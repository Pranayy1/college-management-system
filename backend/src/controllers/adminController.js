const db = require("../config/db");
const bcrypt = require("bcrypt");
const { getSupabaseAdmin } = require("../config/supabase");

/*
  Get Admin Profile
*/
exports.getAdminProfile = async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM admin LIMIT 1");

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Admin not found"
            });
        }

        const admin = rows[0];

        const supabase = getSupabaseAdmin();

        const { data } = supabase.storage
            .from("admin-assets")
            .getPublicUrl("admin/logo");

        admin.logo = `${data.publicUrl}?v=${Date.now()}`;

        res.json(admin);

    } catch (error) {
        console.error("Get admin profile error:", error);

        res.status(500).json({
            message: "Error fetching admin"
        });
    }
};


/*
  Update Admin Profile
*/

exports.updateAdminProfile = async (req, res) => {
    try {
        const {
            collagename,
            address,
            emailid,
            contactnumber,
            website,
            facebook,
            instagram,
            twitter,
            linkedin,
            password
        } = req.body;

        let hashedPassword = null;

        if (password) {
            hashedPassword = await bcrypt.hash(password, 10);
        }

        if (req.file) {
            const allowedTypes = ["image/png", "image/jpeg"];

            if (!allowedTypes.includes(req.file.mimetype)) {
                return res.status(400).json({
                    message: "Only PNG, JPG, JPEG allowed"
                });
            }

            const supabase = getSupabaseAdmin();

            const { error } = await supabase.storage
                .from("admin-assets")
                .upload("admin/logo", req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: true,
                    cacheControl: "3600"
                });

            if (error) {
                console.error("Supabase logo upload error:", error);

                return res.status(500).json({
                    message: "Failed to upload admin logo"
                });
            }
        }

        await db.query(
            `
            UPDATE admin
            SET collagename = $1,
                address = $2,
                emailid = $3,
                contactnumber = $4,
                website = $5,
                facebook = $6,
                instagram = $7,
                twitter = $8,
                linkedin = $9,
                password = COALESCE($10, password)
            `,
            [
                collagename,
                address,
                emailid,
                contactnumber,
                website,
                facebook,
                instagram,
                twitter,
                linkedin,
                hashedPassword
            ]
        );

        res.json({
            message: "Admin updated successfully"
        });

    } catch (error) {
        console.error("Update admin profile error:", error);

        res.status(500).json({
            message: "Update failed"
        });
    }
};