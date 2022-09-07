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
            for (const element of passengers) {
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
      }).then(async (cars) => {
        for (const car of cars) {
          const driver = await User.findById(car.driver);
          const group = await Group.findById(car.postedInGroup);
          const festival = await Festival.findById(car.festivalDriving);
          const to = car.dayDriving;
          const back = car.dayDrivingBack;
          const seats = car.seatsAvailable;
          const passengers = [];
          for (const element of passengers) {
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
      });

      res.render("user/dashboard", {
        username,
        notifications,
        watchlist,
        usersGroups,
        carsDriving,
        carsPassenger,
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

module.exports = router;
