import express from "express";
import UserModel from "../Model/User.js";
import jwt from "jsonwebtoken";

// update location
export const UpdateLocation = async (req, res) => {
  const { location } = req.body;
  try {
    const email = req.user?.email;

    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing email in token" });
    }
    // find user using email
    const usr = await UserModel.findOne({ email });
    if (!usr) {
      return res.status(400).json({ message: "Cant find user" });
    }

    if (
      location &&
      location.type === "Point" &&
      Array.isArray(location.coordinates)
    ) {
      if (location.coordinates.length === 2) {
        usr.location = {
          type: "Point",
          coordinates: location.coordinates, // [lan, lat]
        };
        await usr.save();

        return res.status(200).json({
          status: "success",
          message: "Location updated sucessfully",
        });
      } else {
        return res.status(404).json({
          status: "error",
          message: "Location coordinates must be an array",
        });
      }
    }
  } catch (error) {
    console.error("Error while updating location:", error.message, error.stack);
    res.status(500).json({ status: "error", message: error.message });
  }
};

export const Login = async (req, res) => {
  const { email, password, location } = req.body;
  try {
    const usr = await UserModel.findOne({ email });

    if (usr) {
      const isMatch = await usr.comparePassword(password);

      if (isMatch) {
        //✅ Update location if provided and valid
        if (
          location &&
          location.type === "Point" &&
          Array.isArray(location.coordinates) &&
          location.coordinates.length === 2
        ) {
          usr.location = {
            type: "Point",
            coordinates: location.coordinates,
          };
          usr.markModified("location");
          await usr.save(); //  Save updated location
          console.log("Saved user location:", usr.location);
        }

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
    const email = req.user.email; // from LoginCheck middleware
    if (!email) {
      return res
        .status(400)
        .json({ status: "error", message: "Missing email in token" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ status: "error", message: "User not found" });
    }

    // update text fields
    const { name, mobile, password, location } = req.body;

    if (name) user.name = name;
    if (mobile) user.mobile = mobile;
    if (password) user.password = password;

    // ✅ update location if provided and valid
    if (
      location &&
      location.type === "Point" &&
      Array.isArray(location.coordinates)
    ) {
      if (location.coordinates.length === 2) {
        user.location = {
          type: "Point",
          coordinates: location.coordinates, // [lng, lat]
        };
      } else {
        return res.status(400).json({
          status: "error",
          message:
            "Location coordinate must be an array of [longitude, latitude]",
        });
      }
    }

    // handle uploaded image
    if (req.file) {
      user.profileImg = `/uploads/${req.file.filename}`;
    }

    const updatedUser = await user.save();

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
    console.error("Error while updating user:", error.message, error.stack);
    res.status(500).json({ status: "error", message: error.message });
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
