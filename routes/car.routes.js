const express = require("express");
const router = express.Router();
const Group = require("../models/Group.model");
const User = require("../models/User.model");
const Festival = require("../models/Festival.model");
const Car = require("../models/Car.model");
const isLoggedIn = require("../middleware/isLoggedIn");
const { Types } = require("mongoose");
const isCrewmember = require("../utils/isCrewmember");

// Share your car:
router.post("/addCar/:groupId", isLoggedIn, async (req, res) => {
  const currentUser = req.session.user;
  const { groupId } = req.params;

  if (!isCrewmember(currentUser, groupId)) {
    console.log("YOU ARE NO CREW MEMBER");
    return res.redirect("/group");
  }

  const { festivalDrivingId, dayDriving, dayDrivingBack, capacity } = req.body;
  // console.log("Festival ID: ", festivalDrivingId);

  // get the festival name:
  let festivalName;
  await Festival.findById(Types.ObjectId(festivalDrivingId)).then(
    (festival) => (festivalName = festival.name)
  );

  // console.log("Festival NAME: ", festivalName);

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
        ).then(async (group) => {
          const { crew, groupName } = group;

          // create notification...
          const today = new Date().toISOString().slice(0, 10);
          await User.findById(currentUser).then((user) => {
            const { username } = user;

            const newNotification = {
              message: `${username} is going to drive to ${festivalName} and has ${capacity} vacant seat(s). Go to group "${groupName}" and get in the car if you want a ride!`,
              date: today,
              type: "carsharing",
            };
            // ...send to all crew members except current user:
            crew.forEach(async (element) => {
              await User.findById(element._id).then(async (user) => {
                if (!user._id.equals(currentUser)) {
                  await User.findByIdAndUpdate(
                    Types.ObjectId(user._id),
                    { $push: { notifications: newNotification } },
                    { new: true }
                  );
                }
              });
            });
          });
        });
      });
    })
    .then(() => res.redirect(`/group/${groupId}`))
    .catch((err) => console.log("Adding your car didn't Work.", err));
});

// get in a car
router.post("/joinCar/:carId", isLoggedIn, async (req, res) => {
  const { carId } = req.params;
  const currentUser = req.session.user;
  const { groupId, festivalName } = req.body;

  console.log("Car Id from params: ", carId);

  if (!isCrewmember(currentUser, groupId)) {
    console.log("YOU ARE NO CREW MEMBER");
    return res.redirect("/group");
  }

  await Car.findById(carId)
    .then(async (car) => {
      const { driver, passengers, seatsAvailable, allOccupied } = car;
      const alreadyPassenger = await passengers.find(
        async (element) => await element.equals(currentUser)
      );

      console.log("THE CAR: ", car);
      // check if user is already a passenger or the driver:
      if (alreadyPassenger || driver.equals(currentUser)) {
        console.log("You are already a passenger.");
        return res.redirect(`/group/${groupId}`);
      }

      // check for vacant seat:
      if (seatsAvailable <= 0) {
        console.log("No vacant seats, sorry.");
        return res.redirect(`/group/${groupId}`);
      }

      // add user as passenger and increment available seats:
      await Car.findByIdAndUpdate(
        Types.ObjectId(carId),
        { $inc: { seatsAvailable: -1 }, $push: { passengers: currentUser } },
        { new: true }
      ).then(async (updatedCar) => {
        console.log("The updated car: ", updatedCar);
        const { _id, seatsAvailable } = updatedCar;

        if (seatsAvailable <= 0) {
          await Car.findByIdAndUpdate(
            Types.ObjectId(_id),
            { $set: { allOccupied: !allOccupied } },
            { new: true }
          );
        }

        // send notification...
        const today = new Date().toISOString().slice(0, 10);
        await User.findById(currentUser).then(async (user) => {
          const { username } = user;

          const newNotification = {
            message: `${username} is going to join you on the drive to ${festivalName}.`,
            date: today,
            type: "carsharing",
          };
          // ... to driver:
          await User.findByIdAndUpdate(
            Types.ObjectId(driver),
            { $push: { notifications: newNotification } },
            { new: true }
          );
        });
        res.redirect(`/group/${groupId}`);
      });
    })
    .catch((err) => console.log("Getting in the car did not work.", err));
});

// get out of a car
router.post("/leaveCar/:carId", async (req, res) => {
  const { carId } = req.params;
  const currentUser = req.session.user;
  const { groupId } = req.body;

  if (!isCrewmember(currentUser, groupId)) {
    console.log("YOU ARE NO CREW MEMBER");
    return res.redirect("/group");
  }

  await Car.findById(carId)
    .then(async (car) => {
      const { passengers, postedInGroup } = car;
      const userIsPassenger = await passengers.find((element) =>
        element.equals(currentUser)
      );

      if (!userIsPassenger) {
        return res.redirect(`/group/${postedInGroup}`);
      }

      const passengerIndex = passengers.indexOf(userIsPassenger);

      await Car.findByIdAndUpdate(
        carId,
        { $inc: { seatsAvailable: 1 }, $pull: { passengers: userIsPassenger } },
        { new: true }
      ).then(() => res.redirect(`/group/${postedInGroup}`));
    })
    .catch((err) =>
      console.log(
        "Something went wrong when trying to get out of the car.",
        err
      )
    );
});

module.exports = router;
