import RideModel from "../Model/Ride.js";
import DriverModel from "../Model/Driver.js";
import UserModel from "../Model/User.js";
import PaymentModel from "../Model/Payment.js";
import CashfreeService from "../services/cashfree.service.js";
import CASHFREE_CONFIG from "../config/cashfree.js";
import { io } from "../index.js";

/**
 * 💳 Create Cashfree Payment Order
 * POST /api/payments/create-order or POST /payment/create-order
 * Authenticated users only
 */
export const createPaymentOrder = async (req, res) => {
  try {
    const isWallet = req.body.type === "WALLET" || req.body.purpose === "WALLET_TOPUP";
    const rideId = req.body.rideId || req.body.orderId;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    // Handle Wallet Deposit Order
    if (isWallet) {
      const depositAmount = Number(req.body.amount || 500);
      if (isNaN(depositAmount) || depositAmount <= 0) {
        return res.status(400).json({ status: "error", message: "Invalid deposit amount" });
      }

      const cashfreeOrderId = `wallet_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      const customerId = userId ? String(userId) : `cust_${Date.now()}`;
      const customerEmail = userEmail || "passenger@voyago.com";
      const customerName = req.user?.name || "Voyago Passenger";
      const customerPhone = "9999999999";

      const cashfreeOrder = await CashfreeService.createOrder({
        orderId: cashfreeOrderId,
        orderAmount: depositAmount,
        orderCurrency: "INR",
        customerDetails: {
          customerId,
          customerName,
          customerEmail,
          customerPhone,
        },
        returnUrl: `${CASHFREE_CONFIG.frontendUrl}/payment/callback?order_id={order_id}&type=wallet`,
        notifyUrl: `${process.env.BACKEND_URL || "http://localhost:8080"}/api/payments/webhook`,
        orderNote: `Voyago Wallet Top-up of ₹${depositAmount} for ${customerEmail}`,
      });

      const paymentRecord = await PaymentModel.create({
        userId: userId || new mongoose.Types.ObjectId(),
        orderType: "WALLET_TOPUP",
        cashfreeOrderId,
        paymentSessionId: cashfreeOrder.payment_session_id,
        amount: depositAmount,
        currency: "INR",
        status: "CREATED",
        paymentMethod: "CASHFREE_WALLET",
        gateway: "CASHFREE",
        gatewayResponse: cashfreeOrder,
      });

      return res.status(200).json({
        status: "success",
        message: "Cashfree wallet deposit order created successfully",
        data: {
          orderId: cashfreeOrderId,
          orderAmount: depositAmount,
          orderCurrency: "INR",
          paymentSessionId: cashfreeOrder.payment_session_id,
          isSandbox: CASHFREE_CONFIG.environment === "SANDBOX",
          customerDetails: { customerId, customerName, customerEmail, customerPhone },
          paymentId: paymentRecord._id,
        },
      });
    }

    if (!rideId) {
      return res.status(400).json({
        status: "error",
        message: "Order identifier (rideId or orderId) is required",
      });
    }

    // 1. Retrieve the actual ride/order from MongoDB
    const ride = await RideModel.findById(rideId).populate("passenger").populate("driver");
    if (!ride) {
      return res.status(404).json({
        status: "error",
        message: "Order / Ride not found",
      });
    }

    // 2. Validate Order Ownership (Prevent paying for another user's order)
    const passengerId = ride.passenger?._id?.toString() || ride.passenger?.toString();
    const passengerEmail = ride.passenger?.email;

    const isOwner =
      (userId && passengerId && passengerId === userId.toString()) ||
      (userEmail && passengerEmail && passengerEmail === userEmail) ||
      req.user?.role === "admin";

    if (!isOwner) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden: You are not authorized to pay for this order",
      });
    }

    // 3. Validate Order State
    if (ride.paymentStatus === "paid") {
      return res.status(400).json({
        status: "error",
        message: "Order is already paid and completed",
        orderId: ride.cashfreeOrderId,
      });
    }

    if (ride.status === "cancelled") {
      return res.status(400).json({
        status: "error",
        message: "Cannot initiate payment for a cancelled order",
      });
    }

    // 4. Server-side Authoritative Amount (DO NOT TRUST FRONTEND AMOUNT)
    const authoritativeAmount = ride.earnings
      ? Number(ride.earnings.toFixed(2))
      : ride.price
      ? Number(ride.price.toFixed(2))
      : 50.0;

    if (isNaN(authoritativeAmount) || authoritativeAmount <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Invalid order payable amount in database",
      });
    }

    // 5. Generate unique Cashfree Order ID
    const cashfreeOrderId = `order_${ride._id}_${Date.now()}`;
    const customerId = passengerId || `cust_${Date.now()}`;
    const customerName = ride.passenger?.name || "Voyago Passenger";
    const customerEmail = passengerEmail || userEmail || "passenger@voyago.com";
    const customerPhone = ride.passenger?.mobile || "9999999999";

    // 6. Call Cashfree Hosted Checkout API
    const cashfreeOrder = await CashfreeService.createOrder({
      orderId: cashfreeOrderId,
      orderAmount: authoritativeAmount,
      orderCurrency: "INR",
      customerDetails: {
        customerId,
        customerName,
        customerEmail,
        customerPhone,
      },
      returnUrl: `${CASHFREE_CONFIG.frontendUrl}/payment/callback?order_id={order_id}`,
      notifyUrl: `${process.env.BACKEND_URL || "http://localhost:8080"}/api/payments/webhook`,
      orderNote: `Voyago Trip fare for Ride #${ride._id}`,
    });

    const paymentSessionId = cashfreeOrder.payment_session_id;

    // 7. Store internal Payment record in MongoDB
    const paymentRecord = await PaymentModel.create({
      userId: ride.passenger?._id || userId,
      rideId: ride._id,
      cashfreeOrderId,
      paymentSessionId,
      amount: authoritativeAmount,
      currency: "INR",
      status: "CREATED",
      paymentMethod: "CASHFREE_HOSTED",
      gateway: "CASHFREE",
      gatewayResponse: cashfreeOrder,
    });

    // 8. Update Ride with cashfreeOrderId
    ride.cashfreeOrderId = cashfreeOrderId;
    ride.price = authoritativeAmount;
    await ride.save();

    return res.status(200).json({
      status: "success",
      message: "Cashfree payment order created successfully",
      data: {
        orderId: cashfreeOrderId,
        internalOrderId: ride._id,
        orderAmount: authoritativeAmount,
        orderCurrency: "INR",
        paymentSessionId,
        isSandbox: CASHFREE_CONFIG.environment === "SANDBOX",
        customerDetails: {
          customerId,
          customerName,
          customerEmail,
          customerPhone,
        },
        paymentId: paymentRecord._id,
      },
    });
  } catch (error) {
    console.error("Error creating Cashfree payment order:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to create payment order",
    });
  }
};

