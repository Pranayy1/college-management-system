const crypto = require("crypto");
const { getSupabaseAdmin } = require("../config/supabase");

const FACULTY_IMAGE_BUCKET = "faculty-assets";
const STUDENT_IMAGE_BUCKET = "student-assets";

const IMAGE_TYPES = new Map([
    ["image/jpeg", ".jpg"],
    ["image/jpg", ".jpg"],
    ["image/png", ".png"],
    ["image/webp", ".webp"]
]);

const uploadProfileImage = async (bucket, ownerId, file) => {
    if (!file || !Buffer.isBuffer(file.buffer)) {
        const error = new Error("A buffered profile image is required");
        error.status = 400;
        throw error;
    }

    const extension = IMAGE_TYPES.get(file.mimetype);
    if (!extension) {
        const error = new Error("Only JPG, PNG, and WEBP images are allowed");
        error.status = 400;
        throw error;
    }

    const safeOwnerId = String(ownerId || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "-");

    if (!safeOwnerId) {
        const error = new Error("A valid profile image owner ID is required");
        error.status = 400;
        throw error;
    }

    const storagePath = `profiles/${safeOwnerId}/${crypto.randomUUID()}${extension}`;
    const { error } = await getSupabaseAdmin()
        .storage
        .from(bucket)
        .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });

    if (error) {
        console.error("Profile image upload error:", error);
        throw new Error("Failed to upload profile image", { cause: error });
    }

    return storagePath;
};

const getProfileImageUrl = (bucket, storagePath) => {
    if (
        typeof storagePath !== "string" ||
        !storagePath.startsWith("profiles/") ||
        storagePath.includes("..")
    ) {
        return null;
    }

    const { data } = getSupabaseAdmin()
        .storage
        .from(bucket)
        .getPublicUrl(storagePath);

    return data.publicUrl;
};

const removeProfileImage = async (bucket, storagePath) => {
    if (
        typeof storagePath !== "string" ||
        !storagePath.startsWith("profiles/") ||
        storagePath.includes("..")
    ) {
        return;
    }

    const { error } = await getSupabaseAdmin()
        .storage
        .from(bucket)
        .remove([storagePath]);

    if (error) {
        console.error("Profile image removal error:", error);
        throw new Error("Failed to remove profile image", { cause: error });
    }
};

module.exports = {
    FACULTY_IMAGE_BUCKET,
    STUDENT_IMAGE_BUCKET,
    uploadProfileImage,
    getProfileImageUrl,
    removeProfileImage
};
