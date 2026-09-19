import express from "express";
import {
  BookRide,
  getDriver,
  getRides,
  nearby,
  SignIn,
  SignOut,
  SignUp,
  updateDriver,
  updateRideStatus,
  UpdatLocation,
} from "../Controller/Driver.js";
import { LoginCheck, DriverCheck, PassengerCheck } from "../Middlewere/Auth.js";
import { validate, DriverSignUpSchema, DriverSignInSchema, BookRideSchema, LocationUpdateSchema } from "../Middlewere/Validation.js";
import { upload } from "../Storage/multerStorage.js";

const router = express.Router();

// routes for drivers
router.post("/driverlogin", validate(DriverSignInSchema), SignIn);
router.post("/signup-driver", validate(DriverSignUpSchema), SignUp);
router.put(
  "/driver/update",
  LoginCheck,
  DriverCheck,
  upload.single("profileImg"),
  updateDriver
);
router.get("/driver", LoginCheck, DriverCheck, getDriver);
router.put("/currentlocation", LoginCheck, DriverCheck, UpdatLocation);
router.get("/nearby", nearby);

router.post("/driver/acceptride", LoginCheck, DriverCheck, updateRideStatus);
router.post("/bookride", LoginCheck, PassengerCheck, validate(BookRideSchema), BookRide);

router.get("/ride/status", LoginCheck, PassengerCheck, getRides);
router.post("/driverlogout", LoginCheck, DriverCheck, SignOut);

export default router;
