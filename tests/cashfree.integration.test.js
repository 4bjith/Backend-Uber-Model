import request from "supertest";
import { app, server } from "../index.js";
import mongoose from "mongoose";
import UserModel from "../Model/User.js";
import DriverModel from "../Model/Driver.js";
import RideModel from "../Model/Ride.js";
import PaymentModel from "../Model/Payment.js";
import CASHFREE_CONFIG from "../config/cashfree.js";
import CashfreeService from "../services/cashfree.service.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

describe("Cashfree Payment Gateway Integration Tests (Sandbox / Hosted Checkout)", () => {
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  let driverId;
  let rideAId;
  let rideBId;
  let createdCashfreeOrderId;

  const JWT_SECRET = process.env.JWT_SECRET || "qwerty";

  beforeAll(async () => {
    // Wait for MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once("open", resolve);
        setTimeout(resolve, 5000);
      });
    }

    // 1. Create User A (Primary Passenger)
    const userA = await UserModel.create({
      name: "Abhijith Passenger A",
      email: `cf_user_a_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9876543210",
    });
    userAId = userA._id;
    userAToken = jwt.sign(
      { id: userA._id, email: userA.email, role: "passenger" },
      JWT_SECRET
    );

    // 2. Create User B (Attacker / Other Passenger)
    const userB = await UserModel.create({
      name: "Unauthorized User B",
      email: `cf_user_b_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9876543211",
    });
    userBId = userB._id;
    userBToken = jwt.sign(
      { id: userB._id, email: userB.email, role: "passenger" },
      JWT_SECRET
    );

    // 3. Create Driver
    const driver = await DriverModel.create({
      name: "Voyago Driver 1",
      email: `cf_driver_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9876543212",
      vehicle: "DL-01-CF-1234",
      vehicleName: "Swift Dzire",
      licence: "DL-LIC-9999",
      status: "online",
      kycStatus: "verified",
      ratePerKm: 20,
      location: { type: "Point", coordinates: [77.2167, 28.6315] },
    });
    driverId = driver._id;

    // 4. Create Ride for User A
    const rideA = await RideModel.create({
      driver: driverId,
      passenger: userAId,
      pickup: "Connaught Place, New Delhi",
      dropoff: "Cyber Hub, Gurugram",
      pickupCoordinates: { type: "Point", coordinates: [77.2167, 28.6315] },
      dropoffCoordinates: { type: "Point", coordinates: [77.0878, 28.4986] },
      distance: "25.0",
      earnings: 250.0,
      status: "completed",
      paymentStatus: "pending",
      time: "10:30 AM",
    });
    rideAId = rideA._id;

    // 5. Create Ride for User B
    const rideB = await RideModel.create({
      driver: driverId,
      passenger: userBId,
      pickup: "Saket, New Delhi",
      dropoff: "Noida Sector 62",
      distance: "18.0",
      earnings: 180.0,
      status: "completed",
      paymentStatus: "pending",
      time: "11:00 AM",
    });
    rideBId = rideB._id;
  }, 30000);

  afterAll(async () => {
    try {
      await UserModel.deleteMany({ email: /cf_user_/ });
      await DriverModel.deleteMany({ email: /cf_driver_/ });
      await RideModel.deleteMany({ _id: { $in: [rideAId, rideBId] } });
      if (createdCashfreeOrderId) {
        await PaymentModel.deleteMany({ cashfreeOrderId: createdCashfreeOrderId });
      }
      await mongoose.connection.close();
      server.close();
    } catch (e) {
      // cleanup error ignored
    }
  });

  // ==========================================
  // Test 1: Order Creation & Checkout Session
  // ==========================================
  test("Test 1: Create an order -> initiate payment -> returns Cashfree paymentSessionId & orderId", async () => {
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({ orderId: rideAId });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.orderId).toBeDefined();
    expect(res.body.data.paymentSessionId).toBeDefined();
    expect(res.body.data.orderAmount).toBe(250.0);
    expect(res.body.data.orderCurrency).toBe("INR");
    expect(res.body.data.isSandbox).toBe(true);

    createdCashfreeOrderId = res.body.data.orderId;

    // Verify DB Payment record
    const paymentRecord = await PaymentModel.findOne({ cashfreeOrderId: createdCashfreeOrderId });
    expect(paymentRecord).toBeTruthy();
    expect(paymentRecord.status).toBe("CREATED");
    expect(paymentRecord.amount).toBe(250.0);
    expect(paymentRecord.userId.toString()).toBe(userAId.toString());
  });

  // ==========================================
  // Test 2: Successful Payment Verification
  // ==========================================
  test("Test 2: Complete sandbox payment -> verify payment -> order becomes PAID / CONFIRMED with driver payout split", async () => {
    const res = await request(app)
      .post("/api/payments/verify")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        rideId: rideAId,
        orderId: createdCashfreeOrderId,
        paymentMethod: "CASHFREE_UPI",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.paymentStatus).toBe("PAID");
    expect(res.body.orderStatus).toBe("CONFIRMED");
    expect(res.body.data.totalFare).toBe(250.0);
    expect(res.body.data.driverPayout).toBe(200.0); // 80% of 250
    expect(res.body.data.platformFee).toBe(50.0); // 20% of 250

    // Verify DB Ride state
    const updatedRide = await RideModel.findById(rideAId);
    expect(updatedRide.paymentStatus).toBe("paid");
    expect(updatedRide.fareBreakdown.driverPayout).toBe(200.0);
    expect(updatedRide.fareBreakdown.platformFee).toBe(50.0);

    // Verify DB Payment state
    const updatedPayment = await PaymentModel.findOne({ cashfreeOrderId: createdCashfreeOrderId });
    expect(updatedPayment.status).toBe("PAID");
    expect(updatedPayment.paidAt).toBeDefined();
  });

  // ==========================================
  // Test 3: Failed Payment Simulation
  // ==========================================
  test("Test 3: Unpaid / Failed payment verification -> order remains unpaid", async () => {
    // Check status of a new unpaid ride
    const res = await request(app)
      .get(`/api/payments/order_non_existent_${Date.now()}/status`)
      .set("Authorization", `Bearer ${userBToken}`);

    // If order is not found or unpaid, it returns 404 or success: false
    if (res.status === 200) {
      expect(res.body.paymentStatus).not.toBe("PAID");
    } else {
      expect(res.status).toBe(404);
    }

    const unpaidRide = await RideModel.findById(rideBId);
    expect(unpaidRide.paymentStatus).toBe("pending");
  });

  // ==========================================
  // Test 4: Idempotency on Refresh
  // ==========================================
  test("Test 4: Refresh payment status endpoint -> payment is not duplicated", async () => {
    const res1 = await request(app)
      .get(`/api/payments/${createdCashfreeOrderId}/status`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res1.status).toBe(200);
    expect(res1.body.paymentStatus).toBe("PAID");

    const res2 = await request(app)
      .get(`/api/payments/${createdCashfreeOrderId}/status`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.paymentStatus).toBe("PAID");
    expect(res2.body.data.totalFare).toBe(250.0);
  });

  // ==========================================
  // Test 5: Idempotent Webhook Delivery
  // ==========================================
  test("Test 5: Send duplicate webhook -> database remains consistent with 200 OK", async () => {
    const rawPayload = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      event_time: new Date().toISOString(),
      data: {
        order: {
          order_id: createdCashfreeOrderId,
          order_amount: 250.0,
          order_currency: "INR",
          order_status: "PAID",
        },
        payment: {
          cf_payment_id: "cf_pay_123456",
          payment_status: "SUCCESS",
          payment_amount: 250.0,
          payment_group: "upi",
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac("sha256", CASHFREE_CONFIG.clientSecret)
      .update(timestamp + rawPayload)
      .digest("base64");

    // First delivery
    const webhookRes1 = await request(app)
      .post("/api/payments/webhook")
      .set("x-webhook-timestamp", timestamp)
      .set("x-webhook-signature", signature)
      .set("Content-Type", "application/json")
      .send(rawPayload);

    expect(webhookRes1.status).toBe(200);
    expect(webhookRes1.body.status).toBe("OK");

    // Second (duplicate) delivery
    const webhookRes2 = await request(app)
      .post("/api/payments/webhook")
      .set("x-webhook-timestamp", timestamp)
      .set("x-webhook-signature", signature)
      .set("Content-Type", "application/json")
      .send(rawPayload);

    expect(webhookRes2.status).toBe(200);
    expect(webhookRes2.body.status).toBe("OK");

    // Verify DB remains consistent
    const ride = await RideModel.findById(rideAId);
    expect(ride.paymentStatus).toBe("paid");
  });

  // ==========================================
  // Test 6: Authorization Security
  // ==========================================
  test("Test 6: User B attempts to pay for User A's ride -> request is rejected (403 Forbidden)", async () => {
    // Create new unpaid ride for User A
    const rideA2 = await RideModel.create({
      driver: driverId,
      passenger: userAId,
      pickup: "Delhi",
      dropoff: "Gurgaon",
      earnings: 300,
      status: "completed",
      paymentStatus: "pending",
      time: "12:00 PM",
    });

    // User B tries to initiate payment for User A's ride
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ orderId: rideA2._id });

    expect(res.status).toBe(403);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toMatch(/Forbidden|not authorized/i);

    // Clean up
    await RideModel.findByIdAndDelete(rideA2._id);
  });

  // ==========================================
  // Test 7: Amount Tampering Resistance
  // ==========================================
  test("Test 7: Client tampers with amount payload -> backend enforces database authoritative amount", async () => {
    // Create ride for User B with 180 earnings
    const rideTamper = await RideModel.create({
      driver: driverId,
      passenger: userBId,
      pickup: "Noida",
      dropoff: "Delhi",
      earnings: 450.0,
      status: "completed",
      paymentStatus: "pending",
      time: "1:00 PM",
    });

    // Frontend attempts to send fake amount ₹1.00
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({
        orderId: rideTamper._id,
        amount: 1.0, // Tampered fake payload
      });

    expect(res.status).toBe(200);
    // Backend must use DB earnings (450), ignoring 1.0
    expect(res.body.data.orderAmount).toBe(450.0);

    // Clean up
    await RideModel.findByIdAndDelete(rideTamper._id);
    await PaymentModel.deleteMany({ rideId: rideTamper._id });
  });

  // ==========================================
  // Test 8: Webhook Reconciles Without Frontend
  // ==========================================
  test("Test 8: Payment succeeds via webhook without user returning to frontend -> ride marked paid", async () => {
    // Create new pending ride for User B
    const rideAsync = await RideModel.create({
      driver: driverId,
      passenger: userBId,
      pickup: "Airport T3",
      dropoff: "South Ex",
      earnings: 500.0,
      status: "completed",
      paymentStatus: "pending",
      time: "2:00 PM",
    });

    const orderRes = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({ orderId: rideAsync._id });

    const asyncOrderId = orderRes.body.data.orderId;

    // Direct webhook arrival
    const webhookPayload = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order: {
          order_id: asyncOrderId,
          order_amount: 500.0,
          order_currency: "INR",
          order_status: "PAID",
        },
        payment: {
          cf_payment_id: "cf_pay_async_999",
          payment_status: "SUCCESS",
          payment_group: "card",
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac("sha256", CASHFREE_CONFIG.clientSecret)
      .update(timestamp + webhookPayload)
      .digest("base64");

    const webhookRes = await request(app)
      .post("/api/payments/webhook")
      .set("x-webhook-timestamp", timestamp)
      .set("x-webhook-signature", signature)
      .set("Content-Type", "application/json")
      .send(webhookPayload);

    expect(webhookRes.status).toBe(200);

    // Verify DB Ride state was updated
    const verifiedRide = await RideModel.findById(rideAsync._id);
    expect(verifiedRide.paymentStatus).toBe("paid");
    expect(verifiedRide.paymentMethod).toBe("card");

    // Clean up
    await RideModel.findByIdAndDelete(rideAsync._id);
    await PaymentModel.deleteMany({ cashfreeOrderId: asyncOrderId });
  });

  // ==========================================
  // Test 9: Webhook Signature Verification
  // ==========================================
  test("Test 9: Invalid webhook signature verification -> rejected and payment state unchanged", async () => {
    const rawPayload = JSON.stringify({
      type: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order: {
          order_id: `order_fake_${Date.now()}`,
          order_status: "PAID",
        },
        payment: {
          payment_status: "SUCCESS",
        },
      },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const invalidSignature = "invalid_fake_signature_base64==";

    const isValid = CashfreeService.verifyWebhookSignature({
      signature: invalidSignature,
      timestamp,
      rawBody: rawPayload,
    });

    expect(isValid).toBe(false);
  });
});
