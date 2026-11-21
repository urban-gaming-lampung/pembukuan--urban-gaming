import React from "react";
import { Calculator, Check, X } from "lucide-react";
import TableEditor, { AutoFitInput } from "./TableEditor";
import { toInt, formatRibuanInput, rupiah } from "../lib/format";
import { ONGKIR_BAGI_HASIL_SEJAK } from "../lib/sewa";

interface Props {
  rows: any[];
  setRows: React.Dispatch<React.SetStateAction<any[]>>;
  currentDate?: string;
  currentDay?: string;
  isMobileTable?: boolean;
  ongkirMasukGaji?: boolean;
  /** Total pemasukan tunai hari ini (untuk rincian hitungan setoran) */
  totalCash?: number;
  /** Baris Rincian Pengeluaran (untuk rincian potongan cash) */
  rowsPengeluaran?: any[];
}

const BLANK_SETORAN = { ket: "", harga: "", bayar: "" };

export default function RincianSetoran({
  rows,
  setRows,
  currentDate,
  isMobileTable,
  ongkirMasukGaji = false,
  totalCash,
  rowsPengeluaran = [],
}: Props) {
  const sistemBaru = !!currentDate && currentDate >= ONGKIR_BAGI_HASIL_SEJAK;
  const hintOtomatis = sistemBaru
    ? "Kalkulasi otomatis (Semua Cash - Pengeluaran Cash manual)"
    : "Kalkulasi otomatis (Cash - Pengeluaran Cash)";
  void ongkirMasukGaji;

  // Rincian hitungan: semua cash masuk − pengeluaran cash manual (ongkir pengantar dibayar owner sesudah setor)
  const potongan = sistemBaru
    ? rowsPengeluaran
        .filter((r) => r?.bayar === "Cash" && toInt(r?.harga) > 0 && !r?._autoOngkirKey)
        .map((r) => ({ ket: String(r?.ket || "Pengeluaran").trim(), harga: toInt(r?.harga) }))
    : [];
  const ongkirPengantarCash = sistemBaru
    ? rowsPengeluaran.filter((r) => r?._autoOngkirKey && r?.bayar === "Cash").reduce((a, r) => a + toInt(r?.harga), 0)
    : 0;
  const rincianHitung =
    sistemBaru && typeof totalCash === "number" && totalCash > 0 ? (
      <div className="rounded-tile apple-tile ring-1 ring-black/[0.03] dark:ring-white/[0.04] px-3.5 py-2.5 text-caption text-label-2 space-y-1">
        <div className="flex items-center justify-between gap-3">
          <span>Pemasukan cash</span>
          <span className="font-mono tabular-nums text-label">{rupiah(totalCash)}</span>
        </div>
        {potongan.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">− {p.ket}</span>
            <span className="shrink-0 font-mono tabular-nums text-negative">−{rupiah(p.harga)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-sep pt-1 font-semibold text-label">
          <span>Setoran</span>
          <span className="font-mono tabular-nums">{rupiah(Math.max(0, totalCash - potongan.reduce((a, p) => a + p.harga, 0)))}</span>
        </div>
        {ongkirPengantarCash > 0 && (
          <p className="text-caption2 text-label-3 pt-0.5">
            Bagian ongkir pengantar {rupiah(ongkirPengantarCash)} tidak dipotong — ikut disetor, lalu dibayarkan owner ke pengantar.
          </p>
        )}
      </div>
    ) : undefined;

  return (
    <TableEditor<any>
      title="Rincian Setoran Hari Ini"
      slotBawahTable={rincianHitung}
      subtitle={hintOtomatis}
      totalLabel="Total Setoran"
      columns={["No.", "Keterangan (Wajib)", "Nominal (Rp)"]}
      rows={rows}
      setRows={setRows}
      blank={{ ...BLANK_SETORAN }}
      minRows={1}
      onClear={() => {}}
      getHarga={(r) => toInt(String(r?.harga ?? ""))}
      isMobileTable={isMobileTable}
      hidePayColumns
      hideRowActions
      showAddRow={false}
      showReset={false}
      placeholders={{ ket: "Keterangan..." }}
      renderCell={({ keyName, row, rowIndex, isMobile }) => {
        if (keyName === "harga" && rowIndex === 0) {
          return (
            <div className="space-y-1">
              <AutoFitInput
                isMobile={isMobile}
                prefixText="Rp"
                minSample="00.000"
                readOnly
                type="text"
                value={
                  row?.harga === "" || row?.harga === undefined || row?.harga === null
                    ? ""
                    : formatRibuanInput(row.harga, { allowZero: true })
                }
                placeholder="0"
                title={hintOtomatis}
                className="pr-9 font-mono font-semibold tabular-nums text-label opacity-80 cursor-not-allowed"
                rightAdornment={
                  <span className="z-[1] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" title={hintOtomatis}>
                    <Calculator size={14} className="text-label-3" />
                  </span>
                }
              />
              {isMobileTable && (
                <p className="text-caption2 text-label-3 italic px-0.5">{hintOtomatis}</p>
              )}
            </div>
          );
        }
        return undefined;
      }}
      extraColumns={[
        {
          header: "Sudah di TF?",
          center: true,
          mobileLabel: "Sudah di TF?",
          render: ({ row, rowIndex, updateRow, isMobile }) => (
            <div className={`inline-flex items-center justify-center gap-1 apple-segmented rounded-full p-1 w-fit ${isMobile ? "" : "mx-auto"}`}>
              <button
                type="button"
                onClick={() => updateRow(rowIndex, { bayar: "Ya" })}
                className={`flex items-center justify-center gap-1.5 min-h-[34px] px-3 rounded-full text-caption font-semibold transition ${
                  row?.bayar === "Ya"
                    ? "apple-segmented-thumb text-positive"
                    : "text-label-2 hover:text-label"
                }`}
              >
                <Check size={12} strokeWidth={2.5} /> Ya
              </button>
              <button
                type="button"
                onClick={() => updateRow(rowIndex, { bayar: "Belum" })}
                className={`flex items-center justify-center gap-1.5 min-h-[34px] px-3 rounded-full text-caption font-semibold transition ${
                  row?.bayar === "Belum"
                    ? "apple-segmented-thumb text-warning"
                    : "text-label-2 hover:text-label"
                }`}
              >
                <X size={12} strokeWidth={2.5} /> Belum
              </button>
            </div>
          ),
        },
      ]}
    />
  );
}
