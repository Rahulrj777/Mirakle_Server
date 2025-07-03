import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import Product from '../models/Product.js';

const router = express.Router();

// Ensure product upload folder exists
const productUploadDir = 'uploads/products';
if (!fs.existsSync(productUploadDir)) fs.mkdirSync(productUploadDir, { recursive: true });

const productStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, productUploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage: productStorage });

// =========================
// PUT /api/products/:id
// =========================
router.put('/:id', upload.array('images'), async (req, res) => {
  try {
    const {
      name,
      description,
      variants,
      details,
      removedImages = [],
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.name = name || product.name;
    product.description = description || product.description;
    product.variants = variants ? JSON.parse(variants) : product.variants;
    product.details = details ? JSON.parse(details) : product.details;

    // Remove old images
    if (Array.isArray(removedImages)) {
      removedImages.forEach((imgPath) => {
        const fullPath = path.join('.', imgPath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      });
      product.images.others = product.images.others.filter(img => !removedImages.includes(img));
    }

    // Add new images
    if (req.files && req.files.length > 0) {
      const newImagePaths = req.files.map(file => `/${productUploadDir}/${file.filename}`);
      product.images.others = [...product.images.others, ...newImagePaths];
    }

    await product.save();

    res.json({ message: 'Product updated successfully', product });
  } catch (err) {
    console.error('Product update error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
