import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// Driver schema
const DriverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  mobile: { type: String, required: true },
  vehicleName: { type: String },
  vehicle: { type: String, required: true },
  licence: { type: String, required: true },
  profileImg: { type: String },
});

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

// ✅ Corrected instance method definition
DriverSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const DriverModel = mongoose.model("driver", DriverSchema);
export default DriverModel;
