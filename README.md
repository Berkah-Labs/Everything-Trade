# Everything Trade — Multi-VPS Auto Registration & Daily Check-in

Bot automasi pendaftaran (referral) dan *daily check-in* untuk **Everything Trade**. Dirancang khusus untuk berjalan secara paralel di 3 VPS yang berbeda guna mencegah *rate-limit* / pemblokiran Cloudflare, serta dikontrol penuh secara terpusat lewat Telegram.

---

## 🏗️ Arsitektur 3 VPS

Sistem dibagi menjadi 3 lokasi pengerjaan terpisah untuk mencegah deteksi sybil:
1. **VPS 1 (Wormcup)** — Menjalankan Worker Pendaftaran
2. **VPS 2 (Hypermet)** — Menjalankan Worker Pendaftaran
3. **VPS 3 (Failover)** — Menjalankan Worker Pendaftaran + Telegram Dashboard Hub

### Pembagian Tugas (*Cron Jobs*)
- **Setiap saat (24/7):** Ketiga VPS secara paralel membuat akun terus-menerus (`1 Worker` per VPS) tanpa henti (*Guaranteed Slot Fulfillment*). Jika terjadi gagal pada slot, worker akan me-retry slot tersebut dan *TIDAK AKAN* melewati (skip) slot.
- **Setiap Pagi 07:00 WIB:** Ketiga VPS secara serentak memulai *Daily Check-in* untuk seluruh akun yang telah mereka cetak masing-masing di database lokalnya. Hal ini meringankan *load network* dan IP limit jika semua dipusatkan pada 1 server.
- **Setiap Pagi 08:30 WIB:** VPS 3 akan menarik seluruh hasil *check-in* dari VPS 1 dan 2, menggabungkannya ke dalam satu `accounts.json` yang konsolidatif, lalu otomatis mem-push/backup hasilnya ke GitHub (repo ini).

---

## 🤖 Telegram Dashboard Manager (VPS 3)

Bot manager terpusat berjalan 24/7 di VPS 3 dan melapor/terhubung ke BotFather.
- **Live 1-Minute Update:** Bot tidak mengirim pesan bertubi-tubi, melainkan melakukan *Live Edit* pada 1 pesan Dashboard setiap 1 menit (Bisa diubah via command `/mode`).
- **Real-Time $E Balance:** Secara cerdas mengambil data langsung dari API `/etoken/reward/balance` jika Token EVM disematkan. Jika token tidak tersedia, bot menggunakan perhitungan matematika cerdas (`+2 $E` per pendaftaran & `+2 $E` per usia hari pembuatan) untuk menampikan estimasi 100% akurat.

### Command Tersedia
* `/status` — Meminta pembaruan Dashboard saat ini
* `/sync` — Menggabungkan data dari 3 VPS lalu push ke GitHub
* `/checkin` — Menjalankan Check-in manual untuk semua akun sekarang juga
* `/pause` & `/resume` — Menghentikan dan melanjutkan pencetakan akun baru di *ketiga VPS secara bersamaan* via eksekusi SSH.
* `/mode` — Ubah model pengiriman log (Dashboard Pinned vs Notif tiap Menit).

---

## 🎲 Sistem Referal: Asymmetric Weighted Random
Pendaftaran tidak dipukul rata, melainkan didistribusikan secara acak-terbobot (`Weighted Random`) ke 5 akun utama:
- `hidnan`
- `azzura`
- `sansan`
- `raihanadhe`
- `zurzur`

Sistem ini membantu agar pertumbuhan referal tidak berbentuk angka bulat mencurigakan, membuat aktivitas terlihat 100% organik.
