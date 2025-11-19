import express from "express";
import { LoginCheck } from "../Middlewere/Auth.js";
import { getRide } from "../Controller/Ride.js";

const router = express.Router()


router.get("/ride/info",LoginCheck,getRide);


export default router