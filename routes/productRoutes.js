// routes/productRoutes.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import product from '../models/Product.js';
import { product } from '../middleware/auth.js';

const router = express.Router();

const uploadDir = 'uploads/products';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

/**
 * GET /api/products/all-products
 */
router.get('/all-products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get("/related/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const keywords = product.keywords || [];

    let related = await Product.find({
      _id: { $ne: product._id },
      keywords: { $in: keywords },
    }).limit(10);

    if (related.length < 4) {
      const additional = await Product.find({
        _id: { $ne: product._id },
      }).limit(10);

      const existingIds = new Set(related.map(p => p._id.toString()));
      additional.forEach(p => {
        if (!existingIds.has(p._id.toString())) {
          related.push(p);
        }
      });
    }

    res.json(related.slice(0, 10));
  } catch (error) {
    console.error("Failed to fetch related products:", error);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/products/upload-product
 */
router.post('/upload-product', upload.array('images', 10), async (req, res) => {
  try {
    const { name, variants, description, details, keywords } = req.body;

    if (!name || !variants) {
      return res.status(400).json({ message: 'Product name and variants are required' });
    }

    let parsedVariants, parsedDetails, parsedKeywords;

    try {
      parsedVariants = JSON.parse(variants);
      parsedDetails = details ? JSON.parse(details) : {};
      parsedKeywords = keywords ? JSON.parse(keywords) : [];
    } catch (err) {
      return res.status(400).json({ message: 'Invalid JSON in variants, details, or keywords' });
    }

    const images = req.files.map(file => `/${uploadDir}/${file.filename}`);

    const newProduct = new Product({
      title: name,
      variants: parsedVariants,
      description: description || '',
      details: parsedDetails,
      keywords: parsedKeywords,
      images: {
        others: images,
      },
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get("/search", async (req, res) => {
  const query = req.query.query || "";

  try {
    const results = await Product.aggregate([
      {
        $match: {
          $or: [
            { title: { $regex: query, $options: "i" } },
            { keywords: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } }
          ],
        },
      },
      {
        $addFields: {
          matchStrength: {
            $cond: [
              { $regexMatch: { input: "$title", regex: query, options: "i" } }, 3,
              {
                $cond: [
                  {
                    $regexMatch: {
                      input: {
                        $reduce: {
                          input: "$keywords",
                          initialValue: "",
                          in: { $concat: ["$$value", " ", "$$this"] }
                        }
                      },
                      regex: query,
                      options: "i"
                    }
                  }, 2,
                  {
                    $cond: [
                      { $regexMatch: { input: "$description", regex: query, options: "i" } }, 1, 0
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      { $sort: { matchStrength: -1, createdAt: -1 } },
      { $limit: 10 }
    ]);

    res.json(results);
  } catch (error) {
    console.error("Search failed:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// POST /api/products/:id/review
router.post('/:id/review', product, async (req, res) => {
  console.log("🔒 producted Review Route Hit");
  console.log("Product ID:", req.params.id);
  console.log("User:", req.user);
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const alreadyReviewed = product.reviews.find(
    (r) => r.user.toString() === req.user._id.toString()
  );
  if (alreadyReviewed) return res.status(400).json({ message: 'Already reviewed' });

  const review = {
    user: req.user._id,
    rating: req.body.rating,
    comment: req.body.comment,
    createdAt: new Date(),
  };

  product.reviews.push(review);
  await product.save();

  res.status(201).json({ message: 'Review added' });
});

/**
 * PUT /api/products/:id
 */
router.put('/:id', upload.array('images', 10), async (req, res) => {
  try {
    const { name, variants, description, details, removedImages, keywords } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.title = name || product.title;
    product.description = description || '';

    if (details) {
      try {
        product.details = JSON.parse(details);
      } catch {
        product.details = {};
      }
    }

    if (keywords) {
      try {
        product.keywords = JSON.parse(keywords);
      } catch (err) {
        return res.status(400).json({ message: 'Invalid keywords JSON' });
      }
    }

    if (variants) {
      try {
        const parsedVariants = JSON.parse(variants);
        product.variants = parsedVariants;
      } catch (err) {
        return res.status(400).json({ message: 'Invalid variants JSON' });
      }
    }

    const newImages = req.files.map(file => `/${uploadDir}/${file.filename}`);

    if (removedImages) {
      try {
        const removed = JSON.parse(removedImages);
        product.images.others = product.images.others.filter(img => {
          if (removed.includes(img)) {
            const fullPath = path.join(uploadDir, path.basename(img));
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            return false;
          }
          return true;
        });
      } catch (err) {
        return res.status(400).json({ message: 'Invalid removedImages JSON' });
      }
    }

    product.images.others = [...product.images.others, ...newImages];

    await product.save();
    res.json({ message: 'Product updated successfully', product });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id/toggle-stock', async (req, res) => {
  try {
    const { isOutOfStock } = req.body;
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { isOutOfStock },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    if (product.images && product.images.others) {
      for (const imgPath of product.images.others) {
        const fullPath = path.join(uploadDir, path.basename(imgPath));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
    }

    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
