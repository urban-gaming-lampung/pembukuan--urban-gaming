import React from "react";
import { Calculator, Check, X } from "lucide-react";
import TableEditor, { AutoFitInput } from "./TableEditor";
import { toInt, formatRibuanInput } from "../lib/format";

interface Props {
  rows: any[];
  setRows: React.Dispatch<React.SetStateAction<any[]>>;
  currentDate?: string;
  currentDay?: string;
  isMobileTable?: boolean;
}

const BLANK_SETORAN = { ket: "", harga: "", bayar: "" };

export default function RincianSetoran({
  rows,
  setRows,
  currentDate,
  isMobileTable,
}: Props) {
  const hintOtomatis =
    currentDate && currentDate >= "2026-04-29"
      ? "Kalkulasi otomatis (Total Cash - Pengeluaran Manual)"
      : "Kalkulasi otomatis (Cash - Pengeluaran)";

  return (
    <TableEditor<any>
      title="Rincian Setoran Hari Ini"
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
                className={`flex items-center justify-center gap-1.5 min-h-[34px] px-3 rounded-full text-caption font-semibold transition-all ${
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
                className={`flex items-center justify-center gap-1.5 min-h-[34px] px-3 rounded-full text-caption font-semibold transition-all ${
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
