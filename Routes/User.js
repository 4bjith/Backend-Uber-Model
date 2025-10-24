import express from "express";

import { Login, Register, UpdateLocation, updateUser, viewUser } from "../Controller/User.js";
import { LoginCheck } from "../Middlewere/Auth.js";
import { upload } from "../Storage/multerStorage.js";


const router = express.Router();

// routes for users
router.post("/login", Login);
router.post("/register", Register);
router.put("/userupdate", LoginCheck, upload.single("profileImg"), updateUser);
router.get("/users", LoginCheck, viewUser);
router.put("/location", LoginCheck, UpdateLocation);

export default router;
