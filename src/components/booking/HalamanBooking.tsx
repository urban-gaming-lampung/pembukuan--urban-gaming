import React, { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CalendarClock, ChevronRight, History, Plus, Truck } from "lucide-react";
import {
  AKSEN_TILE,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  IconButton,
  Notice,
  Pill,
  Sheet,
  SubTabs,
  cx,
  tile,
  type WarnaIkon,
} from "../../ui";
import { rpShort } from "../../lib/format";
import { buildSewaTable } from "../../lib/priceLists";
import { daftarSewaBerjalan, jenisUnit } from "../../lib/sewa";
import type { HistoryItem, RowSewa } from "../../lib/types";
import {
  aktif,
  adaBentrokPenuh,
  cekBentrok,
  fmtHariTanggal,
  fmtJam,
  kelompokBooking,
  LABEL_STATUS,
  mulaiBooking,
  perluDiingatkan,
  rentangBooking,
  tanggalKelompok,
  useKapasitasUnit,
  type BookingSewa,
  type KelompokBooking,
} from "../../lib/bookingSewa";
import BookingFormSheet from "./BookingFormSheet";
import BookingDetailSheet, { NADA_STATUS } from "./BookingDetailSheet";
import SlotKosongPanel, { type PrefillBookingSlot } from "./SlotKosongPanel";

const JUDUL_KELOMPOK: Record<KelompokBooking, string> = {
  LEWAT: "Lewat jam ambil",
  HARI_INI: "Hari ini",
  BESOK: "Besok",
  MINGGU_INI: "7 hari ke depan",
  NANTI: "Nanti",
  TANPA_JADWAL: "Tanpa jadwal",
};
const URUTAN: KelompokBooking[] = ["LEWAT", "HARI_INI", "BESOK", "MINGGU_INI", "NANTI", "TANPA_JADWAL"];

type FilterBooking = "SEMUA" | "HARI_INI" | "BELUM_DP" | "PERHATIAN";

const warnaJenisSewa = (jenisPS?: string): WarnaIkon => {
  const u = jenisUnit(jenisPS);
  if (u.konsol === "PS5") return "indigo";
  if (u.konsol === "PS4") return "blue";
  if (u.portabel) return "teal";
  if (u.hanyaTv) return "orange";
  return "gray";
};

const BarisBooking: React.FC<{
  b: BookingSewa;
  now: number;
  bentrok?: "penuh" | "mepet";
  kelompok?: KelompokBooking;
  onClick: () => void;
  riwayat?: boolean;
}> = ({ b, now, bentrok, kelompok, onClick, riwayat }) => {
  const m = mulaiBooking(b);
  const r = rentangBooking(b);
  const dp = b.dp && b.dp.nominal > 0 ? b.dp.nominal : 0;
  const ingat = !riwayat && perluDiingatkan(b, now);
  const isLewat = !riwayat && kelompok === "LEWAT";
  const isHariIni = !riwayat && kelompok === "HARI_INI";
  const warnaUnit = warnaJenisSewa(b.jenisPS);

  const selesaiTeks = (() => {
    if (!r) return "";
    const samaHari = new Date(r.mulai).toDateString() === new Date(r.selesai).toDateString();
    return samaHari ? `s.d. ${fmtJam(r.selesai)}` : `s.d. ${fmtHariTanggal(r.selesai)} ${fmtJam(r.selesai)}`;
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[68px] w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-fill/45 active:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tint"
    >
      {/* Lencana Hari + Tanggal + Jam (Apple iOS Calendar style) */}
      <span
        className={cx(
          "flex w-[86px] sm:w-[92px] shrink-0 flex-col items-center justify-center rounded-field px-2 py-1.5 ring-1 ring-inset",
          isLewat
            ? "bg-warning/[0.12] ring-warning/25"
            : isHariIni
              ? "bg-tint/[0.10] ring-tint/20"
              : "bg-fill/85 ring-black/[0.04] dark:ring-white/[0.06]"
        )}
      >
        <span
          className={cx(
            "truncate max-w-full text-caption2 font-semibold leading-tight",
            isLewat ? "text-warning" : isHariIni ? "text-tint" : "text-label-2"
          )}
        >
          {m !== null ? fmtHariTanggal(m) : "Tanpa tgl"}
        </span>
        <span
          className={cx(
            "mt-0.5 text-headline font-bold tabular-nums leading-tight",
            isLewat ? "text-warning" : "text-label"
          )}
        >
          {b.jam ? b.jam.replace(":", ".") : "—"}
        </span>
      </span>

      {/* Identitas penyewa & jadwal unit */}
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-subhead font-semibold text-label">{b.nama || "Tanpa nama"}</span>
          {b.antar && (
            <span
              title="Diantar ke alamat"
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-fill px-1.5 py-0.5 text-caption2 font-medium text-label-2"
            >
              <Truck aria-label="Diantar" className="h-3 w-3 shrink-0" />
            </span>
          )}
        </span>

        <span className="flex min-w-0 items-center gap-1.5 text-caption text-label-2">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: AKSEN_TILE[warnaUnit].bar }}
          />
          <span className="truncate">
            <strong className="font-semibold text-label">{b.jenisPS}</strong>
            {" · "}
            {String(b.lamaSewa || "").toLowerCase()}
          </span>
        </span>

        {selesaiTeks && (
          <span className="block truncate text-caption2 text-label-3 tabular-nums">{selesaiTeks}</span>
        )}
      </span>

      {/* Status DP & peringatan */}
      <span className="flex shrink-0 flex-col items-end gap-1">
        {riwayat ? (
          <Pill tone={NADA_STATUS[b.status]}>{LABEL_STATUS[b.status]}</Pill>
        ) : (
          <Pill tone={dp ? "positive" : b.status === "KONFIRMASI" ? "tint" : "neutral"}>
            {dp ? `DP ${rpShort(dp)}` : b.status === "KONFIRMASI" ? "Pasti" : "Belum DP"}
          </Pill>
        )}
        {bentrok === "penuh" ? <Pill tone="negative">Unit kurang</Pill> : ingat ? <Pill tone="warning">Ingatkan</Pill> : bentrok === "mepet" ? <Pill tone="warning">Mepet</Pill> : null}
      </span>

      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-label-3" />
    </button>
  );
};

