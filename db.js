const { Pool } = require('pg');

const pool = new Pool({
  user: 'daschuepf', // dein macOS Benutzername
  host: 'localhost',
  database: 'themenplattform',
  password: '',      // leer lassen, wenn du kein Passwort gesetzt hast
  port: 5432,
});

module.exports = pool;