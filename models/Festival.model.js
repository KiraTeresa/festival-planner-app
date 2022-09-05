const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const festivalSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
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
  },
  {
    timestamps: true,
  }
);

const Festival = mongoose.model("Festival", festivalSchema);

module.exports = Festival;
