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

/** Link chat WhatsApp berisi pesan. */
export const linkWa = (wa: unknown, pesan: string) => `https://wa.me/${waInternasional(wa)}?text=${encodeURIComponent(pesan)}`;
