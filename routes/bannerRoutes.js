import express from "express"

const router = express.Router()

// Add logging middleware
router.use((req, res, next) => {
  console.log(`🔥 BANNER ROUTE: ${req.method} ${req.originalUrl}`)
  console.log(`🔥 Full URL: ${req.protocol}://${req.get("host")}${req.originalUrl}`)
  next()
})

// Test route
router.get("/test", (req, res) => {
  console.log("✅ Banner test route hit")
  res.json({
    message: "Banner routes working!",
    timestamp: new Date().toISOString(),
    route: "/api/banners/test",
  })
})

// Get all banners
router.get("/", (req, res) => {
  console.log("✅ Get banners route hit")
  res.json({
    message: "Get banners working",
    banners: [],
    timestamp: new Date().toISOString(),
  })
})

// Upload route (simplified)
router.post("/upload", (req, res) => {
  console.log("✅ Upload route hit")
  console.log("Content-Type:", req.headers["content-type"])
  console.log("Body keys:", Object.keys(req.body))

  res.json({
    message: "Upload route working",
    received: {
      contentType: req.headers["content-type"],
      bodyKeys: Object.keys(req.body),
      body: req.body,
    },
    timestamp: new Date().toISOString(),
  })
})

export default router
