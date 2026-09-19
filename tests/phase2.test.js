import request from "supertest";
import { app, server } from "../index.js";
import mongoose from "mongoose";
import UserModel from "../Model/User.js";
import DriverModel from "../Model/Driver.js";
import RideModel from "../Model/Ride.js";
import jwt from "jsonwebtoken";

describe("Phase 2: Cashfree Payment Gateway & Billing Integration Tests", () => {
  let passengerToken;
  let driverToken;
  let testRideId;
  let testUserId;
  let testDriverId;

  beforeAll(async () => {
    // Wait for mongoose connection with timeout
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once("open", resolve);
        setTimeout(resolve, 5000);
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET || "qwerty";

    // Create test passenger
    const testPassenger = await UserModel.create({
      name: "Cashfree Passenger",
      email: `cf_passenger_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9988776655",
    });
    testUserId = testPassenger._id;
    passengerToken = jwt.sign(
      { id: testPassenger._id, email: testPassenger.email, role: "passenger" },
      JWT_SECRET
    );

    // Create test driver
    const testDriver = await DriverModel.create({
      name: "Cashfree Driver",
      email: `cf_driver_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9988776644",
      vehicle: "CF-01-AB",
      vehicleName: "Hyundai i20",
      licence: "DL-CF9988",
      status: "online",
      kycStatus: "verified",
      ratePerKm: 20,
      location: { type: "Point", coordinates: [78.9629, 20.5937] },
    });
    testDriverId = testDriver._id;
    driverToken = jwt.sign(
      { id: testDriver._id, email: testDriver.email, role: "driver" },
      JWT_SECRET
    );

    // Create test ride in completed state
    const testRide = await RideModel.create({
      driver: testDriverId,
      passenger: testUserId,
      pickup: "Connaught Place, New Delhi",
      dropoff: "India Gate, New Delhi",
      pickupCoordinates: { type: "Point", coordinates: [28.6315, 77.2167] },
      dropoffCoordinates: { type: "Point", coordinates: [28.6129, 77.2295] },
      distance: "5.5",
      earnings: 110,
      status: "completed",
      time: "14:30",
    });
    testRideId = testRide._id;
  }, 30000);

  afterAll(async () => {
    try {
      await UserModel.deleteMany({ email: /cf_passenger_/ });
      await DriverModel.deleteMany({ email: /cf_driver_/ });
      await RideModel.deleteMany({ _id: testRideId });
      await mongoose.connection.close();
      server.close();
    } catch (e) {
      // ignore cleanup error
    }
  });

  test("2.1 Cashfree Order Creation: Generates order with session ID and customer metadata", async () => {
    const res = await request(app)
      .post("/payment/create-order")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({ rideId: testRideId });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.orderId).toBeDefined();
    expect(res.body.data.orderAmount).toBe(110);
    expect(res.body.data.orderCurrency).toBe("INR");
    expect(res.body.data.paymentSessionId).toBeDefined();
  });

  test("2.2 Cashfree Payment Verification: Marks ride as paid and splits earnings (80% driver, 20% platform)", async () => {
    const res = await request(app)
      .post("/payment/verify")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        rideId: testRideId,
        orderId: `order_${testRideId}_test`,
        paymentMethod: "CASHFREE_UPI",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.paymentStatus).toBe("paid");
    expect(res.body.data.totalFare).toBe(110);
    expect(res.body.data.driverPayout).toBe(88); // 80%
    expect(res.body.data.platformFee).toBe(22); // 20%

    // Check DB
    const updatedRide = await RideModel.findById(testRideId);
    expect(updatedRide.paymentStatus).toBe("paid");
    expect(updatedRide.paymentMethod).toBe("CASHFREE_UPI");
  });

  test("2.3 Cashfree Refund API: Processes refund for disputed or cancelled ride", async () => {
    const res = await request(app)
      .post("/payment/refund")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        rideId: testRideId,
        reason: "Test Passenger disputed charge",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.refundId).toBeDefined();
    expect(res.body.data.refundAmount).toBe(110);

    const refundedRide = await RideModel.findById(testRideId);
    expect(refundedRide.paymentStatus).toBe("refunded");
  });
});
