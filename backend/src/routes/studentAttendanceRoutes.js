const express = require("express");
const router = express.Router();

const { getStudentAttendance } = require("../controllers/studentAttendanceController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/attendance", verifyToken, getStudentAttendance);

module.exports = router;
