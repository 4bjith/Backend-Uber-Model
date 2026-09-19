import express from "express";
import {
  createPaymentOrder,
  verifyPayment,
  handleCashfreeWebhook,
  processRefund,
} from "../Controller/Payment.js";
import { LoginCheck } from "../Middlewere/Auth.js";

const router = express.Router();

router.post("/payment/create-order", LoginCheck, createPaymentOrder);
router.post("/payment/verify", LoginCheck, verifyPayment);
router.post("/payment/webhook", handleCashfreeWebhook);
router.post("/payment/refund", LoginCheck, processRefund);

export default router;
