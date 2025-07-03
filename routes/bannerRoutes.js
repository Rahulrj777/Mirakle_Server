import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import Banner from '../models/Banner.js';

const router = express.Router();

const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

/**
 * Middleware to handle single file upload from either 'image' or 'bannerImage'
 */
const handleImageUpload = (req, res, next) => {
  const singleUpload = upload.single('image');

  singleUpload(req, res, function (err) {
    if (err || !req.file) {
      // Try 'bannerImage' key
      const fallbackUpload = upload.single('bannerImage');
      fallbackUpload(req, res, function (err2) {
        if (err2 || !req.file) {
          return res.status(400).json({ message: 'File upload failed. Please use "image" or "bannerImage".' });
        }
        next();
      });
    } else {
      next();
    }
  });
};

// POST /upload
// routes/bannerRoutes.js

router.post('/upload', uploadMiddleware, async (req, res) => {
  try {
    const { type, hash, title, price, oldPrice, discountPercent, weightValue, weightUnit, productIds } = req.body;

    const bannerData = { type };
    if (type === 'most-selling' || type === 'product-type') {
      bannerData.products = JSON.parse(productIds || '[]');
    } else {
      if (!req.file || !hash) throw new Error('Missing image or hash');
      bannerData.hash = hash;
      bannerData.imageUrl = `/${uploadDir}/${req.file.filename}`;
      bannerData.title = title || '';
      if (type === 'product-type') {
        bannerData.price = parseFloat(price) || 0;
        bannerData.oldPrice = parseFloat(oldPrice) || 0;
        bannerData.discountPercent = parseFloat(discountPercent) || 0;
        bannerData.weight = weightValue && weightUnit ? { value: parseFloat(weightValue), unit: weightUnit } : undefined;
      }
    }

    const banner = new Banner(bannerData);
    await banner.save();
    return res.status(201).json(banner);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const { type, title, price, oldPrice, discountPercent, weightValue, weightUnit, productIds } = req.body;
    const updates = {};
    if (type === 'most-selling' || type === 'product-type') {
      updates.products = JSON.parse(productIds || '[]');
    }
    if (req.file) updates.imageUrl = `/${uploadDir}/${req.file.filename}`;
    // other updates...
    
    const updated = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!updated) return res.status(404).json({ message: 'Not found' });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
});

// PUT /:id
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const {
      type,
      title,
      price,
      oldPrice,
      discountPercent,
      weightValue,
      weightUnit,
    } = req.body;

    const updates = {};
    if (type) updates.type = type;
    if (title) updates.title = title;
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
    const banners = await Banner.find();
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

    const filePath = path.join('uploads', path.basename(banner.imageUrl));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
