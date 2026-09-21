const createServiceError = (message, status = 400, code = "FEE_ACCOUNTING_ERROR") => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
};

const recordVerifiedPayment = async (client, {
    feeAccountId,
    amount,
    source,
    paymentRequestId = null,
    paidAt = null,
    recordedBy = null,
    note = null
}) => {
    if (!client || typeof client.query !== "function") {
        throw createServiceError("A transaction client is required", 500, "INVALID_TRANSACTION_CLIENT");
    }

    const accountId = Number(feeAccountId);
    const requestId = paymentRequestId === null || paymentRequestId === undefined
        ? null
        : Number(paymentRequestId);

    if (!Number.isInteger(accountId) || accountId <= 0) {
        throw createServiceError("A valid fee account is required");
    }
    if (!['MANUAL', 'UPI_REQUEST'].includes(source)) {
        throw createServiceError("Invalid payment source");
    }
    if (source === "UPI_REQUEST" && (!Number.isInteger(requestId) || requestId <= 0)) {
        throw createServiceError("A payment request is required for UPI payments");
    }
    if (source === "MANUAL" && requestId !== null) {
        throw createServiceError("Manual payments cannot reference a payment request");
    }

    const accountResult = await client.query(
        `SELECT fee_account_id, student_id, total_amount
         FROM fee_accounts
         WHERE fee_account_id = $1
         FOR UPDATE`,
        [accountId]
    );
    if (!accountResult.rowCount) {
        throw createServiceError("Fee account not found", 404, "FEE_ACCOUNT_NOT_FOUND");
    }

    const account = accountResult.rows[0];
    let paymentAmount;
    let paymentRequest = null;
    if (source === "UPI_REQUEST") {
        const requestResult = await client.query(
            `SELECT request_id, fee_account_id, student_id, amount, status
             FROM fee_payment_requests
             WHERE request_id = $1
             FOR UPDATE`,
            [requestId]
        );
        if (!requestResult.rowCount) {
            throw createServiceError("Payment request not found", 404, "PAYMENT_REQUEST_NOT_FOUND");
        }
        paymentRequest = requestResult.rows[0];
        if (paymentRequest.fee_account_id !== account.fee_account_id) {
            throw createServiceError("Payment request does not belong to this fee account");
        }
        if (paymentRequest.status !== "VERIFIED") {
            throw createServiceError("Only verified payment requests can create payments");
        }
        paymentAmount = Number(paymentRequest.amount);
    } else {
        paymentAmount = Number(amount);
    }
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        throw createServiceError("A positive payment amount is required");
    }

    const appliedResult = await client.query(
        `SELECT COALESCE(SUM(fee_applied_amount), 0) AS applied_amount
         FROM fee_payments
         WHERE fee_account_id = $1`,
        [accountId]
    );

    const totalAmount = Number(account.total_amount);
    const currentApplied = Number(appliedResult.rows[0].applied_amount);
    const remainingBefore = Math.max(totalAmount - currentApplied, 0);
    const feeAppliedAmount = Math.min(paymentAmount, remainingBefore);
    const creditAmount = paymentAmount - feeAppliedAmount;

    if (source === "UPI_REQUEST") {
        const existingPayment = await client.query(
            `SELECT payment_id
             FROM fee_payments
             WHERE payment_request_id = $1
             FOR UPDATE`,
            [requestId]
        );
        if (existingPayment.rowCount) {
            throw createServiceError("Payment request has already been recorded", 409, "PAYMENT_REQUEST_ALREADY_RECORDED");
        }
    }

    let paymentResult;
    try {
        paymentResult = await client.query(
            `INSERT INTO fee_payments (
                fee_account_id,
                amount,
                paid_at,
                recorded_by,
                note,
                source,
                payment_request_id,
                fee_applied_amount,
                credit_amount
             )
             VALUES ($1, $2, COALESCE($3::timestamp, CURRENT_TIMESTAMP), $4, $5, $6, $7, $8, $9)
             RETURNING payment_id, fee_account_id, amount, paid_at, recorded_by, note,
                       source, payment_request_id, fee_applied_amount, credit_amount`,
            [
                accountId,
                paymentAmount,
                paidAt || null,
                recordedBy,
                note,
                source,
                requestId,
                feeAppliedAmount,
                creditAmount
            ]
        );
    } catch (error) {
        if (error.code === "23505" && source === "UPI_REQUEST") {
            throw createServiceError("Payment request has already been recorded", 409, "PAYMENT_REQUEST_ALREADY_RECORDED");
        }
        throw error;
    }

    const payment = paymentResult.rows[0];
    let credit = null;
    if (creditAmount > 0) {
        const creditResult = await client.query(
            `INSERT INTO fee_credit_ledger (
                student_id,
                entry_type,
                amount,
                fee_payment_id,
                fee_account_id,
                reason
             )
             VALUES ($1, 'CREDIT_CREATED', $2, $3, $4, $5)
             RETURNING ledger_id, student_id, entry_type, amount, fee_payment_id,
                       fee_account_id, reason, created_at`,
            [
                account.student_id,
                creditAmount,
                payment.payment_id,
                account.fee_account_id,
                "Verified payment overpayment"
            ]
        );
        credit = creditResult.rows[0];
    }

    return {
        payment,
        credit,
        feeAppliedAmount,
        creditAmount,
        remainingAmount: Math.max(remainingBefore - feeAppliedAmount, 0)
    };
};

module.exports = { recordVerifiedPayment };