// ⚠️ Baris SUPABASE_URL sudah diisi sesuai project Supabase NitipBox kamu.
// Baris SUPABASE_KEY WAJIB kamu isi sendiri dari: Supabase Dashboard > Settings > API > "anon public" key
const SUPABASE_URL = 'https://tevehzihkqhqmxlrtdhl.supabase.co'
const SUPABASE_KEY = 'sb_publishable_NMoOIVW_lTA1lMsdkG2x1A_Qj0iRFIu'
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

var basisTarif = { "Kecil-S": 3000, "Sedang-M": 7000, "Besar-L": 12000, "Sangat Besar-XL": 20000, "Super Besar-XXL+": 50000 };
var prefixLokasi = { "Surabaya": "SBY", "Sidoarjo": "SDA01", "Sidoarjo 2 (Back Up)": "SDA02" };

/* =============================================
   NOTIFIKASI SUARA (Web Audio API, tanpa file audio)
   ============================================= */
var audioCtx = null;
function siapkanAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
}
function mainkanSuaraNotif() {
  if (!audioCtx) return;
  [880, 1175].forEach(function(freq, i) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    var start = audioCtx.currentTime + i * 0.15;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

function tampilkanToast(pesan) {
  var toast = document.getElementById('notifToast');
  toast.textContent = pesan;
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 4500);
}

/* =============================================
   AUTH (Google OAuth via Supabase)
   ============================================= */
document.getElementById('btnLoginGoogle').addEventListener('click', function() {
  siapkanAudio(); // unlock audio dalam gesture user, biar notif nanti boleh bunyi
  db.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/admin.html' }
  });
});

document.getElementById('btnLogout').addEventListener('click', function() {
  db.auth.signOut().then(function() { window.location.reload(); });
});

async function cekSesiLogin() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { tampilkanLogin(); return; }

  const user = session.user;
  // pastikan baris user ada di tabel users (kalau login pertama kali)
  await db.from('users').upsert({
    id: user.id,
    email: user.email,
    nama: user.user_metadata.full_name || user.email,
    foto_profil: user.user_metadata.avatar_url || null
  }, { onConflict: 'id' });

  const { data: userRow } = await db.from('users').select('role').eq('id', user.id).maybeSingle();

  if (!userRow || userRow.role !== 'admin') {
    tampilkanLogin();
    document.getElementById('loginMsg').textContent = 'Akun ini belum terdaftar sebagai admin. Hubungi developer untuk diaktifkan.';
    return;
  }

  document.getElementById('adminEmail').textContent = user.email;
  tampilkanDashboard();
  muatSemuaData();
  aktifkanRealtimeNotif();
}

function tampilkanLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
}
function tampilkanDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
  siapkanAudio();
}

/* =============================================
   NAVIGASI TAB
   ============================================= */
