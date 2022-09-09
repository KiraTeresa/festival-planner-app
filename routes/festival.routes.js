const express = require("express");
const router = express.Router();
const Festival = require("../models/Festival.model");
const isOwner = require("../middleware/isOwner");
const spotifyApi = require("../utils/spotify");
const { Types } = require("mongoose");
const User = require("../models/User.model");
const Group = require("../models/Group.model");
const Car = require("../models/Car.model");

// Making sure only users with the role "owner" can access the festival routes:
// router.use(isOwner);

// Create a new festival:
router.get("/create", isOwner, (req, res) => {
  res.render("festival/create");
});

router.post("/create", isOwner, async (req, res) => {
  const { name, startDate, endDate } = req.body;

  // check for missing information:
  if (!name || !startDate || !endDate) {
    return res.render("festival/create", {
      errorMessage: "All fields are required.",
      name,
      startDate,
      endDate,
    });
  }

  // console.log(name, startDate, endDate);
  // if all info was provided --> create:
  const newFestival = await Festival.create({ name, startDate, endDate });

  // send notification to all users:
  const currentUser = req.session.user;
  const today = new Date().toISOString().slice(0, 10);

  await User.findById(currentUser).then(async (owner) => {
    const { username } = owner;
    const newNotification = {
      message: `Great news from ${username}! A new festival has been added: ${newFestival.name}. Go check it out!`,
      date: today,
      type: "festival",
    };
    await User.find({ role: "user" }).then((allUsers) => {
      console.log(
        "These users get the notification about the new festival: ",
        allUsers
      );
      for (element of allUsers) {
        User.findById(element._id).then((user) => {
          const { notifications } = user;
          notifications.push(newNotification);
          user.save();
        });
      }
    });
  });

  res.redirect("/festival/all");
});

// Show list of all festivals:
router.get("/all", (req, res) => {
  Festival.find()
    .then((festivals) => {
      res.render("festival/all", { festivals });
    })
    .catch((err) => console.log("Rendering all festivals didn't work", err));
});

// Add a stage to a festival:
router.get("/:id/add-stage", isOwner, (req, res) => {
  Festival.findById(req.params.id).then((festival) => {
    const { _id, name } = festival;
    console.log("Session User: ", req.session.user);
    res.render("festival/add-stage", {
      _id,
      name,
    });
  });
});

router.post("/:id/add-stage", isOwner, (req, res) => {
  const { stage } = req.body;

  Festival.findById(req.params.id)
    .then((festival) => {
      const { name, stages, _id } = festival;

      // check if all needed information was provided:
      if (!stage) {
        return res.status(400).render("festival/add-stage", {
          _id,
          name,
          errorMessage: "Please provide the name of the stage.",
        });
      }

      stages.push(stage);
      festival.save();
      res.redirect(`/festival/${_id}`);
    })
    .catch((err) => console.log("Adding stage failed", err));
});

// Add a band to a festival:
router.get("/:festivalId/add-band/", isOwner, (req, res) => {
  const { festivalId } = req.params;
  const { spotifyId } = req.query;

  Festival.findById(festivalId).then((festival) => {
    const { _id, startDate, endDate, stages } = festival;
    const festivalName = festival.name;

    spotifyApi.getArtist(spotifyId).then((artist) => {
      const { name, images } = artist.body;

      res.render("festival/add-band", {
        _id,
        festivalName,
        startDate,
        endDate,
        stages,
        spotifyId,
        bandName: name,
        image: images[0].url,
      });
    });
  });
});

router.post("/:festivalId/add-band", isOwner, (req, res) => {
  const { festivalId } = req.params;
  const {
    festivalName,
    bandName,
    spotifyId,
    stage,
    day,
    startTime,
    endTime,
    image,
  } = req.body;
  const band = {
    bandName,
    spotifyId,
    stage,
    day,
    startTime,
    endTime,
  };

  Festival.findById(festivalId)
    .then((festival) => {
      const { startDate, endDate, stages, bands } = festival;

      // check if any information is missing:
      if (!stage || !day || !startTime || !endTime) {
        return res.status(400).render("festival/add-band", {
          _id: festivalId,
          festivalName,
          startDate,
          endDate,
          stages,
          spotifyId,
          bandName,
          image,
          errorMessage: "All fields are required.",
        });
      }

      // if all required info is provided --> add the band:
      bands.push(band);
      festival.save();
      res.redirect(`/festival/${festivalId}`);
    })
    .catch((err) => console.log("Adding a band failed", err));
});

