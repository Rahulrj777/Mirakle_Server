import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Product from "../models/Product.js"

const router = express.Router()

const uploadDir = "uploads"
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
})

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// GET all products
router.get("/all-products", async (req, res) => {
  try {
    const products = await Product.find()
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch products", error: error.message })
  }
})

// 🚨 NEW: Search products with fuzzy matching
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query
    if (!q) {
      return res.json([])
    }

    // Method 1: MongoDB text search (handles some fuzzy matching)
    const textSearchResults = await Product.find({ $text: { $search: q } }, { score: { $meta: "textScore" } }).sort({
      score: { $meta: "textScore" },
    })

    // Method 2: Regex search for partial matches
    const regexSearchResults = await Product.find({
      $or: [
        { title: { $regex: q, $options: "i" } },
        { keywords: { $in: [new RegExp(q, "i")] } },
        { description: { $regex: q, $options: "i" } },
      ],
    })

    // Combine and deduplicate results
    const allResults = [...textSearchResults, ...regexSearchResults]
    const uniqueResults = allResults.filter(
      (product, index, self) => index === self.findIndex((p) => p._id.toString() === product._id.toString()),
    )

    res.json(uniqueResults)
  } catch (error) {
    res.status(500).json({ message: "Search failed", error: error.message })
  }
})

// POST upload product
router.post("/upload-product", upload.array("images", 10), async (req, res) => {
  try {
    const { name, variants, description, details, keywords } = req.body

    const parsedVariants = JSON.parse(variants)
    const parsedDetails = details ? JSON.parse(details) : {}
    const parsedKeywords = keywords ? JSON.parse(keywords) : [] // 🚨 NEW: Parse keywords

    const imageUrls = req.files.map((file) => `/uploads/${file.filename}`)

    const product = new Product({
      title: name,
      variants: parsedVariants,
      images: { others: imageUrls },
      description,
      details: parsedDetails,
      keywords: parsedKeywords, // 🚨 NEW: Save keywords
    })

    await product.save()
    res.status(201).json(product)
  } catch (error) {
    console.error("Upload error:", error)
    res.status(500).json({ message: "Upload failed", error: error.message })
  }
})

// PUT update product
router.put("/:id", upload.array("images", 10), async (req, res) => {
  try {
    const { name, variants, description, details, keywords, removedImages } = req.body

    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    // Handle removed images
    if (removedImages) {
      const removed = JSON.parse(removedImages)
      removed.forEach((imgPath) => {
        const fullPath = path.join(uploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      })
      product.images.others = product.images.others.filter((img) => !removed.includes(img))
    }

    // Add new images
    if (req.files && req.files.length > 0) {
      const newImageUrls = req.files.map((file) => `/uploads/${file.filename}`)
      product.images.others.push(...newImageUrls)
    }

    // Update other fields
    product.title = name
    product.variants = JSON.parse(variants)
    product.description = description
    product.details = details ? JSON.parse(details) : {}
    product.keywords = keywords ? JSON.parse(keywords) : [] // 🚨 NEW: Update keywords

    await product.save()
    res.json(product)
  } catch (error) {
    console.error("Update error:", error)
    res.status(500).json({ message: "Update failed", error: error.message })
  }
})

// DELETE product
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    // Delete associated images
    product.images.others.forEach((imgPath) => {
      const fullPath = path.join(uploadDir, path.basename(imgPath))
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath)
      }
    })

    res.json({ message: "Product deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Delete failed", error: error.message })
  }
})

// PUT toggle stock
router.put("/:id/toggle-stock", async (req, res) => {
  try {
    const { isOutOfStock } = req.body
    const product = await Product.findByIdAndUpdate(req.params.id, { isOutOfStock }, { new: true })

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    res.json(product)
  } catch (error) {
    res.status(500).json({ message: "Stock update failed", error: error.message })
  }
})

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "Products routes working", timestamp: new Date().toISOString() })
})

export default router
