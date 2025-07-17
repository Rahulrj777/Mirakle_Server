import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import Product from "../models/Product.js"
import auth from "../middleware/auth.js"

const router = express.Router()

const productUploadDir = path.join(__dirname, "../uploads/products")
if (!fs.existsSync(productUploadDir)) fs.mkdirSync(productUploadDir, { recursive: true })

const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productUploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  },
})

const uploadProduct = multer({ storage: productStorage })

const reviewUploadDir = path.join(__dirname, "../uploads/reviews")
if (!fs.existsSync(reviewUploadDir)) fs.mkdirSync(reviewUploadDir, { recursive: true })

const reviewStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, reviewUploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  },
})

const uploadReview = multer({ storage: reviewStorage })

// ✅ MODIFIED: GET all products with optional productType string filter
router.get("/all-products", async (req, res) => {
  try {
    const { productType } = req.query
    const filter = {}

    if (productType) {
      // Filter by productType string directly
      filter.productType = productType
    }

    // No populate needed as productType is a string
    const products = await Product.find(filter)
    res.json(products)
  } catch (err) {
    console.error("Error fetching products:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.get("/related/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })
    const keywords = product.keywords || []
    const related = await Product.find({
      _id: { $ne: product._id },
      keywords: { $in: keywords },
    }).limit(10)
    if (related.length < 4) {
      const additional = await Product.find({
        _id: { $ne: product._id },
      }).limit(10)
      const existingIds = new Set(related.map((p) => p._id.toString()))
      additional.forEach((p) => {
        if (!existingIds.has(p._id.toString())) {
          related.push(p)
        }
      })
    }
    res.json(related.slice(0, 10))
  } catch (error) {
    console.error("Failed to fetch related products:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// ✅ MODIFIED: POST upload product to include productType as string
router.post("/upload-product", uploadProduct.array("images", 10), async (req, res) => {
  try {
    const { name, variants, description, details, keywords, productType } = req.body // ✅ Get productType as string
    console.log("🔍 Body:", req.body)
    console.log("🖼 Images:", req.files)

    if (!name || !variants || !productType) {
      // ✅ Validate productType string
      return res.status(400).json({ message: "Product name, variants, and product type are required" })
    }

    let parsedVariants, parsedDetails, parsedKeywords
    try {
      parsedVariants = JSON.parse(variants)
      parsedDetails = details ? JSON.parse(details) : {}
      parsedKeywords = keywords ? JSON.parse(keywords) : []
    } catch (err) {
      console.error("❌ JSON Parse Error:", err)
      return res.status(400).json({ message: "Invalid JSON in variants, details, or keywords" })
    }

    const images = req.files.map((file) => `/uploads/products/${file.filename}`)

    const newProduct = new Product({
      title: name,
      variants: parsedVariants,
      description: description || "",
      details: parsedDetails,
      keywords: parsedKeywords,
      productType: productType, // ✅ Assign productType string
      images: {
        others: images,
      },
    })

    await newProduct.save()
    res.status(201).json(newProduct)
  } catch (err) {
    console.error("❌ Upload error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.get("/search", async (req, res) => {
  const query = req.query.query || ""
  try {
    const results = await Product.aggregate([
      {
        $match: {
          $or: [
            { title: { $regex: query, $options: "i" } },
            { keywords: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
          ],
        },
      },
      {
        $addFields: {
          matchStrength: {
            $cond: [
              { $regexMatch: { input: "$title", regex: query, options: "i" } },
              3,
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: {
                        $reduce: {
                          input: "$keywords",
                          initialValue: "",
                          in: { $concat: ["$$value", " ", "$$this"] },
                        },
                      },
                      regex: query,
                      options: "i",
                    },
                  },
                  2,
                  {
                    $cond: [{ $regexMatch: { input: "$description", regex: query, options: "i" } }, 1, 0],
                  },
                ],
              },
            ],
          },
        },
      },
      { $sort: { matchStrength: -1, createdAt: -1 } },
      { $limit: 10 },
    ])
    res.json(results)
  } catch (error) {
    console.error("Search failed:", error)
    res.status(500).json({ error: "Search failed" })
  }
})

router.post("/:id/review", auth, uploadReview.array("images", 5), async (req, res) => {
  try {
    const { rating, comment } = req.body
    const reviewImages = req.files?.map((file) => `/uploads/reviews/${file.filename}`) || []
    if (!rating || !comment) {
      reviewImages.forEach((imgPath) => {
        const fullPath = path.join(reviewUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      })
      return res.status(400).json({ message: "Rating and comment are required" })
    }
    if (rating < 1 || rating > 5) {
      reviewImages.forEach((imgPath) => {
        const fullPath = path.join(reviewUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      })
      return res.status(400).json({ message: "Rating must be between 1 and 5" })
    }
    const product = await Product.findById(req.params.id)
    if (!product) {
      reviewImages.forEach((imgPath) => {
        const fullPath = path.join(reviewUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      })
      return res.status(404).json({ message: "Product not found" })
    }
    const existingReviewIndex = product.reviews.findIndex((r) => r.user.toString() === req.user.id)
    if (existingReviewIndex !== -1) {
      product.reviews[existingReviewIndex].images.forEach((imgPath) => {
        const fullPath = path.join(reviewUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      })
      product.reviews[existingReviewIndex].rating = Number(rating)
      product.reviews[existingReviewIndex].comment = comment.trim()
      product.reviews[existingReviewIndex].images = reviewImages
      product.reviews[existingReviewIndex].createdAt = new Date()
    } else {
      const newReview = {
        user: req.user.id,
        name: req.user.name || "User",
        rating: Number(rating),
        comment: comment.trim(),
        images: reviewImages,
        likes: [],
        dislikes: [],
        createdAt: new Date(),
      }
      product.reviews.push(newReview)
    }
    await product.save()
    const updatedProduct = await Product.findById(req.params.id)
    res.status(201).json({
      message: "Review submitted successfully",
      reviews: updatedProduct?.reviews,
    })
  } catch (err) {
    console.error("Review submission error:", err)
    if (req.files) {
      req.files.forEach((file) => {
        const fullPath = path.join(reviewUploadDir, file.filename)
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      })
    }
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.post("/create", async (req, res) => {
  try {
    const product = new Product(req.body)
    await product.save()
    res.status(201).json(product)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

// ✅ MODIFIED: Removed populate as productType is a string
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
    res.json(products)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post("/:id/review/:reviewId/like", auth, async (req, res) => {
  try {
    const { id: productId, reviewId } = req.params
    const userId = req.user.id
    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })
    const review = product.reviews.id(reviewId)
    if (!review) return res.status(404).json({ message: "Review not found" })
    const userLiked = review.likes.includes(userId)
    const userDisliked = review.dislikes.includes(userId)
    if (userLiked) {
      review.likes = review.likes.filter((id) => id.toString() !== userId.toString())
    } else {
      review.likes.push(userId)
      if (userDisliked) {
        review.dislikes.pull(userId)
      }
    }
    product.markModified("reviews")
    await product.save()
    const updatedReview = review.toObject()
    updatedReview.userLiked = review.likes.some((id) => id.toString() === userId.toString())
    updatedReview.userDisliked = review.dislikes.some((id) => id.toString() === userId.toString())
    res.json({ message: "Review liked/unliked successfully", review: updatedReview })
  } catch (err) {
    console.error("Like review error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.post("/:id/review/:reviewId/dislike", auth, async (req, res) => {
  try {
    const { id: productId, reviewId } = req.params
    const userId = req.user.id
    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })
    const review = product.reviews.id(reviewId)
    if (!review) return res.status(404).json({ message: "Review not found" })
    const userLiked = review.likes.includes(userId)
    const userDisliked = review.dislikes.includes(userId)
    if (userDisliked) {
      review.dislikes = review.dislikes.filter((id) => id.toString() !== userId.toString())
    } else {
      review.dislikes.push(userId)
      if (userLiked) {
        review.likes.pull(userId)
      }
    }
    product.markModified("reviews")
    await product.save()
    const updatedReview = review.toObject()
    updatedReview.userLiked = review.likes.some((id) => id.toString() === userId.toString())
    updatedReview.userDisliked = review.dislikes.some((id) => id.toString() === userId.toString())
    res.json({ message: "Review disliked/undisliked successfully", review: updatedReview })
  } catch (err) {
    console.error("Dislike review error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.delete("/:id/review/:reviewId", auth, async (req, res) => {
  try {
    const { id: productId, reviewId } = req.params
    const userId = req.user.id
    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })
    const reviewIndex = product.reviews.findIndex((r) => r._id.toString() === reviewId && r.user.toString() === userId)
    if (reviewIndex === -1) {
      return res.status(404).json({ message: "Review not found or unauthorized" })
    }
    const reviewToDelete = product.reviews[reviewIndex]
    if (reviewToDelete.images && reviewToDelete.images.length > 0) {
      reviewToDelete.images.forEach((imgPath) => {
        const fullPath = path.join(reviewUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      })
    }
    product.reviews.splice(reviewIndex, 1)
    await product.save()
    res.json({ message: "Review deleted successfully" })
  } catch (err) {
    console.error("Delete review error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// ✅ MODIFIED: PUT update product to include productType as string
router.put("/update/:id", auth, uploadProduct.array("images", 10), async (req, res) => {
  try {
    const { name, variants, description, details, removedImages, keywords, productType } = req.body // ✅ Get productType as string
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    // Assign productType string directly
    product.productType = productType || product.productType // ✅ Assign productType string

    product.title = name?.trim() || product.title
    product.description = description?.trim() || ""

    if (details) {
      try {
        product.details = JSON.parse(details)
      } catch {
        product.details = {}
      }
    }

    if (keywords) {
      try {
        const parsedKeywords = JSON.parse(keywords)
        if (!Array.isArray(parsedKeywords) || !parsedKeywords.every((k) => typeof k === "string")) {
          return res.status(400).json({ message: "Keywords must be an array of strings" })
        }
        product.keywords = parsedKeywords
      } catch {
        return res.status(400).json({ message: "Invalid keywords JSON" })
      }
    }

    if (variants) {
      try {
        const parsedVariants = JSON.parse(variants)
        if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
          return res.status(400).json({ message: "At least one variant is required" })
        }
        product.variants = parsedVariants
      } catch (err) {
        return res.status(400).json({ message: "Invalid variants JSON" })
      }
    }

    const newImages = req.files?.map((file) => `/uploads/products/${file.filename}`) || []
    console.log("🖼 Uploaded Files:", req.files)

    if (removedImages) {
      try {
        const removed = JSON.parse(removedImages)
        product.images.others = product.images.others.filter((img) => {
          if (removed.includes(img)) {
            const fullPath = path.join(productUploadDir, path.basename(img))
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
            return false
          }
          return true
        })
      } catch (err) {
        return res.status(400).json({ message: "Invalid removedImages JSON" })
      }
    }

    product.images.others = [...product.images.others, ...newImages]
    await product.save()
    res.json({ message: "Product updated successfully", product })
  } catch (err) {
    console.error("Update error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.put("/toggle-stock/:id", async (req, res) => {
  try {
    const { isOutOfStock } = req.body
    const updated = await Product.findByIdAndUpdate(req.params.id, { isOutOfStock }, { new: true })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete("/delete/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })
    if (product.images && product.images.others) {
      for (const imgPath of product.images.others) {
        const fullPath = path.join(productUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      }
    }
    res.json({ message: "Product deleted" })
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

export default router
