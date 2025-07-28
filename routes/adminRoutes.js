import express from "express"
import {
  adminSignup,
  adminLogin,
  forgotPassword,
  resetPassword,
  validateToken,
} from "../controllers/adminController.js"
import adminAuth from "../middleware/adminAuth.js"

const router = express.Router()

router.post("/signup", adminSignup)
router.post("/login", adminLogin)
router.post("/forgot-password", forgotPassword)
router.post("/reset-password", resetPassword)

// Add token validation route
router.get("/validate-token", adminAuth, validateToken)

export default router
