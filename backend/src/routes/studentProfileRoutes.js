const express = require("express");
const router = express.Router();

const { updateStudentProfile } = require("../controllers/studentProfileController");
const verifyToken = require("../middleware/authMiddleware");

router.put("/profile", verifyToken, updateStudentProfile);

module.exports = router;
