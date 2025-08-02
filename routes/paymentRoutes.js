// import express from "express";
// import Razorpay from "razorpay";

// const router = express.Router();

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// // Create order
// router.post("/create-order", async (req, res) => {
//   try {
//     const { amount } = req.body; // Amount in INR

//     const options = {
//       amount: amount * 100, // convert to paise
//       currency: "INR",
//       receipt: `receipt_${Date.now()}`
//     };

//     const order = await razorpay.orders.create(options);
//     res.json(order);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Failed to create Razorpay order" });
//   }
// });

// export default router;
