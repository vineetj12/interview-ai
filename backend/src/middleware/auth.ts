import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback_refresh";

export const generateTokens = (userId: string, email: string) => {
  const accessToken = jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: "15m" }
  );
  const refreshToken = jwt.sign(
    { userId },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
};

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

export const verifyRefreshToken = (token: string): { userId: string } | null => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    return null;
  }
};
