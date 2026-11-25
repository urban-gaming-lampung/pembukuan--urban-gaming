import React, { useMemo, useState } from "react";
import { ChevronRight, ShieldCheck, Wallet } from "lucide-react";
import {
  AKSEN_TILE,
  Amount,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  Footnote,
  IconBadge,
  LineItem,
  LineList,
  ListGroup,
  MARK,
  Pill,
  Sheet,
  SplitBar,
  StatTile,
  SubTabs,
  cx,
} from "../../ui";
import { persen, rupiah } from "../../lib/format";
import type { SewaTable } from "../../lib/priceLists";
import {
  fmtWaktu,
  hitungEstimasiBooking,
  mulaiBooking,
  type BookingSewa,
  type RentangEstimasiBooking,
} from "../../lib/bookingSewa";

const LABEL_RENTANG: Record<RentangEstimasiBooking, string> = {
  SEMUA: "semua jadwal aktif",
  HARI_INI: "jadwal hari ini",
  MINGGU: "7 hari ke depan",
  BULAN: "bulan ini",
};

/**
 * ESTIMASI PENDAPATAN BOOKING — khusus Super Admin / Owner.
 * Mengikuti Apple iOS 27 Liquid Glass (Card Hero + nested StatTile konsentris + SplitBar + Detail Sheet).
 */
