const db = require("../config/db");
const { recordVerifiedPayment } = require("../services/feeAccountingService");

const REQUEST_STATUSES = new Set(["PENDING", "VERIFIED", "REJECTED", "ALL"]);

const controllerError = (message, status, code = "PAYMENT_REQUEST_ERROR") => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
};

const formatPaymentRequest = request => ({
    request_id: request.request_id,
    fee_account_id: request.fee_account_id,
    student_id: request.student_id,
    student_name: [request.firstname, request.lastname].filter(Boolean).join(" ").trim(),
    rollnumber: request.rollnumber,
    course_code: request.course_code,
    semoryear: request.semoryear,
    amount: request.amount,
    utr: request.utr,
    status: request.status,
    submitted_at: request.submitted_at,
    verified_at: request.verified_at,
    rejected_at: request.rejected_at,
    rejection_reason: request.rejection_reason_text || request.rejection_reason_code || null,
    verified_by: request.verified_by ? "Admin" : null,
    rejected_by: request.rejected_by ? "Admin" : null
});

const getRequestId = value => {
    const requestId = Number(value);
    return Number.isInteger(requestId) && requestId > 0 ? requestId : null;
};

const rollback = async (client, transactionStarted) => {
    if (client && transactionStarted) await client.query("ROLLBACK");
};

exports.listPaymentRequests = async (req, res) => {
    const status = String(req.query.status || "PENDING").trim().toUpperCase();
    const search = String(req.query.search || "").trim();
    const course = String(req.query.course || "").trim().toUpperCase();
    const semoryear = req.query.semoryear === undefined ? null : Number(req.query.semoryear);

    if (!REQUEST_STATUSES.has(status)) {
        return res.status(400).json({ message: "Invalid payment request status" });
    }
    if (req.query.semoryear !== undefined && (!Number.isInteger(semoryear) || semoryear < 1)) {
        return res.status(400).json({ message: "Invalid semester/year" });
    }

    const conditions = [];
    const values = [];
    const addCondition = (condition, value) => {
        values.push(value);
        conditions.push(condition.replace("$VALUE", `$${values.length}`));
    };

    if (status !== "ALL") addCondition("fpr.status = $VALUE", status);
    if (search) {
        addCondition(
            `(CONCAT_WS(' ', s.firstname, s.lastname) ILIKE $VALUE
              OR s.rollnumber::text ILIKE $VALUE
              OR fpr.utr ILIKE $VALUE)`,
            `%${search}%`
        );
    }
    if (course) addCondition("fa.course_code = $VALUE", course);
    if (semoryear !== null) addCondition("fa.semoryear = $VALUE", semoryear);

    try {
        const result = await db.query(
            `SELECT fpr.request_id, fpr.fee_account_id, fpr.student_id,
                    s.firstname, s.lastname, s.rollnumber,
                    fa.course_code, fa.semoryear, fpr.amount, fpr.utr,
                    fpr.status, fpr.submitted_at, fpr.verified_at, fpr.rejected_at,
                    fpr.verified_by, fpr.rejected_by,
                    fpr.rejection_reason_code, fpr.rejection_reason_text
             FROM fee_payment_requests fpr
             JOIN fee_accounts fa ON fa.fee_account_id = fpr.fee_account_id
             JOIN students s ON s.sr_no = fpr.student_id
             ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
             ORDER BY CASE WHEN fpr.status = 'PENDING' THEN 0 ELSE 1 END,
                      fpr.submitted_at ASC, fpr.request_id ASC`,
            values
        );
        res.json(result.rows.map(formatPaymentRequest));
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load payment requests" });
    }
};

