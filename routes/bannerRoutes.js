import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import Banner from "../models/Banner.js"
import cloudinary from "../utils/cloudinary.js" 
import streamifier from "streamifier" 

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const uploadDir = path.join(__dirname, "../uploads/banners")
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const upload = multer({ storage: multer.memoryStorage() })

router.use((req, res, next) => {
  console.log(`🔥 BANNER ROUTE: ${req.method} ${req.path}`)
  next()
})

router.get("/test", (req, res) => {
  console.log("✅ Banner test route hit")
  res.json({
    message: "Banner routes working!",
    timestamp: new Date().toISOString(),
  })
})

router.get("/", async (req, res) => {
  try {
    const { type } = req.query
    const filter = {}
    if (type) {
      filter.type = type
    }
    const banners = await Banner.find(filter).sort({ createdAt: -1 })
    res.json(banners)
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch banners",
      error: error.message,
    })
  }
})

const BANNER_LIMITS = {
  homebanner: 5,
  category: 3, 
  offerbanner: 2, 
  "product-type": 10,
}

// Helper function to upload buffer to Cloudinary
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

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const {
      type,
      productId,
      productImageUrl,
      title,
      price,
      oldPrice,
      discountPercent,
      weightValue,
      weightUnit,
      percentage,
      slot,
    } = req.body
    const file = req.file

    console.log("🔍 Banner Body:", req.body)
    console.log("🖼 Banner File (if any):", file ? "Present" : "Not Present")

    if (!type) {
      return res.status(400).json({ message: "Banner type is required" })
    }

    // Check limits for specific banner types
    if (BANNER_LIMITS[type]) {
      const currentBannerCount = await Banner.countDocuments({ type })
      if (currentBannerCount >= BANNER_LIMITS[type]) {
        return res.status(400).json({ message: `Limit of ${BANNER_LIMITS[type]} banners reached for type '${type}'` })
      }
    }

    const bannerData = { type }

    if (type === "homebanner") {
      if (!file) {
        return res.status(400).json({ message: "Image file is required for homebanner type" })
      }
      // No title needed for homebanner, as per new model/logic
      const result = await streamUpload(file.buffer, "home-banners")
      bannerData.imageUrl = result.secure_url
      bannerData.public_id = result.public_id
    } else if (type === "category") {
      if (!file) {
        return res.status(400).json({ message: "Image file is required for category banners" })
      }
      if (!title) {
        return res.status(400).json({ message: "Title is required for category banners" })
      }
      // ✅ NEW: Check for duplicate category title
      const existingCategoryBanner = await Banner.findOne({ type: "category", title: title.trim() })
      if (existingCategoryBanner) {
        return res.status(400).json({ message: `A category banner with title '${title}' already exists.` })
      }

      const result = await streamUpload(file.buffer, "category-banners")
      bannerData.imageUrl = result.secure_url
      bannerData.public_id = result.public_id
      bannerData.title = title.trim() // Title is the category name
    } else if (type === "offerbanner") {
      if (!file) {
        return res.status(400).json({ message: "Image file is required for offer banners" })
      }
      if (!title || !slot) {
        return res.status(400).json({ message: "Title and slot are required for offer banners" })
      }
      // ✅ NEW: Check for duplicate offer slot (already in model, but explicit check here)
      const existingOfferBanner = await Banner.findOne({ type: "offerbanner", slot })
      if (existingOfferBanner) {
        return res.status(400).json({ message: `An offer banner already exists for slot '${slot}'.` })
      }

      const result = await streamUpload(file.buffer, "offer-banners")
      bannerData.imageUrl = result.secure_url
      bannerData.public_id = result.public_id
      bannerData.title = title.trim()
      bannerData.percentage = Number(percentage) || 0
      bannerData.slot = slot
    } else if (type === "product-type") {
      // Product-type banners still reference local product images, no file upload here
      if (!productId || !productImageUrl || !title || !price) {
        return res.status(400).json({
          message: "Product ID, image URL, title, and price are required for this banner type",
        })
      }
      // ✅ Existing: Check for duplicate product ID for product-type banners
      const existingProductBanner = await Banner.findOne({ type: "product-type", productId })
      if (existingProductBanner) {
        return res.status(400).json({ message: "Banner for this product already exists." })
      }

      bannerData.productId = productId
      bannerData.imageUrl = productImageUrl 
      bannerData.title = title.trim()
      bannerData.price = Number(price)
      bannerData.oldPrice = Number(oldPrice) || 0
      bannerData.discountPercent = Number(discountPercent) || 0
      if (weightValue && weightUnit) {
        bannerData.weight = { value: Number(weightValue), unit: weightUnit }
      }
    } else {
      return res.status(400).json({ message: "Invalid banner type" })
    }

    const banner = new Banner(bannerData)
    const savedBanner = await banner.save()
    console.log("✅ Banner saved successfully:", savedBanner._id)
    res.status(201).json(savedBanner)
  } catch (error) {
    console.error("❌ Upload error:", error)
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.slot) {
        return res.status(409).json({ message: "An offer banner already exists for this slot." })
      }
      if (error.keyPattern && error.keyPattern.title && error.keyPattern.type) {
        return res.status(409).json({ message: "A category banner with this title already exists." })
      }
    }
    res.status(500).json({
      message: "Server error during upload",
      error: error.message,
    })
  }
})

router.delete("/", async (req, res) => {
  console.log("🔥 DELETE ALL BANNERS")
  try {
    const { type } = req.query
    let filter = {}

    if (type && type !== "all") {
      filter = { type }
    }

    const bannersToDelete = await Banner.find(filter)

    for (const banner of bannersToDelete) {
      if (
        (banner.type === "homebanner" || banner.type === "category" || banner.type === "offerbanner") &&
        banner.public_id
      ) {
        await cloudinary.uploader.destroy(banner.public_id)
        console.log(`🗑️ Cloudinary image deleted: ${banner.public_id}`)
      }
    }

    const result = await Banner.deleteMany(filter)

    const message =
      type && type !== "all"
        ? `All ${type} banners deleted successfully (${result.deletedCount} banners)`
        : `All banners deleted successfully (${result.deletedCount} banners)`

    res.json({ message, deletedCount: result.deletedCount })
  } catch (error) {
    console.error("❌ Failed to delete banners:", error)
    res.status(500).json({
      message: "Failed to delete banners",
      error: error.message,
    })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)

    if (!banner) {
      return res.status(404).json({ message: "Banner not found" })
    }

    if (
      (banner.type === "homebanner" || banner.type === "category" || banner.type === "offerbanner") &&
      banner.public_id
    ) {
      await cloudinary.uploader.destroy(banner.public_id)
      console.log(`🗑️ Cloudinary image deleted: ${banner.public_id}`)
    }

    res.status(200).json({ message: "Banner deleted successfully" })
  } catch (error) {
    console.error("❌ Failed to delete banner:", error)
    res.status(500).json({
      message: "Failed to delete banner",
      error: error.message,
    })
  }
})

export default router
