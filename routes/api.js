const router = require("express").Router();
const passport = require("passport");
const jwt = require("jsonwebtoken"); 
const mongoose = require("mongoose"); 

const BetSlip = require("../models/betSlip");
const User = require("../models/user");
const Game = require("../models/games"); 
const Sport = require("../models/sport"); 

const updateUserAccount = async (userId, amount) => {
  const user = await User.findOne({ user_id: userId });
  if (!user) throw new Error("User not found");

  const updatedUser = await User.updateOne(
    { user_id: userId },
    {
      $inc: {
        "account_value.pending": amount,
        "account_value.current": -amount,
      },
      $push: {
        "account_value_history.pending": {
          date: Date.now(),
          value: user.account_value.pending + amount,
        },
        "account_value_history.balance": {
          date: Date.now(),
          value: user.account_value.current - amount,
        },
      },
    },
    { new: true },
  );
  return updatedUser;
};

// Unified bet processing function
const processBets = async (betInfo, sum) => {
  let slips, user;
  if (Array.isArray(betInfo) && betInfo.length > 1) {
    slips = await BetSlip.insertMany(betInfo);
  } else {
    const slip = await BetSlip.create(betInfo);
    slips = [slip]; // Ensure slips is always an array for consistency
  }

  if (slips.length > 0) {
    await updateUserAccount(slips[0].userID, parseFloat(sum));
    user = await User.findOne({ user_id: slips[0].userID });
  }

  return { slips, user };
};

// Route to handle both single and bulk bet slips
router.post("/api/bet", async (req, res) => {
  try {
    const { betInfo, sum } = req.body;
    if (!betInfo || sum === undefined)
      throw new Error("Missing betInfo or sum");

    const { slips, user } = await processBets(betInfo, sum);
    res.json({ slips, user });
  } catch (error) {
    console.error("Error processing bet:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.get("/api/user", (req, res) => {
  User.findOne({ user_id: req.query.user_id })
    .then((user) => res.json(user))
    .catch((err) => res.status(400).json(err));
});

router.get("/api/bet", (req, res) => {
  BetSlip.find({ userID: req.query.userId })
    .then((dbBetSlip) => res.json(dbBetSlip))
    .catch((err) => res.status(400).json(err));
});

router.post("/signup", (req, res) => {
  // console.log(req.body)
  const Users = new User({
    username: req.body.email,
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    email: req.body.email,
    address: req.body.address,
    city: req.body.city,
    state: req.body.state,
    zipcode: req.body.zipcode,
  });

  User.register(Users, req.body.password, function (err, user) {
    if (err) {
      res.json({ success: false, message: "creation unsuccessful", err });
    } else {
      // passport.authenticate('local')(req, res, function() {
      //   console.log('authenticated');
      // })
      // console.log(user)
      res.json({ success: true, message: "creation successful", user });
    }
  });
});

router.post("/login", (req, res) => {
  // console.log("inside /login");
  passport.authenticate("local", async (err, user, info) => {
    //  console.log(req.body)
    if (err) {
      res.json({ success: false, message: err });
    } else if (!user) {
      res.json({ success: false, message: "username or pass incorrect" });
    } else {
      const token = jwt.sign({ username: user.username }, "shhhh", {
        expiresIn: "1h",
      });
      // localStorage.setItem('user', JSON.stringify(user)); // define what is passed back
      await BetSlip.find({
        userID: user.user_id,
      })
        .then((dbBetSlip) => {
          // console.log(dbBetSlip);
          user["slips"] = dbBetSlip;
          // console.log(user.slips)
          // `user.slips` = dbBetSlip;
          // console.log('inside user');
          // console.log(user);
          res.json({
            success: true,
            message: "authentication successful",
            token,
            user,
            dbBetSlip,
          });
          // res.json(dbBetSlip);
        })
        .catch((err) => {
          res.status(400).json(err);
        });
      // res.json({success: true, message: "authentication successful", token, user});
    }
  })(req, res);
});

module.exports = router;
