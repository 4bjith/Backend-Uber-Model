import DriverModel from "../Model/Driver.js";
import jwt from "jsonwebtoken";
import UserModel from "../Model/User.js";
import RideModel from "../Model/Ride.js";
import { io } from "../index.js";

// api function to update location
export const UpdatLocation = async (req, res) => {
  const { location, status } = req.body;
  try {
    const email = req.user?.email;

    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing email in token" });
    }
    // find driver using email
    const driver = await DriverModel.findOne({ email });
    if (!driver) {
      return res.status(404).json({ status: "error", message: "Cannot find the driver" });
    }

    if (status) {
      if (status === "online" && driver.kycStatus !== "verified") {
        return res.status(403).json({
          status: "error",
          message: "Account KYC is pending verification. You cannot go online until approved.",
          kycStatus: driver.kycStatus,
        });
      }
      driver.status = status;
    }

    if (
      location &&
      location.type === "Point" &&
      Array.isArray(location.coordinates)
    ) {
      if (location.coordinates.length === 2) {
        driver.location = {
          type: "Point",
          coordinates: location.coordinates, // [lng, lat]
        };
      } else {
        return res.status(400).json({
          status: "error",
          message: "Location coordinate must be an array of [longitude, latitude]",
        });
      }
    }

    await driver.save();

    return res.status(200).json({
      status: "success",
      message: "Driver status and location updated successfully",
      driver: {
        _id: driver._id,
        name: driver.name,
        email: driver.email,
        status: driver.status,
        kycStatus: driver.kycStatus,
        location: driver.location,
      },
    });
  } catch (error) {
    console.error("Error while updating location:", error.message, error.stack);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// api function to login or sign in
export const SignIn = async (req, res) => {
  const { email, password, location } = req.body;
  const JWT_SECRET = process.env.JWT_SECRET || "qwerty";
  try {
    const driver = await DriverModel.findOne({ email });
    if (driver) {
      const isMatch = await driver.comparePassword(password);

      if (isMatch) {
        // Driver only goes online automatically if KYC is verified
        if (driver.kycStatus === "verified") {
          driver.status = "online";
        } else {
          driver.status = "offline";
        }

        if (
          location &&
          location.type === "Point" &&
          Array.isArray(location.coordinates) &&
          location.coordinates.length === 2
        ) {
          driver.location = {
            type: "Point",
            coordinates: location.coordinates,
          };
        }

        await driver.save();

        const token = jwt.sign(
          { id: driver._id, email: driver.email, role: "driver" },
          JWT_SECRET,
          { expiresIn: "12h" }
        );

        res.json({
          status: "success",
          message: "Login successful",
          token: token,
          driver: {
            _id: driver._id,
            name: driver.name,
            email: driver.email,
            mobile: driver.mobile,
            vehicle: driver.vehicle,
            vehicleName: driver.vehicleName,
            vehicleType: driver.vehicleType,
            status: driver.status,
            kycStatus: driver.kycStatus,
            profileImg: driver.profileImg,
          },
        });
      } else {
        res.status(401).json({ status: "error", message: "Invalid credentials (Wrong password)" });
      }
    } else {
      res.status(404).json({ status: "error", message: "Driver account not found" });
    }
  } catch (error) {
    console.error("login error :", error);
    res.status(500).json({ status: "error", message: "Server error during login" });
  }
};

// api function to signOut
export const SignOut = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing email in token" });
    }
    const driver = await DriverModel.findOne({ email });

    if (!driver) {
      return res
        .status(404)
        .json({ status: "error", message: "Driver not found in database" });
    }
    driver.status = "offline";
    await driver.save();

    res.status(200).json({ status: "success", message: "Driver signed out successfully" });
  } catch (error) {
    console.error("Error in signing out:", error.message, error.stack);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// api function to register or sign up
export const SignUp = async (req, res) => {
  const {
    name,
    email,
    password,
    mobile,
    vehicleName,
    vehicle,
    licence,
    vehicleType,
  } = req.body;
  try {
    const existing = await DriverModel.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Driver with this email already exists" });
    }

    let ratePerKm = 20;
    if (vehicleType === "Bike") ratePerKm = 10;
    else if (vehicleType === "SUV") ratePerKm = 30;

    const newDriver = await DriverModel.create({
      name,
      email,
      password,
      mobile,
      vehicleName: vehicleName || "Voyago Fleet",
      vehicle,
      vehicleType: vehicleType || "Sedan",
      licence,
      ratePerKm,
      kycStatus: "pending", // Requires admin approval
    });

    res.status(201).json({
      status: "success",
      message: "New Driver registered successfully. Account is pending KYC verification.",
      driverId: newDriver._id,
      kycStatus: newDriver.kycStatus,
    });
  } catch (error) {
    console.error("Error while creating Driver:", error.message);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// api function to update driver
export const updateDriver = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing email in token" });
    }

    const driver = await DriverModel.findOne({ email });
    if (!driver) {
      return res
        .status(404)
        .json({ status: "error", message: "Driver not found" });
    }

    const {
      name,
      password,
      mobile,
      vehicleName,
      vehicle,
      licence,
      vehicleType,
      status,
    } = req.body;

    if (name) driver.name = name;
    if (password) driver.password = password;
    if (mobile) driver.mobile = mobile;
    if (vehicleName) driver.vehicleName = vehicleName;
    if (vehicle) driver.vehicle = vehicle;
    if (licence) driver.licence = licence;
    if (status) {
      if (status === "online" && driver.kycStatus !== "verified") {
        return res.status(403).json({
          status: "error",
          message: "KYC verification required before going online",
        });
      }
      driver.status = status;
    }
    if (vehicleType) {
      driver.vehicleType = vehicleType;
      if (vehicleType === "Bike") driver.ratePerKm = 10;
      else if (vehicleType === "SUV") driver.ratePerKm = 30;
      else driver.ratePerKm = 20;
    }

    if (req.file) {
      driver.profileImg = `/uploads/${req.file.filename}`;
    }

    const updatedDriver = await driver.save();

    res.status(200).json({
      status: "success",
      message: "Driver updated successfully",
      driver: {
        _id: updatedDriver._id,
        name: updatedDriver.name,
        email: updatedDriver.email,
        mobile: updatedDriver.mobile,
        vehicleName: updatedDriver.vehicleName,
        vehicle: updatedDriver.vehicle,
        vehicleType: updatedDriver.vehicleType,
        licence: updatedDriver.licence,
        status: updatedDriver.status,
        kycStatus: updatedDriver.kycStatus,
        profileImg: updatedDriver.profileImg,
      },
    });
  } catch (error) {
    console.error("Error while updating Driver:", error.message, error.stack);
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const getDriver = async (req, res) => {
  try {
    const email = req.user?.email;
    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing email in token" });
    }

    const driverData = await DriverModel.findOne({ email }).select("-password");
    if (!driverData) {
      return res
        .status(404)
        .json({ status: "error", message: "Failed to find driver" });
    }

    res.status(200).json({
      status: "success",
      driver: driverData,
    });
  } catch (error) {
    console.error("Error in getDriver:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// api function to find all drivers nearby
// api function to find all drivers nearby
export const nearby = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing latitude or longitude" });
    }
    let p1 = parseFloat(lat);
    let p2 = parseFloat(lng);
    let latitude, longitude;

    if (Math.abs(p1) > 90 && Math.abs(p2) <= 90) {
      longitude = p1;
      latitude = p2;
    } else {
      latitude = p1;
      longitude = p2;
    }

    // 1. Primary: find drivers within 15km radius who are online and KYC verified
    let drivers = [];
    try {
      drivers = await DriverModel.find({
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: 15000, // 15 km
          },
        },
        status: "online",
        kycStatus: "verified",
      }).select("-password");
    } catch (geoErr) {
      console.warn("Geospatial nearby query fallback:", geoErr.message);
    }

    // 2. Fallback: If no drivers within 15km or uncalibrated GPS, return all online verified drivers
    if (drivers.length === 0) {
      drivers = await DriverModel.find({
        status: "online",
        kycStatus: "verified",
      }).select("-password");
    }

    res.status(200).json({
      status: "success",
      count: drivers.length,
      drivers,
    });
  } catch (err) {
    console.error("Error in nearby:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

export const BookRide = async (req, res) => {
  try {
    const passenger = await UserModel.findOne({ _id: req.body.userId });
    if (!passenger) {
      return res.status(404).json({ status: "error", message: "Passenger not found" });
    }
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const p1 = parseFloat(req.body.pickupCoordinates[0]);
    const p2 = parseFloat(req.body.pickupCoordinates[1]);
    
    // Auto-detect coordinate order [lat, lng] vs [lng, lat]
    let latitude, longitude;
    if (Math.abs(p1) > 90 && Math.abs(p2) <= 90) {
      longitude = p1;
      latitude = p2;
    } else {
      latitude = p1;
      longitude = p2;
    }

    const vehicleType = req.body.vehicleType || "Sedan";

    // 1. Tier 1 Search: Online, verified drivers matching vehicleType within 15km
    let drivers = [];
    try {
      drivers = await DriverModel.find({
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: 15000, // 15 km
          },
        },
        status: "online",
        kycStatus: "verified",
        vehicleType: new RegExp(`^${vehicleType}$`, "i"),
      });
    } catch (geoErr) {
      console.warn("Geospatial search primary error, proceeding to fallback:", geoErr.message);
    }

    // 2. Tier 2 Search: Any online, verified drivers within 15km regardless of vehicle tier
    if (drivers.length === 0) {
      try {
        drivers = await DriverModel.find({
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [longitude, latitude],
              },
              $maxDistance: 15000, // 15 km
            },
          },
          status: "online",
          kycStatus: "verified",
        });
      } catch (e) {}
    }

    // 3. Tier 3 Search: All online, verified drivers across platform (sandbox/development fallback)
    if (drivers.length === 0) {
      drivers = await DriverModel.find({
        status: "online",
        kycStatus: "verified",
      });
    }

    if (drivers.length === 0) {
      return res.status(404).json({
        status: "error",
        message: `No online verified drivers are currently active. Please ensure a driver is logged in and set to Online.`,
      });
    }

    const standardRate = vehicleType === "Bike" ? 10 : vehicleType === "SUV" ? 30 : 20;
    const ratePerKm = drivers[0]?.ratePerKm || standardRate;
    const distanceNum = parseFloat(req.body.distance) || 1;
    const earnings = Math.round(distanceNum * ratePerKm);

    // Create ride initially unassigned (driver: null) in 'requested' state
    const ride = await RideModel.create({
      pickup: req.body.pickup,
      dropoff: req.body.dropoff,
      pickupCoordinates: { type: "Point", coordinates: [latitude, longitude] },
      dropoffCoordinates: {
        type: "Point",
        coordinates: [parseFloat(req.body.dropoffCoordinates[0]), parseFloat(req.body.dropoffCoordinates[1])],
      },
      driver: null,
      status: "requested",
      date: req.body.date || new Date(),
      time: req.body.time || new Date().toLocaleTimeString(),
      otp: otp,
      passenger: passenger._id,
      distance: distanceNum.toString(),
      earnings: earnings,
      fareBreakdown: {
        baseFare: vehicleType === "Bike" ? 5 : vehicleType === "SUV" ? 12 : 8,
        distanceFare: earnings,
        platformFee: Math.round(earnings * 0.2), // 20% platform fee
        driverPayout: Math.round(earnings * 0.8), // 80% to driver
      },
    });

    // Broadcast ride alert to all online matching drivers in the area
    let broadcastCount = 0;
    drivers.forEach((d) => {
      if (d.socketId) {
        io.to(d.socketId).emit("ride:alert", {
          pickup: req.body.pickup,
          dropoff: req.body.dropoff,
          rideId: ride._id,
          distance: distanceNum,
          earnings: earnings,
          vehicleType,
          passengerName: passenger.name,
        });
        broadcastCount++;
      }
    });

    res.status(201).json({
      status: "success",
      message: "Ride request broadcasted to nearby drivers",
      rideId: ride._id,
      otp: otp,
      broadcastCount: drivers.length,
    });
  } catch (err) {
    console.error("Error booking ride:", err);
    res.status(500).json({ status: "error", message: "Failed to broadcast ride request: " + err.message });
  }
};

