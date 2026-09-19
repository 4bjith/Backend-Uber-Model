import express from "express";
import { endRide, getRide, getRideDistance, getAllRides, UserRides, getRouteGeometry, getActiveRide, cancelRide, getFareEstimates, payRide, rateRide } from "../Controller/Ride.js";
import { LoginCheck } from "../Middlewere/Auth.js";

const router = express.Router();

router.get("/ride/info", getRide);
router.get("/ride/distance", getRideDistance);
router.put("/ride/end", endRide);
router.get("/allrides", LoginCheck, getAllRides);
router.get("/user-ridehistory",LoginCheck, UserRides);
router.get("/ride/route", LoginCheck, getRouteGeometry);
router.get("/ride/active", LoginCheck, getActiveRide);
router.put("/ride/cancel", LoginCheck, cancelRide);
router.get("/ride/fare-estimates", LoginCheck, getFareEstimates);
router.post("/ride/pay", LoginCheck, payRide);
router.post("/ride/rate", LoginCheck, rateRide);

export default router;