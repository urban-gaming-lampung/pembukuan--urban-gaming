import React from "react";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { PILIH_SAAT_CHECKOUT, StokRef } from "../lib/posSales";
import { kunciStok } from "../lib/stokJualan";

const AUTO = "__auto__";
const encode = (r?: StokRef | null) => (r ? kunciStok(r) : "");
const decode = (v: string): StokRef | null => {
  if (!v) return null;
  const [kategori, item] = v.split("||");
  return { kategori, item };
};

/** Barang yang dirujuk masih ada di master stok? */
export const refAda = (r: StokRef, categories: StokKategori[]) => {
  const c = categories.find((x) => x.kategori === r.kategori);
  return !!c && (r.item === PILIH_SAAT_CHECKOUT || c.items.includes(r.item));
};

/**
 * Pilihan barang stok (dipakai di form produk & lembar Hubungkan Stok).
 * `allowAuto`: tampilkan opsi "Otomatis" (value undefined = sistem yang menentukan / membuat barang stok).
 * `dipakai`: "KATEGORI||ITEM" -> nama produk lain yang sudah memakai barang itu. Barang tersebut tidak bisa
 *   dipilih (1 produk = 1 barang stok), kecuali yang sedang terpilih.
 */
export const StokRefSelect: React.FC<{
  value?: StokRef | null;
  onChange: (r: StokRef | null | undefined) => void;
  categories: StokKategori[];
  data?: Record<string, Record<string, StokItemValue>>;
  className?: string;
  allowAuto?: boolean;
  dipakai?: Record<string, string>;
}> = ({ value, onChange, categories, data, className, allowAuto, dipakai }) => (
  <select
    value={value === undefined && allowAuto ? AUTO : encode(value)}
    onChange={(e) => onChange(e.target.value === AUTO ? undefined : decode(e.target.value))}
    className={className || "w-full h-11 px-3 rounded-field bg-fill text-[16px] sm:text-footnote font-semibold text-label focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35"}
  >
    {allowAuto && <option value={AUTO}>Otomatis — sistem hubungkan / buat barang stok</option>}
    <option value="">— Tidak dihubungkan (stok tidak berkurang) —</option>
    {categories.map((c) => (
      <optgroup key={c.kategori} label={c.kategori}>
        <option value={`${c.kategori}||${PILIH_SAAT_CHECKOUT}`}>{c.kategori} › pilih varian saat checkout</option>
        {c.items.map((it) => {
          const n = data?.[c.kategori]?.[it]?.jumlah;
          const k = `${c.kategori}||${it}`;
          const milik = dipakai?.[k];
          const terpilih = encode(value) === k;
          return (
            <option key={it} value={k} disabled={!!milik && !terpilih}>
              {c.kategori} › {it}{typeof n === "number" ? ` (sisa ${n})` : " (belum dihitung)"}{milik ? ` · dipakai ${milik}` : ""}
            </option>
          );
        })}
      </optgroup>
    ))}
  </select>
);
