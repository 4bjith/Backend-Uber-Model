import express from "express";

import { Login, Register, updateUser, viewUser } from "../Controller/User.js";
import { LoginCheck } from "../Middlewere/Auth.js";

const router = express.Router();

// routes for users
router.post("/login", Login);
router.post("/register", Register);
router.put("/userupdate/:id",LoginCheck, updateUser);
router.get("/users", LoginCheck, viewUser);

export default router;
