import express from "express"
import mongoose from "mongoose"
import dotenv from "dotenv"
import cors from "cors"
import bannerRoutes from "./routes/bannerRoutes.js"
import productRoutes from "./routes/productRoutes.js"
import userRoutes from "./routes/userRoutes.js"

// Load environment variables FIRST
dotenv.config()

const app = express()

// Request logging middleware (FIRST)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  console.log("Origin:", req.headers.origin)
  next()
})

// CORS configuration (SECOND)
const allowedOrigins = [
  "https://mirakle-admin.vercel.app",
  "https://mirakle-client.vercel.app",
  "http://localhost:3000", // For local development
]

app.use(
  cors({
    origin: (origin, callback) => {
      console.log("CORS check for origin:", origin)
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        console.log("✅ CORS allowed")
        callback(null, true)
      } else {
        console.log("❌ CORS blocked for:", origin)
        callback(new Error("Not allowed by CORS"))
      }
    },
    credentials: true,
  }),
)

// Body parsing middleware (THIRD)
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Static files middleware (FOURTH)
app.use("/uploads", express.static("uploads"))

// Test route (BEFORE other routes)
app.get("/", (req, res) => {
  console.log("✅ Root endpoint hit")
  res.json({
    message: "Mirakle Server is Running",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  })
})

app.get("/api/test", (req, res) => {
  console.log("✅ API test endpoint hit")
  res.json({
    message: "API is working",
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
  })
})

// Register API routes (FIFTH)
console.log("🔧 Registering routes...")
try {
  app.use("/api/products", productRoutes)
  app.use("/api/banners", bannerRoutes)
  app.use("/api", userRoutes)
  console.log("✅ All routes registered successfully")
} catch (error) {
  console.error("❌ Route registration error:", error)
}

// Global error handling middleware (LAST)
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err)
  console.error("Stack:", err.stack)
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : "Something went wrong",
    timestamp: new Date().toISOString(),
  })
})

// 404 handler (VERY LAST)
app.use("*", (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`)
  res.status(404).json({
    message: "Route not found",
    method: req.method,
    url: req.url,
    availableRoutes: [
      "GET /",
      "GET /api/test",
      "GET /api/banners",
      "POST /api/banners/upload",
      "GET /api/products/all-products",
    ],
  })
})

// MongoDB connection with better error handling
console.log("🔗 Connecting to MongoDB...")
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully")
    console.log("Database:", mongoose.connection.db.databaseName)
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err)
    process.exit(1) // Exit if database connection fails
  })

// Handle MongoDB connection events
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB error:", err)
})

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB disconnected")
})

// Start server
const PORT = process.env.PORT || 7000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📍 Server URL: http://localhost:${PORT}`)
  console.log("Allowed origins:", allowedOrigins)
  console.log("Environment:", process.env.NODE_ENV || "development")
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error)
  process.exit(1)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason)
  process.exit(1)
})
