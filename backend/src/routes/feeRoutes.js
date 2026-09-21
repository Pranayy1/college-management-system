const express = require("express");
const multer = require("multer");
const router = express.Router();
const feeController = require("../controllers/feeController");
const feePaymentMethodController = require("../controllers/feePaymentMethodController");
const authMiddleware = require("../middleware/authMiddleware");
const roleAuth = require("../middleware/roleAuthMiddleware");

const qrUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 }
});

const handleQrUpload = (req, res, next) => {
	qrUpload.single("qr_image")(req, res, error => {
		if (error) return res.status(400).json({ message: error.message });
		next();
	});
};

router.post("/assign", authMiddleware, roleAuth(["admin"]), feeController.assignFees);
router.post("/payments", authMiddleware, roleAuth(["admin"]), feeController.recordPayment);
router.post(
	"/payment-method",
	authMiddleware,
	roleAuth(["admin"]),
	handleQrUpload,
	feePaymentMethodController.savePaymentMethod
);
router.get(
	"/payment-method",
	authMiddleware,
	roleAuth(["student"]),
	feePaymentMethodController.getPaymentMethod
);
router.get("/report", authMiddleware, roleAuth(["admin", "faculty"]), feeController.getClassFees);
router.get("/student", authMiddleware, roleAuth(["student"]), feeController.getStudentFees);

module.exports = router;
