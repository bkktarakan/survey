/**
 * GOOGLE APPS SCRIPT - BACKEND PENILAIAN PETUGAS TERBAIK BKK TARAKAN 2026
 * 
 * Mendukung penyimpanan data penilaian lengkap beserta Wilayah Kerja & NIP Pegawai.
 */

const SHEET_RESPONSES = 'Data_Penilaian_2026';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Penilaian Kepuasan & Pemilihan Petugas Pelayanan Terbaik BKK Tarakan 2026')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_RESPONSES);

    if (!sheet) {
      sheet = ss.insertSheet(SHEET_RESPONSES);
      sheet.appendRow([
        'Waktu Input',
        'Nama / Perusahaan / Instansi',
        'No. HP / WhatsApp',
        'Jenis Dokumen',
        'Intensitas Pengurusan 2026',
        'Wilayah Kerja Pegawai',
        'Nama Pegawai Dinilai & Dipilih',
        'NIP Pegawai',
        '1. Keramahan & Kesopanan',
        '2. Kecepatan & Ketanggapan',
        '3. Kejelasan Informasi & Komunikasi',
        '4. Ketelitian & Profesionalisme',
        '5. Kedisiplinan & Penampilan',
        'Rata-rata Skor Penilaian',
        'Alasan Utama Memilih',
        'Kepuasan Keseluruhan BKK Tarakan (1-5)',
        'Saran Perbaikan 2027'
      ]);
      sheet.getRange(1, 1, 1, 17).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
    }

    sheet.appendRow([
      new Date(),
      data.respondentName,
      data.respondentContact || '',
      (data.docTypes || []).join(', '),
      data.intensity,
      data.evaluatedOfficerWilker || '',
      data.evaluatedOfficerName || '',
      data.evaluatedOfficerNip || '',
      data.scores ? data.scores.c1 : '',
      data.scores ? data.scores.c2 : '',
      data.scores ? data.scores.c3 : '',
      data.scores ? data.scores.c4 : '',
      data.scores ? data.scores.c5 : '',
      data.avgScore,
      data.voteReason,
      data.overallSatisfaction,
      data.suggestion2027 || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success', message: 'Data berhasil disimpan' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
