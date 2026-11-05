<?php
/**
 * BACKEND API PHP + MYSQL (Hostinger / cPanel / Apache / LiteSpeed / XAMPP)
 * Aplikasi Penilaian Kepuasan & Pemilihan Petugas Pelayanan Terbaik BKK Tarakan 2026
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-HTTP-Method-Override');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

// Daftar konfigurasi database (otomatis mencoba Hostinger lalu fallback ke XAMPP Lokal)
$dbCandidates = [
    [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => getenv('DB_PORT') ?: '3306',
        'user' => getenv('DB_USER') ?: 'u686952159_user_survey',
        'pass' => getenv('DB_PASSWORD') ?: 'Mulawarman103!',
        'name' => getenv('DB_NAME') ?: 'u686952159_db_survey'
    ],
    [
        'host' => 'localhost',
        'port' => '3306',
        'user' => 'u686952159_user_survey',
        'pass' => 'Mulawarman103!',
        'name' => 'u686952159_db_survey'
    ],
    [
        'host' => '127.0.0.1',
        'port' => '3306',
        'user' => 'root',
        'pass' => '',
        'name' => 'bkk_tarakan_2026'
    ]
];

$pdo = null;
$activeDbName = '';
$lastError = '';

foreach ($dbCandidates as $cfg) {
    try {
        $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 5
        ]);
        $activeDbName = $cfg['name'];
        break;
    } catch (Exception $e) {
        $lastError = $e->getMessage();
    }
}

if (!$pdo) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Koneksi database MySQL gagal: ' . $lastError
    ]);
    exit;
}

// Inisialisasi tabel otomatis jika belum ada di database
function initTables(PDO $pdo) {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS admin_users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    $countAdmin = (int)$pdo->query("SELECT COUNT(*) FROM admin_users")->fetchColumn();
    if ($countAdmin === 0) {
        $stmt = $pdo->prepare("INSERT IGNORE INTO admin_users (id, username, password) VALUES (1, 'admin', 'bkktarakan2026')");
        $stmt->execute();
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS employees (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            nip VARCHAR(50) NOT NULL,
            jabatan VARCHAR(200) NOT NULL,
            wilker VARCHAR(150) NOT NULL,
            photo LONGTEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");

    $countEmp = (int)$pdo->query("SELECT COUNT(*) FROM employees")->fetchColumn();
    if ($countEmp === 0) {
        $pdo->exec("
            INSERT IGNORE INTO employees (id, name, nip, jabatan, wilker, photo) VALUES
            ('emp-1', 'Petugas Contoh 1 (Silakan Edit di Panel Admin)', '199001012015031001', 'Petugas Pelayanan Dokumen Kekarantinaan', 'Layanan Pelabuhan Malundung Tarakan', ''),
            ('emp-2', 'Petugas Contoh 2', '199204152018012002', 'Epidemiolog Kesehatan / Petugas SSCEC & PHQC', 'Wilker Tanjung Selor', ''),
            ('emp-3', 'Petugas Contoh 3', '198908202014021003', 'Petugas Pelayanan Vaksinasi & Buku ICV', 'Wilker Berau', ''),
            ('emp-4', 'Petugas Contoh 4', '199411102019031004', 'Sanitarian / Pemeriksa Dokumen Kapal', 'Wilker Nunukan', '');
        ");
    }

    // Sesuaikan nama Wilayah Kerja lama pada data contoh jika sudah terlanjur dibuat
    $pdo->exec("
        UPDATE employees SET wilker = 'Layanan Pelabuhan Malundung Tarakan' WHERE wilker IN ('Kantor Induk BKK Tarakan', 'Kantor Induk', 'Wilker Pelabuhan Malundung');
        UPDATE employees SET wilker = 'Wilker Berau' WHERE wilker IN ('Wilker Bandara Juwata', 'Layanan Bandara Juwata Tarakan');
        UPDATE employees SET wilker = 'Pos Malinau' WHERE wilker = 'Wilker Malinau';
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS responses (
            id VARCHAR(64) PRIMARY KEY,
            timestamp_str VARCHAR(100) NOT NULL,
            respondent_name VARCHAR(200) NOT NULL,
            respondent_contact VARCHAR(50) DEFAULT '',
            doc_types TEXT NOT NULL,
            intensity VARCHAR(50) NOT NULL,
            evaluated_officer_id VARCHAR(64) NOT NULL,
            evaluated_officer_name VARCHAR(200) NOT NULL,
            evaluated_officer_nip VARCHAR(50) NOT NULL,
            evaluated_officer_wilker VARCHAR(150) NOT NULL,
            score_c1 TINYINT NOT NULL,
            score_c2 TINYINT NOT NULL,
            score_c3 TINYINT NOT NULL,
            score_c4 TINYINT NOT NULL,
            score_c5 TINYINT NOT NULL,
            avg_score DECIMAL(4,2) NOT NULL,
            vote_reason TEXT NOT NULL,
            overall_satisfaction TINYINT NOT NULL,
            suggestion_2027 TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
}

function fetchAllData(PDO $pdo) {
    $empRows = $pdo->query("SELECT id, name, nip, jabatan, wilker, IFNULL(photo, '') AS photo FROM employees ORDER BY created_at ASC, id ASC")->fetchAll();
    $respRows = $pdo->query("SELECT * FROM responses ORDER BY created_at DESC, id DESC")->fetchAll();

    $responses = [];
    foreach ($respRows as $raw) {
        $docTypes = json_decode($raw['doc_types'] ?? '[]', true);
        if (!is_array($docTypes)) {
            $docTypes = !empty($raw['doc_types']) ? [$raw['doc_types']] : [];
        }
        $responses[] = [
            'id' => $raw['id'],
            'timestamp' => $raw['timestamp_str'],
            'respondentName' => $raw['respondent_name'],
            'respondentContact' => $raw['respondent_contact'] ?? '',
            'docTypes' => $docTypes,
            'intensity' => $raw['intensity'],
            'evaluatedOfficerId' => $raw['evaluated_officer_id'],
            'evaluatedOfficerName' => $raw['evaluated_officer_name'],
            'evaluatedOfficerNip' => $raw['evaluated_officer_nip'],
            'evaluatedOfficerWilker' => $raw['evaluated_officer_wilker'],
            'scores' => [
                'c1' => (int)$raw['score_c1'],
                'c2' => (int)$raw['score_c2'],
                'c3' => (int)$raw['score_c3'],
                'c4' => (int)$raw['score_c4'],
                'c5' => (int)$raw['score_c5']
            ],
            'avgScore' => (float)$raw['avg_score'],
            'bestOfficerVoteId' => $raw['evaluated_officer_id'],
            'bestOfficerVoteName' => $raw['evaluated_officer_name'],
            'bestOfficerVoteNip' => $raw['evaluated_officer_nip'],
            'bestOfficerVoteWilker' => $raw['evaluated_officer_wilker'],
            'voteReason' => $raw['vote_reason'],
            'overallSatisfaction' => (int)$raw['overall_satisfaction'],
            'suggestion2027' => $raw['suggestion_2027'] ?? ''
        ];
    }

    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $baseDir = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/\\');
    $baseUrl = "{$proto}://{$host}{$baseDir}";

    return [
        'employees' => $empRows,
        'responses' => $responses,
        'networkBaseUrl' => $baseUrl
    ];
}

try {
    initTables($pdo);

    $rawBody = file_get_contents('php://input');
    $body = $rawBody ? json_decode($rawBody, true) : [];
    if (!is_array($body)) {
        $body = [];
    }

    $method = $_SERVER['REQUEST_METHOD'];
    if (!empty($body['_method'])) {
        $method = strtoupper($body['_method']);
    } elseif (!empty($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
        $method = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
    }

    $endpoint = $_GET['endpoint'] ?? '';
    if (!$endpoint) {
        $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
        if (preg_match('#/api/(.+)$#', $uriPath, $m)) {
            $endpoint = $m[1];
        }
    }
    $endpoint = trim($endpoint, '/');

    // 1. GET /api/data
    if ($endpoint === 'data' && $method === 'GET') {
        $data = fetchAllData($pdo);
        echo json_encode(array_merge([
            'status' => 'success',
            'database' => $activeDbName
        ], $data));
        exit;
    }

    // 2. POST /api/login
    if ($endpoint === 'login' && $method === 'POST') {
        $username = trim($body['username'] ?? '');
        $password = (string)($body['password'] ?? '');

        $stmt = $pdo->prepare("SELECT id, username FROM admin_users WHERE LOWER(username) = LOWER(:u) AND password = :p LIMIT 1");
        $stmt->execute([':u' => $username, ':p' => $password]);
        $admin = $stmt->fetch();

        if (!$admin) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Username atau Password salah.']);
            exit;
        }

        echo json_encode(['status' => 'success', 'admin' => $admin]);
        exit;
    }

    // 3. POST /api/change-password
    if ($endpoint === 'change-password' && $method === 'POST') {
        $currentPassword = (string)($body['currentPassword'] ?? '');
        $newUsername = trim($body['newUsername'] ?? '');
        $newPassword = (string)($body['newPassword'] ?? '');

        $stmt = $pdo->prepare("SELECT id FROM admin_users WHERE password = :p LIMIT 1");
        $stmt->execute([':p' => $currentPassword]);
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Password saat ini tidak sesuai.']);
            exit;
        }

        $upd = $pdo->prepare("UPDATE admin_users SET username = :u, password = :p WHERE id = :id");
        $upd->execute([':u' => $newUsername, ':p' => $newPassword, ':id' => $row['id']]);

        echo json_encode(['status' => 'success', 'message' => 'Username & Password berhasil diperbarui di MySQL.']);
        exit;
    }

    // 4. POST /api/employees
    if ($endpoint === 'employees' && $method === 'POST') {
        $id = !empty($body['id']) ? $body['id'] : ('emp-' . round(microtime(true) * 1000));
        $stmt = $pdo->prepare("
            INSERT INTO employees (id, name, nip, jabatan, wilker, photo)
            VALUES (:id, :name, :nip, :jabatan, :wilker, :photo)
            ON DUPLICATE KEY UPDATE
                name = VALUES(name),
                nip = VALUES(nip),
                jabatan = VALUES(jabatan),
                wilker = VALUES(wilker),
                photo = VALUES(photo)
        ");
        $stmt->execute([
            ':id' => $id,
            ':name' => $body['name'] ?? '',
            ':nip' => $body['nip'] ?? '',
            ':jabatan' => $body['jabatan'] ?? '',
            ':wilker' => $body['wilker'] ?? '',
            ':photo' => $body['photo'] ?? ''
        ]);

        $data = fetchAllData($pdo);
        echo json_encode(array_merge(['status' => 'success'], $data));
        exit;
    }

    // 5. POST /api/employees/bulk
    if ($endpoint === 'employees/bulk' && $method === 'POST') {
        $list = $body['employees'] ?? [];
        if (is_array($list) && count($list) > 0) {
            $stmt = $pdo->prepare("
                INSERT INTO employees (id, name, nip, jabatan, wilker, photo)
                VALUES (:id, :name, :nip, :jabatan, :wilker, :photo)
                ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    nip = VALUES(nip),
                    jabatan = VALUES(jabatan),
                    wilker = VALUES(wilker)
            ");
            foreach ($list as $idx => $emp) {
                if (!empty($emp['name']) && !empty($emp['wilker'])) {
                    $stmt->execute([
                        ':id' => !empty($emp['id']) ? $emp['id'] : ('emp-' . round(microtime(true) * 1000) . '-' . $idx),
                        ':name' => $emp['name'],
                        ':nip' => $emp['nip'] ?? '-',
                        ':jabatan' => $emp['jabatan'] ?? 'Petugas Pelayanan',
                        ':wilker' => $emp['wilker'],
                        ':photo' => $emp['photo'] ?? ''
                    ]);
                }
            }
        }
        $data = fetchAllData($pdo);
        echo json_encode(array_merge(['status' => 'success'], $data));
        exit;
    }

    // 6. DELETE /api/employees/{id}
    if (strpos($endpoint, 'employees/') === 0 && $method === 'DELETE') {
        $empId = urldecode(substr($endpoint, strlen('employees/')));
        $stmt = $pdo->prepare("DELETE FROM employees WHERE id = :id");
        $stmt->execute([':id' => $empId]);
        $data = fetchAllData($pdo);
        echo json_encode(array_merge(['status' => 'success'], $data));
        exit;
    }

    // 7. POST /api/responses
    if ($endpoint === 'responses' && $method === 'POST') {
        $officerId = $body['evaluatedOfficerId'] ?? '';
        $respName = trim($body['respondentName'] ?? '');
        $respContact = trim($body['respondentContact'] ?? '');

        $dupStmt = $pdo->prepare("
            SELECT id FROM responses
            WHERE DATE(created_at) = CURDATE()
              AND evaluated_officer_id = :oid
              AND (
                LOWER(TRIM(respondent_name)) = LOWER(:rname)
                OR (:rcontact <> '' AND TRIM(respondent_contact) = :rcontact2)
              )
            LIMIT 1
        ");
        $dupStmt->execute([
            ':oid' => $officerId,
            ':rname' => $respName,
            ':rcontact' => $respContact,
            ':rcontact2' => $respContact
        ]);

        if ($dupStmt->fetch()) {
            http_response_code(409);
            echo json_encode([
                'status' => 'duplicate',
                'message' => 'Anda sudah memberikan penilaian untuk pegawai ini pada hari ini. Terima kasih atas partisipasi Anda!'
            ]);
            exit;
        }

        $id = !empty($body['id']) ? $body['id'] : ('RESP-' . round(microtime(true) * 1000));
        $scores = $body['scores'] ?? [];

        $ins = $pdo->prepare("
            INSERT INTO responses (
                id, timestamp_str, respondent_name, respondent_contact, doc_types, intensity,
                evaluated_officer_id, evaluated_officer_name, evaluated_officer_nip, evaluated_officer_wilker,
                score_c1, score_c2, score_c3, score_c4, score_c5, avg_score,
                vote_reason, overall_satisfaction, suggestion_2027
            ) VALUES (
                :id, :ts, :rname, :rcontact, :docs, :intensity,
                :oid, :oname, :onip, :owilker,
                :c1, :c2, :c3, :c4, :c5, :avg,
                :reason, :sat, :sug
            )
        ");
        $ins->execute([
            ':id' => $id,
            ':ts' => $body['timestamp'] ?? date('d/m/Y, H.i.s'),
            ':rname' => $respName,
            ':rcontact' => $respContact,
            ':docs' => json_encode($body['docTypes'] ?? [], JSON_UNESCAPED_UNICODE),
            ':intensity' => $body['intensity'] ?? '',
            ':oid' => $officerId,
            ':oname' => $body['evaluatedOfficerName'] ?? '',
            ':onip' => $body['evaluatedOfficerNip'] ?? '',
            ':owilker' => $body['evaluatedOfficerWilker'] ?? '',
            ':c1' => (int)($scores['c1'] ?? 5),
            ':c2' => (int)($scores['c2'] ?? 5),
            ':c3' => (int)($scores['c3'] ?? 5),
            ':c4' => (int)($scores['c4'] ?? 5),
            ':c5' => (int)($scores['c5'] ?? 5),
            ':avg' => (float)($body['avgScore'] ?? 5),
            ':reason' => $body['voteReason'] ?? '',
            ':sat' => (int)($body['overallSatisfaction'] ?? 5),
            ':sug' => $body['suggestion2027'] ?? ''
        ]);

        $data = fetchAllData($pdo);
        echo json_encode(array_merge(['status' => 'success'], $data));
        exit;
    }

    // 8. DELETE /api/responses
    if ($endpoint === 'responses' && $method === 'DELETE') {
        $pdo->exec("DELETE FROM responses");
        $data = fetchAllData($pdo);
        echo json_encode(array_merge(['status' => 'success'], $data));
        exit;
    }

    http_response_code(404);
    echo json_encode(['status' => 'error', 'message' => 'Endpoint API tidak ditemukan: ' . $endpoint]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

