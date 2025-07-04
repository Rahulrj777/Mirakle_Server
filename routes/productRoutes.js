// routes/productRoutes.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import Product from '../models/Product.js';

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

/**
 * POST /api/products/upload-product
 */
router.post('/upload-product', upload.array('images', 10), async (req, res) => {
  try {
    const { name, variants, description, details, keywords } = req.body; // ⬅️ added keywords

    if (!name || !variants) {
      return res.status(400).json({ message: 'Product name and variants are required' });
    }

    let parsedVariants, parsedDetails, parsedKeywords;

    try {
      parsedVariants = JSON.parse(variants);
      parsedDetails = details ? JSON.parse(details) : {};
      parsedKeywords = keywords ? JSON.parse(keywords) : []; // ⬅️ parse keywords
    } catch (err) {
      return res.status(400).json({ message: 'Invalid JSON in variants, details, or keywords' });
    }

    const images = req.files.map(file => `/${uploadDir}/${file.filename}`);

    const newProduct = new Product({
      title: name,
      variants: parsedVariants,
      description: description || '',
      details: parsedDetails,
      keywords: parsedKeywords, // ⬅️ add keywords
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


// GET /api/products/search?query=tomato
router.get("/search", async (req, res) => {
  const query = req.query.query || "";
  try {
    const results = await Product.find({
      title: { $regex: query, $options: "i" },
    }).limit(10);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});


/**
 * PUT /api/products/:id
 */
router.put('/:id', upload.array('images', 10), async (req, res) => {
  try {
    const { name, variants, description, details, removedImages, keywords } = req.body; // ⬅️ added keywords

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.title = name || product.title;
    product.description = description || '';
    product.details = details ? JSON.parse(details) : product.details;

    if (keywords) {
      try {
        const parsedKeywords = JSON.parse(keywords); // ⬅️ parse keywords
        product.keywords = parsedKeywords;
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

/**
 * PUT /api/products/:id/toggle-stock
 */
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

/**
 * DELETE /api/products/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Delete all associated image files
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
