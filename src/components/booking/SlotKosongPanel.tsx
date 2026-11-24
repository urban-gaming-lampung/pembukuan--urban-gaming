import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Calendar,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gamepad2,
  Monitor,
  Plus,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { AKSEN_TILE, Button, EmptyState, Eyebrow, Pill, cx, tile, type WarnaIkon } from "../../ui";
import { rupiah } from "../../lib/format";
import { getSewaPrice, type SewaTable } from "../../lib/priceLists";
import { jamDurasi, type SewaBerjalan } from "../../lib/sewa";
import {
  bangunPemakaianUnit,
  cariSlotKosongBerikutnya,
  fmtHariTanggal,
  fmtHariTanggalLengkap,
  fmtJam,
  geserTanggalYmd,
  hariIniYmd,
  hitungSlotHari,
  kapasitasSumber,
  LABEL_UNIT_PENDEK,
  pilihJenisSewaDariUnit,
  ringkasanRentangKosong,
  ringkasanStripHari,
  tanggalKeMs,
  URUTAN_SUMBER_UNIT,
  type BookingSewa,
  type InfoSlotJam,
  type Kapasitas,
  type SumberUnit,
} from "../../lib/bookingSewa";

export type PrefillBookingSlot = {
  tanggal: string;
  jam: string;
  jenisPS: string;
  lamaSewa: string;
};

const WARNA_UNIT: Record<SumberUnit, WarnaIkon> = {
  PS5: "indigo",
  PS4: "blue",
  PS3: "gray",
  PORTABEL: "teal",
  TV: "orange",
};

const IKON_UNIT: Record<SumberUnit, React.ReactNode> = {
  PS5: <Gamepad2 className="h-3.5 w-3.5" />,
  PS4: <Gamepad2 className="h-3.5 w-3.5" />,
  PS3: <Gamepad2 className="h-3.5 w-3.5" />,
  PORTABEL: <Smartphone className="h-3.5 w-3.5" />,
  TV: <Monitor className="h-3.5 w-3.5" />,
};

const labelDurasiRingkas = (lama: string) =>
  lama
    .toLowerCase()
    .replace(/\b24 jam\b/, "1 hari")
    .replace(/\s+/g, " ")
    .trim();

/**
 * PANEL SLOT KOSONG (Apple iOS 27 Calendar & Availability Inspector).
 * Menghitung jadwal kosong real-time dari kapasitas master_unit − (sewa berjalan + booking aktif + 1 jam toleransi).
 */
