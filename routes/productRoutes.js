import express from "express"
import multer from "multer"
import cloudinary from "../config/cloudinary.js"
import Product from "../models/Product.js"
import { adminAuth } from "../middleware/adminAuth.js"
import path from "path"
import fs from "fs"

const router = express.Router()

// Configure multer for memory storage
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"), false)
    }
  },
})

// Helper function to upload image to Cloudinary
const uploadToCloudinary = (buffer, folder = "products") => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: "image",
          folder: folder,
          quality: "auto",
          fetch_format: "auto",
        },
        (error, result) => {
          if (error) {
            reject(error)
          } else {
            resolve({
              url: result.secure_url,
              public_id: result.public_id,
            })
          }
        },
      )
      .end(buffer)
  })
}

// Helper function to delete image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId)
    console.log(`✅ Deleted image: ${publicId}`)
  } catch (error) {
    console.error(`❌ Failed to delete image: ${publicId}`, error)
  }
}

// Get all products
router.get("/all-products", async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 })
    res.json(products)
  } catch (error) {
    console.error("Error fetching products:", error)
    res.status(500).json({ message: "Failed to fetch products" })
  }
})

// Public routes (no auth needed)
router.get("/public", async (req, res) => {
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
const reviewUploadDir = "path/to/review/images" // Declare reviewUploadDir variable

router.delete("/:id/review/:reviewId", async (req, res) => {
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

router.post("/:id/review", upload.array("images", 5), async (req, res) => {
  try {
    const { rating, comment } = req.body

    const reviewImages = []
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await uploadToCloudinary(file.buffer, "mirakle-reviews")
          reviewImages.push(result.secure_url)
        } catch (uploadErr) {
          console.error("❌ Review image upload error:", uploadErr)
        }
      }
    }

    if (!rating || !comment) {
      return res.status(400).json({ message: "Rating and comment are required" })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" })
    }

    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    const existingReviewIndex = product.reviews.findIndex((r) => r.user.toString() === req.user.id)
    if (existingReviewIndex !== -1) {
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
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// Admin routes - using adminAuth middleware
router.post("/upload-product", adminAuth, upload.any(), async (req, res) => {
  try {
    console.log("📦 Creating new product...")
    const { name, description, details, keywords, productType, variants } = req.body

    if (!name || !variants) {
      return res.status(400).json({ message: "Name and variants are required" })
    }

    const parsedVariants = JSON.parse(variants)
    const parsedDetails = details ? JSON.parse(details) : {}
    const parsedKeywords = keywords ? JSON.parse(keywords) : []

    // Process variant images
    const processedVariants = await Promise.all(
      parsedVariants.map(async (variant, variantIndex) => {
        const variantImages = []

        // Find images for this variant
        const variantImageFiles = req.files.filter((file) =>
          file.fieldname.startsWith(`variant_${variantIndex}_image_`),
        )

        // Upload variant images to Cloudinary
        for (const file of variantImageFiles) {
          try {
            const uploadResult = await uploadToCloudinary(file.buffer, `products/variants`)
            variantImages.push(uploadResult)
            console.log(`✅ Uploaded variant ${variantIndex} image: ${uploadResult.url}`)
          } catch (error) {
            console.error(`❌ Failed to upload variant ${variantIndex} image:`, error)
          }
        }

        return {
          ...variant,
          images: variantImages,
        }
      }),
    )

    const newProduct = new Product({
      name,
      title: name,
      description,
      details: parsedDetails,
      keywords: parsedKeywords,
      productType,
      variants: processedVariants,
      images: { others: [] }, // Keep for backward compatibility
    })

    await newProduct.save()
    console.log("✅ Product created successfully")
    res.status(201).json({ message: "Product created successfully", product: newProduct })
  } catch (error) {
    console.error("❌ Error creating product:", error)
    res.status(500).json({ message: "Failed to create product", error: error.message })
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

// Migrate images from common to variants
router.post("/migrate-images/:productId", adminAuth, async (req, res) => {
  try {
    const { productId } = req.params

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    // Check if product has common images to migrate
    if (!product.images?.others?.length) {
      return res.json({ message: "No images to migrate", product })
    }

    console.log(`🔄 Migrating ${product.images.others.length} common images to first variant...`)

    // Migrate common images to first variant
    if (product.variants.length > 0) {
      if (!product.variants[0].images) {
        product.variants[0].images = []
      }

      // Add common images to first variant
      product.variants[0].images.push(...product.images.others)

      // Clear common images
      product.images.others = []

      await product.save()
      console.log("✅ Images migrated successfully")
    }

    res.json({ message: "Images migrated successfully", product })
  } catch (error) {
    console.error("❌ Error migrating images:", error)
    res.status(500).json({ message: "Failed to migrate images", error: error.message })
  }
})

// Bulk migrate all products
router.post("/bulk-migrate-images", adminAuth, async (req, res) => {
  try {
    console.log("🔄 Starting bulk migration...")

    const products = await Product.find({ "images.others.0": { $exists: true } })
    console.log(`Found ${products.length} products with common images to migrate`)

    let migratedCount = 0
    let errorCount = 0

    for (const product of products) {
      try {
        if (product.variants.length > 0) {
          if (!product.variants[0].images) {
            product.variants[0].images = []
          }

          // Add common images to first variant
          product.variants[0].images.push(...product.images.others)

          // Clear common images
          product.images.others = []

          await product.save()
          migratedCount++
          console.log(`✅ Migrated: ${product.title}`)
        }
      } catch (error) {
        console.error(`❌ Failed to migrate ${product.title}:`, error)
        errorCount++
      }
    }

    console.log(`🎉 Bulk migration completed: ${migratedCount} migrated, ${errorCount} errors`)
    res.json({
      message: "Bulk migration completed",
      migratedCount,
      errorCount,
      totalProcessed: products.length,
    })
  } catch (error) {
    console.error("❌ Bulk migration failed:", error)
    res.status(500).json({ message: "Bulk migration failed", error: error.message })
  }
})

// Updated update route with enhanced migration support
router.put("/update/:id", adminAuth, upload.any(), async (req, res) => {
  try {
    console.log(`📝 Updating product: ${req.params.id}`)
    const { name, description, details, keywords, productType, variants } = req.body

    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    const parsedVariants = JSON.parse(variants)
    const parsedDetails = details ? JSON.parse(details) : {}
    const parsedKeywords = keywords ? JSON.parse(keywords) : []

    // Process variant images
    const processedVariants = await Promise.all(
      parsedVariants.map(async (variant, variantIndex) => {
        // Keep existing images that are not File objects
        const existingImages = product.variants[variantIndex]?.images || []
        const keptImages = existingImages.filter((img) => img && img.url)

        // Find new images for this variant
        const variantImageFiles = req.files.filter((file) =>
          file.fieldname.startsWith(`variant_${variantIndex}_image_`),
        )

        // Upload new variant images to Cloudinary
        const newImages = []
        for (const file of variantImageFiles) {
          try {
            const uploadResult = await uploadToCloudinary(file.buffer, `products/variants`)
            newImages.push(uploadResult)
            console.log(`✅ Uploaded new variant ${variantIndex} image: ${uploadResult.url}`)
          } catch (error) {
            console.error(`❌ Failed to upload variant ${variantIndex} image:`, error)
          }
        }

        return {
          ...variant,
          images: [...keptImages, ...newImages],
        }
      }),
    )

    // Update product
    product.name = name
    product.title = name
    product.description = description
    product.details = parsedDetails
    product.keywords = parsedKeywords
    product.productType = productType
    product.variants = processedVariants

    await product.save()
    console.log("✅ Product updated successfully")
    res.json({ message: "Product updated successfully", product })
  } catch (error) {
    console.error("❌ Error updating product:", error)
    res.status(500).json({ message: "Failed to update product", error: error.message })
  }
})

// Delete variant image
router.delete("/variant-image/:productId/:variantIndex/:imageIndex", adminAuth, async (req, res) => {
  try {
    const { productId, variantIndex, imageIndex } = req.params

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    const variant = product.variants[variantIndex]
    if (!variant || !variant.images || !variant.images[imageIndex]) {
      return res.status(404).json({ message: "Image not found" })
    }

    const imageToDelete = variant.images[imageIndex]

    // Delete from Cloudinary
    if (imageToDelete.public_id) {
      await deleteFromCloudinary(imageToDelete.public_id)
    }

    // Remove from database
    variant.images.splice(imageIndex, 1)
    await product.save()

    console.log(`✅ Deleted variant image: ${imageToDelete.url}`)
    res.json({ message: "Image deleted successfully" })
  } catch (error) {
    console.error("❌ Error deleting variant image:", error)
    res.status(500).json({ message: "Failed to delete image", error: error.message })
  }
})

// Toggle variant stock status
router.put("/toggle-variant-stock/:productId", adminAuth, async (req, res) => {
  try {
    const { productId } = req.params
    const { variantIndex, isOutOfStock } = req.body

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    if (!product.variants[variantIndex]) {
      return res.status(404).json({ message: "Variant not found" })
    }

    product.variants[variantIndex].isOutOfStock = isOutOfStock
    await product.save()

    console.log(`✅ Updated variant ${variantIndex} stock status: ${isOutOfStock ? "Out of Stock" : "In Stock"}`)
    res.json({ message: "Variant stock status updated successfully" })
  } catch (error) {
    console.error("❌ Error updating variant stock:", error)
    res.status(500).json({ message: "Failed to update variant stock", error: error.message })
  }
})

// Delete product
router.delete("/delete/:id", adminAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    // Delete all images from Cloudinary
    const imagesToDelete = []

    // Collect common images
    if (product.images?.others) {
      imagesToDelete.push(...product.images.others.map((img) => img.public_id).filter(Boolean))
    }

    // Collect variant images
    product.variants.forEach((variant) => {
      if (variant.images) {
        imagesToDelete.push(...variant.images.map((img) => img.public_id).filter(Boolean))
      }
    })

    // Delete images from Cloudinary
    for (const publicId of imagesToDelete) {
      await deleteFromCloudinary(publicId)
    }

    await Product.findByIdAndDelete(req.params.id)
    console.log(`✅ Deleted product: ${product.title}`)
    res.json({ message: "Product deleted successfully" })
  } catch (error) {
    console.error("❌ Error deleting product:", error)
    res.status(500).json({ message: "Failed to delete product", error: error.message })
  }
})

export default router