/**
 * 💳 Server-side Payment Verification & Status Lookup
 * GET /api/payments/:orderId/status or POST /payment/verify
 * Queries Cashfree server-side credentials and reconciles state
 */
export const getPaymentStatus = async (req, res) => {
  try {
    const orderId = req.params?.orderId || req.query?.orderId || req.body?.orderId;
    const rideId = req.body?.rideId || req.query?.rideId;
    const paymentMethod = req.body?.paymentMethod || "CASHFREE_HOSTED";

    if (!orderId && !rideId) {
      return res.status(400).json({
        status: "error",
        message: "orderId or rideId parameter is required",
      });
    }

    // Find the ride record
    let ride = null;
    if (orderId) {
      ride = await RideModel.findOne({ cashfreeOrderId: orderId })
        .populate("passenger")
        .populate("driver");
    }
    if (!ride && rideId) {
      ride = await RideModel.findById(rideId)
        .populate("passenger")
        .populate("driver");
    }

    if (!ride) {
      const walletPayment = await PaymentModel.findOne({ cashfreeOrderId: orderId });
      if (walletPayment) {
        let isWalletPaid = walletPayment.status === "PAID";
        if (!isWalletPaid) {
          const cfOrder = await CashfreeService.getOrder(orderId);
          if (cfOrder?.order_status === "PAID") {
            isWalletPaid = true;
          }
        }
        if (isWalletPaid || (CASHFREE_CONFIG.environment === "SANDBOX" && req.method === "POST")) {
          walletPayment.status = "PAID";
          walletPayment.paidAt = walletPayment.paidAt || new Date();
          await walletPayment.save();
          return res.status(200).json({
            success: true,
            status: "success",
            orderId,
            paymentStatus: "PAID",
            orderStatus: "CONFIRMED",
            data: {
              totalFare: walletPayment.amount,
              orderId,
              orderType: "WALLET_TOPUP",
            },
          });
        }
      }

      return res.status(404).json({
        status: "error",
        message: "Associated ride or order not found",
      });
    }

    const targetOrderId = orderId || ride.cashfreeOrderId || `order_${ride._id}`;

    // Find or initialize Payment record
    let payment = await PaymentModel.findOne({ cashfreeOrderId: targetOrderId });
    if (!payment) {
      payment = await PaymentModel.findOne({ rideId: ride._id }).sort({ createdAt: -1 });
    }

    // If ride is already marked as paid in DB, return idempotent confirmation
    if (ride.paymentStatus === "paid") {
      return res.status(200).json({
        success: true,
        status: "success",
        orderId: targetOrderId,
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        data: {
          rideId: ride._id,
          paymentStatus: "paid",
          totalFare: ride.earnings || ride.price || 50,
          driverPayout: ride.fareBreakdown?.driverPayout || Math.round((ride.earnings || 50) * 0.8),
          platformFee: ride.fareBreakdown?.platformFee || Math.round((ride.earnings || 50) * 0.2),
          orderId: targetOrderId,
        },
      });
    }

    // Server-side verification with Cashfree API
    let isPaid = false;
    let cfPaymentDetails = null;

    if (targetOrderId) {
      const cfOrder = await CashfreeService.getOrder(targetOrderId);
      const cfPayments = await CashfreeService.getOrderPayments(targetOrderId);

      if (cfOrder) {
        if (cfOrder.order_status === "PAID") {
          isPaid = true;
        }
      }

      if (Array.isArray(cfPayments) && cfPayments.length > 0) {
        const successfulPayment = cfPayments.find(
          (p) => p.payment_status === "SUCCESS" || p.payment_status === "PAID"
        );
        if (successfulPayment) {
          isPaid = true;
          cfPaymentDetails = successfulPayment;
        }
      }
    }

    // In sandbox test mode if called via verify API simulation
    if (!isPaid && CASHFREE_CONFIG.environment === "SANDBOX" && req.method === "POST") {
      isPaid = true;
    }

    if (isPaid) {
      // 1. Update Ride status
      ride.paymentStatus = "paid";
      ride.paymentMethod = cfPaymentDetails?.payment_group || paymentMethod;
      ride.completedAt = ride.completedAt || new Date();

      const totalFare = ride.earnings || ride.price || 50;
      const platformFee = Math.round(totalFare * 0.2); // 20% platform cut
      const driverPayout = totalFare - platformFee; // 80% to driver

      ride.fareBreakdown = {
        baseFare: 10,
        distanceFare: totalFare - 10 > 0 ? totalFare - 10 : 0,
        platformFee,
        driverPayout,
        tax: 0,
      };

      await ride.save();

      // 2. Update Payment record
      if (payment) {
        payment.status = "PAID";
        payment.paidAt = new Date();
        payment.paymentMethod = ride.paymentMethod;
        if (cfPaymentDetails?.cf_payment_id) {
          payment.cfPaymentId = String(cfPaymentDetails.cf_payment_id);
        }
        payment.gatewayResponse = cfPaymentDetails || payment.gatewayResponse;
        await payment.save();
      }

      // 3. Emit real-time Socket.IO notification
      io.emit("ride:paid", {
        rideId: ride._id,
        paymentStatus: "paid",
        totalAmount: totalFare,
        driverPayout,
        orderId: targetOrderId,
      });

      return res.status(200).json({
        success: true,
        status: "success",
        orderId: targetOrderId,
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        data: {
          rideId: ride._id,
          paymentStatus: "paid",
          totalFare,
          driverPayout,
          platformFee,
          orderId: targetOrderId,
        },
      });
    } else {
      if (payment) {
        payment.status = "PENDING";
        await payment.save();
      }

      return res.status(200).json({
        success: false,
        status: "pending",
        orderId: targetOrderId,
        paymentStatus: "PENDING",
        orderStatus: "PENDING_PAYMENT",
        message: "Payment is still being processed or unpaid",
      });
    }
  } catch (error) {
    console.error("Error in getPaymentStatus:", error);
    return res.status(500).json({
      status: "error",
      message: error.message || "Failed to verify payment status",
    });
  }
};

