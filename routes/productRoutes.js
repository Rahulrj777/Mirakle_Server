import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import Product from "../models/Product.js"
import userAuth from "../middleware/userAuth.js"
import cloudinary from "../utils/cloudinary.js"
import streamifier from "streamifier"
import adminAuth from "../middleware/adminAuth.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
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
const uploadProduct = multer({ storage: multer.memoryStorage() })

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

// ADD THIS NEW ROUTE FOR STOCK CHECKING
router.post("/check-stock", userAuth, async (req, res) => {
  try {
    const { items } = req.body // Array of {productId, variantId}

    console.log("🔍 Stock check request received for items:", items)

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Items array is required" })
    }

    const stockStatus = await Promise.all(
      items.map(async (item) => {
        try {
          // Find the product by ID
          const product = await Product.findById(item.productId)

          if (!product) {
            console.log(`❌ Product not found: ${item.productId}`)
            return {
              productId: item.productId,
              variantId: item.variantId,
              inStock: false,
              availableQuantity: 0,
            }
          }

          // Check if product is marked as out of stock globally
          if (product.isOutOfStock) {
            console.log(`❌ Product ${product.title} is marked as out of stock globally`)
            return {
              productId: item.productId,
              variantId: item.variantId,
              inStock: false,
              availableQuantity: 0,
            }
          }

          // Find the specific variant
          const variant = product.variants?.find((v) => v._id.toString() === item.variantId)

          if (!variant) {
            console.log(`❌ Variant not found: ${item.variantId} for product: ${item.productId}`)
            return {
              productId: item.productId,
              variantId: item.variantId,
              inStock: false,
              availableQuantity: 0,
            }
          }

          // Check variant stock
          const stockQuantity = variant.stock || 0
          const isInStock = stockQuantity > 0

          console.log(
            `✅ Product: ${product.title}, Variant: ${variant.size}, Stock: ${stockQuantity}, InStock: ${isInStock}`,
          )

          return {
            productId: item.productId,
            variantId: item.variantId,
            inStock: isInStock,
            availableQuantity: stockQuantity,
          }
        } catch (error) {
          console.error(`❌ Error checking stock for item ${item.productId}:`, error)
          return {
            productId: item.productId,
            variantId: item.variantId,
            inStock: false,
            availableQuantity: 0,
          }
        }
      }),
    )

    console.log("📊 Stock check results:", stockStatus)
    res.json({ stockStatus })
  } catch (error) {
    console.error("❌ Stock check API error:", error)
    res.status(500).json({ error: "Failed to check stock status" })
  }
})

// Public routes (no auth needed)
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

// User auth routes
router.delete("/:id/review/:reviewId", userAuth, async (req, res) => {
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

router.post("/:id/review", userAuth, uploadReview.array("images", 5), async (req, res) => {
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

// Admin routes - using adminAuth middleware
router.post("/upload-product", adminAuth, uploadProduct.array("images", 10), async (req, res) => {
  try {
    const { name, variants, description, details, keywords, productType } = req.body

    console.log("🔍 Upload product request received")
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
        const result = await streamUpload(file.buffer, "mirakle-products")
        uploadedImages.push({ url: result.secure_url, public_id: result.public_id })
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

router.post("/create", adminAuth, async (req, res) => {
  try {
    const product = new Product(req.body)
    await product.save()
    res.status(201).json(product)
  } catch (err) {
    res.status(400).json({ message: err.message })
  }
})

router.get("/", adminAuth, async (req, res) => {
  try {
    const products = await Product.find()
    res.json(products)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put("/update/:id", adminAuth, uploadProduct.array("images", 10), async (req, res) => {
  try {
    console.log("🔍 UPDATE ROUTE CALLED")
    console.log("🔍 Product ID:", req.params.id)
    console.log("🔍 User from middleware:", req.user)
    console.log("🔍 Request body keys:", Object.keys(req.body))

    const { name, variants, description, details, removedImages, keywords, productType } = req.body

    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    product.productType = productType || product.productType
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

    const newImages = []
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await streamUpload(file.buffer, "mirakle-products")
          newImages.push({ url: result.secure_url, public_id: result.public_id })
        } catch (uploadErr) {
          console.error("❌ Cloudinary upload error during update:", uploadErr)
          return res
            .status(500)
            .json({ message: "Failed to upload new images to Cloudinary", error: uploadErr.message })
        }
      }
    }

    console.log("--- Image Removal Process Start ---")
    console.log("Product images before removal attempt:", JSON.stringify(product.images.others, null, 2))

    if (removedImages) {
      let removedPublicIds
      try {
        removedPublicIds = JSON.parse(removedImages)
        console.log("Server received public IDs to remove (parsed from client):", removedPublicIds)
        if (!Array.isArray(removedPublicIds)) {
          console.error("❌ removedImages is not an array after parsing:", removedPublicIds)
          return res.status(400).json({ message: "Invalid removedImages format: expected an array." })
        }
      } catch (err) {
        console.error("❌ Error parsing removedImages JSON:", err)
        return res.status(400).json({ message: "Invalid removedImages JSON" })
      }

      const imagesToKeep = []
      for (const imgObj of product.images.others) {
        console.log(
          `Processing existing image: URL=${imgObj.url}, Public ID=${imgObj.public_id}. Is it in removed list? ${removedPublicIds.includes(imgObj.public_id)}`,
        )

        if (removedPublicIds.includes(imgObj.public_id)) {
          console.log(`Attempting to delete Cloudinary image with public_id: ${imgObj.public_id}`)
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
          console.log(`Keeping image: ${imgObj.public_id}`)
          imagesToKeep.push(imgObj)
        }
      }

      product.images.others = imagesToKeep
      console.log("Product images array after filtering for removal:", JSON.stringify(product.images.others, null, 2))
    }

    product.images.others = [...product.images.others, ...newImages]
    console.log("Product images after adding new images:", JSON.stringify(product.images.others, null, 2))

    if (product.images.others.length === 0) {
      return res.status(400).json({ message: "Product must have at least one image." })
    }

    product.markModified("images.others")
    await product.save()

    console.log("✅ Product updated successfully")
    console.log("Product saved successfully. Final images in DB:", JSON.stringify(product.images.others, null, 2))

    res.json({ message: "Product updated successfully", product })
  } catch (err) {
    console.error("❌ Update error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.put("/toggle-stock/:id", adminAuth, async (req, res) => {
  try {
    const { isOutOfStock } = req.body
    const updated = await Product.findByIdAndUpdate(req.params.id, { isOutOfStock }, { new: true })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.delete("/delete/:id", adminAuth, async (req, res) => {
  try {
    const productId = req.params.id

    const product = await Product.findByIdAndDelete(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    if (product.images && product.images.others && product.images.others.length > 0) {
      for (const imgObj of product.images.others) {
        if (imgObj.public_id) {
          try {
            await cloudinary.uploader.destroy(imgObj.public_id)
            console.log(`🗑️ Cloudinary image deleted: ${imgObj.public_id}`)
          } catch (cloudinaryErr) {
            console.error(`❌ Failed to delete image ${imgObj.public_id} from Cloudinary:`, cloudinaryErr)
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
