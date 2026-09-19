import request from "supertest";
import { app, server } from "../index.js";
import mongoose from "mongoose";

describe("Phase 1: Security, Validation, and KYC Hardening Tests", () => {
  beforeAll(async () => {
    // Wait for mongoose connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27017/testdb");
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
    server.close();
  });

  test("1.1 Security Headers: Helmet should set security headers", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("1.2 Zod Validation: Rejects invalid user registration payload with detailed errors", async () => {
    const res = await request(app).post("/register").send({
      name: "A", // too short
      email: "not-an-email",
      password: "123", // too short
      mobile: "12", // too short
    });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors.length).toBeGreaterThanOrEqual(3);
  });

  test("1.3 Zod Validation: Rejects invalid driver registration payload", async () => {
    const res = await request(app).post("/signup-driver").send({
      name: "Valid Driver",
      email: "invalid-email-driver",
      password: "short",
      // missing vehicle, licence, mobile
    });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Validation failed");
  });

  test("1.4 Auth Hardening: Returns 401 on missing or invalid JWT bearer token", async () => {
    const res = await request(app)
      .get("/users")
      .set("Authorization", "Bearer invalid-token-12345");

    expect(res.status).toBe(401);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toMatch(/invalid or expired token/i);
  });

  test("1.5 Driver KYC Flow: Driver is registered with pending KYC", async () => {
    const uniqueEmail = `driver_test_${Date.now()}@voyago.com`;
    const res = await request(app).post("/signup-driver").send({
      name: "Test Driver KYC",
      email: uniqueEmail,
      password: "password123",
      mobile: "9876543210",
      vehicleName: "Honda Civic",
      vehicle: "DL01AB1234",
      vehicleType: "Sedan",
      licence: "DL-123456789",
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("success");
    expect(res.body.kycStatus).toBe("pending");

    // Attempt to login with pending KYC
    const loginRes = await request(app).post("/driverlogin").send({
      email: uniqueEmail,
      password: "password123",
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.driver.kycStatus).toBe("pending");
    expect(loginRes.body.driver.status).toBe("offline"); // blocked from going online automatically
  });
});
