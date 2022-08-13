const express = require("express");
const router = express.Router();
const Group = require("../models/Group.model");

router.get("/", (req, res) => {
  Group.find()
    .then((groups) => {
      res.render("group/all", { groups });
    })
    .catch((err) => "Rendering list of all groups didn't work.");
});

module.exports = router;
