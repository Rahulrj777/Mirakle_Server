// routes/bannerRoutes.js
import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Banner from "../models/Banner.js"

const router = express.Router()

const uploadDir = "uploads"
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir)

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
})

const upload = multer({ storage })

// POST /upload
router.post("/upload", async (req, res) => {
  try {
    console.log("Upload request received:", req.body)

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
      return res.status(400).json({ message: "Banner type is required" })
    }

    // Check limits
    const typeLimits = {
      slider: 5,
      side: 3,
      offer: 1,
      "product-type": 10,
    }

    const maxLimit = typeLimits[type] || 10
    const count = await Banner.countDocuments({ type })

    if (count >= maxLimit) {
      return res.status(400).json({ message: `Only ${maxLimit} banners allowed for ${type}` })
    }

    // Handle product-based banners (no file upload needed)
    if (type === "product-type" || type === "side") {
      if (!productId) {
        return res.status(400).json({ message: "Product selection is required" })
      }

      const bannerData = {
        type,
        productId,
        selectedVariantIndex: Number.parseInt(selectedVariantIndex) || 0,
        imageUrl: productImageUrl,
        title: title || "",
        price: price ? Number.parseFloat(price) : 0,
        oldPrice: oldPrice ? Number.parseFloat(oldPrice) : 0,
        discountPercent: discountPercent ? Number.parseFloat(discountPercent) : 0,
        ...(weightValue && weightUnit ? { weight: { value: Number.parseFloat(weightValue), unit: weightUnit } } : {}),
      }

      const banner = new Banner(bannerData)
      await banner.save()
      return res.status(201).json(banner)
    }

    // Handle regular banners with file upload
    upload.single("image")(req, res, async (err) => {
      if (err) {
        console.error("Multer error:", err)
        return res.status(400).json({ message: "File upload failed" })
      }

      if (!req.file) {
        return res.status(400).json({ message: "Image file is required" })
      }

      if (!hash) {
        fs.unlinkSync(req.file.path)
        return res.status(400).json({ message: "File hash is required" })
      }

      try {
        // Check for duplicates
        const existing = await Banner.findOne({ type, hash })
        if (existing) {
          fs.unlinkSync(req.file.path)
          return res.status(409).json({ message: "This image already exists" })
        }

        const bannerData = {
          type,
          imageUrl: `/${uploadDir}/${req.file.filename}`,
          hash,
          title: title || "",
        }

        const banner = new Banner(bannerData)
        await banner.save()
        res.status(201).json(banner)
      } catch (saveErr) {
        console.error("Save error:", saveErr)
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        res.status(500).json({ message: "Failed to save banner", error: saveErr.message })
      }
    })
  } catch (err) {
    console.error("Upload route error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// PUT /:id
router.put("/:id", async (req, res) => {
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

    // Handle product-based banner updates
    if (type === "product-type" || type === "side") {
      const updates = {
        type,
        title: title || "",
        productId,
        selectedVariantIndex: Number.parseInt(selectedVariantIndex) || 0,
        imageUrl: productImageUrl,
        price: price ? Number.parseFloat(price) : 0,
        oldPrice: oldPrice ? Number.parseFloat(oldPrice) : 0,
        discountPercent: discountPercent ? Number.parseFloat(discountPercent) : 0,
        ...(weightValue && weightUnit ? { weight: { value: Number.parseFloat(weightValue), unit: weightUnit } } : {}),
      }

      const updated = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true })
      if (!updated) return res.status(404).json({ message: "Banner not found" })
      return res.json(updated)
    }

    // Handle regular banner updates with potential file upload
    upload.single("image")(req, res, async (uploadErr) => {
      try {
        const updates = { type, title: title || "" }

        if (req.file) {
          updates.imageUrl = `/${uploadDir}/${req.file.filename}`
        }

        const updated = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true })
        if (!updated) return res.status(404).json({ message: "Banner not found" })
        res.json(updated)
      } catch (updateErr) {
        console.error("Update error:", updateErr)
        res.status(500).json({ message: "Update failed", error: updateErr.message })
      }
    })
  } catch (err) {
    console.error("Put route error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// GET /
router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find().populate("productId", "title images variants")
    res.json(banners)
  } catch (err) {
    console.error("Get banners error:", err)
    res.status(500).json({ message: "Failed to fetch banners", error: err.message })
  }
})

// DELETE /:id
router.delete("/:id", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)
    if (!banner) return res.status(404).json({ message: "Banner not found" })

    // Only delete file if it's not a product-based banner
    if (banner.type !== "product-type" && banner.type !== "side" && banner.imageUrl) {
      const filePath = path.join(uploadDir, path.basename(banner.imageUrl))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    res.json({ message: "Banner deleted successfully" })
  } catch (err) {
    console.error("Delete error:", err)
    res.status(500).json({ message: "Failed to delete banner", error: err.message })
  }
})

export default router
