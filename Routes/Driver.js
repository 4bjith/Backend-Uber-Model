import express from "express";
import {
  BookRide,
  getDriver,
  getRides,
  nearby,
  SignIn,
  SignUp,
  updateDriver,
  updateRideStatus,
  UpdatLocation,
} from "../Controller/Driver.js";
import { LoginCheck } from "../Middlewere/Auth.js";
import { upload } from "../Storage/multerStorage.js";

const router = express.Router();

// routes for drivers
router.post("/driverlogin", SignIn);
router.post("/signup-driver", SignUp);
router.put(
  "/driver/update",
  LoginCheck,
  upload.single("profileImg"),
  updateDriver
);
router.get("/driver", LoginCheck, getDriver);
router.put("/currentlocation", LoginCheck, UpdatLocation);
router.get("/nearby",nearby);

router.post("/driver/acceptride", updateRideStatus);
router.post("/bookride", BookRide);

router.get("/ride/status",getRides)

export default router;
