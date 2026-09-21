const db = require("../config/db");
const {
    uploadQrImage,
    removeQrImage,
    createQrSignedUrl
} = require("../services/feePaymentQrStorage");

const normalizeCourseCode = (value) => String(value || "").trim().toUpperCase();

const validateUpiId = (value) => {
    const upiId = String(value || "").trim();
    if (!upiId || upiId.length > 255 || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,254}@[A-Za-z0-9.-]+$/.test(upiId)) {
        return null;
    }
    return upiId;
};

exports.savePaymentMethod = async (req, res) => {
    const courseCode = normalizeCourseCode(req.body.course_code);
    const upiId = validateUpiId(req.body.upi_id);

    if (!courseCode) return res.status(400).json({ message: "Course code is required" });
    if (!upiId) return res.status(400).json({ message: "A valid UPI ID is required" });
    if (!req.file) return res.status(400).json({ message: "A QR image is required" });

    let uploadedPath;
    let oldQrStoragePath;
    try {
        const courseResult = await db.query(
            "SELECT course_code FROM courses WHERE course_code = $1",
            [courseCode]
        );
        if (!courseResult.rowCount) {
            return res.status(404).json({ message: "Course not found" });
        }

        const existingResult = await db.query(
            `SELECT qr_storage_path
             FROM fee_course_payment_methods
             WHERE course_code = $1`,
            [courseCode]
        );
        oldQrStoragePath = existingResult.rows[0]?.qr_storage_path;

        uploadedPath = await uploadQrImage(courseCode, req.file);

        let methodResult;
        try {
            methodResult = await db.query(
                `INSERT INTO fee_course_payment_methods (course_code, upi_id, qr_storage_path)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (course_code)
                 DO UPDATE SET
                    upi_id = EXCLUDED.upi_id,
                    qr_storage_path = EXCLUDED.qr_storage_path
                 RETURNING course_code, upi_id, qr_storage_path, updated_at`,
                [courseCode, upiId, uploadedPath]
            );
        } catch (error) {
            try {
                await removeQrImage(uploadedPath);
            } catch (cleanupError) {
                console.error("Failed to clean up QR after database failure", cleanupError);
            }
            uploadedPath = undefined;
            throw error;
        }

        if (oldQrStoragePath && oldQrStoragePath !== uploadedPath) {
            try {
                await removeQrImage(oldQrStoragePath);
            } catch (cleanupError) {
                console.error("Failed to remove replaced QR image", cleanupError);
            }
        }

        res.json({
            message: "Payment destination saved successfully",
            payment_method: methodResult.rows[0]
        });
    } catch (error) {
        if (uploadedPath && error.code !== "FEE_PAYMENT_QR_STORAGE_ERROR") {
            try {
                await removeQrImage(uploadedPath);
            } catch (cleanupError) {
                console.error("Failed to clean up QR after payment destination failure", cleanupError);
            }
        }
        console.error(error);
        res.status(error.status || 500).json({
            message: error.status ? error.message : "Failed to save payment destination"
        });
    }
};

exports.getPaymentMethod = async (req, res) => {
    const courseCode = normalizeCourseCode(req.query.course);
    if (!courseCode) return res.status(400).json({ message: "Course code is required" });

    try {
        const courseResult = await db.query(
            "SELECT course_code FROM courses WHERE course_code = $1",
            [courseCode]
        );
        if (!courseResult.rowCount) return res.status(404).json({ message: "Course not found" });

        const methodResult = await db.query(
            `SELECT course_code, upi_id, qr_storage_path
             FROM fee_course_payment_methods
             WHERE course_code = $1`,
            [courseCode]
        );
        if (!methodResult.rowCount) {
            return res.status(404).json({ message: "Payment destination is not configured for this course" });
        }

        const method = methodResult.rows[0];
        const qrUrl = await createQrSignedUrl(method.qr_storage_path, 3600);
        res.json({
            course_code: method.course_code,
            upi_id: method.upi_id,
            qr_url: qrUrl
        });
    } catch (error) {
        console.error(error);
        res.status(error.status || 500).json({
            message: error.status ? error.message : "Failed to load payment destination"
        });
    }
};
