import express from "express";
import { SignIn, SignUp, updateDriver } from "../Controller/Driver.js";

const router = express.Router();

// routes for drivers
router.post("/driverlogin", SignIn);
router.post("/signup-driver", SignUp);
router.put("/driver/update", updateDriver);

export default router;
