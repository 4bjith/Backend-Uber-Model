import RideModel from "../Model/Ride.js";

export const getRide = async (req, res) => {
  try {
    const email = req.user?.email; // email from middleware-auth decoded token

    if (!email) {
      return res.status(400).json({ message: "Cannot find email from token" });
    }

    const ride = await RideModel.findOne({ email });

    if (!ride) {
      return res.status(404).json({ message: "No ride found for this user" });
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
