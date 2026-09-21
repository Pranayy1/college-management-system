const crypto = require("crypto");
const path = require("path");
const { getSupabaseAdmin } = require("../config/supabase");

const FEE_PAYMENT_QR_BUCKET = "fee-payment-qr";
const MAX_QR_FILE_SIZE = 5 * 1024 * 1024;
const QR_MIME_TYPES = new Map([
    ["image/png", ".png"],
    ["image/jpeg", ".jpg"],
    ["image/webp", ".webp"]
]);

const createStorageError = (message, cause) => {
    const error = new Error(message);
    error.code = "FEE_PAYMENT_QR_STORAGE_ERROR";
    error.status = 500;
    error.cause = cause;
    return error;
};

const sanitizePathComponent = (value) => {
    const sanitized = String(value || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-");

    if (!sanitized) {
        const error = new Error("A valid course code is required");
        error.status = 400;
        throw error;
    }

    return sanitized;
};

const validateQrFile = (file) => {
    if (!file || !Buffer.isBuffer(file.buffer)) {
        const error = new Error("A buffered QR image file is required");
        error.status = 400;
        throw error;
    }
    if (!QR_MIME_TYPES.has(file.mimetype)) {
        const error = new Error("Only PNG, JPEG, and WebP QR images are allowed");
        error.status = 400;
        throw error;
    }
    if (file.size > MAX_QR_FILE_SIZE || file.buffer.length > MAX_QR_FILE_SIZE) {
        const error = new Error("QR image must be 5 MB or smaller");
        error.status = 400;
        throw error;
    }
};

const uploadQrImage = async (courseCode, file) => {
    validateQrFile(file);

    const safeCourseCode = sanitizePathComponent(courseCode);
    const extension = QR_MIME_TYPES.get(file.mimetype);
    const storagePath = `${safeCourseCode}/${crypto.randomUUID()}${extension}`;

    try {
        const { error } = await getSupabaseAdmin()
            .storage
            .from(FEE_PAYMENT_QR_BUCKET)
            .upload(storagePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) throw error;
        return storagePath;
    } catch (error) {
        if (error.code === "FEE_PAYMENT_QR_STORAGE_ERROR") throw error;
        throw createStorageError("Failed to upload QR image", error);
    }
};

const removeQrImage = async (storagePath) => {
    if (!storagePath || typeof storagePath !== "string") return;

    try {
        const { error } = await getSupabaseAdmin()
            .storage
            .from(FEE_PAYMENT_QR_BUCKET)
            .remove([storagePath]);

        if (error) throw error;
    } catch (error) {
        if (error.code === "FEE_PAYMENT_QR_STORAGE_ERROR") throw error;
        throw createStorageError("Failed to remove QR image", error);
    }
};

const createQrSignedUrl = async (storagePath, expiresInSeconds = 3600) => {
    if (!storagePath || typeof storagePath !== "string") {
        const error = new Error("A QR storage path is required");
        error.status = 400;
        throw error;
    }

    const expiresIn = Number(expiresInSeconds);
    if (!Number.isInteger(expiresIn) || expiresIn < 1 || expiresIn > 86400) {
        const error = new Error("QR signed URL expiry must be between 1 and 86400 seconds");
        error.status = 400;
        throw error;
    }

    try {
        const { data, error } = await getSupabaseAdmin()
            .storage
            .from(FEE_PAYMENT_QR_BUCKET)
            .createSignedUrl(storagePath, expiresIn);

        if (error) throw error;
        return data.signedUrl;
    } catch (error) {
        if (error.code === "FEE_PAYMENT_QR_STORAGE_ERROR") throw error;
        throw createStorageError("Failed to create QR signed URL", error);
    }
};

module.exports = {
    FEE_PAYMENT_QR_BUCKET,
    MAX_QR_FILE_SIZE,
    uploadQrImage,
    removeQrImage,
    createQrSignedUrl
};