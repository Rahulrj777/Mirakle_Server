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

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// POST /upload - Simplified version
router.post('/upload', async (req, res) => {
  console.log('=== UPLOAD REQUEST START ===');
  console.log('Request body keys:', Object.keys(req.body));
  console.log('Request type:', req.body.type);

  try {
    const { type } = req.body;

    if (!type) {
      console.log('❌ No type provided');
      return res.status(400).json({ message: 'Banner type is required' });
    }

    console.log('✅ Banner type:', type);

    // Check limits
    const typeLimits = {
      slider: 5,
      side: 3,
      offer: 1,
      'product-type': 10,
    };

    const maxLimit = typeLimits[type] || 10;
    const count = await Banner.countDocuments({ type });
    console.log(`📊 Current count for ${type}: ${count}/${maxLimit}`);

    if (count >= maxLimit) {
      console.log('❌ Limit exceeded');
      return res.status(400).json({ message: `Only ${maxLimit} banners allowed for ${type}` });
    }

    // Handle product-based banners
    if (type === 'product-type' || type === 'side') {
      console.log('🛍️ Processing product-based banner');
      
      const {
        productId,
        selectedVariantIndex,
        productImageUrl,
        title,
        price,
        oldPrice,
        discountPercent,
        weightValue,
        weightUnit
      } = req.body;

      if (!productId) {
        console.log('❌ No product ID provided');
        return res.status(400).json({ message: 'Product selection is required' });
      }

      console.log('✅ Product ID:', productId);

      const bannerData = {
        type,
        productId,
        selectedVariantIndex: parseInt(selectedVariantIndex) || 0,
        imageUrl: productImageUrl || '',
        title: title || '',
        price: parseFloat(price) || 0,
        oldPrice: parseFloat(oldPrice) || 0,
        discountPercent: parseFloat(discountPercent) || 0,
      };

      if (weightValue && weightUnit) {
        bannerData.weight = {
          value: parseFloat(weightValue),
          unit: weightUnit
        };
      }

      console.log('💾 Saving product banner:', bannerData);

      const banner = new Banner(bannerData);
      await banner.save();
      
      console.log('✅ Product banner saved successfully');
      return res.status(201).json(banner);
    }

    // Handle regular banners with file upload
    console.log('🖼️ Processing regular banner with file upload');
    
    // Use multer middleware for file upload
    upload.single('image')(req, res, async (err) => {
      if (err) {
        console.log('❌ Multer error:', err.message);
        return res.status(400).json({ message: `File upload error: ${err.message}` });
      }

      console.log('📁 File upload processed');
      console.log('File info:', req.file ? {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : 'No file');

      if (!req.file) {
        console.log('❌ No file uploaded');
        return res.status(400).json({ message: 'Image file is required' });
      }

      const { hash, title } = req.body;

      if (!hash) {
        console.log('❌ No hash provided, deleting uploaded file');
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: 'File hash is required' });
      }

      console.log('✅ Hash provided:', hash);

      try {
        // Check for duplicates
        const existing = await Banner.findOne({ type, hash });
        if (existing) {
          console.log('❌ Duplicate found, deleting uploaded file');
          fs.unlinkSync(req.file.path);
          return res.status(409).json({ message: 'This image already exists in the selected type' });
        }

        console.log('✅ No duplicate found');

        const bannerData = {
          type,
          imageUrl: `/${uploadDir}/${req.file.filename}`,
          hash,
          title: title || '',
        };

        console.log('💾 Saving regular banner:', bannerData);

        const banner = new Banner(bannerData);
        await banner.save();
        
        console.log('✅ Regular banner saved successfully');
        res.status(201).json(banner);

      } catch (saveError) {
        console.log('❌ Save error:', saveError);
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ 
          message: 'Failed to save banner', 
          error: saveError.message 
        });
      }
    });

  } catch (error) {
    console.log('❌ General error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }

  console.log('=== UPLOAD REQUEST END ===');
});

// PUT /:id - Simplified version
router.put('/:id', async (req, res) => {
  console.log('=== UPDATE REQUEST START ===');
  console.log('Banner ID:', req.params.id);
  console.log('Request body:', req.body);

  try {
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ message: 'Banner type is required' });
    }

    // Handle product-based banner updates
    if (type === 'product-type' || type === 'side') {
      const {
        productId,
        selectedVariantIndex,
        productImageUrl,
        title,
        price,
        oldPrice,
        discountPercent,
        weightValue,
        weightUnit
      } = req.body;

      const updates = {
        type,
        productId,
        selectedVariantIndex: parseInt(selectedVariantIndex) || 0,
        imageUrl: productImageUrl || '',
        title: title || '',
        price: parseFloat(price) || 0,
        oldPrice: parseFloat(oldPrice) || 0,
        discountPercent: parseFloat(discountPercent) || 0,
      };

      if (weightValue && weightUnit) {
        updates.weight = {
          value: parseFloat(weightValue),
          unit: weightUnit
        };
      }

      const updated = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
      if (!updated) {
        return res.status(404).json({ message: 'Banner not found' });
      }

      console.log('✅ Product banner updated');
      return res.json(updated);
    }

    // Handle regular banner updates
    upload.single('image')(req, res, async (uploadErr) => {
      try {
        const updates = {
          type,
          title: req.body.title || '',
        };

        if (req.file) {
          updates.imageUrl = `/${uploadDir}/${req.file.filename}`;
          if (req.body.hash) {
            updates.hash = req.body.hash;
          }
        }

        const updated = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!updated) {
          return res.status(404).json({ message: 'Banner not found' });
        }

        console.log('✅ Regular banner updated');
        res.json(updated);

      } catch (updateError) {
        console.log('❌ Update error:', updateError);
        res.status(500).json({ 
          message: 'Update failed', 
          error: updateError.message 
        });
      }
    });

  } catch (error) {
    console.log('❌ General update error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }

  console.log('=== UPDATE REQUEST END ===');
});

// GET / - Get all banners
router.get('/', async (req, res) => {
  console.log('=== GET BANNERS REQUEST ===');
  
  try {
    const banners = await Banner.find().populate('productId', 'title images variants');
    console.log(`✅ Found ${banners.length} banners`);
    res.json(banners);
  } catch (error) {
    console.log('❌ Get banners error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch banners', 
      error: error.message 
    });
  }
});

// DELETE /:id - Delete banner
router.delete('/:id', async (req, res) => {
  console.log('=== DELETE REQUEST ===');
  console.log('Banner ID:', req.params.id);

  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: 'Banner not found' });
    }

    // Delete file if it's not a product-based banner
    if (banner.type !== 'product-type' && banner.type !== 'side' && banner.imageUrl) {
      const filePath = path.join(uploadDir, path.basename(banner.imageUrl));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('✅ File deleted:', filePath);
      }
    }

    console.log('✅ Banner deleted successfully');
    res.json({ message: 'Banner deleted successfully' });

  } catch (error) {
    console.log('❌ Delete error:', error);
    res.status(500).json({ 
      message: 'Failed to delete banner', 
      error: error.message 
    });
  }
});

export default router;