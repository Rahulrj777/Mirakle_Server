// routes/userRoutes
import express from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import User from "../models/User.js"
import userAuth from "../middleware/userAuth.js"
import nodemailer from "nodemailer";

const router = express.Router()
const otpStore = {};

router.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

  console.log("OTP generated for:", email, "OTP:", otp); // debug

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.CONTACT_EMAIL, pass: process.env.CONTACT_PASSWORD },
  });

  try {
    await transporter.sendMail({
      from: `"Mirakle" <${process.env.CONTACT_EMAIL}>`,
      to: email,
      subject: "Your Mirakle OTP Code",
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Email sending error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];

  if (!record || record.otp !== otp || record.expires < Date.now()) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  delete otpStore[email];

});

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

// ✅ Get all addresses
router.get("/address", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ addresses: user.addresses });
  } catch (err) {
    res.status(500).json({ message: "Failed to get addresses" });
  }
});

// ✅ Add address
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

// ✅ Update address
router.put("/address/:id", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const address = user.addresses.id(req.params.id);

    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // Update only provided fields
    Object.assign(address, req.body);

    await user.save();
    res.json({ message: "Address updated", addresses: user.addresses });
  } catch (err) {
    console.error("Edit error:", err);
    res.status(500).json({ message: "Failed to edit address" });
  }
});

// ✅ Delete address
router.delete("/address/:id", userAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses = user.addresses.filter((a) => a._id.toString() !== req.params.id);
    await user.save();

    res.json({ message: "Address deleted", addresses: user.addresses });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Failed to delete address" });
  }
});

export default router
