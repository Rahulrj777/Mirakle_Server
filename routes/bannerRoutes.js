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
router.post('/upload', handleImageUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const {
      type,
      hash,
      title,
      price,
      oldPrice,
      discountPercent,
      weightValue,
      weightUnit,
    } = req.body;

    if (!type || !hash) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Missing type or hash' });
    }

    const typeLimits = {
      slider: 5,
      side: 3,
      offer: 1,
      'product-type': 10,
    };

    const maxLimit = typeLimits[type] || 10;

    const existing = await Banner.findOne({ type, hash });
    if (existing) {
      fs.unlinkSync(req.file.path);
      return res.status(409).json({ message: 'Duplicate image in this banner type' });
    }

    const count = await Banner.countDocuments({ type });
    if (count >= maxLimit) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: `Only ${maxLimit} banners allowed for ${type}` });
    }

    const newBanner = new Banner({
      imageUrl: `/${uploadDir}/${req.file.filename}`,
      type,
      hash,
      title: title || '',
      ...(type === 'product-type' && price && { price: parseFloat(price) }),
      ...(type === 'product-type' && oldPrice && { oldPrice: parseFloat(oldPrice) }),
      ...(type === 'product-type' && discountPercent && { discountPercent: parseFloat(discountPercent) }),
      ...(type === 'product-type' && weightValue && weightUnit && {
        weight: { value: parseFloat(weightValue), unit: weightUnit },
      }),
    });

    await newBanner.save();
    res.status(201).json(newBanner);
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Server error', error: err.message });
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
