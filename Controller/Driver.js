
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
          expiresIn: "12hr",
        });
        res.json({
          status: "Login done",
          token: token,
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
  const { name, email, password, mobile, vehicle, licence } = req.body;
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
      vehicle,
      licence,
    });
    res.status(201).json({
      status: "sucess",
      message: "New Driver Created",
      driverId: newDriver._id,
    });
  } catch (error) {
    console.error("Error while registring :", error);
    res.status(500).json({ status: "error", message: "server error" });
  }
};
