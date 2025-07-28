import Admin from "../models/Admin.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import crypto from "crypto"

// Increase token expiry time
const generateToken = (id) => {
  return jwt.sign({ id, role: "admin" }, process.env.ADMIN_JWT_SECRET, {
    expiresIn: "24h", // Changed from 2h to 24h
  })
}

export const adminSignup = async (req, res) => {
  try {
    const { name, email, password } = req.body
    const existingAdmin = await Admin.findOne()
    if (existingAdmin) {
      return res.status(403).json({ message: "Admin already exists. Signup disabled." })
    }

    const hashed = await bcrypt.hash(password, 10)
    const admin = new Admin({ name, email, password: hashed })
    await admin.save()
    const token = generateToken(admin._id)

    res.status(201).json({
      message: "Admin registered successfully",
      token,
      admin: { id: admin._id, name, email },
    })
  } catch (error) {
    console.error("Admin signup error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body

    const admin = await Admin.findOne({ email })
    if (!admin) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    const match = await bcrypt.compare(password, admin.password)
    if (!match) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    const token = generateToken(admin._id)

    console.log("✅ Admin login successful:", {
      adminId: admin._id,
      tokenGenerated: !!token,
      tokenPreview: token.substring(0, 20) + "...",
    })

    res.json({
      message: "Login successful",
      token,
      admin: { id: admin._id, name: admin.name, email },
    })
  } catch (error) {
    console.error("❌ Admin login error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body
    const admin = await Admin.findOne({ email })
    if (!admin) return res.status(404).json({ message: "Admin not found" })

    const resetToken = crypto.randomBytes(32).toString("hex")
    admin.resetToken = resetToken
    admin.resetTokenExpiry = Date.now() + 3600000 // 1 hour
    await admin.save()

    res.json({ message: "Reset token generated", resetToken })
  } catch (error) {
    console.error("Forgot password error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body
    const admin = await Admin.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    })

    if (!admin) return res.status(400).json({ message: "Invalid or expired token" })

    admin.password = await bcrypt.hash(newPassword, 10)
    admin.resetToken = undefined
    admin.resetTokenExpiry = undefined
    await admin.save()

    res.json({ message: "Password reset successful" })
  } catch (error) {
    console.error("Reset password error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
}

// Add a token validation endpoint
export const validateToken = async (req, res) => {
  try {
    // If we reach here, the token is valid (middleware already verified it)
    console.log("✅ Token validation successful for user:", req.user)
    res.json({
      message: "Token is valid",
      user: req.user,
      tokenExpiry: new Date(req.user.exp * 1000), // Convert to readable date
    })
  } catch (error) {
    console.error("❌ Token validation error:", error)
    res.status(401).json({ message: "Invalid token" })
  }
}
