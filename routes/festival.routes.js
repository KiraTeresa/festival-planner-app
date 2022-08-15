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

router.get("/:id/add-stage", (req, res) => {
  Festival.findById(req.params.id).then((festival) => {
    const { _id, name, startDate, endDate, stages, bands } = festival;
    res.render("festival/add-stage", {
      _id,
      name,
      startDate,
      endDate,
      stages,
      bands,
    });
  });
});

router.post("/:id/add-stage", (req, res) => {
  const { stage } = req.body;
  Festival.findByIdAndUpdate(req.params.id, { stages: stage })
    .then((festival) => {
      res.redirect(`/festival/${festival._id}`);
    })
    .catch((err) => console.log("Adding stage failed", err));
});

router.get("/:id", (req, res) => {
  Festival.findById(req.params.id)
    .then((festival) => {
      const { _id, name, startDate, endDate, stages, bands } = festival;
      console.log(stages);
      res.render("festival/details", {
        _id,
        name,
        startDate,
        endDate,
        stages,
        bands,
      });
    })
    .catch((err) => console.log("Loading festival details failed", err));
});

module.exports = router;
