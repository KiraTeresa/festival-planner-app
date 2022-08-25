const express = require("express");
const router = express.Router();
const User = require("../models/User.model");
const Group = require("../models/Group.model");
const isLoggedIn = require("../middleware/isLoggedIn");

router.get("/dashboard", isLoggedIn, async (req, res) => {
  User.findById(req.session.user)
    .populate("groups")
    .then(async (user) => {
      const { username, watchlist, notifications, groups } = user;

      let usersGroups = [];
      console.log("GROUPS BEFORE LOOP: ", usersGroups);
      if (groups) {
        for (const element of groups) {
          await Group.findById(element.toString()).then(async (group) => {
            const { groupName } = group;
            usersGroups.push(groupName);
            console.log("Element: ", element);
            console.log("-------");
          });
        }
      }
      console.log("USERS GROUPS AFTER LOOP: ", usersGroups);
      res.render("user/dashboard", {
        username,
        notifications,
        watchlist,
        usersGroups,
      });
    })

    .catch((err) => console.log("Something went wrong", err));
});

module.exports = router;
