import express from 'express';

import { Login,Register,updateUser } from '../Controller/User';

const router = express.Router()

// routes for users
router.post("/login",Login);
router.post("/register",Register);
router.put("/user",updateUser);

export default router