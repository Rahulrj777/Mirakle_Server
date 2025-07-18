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
router.delete("/:id", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" })
    }

    if ((banner.type === "homebanner") && banner.imageUrl) {
      const filePath = path.join(uploadDir, path.basename(banner.imageUrl))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
    res.status(200).json({ message: "Banner deleted successfully" })

  } catch (error) {
    console.error("❌ Failed to delete banner:", error)
    res.status(500).json({
      message: "Failed to delete banner",
      error: error.message,
    })
  }
})

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
