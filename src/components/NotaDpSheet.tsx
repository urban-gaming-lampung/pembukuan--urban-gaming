import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Ban, CheckCircle2, Clock, Loader2, Package, Receipt, Undo2, Wallet, X } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import type { StokItemValue } from "../hooks/useStokData";
import { batalkanNotaDp, hariKeJatuhTempo, lunasiNotaDp, PosSale, sisaBayar, totalDibayar } from "../lib/posSales";
import { fmtJatuhTempo } from "../lib/posReceipt";
import { NotaActionButtons, NotaPreview, useNotaActions } from "./PosCheckoutSheet";
import { UploadTransferProof } from "./TableEditor";
import { rupiah } from "../lib/format";


/** Label jatuh tempo: lewat / hari ini / H-n. */
export function labelJatuhTempo(s: PosSale): { teks: string; tone: "lewat" | "dekat" | "aman" } {
  const h = hariKeJatuhTempo(s.jatuhTempo);
  if (h === null) return { teks: "Tanpa jatuh tempo", tone: "aman" };
  if (h < 0) return { teks: `Lewat ${-h} hari`, tone: "lewat" };
  if (h === 0) return { teks: "Jatuh tempo hari ini", tone: "dekat" };
  if (h <= 2) return { teks: `${h} hari lagi`, tone: "dekat" };
  return { teks: `Jatuh tempo ${fmtJatuhTempo(s.jatuhTempo).replace(/^\w+, /, "")}`, tone: "aman" };
}
const TONE = {
  lewat: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  dekat: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  aman: "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
};

/**
 * Pilihan pembatalan nota DP (owner / super admin):
 * dibatalkan pembeli = DP hangus (pemasukan usaha) · dibatalkan URBAN = DP dikembalikan.
 */
