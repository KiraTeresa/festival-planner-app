const express = require("express");
const router = express.Router();
const User = require("../models/User.model");
const isLoggedIn = require("../middleware/isLoggedIn");

router.get("/dashboard", isLoggedIn, (req, res) => {
  User.findById(req.session.user)
    .then((user) => {
      const { username, notifications } = user;
      res.render("user/dashboard", { username, notifications });
    })
    .catch((err) => console.log("Something went wrong", err));
});

module.exports = router;
