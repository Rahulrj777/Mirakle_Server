import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import cartRoutes from "./routes/cartRoutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "https://mirakle-website-m1xp.vercel.app",
  "https://mirakle-client.vercel.app", 
  "https://mirakle-admin.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed for this origin: " + origin));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`)
  next();
});

app.use("/api/products", productRoutes);
app.use("/api", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/banner", bannerRoutes);

app.get("/", (req, res) => {
  res.send("Mirakle Server is Running");
});

// Load userRoutes
try {
  const userRoutes = await import("./routes/userRoutes.js")
  app.use("/api", userRoutes.default)
  console.log("✅ userRoutes loaded successfully")
} catch (error) {
  console.error("❌ Error loading userRoutes:", error.message)
}

// Load cartRoutes
try {
  const cartRoutes = await import("./routes/cartRoutes.js")
  app.use("/api/cart", cartRoutes.default)
  console.log("✅ cartRoutes loaded successfully")
} catch (error) {
  console.error("❌ Error loading cartRoutes:", error.message)
}

// Load productRoutes
try {
  const productRoutes = await import("./routes/productRoutes.js")
  app.use("/api/products", productRoutes.default)
  console.log("✅ productRoutes loaded successfully")
} catch (error) {
  console.error("❌ Error loading productRoutes:", error.message)
}

// Create a simple bannerRoutes if it doesn't exist
app.get("/api/banners", (req, res) => {
  console.log("📋 Banner request received")
  res.json({
    message: "Banners endpoint working",
    banners: [], // Return empty array for now
  })
})

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "Mirakle Server is Running",
    timestamp: new Date().toISOString(),
    endpoints: {
      products: "/api/products",
      reviews: "/api/products/:id/review",
      cart: "/api/cart",
      auth: "/api/login, /api/signup",
      banners: "/api/banners",
    },
  })
})

// Global error handling
app.use((err, req, res, next) => {
  console.error("🚨 Global error:", {
    error: err.message,
    url: req.url,
    method: req.method,
  })

  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
  })
})

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));