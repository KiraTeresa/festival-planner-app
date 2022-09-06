const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const carSchema = new Schema(
  {
    driver: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
    festivalDriving: {
      type: mongoose.Types.ObjectId,
      ref: "Festival",
    },
    dayDriving: String,
    dayDrivingBack: String,
    capacity: Number,
    seatsAvailable: Number,
    allOccupied: {
      type: Boolean,
      default: false,
    },
    passengers: {
      type: [mongoose.Types.ObjectId],
      ref: "User",
      default: [],
    },
    postedInGroup: {
      type: mongoose.Types.ObjectId,
      ref: "Group",
    },
  },
  {
    timestamps: true,
  }
);

const Car = mongoose.model("Car", carSchema);
module.exports = Car;
