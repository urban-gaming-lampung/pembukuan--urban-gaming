import React from "react";
import TableEditor from "./TableEditor";
import { RowJajanan } from "../lib/types";
import { toInt } from "../lib/format";
import { ChevronDown } from "lucide-react";

type PriceItem = { label: string; price: number };

function pickKey(row: any, candidates: string[]) {
  const keys = Object.keys(row || {});
  const lower = keys.map((k) => ({ k, l: k.toLowerCase() }));
  for (const c of candidates) {
    const hit = lower.find((x) => x.l === c || x.l.includes(c));
    if (hit) return hit.k;
  }
  return null;
}

function normalizeItems(items?: PriceItem[]) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items
    .map((x) => ({
      label: String(x?.label ?? "").trim(),
      price: Math.max(0, Number(x?.price) || 0),
    }))
    .filter((x) => x.label.length > 0);
}

function buildPriceMap(items: PriceItem[]) {
  const map: Record<string, number> = {};
  for (const it of items) map[it.label] = Math.max(0, Number(it.price) || 0);
  return map;
}

function calcHarga(row: any, priceMap: Record<string, number>) {
  const jenisKey = pickKey(row, ["jenis jajanan", "jenisjajanan", "jenis", "jajanan", "menu"]);
  const qtyKey = pickKey(row, ["qty", "jumlah"]);

  const jenis = String(jenisKey ? row[jenisKey] : "");
  const qty = toInt(String(qtyKey ? row[qtyKey] : 0)) || 0;

  const unit = priceMap[jenis] ?? 0;
  return qty * unit;
}

const RincianJajanan: React.FC<{
  rows: RowJajanan[];
  setRows: React.Dispatch<React.SetStateAction<RowJajanan[]>>;
  blank: RowJajanan;
  hargaItems?: PriceItem[];
  isMobileTable?: boolean;
}> = ({ rows, setRows, blank, hargaItems, isMobileTable }) => {
  const items = React.useMemo(() => normalizeItems(hargaItems), [hargaItems]);
  const priceMap = React.useMemo(() => buildPriceMap(items), [items]);
  const menu = React.useMemo(() => items.map((x) => x.label), [items]);

  return (
    <TableEditor<RowJajanan>
      title="2. Rincian Pemasukan Jajanan"
      columns={["No.", "Jenis Jajanan", "Qty & Jam", "Harga (Rp)", "Cash", "Transfer"]}
      rows={rows}
      setRows={setRows}
      blank={blank}
      minRows={5} 
      onClear={() => {}} 
      getHarga={(r) => toInt(String((r as any).harga))}
      renderCell={({ keyName, value, row, rowIndex, inputBase, onKeyNav, updateRow }) => {
        const jenisKey = pickKey(row, ["jenis jajanan", "jenisjajanan", "jenis", "jajanan", "menu"]);
        const qtyKey = pickKey(row, ["qty", "jumlah"]);

        if (jenisKey && keyName === jenisKey) {
          const selected = String(value || "");
          return (
            <div className="relative w-full">
              <select
                className={`${inputBase} appearance-none pr-8 cursor-pointer`}
                value={selected}
                onKeyDown={onKeyNav}
                onChange={(e) => {
                  const nextJenis = e.target.value;
                  const qtyNow = toInt(String(qtyKey ? (row as any)[qtyKey] : 0)) || 0;
                  const unit = priceMap[nextJenis] ?? 0;
                  updateRow(rowIndex, { [jenisKey]: nextJenis, harga: qtyNow * unit } as any);
                }}
              >
                <option value="">Pilih jajanan...</option>
                {menu.length > 0 ? (
                  menu.map((m) => (
                    <option key={m} value={m}>
                      {m}
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

        if (qtyKey && keyName === qtyKey) {
          const v = value ?? "";
          return (
            <input
              type="number" inputMode="numeric" pattern="[0-9]*"
              min={0}
              className={`${inputBase} font-mono`}
              value={v}
              onKeyDown={onKeyNav}
              onChange={(e) => {
                const nextQtyRaw = e.target.value;
                const nextQty = toInt(String(nextQtyRaw)) || 0;
                const jenis = String(jenisKey ? (row as any)[jenisKey] : "");
                const unit = priceMap[jenis] ?? 0;
                updateRow(rowIndex, { [qtyKey]: nextQtyRaw, harga: nextQty * unit } as any);
              }}
              placeholder="0"
            />
          );
        }

        if (keyName === "harga") {
          const computed = calcHarga(row, priceMap);
          const shown = computed || toInt(String((row as any).harga)) || 0;
          return (
             <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-medium select-none">Rp</span>
              <input
                inputMode="numeric"
                className={`${inputBase} pl-8 font-mono font-medium text-zinc-900 dark:text-zinc-100`}
                value={shown}
                onKeyDown={onKeyNav}
                readOnly
                placeholder="0"
              />
            </div>
          );
        }
        return undefined;
      }}
      isMobileTable={isMobileTable}
    />
  );
};

export default RincianJajanan;