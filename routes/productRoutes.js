import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
  
import Product from "../models/Product.js"
import auth from "../middleware/auth.js"

const router = express.Router()
const uploadDir = path.join(__dirname, "uploads/products");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/products"));
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

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
    const { name, variants, description, details, keywords } = req.body;

    console.log("🔍 Body:", req.body);
    console.log("🖼 Images:", req.files);

    if (!name || !variants) {
      return res.status(400).json({ message: "Product name and variants are required" });
    }

    let parsedVariants, parsedDetails, parsedKeywords;
    try {
      parsedVariants = JSON.parse(variants);
      parsedDetails = details ? JSON.parse(details) : {};
      parsedKeywords = keywords ? JSON.parse(keywords) : [];
    } catch (err) {
      console.error("❌ JSON Parse Error:", err);
      return res.status(400).json({ message: "Invalid JSON in variants, details, or keywords" });
    }

    const images = req.files.map((file) => `/uploads/products/${file.filename}`);

    const newProduct = new Product({
      title: name,
      variants: parsedVariants,
      description: description || "",
      details: parsedDetails,
      keywords: parsedKeywords,
      images: {
        others: images,
      },
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

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

router.post("/:id/review", auth, async (req, res) => {
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
      // Update existing review
      product.reviews[existingReviewIndex].rating = Number(rating)
      product.reviews[existingReviewIndex].comment = comment.trim()
      product.reviews[existingReviewIndex].createdAt = new Date()
    } else {
      // Create new review
      const newReview = {
        user: req.user.id,
        name: req.user.name || "User",
        rating: Number(rating),
        comment: comment.trim(),
        likes: [],
        dislikes: [],
        createdAt: new Date(),
      }
      product.reviews.push(newReview)
    }

    await product.save()

    // Return the updated product with populated reviews
    const updatedProduct = await Product.findById(req.params.id)
    res.status(201).json({
      message: "Review submitted successfully",
      reviews: updatedProduct.reviews,
    })
  } catch (err) {
    console.error("Review error:", err)
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

    product.reviews.splice(reviewIndex, 1)
    await product.save()

    res.json({ message: "Review deleted successfully" })
  } catch (err) {
    console.error("Delete review error:", err)
    res.status(500).json({ message: "Server error", error: err.message })
  }
})

router.put("/:id", auth, upload.array("images", 10), async (req, res) => {
  try {
    const { name, variants, description, details, removedImages, keywords } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    // Title and description trim
    product.title = name?.trim() || product.title;
    product.description = description?.trim() || "";

    // Parse and assign details
    if (details) {
      try {
        product.details = JSON.parse(details);
      } catch {
        product.details = {};
      }
    }
    // Parse and validate keywords
    if (keywords) {
      try {
        const parsedKeywords = JSON.parse(keywords);
        if (!Array.isArray(parsedKeywords) || !parsedKeywords.every(k => typeof k === 'string')) {
          return res.status(400).json({ message: "Keywords must be an array of strings" });
        }
        product.keywords = parsedKeywords;
      } catch {
        return res.status(400).json({ message: "Invalid keywords JSON" });
      }
    }
    // Parse and validate variants
    if (variants) {
      try {
        const parsedVariants = JSON.parse(variants);
        if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
          return res.status(400).json({ message: "At least one variant is required" });
        }
        product.variants = parsedVariants;
      } catch (err) {
        return res.status(400).json({ message: "Invalid variants JSON" });
      }
    }

    const newImages = req.files?.map(file => `/uploads/products/${file.filename}`) || [];
    console.log("🖼 Uploaded Files:", req.files);

    // Remove selected images
    if (removedImages) {
      try {
        const removed = JSON.parse(removedImages);
        product.images.others = product.images.others.filter((img) => {
          if (removed.includes(img)) {
            const fullPath = path.join(uploadDir, path.basename(img));
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            return false;
          }
          return true; 
        });
      } catch (err) {
        return res.status(400).json({ message: "Invalid removedImages JSON" });
      }
    }
    // Add new images
    product.images.others = [...product.images.others, ...newImages];

    await product.save();
    res.json({ message: "Product updated successfully", product });
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

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

export default router
