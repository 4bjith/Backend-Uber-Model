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
  dropoff: { type: String, required: true },
  price: { type: Number },
  date: { type: Date, default: Date.now },
  time: { type: String, required: true },
  otp: { type: String },
  status: {
    type: String,
    enum: ["requested", "in_progress", "completed", "cancelled"],
    default: "requested",
  },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
});

const RideModel = mongoose.model("ride", RideSchema);

export default RideModel;