document.querySelectorAll('.nav-item[data-tab]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    if (btn.disabled) return;
    document.querySelectorAll('.nav-item').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* =============================================
   HELPER
   ============================================= */
function inisial(nama) {
  if (!nama) return '?';
  var kata = nama.trim().split(' ');
  return (kata[0][0] + (kata[1] ? kata[1][0] : '')).toUpperCase();
}
function labelAntarJemput(layanan) {
  if (!layanan || layanan.indexOf('Tidak') !== -1) return { teks: 'Tidak', kelas: 'badge-neutral' };
  if (layanan.indexOf('Keduanya') !== -1 || layanan.indexOf('+') !== -1) return { teks: 'Antar + jemput', kelas: 'badge-tosca' };
  if (layanan.indexOf('Penjemputan') !== -1) return { teks: 'Jemput', kelas: 'badge-tosca' };
  if (layanan.indexOf('Pengantaran') !== -1) return { teks: 'Antar', kelas: 'badge-tosca' };
  return { teks: layanan, kelas: 'badge-neutral' };
}
function hitungJatuhTempo(tanggalMasuk, hari) {
  var d = new Date(tanggalMasuk);
  d.setDate(d.getDate() + parseInt(hari || 1, 10));
  return d;
}
function formatTanggalID(d) {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function hitungTarif(ukuran, hari) {
  var tarifHarian = basisTarif[ukuran] || 0;
  var kotor = tarifHarian * (hari || 1);
  var diskon = 0;
  if ((hari || 1) >= 30) diskon = 0.30;
  else if ((hari || 1) >= 7) diskon = 0.15;
  return Math.ceil((kotor - kotor * diskon) / 100) * 100;
}
function hitungTarifDetail(ukuran, hari) {
  var tarifHarian = basisTarif[ukuran] || 0;
  var kotor = tarifHarian * (hari || 1);
  var persenDiskon = 0;
  if ((hari || 1) >= 30) persenDiskon = 0.30;
  else if ((hari || 1) >= 7) persenDiskon = 0.15;
  var nominalDiskon = kotor * persenDiskon;
  var total = Math.ceil((kotor - nominalDiskon) / 100) * 100;
  var dp = Math.ceil((total * 0.30) / 1000) * 1000;
  return { tarifHarian: tarifHarian, kotor: kotor, persenDiskon: persenDiskon, nominalDiskon: nominalDiskon, total: total, dp: dp };
}

/* =============================================
   MUAT SEMUA DATA
   ============================================= */
function muatSemuaData() {
  muatVerifikasi();
  muatListOrderan();
  muatKeuangan();
}

/* =============================================
   TAB: VERIFIKASI ORDERAN
   ============================================= */
async function muatVerifikasi() {
  const { data: pending } = await db.from('titipan').select('*').eq('status', 'booking').order('created_at', { ascending: true });
  const { data: aktif } = await db.from('titipan').select('id, tanggal_masuk, hari, ukuran, created_at').eq('status', 'aktif');

  var jumlahPending = (pending || []).length;
  document.getElementById('verifikasiCount').textContent = jumlahPending + ' menunggu konfirmasi';

  var badge = document.getElementById('badgeVerifikasi');
  if (jumlahPending > 0) { badge.style.display = 'inline-block'; badge.textContent = jumlahPending; }
  else { badge.style.display = 'none'; }

  // statistik ringkas
  var hariIni = new Date(); hariIni.setHours(0,0,0,0);
  var jumlahTempo = 0;
  var pemasukanBulanIni = 0;
  var bulanIni = new Date().getMonth();
  var tahunIni = new Date().getFullYear();
  (aktif || []).forEach(function(row) {
    var jt = hitungJatuhTempo(row.tanggal_masuk, row.hari);
    jt.setHours(0,0,0,0);
    if (jt <= hariIni) jumlahTempo++;
    var dibuat = new Date(row.created_at);
    if (dibuat.getMonth() === bulanIni && dibuat.getFullYear() === tahunIni) {
      var tarifHarian = basisTarif[row.ukuran] || 0;
      pemasukanBulanIni += tarifHarian * (row.hari || 1);
    }
  });

  document.getElementById('statAktif').textContent = (aktif || []).length;
  document.getElementById('statTempo').textContent = jumlahTempo;
  document.getElementById('statPemasukan').textContent = 'Rp ' + pemasukanBulanIni.toLocaleString('id-ID');
  document.getElementById('statBelum').textContent = jumlahPending;

  var wrap = document.getElementById('verifikasiList');
  if (!pending || pending.length === 0) {
    wrap.innerHTML = '<p class="empty-state">Tidak ada orderan yang menunggu verifikasi 🎉</p>';
    return;
  }

  wrap.innerHTML = '';
  window._pendingCache = {};
  pending.forEach(function(row) {
    window._pendingCache[row.id] = row;
    var aj = labelAntarJemput(row.layanan);
    var div = document.createElement('div');
    div.className = 'order-row';
    div.innerHTML =
      '<div class="order-avatar">' + inisial(row.nama) + '</div>' +
      '<div class="order-info">' +
        '<p class="order-name">' + row.nama + ' <span>· ' + row.wa + '</span></p>' +
        '<p class="order-meta">' + row.deskripsi + ' · ' + row.ukuran.replace('-', ' - ') + ' · ' + row.hari + ' hari · ' + (row.lokasi || '-') + ' · <span class="badge-mini ' + aj.kelas + '" style="display:inline-block">' + aj.teks + '</span></p>' +
      '</div>' +
      '<div class="order-actions">' +
        '<button class="btn btn-icon" title="Sunting" data-aksi="edit" data-id="' + row.id + '">✏️</button>' +
        '<button class="btn btn-icon" title="Hapus permanen" data-aksi="hapus" data-id="' + row.id + '">🗑️</button>' +
        '<button class="btn btn-ghost" data-aksi="tolak" data-id="' + row.id + '">Tolak</button>' +
        '<button class="btn btn-tosca-solid" data-aksi="konfirmasi" data-id="' + row.id + '">Konfirmasi</button>' +
      '</div>';
    wrap.appendChild(div);
  });

  wrap.querySelectorAll('button[data-aksi]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.dataset.aksi === 'edit') { bukaEditModal(btn.dataset.id); return; }
      prosesAksiVerifikasi(btn.dataset.aksi, btn.dataset.id);
    });
  });
}

