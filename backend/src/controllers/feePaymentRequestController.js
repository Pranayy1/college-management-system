const db = require("../config/db");

const validateAmount = value => {
    const amount = Number(value);
    return Number.isFinite(amount) && Number.isInteger(amount) && amount > 0 && amount % 100 === 0
        ? amount
        : null;
};

const normalizeUtr = value => {
    const utr = String(value || "").trim();
    if (utr.length < 6 || utr.length > 100 || !/^[A-Za-z0-9]+$/.test(utr)) return null;
    return utr;
};

exports.createPaymentRequest = async (req, res) => {
    const feeAccountId = Number(req.body.fee_account_id);
    const amount = validateAmount(req.body.amount);
    const utr = normalizeUtr(req.body.utr);
    const studentEmail = String(req.user?.email || "").trim();

    if (!Number.isInteger(feeAccountId) || feeAccountId <= 0) {
        return res.status(400).json({ message: "A valid fee account is required" });
    }
    if (amount === null) {
        return res.status(400).json({ message: "Amount must be a positive whole number and a multiple of 100" });
    }
    if (!utr) return res.status(400).json({ message: "A valid UTR is required" });

    try {
        const accountResult = await db.query(
            `SELECT fa.fee_account_id, fa.student_id, fa.course_code, fa.semoryear, fa.total_amount
             FROM fee_accounts fa
             JOIN students s ON s.sr_no = fa.student_id
             WHERE fa.fee_account_id = $1
               AND s.emailid = $2`,
            [feeAccountId, studentEmail]
        );
        if (!accountResult.rowCount) {
            return res.status(404).json({ message: "Fee account not found" });
        }

        const account = accountResult.rows[0];
        const destinationResult = await db.query(
            `SELECT 1
             FROM fee_course_payment_methods
             WHERE course_code = $1`,
            [account.course_code]
        );
        if (!destinationResult.rowCount) {
            return res.status(409).json({ message: "Payment destination is not configured for this course" });
        }

        const requestResult = await db.query(
            `INSERT INTO fee_payment_requests (fee_account_id, student_id, amount, utr, status)
             VALUES ($1, $2, $3, $4, 'PENDING')
             RETURNING request_id, fee_account_id, student_id, amount, utr, status, submitted_at`,
            [account.fee_account_id, account.student_id, amount, utr]
        );

        res.status(201).json({
            message: "Payment request submitted successfully",
            payment_request: requestResult.rows[0]
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ message: "UTR has already been submitted" });
        }

        console.error(error);
        res.status(500).json({ message: "Failed to submit payment request" });
    }
};
