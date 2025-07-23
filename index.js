// index.js
const express = require('express');
const pool = require('./firebird');

const app = express();
const PORT = 3000;

app.use(express.json());

// Contoh GET /users
app.get('/users', (req, res) => {
  pool.get((err, db) => {
    if (err) {
      console.error('Firebird connection error:', err);
      return res.status(500).json({ error: 'Database connection failed' });
    }

    db.query("SELECT * FROM KARYAWAN", (err, result) => {
      db.detach();

      if (err) {
        console.error('Query error:', err);
        return res.status(500).json({ error: 'Query failed' });
      }

      res.json(result);
    });
  });
});

// Mulai server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
