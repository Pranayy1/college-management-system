const db = require("../config/db");
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
const ExcelJS = require("exceljs");
const {
  STUDENT_IMAGE_BUCKET,
  uploadProfileImage,
  getProfileImageUrl,
  removeProfileImage
} = require("../services/profileImageStorage");

// ============================
// Get Student Profile
// ============================

exports.getStudentProfile = async (req, res) => {
  try {
    const email = req.user.email;

    const result = await db.query(
        "SELECT * FROM students WHERE emailid = $1",
        [email]
    );

    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.json({
      ...rows[0],
      profilepic: getProfileImageUrl(STUDENT_IMAGE_BUCKET, rows[0].profilepic)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching profile" });
  }
};

// ============================
// Get Student Subjects
// ============================

exports.getStudentSubjects = async (req, res) => {
  try {
    const email = req.user.email;

    const studentResult = await db.query(
      "SELECT courcecode, semoryear FROM students WHERE emailid = $1",
        [email]
    );

    const student = studentResult.rows;

    if (student.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    const { courcecode, semoryear } = student[0];

    const subjectsResult = await db.query(
        "SELECT * FROM subject WHERE courcecode = $1 AND semoryear = $2",
        [courcecode, semoryear]
    );

    const subjects = subjectsResult.rows;

    res.json(subjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching subjects" });
  }
};

// ============================
// Update Student Profile
// ============================

exports.updateStudentProfile = async (req, res) => {
  try {
    const email = req.user.email;
    const { emailid, contactnumber, state, city } = req.body;

    const studentResult = await db.query(
      "SELECT rollnumber, profilepic FROM students WHERE emailid = $1",
      [email]
    );
    if (!studentResult.rows.length) {
      return res.status(404).json({ message: "Student not found" });
    }

    const current = studentResult.rows[0];
    const profilepic = req.file
      ? await uploadProfileImage(STUDENT_IMAGE_BUCKET, current.rollnumber, req.file)
      : current.profilepic;

    try {
      await db.query(
          `UPDATE students
         SET emailid = $1, contactnumber = $2, state = $3, city = $4,
             profilepic = $5
         WHERE emailid = $6`,
          [emailid, contactnumber, state, city, profilepic, email]
      );
    } catch (error) {
      if (req.file && current.profilepic !== profilepic) {
        try {
          await removeProfileImage(STUDENT_IMAGE_BUCKET, profilepic);
        } catch (cleanupError) {
          console.error("Student profile image cleanup after failed update also failed:", cleanupError);
        }
      }
      throw error;
    }

    if (req.file && current.profilepic !== profilepic) {
      await removeProfileImage(STUDENT_IMAGE_BUCKET, current.profilepic);
    }

    res.json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Update failed" });
  }
};

// ============================
// Admin: Get All Students
// ============================

exports.getAllStudents = async (req, res) => {
  try {
    const result = await db.query(
        `SELECT * FROM students ORDER BY sr_no DESC`
    );

    const rows = result.rows;

    const updatedStudents = rows.map((student) => ({
      ...student,
      profilepic: getProfileImageUrl(STUDENT_IMAGE_BUCKET, student.profilepic),
    }));

    res.json(updatedStudents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching students" });
  }
};

// ============================
// Admin: Create Student
// ============================

exports.createStudent = async (req, res) => {
  try {
    const {
      fullname,
      rollnumber,
      emailid,
      contactnumber,
      dateofbirth,
      gender,
      state,
      city,
      fathername,
      fatheroccupation,
      mothername,
      motheroccupation,
      Courcecode,
      semoryear,
      optionalsubject,
      admissiondate,
      password
    } = req.body;

    if (
        !fullname ||
        !rollnumber ||
        !emailid ||
        !contactnumber ||
        !dateofbirth ||
        !gender ||
        !Courcecode ||
        !semoryear
    ) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const nameParts = fullname.trim().split(" ");
    const firstname = nameParts[0];
    const lastname = nameParts.slice(1).join(" ") || "";

    // Check duplicate email
    const existingResult = await db.query(
        `SELECT * FROM students WHERE emailid = $1`,
        [emailid]
    );

    const existing = existingResult.rows;

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const finalPassword = password || dateofbirth;
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    const profilepic = req.file
      ? await uploadProfileImage(STUDENT_IMAGE_BUCKET, rollnumber, req.file)
      : null;

    try {
      await db.query(
        `INSERT INTO students
         (Courcecode, semoryear, rollnumber, optionalsubject, firstname, lastname, emailid,
          contactnumber, dateofbirth, gender, state, city,
          fathername, fatheroccupation, mothername, motheroccupation,
          profilepic, password, activestatus, admissiondate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                 $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          Courcecode,
          semoryear,
          rollnumber,
          optionalsubject || null,
          firstname,
          lastname,
          emailid,
          contactnumber,
          dateofbirth,
          gender,
          state,
          city,
          fathername || null,
          fatheroccupation || null,
          mothername || null,
          motheroccupation || null,
          profilepic,
          hashedPassword,
          0,
          admissiondate || null
        ]
      );
    } catch (error) {
      if (profilepic) {
        try {
          await removeProfileImage(STUDENT_IMAGE_BUCKET, profilepic);
        } catch (cleanupError) {
          console.error("Student profile image cleanup after failed creation also failed:", cleanupError);
        }
      }
      throw error;
    }

    res.json({ message: "Student created successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating student" });
  }
};

// ============================
// Admin: Update Student
// ============================

exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      fullname,
      rollnumber,
      emailid,
      contactnumber,
      dateofbirth,
      gender,
      state,
      city,
      fathername,
      fatheroccupation,
      mothername,
      motheroccupation,
      Courcecode,
      semoryear,
      optionalsubject,
      admissiondate,
      password,
      activestatus
    } = req.body;

    const existingResult = await db.query(
      "SELECT profilepic FROM students WHERE sr_no = $1",
      [id]
    );
    if (!existingResult.rows.length) {
      return res.status(404).json({ message: "Student not found" });
    }

    const currentProfilepic = existingResult.rows[0].profilepic;
    const newProfilepic = req.file
      ? await uploadProfileImage(STUDENT_IMAGE_BUCKET, rollnumber, req.file)
      : null;

    const nameParts = fullname.trim().split(" ");
    const firstname = nameParts[0];
    const lastname = nameParts.slice(1).join(" ") || "";

    let updateQuery = `
      UPDATE students SET
                        Courcecode = $1,
                        semoryear = $2,
                        rollnumber = $3,
                        optionalsubject = $4,
                        firstname = $5,
                        lastname = $6,
                        emailid = $7,
                        contactnumber = $8,
                        dateofbirth = $9,
                        gender = $10,
                        state = $11,
                        city = $12,
                        fathername = $13,
                        fatheroccupation = $14,
                        mothername = $15,
                        motheroccupation = $16,
                        admissiondate = $17,
                        activestatus = $18
    `;

    const values = [
      Courcecode,
      semoryear,
      rollnumber,
      optionalsubject || null,
      firstname,
      lastname,
      emailid,
      contactnumber,
      dateofbirth,
      gender,
      state,
      city,
      fathername || null,
      fatheroccupation || null,
      mothername || null,
      motheroccupation || null,
      admissiondate || null,
      activestatus
    ];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      values.push(hashedPassword);
      updateQuery += `, password = $${values.length}`;
    }

    if (req.file) {
      values.push(newProfilepic);
      updateQuery += `, profilepic = $${values.length}`;
    }

    values.push(id);
    updateQuery += ` WHERE sr_no = $${values.length}`;

    try {
      await db.query(updateQuery, values);
    } catch (error) {
      if (req.file && currentProfilepic !== newProfilepic) {
        try {
          await removeProfileImage(STUDENT_IMAGE_BUCKET, newProfilepic);
        } catch (cleanupError) {
          console.error("Student profile image cleanup after failed update also failed:", cleanupError);
        }
      }
      throw error;
    }

    if (req.file && currentProfilepic !== newProfilepic) {
      await removeProfileImage(STUDENT_IMAGE_BUCKET, currentProfilepic);
    }

    res.json({ message: "Student updated successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating student" });
  }
};

// ============================
// Admin: Delete Student
// ============================

exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
        "SELECT profilepic FROM students WHERE sr_no = $1",
        [id]
    );

    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    const profilepic = rows[0].profilepic;

    await db.query(
        "DELETE FROM students WHERE sr_no = $1",
        [id]
    );

    await removeProfileImage(STUDENT_IMAGE_BUCKET, profilepic);

    res.json({ message: "Student deleted successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting student" });
  }
};

// ============================
// Download Student Template
// ============================

exports.downloadStudentTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Students");

    const headers = [
      "fullname",
      "rollnumber",
      "emailid",
      "contactnumber",
      "dateofbirth",
      "gender",
      "state",
      "city",
      "fathername",
      "fatheroccupation",
      "mothername",
      "motheroccupation",
      "Courcecode",
      "semoryear",
      "optionalsubject",
      "admissiondate"
    ];

    sheet.addRow(headers);

    sheet.columns.forEach(col => {
      col.width = 22;
    });

    sheet.getRow(1).font = { bold: true };

    sheet.addRow([
      "Rahul Kumar",
      "23011001",
      "rahul@example.com",
      "9876543210",
      "2003-01-01",
      "Male",
      "Odisha",
      "Bhubaneswar",
      "",
      "",
      "",
      "",
      "BCA",
      1,
      "",
      ""
    ]);

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
        "Content-Disposition",
        "attachment; filename=Student_Import_Template.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error generating template" });
  }
};

// ============================
// Import Students From Excel
// ============================

exports.importStudentsFromExcel = async (req, res) => {

  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  let totalRows = 0;
  let inserted = 0;
  let duplicates = 0;
  let invalidRows = 0;

  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    totalRows = data.length;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      const {
        fullname,
        rollnumber,
        emailid,
        contactnumber,
        dateofbirth,
        gender,
        state,
        city,
        fathername,
        fatheroccupation,
        mothername,
        motheroccupation,
        Courcecode,
        semoryear,
        optionalsubject,
        admissiondate
      } = row;

      if (!fullname || !rollnumber || !emailid || !Courcecode || !semoryear) {
        invalidRows++;
        continue;
      }

      try {
        const nameParts = fullname.trim().split(" ");
        const firstname = nameParts[0];
        const lastname = nameParts.slice(1).join(" ") || "";

        const hashedPassword = await bcrypt.hash(dateofbirth, 10);

        await db.query(
            `INSERT INTO students
             (Courcecode, semoryear, rollnumber, optionalsubject, firstname, lastname, emailid,
              contactnumber, dateofbirth, gender, state, city,
              fathername, fatheroccupation, mothername, motheroccupation,
              password, activestatus, admissiondate)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                     $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
            [
              Courcecode,
              semoryear,
              rollnumber,
              optionalsubject || null,
              firstname,
              lastname,
              emailid,
              contactnumber,
              dateofbirth,
              gender,
              state,
              city,
              fathername || null,
              fatheroccupation || null,
              mothername || null,
              motheroccupation || null,
              hashedPassword,
              1,
              admissiondate || null
            ]
        );

        inserted++;

      } catch (error) {
        if (error.code === "23505") {
          duplicates++;
        } else {
          invalidRows++;
        }
      }
    }

    res.json({
      totalRows,
      inserted,
      duplicates,
      invalidRows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Import failed" });
  }
};