# Perbaikan penyimpanan gaji dan Edit Rincian

## Temuan dari kode

- `useAppController.ts`: penyimpanan otomatis semua daftar harga dipicu oleh `hydrated`, yang ditandai siap oleh listener **history_pembukuan**, bukan listener pengaturan. Jika history datang lebih dahulu, harga bawaan dapat menimpa rincian server. Pembacaan snapshot pengaturan juga memicu penulisan balik seluruh daftar dari setiap perangkat.
- `Input.tsx`, `useAppController.ts`, `TabPegawai.tsx`: penambahan denda, pembuatan bulan otomatis, dan penyimpanan manual membaca salinan data lalu mengganti seluruh array `records`. `merge: true` tidak menggabungkan isi array. Dua penulis dapat saling menghilangkan tambahan, pengurangan, dan status pembatalan yang sudah tersimpan.
- `TabPegawai.tsx`: efek pembersihan otomatis menghapus dokumen gaji ketika profil tidak ada dalam snapshot users, termasuk pengecualian email hard-coded. Listener cache/urutan kedatangan data bukan bukti bahwa riwayat keuangan boleh dihapus.
- Form gaji sebelumnya menampilkan sukses meskipun fungsi penyimpanan menangkap kegagalan. Edit Rincian menutup formulir tanpa menunggu server dan mengganti draf saat snapshot berubah.
- Query gaji membaca seluruh koleksi tanpa `limit`. Filter 60 hari ada pada history pembukuan dan dapat memengaruhi angka turunan ongkir, tetapi tidak membatasi records gaji atau daftar harga tersimpan.

Pemeriksaan ulang produksi pada 22 September 2026 mengonfirmasi tidak ada konfigurasi TTL dan PITR belum aktif. Rules aktif telah dibandingkan dengan perubahan lokal. Temuan ini membuktikan jalur kerusakan pada source code; penyebab setiap kejadian historis belum bisa dipastikan tanpa log kejadian tersebut.

## Perubahan

- Semua jalur baca-ubah-tulis gaji memakai transaksi Firestore dengan nomor revisi yang bertambah.
- Penyimpanan gaji dari formulir lama ditolak jika records server sudah berubah. Draf tetap terbuka dan pesan konflik menjelaskan langkah pemulihan. Ini sengaja konservatif, termasuk jika ada denda baru saat formulir diedit.
- Snapshot pengaturan hanya membaca. Simpan/reset/restore harga menulis secara eksplisit, menunggu server, membatasi perubahan pada daftar yang dipilih, dan memeriksa benturan dengan data saat formulir dibuka.
- Pembacaan mendukung struktur lama `settings.priceLists` dan struktur utama `priceLists`.
- Pembersihan gaji otomatis dihapus. Menghapus profil pegawai tetap menyimpan dokumen gaji sebagai arsip; profil yang dihapus/nonaktif masih mengikuti filter tampilan yang sudah ada.
- Rules menolak penghapusan dokumen gaji dan settings, mewajibkan revisi saat mengganti records gaji/daftar harga, dan membatasi perubahan daftar harga ke super admin/owner. Aturan umum/fallback dikecualikan agar tidak membatalkan perlindungan ini.
- Penjagaan revisi adalah perlindungan benturan/kompatibilitas aplikasi, bukan audit keamanan menyeluruh. Penulisan denda oleh pegawai tetap mengikuti model akses yang sudah ada.

## Penerapan dan batasan

Rilis 4.2.32 mencakup aplikasi Vercel, GitHub Pages dari `main:/docs`, dan Firestore Rules pada proyek `pembukuan-app-digital-urban`. Aplikasi dipublikasikan sebelum rules diaktifkan. Seluruh perangkat perlu memuat ulang aplikasi: setelah rules baru aktif, versi lama akan ditolak saat menulis gaji/rincian dengan mekanisme lama. Rules ini tidak menghapus atau mereset dokumen yang sudah ada; dokumen tanpa revisi dimulai dari revisi 1 pada penulisan pertama.

Salinan rules produksi, settings, dan lima dokumen gaji sebelum rilis disimpan lokal dalam `BACKUP/persistence-release/` yang diabaikan Git. Cadangan ini tidak dipublikasikan bersama aplikasi.

Data yang sudah tertimpa/terhapus tidak dapat dibuat kembali dari patch ini. Pemulihan memerlukan backup atau fasilitas pemulihan Firestore yang memang tersedia.

Pemeriksaan ulang yang dilakukan atas permintaan penerapan produksi: kompilasi TypeScript, build produksi Vercel dan GitHub Pages, validasi kompilasi rules Firebase, dan 13 kasus aturan pada layanan pengujian Firebase (transaksi owner/staf, revisi kedaluwarsa, aplikasi lama, migrasi revisi, create, delete, anonim, perubahan harga, serta pengaturan lain). Seluruhnya lolos tanpa mengubah dokumen produksi. Formulir dikunci selama penyimpanan agar input tambahan saat menunggu respons tidak tertimpa. Tidak menjalankan QA antarmuka menyeluruh atau simulasi transaksi terhadap data operasional.
