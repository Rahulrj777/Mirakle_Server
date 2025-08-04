import express from "express";
import ContactMessage from "../models/Contact.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { name, email, message } = req.body;

  try {
    const newMessage = new ContactMessage({ name, email, message });
    await newMessage.save();

    res.status(200).json({ success: true, message: "Message saved successfully" });
  } catch (error) {
    console.error("❌ Save error:", error.message);
    res.status(500).json({ success: false, error: "Failed to save message" });
  }
});

// ✅ Fetch all messages (Admin panel)
router.get("/", async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("❌ Fetch error:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

export default router;
