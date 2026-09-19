const db = require("../config/db");

/*
Assign Controller
-----------------

Handles:

* Get faculties by course + semester
* Assign subject to faculty
  */

// ============================
// Get Faculties By Course + Semester
// ============================
exports.getFaculties = async (req, res) => {
    const { course_code, sem } = req.query;

    if (!course_code || !sem) {
        return res.status(400).json({
            message: "Course and semester are required"
        });
    }

    try {
        const result = await db.query(
            `SELECT
                 f.sr_no,
                 COALESCE(f.facultyname, f.emailid) AS facultyname,
                 f.emailid,
                 a.subjectcode AS assignment_subjectcode,
                 s.subjectname,
                 a.courcecode AS assignment_courcecode,
                 a.semoryear AS assignment_semoryear
             FROM faculties f
                      LEFT JOIN faculty_subject_assignments a
                        ON a.faculty_sr_no = f.sr_no
                       AND a.courcecode = $1
                       AND a.semoryear = $2
                      LEFT JOIN subject s ON a.subjectcode = s.subjectcode
             ORDER BY f.sr_no ASC`
            , [course_code, sem]
        );


    res.json(result.rows);

} catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching faculties" });
}


    };

// ============================
// Assign Subject To Faculty
// ============================
exports.assignSubject = async (req, res) => {
        const { facultyId } = req.params;
        const { subjectcode, courcecode, semoryear } = req.body;


if (
    !subjectcode ||
    !courcecode ||
    semoryear === undefined
) {
    return res.status(400).json({
        message: "Subject and semester are required"
    });
}

try {
    const facultyResult = await db.query(
        "SELECT sr_no FROM faculties WHERE sr_no = $1",
        [facultyId]
    );

    if (facultyResult.rowCount === 0) {
        return res.status(404).json({
            message: "Faculty not found"
        });
    }

    await db.query(
        `INSERT INTO faculty_subject_assignments
            (faculty_sr_no, subjectcode, courcecode, semoryear)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (faculty_sr_no, subjectcode, courcecode, semoryear)
         DO NOTHING`,
        [facultyId, subjectcode, courcecode, semoryear]
    );

    // Keep the legacy columns populated for older admin/profile views.
    await db.query(
        `UPDATE faculties
         SET subject = $1, courcecode = $2, semoryear = $3
         WHERE sr_no = $4`,
        [subjectcode, courcecode, semoryear, facultyId]
    );

    res.json({ message: "Subject assigned successfully" });

} catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating subject" });
}

};

// ============================
// Unassign One Subject From Faculty
// ============================
exports.unassignSubject = async (req, res) => {
    const { facultyId } = req.params;
    const { subjectcode, courcecode, semoryear } = req.body;

    if (!subjectcode || !courcecode || semoryear === undefined) {
        return res.status(400).json({
            message: "Subject, course and semester are required"
        });
    }

    try {
        const result = await db.query(
            `DELETE FROM faculty_subject_assignments
             WHERE faculty_sr_no = $1
               AND subjectcode = $2
               AND courcecode = $3
               AND semoryear = $4`,
            [facultyId, subjectcode, courcecode, semoryear]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: "Assignment not found"
            });
        }

        const remaining = await db.query(
            `SELECT subjectcode, courcecode, semoryear
             FROM faculty_subject_assignments
             WHERE faculty_sr_no = $1
             ORDER BY assigned_at DESC, assignment_id DESC
             LIMIT 1`,
            [facultyId]
        );

        const assignment = remaining.rows[0] || {
            subjectcode: "NOT ASSIGNED",
            courcecode: "NOT ASSIGNED",
            semoryear: 0
        };

        await db.query(
            `UPDATE faculties
             SET subject = $1, courcecode = $2, semoryear = $3
             WHERE sr_no = $4`,
            [assignment.subjectcode, assignment.courcecode, assignment.semoryear, facultyId]
        );

        res.json({ message: "Subject unassigned successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error unassigning subject" });
    }
};
