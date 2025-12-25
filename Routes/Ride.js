import express from "express";
import { endRide, getRide, getRideDistance, getAllRides, UserRides } from "../Controller/Ride.js";
import { LoginCheck } from "../Middlewere/Auth.js";

const router = express.Router();

router.get("/ride/info", getRide);
router.get("/ride/distance", getRideDistance);
router.put("/ride/end", endRide);
router.get("/allrides", LoginCheck, getAllRides);
router.get("/user-ridehistory",LoginCheck, UserRides)

export default router;