import React, { useMemo, useState } from "react";
import { X, Link2, Search } from "lucide-react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { PILIH_SAAT_CHECKOUT, StokRef, suggestStokRef } from "../lib/posSales";

type ProductLike = { id: string; name: string; price: number; category: string; stokRef?: StokRef | null };

const encode = (r?: StokRef | null) => (r ? `${r.kategori}||${r.item}` : "");
const decode = (v: string): StokRef | null => {
  if (!v) return null;
  const [kategori, item] = v.split("||");
  return { kategori, item };
};

/** Pilihan barang stok (dipakai di form produk & lembar Hubungkan Stok). */
export const StokRefSelect: React.FC<{
  value?: StokRef | null;
  onChange: (r: StokRef | null) => void;
  categories: StokKategori[];
  data?: Record<string, Record<string, StokItemValue>>;
  className?: string;
}> = ({ value, onChange, categories, data, className }) => (
  <select
    value={encode(value)}
    onChange={(e) => onChange(decode(e.target.value))}
    className={className || "w-full h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[13px] font-semibold text-zinc-900 dark:text-white"}
  >
    <option value="">— Tidak dihubungkan (stok tidak berkurang) —</option>
    {categories.map((c) => (
      <optgroup key={c.kategori} label={c.kategori}>
        <option value={`${c.kategori}||${PILIH_SAAT_CHECKOUT}`}>{c.kategori} › pilih varian saat checkout</option>
        {c.items.map((it) => {
          const n = data?.[c.kategori]?.[it]?.jumlah;
          return (
            <option key={it} value={`${c.kategori}||${it}`}>
              {c.kategori} › {it}{typeof n === "number" ? ` (sisa ${n})` : ""}
            </option>
          );
        })}
      </optgroup>
    ))}
  </select>
);

/**
 * Hubungkan produk POS ke barang stok jualan (owner / super admin).
 * Produk yang belum terhubung diisi saran otomatis; owner cukup mengecek lalu simpan.
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
  const [filter, setFilter] = useState<"belum" | "semua">("belum");
  const [cari, setCari] = useState("");
  const [saving, setSaving] = useState(false);

  const list = useMemo(
    () => products.filter((p) => p.category === "JUALAN" || p.category === "SERVIS").sort((a, b) => a.name.localeCompare(b.name, "id")),
    [products]
  );
  const suggestions = useMemo(() => {
    const m = new Map<string, ReturnType<typeof suggestStokRef>>();
    list.forEach((p) => { if (!p.stokRef) m.set(p.id, suggestStokRef(p.name, categories)); });
    return m;
  }, [list, categories]);

  // Nilai awal: link tersimpan; bila belum ada, pakai saran (khusus JUALAN)
  const valueOf = (p: ProductLike): StokRef | null => {
    if (p.id in draft) return draft[p.id];
    if (p.stokRef) return p.stokRef;
    return p.category === "JUALAN" ? suggestions.get(p.id)?.ref || null : null;
  };
  const changed = list.filter((p) => encode(valueOf(p)) !== encode(p.stokRef || null));
  const belum = list.filter((p) => !p.stokRef && p.category === "JUALAN");

  const q = cari.trim().toLowerCase();
  const shown = (filter === "belum" ? belum : list).filter((p) => !q || p.name.toLowerCase().includes(q));

  const save = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      changed.forEach((p) => batch.set(doc(db, "products", p.id), { stokRef: valueOf(p) }, { merge: true }));
      await batch.commit();
      setDraft({});
      alert(`${changed.length} produk tersimpan ✅`);
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
            <h3 className="text-[17px] font-black text-zinc-900 dark:text-white">Hubungkan Produk ke Stok</h3>
            <p className="text-[12px] text-zinc-500">Saat nota dicetak, stok barang yang terhubung otomatis berkurang.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-4 py-3 space-y-2 border-b border-zinc-100 dark:border-white/5">
          <div className="flex gap-2">
            {([["belum", `Belum terhubung (${belum.length})`], ["semua", `Semua (${list.length})`]] as const).map(([k, t]) => (
              <button key={k} type="button" onClick={() => setFilter(k)}
                className={`h-9 px-3 rounded-full text-[12px] font-bold border ${filter === k ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900" : "border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 h-10 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800">
            <Search className="w-4 h-4 text-zinc-400" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari produk…" className="flex-1 bg-transparent text-[14px] focus:outline-none text-zinc-900 dark:text-white" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {shown.length === 0 && <div className="text-center text-sm text-zinc-500 py-10">Semua produk sudah terhubung 👍</div>}
          {shown.map((p) => {
            const sug = !p.stokRef ? suggestions.get(p.id) : null;
            const usingSug = !(p.id in draft) && !p.stokRef && sug && p.category === "JUALAN";
            return (
              <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-white/10 p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold text-zinc-900 dark:text-white leading-snug">{p.name}</div>
                    <div className="text-[11px] text-zinc-400">{p.category} · Rp {p.price.toLocaleString("id-ID")}</div>
                  </div>
                  {usingSug && (
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold ${sug!.yakin ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"}`}>
                      {sug!.yakin ? "Saran" : "Saran · cek"}
                    </span>
                  )}
                </div>
                <StokRefSelect value={valueOf(p)} onChange={(r) => setDraft((d) => ({ ...d, [p.id]: r }))} categories={categories} data={data} />
              </div>
            );
          })}
        </div>

        <div className="px-4 pt-2 pb-4 border-t border-zinc-100 dark:border-white/5">
          <button type="button" disabled={saving || changed.length === 0} onClick={save}
            className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[15px] font-black disabled:opacity-40 active:scale-[0.98]">
            {saving ? "Menyimpan…" : `Simpan ${changed.length} produk`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PosStokLinkSheet;
