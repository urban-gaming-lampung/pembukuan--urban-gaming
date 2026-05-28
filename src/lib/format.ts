export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace("Rp", "Rp ");
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
