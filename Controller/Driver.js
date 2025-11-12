import DriverModel from "../Model/Driver.js";
import jwt from "jsonwebtoken";
import UserModel from "../Model/User.js";
import RideModel from "../Model/Ride.js";
import { io } from "../index.js";
// api function to update location
export const UpdatLocation = async (req, res) => {
  const { location } = req.body;
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
      return res.status(400).json({ message: "Cant find the driver" });
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
        await driver.save();

        return res.status(200).json({
          status: "success",
          message: "Location updated successfully",
        });
      } else {
        return res.status(400).json({
          status: "error",
          message:
            "Location coordinate must be an array of [longitude, latitude]",
        });
      }
    }
  } catch (error) {
    console.error("Error while updating location:", error.message, error.stack);
    res.status(500).json({ status: "error", message: error.message });
  }
};

// api function to login or sign in
export const SignIn = async (req, res) => {
  // taking email and password from req body
  const { email, password, location } = req.body;
  const JWT_SECRET = process.env.JWT_SECRET;
  try {
    // finding driver data in database using email
    const driver = await DriverModel.findOne({ email });
    // checking the data of driver
    if (driver) {
      // if driver is ok then compare password
      const isMatch = await driver.comparePassword(password);

      // if compaireing successed then send token to frontent
      if (isMatch) {
        // save location when login
        // if (
        //   location &&
        //   location.type === "Point" &&
        //   Array.isArray(location.coordinates) &&
        //   location.coordinates.length === 2
        // ) {
        //   driver.location = {
        //     type: "Point",
        //     coordinates: location.coordinates,
        //   };
        //   driver.markModified("location");
        //   await driver.save();
        // }

        const token = jwt.sign({ email: driver.email }, JWT_SECRET, {
          expiresIn: "12h",
        });
        res.json({
          status: "Login done",
          token: token,
          driver: {
            name: driver.name,
            email: driver.email,
            mobile: driver.mobile,
          },
        });
      } else {
        res.status(404).send("Wrong password");
      }
    } else {
      res.status(401).send("Cant find driver data");
    }
  } catch (error) {
    console.error("login error :", error);
    res.status(500).send("Server error");
  }
};

// api function to register or sign up

export const SignUp = async (req, res) => {
  const { name, email, password, mobile, vehicleName, vehicle, licence } =
    req.body;
  try {
    // checking if the user exist in db
    const existing = await DriverModel.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "Dirver alredy exist" });
    }

    // new driver
    const newDriver = await DriverModel.create({
      name,
      email,
      password,
      mobile,
      vehicleName,
      vehicle,
      licence,
    });
    res.status(201).json({
      status: "sucess",
      message: "New Driver Created",
      driverId: newDriver._id,
    });
  } catch (error) {
    console.error("Error while updating Driver:", error.message);
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
        .json({ status: "error", message: "Missing email in token " });
    }

    const driver = await DriverModel.findOne({ email });
    if (!driver) {
      return res
        .status(404)
        .json({ status: "error", message: "Driver not found" });
    }

    const { name, password, mobile, vehicleName, vehicle, licence } = req.body;

    if (name) driver.name = name;
    if (password) driver.password = password;
    if (mobile) driver.mobile = mobile;
    if (vehicleName) driver.vehicleName = vehicleName;
    if (vehicle) driver.vehicle = vehicle;
    if (licence) driver.licence = licence;

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
        licence: updatedDriver.licence,
      },
    });
  } catch {
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

    const driverData = await DriverModel.findOne({ email });
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
    res.status(500).send("error", error.message);
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

    // find driver within 5km radius
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
    });

    res.status(200).json({
      status: "success",
      count: drivers.length,
      drivers,
    });
  } catch (err) {
    console.error("Error in nearby:", err);
    res.status(500).send("error", err.message);
  }
};


export const BookRide = async (req, res) => {
  const driver = await DriverModel.findOne({ _id: req.body.driverId });
  const passenger = await UserModel.findOne({ _id: req.body.userId });
  const ride = await RideModel.create({
    pickup: req.body.pickup,
    dropoff: req.body.dropoff,
    driver: driver._id,
    date: req.body.date,
    time: req.body.time,
    passenger: passenger._id,
  });
  io.to(driver.socketId).emit("ride:alert", {
    pickup: req.body.pickup,
    dropoff: req.body.dropoff,
    rideId: ride._id,
    
  });
  res
    .status(201)
    .json({ status: "success", message: "Ride booked", rideId: ride._id });
};

// api function to update ride status
export const updateRideStatus = async (req, res) => {
  const { rideId, driverEmail } = req.body;
  try {
    // update ride status to 'accepted' and assign driver
    const ride = await RideModel.findByIdAndUpdate(
      rideId,
      {
        status: "accepted",
        email: driverEmail,
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
    res.status(500).send("error", err.message);
  }
};



export const getRides = async (req, res) => {
  try {
    const { rideId } = req.body; // or req.query, depending on frontend
    if (!rideId) {
      return res
        .status(400)
        .json({ status: "error", message: "Ride ID is required" });
    }

    // Find ride by ID
    const ride = await RideModel.findById(rideId);

    if (!ride) {
      return res
        .status(404)
        .json({ status: "error", message: "Ride not found" });
    }

    if (ride.status === "accepted") {
      return res.status(200).json({
        status: "success",
        message: "Ride accepted",
        data: ride,
      });
    } else {
      return res.status(200).json({
        status: "pending",
        message: "Ride not accepted yet",
        data: ride,
      });
    }
  } catch (error) {
    console.error("Error in getRides:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
};

