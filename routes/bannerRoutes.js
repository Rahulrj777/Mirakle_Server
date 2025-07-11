import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Banner from "../models/Banner.js"

const router = express.Router()

const uploadDir = "uploads"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
})

// ✅ Debug middleware
router.use((req, res, next) => {
  console.log(`🔥 BANNER ROUTE: ${req.method} ${req.path}`)
  next()
})

// ✅ Test route
router.get("/test", (req, res) => {
  console.log("✅ Banner test route hit")
  res.json({
    message: "Banner routes working!",
    timestamp: new Date().toISOString(),
  })
})

// ✅ GET all banners - This is the main route your frontend needs
router.get("/", async (req, res) => {
  try {
    console.log("📋 Banner request received")
    const banners = await Banner.find().sort({ createdAt: -1 })
    console.log(`✅ Found ${banners.length} banners`)
    res.json(banners)
  } catch (error) {
    console.error("❌ GET banners error:", error)
    res.status(500).json({
      message: "Failed to fetch banners",
      error: error.message,
    })
  }
})

// ✅ POST upload banner
router.post("/upload", (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      console.log("❌ Multer error:", err.message)
      return res.status(400).json({ message: `Upload error: ${err.message}` })
    }

    try {
      const {
        type,
        hash,
        title,
        price,
        weightValue,
        weightUnit,
        oldPrice,
        discountPercent,
        productId,
        selectedVariantIndex,
        productImageUrl,
      } = req.body

      if (!type) {
        if (req.file) fs.unlinkSync(req.file.path)
        return res.status(400).json({ message: "Banner type is required" })
      }

      console.log("✅ Creating banner with type:", type)

      let bannerData = {
        type,
        title: title || "",
      }

      // Handle product-based banners
      if (type === "product-type" || type === "side") {
        if (!productId) {
          if (req.file) fs.unlinkSync(req.file.path)
          return res.status(400).json({ message: "Product ID is required for product-based banners" })
        }

        // Clean up uploaded file (not needed for product banners)
        if (req.file) {
          fs.unlinkSync(req.file.path)
        }

        bannerData = {
          ...bannerData,
          productId,
          selectedVariantIndex: Number.parseInt(selectedVariantIndex) || 0,
          imageUrl: productImageUrl || "",
          price: Number.parseFloat(price) || 0,
          oldPrice: Number.parseFloat(oldPrice) || 0,
          discountPercent: Number.parseFloat(discountPercent) || 0,
        }

        if (weightValue && weightUnit) {
          bannerData.weight = {
            value: Number.parseFloat(weightValue),
            unit: weightUnit,
          }
        }
      } else {
        // Handle regular banners (require image file)
        if (!req.file) {
          return res.status(400).json({ message: "Image file is required for this banner type" })
        }

        bannerData = {
          ...bannerData,
          imageUrl: `/${uploadDir}/${req.file.filename}`,
          hash: hash || null,
        }
      }

      // Save to database
      const banner = new Banner(bannerData)
      const savedBanner = await banner.save()

      console.log("✅ Banner saved successfully")
      res.status(201).json(savedBanner)
    } catch (error) {
      console.error("❌ Upload error:", error)

      // Clean up file if error occurs
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }

      res.status(500).json({
        message: "Server error during upload",
        error: error.message,
      })
    }
  })
})

// ✅ DELETE all banners
router.delete("/", async (req, res) => {
  console.log("🔥 DELETE ALL BANNERS")
  try {
    const { type } = req.query
    let filter = {}

    if (type && type !== "all") {
      filter = { type }
    }

    const banners = await Banner.find(filter)

    // Delete all banner image files (only if not product-type or side)
    banners.forEach((banner) => {
      if (banner.type !== "product-type" && banner.type !== "side" && banner.imageUrl) {
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

// ✅ DELETE single banner
router.delete("/delete/:id", async (req, res) => {
  console.log("🔥 DELETE SINGLE BANNER:", req.params.id)
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)

    if (!banner) {
      return res.status(404).json({ message: "Banner not found" })
    }

    // Delete associated file
    if (banner.type !== "product-type" && banner.type !== "side" && banner.imageUrl) {
      const filePath = path.join(uploadDir, path.basename(banner.imageUrl))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    res.json({ message: "Banner deleted successfully" })
  } catch (error) {
    console.error("❌ Delete error:", error)
    res.status(500).json({
      message: "Failed to delete banner",
      error: error.message,
    })
  }
})

export default router
