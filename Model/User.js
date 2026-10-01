import mongoose from "mongoose";
import express from "express";
import bcrypt from "bcryptjs";

// user schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile: { type: String, required: true },
  profileImg: { type: String },
  role: { type: String, default: "user" },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  },
  savedPaymentMethods: [
    {
      methodType: { type: String, enum: ["CARD", "UPI", "BANK_ACCOUNT"], required: true },
      nickname: { type: String },
      // Card fields (Tokenized)
      cardToken: { type: String },
      cardNetwork: { type: String, enum: ["VISA", "MASTERCARD", "RUPAY", "AMEX", "DINERS", "OTHER"] },
      cardLast4: { type: String },
      cardIssuer: { type: String },
      cardType: { type: String, enum: ["CREDIT", "DEBIT"] },
      expiryMonth: { type: String },
      expiryYear: { type: String },
      // UPI fields
      upiVpa: { type: String },
      // Bank Account fields
      accountNumberMasked: { type: String },
      ifscCode: { type: String },
      bankName: { type: String },
      isDefault: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

// password bcrypting or salting
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

//Instance methode to compare password for auth check
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
const UserModel = mongoose.model("user", UserSchema);

export default UserModel;
