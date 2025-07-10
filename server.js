import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import productRoutes from "./routes/productRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import cartRoutes from "./routes/cartRoutes.js"
import bannerRoutes from "./routes/bannerRoutes.js"
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

app.use("/api/products", productRoutes)
app.use("/api", userRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/banner", bannerRoutes)

app.use(cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use((req, res, next) => {
  console.log("📥 Request received:", req.method, req.url);
  next();
});

// Test userRoutes first
console.log("🔍 Loading userRoutes...");
try {
  const userRoutes = await import('./routes/userRoutes.js');
  app.use("/api", userRoutes.default);
  console.log("✅ userRoutes loaded successfully");
} catch (error) {
  console.error("❌ Error loading userRoutes:", error.message);
}

app.get("/", (req, res) => {
  res.send("Mirakle Server is Running - Testing userRoutes only");
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));