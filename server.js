import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import bannerRoutes from './routes/bannerRoutes.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();
const app = express();

// ✅ Allow only admin and client apps
const allowedOrigins = [
  "https://mirakle-admin.vercel.app",
  "https://mirakle-client.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// 🛡️ Apply CORS globally
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 📦 Body parser
app.use(express.json());

// 🖼️ Serve static files for uploaded images
app.use('/uploads', express.static(path.resolve('uploads')));

// 📦 API routes
app.use('/api/products', productRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api', userRoutes);

// ✅ Health check route
app.get("/", (req, res) => {
  res.send("✅ Mirakle Server is Running");
});

// 🧠 MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("🟢 MongoDB connected"))
.catch(err => console.error("🔴 MongoDB connection error:", err));

// 🚀 Start the server
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
