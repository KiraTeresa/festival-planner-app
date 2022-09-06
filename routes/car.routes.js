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
  const { groupId } = req.body;

  if (!isCrewmember(currentUser, groupId)) {
    console.log("YOU ARE NO CREW MEMBER");
    return res.redirect("/group");
  }

  await Car.findById(carId)
    .then(async (car) => {
      const { driver, passengers, capacity, seatsAvailable } = car;
      const alreadyPassenger = passengers.find((element) =>
        element.equals(currentUser)
      );

      // check if user is already a passenger or the driver:
      if (alreadyPassenger || driver.equals(currentUser)) {
        return res.redirect(`/group/${groupId}`);
      }

      // check if all seats are going to be occupied after adding this user:
      // if(seatsAvailable-1 === 0){
      //     allOccupied = true;
      // }

      // add user as passenger and increment available seats:
      await Car.findOneAndUpdate(
        carId,
        { $inc: { seatsAvailable: -1 }, $push: { passengers: currentUser } },
        { new: true }
      );
    })
    .then((car) => {
      res.redirect(`/group/${groupId}`);
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
