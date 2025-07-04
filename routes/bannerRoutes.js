import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Banner from "../models/Banner.js"

const router = express.Router()

const uploadDir = "uploads/banners"
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
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"), false)
    }
  },
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

// POST upload - FINAL VERSION (cleaned and clarified)
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

      // 1️⃣ Type limits (slider max 5, side max 3, etc.)
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

      let bannerData = { type, title: title || "" }

      // 2️⃣ Product-based banner logic
      if (type === "product-type" || type === "side") {
        if (!productId) {
          if (req.file) fs.unlinkSync(req.file.path)
          return res.status(400).json({ message: "Product ID is required for this banner type" })
        }

        if (req.file) fs.unlinkSync(req.file.path) // not used for product banners

        const variantIndex = Number.parseInt(selectedVariantIndex) || 0

        // Prevent same product for same type
        const alreadyExists = await Banner.findOne({
          type,
          productId,
          selectedVariantIndex: variantIndex,
        })

        if (alreadyExists) {
          return res.status(409).json({
            message: "This product variant is already added as a banner of this type",
          })
        }

        bannerData = {
          ...bannerData,
          productId,
          selectedVariantIndex: variantIndex,
          imageUrl: productImageUrl || "",
          price: Number(price) || 0,
          oldPrice: Number(oldPrice) || 0,
          discountPercent: Number(discountPercent) || 0,
        }

        if (weightValue && weightUnit) {
          bannerData.weight = {
            value: Number(weightValue),
            unit: weightUnit,
          }
        }
      } else {
        // 3️⃣ Regular image-based banners
        if (!req.file) {
          return res.status(400).json({ message: "Image file is required for this banner type" })
        }

        bannerData = {
          ...bannerData,
          imageUrl: `/${uploadDir}/${req.file.filename}`,
          hash: hash || null, // don't check uniqueness
        }
      }

      // ✅ Save banner
      const newBanner = new Banner(bannerData)
      const saved = await newBanner.save()

      console.log("✅ Banner saved")
      res.status(201).json(saved)
    } catch (error) {
      console.error("❌ Upload error:", error)

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
