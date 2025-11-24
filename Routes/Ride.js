import express from "express";
import { LoginCheck } from "../Middlewere/Auth.js";
import { endRide, getRide } from "../Controller/Ride.js";

const router = express.Router()


router.get("/ride/info",getRide);
router.put("/ride/end", endRide);

export default router