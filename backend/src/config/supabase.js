const { createClient } = require("@supabase/supabase-js");

let supabaseAdmin;

const getSupabaseAdmin = () => {
    if (supabaseAdmin) return supabaseAdmin;

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        const error = new Error("Supabase Storage is not configured");
        error.code = "SUPABASE_STORAGE_NOT_CONFIGURED";
        error.status = 500;
        throw error;
    }

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    return supabaseAdmin;
};

module.exports = { getSupabaseAdmin };