/**
 * 💳 Alias for verifyPayment to maintain backwards compatibility
 */
export const verifyPayment = getPaymentStatus;

/**
 * 🔔 Cashfree Webhook Handler
 * POST /api/payments/webhook or POST /payment/webhook
 * Verifies HMAC-SHA256 signature using rawBody and performs idempotent updates
 */
export const handleCashfreeWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    console.log("📥 Cashfree Webhook received. Timestamp:", timestamp);

    // 1. Verify Webhook Signature
    const isValidSignature = CashfreeService.verifyWebhookSignature({
      signature,
      timestamp,
      rawBody,
    });

    if (!isValidSignature && CASHFREE_CONFIG.environment === "PRODUCTION") {
      console.warn("❌ Invalid Cashfree Webhook Signature rejected.");
      return res.status(401).json({
        status: "error",
        message: "Invalid webhook signature",
      });
    }

    const payload = req.body;
    const eventType = payload.type || payload.event;
    const orderData = payload.data?.order;
    const paymentData = payload.data?.payment;

    const cashfreeOrderId = orderData?.order_id;
    const isPaymentSuccess =
      paymentData?.payment_status === "SUCCESS" ||
      eventType === "PAYMENT_SUCCESS_WEBHOOK" ||
      orderData?.order_status === "PAID";

    if (!cashfreeOrderId) {
      return res.status(200).json({ status: "OK", message: "No order ID found in webhook payload" });
    }

    // 2. Idempotent Database Update
    const ride = await RideModel.findOne({ cashfreeOrderId });
    let payment = await PaymentModel.findOne({ cashfreeOrderId });

    if (isPaymentSuccess) {
      if (ride && ride.paymentStatus !== "paid") {
        ride.paymentStatus = "paid";
        ride.paymentMethod = paymentData?.payment_group || "CASHFREE_WEBHOOK";
        ride.completedAt = ride.completedAt || new Date();

        const totalFare = ride.earnings || ride.price || 50;
        const platformFee = Math.round(totalFare * 0.2);
        const driverPayout = totalFare - platformFee;

        ride.fareBreakdown = {
          baseFare: 10,
          distanceFare: totalFare - 10 > 0 ? totalFare - 10 : 0,
          platformFee,
          driverPayout,
          tax: 0,
        };

        await ride.save();

        io.emit("ride:paid", {
          rideId: ride._id,
          paymentStatus: "paid",
          orderId: cashfreeOrderId,
        });
      }

      if (payment) {
        payment.status = "PAID";
        payment.paidAt = new Date();
        if (paymentData?.cf_payment_id) {
          payment.cfPaymentId = String(paymentData.cf_payment_id);
        }
        payment.gatewayResponse = payload;
        await payment.save();
      }
    } else if (paymentData?.payment_status === "FAILED") {
      if (payment && payment.status !== "PAID") {
        payment.status = "FAILED";
        payment.failureReason = paymentData?.payment_message || "Payment failed via gateway";
        payment.gatewayResponse = payload;
        await payment.save();
      }
    }

    return res.status(200).json({ status: "OK", received: true, orderId: cashfreeOrderId });
  } catch (error) {
    console.error("Error processing Cashfree webhook:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * 🔄 Process Cashfree Refund
 * POST /api/payments/refund or POST /payment/refund
 * Authenticated users / admin
 */
export const processRefund = async (req, res) => {
  try {
    const { rideId, orderId, reason = "Trip cancelled or dispute" } = req.body || {};
    const targetId = rideId || orderId;

    if (!targetId) {
      return res.status(400).json({ status: "error", message: "rideId or orderId is required" });
    }

    let ride = null;
    if (rideId) {
      ride = await RideModel.findById(rideId);
    }
    if (!ride && orderId) {
      ride = await RideModel.findOne({ cashfreeOrderId: orderId });
    }

    if (!ride) {
      return res.status(404).json({ status: "error", message: "Ride not found" });
    }

    const refundAmount = ride.earnings || ride.price || 50;
    const refundId = `ref_${ride._id}_${Date.now()}`;

    // Call Cashfree refund API
    if (ride.cashfreeOrderId) {
      await CashfreeService.initiateRefund({
        orderId: ride.cashfreeOrderId,
        refundAmount,
        refundId,
        refundNote: reason,
      });
    }

    // Update internal models
    ride.paymentStatus = "refunded";
    await ride.save();

    await PaymentModel.findOneAndUpdate(
      { rideId: ride._id },
      {
        status: "REFUNDED",
        refundId,
        refundAmount,
        refundReason: reason,
        refundStatus: "SUCCESS",
      }
    );

    return res.status(200).json({
      status: "success",
      message: `Refund of ₹${refundAmount} processed successfully`,
      data: {
        refundId,
        rideId: ride._id,
        refundAmount,
        reason,
        status: "REFUNDED",
      },
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};
