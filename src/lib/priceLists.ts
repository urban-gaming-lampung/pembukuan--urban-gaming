/**
 * SUMBER TUNGGAL harga rincian (dipakai tabel Usaha Rental, Edit Rincian, controller,
 * dan monitoring). Jangan menaruh harga "cadangan" di komponen lain — semua harga yang
 * tampil di tabel harus bisa dilihat & diubah di Pengaturan > Edit Rincian.
 */
import { DEFAULT_HARGA_SEWA, DEFAULT_HARGA_JASA_AKS, type Price } from "../constants/prices";

export const normText = (s: unknown) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export function cleanPriceList(items?: Price[] | null): Price[] {
  return (Array.isArray(items) ? items : [])
    .map((x) => ({ label: String(x?.label ?? "").trim(), price: Math.max(0, Math.round(Number(x?.price) || 0)) }))
    .filter((x) => x.label.length > 0);
}

/** "PS4+TV 12 Jam" -> "PS4 + TV", "Hanya TV 1 Hari" -> "Hanya TV" */
export function sewaJenisFromLabel(label: string): string | null {
  const s = normText(label);
  if (s.includes("hanya tv") || s === "tv" || (s.includes("tv") && !s.includes("ps"))) return "Hanya TV";
  const psMatch = s.match(/ps\s*(\d+)/);
  if (!psMatch) return null;
  const psVer = `PS${psMatch[1]}`;
  if (s.includes("portable")) return `${psVer} Portable`;
  if (s.includes("tv")) return `${psVer} + TV`;
  return psVer;
}

/** "PS4 12 Jam" -> "12 JAM", "PS4 2 Hari" -> "2 HARI", "semalam/sehari" -> "1 HARI" */
export function sewaLamaFromLabel(label: string): string | null {
  const s = normText(label);
  const jam = s.match(/(\d+)\s*jam/);
  if (jam && Number(jam[1]) > 0) return `${Number(jam[1])} JAM`;
  const hari = s.match(/(\d+)\s*hari/);
  if (hari && Number(hari[1]) > 0) return `${Number(hari[1])} HARI`;
  if (s.includes("semalam") || s.includes("sehari")) return "1 HARI";
  return null;
}

/** Label sewa valid = tabel bisa membaca jenis & lama sewanya. */
export const isValidSewaLabel = (label: string) => !!(sewaJenisFromLabel(label) && sewaLamaFromLabel(label));

/**
 * Daftar harga Sewa yang dipakai tabel = data tersimpan, ditambah default HANYA untuk jenis
 * unit yang belum ada sama sekali (mis. data lama tanpa PS5). Menghapus satu durasi di
 * Edit Rincian tetap berlaku karena jenisnya masih ada.
 */
export function effectiveSewaPrices(items?: Price[] | null): Price[] {
  const cleaned = cleanPriceList(items);
  if (cleaned.length === 0) return cleanPriceList(DEFAULT_HARGA_SEWA);
  const jenisAda = new Set(cleaned.map((i) => sewaJenisFromLabel(i.label)).filter(Boolean) as string[]);
  const extra = cleanPriceList(DEFAULT_HARGA_SEWA).filter((d) => {
    const j = sewaJenisFromLabel(d.label);
    return !!j && !jenisAda.has(j);
  });
  return [...cleaned, ...extra];
}

/** Jasa & Aksesoris: data tersimpan, atau default bila kosong. */
export const effectiveJasaPrices = (items?: Price[] | null): Price[] => {
  const cleaned = cleanPriceList(items);
  return cleaned.length ? cleaned : cleanPriceList(DEFAULT_HARGA_JASA_AKS);
};

export type SewaTable = {
  table: Record<string, Record<string, number>>;
  jenisOptions: string[];
  lamaOptions: string[];
};

const JENIS_ORDER = ["PS3", "PS3 + TV", "PS3 Portable", "PS4", "PS4 + TV", "PS4 Portable", "PS5", "PS5 + TV", "PS5 Portable", "Hanya TV", "Hanya Ongkir"];
const LAMA_ORDER = ["12 JAM", "24 JAM", "1 HARI", "2 HARI", "3 HARI"];
const byOrder = (order: string[]) => (a: string, b: string) => {
  const ia = order.indexOf(a), ib = order.indexOf(b);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.localeCompare(b, "id", { numeric: true });
};

export function buildSewaTable(items?: Price[] | null): SewaTable {
  const table: Record<string, Record<string, number>> = {};
  const jenisSet = new Set<string>();
  const lamaSet = new Set<string>();
  for (const it of effectiveSewaPrices(items)) {
    const jenis = sewaJenisFromLabel(it.label);
    const lama = sewaLamaFromLabel(it.label);
    if (!jenis || !lama) continue;
    (table[lama] ||= {})[jenis] = it.price;
    jenisSet.add(jenis);
    lamaSet.add(lama);
  }
  // "24 JAM" dan "1 HARI" setara: isi yang kosong dari pasangannya.
  if (table["1 HARI"] || table["24 JAM"]) {
    const a = (table["1 HARI"] ||= {}), b = (table["24 JAM"] ||= {});
    Object.entries(a).forEach(([k, v]) => { if (!b[k]) b[k] = v; });
    Object.entries(b).forEach(([k, v]) => { if (!a[k]) a[k] = v; });
    lamaSet.add("1 HARI");
    lamaSet.add("24 JAM");
  }
  jenisSet.add("Hanya Ongkir"); // jasa antar saja, harganya = ongkir
  return {
    table,
    jenisOptions: Array.from(jenisSet).sort(byOrder(JENIS_ORDER)),
    lamaOptions: Array.from(lamaSet).sort(byOrder(LAMA_ORDER)),
  };
}

/** Harga dasar sewa (tanpa ongkir) untuk jenis + lama. "Hanya Ongkir" -> 0. */
export function getSewaPrice(sewa: SewaTable, jenis?: string, lama?: string): number {
  if (!jenis || !lama || jenis === "Hanya Ongkir") return 0;
  return sewa.table[String(lama).toUpperCase()]?.[jenis] || 0;
}
