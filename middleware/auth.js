// File: middleware/auth.js
import jwt from "jsonwebtoken";

const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key");

    req.user = {
      id: decoded.userId || decoded.id,
      ...decoded, 
    };

    next();
  } catch (error) {
    console.error("❌ Invalid token:", error.message);
    return res.status(401).json({ message: "Invalid token." });
  }
};

export default auth;
