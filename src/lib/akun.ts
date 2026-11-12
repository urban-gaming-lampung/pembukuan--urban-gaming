/**
 * KONFIRMASI AKUN — aksi penting (hapus pembukuan, backup / restore / reset) dikonfirmasi
 * dengan PASSWORD AKUN yang sedang login. Firebase yang memeriksa, jadi tidak ada password
 * bersama yang tersimpan di kode aplikasi.
 */
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "./firebase";

const PESAN_GAGAL: Record<string, string> = {
  "auth/wrong-password": "Password salah.",
  "auth/invalid-credential": "Password salah.",
  "auth/invalid-login-credentials": "Password salah.",
  "auth/missing-password": "Masukkan password akun Anda.",
  "auth/too-many-requests": "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.",
  "auth/network-request-failed": "Tidak ada koneksi internet. Coba lagi.",
  "auth/user-mismatch": "Akun tidak cocok. Silakan login ulang.",
  "auth/user-not-found": "Akun tidak ditemukan. Silakan login ulang.",
};

/** Cek password akun yang sedang login. Gagal -> Error dengan pesan siap tampil. */
export async function verifikasiPasswordAkun(password: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
  if (!password) throw new Error("Masukkan password akun Anda.");
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } catch (e: any) {
    throw new Error(PESAN_GAGAL[e?.code] || "Verifikasi gagal. Coba lagi.");
  }
}
