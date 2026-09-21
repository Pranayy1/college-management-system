const db = require("../config/db");
const {
    getStudentCreditBalance,
    applyStudentCredit
} = require("../services/feeAccountingService");

const resolveStudentId = async email => {
    const result = await db.query(
        "SELECT sr_no FROM students WHERE emailid = $1",
        [email]
    );
    return result.rows[0]?.sr_no || null;
};

exports.getCreditBalance = async (req, res) => {
    try {
        const studentId = await resolveStudentId(req.user.email);
        if (!studentId) return res.status(404).json({ message: "Student not found" });

        const availableCredit = await getStudentCreditBalance(db, studentId);
        res.json({ available_credit: availableCredit });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load credit balance" });
    }
};

exports.applyCredit = async (req, res) => {
    const feeAccountId = Number(req.body.fee_account_id);
    const amount = Number(req.body.amount);
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";

    if (!Number.isInteger(feeAccountId) || feeAccountId <= 0) {
        return res.status(400).json({ message: "A valid fee account is required" });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({ message: "Credit amount must be a positive whole number" });
    }
    if (!reason || reason.length > 255) {
        return res.status(400).json({ message: "A reason between 1 and 255 characters is required" });
    }

    let client;
    let transactionStarted = false;
    try {
        const studentId = await resolveStudentId(req.user.email);
        if (!studentId) return res.status(404).json({ message: "Student not found" });

        client = await db.connect();
        await client.query("BEGIN");
        transactionStarted = true;

        const result = await applyStudentCredit(client, {
            studentId,
            feeAccountId,
            amount,
            reason
        });

        await client.query("COMMIT");
        transactionStarted = false;
        res.json({
            message: "Fee credit applied successfully",
            applied_amount: result.appliedAmount,
            remaining_amount: result.remainingAmount,
            available_credit: result.availableCredit
        });
    } catch (error) {
        if (client && transactionStarted) await client.query("ROLLBACK");
        console.error(error);
        res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to apply fee credit" });
    } finally {
        if (client) client.release();
    }
};