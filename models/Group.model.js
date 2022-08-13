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
    ref: "user",
  },
  crew: {
    type: [mongoose.Types.ObjectId],
    ref: "user",
  },
  festivals: [],
});

const Group = mongoose.model("Group", groupSchema);

module.exports = Group;
