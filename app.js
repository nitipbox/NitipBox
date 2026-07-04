// ⚠️ GANTI dengan URL & Key project Supabase NitipBox kamu (project baru, terpisah dari NitipJual)
const SUPABASE_URL = 'https://tevehzihkqhqmxlrtdhl.supabase.co'
const SUPABASE_KEY = 'sb_publishable_NMoOIVW_lTA1lMsdkG2x1A_Qj0iRFIu'
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

/* =============================================
   DATA LOKASI — edit di sini untuk ubah/tambah point
   ============================================= */
var datLokasi = [
  { nama: "Surabaya", alamat: "Manukan Wasono V No.9 Blok 23C", area: "Surabaya Barat, Kec. Tandes, Surabaya", jam: "Senin–Minggu: 08.00–21.00", wa: "6285174271037", status: "aktif" },
  { nama: "Sidoarjo", alamat: "Jl. Raya Kundi No.63, Belakang Warkop Caisar", area: "Wadungasri, Kec. Waru, Sidoarjo", jam: "Senin–Minggu: 08.00–21.00", wa: "6285731283199", status: "aktif" },
  { nama: "Sidoarjo 2 (Back Up)", alamat: "", area: "Tambaksumur, Kec. Waru, Sidoarjo", jam: "Senin–Minggu: 08.00–21.00", wa: "6281336076175", status: "aktif" }
];

function renderLokasi() {
  var grid = document.getElementById("lokasiGrid");
  grid.innerHTML = "";
  datLokasi.forEach(function(loc) {
    var isAktif = loc.status === "aktif";
    var card = document.createElement("div");
    card.className = "lokasi-card" + (isAktif ? "" : " coming");
    card.innerHTML =
      '<div class="lokasi-card-top"><div class="lokasi-icon-wrap">📦</div>' +
      '<span class="' + (isAktif ? "lokasi-badge-aktif" : "lokasi-badge-segera") + '">' + (isAktif ? "✅ Aktif" : "🔜 Segera Hadir") + '</span></div>' +
      '<p class="lokasi-nama">' + loc.nama + '</p>' +
      '<p class="lokasi-area">' + loc.area + '</p>' +
      '<div class="lokasi-info">' +
      (loc.alamat ? '<span><span>📌</span>' + loc.alamat + '</span>' : '') +
      '<span><span>🕐</span>' + loc.jam + '</span></div>' +
      '<hr class="lokasi-divider">' +
      (isAktif && loc.wa
        ? '<a href="https://wa.me/' + loc.wa + '?text=Halo%20NitipBox%20' + encodeURIComponent(loc.nama) + '!%20Saya%20ingin%20bertanya%20tentang%20layanan%20penitipan." class="btn-wa-lokasi" target="_blank">💬 Hubungi Point Ini</a>'
        : '<div class="btn-wa-disabled">🔜 Segera Hadir</div>');
    grid.appendChild(card);
  });
}

function isiDropdownLokasi() {
  var sel = document.getElementById("selectLokasi");
  datLokasi.forEach(function(loc) {
    var opt = document.createElement("option");
    opt.value = loc.nama;
    opt.textContent = loc.nama + " — " + loc.area;
    if (loc.status !== "aktif") { opt.disabled = true; opt.textContent += " (Segera Hadir)"; }
    sel.appendChild(opt);
  });
}

/* =============================================
   VARIABEL UTAMA
   ============================================= */
var basisTarif = { "Kecil-S": 3000, "Sedang-M": 7000, "Besar-L": 12000, "Sangat Besar-XL": 20000, "Super Besar-XXL+": 50000 };
var nomorWAAdmin = "6285174271037";
var kodeBookingGlobal = "";
var lokasiBookingGlobal = "";

window.onload = function() {
  renderLokasi();
  isiDropdownLokasi();
  hitungKalkulatorTarif();
  initPromo();
};

/* =============================================
   FUNGSI TAB
   ============================================= */
