import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// Driver schema
const DriverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobile: { type: String, required: true },
    vehicleName: { type: String },
    vehicle: { type: String, required: true },
    vehicleType: { type: String, enum: ["Sedan", "SUV", "Bike"], default: "Sedan" },
    licence: { type: String, required: true },
    profileImg: { type: String },
    role: { type: String, default: "driver" },
    socketId: { type: String, default: null },
    status: { type: String, enum: ["offline", "online"], default: "offline" },
    kycStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    kycDocuments: {
      licenceUrl: { type: String },
      idProofUrl: { type: String },
      verificationNotes: { type: String },
      verifiedAt: { type: Date },
    },
    ratePerKm: { type: Number, default: 20 },
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
  },
  { timestamps: true }
);

// Pre-save hook to hash password
DriverSchema.pre("save", async function (next) {
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

// Instance method definition
DriverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

DriverSchema.index({ location: "2dsphere" });

const DriverModel = mongoose.model("driver", DriverSchema);
export default DriverModel;
