const express = require("express");
const router = express.Router();
const Group = require("../models/Group.model");
const User = require("../models/User.model");
const Festival = require("../models/Festival.model");
const Car = require("../models/Car.model");
const isLoggedIn = require("../middleware/isLoggedIn");
const { Types } = require("mongoose");

// Share your car:
router.post("/addCar/:groupId", isLoggedIn, async (req, res) => {
  const currentUser = req.session.user;
  const { groupId } = req.params;
  const { festivalDrivingId, dayDriving, dayDrivingBack, capacity } = req.body;
  let allOccupied = false;

  if (capacity === 0) {
    allOccupied = true;
  }

  // search the car collection..
  Car.findOne({
    $and: [
      { driver: Types.ObjectId(currentUser) },
      { festivalDriving: Types.ObjectId(festivalDrivingId) },
    ],
  })
    .then(async (carFound) => {
      // ..if there already is a car driven by that user to that festival --> return:
      if (carFound) {
        console.log("You already added your car for this festival.");
        return res.redirect(`/group/${groupId}`);
      }

      // ..if such car doesn't exist --> create it:
      await Car.create({
        driver: Types.ObjectId(currentUser),
        festivalDriving: Types.ObjectId(festivalDrivingId),
        dayDriving,
        dayDrivingBack,
        capacity,
        seatsAvailable: capacity,
        allOccupied,
        postedInGroup: Types.ObjectId(groupId),
      }).then(async (newCar) => {
        const { _id } = newCar;
        // add the newly created car to the car pool of the group:
        await Group.findByIdAndUpdate(
          groupId,
          {
            $push: {
              carSharing: Types.ObjectId(_id),
            },
          },
          { new: true }
        );
      });
    })
    .then(() => res.redirect(`/group/${groupId}`))
    .catch((err) => console.log("Adding your car didn't Work.", err));
});

// get in a car
router.post("/:groupId/joinCar/:carId", isLoggedIn, async (req, res) => {
  const { groupId, carId } = req.params;
  const currentUser = req.session.user;

  await Group.findOnebyId(groupId).then(async (group) => {
    const { carSharing } = group;

    const car = carSharing.find((element) => element._id.equals(carId));
    console.log("CAR: ", car);
    let { passengers, seatsAvailable, allOccupied } = car;

    const alreadyPassenger = passengers.find((element) =>
      element.equals(currentUser)
    );
    const carIndex = carSharing.indexOf(car);

    if (!allOccupied && !alreadyPassenger) {
      passengers.push(new Types.ObjectId(currentUser));
      seatsAvailable = seatsAvailable - 1;
      if (seatsAvailable === passengers.length) {
        allOccupied = true;
      }
      await group.save();
    }
    console.log("NEW CAR: ", group.carSharing[carIndex]);
    res.redirect(`/group/${groupId}`);
  });
});

module.exports = router;
