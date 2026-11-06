const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/protected", authenticateToken, (req, res) => {
  res.json({
    message: "You have access to this protected route",
    user: req.user,
  });
});

module.exports = router;