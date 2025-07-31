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
router.post("/upload-product", adminAuth, uploadProduct.any(), async (req, res) => {
  try {
    const { name, variants, description, details, keywords, productType } = req.body

    if (!name || !variants || !productType) {
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
            const result = await streamUpload(file.buffer, "mirakle-products/variants")
            variantImages.push({ url: result.secure_url, public_id: result.public_id })
          } catch (uploadErr) {
            console.error("❌ Cloudinary upload error:", uploadErr)
            return res.status(500).json({
              message: "Failed to upload variant images to Cloudinary",
              error: uploadErr.message,
            })
          }
        }

        return {
          ...variant,
          images: variantImages,
        }
      }),
    )

    const newProduct = new Product({
      name: name,
      title: name,
      variants: processedVariants,
      description: description || "",
      details: parsedDetails,
      keywords: parsedKeywords,
      productType: productType,
      images: {
        others: [], // No common images, only variant-specific images
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

// MIGRATION ROUTE - Convert old products to new variant image structure
router.post("/migrate-images/:id", adminAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    console.log("🔄 MIGRATING PRODUCT:", product.title)
    console.log("🔄 Common images:", product.images?.others?.length || 0)
    console.log("🔄 Variants:", product.variants?.length || 0)

    // Check if product has common images but variants don't have images
    if (product.images?.others?.length > 0 && product.variants?.length > 0) {
      const needsMigration = product.variants.some((v) => !v.images || v.images.length === 0)

      if (needsMigration) {
        console.log("🔄 Product needs migration - moving common images to first variant")

        // Move common images to the first variant
        const updatedVariants = product.variants.map((variant, index) => {
          if (index === 0) {
            // First variant gets all common images
            return {
              ...variant,
              images: product.images.others || [],
            }
          } else {
            // Other variants get empty images array (can be populated later)
            return {
              ...variant,
              images: variant.images || [],
            }
          }
        })

        // Update the product
        const updatedProduct = await Product.findByIdAndUpdate(
          req.params.id,
          {
            variants: updatedVariants,
            images: { others: [] }, // Clear common images
          },
          { new: true },
        )

        console.log("✅ Migration completed")
        return res.json({
          message: "Product migrated successfully",
          product: updatedProduct,
          migrated: true,
        })
      }
    }

    res.json({ message: "Product doesn't need migration", migrated: false })
  } catch (err) {
    console.error("❌ Migration error:", err)
    res.status(500).json({ message: "Migration failed", error: err.message })
  }
})

// Updated update route with migration support
router.put("/update/:id", adminAuth, uploadProduct.any(), async (req, res) => {
  try {
    console.log("🔍 UPDATE ROUTE CALLED")
    console.log("🔍 Product ID:", req.params.id)

    const { name, variants, description, details, keywords, productType } = req.body

    // Get current product
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    console.log("🔍 Current product structure:")
    console.log("🔍 Common images:", product.images?.others?.length || 0)
    console.log("🔍 Variants:", product.variants?.length || 0)

    // AUTO-MIGRATE if needed
    let migratedProduct = product
    if (product.images?.others?.length > 0 && product.variants?.length > 0) {
      const needsMigration = product.variants.some((v) => !v.images || v.images.length === 0)
      if (needsMigration) {
        console.log("🔄 AUTO-MIGRATING during update...")
        const updatedVariants = product.variants.map((variant, index) => {
          if (index === 0) {
            return { ...variant, images: product.images.others || [] }
          } else {
            return { ...variant, images: variant.images || [] }
          }
        })

        migratedProduct = await Product.findByIdAndUpdate(
          req.params.id,
          {
            variants: updatedVariants,
            images: { others: [] },
          },
          { new: true },
        )
        console.log("✅ Auto-migration completed")
      }
    }

    // Prepare update object
    const updateData = {}

    if (name?.trim()) {
      updateData.name = name.trim()
      updateData.title = name.trim()
    }

    if (productType) updateData.productType = productType
    if (description !== undefined) updateData.description = description?.trim() || ""

    if (details) {
      try {
        updateData.details = JSON.parse(details)
      } catch {
        updateData.details = {}
      }
    }

    if (keywords) {
      try {
        const parsedKeywords = JSON.parse(keywords)
        updateData.keywords = parsedKeywords
      } catch {
        return res.status(400).json({ message: "Invalid keywords JSON" })
      }
    }

    if (variants) {
      try {
        const parsedVariants = JSON.parse(variants)
        console.log("🔍 Processing variants for update...")

        const processedVariants = await Promise.all(
          parsedVariants.map(async (variant, variantIndex) => {
            // Start with existing images from migrated product
            let variantImages = []
            if (migratedProduct.variants[variantIndex]?.images) {
              variantImages = [...migratedProduct.variants[variantIndex].images]
              console.log(`🔍 Preserving ${variantImages.length} existing images for variant ${variantIndex}`)
            }

            // Add new images
            const variantImageFiles =
              req.files?.filter((file) => file.fieldname.startsWith(`variant_${variantIndex}_image_`)) || []

            console.log(`🔍 Found ${variantImageFiles.length} new images for variant ${variantIndex}`)

            for (const file of variantImageFiles) {
              try {
                const result = await streamUpload(file.buffer, "mirakle-products/variants")
                variantImages.push({ url: result.secure_url, public_id: result.public_id })
                console.log(`✅ Uploaded new image for variant ${variantIndex}`)
              } catch (uploadErr) {
                console.error("❌ Upload error:", uploadErr)
                return res.status(500).json({ message: "Failed to upload images" })
              }
            }

            return {
              ...variant,
              images: variantImages,
            }
          }),
        )

        updateData.variants = processedVariants
      } catch (err) {
        console.error("❌ Variants processing error:", err)
        return res.status(400).json({ message: "Invalid variants JSON" })
      }
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    })

    console.log("✅ Product updated successfully")
    res.json({ message: "Product updated successfully", product: updatedProduct })
  } catch (err) {
    console.error("❌ Update error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.delete("/delete/:id", adminAuth, async (req, res) => {
  try {
    const productId = req.params.id
    const product = await Product.findByIdAndDelete(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    // Delete variant images from Cloudinary
    if (product.variants && product.variants.length > 0) {
      for (const variant of product.variants) {
        if (variant.images && variant.images.length > 0) {
          for (const imgObj of variant.images) {
            if (imgObj.public_id) {
              try {
                await cloudinary.uploader.destroy(imgObj.public_id)
                console.log(`🗑️ Cloudinary variant image deleted: ${imgObj.public_id}`)
              } catch (cloudinaryErr) {
                console.error(`❌ Failed to delete variant image ${imgObj.public_id} from Cloudinary:`, cloudinaryErr)
              }
            }
          }
        }
      }
    }

    // Delete common images from Cloudinary (if any exist)
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

router.put("/toggle-stock/:id", adminAuth, async (req, res) => {
  try {
    const { isOutOfStock } = req.body
    const updated = await Product.findByIdAndUpdate(req.params.id, { isOutOfStock }, { new: true })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put("/toggle-variant-stock/:id", adminAuth, async (req, res) => {
  try {
    const productId = req.params.id
    const { variantIndex, isOutOfStock } = req.body

    const index = Number.parseInt(variantIndex)
    if (isNaN(index) || index < 0) {
      return res.status(400).json({ message: "Invalid variant index" })
    }

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    if (!product.variants || index >= product.variants.length) {
      return res.status(400).json({ message: "Variant index out of range" })
    }

    const updateResult = await Product.updateOne(
      { _id: productId },
      { $set: { [`variants.${index}.isOutOfStock`]: isOutOfStock } },
    )

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ message: "Failed to update variant stock" })
    }

    const updatedProduct = await Product.findById(productId)
    res.json({
      message: "Variant stock updated successfully",
      product: updatedProduct,
      updatedVariant: updatedProduct.variants[index],
    })
  } catch (error) {
    console.error("❌ Variant stock update error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

export default router
