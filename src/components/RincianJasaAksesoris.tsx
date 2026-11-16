import React from "react";
import { ChevronDown, Package, Receipt } from "lucide-react";
import TableEditor, { BarisTerkunci, UploadTransferProof } from "./TableEditor";
import { NotaPosSheet } from "./NotaPosSheet";
import { RowJasaAks } from "../lib/types";
import { rupiah, toInt } from "../lib/format";
import { effectiveJasaPrices } from "../lib/priceLists";
import type { Price } from "../constants/prices";
import type { BarisNota, NotaBarang } from "../lib/posPembukuan";
import type { PosSale } from "../lib/posSales";
import { Amount, Dot, MARK, Notice, Pill, StatTile, TileValue } from "../ui";

const jam = (ts: number) => new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

/** Pisahkan isi keterangan & nomor nota ("… · URB-…") dari baris nota POS. */
const pecahKet = (b: BarisNota) => {
  const parts = String(b.ket || "").split(" · ");
  return parts.length > 1 ? { isi: parts.slice(0, -1).join(" · "), nota: parts[parts.length - 1] } : { isi: b.ket, nota: b._nota };
};

/** Baris jasa dari nota POS -> baris terkunci di dalam tabel (hanya-baca, dengan tombol lihat nota & bukti TF). */
function barisTerkunciDariNota(
  baris: BarisNota[],
  isMobileTable: boolean | undefined,
  onOpenNota: (target: { saleId: string; noNota: string }) => void,
): BarisTerkunci[] {
  return baris.map((b, i) => {
    const { isi, nota } = pecahKet(b);
    const info = `${nota} · ${jam(b._ts)}`;
    return {
      key: `${b._notaId}-${b.tipe}-${i}`,
      label: "POS",
      info,
      bayar: b.bayar,
      buktiTransfer: b.buktiTransfer,
      ringkasan: `${String(b.tipe).toUpperCase()} · ${rupiah(b.harga)}`,
      detail: <span className="line-clamp-2">{isi}</span>,
      renderNo: () => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenNota({ saleId: b._notaId, noNota: b._nota || nota });
          }}
          aria-label={`Lihat nota ${nota}`}
          title={`Nota ${nota}`}
          className={
            isMobileTable === false
              ? "inline-flex items-center justify-center w-8 h-8 rounded-full bg-tint/10 text-tint hover:bg-tint/15 dark:bg-tint/15 active:scale-90 transition"
              : "inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-fill/90 hover:bg-fill text-tint ring-1 ring-edge text-[11px] font-semibold active:scale-95 transition"
          }
        >
          <Receipt size={13} strokeWidth={2.2} />
          {isMobileTable !== false && <span>Nota</span>}
        </button>
      ),
      nilai: {
        tipe: <Pill tone="neutral">{b.tipe}</Pill>,
        ket: (
          <div className="min-w-0 py-0.5">
            <div className="text-subhead leading-snug text-label line-clamp-2" title={isi}>{isi}</div>
            <div className="mt-0.5 text-caption font-mono text-label-2 whitespace-nowrap">{info}</div>
          </div>
        ),
        harga: <Amount value={b.harga} size="subhead" className="font-semibold whitespace-nowrap" />,
      },
    };
  });
}

