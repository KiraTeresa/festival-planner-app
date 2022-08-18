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

// Path when admin allows user to join the group:
router.get("/:groupName/join/:userId", (req, res) => {
  const { groupName, userId } = req.params;
  const currentUser = req.session.user;
  Group.findOne({ groupName })
    .populate("admin crew pending")
    .then((group) => {
      const { _id, admin, crew, pending } = group;
      if (admin._id.equals(currentUser)) {
        // add user to crew and remove from pendingArr:
        crew.push(userId);
        const posInWaitingList = pending.indexOf(userId);
        pending.splice(posInWaitingList, 1);
        group.save();
        group.populate("admin crew pending");

        // send notification to user:
        User.findById(userId).then((user) => {
          const { notifications } = user;
          const today = new Date().toISOString().slice(0, 10);

          const newNotification = {
            message: `Hey ${user.username}, you've been accepted as a new crew member of the group ${groupName}. Congrats!`,
            date: today,
            type: "group",
          };
          notifications.push(newNotification);
          user.save();
          res.redirect(`/group/${_id}`);
        });
      }
    })
    .catch((err) =>
      console.log("Error while allowing a user to join the crew.", err)
    );
});

// Path when admin denies user to join the group:
router.get("/:groupName/deny/:userId", (req, res) => {
  const { groupName, userId } = req.params;
  const currentUser = req.session.user;
  Group.findOne({ groupName })
    .populate("admin crew pending")
    .then((group) => {
      const { _id, admin, pending } = group;
      if (admin._id.equals(currentUser)) {
        const posInWaitingList = pending.indexOf(userId);
        pending.splice(posInWaitingList, 1);
        group.save();
        group.populate("admin crew pending");
        console.log(
          `User ${userId} was denied access to the group ${groupName}`
        );

        // send notification to user:
        User.findById(userId).then((user) => {
          const { notifications } = user;
          const today = new Date().toISOString().slice(0, 10);

          const newNotification = {
            message: `Sorry ${user.username}, the admin of the group ${groupName} didn't not give you permission to join the crew.`,
            date: today,
            type: "group",
          };
          notifications.push(newNotification);
          user.save();
          res.redirect(`/group/${_id}`);
        });
      }
    })
    .catch((err) =>
      console.log("Error while allowing a user to join the crew.", err)
    );
});

// Lists all groups:
router.get("/:id", isLoggedIn, (req, res) => {
  const { id } = req.params;
  const currentUser = req.session.user;

  Group.findById(id)
    .populate("admin crew pending festivals")
    .then((group) => {
      const { groupName, admin, crew, pending, festivals } = group;
      let adminStatus = false;
      if (admin._id.equals(currentUser)) {
        adminStatus = true;
      }
      res.render("group/details", {
        groupName,
        admin,
        crew,
        pending,
        festivals,
        id,
        adminStatus,
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
    .populate("admin crew pending")
    .then((group) => {
      const { admin, crew, pending, groupName, festivals } = group;
      if (!admin._id.equals(currentUser)) {
        const alreadyCrewMember = crew.find((aUser) =>
          aUser._id.equals(currentUser)
        );
        const alreadyPendingMember = pending.find((aUser) =>
          aUser._id.equals(currentUser)
        );
        if (!alreadyCrewMember && !alreadyPendingMember) {
          pending.push(currentUser);
          group.save();
          group.populate("pending");

          // send notification to admin:
          User.findById(currentUser).then((user) => {
            const { username } = user;
            User.findById(admin).then((adminUser) => {
              const { notifications } = adminUser;
              const today = new Date().toISOString().slice(0, 10);

              const newNotification = {
                message: `${username} wants to join your group "${groupName}"`,
                date: today,
                type: "group",
              };
              notifications.push(newNotification);
              adminUser.save();
            });
          });

          res.render("group/details", {
            groupName,
            admin,
            crew,
            pending,
            festivals,
            id,
            userError: "Your request has been send to the group admin.",
          });
        } else if (alreadyCrewMember) {
          return res.status(400).render("group/details", {
            groupName,
            admin,
            crew,
            pending,
            festivals,
            id,
            userError: "You are already part of the crew!",
          });
        } else if (alreadyPendingMember) {
          console.log("Pending: ", pending);
          return res.status(400).render("group/details", {
            groupName,
            admin,
            crew,
            pending,
            festivals,
            id,
            userError:
              "You are almost in, just wait for the admin to confirm that you are worthy to join this incredible crew. Have patience my friend.",
          });
        }
      } else {
        return res.status(400).render("group/details", {
          groupName,
          admin,
          crew,
          pending,
          festivals,
          id,
          userError:
            "You are the admin and therefore already part of the crew!",
        });
      }
    })
    .catch((err) => console.log("Joining the crew didn't work", err));
});

module.exports = router;