async function prosesAksiVerifikasi(aksi, id) {
  if (aksi === 'konfirmasi') {
    await db.from('titipan').update({ status: 'aktif' }).eq('id', id);
  } else if (aksi === 'tolak') {
    await db.from('titipan').update({ status: 'ditolak' }).eq('id', id);
  } else if (aksi === 'hapus') {
    if (!confirm('Hapus orderan ini secara permanen? Tindakan ini tidak bisa dibatalkan.')) return;
    await db.from('titipan').delete().eq('id', id);
  }
  muatVerifikasi();
  muatListOrderan();
}

/* =============================================
   MODAL EDIT ORDERAN
   ============================================= */
function bukaEditModal(id) {
  var row = (window._pendingCache || {})[id];
  if (!row) return;
  document.getElementById('editId').value = row.id;
  document.getElementById('editNama').value = row.nama;
  document.getElementById('editWa').value = row.wa;
  document.getElementById('editDeskripsi').value = row.deskripsi;
  document.getElementById('editUkuran').value = row.ukuran;
  document.getElementById('editHari').value = row.hari;
  document.getElementById('editLayanan').value = row.layanan;
  document.getElementById('editIdentitas').value = row.identitas;
  document.getElementById('editModalOverlay').classList.add('show');
}
function tutupEditModal() {
  document.getElementById('editModalOverlay').classList.remove('show');
}
document.getElementById('btnTutupEdit').addEventListener('click', tutupEditModal);
document.getElementById('btnBatalEdit').addEventListener('click', tutupEditModal);
document.getElementById('editModalOverlay').addEventListener('click', function(e) {
  if (e.target === this) tutupEditModal();
});
document.getElementById('formEdit').addEventListener('submit', async function(e) {
  e.preventDefault();
  var id = document.getElementById('editId').value;
  await db.from('titipan').update({
    nama: document.getElementById('editNama').value,
    wa: document.getElementById('editWa').value,
    deskripsi: document.getElementById('editDeskripsi').value,
    ukuran: document.getElementById('editUkuran').value,
    hari: parseInt(document.getElementById('editHari').value, 10) || 1,
    layanan: document.getElementById('editLayanan').value,
    identitas: document.getElementById('editIdentitas').value
  }).eq('id', id);
  tutupEditModal();
  muatVerifikasi();
});

/* =============================================
   TAB: LIST ORDERAN
   ============================================= */
var _listOrderanCache = [];

document.getElementById('filterWilayah').addEventListener('change', renderListOrderan);
document.getElementById('filterStatus').addEventListener('change', renderListOrderan);
document.getElementById('filterUrutan').addEventListener('change', renderListOrderan);

async function muatListOrderan() {
  const { data } = await db.from('titipan').select('*').eq('status', 'aktif').order('created_at', { ascending: false });
  _listOrderanCache = data || [];
  renderListOrderan();
}

