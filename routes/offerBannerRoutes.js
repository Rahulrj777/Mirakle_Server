import express from 'express';
import multer from 'multer';
import streamifier from 'streamifier';
import OfferBanner from '../models/OfferBanner.js';
import cloudinary from '../utils/cloudinary.js';

const router = express.Router();
const upload = multer(); // no storage — we’ll stream to Cloudinary

// Upload Offer Banner to Cloudinary
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { title, percentage, slot } = req.body;

    if (!slot || !["left", "right"].includes(slot)) {
      return res.status(400).json({ message: "Invalid or missing slot (must be 'left' or 'right')." });
    }

    // Ensure slot is unique
    const existing = await OfferBanner.findOne({ slot });
    if (existing) {
      return res.status(400).json({ message: `Slot '${slot}' already has a banner. Please delete it first.` });
    }

    // Upload image buffer to Cloudinary
    const streamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'offer-banners' },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload();

    const newOffer = new OfferBanner({
      title,
      percentage,
      slot,
      imageUrl: result.secure_url, // permanent cloud URL
    });

    await newOffer.save();
    res.status(201).json({ message: 'Offer banner uploaded', offer: newOffer });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// Get All Offer Banners
router.get('/', async (req, res) => {
  const banners = await OfferBanner.find();
  res.json(banners);
});

// Delete by ID
router.delete('/:id', async (req, res) => {
  try {
    const offer = await OfferBanner.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    await OfferBanner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Offer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Deletion failed', details: err.message });
  }
});

// Delete All
router.delete('/', async (req, res) => {
  try {
    await OfferBanner.deleteMany();
    res.json({ message: 'All offer banners deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete all offer banners', details: err.message });
  }
});

export default router;
