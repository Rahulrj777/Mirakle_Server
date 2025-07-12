import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // Extract token from "Bearer token"

  if (!token) {
    return res.status(403).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Use your secret key here
    req.user = decoded; // Attach the user info to the request
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export default auth;
