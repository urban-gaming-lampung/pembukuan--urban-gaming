/**
 * Ganti window.alert bawaan browser (kasar & memblok layar di HP) dengan toast UDS
 * (ToastKapsul kaca di atas layar) — berlaku global tanpa mengubah pemanggil alert().
 * Nada (berhasil / gagal / peringatan) ditebak dari isi pesan, emoji dibuang.
 *
 * confirm() & prompt() TIDAK diganti di sini karena butuh jawaban sinkron —
 * pakai `await konfirmasi(...)` / `await tanya(...)` dari `src/ui`.
 */
import { notify } from "../ui/presentations/Pemberitahuan";

export const showToast = (message: unknown): void => notify(message);

if (typeof window !== "undefined") {
  window.alert = (message?: unknown) => notify(message);
}
