import RideModel from "../Model/Ride.js";

export const getRide = async (req, res) => {
  try {
    const { rideId } = req.query;   // ← CHANGE HERE

    console.log("Ride ID:", rideId);

    if (!rideId) {
      return res.status(400).json({ message: "rideId is missing" });
    }

    const ride = await RideModel.findById(rideId)
      .populate("driver")     // populate driver details
      .populate("passenger");      // populate user details
 
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
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
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
      { status: "completed" },
      { new: true }
    );  
    if (!ride) {
      return res.status(404).json({ message: "Ride not found" });
    }

    return res.status(200).json({
      message: "Ride ended successfully",
      data: ride,
    });
  } catch (err) {
    console.error("Error ending ride:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};