function renderListOrderan() {
  var wrap = document.getElementById('listOrderanBody');
  var hariIni = new Date(); hariIni.setHours(0,0,0,0);

  var wilayahFilter = document.getElementById('filterWilayah').value;
  var statusFilter = document.getElementById('filterStatus').value;
  var urutanFilter = document.getElementById('filterUrutan').value;

  // hitung status jatuh tempo tiap baris dulu
  var data = _listOrderanCache.map(function(row) {
    var jt = hitungJatuhTempo(row.tanggal_masuk, row.hari);
    var jtTanpaJam = new Date(jt); jtTanpaJam.setHours(0,0,0,0);
    row._jt = jt;
    row._jatuhTempo = jtTanpaJam <= hariIni;
    return row;
  });

  var jumlahBerjalanTotal = data.filter(function(r) { return !r._jatuhTempo; }).length;
  var jumlahTempoTotal = data.filter(function(r) { return r._jatuhTempo; }).length;
  document.getElementById('pillBerjalan').textContent = 'Berjalan ' + jumlahBerjalanTotal;
  document.getElementById('pillTempo').textContent = 'Jatuh tempo ' + jumlahTempoTotal;

  // terapkan filter
  if (wilayahFilter !== 'semua') data = data.filter(function(r) { return r.lokasi === wilayahFilter; });
  if (statusFilter === 'berjalan') data = data.filter(function(r) { return !r._jatuhTempo; });
  if (statusFilter === 'tempo') data = data.filter(function(r) { return r._jatuhTempo; });

  // terapkan urutan
  data.sort(function(a, b) {
    var ta = new Date(a.created_at).getTime();
    var tb = new Date(b.created_at).getTime();
    return urutanFilter === 'terlama' ? ta - tb : tb - ta;
  });

  if (data.length === 0) {
    wrap.innerHTML = '<p class="empty-state">Tidak ada orderan yang cocok dengan filter ini.</p>';
    return;
  }

  wrap.innerHTML = '';
  window._listCache = {};
  data.forEach(function(row) {
    window._listCache[row.id] = row;
    var aj = labelAntarJemput(row.layanan);
    var tarif = hitungTarif(row.ukuran, row.hari);
    var kodeWilayah = prefixLokasi[row.lokasi] || (row.lokasi || '-');
    var div = document.createElement('div');
    div.className = 'list-row';
    div.innerHTML =
      '<div><p class="list-cell-name">' + row.nama + ' <span class="list-kode">· ' + row.kode + '</span></p><p class="list-cell-nik">' + row.wa + ' · NIK ...' + row.identitas + '</p></div>' +
      '<span class="badge-mini badge-neutral">' + kodeWilayah + '</span>' +
      '<span>' + row.deskripsi + '</span>' +
      '<span>' + row.ukuran.split('-')[0] + ' · ' + row.hari + ' hari</span>' +
      '<span class="badge-mini ' + aj.kelas + '">' + aj.teks + '</span>' +
      '<span style="font-weight:bold">Rp ' + tarif.toLocaleString('id-ID') + '</span>' +
      (row._jatuhTempo
        ? '<span class="jatuh-tempo-warn"><span class="warn-icon">⚠️</span>' + formatTanggalID(row._jt) + '</span>'
        : '<span>' + formatTanggalID(row._jt) + '</span>') +
      (row._jatuhTempo
        ? '<span class="badge-mini badge-danger">Jatuh tempo</span>'
        : '<span class="badge-mini badge-tosca">Berjalan</span>') +
      '<div class="list-row-actions">' +
        '<button class="btn btn-icon" title="Nota" data-list-aksi="nota" data-id="' + row.id + '">🧾</button>' +
        '<button class="btn btn-icon" title="Hapus" data-list-aksi="hapus" data-id="' + row.id + '">🗑️</button>' +
      '</div>';
    wrap.appendChild(div);
  });

  wrap.querySelectorAll('button[data-list-aksi]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (btn.dataset.listAksi === 'nota') { bukaNotaModal(btn.dataset.id); return; }
      hapusOrderanAktif(btn.dataset.id);
    });
  });
}

async function hapusOrderanAktif(id) {
  if (!confirm('Hapus orderan ini secara permanen? Tindakan ini tidak bisa dibatalkan.')) return;
  await db.from('titipan').delete().eq('id', id);
  muatListOrderan();
}

/* =============================================
   TAB: CETAK LABEL
   ============================================= */
document.getElementById('btnCariLabel').addEventListener('click', cariDanTampilkanLabel);
document.getElementById('labelKodeInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') cariDanTampilkanLabel();
});

async function cariDanTampilkanLabel() {
  var kode = document.getElementById('labelKodeInput').value.trim().toUpperCase();
  var msg = document.getElementById('labelSearchMsg');
  var area = document.getElementById('labelPrintArea');
  msg.textContent = '';
  if (!kode) { msg.textContent = 'Masukkan kode booking dulu.'; return; }

  const { data, error } = await db.from('titipan').select('*').eq('kode', kode).maybeSingle();
  if (!data || error) {
    area.style.display = 'none';
    msg.textContent = 'Kode booking tidak ditemukan.';
    return;
  }

  document.getElementById('labelLokasi').textContent = data.lokasi || '-';
  document.getElementById('labelKode').textContent = data.kode;
  document.getElementById('labelNama').textContent = data.nama;
  document.getElementById('labelWa').textContent = data.wa;
  document.getElementById('labelBarang').textContent = data.deskripsi;
  document.getElementById('labelUkuran').textContent = data.ukuran.replace('-', ' - ');
  document.getElementById('labelMasuk').textContent = new Date(data.tanggal_masuk).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

  area.style.display = 'flex';
  terapkanUkuranLabel();

  var qrWrap = document.getElementById('labelQR');
  qrWrap.innerHTML = '';
  try {
    new QRCode(qrWrap, { text: data.kode, width: 90, height: 90, correctLevel: QRCode.CorrectLevel.M });
  } catch (err) {
    console.error('Gagal membuat QR:', err);
    msg.textContent = 'Label tampil, tapi QR gagal dibuat (cek koneksi internet).';
  }
}