function switchTab(target) {
  document.querySelectorAll('.tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
  document.querySelectorAll('.content-section').forEach(function(sec) { sec.classList.remove('active'); });
  event.target.classList.add('active');
  document.getElementById('section-' + target).classList.add('active');
}

/* =============================================
   GENERATE KODE BOOKING (ganti logic scan spreadsheet)
   ============================================= */
var prefixLokasi = { "Surabaya": "SBY", "Sidoarjo": "SDA01", "Sidoarjo 2 (Back Up)": "SDA02" }

async function generateKodeBooking(lokasi) {
  const kodeWilayah = prefixLokasi[lokasi] || "UMUM"
  const prefix = "NTB-" + kodeWilayah
  const { data } = await db.from('titipan').select('kode').ilike('kode', prefix + '-%').order('created_at', { ascending: false }).limit(200)
  let maxNomor = 0
  ;(data || []).forEach(row => {
    const angka = parseInt((row.kode || '').replace(prefix + '-', ''), 10)
    if (!isNaN(angka) && angka > maxNomor) maxNomor = angka
  })
  return prefix + "-" + String(maxNomor + 1).padStart(3, '0')
}
/* =============================================
   SUBMIT FORM ORDER (Supabase, gantikan simpanDataJasa)
   ============================================= */
async function submitFormOrder(form) {
  event.preventDefault();
  var btn = document.getElementById("btnOrder");
  btn.innerHTML = "⏳ Memproses Booking...";
  btn.disabled = true;
  var lokasiPilihan = document.getElementById("selectLokasi").value;
  var refInput = document.getElementById("inputReferral");
  var refKode = refInput && refInput.value.trim() ? refInput.value.trim().toUpperCase() : null;

  try {
   const kode = await generateKodeBooking(lokasiPilihan)
    const { error } = await db.from('titipan').insert({
      kode,
      tanggal_masuk: form.tanggal.value,
      nama: form.nama.value,
      wa: form.wa.value,
      deskripsi: form.deskripsi.value,
      ukuran: form.ukuran.value,
      hari: parseInt(form.hari.value) || 1,
      layanan: form.layanan.value,
      identitas: form.identitas.value,
      lokasi: lokasiPilihan,
      referral_kode: refKode,
      status: 'booking'
    })
    btn.innerHTML = "🟢 KIRIM FORM ORDERAN";
    btn.disabled = false;
    if (error) { alert("Terjadi kesalahan: " + error.message); return }
    kodeBookingGlobal = kode;
    lokasiBookingGlobal = lokasiPilihan;
    tampilkanSukses(kode);
  } catch (err) {
    btn.innerHTML = "🟢 KIRIM FORM ORDERAN";
    btn.disabled = false;
    alert("Terjadi kesalahan: " + err.message);
  }
}

function tampilkanSukses(kode) {
  document.getElementById("formWrapper").style.display = "none";
  document.getElementById("kodeDisplay").textContent = kode;
  document.getElementById("suksesCard").classList.add("active");
}

function kirimKeWA() {
  var kode = kodeBookingGlobal;
  var lokasi = lokasiBookingGlobal ? lokasiBookingGlobal : "-";
  var refInput = document.getElementById("inputReferral");
  var refKode = refInput && refInput.value.trim() ? refInput.value.trim().toUpperCase() : "";
  var pesan = "Halo Admin NitipBox! 👋\n\nSaya baru saja melakukan booking melalui website.\n\n"
            + "📦 *KODE BOOKING SAYA: " + kode + "*\n"
            + "📍 *Lokasi Pilihan: " + lokasi + "*\n"
            + (refKode ? "🎟️ *Kode Referral: " + refKode + "*\n" : "")
            + "\nMohon konfirmasinya ya. Terima kasih! 🙏";
  var url = "https://wa.me/" + nomorWAAdmin + "?text=" + encodeURIComponent(pesan);
  window.open(url, "_blank");
}

function orderLagi() {
  document.getElementById("formWrapper").style.display = "block";
  document.getElementById("suksesCard").classList.remove("active");
  document.getElementById("formJasa").reset();
  kodeBookingGlobal = "";
  lokasiBookingGlobal = "";
}

/* =============================================
   CEK JATUH TEMPO (Supabase, gantikan cekJatuhTempo)
   ============================================= */
async function prosesCekTempo() {
  var kode = document.getElementById("tempoKode").value.trim();
  var divRes = document.getElementById("resTempo");
  var btn = document.getElementById("btnTempo");
  if (!kode) { alert("Harap isi kode booking Anda!"); return; }
  btn.innerHTML = "⏳ Melacak..."; btn.disabled = true; divRes.style.display = "none";

  const { data, error } = await db.from('titipan').select('*').eq('kode', kode).maybeSingle()
  btn.innerHTML = "🔍 TRACK STATUS"; btn.disabled = false; divRes.style.display = "block";
  if (data && !error) {
    var tglStr = new Date(data.tanggal_masuk).toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric' })
    divRes.className = "result-box success-res";
    divRes.innerHTML = "<strong>✅ Data Valid!</strong><br>👤 Pelanggan: " + data.nama + "<br>📦 Barang: " + data.deskripsi + "<br>📅 Rencana Masuk: " + tglStr + "<br>⏳ Durasi: " + data.hari + " Hari<br>⚡ <strong>Status: " + (data.status || 'Booking') + "</strong>";
  } else {
    divRes.className = "result-box fail-res";
    divRes.innerHTML = "<strong>❌ Data Tidak Ditemukan!</strong><br>Periksa kembali kode booking NTB-xxxx Anda.";
  }
}

/* =============================================
   KALKULATOR TARIF
   ============================================= */
function hitungKalkulatorTarif() {
  var ukuran = document.getElementById("tarifUkuran").value;
  var hari = parseInt(document.getElementById("tarifHari").value) || 1;
  var hargaHarian = basisTarif[ukuran] || 0;
  var totalKotor = hargaHarian * hari;
  var persenDiskon = 0; var teksDiskon = "0%";
  if (hari >= 30) { persenDiskon = 0.30; teksDiskon = "30%"; }
  else if (hari >= 7) { persenDiskon = 0.15; teksDiskon = "15%"; }
  var nilaiPotongan = totalKotor * persenDiskon;
  var totalAkhir = Math.ceil((totalKotor - nilaiPotongan) / 100) * 100;
  var dpAkhir = Math.ceil((totalAkhir * 0.30) / 1000) * 1000;
  document.getElementById("outTarifDasar").innerHTML = "Rp " + hargaHarian.toLocaleString('id-ID') + " / hari";
  document.getElementById("outHari").innerHTML = hari + " Hari";
  document.getElementById("outKotor").innerHTML = "Rp " + totalKotor.toLocaleString('id-ID');
  document.getElementById("outDiskon").innerHTML = "- Rp " + nilaiPotongan.toLocaleString('id-ID') + " (" + teksDiskon + ")";
  document.getElementById("outTotal").innerHTML = "Rp " + totalAkhir.toLocaleString('id-ID');
  document.getElementById("outDp").innerHTML = "Rp " + dpAkhir.toLocaleString('id-ID');
}

/* =============================================
   SYARAT & KETENTUAN MODAL
   ============================================= */
function bukaSK() {
  document.getElementById("skModal").classList.add("active");
  document.body.style.overflow = "hidden";
}
function tutupSK() {
  document.getElementById("skModal").classList.remove("active");
  document.body.style.overflow = "";
}
function setujuSK() {
  document.getElementById("checkSK").checked = true;
  tutupSK();
}
document.addEventListener('DOMContentLoaded', function() {
  var modal = document.getElementById("skModal")
  if (modal) modal.addEventListener("click", function(e) { if (e.target === this) tutupSK(); })
})

/* =============================================
   PROMO BANNER & COUNTDOWN
   ============================================= */
var PROMO_END = new Date('2026-07-07T23:59:59');
var PROMO_ACTIVE = true;

function initPromo() {
  if (!PROMO_ACTIVE) return;
  var now = new Date();
  if (now < PROMO_END) {
    document.getElementById('promoBanner').classList.add('active');
    updateCountdown();
    setInterval(updateCountdown, 1000);
  }
}
function updateCountdown() {
  var now = new Date();
  var diff = PROMO_END - now;
  if (diff <= 0) { document.getElementById('promoBanner').classList.remove('active'); return; }
  var hari = Math.floor(diff / (1000 * 60 * 60 * 24));
  var jam = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var menit = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  var detik = Math.floor((diff % (1000 * 60)) / 1000);
  document.getElementById('cdHari').textContent = String(hari).padStart(2,'0');
  document.getElementById('cdJam').textContent = String(jam).padStart(2,'0');
  document.getElementById('cdMenit').textContent = String(menit).padStart(2,'0');
  document.getElementById('cdDetik').textContent = String(detik).padStart(2,'0');
}

/* =============================================
   REFERRAL TOGGLE
   ============================================= */
function toggleRef(el) {
  var field = document.getElementById('refField');
  field.classList.toggle('open');
  el.textContent = field.classList.contains('open')
    ? '🎟️ Sembunyikan kode referral'
    : '🎟️ Punya kode referral? Klik di sini';
}

/* =============================================
   CAPTURE LEADS (Supabase, gantikan simpanLeads)
   ============================================= */
async function simpanLeadsForm() {
  var nama = document.getElementById('leadsNama').value.trim();
  var wa = document.getElementById('leadsWa').value.trim();
  if (!nama || !wa) {
    if (!nama) document.getElementById('leadsNama').style.outline = '2px solid #f1b813';
    if (!wa) document.getElementById('leadsWa').style.outline = '2px solid #f1b813';
    return;
  }
  await db.from('leads').insert({ nama: nama, wa: wa })
  document.querySelector('.leads-form-row').style.display = 'none';
  document.getElementById('leadsSuccess').style.display = 'block';
}

/* =============================================
   FAQ
   ============================================= */
function toggleFaq(el) {
  var item = el.parentElement;
  var isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(function(i) { i.classList.remove('open'); });
  if (!isOpen) { item.classList.add('open'); }
}
function filterFaq(cat, btn) {
  document.querySelectorAll('.faq-cat-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('.faq-item').forEach(function(item) {
    item.style.display = (cat === 'semua' || item.getAttribute('data-cat') === cat) ? 'block' : 'none';
  });
}
