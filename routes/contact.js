import express from "express"
import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

const router = express.Router()

// Add explicit CORS headers for this route
router.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin)
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
  res.header("Access-Control-Allow-Credentials", "true")

  if (req.method === "OPTIONS") {
    res.sendStatus(200)
  } else {
    next()
  }
})

router.post("/", async (req, res) => {
  console.log("📧 Contact form submission received:", req.body)

  const { name, email, message } = req.body

  // Validate required fields
  if (!name || !email || !message) {
    return res.status(400).json({
      error: "Missing required fields",
      required: ["name", "email", "message"],
    })
  }

  try {
    const transporter = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.CONTACT_EMAIL,
        pass: process.env.CONTACT_PASSWORD,
      },
    })

    // Verify transporter configuration
    await transporter.verify()
    console.log("📧 Email transporter verified")

    const mailOptions = {
      from: `"${name}" <${process.env.CONTACT_EMAIL}>`, // Use your email as sender
      replyTo: email, // Set reply-to as the user's email
      to: "rahulsrinivasannkl@gmail.com",
      subject: `New Contact Message from ${name}`,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Contact Form Submission</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Message:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 10px;">
              ${message.replace(/\n/g, "<br>")}
            </div>
          </div>
        </div>
      `,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log("📧 Email sent successfully:", info.messageId)

    res.status(200).json({
      message: "Message sent successfully!",
      messageId: info.messageId,
    })
  } catch (error) {
    console.error("📧 Email error:", error)
    res.status(500).json({
      error: "Failed to send email",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    })
  }
})

export default router
