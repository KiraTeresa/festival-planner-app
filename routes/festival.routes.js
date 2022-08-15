const express = require("express");
const router = express.Router();
const Festival = require("../models/Festival.model");
const isOwner = require("../middleware/isOwner");
const spotifyApi = require("../utils/spotify");

// Making sure only users with the role "owner" can access the festival routes:
router.use(isOwner);

// route handling:
router.get("/create", (req, res) => {
  res.render("festival/create");
});

router.post("/create", (req, res) => {
  const { name, startDate, endDate } = req.body;
  console.log(name, startDate, endDate);
  Festival.create({ name, startDate, endDate });
  res.redirect("/festival/all");
});

router.get("/all", (req, res) => {
  Festival.find()
    .then((festivals) => {
      res.render("festival/all", { festivals });
    })
    .catch((err) => console.log("Rendering all festivals didn't work", err));
});

router.get("/:id/add-stage", (req, res) => {
  Festival.findById(req.params.id).then((festival) => {
    const { _id, name } = festival;
    console.log("Session User: ", req.session.user);
    res.render("festival/add-stage", {
      _id,
      name,
    });
  });
});

router.post("/:id/add-stage", (req, res) => {
  const { stage } = req.body;
  Festival.findById(req.params.id)
    .then((festival) => {
      const { stages, _id } = festival;
      stages.push(stage);
      festival.save();
      res.redirect(`/festival/${_id}`);
    })
    .catch((err) => console.log("Adding stage failed", err));
});

router.get("/:id/add-band/", (req, res) => {
  const { id } = req.params;
  const { spotifyId } = req.query;
  Festival.findById(id).then((festival) => {
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
        name,
        images,
      });
    });
  });
});

router.post("/:id/add-band", (req, res) => {
  const { bandName, spotifyId, stage, day, startTime, endTime } = req.body;
  const band = {
    bandName,
    spotifyId,
    stage,
    day,
    startTime,
    endTime,
  };
  Festival.findById(req.params.id)
    .then((festival) => {
      const { bands, _id } = festival;
      bands.push(band);
      festival.save();
      res.redirect(`/festival/${_id}`);
    })
    .catch((err) => console.log("Adding a band failed", err));
});

router.get("/:id/update", (req, res) => {
  Festival.findById(req.params.id)
    .then((festival) => {
      const { _id, name, startDate, endDate } = festival;
      res.render("festival/update", { _id, name, startDate, endDate });
    })
    .catch((err) => console.log("Ups, something went wrong", err));
});

router.post("/:id/update", (req, res) => {
  const { name, startDate, endDate } = req.body;
  Festival.findByIdAndUpdate(req.params.id, { name, startDate, endDate })
    .then(() => res.redirect(`/festival/${req.params.id}`))
    .catch((err) =>
      console.log(
        "Updating the festival info didn't work, please try again",
        err
      )
    );
});

router.post("/:id/delete", (req, res) => {
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
