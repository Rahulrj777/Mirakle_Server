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
  }
});

// Add debugging middleware
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Banner routes working', timestamp: new Date().toISOString() });
});

// POST /upload - Completely rewritten
router.post('/upload-product', upload.array('images', 10), async (req, res) => {
  console.log('=== UPLOAD REQUEST START ===');
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Body keys:', Object.keys(req.body));

  try {
    // First, determine the banner type
    let type;
    
    // Handle multipart form data
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      // Use multer to parse the form data first
      upload.single('image')(req, res, async (err) => {
        if (err) {
          console.log('❌ Multer error:', err);
          return res.status(400).json({ message: `Upload error: ${err.message}` });
        }

        console.log('✅ Multer processed successfully');
        console.log('File:', req.file ? 'Present' : 'Not present');
        console.log('Body after multer:', req.body);

        const { type, hash, title, price, weightValue, weightUnit, oldPrice, discountPercent, productId, selectedVariantIndex, productImageUrl } = req.body;

        if (!type) {
          if (req.file) fs.unlinkSync(req.file.path);
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
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: `Only ${maxLimit} banners allowed for ${type}` });
        }

        let bannerData = {
          type,
          title: title || '',
        };

        // Handle product-based banners
        if (type === 'product-type' || type === 'side') {
          console.log('🛍️ Processing product-based banner');
          
          if (!productId) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'Product ID is required for product-based banners' });
          }

          bannerData = {
            ...bannerData,
            productId,
            selectedVariantIndex: parseInt(selectedVariantIndex) || 0,
            imageUrl: productImageUrl || '',
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

          console.log('💾 Product banner data:', bannerData);

        } else {
          // Handle regular banners with file upload
          console.log('🖼️ Processing regular banner');
          
          if (!req.file) {
            return res.status(400).json({ message: 'Image file is required for this banner type' });
          }

          if (!hash) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'File hash is required' });
          }

          // Check for duplicates
          const existing = await Banner.findOne({ type, hash });
          if (existing) {
            fs.unlinkSync(req.file.path);
            return res.status(409).json({ message: 'This image already exists in the selected type' });
          }

          bannerData = {
            ...bannerData,
            imageUrl: `/${uploadDir}/${req.file.filename}`,
            hash,
          };

          console.log('💾 Regular banner data:', bannerData);
        }

        // Save to database
        try {
          const banner = new Banner(bannerData);
          await banner.save();
          console.log('✅ Banner saved successfully');
          res.status(201).json(banner);
        } catch (saveError) {
          console.log('❌ Save error:', saveError);
          if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          res.status(500).json({ 
            message: 'Failed to save banner', 
            error: saveError.message 
          });
        }
      });
    } else {
      return res.status(400).json({ message: 'Invalid content type' });
    }

  } catch (error) {
    console.log('❌ General error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
  }

  console.log('=== UPLOAD REQUEST END ===');
});

// PUT /:id - Simplified update
router.put('/:id', async (req, res) => {
  console.log('=== UPDATE REQUEST START ===');
  console.log('Banner ID:', req.params.id);

  try {
    // Handle multipart form data for updates
    upload.single('image')(req, res, async (err) => {
      if (err) {
        console.log('❌ Update multer error:', err);
        return res.status(400).json({ message: `Update error: ${err.message}` });
      }

      const { type, title, price, weightValue, weightUnit, oldPrice, discountPercent, productId, selectedVariantIndex, productImageUrl } = req.body;

      if (!type) {
        return res.status(400).json({ message: 'Banner type is required' });
      }

      let updates = {
        type,
        title: title || '',
      };

      // Handle product-based banner updates
      if (type === 'product-type' || type === 'side') {
        updates = {
          ...updates,
          productId,
          selectedVariantIndex: parseInt(selectedVariantIndex) || 0,
          imageUrl: productImageUrl || '',
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
      } else {
        // Handle regular banner updates
        if (req.file) {
          updates.imageUrl = `/${uploadDir}/${req.file.filename}`;
          if (req.body.hash) {
            updates.hash = req.body.hash;
          }
        }
      }

      try {
        const updated = await Banner.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!updated) {
          return res.status(404).json({ message: 'Banner not found' });
        }

        console.log('✅ Banner updated successfully');
        res.json(updated);
      } catch (updateError) {
        console.log('❌ Update save error:', updateError);
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
