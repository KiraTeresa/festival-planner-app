const express = require("express");
const router = express.Router();
const Festival = require("../models/Festival.model");

router.get("/create", (req, res) => {
  res.render("festival/create");
});

router.post("/create", (req, res) => {
  const { name, startDate, endDate } = req.body;

  console.log(name, startDate, endDate);

  Festival.create({ name, startDate, endDate });
  res.redirect("/festival/all");
});

router.get("/all", (req, res) => {
  Festival.find()
    .then((festivals) => {
      res.render("festival/all", { festivals });
    })
    .catch((err) => console.log("Rendering all festivals didn't work", err));
});

module.exports = router;
