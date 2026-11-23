/**
 * NOMOR WHATSAPP — satu sumber untuk nota POS, nota sewa & pengingat penyewa.
 * Disimpan dalam bentuk lokal 08xx; link wa.me memakai 62xx.
 */

const digit = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** Bentuk simpan 08xx (dari +62 / 62 / 8xx / 08xx). */
export function rapikanWa(s: unknown): string {
  const d = digit(s);
  if (!d) return "";
  if (d.startsWith("62")) return "0" + d.slice(2);
  if (d.startsWith("8")) return "0" + d;
  return d;
}

/** Nomor HP Indonesia: 08 + 8–11 angka (total 10–13 angka). */
export const waValid = (s: unknown) => /^08\d{8,11}$/.test(rapikanWa(s));

/** Untuk link wa.me: 62xxx */
export const waInternasional = (s: unknown) => {
  const d = rapikanWa(s);
  return d.startsWith("0") ? "62" + d.slice(1) : d;
};

/** Tampilan: 0812-3456-7890 */
export const formatWa = (s: unknown) => {
  const d = rapikanWa(s);
  if (d.length < 8) return d;
  return `${d.slice(0, 4)}-${d.slice(4, 8)}-${d.slice(8)}`.replace(/-$/, "");
};

// ---------------------------------------------------------------- aplikasi WhatsApp

/**
 * Aplikasi yang dibuka tombol WA, disimpan per HP (localStorage):
 * - "otomatis": link wa.me (HP memakai aplikasi default / menampilkan pilihan)
 * - "bisnis" / "biasa": di Android langsung membuka WhatsApp Business / WhatsApp biasa.
 *   Bila aplikasinya tidak terpasang, browser kembali ke wa.me. iPhone selalu memakai wa.me.
 */
export type AplikasiWa = "otomatis" | "bisnis" | "biasa";
const KUNCI_APLIKASI_WA = "urban_aplikasi_wa";
const PAKET_WA: Record<Exclude<AplikasiWa, "otomatis">, string> = { bisnis: "com.whatsapp.w4b", biasa: "com.whatsapp" };

export function getAplikasiWa(): AplikasiWa {
  try {
    const v = localStorage.getItem(KUNCI_APLIKASI_WA);
    return v === "bisnis" || v === "biasa" ? v : "otomatis";
  } catch {
    return "otomatis";
  }
}
export function setAplikasiWa(v: AplikasiWa) {
  try { localStorage.setItem(KUNCI_APLIKASI_WA, v); } catch { /* mode privat: abaikan */ }
}
export const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");

/** Link chat WhatsApp berisi pesan, sesuai aplikasi WA pilihan di HP ini. */
export function linkWa(wa: unknown, pesan: string): string {
  const nomor = waInternasional(wa);
  const web = `https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`;
  const app = getAplikasiWa();
  if (app === "otomatis" || !isAndroid()) return web;
  return `intent://send?phone=${nomor}&text=${encodeURIComponent(pesan)}#Intent;scheme=whatsapp;package=${PAKET_WA[app]};S.browser_fallback_url=${encodeURIComponent(web)};end`;
}

/** Buka chat WA. Link aplikasi Android (intent) dibuka di tab ini agar tidak meninggalkan tab kosong. */
export function bukaWa(wa: unknown, pesan: string) {
  const url = linkWa(wa, pesan);
  if (url.startsWith("intent:")) window.location.href = url;
  else window.open(url, "_blank", "noopener");
}
