import express from "express"
import mongoose from "mongoose"
import dotenv from "dotenv"
import cors from "cors"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import routes (assuming these paths are correct relative to app.js)
import bannerRoutes from "./routes/bannerRoutes.js"
import productRoutes from "./routes/productRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import cartRoutes from "./routes/cartRoutes.js"
import offerBannerRoutes from './routes/offerBannerRoutes.js'

dotenv.config()

const app = express()

const allowedOrigins = [
  "https://mirakle-website-m1xp.vercel.app",
  "https://mirakle-client.vercel.app",
  "https://mirakle-admin.vercel.app"
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
app.use(express.json())

// Serve static files from the 'uploads' directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

app.use((req, res, next) => {
  console.log("📥 Request received:", req.method, req.url)
  next()
})

// Use your routes
app.use("/api/products", productRoutes)
app.use("/api/banners", bannerRoutes)
app.use("/api", userRoutes)
app.use("/api/cart", cartRoutes)
app.use('/api/offer-banners', offerBannerRoutes)

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err))

const PORT = process.env.PORT || 7000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))



// import express from "express"
// import mongoose from "mongoose"
// import dotenv from "dotenv"
// import cors from "cors"
// import path from "path"
// import { fileURLToPath } from "url"

// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename)

// import homeBannerRoutes from './routes/homeBannerRoute.js';
// import categoryBannerRoutes from './routes/categoryBannerRoute.js';
// import offerBannerRoutes from './routes/offerBannerRoutes.js'
// import productTypeBannerRoutes from './routes/productTypeBannerRoute.js';
// import productRoutes from "./routes/productRoutes.js"
// import userRoutes from "./routes/userRoutes.js"
// import cartRoutes from "./routes/cartRoutes.js"

// dotenv.config()

// const app = express()

// const allowedOrigins = [
//   "https://mirakle-website-m1xp.vercel.app",
//   "https://mirakle-client.vercel.app",
//   "https://mirakle-admin.vercel.app"
// ]

// const corsOptions = {
//   origin: (origin, callback) => {
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true)
//     } else {
//       callback(new Error("CORS not allowed for this origin: " + origin))
//     }
//   },
//   credentials: true,
// }

// app.use(cors(corsOptions))
// app.use(express.json())

// app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// app.use((req, res, next) => {
//   console.log("📥 Request received:", req.method, req.url)
//   next()
// })

// app.use('/api/home-banners', homeBannerRoutes);
// app.use('/api/category-banners', categoryBannerRoutes);
// app.use('/api/offer-banners', offerBannerRoutes)
// app.use('/api/product-type-banners', productTypeBannerRoutes);
// app.use("/api/products", productRoutes)
// app.use("/api", userRoutes)
// app.use("/api/cart", cartRoutes)

// mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => console.log("MongoDB connected"))
//   .catch((err) => console.error("MongoDB connection error:", err))

// const PORT = process.env.PORT || 7000
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
