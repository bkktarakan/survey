/**
 * SERVER NODE.JS + DATABASE MYSQL (XAMPP / MariaDB)
 * Aplikasi Penilaian Kepuasan & Pemilihan Petugas Pelayanan Terbaik BKK Tarakan 2026
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT || 8080);
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bkk_tarakan_2026'
};

const MYSQL_BIN = fs.existsSync('C:\\xampp\\mysql\\bin\\mysql.exe')
  ? 'C:\\xampp\\mysql\\bin\\mysql.exe'
  : 'mysql';
const MYSQLD_BIN = 'C:\\xampp\\mysql\\bin\\mysqld.exe';
const MYSQL_INI = 'C:\\xampp\\mysql\\bin\\my.ini';

// Encode nilai string menjadi ekspresi SQL aman: CONVERT(UNHEX('...') USING utf8mb4)
function sqlStr(val) {
  if (val === null || val === undefined) return 'NULL';
  const hex = Buffer.from(String(val), 'utf8').toString('hex');
  return `CONVERT(UNHEX('${hex}') USING utf8mb4)`;
}

function sqlNum(val) {
  const n = Number(val);
  return Number.isFinite(n) ? String(n) : '0';
}

// Cek apakah port TCP MySQL (3306) sudah aktif
function isPortOpen(port, host = '127.0.0.1', timeout = 1200) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;
    const done = result => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve(result);
      }
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

// Otomatis jalankan MySQL XAMPP jika belum menyala
async function ensureMySQLRunning() {
  const running = await isPortOpen(DB_CONFIG.port, DB_CONFIG.host);
  if (running) {
    console.log(`[MySQL] Terhubung ke MySQL pada ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    return;
  }

  if (fs.existsSync(MYSQLD_BIN)) {
    console.log('[MySQL] Service MySQL belum aktif, menyalakan XAMPP MySQL (mysqld.exe)...');
    const args = [];
    if (fs.existsSync(MYSQL_INI)) {
      args.push(`--defaults-file=${MYSQL_INI}`);
    }
    args.push('--max_allowed_packet=16M');

    const child = spawn(MYSQLD_BIN, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();

    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await isPortOpen(DB_CONFIG.port, DB_CONFIG.host)) {
        console.log('[MySQL] XAMPP MySQL berhasil dinyalakan pada port 3306.');
        return;
      }
    }
  }
  throw new Error('MySQL tidak dapat dihubungi pada port 3306. Pastikan MySQL / XAMPP aktif.');
}

// Eksekusi perintah SQL ke MySQL melalui stdin (mendukung payload besar seperti foto Base64)
function runSQL(sqlQuery, useDb = true) {
  return new Promise((resolve, reject) => {
    const args = [
      `-h${DB_CONFIG.host}`,
      `-P${DB_CONFIG.port}`,
      `-u${DB_CONFIG.user}`,
      '--default-character-set=utf8mb4',
      '--batch',
      '--raw',
      '--skip-column-names'
    ];
    if (DB_CONFIG.password) {
      args.push(`-p${DB_CONFIG.password}`);
    }
    if (useDb) {
      args.push(DB_CONFIG.database);
    }

    const proc = spawn(MYSQL_BIN, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8');
    });
    proc.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', err => reject(err));
    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(stderr.trim() || `mysql exited with code ${code}`));
      }
      resolve(stdout.trim());
    });

    proc.stdin.write(sqlQuery, 'utf8');
    proc.stdin.end();
  });
}

// Inisialisasi schema database.sql
async function initDatabase() {
  await ensureMySQLRunning();
  await runSQL(
    `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    false
  );
  const schemaPath = path.join(__dirname, 'database.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await runSQL(schemaSql, true);
  console.log(`[MySQL] Database "${DB_CONFIG.database}" & tabel siap digunakan.`);
}

async function fetchAllData() {
  const empOut = await runSQL(`
    SELECT JSON_OBJECT(
      'id', id,
      'name', name,
      'nip', nip,
      'jabatan', jabatan,
      'wilker', wilker,
      'photo', IFNULL(photo, '')
    )
    FROM employees
    ORDER BY created_at ASC, id ASC;
  `);

  const employees = empOut
    ? empOut.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line))
    : [];

  const respOut = await runSQL(`
    SELECT JSON_OBJECT(
      'id', id,
      'timestamp', timestamp_str,
      'respondentName', respondent_name,
      'respondentContact', IFNULL(respondent_contact, ''),
      'docTypesJson', doc_types,
      'intensity', intensity,
      'evaluatedOfficerId', evaluated_officer_id,
      'evaluatedOfficerName', evaluated_officer_name,
      'evaluatedOfficerNip', evaluated_officer_nip,
      'evaluatedOfficerWilker', evaluated_officer_wilker,
      'c1', score_c1,
      'c2', score_c2,
      'c3', score_c3,
      'c4', score_c4,
      'c5', score_c5,
      'avgScore', avg_score,
      'voteReason', vote_reason,
      'overallSatisfaction', overall_satisfaction,
      'suggestion2027', IFNULL(suggestion_2027, '')
    )
    FROM responses
    ORDER BY created_at DESC, id DESC;
  `);

  const responses = respOut
    ? respOut.split(/\r?\n/).filter(Boolean).map(line => {
        const raw = JSON.parse(line);
        let docTypes = [];
        try {
          docTypes = JSON.parse(raw.docTypesJson);
        } catch (e) {
          docTypes = raw.docTypesJson ? [raw.docTypesJson] : [];
        }
        return {
          id: raw.id,
          timestamp: raw.timestamp,
          respondentName: raw.respondentName,
          respondentContact: raw.respondentContact || '',
          docTypes,
          intensity: raw.intensity,
          evaluatedOfficerId: raw.evaluatedOfficerId,
          evaluatedOfficerName: raw.evaluatedOfficerName,
          evaluatedOfficerNip: raw.evaluatedOfficerNip,
          evaluatedOfficerWilker: raw.evaluatedOfficerWilker,
          scores: {
            c1: Number(raw.c1),
            c2: Number(raw.c2),
            c3: Number(raw.c3),
            c4: Number(raw.c4),
            c5: Number(raw.c5)
          },
          avgScore: Number(raw.avgScore),
          bestOfficerVoteId: raw.evaluatedOfficerId,
          bestOfficerVoteName: raw.evaluatedOfficerName,
          bestOfficerVoteNip: raw.evaluatedOfficerNip,
          bestOfficerVoteWilker: raw.evaluatedOfficerWilker,
          voteReason: raw.voteReason,
          overallSatisfaction: Number(raw.overallSatisfaction),
          suggestion2027: raw.suggestion2027 || ''
        };
      })
    : [];

  const ips = getLocalIPs();
  const baseUrl = ips.length > 0 ? `http://${ips[0]}:${PORT}` : `http://localhost:${PORT}`;

  return { employees, responses, networkBaseUrl: baseUrl };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
      if (body.length > 15 * 1024 * 1024) {
        reject(new Error('Payload terlalu besar'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Format JSON tidak valid'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const netInfo of nets[name]) {
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        ips.push(netInfo.address);
      }
    }
  }
  return ips;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  try {
    // ==================== REST API MYSQL ====================
    if (pathname === '/api/data' && req.method === 'GET') {
      const data = await fetchAllData();
      return sendJson(res, 200, {
        status: 'success',
        database: DB_CONFIG.database,
        ...data
      });
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      const { username, password } = await readJsonBody(req);
      const out = await runSQL(`
        SELECT JSON_OBJECT('id', id, 'username', username)
        FROM admin_users
        WHERE LOWER(username) = LOWER(${sqlStr(username || '')})
          AND password = ${sqlStr(password || '')}
        LIMIT 1;
      `);
      if (!out) {
        return sendJson(res, 401, { status: 'error', message: 'Username atau Password salah.' });
      }
      const admin = JSON.parse(out.split(/\r?\n/)[0]);
      return sendJson(res, 200, { status: 'success', admin });
    }

    if (pathname === '/api/change-password' && req.method === 'POST') {
      const { currentPassword, newUsername, newPassword } = await readJsonBody(req);
      const checkOut = await runSQL(`
        SELECT id FROM admin_users
        WHERE password = ${sqlStr(currentPassword || '')}
        LIMIT 1;
      `);
      if (!checkOut) {
        return sendJson(res, 400, { status: 'error', message: 'Password saat ini tidak sesuai.' });
      }
      await runSQL(`
        UPDATE admin_users
        SET username = ${sqlStr(newUsername)}, password = ${sqlStr(newPassword)}
        WHERE id = ${sqlNum(checkOut.split(/\r?\n/)[0])};
      `);
      return sendJson(res, 200, { status: 'success', message: 'Username & Password berhasil diperbarui di MySQL.' });
    }

    if (pathname === '/api/employees' && req.method === 'POST') {
      const emp = await readJsonBody(req);
      const id = emp.id || ('emp-' + Date.now());
      await runSQL(`
        INSERT INTO employees (id, name, nip, jabatan, wilker, photo)
        VALUES (
          ${sqlStr(id)},
          ${sqlStr(emp.name)},
          ${sqlStr(emp.nip)},
          ${sqlStr(emp.jabatan)},
          ${sqlStr(emp.wilker)},
          ${sqlStr(emp.photo || '')}
        )
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          nip = VALUES(nip),
          jabatan = VALUES(jabatan),
          wilker = VALUES(wilker),
          photo = VALUES(photo);
      `);
      const data = await fetchAllData();
      return sendJson(res, 200, { status: 'success', ...data });
    }

    if (pathname === '/api/employees/bulk' && req.method === 'POST') {
      const { employees } = await readJsonBody(req);
      if (Array.isArray(employees) && employees.length > 0) {
        const valuesSql = employees
          .filter(e => e && e.name && e.wilker)
          .map((emp, idx) => `(
            ${sqlStr(emp.id || `emp-${Date.now()}-${idx}`)},
            ${sqlStr(emp.name)},
            ${sqlStr(emp.nip || '-')},
            ${sqlStr(emp.jabatan || 'Petugas Pelayanan')},
            ${sqlStr(emp.wilker)},
            ${sqlStr(emp.photo || '')}
          )`)
          .join(',\n');

        if (valuesSql) {
          await runSQL(`
            INSERT INTO employees (id, name, nip, jabatan, wilker, photo)
            VALUES ${valuesSql}
            ON DUPLICATE KEY UPDATE
              name = VALUES(name),
              nip = VALUES(nip),
              jabatan = VALUES(jabatan),
              wilker = VALUES(wilker);
          `);
        }
      }
      const data = await fetchAllData();
      return sendJson(res, 200, { status: 'success', ...data });
    }

    if (pathname.startsWith('/api/employees/') && req.method === 'DELETE') {
      const empId = decodeURIComponent(pathname.replace('/api/employees/', ''));
      await runSQL(`DELETE FROM employees WHERE id = ${sqlStr(empId)};`);
      const data = await fetchAllData();
      return sendJson(res, 200, { status: 'success', ...data });
    }

    if (pathname === '/api/responses' && req.method === 'POST') {
      const r = await readJsonBody(req);

      // Pencegahan suara ganda (Anti-Spam): Cek apakah responden/No HP yang sama sudah menilai pegawai yang sama hari ini
      const dupCheck = await runSQL(`
        SELECT id FROM responses
        WHERE DATE(created_at) = CURDATE()
          AND evaluated_officer_id = ${sqlStr(r.evaluatedOfficerId || '')}
          AND (
            LOWER(TRIM(respondent_name)) = LOWER(TRIM(${sqlStr(r.respondentName || '')}))
            OR (
              ${sqlStr(r.respondentContact || '')} <> ''
              AND TRIM(respondent_contact) = TRIM(${sqlStr(r.respondentContact || '')})
            )
          )
        LIMIT 1;
      `);

      if (dupCheck) {
        return sendJson(res, 409, {
          status: 'duplicate',
          message: 'Anda sudah memberikan penilaian untuk pegawai ini pada hari ini. Terima kasih atas partisipasi Anda!'
        });
      }

      const id = r.id || ('RESP-' + Date.now());
      await runSQL(`
        INSERT INTO responses (
          id, timestamp_str, respondent_name, respondent_contact, doc_types, intensity,
          evaluated_officer_id, evaluated_officer_name, evaluated_officer_nip, evaluated_officer_wilker,
          score_c1, score_c2, score_c3, score_c4, score_c5, avg_score,
          vote_reason, overall_satisfaction, suggestion_2027
        ) VALUES (
          ${sqlStr(id)},
          ${sqlStr(r.timestamp)},
          ${sqlStr(r.respondentName)},
          ${sqlStr(r.respondentContact || '')},
          ${sqlStr(JSON.stringify(r.docTypes || []))},
          ${sqlStr(r.intensity)},
          ${sqlStr(r.evaluatedOfficerId)},
          ${sqlStr(r.evaluatedOfficerName)},
          ${sqlStr(r.evaluatedOfficerNip)},
          ${sqlStr(r.evaluatedOfficerWilker)},
          ${sqlNum(r.scores?.c1)},
          ${sqlNum(r.scores?.c2)},
          ${sqlNum(r.scores?.c3)},
          ${sqlNum(r.scores?.c4)},
          ${sqlNum(r.scores?.c5)},
          ${sqlNum(r.avgScore)},
          ${sqlStr(r.voteReason)},
          ${sqlNum(r.overallSatisfaction)},
          ${sqlStr(r.suggestion2027 || '')}
        );
      `);
      const data = await fetchAllData();
      return sendJson(res, 200, { status: 'success', ...data });
    }

    if (pathname === '/api/responses' && req.method === 'DELETE') {
      await runSQL(`DELETE FROM responses;`);
      const data = await fetchAllData();
      return sendJson(res, 200, { status: 'success', ...data });
    }

    // ==================== STATIC FILES ====================
    const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const fullPath = path.join(__dirname, safePath);

    if (!fullPath.startsWith(__dirname) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.json': 'application/json; charset=utf-8'
    };

    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  } catch (err) {
    console.error('[Server Error]', err);
    sendJson(res, 500, { status: 'error', message: err.message || 'Internal Server Error' });
  }
});

initDatabase()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`=============================================================`);
      console.log(`Server BKK Tarakan 2026 berjalan dengan Database MySQL!`);
      console.log(`- Akses Lokal : http://localhost:${PORT}`);
      const ips = getLocalIPs();
      ips.forEach(ip => console.log(`- Akses Jaringan/HP : http://${ip}:${PORT}`));
      console.log(`- Database MySQL : ${DB_CONFIG.database} (Port ${DB_CONFIG.port})`);
      console.log(`=============================================================`);
    });
  })
  .catch(err => {
    console.error('Gagal menginisialisasi database MySQL:', err.message);
    process.exit(1);
  });
