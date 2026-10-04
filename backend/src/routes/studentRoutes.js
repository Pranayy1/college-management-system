const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const authMiddleware = require("../middleware/authMiddleware");
const studentController = require("../controllers/studentController");

const studentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG and PNG images are allowed"));
    }
    cb(null, true);
  }
});

/* Student Routes */

// View Profile
router.get("/profile", authMiddleware, studentController.getStudentProfile);

// Update Profile
router.put(
  "/profile",
  authMiddleware,
  studentUpload.single("profilepic"),
  studentController.updateStudentProfile
  );

// View Subjects
router.get("/subjects", authMiddleware, studentController.getStudentSubjects);


// Admin Routes

router.get("/", authMiddleware, studentController.getAllStudents);

router.post(
    "/",
    authMiddleware,
    studentUpload.single("profilepic"),
    studentController.createStudent
);

router.put(
    "/:id",
    authMiddleware,
    studentUpload.single("profilepic"),
    studentController.updateStudent
);

router.delete(
    "/:id",
    authMiddleware,
    studentController.deleteStudent
);
/* ============================================
   Excel Upload Configuration
   ============================================ */

const excelUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".xlsx" && ext !== ".xls") {
      return cb(new Error("Only Excel files allowed"));
    }
    cb(null, true);
  }
});

// Download Student Template
router.get(
    "/template",
    authMiddleware,
    studentController.downloadStudentTemplate
);

// Import Students From Excel
router.post(
    "/import",
    authMiddleware,
    excelUpload.single("file"),
    studentController.importStudentsFromExcel
);


module.exports = router;
