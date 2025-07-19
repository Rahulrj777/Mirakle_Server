import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import Product from "../models/Product.js"
import auth from "../middleware/auth.js"
import cloudinary from "../utils/cloudinary.js"
import streamifier from "streamifier"

const router = express.Router()

// Multer storage for review images (still local for now)
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

// Multer storage for product images (in-memory for Cloudinary upload)
const uploadProduct = multer({ storage: multer.memoryStorage() })

// Helper function to upload buffer to Cloudinary
const streamUpload = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folder,
      },
      (error, result) => {
        if (result) {
          resolve(result)
        } else {
          reject(error)
        }
      },
    )
    streamifier.createReadStream(fileBuffer).pipe(stream)
  })
}

router.get("/all-products", async (req, res) => {
  try {
    const { productType } = req.query
    const filter = {}

    if (productType) {
      filter.productType = productType
    }

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

// Create/Upload a new product
router.post(
  "/upload-product",
  uploadProduct.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "otherImages", maxCount: 9 },
  ]),
  async (req, res) => {
    try {
      const { name, variants, description, details, keywords, productType } = req.body
      const mainImageFile = req.files?.mainImage?.[0]
      const otherImageFiles = req.files?.otherImages || []

      console.log("🔍 Body:", req.body)
      console.log("🖼 Main Image File:", mainImageFile ? "Present" : "Not Present")
      console.log("🖼 Other Image Files Count:", otherImageFiles.length)

      if (!name || !variants || !productType) {
        return res.status(400).json({ message: "Product name, variants, and product type are required" })
      }
      if (!mainImageFile && otherImageFiles.length === 0) {
        return res.status(400).json({ message: "At least one image (main or other) is required for the product" })
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

      let mainImage = null
      if (mainImageFile) {
        try {
          const result = await streamUpload(mainImageFile.buffer, "mirakle-products")
          mainImage = { url: result.secure_url, public_id: result.public_id }
        } catch (uploadErr) {
          console.error("❌ Cloudinary main image upload error:", uploadErr)
          return res
            .status(500)
            .json({ message: "Failed to upload main image to Cloudinary", error: uploadErr.message })
        }
      }

      const uploadedOtherImages = []
      for (const file of otherImageFiles) {
        try {
          const result = await streamUpload(file.buffer, "mirakle-products")
          uploadedOtherImages.push({ url: result.secure_url, public_id: result.public_id })
        } catch (uploadErr) {
          console.error("❌ Cloudinary other image upload error:", uploadErr)
          // Continue processing other images even if one fails, but log the error
        }
      }

      const newProduct = new Product({
        title: name,
        variants: parsedVariants,
        description: description || "",
        details: parsedDetails,
        keywords: parsedKeywords,
        productType: productType,
        images: {
          main: mainImage,
          others: uploadedOtherImages,
        },
      })

      await newProduct.save()
      res.status(201).json(newProduct)
    } catch (err) {
      console.error("❌ Product upload error:", err)
      res.status(500).json({ message: "Server error", error: err.message })
    }
  },
)

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
      // Delete old review images if updating
      product.reviews[existingReviewIndex].images.forEach((imgPath) => {
        const fullPath = path.join(reviewUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      })

      product.reviews[existingReviewIndex].rating = Number(rating)
      product.reviews[existingReviewIndex].comment = comment.trim()
      product.reviews[existingReviewIndex].images = reviewImages
      product.reviews[existingReviewIndex].createdAt = new Date() // Update timestamp
    } else {
      const newReview = {
        user: req.user.id,
        name: req.user.name || "User", // Use user's name if available
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

    // Fetch the updated product to return the latest reviews
    const updatedProduct = await Product.findById(req.params.id)
    res.status(201).json({
      message: "Review submitted successfully",
      reviews: updatedProduct?.reviews,
    })
  } catch (err) {
    console.error("Review submission error:", err)
    // Clean up uploaded images if an error occurs
    if (req.files) {
      req.files.forEach((file) => {
        const fullPath = path.join(reviewUploadDir, file.filename)
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      })
    }
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })
    res.json(product)
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
      // User already liked, so unlike
      review.likes = review.likes.filter((id) => id.toString() !== userId.toString())
    } else {
      // User wants to like
      review.likes.push(userId)
      if (userDisliked) {
        // If user previously disliked, remove dislike
        review.dislikes.pull(userId)
      }
    }

    product.markModified("reviews") // Mark reviews array as modified
    await product.save()

    // Return the updated review object with current like/dislike status for the user
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
      // User already disliked, so undislike
      review.dislikes = review.dislikes.filter((id) => id.toString() !== userId.toString())
    } else {
      // User wants to dislike
      review.dislikes.push(userId)
      if (userLiked) {
        // If user previously liked, remove like
        review.likes.pull(userId)
      }
    }

    product.markModified("reviews") // Mark reviews array as modified
    await product.save()

    // Return the updated review object with current like/dislike status for the user
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
    const userId = req.user.id // Assuming req.user.id is set by auth middleware

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    // Find the review by ID and ensure it belongs to the current user
    const reviewIndex = product.reviews.findIndex((r) => r._id.toString() === reviewId && r.user.toString() === userId)

    if (reviewIndex === -1) {
      return res.status(404).json({ message: "Review not found or unauthorized" })
    }

    const reviewToDelete = product.reviews[reviewIndex]

    // Delete associated review images from local storage
    if (reviewToDelete.images && reviewToDelete.images.length > 0) {
      reviewToDelete.images.forEach((imgPath) => {
        const fullPath = path.join(reviewUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      })
    }

    product.reviews.splice(reviewIndex, 1) // Remove the review from the array
    await product.save()

    res.json({ message: "Review deleted successfully" })
  } catch (err) {
    console.error("Delete review error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// Update a product
router.put(
  "/update/:id",
  auth,
  uploadProduct.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "otherImages", maxCount: 9 },
  ]),
  async (req, res) => {
    try {
      const {
        name,
        variants,
        description,
        details,
        removedImages, // public_ids of existing 'other' images to remove
        mainImagePublicIdToRemove, // public_id of the main image to remove/replace
        keywords,
        productType,
      } = req.body

      const product = await Product.findById(req.params.id)
      if (!product) return res.status(404).json({ message: "Product not found" })

      // Update basic fields
      product.productType = productType || product.productType
      product.title = name?.trim() || product.title
      product.description = description?.trim() || ""

      if (details) {
        try {
          product.details = JSON.parse(details)
        } catch {
          product.details = {} // Default to empty object on parse error
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

      // Handle main image update/removal
      const newMainImageFile = req.files?.mainImage?.[0]
      if (newMainImageFile) {
        // Upload new main image
        try {
          const result = await streamUpload(newMainImageFile.buffer, "mirakle-products")
          // Delete old main image from Cloudinary if it exists
          if (product.images.main?.public_id) {
            await cloudinary.uploader.destroy(product.images.main.public_id)
            console.log(`🗑️ Old main image deleted: ${product.images.main.public_id}`)
          }
          product.images.main = { url: result.secure_url, public_id: result.public_id }
        } catch (uploadErr) {
          console.error("❌ Cloudinary main image upload error during update:", uploadErr)
          return res.status(500).json({ message: "Failed to upload new main image", error: uploadErr.message })
        }
      } else if (mainImagePublicIdToRemove && product.images.main?.public_id === mainImagePublicIdToRemove) {
        // If no new main image, but old main image is explicitly marked for removal
        try {
          await cloudinary.uploader.destroy(mainImagePublicIdToRemove)
          console.log(`🗑️ Main image explicitly removed: ${mainImagePublicIdToRemove}`)
          product.images.main = null // Set main image to null
        } catch (cloudinaryErr) {
          console.error(`❌ Failed to delete main image ${mainImagePublicIdToRemove} from Cloudinary:`, cloudinaryErr)
        }
      }

      // Handle other images: removal of existing and upload of new
      const newOtherImageFiles = req.files?.otherImages || []
      let currentOtherImages = product.images.others || []

      // 1. Remove specified existing other images
      if (removedImages) {
        let removedPublicIds
        try {
          removedPublicIds = JSON.parse(removedImages)
          if (!Array.isArray(removedPublicIds)) {
            console.error("❌ removedImages is not an array after parsing:", removedPublicIds)
            return res.status(400).json({ message: "Invalid removedImages format: expected an array." })
          }
        } catch (err) {
          console.error("❌ Error parsing removedImages JSON:", err)
          return res.status(400).json({ message: "Invalid removedImages JSON" })
        }

        const imagesToKeep = []
        for (const imgObj of currentOtherImages) {
          if (removedPublicIds.includes(imgObj.public_id)) {
            try {
              const destroyResult = await cloudinary.uploader.destroy(imgObj.public_id)
              console.log(`Cloudinary deletion result for ${imgObj.public_id}:`, destroyResult)
              if (destroyResult.result !== "ok") {
                console.warn(`⚠️ Cloudinary deletion for ${imgObj.public_id} was not 'ok'. Result:`, destroyResult)
              }
            } catch (cloudinaryErr) {
              console.error(`❌ Failed to delete image ${imgObj.public_id} from Cloudinary:`, cloudinaryErr)
            }
          } else {
            imagesToKeep.push(imgObj)
          }
        }
        currentOtherImages = imagesToKeep
      }

      // 2. Upload new other images
      const uploadedNewOtherImages = []
      for (const file of newOtherImageFiles) {
        try {
          const result = await streamUpload(file.buffer, "mirakle-products")
          uploadedNewOtherImages.push({ url: result.secure_url, public_id: result.public_id })
        } catch (uploadErr) {
          console.error("❌ Cloudinary new other image upload error during update:", uploadErr)
        }
      }

      // Combine existing (kept) other images with newly uploaded other images
      product.images.others = [...currentOtherImages, ...uploadedNewOtherImages]

      // Ensure there's at least one image (main or other) after update
      if (!product.images.main && product.images.others.length === 0) {
        return res.status(400).json({ message: "Product must have at least one image (main or other)." })
      }

      // Mark the images object as modified to ensure Mongoose saves changes
      product.markModified("images.main")
      product.markModified("images.others")

      await product.save()
      console.log("Product saved successfully. Final images in DB:", JSON.stringify(product.images, null, 2))
      res.json({ message: "Product updated successfully", product })
    } catch (err) {
      console.error("Update error:", err)
      res.status(500).json({ message: "Server error", error: err.message })
    }
  },
)

router.put("/toggle-stock/:id", async (req, res) => {
  try {
    const { isOutOfStock } = req.body
    const updated = await Product.findByIdAndUpdate(req.params.id, { isOutOfStock }, { new: true })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Delete a product
router.delete("/delete/:id", async (req, res) => {
  try {
    const productId = req.params.id
    const product = await Product.findByIdAndDelete(productId)

    if (!product) return res.status(404).json({ message: "Product not found" })

    // Delete associated Cloudinary images (main and others)
    if (product.images) {
      if (product.images.main?.public_id) {
        try {
          await cloudinary.uploader.destroy(product.images.main.public_id)
          console.log(`🗑️ Cloudinary main image deleted: ${product.images.main.public_id}`)
        } catch (cloudinaryErr) {
          console.error(
            `❌ Failed to delete main image ${product.images.main.public_id} from Cloudinary:`,
            cloudinaryErr,
          )
        }
      }
      if (product.images.others && product.images.others.length > 0) {
        for (const imgObj of product.images.others) {
          if (imgObj.public_id) {
            try {
              await cloudinary.uploader.destroy(imgObj.public_id)
              console.log(`🗑️ Cloudinary other image deleted: ${imgObj.public_id}`)
            } catch (cloudinaryErr) {
              console.error(`❌ Failed to delete image ${imgObj.public_id} from Cloudinary:`, cloudinaryErr)
            }
          }
        }
      }
    }

    res.json({ message: "Product deleted" })
  } catch (err) {
    console.error("Delete product error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

export default router
