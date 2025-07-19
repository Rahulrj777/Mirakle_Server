import express from "express"
import multer from "multer"
import OfferBanner from "../models/OfferBanner.js"
import cloudinary from "../utils/cloudinary.js"
import streamifier from "streamifier"

const router = express.Router()

// Use memory storage for Cloudinary uploads
const upload = multer({ storage: multer.memoryStorage() })

// Function to upload stream to Cloudinary
const streamUpload = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
      },
      (error, result) => {
        if (error) return reject(error)
        resolve(result)
      },
    )
    streamifier.createReadStream(buffer).pipe(stream)
  })
}

router.use((req, res, next) => {
  console.log(`🔥 OFFER BANNER ROUTE: ${req.method} ${req.path}`)
  next()
})

// Get all offer banners
router.get("/", async (req, res) => {
  try {
    const offerBanners = await OfferBanner.find().sort({ createdAt: -1 })
    res.json(offerBanners)
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch offer banners",
      error: error.message,
    })
  }
})

// Upload a new offer banner
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const {
      title,
      percentage,
      slot,
      linkedProductId,
      linkedCategory,
      linkedDiscountUpTo,
      linkedUrl,
      offerLinkType, // This field is sent from frontend to indicate which link type is active
    } = req.body
    const file = req.file

    console.log("🔍 Offer Banner Body:", req.body)
    console.log("🖼 Offer Banner File:", file ? "Present" : "Not Present")

    if (!file) {
      return res.status(400).json({ message: "Image file is required for offer banners" })
    }
    if (!title || percentage === undefined || percentage === null || !slot) {
      return res.status(400).json({ message: "Title, percentage, and slot are required for offer banners" })
    }
    if (isNaN(Number(percentage)) || Number(percentage) < 0 || Number(percentage) > 100) {
      return res.status(400).json({ message: "Percentage must be a number between 0 and 100." })
    }

    // Check for duplicate offer slot
    const existingOfferBanner = await OfferBanner.findOne({ slot })
    if (existingOfferBanner) {
      return res.status(400).json({ message: `An offer banner already exists for slot '${slot}'.` })
    }

    const result = await cloudinary.uploader.upload_stream(
      {
        folder: "offer-banners",
      },
      async (error, result) => {
        if (error) {
          console.error("❌ Cloudinary upload error:", error)
          return res.status(500).json({ message: "Failed to upload image to Cloudinary", error: error.message })
        }

        const bannerData = {
          title: title.trim(),
          imageUrl: result.secure_url,
          public_id: result.public_id,
          percentage: Number(percentage),
          slot,
          linkedProductId: null, // Reset all linking fields
          linkedCategory: null,
          linkedDiscountUpTo: null,
          linkedUrl: null,
        }

        // Set the active linking field based on offerLinkType
        if (offerLinkType === "product" && linkedProductId) {
          bannerData.linkedProductId = linkedProductId
        } else if (offerLinkType === "category" && linkedCategory) {
          bannerData.linkedCategory = linkedCategory.trim()
        } else if (offerLinkType === "discount" && linkedDiscountUpTo !== undefined && linkedDiscountUpTo !== null) {
          const discountVal = Number(linkedDiscountUpTo)
          if (isNaN(discountVal) || discountVal < 0 || discountVal > 100) {
            return res.status(400).json({ message: "Linked Discount Up To must be a number between 0 and 100." })
          }
          bannerData.linkedDiscountUpTo = discountVal
        } else if (offerLinkType === "url" && linkedUrl) {
          bannerData.linkedUrl = linkedUrl.trim()
        }

        const newOfferBanner = new OfferBanner(bannerData)
        try {
          const savedBanner = await newOfferBanner.save()
          console.log("✅ Offer Banner saved successfully:", savedBanner._id)
          res.status(201).json(savedBanner)
        } catch (dbError) {
          console.error("❌ Database save error:", dbError)
          // If DB save fails, attempt to delete the uploaded image from Cloudinary
          if (result.public_id) {
            await cloudinary.uploader.destroy(result.public_id).catch(console.error)
          }
          if (dbError.code === 11000) {
            return res.status(409).json({ message: "An offer banner already exists for this slot." })
          }
          res.status(500).json({ message: "Server error during save", error: dbError.message })
        }
      },
    )
    streamifier.createReadStream(file.buffer).pipe(result)
  } catch (error) {
    console.error("❌ Upload request error:", error)
    res.status(500).json({
      message: "Server error during upload request processing",
      error: error.message,
    })
  }
})

