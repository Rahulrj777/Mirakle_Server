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
router.post('/upload', async (req, res) => {
  try {
    const { type, productId, selectedVariantIndex, title, price, weightValue, weightUnit, oldPrice, discountPercent, productImageUrl } = req.body;

    if (!type) {
      return res.status(400).json({ message: 'Banner type is required' });
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
      return res.status(400).json({ message: `Only ${maxLimit} banners allowed for ${type}` });
    }

    let bannerData = { type };

    // Handle product-based banners (no file upload needed)
    if (type === 'product-type' || type === 'side') {
      if (!productId) {
        return res.status(400).json({ message: 'Product selection is required for product-based banners' });
      }

      bannerData = {
        ...bannerData,
        productId,
        selectedVariantIndex: parseInt(selectedVariantIndex) || 0,
        imageUrl: productImageUrl,
        title: title || '',
        price: price ? parseFloat(price) : 0,
        oldPrice: oldPrice ? parseFloat(oldPrice) : 0,
        discountPercent: discountPercent ? parseFloat(discountPercent) : 0,
        weight: weightValue && weightUnit ? { 
          value: parseFloat(weightValue), 
          unit: weightUnit 
        } : undefined,
      };
    } else {
      // Handle regular banners with file upload
      return new Promise((resolve, reject) => {
        upload.single('image')(req, res, async (err) => {
          if (err) {
            return res.status(400).json({ message: 'File upload failed' });
          }

          if (!req.file) {
            return res.status(400).json({ message: 'Image file is required for this banner type' });
          }

          const { hash } = req.body;
          if (!hash) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'File hash is required' });
          }

          const existing = await Banner.findOne({ type, hash });
          if (existing) {
            fs.unlinkSync(req.file.path);
            return res.status(409).json({ message: 'This image already exists in the selected type' });
          }

          bannerData = {
            ...bannerData,
            imageUrl: `/${uploadDir}/${req.file.filename}`,
            hash,
            title: title || '',
          };

          try {
            const banner = new Banner(bannerData);
            await banner.save();
            res.status(201).json(banner);
          } catch (error) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            res.status(500).json({ message: 'Server error', error: error.message });
          }
        });
      });
    }

    // Save product-based banner
    const banner = new Banner(bannerData);
    await banner.save();
    res.status(201).json(banner);

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /:id
router.put('/:id', async (req, res) => {
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
      if (price) updates.price = parseFloat(price);
      if (oldPrice) updates.oldPrice = parseFloat(oldPrice);
      if (discountPercent) updates.discountPercent = parseFloat(discountPercent);
      if (weightValue && weightUnit) {
        updates.weight = { value: parseFloat(weightValue), unit: weightUnit };
      }
    } else {
      // Handle regular banner updates with potential file upload
      return new Promise((resolve, reject) => {
        upload.single('image')(req, res, async (uploadErr) => {
          if (uploadErr && !req.file) {
            // No file uploaded, just update other fields
          }

          if (req.file) {
            updates.imageUrl = `/${uploadDir}/${req.file.filename}`;
          }

          try {
            const updated = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
            if (!updated) return res.status(404).json({ message: 'Banner not found' });
            res.json(updated);
          } catch (error) {
            res.status(500).json({ message: error.message });
          }
        });
      });
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
    if (banner.type !== 'product-type' && banner.type !== 'side' && banner.imageUrl) {
      const filePath = path.join('uploads', path.basename(banner.imageUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
