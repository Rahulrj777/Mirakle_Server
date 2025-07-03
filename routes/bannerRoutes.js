// routes/bannerRoutes.js
import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Banner from "../models/Banner.js"

const router = express.Router()

const uploadDir = "uploads"
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
})

const upload = multer({ storage })

// Add debugging middleware
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`)
  next()
})

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Banner routes working", timestamp: new Date().toISOString() })
})

/**
 * GET /api/banners
 */
router.get("/", async (req, res) => {
  console.log("=== GET BANNERS REQUEST ===")

  try {
    const banners = await Banner.find().populate("productId", "title images variants")
    console.log(`✅ Found ${banners.length} banners`)
    res.json(banners)
  } catch (error) {
    console.log("❌ Get banners error:", error)
    res.status(500).json({
      message: "Failed to fetch banners",
      error: error.message,
    })
  }
})

/**
 * POST /api/banners/upload - Following the exact same pattern as product upload
 */
router.post("/upload", upload.single("image"), async (req, res) => {
  console.log("=== UPLOAD REQUEST START ===")
  console.log("Request body:", req.body)
  console.log("File:", req.file ? "Present" : "Not present")

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

    console.log("✅ Banner type:", type)

    // Check limits
    const typeLimits = {
      slider: 5,
      side: 3,
      offer: 1,
      "product-type": 10,
    }

    const maxLimit = typeLimits[type] || 10
    const count = await Banner.countDocuments({ type })
    console.log(`📊 Current count for ${type}: ${count}/${maxLimit}`)

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
      console.log("🛍️ Processing product-based banner")

      if (!productId) {
        if (req.file) fs.unlinkSync(req.file.path)
        return res.status(400).json({ message: "Product ID is required for product-based banners" })
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

      console.log("💾 Product banner data:", bannerData)
    } else {
      // Handle regular banners with file upload (same as product logic)
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

    // Save to database (same as product logic)
    const banner = new Banner(bannerData)
    await banner.save()

    console.log("✅ Banner saved successfully")
    res.status(201).json(banner)
  } catch (err) {
    console.error("❌ Upload error:", err)
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    if (err.code === 11000) return res.status(409).json({ message: "Duplicate entry." })
    res.status(500).json({ message: "Server error", error: err.message })
  }

  console.log("=== UPLOAD REQUEST END ===")
})

/**
 * PUT /api/banners/:id - Following the exact same pattern as product update
 */
router.put("/:id", upload.single("image"), async (req, res) => {
  console.log("=== UPDATE REQUEST START ===")
  console.log("Banner ID:", req.params.id)
  console.log("Request body:", req.body)
  console.log("File:", req.file ? "Present" : "Not present")

  try {
    const {
      type,
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

    const banner = await Banner.findById(req.params.id)
    if (!banner) return res.status(404).json({ message: "Banner not found" })

    // Update basic fields
    banner.type = type || banner.type
    banner.title = title || banner.title

    // Handle product-based banner updates
    if (type === "product-type" || type === "side") {
      if (productId) banner.productId = productId
      if (selectedVariantIndex !== undefined) banner.selectedVariantIndex = Number.parseInt(selectedVariantIndex)
      if (productImageUrl) banner.imageUrl = productImageUrl
      if (price) banner.price = Number.parseFloat(price)
      if (oldPrice) banner.oldPrice = Number.parseFloat(oldPrice)
      if (discountPercent) banner.discountPercent = Number.parseFloat(discountPercent)

      if (weightValue && weightUnit) {
        banner.weight = { value: Number.parseFloat(weightValue), unit: weightUnit }
      }
    } else {
      // Handle regular banner updates with potential new image
      if (req.file) {
        banner.imageUrl = `/${uploadDir}/${req.file.filename}`
        if (req.body.hash) {
          banner.hash = req.body.hash
        }
      }
    }

    await banner.save()

    console.log("✅ Banner updated successfully")
    res.json({ message: "Banner updated successfully", banner })
  } catch (err) {
    console.error("❌ Update error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }

  console.log("=== UPDATE REQUEST END ===")
})

/**
 * DELETE /api/banners/:id - Following the exact same pattern as product delete
 */
router.delete("/:id", async (req, res) => {
  console.log("=== DELETE REQUEST ===")
  console.log("Banner ID:", req.params.id)

  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)
    if (!banner) return res.status(404).json({ message: "Banner not found" })

    // Delete file if it's not a product-based banner (same logic as products)
    if (banner.type !== "product-type" && banner.type !== "side" && banner.imageUrl) {
      const fullPath = path.join(uploadDir, path.basename(banner.imageUrl))
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
        console.log("✅ File deleted:", fullPath)
      }
    }

    console.log("✅ Banner deleted successfully")
    res.json({ message: "Banner deleted successfully" })
  } catch (error) {
    console.log("❌ Delete error:", error)
    res.status(500).json({
      message: "Failed to delete banner",
      error: error.message,
    })
  }
})

export default router
