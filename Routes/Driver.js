import express from "express"
import { SignIn, SignUp } from "../Controller/Driver.js";


const router = express.Router();

// routes for drivers
router.post("/driverlogin",SignIn);
router.post("/signup-driver",SignUp)

export default router;