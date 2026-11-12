import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Receipt, X } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { NotaActionButtons, NotaPreview, useNotaActions } from "./PosCheckoutSheet";
import { ambilNomorNotaSewa, BarisSewaNota, notaSewaDariBaris } from "../lib/notaSewa";
import { rapikanWa } from "../lib/wa";
import { waBaris } from "../lib/sewa";
import { rupiah } from "../lib/format";


/**
 * Lembar nota sewa untuk satu baris Rincian Pemasukan SEWA PS:
 * nomor nota dibuat sekali (disimpan di baris), lalu bisa dicetak thermal, diunduh PDF,
 * atau dikirim ke WhatsApp penyewa — sama seperti nota POS.
 */
const NotaSewaSheet: React.FC<{
  row: BarisSewaNota | null;
  hargaDasar: number;
  tanggal: string;
  kasirEmail?: string | null;
  /** Simpan nomor nota / WA penyewa ke baris sewa */
  onPatch: (patch: Partial<BarisSewaNota>) => void;
  onClose: () => void;
}> = ({ row, hargaDasar, tanggal, kasirEmail, onPatch, onClose }) => {
  const open = !!row;
  useBodyScrollLock(open);
  const [membuat, setMembuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [wa, setWa] = useState("");
  const [waFinal, setWaFinal] = useState("");

  useEffect(() => {
    if (!row) return;
    setGalat("");
    // Satu sumber: kolom No. WA Penyewa di tabel sewa
    setWa(waBaris(row));
    setWaFinal(waBaris(row));
    if (row._noNota) return;
    let alive = true;
    setMembuat(true);
    ambilNomorNotaSewa()
      .then((n) => { if (alive) onPatch({ _noNota: n.noNota, _notaTs: n.ts }); })
      .catch((e) => { if (alive) setGalat("Nomor nota gagal dibuat: " + (e?.message || e)); })
      .finally(() => { if (alive) setMembuat(false); });
    return () => { alive = false; };
    // Hanya saat lembar dibuka untuk baris ini
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?._rowId, open]);

  // Nota disusun ulang hanya bila isi yang tercetak berubah (bukan setiap render tabel)
  const tanda = row
    ? JSON.stringify([row._noNota, row._notaTs, row.jenisPS, row.lamaSewa, row._customDurasi, row.jamMasukSewa, row.ket, row.isPaid, row.harga, row.isOngkir, row._ongkir, row._customBase, row.bayar, row.diantarOleh, hargaDasar, tanggal, waFinal, kasirEmail])
    : "";
  const sale = useMemo(
    () =>
      row?._noNota
        ? notaSewaDariBaris(row, { noNota: row._noNota, ts: Number(row._notaTs) || Date.now(), tanggal, hargaDasar, kasir: kasirEmail || undefined, wa: waFinal.trim() || undefined })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tanda]
  );
  const actions = useNotaActions(sale);

  if (!open) return null;

  const simpanWa = () => {
    const v = rapikanWa(wa);
    setWa(v);
    if (v === waFinal) return;
    setWaFinal(v);
    onPatch({ waPenyewa: v });
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center font-sans">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-zinc-50 dark:bg-[#141416] rounded-t-[26px] sm:rounded-[26px] max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
        <div className="px-4 pt-2 pb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0"><Receipt className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-black text-zinc-900 dark:text-white leading-tight">Nota Sewa</h3>
            <p className="text-[12px] text-zinc-500 font-mono truncate">{sale ? `${sale.noNota} · ${rupiah(sale.total)}` : "Menyiapkan nomor nota…"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-9 h-9 rounded-full bg-zinc-200/70 dark:bg-zinc-800 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {galat && <div className="text-[12.5px] font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{galat}</div>}
          {actions.msg && <div className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#1c1c1e] rounded-xl px-3 py-2">{actions.msg}</div>}

          <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-3.5 space-y-1.5">
            <label htmlFor="wa-penyewa" className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">WhatsApp penyewa</label>
            <input
              id="wa-penyewa"
              value={wa}
              onChange={(e) => setWa(e.target.value)}
              onBlur={simpanWa}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              inputMode="tel"
              autoComplete="off"
              placeholder="Opsional · untuk kirim nota lewat WA"
              className="w-full h-12 px-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[15px] font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
          </div>

          <div className="rounded-[22px] bg-zinc-200/60 dark:bg-black/40 p-3 min-h-[200px] flex items-center justify-center">
            {sale ? <NotaPreview sale={sale} /> : membuat ? <Loader2 className="w-6 h-6 animate-spin text-zinc-400" /> : null}
          </div>
        </div>

        {sale && (
          <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-white dark:bg-[#1c1c1e] border-t border-zinc-200/70 dark:border-white/5">
            <NotaActionButtons sale={sale} actions={actions} />
          </div>
        )}
      </div>
    </div>
  );
};

export default NotaSewaSheet;