// api function to atomically accept ride (Driver claims ride)
export const updateRideStatus = async (req, res) => {
  const { rideId } = req.body;
  const driverEmail = req.user?.email;
  try {
    if (!driverEmail) {
      return res.status(400).json({ status: "error", message: "Missing driver email in token" });
    }

    const driver = await DriverModel.findOne({ email: driverEmail });
    if (!driver) {
      return res.status(404).json({ status: "error", message: "Driver profile not found" });
    }

    // Atomic CAS (Compare-and-Swap): Ensure only the first accepting driver claims the unassigned ride
    const ride = await RideModel.findOneAndUpdate(
      { _id: rideId, status: "requested", driver: null },
      {
        status: "accepted",
        driver: driver._id,
      },
      { new: true }
    )
      .populate("driver")
      .populate("passenger");

    if (!ride) {
      return res.status(409).json({
        status: "error",
        message: "This ride has already been accepted by another driver or was cancelled.",
      });
    }

    // Notify passenger and broadcast update
    io.emit("ride:status:update", {
      rideId,
      status: "accepted",
      driverEmail,
      driver: {
        _id: driver._id,
        name: driver.name,
        mobile: driver.mobile,
        vehicle: driver.vehicle,
        vehicleName: driver.vehicleName,
        rating: 4.9,
      },
    });

    // Notify other drivers that this ride is claimed so they can auto-dismiss their alert
    io.emit("ride:taken", {
      rideId,
      driverId: driver._id,
    });

    res.status(200).json({
      status: "success",
      message: "Ride accepted successfully",
      ride,
    });
  } catch (err) {
    console.error("Error in updateRideStatus:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

export const getRides = async (req, res) => {
  try {
    const { rideId } = req.query;
    if (!rideId) {
      return res
        .status(400)
        .json({ status: "error", message: "Ride ID is required" });
    }

    const ride = await RideModel.findById(rideId).populate("driver").populate("passenger");

    if (!ride) {
      return res
        .status(404)
        .json({ status: "error", message: "Ride not found" });
    }

    return res.status(200).json({
      status: "success",
      message: `Ride status is ${ride.status}`,
      data: ride,
    });
  } catch (error) {
    console.error("Error in getRides:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};
