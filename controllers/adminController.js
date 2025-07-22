import Admin from "../models/Admin.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const generateToken = (id) => {
  return jwt.sign({ id, role: "admin" }, process.env.ADMIN_JWT_SECRET, { expiresIn: "2h" });
};

export const adminSignup = async (req, res) => {
  const { name, email, password } = req.body;

  // Check if an admin already exists in DB
  const existingAdmin = await Admin.findOne();
  if (existingAdmin) {
    return res.status(403).json({ message: "Admin already exists. Signup disabled." });
  }

  const hashed = await bcrypt.hash(password, 10);
  const admin = new Admin({ name, email, password: hashed });

  await admin.save();

  const token = generateToken(admin._id);

  res.status(201).json({
    message: "Admin registered successfully",
    token,
    admin: { id: admin._id, name, email }
  });
};

export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(400).json({ message: "Invalid credentials" });

  const match = await bcrypt.compare(password, admin.password);
  if (!match) return res.status(400).json({ message: "Invalid credentials" });

  const token = generateToken(admin._id);

  res.json({ message: "Login successful", token, admin: { id: admin._id, name: admin.name, email } });
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const admin = await Admin.findOne({ email });
  if (!admin) return res.status(404).json({ message: "Admin not found" });

  const resetToken = crypto.randomBytes(32).toString("hex");
  admin.resetToken = resetToken;
  admin.resetTokenExpiry = Date.now() + 3600000; // 1 hour
  await admin.save();

  // For testing: send token in response (Replace with email in production)
  res.json({ message: "Reset token generated", resetToken });

  // Optional: sendEmail(admin.email, "Reset Password", `Use this token: ${resetToken}`);
};

export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  const admin = await Admin.findOne({
    resetToken: token,
    resetTokenExpiry: { $gt: Date.now() },
  });

  if (!admin) return res.status(400).json({ message: "Invalid or expired token" });

  admin.password = await bcrypt.hash(newPassword, 10);
  admin.resetToken = undefined;
  admin.resetTokenExpiry = undefined;

  await admin.save();
  res.json({ message: "Password reset successful" });
};
