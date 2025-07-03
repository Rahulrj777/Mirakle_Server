import express from "express"

const app = express()

// Basic middleware
app.use(express.json())

// Simple CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  if (req.method === "OPTIONS") {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// Test routes
app.get("/", (req, res) => {
  console.log("✅ Root endpoint hit")
  res.json({
    message: "Minimal server working",
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 7000,
  })
})

app.get("/api/test", (req, res) => {
  console.log("✅ API test endpoint hit")
  res.json({
    message: "API test working",
    timestamp: new Date().toISOString(),
  })
})

app.get("/api/banners/test", (req, res) => {
  console.log("✅ Banner test endpoint hit")
  res.json({
    message: "Banner test working!",
    timestamp: new Date().toISOString(),
  })
})

// Simple banner routes
app.get("/api/banners", (req, res) => {
  console.log("✅ Get banners endpoint hit")
  res.json({
    message: "Get banners working",
    banners: [],
    timestamp: new Date().toISOString(),
  })
})

app.post("/api/banners/upload", (req, res) => {
  console.log("✅ Upload endpoint hit")
  res.json({
    message: "Upload endpoint working",
    timestamp: new Date().toISOString(),
  })
})

// 404 handler
app.use("*", (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.url}`)
  res.status(404).json({
    message: "Route not found",
    method: req.method,
    url: req.url,
  })
})

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err)
  res.status(500).json({
    message: "Server error",
    error: err.message,
  })
})

const PORT = process.env.PORT || 7000

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Minimal server running on port ${PORT}`)
  console.log(`📍 Available at: http://0.0.0.0:${PORT}`)
})

// Handle process events
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error)
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason)
})

process.on("SIGTERM", () => {
  console.log("👋 SIGTERM received, shutting down gracefully")
  process.exit(0)
})
