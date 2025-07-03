import express from "express"
import cors from "cors"

const app = express()

// Enable CORS for your admin panel
app.use(
  cors({
    origin: ["https://mirakle-admin.vercel.app", "http://localhost:3000"],
    credentials: true,
  }),
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Test routes
app.get("/", (req, res) => {
  console.log("✅ Root endpoint hit")
  res.json({ message: "Test server is running", timestamp: new Date().toISOString() })
})

app.get("/api/test", (req, res) => {
  console.log("✅ API test endpoint hit")
  res.json({ message: "API is working", timestamp: new Date().toISOString() })
})

// Banner test routes
app.get("/api/banners/test", (req, res) => {
  console.log("✅ Banner test endpoint hit")
  res.json({ message: "Banner routes are working!", timestamp: new Date().toISOString() })
})

app.get("/api/banners", (req, res) => {
  console.log("✅ Get banners endpoint hit")
  res.json({ message: "Get banners working", banners: [] })
})

app.post("/api/banners/upload", (req, res) => {
  console.log("✅ Upload endpoint hit")
  console.log("Body:", req.body)
  console.log("Headers:", req.headers)
  res.json({ message: "Upload endpoint working", received: Object.keys(req.body) })
})

// Catch all other routes
app.use("*", (req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.originalUrl}`)
  res.status(404).json({
    message: "Route not found",
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  })
})

const PORT = process.env.PORT || 7000
app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`)
  console.log(`📍 Test URLs:`)
  console.log(`   Root: http://localhost:${PORT}/`)
  console.log(`   API Test: http://localhost:${PORT}/api/test`)
  console.log(`   Banner Test: http://localhost:${PORT}/api/banners/test`)
  console.log(`   Get Banners: http://localhost:${PORT}/api/banners`)
  console.log(`   Upload Test: http://localhost:${PORT}/api/banners/upload`)
})
