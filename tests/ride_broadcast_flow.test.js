import request from "supertest";
import { app, server } from "../index.js";
import mongoose from "mongoose";
import UserModel from "../Model/User.js";
import DriverModel from "../Model/Driver.js";
import RideModel from "../Model/Ride.js";
import jwt from "jsonwebtoken";

describe("Ride Broadcast & Driver-Selection Flow Integration Tests", () => {
  let passengerToken;
  let driver1Token;
  let driver2Token;
  let testPassengerId;
  let testDriver1Id;
  let testDriver2Id;
  let createdRideId;
  let createdOtp;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once("open", resolve);
        setTimeout(resolve, 5000);
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET || "qwerty";

    // 1. Create Passenger
    const passenger = await UserModel.create({
      name: "Broadcast Passenger",
      email: `broadcast_passenger_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9876543201",
    });
    testPassengerId = passenger._id;
    passengerToken = jwt.sign(
      { id: passenger._id, email: passenger.email, role: "passenger" },
      JWT_SECRET
    );

    // 2. Create Driver 1 (Online & Verified Sedan)
    const driver1 = await DriverModel.create({
      name: "Driver One",
      email: `driver1_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9876543202",
      vehicle: "DL-01-AA-1111",
      vehicleName: "Honda City",
      vehicleType: "Sedan",
      licence: "DL-DRV-001",
      status: "online",
      kycStatus: "verified",
      ratePerKm: 20,
      location: { type: "Point", coordinates: [77.2090, 28.6139] },
    });
    testDriver1Id = driver1._id;
    driver1Token = jwt.sign(
      { id: driver1._id, email: driver1.email, role: "driver" },
      JWT_SECRET
    );

    // 3. Create Driver 2 (Online & Verified Sedan nearby)
    const driver2 = await DriverModel.create({
      name: "Driver Two",
      email: `driver2_${Date.now()}@voyago.com`,
      password: "password123",
      mobile: "9876543203",
      vehicle: "DL-01-BB-2222",
      vehicleName: "Hyundai Verna",
      vehicleType: "Sedan",
      licence: "DL-DRV-002",
      status: "online",
      kycStatus: "verified",
      ratePerKm: 20,
      location: { type: "Point", coordinates: [77.2100, 28.6145] },
    });
    testDriver2Id = driver2._id;
    driver2Token = jwt.sign(
      { id: driver2._id, email: driver2.email, role: "driver" },
      JWT_SECRET
    );
  }, 30000);

  afterAll(async () => {
    try {
      await UserModel.deleteMany({ email: /broadcast_passenger_/ });
      await DriverModel.deleteMany({ email: /driver[12]_/ });
      if (createdRideId) {
        await RideModel.deleteMany({ _id: createdRideId });
      }
      await mongoose.connection.close();
      server.close();
    } catch (e) {
      // cleanup
    }
  });

  test("1. Passenger requests a ride: creates unassigned 'requested' ride and broadcasts to area drivers", async () => {
    const res = await request(app)
      .post("/bookride")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        userId: testPassengerId.toString(),
        pickup: "Connaught Place, New Delhi",
        dropoff: "India Gate, New Delhi",
        pickupCoordinates: [28.6139, 77.2090],
        dropoffCoordinates: [28.6129, 77.2295],
        distance: "5.0",
        vehicleType: "Sedan",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.rideId).toBeDefined();
    expect(res.body.otp).toBeDefined();
    expect(res.body.broadcastCount).toBeGreaterThanOrEqual(2);

    createdRideId = res.body.rideId;
    createdOtp = res.body.otp;

    // Verify DB state: ride is unassigned (driver is null) and status is 'requested'
    const rideInDb = await RideModel.findById(createdRideId);
    expect(rideInDb).toBeDefined();
    expect(rideInDb.status).toBe("requested");
    expect(rideInDb.driver).toBeNull();
    expect(rideInDb.otp).toBe(createdOtp);
  });

  test("2. Driver 1 accepts the broadcast ride: atomically claims the ride and sets status to 'accepted'", async () => {
    const res = await request(app)
      .post("/driver/acceptride")
      .set("Authorization", `Bearer ${driver1Token}`)
      .send({ rideId: createdRideId });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.ride.status).toBe("accepted");
    expect(res.body.ride.driver._id.toString()).toBe(testDriver1Id.toString());

    // Verify DB state
    const rideInDb = await RideModel.findById(createdRideId);
    expect(rideInDb.status).toBe("accepted");
    expect(rideInDb.driver.toString()).toBe(testDriver1Id.toString());
  });

  test("3. Driver 2 tries to accept the already-claimed ride: receives 409 Conflict", async () => {
    const res = await request(app)
      .post("/driver/acceptride")
      .set("Authorization", `Bearer ${driver2Token}`)
      .send({ rideId: createdRideId });

    expect(res.status).toBe(409);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toMatch(/already been accepted/i);

    // Verify DB state was not overwritten
    const rideInDb = await RideModel.findById(createdRideId);
    expect(rideInDb.driver.toString()).toBe(testDriver1Id.toString());
  });

  test("4. Driver submits incorrect OTP: receives 400 Invalid OTP error", async () => {
    const res = await request(app)
      .post("/ride/verify-otp")
      .set("Authorization", `Bearer ${driver1Token}`)
      .send({
        rideId: createdRideId,
        otp: "0000", // Wrong OTP
      });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toMatch(/invalid otp/i);

    // Status remains 'accepted'
    const rideInDb = await RideModel.findById(createdRideId);
    expect(rideInDb.status).toBe("accepted");
  });

  test("5. Driver submits correct 4-digit OTP: transitions ride to 'in_progress'", async () => {
    const res = await request(app)
      .post("/ride/verify-otp")
      .set("Authorization", `Bearer ${driver1Token}`)
      .send({
        rideId: createdRideId,
        otp: createdOtp,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.data.status).toBe("in_progress");

    // Verify DB state
    const rideInDb = await RideModel.findById(createdRideId);
    expect(rideInDb.status).toBe("in_progress");
  });

  test("6. Driver completes ride at destination: transitions ride to 'completed'", async () => {
    const res = await request(app)
      .put("/ride/end")
      .set("Authorization", `Bearer ${driver1Token}`)
      .send({ rideId: createdRideId });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("completed");

    const rideInDb = await RideModel.findById(createdRideId);
    expect(rideInDb.status).toBe("completed");
    expect(rideInDb.completedAt).toBeDefined();
  });

  test("7. Passenger cancels an unassigned ride request: status transitions to 'cancelled'", async () => {
    // Create new requested ride within driver radius
    const bookRes = await request(app)
      .post("/bookride")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({
        userId: testPassengerId.toString(),
        pickup: "Barakhamba Road, New Delhi",
        dropoff: "Janpath, New Delhi",
        pickupCoordinates: [28.6280, 77.2250],
        dropoffCoordinates: [28.6210, 77.2190],
        distance: "2.5",
        vehicleType: "Sedan",
      });

    expect(bookRes.status).toBe(201);
    const newRideId = bookRes.body.rideId;
    expect(newRideId).toBeDefined();

    const cancelRes = await request(app)
      .put("/ride/cancel")
      .set("Authorization", `Bearer ${passengerToken}`)
      .send({ rideId: newRideId });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe("cancelled");

    const rideInDb = await RideModel.findById(newRideId);
    expect(rideInDb.status).toBe("cancelled");

    // Clean up
    await RideModel.deleteOne({ _id: newRideId });
  });
});
