import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // ✅ Generate JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email },
      "mirakle_secret_key", // You should move this to process.env.JWT_SECRET later
      { expiresIn: "7d" }
    );

    res.status(200).json({ user, token }); // ✅ Send token to frontend
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};
