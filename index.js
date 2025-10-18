import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";

import AuthRoute from "./Routes/User.js";
import DriverRoute from "./Routes/Driver.js";

dotenv.config();
const MONGO_URL = process.env.MONGO_URL;
const PORT = process.env.PORT;
const app = express();

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("MongoDB connected sucessfully. "))
  .catch((err) => console.error("MongoDB connection error : ", err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// user section
app.use(AuthRoute);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

//driver section
app.use(DriverRoute);

//Run server at port
app.listen(PORT, () => console.log(`Running server on port ${PORT}`));
