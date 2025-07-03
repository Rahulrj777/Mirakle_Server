// routes/bannerRoutes.js
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import Banner from '../models/Banner.js';

const router = express.Router();

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

// POST /upload
router.post('/upload', (req, res, next) => {
  const { type } = req.body;
  
  // Skip file upload for product-based banners
  if (type === 'product-type' || type === 'side') {
    return next();
  }
  
  // Handle file upload for other banner types
  const uploader = upload.single('image');
  uploader(req, res, function (err) {
    if (err) {
      // Try with 'bannerImage'
      upload.single('bannerImage')(req, res, function (err2) {
        if (err2) return res.status(400).json({ message: "Upload failed" });
        next();
      });
    } else {
      next();
    }
  });
}, async (req, res) => {
  try {
    const { type, hash, title, price, weightValue, weightUnit, oldPrice, discountPercent, productId, selectedVariantIndex, productImageUrl } = req.body;

    if (!type) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Missing type' });
    }

    const typeLimits = {
      slider: 5,
      side: 3,
      offer: 1,
      'product-type': 10,
    };

    const maxLimit = typeLimits[type] || 10;
    const count = await Banner.countDocuments({ type });

    if (count >= maxLimit) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: `Only ${maxLimit} banners allowed for ${type}` });
    }

    let bannerData = {
      type,
      ...(title ? { title } : {}),
    };

    // Handle product-based banners
    if (type === 'product-type' || type === 'side') {
      if (!productId) {
        return res.status(400).json({ message: 'Product ID is required for product-based banners' });
      }

      bannerData = {
        ...bannerData,
        productId,
        selectedVariantIndex: parseInt(selectedVariantIndex) || 0,
        imageUrl: productImageUrl, // Use product image
        ...(price ? { price: parseFloat(price) } : {}),
        ...(oldPrice ? { oldPrice: parseFloat(oldPrice) } : {}),
        ...(discountPercent ? { discountPercent: parseFloat(discountPercent) } : {}),
        ...(weightValue && weightUnit ? { weight: { value: parseFloat(weightValue), unit: weightUnit } } : {}),
      };
    } else {
      // Handle regular banners with file upload
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      if (!hash) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'Missing hash' });
      }

      const existing = await Banner.findOne({ type, hash });
      if (existing) {
        fs.unlinkSync(req.file.path);
        return res.status(409).json({ message: 'Duplicate image in this banner type' });
      }

      bannerData = {
        ...bannerData,
        imageUrl: `/${uploadDir}/${req.file.filename}`,
        hash,
      };
    }

    const banner = new Banner(bannerData);
    await banner.save();

    res.status(201).json(banner);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (err.code === 11000) return res.status(409).json({ message: 'Duplicate entry.' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /:id
router.put('/:id', (req, res, next) => {
  const { type } = req.body;
  
  // Skip file upload for product-based banners unless updating image
  if ((type === 'product-type' || type === 'side') && !req.body.updateImage) {
    return next();
  }
  
  // Handle file upload for other banner types or when updating product banner image
  upload.single('image')(req, res, next);
}, async (req, res) => {
  try {
    const { type, title, price, weightValue, weightUnit, oldPrice, discountPercent, productId, selectedVariantIndex, productImageUrl } = req.body;

    const updates = {};

    if (type) updates.type = type;
    if (title) updates.title = title;

    // Handle product-based banner updates
    if (type === 'product-type' || type === 'side') {
      if (productId) updates.productId = productId;
      if (selectedVariantIndex !== undefined) updates.selectedVariantIndex = parseInt(selectedVariantIndex);
      if (productImageUrl) updates.imageUrl = productImageUrl;
    }

    if (price) updates.price = parseFloat(price);
    if (oldPrice) updates.oldPrice = parseFloat(oldPrice);
    if (discountPercent) updates.discountPercent = parseFloat(discountPercent);

    if (weightValue && weightUnit) {
      updates.weight = { value: parseFloat(weightValue), unit: weightUnit };
    }

    if (req.file) {
      updates.imageUrl = `/${uploadDir}/${req.file.filename}`;
    }

    const updated = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: 'Banner not found' });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find().populate('productId', 'title images variants');
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    // Only delete file if it's not a product-based banner
    if (banner.type !== 'product-type' && banner.type !== 'side') {
      const filePath = path.join('uploads', path.basename(banner.imageUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;