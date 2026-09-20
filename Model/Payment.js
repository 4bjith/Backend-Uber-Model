import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    rideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ride",
      required: false,
      index: true,
    },
    orderType: {
      type: String,
      enum: ["RIDE_PAYMENT", "WALLET_TOPUP"],
      default: "RIDE_PAYMENT",
    },
    cashfreeOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    paymentSessionId: {
      type: String,
      index: true,
    },
    cfPaymentId: {
      type: String,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
    },
    status: {
      type: String,
      enum: ["CREATED", "PENDING", "PAID", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED"],
      default: "CREATED",
      index: true,
    },
    paymentMethod: {
      type: String,
      default: "CASHFREE_HOSTED",
    },
    gateway: {
      type: String,
      default: "CASHFREE",
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
    },
    paidAt: {
      type: Date,
    },
    failureReason: {
      type: String,
    },
    refundId: {
      type: String,
    },
    refundAmount: {
      type: Number,
    },
    refundReason: {
      type: String,
    },
    refundStatus: {
      type: String,
    },
  },
  { timestamps: true }
);

// Compound indexes for optimized query performance
PaymentSchema.index({ userId: 1, createdAt: -1 });
PaymentSchema.index({ rideId: 1, status: 1 });
PaymentSchema.index({ cashfreeOrderId: 1, status: 1 });

const PaymentModel = mongoose.model("payment", PaymentSchema);

export default PaymentModel;
