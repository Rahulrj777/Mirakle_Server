import jwt from "jsonwebtoken"

const auth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access denied. No token provided." })
    }

    const token = authHeader.split(" ")[1]

    if (!token) {
      return res.status(401).json({ message: "Access denied. Invalid token format." })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key")

    // Ensure the user object has all necessary fields
    req.user = {
      id: decoded.id || decoded._id,
      email: decoded.email,
      name: decoded.name,
      ...decoded,
    }

    console.log("Auth middleware - User:", req.user)
    next()
  } catch (error) {
    console.error("Auth middleware error:", error)
    res.status(401).json({ message: "Invalid token." })
  }
}

export default auth
