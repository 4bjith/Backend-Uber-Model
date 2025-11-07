import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import AuthRoute from "./Routes/User.js";
import DriverRoute from "./Routes/Driver.js";
import DriverModel from "./Model/Driver.js";
import RideRoute from "./Routes/Ride.js";

dotenv.config();

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/testdb";
const PORT = process.env.PORT || 8080;

const allowedOrigins = ["http://localhost:5173", "http://localhost:5174"]; // Add more allowed origins as needed

const app = express();
const server = http.createServer(app);

// ✅ Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      } // allow requests with no origin
    },
    credentials: true,
  })
);

// ✅ Routes
app.use(AuthRoute);
app.use(DriverRoute);
app.use(RideRoute);

// ✅ Serve static uploads folder
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ Socket.IO events
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  // check oder status
  socket.on("checkOrderStatus", async (orderId) => {
    console.log("Checking order status for orderId:", orderId);

    setTimeout(async () => {
      try {
        const checkOrder = await OrderModel.findOne({ _id: orderId });
        console.log("Order found:", checkOrder);
        if (checkOrder.status === "accepted") {
          io.to(socket.id).emit("orderStatus", {
            orderId,
            status: "accepted",
          });
        }
      } catch (error) {
        console.error("Error checking order status:", error);
      }
    }, 15000);
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });

  // Receive driver location updates
  socket.on("driver:location:update", async (data) => {
    try {
      const { email, coordinates, socketId } = data;

      if (!email || !coordinates) {
        console.warn("Invalid data received");
        return;
      }

      // GeoJSON expects [lng, lat]
      const { lat, lng } = coordinates;

      // Update driver location in the database
      const driver = await DriverModel.findOneAndUpdate(
        { email },
        {
          $set: {
            socketId: socketId,
            location: {
              type: "Point",
              coordinates: [lng, lat],
            },
          },
        },
        { new: true }
      );
      io.emit("driver:location", coordinates);
      if (driver) {
        console.log(
          `📍 Updated location for ${driver.email}:`,
          driver.location.coordinates
        );
      } else {
        console.warn(`⚠️ Driver not found for email: ${email}`);
      }
    } catch (err) {
      console.error("Error updating driver location:", err);
    }
  });
});

// ✅ Start server (with Socket.IO)
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
