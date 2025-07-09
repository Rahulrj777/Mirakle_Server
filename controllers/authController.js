// controllers/authController.js
import User from "../models/User.js";
import jwt from "jsonwebtoken";

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      "mirakle_secret_key",
      { expiresIn: "7d" }
    );

    res.status(200).json({ user, token }); 
  } catch (err) {
    res.status(500).json({ message: "Login failed", error: err.message });
  }
};
