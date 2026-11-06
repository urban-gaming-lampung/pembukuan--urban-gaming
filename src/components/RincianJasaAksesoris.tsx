import React from "react";
import TableEditor from "./TableEditor";
import { RowJasaAks } from "../lib/types";
import { toInt } from "../lib/format";
import { ChevronDown } from "lucide-react";
import { effectiveJasaPrices } from "../lib/priceLists";
import type { Price } from "../constants/prices";

const RincianJasaAksesoris: React.FC<{
  rows: RowJasaAks[];
  setRows: React.Dispatch<React.SetStateAction<RowJasaAks[]>>;
  blank: RowJasaAks;
  isMobileTable?: boolean;
  hargaItems?: Price[];
}> = ({ rows, setRows, blank, isMobileTable, hargaItems }) => {
  // Pilihan "Tipe" = daftar di Pengaturan > Edit Rincian > Jasa & Aksesoris (sumber tunggal)
  const items = React.useMemo(() => effectiveJasaPrices(hargaItems), [hargaItems]);
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
                onChange={(e) => {
                  const tipe = e.target.value;
                  const item = items.find((it) => it.label === tipe);
                  // Harga otomatis dari Edit Rincian bila harga di baris masih kosong (tetap bisa diubah)
                  const patch: any = { tipe };
                  if (item && item.price > 0 && !harga) patch.harga = item.price;
                  updateRow(rowIndex, patch);
                }}
              >
                <option value="">Pilih tipe...</option>
                {items.map((it) => (
                  <option key={it.label} value={it.label}>
                    {it.price > 0 ? `${it.label} — Rp ${it.price.toLocaleString("id-ID")}` : it.label}
                  </option>
                ))}
                {value && !items.some((it) => it.label === value) && (
                  <option value={String(value)}>{String(value)}</option>
                )}
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