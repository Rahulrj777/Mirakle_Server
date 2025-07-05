// ✅ Required imports
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

import bannerRoutes from './routes/bannerRoutes.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();

// ✅ Allow only your frontend domains
const allowedOrigins = [
  "https://mirakle-client.vercel.app",
  "https://mirakle-admin.vercel.app",
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

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // ✅ Handle preflight requests

app.use(express.json()); // ✅ Parse incoming JSON
app.use("/uploads", express.static("uploads")); // ✅ Serve static uploads

app.use("/api/products", productRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api", userRoutes);

app.get("/", (req, res) => {
  res.send("Mirakle Server is Running");
});
