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

module.exports = router;
