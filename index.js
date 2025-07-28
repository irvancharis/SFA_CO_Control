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
    return res.status(400).json({ error: "Username dan password wajib diisi" }); 
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

app.get("/FEATURE", (req, res) => {
  
  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    db.query("SELECT * FROM BSA_FEATURE WHERE IS_ACTIVE = 1", (err, result) => {
      db.detach();
      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }
      res.json(result);
    });
  });
});


app.get("/DETAIL_FEATURE/:id", (req, res) => {  
  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    db.query(
      "SELECT * FROM BSA_FEATUREDETAIL WHERE IS_ACTIVE = 1 AND ID_FEATURE = ?",
      [req.params.id],
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

app.get("/DETAIL_WITH_SUB/:id", (req, res) => {
  const featureId = req.params.id;

  if (!featureId) {
    return res.status(400).json({ error: "ID fitur tidak boleh kosong" });
  }

  pool.get((err, db) => {
    if (err) {
      console.error("❌ Gagal koneksi Firebird:", err);
      return res.status(500).json({ error: "Koneksi database gagal" });
    }

    console.log(`🚀 Mulai ambil DETAIL untuk featureId: ${featureId}`);

    const cleanRow = (row) => {
      const obj = {};
      for (const key in row) {
        const val = row[key];
        if (typeof val === "function") continue;
        if (val === null || typeof val === "string" || typeof val === "number" || val instanceof Date) {
          obj[key] = val;
        } else {
          obj[key] = String(val); // Fallback for Buffer or object
        }
      }
      return obj;
    };

    db.query(
      "SELECT * FROM BSA_FEATUREDETAIL WHERE IS_ACTIVE = 1 AND ID_FEATURE = ?",
      [featureId],
      async (err, detailResults) => {
        if (err) {
          db.detach();
          console.error("❌ Query DETAIL gagal:", err);
          return res.status(500).json({ error: "Query DETAIL gagal" });
        }

        if (!detailResults || detailResults.length === 0) {
          db.detach();
          console.log("🔍 Tidak ada DETAIL ditemukan");
          return res.json([]);
        }

        console.log(`✅ Ditemukan ${detailResults.length} detail`);

        const detailWithSubs = [];

        for (const rawDetail of detailResults) {
          const detail = cleanRow(rawDetail);
          const detailId = detail.ID_FEATUREDETAIL;

          console.log(`🔄 Ambil SUBDETAIL untuk ID_DETAIL: ${detailId}`);

          try {
            const subResults = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                console.warn(`⚠️ Timeout SUBDETAIL untuk ID: ${detailId}`);
                resolve([]); // return empty array on timeout
              }, 5000); // 5 detik timeout per subdetail

              db.query(
                "SELECT * FROM BSA_FEATURESUBDETAIL WHERE ID_FEATUREDETAIL = ?",
                [detailId],
                (err, results) => {
                  clearTimeout(timeout);
                  if (err) {
                    console.error(`❌ Query SUBDETAIL gagal (ID ${detailId}):`, err);
                    resolve([]); // continue with empty result
                  } else {
                    resolve(results || []);
                  }
                }
              );
            });

            detail.SUBDETAIL = subResults.map(cleanRow);
          } catch (err) {
            console.error(`❌ Gagal mengambil SUBDETAIL untuk ID: ${detailId}`, err);
            detail.SUBDETAIL = [];
          }

          detailWithSubs.push(detail);
        }

        db.detach();
        console.log("📦 Semua data lengkap, kirim ke client");
        return res.json(detailWithSubs);
      }
    );
  });
});



app.post('/SUBMIT_CHECKLIST', express.json(), (req, res) => {
  const data = req.body.checklist;

  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: "Checklist kosong" });
  }

  // Simulasi simpan ke database
  console.log("✅ Checklist diterima:");
  data.forEach(item => {
    console.log(`- ${item.id}: ${item.nama}`);
    // Simpan ke DB jika perlu
  });

  return res.json({ success: true });
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
