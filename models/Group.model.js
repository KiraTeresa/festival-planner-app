const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const groupSchema = new Schema({
  groupName: {
    type: String,
    unique: true,
    required: true,
  },
  admin: {
    type: mongoose.Types.ObjectId,
    ref: "User",
  },
  crew: {
    type: [mongoose.Types.ObjectId],
    ref: "User",
  },
  pending: {
    type: [mongoose.Types.ObjectId],
    ref: "User",
  },
  festivals: {
    type: [mongoose.Types.ObjectId],
    ref: "Festival",
    default: [],
  },
});

const Group = mongoose.model("Group", groupSchema);

module.exports = Group;
