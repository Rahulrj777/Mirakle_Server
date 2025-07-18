import express from 'express';
import multer from 'multer';
import OfferBanner from '../models/OfferBanner.js';
import streamifier from 'streamifier';
import cloudinary from '../utils/cloudinary.js';

const router = express.Router();
const upload = multer(); 

// Upload Offer Banner to Cloudinary
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const { title, percentage, slot } = req.body;
    const file = req.file;

    console.log("📥 Upload Request Received:", { title, percentage, slot });

    if (!file) {
      console.log("🚫 No file uploaded");
      return res.status(400).json({ message: "No file uploaded" });
    }

    const streamUpload = (fileBuffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "offer-banners",
          },
          (error, result) => {
            if (result) {
              console.log("✅ Cloudinary Upload Result:", result);
              resolve(result);
            } else {
              console.error("❌ Cloudinary Upload Error:", error);
              reject(error);
            }
          }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
      });
    };

    const result = await streamUpload(file.buffer);

    const banner = new OfferBanner({
      title,
      percentage,
      slot,
      imageUrl: result.secure_url,
      public_id: result.public_id,
    });

    const savedBanner = await banner.save();
    console.log("📝 Banner Saved to DB:", savedBanner);

    res.status(201).json(savedBanner);
  } catch (error) {
    console.error("🔥 Offer Upload Error:", error);
    res.status(500).json({ message: "Offer upload failed", error: error.message });
  }
});

// Get All Offer Banners
router.get('/', async (req, res) => {
  try {
    const banners = await OfferBanner.find();
    console.log("📦 All Offer Banners Fetched:", banners.length);
    res.json(banners);
  } catch (err) {
    console.error("⚠️ Fetch Error:", err.message);
    res.status(500).json({ message: "Failed to fetch banners", error: err.message });
  }
});

// Delete by ID
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

// Delete All
router.delete('/', async (req, res) => {
  try {
    const offers = await OfferBanner.find();
    for (const offer of offers) {
      if (offer.public_id) {
        await cloudinary.uploader.destroy(offer.public_id);
        console.log("🗑️ Cloudinary Image Deleted:", offer.public_id);
      }
    }

    await OfferBanner.deleteMany();
    console.log("🚮 All offer banners deleted");
    res.json({ message: 'All offer banners deleted successfully' });
  } catch (err) {
    console.error("❌ Bulk Deletion Error:", err.message);
    res.status(500).json({ error: 'Failed to delete all offer banners', details: err.message });
  }
});

export default router;
