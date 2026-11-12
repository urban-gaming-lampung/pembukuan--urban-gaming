import React from "react";
import TableEditor, { BarisTerkunci } from "./TableEditor";
import { RowJasaAks } from "../lib/types";
import { toInt } from "../lib/format";
import { ChevronDown, Package } from "lucide-react";
import { effectiveJasaPrices } from "../lib/priceLists";
import type { Price } from "../constants/prices";
import type { BarisNota, NotaBarang } from "../lib/posPembukuan";

const rp = (n: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(Number(n) || 0));
const jam = (ts: number) => new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** Pisahkan isi keterangan & nomor nota ("… · URB-…") dari baris nota POS. */
const pecahKet = (b: BarisNota) => {
  const parts = String(b.ket || "").split(" · ");
  return parts.length > 1 ? { isi: parts.slice(0, -1).join(" · "), nota: parts[parts.length - 1] } : { isi: b.ket, nota: b._nota };
};

/** Baris jasa dari nota POS → baris terkunci di dalam tabel (hanya-baca). */
function barisTerkunciDariNota(baris: BarisNota[]): BarisTerkunci[] {
  return baris.map((b, i) => {
    const { isi, nota } = pecahKet(b);
    const info = `${nota} · ${jam(b._ts)}`;
    return {
      key: `${b._notaId}-${b.tipe}-${i}`,
      label: "POS",
      info,
      bayar: b.bayar,
      ringkasan: `${String(b.tipe).toUpperCase()} - ${rp(b.harga)}`,
      detail: <span className="line-clamp-2">{isi}</span>,
      nilai: {
        tipe: (
          <span className="px-2 py-0.5 rounded-md text-[11.5px] font-bold text-white whitespace-nowrap" style={{ backgroundColor: "#ED4343" }}>
            {b.tipe}
          </span>
        ),
        ket: (
          <div className="min-w-0 py-0.5">
            <div className="text-[13px] leading-snug line-clamp-2" title={isi}>{isi}</div>
            <div className="text-[11px] font-mono text-zinc-400 mt-0.5 whitespace-nowrap">{info}</div>
          </div>
        ),
        harga: <span className="font-mono font-medium tabular-nums whitespace-nowrap">{rp(b.harga)}</span>,
      },
    };
  });
}

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
  // Baris jasa dari nota POS tampil DI DALAM tabel (terkunci); nota barang = pengingat setor ke owner
  const terkunci = React.useMemo(() => barisTerkunciDariNota(barisNota), [barisNota]);
  const slot = notaBarang.length ? <PengingatBarang nota={notaBarang} tampilNominal={tampilNominalBarang} /> : null;
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
      barisTerkunci={terkunci}
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
