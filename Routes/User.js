import express from "express";
import { Login, Register, UpdateLocation, updateUser, viewUser } from "../Controller/User.js";
import { LoginCheck, PassengerCheck } from "../Middlewere/Auth.js";
import { validate, UserRegisterSchema, UserLoginSchema, LocationUpdateSchema } from "../Middlewere/Validation.js";
import { upload } from "../Storage/multerStorage.js";

const router = express.Router();

// routes for users
router.post("/login", validate(UserLoginSchema), Login);
router.post("/register", validate(UserRegisterSchema), Register);
router.put("/userupdate", LoginCheck, PassengerCheck, upload.single("profileImg"), updateUser);
router.get("/users", LoginCheck, PassengerCheck, viewUser);
router.put("/location", LoginCheck, PassengerCheck, validate(LocationUpdateSchema), UpdateLocation);

router.get("/tockencheck", LoginCheck, (req, res) => {
  res.status(200).json({ status: "success", message: "Token is valid", user: req.user });
});

export default router;
