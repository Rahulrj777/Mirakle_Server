import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import OfferBanner from '../models/OfferBanner.js'; // update with correct path

const router = express.Router();

// Create upload directory if not exists
const uploadDir = 'uploads/offer-banners';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '')}`)
});
const upload = multer({ storage });

// ✅ Upload Offer Banner
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { title, percentage } = req.body;
    const imageUrl = `${uploadDir}/${req.file.filename}`;

    const newOffer = new OfferBanner({ title, percentage, imageUrl });
    await newOffer.save();

    res.status(201).json({ message: 'Offer banner uploaded', offer: newOffer });
  } catch (err) {
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

    // Delete image from disk
    fs.unlinkSync(offer.imageUrl);

    // Delete from DB
    await OfferBanner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Offer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Deletion failed' });
  }
});

export default router;
