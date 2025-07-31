require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { pool, Firebird, NOOP } = require("./firebird"); // pastikan ini betul
const jwt = require("jsonwebtoken");
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = 3000;


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads')); // Folder 'uploads' di root project
  },
  filename: function (req, file, cb) {
    // Optional: Ganti nama file jika ingin
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });




app.use(bodyParser.json());

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


app.get("/DETAIL_FEATURE", (req, res) => {
  
  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    db.query("SELECT * FROM BSA_FEATUREDETAIL WHERE IS_ACTIVE = 1", (err, result) => {
      db.detach();
      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }
      res.json(result);
    });
  });
});


app.get("/SUBDETAIL_FEATURE", (req, res) => {
  
  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    db.query("SELECT * FROM BSA_FEATURESUBDETAIL WHERE IS_ACTIVE = 1", (err, result) => {
      db.detach();
      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }
      res.json(result);
    });
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


app.post("/SUBMIT_VISIT", async (req, res) => {
  const {
    id_visit,
    tanggal,
    idspv,
    idpelanggan,
    latitude,
    longitude,
    mulai,
    selesai,
    catatan,
    details,
    id_feature,
    id_sales, // field dari Flutter
    nocall,
  } = req.body;

  // Validasi data wajib
  if (
    !id_visit || !tanggal || !idspv || !idpelanggan ||
    !mulai || !selesai || !Array.isArray(details) || !id_sales || !nocall
  ) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  pool.get(async (err, db) => {
    if (err) {
      console.error("❌ Koneksi DB gagal:", err);
      return res.status(500).json({ error: "Koneksi database gagal" });
    }

    const insertVisit = `
      INSERT INTO SFA_VISIT 
        (ID_VISIT, TANGGAL, IDSPV, IDPELANGGAN, LATITUDE, LONGITUDE, MULAI, SELESAI, CATATAN, IDSALES, NOCALL)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertDetail = `
      INSERT INTO SFA_VISITDET 
        (ID_VISIT, ID_FEATURE, ID_FEATUREDETAIL, ID_FEATURESUBDETAIL, CHECKLIST)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, tx) => {
      if (err) {
        console.error("❌ Gagal mulai transaksi:", err);
        db.detach();
        return res.status(500).json({ error: "Transaksi gagal dimulai" });
      }

      try {
        // Insert visit utama (dengan id_sales & nocall)
        await queryAsync(tx, insertVisit, [
          id_visit,
          new Date(tanggal),
          idspv,
          idpelanggan,
          latitude,
          longitude,
          new Date(mulai),
          new Date(selesai),
          catatan,
          id_sales,
          nocall
        ]);

        // Insert detail checklist
        for (const detail of details) {
          const id_featuredetail = detail.id;
          const subDetails = detail.subDetails || [];

          for (const sub of subDetails) {
            const checklist = sub.isChecked ? 1 : 0;
            await queryAsync(tx, insertDetail, [
              id_visit,
              id_feature,
              id_featuredetail,
              sub.id,
              checklist,
            ]);
          }
        }

        tx.commit((commitErr) => {
          db.detach();
          if (commitErr) {
            console.error("❌ Commit gagal:", commitErr);
            return res.status(500).json({ error: "Gagal menyimpan ke database" });
          }
          return res.json({ success: true, message: "Checklist berhasil disimpan" });
        });
      } catch (e) {
        console.error("❌ Exception dalam transaksi:", e);
        tx.rollback(() => {
          db.detach();
          res.status(500).json({ error: "Gagal menyimpan checklist" });
        });
      }
    });
  });
});


// GET /JOINT_CALL_DETAIL
app.get("/JOINT_CALL_DETAIL/:nocall", (req, res) => {
  const authHeader = req.headers.authorization;
  const nocall = req.params.nocall; // Ambil dari URL

  if (!nocall) {
    return res.status(400).json({ error: "Parameter 'nocall' wajib diisi di URL." });
  }

  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Koneksi ke database gagal." });
    }

    const query = `
      SELECT 
  a.NOCALL, 
  a.NODETAIL, 
  a.IDPELANGGAN, 
  b.NAMAPELANGGAN, 
  b.ALAMAT, 
  b.KECAMATAN, 
  b.KOTAKABUPATEN, 
  b.LATITUDE, 
  b.LONGITUDE, 
  b.TIPE as TIPEPELANGGAN, 
  b.TOP as TIPEPEMBAYARAN
FROM BSA_CALLDETAIL a
INNER JOIN BSA_PELANGGAN b ON a.IDPELANGGAN = b.BARCODE
WHERE a.NODETAIL = (
  SELECT MIN(a2.NODETAIL)
  FROM BSA_CALLDETAIL a2
  WHERE a2.IDPELANGGAN = a.IDPELANGGAN
    AND a2.NOCALL = ?
)
AND a.NOCALL = ?
ORDER BY a.NODETAIL ASC

    `;

    db.query(query, [nocall, nocall], (err, result) => {
      db.detach(); // Penting: selalu detach setelah query

      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Gagal menjalankan query." });
      }

      res.json(result);
    });
  });
});

// GET /CONTROL_CALL_DETAIL
app.get("/CONTROL_CALL_DETAIL/:nocall", (req, res) => {
  const authHeader = req.headers.authorization;
  const nocall = req.params.nocall; // Ambil dari URL

  if (!nocall) {
    return res.status(400).json({ error: "Parameter 'nocall' wajib diisi di URL." });
  }

  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Koneksi ke database gagal." });
    }

    const query = `
      SELECT 
  a.NOCALL, 
  a.NODETAIL, 
  a.IDPELANGGAN, 
  b.ALAMAT, 
  b.KECAMATAN, 
  b.KOTAKABUPATEN, 
  a.LATITUDE, 
  a.LONGITUDE
FROM SFA_CALLDETAIL a
INNER JOIN SFA_PELANGGAN b ON a.IDPELANGGAN = b.ID
WHERE a.NODETAIL = (
  SELECT MIN(a2.NODETAIL)
  FROM SFA_CALLDETAIL a2
  WHERE a2.IDPELANGGAN = a.IDPELANGGAN
    AND a2.NOCALL = ?
)
AND a.NOCALL = ?
ORDER BY a.NODETAIL ASC;

    `;

    db.query(query, [nocall, nocall], (err, result) => {
      db.detach(); // Penting: selalu detach setelah query

      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Gagal menjalankan query." });
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
      "SELECT IDSALES,IDCABANG,SUSPEND,FLAG_KUNJUNGAN, NAMASALES, NAMAKARYAWAN as KODESALES ,IDSPV FROM BSA_KARYAWAN",
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

// Misal pakai express-fileupload atau multer
app.post('/upload-db', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ status: 'success', filename: req.file.originalname });
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

// Helper untuk promisify query Firebird
function queryAsync(tx, sql, params) {
  return new Promise((resolve, reject) => {
    tx.query(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Mulai server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
