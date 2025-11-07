export default BookRide = async (req, res) => {
  const driver = await DriverModel.findOne({ _id: req.body.driverId });
  const ride = new RideModel.create({
    pickup: req.body.pickup,
    dropoff: req.body.dropoff,
    driver: driver._id,
  });
  io.to(driver.socketId).emit("ride:alert", {
    pickup: req.body.pickup,
    dropoff: req.body.dropoff,
    rideId: ride._id,
  });
  res
    .status(201)
    .json({ status: "success", message: "Ride booked", rideId: ride._id });
};

// api function to update ride status
export const updateRideStatus = async (req, res) => {
  const { rideId, driverEmail } = req.body;
  try {
    // update ride status to 'accepted' and assign driver
    const ride = await RideModel.findByIdAndUpdate(
      rideId,
      {
        $set: {
          status: "accepted",
          driverEmail: driverEmail,
        },
      },
      { new: true }
    );
    if (!ride) {
      return res
        .status(404)
        .json({ status: "error", message: "Ride not found" });
    }
    res.status(200).json({
      status: "success",
      message: "Ride status updated to accepted",
      ride,
    });
  } catch (err) {
    console.error("Error in updateRideStatus:", err);
    res.status(500).send("error", err.message);
  }
};