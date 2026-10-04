const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middleware/authMiddleware");
const adminController = require("../controllers/adminController");

/* Multer Setup */

const storage = multer.memoryStorage();

const upload = multer({
    storage,

    limits: {
        fileSize: 1024 * 1024 // 1MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/png", "image/jpeg"];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Only PNG, JPG, JPEG allowed"));
        }

        cb(null, true);
    }
});

/* Routes */

router.get("/logo", adminController.getAdminLogo);

router.get(
    "/profile",
    authMiddleware,
    adminController.getAdminProfile
);

router.put(
    "/profile",
    authMiddleware,
    upload.single("logo"),
    adminController.updateAdminProfile
);

module.exports = router;