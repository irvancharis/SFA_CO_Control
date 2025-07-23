require('dotenv').config();
const express = require('express');
const pool = require('./firebird');
const jwt     = require('jsonwebtoken');

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper: buat JWT
function createToken(payload) {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });
  }
  

// POST /login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  pool.get((err, db) => {
    if (err) {
      console.error('Firebird connection error:', err);
      return res.status(500).json({ error: 'Database connection gagal' });
    }

    const sql = `
      SELECT ID_KARYAWAN, NAMA_KARYAWAN, TELEPON
      FROM KARYAWAN
      WHERE ID_KARYAWAN = ? AND TELEPON = ?
    `;

    db.query(sql, [username, password], (err, result) => {
      db.detach();
      if (err) {
        console.error('Query error:', err);
        return res.status(500).json({ error: 'Query gagal' });
      }

      if (result.length === 0) {
        // gagal autentikasi
        return res.status(401).json({ error: 'Username atau password salah' });
      }

      // berhasil: buat token
      const user = result[0];
      const token = createToken({
        id: user.ID_KARYAWAN,
        name: user.NAMA
      });

      res.json({
        token,
        user: {
          id: user.ID_KARYAWAN,
          name: user.NAMA
        }
      });
    });
  });
});

// Contoh GET /users (butuh token di header Authorization: Bearer <token>)
app.get('/users', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }
  const token = authHeader.split(' ')[1];
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch (_) {
    return res.status(401).json({ error: 'Token tidak valid' });
  }

  pool.get((err, db) => {
    if (err) {
      console.error('Firebird connection error:', err);
      return res.status(500).json({ error: 'Database connection gagal' });
    }

    db.query("SELECT * FROM KARYAWAN", (err, result) => {
      db.detach();
      if (err) {
        console.error('Query error:', err);
        return res.status(500).json({ error: 'Query gagal' });
      }
      res.json(result);
    });
  });
});

// Mulai server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
