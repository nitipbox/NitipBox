// ⚠️ ISI SAMA PERSIS seperti nilai yang sudah kamu isi di app.js (project Supabase yang sama)
const SUPABASE_URL = 'Https://NitipBox.my.id'
const SUPABASE_KEY = 'sb_publishable_NMoOIVW_lTA1lMsdkG2x1A_Qj0iRFIu'
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

var basisTarif = { "Kecil-S": 3000, "Sedang-M": 7000, "Besar-L": 12000, "Sangat Besar-XL": 20000, "Super Besar-XXL+": 50000 };

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
  db.auth.signInWithOAuth({ provider: 'google' });
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

/* =============================================
   MUAT SEMUA DATA
   ============================================= */
function muatSemuaData() {
  muatVerifikasi();
  muatListOrderan();
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
  pending.forEach(function(row) {
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
        '<button class="btn btn-icon" title="Hapus permanen" data-aksi="hapus" data-id="' + row.id + '">🗑️</button>' +
        '<button class="btn btn-ghost" data-aksi="tolak" data-id="' + row.id + '">Tolak</button>' +
        '<button class="btn btn-tosca-solid" data-aksi="konfirmasi" data-id="' + row.id + '">Konfirmasi</button>' +
      '</div>';
    wrap.appendChild(div);
  });

  wrap.querySelectorAll('button[data-aksi]').forEach(function(btn) {
    btn.addEventListener('click', function() { prosesAksiVerifikasi(btn.dataset.aksi, btn.dataset.id); });
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
   TAB: LIST ORDERAN
   ============================================= */
async function muatListOrderan() {
  const { data } = await db.from('titipan').select('*').eq('status', 'aktif').order('created_at', { ascending: false });
  var wrap = document.getElementById('listOrderanBody');

  var hariIni = new Date(); hariIni.setHours(0,0,0,0);
  var jumlahBerjalan = 0, jumlahTempo = 0;

  if (!data || data.length === 0) {
    wrap.innerHTML = '<p class="empty-state">Belum ada orderan berjalan.</p>';
    document.getElementById('pillBerjalan').textContent = 'Berjalan 0';
    document.getElementById('pillTempo').textContent = 'Jatuh tempo 0';
    return;
  }

  wrap.innerHTML = '';
  data.forEach(function(row) {
    var jt = hitungJatuhTempo(row.tanggal_masuk, row.hari);
    var jtTanpaJam = new Date(jt); jtTanpaJam.setHours(0,0,0,0);
    var sudahJatuhTempo = jtTanpaJam <= hariIni;
    if (sudahJatuhTempo) jumlahTempo++; else jumlahBerjalan++;

    var aj = labelAntarJemput(row.layanan);
    var div = document.createElement('div');
    div.className = 'list-row';
    div.innerHTML =
      '<div><p class="list-cell-name">' + row.nama + '</p><p class="list-cell-nik">NIK ...' + row.identitas + '</p></div>' +
      '<span class="list-kode">' + row.kode + '</span>' +
      '<span>' + row.ukuran.split('-')[0] + ' · ' + row.hari + ' hari</span>' +
      '<span class="badge-mini ' + aj.kelas + '">' + aj.teks + '</span>' +
      (sudahJatuhTempo
        ? '<span class="jatuh-tempo-warn"><span class="warn-icon">⚠️</span>' + formatTanggalID(jt) + '</span>'
        : '<span>' + formatTanggalID(jt) + '</span>') +
      (sudahJatuhTempo
        ? '<span class="badge-mini badge-danger">Jatuh tempo</span>'
        : '<span class="badge-mini badge-tosca">Berjalan</span>');
    wrap.appendChild(div);
  });

  document.getElementById('pillBerjalan').textContent = 'Berjalan ' + jumlahBerjalan;
  document.getElementById('pillTempo').textContent = 'Jatuh tempo ' + jumlahTempo;
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

  JsBarcode('#labelBarcode', data.kode, { format: 'CODE128', width: 2, height: 50, displayValue: false, margin: 0 });

  area.style.display = 'flex';
}

document.getElementById('btnPrintLabel').addEventListener('click', function() { window.print(); });

/* =============================================
   REALTIME NOTIFIKASI ORDER BARU
   ============================================= */
function aktifkanRealtimeNotif() {
  db.channel('titipan-realtime')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'titipan' }, function(payload) {
      mainkanSuaraNotif();
      tampilkanToast('📦 Orderan baru masuk: ' + payload.new.kode);
      muatVerifikasi();
    })
    .subscribe();
}

/* =============================================
   START
   ============================================= */
cekSesiLogin();
db.auth.onAuthStateChange(function() { cekSesiLogin(); });
