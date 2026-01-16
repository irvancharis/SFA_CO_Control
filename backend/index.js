require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { pool, Firebird, NOOP } = require("./firebird"); // pastikan ini betul
const sqliteDb = require("./sqlite_db");
const jwt = require("jsonwebtoken");
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Import fs module for directory creation

const app = express();
const PORT = 3333;

// --- Buat folder upload jika belum ada ---
const dbUploadDir = path.join(__dirname, 'uploads', 'databases');
const photoUploadDir = path.join(__dirname, 'uploads', 'photos');
const apkUploadDir = path.join(__dirname, 'public', 'uploads', 'apks'); // In public for direct access

// Pastikan folder ada
fs.mkdirSync(dbUploadDir, { recursive: true });
fs.mkdirSync(photoUploadDir, { recursive: true });
fs.mkdirSync(apkUploadDir, { recursive: true });

// --- Konfigurasi Multer untuk Database Uploads ---
const dbStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, dbUploadDir); // Folder 'uploads/databases'
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const uploadDb = multer({ storage: dbStorage });

// --- Konfigurasi Multer untuk Photo Uploads ---
const photoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, photoUploadDir); // Folder 'uploads/photos'
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // max 10MB
  fileFilter: (req, file, cb) => {
    const allowedExt = [".jpg", ".jpeg", ".png"];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    if (!allowedExt.includes(ext)) {
      return cb(new Error("Hanya file JPG, JPEG, PNG yang diperbolehkan"));
    }
    cb(null, true);
  }
});

// --- Konfigurasi Multer untuk APK Uploads ---
const apkStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, apkUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
    cb(null, `update_${Date.now()}_${safeName}`);
  }
});

const uploadApk = multer({ 
  storage: apkStorage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.apk') {
      return cb(new Error('Hanya file .apk yang diperbolehkan'));
    }
    cb(null, true);
  }
});


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(express.static(path.join(__dirname, 'public')));

