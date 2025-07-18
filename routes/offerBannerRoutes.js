import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import OfferBanner from '../models/OfferBanner.js';

const router = express.Router();

const uploadDir = path.join(__dirname, '../uploads/offer-banners');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '')}`)
});
const upload = multer({ storage });

// ✅ Upload Offer Banner with Slot
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { title, percentage, slot } = req.body;

    if (!slot || !["left", "right"].includes(slot)) {
      return res.status(400).json({ message: "Invalid or missing slot (must be 'left' or 'right')." });
    }

    const imageUrl = `/uploads/offer-banners/${req.file.filename}`;
    console.log("File uploaded:", req.file);

    // Ensure slot is unique
    const existing = await OfferBanner.findOne({ slot });
    if (existing) {
      return res.status(400).json({ message: `Slot '${slot}' already has a banner. Please delete it first.` });
    }

    const newOffer = new OfferBanner({ title, percentage, slot, imageUrl });
    await newOffer.save();

    res.status(201).json({ message: 'Offer banner uploaded', offer: newOffer });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// 🧾 Get All Offer Banners
router.get('/', async (req, res) => {
  const banners = await OfferBanner.find();
  res.json(banners);
});

// ❌ Delete Offer Banner by ID
router.delete('/:id', async (req, res) => {
  try {
    const offer = await OfferBanner.findById(req.params.id);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });

    const filePath = path.resolve('.', offer.imageUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await OfferBanner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Offer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Deletion failed', details: err.message });
  }
});

// ❗ Delete All Offer Banners
router.delete('/', async (req, res) => {
  try {
    const banners = await OfferBanner.find();

    for (const banner of banners) {
      const filePath = path.resolve('.', banner.imageUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await OfferBanner.deleteMany();
    res.json({ message: 'All offer banners deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete all offer banners', details: err.message });
  }
});

export default router;
