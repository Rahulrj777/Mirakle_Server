import express from "express";
import {
  adminSignup,
  adminLogin,
  forgotPassword,
  resetPassword,
} from "../controllers/adminController.js";

const router = express.Router();

router.post("/signup", adminSignup);
router.post("/login", adminLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
