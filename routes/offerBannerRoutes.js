import express from "express"
import multer from "multer"
import OfferBanner from "../models/OfferBanner.js"
import streamifier from "streamifier"
import cloudinary from "../utils/cloudinary.js"

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() }) // Use memory storage for Cloudinary uploads

const streamUpload = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
      },
      (error, result) => {
        if (result) {
          resolve(result)
        } else {
          reject(error)
        }
      },
    )
    streamifier.createReadStream(fileBuffer).pipe(stream)
  })
}

// Upload Offer Banner to Cloudinary
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { title, percentage, slot, linkedProductId, linkedCategory, linkedDiscountUpTo } = req.body
    const file = req.file

    console.log("📥 Offer Upload Request Received:", {
      title,
      percentage,
      slot,
      linkedProductId,
      linkedCategory,
      linkedDiscountUpTo,
    })

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" })
    }
    if (!title || !slot) {
      return res.status(400).json({ message: "Title and slot are required" })
    }

    // Validation for linking: either linkedProductId OR linkedCategory, not both
    if (linkedProductId && linkedCategory) {
      return res.status(400).json({ message: "Cannot link to both a product and a category. Choose one." })
    }
    if (!linkedProductId && !linkedCategory && linkedDiscountUpTo > 0) {
      return res.status(400).json({ message: "Discount percentage requires a linked product or category." })
    }

    const existingBanner = await OfferBanner.findOne({ slot })
    if (existingBanner) {
      return res
        .status(400)
        .json({ message: `An offer banner already exists for slot '${slot}'. Please delete it first.` })
    }

    const result = await streamUpload(file.buffer, "offer-banners")

    const banner = new OfferBanner({
      title,
      percentage: Number(percentage) || 0,
      slot,
      imageUrl: result.secure_url,
      public_id: result.public_id,
      linkedProductId: linkedProductId || null,
      linkedCategory: linkedCategory || null,
      linkedDiscountUpTo: Number(linkedDiscountUpTo) || 0,
    })

    const savedBanner = await banner.save()
    console.log("📝 Offer Banner Saved to DB:", savedBanner)
    res.status(201).json(savedBanner)
  } catch (error) {
    console.error("🔥 Offer Upload Error:", error)
    // Handle Mongoose duplicate key error specifically for unique slot
    if (error.code === 11000 && error.keyPattern && error.keyPattern.slot) {
      return res.status(409).json({ message: `An offer banner already exists for slot '${req.body.slot}'.` })
    }
    res.status(500).json({ message: "Offer upload failed", error: error.message })
  }
})

// Update Offer Banner
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { title, percentage, slot, linkedProductId, linkedCategory, linkedDiscountUpTo } = req.body
    const file = req.file
    const bannerId = req.params.id

    const offerBanner = await OfferBanner.findById(bannerId)
    if (!offerBanner) {
      return res.status(404).json({ message: "Offer banner not found" })
    }

    // Validation for linking: either linkedProductId OR linkedCategory, not both
    if (linkedProductId && linkedCategory) {
      return res.status(400).json({ message: "Cannot link to both a product and a category. Choose one." })
    }
    if (!linkedProductId && !linkedCategory && linkedDiscountUpTo > 0) {
      return res.status(400).json({ message: "Discount percentage requires a linked product or category." })
    }

    // Check for duplicate slot if slot is being changed
    if (slot && slot !== offerBanner.slot) {
      const existingBanner = await OfferBanner.findOne({ slot })
      if (existingBanner && existingBanner._id.toString() !== bannerId) {
        return res.status(400).json({ message: `An offer banner already exists for slot '${slot}'.` })
      }
    }

    if (file) {
      // Delete old image from Cloudinary
      if (offerBanner.public_id) {
        await cloudinary.uploader.destroy(offerBanner.public_id)
        console.log(`🗑️ Cloudinary image deleted: ${offerBanner.public_id}`)
      }
      const result = await streamUpload(file.buffer, "offer-banners")
      offerBanner.imageUrl = result.secure_url
      offerBanner.public_id = result.public_id
    }

    offerBanner.title = title || offerBanner.title
    offerBanner.percentage = Number(percentage) || 0
    offerBanner.slot = slot || offerBanner.slot
    offerBanner.linkedProductId = linkedProductId || null
    offerBanner.linkedCategory = linkedCategory || null
    offerBanner.linkedDiscountUpTo = Number(linkedDiscountUpTo) || 0

    const updatedBanner = await offerBanner.save()
    res.status(200).json(updatedBanner)
  } catch (error) {
    console.error("🔥 Offer Update Error:", error)
    if (error.code === 11000 && error.keyPattern && error.keyPattern.slot) {
      return res.status(409).json({ message: `An offer banner already exists for slot '${req.body.slot}'.` })
    }
    res.status(500).json({ message: "Offer update failed", error: error.message })
  }
})

// Get All Offer Banners
router.get("/", async (req, res) => {
  try {
    const banners = await OfferBanner.find()
    console.log("📦 All Offer Banners Fetched:", banners.length)
    res.json(banners)
  } catch (err) {
    console.error("⚠️ Fetch Error:", err.message)
    res.status(500).json({ message: "Failed to fetch banners", error: err.message })
  }
})

// Delete by ID
router.delete("/:id", async (req, res) => {
  try {
    const offer = await OfferBanner.findById(req.params.id)
    if (!offer) {
      console.log("🔍 Offer not found:", req.params.id)
      return res.status(404).json({ error: "Offer not found" })
    }
    await cloudinary.uploader.destroy(offer.public_id) // Delete from Cloudinary
    await offer.deleteOne() // Delete from MongoDB
    console.log("🗑️ Deleted Offer:", req.params.id)
    res.json({ message: "Offer deleted" })
  } catch (err) {
    console.error("❌ Deletion Error:", err.message)
    res.status(500).json({ error: "Deletion failed", details: err.message })
  }
})

// Delete All
router.delete("/", async (req, res) => {
  try {
    const offers = await OfferBanner.find()
    for (const offer of offers) {
      if (offer.public_id) {
        await cloudinary.uploader.destroy(offer.public_id)
        console.log("🗑️ Cloudinary Image Deleted:", offer.public_id)
      }
    }
    await OfferBanner.deleteMany()
    console.log("🚮 All offer banners deleted")
    res.json({ message: "All offer banners deleted successfully" })
  } catch (err) {
    console.error("❌ Bulk Deletion Error:", err.message)
    res.status(500).json({ error: "Failed to delete all offer banners", details: err.message })
  }
})

export default router
