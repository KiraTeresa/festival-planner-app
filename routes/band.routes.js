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

// band details:
router.get("/:bandName/:festivalID", (req, res) => {
  const band = req.params.bandName;
  const festivalID = req.params.festivalID;
  Festival.findById(festivalID)
    .then((festival) => {
      const bandFound = festival.bands.find(
        (element) => element.bandName === band
      );
      const { bandName, spotifyId, stage, day, startTime, endTime } = bandFound;
      spotifyApi.getArtist(spotifyId).then((artist) => {
        const { genres, images } = artist.body;
        spotifyApi.getArtistTopTracks(spotifyId, "de").then((topTracks) => {
          const { tracks } = topTracks.body;
          console.log("Found the top tracks: ", tracks);
          res.render("band/details", {
            bandName,
            stage,
            day,
            startTime,
            endTime,
            genres,
            images,
            tracks,
          });
        });
      });
    })
    .catch((err) =>
      console.log("Did not find the band you were looking for", err)
    );
});

module.exports = router;