/* =============================================
   UKURAN LABEL — scale otomatis biar selalu pas 1 halaman
   ============================================= */
document.getElementById('labelUkuranKertas').addEventListener('change', terapkanUkuranLabel);

function terapkanUkuranLabel() {
  var ukuran = document.getElementById('labelUkuranKertas').value; // contoh: "50x30"
  var parts = ukuran.split('x');
  var targetW = parseFloat(parts[0]);
  var targetH = parseFloat(parts[1]);
  var baseW = 100, baseH = 50; // ukuran desain dasar (mm), jangan diubah

  var target = document.getElementById('labelPrintTarget');
  var card = document.getElementById('labelCard');
  var factor = Math.min(targetW / baseW, targetH / baseH);

  target.style.width = targetW + 'mm';
  target.style.height = targetH + 'mm';
  card.style.transform = 'scale(' + factor + ')';

  var styleTag = document.getElementById('printPageSizeStyle');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'printPageSizeStyle';
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = '@page { size: ' + targetW + 'mm ' + targetH + 'mm; margin: 0; }';
}

document.getElementById('btnPrintLabel').addEventListener('click', function() {
  terapkanUkuranLabel();
  cetakElemen('labelPrintTarget');
});

function cetakElemen(id) {
  var target = document.getElementById(id);
  var originalParent = target.parentNode;
  var originalNextSibling = target.nextSibling;

  // pindahkan keluar dari struktur dashboard (yg tinggi) biar nggak numpuk banyak halaman kosong
  document.body.appendChild(target);
  document.body.classList.add('lagi-print');

  function kembalikan() {
    document.body.classList.remove('lagi-print');
    originalParent.insertBefore(target, originalNextSibling);
    window.removeEventListener('afterprint', kembalikan);
  }
  window.addEventListener('afterprint', kembalikan);

  window.print();
}

/* =============================================
   MODAL NOTA
   ============================================= */
function bukaNotaModal(id) {
  var row = (window._listCache || {})[id];
  if (!row) return;

  var d = hitungTarifDetail(row.ukuran, row.hari);
  var aj = labelAntarJemput(row.layanan);
  var tglMasuk = new Date(row.tanggal_masuk).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

  document.getElementById('notaLokasi').textContent = row.lokasi || '-';
  document.getElementById('notaKode').textContent = row.kode;
  document.getElementById('notaTanggal').textContent = tglMasuk;
  document.getElementById('notaDurasi').textContent = row.hari + ' hari';
  document.getElementById('notaLayanan').textContent = aj.teks;
  document.getElementById('notaDasar').textContent = 'Rp ' + d.tarifHarian.toLocaleString('id-ID') + '/hari';
  document.getElementById('notaDiskon').textContent = d.persenDiskon > 0
    ? '- Rp ' + d.nominalDiskon.toLocaleString('id-ID') + ' (' + (d.persenDiskon * 100) + '%)'
    : 'Tidak ada';
  document.getElementById('notaTotal').textContent = 'Rp ' + d.total.toLocaleString('id-ID');
  document.getElementById('notaDp').textContent = 'Rp ' + d.dp.toLocaleString('id-ID');

  var qrWrap = document.getElementById('notaQR');
  qrWrap.innerHTML = '';
  try {
    new QRCode(qrWrap, { text: row.kode, width: 110, height: 110, correctLevel: QRCode.CorrectLevel.M });
  } catch (err) {
    console.error('Gagal membuat QR nota:', err);
  }

  document.getElementById('notaModalOverlay').classList.add('show');
}
function tutupNotaModal() {
  document.getElementById('notaModalOverlay').classList.remove('show');
}
document.getElementById('btnTutupNota').addEventListener('click', tutupNotaModal);
document.getElementById('notaModalOverlay').addEventListener('click', function(e) {
  if (e.target === this) tutupNotaModal();
});
document.getElementById('btnCetakNota').addEventListener('click', function() {
  cetakElemen('notaPrintTarget');
});

/* =============================================
   REALTIME NOTIFIKASI ORDER BARU
   ============================================= */
var _realtimeAktif = false;
function aktifkanRealtimeNotif() {
  if (_realtimeAktif) return;
  _realtimeAktif = true;
  db.channel('titipan-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'titipan' }, function(payload) {
      mainkanSuaraNotif();
      tampilkanToast('📦 Orderan baru masuk: ' + payload.new.kode);
      muatVerifikasi();
    })
    .subscribe();
}

