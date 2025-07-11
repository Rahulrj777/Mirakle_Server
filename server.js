import express from "express"
import mongoose from "mongoose"
import dotenv from "dotenv"
import cors from "cors"

dotenv.config()

const app = express()

// Basic CORS setup
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
      callback(new Error("CORS not allowed for this origin: " + origin))
    }
  },
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Test route
app.get("/", (req, res) => {
  res.send("Mirakle Server is Running - Debug Mode")
})

app.get("/test", (req, res) => {
  res.json({ message: "Server working fine", timestamp: new Date().toISOString() })
})

// Try to connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err))

const PORT = process.env.PORT || 7000

console.log("🔍 Starting debug server...")
app.listen(PORT, () => {
  console.log(`✅ Debug server running on port ${PORT}`)
  console.log("✅ Basic server is working fine")
})
