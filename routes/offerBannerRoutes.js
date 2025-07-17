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
    const imageUrl = `/uploads/offer-banners/${req.file.filename}`; 

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

router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const { title, percentage, slot } = req.body;
    const imageUrl = `/uploads/offer-banners/${req.file.filename}`;

    // Ensure slot is unique
    const existing = await OfferBanner.findOne({ slot });
    if (existing) {
      return res.status(400).json({ message: `Slot '${slot}' already has a banner. Please delete it first.` });
    }

    const newOffer = new OfferBanner({ title, percentage, slot, imageUrl });
    await newOffer.save();

    res.status(201).json({ message: 'Offer banner uploaded', offer: newOffer });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
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

    // Delete from DB
    await OfferBanner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Offer deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Deletion failed' });
  }
});

// ❗ Delete All Offer Banners
router.delete('/', async (req, res) => {
    try {
        const banners = await OfferBanner.find();

        // Delete images from disk
        for (const banner of banners) {
            if (fs.existsSync(banner.imageUrl)) {
                fs.unlinkSync(banner.imageUrl);
            }
        }

        await OfferBanner.deleteMany();
        res.json({ message: 'All offer banners deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete all offer banners', details: err.message });
    }
    })

export default router;
