import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Banner from "../models/Banner.js"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

const uploadDir = path.join(__dirname, "../uploads/banners")
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir) 
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`
    cb(null, uniqueName)
  },
})

const upload = multer({ storage })

router.use((req, res, next) => {
  console.log(`🔥 BANNER ROUTE: ${req.method} ${req.path}`)
  next()
})

router.get("/test", (req, res) => {
  console.log("✅ Banner test route hit")
  res.json({
    message: "Banner routes working!",
    timestamp: new Date().toISOString(),
  })
})

router.get("/", async (req, res) => {
  try {
    const banners = await Banner.find().sort({ createdAt: -1 })
    res.json(banners)
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch banners",
      error: error.message,
    })
  }
})

const BANNER_LIMITS = {
  category: 3,
  offer: 1,
  homebanner: 5, 
  "product-type": 10,
}

router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const {
      type,
      productId,
      productImageUrl,
      title,
      price,
      oldPrice,
      discountPercent,
      weightValue,
      weightUnit,
      hash,
    } = req.body;

    console.log("🔍 Banner Body:", req.body);
    console.log("🖼 Banner File (if any):", req.file);

    if (!type) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Banner type is required" });
    }

    const currentBannerCount = await Banner.countDocuments({ type });
    if (BANNER_LIMITS[type] && currentBannerCount >= BANNER_LIMITS[type]) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res
        .status(400)
        .json({ message: `Limit of ${BANNER_LIMITS[type]} banners reached for type '${type}'` });
    }

    const bannerData = { type };

    // ✅ HOME BANNER or OFFER ZONE
    if (type === "homebanner" || type === "offer") {
      if (!req.file) {
        return res.status(400).json({ message: "Image file is required for this banner type" });
      }

      if (hash) {
        const existing = await Banner.findOne({ type, hash });
        if (existing) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "This image already exists." });
        }
        bannerData.hash = hash;
      }

      bannerData.imageUrl = `/uploads/banners/${req.file.filename}`;
    }

    // ✅ PRODUCT-TYPE: Full product-based banner
    else if (type === "product-type") {
      const existingProductBanner = await Banner.findOne({ type, productId });
      if (existingProductBanner) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Banner for this product already exists." });
      }

      if (!productId || !productImageUrl || !title || !price) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          message: "Product ID, image URL, title, and price are required for this banner type",
        });
      }

      bannerData.productId = productId;
      bannerData.imageUrl = productImageUrl;
      bannerData.title = title;
      bannerData.price = Number(price);
      bannerData.oldPrice = Number(oldPrice) || 0;
      bannerData.discountPercent = Number(discountPercent) || 0;

      if (weightValue && weightUnit) {
        bannerData.weight = { value: Number(weightValue), unit: weightUnit };
      }

      if (req.file) fs.unlinkSync(req.file.path); // Remove temp file
    }

    // ✅ CATEGORY: Just image + title
    else if (type === "category") {
      if (!req.file) {
        return res.status(400).json({ message: "Image is required for category banners" });
      }

      if (!title) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Title is required for category banners" });
      }

      if (hash) {
        const existing = await Banner.findOne({ type, hash });
        if (existing) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "This category banner image already exists." });
        }
        bannerData.hash = hash;
      }

      bannerData.imageUrl = `/uploads/banners/${req.file.filename}`;
      bannerData.title = title;
    }

    // ❌ Unknown type
    else {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Invalid banner type" });
    }

    // ✅ Save to DB
    const banner = new Banner(bannerData);
    const savedBanner = await banner.save();
    console.log("✅ Banner saved successfully:", savedBanner._id);
    res.status(201).json(savedBanner);
  } catch (error) {
    console.error("❌ Upload error:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      message: "Server error during upload",
      error: error.message,
    });
  }
});

router.delete("/", async (req, res) => {
  console.log("🔥 DELETE ALL BANNERS")
  try {
    const { type } = req.query
    let filter = {}
    if (type && type !== "all") {
      filter = { type }
    }
    const banners = await Banner.find(filter)
    banners.forEach((banner) => {
      // Only delete physical files for 'homebanner' and 'offer' types
      if ((banner.type === "homebanner" || banner.type === "offer") && banner.imageUrl) {
        const filePath = path.join(uploadDir, path.basename(banner.imageUrl))
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
    })
    const result = await Banner.deleteMany(filter)
    const message =
      type && type !== "all"
        ? `All ${type} banners deleted successfully (${result.deletedCount} banners)`
        : `All banners deleted successfully (${result.deletedCount} banners)`
    res.json({ message, deletedCount: result.deletedCount })
  } catch (error) {
    console.error("❌ Failed to delete banners:", error)
    res.status(500).json({
      message: "Failed to delete banners",
      error: error.message,
    })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id)
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" })
    }

    if ((banner.type === "homebanner" || banner.type === "offer") && banner.imageUrl) {
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

export default router
