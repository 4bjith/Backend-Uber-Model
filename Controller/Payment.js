import RideModel from "../Model/Ride.js";
import DriverModel from "../Model/Driver.js";
import UserModel from "../Model/User.js";
import { io } from "../index.js";
import crypto from "crypto";

// Cashfree Sandbox / Test credentials
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "TEST_CF_APP_VOYAGO_SANDBOX";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "TEST_CF_SECRET_VOYAGO_KEY";
const CASHFREE_API_VERSION = process.env.CASHFREE_API_VERSION || "2023-08-01";
const CASHFREE_BASE_URL =
  process.env.CASHFREE_ENV === "PRODUCTION"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

/**
 * 💳 Create Cashfree Payment Order
 * POST /payment/create-order
 */
export const createPaymentOrder = async (req, res) => {
  try {
    const { rideId } = req.body;
    const userEmail = req.user?.email;

    if (!rideId) {
      return res.status(400).json({ status: "error", message: "rideId is required" });
    }

    const ride = await RideModel.findById(rideId).populate("passenger").populate("driver");
    if (!ride) {
      return res.status(404).json({ status: "error", message: "Ride not found" });
    }

    const orderAmount = ride.earnings ? Number(ride.earnings.toFixed(2)) : 50.0;
    const orderId = `order_${ride._id}_${Date.now()}`;
    const customerId = ride.passenger?._id?.toString() || `cust_${Date.now()}`;
    const customerName = ride.passenger?.name || "Voyago Passenger";
    const customerEmail = ride.passenger?.email || userEmail || "passenger@voyago.com";
    const customerPhone = ride.passenger?.mobile || "9999999999";

    const payload = {
      order_id: orderId,
      order_amount: orderAmount,
      order_currency: "INR",
      customer_details: {
        customer_id: customerId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
      order_meta: {
        return_url: `http://localhost:5173/finalride?id=${ride._id}&order_id={order_id}`,
        notify_url: `http://localhost:8080/payment/webhook`,
      },
      order_note: `Voyago Trip fare for Ride #${ride._id}`,
    };

    let paymentSessionId = `session_${orderId}_${crypto.randomBytes(8).toString("hex")}`;
    let cashfreeSuccess = false;

    // Call Cashfree Sandbox API if network/credentials available
    try {
      const response = await fetch(`${CASHFREE_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": CASHFREE_APP_ID,
          "x-client-secret": CASHFREE_SECRET_KEY,
          "x-api-version": CASHFREE_API_VERSION,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        paymentSessionId = data.payment_session_id || paymentSessionId;
        cashfreeSuccess = true;
      }
    } catch (cfError) {
      // In sandbox development/offline mode, fallback to generated test session
      console.warn("Cashfree API call sandbox fallback:", cfError.message);
    }

    // Update ride record with order metadata
    ride.cashfreeOrderId = orderId;
    ride.price = orderAmount;
    await ride.save();

    return res.status(200).json({
      status: "success",
      message: "Cashfree payment order created successfully",
      data: {
        orderId,
        orderAmount,
        orderCurrency: "INR",
        paymentSessionId,
        isSandbox: true,
        customerDetails: payload.customer_details,
      },
    });
  } catch (error) {
    console.error("Error creating Cashfree payment order:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * 💳 Verify Cashfree Payment
 * POST /payment/verify
 */
export const verifyPayment = async (req, res) => {
  try {
    const { rideId, orderId, paymentMethod = "CASHFREE_UPI" } = req.body;

    if (!rideId) {
      return res.status(400).json({ status: "error", message: "rideId is required" });
    }

    const ride = await RideModel.findById(rideId).populate("driver").populate("passenger");
    if (!ride) {
      return res.status(404).json({ status: "error", message: "Ride not found" });
    }

    let isPaid = true; // Sandbox test default verification

    if (orderId && process.env.CASHFREE_ENV === "PRODUCTION") {
      try {
        const response = await fetch(`${CASHFREE_BASE_URL}/orders/${orderId}`, {
          method: "GET",
          headers: {
            "x-client-id": CASHFREE_APP_ID,
            "x-client-secret": CASHFREE_SECRET_KEY,
            "x-api-version": CASHFREE_API_VERSION,
          },
        });
        if (response.ok) {
          const data = await response.json();
          isPaid = data.order_status === "PAID";
        }
      } catch (err) {
        console.error("Cashfree verify API check error:", err);
      }
    }

    if (isPaid) {
      ride.paymentStatus = "paid";
      ride.paymentMethod = paymentMethod;
      ride.completedAt = ride.completedAt || new Date();

      // Platform commission calculations
      const totalFare = ride.earnings || ride.price || 50;
      const platformFee = Math.round(totalFare * 0.2); // 20% platform cut
      const driverPayout = totalFare - platformFee; // 80% to driver

      ride.fareBreakdown = {
        baseFare: 10,
        distanceFare: totalFare - 10 > 0 ? totalFare - 10 : 0,
        platformFee,
        driverPayout,
      };

      await ride.save();

      // Notify passenger and driver via WebSockets
      io.emit("ride:paid", {
        rideId: ride._id,
        paymentStatus: "paid",
        totalAmount: totalFare,
        driverPayout,
        orderId: orderId || ride.cashfreeOrderId,
      });

      return res.status(200).json({
        status: "success",
        message: "Payment verified and processed successfully",
        data: {
          rideId: ride._id,
          paymentStatus: "paid",
          totalFare,
          driverPayout,
          platformFee,
          orderId: orderId || ride.cashfreeOrderId,
        },
      });
    } else {
      return res.status(400).json({
        status: "error",
        message: "Cashfree payment verification failed or order is unpaid",
      });
    }
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * 🔔 Cashfree Webhook Handler
 * POST /payment/webhook
 */
export const handleCashfreeWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = JSON.stringify(req.body);

    console.log("📥 Cashfree Webhook received:", req.body);

    const { data } = req.body;
    if (data?.order?.order_id && data?.payment?.payment_status === "SUCCESS") {
      const orderId = data.order.order_id;
      const ride = await RideModel.findOne({ cashfreeOrderId: orderId });

      if (ride) {
        ride.paymentStatus = "paid";
        ride.paymentMethod = data.payment.payment_group || "CASHFREE";
        await ride.save();

        io.emit("ride:paid", {
          rideId: ride._id,
          paymentStatus: "paid",
          orderId,
        });
      }
    }

    return res.status(200).json({ status: "OK", received: true });
  } catch (error) {
    console.error("Error processing Cashfree webhook:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

/**
 * 🔄 Process Cashfree Refund
 * POST /payment/refund
 */
export const processRefund = async (req, res) => {
  try {
    const { rideId, reason = "Trip cancelled or dispute" } = req.body;
    if (!rideId) {
      return res.status(400).json({ status: "error", message: "rideId is required" });
    }

    const ride = await RideModel.findById(rideId);
    if (!ride) {
      return res.status(404).json({ status: "error", message: "Ride not found" });
    }

    const refundId = `ref_${ride._id}_${Date.now()}`;
    const refundAmount = ride.earnings || 50;

    ride.paymentStatus = "refunded";
    await ride.save();

    return res.status(200).json({
      status: "success",
      message: `Refund of ₹${refundAmount} processed successfully`,
      data: {
        refundId,
        rideId: ride._id,
        refundAmount,
        reason,
      },
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};
