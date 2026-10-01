import express from "express";
import {
  createPaymentOrder,
  getPaymentStatus,
  verifyPayment,
  handleCashfreeWebhook,
  processRefund,
  initiateCardPayment,
  initiateUpiPayment,
  initiateNetBankingPayment,
  generateVirtualAccountPayment,
  getBanksList,
  getSavedPaymentMethods,
  savePaymentMethod,
  deleteSavedPaymentMethod,
} from "../Controller/Payment.js";
import { LoginCheck } from "../Middlewere/Auth.js";

const router = express.Router();

// 💳 Standard Order & Verification Endpoints
router.post("/create-order", LoginCheck, createPaymentOrder);
router.get("/:orderId/status", LoginCheck, getPaymentStatus);
router.post("/verify", LoginCheck, verifyPayment);
router.post("/webhook", handleCashfreeWebhook);
router.post("/refund", LoginCheck, processRefund);

// 🚀 Multi-Channel Direct Payment Endpoints
router.post("/pay/card", LoginCheck, initiateCardPayment);
router.post("/pay/upi", LoginCheck, initiateUpiPayment);
router.post("/pay/netbanking", LoginCheck, initiateNetBankingPayment);
router.post("/pay/bank-transfer", LoginCheck, generateVirtualAccountPayment);
router.get("/banks", getBanksList);

// 💼 Saved Payment Methods Endpoints
router.get("/user/saved-methods", LoginCheck, getSavedPaymentMethods);
router.post("/user/saved-methods", LoginCheck, savePaymentMethod);
router.delete("/user/saved-methods/:methodId", LoginCheck, deleteSavedPaymentMethod);

// 💳 Legacy / Direct root route aliases for backward compatibility
router.post("/payment/create-order", LoginCheck, createPaymentOrder);
router.get("/payment/:orderId/status", LoginCheck, getPaymentStatus);
router.post("/payment/verify", LoginCheck, verifyPayment);
router.post("/payment/webhook", handleCashfreeWebhook);
router.post("/payment/refund", LoginCheck, processRefund);
router.post("/payment/pay/card", LoginCheck, initiateCardPayment);
router.post("/payment/pay/upi", LoginCheck, initiateUpiPayment);
router.post("/payment/pay/netbanking", LoginCheck, initiateNetBankingPayment);
router.post("/payment/pay/bank-transfer", LoginCheck, generateVirtualAccountPayment);
router.get("/payment/banks", getBanksList);

export default router;

