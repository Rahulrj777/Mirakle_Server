import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose"
import productRoutes from "./routes/productRoutes.js"
import cartRoutes from "./routes/cartRoutes.js"
import userRoutes from "./routes/userRoutes.js" // Assuming you have user routes
import bannerRoutes from "./routes/bannerRoutes.js"

dotenv.config()

const app = express()

const allowedOrigins = [
  "https://mirakle-website-m1xp.vercel.app",
  "https://mirakle-client.vercel.app",
  "https://mirakle-admin.vercel.app",
  "http://localhost:3000", // Add localhost for development
  "http://localhost:5173", // Add Vite dev server
]

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.log("❌ CORS blocked origin:", origin)
      callback(new Error("CORS not allowed for this origin: " + origin))
    }
  },
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json({ limit: "10mb" })) // Increase limit for image uploads
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Serve static files
app.use("/uploads", express.static("uploads"))

// Enhanced request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`)

  // Log review-related requests with more detail
  if (req.url.includes("/review")) {
    console.log("🔍 Review request details:", {
      method: req.method,
      url: req.url,
      headers: {
        authorization: req.headers.authorization ? "Bearer [TOKEN]" : "No auth header",
        "content-type": req.headers["content-type"],
      },
      body: req.method === "POST" ? { ...req.body, images: req.body.images ? "[FILES]" : "No images" } : "N/A",
    })
  }

  next()
})

// Routes
app.use("/api/products", productRoutes)
app.use("/api/banners", bannerRoutes)
app.use("/api", userRoutes)
app.use("/api/cart", cartRoutes)

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
    },
  })
})

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("🚨 Global error handler:", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
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
    availableRoutes: [
      "GET /api/products/all-products",
      "POST /api/products/:id/review",
      "DELETE /api/products/:id/review/:reviewId",
      "POST /api/products/:productId/review/:reviewId/like",
      "POST /api/products/:productId/review/:reviewId/dislike",
    ],
  })
})

// MongoDB connection with better error handling
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully")
    console.log("🔗 Database:", process.env.MONGO_URI.split("@")[1]?.split("?")[0])
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err)
    process.exit(1)
  })

// Handle MongoDB connection events
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err)
})

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected")
})

const PORT = process.env.PORT || 7000

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`)
  console.log(`📝 API Base URL: http://localhost:${PORT}`)
  console.log(`📋 Available endpoints:`)
  console.log(`   GET    /api/products/all-products`)
  console.log(`   POST   /api/products/:id/review`)
  console.log(`   DELETE /api/products/:id/review/:reviewId`)
  console.log(`   POST   /api/products/:productId/review/:reviewId/like`)
  console.log(`   POST   /api/products/:productId/review/:reviewId/dislike`)
  console.log(`   POST   /api/login`)
  console.log(`   POST   /api/signup`)
})

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...")
  mongoose.connection.close(() => {
    console.log("✅ MongoDB connection closed")
    process.exit(0)
  })
})

export default app
