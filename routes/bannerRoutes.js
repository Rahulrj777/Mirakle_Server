import express from "express"
import multer from "multer"
import fs from "fs"
import path from "path"
import Banner from "../models/Banner.js"

const router = express.Router()

const uploadDir = "uploads/banners";
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/banners");
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

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

router.post("/upload", (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      console.log("❌ Multer error:", err.message);
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    }

    try {
      const { type, hash } = req.body;

      if (!type) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Banner type is required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Image file is required" });
      }

      const bannerData = {
        type,
        imageUrl: `/${uploadDir}/${req.file.filename}`,
        hash: hash || null,
      };

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
      if (banner.type !== "product-type" && banner.type !== "side" && banner.imageUrl) {
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

    if (banner.type !== "product-type" && banner.type !== "side" && banner.imageUrl) {
      const filePath = path.join(uploadDir, path.basename(banner.imageUrl))
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }
    res.json({ message: "Banner deleted successfully" })
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete banner",
      error: error.message,
    })
  }
})

export default router
