import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "qwerty";

export const LoginCheck = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ status: "error", message: "Authorization token missing or malformed" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ status: "error", message: "Invalid or expired token", error: err.message });
  }
};

export const PassengerCheck = (req, res, next) => {
  if (req.user && req.user.role === "passenger") {
    next();
  } else {
    return res
      .status(403)
      .json({ status: "error", message: "Access denied. Passenger role required." });
  }
};

export const DriverCheck = (req, res, next) => {
  if (req.user && req.user.role === "driver") {
    next();
  } else {
    return res
      .status(403)
      .json({ status: "error", message: "Access denied. Driver role required." });
  }
};

export const AdminCheck = (req, res, next) => {
  if (req.user && (req.user.role === "admin" || req.user.email === "admin@voyago.com")) {
    next();
  } else {
    return res
      .status(403)
      .json({ status: "error", message: "Access denied. Admin role required." });
  }
};