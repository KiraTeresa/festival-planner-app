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
    .then(async (userFound) => {
      console.log(
        `Creating the group ${groupName} with admin ${userFound._id}`
      );
      const newGroup = await Group.create({ groupName, admin: userFound._id });

      // also add group to user.groups array:
      userFound.groups.push(new Types.ObjectId(newGroup._id));
      await userFound.save();

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

      // check who of your crew is interested in which band and store in new array:
      const newFestivalArr = [];
      for (element of festivals) {
        const addFestival = {
          festivalName: element.name,
          IdOfFestival: element._id,
          bandsWithCrewArr: [],
        };

        await Festival.findById(element).then(async (festival) => {
          const { _id, name, bands } = festival;

          for (band of bands) {
            const { bandName } = band;
            console.log("TEST: ", band);
            const newBandObj = {
              band,
            };

            // Find all crew members who are interested to watch this band on that festival:
            await User.find({
              groups: new Types.ObjectId(id),
              watchlist: {
                $elemMatch: {
                  festivalId: new Types.ObjectId(_id),
                  bands: bandName,
                },
              },
            }).then((userArr) => {
              newBandObj.crewArr = userArr;
              addFestival.bandsWithCrewArr.push(newBandObj);
            });
          }
        });
        newFestivalArr.push(addFestival);
      }

      console.log("New Festival Array: ", newFestivalArr);
      console.log(
        "First Arr Element: ",
        newFestivalArr[0].bandsWithCrewArr[1].crewArr
      );

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
          newFestivalArr,
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
    .populate("admin crew pending festivals")
    .then(async (group) => {
      const { admin, crew, pending, groupName, festivals } = group;
      if (!admin._id.equals(currentUser)) {
        const alreadyCrewMember = crew.find((aUser) =>
          aUser._id.equals(currentUser)
        );
        const alreadyPendingMember = pending.find((aUser) =>
          aUser._id.equals(currentUser)
        );

        console.log(
          `Already in crew? ${alreadyCrewMember} or already pending? ${alreadyPendingMember}`
        );

        if (!alreadyCrewMember && !alreadyPendingMember) {
          pending.push(currentUser);
          group.save();
          group.populate("pending festivals");

          // send notification to admin:
          await User.findById(currentUser).then(async (user) => {
            const { username } = user;
            await User.findById(admin).then((adminUser) => {
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

          // Festival.find().then((festivalCollection) => {
          //   res.render("group/details", {
          //     groupName,
          //     admin,
          //     crew,
          //     pending,
          //     festivals,
          //     id,
          //     userError: "Your request has been send to the group admin.",
          //     festivalCollection,
          //   });
          // });
          //   } else if (alreadyCrewMember) {
          //     Festival.find().then((festivalCollection) => {
          //       return res.status(400).render("group/details", {
          //         groupName,
          //         admin,
          //         crew,
          //         pending,
          //         festivals,
          //         id,
          //         userError: "You are already part of the crew!",
          //         festivalCollection,
          //       });
          //     });
          //   } else if (alreadyPendingMember) {
          //     console.log("Pending: ", pending);
          //     Festival.find().then((festivalCollection) => {
          //       return res.status(400).render("group/details", {
          //         groupName,
          //         admin,
          //         crew,
          //         pending,
          //         festivals,
          //         id,
          //         userError:
          //           "You are almost in, just wait for the admin to confirm that you are worthy to join this incredible crew. Have patience my friend.",
          //         festivalCollection,
          //       });
          //     });
          //   }
          // } else {
          //   Festival.find().then((festivalCollection) => {
          //     return res.status(400).render("group/details", {
          //       groupName,
          //       admin,
          //       crew,
          //       pending,
          //       festivals,
          //       id,
          //       userError:
          //         "You are the admin and therefore already part of the crew!",
          //       festivalCollection,
          //     });
          // });
        }
      }
      return res.redirect(`/group/${id}`);
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
        const pendingUser = pending.find((element) => element.equals(userId));
        const posInWaitingList = pending.indexOf(pendingUser);
        console.log("Index: ", posInWaitingList);
        pending.splice(posInWaitingList, 1);
        console.log("New pending: ", pending);
        group.save();

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
        const pendingUser = pending.find((element) => element.equals(userId));
        const posInWaitingList = pending.indexOf(pendingUser);
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

// Leave a crew:
router.post("/:id/leave", isLoggedIn, async (req, res) => {
  const { id } = req.params;
  const currentUser = req.session.user;

  await Group.findById(id)
    .populate("admin crew")
    .then((group) => {
      const { admin, crew, pending, groupName, festivals } = group;
      if (!admin._id.equals(currentUser)) {
        // check if user is part of the crew or on pending list:
        const crewMember = crew.find((aUser) => aUser._id.equals(currentUser));
        const pendingMember = pending.find((aUser) =>
          aUser._id.equals(currentUser)
        );

        // remove if user is a crew member:
        if (crewMember) {
          const index = crew.indexOf(crewMember);
          crew.splice(index, 1);

          // also remove group from user.groups array:
          User.findById(currentUser).then((user) => {
            const { groups } = user;
            const indexOfGroup = groups.indexOf(group._id);
            groups.splice(indexOfGroup, 1);
            user.save();
          });
        }

        // remove from pending list if user wants to leave before admin had a chance to accept or deny:
        else if (pendingMember) {
          const index = pending.indexOf(crewMember);
          pending.splice(index, 1);
        }

        // redirect if none of the above is true:
        else {
          res.redirect("/group");
        }

        // save changes:
        group.save();
        group.populate("pending");

        // send notification to admin:
        User.findById(currentUser).then((user) => {
          const { username } = user;
          User.findById(admin).then((adminUser) => {
            const { notifications } = adminUser;
            const today = new Date().toISOString().slice(0, 10);

            const newNotification = {
              message: `${username} is no longer part of your group "${groupName}"`,
              date: today,
              type: "group",
            };
            notifications.push(newNotification);
            adminUser.save();
            res.redirect("/group");
          });
        });
      } else if (admin._id.equals(currentUser)) {
        group.populate("admin crew pending festivals");
        return res.status(400).render("group/details", {
          groupName,
          admin,
          crew,
          pending,
          festivals,
          id,
          userError: "You are the admin, you cannot leave!!!",
        });
      }
    })
    .catch((err) => console.log("Leaving the crew didn't work", err));
});

// Path when admin allows user to join the group:
router.post("/:groupName/join/:userId", async (req, res) => {
  const { groupName, userId } = req.params;
  const currentUser = req.session.user;
  await Group.findOne({ groupName })
    .populate("admin crew pending")
    .then(async (group) => {
      const { _id, admin, crew, pending } = group;
      if (admin._id.equals(currentUser)) {
        // add user to crew and remove from pendingArr:
        crew.push(userId);
        const pendingUser = pending.find((element) => element.equals(userId));
        const posInWaitingList = pending.indexOf(pendingUser);
        console.log("Index: ", posInWaitingList);
        pending.splice(posInWaitingList, 1);
        console.log("New pending: ", pending);
        group.save();
        // group.populate("admin crew pending");

        // send notification to user:
        await User.findById(userId).then((user) => {
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
router.post("/:groupName/deny/:userId", (req, res) => {
  const { groupName, userId } = req.params;
  const currentUser = req.session.user;
  Group.findOne({ groupName })
    .populate("admin crew pending")
    .then((group) => {
      const { _id, admin, pending } = group;
      if (admin._id.equals(currentUser)) {
        const pendingUser = pending.find((element) => element.equals(userId));
        const posInWaitingList = pending.indexOf(pendingUser);
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
