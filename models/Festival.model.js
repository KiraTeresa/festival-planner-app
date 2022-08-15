const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const festivalSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  stages: {
    type: [],
    required: true,
    default: [],
  },
  bands: {
    type: [],
    required: true,
    default: [],
  },
});

const Festival = mongoose.model("Festival", festivalSchema);

module.exports = Festival;
