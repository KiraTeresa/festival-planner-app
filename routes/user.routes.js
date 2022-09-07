const express = require("express");
const router = express.Router();
const User = require("../models/User.model");
const Group = require("../models/Group.model");
const Festival = require("../models/Festival.model");
const Car = require("../models/Car.model");
const isLoggedIn = require("../middleware/isLoggedIn");
const { Types } = require("mongoose");

router.get("/dashboard", isLoggedIn, async (req, res) => {
  const currentUser = req.session.user;
  User.findById(currentUser)
    .populate("groups")
    .then(async (user) => {
      const { username, watchlist, notifications, groups } = user;

      let usersGroups = [];
      if (groups) {
        for (const element of groups) {
          await Group.findById(element.toString()).then(async (group) => {
            const { _id, groupName } = group;
            usersGroups.push({ _id, groupName });
          });
        }
      }

      const carsDriving = [];
      await Car.find({ driver: Types.ObjectId(currentUser) }).then(
        async (cars) => {
          for (const car of cars) {
            const group = await Group.findById(car.postedInGroup);
            const festival = await Festival.findById(car.festivalDriving);
            const to = car.dayDriving;
            const back = car.dayDrivingBack;
            const seats = car.seatsAvailable;
            const passengers = [];
            for (const element of car.passengers) {
              const passenger = await User.findById(element);
              passengers.push(passenger);
            }
            const carInfo = { group, festival, to, back, seats, passengers };
            carsDriving.push(carInfo);
          }
        }
      );

      const carsPassenger = [];
      await Car.find({
        passengers: { $in: Types.ObjectId(currentUser) },
      })
        .then(async (cars) => {
          for (const car of cars) {
            const driver = await User.findById(car.driver);
            const group = await Group.findById(car.postedInGroup);
            const festival = await Festival.findById(car.festivalDriving);
            const to = car.dayDriving;
            const back = car.dayDrivingBack;
            const seats = car.seatsAvailable;
            const passengers = [];
            for (const element of car.passengers) {
              const passenger = await User.findById(element);
              passengers.push(passenger);
            }
            const carInfo = {
              driver,
              group,
              festival,
              to,
              back,
              seats,
              passengers,
            };
            carsPassenger.push(carInfo);
          }
        })
        .then(() => {
          res.render("user/dashboard", {
            username,
            notifications,
            watchlist,
            usersGroups,
            carsDriving,
            carsPassenger,
          });
        });
    })

    .catch((err) => console.log("Something went wrong", err));
});

// add a band to your personal setlist:
router.post(
  "/:userName/add-to-watchlist/:bandName",
  isLoggedIn,
  async (req, res) => {
    const { userName, bandName } = req.params;
    console.log("The query: ", req.body);
    const { festivalID, groupId, spotifyId } = req.body;
    const currentUser = req.session.user;
    console.log("FestivalID: ", festivalID);
    let festival;
    await Festival.findById(festivalID).then((element) => {
      console.log("Festival element: ", element);
      festival = element.name;
    });

    await User.findById(currentUser)
      .then(async (user) => {
        const { watchlist = [] } = user;

        // check if festival is already on your list:
        const festivalOnList = watchlist.find(
          (element) => element.festivalName === festival
        );

        console.log(festivalOnList);
        // if not on your list --> add:
        if (!festivalOnList) {
          const newElement = new Types.ObjectId(festivalID);
          watchlist.push({
            festivalId: newElement,
            festivalName: festival,
            bands: [{ bandName, spotifyId }],
          });
          await user.save();
        }

        // if festival already on your list, check if you already added the band:
        else if (festivalOnList) {
          const index = watchlist.indexOf(festivalOnList);
          console.log("INDEX:", index);
          console.log("WATCHLIST: ", watchlist);

          const bandOnList = await watchlist[index].bands.find(
            (element) => element.bandName === bandName
          );

          // if band not found --> add:
          if (!bandOnList) {
            watchlist[index].bands.push({ bandName, spotifyId });
            await user.updateOne({ watchlist });
          }
        }

        res.redirect(`/group/${groupId}`);
      })
      .catch((err) =>
        console.log("Adding the band to your watchlist failed, sorry.", err)
      );
  }
);

// remove a band from your personal setlist:
router.post(
  "/:username/remove-from-watchlist/:bandName",
  isLoggedIn,
  async (req, res) => {
    const bandName = req.params.bandName;
    const { festivalID, groupId } = req.body;
    const currentUser = req.session.user;

    await User.findOne({
      _id: new Types.ObjectId(currentUser),
      watchlist: {
        $elemMatch: {
          festivalId: new Types.ObjectId(festivalID),
          bands: {
            $elemMatch: {
              bandName,
            },
          },
        },
      },
    })
      .then(async (user) => {
        // leave, if there is no such user:
        if (!user) {
          console.log("This band is not on your watchlist");
          res.redirect(`/group/${groupId}`);
        }

        // if there is a user matching the criteria --> find the band in the users watchlist..
        const { watchlist } = user;
        const getFestival = watchlist.find((element) =>
          element.festivalId.equals(festivalID)
        );
        const { bands } = getFestival;
        const getBand = bands.find((element) => element.bandName === bandName);
        const bandIndex = bands.indexOf(getBand);
        // .. then remove the band
        bands.splice(bandIndex, 1);
        await user.updateOne({ watchlist });
        console.log(`${bandName} was removed from your list`);

        if (bands.length < 1) {
          const index = watchlist.indexOf(getFestival);
          watchlist.splice(index, 1);
          await user.updateOne({ watchlist });
        }

        res.redirect(`/group/${groupId}`);
      })
      .catch((err) =>
        console.log("Removing the band from your watchlist failed, sorry.", err)
      );

    // User.findById(currentUser)
    //   .then((user) => {
    //     const { watchlist } = user;

    //     // check if band-festival-combo is already on your list:
    //     const alreadyOnList = watchlist.find(
    //       (element) =>
    //         element.festival.equals(festivalID) && element.band === bandName
    //     );

    //     // if on your list --> remove:
    //     if (alreadyOnList) {
    //       const index = watchlist.indexOf(alreadyOnList);

    //       watchlist.splice(index, 1);
    //       user.save();
    //       console.log(
    //         `${alreadyOnList} at index ${index} was successfully removed from your watchlist.`
    //       );
    //     }
    //     res.redirect(`/group/${groupID}`);
    //   })
    //   .catch((err) =>
    //     console.log("Removing the band from your watchlist failed, sorry.", err)
    //   );
  }
);

