import express from "express";
import { endRide, getRide, getRideDistance, getAllRides } from "../Controller/Ride.js";
import { LoginCheck } from "../Middlewere/Auth.js";

const router = express.Router();

router.get("/ride/info", getRide);
router.get("/ride/distance", getRideDistance);
router.put("/ride/end", endRide);
router.get("/allrides", LoginCheck, getAllRides);

export default router;