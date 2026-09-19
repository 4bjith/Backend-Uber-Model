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
export const nearby = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    if (!lat || !lng) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing latitude or longitude" });
    }
    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);

    // find drivers within 5km radius who are online and KYC verified
    const drivers = await DriverModel.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: 5000, // 5 km
        },
      },
      status: "online",
      kycStatus: "verified",
    }).select("-password");

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
    const [lat, lng] = req.body.pickupCoordinates;
    const longitude = parseFloat(lng);
    const latitude = parseFloat(lat);
    const vehicleType = req.body.vehicleType || "Sedan";

    // Geospatial search for the nearest online and KYC-verified driver of matching vehicleType
    const drivers = await DriverModel.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude],
          },
          $maxDistance: 10000, // 10 km
        },
      },
      status: "online",
      kycStatus: "verified",
      vehicleType: vehicleType,
    });

    if (drivers.length === 0) {
      return res.status(404).json({
        status: "error",
        message: `No online verified drivers found for vehicle type ${vehicleType} within 10km. Please try another tier or wait.`,
      });
    }

    const matchedDriver = drivers[0];
    const ratePerKm = matchedDriver.ratePerKm || 20;
    const distanceNum = parseFloat(req.body.distance) || 1;
    const earnings = Math.round(distanceNum * ratePerKm);

    const ride = await RideModel.create({
      pickup: req.body.pickup,
      dropoff: req.body.dropoff,
      pickupCoordinates: { type: "Point", coordinates: [latitude, longitude] },
      dropoffCoordinates: {
        type: "Point",
        coordinates: [parseFloat(req.body.dropoffCoordinates[0]), parseFloat(req.body.dropoffCoordinates[1])],
      },
      driver: matchedDriver._id,
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

    if (matchedDriver.socketId) {
      io.to(matchedDriver.socketId).emit("ride:alert", {
        pickup: req.body.pickup,
        dropoff: req.body.dropoff,
        rideId: ride._id,
        distance: distanceNum,
        earnings: earnings,
      });
    }

    res.status(201).json({
      status: "success",
      message: "Ride booked and driver matched",
      rideId: ride._id,
      otp: otp,
      driver: {
        _id: matchedDriver._id,
        name: matchedDriver.name,
        vehicleName: matchedDriver.vehicleName,
        vehicle: matchedDriver.vehicle,
      },
    });
  } catch (err) {
    console.error("Error booking ride:", err);
    res.status(500).json({ status: "error", message: "Failed to book and match ride: " + err.message });
  }
};

// api function to update ride status
export const updateRideStatus = async (req, res) => {
  const { rideId } = req.body;
  const driverEmail = req.user?.email;
  try {
    if (!driverEmail) {
      return res.status(400).json({ status: "error", message: "Missing driver email in token" });
    }
    const ride = await RideModel.findByIdAndUpdate(
      rideId,
      {
        status: "accepted",
      },
      { new: true }
    );
    if (!ride) {
      return res
        .status(404)
        .json({ status: "error", message: "Ride not found" });
    }
    io.emit("ride:status:update", { rideId, status: "accepted", driverEmail });
    res.status(200).json({
      status: "success",
      message: "Ride status updated to accepted",
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
