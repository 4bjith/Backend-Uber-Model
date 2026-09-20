import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import http from "http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import AuthRoute from "./Routes/User.js";
import DriverRoute from "./Routes/Driver.js";
import DriverModel from "./Model/Driver.js";
import RideRoute from "./Routes/Ride.js";
import RideModel from "./Model/Ride.js";
import PaymentRoute from "./Routes/Payment.js";
import AdminRoute from "./Routes/Admin.js";

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/testdb";
const PORT = process.env.PORT || 8080;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
];

const app = express();
const server = http.createServer(app);

// ✅ Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ✅ Cookie parser
app.use(cookieParser());

// ✅ Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // max 1000 requests per window
  message: { status: "error", message: "Too many requests from this IP, please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // max 100 auth attempts per 15 min
  message: { status: "error", message: "Too many authentication attempts, please try again later." },
});

app.use(generalLimiter);
app.use("/login", authLimiter);
app.use("/driverlogin", authLimiter);
app.use("/register", authLimiter);
app.use("/signup-driver", authLimiter);

// ✅ MongoDB connection
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB connected successfully."))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Body Parsing Middleware with Raw Body capture for Cashfree Webhooks
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ✅ Socket.IO setup
export const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"],
  },
});

// ✅ Routes
app.use(AuthRoute);
app.use(DriverRoute);
app.use(RideRoute);
app.use(PaymentRoute);
app.use("/api/payments", PaymentRoute);
app.use(AdminRoute);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() });
});

// ✅ Serve static uploads folder
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ Socket.IO events
io.on("connection", (socket) => {
  // console.log("🟢 Client connected:", socket.id);

  socket.on("disconnect", () => {
    // console.log("🔴 Client disconnected:", socket.id);
  });

  // Receive driver location updates
  socket.on("driver:location:update", async (data) => {
    try {
      const { email, coordinates, socketid } = data;
      if (!email || !coordinates) return;

      const { lat, lng } = coordinates;
      await DriverModel.findOneAndUpdate(
        { email },
        {
          $set: {
            socketId: socketid || socket.id,
            location: {
              type: "Point",
              coordinates: [lng, lat],
            },
          },
        },
        { new: true }
      );

      io.emit("driver:location", coordinates);
    } catch (err) {
      console.error("Error updating driver location:", err);
    }
  });

  socket.on("driver:ridestart", async (data) => {
    try {
      const { rideId, destination, currentLocation } = data;
      await RideModel.findOneAndUpdate(
        { _id: rideId },
        {
          status: "in_progress",
        }
      );

      io.emit("ride:status", {
        rideId,
        status: "in_progress",
      });
      io.emit("ride:started", {
        rideId,
        destination,
        currentLocation,
      });
    } catch (err) {
      console.error("Error in driver:ridestart:", err);
    }
  });

  socket.on("user:location:update", (data) => {
    if (data?.coordinates) {
      io.emit("user:location", {
        email: data.email,
        lat: data.coordinates.lat,
        lng: data.coordinates.lng,
      });
    }
  });
});

// ✅ Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("🚨 Unhandled Error:", err);
  const status = err.status || 500;
  res.status(status).json({
    status: "error",
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
});

// Export server and app for testing
export { app, server };

// ✅ Start server
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}