// Remove a band from festival list:
router.get("/:id/delete-band/:bandName", isOwner, async (req, res) => {
  const { id, bandName } = req.params;
  let festivalName;

  await Festival.findByIdAndUpdate(
    id,
    { $pull: { bands: { bandName } } },
    { new: true }
  ).then((updatedFestival) => {
    festivalName = updatedFestival.name;
    // console.log("Updated Festival: ", updatedFestival);
  });

  // also remove from user watchlist..
  await User.find({
    watchlist: { $elemMatch: { festivalId: Types.ObjectId(id) } },
  })
    .then(async (userFound) => {
      console.log("User FOUND: ", userFound);

      for (element of userFound) {
        await User.findById(element._id).then(async (user) => {
          const { _id, watchlist } = user;
          console.log("THE WATCHLIST: ", watchlist);

          //.. find obj in watchlist arr, which holds the info for that festival..
          const findWatchlistObj = watchlist.find((list) =>
            list.festivalId.equals(id)
          );
          console.log("THE WATCHLST OBJ: ", findWatchlistObj);

          //.. delete that obj..
          await User.findByIdAndUpdate(
            _id,
            {
              $pull: { watchlist: findWatchlistObj },
            },
            { new: true }
          );

          await User.findById(_id).then((user) =>
            console.log("Updated User: ", user)
          );

          //.. find the index, where the object was found..
          const indexOfWatchlistObj = watchlist.indexOf(findWatchlistObj);
          console.log("WATCHLIST found at indes: ", indexOfWatchlistObj);

          //.. within the watchlist object look for that element in the bands array, which holds the band info..
          const findBandObj = findWatchlistObj.bands.find(
            (list) => list.bandName === bandName
          );
          console.log("THE BAND OBJ: ", findBandObj);

          //.. get the index, of where the band was found..
          const indexOfBandObj = findWatchlistObj.bands.indexOf(findBandObj);
          console.log("Band found at index: ", indexOfBandObj);

          findWatchlistObj.bands.splice(indexOfBandObj, 1);

          console.log("NEW WatchlistObj: ", findWatchlistObj);

          console.log("IF: ", findWatchlistObj.bands);
          console.log("LENGTH: ", findWatchlistObj.bands.length);

          // prepare notification...
          const today = new Date().toISOString().slice(0, 10);

          const newNotification = {
            message: `${bandName} is no longer coming to ${festivalName}.`,
            date: today,
            type: "band",
          };

          // update user witch new watchlist object, if it still holds a band...
          if (findWatchlistObj.bands.length > 0) {
            await User.findByIdAndUpdate(
              _id,
              {
                $push: { watchlist: findWatchlistObj },
              },
              { new: true }
            );
          }

          // send notification..
          await User.findByIdAndUpdate(
            _id,
            {
              $push: { notifications: newNotification },
            },
            { new: true }
          ).then((updatedUser) => console.log("Updated User: ", updatedUser));

          // console.log("New Watchlist: ", watchlist);
        });
      }
    })
    .then(() => res.redirect(`/festival/${id}`))
    .catch((err) => console.log("Deleting failed", err));
});

// Update festival info:
router.get("/:id/update", isOwner, (req, res) => {
  Festival.findById(req.params.id)
    .then((festival) => {
      const { _id, name, startDate, endDate } = festival;
      res.render("festival/update", { _id, name, startDate, endDate });
    })
    .catch((err) => console.log("Ups, something went wrong", err));
});

router.post("/:id/update", isOwner, (req, res) => {
  const { name, startDate, endDate } = req.body;
  const _id = req.params.id;
  // check for missing information:
  if (!name || !startDate || !endDate) {
    return res.render("festival/update", {
      errorMessage: "All fields are required.",
      _id,
      name,
      startDate,
      endDate,
    });
  }

  // if all info was provided --> update:
  Festival.findByIdAndUpdate(req.params.id, { name, startDate, endDate })
    .then(() => res.redirect(`/festival/${req.params.id}`))
    .catch((err) =>
      console.log(
        "Updating the festival info didn't work, please try again",
        err
      )
    );
});

// Delete a festival:
router.post("/:id/delete", isOwner, (req, res) => {
  const festival = req.params.id;
  Festival.findByIdAndDelete(festival)
    .then(async (deletedFestival) => {
      // remove festival from all groups..
      await Group.updateMany(
        { festivals: { $in: Types.ObjectId(festival) } },
        { $pull: { festivals: Types.ObjectId(festival) } },
        { new: true }
      );

      // remove festival from user watchlists..
      await User.updateMany(
        {
          watchlist: { $elemMatch: { festivalId: Types.ObjectId(festival) } },
        },
        {
          $pull: {
            watchlist: {
              festivalId: Types.ObjectId(festival),
            },
          },
        },
        { new: true }
      ).then((updatedUsers) =>
        console.log("Users after deleting a festival: ", updatedUsers)
      );

      // remove all car pools which were driving there..
      await Car.deleteMany({
        festivalDriving: Types.ObjectId(festival),
      });

      // send notification to all users..
      const today = new Date().toISOString().slice(0, 10);
      const newNotification = {
        message: `The festival "${deletedFestival.name}" was deleted by Helga.`,
        date: today,
        type: "festival",
      };

      await User.updateMany(
        { role: "user" },
        { $push: { notifications: newNotification } },
        { new: true }
      );

      // redirect when all collections are cleared..
      res.redirect("/festival/all");
    })
    .catch((err) => console.log("Deleting failed", err));
});

// Show festival details:
router.get("/:id", (req, res) => {
  Festival.findById(req.params.id)
    .then((festival) => {
      const { _id, name, startDate, endDate, stages, bands } = festival;
      console.log(stages);
      res.render("festival/details", {
        _id,
        name,
        startDate,
        endDate,
        stages,
        bands,
      });
    })
    .catch((err) => console.log("Loading festival details failed", err));
});

module.exports = router;
