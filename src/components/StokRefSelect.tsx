import React from "react";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { PILIH_SAAT_CHECKOUT, StokRef } from "../lib/posSales";

const AUTO = "__auto__";
const encode = (r?: StokRef | null) => (r ? `${r.kategori}||${r.item}` : "");
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
 */
export const StokRefSelect: React.FC<{
  value?: StokRef | null;
  onChange: (r: StokRef | null | undefined) => void;
  categories: StokKategori[];
  data?: Record<string, Record<string, StokItemValue>>;
  className?: string;
  allowAuto?: boolean;
}> = ({ value, onChange, categories, data, className, allowAuto }) => (
  <select
    value={value === undefined && allowAuto ? AUTO : encode(value)}
    onChange={(e) => onChange(e.target.value === AUTO ? undefined : decode(e.target.value))}
    className={className || "w-full h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[13px] font-semibold text-zinc-900 dark:text-white"}
  >
    {allowAuto && <option value={AUTO}>✨ Otomatis — sistem hubungkan / buat barang stok</option>}
    <option value="">— Tidak dihubungkan (stok tidak berkurang) —</option>
    {categories.map((c) => (
      <optgroup key={c.kategori} label={c.kategori}>
        <option value={`${c.kategori}||${PILIH_SAAT_CHECKOUT}`}>{c.kategori} › pilih varian saat checkout</option>
        {c.items.map((it) => {
          const n = data?.[c.kategori]?.[it]?.jumlah;
          return (
            <option key={it} value={`${c.kategori}||${it}`}>
              {c.kategori} › {it}{typeof n === "number" ? ` (sisa ${n})` : " (belum dihitung)"}
            </option>
          );
        })}
      </optgroup>
    ))}
  </select>
);
