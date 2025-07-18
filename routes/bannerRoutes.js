import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import Banner from "../models/Banner.js"
import cloudinary from "../utils/cloudinary.js" // Import Cloudinary
import streamifier from "streamifier" // For streaming to Cloudinary

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Local upload directory for product-type banners (which reference local product images)
const uploadDir = path.join(__dirname, "../uploads/banners")
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Multer setup:
// For Cloudinary uploads (homebanner, category), use memory storage.
// For product-type banners, no file upload is needed here as they reference existing product images.
const upload = multer({ storage: multer.memoryStorage() }) // Use memory storage for Cloudinary uploads

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
    const banners = await Banner.find().sort({ createdAt: -1 })
    res.json(banners)
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch banners",
      error: error.message,
    })
  }
})

const BANNER_LIMITS = {
  category: 3,
  homebanner: 5,
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
    const { type, productId, productImageUrl, title, price, oldPrice, discountPercent, weightValue, weightUnit } =
      req.body
    const file = req.file // This will be present for homebanner and category types

    console.log("🔍 Banner Body:", req.body)
    console.log("🖼 Banner File (if any):", file ? "Present" : "Not Present")

    if (!type) {
      return res.status(400).json({ message: "Banner type is required" })
    }

    const currentBannerCount = await Banner.countDocuments({ type })
    if (BANNER_LIMITS[type] && currentBannerCount >= BANNER_LIMITS[type]) {
      return res.status(400).json({ message: `Limit of ${BANNER_LIMITS[type]} banners reached for type '${type}'` })
    }

    const bannerData = { type }

    if (type === "homebanner" || type === "category") {
      if (!file) {
        return res.status(400).json({ message: "Image file is required for this banner type" })
      }
      if (type === "category" && !title) {
        return res.status(400).json({ message: "Title is required for category banners" })
      }

      // Upload to Cloudinary
      const folder = type === "homebanner" ? "home-banners" : "category-banners"
      const result = await streamUpload(file.buffer, folder)

      bannerData.imageUrl = result.secure_url
      bannerData.public_id = result.public_id // Save public_id for deletion
      if (type === "category") {
        bannerData.title = title // Title is the category name for category banners
      }
    } else if (type === "product-type") {
      // Product-type banners still reference local product images, no file upload here
      const existingProductBanner = await Banner.findOne({ type, productId })
      if (existingProductBanner) {
        return res.status(400).json({ message: "Banner for this product already exists." })
      }
      if (!productId || !productImageUrl || !title || !price) {
        return res.status(400).json({
          message: "Product ID, image URL, title, and price are required for this banner type",
        })
      }
      bannerData.productId = productId
      bannerData.imageUrl = productImageUrl // This is a local path from product upload
      bannerData.title = title
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
      if ((banner.type === "homebanner" || banner.type === "category") && banner.public_id) {
        // Delete from Cloudinary
        await cloudinary.uploader.destroy(banner.public_id)
        console.log(`🗑️ Cloudinary image deleted: ${banner.public_id}`)
      }
      // For product-type banners, their images are part of product uploads, not deleted here.
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

    // Delete associated file from Cloudinary if it's a homebanner or category type
    if ((banner.type === "homebanner" || banner.type === "category") && banner.public_id) {
      await cloudinary.uploader.destroy(banner.public_id)
      console.log(`🗑️ Cloudinary image deleted: ${banner.public_id}`)
    }
    // For product-type banners, their images are part of product uploads, not deleted here.

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
