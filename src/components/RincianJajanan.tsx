import React from "react";
import TableEditor, { AutoFitInput, AutoFitSelect } from "./TableEditor";
import { RowJajanan } from "../lib/types";
import { toInt, formatRibuanInput } from "../lib/format";

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
      renderCell={({ keyName, value, row, rowIndex, isMobile, onKeyNav, updateRow }) => {
        const jenisKey = pickKey(row, ["jenis jajanan", "jenisjajanan", "jenis", "jajanan", "menu"]);
        const qtyKey = pickKey(row, ["qty", "jumlah"]);

        if (jenisKey && keyName === jenisKey) {
          const selected = String(value || "");
          return (
            <AutoFitSelect
              isMobile={isMobile}
              value={selected}
              onKeyDown={onKeyNav}
              onChange={(e) => {
                const nextJenis = e.target.value;
                const qtyNow = toInt(String(qtyKey ? (row as any)[qtyKey] : 0)) || 0;
                const unit = priceMap[nextJenis] ?? 0;
                updateRow(rowIndex, { [jenisKey]: nextJenis, harga: qtyNow * unit } as any);
              }}
            >
              <option value="" className="bg-surface text-label">Pilih jajanan...</option>
              {menu.length > 0 ? (
                menu.map((m) => (
                  <option key={m} value={m} className="bg-surface text-label">
                    {m}
                  </option>
                ))
              ) : (
                <option disabled className="bg-surface text-label-3">List Kosong</option>
              )}
            </AutoFitSelect>
          );
        }

        if (qtyKey && keyName === qtyKey) {
          const v = value ?? "";
          return (
            <AutoFitInput
              isMobile={isMobile}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              minSample="00"
              className="font-mono"
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
            <AutoFitInput
              isMobile={isMobile}
              prefixText="Rp"
              minSample="00.000"
              type="text"
              inputMode="numeric"
              className="font-mono font-medium text-label"
              value={shown > 0 ? formatRibuanInput(shown) : ""}
              onKeyDown={onKeyNav}
              readOnly
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

export default RincianJajanan;