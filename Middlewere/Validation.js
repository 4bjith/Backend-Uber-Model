import { z } from "zod";

// Generic validator for request body
export const validate = (schema) => (req, res, next) => {
  try {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formattedErrors = result.error.issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return res.status(400).json({
        status: "error",
        message: "Validation failed",
        errors: formattedErrors,
      });
    }
    req.body = result.data;
    next();
  } catch (error) {
    next(error);
  }
};

// User schemas
export const UserRegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  mobile: z.string().min(8, "Mobile number must be at least 8 digits"),
});

export const UserLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  location: z
    .object({
      type: z.literal("Point").default("Point"),
      coordinates: z.array(z.number()).length(2),
    })
    .optional(),
});

// Driver schemas
export const DriverSignUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  mobile: z.string().min(8, "Mobile number must be at least 8 digits"),
  vehicleName: z.string().min(1, "Vehicle name is required").optional(),
  vehicle: z.string().min(1, "Vehicle registration number is required"),
  vehicleType: z.enum(["Sedan", "SUV", "Bike"]).default("Sedan"),
  licence: z.string().min(1, "License number is required"),
});

export const DriverSignInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  location: z
    .object({
      type: z.literal("Point").default("Point"),
      coordinates: z.array(z.number()).length(2),
    })
    .optional(),
});

// Ride booking schema
export const BookRideSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  pickup: z.string().min(1, "Pickup address is required"),
  dropoff: z.string().min(1, "Dropoff address is required"),
  pickupCoordinates: z.array(z.number()).length(2, "Pickup coordinates must be [lat, lng]"),
  dropoffCoordinates: z.array(z.number()).length(2, "Dropoff coordinates must be [lat, lng]"),
  distance: z.union([z.string(), z.number()]),
  vehicleType: z.enum(["Sedan", "SUV", "Bike"]).default("Sedan"),
  date: z.string().optional(),
  time: z.string().optional(),
});

// Location update schema
export const LocationUpdateSchema = z.object({
  location: z.object({
    type: z.literal("Point").default("Point"),
    coordinates: z.array(z.number()).length(2, "Coordinates must be [lng, lat]"),
  }),
});
