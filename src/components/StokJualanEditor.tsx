import React, { useMemo, useState } from "react";
import { Minus, Plus, Search, X, Package, Check, ClipboardPaste, Copy } from "lucide-react";
import StokReportPaste from "./StokReportPaste";
import { buildStokReport } from "../lib/stokReport";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import {
  ALASAN_LABEL, StokAlasan, StokRow, buildStokRows, commitStokChanges, fmtWaktu, useMinStok,
} from "../lib/stokJualan";

/**
 * Update Stok Jualan (pegawai & owner) — mobile-first.
 * Perubahan dikumpulkan dulu (draft), lalu disimpan sekali dengan jenis perubahan
 * (barang masuk / terjual / rusak / koreksi) sehingga tercatat rapi di riwayat.
 */
type Draft = { delta: number; setTo?: number };
const keyOf = (r: { kategori: string; item: string }) => `${r.kategori}||${r.item}`;

const STATUS_DOT: Record<StokRow["status"], string> = {
  habis: "bg-red-500",
  menipis: "bg-amber-500",
  aman: "bg-emerald-500",
};

const StokJualanEditor: React.FC<{
  categories: StokKategori[];
  data: Record<string, Record<string, StokItemValue>>;
  isOwner?: boolean;
}> = ({ categories, data, isOwner }) => {
  const [pasteOpen, setPasteOpen] = useState(false);
  const copyReport = async () => {
    const txt = buildStokReport(categories, data as any);
    try {
      if (navigator.share && /android|iphone|ipad/i.test(navigator.userAgent)) await navigator.share({ text: txt });
      else { await navigator.clipboard.writeText(txt); alert("Laporan stok disalin 📋 Tempel di WhatsApp."); }
    } catch (e: any) {
      if (e?.name !== "AbortError") { try { await navigator.clipboard.writeText(txt); alert("Laporan stok disalin 📋"); } catch { alert(txt); } }
    }
  };
  const minMap = useMinStok();
  const rows = useMemo(() => buildStokRows(categories, data, minMap), [categories, data, minMap]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [cari, setCari] = useState("");
  const [kat, setKat] = useState<string>("SEMUA");
  const [hanyaKurang, setHanyaKurang] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alasan, setAlasan] = useState<StokAlasan | null>(null);
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);
  useBodyScrollLock(sheetOpen);

  const nextQty = (r: StokRow) => {
    const d = drafts[keyOf(r)];
    if (!d) return r.jumlah;
    return Math.max(0, (typeof d.setTo === "number" ? d.setTo : r.jumlah) + d.delta);
  };

  const bump = (r: StokRow, step: number) => {
    setDrafts((prev) => {
      const k = keyOf(r);
      const cur = prev[k] || { delta: 0 };
      const base = typeof cur.setTo === "number" ? cur.setTo : r.jumlah;
      const delta = Math.max(-base, cur.delta + step);
      const next = { ...prev, [k]: { ...cur, delta } };
      if (delta === 0 && typeof cur.setTo !== "number") delete next[k];
      return next;
    });
  };

  const commitTyped = (r: StokRow) => {
    const n = parseInt(editVal, 10);
    setEditKey(null);
    if (isNaN(n) || n < 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      if (n === r.jumlah) delete next[keyOf(r)];
      else next[keyOf(r)] = { delta: 0, setTo: n };
      return next;
    });
  };

  const changed = rows.filter((r) => drafts[keyOf(r)] && nextQty(r) !== r.jumlah);
  const autoAlasan: StokAlasan = (() => {
    if (changed.some((r) => typeof drafts[keyOf(r)]?.setTo === "number")) return "koreksi";
    const ups = changed.filter((r) => nextQty(r) > r.jumlah).length;
    if (ups === changed.length) return "masuk";
    if (ups === 0) return "terjual";
    return "koreksi";
  })();

  const q = cari.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (kat === "SEMUA" || r.kategori === kat) &&
      (!q || r.item.toLowerCase().includes(q) || r.kategori.toLowerCase().includes(q)) &&
      (!hanyaKurang || r.status !== "aman" || drafts[keyOf(r)])
  );
  const grouped = categories
    .map((c) => ({ kategori: c.kategori, items: visible.filter((r) => r.kategori === c.kategori) }))
    .filter((g) => g.items.length > 0);
  const kurangCount = rows.filter((r) => r.status !== "aman").length;

  const save = async () => {
    setSaving(true);
    try {
      const n = await commitStokChanges(
        changed.map((r) => {
          const d = drafts[keyOf(r)];
          return typeof d.setTo === "number"
            ? { kategori: r.kategori, item: r.item, setTo: Math.max(0, d.setTo + d.delta) }
            : { kategori: r.kategori, item: r.item, delta: d.delta };
        }),
        alasan || autoAlasan,
        catatan
      );
      setDrafts({});
      setSheetOpen(false);
      setAlasan(null);
      setCatatan("");
      alert(`Stok tersimpan (${n} barang) ✅`);
    } catch (e: any) {
      alert("Gagal menyimpan stok: " + (e?.message || e) + "\nPerubahan Anda masih ada, coba simpan lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-10 h-10 rounded-xl bg-lime-100 dark:bg-lime-500/20 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-lime-600 dark:text-lime-400" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-black text-zinc-900 dark:text-white">Update Stok Jualan</h2>
          <p className="text-[12px] text-zinc-500 dark:text-zinc-400">Ubah jumlah, lalu tekan Simpan di bawah</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setPasteOpen(true)} className="h-12 rounded-2xl bg-blue-600 text-white text-[14px] font-black flex items-center justify-center gap-2 active:scale-[0.98]">
          <ClipboardPaste className="w-4 h-4" /> Tempel Laporan
        </button>
        <button type="button" onClick={copyReport} className="h-12 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-100 text-[14px] font-black flex items-center justify-center gap-2 active:scale-[0.98]">
          <Copy className="w-4 h-4" /> Salin Laporan
        </button>
      </div>
      <StokReportPaste open={pasteOpen} onClose={() => setPasteOpen(false)} categories={categories} data={data as any} isOwner={isOwner} />

      {/* Cari + filter */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari barang…"
            className="flex-1 min-w-0 bg-transparent text-[15px] focus:outline-none text-zinc-900 dark:text-white"
          />
          {cari && (
            <button type="button" onClick={() => setCari("")} aria-label="Hapus pencarian" className="p-1 text-zinc-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          <button
            type="button"
            onClick={() => setHanyaKurang((v) => !v)}
            className={`shrink-0 h-9 px-3 rounded-full text-[12px] font-bold border ${
              hanyaKurang ? "bg-red-500 text-white border-red-500" : "bg-white dark:bg-[#1c1c1e] text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30"
            }`}
          >
            Perlu restock ({kurangCount})
          </button>
          {["SEMUA", ...categories.map((c) => c.kategori)].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKat(k)}
              className={`shrink-0 h-9 px-3 rounded-full text-[12px] font-bold border whitespace-nowrap ${
                kat === k
                  ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
                  : "bg-white dark:bg-[#1c1c1e] text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-white/10"
              }`}
            >
              {k === "SEMUA" ? "Semua" : k}
            </button>
          ))}
        </div>
      </div>

      {grouped.length === 0 && (
        <div className="text-center text-sm text-zinc-500 py-10 rounded-2xl border border-dashed border-zinc-300 dark:border-white/10">
          Tidak ada barang yang cocok.
        </div>
      )}

      {grouped.map((g) => (
        <div key={g.kategori} className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center justify-between bg-zinc-50 dark:bg-white/5">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{g.kategori}</span>
            <span className="text-[11px] font-bold text-zinc-400">{g.items.reduce((s, r) => s + r.jumlah, 0)} pcs</span>
          </div>
          {g.items.map((r) => {
            const k = keyOf(r);
            const nq = nextQty(r);
            const diff = nq - r.jumlah;
            const isEditing = editKey === k;
            return (
              <div key={k} className={`px-4 py-3 flex items-center gap-3 border-t border-zinc-100 dark:border-white/5 ${diff !== 0 ? "bg-blue-50/60 dark:bg-blue-500/5" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[r.status]}`} />
                    <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{r.item}</span>
                  </div>
                  {(data as any)?.[r.kategori]?.[r.item]?.catatan && (
                    <div className="text-[11px] italic text-amber-600 dark:text-amber-400 truncate">“{(data as any)[r.kategori][r.item].catatan}”</div>
                  )}
                  <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                    min {r.min} · {fmtWaktu(r.lastTs)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => bump(r, -1)}
                    disabled={nq <= 0}
                    aria-label={`Kurangi ${r.item}`}
                    className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 active:scale-95 disabled:opacity-30"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  {isEditing ? (
                    <input
                      autoFocus
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onBlur={() => commitTyped(r)}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="w-14 h-11 rounded-xl text-center text-[17px] font-black bg-white dark:bg-black border-2 border-blue-500 focus:outline-none text-zinc-900 dark:text-white"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditKey(k); setEditVal(String(nq)); }}
                      aria-label={`Isi jumlah ${r.item}`}
                      className="w-14 h-11 rounded-xl flex flex-col items-center justify-center leading-none"
                    >
                      <span className="text-[18px] font-black text-zinc-900 dark:text-white tabular-nums">{nq}</span>
                      {diff !== 0 && (
                        <span className={`text-[10px] font-bold mt-0.5 ${diff > 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => bump(r, 1)}
                    aria-label={`Tambah ${r.item}`}
                    className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Bar simpan (muncul bila ada perubahan) */}
      {changed.length > 0 && !sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[300] px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border-t border-zinc-200 dark:border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          <div className="max-w-xl mx-auto flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-black text-zinc-900 dark:text-white">{changed.length} barang diubah</div>
              <div className="text-[11px] text-zinc-500 truncate">Belum tersimpan</div>
            </div>
            <button type="button" onClick={() => setDrafts({})} className="h-11 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[14px] font-bold text-zinc-700 dark:text-zinc-200">
              Batal
            </button>
            <button type="button" onClick={() => setSheetOpen(true)} className="h-11 px-5 rounded-xl bg-blue-600 text-white text-[14px] font-black active:scale-95">
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* Lembar konfirmasi simpan */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setSheetOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-white dark:bg-[#1c1c1e] rounded-t-[24px] sm:rounded-[24px] max-h-[88vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
            <div className="px-5 pt-3 pb-2 flex items-center justify-between">
              <h3 className="text-[17px] font-black text-zinc-900 dark:text-white">Simpan perubahan stok</h3>
              <button type="button" onClick={() => setSheetOpen(false)} disabled={saving} aria-label="Tutup" className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 overflow-y-auto space-y-4 pb-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 divide-y divide-zinc-100 dark:divide-white/5">
                {changed.map((r) => {
                  const nq = nextQty(r);
                  const d = nq - r.jumlah;
                  return (
                    <div key={keyOf(r)} className="px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-zinc-900 dark:text-white truncate">{r.item}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{r.kategori}</div>
                      </div>
                      <div className="text-[13px] font-bold tabular-nums shrink-0 text-zinc-700 dark:text-zinc-200">
                        {r.jumlah} → {nq}{" "}
                        <span className={d > 0 ? "text-emerald-600" : "text-red-500"}>({d > 0 ? `+${d}` : d})</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Jenis perubahan</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ALASAN_LABEL) as StokAlasan[]).map((a) => {
                    const active = (alasan || autoAlasan) === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAlasan(a)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-[13px] font-bold text-left border flex items-center gap-2 ${
                          active ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        {active && <Check className="w-4 h-4 shrink-0" />}
                        {ALASAN_LABEL[a]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Catatan (opsional)</div>
                <input
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Mis. restock dari supplier, dijual ke Budi…"
                  className="w-full h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
                />
              </div>
            </div>
            <div className="px-5 pt-2 pb-4 border-t border-zinc-100 dark:border-white/5">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[15px] font-black active:scale-[0.98] disabled:opacity-60"
              >
                {saving ? "Menyimpan…" : `Simpan ${changed.length} perubahan`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StokJualanEditor;
