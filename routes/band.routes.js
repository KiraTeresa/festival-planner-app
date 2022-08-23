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
        res.render("band/search-result", { band, festivalName, festivalID });
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
      .then(async (user) => {
        const { watchlist } = user;

        // check if festival is already on your list:
        const festivalOnList = watchlist.find((element) =>
          element.festival.equals(festivalID)
        );
        // if not on your list --> add:
        if (!festivalOnList) {
          const newElement = new Types.ObjectId(festivalID);
          watchlist.push({ festival: newElement, bands: [bandName] });
          user.save();
        }

        // if festival already on your list, check if you already added the band:
        else if (festivalOnList) {
          const index = watchlist.indexOf(festivalOnList);
          const bandOnList = watchlist[index].bands.find(
            (element) => element === bandName
          );

          // if band not found --> add:
          if (!bandOnList) {
            watchlist[index].bands.push(bandName);
            await user.updateOne({ watchlist });
          }
        }

        res.redirect(`/group/${groupID}`);
      })
      .catch((err) =>
        console.log("Adding the band to your watchlist failed, sorry.", err)
      );
  }
);

// remove a band from your personal setlist:
router.post(
  "/:bandName/:festivalID/:groupID/remove-from-watchlist",
  isLoggedIn,
  async (req, res) => {
    const bandName = req.params.bandName;
    const festivalID = req.params.festivalID;
    const groupID = req.params.groupID;
    const currentUser = req.session.user;

    await User.findOne({
      _id: new Types.ObjectId(currentUser),
      watchlist: {
        $elemMatch: {
          festival: new Types.ObjectId(festivalID),
          bands: bandName,
        },
      },
    })
      .then(async (user) => {
        // leave, if there is no such user:
        if (!user) {
          console.log("This band is not on your watchlist");
          res.redirect(`/group/${groupID}`);
        }

        // if there is a user matchin the criteria --> find the band in the users watchlist..
        const { watchlist } = user;
        const getFestival = watchlist.find((element) =>
          element.festival.equals(festivalID)
        );
        const { bands } = getFestival;
        const bandIndex = bands.indexOf(bandName);
        // .. then remove the band
        bands.splice(bandIndex, 1);
        await user.updateOne({ watchlist });
        console.log(`${bandName} was removed from your list`);

        res.redirect(`/group/${groupID}`);
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
