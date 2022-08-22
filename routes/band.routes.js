const express = require("express");
const router = express.Router();
const spotifyApi = require("../utils/spotify");
const Festival = require("../models/Festival.model");
const User = require("../models/User.model");
const isLoggedIn = require("../middleware/isLoggedIn");
const { Types } = require("mongoose");

router.get("/search-result", (req, res) => {
  const { bandName, festivalID } = req.query;

  spotifyApi
    .searchArtists(bandName)
    .then((data) => {
      const band = data.body.artists.items;
      Festival.findById(festivalID).then((festival) => {
        const festivalName = festival.name;
        res.redirect("/band/search-result", { band, festivalName, festivalID });
      });
    })
    .catch((err) =>
      console.log("Error occurred while searching for a band", err)
    );
});

// add a band to your personal setlist:
router.post(
  "/:bandName/:festivalID/:groupID/add-to-watchlist",
  isLoggedIn,
  (req, res) => {
    const bandName = req.params.bandName;
    const festivalID = req.params.festivalID;
    const groupID = req.params.groupID;
    const currentUser = req.session.user;

    User.findById(currentUser)
      .then((user) => {
        const { watchlist } = user;

        // check if band-festival-combo is already on your list:
        const alreadyOnList = watchlist.find(
          (element) =>
            element.festival.equals(festivalID) && element.band === bandName
        );
        // if not on your list --> add:
        if (!alreadyOnList) {
          const newElement = new Types.ObjectId(festivalID);
          watchlist.push({ festival: newElement, band: bandName });
          user.save();
        }
        res.redirect(`/group/${groupID}`);
      })
      .catch((err) =>
        console.log("Adding the band to your watchlist failed, sorry.", err)
      );
  }
);

// band details:
router.get("/:bandName/:festivalID", (req, res) => {
  const band = req.params.bandName;
  const festivalID = req.params.festivalID;
  // USE MONGOOSE SEARCH --> Find festival with that ID and that band?!
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
