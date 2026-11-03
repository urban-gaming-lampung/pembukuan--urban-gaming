/**
 * Koleksi Firestore `users` dipakai bersama oleh aplikasi lain di project
 * Firebase yang sama (ProsperoEden / launcher PS5). ProsperoEden menyimpan
 * profil dengan ID dokumen = Firebase Auth UID (tanpa "@"), sedangkan akun
 * pegawai/owner URBAN SELALU disimpan dengan ID dokumen = email.
 *
 * Pakai helper ini setiap kali membaca seluruh koleksi `users`, supaya akun
 * ProsperoEden tidak ikut tampil / terhitung di pembukuan URBAN.
 */
export const isUrbanUserDocId = (id: unknown): id is string =>
  typeof id === "string" && id.includes("@");
