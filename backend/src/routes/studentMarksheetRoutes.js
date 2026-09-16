const express = require("express");
const router = express.Router();

const { getStudentMarks } = require("../controllers/studentMarksheetController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/marks", verifyToken, getStudentMarks);

module.exports = router;
