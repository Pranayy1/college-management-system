const express = require("express");
const router = express.Router();
const assignController = require("../controllers/assignController");
const protect = require("../middleware/authMiddleware");
const roleAuth = require("../middleware/roleAuthMiddleware");

// Get faculties
router.get("/faculties", protect, roleAuth(["admin"]), assignController.getFaculties);

// Assign subject
router.put("/:facultyId", protect, roleAuth(["admin"]), assignController.assignSubject);
router.delete("/:facultyId", protect, roleAuth(["admin"]), assignController.unassignSubject);

module.exports = router;