import request from "supertest";
import { app, server } from "../index.js";
import mongoose from "mongoose";
import DriverModel from "../Model/Driver.js";
import RideModel from "../Model/Ride.js";
import UserModel from "../Model/User.js";

describe("Phase 3: Admin & Operations Portal Integration Tests", () => {
  let adminToken;
  let testDriverId;
  let testRideId;
  let testPassengerId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once("open", resolve);
        setTimeout(resolve, 5000);
      });
    }

    // 1. Admin Login
    const adminRes = await request(app).post("/admin/login").send({
      email: "admin@voyago.com",
      password: "admin123",
    });
    adminToken = adminRes.body.token;

    // 2. Create pending driver
    const pendingDriver = await DriverModel.create({
      name: "Admin Test Driver",
      email: `admin_driver_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9123456780",
      vehicle: "ADM-99-XX",
      vehicleName: "Toyota Fortuner",
      licence: "DL-ADMIN-99",
      kycStatus: "pending",
      status: "offline",
    });
    testDriverId = pendingDriver._id;

    // 3. Create passenger and active ride
    const passenger = await UserModel.create({
      name: "Admin Test Passenger",
      email: `admin_user_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9123456781",
    });
    testPassengerId = passenger._id;

    const ride = await RideModel.create({
      driver: testDriverId,
      passenger: testPassengerId,
      pickup: "Aerocity, New Delhi",
      dropoff: "Cyber Hub, Gurgaon",
      pickupCoordinates: { type: "Point", coordinates: [28.5562, 77.1000] },
      dropoffCoordinates: { type: "Point", coordinates: [28.4950, 77.0895] },
      status: "in_progress",
      time: "15:00",
      distance: "12",
      earnings: 240,
    });
    testRideId = ride._id;
  }, 30000);

  afterAll(async () => {
    try {
      await DriverModel.deleteMany({ email: /admin_driver_/ });
      await UserModel.deleteMany({ email: /admin_user_/ });
      await RideModel.deleteMany({ _id: testRideId });
      await mongoose.connection.close();
      server.close();
    } catch (e) {
      // ignore
    }
  });

  test("3.1 Admin Authentication: Verifies admin credentials and issues admin JWT", async () => {
    expect(adminToken).toBeDefined();

    // Invalid admin credentials should be rejected
    const invalidRes = await request(app).post("/admin/login").send({
      email: "admin@voyago.com",
      password: "wrong_password",
    });
    expect(invalidRes.status).toBe(401);
  });

  test("3.2 Admin Driver KYC Approval: Approves pending driver KYC and enables online status", async () => {
    const res = await request(app)
      .put("/admin/driver/kyc")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        driverId: testDriverId,
        kycStatus: "verified",
        notes: "Driver license verified against government database",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.kycStatus).toBe("verified");
    expect(res.body.data.status).toBe("online");

    const driverInDb = await DriverModel.findById(testDriverId);
    expect(driverInDb.kycStatus).toBe("verified");
  });

  test("3.3 Admin Live Rides Monitor: Lists all active and in-progress trips", async () => {
    const res = await request(app)
      .get("/admin/rides/live")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((r) => r._id.toString() === testRideId.toString())).toBe(true);
  });

  test("3.4 Admin Platform Metrics: Aggregates real-time stats", async () => {
    const res = await request(app)
      .get("/admin/metrics")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.totalDrivers).toBeGreaterThanOrEqual(1);
    expect(res.body.data.verifiedDrivers).toBeGreaterThanOrEqual(1);
  });

  test("3.5 Admin Dispute & Emergency Refund: Resolves ride dispute and sets status to refunded", async () => {
    const res = await request(app)
      .post("/admin/disputes")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        rideId: testRideId,
        reason: "Passenger reported detour",
        action: "refund",
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.status).toBe("disputed");
    expect(res.body.data.paymentStatus).toBe("refunded");
  });
});
