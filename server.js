import express from "express"
import mongoose from "mongoose"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

import bannerRoutes from "./routes/bannerRoutes.js"
import productRoutes from "./routes/productRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import cartRoutes from "./routes/cartRoutes.js"
import offerBannerRoutes from "./routes/offerBannerRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import locationRoutes from "./routes/locationRoutes.js"
import contactRoutes from "./routes/contact.js"

const app = express()

// Simple CORS configuration that allows all origins (for testing)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization")

  if (req.method === "OPTIONS") {
    res.sendStatus(200)
  } else {
    next()
  }
})

app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

app.use((req, res, next) => {
  console.log("📥 Request received:", req.method, req.url, "Origin:", req.headers.origin)
  next()
})

// Routes
app.use("/api/products", productRoutes)
app.use("/api/banners", bannerRoutes)
app.use("/api/users", userRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/offer-banners", offerBannerRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/location", locationRoutes)
app.use("/api/contact", contactRoutes)

app.get("/", (req, res) => {
  res.send("Mirakle Server is Running")
})

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err))

const PORT = process.env.PORT || 7000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