/* =============================================
   TAB: KEUANGAN
   ============================================= */
document.getElementById('filterCabangKeuangan').addEventListener('change', function() {
  renderSemuaKeuangan(window._keuanganLedgerFull || []);
});

async function muatKeuangan() {
  await muatKategoriPengeluaran();

  const [{ data: aktifRows }, { data: pengeluaranRows }] = await Promise.all([
    db.from('titipan').select('kode, nama, ukuran, hari, lokasi, created_at').eq('status', 'aktif'),
    db.from('pengeluaran').select('*')
  ]);

  var ledger = [];
  (aktifRows || []).forEach(function(row) {
    ledger.push({
      tanggal: new Date(row.created_at),
      keterangan: 'Booking ' + row.kode + ' · ' + row.nama,
      kategori: 'Booking',
      lokasi: row.lokasi || '',
      masuk: hitungTarif(row.ukuran, row.hari),
      keluar: 0,
      bukti: null
    });
  });
  (pengeluaranRows || []).forEach(function(row) {
    ledger.push({
      tanggal: new Date(row.tanggal),
      keterangan: row.keterangan,
      kategori: row.kategori,
      lokasi: row.lokasi || '',
      masuk: 0,
      keluar: Number(row.jumlah),
      bukti: row.bukti_url || null
    });
  });

  ledger.sort(function(a, b) { return a.tanggal - b.tanggal; });
  window._keuanganLedgerFull = ledger;
  renderSemuaKeuangan(ledger);
}

function renderSemuaKeuangan(ledgerFull) {
  var cabang = document.getElementById('filterCabangKeuangan').value;
  var label = document.getElementById('kSaldoLabel');

  var ledger = cabang === 'semua' ? ledgerFull : ledgerFull.filter(function(i) { return i.lokasi === cabang; });
  label.textContent = cabang === 'semua' ? 'Saldo kas saat ini' : 'Saldo bersih cabang ini';

  // hitung ulang saldo berjalan khusus untuk subset yang lagi ditampilkan
  var saldo = 0;
  ledger = ledger.map(function(item) {
    saldo += item.masuk - item.keluar;
    return Object.assign({}, item, { saldo: saldo });
  });

  window._keuanganLedger = ledger;
  renderKeuanganStat(ledger, saldo);
  renderRingkasanPajak(ledger);
  renderTrenChart(ledger);
  renderRiwayatTransaksi(ledger);
}

function renderKeuanganStat(ledger, saldoAkhir) {
  var now = new Date();
  var bulanIni = now.getMonth(), tahunIni = now.getFullYear();
  var pemasukan = 0, pengeluaran = 0;
  ledger.forEach(function(item) {
    if (item.tanggal.getMonth() === bulanIni && item.tanggal.getFullYear() === tahunIni) {
      pemasukan += item.masuk;
      pengeluaran += item.keluar;
    }
  });
  document.getElementById('kPemasukanBulan').textContent = 'Rp ' + pemasukan.toLocaleString('id-ID');
  document.getElementById('kPengeluaranBulan').textContent = 'Rp ' + pengeluaran.toLocaleString('id-ID');
  document.getElementById('kLabaBulan').textContent = 'Rp ' + (pemasukan - pengeluaran).toLocaleString('id-ID');
  document.getElementById('kSaldoKas').textContent = 'Rp ' + saldoAkhir.toLocaleString('id-ID');
}

function renderRingkasanPajak(ledger) {
  var now = new Date();
  var bulanIni = now.getMonth(), tahunIni = now.getFullYear();
  var omzetBulan = 0, bebanBulan = 0, omzetTahun = 0, bebanTahun = 0;
  ledger.forEach(function(item) {
    if (item.tanggal.getFullYear() === tahunIni) {
      omzetTahun += item.masuk;
      bebanTahun += item.keluar;
      if (item.tanggal.getMonth() === bulanIni) {
        omzetBulan += item.masuk;
        bebanBulan += item.keluar;
      }
    }
  });
  var rp = function(n) { return 'Rp ' + Math.round(n).toLocaleString('id-ID'); };
  document.getElementById('pOmzetBulan').textContent = rp(omzetBulan);
  document.getElementById('pOmzetTahun').textContent = rp(omzetTahun);
  document.getElementById('pBebanBulan').textContent = rp(bebanBulan);
  document.getElementById('pBebanTahun').textContent = rp(bebanTahun);
  document.getElementById('pLabaBulan').textContent = rp(omzetBulan - bebanBulan);
  document.getElementById('pLabaTahun').textContent = rp(omzetTahun - bebanTahun);
  document.getElementById('pPphBulan').textContent = rp(omzetBulan * 0.005);
  document.getElementById('pPphTahun').textContent = rp(omzetTahun * 0.005);
}

