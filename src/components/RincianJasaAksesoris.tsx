import React from "react";
import TableEditor from "./TableEditor";
import { RowJasaAks } from "../lib/types";
import { toInt } from "../lib/format";
import { ChevronDown, Lock, Package } from "lucide-react";
import { effectiveJasaPrices } from "../lib/priceLists";
import type { Price } from "../constants/prices";
import type { BarisNota, NotaBarang } from "../lib/posPembukuan";

const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(Number(n) || 0));
const jam = (ts: number) => new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** Baris jasa dari POS kasir: tampil terkunci di atas tabel manual. */
const BarisPos: React.FC<{ baris: BarisNota[] }> = ({ baris }) => {
  if (!baris.length) return null;
  return (
    <div className="rounded-[20px] bg-zinc-50 dark:bg-white/[0.04] ring-1 ring-black/5 dark:ring-white/10 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          <Lock className="w-3 h-3" /> Dari POS Kasir
        </span>
        <span className="text-[11px] text-zinc-400">otomatis · {baris.length} baris</span>
      </div>
      <ul className="divide-y divide-zinc-200/70 dark:divide-white/5">
        {baris.map((b, i) => {
          const parts = b.ket.split(" · ");
          const nota = parts.length > 1 ? parts[parts.length - 1] : b._nota;
          const isi = parts.length > 1 ? parts.slice(0, -1).join(" · ") : b.ket;
          return (
            <li key={`${b._notaId}-${b.tipe}-${i}`} className="flex items-start gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold text-white" style={{ backgroundColor: "#ED4343" }}>{b.tipe}</span>
                  <span className="text-[11px] font-mono text-zinc-400 truncate">{nota} · {jam(b._ts)}</span>
                </div>
                <p className="mt-1 text-[13px] leading-snug text-zinc-800 dark:text-zinc-100 line-clamp-2">{isi}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[14px] font-bold tabular-nums text-zinc-900 dark:text-white">{rp(b.harga)}</div>
                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold ${b.bayar === "Transfer" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
                  {b.bayar === "Transfer" ? "TF/QRIS" : "Cash"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/** Pengingat nota barang hari ini — uangnya langsung disetor ke owner, tidak masuk kas harian. */
const PengingatBarang: React.FC<{ nota: NotaBarang[]; tampilNominal?: boolean }> = ({ nota, tampilNominal }) => {
  if (!nota.length) return null;
  const total = nota.reduce((a, n) => a + n.total, 0);
  const adaDp = nota.some((n) => n.label);
  return (
    <div className="rounded-[20px] bg-amber-50 dark:bg-amber-500/[0.08] ring-1 ring-amber-200/70 dark:ring-amber-500/20 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Package className="w-3.5 h-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-amber-900 dark:text-amber-200 leading-snug">
            {nota.length} nota barang{adaDp ? " & DP" : ""} hari ini
            {tampilNominal && <span className="whitespace-nowrap"> · {rp(total)}</span>}
          </p>
          <p className="text-[12px] text-amber-800/80 dark:text-amber-300/80 leading-snug">Setor langsung ke owner — tidak masuk kas harian.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {nota.map((n) => (
              <span key={n.id} className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-white/10 text-[11px] font-mono font-semibold text-amber-900 dark:text-amber-200">
                {n.noNota}{n.label ? ` · ${n.label}` : ""}{tampilNominal ? ` · ${rp(n.total)}` : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const RincianJasaAksesoris: React.FC<{
  rows: RowJasaAks[];
  setRows: React.Dispatch<React.SetStateAction<RowJasaAks[]>>;
  blank: RowJasaAks;
  isMobileTable?: boolean;
  hargaItems?: Price[];
  /** Baris jasa dari nota POS hari ini (terkunci) */
  barisNota?: BarisNota[];
  /** Nota barang hari ini (pengingat setor ke owner) */
  notaBarang?: NotaBarang[];
  /** Owner / super admin melihat nominal nota barang */
  tampilNominalBarang?: boolean;
}> = ({ rows, setRows, blank, isMobileTable, hargaItems, barisNota = [], notaBarang = [], tampilNominalBarang }) => {
  // Pilihan "Tipe" = daftar di Pengaturan > Edit Rincian > Rincian Pemasukan Usaha (sumber tunggal)
  const items = React.useMemo(() => effectiveJasaPrices(hargaItems), [hargaItems]);
  const extraTotal = React.useMemo(() => barisNota.reduce((a, b) => a + (Number(b.harga) || 0), 0), [barisNota]);
  const slot =
    barisNota.length || notaBarang.length ? (
      <div className="flex flex-col gap-2.5">
        <BarisPos baris={barisNota} />
        <PengingatBarang nota={notaBarang} tampilNominal={tampilNominalBarang} />
      </div>
    ) : null;
  return (
    <TableEditor<RowJasaAks>
      title="3. Rincian Pemasukan Usaha"
      columns={["No.", "Tipe", "Keterangan", "Harga (Rp)", "Cash", "Transfer"]}
      rows={rows}
      setRows={setRows}
      blank={blank}
      minRows={5}
      onClear={() => {}}
      extraTotal={extraTotal}
      slotAtas={slot}
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
