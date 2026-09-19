import express from "express";
import {
  adminLogin,
  getDriversList,
  updateDriverKyc,
  getAllLiveRides,
  getPlatformMetrics,
  handleRideDispute,
} from "../Controller/Admin.js";
import { LoginCheck, AdminCheck } from "../Middlewere/Auth.js";

const router = express.Router();

// Admin Authentication
router.post("/admin/login", adminLogin);

// Protected Admin Routes
router.get("/admin/drivers", LoginCheck, AdminCheck, getDriversList);
router.put("/admin/driver/kyc", LoginCheck, AdminCheck, updateDriverKyc);
router.get("/admin/rides/live", LoginCheck, AdminCheck, getAllLiveRides);
router.get("/admin/metrics", LoginCheck, AdminCheck, getPlatformMetrics);
router.post("/admin/disputes", LoginCheck, AdminCheck, handleRideDispute);

export default router;
