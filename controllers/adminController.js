import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await User.findOne({ email, isAdmin: true });
    if (!admin) return res.status(400).json({ message: "Admin not found or not authorized" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      message: "Admin login successful",
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: "admin" },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
