import jwt from "jsonwebtoken"

const auth = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  console.log("💡 Auth Header:", authHeader)

  const token = authHeader?.split(" ")[1]
  console.log("💡 Extracted Token:", token)

  if (!token) {
    return res.status(403).json({ message: "No token provided" })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    console.log("✅ Decoded Token:", decoded)
    req.user = decoded
    next()
  } catch (err) {
    console.error("❌ JWT Error:", err.message)
    return res.status(401).json({ message: "Invalid token" })
  }
}


export default auth
