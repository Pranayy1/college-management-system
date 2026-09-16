-- Run this in Supabase SQL Editor after the schema has been imported.
-- Change the email and password values before running.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO admin (
    collagename,
    address,
    emailid,
    contactnumber,
    website,
    password,
    activestatus
)
VALUES (
    'Vindhya Institute of Technology and Science, Satna',
    'Satna, Madhya Pradesh',
    'admin@vits.ac.in',
    '0000000000',
    'http://localhost',
    crypt('adminhere!', gen_salt('bf', 10)),
    1
)
ON CONFLICT (emailid) DO UPDATE
SET password = EXCLUDED.password,
    activestatus = 1;

-- Verify the account exists without exposing its password:
SELECT emailid, activestatus, password LIKE '$2%' AS is_bcrypt
FROM admin
WHERE emailid = 'admin@vits.ac.in';