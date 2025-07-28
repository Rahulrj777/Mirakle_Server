import jwt from "jsonwebtoken"

// Simple admin-only auth middleware
const adminAuth = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]

  if (!token) {
    return res.status(403).json({ message: "No token provided" })
  }

  try {
    // Only verify with admin secret
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET)
    req.user = decoded
    next()
  } catch (err) {
    console.error("Admin token verification failed:", err.message)
    return res.status(401).json({ message: "Invalid token" })
  }
}

// Keep your existing functions but also export default
export const verifyToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]
  if (!token) return res.status(403).json({ message: "No token provided" })

  try {
    let decoded
    try {
      // Try verifying admin token first
      decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET)
      decoded.role = "admin"
    } catch {
      // Try verifying user token
      decoded = jwt.verify(token, process.env.JWT_SECRET)
      decoded.role = "user"
    }
    req.user = decoded
    next()
  } catch (err) {
    console.error("Token verification failed:", err.message)
    return res.status(401).json({ message: "Invalid token" })
  }
}

export const isAdmin = (req, res, next) => {
  if (req.user?.role === "admin") {
    next()
  } else {
    res.status(403).json({ message: "Access denied: Admins only" })
  }
}

// Export the simple adminAuth as default
export default adminAuth
