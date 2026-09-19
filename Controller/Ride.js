import RideModel from "../Model/Ride.js";
import DriverModel from "../Model/Driver.js";
import { io } from "../index.js";
import e from "cors";
import UserModel from "../Model/User.js";

export const getRide = async (req, res) => {
  try {
    const { rideId } = req.query;

    console.log("Ride ID:", rideId);

    if (!rideId) {
      return res.status(400).json({ message: "rideId is missing" });
    }

    const ride = await RideModel.findById(rideId)
      .populate("driver") // populate driver details
      .populate("passenger"); // populate user details

    if (!ride) {
      return res.status(404).json({ message: "No ride found" });
    }

    return res.status(200).json({
      message: "Ride details fetched successfully",
      data: ride,
    });
  } catch (err) {
    console.error("Error fetching ride:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Haversine distance calculator (in meters)
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 🚀 NEW CONTROLLER — Distance Between Pickup & Dropoff
export const getRideDistance = async (req, res) => {
  try {
    const { rideId } = req.query;

    if (!rideId) {
      return res.status(400).json({ message: "rideId is missing" });
    }

    const ride = await RideModel.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    const pickup = ride.pickupCoordinates?.coordinates; // [lng, lat]
    const dropoff = ride.dropoffCoordinates?.coordinates; // [lng, lat]

    if (!pickup || !dropoff) {
      return res.status(400).json({
        message: "Pickup or dropoff coordinates missing in DB",
      });
    }

    const [pickupLng, pickupLat] = pickup;
    const [dropLng, dropLat] = dropoff;

    const distanceMeters = getDistanceMeters(
      pickupLat,
      pickupLng,
      dropLat,
      dropLng
    );

    return res.status(200).json({
      message: "Distance calculated successfully",
      distance_meters: distanceMeters,
      distance_km: distanceMeters / 1000,
      formatted: `${(distanceMeters / 1000).toFixed(2)} km`,
    });
  } catch (err) {
    console.error("Error calculating ride distance:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const endRide = async (req, res) => {
  try {
    const { rideId } = req.body;
    if (!rideId) {
      return res.status(400).json({ message: "rideId is missing" });
    }

    const ride = await RideModel.findByIdAndUpdate(
      rideId,
      { status: "completed",
        completedAt: new Date(),
       },
      { new: true }
    );
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    io.emit("ride:end", {
      rideId,
      status: "completed",
    });
    return res.status(200).json({
      message: "Ride ended successfully",
      data: ride,
    });
  } catch (err) {
    console.error("Error ending ride:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getAllRides = async (req, res) => {
  const { limit, pages } = req.query;
  try {
    const driverEmail = req.user?.email;

    if (!driverEmail) {
      return res.status(400).json({ message: "driverEmail is missing" });
    }
    const driverId = await DriverModel.findOne({ email: driverEmail }).select(
      "_id"
    );
    let rides;
    // Sort by newest first
    if (limit ) {
      rides = await RideModel.find({ driver: driverId }).populate("passenger", "driver")
        .sort({ createdAt: -1 })
        .skip(pages ? (parseInt(pages) - 1) * parseInt(limit) : 0)
        .limit(parseInt(limit));
    } else {
      rides = await RideModel.find({ driver: driverId }).populate("passenger", "driver").sort({
        createdAt: -1,
      });
    }
    return res.status(200).json({
      message: "Rides fetched successfully",
      data: rides,
      rideCount: rides.length,
    });
  } catch (err) {
    console.error("Error fetching all rides:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const UserRides = async (req, res) => {
  const { limit, pages } = req.query;
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      return res.status(400).json({ message: "userEmail is missing" });
    }
    const userId = await UserModel.findOne({ email: userEmail }).select(
      "_id"
    );
    let rides;
    // Sort by newest first
    if (limit ) {
      rides = await RideModel.find({ passenger: userId }).populate("driver")
        .sort({ createdAt: -1 })
        .skip(pages ? (parseInt(pages) - 1) * parseInt(limit) : 0)
        .limit(parseInt(limit));
    } else {
      rides = await RideModel.find({ passenger: userId }).populate( "driver").sort({
        createdAt: -1,
      });
    }
    return res.status(200).json({
      message: "Rides fetched successfully",
      data: rides,
      rideCount: rides.length,
    });
  } catch (err) {
    console.error("Error fetching all rides:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getRouteGeometry = async (req, res) => {
  try {
    const { startLng, startLat, endLng, endLat } = req.query;
    if (!startLng || !startLat || !endLng || !endLat) {
      return res.status(400).json({ message: "Missing start or end coordinates" });
    }
    const apiKey = process.env.ORS_API_KEY || "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImM2OTg1ZDk4ZjVkNTQxMWU5OTAzZjVmMGNjMjZlYWIxIiwiaCI6Im11cm11cjY0In0=";
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${startLng},${startLat}&end=${endLng},${endLat}&geometries=geojson`;

    const response = await fetch(url);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error("Error fetching route from ORS:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getActiveRide = async (req, res) => {
  try {
    const email = req.user?.email;
    const role = req.user?.role;
    if (!email) {
      return res.status(400).json({ message: "Missing email in token" });
    }

    let activeRide = null;

    if (role === "driver") {
      const driver = await DriverModel.findOne({ email });
      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }
      activeRide = await RideModel.findOne({
        driver: driver._id,
        status: { $in: ["requested", "accepted", "in_progress"] },
      }).populate("passenger").populate("driver");
    } else {
      const user = await UserModel.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "Passenger not found" });
      }
      activeRide = await RideModel.findOne({
        passenger: user._id,
        status: { $in: ["requested", "accepted", "in_progress"] },
      }).populate("passenger").populate("driver");
    }

    return res.status(200).json({
      message: "Active ride checked",
      data: activeRide,
    });
  } catch (err) {
    console.error("Error fetching active ride:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const dispatchToNextDriver = async (ride) => {
  try {
    const prevDriverId = ride.driver;
    const prevDriver = await DriverModel.findById(prevDriverId);
    const vehicleType = prevDriver?.vehicleType || "Sedan";

    const [lng, lat] = ride.pickupCoordinates.coordinates;
    const nextDrivers = await DriverModel.find({
      _id: { $ne: prevDriverId },
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: 10000,
        },
      },
      status: "online",
      vehicleType: vehicleType,
    });

    if (nextDrivers.length > 0) {
      const nextDriver = nextDrivers[0];
      ride.driver = nextDriver._id;
      ride.earnings = ride.distance * (nextDriver.ratePerKm || 20);
      await ride.save();

      if (nextDriver.socketId) {
        io.to(nextDriver.socketId).emit("ride:alert", {
          pickup: ride.pickup,
          dropoff: ride.dropoff,
          rideId: ride._id,
        });
      }

      io.emit("ride:status:update", {
        rideId: ride._id,
        status: "requested",
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error in dispatchToNextDriver:", err);
    return false;
  }
};

export const cancelRide = async (req, res) => {
  const { rideId } = req.body;
  const userRole = req.user?.role;
  try {
    if (!rideId) {
      return res.status(400).json({ message: "rideId is missing" });
    }
    const ride = await RideModel.findById(rideId);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    if (userRole === "driver" && ride.status === "requested") {
      const dispatched = await dispatchToNextDriver(ride);
      if (dispatched) {
        return res.status(200).json({
          message: "Ride declined. Dispatched to next nearest driver.",
          data: ride,
        });
      }
    }

    ride.status = "cancelled";
    await ride.save();

    io.emit("ride:status:update", {
      rideId,
      status: "cancelled",
    });
    return res.status(200).json({
      message: "Ride cancelled successfully",
      data: ride,
    });
  } catch (err) {
    console.error("Error cancelling ride:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const getFareEstimates = async (req, res) => {
  const { distance } = req.query;
  try {
    if (!distance) {
      return res.status(400).json({ message: "distance is missing" });
    }
    const distNum = parseFloat(distance);
    const estimates = [
      {
        vehicleType: "Bike",
        name: "Voyago Moto",
        baseFare: 5,
        ratePerKm: 10,
        fare: Math.round(5 + distNum * 10),
        eta: 2,
        description: "Affordable motorcycle rides",
        image: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=150&auto=format&fit=crop",
      },
      {
        vehicleType: "Sedan",
        name: "Voyago Go",
        baseFare: 8,
        ratePerKm: 20,
        fare: Math.round(8 + distNum * 20),
        eta: 4,
        description: "Comfortable everyday sedans",
        image: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=150&auto=format&fit=crop",
      },
      {
        vehicleType: "SUV",
        name: "Voyago Max",
        baseFare: 12,
        ratePerKm: 30,
        fare: Math.round(12 + distNum * 30),
        eta: 6,
        description: "Premium SUVs for extra space",
        image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=150&auto=format&fit=crop",
      },
    ];
    return res.status(200).json({
      status: "success",
      estimates,
    });
  } catch (err) {
    console.error("Error calculating fare estimates:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const payRide = async (req, res) => {
  const { rideId } = req.body;
  try {
    if (!rideId) {
      return res.status(400).json({ message: "rideId is missing" });
    }
    const ride = await RideModel.findByIdAndUpdate(
      rideId,
      { paymentStatus: "paid" },
      { new: true }
    );
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    return res.status(200).json({
      status: "success",
      message: "Ride payment completed successfully",
      data: ride,
    });
  } catch (err) {
    console.error("Error paying for ride:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const rateRide = async (req, res) => {
  const { rideId, rating, review } = req.body;
  try {
    if (!rideId) {
      return res.status(400).json({ message: "rideId is missing" });
    }
    const ride = await RideModel.findByIdAndUpdate(
      rideId,
      { rating, review },
      { new: true }
    );
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }
    return res.status(200).json({
      status: "success",
      message: "Ride rating and review submitted successfully",
      data: ride,
    });
  } catch (err) {
    console.error("Error rating ride:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
