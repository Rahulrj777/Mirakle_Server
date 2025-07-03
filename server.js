import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import bannerRoutes from './routes/bannerRoutes.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';

dotenv.config();

const app = express();

const corsOptions = {
  origin: "*", // TEMP: allow all origins. After testing, restrict if needed.
  credentials: true,
};

// ✅ Use this at the TOP, before any route/static/middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 

// Middleware
app.use(express.json());
app.use('/uploads', express.static('uploads')); 

// Routes
app.use('/api/products', productRoutes);
app.use('/api/banners', bannerRoutes);
app.use("/api", userRoutes);       

app.get("/", (req, res) => {
  res.send("Mirakle Server is Running");
});

// DB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
