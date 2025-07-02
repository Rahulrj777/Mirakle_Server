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
  "https://mirakle-client.vercel.app",
  "https://mirakle-admin.vercel.app",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ Blocked by CORS:", origin); // for debugging
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 👇 This must come BEFORE any routes
app.options('*', cors());


app.use(express.json());
app.use('/uploads', express.static('uploads')); 
console.log("Static uploads directory mounted at /uploads");
app.use('/api/products', productRoutes);
console.log("Mounted route: /api/products")
app.use('/api/banners', bannerRoutes);
console.log("Mounted route: /api/banners")
app.use("/api", userRoutes);       
console.log("Mounted route: /api")               

app.get("/", (req, res) => {
  res.send("Mirakle Server is Running");
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

  // Debug: Print all registered route paths
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log("📦 Route:", middleware.route.path);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      const routePath = handler.route?.path;
      const method = Object.keys(handler.route?.methods || {})[0];
      if (routePath) {
        console.log(`🔹 ${method.toUpperCase()} ${routePath}`);
      }
    });
  }
});


const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