/**
 * MONITORING › BOOKING — booking sewa PS + pencari Slot Kosong (Apple iOS 27 Liquid Glass).
 * - Layer-1 <Card> container agar serasi dengan Status unit & Kondisi alat.
 * - Mobile (< lg): satu kartu utama dengan saklar kapsul recessed Daftar | Slot kosong.
 * - Desktop (lg+): tata letak 2 kolom master-detail (Daftar booking + Slot kosong berdampingan).
 */
const HalamanBooking: React.FC<{
  bolehHapus: boolean;
  bookings: BookingSewa[];
  loading: boolean;
  error?: string;
  history: HistoryItem[];
  rowsSewa: RowSewa[];
  activeDate?: string;
  hargaItems?: any[];
  onMulaiSewa: (b: BookingSewa) => Promise<boolean>;
  onDpHangus: (b: BookingSewa, alasan: string) => Promise<boolean>;
  onUrungkan: (b: BookingSewa) => Promise<boolean>;
}> = ({ bolehHapus, bookings, loading, error, history, rowsSewa, activeDate, hargaItems, onMulaiSewa, onDpHangus, onUrungkan }) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const [lihatId, setLihatId] = useState<string | null>(null);
  const [form, setForm] = useState<{ booking: BookingSewa | null; prefill?: PrefillBookingSlot | null } | null>(null);
  const [riwayat, setRiwayat] = useState(false);
  const [mobileMode, setMobileMode] = useState<"daftar" | "slot">("daftar");
  const [filter, setFilter] = useState<FilterBooking>("SEMUA");

  const kapasitas = useKapasitasUnit();
  const sewaTable = useMemo(() => buildSewaTable(hargaItems), [hargaItems]);
  const berjalan = useMemo(
    () => daftarSewaBerjalan({ history, rowsSewa: rowsSewa as any[], activeDate, now }),
    [history, rowsSewa, activeDate, now]
  );

  const aktifList = useMemo(
    () => bookings.filter(aktif).sort((a, c) => (mulaiBooking(a) ?? Infinity) - (mulaiBooking(c) ?? Infinity)),
    [bookings]
  );
  const riwayatList = useMemo(
    () => bookings.filter((b) => !aktif(b)).sort((a, c) => (mulaiBooking(c) ?? 0) - (mulaiBooking(a) ?? 0)),
    [bookings]
  );
  const bentrokIds = useMemo(() => {
    const s = new Map<string, "penuh" | "mepet">();
    aktifList.forEach((b) => {
      const list = cekBentrok(b, { bookings, berjalan, kapasitas, now });
      if (list.length) s.set(b.id, adaBentrokPenuh(list) ? "penuh" : "mepet");
    });
    return s;
  }, [aktifList, bookings, berjalan, kapasitas, now]);

  const jumlahHariIni = useMemo(
    () => aktifList.filter((b) => kelompokBooking(b, now) === "HARI_INI").length,
    [aktifList, now]
  );
  const jumlahBelumDp = useMemo(
    () => aktifList.filter((b) => !(b.dp && b.dp.nominal > 0)).length,
    [aktifList]
  );
  const jumlahIngat = useMemo(() => aktifList.filter((b) => perluDiingatkan(b, now)).length, [aktifList, now]);
  const jumlahPerhatian = useMemo(
    () =>
      aktifList.filter(
        (b) => kelompokBooking(b, now) === "LEWAT" || perluDiingatkan(b, now) || bentrokIds.has(b.id)
      ).length,
    [aktifList, now, bentrokIds]
  );

  const tampilList = useMemo(() => {
    if (filter === "HARI_INI") return aktifList.filter((b) => kelompokBooking(b, now) === "HARI_INI");
    if (filter === "BELUM_DP") return aktifList.filter((b) => !(b.dp && b.dp.nominal > 0));
    if (filter === "PERHATIAN") {
      return aktifList.filter(
        (b) => kelompokBooking(b, now) === "LEWAT" || perluDiingatkan(b, now) || bentrokIds.has(b.id)
      );
    }
    return aktifList;
  }, [aktifList, filter, now, bentrokIds]);

  const kelompok = useMemo(() => {
    const g = new Map<KelompokBooking, BookingSewa[]>();
    tampilList.forEach((b) => {
      const k = kelompokBooking(b, now);
      g.set(k, [...(g.get(k) || []), b]);
    });
    return URUTAN.filter((k) => g.has(k)).map((k) => ({ k, list: g.get(k)! }));
  }, [tampilList, now]);

  const lihat = lihatId ? bookings.find((b) => b.id === lihatId) || null : null;

  const bukaBookingDariSlot = (prefill: PrefillBookingSlot) => {
    setForm({ booking: null, prefill });
  };

  const toggleFilter = (target: FilterBooking) => {
    setFilter((f) => (f === target ? "SEMUA" : target));
  };

  const daftarKonten = (
    <div className="space-y-4">
      {error && <Notice tone="negative">Booking gagal dimuat: {error}</Notice>}

      {/* Strip ringkasan & filter cepat (iOS 27 nested tiles) */}
      {!loading && !error && aktifList.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              {
                key: "HARI_INI" as const,
                label: "Hari ini",
                count: jumlahHariIni,
                accent: jumlahHariIni > 0 ? "blue" : "gray",
              },
              {
                key: "BELUM_DP" as const,
                label: "Belum DP",
                count: jumlahBelumDp,
                accent: "gray",
              },
              {
                key: "PERHATIAN" as const,
                label: "Perhatian",
                count: jumlahPerhatian,
                accent: jumlahPerhatian > 0 ? "orange" : "gray",
              },
            ] as { key: FilterBooking; label: string; count: number; accent: WarnaIkon }[]
          ).map((it) => {
            const aktifFilter = filter === it.key;
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => toggleFilter(it.key)}
                aria-pressed={aktifFilter}
                className={cx(
                  "rounded-tile px-2.5 py-2.5 text-left transition-[background-color,box-shadow,transform] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                  aktifFilter
                    ? cx(AKSEN_TILE[it.accent === "gray" ? "blue" : it.accent].bg, "ring-2 ring-tint")
                    : it.accent !== "gray"
                      ? AKSEN_TILE[it.accent].bg
                      : cx(tile, "apple-tile-interactive")
                )}
              >
                <div className="truncate text-caption2 font-semibold uppercase tracking-wide text-label-2">
                  {it.label}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-title2 font-bold tabular-nums text-label leading-none">{it.count}</span>
                  {aktifFilter && <span className="text-caption2 font-semibold text-tint">Aktif</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && aktifList.length === 0 && (
        <EmptyState icon={<CalendarClock />} title="Belum ada booking">
          Tempel pesan booking dari grup WhatsApp lewat tombol Tambah, atau cek jadwal di Slot kosong.
        </EmptyState>
      )}

      {!loading && !error && aktifList.length > 0 && tampilList.length === 0 && (
        <div className={cx(tile, "p-5 text-center space-y-2.5")}>
          <p className="text-subhead font-semibold text-label">Tidak ada booking untuk filter ini</p>
          <Button variant="tinted" size="sm" onClick={() => setFilter("SEMUA")}>
            Tampilkan semua ({aktifList.length})
          </Button>
        </div>
      )}

      {/* Daftar kelompok booking dengan tanggal di samping hari */}
      {kelompok.map(({ k, list }) => {
        const tglInfo = tanggalKelompok(k, now);
        return (
          <section key={k} className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                <Eyebrow>
                  <span className={cx(k === "LEWAT" && "text-warning")}>{JUDUL_KELOMPOK[k]}</span>
                </Eyebrow>
                {tglInfo && (
                  <span className="truncate rounded-full bg-fill/85 px-2 py-0.5 text-caption2 font-semibold text-label-2 tabular-nums">
                    {tglInfo}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-caption font-semibold text-label-3 tabular-nums">
                {k === "LEWAT" ? "Tanyakan lagi" : `${list.length}`}
              </span>
            </div>

            <div className="overflow-hidden rounded-tile apple-tile ring-1 ring-edge divide-y divide-sep">
              {list.map((b) => (
                <BarisBooking
                  key={b.id}
                  b={b}
                  now={now}
                  kelompok={k}
                  bentrok={bentrokIds.get(b.id)}
                  onClick={() => setLihatId(b.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* LAYER-1 CONTAINER UTAMA: BOOKING SEWA (Mobile juga memuat switcher Daftar / Slot Kosong) */}
        <Card
          className="lg:col-span-7"
          title="Booking sewa"
          subtitle={
            loading
              ? "Memuat…"
              : aktifList.length
                ? `${aktifList.length} aktif${jumlahIngat ? ` · ${jumlahIngat} perlu diingatkan` : ""}`
                : "Tidak ada booking aktif"
          }
          icon={<CalendarClock />}
          iconColor="blue"
          accessory={
            <div className="flex items-center gap-1.5">
              <IconButton label="Riwayat booking" size="sm" onClick={() => setRiwayat(true)}>
                <History />
              </IconButton>
              <Button variant="filled" size="sm" icon={<Plus />} onClick={() => setForm({ booking: null })}>
                Tambah
              </Button>
            </div>
          }
        >
          {/* Switcher khusus Mobile (< lg) di dalam kartu utama */}
          <div className="mb-4 lg:hidden">
            <SubTabs<"daftar" | "slot">
              size="sm"
              ariaLabel="Tampilan booking"
              value={mobileMode}
              onChange={setMobileMode}
              options={[
                { key: "daftar", label: "Daftar", ...(aktifList.length ? { count: aktifList.length } : {}) },
                { key: "slot", label: "Slot kosong" },
              ]}
            />
          </div>

          {/* Mobile: tampil sesuai pilihan switcher. Desktop (lg+): selalu tampil daftar booking di kolom kiri */}
          <div className={cx(mobileMode === "slot" && "hidden lg:block")}>{daftarKonten}</div>
          <div className={cx("lg:hidden", mobileMode !== "slot" && "hidden")}>
            <SlotKosongPanel
              bookings={bookings}
              berjalan={berjalan}
              kapasitas={kapasitas}
              sewaTable={sewaTable}
              now={now}
              onPilihBooking={bukaBookingDariSlot}
            />
          </div>
        </Card>

        {/* LAYER-1 CONTAINER KANAN (Desktop lg+): SLOT KOSONG SELALU SIAP DIPANTAU */}
        <Card
          className="hidden lg:block lg:col-span-5"
          title="Slot kosong"
          subtitle="Cek jadwal unit tersedia & booking cepat"
          icon={<CalendarCheck2 />}
          iconColor="green"
        >
          <SlotKosongPanel
            bookings={bookings}
            berjalan={berjalan}
            kapasitas={kapasitas}
            sewaTable={sewaTable}
            now={now}
            onPilihBooking={bukaBookingDariSlot}
          />
        </Card>
      </div>

      {/* SHEET RIWAYAT BOOKING */}
      <Sheet open={riwayat} onClose={() => setRiwayat(false)} title="Riwayat booking" subtitle="Sudah diambil & batal, 45 hari terakhir" size="md">
        {riwayatList.length ? (
          <div className="overflow-hidden rounded-tile apple-tile ring-1 ring-edge divide-y divide-sep">
            {riwayatList.map((b) => (
              <BarisBooking key={b.id} b={b} now={now} riwayat onClick={() => setLihatId(b.id)} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<History />} title="Belum ada riwayat" />
        )}
      </Sheet>

      <BookingDetailSheet
        booking={lihat}
        onClose={() => setLihatId(null)}
        bolehHapus={bolehHapus}
        bookings={bookings}
        berjalan={berjalan}
        kapasitas={kapasitas}
        sewaTable={sewaTable}
        onUbah={(b) => {
          setLihatId(null);
          setForm({ booking: b });
        }}
        onMulaiSewa={onMulaiSewa}
        onDpHangus={onDpHangus}
        onUrungkan={onUrungkan}
      />

      <BookingFormSheet
        open={!!form}
        booking={form?.booking || null}
        bolehLangsungUbah={bolehHapus}
        prefill={form?.prefill || null}
        onClose={() => setForm(null)}
        bookings={bookings}
        berjalan={berjalan}
        kapasitas={kapasitas}
        sewaTable={sewaTable}
        onSaved={(id) => {
          setForm(null);
          setMobileMode("daftar");
          setLihatId(id);
        }}
      />
    </>
  );
};

export default HalamanBooking;
