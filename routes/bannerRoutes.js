import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Banner from "../models/Banner.js"
import { fileURLToPath } from "url" // Import for __dirname equivalent

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const uploadDir = path.join(__dirname, "../uploads/banners") // Use path.join with __dirname
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir) // Use the absolute path
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  },
})

const upload = multer({ storage })

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

// Refactored POST route to use multer as middleware
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const {
      type,
      productId,
      selectedVariantIndex,
      productImageUrl,
      title,
      price,
      oldPrice,
      discountPercent,
      weightValue,
      weightUnit,
    } = req.body

    console.log("🔍 Banner Body:", req.body)
    console.log("🖼 Banner File:", req.file)

    if (!type) {
      if (req.file) fs.unlinkSync(req.file.path)
      return res.status(400).json({ message: "Banner type is required" })
    }

    const bannerData = { type }

    if (type === "main" || type === "offer") {
      // "slider" mapped to "main"
      if (!req.file) {
        return res.status(400).json({ message: "Image file is required for this banner type" })
      }
      bannerData.imageUrl = `/uploads/banners/${req.file.filename}`
      // You had 'hash' in your frontend, but it's not in the schema. If needed, add to schema.
      // bannerData.hash = hash || null;
    } else if (type === "product-type" || type === "side") {
      if (!productId || !productImageUrl || !title || !price) {
        return res
          .status(400)
          .json({ message: "Product ID, image URL, title, and price are required for this banner type" })
      }
      bannerData.productId = productId
      bannerData.imageUrl = productImageUrl // Use the product's image URL
      bannerData.title = title
      bannerData.price = Number.parseFloat(price)
      bannerData.oldPrice = Number.parseFloat(oldPrice) || 0
      bannerData.discountPercent = Number.parseFloat(discountPercent) || 0
      if (weightValue && weightUnit) {
        bannerData.weight = { value: Number.parseFloat(weightValue), unit: weightUnit }
      }
      // No new image upload needed for these types, so req.file is not expected
      if (req.file) {
        // If a file was accidentally uploaded, delete it
        fs.unlinkSync(req.file.path)
      }
    } else {
      if (req.file) fs.unlinkSync(req.file.path) // Delete any unexpected file uploads
      return res.status(400).json({ message: "Invalid banner type" })
    }

    const banner = new Banner(bannerData)
    const savedBanner = await banner.save()
    console.log("✅ Banner saved successfully:", savedBanner._id)
    res.status(201).json(savedBanner)
  } catch (error) {
    console.error("❌ Upload error:", error)
    // Ensure any uploaded file is deleted on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
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
    const banners = await Banner.find(filter)
    banners.forEach((banner) => {
      // Only delete physical files for 'main' and 'offer' types
      if ((banner.type === "main" || banner.type === "offer") && banner.imageUrl) {
        const filePath = path.join(uploadDir, path.basename(banner.imageUrl))
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    })
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
    // Only delete physical files for 'main' and 'offer' types
    if ((banner.type === "main" || banner.type === "offer") && banner.imageUrl) {
      const filePath = path.join(uploadDir, path.basename(banner.imageUrl))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
    res.json({ message: "Banner deleted successfully" })
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete banner",
      error: error.message,
    })
  }
})

export default router
