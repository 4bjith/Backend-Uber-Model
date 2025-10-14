import express from "express";
import UserModel from "../Model/User.js";
import jwt from "jsonwebtoken";

export const Login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const usr = await UserModel.findOne({ email });

    if (usr) {
      const isMatch = await usr.comparePassword(password);

      if (isMatch) {
        const token = jwt.sign({ email: usr.email }, "qwerty", {
          expiresIn: "4h",
        });
        res.json({
          status: "Login done",
          token: token,
        });
      } else {
        res.status(404).send("wrong password");
      }
    } else {
      res.send("no user found");
    }
  } catch (error) {
    console.error("login error :", error);
    res.status(500).send("Server error");
  }
};

//api for user register

export const Register = async (req, res) => {
  const { name, email, password, mobile } = req.body;
  try {
    const existing = await UserModel.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ status: "error", message: "User already exist" });
    }
    const newUser = await UserModel.create({ name, email, password, mobile });
    res.status(201).json({
      status: "sucess",
      message: "User Created",
      userId: newUser._id,
    });
  } catch (error) {
    console.error("Error while registring :", error);
    res.status(500).json({ status: "error", message: "server error" });
  }
};

// api for user update

// export const updateUser = async (req, res) => {
//   const userId = req.params.id;
//   const { name, mobile, profileImg, password } = req.body;

//   // dummy obj container
//   const updateFields = {};

//   if (name) updateFields.name = name;
//   if (mobile) updateFields.mobile = mobile;
//   if (profileImg) updateFields.profileImg = profileImg;

//   try {
//     const user = await UserModel.findById(userId);
//     if (!user) {
//       return res
//         .status(404)
//         .json({ status: "error", message: "user not found" });
//     }

//     if (password) {
//       user.password = password;
//     }
//     Object.assign(user, updateFields);

//     const updatedUser = await user.save();
//     res.status(200).json({
//       status: "success",
//       message: "User updated successfully",
//       user: {
//         _id: updatedUser._id,
//         name: updatedUser.name,
//         email: updatedUser.email,
//         mobile: updatedUser.mobile,
//         profileImg: updatedUser.profileImg,
//       },
//     });
//   } catch (error) {
//     if (error.name === "ValidationError") {
//       return res.status(400).json({ status: "error", message: error.message });
//     }

//     console.error("Error while updating user:", error);
//     res
//       .status(500)
//       .json({ status: "error", message: "Server error during update" });
//   }
// };
export const updateUser = async (req, res) => {
  try {
    // extract token from headers
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ status: "error", message: "Authorization token missing" });
    }
    // verify and decode token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res
        .status(401)
        .json({ status: "error", message: "Invalid or expired token" });
    }

    const email = decoded.email;
    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Token missing email field" });
    }
    // Extract updeate fields from request body
    const { name, mobile, profileImg, password } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (mobile) updateFields.mobile = mobile;
    if (profileImg) updateFields.profileImg = profileImg;
    if (password) updateFields.password = password;

    // find user by email
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found " });
    }

    // updating  the fields
    Object.assign(user, updateFields);

    // save usser
    const updatedUser = await user.save();
    // respond with updated user data
    res.status(200).json({
      status: "success",
      message: "User updated successfully",
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        profileImg: updatedUser.profileImg,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ status: "error", message: error.message });
    }
    console.error("Error while updating user:", error);
    res
      .status(500)
      .json({ status: "error", message: "Server error during update" });
  }
};

//api to get user ifo

export const viewUser = async (req, res) => {
  try {
    const email = req.user.email; // 🔧 Get email from token

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await UserModel.findOne({ email });

    if (!user) {
      console.log("Failed to find user from the valid token ");
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
