export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace("Rp", "Rp ");
/** Rupiah ringkas untuk sumbu grafik & angka kecil: 1,2 jt · 450 rb · 1,1 M */
export const rpShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} M`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(Math.round(n));
};
export const toInt = (v: string | number) => {
  const s = String(v ?? "0");
  const n = parseInt(s.replace(/[^0-9-]/g, ""), 10);
  return isNaN(n) ? 0 : n;
};

export const formatDateShort = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
};
