const express = require("express");
const router = express.Router();
const feeController = require("../controllers/feeController");
const authMiddleware = require("../middleware/authMiddleware");
const roleAuth = require("../middleware/roleAuthMiddleware");

router.post("/assign", authMiddleware, roleAuth(["admin"]), feeController.assignFees);
router.post("/payments", authMiddleware, roleAuth(["admin"]), feeController.recordPayment);
router.get("/report", authMiddleware, roleAuth(["admin", "faculty"]), feeController.getClassFees);
router.get("/student", authMiddleware, roleAuth(["student"]), feeController.getStudentFees);

module.exports = router;
