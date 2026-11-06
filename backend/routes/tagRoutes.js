const express = require("express");

const {
  createTag,
  getTags,
} = require("../controllers/tagController");

const authenticateToken = require("../middleware/authMiddleware");

const router = express.Router();


// ==========================================
// CREATE TAG
// ==========================================

router.post("/", authenticateToken, createTag);


// ==========================================
// GET ALL TAGS
// ==========================================

router.get("/", authenticateToken, getTags);


module.exports = router;
