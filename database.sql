-- ============================================================================
-- DATABASE MYSQL: PENILAIAN & PEMILIHAN PETUGAS TERBAIK BKK TARAKAN 2026
-- ============================================================================

CREATE DATABASE IF NOT EXISTS bkk_tarakan_2026
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bkk_tarakan_2026;

-- 1. Tabel Admin / Panitia
CREATE TABLE IF NOT EXISTS admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin jika belum ada
INSERT IGNORE INTO admin_users (id, username, password)
VALUES (1, 'admin', 'bkktarakan2026');

-- 2. Tabel Data Pegawai BKK Tarakan
CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  nip VARCHAR(50) NOT NULL,
  jabatan VARCHAR(200) NOT NULL,
  wilker VARCHAR(150) NOT NULL,
  photo LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert data contoh awal jika tabel employees masih kosong
INSERT INTO employees (id, name, nip, jabatan, wilker, photo)
SELECT * FROM (
  SELECT 'emp-1' AS id, 'Petugas Contoh 1 (Silakan Edit di Panel Panitia)' AS name, '199001012015031001' AS nip, 'Petugas Pelayanan Dokumen Kekarantinaan' AS jabatan, 'Kantor Induk BKK Tarakan' AS wilker, '' AS photo
  UNION ALL
  SELECT 'emp-2', 'Petugas Contoh 2', '199204152018012002', 'Epidemiolog Kesehatan / Petugas SSCE & PHQC', 'Wilker Pelabuhan Malundung', ''
  UNION ALL
  SELECT 'emp-3', 'Petugas Contoh 3', '198908202014021003', 'Petugas Pelayanan Vaksinasi & Buku ICV', 'Wilker Bandara Juwata', ''
  UNION ALL
  SELECT 'emp-4', 'Petugas Contoh 4', '199411102019031004', 'Sanitarian / Pemeriksa Dokumen Kapal', 'Wilker Nunukan', ''
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM employees LIMIT 1);

-- 3. Tabel Data Penilaian Responden
CREATE TABLE IF NOT EXISTS responses (
  id VARCHAR(64) PRIMARY KEY,
  timestamp_str VARCHAR(100) NOT NULL,
  respondent_name VARCHAR(255) NOT NULL,
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

-- Migrasi otomatis jika tabel responses sudah dibuat sebelumnya tanpa kolom respondent_contact
ALTER TABLE responses ADD COLUMN IF NOT EXISTS respondent_contact VARCHAR(50) DEFAULT '' AFTER respondent_name;
