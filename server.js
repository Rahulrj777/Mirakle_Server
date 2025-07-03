import express from "express"
import cors from "cors"
import bannerRoutes from "./simple-banner-routes.js"

const app = express()

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  console.log("Origin:", req.headers.origin)
  console.log("User-Agent:", req.headers["user-agent"])
  next()
})

// CORS
app.use(
  cors({
    origin: ["https://mirakle-admin.vercel.app", "http://localhost:3000"],
    credentials: true,
  }),
)

app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Root route
app.get("/", (req, res) => {
  console.log("✅ Root endpoint hit")
  res.json({
    message: "Working server is running",
    timestamp: new Date().toISOString(),
    availableRoutes: [
      "GET /",
      "GET /api/test",
      "GET /api/banners",
      "GET /api/banners/test",
      "POST /api/banners/upload",
    ],
  })
})

// API test route
app.get("/api/test", (req, res) => {
  console.log("✅ API test endpoint hit")
  res.json({ message: "API working", timestamp: new Date().toISOString() })
})

// Register banner routes
console.log("🔧 Registering banner routes...")
app.use("/api/banners", bannerRoutes)
console.log("✅ Banner routes registered")

// 404 handler
app.use("*", (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`)
  res.status(404).json({
    message: "Route not found",
    method: req.method,
    url: req.originalUrl,
    availableRoutes: [
      "GET /",
      "GET /api/test",
      "GET /api/banners",
      "GET /api/banners/test",
      "POST /api/banners/upload",
    ],
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err)
  res.status(500).json({
    message: "Server error",
    error: err.message,
    timestamp: new Date().toISOString(),
  })
})

const PORT = process.env.PORT || 7000
app.listen(PORT, () => {
  console.log(`🚀 Working server running on port ${PORT}`)
  console.log("📍 Available endpoints:")
  console.log(`   Root: http://localhost:${PORT}/`)
  console.log(`   API Test: http://localhost:${PORT}/api/test`)
  console.log(`   Banner Test: http://localhost:${PORT}/api/banners/test`)
  console.log(`   Get Banners: http://localhost:${PORT}/api/banners`)
  console.log(`   Upload: http://localhost:${PORT}/api/banners/upload`)
})
