// Save this as bannerRoutes.js (replace your existing one)
import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Banner from "../models/Banner.js"

const router = express.Router()

// Create uploads directory
const uploadDir = "uploads"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
  console.log("✅ Created uploads directory")
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("📁 Multer destination called")
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + "-" + file.originalname
    console.log("📝 Multer filename:", filename)
    cb(null, filename)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    console.log("🔍 File filter:", file.mimetype)
    cb(null, true)
  },
})

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔥 BANNER ROUTE: ${req.method} ${req.originalUrl}`)
  console.log("🔥 Headers:", req.headers)
  next()
})

// Simple test route
router.get("/test", (req, res) => {
  console.log("✅ Banner test route hit")
  res.json({
    message: "Banner routes are working!",
    timestamp: new Date().toISOString(),
    uploadDir: uploadDir,
    uploadsExists: fs.existsSync(uploadDir),
  })
})

// GET all banners - SIMPLIFIED
router.get("/", async (req, res) => {
  console.log("🔥 GET BANNERS REQUEST")

  try {
    const banners = await Banner.find()
    console.log(`✅ Found ${banners.length} banners`)

    res.status(200).json(banners)
  } catch (error) {
    console.error("❌ GET banners error:", error)
    res.status(500).json({
      message: "Failed to fetch banners",
      error: error.message,
    })
  }
})

// POST upload - SIMPLIFIED
router.post("/upload", upload.single("image"), async (req, res) => {
  console.log("🔥 UPLOAD REQUEST START")
  console.log("📝 Body:", req.body)
  console.log("📁 File:", req.file ? "Present" : "Missing")

  try {
    const { type, hash } = req.body

    if (!type) {
      console.log("❌ No type provided")
      if (req.file) fs.unlinkSync(req.file.path)
      return res.status(400).json({ message: "Banner type is required" })
    }

    console.log("✅ Type:", type)

    // For now, let's just handle regular banners to test
    if (!req.file) {
      console.log("❌ No file provided")
      return res.status(400).json({ message: "Image file is required" })
    }

    if (!hash) {
      console.log("❌ No hash provided")
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ message: "File hash is required" })
    }

    console.log("✅ File saved to:", req.file.path)
    console.log("✅ Hash:", hash)

    // Check for duplicates
    const existing = await Banner.findOne({ type, hash })
    if (existing) {
      console.log("❌ Duplicate found")
      fs.unlinkSync(req.file.path)
      return res.status(409).json({ message: "This image already exists" })
    }

    // Create banner data
    const bannerData = {
      type,
      imageUrl: `/${uploadDir}/${req.file.filename}`,
      hash,
      title: req.body.title || "",
    }

    console.log("💾 Saving banner:", bannerData)

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
    res.status(500).json({
      message: "Server error",
      error: error.message,
    })
  }

  console.log("🔥 UPLOAD REQUEST END")
})

// DELETE route
router.delete("/:id", async (req, res) => {
  console.log("🔥 DELETE REQUEST:", req.params.id)

  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" })
    }

    // Delete file if exists
    if (banner.imageUrl && banner.type !== "product-type") {
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
    res.status(500).json({
      message: "Failed to delete banner",
      error: error.message,
    })
  }
})

export default router
