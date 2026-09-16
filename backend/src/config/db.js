const { Pool } = require("pg");

const ssl = process.env.DB_SSL === "true" || Boolean(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false;

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 10,
        ssl
    })
    : new Pool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 5432,
        max: 10,
        ssl
    });

module.exports = pool;