// Helper: queryAsync for simple queries
const queryAsyncSimple = (db, sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, result) => {
            if (err) reject(err);
            else resolve(result);
        });
    });
};


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
        SELECT USERNAME, IDSPV, PASSWORD_SFA, FLAGSALES
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
        id: user.IDSPV,
        name: user.USERNAME,
      });

      return res.status(200).json({
        token,
        user: {
          id: user.IDSPV,
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
  b.NAMAPELANGGAN,
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

// ================= SELLING HIST DETAIL=================
app.get("/DETAILHISTORYSELLING/:idSales/:tanggal/:idPelanggan", (req, res) => {
  const { idSales, tanggal, idPelanggan } = req.params;

  // 🔎 Convert tanggal dari ISO ke format YYYY-MM-DD
  let tglFormatted;
  try {
    tglFormatted = new Date(tanggal).toISOString().slice(0, 10);
  } catch (e) {
    console.error("Format tanggal tidak valid:", tanggal);
    return res.status(400).json({ error: "Format tanggal tidak valid" });
  }

  // Debug log parameter
  console.log("DETAILHISTORYSELLING Params diterima:", { idSales, tanggal, tglFormatted, idPelanggan });

  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    const sql = `
      SELECT a.TANGGAL, a.IDSALES, a.NOTRANSAKSI, a.IDPELANGGAN,
            x.NAMAPELANGGAN, x.ALAMAT,
            b.HARGA, b.IDITEMPRODUK, b.QTY, b.UNIT,
            b.QTYCASHBACK, b.JUMLAHCASHBACK, b.QTYPROMO, b.JUMLAHPROMO,
            'PENJUALAN' AS SOURCE
      FROM SFA_PENJUALAN a
      INNER JOIN SFA_PENJUALANDETAIL b ON a.NOTRANSAKSI=b.NOTRANSAKSI
      INNER JOIN SFA_PELANGGAN x ON a.IDPELANGGAN=x.ID
      WHERE a.IDSALES=? AND a.TANGGAL=? AND a.IDPELANGGAN=?

      UNION ALL

      SELECT a.TANGGAL, a.IDSALES, a.NOTRANSAKSI, a.IDPELANGGAN,
            x.NAMAPELANGGAN, x.ALAMAT,
            b.HARGA, b.IDITEMPRODUK, b.QTY, b.UNIT,
            b.QTYCASHBACK, b.JUMLAHCASHBACK, b.QTYPROMO, b.JUMLAHPROMO,
            'PROMOVENDOR' AS SOURCE
      FROM SFA_PROMOVENDOR a
      INNER JOIN SFA_PROMOVENDORDETAIL b ON a.NOTRANSAKSI=b.NOTRANSAKSI
      INNER JOIN SFA_PELANGGAN x ON a.IDPELANGGAN=x.ID
      WHERE a.IDSALES=? AND a.TANGGAL=? AND a.IDPELANGGAN=?

      UNION ALL

      SELECT a.TANGGAL, a.IDSALES, a.NOTRANSAKSI, a.IDPELANGGAN,
            x.NAMAPELANGGAN, x.ALAMAT,
            b.HARGA, b.IDITEMPRODUK, b.QTY, b.UNIT,
            b.QTYCASHBACK, b.JUMLAHCASHBACK, b.QTYPROMO, b.JUMLAHPROMO,
            'TRANSPROMO' AS SOURCE
      FROM SFA_TRANSPROMO a
      INNER JOIN SFA_TRANSPROMODETAIL b ON a.NOTRANSAKSI=b.NOTRANSAKSI
      INNER JOIN SFA_PELANGGAN x ON a.IDPELANGGAN=x.ID
      WHERE a.IDSALES=? AND a.TANGGAL=? AND a.IDPELANGGAN=?

      UNION ALL

      SELECT a.TANGGAL, a.IDSALES, a.NOTRANSAKSI, a.IDPELANGGAN,
            x.NAMAPELANGGAN, x.ALAMAT,
            b.HARGA, b.IDITEMPRODUK, b.QTY, b.UNIT,
            b.QTYCASHBACK, b.JUMLAHCASHBACK, b.QTYPROMO, b.JUMLAHPROMO,
            'PENJUALAN_KHUSUS' AS SOURCE
      FROM SFA_PENJUALAN_KHUSUS a
      INNER JOIN SFA_PENJUALANDETAIL_KHUSUS b ON a.NOTRANSAKSI=b.NOTRANSAKSI
      INNER JOIN SFA_PELANGGAN x ON a.IDPELANGGAN=x.ID
      WHERE a.IDSALES=? AND a.TANGGAL=? AND a.IDPELANGGAN=?
    `;

    const params = [
      idSales, tglFormatted, idPelanggan,
      idSales, tglFormatted, idPelanggan,
      idSales, tglFormatted, idPelanggan,
      idSales, tglFormatted, idPelanggan,
    ];

    // Debug log params query
    console.log("DETAILHISTORYSELLING Params query:", params);

    db.query(sql, params, (err, result) => {
      db.detach();

      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }

      console.log("DETAILHISTORYSELLING result count:", result?.length || 0);
      res.json(result);
    });
  });
});





//=================== HIST SELLING PER ID ==========
app.get("/DATAHISTORYSELLING/:idpelanggan", (req, res) => {
  const idPelanggan = req.params.idpelanggan;

  pool.get((err, db) => {
    if (err) {
      console.error("Firebird connection error:", err);
      return res.status(500).json({ error: "Database connection gagal" });
    }

    const sql = `
      SELECT FIRST 2 d.IDPELANGGAN, d.IDSALES, d.TANGGAL
      FROM (
        SELECT a.IDPELANGGAN, a.IDSALES, a.TANGGAL FROM SFA_PENJUALAN a
        UNION ALL
        SELECT a.IDPELANGGAN, a.IDSALES, a.TANGGAL FROM SFA_PROMOVENDOR a
        UNION ALL
        SELECT a.IDPELANGGAN, a.IDSALES, a.TANGGAL FROM SFA_TRANSPROMO a
        UNION ALL
        SELECT a.IDPELANGGAN, a.IDSALES, a.TANGGAL FROM SFA_PENJUALAN_KHUSUS a
      ) d
      WHERE d.IDPELANGGAN = ?
      ORDER BY d.TANGGAL DESC
    `;

    db.query(sql, [idPelanggan], (err, result) => {
      db.detach();

      if (err) {
        console.error("Query error:", err);
        return res.status(500).json({ error: "Query gagal" });
      }

      res.json(result);
    });
  });
});



