const User = require("../models/User.model");

module.exports = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/");
  }

  User.findById(req.session.user).then((userFound) => {
    if (userFound.role !== "owner") {
      return res.redirect("/");
    }
  });

  next();
};
