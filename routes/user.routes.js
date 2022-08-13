const express = require("express");
const router = express.Router();
const User = require("../models/User.model");

router.get("/:id", (req, res) => {
  User.findById(req.params.id)
    .then((user) => {
      const { username } = user;
      res.render("user/dashboard", { username });
    })
    .catch((err) => console.log("Something went wrong", err));
});

module.exports = router;
