const { Types } = require("mongoose");
const User = require("../models/User.model");

async function isCrewmember(user, groupId) {
  await User.findOne({
    $and: [
      { _id: Types.ObjectId(user) },
      { groups: { $in: Types.ObjectId(groupId) } },
    ],
  }).then((userFound) => {
    console.log("USER FOUND FUNCTION: ", userFound);
    return userFound;
  });
}

module.exports = isCrewmember;
