// firebird.js
const Firebird = require('node-firebird');

const options = {
  host:     '192.168.3.252',
  port:     3051,
  database: 'c://sfa/sfabsa3w2025.fdb',
  user:     'SYSDBA',
  password: 'masterkey',
  role:     null,
  pageSize: 4096
};

// Buat pool dengan maksimal 5 koneksi
const pool = Firebird.pool(5, options);

module.exports = pool;
