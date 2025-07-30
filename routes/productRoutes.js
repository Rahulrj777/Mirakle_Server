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

router.post("/check-stock", async (req, res) => {
  try {
    const { productIds } = req.body
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "Product IDs array is required" })
    }

    console.log("🔍 Checking stock for products:", productIds)
    const products = await Product.find({
      _id: { $in: productIds },
    }).select("_id title variants isOutOfStock")

    console.log(`✅ Found ${products.length} products for stock check`)

    res.json({
      products: products.map((product) => ({
        _id: product._id,
        title: product.title,
        isOutOfStock: product.isOutOfStock,
        variants: product.variants.map((variant) => ({
          size: variant.size,
          weight: variant.weight,
          price: variant.price,
          discountPercent: variant.discountPercent,
          stock: variant.stock,
          isOutOfStock: variant.isOutOfStock,
        })),
      })),
    })
  } catch (error) {
    console.error("❌ Stock check error:", error)
    res.status(500).json({ message: "Failed to check stock", error: error.message })
  }
})

// Get all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
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
router.post("/upload-product", adminAuth, uploadProduct.array("images", 50), async (req, res) => {
  try {
    const { name, variants, description, details, keywords, productType } = req.body

    console.log("🔍 Upload product request received")
    console.log("🔍 Request body:", {
      name,
      productType,
      variantsLength: variants ? JSON.parse(variants).length : 0,
      filesCount: req.files?.length || 0,
    })
    console.log(
      "🖼 Files received:",
      req.files?.map((f) => ({
        fieldname: f.fieldname,
        originalname: f.originalname,
        size: f.size,
      })),
    )

    if (!name || !variants || !productType) {
      console.error("❌ Missing required fields:", { name: !!name, variants: !!variants, productType: !!productType })
      return res.status(400).json({ message: "Product name, variants, and product type are required" })
    }

    let parsedVariants, parsedDetails, parsedKeywords
    try {
      parsedVariants = JSON.parse(variants)
      parsedDetails = details ? JSON.parse(details) : {}
      parsedKeywords = keywords ? JSON.parse(keywords) : []
      console.log("✅ JSON parsing successful")
    } catch (err) {
      console.error("❌ JSON Parse Error:", err)
      return res.status(400).json({ message: "Invalid JSON in variants, details, or keywords" })
    }

    // Process images - separate by variant or general
    const uploadedImages = []
    const variantImages = {}

    if (req.files && req.files.length > 0) {
      console.log("🔄 Processing images...")
      for (const file of req.files) {
        try {
          console.log(`📤 Uploading ${file.fieldname}: ${file.originalname}`)
          const result = await streamUpload(file.buffer, "mirakle-products")
          const imageData = { url: result.secure_url, public_id: result.public_id }

          // Check if this image is for a specific variant (based on fieldname)
          if (file.fieldname.startsWith("variant_")) {
            const variantIndex = file.fieldname.split("_")[1]
            if (!variantImages[variantIndex]) {
              variantImages[variantIndex] = []
            }
            variantImages[variantIndex].push(imageData)
            console.log(`✅ Variant ${variantIndex} image uploaded:`, imageData.url)
          } else {
            uploadedImages.push(imageData)
            console.log("✅ Main product image uploaded:", imageData.url)
          }
        } catch (uploadErr) {
          console.error("❌ Cloudinary upload error:", uploadErr)
          return res.status(500).json({
            message: "Failed to upload some images to Cloudinary",
            error: uploadErr.message,
            file: file.originalname,
          })
        }
      }
    }

    // Add variant-specific images to variants
    const processedVariants = parsedVariants.map((variant, index) => ({
      ...variant,
      images: variantImages[index] || [],
    }))

    console.log(
      "🔄 Creating product with processed variants:",
      processedVariants.map((v, i) => ({
        index: i,
        size: v.size,
        imagesCount: v.images?.length || 0,
      })),
    )

    // Check if we have at least one image (either main or variant)
    const hasMainImages = uploadedImages.length > 0
    const hasVariantImages = Object.keys(variantImages).length > 0

    if (!hasMainImages && !hasVariantImages) {
      console.error("❌ No images provided")
      return res.status(400).json({ message: "At least one image is required for the product or its variants" })
    }

    const newProduct = new Product({
      title: name,
      variants: processedVariants,
      description: description || "",
      details: parsedDetails,
      keywords: parsedKeywords,
      productType: productType,
      images: {
        others: uploadedImages,
      },
    })

    console.log("💾 Saving product to database...")
    await newProduct.save()
    console.log("✅ Product saved successfully with ID:", newProduct._id)

    res.status(201).json(newProduct)
  } catch (err) {
    console.error("❌ Product upload error:", err)
    console.error("❌ Error stack:", err.stack)
    res.status(500).json({
      message: "Server error",
      error: err.message,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    })
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

router.put("/update/:id", adminAuth, uploadProduct.array("images", 50), async (req, res) => {
  try {
    console.log("🔍 UPDATE ROUTE CALLED")
    console.log("🔍 Product ID:", req.params.id)
    console.log("🔍 Request body keys:", Object.keys(req.body))
    console.log("🔍 Files received:", req.files?.length || 0)

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

        // Process new images for variants
        const variantImages = {}
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            if (file.fieldname.startsWith("variant_")) {
              const variantIndex = file.fieldname.split("_")[1]
              if (!variantImages[variantIndex]) {
                variantImages[variantIndex] = []
              }
              try {
                const result = await streamUpload(file.buffer, "mirakle-products")
                variantImages[variantIndex].push({ url: result.secure_url, public_id: result.public_id })
                console.log(`✅ Variant ${variantIndex} image uploaded during update`)
              } catch (uploadErr) {
                console.error("❌ Variant image upload error:", uploadErr)
                return res.status(500).json({ message: "Failed to upload variant images" })
              }
            }
          }
        }

        // Merge existing variant images with new ones
        const processedVariants = parsedVariants.map((variant, index) => {
          const existingVariant = product.variants[index] || {}
          const existingImages = existingVariant.images || []
          const newImages = variantImages[index] || []

          return {
            ...variant,
            images: [...existingImages, ...newImages],
          }
        })

        product.variants = processedVariants
      } catch (err) {
        console.error("❌ Variants processing error:", err)
        return res.status(400).json({ message: "Invalid variants JSON" })
      }
    }

    // Handle main product images (existing logic)
    const newImages = []
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (!file.fieldname.startsWith("variant_")) {
          try {
            const result = await streamUpload(file.buffer, "mirakle-products")
            newImages.push({ url: result.secure_url, public_id: result.public_id })
          } catch (uploadErr) {
            console.error("❌ Main image upload error:", uploadErr)
            return res.status(500).json({ message: "Failed to upload main images" })
          }
        }
      }
    }

    // Handle removed images
    if (removedImages) {
      let removedPublicIds
      try {
        removedPublicIds = JSON.parse(removedImages)
        if (Array.isArray(removedPublicIds)) {
          const imagesToKeep = []
          for (const imgObj of product.images.others) {
            if (removedPublicIds.includes(imgObj.public_id)) {
              try {
                await cloudinary.uploader.destroy(imgObj.public_id)
                console.log(`🗑️ Deleted image: ${imgObj.public_id}`)
              } catch (cloudinaryErr) {
                console.error(`❌ Failed to delete image ${imgObj.public_id}:`, cloudinaryErr)
              }
            } else {
              imagesToKeep.push(imgObj)
            }
          }
          product.images.others = imagesToKeep
        }
      } catch (err) {
        console.error("❌ Error processing removed images:", err)
      }
    }

    product.images.others = [...product.images.others, ...newImages]

    if (product.images.others.length === 0 && !product.variants.some((v) => v.images && v.images.length > 0)) {
      return res.status(400).json({ message: "Product must have at least one image." })
    }

    product.markModified("images.others")
    product.markModified("variants")
    await product.save()

    console.log("✅ Product updated successfully")
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

// CRITICAL: Add this missing route - this is what's causing your 404 error!
router.put("/toggle-variant-stock/:id", adminAuth, async (req, res) => {
  try {
    const { variantIndex, isOutOfStock } = req.body
    const productId = req.params.id

    console.log("🔍 Toggle variant stock request:", { productId, variantIndex, isOutOfStock })

    // Validate input
    if (typeof variantIndex !== "number" || variantIndex < 0) {
      return res.status(400).json({ message: "Invalid variant index" })
    }

    if (typeof isOutOfStock !== "boolean") {
      return res.status(400).json({ message: "isOutOfStock must be a boolean" })
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (variantIndex >= product.variants.length) {
      return res.status(400).json({ message: "Variant index out of range" })
    }

    // Update the specific variant's stock status
    product.variants[variantIndex].isOutOfStock = isOutOfStock

    // Mark the variants array as modified for Mongoose
    product.markModified("variants")

    await product.save()

    console.log("✅ Variant stock updated successfully")
    res.json({
      message: "Variant stock updated successfully",
      product,
      updatedVariant: product.variants[variantIndex],
    })
  } catch (err) {
    console.error("❌ Variant stock update error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
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
