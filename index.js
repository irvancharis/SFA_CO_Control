require("dotenv").config();
const express = require("express");
const pool = require("./firebird");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper: buat JWT
function createToken(payload) {
  if (!process.env.JWT_SECRET) {
    console.error("⚠️ JWT_SECRET is missing!");
    process.exit(1);
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  });
}

// POST /login
app.post("/login", (req, res) => {
  console.log(">> Login payload:", req.body);
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username dan password wajib diisi" }); //asek asek jos
  }

  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    const sql = `
        SELECT USERNAME, PASSWORD_SFA, FLAGSALES
        FROM VIEW_SFA_LOGIN
        WHERE USERNAME = ? AND PASSWORD_SFA = ?
      `;

    db.query(sql, [username, password], (err, result) => {
      console.log(">> DB result for", username, ":", result);
      db.detach();
      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }

      if (result.length === 0) {
        return res.status(401).json({ error: "Username atau password salah" });
      }

      const user = result[0];
      const token = createToken({
        id: user.USERNAME,
        name: user.USERNAME,
      });

      return res.status(200).json({
        token,
        user: {
          id: user.USERNAME,
          name: user.USERNAME,
        },
      });
    });
  });
});

//MASTER_VISIT_JOIN
app.get("/VISIT_JOIN", (req, res) => {
  
  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    db.query("SELECT * FROM BSA_VISITCOMPONENT WHERE JENIS_KUNJUNGAN = 0", (err, result) => {
      db.detach();
      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }
      res.json(result);
    });
  });
});


//MASTER_VISIT_CONTROL
app.get("/VISIT_CONTROL", (req, res) => {
  
    pool.get((err, db) => {
      if (err) {
        console.error("Firebird connection error:", err);
        return res.status(500).json({ error: "Database connection gagal" });
      }
  
      db.query("SELECT * FROM BSA_VISITCOMPONENT WHERE JENIS_KUNJUNGAN = 1", (err, result) => {
        db.detach();
        if (err) {
          console.error("Query error:", err);
          return res.status(500).json({ error: "Query gagal" });
        }
        res.json(result);
      });
    });
  });

//MASTER_DATASALES
app.get("/DATASALES", (req, res) => {
  
  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    db.query(
      "SELECT IDSALES,IDCABANG,SUSPEND,FLAG_KUNJUNGAN, NAMASALES,IDSPV FROM BSA_KARYAWAN",
      (err, result) => {
        db.detach();
        if (err) {
          console.error("Query error:", err);
          return res.status(500).json({ error: "Query gagal" });
        }
        res.json(result);
      }
    );
  });
});

//SEARCHING DATA MASTER KUNJUNGAN UNTUK JOINT_CALL
app.get("/JOINTCALL", (req, res) => {
  
  const { KODECABANG, IDSALES, TANGGAL } = req.body;

  if (!KODECABANG || !IDSALES || !TANGGAL) {
    return res
      .status(400)
      .json({ error: "KODECABANG, IDSALES, dan TANGGAL wajib diisi" });
  }

  const NOCALL = `W${KODECABANG}_${IDSALES}_${TANGGAL}`;

  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    const sql = `SELECT * FROM VIEW_GET_BSA_CALLDETAIL WHERE NOCALL = ? ORDER BY NODETAIL ASC;`;

    db.query(sql, [NOCALL], (err, result) => {
      db.detach();
      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }
      res.json(result);
    });
  });
});

//SEARCHING DATA MASTER KUNJUNGAN UNTUK JOINT_CALL
app.get("/CONTROLCALL", (req, res) => {

  // Ambil parameter dari query string
  const { KODECABANG, IDSALES, TANGGAL } = req.body;

  if (!KODECABANG || !IDSALES || !TANGGAL) {
    return res
      .status(400)
      .json({ error: "KODECABANG, IDSALES, dan TANGGAL wajib diisi" });
  }

  const NOCALL = `W${KODECABANG}_${IDSALES}_${TANGGAL}`;

  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    const sql = `SELECT * FROM VIEW_GET_SFA_CALLDETAIL WHERE NOCALL = ? ORDER BY NODETAIL ASC;`;

    db.query(sql, [NOCALL], (err, result) => {
      db.detach();
      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }
      res.json(result);
    });
  });
});

// Contoh GET /users (butuh token di header Authorization: Bearer <token>)
app.get("/users", (req, res) => {
  const authHeader = req.headers.authorization;

  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    db.query("SELECT * FROM KARYAWAN", (err, result) => {
      db.detach();
      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }
      res.json(result);
    });
  });
});

// Mulai server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
