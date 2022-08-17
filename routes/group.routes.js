const express = require("express");
const router = express.Router();
const Group = require("../models/Group.model");
const User = require("../models/User.model");
const isLoggedIn = require("../middleware/isLoggedIn");

router.get("/", isLoggedIn, (req, res) => {
  Group.find()
    .then((groups) => {
      res.render("group/all", { groups });
    })
    .catch((err) => "Rendering list of all groups didn't work.");
});

router.get("/create", isLoggedIn, (req, res) => {
  res.render("group/create");
});

router.post("/create", isLoggedIn, (req, res) => {
  const { groupName } = req.body;
  const adminId = req.session.user;
  User.findById(adminId)
    .then((userFound) => {
      console.log(
        `Creating the group ${groupName} with admin ${userFound._id}`
      );
      Group.create({ groupName, admin: userFound._id });
      res.redirect("/group");
    })
    .catch((err) => console.log("Failed creating a group", err));
});

router.get("/:id", isLoggedIn, (req, res) => {
  const { id } = req.params;
  Group.findById(id)
    .populate("admin crew festivals") // --> give the whole user object with this ID
    .then((group) => {
      const { groupName, admin, crew, festivals } = group;
      res.render("group/details", {
        groupName,
        admin,
        crew,
        festivals,
        id,
      });
    })
    .catch((err) => console.log("Sorry, that didn't work", err));
});

// joining a crew:
router.post("/:id", isLoggedIn, (req, res) => {
  const { id } = req.params;
  const currentUser = req.session.user;
  console.log("The current user: ", currentUser);
  Group.findById(id)
    .populate("admin crew")
    .then((group) => {
      const { admin, crew, groupName, festivals } = group;
      if (!admin._id.equals(currentUser)) {
        const alreadyCrewMember = crew.find((aUser) =>
          aUser._id.equals(currentUser)
        );
        if (!alreadyCrewMember) {
          crew.push(currentUser);
          group.save();
          group.populate("crew");
          res.render("group/details", {
            groupName,
            admin,
            crew,
            festivals,
            id,
          });
        } else {
          return res.status(400).render("group/details", {
            groupName,
            admin,
            crew,
            festivals,
            id,
            userError: "You are already part of the crew!",
          });
        }
      } else {
        return res.status(400).render("group/details", {
          groupName,
          admin,
          crew,
          festivals,
          id,
          adminError:
            "You are the admin and therefore already part of the crew!",
        });
      }
    })
    .catch((err) => console.log("Joining the crew didn't work", err));
});

module.exports = router;
