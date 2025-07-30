import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import Product from "../models/Product.js"
import userAuth from "../middleware/userAuth.js"
import adminAuth from "../middleware/adminAuth.js"
import cloudinary from "../utils/cloudinary.js"
import streamifier from "streamifier"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const router = express.Router()

// Multer setup for reviews (disk storage)
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

// Multer in-memory storage for product images
const uploadProduct = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed"), false)
    }
  },
})

// Helper: Upload buffer to Cloudinary
const streamUpload = (fileBuffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto:good" }],
      },
      (error, result) => {
        if (result) resolve(result)
        else reject(error)
      }
    )
    streamifier.createReadStream(fileBuffer).pipe(stream)
  })

// --- Routes ---

// --- Stock check ---
router.post("/check-stock", async (req, res) => {
  try {
    const { productIds } = req.body
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: "Product IDs array is required" })
    }

    const products = await Product.find({ _id: { $in: productIds } }).select(
      "_id title variants isOutOfStock"
    )

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

// --- Get all products ---
router.get("/", async (req, res) => {
  try {
    const products = await Product.find()
    res.json(products)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
})

// --- Public all products with optional filtering ---
router.get("/all-products", async (req, res) => {
  try {
    const { productType } = req.query
    const filter = {}
    if (productType) filter.productType = productType
    const products = await Product.find(filter).sort({ createdAt: -1 })
    res.json(products)
  } catch (err) {
    console.error("❌ Fetch products error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// --- Related products ---
router.get("/related/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    const related = await Product.find({
      _id: { $ne: product._id },
      productType: product.productType,
    }).limit(10)

    res.json(related)
  } catch (error) {
    console.error("❌ Fetch related products error:", error)
    res.status(500).json({ message: "Failed to fetch related products" })
  }
})

// --- Search products ---
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

// --- Reviews ---

router.post("/:id/review", userAuth, uploadReview.array("images", 5), async (req, res) => {
  try {
    const { rating, comment } = req.body
    const reviewImages = req.files?.map((file) => `/uploads/reviews/${file.filename}`) || []

    if (!rating || !comment) {
      // Cleanup uploaded images on error
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
      // Delete old review images
      product.reviews[existingReviewIndex].images.forEach((imgPath) => {
        const fullPath = path.join(reviewUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      })

      product.reviews[existingReviewIndex].rating = Number(rating)
      product.reviews[existingReviewIndex].comment = comment.trim()
      product.reviews[existingReviewIndex].images = reviewImages
      product.reviews[existingReviewIndex].createdAt = new Date()
    } else {
      product.reviews.push({
        user: req.user.id,
        name: req.user.name || "User",
        rating: Number(rating),
        comment: comment.trim(),
        images: reviewImages,
        createdAt: new Date(),
      })
    }

    await product.save()
    const updatedProduct = await Product.findById(req.params.id)
    res.status(201).json({
      message: "Review submitted successfully",
      reviews: updatedProduct.reviews,
    })
  } catch (err) {
    console.error("Review submission error:", err)
    // Cleanup uploaded files on error
    if (req.files) {
      req.files.forEach((file) => {
        const fullPath = path.join(reviewUploadDir, file.filename)
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      })
    }
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.delete("/:id/review/:reviewId", userAuth, async (req, res) => {
  try {
    const { id: productId, reviewId } = req.params
    const userId = req.user.id

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    const reviewIndex = product.reviews.findIndex(
      (r) => r._id.toString() === reviewId && r.user.toString() === userId
    )
    if (reviewIndex === -1)
      return res.status(404).json({ message: "Review not found or unauthorized" })

    const reviewToDelete = product.reviews[reviewIndex]
    if (reviewToDelete.images && reviewToDelete.images.length > 0) {
      reviewToDelete.images.forEach((imgPath) => {
        const fullPath = path.join(reviewUploadDir, path.basename(imgPath))
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
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

// --- Admin Routes ---

// Upload/Create product
router.post("/upload-product", adminAuth, uploadProduct.array("images", 50), async (req, res) => {
  try {
    const { name, variants, description, details, keywords, productType } = req.body

    if (!name || !variants || !productType) {
      return res
        .status(400)
        .json({ message: "Product name, variants, and product type are required" })
    }

    let parsedVariants, parsedDetails, parsedKeywords
    try {
      parsedVariants = JSON.parse(variants)
      parsedDetails = details ? JSON.parse(details) : {}
      parsedKeywords = keywords ? JSON.parse(keywords) : []
    } catch (err) {
      return res.status(400).json({ message: "Invalid JSON in variants, details, or keywords" })
    }

    const uploadedImages = []
    const variantImages = {}

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const result = await streamUpload(file.buffer, "mirakle-products")
          const imageData = { url: result.secure_url, public_id: result.public_id }

          if (file.fieldname.startsWith("variant_")) {
            const variantIndex = parseInt(file.fieldname.split("_")[1])
            if (!variantImages[variantIndex]) variantImages[variantIndex] = []
            variantImages[variantIndex].push(imageData)
          } else {
            uploadedImages.push(imageData)
          }
        } catch (uploadErr) {
          return res.status(500).json({
            message: "Failed to upload some images to Cloudinary",
            error: uploadErr.message,
            file: file.originalname,
          })
        }
      }
    }

    const processedVariants = parsedVariants.map((variant, index) => ({
      ...variant,
      images: variantImages[index] || [],
    }))

    if (uploadedImages.length === 0 && Object.keys(variantImages).length === 0) {
      return res.status(400).json({ message: "At least one image is required for product or variants" })
    }

    const newProduct = new Product({
      title: name,
      variants: processedVariants,
      description: description || "",
      details: parsedDetails,
      keywords: parsedKeywords,
      productType,
      images: { others: uploadedImages },
    })

    await newProduct.save()
    res.status(201).json(newProduct)
  } catch (err) {
    console.error("Product upload error:", err)
    res.status(500).json({
      message: "Server error",
      error: err.message,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    })
  }
})

// Update product
router.put("/update/:id", adminAuth, uploadProduct.array("images", 50), async (req, res) => {
  try {
    const { name, variants, description, details, removedImages, keywords, productType } = req.body
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    // Update simple fields
    if (name) {
      product.title = name.trim()
      product.name = name.trim()
    }
    product.description = description?.trim() || product.description
    product.productType = productType || product.productType

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

    // Remove images requested by admin
    if (removedImages) {
      let removedPublicIds = []
      try {
        removedPublicIds = JSON.parse(removedImages)
        if (Array.isArray(removedPublicIds)) {
          const imagesToKeep = []
          for (const imgObj of product.images.others) {
            if (removedPublicIds.includes(imgObj.public_id)) {
              try {
                await cloudinary.uploader.destroy(imgObj.public_id)
              } catch {}
            } else {
              imagesToKeep.push(imgObj)
            }
          }
          product.images.others = imagesToKeep
        }
      } catch (err) {
        console.error("Error processing removed images:", err)
      }
    }

    // Process new images for variants and main images
    const variantImages = {}
    const newMainImages = []

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.fieldname.startsWith("variant_")) {
          const variantIndex = parseInt(file.fieldname.split("_")[1])
          if (!variantImages[variantIndex]) variantImages[variantIndex] = []
          try {
            const result = await streamUpload(file.buffer, "mirakle-products")
            variantImages[variantIndex].push({ url: result.secure_url, public_id: result.public_id })
          } catch (uploadErr) {
            return res.status(500).json({ message: "Failed to upload variant images" })
          }
        } else {
          try {
            const result = await streamUpload(file.buffer, "mirakle-products")
            newMainImages.push({ url: result.secure_url, public_id: result.public_id })
          } catch (uploadErr) {
            return res.status(500).json({ message: "Failed to upload main images" })
          }
        }
      }
    }

    // Parse & update variants with images merged
    if (variants) {
      let parsedVariants
      try {
        parsedVariants = JSON.parse(variants)
        if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
          return res.status(400).json({ message: "At least one variant is required" })
        }
      } catch {
        return res.status(400).json({ message: "Invalid variants JSON" })
      }

      product.variants = parsedVariants.map((variant, index) => {
        const existingImages = product.variants[index]?.images || []
        const newVarImages = variantImages[index] || []
        return {
          ...variant,
          images: [...existingImages.filter((img) => !removedImages?.includes(img.public_id)), ...newVarImages],
        }
      })
    }

    product.images.others = [...product.images.others, ...newMainImages]

    if (
      product.images.others.length === 0 &&
      !product.variants.some((v) => v.images && v.images.length > 0)
    ) {
      return res.status(400).json({ message: "Product must have at least one image." })
    }

    product.markModified("images.others")
    product.markModified("variants")
    await product.save()

    res.json({ message: "Product updated successfully", product })
  } catch (err) {
    console.error("Update error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// Toggle product stock
router.put("/toggle-stock/:id", adminAuth, async (req, res) => {
  try {
    const { isOutOfStock } = req.body
    const updated = await Product.findByIdAndUpdate(req.params.id, { isOutOfStock }, { new: true })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// Toggle variant stock
router.put("/toggle-variant-stock/:id", adminAuth, async (req, res) => {
  try {
    const { variantIndex, isOutOfStock } = req.body
    const productId = req.params.id

    if (typeof variantIndex !== "number" || variantIndex < 0) {
      return res.status(400).json({ message: "Invalid variant index" })
    }
    if (typeof isOutOfStock !== "boolean") {
      return res.status(400).json({ message: "isOutOfStock must be boolean" })
    }

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })
    if (variantIndex >= product.variants.length) {
      return res.status(400).json({ message: "Variant index out of range" })
    }

    product.variants[variantIndex].isOutOfStock = isOutOfStock
    product.markModified("variants")
    await product.save()

    res.json({
      message: "Variant stock updated successfully",
      product,
      updatedVariant: product.variants[variantIndex],
    })
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

// Delete product
router.delete("/delete/:id", adminAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) return res.status(404).json({ message: "Product not found" })

    // Delete all images from Cloudinary (main + variants)
    for (const imgObj of product.images?.others || []) {
      if (imgObj.public_id) {
        try {
          await cloudinary.uploader.destroy(imgObj.public_id)
        } catch {}
      }
    }
    for (const variant of product.variants || []) {
      for (const img of variant.images || []) {
        if (img.public_id) {
          try {
            await cloudinary.uploader.destroy(img.public_id)
          } catch {}
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id)
    res.json({ message: "Product deleted" })
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

export default router
