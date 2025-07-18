import express from 'express';
import multer from 'multer';
import streamifier from 'streamifier';
import cloudinary from '../utils/cloudinary.js';
import CategoryBanner from '../models/CategoryBanner.js';

const router = express.Router();
const upload = multer();

// ✅ UPLOAD BANNER
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    console.log('Uploading Category Banner:', req.body.title);

    const streamUpload = (req) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'mirakle/categorybanners',
          },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

    const result = await streamUpload(req);

    const banner = new CategoryBanner({
      title: req.body.title,
      imageUrl: result.secure_url,
      public_id: result.public_id,
    });

    await banner.save();
    console.log('Banner saved:', banner._id);
    res.status(201).json(banner);
  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ message: 'Upload failed', error: err });
  }
});

// ✅ GET ALL BANNERS
router.get('/', async (req, res) => {
  try {
    const banners = await CategoryBanner.find();
    console.log(`Fetched ${banners.length} category banners`);
    res.json(banners);
  } catch (err) {
    console.error('Fetch failed:', err);
    res.status(500).json({ message: 'Failed to fetch banners', error: err });
  }
});

// ✅ DELETE ONE BANNER
router.delete('/:id', async (req, res) => {
  try {
    console.log('Attempting to delete banner ID:', req.params.id);
    const banner = await CategoryBanner.findById(req.params.id);
    if (!banner) {
      console.warn('Banner not found');
      return res.status(404).json({ message: 'Not found' });
    }

    await cloudinary.uploader.destroy(banner.public_id);
    await banner.deleteOne();
    console.log('Banner deleted:', req.params.id);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Delete failed:', err);
    res.status(500).json({ message: 'Failed to delete banner', error: err });
  }
});

// ✅ DELETE ALL BANNERS
router.delete('/', async (req, res) => {
  try {
    console.log('Attempting to delete all category banners');
    const banners = await CategoryBanner.find();

    for (const banner of banners) {
      await cloudinary.uploader.destroy(banner.public_id);
      console.log('Deleted from Cloudinary:', banner.public_id);
    }

    await CategoryBanner.deleteMany();
    console.log('All category banners deleted from MongoDB');
    res.json({ message: 'All banners deleted successfully' });
  } catch (err) {
    console.error('Delete all failed:', err);
    res.status(500).json({ message: 'Failed to delete all banners', error: err.message });
  }
});

export default router;
