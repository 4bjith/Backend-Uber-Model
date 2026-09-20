import mongoose from "mongoose";

const RideSchema = new mongoose.Schema(
  {
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
    distance: { type: String },
    status: {
      type: String,
      enum: ["requested", "accepted", "in_progress", "completed", "cancelled", "disputed"],
      default: "requested",
    },
    requestedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    earnings: { type: Number },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded", "failed"],
      default: "pending",
    },
    paymentMethod: { type: String, default: "CASHFREE" },
    cashfreeOrderId: { type: String },
    fareBreakdown: {
      baseFare: { type: Number, default: 0 },
      distanceFare: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      driverPayout: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
    },
    rating: { type: Number },
    review: { type: String },
    disputeReason: { type: String },
  },
  { timestamps: true }
);

RideSchema.index({ cashfreeOrderId: 1 });
RideSchema.index({ passenger: 1, createdAt: -1 });
RideSchema.index({ driver: 1, createdAt: -1 });
RideSchema.index({ status: 1, paymentStatus: 1 });

const RideModel = mongoose.model("ride", RideSchema);

export default RideModel;
