import express from 'express';
import multer from 'multer';
import streamifier from 'streamifier';
import cloudinary from '../utils/cloudinary.js';
import ProductTypeBanner from '../models/ProductTypeBanner.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// @desc    Upload new product type banner
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    console.log('📤 Upload request received');
    console.log('Title:', req.body.title);
    console.log('File:', req.file?.originalname);

    const streamUpload = (req) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'mirakle/producttypebanners',
          },
          (error, result) => {
            if (result) {
              console.log('✅ Cloudinary upload result:', result);
              resolve(result);
            } else {
              console.error('❌ Cloudinary upload error:', error);
              reject(error);
            }
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

    const result = await streamUpload(req);

    const banner = new ProductTypeBanner({
      title: req.body.title,
      imageUrl: result.secure_url,
      public_id: result.public_id,
    });

    await banner.save();
    console.log('✅ Banner saved to MongoDB:', banner);

    res.status(201).json(banner);
  } catch (err) {
    console.error('❌ Upload failed:', err.message);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

// @desc    Get all product type banners
router.get('/', async (req, res) => {
  try {
    const banners = await ProductTypeBanner.find();
    console.log('📥 Fetching all banners:', banners.length);
    res.json(banners);
  } catch (err) {
    console.error('❌ Fetch failed:', err.message);
    res.status(500).json({ message: 'Failed to fetch banners', error: err.message });
  }
});

// @desc    Delete a specific banner by ID
router.delete('/:id', async (req, res) => {
  try {
    console.log('🗑️ Delete request for ID:', req.params.id);

    const banner = await ProductTypeBanner.findById(req.params.id);
    if (!banner) {
      console.warn('⚠️ Banner not found');
      return res.status(404).json({ message: 'Not found' });
    }

    await cloudinary.uploader.destroy(banner.public_id);
    console.log('🗑️ Deleted from Cloudinary:', banner.public_id);

    await banner.deleteOne();
    console.log('🗑️ Deleted from MongoDB:', req.params.id);

    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('❌ Delete failed:', err.message);
    res.status(500).json({ message: 'Failed to delete banner', error: err.message });
  }
});

// @desc    Delete all product type banners
router.delete('/', async (req, res) => {
  try {
    console.log('⚠️ Deleting all banners...');

    const banners = await ProductTypeBanner.find();
    console.log('Found', banners.length, 'banners to delete');

    for (const banner of banners) {
      console.log('🗑️ Deleting from Cloudinary:', banner.public_id);
      await cloudinary.uploader.destroy(banner.public_id);
    }

    await ProductTypeBanner.deleteMany();
    console.log('✅ All banners deleted from MongoDB');

    res.json({ message: 'All banners deleted successfully' });
  } catch (err) {
    console.error('❌ Failed to delete all banners:', err.message);
    res.status(500).json({ message: 'Failed to delete all banners', error: err.message });
  }
});

export default router;
