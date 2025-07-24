// routes/userRoutes
import express from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import User from "../models/User.js"
import userAuth from "../middleware/userAuth.js"

const router = express.Router()

// Register
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body

    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    })

    await user.save()
    res.status(201).json({ message: "User created successfully" })
  } catch (error) {
    console.error("Signup error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body
    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" })
    }
    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" })
    }
    // Create token
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: user.name,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" },
    )
    res.json({
      token,
      user: {
        _id: user._id,
        userId: user._id, // Add this for compatibility
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get saved addresses
router.get("/address", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: "Failed to get addresses" });
  }
});

// Add new address
router.post("/address", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses.push(req.body);
    await user.save();
    res.status(201).json({ message: "Address added", addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: "Failed to add address" });
  }
});

// Delete address
router.delete("/address/:id", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Correct filtering
    const updatedAddresses = user.addresses.filter(
      a => a._id.toString() !== req.params.id.toString()
    );

    user.addresses = updatedAddresses;
    await user.save();

    res.json({ message: "Address deleted", addresses: user.addresses });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Failed to delete address" });
  }
});

export default router
