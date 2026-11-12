import React, { useMemo, useState } from "react";
import { X, Link2, Search, Sparkles, AlertTriangle } from "lucide-react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { hapusStokOtomatisBilaYatim, PILIH_SAAT_CHECKOUT, ProdukSync, StokRef } from "../lib/posSales";

type ProductLike = { id: string; name: string; price: number; category: string; subcategory?: string | null; stokRef?: StokRef | null; stokAuto?: boolean };

const AUTO = "__auto__";
const encode = (r?: StokRef | null) => (r ? `${r.kategori}||${r.item}` : "");
const decode = (v: string): StokRef | null => {
  if (!v) return null;
  const [kategori, item] = v.split("||");
  return { kategori, item };
};
const same = (a?: StokRef | null, b?: StokRef | null) => encode(a) === encode(b);

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

/**
 * Hubungan produk POS <-> barang stok jualan (owner / super admin).
 * Produk baru otomatis dihubungkan / dibuatkan barang stok; di sini owner cukup mengoreksi.
 */
const PosStokLinkSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  products: ProductLike[];
  categories: StokKategori[];
  data: Record<string, Record<string, StokItemValue>>;
}> = ({ open, onClose, products, categories, data }) => {
  useBodyScrollLock(open);
  const [draft, setDraft] = useState<Record<string, StokRef | null>>({});
  const [filter, setFilter] = useState<"perlu" | "baru" | "semua">("semua");
  const [cari, setCari] = useState("");
  const [saving, setSaving] = useState(false);

  const list = useMemo(
    () => products.filter((p) => p.category === "JUALAN" || p.category === "SERVIS").sort((a, b) => a.name.localeCompare(b.name, "id")),
    [products]
  );
  const valueOf = (p: ProductLike): StokRef | null => (p.id in draft ? draft[p.id] : p.stokRef || null);
  const changed = list.filter((p) => !same(valueOf(p), p.stokRef || null));
  const perlu = list.filter((p) => p.category === "JUALAN" && (!p.stokRef || !refAda(p.stokRef, categories)));
  const baru = list.filter((p) => p.stokAuto);

  const q = cari.trim().toLowerCase();
  const base = filter === "perlu" ? perlu : filter === "baru" ? baru : list;
  const shown = base.filter((p) => !q || p.name.toLowerCase().includes(q) || encode(p.stokRef).toLowerCase().includes(q));

  const save = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      changed.forEach((p) => batch.set(doc(db, "products", p.id), { stokRef: valueOf(p), stokAuto: false }, { merge: true }));
      await batch.commit();
      // Barang stok otomatis yang ditinggalkan (tidak dipakai produk lain & stok 0) ikut dibersihkan
      const after: ProdukSync[] = products.map((p) => ({ ...p, stokRef: p.id in draft ? draft[p.id] : p.stokRef }));
      let dibersihkan = 0;
      for (const p of changed) {
        if (p.stokAuto && p.stokRef) {
          const ok = await hapusStokOtomatisBilaYatim(p.stokRef, after.filter((x) => x.id !== p.id), data?.[p.stokRef.kategori]?.[p.stokRef.item]?.jumlah).catch(() => false);
          if (ok) dibersihkan++;
        }
      }
      setDraft({});
      alert(`${changed.length} produk tersimpan ✅${dibersihkan ? `\n${dibersihkan} barang stok otomatis yang tidak terpakai dihapus.` : ""}`);
      onClose();
    } catch (e: any) {
      alert("Gagal menyimpan: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !saving && onClose()} />
      <div className="relative w-full sm:max-w-xl bg-white dark:bg-[#1c1c1e] rounded-t-[24px] sm:rounded-[24px] h-[92vh] sm:h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
        <div className="px-4 pt-2 pb-3 flex items-start gap-3 border-b border-zinc-100 dark:border-white/5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0"><Link2 className="w-4 h-4" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-black text-zinc-900 dark:text-white">Produk ↔ Stok Jualan</h3>
            <p className="text-[12px] text-zinc-500 leading-snug">Produk jualan otomatis masuk stok & saling sinkron. Ubah di sini bila hubungannya kurang tepat.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-4 py-3 space-y-2 border-b border-zinc-100 dark:border-white/5">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {([["semua", `Semua (${list.length})`], ["baru", `Dibuat otomatis (${baru.length})`], ["perlu", `Tanpa stok (${perlu.length})`]] as const).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setFilter(k)}
                className={`shrink-0 h-9 px-3 rounded-full text-[12px] font-bold border ${filter === k ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900" : "border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Search className="w-4 h-4 text-zinc-400" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari produk / barang stok…" className="flex-1 bg-transparent text-[14px] focus:outline-none text-zinc-900 dark:text-white" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {shown.length === 0 && <div className="text-center text-sm text-zinc-500 py-10">{filter === "perlu" ? "Semua produk jualan sudah terhubung ke stok 👍" : "Tidak ada produk."}</div>}
          {shown.map((p) => {
            const v = valueOf(p);
            const hilang = !!v && !refAda(v, categories);
            return (
              <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-white/10 p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-zinc-900 dark:text-white leading-snug">{p.name}</div>
                    <div className="text-[11px] text-zinc-400">{p.category} · Rp {p.price.toLocaleString("id-ID")}</div>
                  </div>
                  {p.stokAuto && !(p.id in draft) && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                      <Sparkles className="w-3 h-3" />Dibuat otomatis
                    </span>
                  )}
                </div>
                <StokRefSelect value={v} onChange={(r) => setDraft((d) => ({ ...d, [p.id]: r ?? null }))} categories={categories} data={data} />
                {hilang && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />Barang stok ini sudah dihapus — pilih yang lain
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 pt-2 pb-4 border-t border-zinc-100 dark:border-white/5">
          <button type="button" disabled={saving || changed.length === 0} onClick={save}
            className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[15px] font-black disabled:opacity-40 active:scale-[0.98]">
            {saving ? "Menyimpan…" : changed.length ? `Simpan ${changed.length} perubahan` : "Belum ada perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosStokLinkSheet;
