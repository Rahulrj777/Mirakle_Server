import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
import Product from "../models/Product.js"
import auth from "../middleware/auth.js"
import cloudinary from "cloudinary"
import streamifier from "streamifier"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "mirakle_products" }, // Optional: specify a folder in Cloudinary
      (error, result) => {
        if (error) return reject(error)
        resolve({ url: result.secure_url, public_id: result.public_id })
      },
    )
    streamifier.createReadStream(fileBuffer).pipe(uploadStream)
  })
}

const deleteFromCloudinary = (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) return reject(error)
      resolve(result)
    })
  })
}

const router = express.Router()

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

router.get("/all-products", async (req, res) => {
  try {
    const products = await Product.find({})
    res.json(products)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get("/search", async (req, res) => {
  try {
    const { query } = req.query
    if (!query) {
      return res.status(400).json({ message: "Search query is required" })
    }

    const searchRegex = new RegExp(query, "i") // Case-insensitive search

    const products = await Product.find({
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { productType: searchRegex },
        { category: searchRegex },
        { subCategory: searchRegex },
        { brand: searchRegex },
        { keywords: searchRegex },
      ],
    })
    res.json(products)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }
    res.json(product)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post("/add", upload.array("images", 10), async (req, res) => {
  try {
    const {
      title,
      description,
      productType,
      category,
      subCategory,
      brand,
      variants,
      keywords,
      isFeatured,
      isNewArrival,
      isBestSeller,
      isOutOfStock,
    } = req.body

    let parsedVariants
    try {
      parsedVariants = JSON.parse(variants)
    } catch (e) {
      return res.status(400).json({ message: "Variants must be a valid JSON string." })
    }

    let parsedKeywords
    try {
      parsedKeywords = JSON.parse(keywords)
    } catch (e) {
      parsedKeywords = [] // Default to empty array if parsing fails
    }

    const newProduct = new Product({
      title,
      description,
      productType,
      category,
      subCategory,
      brand,
      variants: parsedVariants,
      keywords: parsedKeywords,
      isFeatured: isFeatured === "true",
      isNewArrival: isNewArrival === "true",
      isBestSeller: isBestSeller === "true",
      isOutOfStock: isOutOfStock === "true",
    })

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      const uploadedImages = await Promise.all(req.files.map((file) => uploadToCloudinary(file.buffer)))
      newProduct.images.thumbnail = uploadedImages[0] // First image as thumbnail
      newProduct.images.others = uploadedImages.slice(1) // Rest as others
    }

    const savedProduct = await newProduct.save()
    res.status(201).json(savedProduct)
  } catch (err) {
    console.error("Error adding product:", err)
    res.status(400).json({ message: err.message })
  }
})

router.put("/edit/:id", upload.array("images", 10), async (req, res) => {
  try {
    const { id } = req.params
    const {
      title,
      description,
      productType,
      category,
      subCategory,
      brand,
      variants,
      keywords,
      isFeatured,
      isNewArrival,
      isBestSeller,
      isOutOfStock,
      existingImagePublicIds,
    } = req.body

    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    // Parse variants and keywords
    let parsedVariants
    try {
      parsedVariants = JSON.parse(variants)
    } catch (e) {
      return res.status(400).json({ message: "Variants must be a valid JSON string." })
    }

    let parsedKeywords
    try {
      parsedKeywords = JSON.parse(keywords)
    } catch (e) {
      parsedKeywords = []
    }

    // Update product fields
    product.title = title
    product.description = description
    product.productType = productType
    product.category = category
    product.subCategory = subCategory
    product.brand = brand
    product.variants = parsedVariants
    product.keywords = parsedKeywords
    product.isFeatured = isFeatured === "true"
    product.isNewArrival = isNewArrival === "true"
    product.isBestSeller = isBestSeller === "true"
    product.isOutOfStock = isOutOfStock === "true"

    // Handle image updates
    let currentImagePublicIds = []
    if (product.images.thumbnail && product.images.thumbnail.public_id) {
      currentImagePublicIds.push(product.images.thumbnail.public_id)
    }
    if (product.images.others && product.images.others.length > 0) {
      currentImagePublicIds = currentImagePublicIds.concat(
        product.images.others.map((img) => img.public_id).filter(Boolean),
      )
    }

    // Determine images to delete
    const existingPublicIdsArray = existingImagePublicIds ? JSON.parse(existingImagePublicIds) : []
    const publicIdsToDelete = currentImagePublicIds.filter((publicId) => !existingPublicIdsArray.includes(publicId))

    // Delete images from Cloudinary
    await Promise.all(
      publicIdsToDelete.map((publicId) => {
        console.log(`Deleting image with public_id: ${publicId}`)
        return deleteFromCloudinary(publicId)
      }),
    )

    // Update product.images based on existingImagePublicIds and new uploads
    let updatedImages = []
    if (existingPublicIdsArray.length > 0) {
      // Filter out deleted images and reconstruct the array
      const allExistingImages = [product.images.thumbnail, ...product.images.others].filter(Boolean)
      updatedImages = allExistingImages.filter((img) => existingPublicIdsArray.includes(img.public_id))
    }

    // Upload new images
    if (req.files && req.files.length > 0) {
      const newUploadedImages = await Promise.all(req.files.map((file) => uploadToCloudinary(file.buffer)))
      updatedImages = updatedImages.concat(newUploadedImages)
    }

    // Assign updated images back to product
    if (updatedImages.length > 0) {
      product.images.thumbnail = updatedImages[0]
      product.images.others = updatedImages.slice(1)
    } else {
      product.images.thumbnail = {}
      product.images.others = []
    }

    const updatedProduct = await product.save()
    res.json(updatedProduct)
  } catch (err) {
    console.error("Error updating product:", err)
    res.status(400).json({ message: err.message })
  }
})

router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params
    const product = await Product.findById(id)

    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    // Delete images from Cloudinary before deleting the product
    let publicIdsToDelete = []
    if (product.images.thumbnail && product.images.thumbnail.public_id) {
      publicIdsToDelete.push(product.images.thumbnail.public_id)
    }
    if (product.images.others && product.images.others.length > 0) {
      publicIdsToDelete = publicIdsToDelete.concat(product.images.others.map((img) => img.public_id).filter(Boolean))
    }

    await Promise.all(
      publicIdsToDelete.map((publicId) => {
        console.log(`Deleting image with public_id: ${publicId} during product deletion`)
        return deleteFromCloudinary(publicId)
      }),
    )

    await Product.findByIdAndDelete(id)
    res.json({ message: "Product deleted successfully" })
  } catch (err) {
    console.error("Error deleting product:", err)
    res.status(500).json({ message: err.message })
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
    const { name, variants, description, details, keywords, productType } = req.body
    console.log("🔍 Body:", req.body)
    console.log("🖼 Files received for upload:", req.files?.length)

    if (!name || !variants || !productType) {
      return res.status(400).json({ message: "Product name, variants, and product type are required" })
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "At least one image is required for the product" })
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

    const uploadedImages = []
    for (const file of req.files) {
      try {
        const result = await uploadToCloudinary(file.buffer)
        uploadedImages.push({ url: result.url, public_id: result.public_id })
      } catch (uploadErr) {
        console.error("❌ Cloudinary upload error:", uploadErr)
        return res.status(500).json({ message: "Failed to upload some images to Cloudinary", error: uploadErr.message })
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
        others: uploadedImages,
      },
    })

    await newProduct.save()
    res.status(201).json(newProduct)
  } catch (err) {
    console.error("❌ Product upload error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
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

router.put("/toggle-stock/:id", async (req, res) => {
  try {
    const { isOutOfStock } = req.body
    const updated = await Product.findByIdAndUpdate(req.params.id, { isOutOfStock }, { new: true })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

export default router
