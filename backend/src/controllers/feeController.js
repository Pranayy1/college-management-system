const db = require("../config/db");

exports.assignFees = async (req, res) => {
    const { course_code: courseCode, semoryear, amount, mode = "class", student_id: studentId } = req.body;
    const term = Number(semoryear);
    const feeAmount = Number(amount);

    if (!courseCode || !Number.isInteger(term) || term < 1 || !Number.isFinite(feeAmount) || feeAmount < 0) {
        return res.status(400).json({ message: "Course, semester/year, and a valid amount are required" });
    }
    if (!["class", "individual"].includes(mode)) return res.status(400).json({ message: "Invalid assignment mode" });
    if (mode === "individual" && !Number.isInteger(Number(studentId))) {
        return res.status(400).json({ message: "A student is required for individual assignment" });
    }

    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const students = mode === "class"
            ? await client.query("SELECT sr_no FROM students WHERE courcecode = $1 AND semoryear = $2", [courseCode, term])
            : await client.query("SELECT sr_no FROM students WHERE sr_no = $1 AND courcecode = $2 AND semoryear = $3", [Number(studentId), courseCode, term]);

        if (!students.rowCount) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "No matching student found" });
        }

        for (const student of students.rows) {
            await client.query(
                `INSERT INTO fee_accounts (student_id, course_code, semoryear, total_amount)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (student_id, course_code, semoryear)
                 DO UPDATE SET total_amount = EXCLUDED.total_amount`,
                [student.sr_no, courseCode, term, feeAmount]
            );
        }
        await client.query("COMMIT");
        res.json({ message: "Fees assigned successfully", updated_students: students.rowCount });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error(error);
        res.status(500).json({ message: "Failed to assign fees" });
    } finally {
        client.release();
    }
};

exports.getClassFees = async (req, res) => {
    const { course, sem } = req.query;
    if (!course || !sem) return res.status(400).json({ message: "Course and semester/year are required" });
    try {
        const result = await db.query(
            `SELECT fa.fee_account_id, s.sr_no AS student_id, s.rollnumber, s.firstname, s.lastname,
                    fa.course_code, fa.semoryear, fa.total_amount,
                    COALESCE(SUM(fp.amount), 0)::numeric(12, 2) AS paid_amount,
                    (fa.total_amount - COALESCE(SUM(fp.amount), 0))::numeric(12, 2) AS remaining_amount,
                    MAX(fp.paid_at) AS last_paid_at
             FROM fee_accounts fa
             JOIN students s ON s.sr_no = fa.student_id
             LEFT JOIN fee_payments fp ON fp.fee_account_id = fa.fee_account_id
             WHERE fa.course_code = $1 AND fa.semoryear = $2
             GROUP BY fa.fee_account_id, s.sr_no, fa.course_code, fa.semoryear
             ORDER BY s.rollnumber`,
            [course, Number(sem)]
        );
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load fee report" });
    }
};

exports.getStudentFees = async (req, res) => {
    try {
        const accounts = await db.query(
            `SELECT fa.fee_account_id, fa.course_code, fa.semoryear, fa.total_amount,
                    COALESCE(SUM(fp.amount), 0)::numeric(12, 2) AS paid_amount,
                    (fa.total_amount - COALESCE(SUM(fp.amount), 0))::numeric(12, 2) AS remaining_amount
             FROM fee_accounts fa
             JOIN students s ON s.sr_no = fa.student_id
             LEFT JOIN fee_payments fp ON fp.fee_account_id = fa.fee_account_id
             WHERE s.emailid = $1
             GROUP BY fa.fee_account_id
             ORDER BY fa.course_code, fa.semoryear`,
            [req.user.email]
        );
        const payments = await db.query(
            `SELECT fp.payment_id, fp.fee_account_id, fp.amount, fp.paid_at, fp.note,
                    fa.course_code, fa.semoryear
             FROM fee_payments fp
             JOIN fee_accounts fa ON fa.fee_account_id = fp.fee_account_id
             JOIN students s ON s.sr_no = fa.student_id
             WHERE s.emailid = $1
             ORDER BY fp.paid_at DESC, fp.payment_id DESC`,
            [req.user.email]
        );
        res.json({ accounts: accounts.rows, payments: payments.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load student fees" });
    }
};

exports.recordPayment = async (req, res) => {
    const { fee_account_id: accountId, amount, paid_at: paidAt, note } = req.body;
    const paymentAmount = Number(amount);
    if (!Number.isInteger(Number(accountId)) || !Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ message: "Fee account and a positive payment amount are required" });
    }
    try {
        const account = await db.query("SELECT fee_account_id, total_amount FROM fee_accounts WHERE fee_account_id = $1", [Number(accountId)]);
        if (!account.rowCount) return res.status(404).json({ message: "Fee account not found" });
        const paid = await db.query("SELECT COALESCE(SUM(amount), 0) AS paid FROM fee_payments WHERE fee_account_id = $1", [Number(accountId)]);
        if (paymentAmount > Number(account.rows[0].total_amount) - Number(paid.rows[0].paid)) return res.status(400).json({ message: "Payment cannot exceed remaining fees" });
        const result = await db.query(
            `INSERT INTO fee_payments (fee_account_id, amount, paid_at, recorded_by, note)
             VALUES ($1, $2, COALESCE($3::timestamp, CURRENT_TIMESTAMP), $4, $5)
             RETURNING payment_id, fee_account_id, amount, paid_at, note`,
            [Number(accountId), paymentAmount, paidAt || null, req.user.email, note || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to record payment" });
    }
};
