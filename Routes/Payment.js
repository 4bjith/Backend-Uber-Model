import express from "express";
import {
  createPaymentOrder,
  getPaymentStatus,
  verifyPayment,
  handleCashfreeWebhook,
  processRefund,
} from "../Controller/Payment.js";
import { LoginCheck } from "../Middlewere/Auth.js";

const router = express.Router();

// 💳 Standard RESTful endpoints (under /api/payments or /payment)
router.post("/create-order", LoginCheck, createPaymentOrder);
router.get("/:orderId/status", LoginCheck, getPaymentStatus);
router.post("/verify", LoginCheck, verifyPayment);
router.post("/webhook", handleCashfreeWebhook);
router.post("/refund", LoginCheck, processRefund);

// 💳 Legacy / Direct root route aliases for backward compatibility
router.post("/payment/create-order", LoginCheck, createPaymentOrder);
router.get("/payment/:orderId/status", LoginCheck, getPaymentStatus);
router.post("/payment/verify", LoginCheck, verifyPayment);
router.post("/payment/webhook", handleCashfreeWebhook);
router.post("/payment/refund", LoginCheck, processRefund);

export default router;
