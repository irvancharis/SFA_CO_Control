// firebird.js
const Firebird = require('node-firebird');

const options = {
  host:     '127.0.0.1',
  port:     3051,
  database: 'C:\\superapps.FDB',  // path langsung ke drive C
  user:     'SYSDBA',
  password: 'masterkey',
  role:     null,
  pageSize: 4096
};

// Buat pool dengan maksimal 5 koneksi
const pool = Firebird.pool(5, options);

module.exports = pool;
