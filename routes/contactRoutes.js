import express from "express";
import ContactMessage from "../models/Contact.js";
import nodemailer from "nodemailer";
import userAuth from "../middleware/userAuth.js"; // your auth middleware

const router = express.Router();

// Create reusable transporter once
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.CONTACT_EMAIL,
    pass: process.env.CONTACT_PASSWORD,
  },
});

// POST /api/contact protected route to save msg & send email
router.post("/", userAuth, async (req, res) => {
  const { name, message } = req.body;
  const email = req.user.email;

  if (!name || !message) {
    return res.status(400).json({ success: false, error: "Name and message are required" });
  }

  try {
    const newMessage = new ContactMessage({
      name,
      email,
      message,
      status: "unread",
    });
    await newMessage.save();

    await transporter.sendMail({
      from: `"Mirakle Contact" <${process.env.CONTACT_EMAIL}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `New Contact Message from ${name}`,
      text: `You have received a new message from ${name} (${email}):\n\n${message}`,
    });

    res.status(200).json({ success: true, message: "Message saved and emailed successfully" });
  } catch (error) {
    console.error("Save error:", error);
    res.status(500).json({ success: false, error: "Failed to save message or send email" });
  }
});

// PUT /api/contact/respond/:id
router.put("/respond/:id", async (req, res) => {
  try {
    const message = await ContactMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, error: "Message not found" });

    message.status = "responded";
    await message.save();

    res.json({ success: true, message: "Message marked as responded" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/contact
router.get("/", async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

export default router;
