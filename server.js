import express from "express"
import mongoose from "mongoose"
import dotenv from "dotenv"
import cors from "cors"

dotenv.config()

const app = express()

const allowedOrigins = [
  "https://mirakle-website-m1xp.vercel.app",
  "https://mirakle-client.vercel.app",
  "https://mirakle-admin.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
]

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error("CORS not allowed for this origin: " + origin))
    }
  },
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use("/uploads", express.static("uploads"))

// Enhanced logging
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// Load routes safely
console.log("🔍 Loading routes...")

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

// 404 handler
app.use("*", (req, res) => {
  console.log("❌ 404 - Route not found:", req.method, req.originalUrl)
  res.status(404).json({
    message: "Route not found",
    requestedUrl: req.originalUrl,
    method: req.method,
  })
})

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully")
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err)
    process.exit(1)
  })

const PORT = process.env.PORT || 7000

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📝 API Base URL: http://localhost:${PORT}`)
  console.log(`📋 Available endpoints:`)
  console.log(`   GET    /api/products/all-products`)
  console.log(`   POST   /api/products/:id/review`)
  console.log(`   GET    /api/banners`)
  console.log(`   POST   /api/login`)
  console.log(`   POST   /api/signup`)
  console.log(`   GET    /api/cart`)
})

export default app