const DaftarNotaOwner: React.FC<{
  judul: string;
  dotColor: string;
  subtotal: number;
  items: NotaBarang[];
  isCash: boolean;
  onOpenNota: (n: NotaBarang) => void;
}> = ({ judul, dotColor, subtotal, items, isCash, onOpenNota }) => {
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="flex min-w-0 items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.04em] text-label-2">
          <Dot color={dotColor} />
          <span className="truncate">{judul}</span>
        </span>
        <Amount value={subtotal} size="footnote" className="shrink-0 font-semibold text-label" />
      </div>

      <div className="overflow-hidden rounded-tile apple-tile ring-1 ring-black/[0.03] dark:ring-white/[0.04] divide-y divide-sep">
        {items.map((n) => (
          <div key={n.id} className="px-3.5 py-2.5">
            <div className="flex items-start justify-between gap-2.5">
              <span className="min-w-0 flex-1 truncate text-subhead font-semibold text-label">
                {n.pembeli || "Pelanggan"}
              </span>
              <Amount
                value={n.total}
                size="subhead"
                tone={n.total < 0 ? "negative" : "neutral"}
                className="shrink-0 font-bold whitespace-nowrap"
              />
            </div>

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="font-mono text-caption text-label-2">
                  {n.noNota} · {jam(n.ts)}
                </span>
                <Pill tone={isCash ? "warning" : "tint"}>
                  {isCash ? "Belum disetor" : "TF / QRIS"}
                </Pill>
                {n.label && (
                  <Pill tone={n.label === "DP" ? "warning" : n.label === "Tukar tambah" ? "tint" : "positive"}>
                    {n.label}
                  </Pill>
                )}
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-2">
                {!isCash && n.buktiTransfer && (
                  <UploadTransferProof value={n.buktiTransfer} onChange={() => {}} disabled />
                )}
                <button
                  type="button"
                  onClick={() => onOpenNota(n)}
                  aria-label={`Lihat nota ${n.noNota}`}
                  className="inline-flex h-11 sm:h-9 items-center gap-1.5 rounded-full bg-tint/10 px-3.5 text-caption font-semibold text-tint transition hover:bg-tint/15 dark:bg-tint/15 active:scale-95"
                >
                  <Receipt size={14} />
                  <span>Nota</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Pengingat umum setor langsung ke owner (barang jualan, DP, pelunasan, tukar tambah) — terpisah Cash (belum disetor) & TF. */
const SetorBarangOwner: React.FC<{
  nota: NotaBarang[];
  onOpenNota: (n: NotaBarang) => void;
}> = ({ nota, onOpenNota }) => {
  if (!nota.length) return null;

  const listCash = nota.filter((n) => n.metode !== "TRANSFER");
  const listTf = nota.filter((n) => n.metode === "TRANSFER");
  const totalCash = listCash.reduce((a, n) => a + n.total, 0);
  const totalTf = listTf.reduce((a, n) => a + n.total, 0);
  const totalSemua = totalCash + totalTf;
  const adaDp = nota.some((n) => n.label === "DP" || n.label === "Pelunasan");
  const adaKePembeli = nota.some((n) => n.total < 0);

  return (
    <div className="space-y-3">
      <Notice tone="warning">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <span className="inline-flex items-center gap-1.5 font-semibold text-label">
            <Package size={15} className="shrink-0 text-warning" />
            <span>{nota.length} nota barang{adaDp ? " & DP" : ""} hari ini (Setor Owner)</span>
          </span>
          <Amount value={totalSemua} size="subhead" className="font-bold text-label whitespace-nowrap" />
        </div>
        <p className="mt-1 text-caption leading-relaxed text-label-2">
          Tidak masuk pembukuan kas harian. <span className="font-semibold text-label">Cash berstatus belum disetor</span> ke owner, sedangkan Transfer/QRIS langsung masuk rekening.
          {adaKePembeli ? " Nilai minus = tukar tambah dibayar URBAN ke pembeli." : ""}
        </p>
      </Notice>

      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2.5">
        <StatTile
          dot={MARK.tunai}
          label="Cash · Belum disetor"
          value={
            <TileValue tone={totalCash > 0 ? "warning" : totalCash < 0 ? "negative" : "neutral"}>
              <Amount value={totalCash} size="headline" fitAt={11} />
            </TileValue>
          }
          sub={listCash.length ? `${listCash.length} nota · perlu disetor` : "Tidak ada cash"}
        />
        <StatTile
          dot={MARK.transfer}
          label="Transfer / QRIS"
          value={
            <TileValue tone={totalTf > 0 ? "tint" : totalTf < 0 ? "negative" : "neutral"}>
              <Amount value={totalTf} size="headline" fitAt={11} />
            </TileValue>
          }
          sub={listTf.length ? `${listTf.length} nota · masuk rekening` : "Tidak ada transfer"}
        />
      </div>

      <DaftarNotaOwner
        judul="Cash · Belum disetor ke owner"
        dotColor={MARK.tunai}
        subtotal={totalCash}
        items={listCash}
        isCash
        onOpenNota={onOpenNota}
      />

      <DaftarNotaOwner
        judul="Transfer / QRIS · Setor ke owner"
        dotColor={MARK.transfer}
        subtotal={totalTf}
        items={listTf}
        isCash={false}
        onOpenNota={onOpenNota}
      />
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
  /** Nota barang hari ini (pengingat setor ke owner, umum untuk seluruh admin) */
  notaBarang?: NotaBarang[];
  /** Daftar penuh PosSale hari kerja untuk pratinjau instan nota */
  salesNota?: PosSale[];
  tampilNominalBarang?: boolean;
}> = ({ rows, setRows, blank, isMobileTable, hargaItems, barisNota = [], notaBarang = [], salesNota = [] }) => {
  const [notaAktif, setNotaAktif] = React.useState<{ saleId?: string; noNota?: string } | null>(null);

  // Pilihan "Tipe" = daftar di Pengaturan > Edit Rincian > Rincian Pemasukan Usaha (sumber tunggal)
  const items = React.useMemo(() => effectiveJasaPrices(hargaItems), [hargaItems]);
  const extraTotal = React.useMemo(() => barisNota.reduce((a, b) => a + (Number(b.harga) || 0), 0), [barisNota]);

  const terkunci = React.useMemo(
    () => barisTerkunciDariNota(barisNota, isMobileTable, (t) => setNotaAktif(t)),
    [barisNota, isMobileTable],
  );

  const slot = notaBarang.length ? (
    <SetorBarangOwner
      nota={notaBarang}
      onOpenNota={(n) => setNotaAktif({ saleId: n.saleId, noNota: n.noNota })}
    />
  ) : null;

  return (
    <>
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
                  <option value="" className="bg-surface text-label">Pilih tipe...</option>
                  {items.map((it) => (
                    <option key={it.label} value={it.label} className="bg-surface text-label">
                      {it.price > 0 ? `${it.label} — ${rupiah(it.price)}` : it.label}
                    </option>
                  ))}
                  {value && !items.some((it) => it.label === value) && (
                    <option value={String(value)} className="bg-surface text-label">{String(value)}</option>
                  )}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-label-3 pointer-events-none" />
              </div>
            );
          }

          if (keyName === "ket") {
            const invalid = isHargaKeluar && String(value || "").trim() === "";
            return (
              <input
                className={`${inputBase} ${
                  invalid ? "!border-negative/50 bg-negative/5 focus:!ring-negative/25" : ""
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

      <NotaPosSheet
        open={!!notaAktif}
        saleId={notaAktif?.saleId}
        noNota={notaAktif?.noNota}
        sales={salesNota}
        onClose={() => setNotaAktif(null)}
      />
    </>
  );
};

export default RincianJasaAksesoris;
