import React, { useMemo, useState } from "react";
import { ClipboardPaste, X, ArrowLeft, AlertTriangle } from "lucide-react";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { MatchedLine, matchReport, normKey, parseStokReport } from "../lib/stokReport";
import { applyMasterChanges, commitStokChanges, StokChange } from "../lib/stokJualan";

/**
 * Tempel laporan stok format WhatsApp → pratinjau → simpan.
 * Barang yang cocok diperbarui jumlah & catatannya; barang yang belum ada bisa ditambahkan,
 * disamakan dengan barang lain, atau dilewati.
 */
type Decision = "baru" | "lewati" | `map:${string}`;
type StaleAction = "biarkan" | "nol" | "hapus";

const CONTOH = `*UNIT KONSOL BARU*\n• PS4 SLIM 1TB - 1 Unit\n\n*STIK PS3*\n• Hitam - 10\n• Putih - 9 (1 baret)`;

const StokReportPaste: React.FC<{
  open: boolean;
  onClose: () => void;
  categories: StokKategori[];
  data: Record<string, Record<string, StokItemValue & { catatan?: string }>>;
  isOwner?: boolean;
}> = ({ open, onClose, categories, data, isOwner }) => {
  useBodyScrollLock(open);
  const [text, setText] = useState("");
  const [step, setStep] = useState<"input" | "preview">("input");
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [staleAction, setStaleAction] = useState<StaleAction>("biarkan");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseStokReport(text), [text]);
  const matched = useMemo<MatchedLine[]>(() => matchReport(parsed.lines, categories), [parsed, categories]);

  const qtyOf = (kat: string, item: string) => Math.max(0, Math.round(Number(data?.[kat]?.[item]?.jumlah) || 0));
  const noteOf = (kat: string, item: string) => String(data?.[kat]?.[item]?.catatan || "");
  const decisionOf = (i: number, m: MatchedLine): Decision => (m.item ? `map:${m.item}` : decisions[i] || "baru");
  const targetOf = (i: number, m: MatchedLine): string | null => {
    const d = decisionOf(i, m);
    if (d === "lewati") return null;
    if (d === "baru") return m.nama;
    return d.slice(4);
  };

  // Barang master (di kategori yang ada di laporan) yang tidak disebut di laporan
  const stale = useMemo(() => {
    const disebut = new Set<string>();
    matched.forEach((m, i) => { const t = targetOf(i, m); if (t) disebut.add(`${m.kategori}||${normKey(t)}`); });
    const katDiLaporan = new Set(matched.map((m) => m.kategori));
    const out: { kategori: string; item: string }[] = [];
    categories.forEach((c) => {
      if (!katDiLaporan.has(c.kategori)) return;
      c.items.forEach((it) => { if (!disebut.has(`${c.kategori}||${normKey(it)}`)) out.push({ kategori: c.kategori, item: it }); });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, decisions, categories]);

  const stats = useMemo(() => {
    let berubah = 0, sama = 0, baru = 0, lewati = 0;
    matched.forEach((m, i) => {
      const d = decisionOf(i, m);
      if (d === "lewati") { lewati++; return; }
      if (d === "baru") { baru++; return; }
      const t = d.slice(4);
      const changed = qtyOf(m.kategori, t) !== m.jumlah || (m.catatan || "") !== noteOf(m.kategori, t);
      changed ? berubah++ : sama++;
    });
    return { berubah, sama, baru, lewati };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, decisions, data]);

  const reset = () => { setText(""); setStep("input"); setDecisions({}); setStaleAction("biarkan"); };
  const close = () => { if (saving) return; reset(); onClose(); };

  const save = async () => {
    setSaving(true);
    try {
      const add: Record<string, string[]> = {};
      const remove: Record<string, string[]> = {};
      const byKey = new Map<string, StokChange>(); // baris terakhir menang bila ada nama kembar
      matched.forEach((m, i) => {
        const d = decisionOf(i, m);
        const target = targetOf(i, m);
        if (!target) return;
        if (d === "baru") (add[m.kategori] ||= []).push(target);
        byKey.set(`${m.kategori}||${normKey(target)}`, { kategori: m.kategori, item: target, setTo: m.jumlah, catatan: m.catatan || "", touch: true });
      });
      if (staleAction === "nol") stale.forEach((s) => byKey.set(`${s.kategori}||${normKey(s.item)}`, { kategori: s.kategori, item: s.item, setTo: 0 }));
      if (staleAction === "hapus" && isOwner) stale.forEach((s) => (remove[s.kategori] ||= []).push(s.item));

      await applyMasterChanges(add, remove);
      const n = await commitStokChanges(Array.from(byKey.values()), "koreksi", "Tempel laporan stok");
      const addedCount = Object.values(add).reduce((s, l) => s + l.length, 0);
      alert(`Laporan stok tersimpan ✅\n${stats.berubah} berubah${addedCount ? ` · ${addedCount} barang baru` : ""}\n${n} barang tercatat sudah dicek hari ini.`);
      reset();
      onClose();
    } catch (e: any) {
      alert("Gagal menyimpan laporan: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const grouped = Array.from(
    matched.reduce((map, m, i) => map.set(m.kategori, [...(map.get(m.kategori) || []), { m, i }]), new Map<string, { m: MatchedLine; i: number }[]>())
  );

  return (
    <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-[#1c1c1e] rounded-t-[24px] sm:rounded-[24px] h-[92vh] sm:h-auto sm:max-h-[88vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
        <div className="px-4 pt-2 pb-3 flex items-center gap-2 border-b border-zinc-100 dark:border-white/5">
          {step === "preview" && (
            <button type="button" onClick={() => setStep("input")} aria-label="Kembali" className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-black text-zinc-900 dark:text-white">{step === "input" ? "Tempel Laporan Stok" : "Cek sebelum simpan"}</h3>
            <p className="text-[12px] text-zinc-500 truncate">
              {step === "input" ? "Format WhatsApp: *KATEGORI* lalu • Barang - jumlah" : `${matched.length} barang terbaca`}
            </p>
          </div>
          <button type="button" onClick={close} aria-label="Tutup" className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "input" ? (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Tempel laporan di sini, contoh:\n\n${CONTOH}`}
                className="w-full h-[46vh] sm:h-72 p-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-[14px] leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white resize-none"
              />
              <button
                type="button"
                onClick={async () => { try { setText(await navigator.clipboard.readText()); } catch { alert("Tidak bisa membaca clipboard. Tekan lama kolom di atas lalu pilih Tempel."); } }}
                className="w-full h-11 rounded-xl border border-zinc-200 dark:border-white/10 text-[14px] font-bold text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-2"
              >
                <ClipboardPaste className="w-4 h-4" /> Tempel dari clipboard
              </button>
              {text.trim() && (
                <p className="text-[12px] text-zinc-500">
                  Terbaca <b>{parsed.lines.length}</b> barang
                  {parsed.diabaikan.length > 0 && <> · {parsed.diabaikan.length} baris tidak dikenali</>}
                </p>
              )}
            </div>
            <div className="px-4 pt-2 pb-4 border-t border-zinc-100 dark:border-white/5">
              <button
                type="button"
                disabled={parsed.lines.length === 0}
                onClick={() => setStep("preview")}
                className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[15px] font-black disabled:opacity-40 active:scale-[0.98]"
              >
                Baca laporan ({parsed.lines.length} barang)
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { t: "Berubah", v: stats.berubah, c: "text-blue-600 dark:text-blue-400" },
                  { t: "Sama", v: stats.sama, c: "text-zinc-500" },
                  { t: "Baru", v: stats.baru, c: "text-emerald-600 dark:text-emerald-400" },
                  { t: "Lewati", v: stats.lewati, c: "text-zinc-400" },
                ].map((x) => (
                  <div key={x.t} className="rounded-xl bg-zinc-100 dark:bg-zinc-800 py-2 text-center">
                    <div className={`text-[18px] font-black ${x.c}`}>{x.v}</div>
                    <div className="text-[10px] font-bold uppercase text-zinc-400">{x.t}</div>
                  </div>
                ))}
              </div>

              {parsed.diabaikan.length > 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 text-[12px] text-amber-800 dark:text-amber-300">
                  <div className="font-bold flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Baris tidak dikenali (dilewati)</div>
                  {parsed.diabaikan.slice(0, 5).map((d) => <div key={d.baris} className="truncate">Baris {d.baris}: {d.teks}</div>)}
                </div>
              )}

              {grouped.map(([kat, list]) => {
                const cat = categories.find((c) => c.kategori === kat);
                return (
                  <div key={kat} className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                    <div className="px-3 py-2 bg-zinc-50 dark:bg-white/5 flex items-center justify-between">
                      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500">{kat}</span>
                      {!cat && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Kategori baru</span>}
                    </div>
                    {list.map(({ m, i }) => {
                      const d = decisionOf(i, m);
                      const target = targetOf(i, m);
                      const isNew = d === "baru";
                      const before = target && !isNew ? qtyOf(kat, target) : null;
                      const changed = before !== null && (before !== m.jumlah || (m.catatan || "") !== noteOf(kat, target!));
                      return (
                        <div key={i} className={`px-3 py-2.5 border-t border-zinc-100 dark:border-white/5 ${d === "lewati" ? "opacity-50" : ""}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[14px] font-semibold text-zinc-900 dark:text-white truncate">{m.nama}</div>
                              {m.item && normKey(m.item) === normKey(m.nama) && m.item !== m.nama && (
                                <div className="text-[11px] text-zinc-400 truncate">= {m.item}</div>
                              )}
                              {m.catatan && <div className="text-[11px] italic text-amber-600 dark:text-amber-400 truncate">“{m.catatan}”</div>}
                            </div>
                            <div className="text-[13px] font-bold tabular-nums shrink-0 text-right">
                              {d === "lewati" ? (
                                <span className="text-zinc-400">dilewati</span>
                              ) : isNew ? (
                                <span className="text-emerald-600 dark:text-emerald-400">BARU · {m.jumlah}</span>
                              ) : changed ? (
                                <span className="text-blue-600 dark:text-blue-400">{before} → {m.jumlah}</span>
                              ) : (
                                <span className="text-zinc-400">tetap {m.jumlah}</span>
                              )}
                            </div>
                          </div>
                          {!m.item && (
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {m.saran && d !== `map:${m.saran}` && (
                                <button
                                  type="button"
                                  onClick={() => setDecisions((p) => ({ ...p, [i]: `map:${m.saran}` }))}
                                  className="h-8 px-2.5 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                >
                                  Samakan dgn “{m.saran}”?
                                </button>
                              )}
                              <select
                                value={d}
                                onChange={(e) => setDecisions((p) => ({ ...p, [i]: e.target.value as Decision }))}
                                className="h-8 px-2 rounded-lg text-[12px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 max-w-full"
                              >
                                <option value="baru">+ Tambah barang baru</option>
                                <option value="lewati">Lewati</option>
                                {(cat?.items || []).map((it) => (
                                  <option key={it} value={`map:${it}`}>Samakan dgn: {it}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {stale.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 dark:border-white/10 p-3 space-y-2">
                  <div className="text-[13px] font-black text-zinc-900 dark:text-white">Ada di daftar, tidak ada di laporan ({stale.length})</div>
                  <div className="text-[12px] text-zinc-500 line-clamp-3">{stale.map((s) => s.item).join(", ")}</div>
                  <div className={`grid gap-2 ${isOwner ? "grid-cols-3" : "grid-cols-2"}`}>
                    {([["biarkan", "Biarkan"], ["nol", "Jadikan 0"], ...(isOwner ? [["hapus", "Hapus dari daftar"]] : [])] as [StaleAction, string][]).map(([k, t]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setStaleAction(k)}
                        className={`min-h-[40px] px-2 rounded-xl text-[12px] font-bold border ${staleAction === k ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {staleAction === "hapus" && <p className="text-[11px] text-zinc-400">Barang hanya dihilangkan dari daftar; riwayat & angka lama tetap tersimpan.</p>}
                </div>
              )}
            </div>
            <div className="px-4 pt-2 pb-4 border-t border-zinc-100 dark:border-white/5">
              <button
                type="button"
                onClick={save}
                disabled={saving || stats.lewati === matched.length}
                className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[15px] font-black disabled:opacity-40 active:scale-[0.98]"
              >
                {saving ? "Menyimpan…" : `Simpan laporan · ${stats.berubah} berubah · ${stats.baru} baru`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StokReportPaste;
