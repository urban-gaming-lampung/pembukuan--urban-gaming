import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Receipt } from "lucide-react";
import { Notice, Sheet } from "../ui";
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
    <Sheet
      open={open}
      onClose={onClose}
      size="sm"
      title="Nota Sewa"
      subtitle={sale ? `${sale.noNota} · ${rupiah(sale.total)}` : "Menyiapkan nomor nota…"}
      icon={<Receipt className="w-4 h-4" />}
      iconColor="cyan"
      footer={sale ? <NotaActionButtons sale={sale} actions={actions} /> : undefined}
    >
      <div className="space-y-3">
        {galat && <Notice tone="negative">{galat}</Notice>}
        {actions.msg && <Notice tone="info">{actions.msg}</Notice>}

        <div className="rounded-card apple-card ring-1 ring-edge p-3.5 shadow-card space-y-1.5">
          <label htmlFor="wa-penyewa" className="block text-caption2 font-semibold uppercase tracking-wider text-label-3">
            WhatsApp penyewa
          </label>
          <input
            id="wa-penyewa"
            value={wa}
            onChange={(e) => setWa(e.target.value)}
            onBlur={simpanWa}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            inputMode="tel"
            autoComplete="off"
            placeholder="Opsional · untuk kirim nota lewat WA"
            className="w-full h-11 px-3.5 rounded-field bg-fill border border-sep text-[16px] font-medium text-label placeholder:text-label-3 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-tint/30"
          />
        </div>

        <div className="rounded-card apple-tile ring-1 ring-edge p-3 min-h-[200px] flex items-center justify-center">
          {sale ? <NotaPreview sale={sale} /> : membuat ? <Loader2 className="w-6 h-6 animate-spin text-label-3" /> : null}
        </div>
      </div>
    </Sheet>
  );
};

export default NotaSewaSheet;
