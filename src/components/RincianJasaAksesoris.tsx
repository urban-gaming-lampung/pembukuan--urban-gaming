import React from "react";
import TableEditor from "./TableEditor";
import { RowJasaAks } from "../lib/types";
import { toInt } from "../lib/format";
import { ChevronDown } from "lucide-react";

const TIPE_OPTIONS = ["Isi Game", "Stik & Aksesoris", "Upgrade HEN", "Aksesoris"];

const RincianJasaAksesoris: React.FC<{
  rows: RowJasaAks[];
  setRows: React.Dispatch<React.SetStateAction<RowJasaAks[]>>;
  blank: RowJasaAks;
  isMobileTable?: boolean;
}> = ({ rows, setRows, blank, isMobileTable }) => {
  return (
    <TableEditor<RowJasaAks>
      title="3. Rincian Pemasukan Jasa & Aksesoris"
      columns={["No.", "Tipe", "Keterangan", "Harga (Rp)", "Cash", "Transfer"]}
      rows={rows}
      setRows={setRows}
      blank={blank}
      minRows={5}
      onClear={() => {}}
      getHarga={(r) => toInt(String((r as any).harga))}
      renderCell={({ keyName, value, row, rowIndex, inputBase, onKeyNav, updateRow }) => {
        const harga = toInt(String((row as any).harga));
        const isHargaKeluar = harga > 0;

        if (keyName === "tipe") {
          return (
            <div className="relative w-full">
              <select
                className={`${inputBase} appearance-none pr-8 cursor-pointer`}
                value={String(value || "")}
                onKeyDown={onKeyNav}
                onChange={(e) => updateRow(rowIndex, { tipe: e.target.value } as any)}
              >
                <option value="">Pilih tipe...</option>
                {TIPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none opacity-60" />
            </div>
          );
        }

        if (keyName === "ket") {
          const invalid = isHargaKeluar && String(value || "").trim() === "";
          return (
            <input
              className={`${inputBase} ${
                invalid ? "!border-red-500/50 bg-red-50/50 focus:!ring-red-500/30" : ""
              }`}
              value={String(value || "")}
              onKeyDown={onKeyNav}
              onChange={(e) => updateRow(rowIndex, { ket: e.target.value } as any)}
              placeholder={invalid ? "Wajib diisi..." : "Keterangan"}
              required={isHargaKeluar}
            />
          );
        }
        return undefined;
      }}
      isMobileTable={isMobileTable}
    />
  );
};

export default RincianJasaAksesoris;