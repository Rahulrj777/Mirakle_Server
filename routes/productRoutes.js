// routes/productRoutes.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import Product from '../models/Product.js';

const router = express.Router();

const uploadDir = 'uploads/products';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// GET /api/products/all-products
router.get('/all-products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Updated backend route to accept description and details
router.post('/upload-product', upload.array('images', 10), async (req, res) => {
  try {
    const { name, variants, description, details } = req.body;

    if (!name || !variants) {
      return res.status(400).json({ message: 'Product name and variants are required' });
    }

    const parsedVariants = JSON.parse(variants);
    if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
      return res.status(400).json({ message: 'At least one variant is required' });
    }

    const parsedDetails = details ? JSON.parse(details) : {};
    const images = req.files.map((file) => `/${uploadDir}/${file.filename}`);

    const product = new Product({
      title: name,
      variants: parsedVariants,
      description: description || '',
      details: parsedDetails,
      images: {
        others: images,
      },
    });

    await product.save();
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// PUT /api/products/:id
router.put('/:id', upload.array('images', 10), async (req, res) => {
  try {
    const { name, currentPrice, oldPrice, weightValue, weightUnit, discountPercent } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Update basic fields
    product.title = name || product.title;
    product.currentPrice = parseFloat(currentPrice) || product.currentPrice;
    product.oldPrice = oldPrice ? parseFloat(oldPrice) : undefined;
    product.discountPercent = discountPercent ? parseFloat(discountPercent) : undefined;
    product.weight = {
      value: parseFloat(weightValue) || product.weight.value,
      unit: weightUnit || product.weight.unit,
    };

    // If new images are uploaded, replace the old ones
    if (req.files && req.files.length > 0) {
      const images = req.files.map((file) => `/${uploadDir}/${file.filename}`);
      product.images.others = images;
    }

    await product.save();
    res.json({ message: 'Product updated successfully', product });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/products/:id/toggle-stock
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

// DELETE product by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;