// ================= UPLOAD DB =================
// Menggunakan uploadDb untuk upload database
app.post('/upload-db', uploadDb.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    status: 'success',
    filename: req.file.filename, // Menggunakan filename dari multer (nama file yang disimpan)
    filepath: req.file.path // Path lengkap file yang disimpan
  });
});



app.post("/SUBMIT_VISIT", (req, res) => {
  const {
    id_visit,
    tanggal,
    id_spv,
    id_pelanggan,
    latitude,
    longitude,
    mulai,
    selesai,
    catatan,
    details,
    id_feature,
    id_sales,
    nocall,
  } = req.body;

  // 🟡 Cetak semua data yang dikirim dari Flutter
  console.log("\n📥 DATA DITERIMA DARI FLUTTER:");
  console.log({
    id_visit,
    tanggal,
    id_spv,
    id_pelanggan,
    latitude,
    longitude,
    mulai,
    selesai,
    catatan,
    id_feature,
    id_sales,
    nocall,
    checklistCount: Array.isArray(details) ? details.length : 'invalid',
  });

  // 🛑 Validasi
  // Pastikan ID VISIT tidak kosong agar query DELETE dan INSERT berfungsi dengan benar.
  if (
    !id_visit || !tanggal || !id_spv || !id_pelanggan ||
    !mulai || !selesai || !id_sales || !nocall
  ) {
    console.warn("❌ VALIDASI GAGAL. Data tidak lengkap.");
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  // ✅ Lanjut insert/replace ke DB...
  pool.get((err, db) => {
    if (err) {
      console.error("❌ Koneksi DB gagal:", err);
      return res.status(500).json({ error: "Koneksi database gagal" });
    }

    db.transaction(Firebird.ISOLATION_READ_COMMITTED, async (err, tx) => {
      if (err) {
        console.error("❌ Gagal mulai transaksi:", err);
        db.detach();
        return res.status(500).json({ error: "Transaksi gagal dimulai" });
      }

      try {
        // ==========================================
        // 🔥 LOGIKA IDEMPOTENT: HAPUS DATA LAMA DULU 🔥
        // Ini mencegah error "PRIMARY KEY violation" jika data di-submit ulang.
        // ==========================================
        console.log(`♻️ Membersihkan data lama (jika ada) untuk ID: ${id_visit}`);

        // 1. Hapus Detail (Child) terlebih dahulu
        const deleteDetailQuery = `DELETE FROM SFA_VISITDET WHERE ID_VISIT = ?`;
        await queryAsync(tx, deleteDetailQuery, [id_visit]);

        // 2. Hapus Header (Parent)
        const deleteVisitQuery = `DELETE FROM SFA_VISIT WHERE ID_VISIT = ?`;
        await queryAsync(tx, deleteVisitQuery, [id_visit]);

        // ==========================================
        // 🚀 MULAI INSERT DATA BARU
        // ==========================================
        console.log(`🚀 Menyimpan VISIT BARU: ${id_visit}`);

        const insertVisit = `
          INSERT INTO SFA_VISIT
          (ID_VISIT, TANGGAL, IDSPV, IDPELANGGAN, LATITUDE, LONGITUDE, MULAI, SELESAI, CATATAN, IDSALES, NOCALL)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // INSERT Header (SFA_VISIT)
        await queryAsync(tx, insertVisit, [
          id_visit,
          new Date(tanggal),
          id_spv,
          id_pelanggan,
          latitude,
          longitude,
          new Date(mulai),
          new Date(selesai),
          catatan,
          id_sales,
          nocall
        ]);

        const insertDetail = `
          INSERT INTO SFA_VISITDET
          (ID_VISIT, ID_FEATURE, ID_FEATUREDETAIL, ID_FEATURESUBDETAIL, CHECKLIST)
          VALUES (?, ?, ?, ?, ?)
        `;

        // INSERT Detail (SFA_VISITDET)
        if (Array.isArray(details)) {
            for (const detail of details) {
            const id_featuredetail = detail.id_feature_detail;
            const subDetails = detail.sub_details || [];

            console.log(`📌 Detail: ${id_featuredetail} | sub: ${subDetails.length}`);

            for (const sub of subDetails) {
                const checklist = sub.is_checked ? 1 : 0;
                const id_sub = sub.id_feature_sub_detail;

                await queryAsync(tx, insertDetail, [
                id_visit,
                id_feature,
                id_featuredetail,
                id_sub,
                checklist
                ]);
            }
            }
        }

        // COMMIT Transaksi
        tx.commit((err) => {
          db.detach();
          if (err) {
            console.error("❌ Gagal commit:", err);
            // Walaupun commit gagal, data lama (jika ada) sudah hilang dan data baru mungkin sudah setengah masuk, 
            // tetapi ini adalah titik kegagalan yang paling sulit ditangani. Kita anggap ini error internal server.
            return res.status(500).json({ error: "Gagal menyimpan data (Commit Gagal)" });
          }
          return res.json({ success: true, message: "Checklist berhasil disimpan/diperbarui" });
        });

      } catch (e) {
        // Rollback jika terjadi error pada DELETE atau salah satu INSERT
        console.error("❌ Exception transaksi:", e);
        tx.rollback(() => {
          db.detach();
          return res.status(500).json({ error: "Gagal menyimpan checklist", detail: e.message });
        });
      }
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

// Menggunakan uploadPhoto untuk upload selfie
app.post('/upload-selfie', uploadPhoto.single('selfie'), (req, res) => {
  if (!req.file) {
      return res.status(400).json({ message: 'Tidak ada file yang diunggah.' });
  }

  res.status(200).json({
      message: 'Selfie berhasil diunggah!',
      filename: req.file.filename,
      filepath: req.file.path
  });
});


// GET /photo/:kodetransaksi -> mengembalikan file uploads/photos/<kodetransaksi>.jpg
app.get("/photo/:kodetransaksi", (req, res) => {
  try {
    const kode = req.params.kodetransaksi;
    // paksa ekstensi .jpg sesuai permintaan
    const requestedName = `${kode}.jpg`;

    // resolve path absolut dan cegah path traversal
    const absPhotosDir = path.resolve(photoUploadDir);
    const absTarget = path.resolve(path.join(photoUploadDir, requestedName));
    if (!absTarget.startsWith(absPhotosDir + path.sep) && absTarget !== absPhotosDir) {
      return res.status(400).json({ error: "Path tidak valid." });
    }

    // cek file ada
    fs.stat(absTarget, (err, stat) => {
      if (err || !stat.isFile()) {
        return res.status(404).json({ error: "Foto tidak ditemukan." });
      }

      // set header dan kirim file
      res.setHeader("Content-Type", "image/jpeg");
      // cache 1 hari (opsional)
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(absTarget);
    });
  } catch (e) {
    console.error("Error serve photo:", e);
    return res.status(500).json({ error: "Gagal menampilkan foto." });
  }
});


// ================= UPDATE LOKASI PELANGGAN =================
app.post("/update-location", (req, res) => {
  const { id_pelanggan, latitude, longitude, updated_by } = req.body;

  // 1. Validasi Input
  if (!id_pelanggan || !latitude || !longitude) {
    return res.status(400).json({ 
      error: "Data tidak lengkap. id_pelanggan, latitude, dan longitude wajib diisi." 
    });
  }

  pool.get((err, db) => {
    if (err) {
      console.error("❌ Firebird connection error:", err);
      return res.status(500).json({ error: "Koneksi database gagal" });
    }

    // 2. Tentukan Query Update
    // PENTING: Pastikan nama tabel pelanggan Anda yang benar (SFA_PELANGGAN atau BSA_PELANGGAN).
    // Berdasarkan query '/CONTROL_CALL_DETAIL' sebelumnya, tabelnya adalah SFA_PELANGGAN dan kolom ID adalah 'ID'.
    // Jika Anda ingin mengupdate tabel master BSA, ubah menjadi BSA_PELANGGAN dan ID menjadi BARCODE.
    
    const sql = `
      UPDATE SFA_PELANGGAN 
      SET LATITUDE = ?, 
          LONGITUDE = ?
          -- , MODIFIED_BY = ?  <-- Aktifkan baris ini jika ada kolom untuk mencatat siapa yang edit
      WHERE ID = ?
    `;

    // Array parameter (urutan harus sama dengan tanda tanya di SQL)
    const params = [latitude, longitude, id_pelanggan];

    // 3. Eksekusi Query
    db.query(sql, params, (err, result) => {
      // Commit transaksi (di node-firebird, detach biasanya melakukan commit otomatis jika tidak ada error)
      db.detach(); 

      if (err) {
        console.error("❌ Gagal update lokasi:", err);
        return res.status(500).json({ error: "Gagal mengupdate lokasi di database." });
      }

      console.log(`✅ Lokasi Pelanggan ${id_pelanggan} berhasil diupdate ke: ${latitude}, ${longitude}`);
      
      return res.json({ 
        success: true, 
        message: "Koordinat toko berhasil diperbarui.",
        data: { id_pelanggan, latitude, longitude }
      });
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

// ================= APK VERSION CONTROL (SQLITE) =================

// Public endpoint for mobile app to check latest version
app.get("/api/apk-latest", (req, res) => {
  const sql = "SELECT * FROM apk_versions ORDER BY version_code DESC LIMIT 1";
  sqliteDb.get(sql, [], (err, row) => {
    if (err) return res.status(500).json({ error: "Query failed", details: err.message });
    res.json(row || null);
  });
});

// Admin endpoint: List all versions
app.get("/api/admin/apk-versions", (req, res) => {
  const sql = "SELECT * FROM apk_versions ORDER BY version_code DESC";
  sqliteDb.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: "Query failed", details: err.message });
    res.json(rows);
  });
});

// Admin endpoint: Add new version (Handling File Upload)
app.post("/api/admin/apk-versions", uploadApk.single('apk_file'), (req, res) => {
  const { version_name, version_code, release_notes, is_force_update } = req.body;
  let download_url = req.body.download_url; // Manual URL fallback

  // If a file was uploaded, construct the URL
  if (req.file) {
    // Construction URL based on host. 
    // In production, you might want to use a more robust way to get the base URL.
    const protocol = req.protocol;
    const host = req.get('host');
    download_url = `${protocol}://${host}/uploads/apks/${req.file.filename}`;
  }

  if (!version_name || !version_code || !download_url) {
    return res.status(400).json({ error: "Missing required fields (version, code, and file/url)" });
  }

  const sql = `
    INSERT INTO apk_versions (version_name, version_code, download_url, release_notes, is_force_update)
    VALUES (?, ?, ?, ?, ?)
  `;
  const params = [version_name, version_code, download_url, release_notes, is_force_update || 0];

  sqliteDb.run(sql, params, function(err) {
    if (err) {
      console.error("Insert error:", err);
      return res.status(500).json({ error: "Failed to insert version" });
    }
    res.json({ success: true, id: this.lastID });
  });
});

// Admin endpoint: Delete version
app.delete("/api/admin/apk-versions/:id", (req, res) => {
  const { id } = req.params;
  sqliteDb.run("DELETE FROM apk_versions WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: "Delete failed" });
    res.json({ success: true });
  });
});

// Mulai server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
  console.log(`📂 Database uploads will go to: ${dbUploadDir}`);
  console.log(`📸 Photo uploads will go to: ${photoUploadDir}`);
});
