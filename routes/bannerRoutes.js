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

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔥 BANNER: ${req.method} ${req.originalUrl}`)
  next()
})

// Test route
router.get("/test", (req, res) => {
  console.log("✅ Banner test route working")
  res.json({ message: "Banner routes working!", timestamp: new Date().toISOString() })
})

// GET all banners
router.get("/", async (req, res) => {
  console.log("🔥 GET BANNERS")

  try {
    const banners = await Banner.find().populate("productId", "title images variants")
    console.log(`✅ Found ${banners.length} banners`)
    res.json(banners)
  } catch (error) {
    console.error("❌ Get banners error:", error)
    res.status(500).json({ message: "Failed to fetch banners", error: error.message })
  }
})

// POST upload
router.post("/upload", (req, res) => {
  console.log("🔥 UPLOAD START")

  upload.single("image")(req, res, async (err) => {
    if (err) {
      console.log("❌ Multer error:", err)
      return res.status(400).json({ message: `Upload error: ${err.message}` })
    }

    console.log("✅ Multer processed")
    console.log("📝 Body:", req.body)
    console.log("📁 File:", req.file ? "Present" : "Not present")

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

      console.log("✅ Type:", type)

      // Check limits
      const typeLimits = { slider: 5, side: 3, offer: 1, "product-type": 10 }
      const maxLimit = typeLimits[type] || 10
      const count = await Banner.countDocuments({ type })

      console.log(`📊 Current count for ${type}: ${count}/${maxLimit}`)

      if (count >= maxLimit) {
        if (req.file) fs.unlinkSync(req.file.path)
        return res.status(400).json({ message: `Only ${maxLimit} banners allowed for ${type}` })
      }

      let bannerData = { type, title: title || "" }

      // Handle product-based banners
      if (type === "product-type" || type === "side") {
        console.log("🛍️ Processing product-based banner")

        if (!productId) {
          if (req.file) fs.unlinkSync(req.file.path)
          return res.status(400).json({ message: "Product ID is required for product-based banners" })
        }

        // Clean up any uploaded file since we don't need it for product banners
        if (req.file) {
          fs.unlinkSync(req.file.path)
          console.log("🗑️ Cleaned up unnecessary file for product banner")
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
          bannerData.weight = { value: Number.parseFloat(weightValue), unit: weightUnit }
        }

        console.log("💾 Product banner data:", bannerData)
      } else {
        // Handle regular banners
        console.log("🖼️ Processing regular banner")

        if (!req.file) {
          return res.status(400).json({ message: "Image file is required for this banner type" })
        }

        if (!hash) {
          fs.unlinkSync(req.file.path)
          return res.status(400).json({ message: "File hash is required" })
        }

        // Check for duplicates
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

        console.log("💾 Regular banner data:", bannerData)
      }

      // Save to database
      const banner = new Banner(bannerData)
      await banner.save()

      console.log("✅ Banner saved successfully")
      res.status(201).json(banner)
    } catch (error) {
      console.error("❌ Upload error:", error)
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      res.status(500).json({ message: "Server error", error: error.message })
    }

    console.log("🔥 UPLOAD END")
  })
})

// DELETE banner
router.delete("/:id", async (req, res) => {
  console.log("🔥 DELETE:", req.params.id)

  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" })
    }

    // Delete file if it's not a product-based banner
    if (banner.type !== "product-type" && banner.type !== "side" && banner.imageUrl) {
      const filePath = path.join(uploadDir, path.basename(banner.imageUrl))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        console.log("✅ File deleted:", filePath)
      }
    }

    console.log("✅ Banner deleted successfully")
    res.json({ message: "Banner deleted successfully" })
  } catch (error) {
    console.error("❌ Delete error:", error)
    res.status(500).json({ message: "Failed to delete banner", error: error.message })
  }
})

export default router
