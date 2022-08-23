const express = require("express");
const router = express.Router();
const Group = require("../models/Group.model");
const User = require("../models/User.model");
const Festival = require("../models/Festival.model");
const isLoggedIn = require("../middleware/isLoggedIn");
const { Types } = require("mongoose");

// all groups:
router.get("/", isLoggedIn, (req, res) => {
  Group.find()
    .then((groups) => {
      res.render("group/all", { groups });
    })
    .catch((err) => "Rendering list of all groups didn't work.");
});

// create a new group:
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

// shows group details:
router.get("/:id", isLoggedIn, (req, res) => {
  const { id } = req.params;
  const currentUser = req.session.user;

  Group.findById(id)
    .populate("admin crew pending festivals")
    .then(async (group) => {
      const { groupName, admin, crew, pending, festivals } = group;
      // console.log("The festivals: ", festivals);
      let adminStatus = false;
      if (admin._id.equals(currentUser)) {
        adminStatus = true;
      }
      Festival.find().then((festivalCollection) => {
        res.render("group/details", {
          groupName,
          admin,
          crew,
          pending,
          festivals,
          id,
          adminStatus,
          festivalCollection,
        });
      });
    })
    .catch((err) => console.log("Sorry, that didn't work", err));
});

// add festival to group:
router.post("/:id", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { addFestival } = req.body;
  const currentUser = req.session.user;

  // DB
  // get me one group
  // check if the admin is the current user
  // check within ALL of the crew if the user is part of it or not

  // console.log(
  //   await Group.findOne({
  //     _id: id,
  //     $or: [{ admin: currentUser }, { crew: { $in: currentUser } }],
  //   })
  // );

  // return Group.findOne({
  //   _id: id,
  //   $or: [{ admin: currentUser }, { crew: { $in: currentUser } }],
  // }).then(async (group) => {
  //   if (!group) {
  //     console.log(
  //       "You need to be part of the crew, in order to add a festival."
  //     );
  //     return res.redirect("/group");
  //   }
  //   await Group.findByIdAndUpdate(group._id, {
  //     $push: {
  //       festivals: addFestival,
  //     },
  //   });
  //   res.redirect(`/group/${id}`);
  // });

  Group.findById(id)
    .populate("admin crew")
    .then(async (group) => {
      const { groupName, admin, crew, festivals = [] } = group;
      // console.log(group);
      // check if user is crew member/admin:
      const isCrewmember = crew.find((user) => user._id.equals(currentUser));
      if (admin._id.equals(currentUser) || isCrewmember) {
        // console.log("HIER?", addFestival);
        // if user is allowed to add a festival, check if festival was already added to the group:
        const festivalAlreadyAdded = festivals.find((festival) =>
          festival._id.equals(addFestival)
        );
        if (!festivalAlreadyAdded) {
          festivals.push(new Types.ObjectId(addFestival));
          await group.save();

          // send notification...
          const today = new Date().toISOString().slice(0, 10);
          User.findById(currentUser).then((user) => {
            const { username } = user;
            const newNotification = {
              message: `${username} has added a new festival to your group "${groupName}". Go check it out!`,
              date: today,
              type: "group",
            };
            // ...to all crew members:
            crew.forEach((element) => {
              User.findById(element._id).then((user) => {
                const { notifications } = user;
                notifications.push(newNotification);
                user.save();
              });
            });
            // ...to group admin:
            User.findById(admin._id).then((user) => {
              const { notifications } = user;
              notifications.push(newNotification);
              user.save();
            });
            res.redirect(`/group/${id}`);
          });
        } else {
          console.log("The festival you chose is already on the list.");
          res.redirect(`/group/${id}`);
        }
      } else {
        console.log(
          "You need to be part of the crew, in order to add a festival."
        );
        res.redirect("/group");
      }
    })
    .catch((err) => console.log("Sorry, that didn't work", err));
});

// joining a crew:
router.post("/:id/join", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const currentUser = req.session.user;
  // console.log("The current user: ", currentUser);
  await Group.findById(id)
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
          const { notifications, groups } = user;
          const today = new Date().toISOString().slice(0, 10);

          const newNotification = {
            message: `Hey ${user.username}, you've been accepted as a new crew member of the group ${groupName}. Congrats!`,
            date: today,
            type: "group",
          };
          notifications.push(newNotification);

          // also add group to user.groups array:
          groups.push(new Types.ObjectId(_id));
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

module.exports = router;
