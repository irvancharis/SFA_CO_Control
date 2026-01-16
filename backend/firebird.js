// firebird.js
const Firebird = require('node-firebird');

const options = {
  host: '192.168.3.61',
  port: 3051,
  database: 'c://sfa/sfabsa2026.fdb',
  user: 'SYSDBA',
  password: 'masterkey',
  role: null,
  pageSize: 4096
};

// Buat pool koneksi Firebird
const pool = Firebird.pool(5, options);

// Fungsi kosong untuk detach
const NOOP = () => {};

module.exports = { pool, Firebird, NOOP };