// Update an existing offer banner
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const {
      title,
      percentage,
      slot,
      linkedProductId,
      linkedCategory,
      linkedDiscountUpTo,
      linkedUrl,
      offerLinkType, // This field is sent from frontend to indicate which link type is active
    } = req.body
    const file = req.file

    const offerBanner = await OfferBanner.findById(req.params.id)
    if (!offerBanner) {
      return res.status(404).json({ message: "Offer banner not found" })
    }

    // Update image if a new file is provided
    if (file) {
      // Delete old image from Cloudinary
      if (offerBanner.public_id) {
        await cloudinary.uploader.destroy(offerBanner.public_id)
        console.log(`🗑️ Old offer banner image deleted: ${offerBanner.public_id}`)
      }
      const result = await streamUpload(file.buffer, "offer-banners")
      offerBanner.imageUrl = result.secure_url
      offerBanner.public_id = result.public_id
    }

    // Update basic fields
    offerBanner.title = title?.trim() || offerBanner.title
    offerBanner.percentage =
      percentage !== undefined && percentage !== null ? Number(percentage) : offerBanner.percentage
    if (isNaN(offerBanner.percentage) || offerBanner.percentage < 0 || offerBanner.percentage > 100) {
      return res.status(400).json({ message: "Percentage must be a number between 0 and 100." })
    }

    // Check for slot change and duplicate
    if (slot && offerBanner.slot !== slot) {
      const existingSlotBanner = await OfferBanner.findOne({ slot })
      if (existingSlotBanner && String(existingSlotBanner._id) !== String(offerBanner._id)) {
        return res.status(400).json({ message: `An offer banner already exists for slot '${slot}'.` })
      }
      offerBanner.slot = slot
    }

    // Reset all linking fields before setting the active one
    offerBanner.linkedProductId = null
    offerBanner.linkedCategory = null
    offerBanner.linkedDiscountUpTo = null
    offerBanner.linkedUrl = null

    // Set the active linking field based on offerLinkType
    if (offerLinkType === "product" && linkedProductId) {
      offerBanner.linkedProductId = linkedProductId
    } else if (offerLinkType === "category" && linkedCategory) {
      offerBanner.linkedCategory = linkedCategory.trim()
    } else if (offerLinkType === "discount" && linkedDiscountUpTo !== undefined && linkedDiscountUpTo !== null) {
      const discountVal = Number(linkedDiscountUpTo)
      if (isNaN(discountVal) || discountVal < 0 || discountVal > 100) {
        return res.status(400).json({ message: "Linked Discount Up To must be a number between 0 and 100." })
      }
      offerBanner.linkedDiscountUpTo = discountVal
    } else if (offerLinkType === "url" && linkedUrl) {
      offerBanner.linkedUrl = linkedUrl.trim()
    }

    const updatedOfferBanner = await offerBanner.save()
    console.log("✅ Offer Banner updated successfully:", updatedOfferBanner._id)
    res.status(200).json(updatedOfferBanner)
  } catch (error) {
    console.error("❌ Update error:", error)
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.slot) {
        return res.status(409).json({ message: "An offer banner already exists for this slot." })
      }
    }
    res.status(500).json({
      message: "Server error during update",
      error: error.message,
    })
  }
})

// Delete all offer banners
router.delete("/", async (req, res) => {
  console.log("🔥 DELETE ALL OFFER BANNERS")
  try {
    const bannersToDelete = await OfferBanner.find({})
    for (const banner of bannersToDelete) {
      if (banner.public_id) {
        await cloudinary.uploader.destroy(banner.public_id)
        console.log(`🗑️ Cloudinary image deleted: ${banner.public_id}`)
      }
    }
    const result = await OfferBanner.deleteMany({})
    res.json({
      message: `All offer banners deleted successfully (${result.deletedCount} banners)`,
      deletedCount: result.deletedCount,
    })
  } catch (error) {
    console.error("❌ Failed to delete all offer banners:", error)
    res.status(500).json({
      message: "Failed to delete all offer banners",
      error: error.message,
    })
  }
})

// Delete a single offer banner by ID
router.delete("/:id", async (req, res) => {
  try {
    const offerBanner = await OfferBanner.findByIdAndDelete(req.params.id)
    if (!offerBanner) {
      return res.status(404).json({ message: "Offer banner not found" })
    }

    if (offerBanner.public_id) {
      await cloudinary.uploader.destroy(offerBanner.public_id)
      console.log(`🗑️ Cloudinary image deleted: ${offerBanner.public_id}`)
    }

    res.status(200).json({ message: "Offer banner deleted successfully" })
  } catch (error) {
    console.error("❌ Failed to delete offer banner:", error)
    res.status(500).json({
      message: "Failed to delete offer banner",
      error: error.message,
    })
  }
})

export default router
