import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import AuthRoute from "./Routes/User.js";
import DriverRoute from "./Routes/Driver.js";

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/testdb";
const PORT = process.env.PORT || 8080;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const app = express();
const server = http.createServer(app);

// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

// ✅ MongoDB connection
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB connected successfully."))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: CLIENT_URL }));

// ✅ Routes
app.use( AuthRoute);
app.use( DriverRoute);

// ✅ Serve static uploads folder
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ Socket.IO events
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });

  // Receive driver location updates
  socket.on("location:update", (coords) => {
    console.log("🚗 Driver location:", coords);
    // Broadcast to all connected clients
    io.emit("driver:location", coords);
  });
});

// ✅ Start server (with Socket.IO)
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
