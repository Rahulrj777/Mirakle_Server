// Make sure your main server file (server.js or index.js) looks like this
import express from "express"
import mongoose from "mongoose"
import dotenv from "dotenv"
import cors from "cors"
import bannerRoutes from "./routes/bannerRoutes.js" // EXACT filename match
import productRoutes from "./routes/productRoutes.js"
import userRoutes from "./routes/userRoutes.js"

dotenv.config()

const app = express()

const allowedOrigins = ["https://mirakle-admin.vercel.app", "https://mirakle-client.vercel.app"]

// Enhanced CORS
app.use(
  cors({
    origin: (origin, callback) => {
      console.log("CORS check for origin:", origin)
      if (!origin || allowedOrigins.includes(origin)) {
        console.log("✅ CORS allowed")
        callback(null, true)
      } else {
        console.log("❌ CORS blocked")
        callback(new Error("Not allowed by CORS"))
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
)

// Handle preflight requests
app.options("*", cors())

app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Static files
app.use("/uploads", express.static("uploads"))

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  console.log("Origin:", req.headers.origin)
  next()
})

// Test route
app.get("/api/test", (req, res) => {
  console.log("✅ Test endpoint hit")
  res.json({
    message: "Server is working",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  })
})

// Register routes
console.log("🔧 Registering routes...")
app.use("/api/products", productRoutes)
app.use("/api/banners", bannerRoutes) // Make sure this matches the import
app.use("/api", userRoutes)
console.log("✅ Routes registered")

// Root route
app.get("/", (req, res) => {
  console.log("✅ Root endpoint hit")
  res.send("Mirakle Server is Running")
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err)
  res.status(500).json({
    message: "Server error",
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  })
})

// Database connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err)
    process.exit(1)
  })

const PORT = process.env.PORT || 7000
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
  console.log("Allowed origins:", allowedOrigins)
})
