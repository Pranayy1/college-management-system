const db = require("../config/db");
const { recordVerifiedPayment } = require("../services/feeAccountingService");

exports.assignFees = async (req, res) => {
    const { course_code: courseCode, semoryear, amount, mode = "class", student_id: studentId } = req.body;
    const term = Number(semoryear);
    const feeAmount = Number(amount);
    const adjustmentReason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";

    if (!courseCode || !Number.isInteger(term) || term < 1 || !Number.isFinite(feeAmount) || feeAmount < 0) {
        return res.status(400).json({ message: "Course, semester/year, and a valid amount are required" });
    }
    if (!["class", "individual"].includes(mode)) return res.status(400).json({ message: "Invalid assignment mode" });
    if (mode === "individual" && !Number.isInteger(Number(studentId))) {
        return res.status(400).json({ message: "A student is required for individual assignment" });
    }

    let client;
    let transactionStarted = false;
    try {
        client = await db.connect();
        await client.query("BEGIN");
        transactionStarted = true;
        const students = mode === "class"
            ? await client.query("SELECT sr_no FROM students WHERE courcecode = $1 AND semoryear = $2", [courseCode, term])
            : await client.query("SELECT sr_no FROM students WHERE sr_no = $1 AND courcecode = $2 AND semoryear = $3", [Number(studentId), courseCode, term]);

        if (!students.rowCount) {
            await client.query("ROLLBACK");
            transactionStarted = false;
            return res.status(404).json({ message: "No matching student found" });
        }

        for (const student of students.rows) {
            const accountResult = await client.query(
                `SELECT fee_account_id, total_amount
                 FROM fee_accounts
                 WHERE student_id = $1
                   AND course_code = $2
                   AND semoryear = $3
                 FOR UPDATE`,
                [student.sr_no, courseCode, term]
            );

            if (!accountResult.rowCount) {
                await client.query(
                    `INSERT INTO fee_accounts (student_id, course_code, semoryear, total_amount)
                     VALUES ($1, $2, $3, $4)`,
                    [student.sr_no, courseCode, term, feeAmount]
                );
                continue;
            }

            const account = accountResult.rows[0];
            const currentTotal = Number(account.total_amount);
            if (feeAmount === currentTotal) continue;

            if (!adjustmentReason || adjustmentReason.length > 255) {
                const error = new Error("A reason between 1 and 255 characters is required for fee adjustments");
                error.status = 400;
                throw error;
            }

            const appliedResult = await client.query(
                `SELECT COALESCE(SUM(fee_applied_amount), 0) AS applied_amount
                 FROM fee_payments
                 WHERE fee_account_id = $1`,
                [account.fee_account_id]
            );
            const appliedAmount = Number(appliedResult.rows[0].applied_amount);

            if (feeAmount < appliedAmount) {
                const error = new Error("New fee cannot be lower than the amount already paid/applied");
                error.status = 409;
                throw error;
            }

            await client.query(
                `UPDATE fee_accounts
                 SET total_amount = $1
                 WHERE fee_account_id = $2`,
                [feeAmount, account.fee_account_id]
            );
            await client.query(
                `INSERT INTO fee_adjustments (
                    fee_account_id,
                    previous_total,
                    new_total,
                    reason,
                    adjusted_by
                 )
                 VALUES ($1, $2, $3, $4, $5)`,
                [account.fee_account_id, currentTotal, feeAmount, adjustmentReason, req.user.email]
            );
        }
        await client.query("COMMIT");
        transactionStarted = false;
        res.json({ message: "Fees assigned successfully", updated_students: students.rowCount });
    } catch (error) {
        if (client && transactionStarted) await client.query("ROLLBACK");
        console.error(error);
        res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to assign fees" });
    } finally {
        if (client) client.release();
    }
};

exports.getClassFees = async (req, res) => {
    const { course, sem } = req.query;
    if (!course || !sem) return res.status(400).json({ message: "Course and semester/year are required" });
    try {
        const result = await db.query(
            `SELECT fa.fee_account_id, s.sr_no AS student_id, s.rollnumber, s.firstname, s.lastname,
                    fa.course_code, fa.semoryear, fa.total_amount,
                                        (COALESCE(SUM(fp.fee_applied_amount), 0) + COALESCE((
                                                SELECT SUM(fcl.amount)
                                                FROM fee_credit_ledger fcl
                                                WHERE fcl.fee_account_id = fa.fee_account_id
                                                    AND fcl.entry_type = 'CREDIT_APPLIED'
                                        ), 0))::numeric(12, 2) AS paid_amount,
                                        GREATEST(fa.total_amount - COALESCE(SUM(fp.fee_applied_amount), 0) - COALESCE((
                                                SELECT SUM(fcl.amount)
                                                FROM fee_credit_ledger fcl
                                                WHERE fcl.fee_account_id = fa.fee_account_id
                                                    AND fcl.entry_type = 'CREDIT_APPLIED'
                                        ), 0), 0)::numeric(12, 2) AS remaining_amount,
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
                                        (COALESCE(SUM(fp.fee_applied_amount), 0) + COALESCE((
                                                SELECT SUM(fcl.amount)
                                                FROM fee_credit_ledger fcl
                                                WHERE fcl.fee_account_id = fa.fee_account_id
                                                    AND fcl.entry_type = 'CREDIT_APPLIED'
                                        ), 0))::numeric(12, 2) AS paid_amount,
                                        GREATEST(fa.total_amount - COALESCE(SUM(fp.fee_applied_amount), 0) - COALESCE((
                                                SELECT SUM(fcl.amount)
                                                FROM fee_credit_ledger fcl
                                                WHERE fcl.fee_account_id = fa.fee_account_id
                                                    AND fcl.entry_type = 'CREDIT_APPLIED'
                                        ), 0), 0)::numeric(12, 2) AS remaining_amount
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
    let client;
    let transactionStarted = false;
    try {
        client = await db.connect();
        await client.query("BEGIN");
        transactionStarted = true;

        const result = await recordVerifiedPayment(client, {
            feeAccountId: Number(accountId),
            amount: paymentAmount,
            source: "MANUAL",
            paidAt,
            recordedBy: req.user.email,
            note: note || null
        });

        await client.query("COMMIT");
        transactionStarted = false;
        res.status(201).json({
            ...result.payment,
            fee_applied_amount: result.payment.fee_applied_amount,
            credit_amount: result.payment.credit_amount,
            remaining_amount: result.remainingAmount,
            credit: result.credit
        });
    } catch (error) {
        if (client && transactionStarted) await client.query("ROLLBACK");
        console.error(error);
        res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to record payment" });
    } finally {
        if (client) client.release();
    }
};
