import mongoose from "mongoose";

const RideSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "driver",
    required: true,
  },
  passenger: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  pickup: { type: String, required: true },
  pickupCoordinates: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  },
  dropoffCoordinates: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  },
  dropoff: { type: String, required: true },
  price: { type: Number },
  date: { type: Date, default: Date.now },
  time: { type: String, required: true },
  otp: { type: String },
  status: {
    type: String,
    enum: ["requested", "accepted", "in_progress", "completed", "cancelled"],
    default: "requested",
  },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

const RideModel = mongoose.model("ride", RideSchema);

export default RideModel;