export const BatalDp: React.FC<{ sale: PosSale; onSelesai: (s: PosSale) => void; onKembali?: () => void }> = ({ sale, onSelesai, onKembali }) => {
  const [pihak, setPihak] = useState<"PEMBELI" | "URBAN" | null>(null);
  const [alasan, setAlasan] = useState("");
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const dp = totalDibayar(sale);
  const pilihan = [
    { k: "PEMBELI" as const, judul: "Dibatalkan pembeli", isi: `DP ${rupiah(dp)} hangus — dicatat sebagai pemasukan usaha.`, icon: <Ban className="w-5 h-5" /> },
    { k: "URBAN" as const, judul: "Dibatalkan URBAN", isi: `DP ${rupiah(dp)} dikembalikan penuh ke pembeli — bukan pemasukan.`, icon: <Undo2 className="w-5 h-5" /> },
  ];
  const simpan = async () => {
    if (!pihak) return;
    setBusy(true);
    setGalat("");
    try {
      onSelesai(await batalkanNotaDp(sale, pihak, alasan));
    } catch (e: any) {
      setGalat("Gagal membatalkan: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2.5">
      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 px-1">Siapa yang membatalkan?</div>
      {pilihan.map((p) => (
        <button key={p.k} type="button" onClick={() => setPihak(p.k)} aria-pressed={pihak === p.k}
          className={`w-full text-left flex items-start gap-3 rounded-2xl p-3.5 transition ${pihak === p.k ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-white dark:bg-[#1c1c1e] text-zinc-900 dark:text-white"}`}>
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${pihak === p.k ? "bg-white/15 dark:bg-black/10" : "bg-zinc-100 dark:bg-white/10"}`}>{p.icon}</span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-black">{p.judul}</span>
            <span className={`block text-[12.5px] leading-snug mt-0.5 ${pihak === p.k ? "opacity-80" : "text-zinc-500 dark:text-zinc-400"}`}>{p.isi}</span>
          </span>
        </button>
      ))}
      <input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan (opsional)" autoComplete="off"
        className="w-full h-12 px-3.5 rounded-xl bg-white dark:bg-[#1c1c1e] text-[14.5px] font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-zinc-900/15 dark:focus:ring-white/20" />
      {galat && <div className="text-[12.5px] font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{galat}</div>}
      <div className="grid grid-cols-[auto_1fr] gap-2">
        {onKembali && (
          <button type="button" onClick={onKembali} disabled={busy} className="h-12 px-4 rounded-xl text-[13.5px] font-bold bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200">Batal</button>
        )}
        <button type="button" onClick={simpan} disabled={!pihak || busy}
          className={`h-12 rounded-xl text-[14px] font-black text-white bg-red-600 disabled:opacity-40 flex items-center justify-center gap-2 ${onKembali ? "" : "col-span-2"}`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}Batalkan nota DP
        </button>
      </div>
    </div>
  );
};

type Mode = { k: "list" } | { k: "lunasi"; id: string } | { k: "nota"; id: string } | { k: "batal"; id: string } | { k: "selesai"; sale: PosSale; judul: string };

/**
 * BELUM LUNAS — daftar nota DP: pelunasan (kasir), lihat/cetak nota, batalkan (owner).
 */
const NotaDpSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  list: PosSale[];
  isOwner?: boolean;
  kasirNama: string;
  data: Record<string, Record<string, StokItemValue>>;
}> = ({ open, onClose, list, isOwner, kasirNama, data }) => {
  useBodyScrollLock(open);
  const [mode, setMode] = useState<Mode>({ k: "list" });
  const [metode, setMetode] = useState<"CASH" | "TRANSFER">("CASH");
  const [bukti, setBukti] = useState("");
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  useEffect(() => { if (!open) { setMode({ k: "list" }); setGalat(""); } }, [open]);

  const aktif = mode.k === "lunasi" || mode.k === "nota" || mode.k === "batal" ? list.find((s) => s.id === mode.id) || null : null;
  const notaTampil = mode.k === "selesai" ? mode.sale : mode.k === "nota" ? aktif : null;
  const actions = useNotaActions(notaTampil);
  // Nota yang sedang dibuka sudah dilunasi / dibatalkan dari HP lain
  useEffect(() => {
    if ((mode.k === "lunasi" || mode.k === "nota" || mode.k === "batal") && !aktif) setMode({ k: "list" });
  }, [mode, aktif]);

  const totalSisa = useMemo(() => list.reduce((a, s) => a + sisaBayar(s), 0), [list]);
  if (!open) return null;

  const mulaiLunasi = (s: PosSale) => { setMetode("CASH"); setBukti(""); setGalat(""); setMode({ k: "lunasi", id: s.id! }); };
  const lunasi = async () => {
    if (!aktif) return;
    if (metode === "TRANSFER" && !bukti) { setGalat("Upload foto bukti transfer dulu."); return; }
    setBusy(true);
    setGalat("");
    try {
      const s = await lunasiNotaDp(aktif, { metode, buktiTransfer: metode === "TRANSFER" ? bukti : undefined, kasirNama });
      setMode({ k: "selesai", sale: s, judul: "Pelunasan tersimpan" });
    } catch (e: any) {
      setGalat("Pelunasan gagal: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const judul =
    mode.k === "lunasi" ? "Pelunasan" : mode.k === "nota" ? "Nota DP" : mode.k === "batal" ? "Batalkan nota DP" : mode.k === "selesai" ? mode.judul : "Belum Lunas";
  const sub =
    mode.k === "list"
      ? list.length ? `${list.length} nota DP · sisa tagihan ${rupiah(totalSisa)}` : "Tidak ada nota DP"
      : aktif ? `${aktif.noNota} · ${aktif.pembeli || "Pelanggan"}` : mode.k === "selesai" ? mode.sale.noNota : "";

  return (
    <div className="fixed inset-0 z-[255] flex items-end sm:items-center justify-center font-sans">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={busy ? undefined : onClose} />
      <div className="relative w-full sm:max-w-md bg-zinc-50 dark:bg-[#141416] rounded-t-[26px] sm:rounded-[26px] max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
        <div className="px-4 pt-2 pb-3 flex items-center gap-3">
          {mode.k !== "list" ? (
            <button type="button" onClick={() => setMode({ k: "list" })} disabled={busy} aria-label="Kembali ke daftar" className="w-9 h-9 rounded-full bg-zinc-200/70 dark:bg-zinc-800 flex items-center justify-center shrink-0"><ArrowLeft className="w-4 h-4" /></button>
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0"><Clock className="w-5 h-5" /></div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-black text-zinc-900 dark:text-white leading-tight">{judul}</h3>
            <p className="text-[12px] text-zinc-500 truncate">{sub}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Tutup" className="w-9 h-9 rounded-full bg-zinc-200/70 dark:bg-zinc-800 flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {/* ===== Daftar ===== */}
          {mode.k === "list" && (
            list.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                <div className="mt-2 text-[15px] font-black text-zinc-800 dark:text-zinc-100">Semua nota sudah lunas</div>
                <p className="text-[12.5px] text-zinc-500 mt-1">Nota DP dibuat dari Selesaikan Transaksi › Bayar DP.</p>
              </div>
            ) : (
              list.map((s) => {
                const jt = labelJatuhTempo(s);
                const barang = (s.items || []).map((it) => `${it.qty > 1 ? `${it.qty}× ` : ""}${it.nama}`);
                return (
                  <div key={s.id} className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[15px] font-black text-zinc-900 dark:text-white truncate">{s.pembeli || "Pelanggan"}</div>
                        <div className="text-[11.5px] font-mono text-zinc-400">{s.noNota}</div>
                      </div>
                      <span className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-bold ${TONE[jt.tone]}`}>{jt.teks}</span>
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-snug text-zinc-600 dark:text-zinc-300 line-clamp-2">{barang.join(", ")}</p>
                    <div className="mt-2.5 grid grid-cols-3 gap-2 text-[11.5px]">
                      <div><div className="text-zinc-400">Total</div><div className="font-bold tabular-nums text-zinc-900 dark:text-white">{rupiah(s.total)}</div></div>
                      <div><div className="text-zinc-400">DP</div><div className="font-bold tabular-nums text-zinc-900 dark:text-white">{rupiah(totalDibayar(s))}</div></div>
                      <div className="text-right"><div className="text-zinc-400">Sisa</div><div className="font-black tabular-nums text-red-600">{rupiah(sisaBayar(s))}</div></div>
                    </div>
                    <div className={`mt-3 grid gap-2 ${isOwner ? "grid-cols-[1fr_auto_auto]" : "grid-cols-[1fr_auto]"}`}>
                      <button type="button" onClick={() => mulaiLunasi(s)} className="h-11 rounded-xl bg-blue-600 text-white text-[13.5px] font-black flex items-center justify-center gap-1.5 active:scale-[0.98]">
                        <Wallet className="w-4 h-4" />Pelunasan
                      </button>
                      <button type="button" onClick={() => setMode({ k: "nota", id: s.id! })} aria-label={`Nota ${s.noNota}`} className="h-11 px-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-[13px] font-bold flex items-center gap-1.5">
                        <Receipt className="w-4 h-4" />Nota
                      </button>
                      {isOwner && (
                        <button type="button" onClick={() => setMode({ k: "batal", id: s.id! })} aria-label={`Batalkan ${s.noNota}`} className="h-11 w-11 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 flex items-center justify-center">
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )
          )}

          {/* ===== Pelunasan ===== */}
          {mode.k === "lunasi" && aktif && (
            <>
              <div className="rounded-[20px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-3.5">
                <div className="text-[11px] font-bold uppercase tracking-widest opacity-60">Sisa yang dibayar</div>
                <div className="text-[30px] font-black font-mono tracking-tight leading-none mt-1">{rupiah(sisaBayar(aktif))}</div>
                <div className="text-[12px] mt-1.5 opacity-80">Total {rupiah(aktif.total)} · DP {rupiah(totalDibayar(aktif))}</div>
              </div>
              <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-3.5 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Metode pelunasan</div>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800">
                  {(["CASH", "TRANSFER"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => { setMetode(m); setGalat(""); }}
                      className={`h-10 rounded-[10px] text-[13px] font-bold transition ${metode === m ? (m === "CASH" ? "bg-emerald-600 text-white shadow" : "bg-blue-600 text-white shadow") : "text-zinc-500"}`}>
                      {m === "CASH" ? "Tunai" : "Transfer / QRIS"}
                    </button>
                  ))}
                </div>
                {metode === "TRANSFER" && (
                  <div className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 ${bukti ? "bg-blue-50 dark:bg-blue-500/10" : "bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-300/60 dark:ring-amber-500/30"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-zinc-900 dark:text-white">Bukti transfer</div>
                      <div className={`text-[12px] ${bukti ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-400"}`}>{bukti ? "Terupload ✓" : "Wajib · foto / screenshot bukti transfer"}</div>
                    </div>
                    <UploadTransferProof value={bukti} onChange={setBukti} />
                  </div>
                )}
              </div>
              <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Barang diserahkan · stok berkurang</div>
                  <Package className="w-4 h-4 text-zinc-300" />
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-white/5">
                  {(aktif.items || []).map((it, i) => {
                    const r = it.stokRef;
                    const v = r ? data?.[r.kategori]?.[r.item] : undefined;
                    const sisa = v ? Math.max(0, Math.round(Number(v.jumlah) || 0)) : null;
                    const kurang = sisa !== null && sisa < it.qty;
                    return (
                      <div key={i} className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-bold text-zinc-900 dark:text-white leading-snug">{it.nama}</div>
                          {r && sisa !== null && (
                            <div className={`text-[11.5px] font-semibold ${kurang ? "text-red-600" : "text-zinc-500"}`}>
                              {kurang ? <><AlertTriangle className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />Stok tercatat {sisa}, butuh {it.qty} — cek stok fisik</> : `Stok ${r.item}: ${sisa} → ${sisa - it.qty}`}
                            </div>
                          )}
                          {r && sisa === null && <div className="text-[11.5px] text-zinc-400">Stok {r.item} belum dihitung</div>}
                        </div>
                        <div className="shrink-0 text-[12.5px] font-bold font-mono text-zinc-700 dark:text-zinc-200">{it.qty}×</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {galat && <div className="text-[12.5px] font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{galat}</div>}
            </>
          )}

          {/* ===== Batalkan ===== */}
          {mode.k === "batal" && aktif && (
            <BatalDp sale={aktif} onKembali={() => setMode({ k: "list" })} onSelesai={(s) => setMode({ k: "selesai", sale: s, judul: s.status === "BATAL_PEMBELI" ? "DP hangus" : "DP dikembalikan" })} />
          )}

          {/* ===== Nota (DP / hasil pelunasan / pembatalan) ===== */}
          {notaTampil && (
            <>
              {mode.k === "selesai" && (
                <div className={`flex items-start gap-2 rounded-2xl p-3 text-[12.5px] leading-snug ${mode.sale.status === "LUNAS" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-zinc-200/70 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
                  <span>
                    {mode.sale.status === "LUNAS"
                      ? "Nota sekarang LUNAS & stok barang sudah berkurang. Kirim / cetak nota lunas untuk pembeli."
                      : mode.sale.status === "BATAL_PEMBELI"
                        ? "Nota dibatalkan pembeli — DP hangus & tercatat sebagai pemasukan usaha."
                        : "Nota dibatalkan URBAN — kembalikan DP ke pembeli."}
                  </span>
                </div>
              )}
              {actions.msg && <div className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#1c1c1e] rounded-xl px-3 py-2">{actions.msg}</div>}
              <div className="rounded-[22px] bg-zinc-200/60 dark:bg-black/40 p-3">
                <NotaPreview sale={notaTampil} />
              </div>
            </>
          )}
        </div>

        {mode.k === "lunasi" && aktif && (
          <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-white dark:bg-[#1c1c1e] border-t border-zinc-200/70 dark:border-white/5">
            <button type="button" onClick={lunasi} disabled={busy || (metode === "TRANSFER" && !bukti)}
              className="w-full h-[52px] rounded-2xl bg-blue-600 text-white text-[15px] font-black flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]">
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}Lunasi {rupiah(sisaBayar(aktif))}
            </button>
          </div>
        )}
        {notaTampil && (
          <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-white dark:bg-[#1c1c1e] border-t border-zinc-200/70 dark:border-white/5">
            <NotaActionButtons sale={notaTampil} actions={actions} />
          </div>
        )}
      </div>
    </div>
  );
};

export default NotaDpSheet;