function renderTrenChart(ledger) {
  var hariLabel = [];
  var pemasukanHarian = [];
  var pengeluaranHarian = [];
  for (var i = 6; i >= 0; i--) {
    var d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
    var masuk = 0, keluar = 0;
    ledger.forEach(function(item) {
      var t = new Date(item.tanggal); t.setHours(0,0,0,0);
      if (t.getTime() === d.getTime()) { masuk += item.masuk; keluar += item.keluar; }
    });
    pemasukanHarian.push(masuk);
    pengeluaranHarian.push(keluar);
  }

  var maxVal = Math.max.apply(null, pemasukanHarian.concat(pengeluaranHarian, [1]));
  function ke_titik(arr) {
    return arr.map(function(v, i) {
      var x = (560 / 6) * i;
      var y = 110 - (v / maxVal) * 100;
      return x + ',' + y;
    }).join(' ');
  }

  var svg = document.getElementById('trenChart');
  svg.innerHTML =
    '<polyline points="' + ke_titik(pemasukanHarian) + '" fill="none" stroke="#00b89c" stroke-width="3"/>' +
    '<polyline points="' + ke_titik(pengeluaranHarian) + '" fill="none" stroke="#c62828" stroke-width="2" stroke-dasharray="4 3"/>';
}

function renderRiwayatTransaksi(ledger) {
  var wrap = document.getElementById('riwayatTransaksiBody');
  if (ledger.length === 0) {
    wrap.innerHTML = '<p class="empty-state">Belum ada transaksi tercatat.</p>';
    return;
  }
  var terbaruDulu = ledger.slice().reverse();
  wrap.innerHTML = '';
  terbaruDulu.forEach(function(item) {
    var div = document.createElement('div');
    div.className = 'list-row keuangan-row';
    div.innerHTML =
      '<span>' + formatTanggalID(item.tanggal) + '</span>' +
      '<span>' + item.keterangan + '</span>' +
      '<span>' + item.kategori + '</span>' +
      '<span class="keuangan-masuk">' + (item.masuk > 0 ? 'Rp ' + item.masuk.toLocaleString('id-ID') : '–') + '</span>' +
      '<span class="keuangan-keluar">' + (item.keluar > 0 ? 'Rp ' + item.keluar.toLocaleString('id-ID') : '–') + '</span>' +
      '<span class="keuangan-saldo">Rp ' + item.saldo.toLocaleString('id-ID') + '</span>' +
      '<span>' + (item.bukti ? '<a href="' + item.bukti + '" target="_blank" rel="noopener">📎 Lihat</a>' : '–') + '</span>';
    wrap.appendChild(div);
  });
}

/* =============================================
   KATEGORI PENGELUARAN
   ============================================= */
async function muatKategoriPengeluaran() {
  const { data } = await db.from('kategori_pengeluaran').select('nama').order('nama', { ascending: true });
  var sel = document.getElementById('pengeluaranKategori');
  var opsiLama = sel.querySelectorAll('option[data-kategori]');
  opsiLama.forEach(function(o) { o.remove(); });
  (data || []).forEach(function(row) {
    var opt = document.createElement('option');
    opt.value = row.nama;
    opt.textContent = row.nama;
    opt.setAttribute('data-kategori', '1');
    sel.insertBefore(opt, sel.firstChild);
  });
}

document.getElementById('pengeluaranKategori').addEventListener('change', function() {
  document.getElementById('wrapKategoriBaru').style.display = this.value === '__baru__' ? 'block' : 'none';
});

document.getElementById('pengeluaranBukti').addEventListener('change', function(e) {
  var file = e.target.files[0];
  var preview = document.getElementById('pengeluaranBuktiPreview');
  if (!file) { preview.style.display = 'none'; return; }
  var reader = new FileReader();
  reader.onload = function(ev) {
    preview.src = ev.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
});

/* =============================================
   KOMPRESI GAMBAR sebelum upload (canvas resize)
   ============================================= */
function kompresGambar(file, maxDim, kualitas) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round(h * (maxDim / w)); w = maxDim; }
        else if (h > maxDim) { w = Math.round(w * (maxDim / h)); h = maxDim; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) {
          if (blob) resolve(blob); else reject(new Error('Gagal kompres gambar'));
        }, 'image/jpeg', kualitas || 0.7);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =============================================
   MODAL TAMBAH PENGELUARAN
   ============================================= */
