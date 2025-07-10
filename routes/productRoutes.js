import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Product from "../models/Product.js"
import auth from "../middleware/auth.js"
import { verifyToken } from "../middleware/verifyToken.js"
import { likeReview, dislikeReview } from "../controllers/productController.js"

const router = express.Router()

const uploadDir = "uploads/products"
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
})

const upload = multer({ storage })

// Add review image upload configuration after the existing upload setup
const reviewUploadDir = "uploads/reviews"
if (!fs.existsSync(reviewUploadDir)) fs.mkdirSync(reviewUploadDir, { recursive: true })

const reviewStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reviewUploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-review-" + file.originalname),
})

const reviewUpload = multer({
  storage: reviewStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"), false)
    }
  },
})

router.get("/all-products", async (req, res) => {
  try {
    const products = await Product.find()
    res.json(products)
  } catch (err) {
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

router.post("/upload-product", upload.array("images", 10), async (req, res) => {
  try {
    const { name, variants, description, details, keywords } = req.body

    if (!name || !variants) {
      return res.status(400).json({ message: "Product name and variants are required" })
    }

    let parsedVariants, parsedDetails, parsedKeywords
    try {
      parsedVariants = JSON.parse(variants)
      parsedDetails = details ? JSON.parse(details) : {}
      parsedKeywords = keywords ? JSON.parse(keywords) : []
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON in variants, details, or keywords" })
    }

    const images = req.files.map((file) => `${uploadDir}/${file.filename}`)

    const newProduct = new Product({
      title: name,
      variants: parsedVariants,
      description: description || "",
      details: parsedDetails,
      keywords: parsedKeywords,
      images: {
        others: images,
      },
    })

    await newProduct.save()
    res.status(201).json(newProduct)
  } catch (err) {
    console.error("Upload error:", err)
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

// Replace the existing review submission route with this enhanced version
router.post("/:id/review", auth, reviewUpload.array("images", 5), async (req, res) => {
  try {
    const { rating, comment } = req.body

    if (!rating || !comment) {
      return res.status(400).json({ message: "Rating and comment are required" })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" })
    }

    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    // Check if user already reviewed
    const existingReviewIndex = product.reviews.findIndex((r) => r.user.toString() === req.user.id)

    if (existingReviewIndex !== -1) {
      return res.status(400).json({ message: "You have already reviewed this product. You can only review once." })
    }

    // Process uploaded images
    const reviewImages = req.files ? req.files.map((file) => `/${reviewUploadDir}/${file.filename}`) : []

    // Create new review
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
    await product.save()

    // Return the updated product with populated reviews
    const updatedProduct = await Product.findById(req.params.id)
    res.status(201).json({
      message: "Review submitted successfully",
      review: newReview,
      reviews: updatedProduct.reviews,
    })
  } catch (err) {
    console.error("Review error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// Update the delete review route to also delete images
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

    const review = product.reviews[reviewIndex]

    // Delete review images from filesystem
    if (review.images && review.images.length > 0) {
      review.images.forEach((imagePath) => {
        const fullPath = path.join(process.cwd(), imagePath.replace(/^\//, ""))
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

router.put("/:id", upload.array("images", 10), async (req, res) => {
  try {
    const { name, variants, description, details, removedImages, keywords } = req.body
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    product.title = name || product.title
    product.description = description || ""

    if (details) {
      try {
        product.details = JSON.parse(details)
      } catch {
        product.details = {}
      }
    }

    if (keywords) {
      try {
        product.keywords = JSON.parse(keywords)
      } catch (err) {
        return res.status(400).json({ message: "Invalid keywords JSON" })
      }
    }

    if (variants) {
      try {
        const parsedVariants = JSON.parse(variants)
        product.variants = parsedVariants
      } catch (err) {
        return res.status(400).json({ message: "Invalid variants JSON" })
      }
    }

    const newImages = req.files.map((file) => `${uploadDir}/${file.filename}`)

    if (removedImages) {
      try {
        const removed = JSON.parse(removedImages)
        product.images.others = product.images.others.filter((img) => {
          if (removed.includes(img)) {
            const fullPath = path.join(uploadDir, path.basename(img))
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

router.put("/:id/toggle-stock", async (req, res) => {
  try {
    const { isOutOfStock } = req.body
    const updated = await Product.findByIdAndUpdate(req.params.id, { isOutOfStock }, { new: true })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    if (product.images && product.images.others) {
      for (const imgPath of product.images.others) {
        const fullPath = path.join(uploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      }
    }

    res.json({ message: "Product deleted" })
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// ✅ Like and Dislike routes
router.post("/:productId/review/:reviewId/like", verifyToken, likeReview)
router.post("/:productId/review/:reviewId/dislike", verifyToken, dislikeReview)

// ✅ Submit a review (with image upload)
router.post("/:id/review", auth, reviewUpload.array("images", 5), async (req, res) => {
  try {
    const { rating, comment } = req.body

    if (!rating || !comment) {
      return res.status(400).json({ message: "Rating and comment are required" })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" })
    }

    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    // Check if user already reviewed
    const existingReviewIndex = product.reviews.findIndex((r) => r.user.toString() === req.user.id)

    if (existingReviewIndex !== -1) {
      return res.status(400).json({ message: "You have already reviewed this product. You can only review once." })
    }

    // Process uploaded images
    const reviewImages = req.files ? req.files.map((file) => `/${reviewUploadDir}/${file.filename}`) : []

    // Create new review
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
    await product.save()

    // Return the updated product with populated reviews
    const updatedProduct = await Product.findById(req.params.id)
    res.status(201).json({
      message: "Review submitted successfully",
      review: newReview,
      reviews: updatedProduct.reviews,
    })
  } catch (err) {
    console.error("Review error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// ✅ Delete a review
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

    const review = product.reviews[reviewIndex]

    // Delete review images from filesystem
    if (review.images && review.images.length > 0) {
      review.images.forEach((imagePath) => {
        const fullPath = path.join(process.cwd(), imagePath.replace(/^\//, ""))
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

// ✅ Like a review
router.post("/:productId/review/:reviewId/like", auth, async (req, res) => {
  try {
    const { productId, reviewId } = req.params
    const userId = req.user.id

    console.log("Like request:", { productId, reviewId, userId })

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    const review = product.reviews.id(reviewId)
    if (!review) return res.status(404).json({ message: "Review not found" })

    // Initialize arrays if they don't exist
    if (!review.likes) review.likes = []
    if (!review.dislikes) review.dislikes = []

    const hasLiked = review.likes.includes(userId)
    const hasDisliked = review.dislikes.includes(userId)

    if (hasLiked) {
      // Remove like
      review.likes.pull(userId)
    } else {
      // Add like and remove dislike if exists
      if (hasDisliked) {
        review.dislikes.pull(userId)
      }
      review.likes.push(userId)
    }

    await product.save()

    res.status(200).json({
      message: hasLiked ? "Like removed" : "Review liked",
      review: {
        _id: review._id,
        likes: review.likes.length,
        dislikes: review.dislikes.length,
        userLiked: review.likes.includes(userId),
        userDisliked: review.dislikes.includes(userId),
      },
    })
  } catch (err) {
    console.error("Like Review Error:", err)
    res.status(500).json({ message: "Something went wrong" })
  }
})

// ✅ Dislike a review
router.post("/:productId/review/:reviewId/dislike", auth, async (req, res) => {
  try {
    const { productId, reviewId } = req.params
    const userId = req.user.id

    console.log("Dislike request:", { productId, reviewId, userId })

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    const review = product.reviews.id(reviewId)
    if (!review) return res.status(404).json({ message: "Review not found" })

    // Initialize arrays if they don't exist
    if (!review.likes) review.likes = []
    if (!review.dislikes) review.dislikes = []

    const hasLiked = review.likes.includes(userId)
    const hasDisliked = review.dislikes.includes(userId)

    if (hasDisliked) {
      // Remove dislike
      review.dislikes.pull(userId)
    } else {
      // Add dislike and remove like if exists
      if (hasLiked) {
        review.likes.pull(userId)
      }
      review.dislikes.push(userId)
    }

    await product.save()

    res.status(200).json({
      message: hasDisliked ? "Dislike removed" : "Review disliked",
      review: {
        _id: review._id,
        likes: review.likes.length,
        dislikes: review.dislikes.length,
        userLiked: review.likes.includes(userId),
        userDisliked: review.dislikes.includes(userId),
      },
    })
  } catch (err) {
    console.error("Dislike Review Error:", err)
    res.status(500).json({ message: "Something went wrong" })
  }
})

export default router
