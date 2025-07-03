import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import bannerRoutes from './routes/bannerRoutes.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();

const allowedOrigins = [
  "https://mirakle-admin.vercel.app",
  "https://mirakle-client.vercel.app",
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));


app.use(express.json());
app.use('/uploads', express.static('uploads')); 
app.use('/api/products', productRoutes);
app.use('/api/banners', bannerRoutes);
app.use("/api", userRoutes);       

app.get("/", (req, res) => {
  res.send("Mirakle Server is Running");
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
