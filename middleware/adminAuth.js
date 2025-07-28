// middleware/adminAuth.js
import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(403).json({ message: "No token provided" });

  try {
    let decoded;

    try {
      // Try verifying admin token
      decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
      decoded.role = "admin";
    } catch {
      // Try verifying user token
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      decoded.role = "user";
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user?.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Access denied: Admins only" });
  }
};