// delete a user:
router.post("/delete", isLoggedIn, async (req, res) => {
  const currentUser = req.session.user;
  let username;

  await User.findById(currentUser).then(async (user) => {
    username = user.username;
  });
  const today = new Date().toISOString().slice(0, 10);

  // .. remove from all groups where user is crew member
  await Group.find({ crew: { $in: Types.ObjectId(currentUser) } }).then(
    async (groupsFound) => {
      console.log("GROUPS: ", groupsFound);

      // send notification to admin:
      for (const group of groupsFound) {
        const newNotification = {
          message: `${username} deleted the account and therefore left the group "${group.groupName}".!`,
          date: today,
          type: "group",
        };
        console.log("NOTIFICATION FOR GROUP ADMIN: ", newNotification);

        await User.findByIdAndUpdate(
          group.admin,
          {
            $push: { notifications: newNotification },
          },
          { new: true }
        );

        await Group.findByIdAndUpdate(
          group._id,
          {
            $pull: { crew: Types.ObjectId(currentUser) },
          },
          { new: true }
        );
      }
    }
  );

  // .. remove from all groups where user is admin
  await Group.find({ admin: Types.ObjectId(currentUser) }).then(
    async (groups) => {
      for (const group of groups) {
        const { _id, crew } = group;
        console.log("User is admin of: ", group.groupName);

        // ..name a new admin if there is a crew member..
        if (crew.length > 0) {
          console.log("Member at index 0 ", crew[0]);
          await Group.findByIdAndUpdate(
            _id,
            { $set: { admin: crew[0] } },
            { new: true }
          ).then(async (updatedGroup) => {
            // send notification to new admin:
            const newNotification = {
              message: `${username} deleted the account and therefore left the group "${updatedGroup.groupName}". You are the admin now!!`,
              date: today,
              type: "group",
            };

            await User.findByIdAndUpdate(
              updatedGroup.admin,
              { $push: { notifications: newNotification } },
              { new: true }
            );
          });
        }

        // ..otherwise delete the group..
        else {
          await Group.findByIdAndDelete(_id);
        }
      }
    }
  );

  // .. remove all cars where user is driver
  await Car.find({ driver: Types.ObjectId(currentUser) }).then(async (cars) => {
    for (const car of cars) {
      const { _id, passengers, festivalDriving } = car;
      console.log("CAR TO: ", festivalDriving);

      await Car.findByIdAndDelete(_id);

      // send notification...
      let festival;
      await Festival.findById(festivalDriving).then(
        (festival) => (festival = festival.name)
      );

      const newNotification = {
        message: `${username} deleted the account and is therefore no longer driving to ${festival}.`,
        date: today,
        type: "carsharing",
      };

      // ... to all passengers:
      for (const passenger of passengers) {
        console.log("Every passenger: ", passenger);
        await User.findByIdAndUpdate(
          passenger,
          { $push: { notifications: newNotification } },
          { new: true }
        );
      }
    }
  });

  // .. remove from all cars where user is passenger
  await Car.find({ passengers: { $in: Types.ObjectId(currentUser) } })
    .populate("driver festivalDriving")
    .then(async (cars) => {
      for (const car of cars) {
        const { _id, driver, festivalDriving } = car;

        await Car.findByIdAndUpdate(
          _id,
          {
            $inc: { seatsAvailable: 1 },
            $pull: { passengers: Types.ObjectId(currentUser) },
          },
          { new: true }
        ).then(async (updatedCar) => {
          console.log("The updated car where user was passenger: ", updatedCar);
          const { allOccupied } = updatedCar;
          // change value of allOccupied if all seats were taken before this user got out:
          if (allOccupied) {
            await Car.findByIdAndUpdate(
              updatedCar._id,
              { $set: { allOccupied: !allOccupied } },
              { new: true }
            );
          }
        });

        // send notification...
        const newNotification = {
          message: `${username} deleted the account and therefore does no longer need a seat in your car to drive to ${festivalDriving.name}.`,
          date: today,
          type: "carsharing",
        };

        // ... to driver:
        await User.findByIdAndUpdate(
          driver._id,
          { $push: { notifications: newNotification } },
          { new: true }
        );
      }
    });

  // .. delete user
  await User.findByIdAndDelete(currentUser)
    .then(() => {
      req.session.destroy((err) => {
        if (err) {
          return res
            .status(500)
            .render("auth/logout", { errorMessage: err.message });
        }
        res.redirect("/");
      });
    })
    .catch((err) =>
      console.log("Something went wrong when deleting a user..", err)
    );
});

module.exports = router;
