import React from "react";
import TableEditor from "./TableEditor";
import { toInt } from "../lib/format";
import { RowHarian } from "../lib/types";
import { ChevronDown } from "lucide-react";

type PsType = string; 
type PriceItem = { label: string; price: number };

function normalizePs(v: any): PsType {
  const s = String(v ?? "").toUpperCase().replace(/\s+/g, "");
  if (/^PS\d+$/.test(s)) return s; 
  return "";
}

function getRateByPs(ps: PsType, rateMap: Record<string, number>): number {
  return rateMap[ps] ?? 0;
}

function buildRateMapFromHarga(hargaItems?: PriceItem[]) {
  const map: Record<string, number> = {};
  if (Array.isArray(hargaItems)) {
    for (const item of hargaItems) {
      const label = String(item?.label ?? "");
      const m = label.match(/PS\s*(\d+)/i); 
      if (m) {
        const key = `PS${m[1]}`;
        const price = Math.max(0, Number(item?.price) || 0);
        if (price > 0) map[key] = price;
      }
    }
  }
  return map;
}

function findJamKey(obj: Record<string, any>) {
  const keys = Object.keys(obj).filter((k) => k !== "harga" && k !== "bayar");
  const prefer = keys.find(
    (k) => k.toLowerCase().includes("jumlah") && k.toLowerCase().includes("jam")
  );
  if (prefer) return prefer;
  return keys.find((k) => k.toLowerCase().includes("jam") && !k.toLowerCase().includes("masuk")) || "";
}

function findPsKey(obj: Record<string, any>) {
  const keys = Object.keys(obj).filter((k) => k !== "harga" && k !== "bayar");
  return (
    keys.find((k) => k.toLowerCase().includes("jenis") && k.toLowerCase().includes("ps")) ||
    keys.find((k) => k.toLowerCase().includes("ps")) || ""
  );
}

const RincianHarian: React.FC<{
  rows: RowHarian[];
  setRows: React.Dispatch<React.SetStateAction<RowHarian[]>>;
  blank: RowHarian;
  hargaItems?: PriceItem[];
  isMobileTable?: boolean;
}> = ({ rows, setRows, blank, hargaItems, isMobileTable }) => {
  const rateMap = React.useMemo(() => buildRateMapFromHarga(hargaItems), [hargaItems]);
  
  const psOptions = React.useMemo(() => {
    return Object.keys(rateMap).sort();
  }, [rateMap]);

  const recalcHarga = React.useCallback(
    (rowIndex: number, nextRow: RowHarian) => {
      const jamKey = findJamKey(nextRow as any);
      const psKey = findPsKey(nextRow as any);
      if (!jamKey || !psKey) return;

      const jam = Math.max(0, toInt((nextRow as any)[jamKey]));
      const ps = normalizePs((nextRow as any)[psKey]);
      const rate = getRateByPs(ps, rateMap);
      
      const harga = jam * rate;

      setRows((prev) =>
        prev.map((r, idx) => (idx === rowIndex ? ({ ...(r as any), harga } as RowHarian) : r))
      );
    },
    [setRows, rateMap]
  );

  return (
    <TableEditor<RowHarian>
      title="1. Rincian Pemasukan Harian"
      columns={["No.", "Jenis PS", "Jam Masuk", "Jumlah Jam", "Harga (Rp)", "Cash", "Transfer"]}
      rows={rows}
      setRows={setRows}
      blank={blank}
      minRows={5}
      onClear={() => {}}
      getHarga={(r) => toInt(String(r.harga))}
      renderCell={({ keyName, value, row, rowIndex, inputBase, onKeyNav, updateRow }) => {
        const jamKey = findJamKey(row as any);
        const psKey = findPsKey(row as any);

        if (psKey && keyName === psKey) {
          const psVal = normalizePs(value);
          return (
            <div className="relative w-full">
              <select
                className={`${inputBase} appearance-none pr-8 cursor-pointer`}
                value={psVal}
                onKeyDown={onKeyNav}
                onChange={(e) => {
                  const v = e.target.value;
                  const nextRow = { ...(row as any), [keyName]: v } as RowHarian;
                  updateRow(rowIndex, { [keyName]: v } as any);
                  recalcHarga(rowIndex, nextRow);
                }}
              >
                <option value="">Pilih</option>
                {psOptions.length > 0 ? (
                  psOptions.map((ps) => (
                    <option key={ps} value={ps}>
                      {ps}
                    </option>
                  ))
                ) : (
                  <option disabled>List Kosong</option>
                )}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none opacity-60" />
            </div>
          );
        }

        if (jamKey && keyName === jamKey) {
          return (
            <input
              type="number" inputMode="numeric" pattern="[0-9]*"
              min={0}
              className={`${inputBase} font-mono`}
              value={value ?? ""}
              onKeyDown={onKeyNav}
              onChange={(e) => {
                const v = e.target.value;
                const nextRow = { ...(row as any), [keyName]: v } as RowHarian;
                updateRow(rowIndex, { [keyName]: v } as any);
                recalcHarga(rowIndex, nextRow);
              }}
              placeholder="0"
            />
          );
        }
        return undefined;
      }}
      isMobileTable={isMobileTable}
    />
  );
};

export default RincianHarian;