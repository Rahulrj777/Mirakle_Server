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

// --- POST /upload ---
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const {
      type,
      hash,
      title,
      price,
      weightValue,
      weightUnit,
      oldPrice,
      discountPercent,
      productId,
      selectedVariantIndex,
      productImageUrl,
    } = req.body;

    if (!type) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
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
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: `Only ${maxLimit} banners allowed for ${type}` });
    }

    let bannerData = {
      type,
      ...(title ? { title } : {}),
    };

    if (type === 'product-type' || type === 'side') {
      if (!productId) return res.status(400).json({ message: 'Product ID required for this banner type' });

      bannerData = {
        ...bannerData,
        productId,
        selectedVariantIndex: parseInt(selectedVariantIndex) || 0,
        imageUrl: productImageUrl,
        ...(price ? { price: parseFloat(price) } : {}),
        ...(oldPrice ? { oldPrice: parseFloat(oldPrice) } : {}),
        ...(discountPercent ? { discountPercent: parseFloat(discountPercent) } : {}),
        ...(weightValue && weightUnit
          ? { weight: { value: parseFloat(weightValue), unit: weightUnit } }
          : {}),
      };
    } else {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
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
    console.error('Upload failed:', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
