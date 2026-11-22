/**
 * NAVIGASI UTAMA — satu lapis tab bar (HP: tab bar bawah, laptop: sidebar).
 *
 *  Admin           : Monitoring · Pembukuan · Stok
 *  Owner / s.admin : Monitoring · Pembukuan · Stok · Analitik · Lainnya
 *
 * Di dalam halaman paling banyak SATU baris segmen (SubTabs). Halaman yang jarang
 * dibuka (Transaksi owner, Pegawai, Request edit, Log) dikumpulkan di "Lainnya"
 * sebagai daftar ala iOS, lalu dibuka dengan tombol kembali.
 *
 * Kunci tab lama dipertahankan ("USAHA RENTAL", "UPDATE STOK") karena dipakai
 * presence (chip pengguna aktif), draft formulir, dan riwayat data.
 */
export type TabUtama = "USAHA RENTAL" | "UPDATE STOK" | "MONITORING" | "ANALITIK" | "LAINNYA";

/** Segmen halaman Monitoring: Status · Booking · Kondisi (+ Stiker khusus owner: buat & daftar stiker unit). */
export type SegmenMonitoring = "status" | "booking" | "device" | "stiker";

/** Halaman di dalam menu Lainnya (owner). */
export type HalamanLainnya = "TRANSAKSI" | "PEGAWAI" | "REQUEST" | "LOG";