document.getElementById('btnTambahPengeluaran').addEventListener('click', function() {
  document.getElementById('formPengeluaran').reset();
  document.getElementById('pengeluaranTanggal').value = new Date().toISOString().slice(0, 10);
  document.getElementById('wrapKategoriBaru').style.display = 'none';
  document.getElementById('pengeluaranBuktiPreview').style.display = 'none';
  document.getElementById('pengeluaranModalOverlay').classList.add('show');
});
function tutupPengeluaranModal() {
  document.getElementById('pengeluaranModalOverlay').classList.remove('show');
}
document.getElementById('btnTutupPengeluaran').addEventListener('click', tutupPengeluaranModal);
document.getElementById('btnBatalPengeluaran').addEventListener('click', tutupPengeluaranModal);
document.getElementById('pengeluaranModalOverlay').addEventListener('click', function(e) {
  if (e.target === this) tutupPengeluaranModal();
});

document.getElementById('formPengeluaran').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = document.getElementById('btnSimpanPengeluaran');
  var fileInput = document.getElementById('pengeluaranBukti');
  var file = fileInput.files[0];

  if (!file) { alert('Foto bukti nota/transfer wajib diupload.'); return; }

  btn.disabled = true;
  btn.textContent = '⏳ Mengupload foto...';

  try {
    var kategoriPilihan = document.getElementById('pengeluaranKategori').value;
    var kategoriFinal = kategoriPilihan;

    if (kategoriPilihan === '__baru__') {
      kategoriFinal = document.getElementById('pengeluaranKategoriBaru').value.trim();
      if (!kategoriFinal) { alert('Nama kategori baru wajib diisi.'); btn.disabled = false; btn.textContent = 'Simpan pengeluaran'; return; }
      await db.from('kategori_pengeluaran').upsert({ nama: kategoriFinal }, { onConflict: 'nama' });
    }

    var blob = await kompresGambar(file, 1000, 0.7);
    var namaFile = 'bukti-' + Date.now() + '.jpg';
    const { error: uploadError } = await db.storage.from('bukti-pengeluaran').upload(namaFile, blob, { contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;
    const { data: urlData } = db.storage.from('bukti-pengeluaran').getPublicUrl(namaFile);

    await db.from('pengeluaran').insert({
      tanggal: document.getElementById('pengeluaranTanggal').value,
      keterangan: document.getElementById('pengeluaranKeterangan').value,
      kategori: kategoriFinal,
      lokasi: document.getElementById('pengeluaranLokasi').value || null,
      jumlah: parseFloat(document.getElementById('pengeluaranJumlah').value) || 0,
      bukti_url: urlData.publicUrl
    });

    btn.disabled = false;
    btn.textContent = 'Simpan pengeluaran';
    tutupPengeluaranModal();
    muatKeuangan();
  } catch (err) {
    console.error('Gagal simpan pengeluaran:', err);
    alert('Gagal menyimpan: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Simpan pengeluaran';
  }
});

/* =============================================
   EXPORT PDF — riwayat transaksi
   ============================================= */
document.getElementById('btnExportPdf').addEventListener('click', function() {
  var rows = document.getElementById('riwayatTransaksiBody').innerHTML;
  var headHtml = '<div class="list-row keuangan-row keuangan-head"><span>Tanggal</span><span>Keterangan</span><span>Kategori</span><span>Masuk</span><span>Keluar</span><span>Saldo</span><span>Bukti</span></div>';

  var target = document.createElement('div');
  target.id = 'exportPdfTarget';
  target.className = 'cetak-target export-pdf-wrap';
  target.innerHTML =
    '<h2 style="color:#005a4e">NitipBox — Riwayat Transaksi Keuangan</h2>' +
    '<p style="font-size:12px;color:#888;margin-bottom:14px">Dicetak: ' + new Date().toLocaleString('id-ID') + '</p>' +
    '<div class="list-table">' + headHtml + rows + '</div>';

  document.body.appendChild(target);
  document.body.classList.add('lagi-print');

  function bersihkan() {
    document.body.classList.remove('lagi-print');
    target.remove();
    window.removeEventListener('afterprint', bersihkan);
  }
  window.addEventListener('afterprint', bersihkan);

  window.print();
});

/* =============================================
   START
   ============================================= */
cekSesiLogin();
db.auth.onAuthStateChange(function() { cekSesiLogin(); });
