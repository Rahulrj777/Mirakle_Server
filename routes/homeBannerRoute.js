import express from "express";
import multer from "multer";
import streamifier from "streamifier";
import cloudinary from "../utils/cloudinary.js";
import HomeBanner from "../models/HomeBanner.js";

const router = express.Router();
const upload = multer();

// ✅ Upload a single banner
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    console.log("📤 Upload request received");

    if (!req.file) {
      console.log("❌ No image file found in request");
      return res.status(400).json({ message: "Image is required" });
    }

    const streamUpload = () =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "mirakle/homebanners" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });

    const result = await streamUpload();
    console.log("✅ Image uploaded to Cloudinary:", result.secure_url);

    const newBanner = new HomeBanner({
      imageUrl: result.secure_url,
      publicId: result.public_id,
    });

    const saved = await newBanner.save();
    console.log("✅ Banner saved to DB:", saved._id);
    res.status(201).json(saved);
  } catch (err) {
    console.error("❌ Upload failed:", err.message);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
});

// ✅ Get all banners
router.get("/", async (req, res) => {
  try {
    console.log("📥 Fetching all banners");
    const banners = await HomeBanner.find().sort({ createdAt: -1 });
    res.json(banners);
  } catch (err) {
    console.error("❌ Fetch failed:", err.message);
    res.status(500).json({ message: "Fetch failed", error: err.message });
  }
});

// ✅ Delete a single banner by ID
router.delete("/:id", async (req, res) => {
  try {
    console.log(`🗑️ Deleting banner with ID: ${req.params.id}`);

    const banner = await HomeBanner.findById(req.params.id);
    if (!banner) {
      console.log("❌ Banner not found");
      return res.status(404).json({ message: "Banner not found" });
    }

    if (banner.publicId) {
      await cloudinary.uploader.destroy(banner.publicId);
      console.log("✅ Deleted from Cloudinary:", banner.publicId);
    }

    await HomeBanner.findByIdAndDelete(req.params.id);
    console.log("✅ Deleted from DB:", req.params.id);
    res.json({ message: "Banner deleted" });
  } catch (err) {
    console.error("❌ Deletion failed:", err.message);
    res.status(500).json({ message: "Deletion failed", error: err.message });
  }
});

// ✅ Delete all banners
router.delete("/", async (req, res) => {
  try {
    console.log("🧨 Bulk delete triggered");

    const allBanners = await HomeBanner.find();
    for (const banner of allBanners) {
      if (banner.publicId) {
        await cloudinary.uploader.destroy(banner.publicId);
        console.log("🗑️ Cloudinary deleted:", banner.publicId);
      }
    }

    await HomeBanner.deleteMany({});
    console.log("✅ All banners deleted from DB");
    res.json({ message: "All banners deleted successfully" });
  } catch (err) {
    console.error("❌ Bulk deletion failed:", err.message);
    res.status(500).json({ message: "Bulk deletion failed", error: err.message });
  }
});

export default router;