const EstimasiBookingCard: React.FC<{
  bookings: BookingSewa[];
  sewaTable: SewaTable;
  now: number;
  loading?: boolean;
  onPilihBooking: (bookingId: string) => void;
}> = ({ bookings, sewaTable, now, loading, onPilihBooking }) => {
  const [rentang, setRentang] = useState<RentangEstimasiBooking>("SEMUA");
  const [bukaRincian, setBukaRincian] = useState(false);

  const ringkas = useMemo(
    () => hitungEstimasiBooking(bookings, sewaTable, rentang, now),
    [bookings, sewaTable, rentang, now]
  );

  const rasioDp = ringkas.totalEstimasi > 0 ? (ringkas.dpMasuk / ringkas.totalEstimasi) * 100 : 0;

  return (
    <>
      <Card variant="hero" accent="green">
        {/* Header: Identitas + Lencana Super Admin + Segmented Filter iOS 27 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <IconBadge color="green">
              <Wallet />
            </IconBadge>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="truncate text-headline font-semibold text-label">Estimasi pendapatan booking</h2>
                <Pill color="green" icon={<ShieldCheck />}>
                  Super Admin
                </Pill>
              </div>
              <p className="truncate text-footnote text-label-2">
                {loading
                  ? "Menghitung estimasi…"
                  : `${ringkas.jumlahBooking} booking aktif · ${LABEL_RENTANG[rentang]}`}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto sm:min-w-[272px] shrink-0">
            <SubTabs<RentangEstimasiBooking>
              size="sm"
              ariaLabel="Rentang estimasi pendapatan booking"
              value={rentang}
              onChange={setRentang}
              options={[
                { key: "SEMUA", label: "Semua" },
                { key: "HARI_INI", label: "Hari ini" },
                { key: "MINGGU", label: "7 hari" },
                { key: "BULAN", label: "Bulan" },
              ]}
            />
          </div>
        </div>

        {/* Konten Utama: Hero Nominal (Kiri) + Nested StatTiles & SplitBar (Kanan) */}
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-5 space-y-1.5">
            <Eyebrow>Potensi total</Eyebrow>
            <div className="min-h-[40px] flex items-center">
              <Amount value={ringkas.totalEstimasi} size="display" fitAt={14} />
            </div>
            <p className="text-footnote text-label-2 tabular-nums">
              {ringkas.jumlahBooking === 0 ? (
                "Belum ada booking aktif pada rentang ini."
              ) : (
                <>
                  Sewa <span className="font-semibold text-label">{rupiah(ringkas.totalSewa)}</span>
                  {ringkas.totalOngkir > 0 && (
                    <>
                      {" · "}Ongkir <span className="font-semibold text-label">{rupiah(ringkas.totalOngkir)}</span>
                    </>
                  )}
                </>
              )}
            </p>
            {ringkas.jumlahBooking > 0 && (
              <div className="pt-1">
                <Button
                  variant="plain"
                  size="sm"
                  className="-ml-2 text-tint"
                  onClick={() => setBukaRincian(true)}
                >
                  Lihat rincian per booking
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            )}
          </div>

          <div className="lg:col-span-7 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile
                accent="green"
                dot={MARK.masuk}
                label="DP sudah masuk"
                value={<Amount value={ringkas.dpMasuk} size="headline" fitAt={13} />}
                sub={
                  ringkas.dpCount > 0
                    ? `${ringkas.dpCount} booking · ${persen(rasioDp)}`
                    : "Belum ada DP"
                }
                onClick={ringkas.jumlahBooking > 0 ? () => setBukaRincian(true) : undefined}
                ariaLabel="Lihat rincian DP booking"
              />
              <StatTile
                accent="blue"
                dot={MARK.transfer}
                label="Sisa saat ambil"
                value={<Amount value={ringkas.sisaPelunasan} size="headline" fitAt={13} />}
                sub={ringkas.sisaPelunasan > 0 ? "Potensi pelunasan" : "Sudah lunas DP"}
                onClick={ringkas.jumlahBooking > 0 ? () => setBukaRincian(true) : undefined}
                ariaLabel="Lihat rincian sisa pelunasan booking"
              />
            </div>

            {ringkas.totalEstimasi > 0 && (
              <div className="rounded-tile apple-tile px-3.5 py-2.5 ring-1 ring-edge">
                <SplitBar
                  ariaLabel="Proporsi estimasi booking pasti jadi dibanding belum pasti"
                  segments={[
                    {
                      key: "pasti",
                      label: `Pasti jadi (${ringkas.pastiCount})`,
                      value: ringkas.pastiTotal,
                      color: MARK.masuk,
                      note: rupiah(ringkas.pastiTotal),
                    },
                    {
                      key: "belum",
                      label: `Belum pasti (${ringkas.belumPastiCount})`,
                      value: ringkas.belumPastiTotal,
                      color: AKSEN_TILE.orange.bar,
                      note: rupiah(ringkas.belumPastiTotal),
                    },
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        {ringkas.tanpaHargaCount > 0 && (
          <Footnote className="mt-3">
            {ringkas.tanpaHargaCount} booking memakai durasi khusus di luar tabel harga — baru menghitung DP bila sudah dibayar.
          </Footnote>
        )}
      </Card>

      {/* SHEET RINCIAN ESTIMASI PER BOOKING */}
      <Sheet
        open={bukaRincian}
        onClose={() => setBukaRincian(false)}
        title="Rincian estimasi booking"
        subtitle={`${ringkas.jumlahBooking} booking aktif · ${LABEL_RENTANG[rentang]}`}
        size="md"
        zClassName="z-[260]"
      >
        <div className="space-y-4">
          <ListGroup>
            <LineList className="px-4">
              <LineItem label="Estimasi sewa PS" value={rupiah(ringkas.totalSewa)} />
              {ringkas.totalOngkir > 0 && <LineItem label="Estimasi ongkir" value={rupiah(ringkas.totalOngkir)} />}
              <LineItem
                label="Total potensi pendapatan"
                total
                value={<Amount value={ringkas.totalEstimasi} size="subhead" className="font-bold" />}
              />
              <LineItem
                dot={MARK.masuk}
                label="DP sudah masuk"
                note={ringkas.dpCount > 0 ? `${ringkas.dpCount} booking` : "Belum ada"}
                value={<Amount value={ringkas.dpMasuk} tone={ringkas.dpMasuk > 0 ? "positive" : "neutral"} />}
              />
              <LineItem
                dot={MARK.transfer}
                label="Sisa pelunasan saat ambil"
                value={<Amount value={ringkas.sisaPelunasan} tone={ringkas.sisaPelunasan > 0 ? "tint" : "neutral"} />}
              />
            </LineList>
          </ListGroup>

          {ringkas.items.length === 0 ? (
            <EmptyState icon={<Wallet />} title="Belum ada booking aktif">
              Tidak ada jadwal booking aktif pada rentang yang dipilih.
            </EmptyState>
          ) : (
            <div className="space-y-2">
              <div className="px-1">
                <Eyebrow>Per booking (ketuk untuk detail)</Eyebrow>
              </div>
              <div className="overflow-hidden rounded-tile apple-tile ring-1 ring-edge divide-y divide-sep">
                {ringkas.items.map((it) => {
                  const m = mulaiBooking(it.booking);
                  return (
                    <button
                      key={it.booking.id}
                      type="button"
                      onClick={() => {
                        setBukaRincian(false);
                        onPilihBooking(it.booking.id);
                      }}
                      className="flex min-h-[60px] w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-fill/45 active:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tint"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-subhead font-semibold text-label">
                            {it.booking.nama || "Tanpa nama"}
                          </span>
                          <Pill tone={it.pasti ? "positive" : "warning"}>
                            {it.pasti ? "Pasti" : "Belum pasti"}
                          </Pill>
                        </div>
                        <div className="truncate text-caption text-label-2 tabular-nums">
                          {it.booking.jenisPS} · {String(it.booking.lamaSewa || "").toLowerCase()}
                          {m !== null ? ` · ${fmtWaktu(m)}` : ""}
                        </div>
                      </div>

                      <div className="shrink-0 text-right tabular-nums">
                        <div
                          className={cx(
                            "text-subhead font-bold",
                            it.tanpaHarga && it.total === 0 ? "text-label-3" : "text-label"
                          )}
                        >
                          {it.tanpaHarga && it.total === 0 ? "Manual" : rupiah(it.total)}
                        </div>
                        <div className="text-caption2 text-label-2">
                          {it.dp > 0 ? `DP ${rupiah(it.dp)} · Sisa ${rupiah(it.sisa)}` : `Sisa ${rupiah(it.sisa)}`}
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 shrink-0 text-label-3" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
};

export default EstimasiBookingCard;
