const express = require("express");
const router = express.Router();
const spotifyApi = require("../utils/spotify");
const Festival = require("../models/Festival.model");
const User = require("../models/User.model");
const isLoggedIn = require("../middleware/isLoggedIn");
const isOwner = require("../middleware/isOwner");
const { Types } = require("mongoose");

router.get("/search-result", isLoggedIn, (req, res) => {
  const { bandName, festivalID } = req.query;

  spotifyApi
    .searchArtists(bandName)
    .then((data) => {
      const band = data.body.artists.items;
      console.log(band);
      Festival.findById(festivalID).then((festival) => {
        const festivalName = festival.name;
        res.render("band/search-result", {
          bandName,
          band,
          festivalName,
          festivalID,
        });
      });
    })
    .catch((err) =>
      console.log("Error occurred while searching for a band", err)
    );
});

// band details:
router.get("/:bandName/:festivalID", isLoggedIn, async (req, res) => {
  const band = req.params.bandName;
  const festivalID = req.params.festivalID;
  // USE MONGOOSE SEARCH --> Find festival with that ID and that band?!
  await Festival.findById(festivalID)
    .then(async (festival) => {
      const { name, bands } = festival;
      const bandFound = bands.find((element) => element.bandName === band);
      const { bandName, spotifyId, stage, day, startTime, endTime } = bandFound;

      await spotifyApi.getArtist(spotifyId).then((artist) => {
        const { genres, images } = artist.body;
        spotifyApi.getArtistTopTracks(spotifyId, "de").then((topTracks) => {
          const { tracks } = topTracks.body;
          // console.log("Found the top tracks: ", tracks);
          res.render("band/details", {
            bandName,
            stage,
            day,
            startTime,
            endTime,
            genres,
            images,
            tracks,
            festivalName: name,
            festivalID,
          });
        });
      });
    })
    .catch((err) =>
      console.log("Did not find the band you were looking for", err)
    );
});

// Edit a band:
router.get(
  "/:bandName/:festivalId/edit",
  isLoggedIn,
  isOwner,
  async (req, res) => {
    const { bandName, festivalId } = req.params;
    await Festival.findById(festivalId).then((festival) => {
      const { name, stages, bands } = festival;
      const bandFound = bands.find((element) => element.bandName === bandName);
      const { stage, day, startTime, endTime } = bandFound;
      res.render("band/edit", {
        bandName,
        stage,
        day,
        startTime,
        endTime,
        festivalName: name,
        festivalId,
        stages,
      });
    });
  }
);

// Edit a band:
router.post(
  "/:bandName/:festivalId/edit",
  isLoggedIn,
  isOwner,
  async (req, res) => {
    const { bandName, festivalId } = req.params;
    const { stageEdit, dayEdit, startTimeEdit, endTimeEdit } = req.body;

    await Festival.findById(festivalId)
      .then(async (festival) => {
        const { name, bands, stages } = festival;

        // check for missing information:
        if (!stageEdit || !dayEdit || !startTimeEdit || !endTimeEdit) {
          return res.render("band/edit", {
            errorMessage: "All fields are required.",
            day: dayEdit,
            startTime: startTimeEdit,
            endTime: endTimeEdit,
            stages,
            bandName,
            festivalName: name,
            festivalId,
          });
        }

        // if all info was provided --> update:
        const bandFound = bands.find(
          (element) => element.bandName === bandName
        );

        let { stage, day, startTime, endTime } = bandFound;
        // console.log(bandFound, dayEdit);
        // console.log("STAGE", stage, stageEdit, stage === stageEdit);
        // console.log("day", day, dayEdit, day === dayEdit);
        // console.log(
        //   "startTime",
        //   startTime,
        //   startTimeEdit,
        //   startTime === startTimeEdit
        // );
        // console.log("end", endTime, endTimeEdit, endTime === endTimeEdit);

        // check if nothing has changed:
        if (
          stage === stageEdit &&
          day === dayEdit &&
          startTime === startTimeEdit &&
          endTime === endTimeEdit
        ) {
          console.log("No changes were made");
          return res.redirect(`/band/${bandName}/${festivalId}`);
        }

        // console.log("NEW", stage, day, startTime, endTime);
        // save changes
        const idx = festival.bands.indexOf(bandFound);

        festival.bands[idx] = {
          ...festival.bands[idx],
          startTime: startTimeEdit,
          endTime: endTimeEdit,
          day: dayEdit,
          stage: stageEdit,
        };

        await Festival.findByIdAndUpdate(festival._id, {
          bands: festival.bands,
        });

        return res.redirect(`/band/${bandName}/${festivalId}`);
      })
      .catch((err) => console.log(`Editing ${bandName} did not work.`, err));
  }
);

module.exports = router;
