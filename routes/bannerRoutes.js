import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Banner from "../models/Banner.js"

const router = express.Router()

// Ensure upload directory exists
const uploadDir = "uploads"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"), false)
    }
  },
})

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔥 BANNER ROUTE: ${req.method} ${req.originalUrl}`)
  next()
})

// Test route
router.get("/test", (req, res) => {
  res.json({
    message: "Banner routes working!",
    timestamp: new Date().toISOString(),
  })
})

// GET all banners
router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find().populate("productId", "title images variants")
    res.json(banners)
  } catch (error) {
    console.error("❌ GET banners error:", error)
    res.status(500).json({
      message: "Failed to fetch banners",
      error: error.message,
    })
  }
})

// POST upload with better duplicate handling
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

      // Check type limits
      const typeLimits = {
        slider: 5,
        side: 3,
        offer: 1,
        "product-type": 10,
      }

      const maxLimit = typeLimits[type] || 10
      const count = await Banner.countDocuments({ type })

      if (count >= maxLimit) {
        if (req.file) fs.unlinkSync(req.file.path)
        return res.status(400).json({ message: `Only ${maxLimit} banners allowed for ${type}` })
      }

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

        // Check for existing product banner of same type
        const existingProductBanner = await Banner.findOne({
          type,
          productId,
          selectedVariantIndex: Number.parseInt(selectedVariantIndex) || 0,
        })

        if (existingProductBanner) {
          return res.status(409).json({
            message: "This product variant is already added as a banner of this type",
          })
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

        if (!hash) {
          fs.unlinkSync(req.file.path)
          return res.status(400).json({ message: "File hash is required" })
        }

        // Check for duplicates (only for regular banners with hash)
        const existing = await Banner.findOne({ type, hash })
        if (existing) {
          fs.unlinkSync(req.file.path)
          return res.status(409).json({ message: "This image already exists in the selected type" })
        }

        bannerData = {
          ...bannerData,
          imageUrl: `/${uploadDir}/${req.file.filename}`,
          hash,
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

      // Handle specific MongoDB errors
      if (error.code === 11000) {
        return res.status(409).json({
          message: "Duplicate entry detected. This banner already exists.",
        })
      }

      res.status(500).json({
        message: "Server error during upload",
        error: error.message,
      })
    }
  })
})

// DELETE banner
router.delete("/:id", async (req, res) => {
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
