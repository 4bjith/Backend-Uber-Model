import DriverModel from "../Model/Driver.js";
import RideModel from "../Model/Ride.js";
import UserModel from "../Model/User.js";
import jwt from "jsonwebtoken";

// Admin Authentication
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@voyago.com";
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
    const JWT_SECRET = process.env.JWT_SECRET || "qwerty";

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { email: ADMIN_EMAIL, role: "admin", name: "Voyago Admin" },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      return res.status(200).json({
        status: "success",
        message: "Admin authentication successful",
        token,
        admin: { email: ADMIN_EMAIL, role: "admin" },
      });
    }

    return res.status(401).json({ status: "error", message: "Invalid admin credentials" });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 1. Get Drivers List with filtering (pending KYC, verified, all)
export const getDriversList = async (req, res) => {
  try {
    const { status, kycStatus } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (kycStatus) filter.kycStatus = kycStatus;

    const drivers = await DriverModel.find(filter)
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      count: drivers.length,
      data: drivers,
    });
  } catch (error) {
    console.error("Error fetching drivers list:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 2. Update Driver KYC Status (Approve / Reject)
export const updateDriverKyc = async (req, res) => {
  try {
    const { driverId, kycStatus, notes } = req.body;

    if (!driverId || !["verified", "rejected", "pending"].includes(kycStatus)) {
      return res.status(400).json({
        status: "error",
        message: "Valid driverId and kycStatus ('verified', 'rejected', 'pending') required",
      });
    }

    const driver = await DriverModel.findById(driverId);
    if (!driver) {
      return res.status(404).json({ status: "error", message: "Driver not found" });
    }

    driver.kycStatus = kycStatus;
    if (kycStatus === "verified") {
      driver.status = "online";
    } else {
      driver.status = "offline";
    }

    driver.kycDocuments = {
      ...driver.kycDocuments,
      verificationNotes: notes || `KYC ${kycStatus} by Admin`,
      verifiedAt: new Date(),
    };

    await driver.save();

    return res.status(200).json({
      status: "success",
      message: `Driver KYC has been updated to ${kycStatus}`,
      data: {
        _id: driver._id,
        name: driver.name,
        email: driver.email,
        kycStatus: driver.kycStatus,
        status: driver.status,
      },
    });
  } catch (error) {
    console.error("Error updating driver KYC:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 3. Get All Live Rides across platform
export const getAllLiveRides = async (req, res) => {
  try {
    const liveRides = await RideModel.find({
      status: { $in: ["requested", "accepted", "in_progress"] },
    })
      .populate("driver", "name email vehicle vehicleName mobile")
      .populate("passenger", "name email mobile")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      count: liveRides.length,
      data: liveRides,
    });
  } catch (error) {
    console.error("Error fetching live rides:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 4. Get Platform Aggregated Metrics
export const getPlatformMetrics = async (req, res) => {
  try {
    const totalDrivers = await DriverModel.countDocuments();
    const verifiedDrivers = await DriverModel.countDocuments({ kycStatus: "verified" });
    const pendingKyc = await DriverModel.countDocuments({ kycStatus: "pending" });
    const onlineDrivers = await DriverModel.countDocuments({ status: "online" });
    const totalUsers = await UserModel.countDocuments();
    const totalRides = await RideModel.countDocuments();
    const completedRides = await RideModel.countDocuments({ status: "completed" });
    const disputedRides = await RideModel.countDocuments({ status: "disputed" });

    // Aggregate total platform revenue
    const revenueAgg = await RideModel.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$earnings" } } },
    ]);
    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const platformEarnings = Math.round(totalRevenue * 0.2);

    return res.status(200).json({
      status: "success",
      data: {
        totalDrivers,
        verifiedDrivers,
        pendingKyc,
        onlineDrivers,
        totalUsers,
        totalRides,
        completedRides,
        disputedRides,
        totalRevenue,
        platformEarnings,
      },
    });
  } catch (error) {
    console.error("Error getting platform metrics:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};

// 5. Handle Ride Dispute & Refund
export const handleRideDispute = async (req, res) => {
  try {
    const { rideId, reason, action = "refund" } = req.body;

    const ride = await RideModel.findById(rideId);
    if (!ride) {
      return res.status(404).json({ status: "error", message: "Ride not found" });
    }

    ride.status = "disputed";
    ride.disputeReason = reason || "Administrative review dispute";

    if (action === "refund") {
      ride.paymentStatus = "refunded";
    }

    await ride.save();

    return res.status(200).json({
      status: "success",
      message: `Dispute resolved with action: ${action}`,
      data: ride,
    });
  } catch (error) {
    console.error("Error handling dispute:", error);
    return res.status(500).json({ status: "error", message: error.message });
  }
};
