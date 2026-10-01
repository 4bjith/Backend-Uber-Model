import request from "supertest";
import { app, server } from "../index.js";
import mongoose from "mongoose";
import UserModel from "../Model/User.js";
import DriverModel from "../Model/Driver.js";
import RideModel from "../Model/Ride.js";
import PaymentModel from "../Model/Payment.js";
import jwt from "jsonwebtoken";

describe("💳 Multi-Channel Payment Enhancements Integration Tests", () => {
  let userToken;
  let userId;
  let driverId;
  let rideId;
  let cashfreeOrderId;
  let paymentSessionId;

  const JWT_SECRET = process.env.JWT_SECRET || "qwerty";

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once("open", resolve);
        setTimeout(resolve, 5000);
      });
    }

    const testUser = await UserModel.create({
      name: "Voyago Rider",
      email: `rider_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9876543210",
    });
    userId = testUser._id;
    userToken = jwt.sign(
      { id: testUser._id, email: testUser.email, role: "passenger" },
      JWT_SECRET
    );

    const testDriver = await DriverModel.create({
      name: "Voyago Pilot",
      email: `driver_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9876543299",
      vehicle: "DL-01-AB-1234",
      vehicleName: "Hyundai Aura",
      licence: "DL-LIC-1111",
      status: "online",
      kycStatus: "verified",
      ratePerKm: 15,
      location: { type: "Point", coordinates: [77.2167, 28.6315] },
    });
    driverId = testDriver._id;

    const testRide = await RideModel.create({
      driver: driverId,
      passenger: userId,
      pickup: "Connaught Place, New Delhi",
      dropoff: "Cyber Hub, Gurugram",
      time: "10:30 AM",
      price: 280.0,
      earnings: 280.0,
      status: "completed",
      paymentStatus: "pending",
    });
    rideId = testRide._id;

    // Create an order session
    const res = await request(app)
      .post("/api/payments/create-order")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ rideId: rideId.toString() });

    cashfreeOrderId = res.body.data?.orderId;
    paymentSessionId = res.body.data?.paymentSessionId;
  }, 30000);

  afterAll(async () => {
    if (userId) await UserModel.findByIdAndDelete(userId);
    if (driverId) await DriverModel.findByIdAndDelete(driverId);
    if (rideId) await RideModel.findByIdAndDelete(rideId);
    if (cashfreeOrderId) await PaymentModel.deleteMany({ cashfreeOrderId });
  });

  // 1. Test Banks List Endpoint
  describe("GET /api/payments/banks", () => {
    it("should return list of supported NetBanking banks", async () => {
      const res = await request(app).get("/api/payments/banks");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((b) => b.id === "HDFC")).toBe(true);
      expect(res.body.data.some((b) => b.id === "SBIN")).toBe(true);
    });
  });

  // 2. Test Direct Card Payment (Credit & Debit)
  describe("POST /api/payments/pay/card", () => {
    it("should reject invalid card payload without card number", async () => {
      const res = await request(app)
        .post("/api/payments/pay/card")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          orderId: cashfreeOrderId,
          paymentSessionId,
        });

      expect(res.status).toBe(400);
    });

    it("should process Credit Card payment successfully and update payment channel", async () => {
      const res = await request(app)
        .post("/api/payments/pay/card")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          orderId: cashfreeOrderId,
          paymentSessionId,
          cardNumber: "4532 0000 0000 8912",
          cardHolderName: "Abhijit Sharma",
          cardExpiryMm: "08",
          cardExpiryYy: "2029",
          cardCvv: "123",
          cardType: "CREDIT",
          saveCard: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.paymentChannel).toBe("CREDIT_CARD");
      expect(res.body.data.cardNetwork).toBe("VISA");
      expect(res.body.data.cardLast4).toBe("8912");
    });
  });

  // 3. Test UPI Payments (Collect, Intent, QR)
  describe("POST /api/payments/pay/upi", () => {
    it("should process UPI Collect request with VPA", async () => {
      const res = await request(app)
        .post("/api/payments/pay/upi")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          orderId: cashfreeOrderId,
          paymentSessionId,
          upiId: "rider@okhdfcbank",
          channel: "collect",
          amount: 280,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.paymentChannel).toBe("UPI_COLLECT");
      expect(res.body.data.upiId).toBe("rider@okhdfcbank");
    });

    it("should generate Dynamic QR Code string for scanning", async () => {
      const res = await request(app)
        .post("/api/payments/pay/upi")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          orderId: cashfreeOrderId,
          paymentSessionId,
          channel: "qrcode",
          amount: 280,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.paymentChannel).toBe("UPI_QR");
      expect(res.body.data.qrData).toContain("upi://pay");
    });
  });

  // 4. Test NetBanking Payment
  describe("POST /api/payments/pay/netbanking", () => {
    it("should initiate NetBanking and return secure redirect link", async () => {
      const res = await request(app)
        .post("/api/payments/pay/netbanking")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          orderId: cashfreeOrderId,
          paymentSessionId,
          bankCode: "3022",
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.paymentChannel).toBe("NETBANKING");
      expect(res.body.data.redirectUrl).toBeDefined();
    });
  });

  // 5. Test Virtual Account / Bank Transfer (VAN)
  describe("POST /api/payments/pay/bank-transfer", () => {
    it("should generate Virtual Account Number and IFSC for direct wire transfer", async () => {
      const res = await request(app)
        .post("/api/payments/pay/bank-transfer")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          orderId: cashfreeOrderId,
          amount: 500,
          rideId: rideId.toString(),
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.virtual_account_number).toContain("VOYAGO");
      expect(res.body.data.ifsc).toBeDefined();
      expect(res.body.data.beneficiary_name).toBeDefined();
    });
  });

  // 6. Test Saved Payment Methods CRUD
  describe("Saved Payment Methods Endpoints", () => {
    let savedMethodId;

    it("should allow user to save a new payment method (Card)", async () => {
      const res = await request(app)
        .post("/api/payments/user/saved-methods")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          methodType: "CARD",
          nickname: "HDFC Primary Visa",
          cardNetwork: "VISA",
          cardLast4: "4092",
          cardType: "CREDIT",
          expiryMonth: "08",
          expiryYear: "2029",
          isDefault: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      savedMethodId = res.body.data[res.body.data.length - 1]._id;
    });

    it("should list user's saved payment methods", async () => {
      const res = await request(app)
        .get("/api/payments/user/saved-methods")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("should delete a saved payment method", async () => {
      if (!savedMethodId) return;
      const res = await request(app)
        .delete(`/api/payments/user/saved-methods/${savedMethodId}`)
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
    });
  });
});
