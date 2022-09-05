const express = require("express");
const router = express.Router();
const Festival = require("../models/Festival.model");
const isOwner = require("../middleware/isOwner");
const spotifyApi = require("../utils/spotify");
const { Types } = require("mongoose");
const User = require("../models/User.model");

// Making sure only users with the role "owner" can access the festival routes:
// router.use(isOwner);

// route handling:
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

router.get("/all", (req, res) => {
  Festival.find()
    .then((festivals) => {
      res.render("festival/all", { festivals });
    })
    .catch((err) => console.log("Rendering all festivals didn't work", err));
});

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
        image: images[2].url,
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

// remove a band from festival list:
router.get("/:id/delete-band/:bandName", isOwner, async (req, res) => {
  const { id, bandName } = req.params;
  await Festival.findOne({
    _id: new Types.ObjectId(id),
    bands: {
      $elemMatch: {
        bandName,
      },
    },
  })
    .then(async (festival) => {
      const { name, bands } = festival;
      // console.log("Festival found: ", festival);
      // console.log("The bands: ", bands);

      const bandIndex = bands.indexOf(bandName);
      bands.splice(bandIndex, 1);
      await festival.save();
      res.redirect(`/festival/${id}`);
    })
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

router.post("/:id/delete", isOwner, (req, res) => {
  Festival.findByIdAndDelete(req.params.id)
    .then(() => {
      console.log("Festival successfully deleted");
      res.redirect("/festival/all");
    })
    .catch((err) => console.log("Deleting failed", err));
});

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
