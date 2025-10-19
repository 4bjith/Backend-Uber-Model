import DriverModel from "../Model/Driver.js";
import jwt from "jsonwebtoken";

// api function to login or sign in
export const SignIn = async (req, res) => {
  // taking email and password from req body
  const { email, password } = req.body;
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