exports.getPaymentRequest = async (req, res) => {
    const requestId = getRequestId(req.params.requestId);
    if (!requestId) return res.status(400).json({ message: "Invalid payment request ID" });

    try {
        const result = await db.query(
            `SELECT fpr.request_id, fpr.fee_account_id, fpr.student_id,
                    s.firstname, s.lastname, s.rollnumber,
                    fa.course_code, fa.semoryear, fa.total_amount,
                    fpr.amount, fpr.utr, fpr.status, fpr.submitted_at,
                    fpr.verified_at, fpr.rejected_at, fpr.verified_by, fpr.rejected_by,
                    fpr.rejection_reason_code, fpr.rejection_reason_text,
                    COALESCE((
                        SELECT SUM(fp.fee_applied_amount)
                        FROM fee_payments fp
                        WHERE fp.fee_account_id = fa.fee_account_id
                    ), 0)::numeric(12, 2) AS current_paid_amount
             FROM fee_payment_requests fpr
             JOIN fee_accounts fa ON fa.fee_account_id = fpr.fee_account_id
             JOIN students s ON s.sr_no = fpr.student_id
             WHERE fpr.request_id = $1`,
            [requestId]
        );
        if (!result.rowCount) return res.status(404).json({ message: "Payment request not found" });

        const request = result.rows[0];
        res.json({
            payment_request: formatPaymentRequest(request),
            fee_account: {
                fee_account_id: request.fee_account_id,
                total_amount: request.total_amount,
                current_paid_amount: request.current_paid_amount
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Failed to load payment request" });
    }
};

const loadLockedRequest = async (client, requestId) => {
    const requestResult = await client.query(
        `SELECT request_id, fee_account_id, student_id, amount, utr, status,
                submitted_at, verified_at, verified_by, rejected_at, rejected_by,
                rejection_reason_code, rejection_reason_text
         FROM fee_payment_requests
         WHERE request_id = $1
         FOR UPDATE`,
        [requestId]
    );
    if (!requestResult.rowCount) {
        throw controllerError("Payment request not found", 404, "PAYMENT_REQUEST_NOT_FOUND");
    }

    const request = requestResult.rows[0];
    if (request.status !== "PENDING") {
        throw controllerError(`Payment request is already ${request.status.toLowerCase()}`, 409, "INVALID_PAYMENT_REQUEST_STATE");
    }

    const accountResult = await client.query(
        `SELECT fee_account_id, student_id, course_code, semoryear, total_amount
         FROM fee_accounts
         WHERE fee_account_id = $1`,
        [request.fee_account_id]
    );
    if (!accountResult.rowCount || Number(accountResult.rows[0].student_id) !== Number(request.student_id)) {
        throw controllerError("Payment request account data is inconsistent", 409, "INCONSISTENT_PAYMENT_REQUEST");
    }

    return { request, account: accountResult.rows[0] };
};

exports.verifyPaymentRequest = async (req, res) => {
    const requestId = getRequestId(req.params.requestId);
    if (!requestId) return res.status(400).json({ message: "Invalid payment request ID" });

    let client;
    let transactionStarted = false;
    try {
        client = await db.connect();
        await client.query("BEGIN");
        transactionStarted = true;
        const { request } = await loadLockedRequest(client, requestId);

        const verifiedResult = await client.query(
            `UPDATE fee_payment_requests
             SET status = 'VERIFIED',
                 verified_at = CURRENT_TIMESTAMP,
                 verified_by = $2,
                 rejected_at = NULL,
                 rejected_by = NULL,
                 rejection_reason_code = NULL,
                 rejection_reason_text = NULL
             WHERE request_id = $1
             RETURNING request_id, fee_account_id, student_id, amount, utr, status,
                       submitted_at, verified_at, verified_by, rejected_at, rejected_by,
                       rejection_reason_code, rejection_reason_text`,
            [requestId, req.user.email]
        );

        const accountingResult = await recordVerifiedPayment(client, {
            feeAccountId: request.fee_account_id,
            amount: request.amount,
            source: "UPI_REQUEST",
            paymentRequestId: request.request_id,
            paidAt: request.submitted_at,
            recordedBy: req.user.email,
            note: "Verified student UPI payment request"
        });

        await client.query("COMMIT");
        transactionStarted = false;
        const verifiedRequest = verifiedResult.rows[0];
        res.json({
            message: "Payment verified successfully",
            payment_request: formatPaymentRequest(verifiedRequest),
            payment: accountingResult.payment
        });
    } catch (error) {
        await rollback(client, transactionStarted);
        console.error(error);
        res.status(error.status || 500).json({
            message: error.status ? error.message : "Failed to verify payment request"
        });
    } finally {
        if (client) client.release();
    }
};

exports.rejectPaymentRequest = async (req, res) => {
    const requestId = getRequestId(req.params.requestId);
    const reason = String(req.body.reason || "").trim();
    if (!requestId) return res.status(400).json({ message: "Invalid payment request ID" });
    if (!reason || reason.length > 500) {
        return res.status(400).json({ message: "A rejection reason between 1 and 500 characters is required" });
    }

    let client;
    let transactionStarted = false;
    try {
        client = await db.connect();
        await client.query("BEGIN");
        transactionStarted = true;
        await loadLockedRequest(client, requestId);

        const rejectedResult = await client.query(
            `UPDATE fee_payment_requests
             SET status = 'REJECTED',
                 rejected_at = CURRENT_TIMESTAMP,
                 rejected_by = $2,
                 verified_at = NULL,
                 verified_by = NULL,
                 rejection_reason_code = NULL,
                 rejection_reason_text = $3
             WHERE request_id = $1
             RETURNING request_id, fee_account_id, student_id, amount, utr, status,
                       submitted_at, verified_at, verified_by, rejected_at, rejected_by,
                       rejection_reason_code, rejection_reason_text`,
            [requestId, req.user.email, reason]
        );

        await client.query("COMMIT");
        transactionStarted = false;
        res.json({
            message: "Payment request rejected",
            payment_request: formatPaymentRequest(rejectedResult.rows[0])
        });
    } catch (error) {
        await rollback(client, transactionStarted);
        console.error(error);
        res.status(error.status || 500).json({
            message: error.status ? error.message : "Failed to reject payment request"
        });
    } finally {
        if (client) client.release();
    }
};