const SlotKosongPanel: React.FC<{
  bookings: BookingSewa[];
  berjalan: SewaBerjalan[];
  kapasitas: Kapasitas;
  sewaTable: SewaTable;
  now: number;
  onPilihBooking: (prefill: PrefillBookingSlot) => void;
}> = ({ bookings, berjalan, kapasitas, sewaTable, now, onPilihBooking }) => {
  const todayYmd = hariIniYmd(now);
  const unitAktif = useMemo(
    () => URUTAN_SUMBER_UNIT.filter((u) => kapasitasSumber(kapasitas, u) > 0),
    [kapasitas]
  );

  // Daftar durasi unik dari tabel harga (deduplikasi 24 JAM vs 1 HARI)
  const durasiOptions = useMemo(() => {
    const seen = new Set<number>();
    const out: { key: string; label: string; jam: number }[] = [];
    const sumber = sewaTable.lamaOptions.length ? sewaTable.lamaOptions : ["12 JAM", "1 HARI", "2 HARI", "3 HARI"];
    sumber.forEach((l) => {
      const jam = jamDurasi({ lamaSewa: l });
      if (!jam || seen.has(jam)) return;
      seen.add(jam);
      out.push({ key: l === "24 JAM" && sumber.includes("1 HARI") ? "1 HARI" : l, label: labelDurasiRingkas(l), jam });
    });
    return out.length ? out : [{ key: "12 JAM", label: "12 jam", jam: 12 }, { key: "1 HARI", label: "1 hari", jam: 24 }];
  }, [sewaTable.lamaOptions]);

  const [unit, setUnit] = useState<SumberUnit>(() => unitAktif[0] || "PS5");
  const [paket, setPaket] = useState<"UNIT" | "TV" | "PORTABEL">("UNIT");
  const [lamaSewa, setLamaSewa] = useState<string>(() => durasiOptions[0]?.key || "12 JAM");
  const [tanggal, setTanggal] = useState<string>(todayYmd);
  const [jamTerpilih, setJamTerpilih] = useState<number | null>(null);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const stripRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const prevTanggalRef = useRef<string>(todayYmd);
  const skipAutoJamRef = useRef(false);

  // Sinkronkan unit terpilih jika master_unit baru selesai dimuat
  useEffect(() => {
    if (unitAktif.length > 0 && !unitAktif.includes(unit)) {
      setUnit(unitAktif[0]);
      setPaket("UNIT");
    }
  }, [unitAktif, unit]);

  // Reset paket tambahan jika bukan konsol atau kapasitas TV/Portabel = 0
  const isKonsol = unit === "PS3" || unit === "PS4" || unit === "PS5";
  const bisaTambahTv = isKonsol && kapasitas.tv > 0;
  const bisaTambahPortabel = isKonsol && kapasitas.portabel > 0;
  const paketAktif: "UNIT" | "TV" | "PORTABEL" =
    paket === "TV" && bisaTambahTv ? "TV" : paket === "PORTABEL" && bisaTambahPortabel ? "PORTABEL" : "UNIT";

  // Unit fisik yang benar-benar dibutuhkan untuk pengecekan
  const unitList = useMemo<SumberUnit[]>(() => {
    if (!unitAktif.length) return [];
    const list: SumberUnit[] = [unit];
    if (paketAktif === "TV") list.push("TV");
    if (paketAktif === "PORTABEL") list.push("PORTABEL");
    return list;
  }, [unit, paketAktif, unitAktif.length]);

  const jenisPS = useMemo(
    () => pilihJenisSewaDariUnit(unit, paketAktif, sewaTable.jenisOptions),
    [unit, paketAktif, sewaTable.jenisOptions]
  );

  const durasiJam = useMemo(
    () => jamDurasi({ lamaSewa }) || durasiOptions[0]?.jam || 12,
    [lamaSewa, durasiOptions]
  );

  const pemakaian = useMemo(
    () => bangunPemakaianUnit({ bookings, berjalan, now }),
    [bookings, berjalan, now]
  );

  // Jendela 14 hari pada strip kalender: mulai hari ini, atau geser jika user lompat jauh ke depan
  const stripStart = useMemo(() => {
    const selisih = Math.round((tanggalKeMs(tanggal) - tanggalKeMs(todayYmd)) / 86400000);
    if (selisih < 0) return tanggal;
    if (selisih >= 12) return geserTanggalYmd(tanggal, -2);
    return todayYmd;
  }, [tanggal, todayYmd]);

  const stripHari = useMemo(
    () =>
      ringkasanStripHari({
        mulaiTanggal: stripStart,
        jumlahHari: 14,
        unitList,
        durasiJam,
        pemakaian,
        bookings,
        kapasitas,
        now,
      }),
    [stripStart, unitList, durasiJam, pemakaian, bookings, kapasitas, now]
  );

  const slots = useMemo(
    () => hitungSlotHari({ tanggal, unitList, durasiJam, pemakaian, kapasitas, now }),
    [tanggal, unitList, durasiJam, pemakaian, kapasitas, now]
  );

  const slotsAktif = useMemo(() => slots.filter((s) => !s.lewat), [slots]);
  const slotsKosong = useMemo(() => slotsAktif.filter((s) => s.sisa > 0), [slotsAktif]);
  const ringkasanRentang = useMemo(() => ringkasanRentangKosong(slots), [slots]);

  // Pilih otomatis slot kosong pertama setiap kali tanggal / unit / paket / durasi berubah
  useEffect(() => {
    if (skipAutoJamRef.current) {
      skipAutoJamRef.current = false;
      return;
    }
    setJamTerpilih((prev) => {
      if (prev !== null && slots.some((s) => s.jam === prev && !s.lewat && s.sisa > 0)) return prev;
      const pertamaKosong = slots.find((s) => !s.lewat && s.sisa > 0);
      const pertamaAktif = slots.find((s) => !s.lewat);
      return pertamaKosong?.jam ?? pertamaAktif?.jam ?? null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal, unit, paketAktif, lamaSewa, slots.length]);

  // Pastikan tanggal terpilih terlihat pada strip horizontal hanya saat user berpindah tanggal
  useEffect(() => {
    if (prevTanggalRef.current === tanggal) return;
    prevTanggalRef.current = tanggal;
    const el = stripRefs.current[tanggal];
    if (el && el.offsetParent !== null) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [tanggal]);

  const slotAktif: InfoSlotJam | null = useMemo(
    () => (jamTerpilih !== null ? slots.find((s) => s.jam === jamTerpilih) || null : null),
    [slots, jamTerpilih]
  );

  // Cari slot kosong berikutnya bila hari atau slot yang dipilih penuh
  const slotBerikutnya = useMemo(() => {
    const perluCari = !slotsKosong.length || (slotAktif && slotAktif.sisa === 0);
    if (!perluCari || !unitList.length) return null;
    return cariSlotKosongBerikutnya({
      dariTanggal: tanggal,
      dariJam: slotAktif ? slotAktif.jam : undefined,
      unitList,
      durasiJam,
      pemakaian,
      kapasitas,
      now,
      maksHari: 14,
    });
  }, [slotsKosong.length, slotAktif, tanggal, unitList, durasiJam, pemakaian, kapasitas, now]);

  const estimasi = useMemo(() => getSewaPrice(sewaTable, jenisPS, lamaSewa), [sewaTable, jenisPS, lamaSewa]);

  if (unitAktif.length === 0) {
    return (
      <EmptyState icon={<CalendarCheck2 />} title="Kapasitas unit belum diatur">
        Atur jumlah PS3, PS4, PS5, Portabel, dan TV di Monitoring › Status unit › Atur unit agar jadwal slot kosong bisa dihitung otomatis.
      </EmptyState>
    );
  }

  const tanggalMs = tanggalKeMs(tanggal);
  const warnaUnitAktif = WARNA_UNIT[unit];
  const nadaRingkasan: WarnaIkon =
    slotsAktif.length === 0 ? "gray" : slotsKosong.length === 0 ? "red" : slotsKosong.length >= Math.ceil(slotsAktif.length * 0.5) ? "green" : "orange";

  const lompatKe = (tgl: string, jam?: number) => {
    if (jam !== undefined) {
      skipAutoJamRef.current = true;
      setJamTerpilih(jam);
    }
    setTanggal(tgl);
  };

  return (
    <div className="space-y-4">
      {/* 1. PILIH UNIT & DURASI */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <Eyebrow>Unit &amp; durasi</Eyebrow>
          <span className="text-caption font-medium text-label-2 tabular-nums">
            {jenisPS} · {labelDurasiRingkas(lamaSewa)}
          </span>
        </div>

        {/* Chip Unit (warna resmi iOS 27 sesuai Status unit) */}
        <div className="flex flex-wrap gap-1.5">
          {unitAktif.map((u) => {
            const aktifChip = u === unit;
            const kap = kapasitasSumber(kapasitas, u);
            const warna = WARNA_UNIT[u];
            return (
              <button
                key={u}
                type="button"
                onClick={() => {
                  setUnit(u);
                  setPaket("UNIT");
                }}
                aria-pressed={aktifChip}
                className={cx(
                  "hit-44 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-footnote font-semibold transition-[background-color,color,box-shadow,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                  aktifChip
                    ? cx(AKSEN_TILE[warna].bg, AKSEN_TILE[warna].iconText, "shadow-xs")
                    : "bg-fill text-label-2 hover:text-label"
                )}
              >
                <span aria-hidden>{IKON_UNIT[u]}</span>
                <span>{LABEL_UNIT_PENDEK[u]}</span>
                <span className="text-caption2 opacity-75 tabular-nums">{kap}</span>
              </button>
            );
          })}
        </div>

        {/* Opsi tambahan paket (+ TV / Portabel) + pemilih durasi */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {durasiOptions.map((d) => {
              const aktifDur = d.key === lamaSewa;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setLamaSewa(d.key)}
                  aria-pressed={aktifDur}
                  className={cx(
                    "hit-44 h-8 rounded-full px-3 text-caption font-semibold transition-[background-color,color,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                    aktifDur
                      ? "bg-action text-action-label shadow-xs"
                      : "bg-fill text-label-2 hover:text-label"
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          {(bisaTambahTv || bisaTambahPortabel) && (
            <div className="flex items-center gap-1.5">
              {bisaTambahTv && (
                <button
                  type="button"
                  onClick={() => setPaket((p) => (p === "TV" ? "UNIT" : "TV"))}
                  aria-pressed={paketAktif === "TV"}
                  className={cx(
                    "hit-44 h-8 rounded-full px-2.5 text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                    paketAktif === "TV"
                      ? cx(AKSEN_TILE.orange.bg, AKSEN_TILE.orange.iconText)
                      : "bg-fill/80 text-label-2 hover:text-label"
                  )}
                >
                  + TV
                </button>
              )}
              {bisaTambahPortabel && (
                <button
                  type="button"
                  onClick={() => setPaket((p) => (p === "PORTABEL" ? "UNIT" : "PORTABEL"))}
                  aria-pressed={paketAktif === "PORTABEL"}
                  className={cx(
                    "hit-44 h-8 rounded-full px-2.5 text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                    paketAktif === "PORTABEL"
                      ? cx(AKSEN_TILE.teal.bg, AKSEN_TILE.teal.iconText)
                      : "bg-fill/80 text-label-2 hover:text-label"
                  )}
                >
                  + Portabel
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. KALENDER STRIP iOS 27 (HARI + TANGGAL + INDIKATOR KETERSEDIAAN) */}
      <div className={cx(tile, "p-3 space-y-2.5")}>
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const el = dateInputRef.current;
                if (!el) return;
                if (typeof (el as any).showPicker === "function") {
                  try { (el as any).showPicker(); return; } catch { /* fallback click */ }
                }
                el.focus();
                el.click();
              }}
              className="group inline-flex min-w-0 items-center gap-1.5 rounded-full py-1 pr-2 text-left transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint"
              aria-label="Pilih tanggal kalender"
            >
              <Calendar className="h-4 w-4 shrink-0 text-tint" aria-hidden />
              <span className="truncate text-subhead font-semibold text-label">
                {fmtHariTanggalLengkap(tanggalMs)}
              </span>
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={tanggal}
              min={todayYmd}
              onChange={(e) => {
                if (e.target.value) setTanggal(e.target.value);
              }}
              aria-label="Tanggal cek slot kosong"
              className="sr-only"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {tanggal !== todayYmd && (
              <button
                type="button"
                onClick={() => setTanggal(todayYmd)}
                className="hit-44 h-7 rounded-full bg-tint/[0.12] px-2.5 text-caption2 font-semibold text-tint transition-colors hover:bg-tint/[0.18] active:opacity-75"
              >
                Hari ini
              </button>
            )}
            <button
              type="button"
              onClick={() => setTanggal((t) => geserTanggalYmd(t, -1))}
              disabled={tanggal <= todayYmd}
              aria-label="Hari sebelumnya"
              className="hit-44 flex h-7 w-7 items-center justify-center rounded-full bg-fill text-label-2 transition-colors hover:text-label disabled:opacity-35"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setTanggal((t) => geserTanggalYmd(t, 1))}
              aria-label="Hari berikutnya"
              className="hit-44 flex h-7 w-7 items-center justify-center rounded-full bg-fill text-label-2 transition-colors hover:text-label"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 14-Day Scrollable iOS Date Picker Strip */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-0.5 px-0.5">
          {stripHari.map((h) => {
            const selected = h.tanggal === tanggal;
            const dotCls =
              h.status === "kosong"
                ? "bg-positive"
                : h.status === "terbatas"
                  ? "bg-warning"
                  : h.status === "penuh"
                    ? "bg-negative"
                    : "bg-label-3/40";
            return (
              <button
                key={h.tanggal}
                ref={(el) => { stripRefs.current[h.tanggal] = el; }}
                type="button"
                onClick={() => setTanggal(h.tanggal)}
                aria-pressed={selected}
                aria-label={`${h.hariPendek}, ${h.tanggalAngka} ${h.bulanPendek}: ${h.tersediaJam} slot jam tersedia`}
                className={cx(
                  "flex w-[54px] shrink-0 flex-col items-center rounded-field py-1.5 px-1 transition-[background-color,box-shadow,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                  selected
                    ? "bg-surface dark:bg-surface-elevated ring-1 ring-edge shadow-card"
                    : "hover:bg-fill/70"
                )}
              >
                <span className={cx("text-caption2 font-semibold uppercase", selected ? "text-label" : "text-label-3")}>
                  {h.hariPendek}
                </span>
                <span
                  className={cx(
                    "mt-1 flex h-8 w-8 items-center justify-center rounded-full text-subhead font-bold tabular-nums transition-colors",
                    selected && h.isHariIni
                      ? "bg-tint text-white shadow-xs"
                      : selected
                        ? "bg-action text-action-label shadow-xs"
                        : h.isHariIni
                          ? "bg-tint/[0.12] text-tint"
                          : "text-label"
                  )}
                >
                  {h.tanggalAngka}
                </span>
                <span className="mt-0.5 text-caption2 text-label-3">{h.bulanPendek}</span>
                <span className={cx("mt-1 h-1.5 w-1.5 rounded-full", dotCls)} aria-hidden />
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. RINGKASAN KETERSEDIAAN TANGGAL TERPILIH */}
      <div className={cx("rounded-tile px-3.5 py-3 space-y-1.5", AKSEN_TILE[nadaRingkasan].bg)}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Clock className={cx("h-4 w-4 shrink-0", AKSEN_TILE[nadaRingkasan].iconText)} aria-hidden />
            <span className="truncate text-subhead font-semibold text-label">
              {slotsKosong.length > 0
                ? `${slotsKosong.length} dari ${slotsAktif.length} jam tersedia`
                : slotsAktif.length === 0
                  ? "Jam operasional lewat"
                  : "Penuh di tanggal ini"}
            </span>
          </div>
          <Pill color={warnaUnitAktif}>{jenisPS}</Pill>
        </div>
        <p className="text-caption text-label-2 leading-snug">{ringkasanRentang}</p>
      </div>

      {/* 4. GRID SLOT JAM OPERASIONAL (10.00 – 23.00) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <Eyebrow>Jam ambil (10.00 – 23.00)</Eyebrow>
          <div className="flex items-center gap-2.5 text-caption2 text-label-3">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden />
              Kosong
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
              Sisa 1
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-negative" aria-hidden />
              Penuh
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {slots.map((s) => {
            const selected = jamTerpilih === s.jam;
            const kosong = !s.lewat && s.sisa > 0;
            const terbatas = kosong && s.sisa === 1 && s.kapasitas > 1;
            return (
              <button
                key={s.jam}
                type="button"
                disabled={s.lewat}
                onClick={() => setJamTerpilih(s.jam)}
                aria-pressed={selected}
                className={cx(
                  "flex min-h-[54px] flex-col items-center justify-center rounded-field px-1.5 py-2 transition-[background-color,box-shadow,transform,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                  s.lewat
                    ? "bg-fill/40 opacity-40 cursor-not-allowed"
                    : selected
                      ? "bg-tint/[0.12] dark:bg-tint/[0.22] ring-2 ring-tint active:scale-[0.97]"
                      : kosong
                        ? "apple-tile apple-tile-interactive ring-1 ring-edge active:scale-[0.97]"
                        : "bg-fill/75 ring-1 ring-edge/60 hover:bg-fill active:scale-[0.97]"
                )}
              >
                <span
                  className={cx(
                    "text-subhead font-semibold tabular-nums leading-tight",
                    s.lewat || !kosong ? "text-label-3" : "text-label",
                    !s.lewat && !kosong && "line-through decoration-negative/50"
                  )}
                >
                  {fmtJam(s.mulaiMs)}
                </span>
                <span
                  className={cx(
                    "mt-0.5 text-caption2 font-semibold tabular-nums leading-tight",
                    s.lewat
                      ? "text-label-3"
                      : !kosong
                        ? "text-negative/85"
                        : terbatas
                          ? "text-warning"
                          : "text-positive"
                  )}
                >
                  {s.lewat ? "Lewat" : !kosong ? "Penuh" : `${s.sisa} sisa`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. INSPEKTOR SLOT TERPILIH + AKSI BOOKING 1 KETUK */}
      {slotAktif && !slotAktif.lewat && (
        <div className={cx(tile, "p-3.5 space-y-3")}>
          {slotAktif.sisa > 0 ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-positive shrink-0" aria-hidden />
                    <span className="text-subhead font-semibold text-label truncate">
                      {fmtHariTanggal(slotAktif.mulaiMs)} · {fmtJam(slotAktif.mulaiMs)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-caption text-label-2 tabular-nums">
                    Selesai {fmtHariTanggal(slotAktif.selesaiMs)} · {fmtJam(slotAktif.selesaiMs)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Pill tone={slotAktif.sisa === 1 && slotAktif.kapasitas > 1 ? "warning" : "positive"}>
                    {slotAktif.sisa}/{slotAktif.kapasitas} kosong
                  </Pill>
                  {estimasi > 0 && (
                    <div className="mt-1 text-caption font-semibold text-label tabular-nums">{rupiah(estimasi)}</div>
                  )}
                </div>
              </div>

              <Button
                variant="filled"
                size="md"
                block
                icon={<Plus />}
                onClick={() =>
                  onPilihBooking({
                    tanggal,
                    jam: slotAktif.jamTeks,
                    jenisPS,
                    lamaSewa,
                  })
                }
              >
                Booking jam {fmtJam(slotAktif.mulaiMs)}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-subhead font-semibold text-negative">
                    Penuh pada {fmtHariTanggal(slotAktif.mulaiMs)} · {fmtJam(slotAktif.mulaiMs)}
                  </div>
                  <div className="mt-0.5 text-caption text-label-2">
                    Semua {slotAktif.kapasitas} unit {jenisPS} terpakai (termasuk 1 jam toleransi kembali).
                  </div>
                </div>
                <Pill tone="negative">0/{slotAktif.kapasitas}</Pill>
              </div>

              {slotAktif.penghalang.length > 0 && (
                <div className="rounded-field bg-fill/75 px-3 py-2 space-y-1 text-caption text-label-2">
                  {slotAktif.penghalang.slice(0, 3).map((p) => (
                    <div key={p} className="truncate">· {p}</div>
                  ))}
                  {slotAktif.penghalang.length > 3 && (
                    <div className="text-label-3">+{slotAktif.penghalang.length - 3} jadwal lainnya</div>
                  )}
                </div>
              )}

              {slotBerikutnya && (
                <Button
                  variant="tinted"
                  size="md"
                  block
                  icon={<Sparkles />}
                  onClick={() => lompatKe(slotBerikutnya.tanggal, slotBerikutnya.slot.jam)}
                >
                  Kosong lagi: {fmtHariTanggal(slotBerikutnya.slot.mulaiMs)} · {fmtJam(slotBerikutnya.slot.mulaiMs)}
                  <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Saran slot berikutnya jika hari ini sudah lewat semua */}
      {(!slotAktif || slotAktif.lewat) && slotBerikutnya && (
        <Button
          variant="tinted"
          size="md"
          block
          icon={<Sparkles />}
          onClick={() => lompatKe(slotBerikutnya.tanggal, slotBerikutnya.slot.jam)}
        >
          Lihat slot kosong: {fmtHariTanggal(slotBerikutnya.slot.mulaiMs)} · {fmtJam(slotBerikutnya.slot.mulaiMs)}
          <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
        </Button>
      )}
    </div>
  );
};

export default SlotKosongPanel;
