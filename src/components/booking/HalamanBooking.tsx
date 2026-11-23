import React, { useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronRight, History, Plus, Truck } from "lucide-react";
import { Button, EmptyState, IconButton, Notice, Pill, SectionHeader, Sheet, cx } from "../../ui";
import { rpShort } from "../../lib/format";
import { buildSewaTable } from "../../lib/priceLists";
import { daftarSewaBerjalan } from "../../lib/sewa";
import type { HistoryItem, RowSewa } from "../../lib/types";
import {
  aktif,
  adaBentrokPenuh,
  cekBentrok,
  kelompokBooking,
  LABEL_STATUS,
  mulaiBooking,
  perluDiingatkan,
  useKapasitasUnit,
  type BookingSewa,
  type KelompokBooking,
} from "../../lib/bookingSewa";
import BookingFormSheet from "./BookingFormSheet";
import BookingDetailSheet, { NADA_STATUS } from "./BookingDetailSheet";

const JUDUL_KELOMPOK: Record<KelompokBooking, string> = {
  LEWAT: "Lewat jam ambil",
  HARI_INI: "Hari ini",
  BESOK: "Besok",
  MINGGU_INI: "7 hari ke depan",
  NANTI: "Nanti",
  TANPA_JADWAL: "Tanpa jadwal",
};
const URUTAN: KelompokBooking[] = ["LEWAT", "HARI_INI", "BESOK", "MINGGU_INI", "NANTI", "TANPA_JADWAL"];
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const BarisBooking: React.FC<{ b: BookingSewa; now: number; bentrok?: "penuh" | "mepet"; onClick: () => void; riwayat?: boolean }> = ({ b, now, bentrok, onClick, riwayat }) => {
  const m = mulaiBooking(b);
  const d = m !== null ? new Date(m) : null;
  const dp = b.dp && b.dp.nominal > 0 ? b.dp.nominal : 0;
  const ingat = !riwayat && perluDiingatkan(b, now);
  return (
    <button type="button" onClick={onClick} className="flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-fill">
      <span className="flex w-[52px] shrink-0 flex-col items-center rounded-[10px] bg-fill py-1">
        <span className="text-caption2 font-semibold uppercase text-label-2">{d ? `${HARI[d.getDay()]} ${d.getDate()}` : "—"}</span>
        <span className="text-subhead font-semibold tabular-nums text-label">{b.jam ? b.jam.replace(":", ".") : "—"}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-subhead font-semibold text-label">{b.nama || "Tanpa nama"}</span>
          {b.antar && <Truck aria-label="Diantar" className="h-3.5 w-3.5 shrink-0 text-label-2" />}
        </span>
        <span className="block truncate text-caption text-label-2">
          {b.jenisPS} · {String(b.lamaSewa || "").toLowerCase()}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {riwayat ? (
          <Pill tone={NADA_STATUS[b.status]}>{LABEL_STATUS[b.status]}</Pill>
        ) : (
          <Pill tone={dp ? "positive" : b.status === "KONFIRMASI" ? "tint" : "neutral"}>{dp ? `DP ${rpShort(dp)}` : b.status === "KONFIRMASI" ? "Pasti" : "Belum DP"}</Pill>
        )}
        {bentrok === "penuh" ? <Pill tone="negative">Unit kurang</Pill> : ingat ? <Pill tone="warning">Ingatkan</Pill> : bentrok === "mepet" ? <Pill tone="warning">Mepet</Pill> : null}
      </span>
      <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-label-3" />
    </button>
  );
};

/**
 * MONITORING › BOOKING — booking sewa PS (pengganti pin chat grup WhatsApp).
 * Semua staf: lihat, tambah, ubah, batalkan, mulai sewa. Hapus: owner / super admin.
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
  const [form, setForm] = useState<{ booking: BookingSewa | null } | null>(null);
  const [riwayat, setRiwayat] = useState(false);

  const kapasitas = useKapasitasUnit();
  const sewaTable = useMemo(() => buildSewaTable(hargaItems), [hargaItems]);
  const berjalan = useMemo(() => daftarSewaBerjalan({ history, rowsSewa: rowsSewa as any[], activeDate, now }), [history, rowsSewa, activeDate, now]);

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
  const kelompok = useMemo(() => {
    const g = new Map<KelompokBooking, BookingSewa[]>();
    aktifList.forEach((b) => {
      const k = kelompokBooking(b, now);
      g.set(k, [...(g.get(k) || []), b]);
    });
    return URUTAN.filter((k) => g.has(k)).map((k) => ({ k, list: g.get(k)! }));
  }, [aktifList, now]);

  const lihat = lihatId ? bookings.find((b) => b.id === lihatId) || null : null;
  const jumlahIngat = aktifList.filter((b) => perluDiingatkan(b, now)).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="text-headline font-semibold text-label">Booking sewa</div>
          <div className="truncate text-caption text-label-2">
            {loading ? "Memuat…" : aktifList.length ? `${aktifList.length} aktif${jumlahIngat ? ` · ${jumlahIngat} perlu diingatkan` : ""}` : "Tidak ada booking aktif"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <IconButton label="Riwayat booking" size="sm" onClick={() => setRiwayat(true)}>
            <History />
          </IconButton>
          <Button variant="filled" size="sm" icon={<Plus />} onClick={() => setForm({ booking: null })}>
            Tambah
          </Button>
        </div>
      </div>

      {error && <Notice tone="negative">Booking gagal dimuat: {error}</Notice>}

      {!loading && !error && aktifList.length === 0 && (
        <EmptyState icon={<CalendarClock />} title="Belum ada booking">
          Tempel pesan booking dari grup WhatsApp lewat tombol Tambah, atau isi manual.
        </EmptyState>
      )}

      {kelompok.map(({ k, list }) => (
        <section key={k}>
          <SectionHeader
            className="px-1 pt-2"
            title={<span className={cx(k === "LEWAT" && "text-warning")}>{JUDUL_KELOMPOK[k]}</span>}
            accessory={k === "LEWAT" ? "Tanyakan jadi atau tidak" : `${list.length}`}
          />
          <div className="overflow-hidden rounded-tile bg-surface ring-1 ring-edge shadow-card divide-y divide-sep">
            {list.map((b) => (
              <BarisBooking key={b.id} b={b} now={now} bentrok={bentrokIds.get(b.id)} onClick={() => setLihatId(b.id)} />
            ))}
          </div>
        </section>
      ))}

      <Sheet open={riwayat} onClose={() => setRiwayat(false)} title="Riwayat booking" subtitle="Sudah diambil & batal, 45 hari terakhir" size="md">
        {riwayatList.length ? (
          <div className="overflow-hidden rounded-tile bg-surface ring-1 ring-edge divide-y divide-sep">
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
        onClose={() => setForm(null)}
        bookings={bookings}
        berjalan={berjalan}
        kapasitas={kapasitas}
        sewaTable={sewaTable}
        onSaved={(id) => {
          setForm(null);
          setLihatId(id);
        }}
      />
    </div>
  );
};

export default HalamanBooking;
