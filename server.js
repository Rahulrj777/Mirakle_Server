import express from "express"
import mongoose from "mongoose"
import dotenv from "dotenv"
import cors from "cors"

dotenv.config()

const app = express()

const allowedOrigins = [
  "https://mirakle-website-m1xp.vercel.app",
  "https://mirakle-client.vercel.app",
  "https://mirakle-client-ocphit56c-rahulrj777s-projects.vercel.app",
  "https://mirakle-admin.vercel.app",
]

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.error("🚨 CORS blocked origin:", origin)
      callback(new Error("CORS not allowed for this origin: " + origin))
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}

app.use(cors(corsOptions))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

app.use((req, res, next) => {
  console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

app.get("/", (req, res) => {
  res.send("Mirakle Server is Running")
})

app.get("/test", (req, res) => {
  res.json({
    message: "Server working fine",
    timestamp: new Date().toISOString(),
  })
})

// ✅ STEP 1: Try adding userRoutes first
console.log("🔍 Step 1: Loading user routes...")
try {
  const { default: userRoutes } = await import("./routes/userRoutes.js")
  app.use("/api", userRoutes)
  console.log("✅ User routes loaded successfully")
} catch (error) {
  console.error("❌ Error loading user routes:", error.message)
  process.exit(1) // Exit if this fails
}

// ✅ STEP 2: Try adding cartRoutes
console.log("🔍 Step 2: Loading cart routes...")
try {
  const { default: cartRoutes } = await import("./routes/cartRoutes.js")
  app.use("/api/cart", cartRoutes)
  console.log("✅ Cart routes loaded successfully")
} catch (error) {
  console.error("❌ Error loading cart routes:", error.message)
  process.exit(1) // Exit if this fails
}

// ✅ STEP 3: Try adding bannerRoutes
console.log("🔍 Step 3: Loading banner routes...")
try {
  const { default: bannerRoutes } = await import("./routes/bannerRoutes.js")
  app.use("/api/banners", bannerRoutes)
  console.log("✅ Banner routes loaded successfully")
} catch (error) {
  console.error("❌ Error loading banner routes:", error.message)
  process.exit(1) // Exit if this fails
}

// ✅ STEP 4: Try adding productRoutes (this is likely the problematic one)
console.log("🔍 Step 4: Loading product routes...")
try {
  const { default: productRoutes } = await import("./routes/productRoutes.js")
  app.use("/api/products", productRoutes)
  console.log("✅ Product routes loaded successfully")
} catch (error) {
  console.error("❌ Error loading product routes:", error.message)
  console.error("❌ This is likely the problematic route file!")
  process.exit(1) // Exit if this fails
}

app.use("/uploads", express.static("uploads"))

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err))

const PORT = process.env.PORT || 7000

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`)
  console.log("✅ All routes loaded successfully!")
})
