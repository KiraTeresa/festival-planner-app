const express = require("express");
const router = express.Router();
const spotifyApi = require("../utils/spotify");
const Festival = require("../models/Festival.model");

router.get("/search-result", (req, res) => {
  const { bandName, festivalID } = req.query;

  spotifyApi
    .searchArtists(bandName)
    .then((data) => {
      const band = data.body.artists.items;
      Festival.findById(festivalID).then((festival) => {
        const festivalName = festival.name;
        res.render("band/search-result", { band, festivalName, festivalID });
      });
    })
    .catch((err) =>
      console.log("Error occurred while searching for a band", err)
    );
});

router.get("/:bandName/:festivalID", (req, res) => {
  const band = req.params.bandName;
  const festivalID = req.params.festivalID;
  Festival.findById(festivalID)
    .then((festival) => {
      const bandFound = festival.bands.find(
        (element) => element.bandName === band
      );
      const { bandName, stage, day, startTime, endTime } = bandFound;
      res.render("band/details", { bandName, stage, day, startTime, endTime });
    })
    .catch((err) =>
      console.log("Did not find the band you were looking for", err)
    );
});

module.exports = router;
