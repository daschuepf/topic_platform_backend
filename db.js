const { Pool } = require('pg');
require('dotenv').config(); // damit .env gelesen wird

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = pool;