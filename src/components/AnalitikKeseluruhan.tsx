import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Gamepad2, Store, Loader2, BarChart3, ArrowDownLeft, ArrowUpRight, Layers } from "lucide-react";
import FilterComp from "./Filter";
import { useIsDark } from "../hooks/useIsDark";
import { usePosSales } from "../lib/posSales";
import { Bisnis, bisnisOf, isBelanjaStok, pemasukanRental, pengeluaranAdminRental, periodRange, TransaksiOwner } from "../lib/keuangan";
import type { HistoryItem } from "../lib/types";
import { barisUsahaManual } from "../lib/pemasukanUsaha";
import { rpShort } from "../lib/format";
import {
  ArusTile, BarisUang, BatangUang, KartuAnalitik, LegendaArus, persen, rp, rpTanda, StatusArus, Titik, WARNA_KELUAR, WARNA_MASUK,
} from "./common/ArusUang";

type Props = {
  mode: string;
  setMode: (v: string) => void;
  month: number;
  setMonth: (v: number) => void;
  rangeStart: string;
  setRangeStart: (v: string) => void;
  rangeEnd: string;
  setRangeEnd: (v: string) => void;
  /** Pembukuan rental yang sudah tersaring periode filter */
  filteredHistory: HistoryItem[];
  /** Pengeluaran & pemasukan owner (rental + usaha) yang sudah tersaring periode filter */
  pengeluaran: TransaksiOwner[];
  pemasukan: TransaksiOwner[];
};

type Hari = { rm: number; rk: number; um: number; uk: number };
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const kunciHari = (t: string) => (/^\d{4}-\d{2}-\d{2}/.test(String(t || "")) ? String(t).slice(0, 10) : ymd(new Date(t)));
const dariYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const LABEL_BISNIS: Record<Bisnis, string> = { RENTAL: "Rental", USAHA: "Usaha" };

type TitikGrafik = { label: string; full: string; masuk: number; keluar: number; keluarNeg: number; net: number };

const TipArus: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as TitikGrafik;
  return (
    <div className="rounded-xl bg-white dark:bg-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,.15)] ring-1 ring-black/5 dark:ring-white/10 px-3 py-2 text-[12px] min-w-[170px]">
      <div className="font-bold text-zinc-900 dark:text-white mb-1">{p.full}</div>
      <div className="flex items-center justify-between gap-3 text-zinc-600 dark:text-zinc-300">
        <span className="flex items-center gap-1.5"><Titik c={WARNA_MASUK} />Masuk</span>
        <span className="font-bold tabular-nums text-zinc-900 dark:text-white">{rp(p.masuk)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-zinc-600 dark:text-zinc-300">
        <span className="flex items-center gap-1.5"><Titik c={WARNA_KELUAR} />Keluar</span>
        <span className="font-bold tabular-nums text-zinc-900 dark:text-white">{rp(p.keluar)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-white/10 mt-1 pt-1">
        <span className="font-semibold text-zinc-600 dark:text-zinc-300">Selisih</span>
        <span className="font-black tabular-nums text-zinc-900 dark:text-white">{rpTanda(p.net)}</span>
      </div>
    </div>
  );
};

/** Kartu satu model usaha (Rental / Usaha). */
const KartuBisnis: React.FC<{
  judul: string;
  sub: string;
  icon: React.ReactNode;
  masuk: number;
  keluar: number;
  rows: { jenis: "masuk" | "keluar"; label: string; note?: string; v: number }[];
  loading?: boolean;
}> = ({ judul, sub, icon, masuk, keluar, rows, loading }) => {
  const net = masuk - keluar;
  return (
    <section className="rounded-[22px] bg-white dark:bg-[#1c1c1e] border border-zinc-200/80 dark:border-white/10 p-4 shadow-sm min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0">{icon}</span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-black text-zinc-900 dark:text-white leading-tight">{judul}</h3>
            <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400 truncate">{sub}</p>
          </div>
        </div>
        {!loading && <StatusArus net={net} size="sm" />}
      </div>
      <div className="mt-3 flex items-baseline gap-2 flex-wrap">
        <span className="text-[24px] font-black tabular-nums tracking-tight leading-none text-zinc-900 dark:text-white">
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-zinc-400" /> : rpTanda(net)}
        </span>
        <span className="text-[11.5px] text-zinc-500 dark:text-zinc-400">selisih</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ArusTile jenis="masuk" value={masuk} />
        <ArusTile jenis="keluar" value={keluar} />
      </div>
      <div className="mt-2 divide-y divide-zinc-100 dark:divide-white/5 text-[13px]">
        {rows.map((r) => (
          <BarisUang key={r.label} jenis={r.jenis} label={r.label} note={r.note} value={r.v} />
        ))}
      </div>
    </section>
  );
};

export default function AnalitikKeseluruhan(props: Props) {
  const { mode, month, rangeStart, rangeEnd, filteredHistory, pengeluaran, pemasukan } = props;
  const isDark = useIsDark();
  const period = useMemo(() => periodRange(mode, month, rangeStart, rangeEnd), [mode, month, rangeStart, rangeEnd]);
  const { sales, loading, error } = usePosSales(period.from, period.to, 4000);

  const d = useMemo(() => {
    const harian = new Map<string, Hari>();
    const tambah = (tgl: string, k: keyof Hari, v: number) => {
      if (!v) return;
      const key = kunciHari(tgl);
      const x = harian.get(key) || { rm: 0, rk: 0, um: 0, uk: 0 };
      x[k] += v;
      harian.set(key, x);
    };
    const r = { buku: 0, lain: 0, admin: 0, owner: 0 };
    const u = { pos: 0, nota: 0, buku: 0, bukuN: 0, lain: 0, stok: 0, ops: 0 };
    const sumber = new Map<string, { label: string; sub: string; v: number }>();
    const kategori = new Map<string, { label: string; sub: string; v: number }>();
    const masukKe = (key: string, label: string, sub: string, v: number) => {
      const x = sumber.get(key) || { label, sub, v: 0 };
      x.v += v;
      sumber.set(key, x);
    };
    const keluarKe = (key: string, label: string, sub: string, v: number) => {
      const x = kategori.get(key) || { label, sub, v: 0 };
      x.v += v;
      kategori.set(key, x);
    };

    // RENTAL — pembukuan harian (aturan sama dengan Analitik Rental)
    filteredHistory.forEach((h) => {
      const v = pemasukanRental(h);
      r.buku += v;
      tambah(h.tanggal, "rm", v);
      // Rincian Pemasukan Usaha (input admin) = pemasukan USAHA; baris dari nota POS dihitung lewat POS
      barisUsahaManual(h).forEach((x) => {
        u.buku += x.harga;
        u.bukuN++;
        tambah(h.tanggal, "um", x.harga);
      });
      pengeluaranAdminRental(h).forEach((x) => {
        r.admin += x.harga;
        tambah(h.tanggal, "rk", x.harga);
        keluarKe("RENTAL|admin", "Operasional harian (admin)", "Rental", x.harga);
      });
    });
    if (r.buku) masukKe("RENTAL|buku", "Pembukuan harian rental", "Rental", r.buku);

    // USAHA — semua nota POS yang tidak dibatalkan
    sales.forEach((s) => {
      if (s.batal || s.ts < period.from || s.ts > period.to) return;
      u.pos += s.total;
      u.nota++;
      tambah(s.tanggal || ymd(new Date(s.ts)), "um", s.total);
    });
    if (u.pos) masukKe("USAHA|pos", "Penjualan POS", `Usaha · ${u.nota} nota`, u.pos);
    if (u.buku) masukKe("USAHA|buku", "Rincian pemasukan usaha", `Usaha · ${u.bukuN} input pembukuan`, u.buku);

    // Transaksi owner (Input › Transaksi)
    pemasukan.forEach((o) => {
      const b = bisnisOf(o);
      if (b === "RENTAL") { r.lain += o.harga; tambah(o.tanggal, "rm", o.harga); }
      else { u.lain += o.harga; tambah(o.tanggal, "um", o.harga); }
      const kat = o.kategori || "Pemasukan lain";
      masukKe(`${b}|${kat}`, kat, LABEL_BISNIS[b], o.harga);
    });
    pengeluaran.forEach((o) => {
      const b = bisnisOf(o);
      if (b === "RENTAL") { r.owner += o.harga; tambah(o.tanggal, "rk", o.harga); }
      else {
        if (isBelanjaStok(o)) u.stok += o.harga;
        else u.ops += o.harga;
        tambah(o.tanggal, "uk", o.harga);
      }
      const kat = b === "USAHA" && isBelanjaStok(o) ? "Belanja stok jualan" : o.kategori || "Lainnya";
      keluarKe(`${b}|${kat}`, kat, LABEL_BISNIS[b], o.harga);
    });

    const rental = { masuk: r.buku + r.lain, keluar: r.admin + r.owner };
    const usaha = { masuk: u.pos + u.buku + u.lain, keluar: u.stok + u.ops };
    const masuk = rental.masuk + usaha.masuk;
    const keluar = rental.keluar + usaha.keluar;
    return {
      harian, r, u, rental, usaha, masuk, keluar, net: masuk - keluar,
      sumber: Array.from(sumber.values()).sort((a, b) => b.v - a.v),
      kategori: Array.from(kategori.values()).sort((a, b) => b.v - a.v),
    };
  }, [filteredHistory, pemasukan, pengeluaran, sales, period.from, period.to]);

  // Grafik arus uang: harian (<= 62 hari) atau bulanan
  const grafik = useMemo(() => {
    const keys = Array.from(d.harian.keys()).sort();
    const akhir = Math.min(period.to, Date.now());
    const awal = period.from > 0 ? period.from : keys.length ? dariYmd(keys[0]).getTime() : akhir;
    const a = new Date(awal); a.setHours(0, 0, 0, 0);
    const b = new Date(akhir); b.setHours(0, 0, 0, 0);
    const days = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
    const titik = (label: string, full: string, x?: Hari): TitikGrafik => {
      const masuk = (x?.rm || 0) + (x?.um || 0);
      const keluar = (x?.rk || 0) + (x?.uk || 0);
      return { label, full, masuk, keluar, keluarNeg: -keluar, net: masuk - keluar };
    };
    if (days <= 62) {
      const out: TitikGrafik[] = [];
      const c = new Date(a);
      for (let i = 0; i < days; i++) {
        out.push(titik(String(c.getDate()), c.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }), d.harian.get(ymd(c))));
        c.setDate(c.getDate() + 1);
      }
      return { per: "hari" as const, data: out };
    }
    const bulan = new Map<string, Hari>();
    d.harian.forEach((v, k) => {
      const mk = k.slice(0, 7);
      const x = bulan.get(mk) || { rm: 0, rk: 0, um: 0, uk: 0 };
      x.rm += v.rm; x.rk += v.rk; x.um += v.um; x.uk += v.uk;
      bulan.set(mk, x);
    });
    const data = Array.from(bulan.entries())
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([k, v]) => {
        const [y, m] = k.split("-").map(Number);
        return titik(BULAN[m - 1].slice(0, 3), `${BULAN[m - 1]} ${y}`, v);
      });
    return { per: "bulan" as const, data };
  }, [d.harian, period.from, period.to]);

  const hariSurplus = grafik.data.filter((x) => x.net > 0).length;
  const hariMinus = grafik.data.filter((x) => x.net < 0).length;
  const kosong = !loading && d.masuk === 0 && d.keluar === 0;
  const rasio = d.masuk > 0 ? (d.keluar / d.masuk) * 100 : 0;
  const kalimat = loading
    ? "Menghitung…"
    : d.net > 0
    ? `Uang masuk lebih besar ${rp(d.net)} dari uang keluar.`
    : d.net < 0
    ? `Uang keluar melebihi uang masuk sebesar ${rp(-d.net)}.`
    : kosong
    ? "Belum ada uang masuk atau keluar di periode ini."
    : "Uang masuk sama dengan uang keluar.";

  const tick = isDark ? "#a1a1aa" : "#71717a";
  const grid = isDark ? "#27272a" : "#f0f0f0";
  const axis = isDark ? "#52525b" : "#d4d4d8";

  return (
    <div className="space-y-4">
      <FilterComp
        mode={props.mode} setMode={props.setMode} month={props.month} setMonth={props.setMonth}
        rangeStart={props.rangeStart} setRangeStart={props.setRangeStart} rangeEnd={props.rangeEnd} setRangeEnd={props.setRangeEnd}
      />

      {error && (
        <div className="rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 text-[13px] text-red-700 dark:text-red-300">
          Gagal memuat transaksi POS: {error}
        </div>
      )}

      {/* HERO: hasil keseluruhan */}
      <section className="rounded-[24px] bg-white dark:bg-[#1c1c1e] border border-zinc-200/80 dark:border-white/10 p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 min-w-0">
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Hasil · {period.label}</span>
          </div>
          {!loading && !kosong && <StatusArus net={d.net} />}
        </div>
        <div className="mt-3 text-[34px] sm:text-[42px] font-black tabular-nums tracking-tight leading-none text-zinc-900 dark:text-white">
          {loading ? <Loader2 className="w-8 h-8 animate-spin text-zinc-400" /> : rpTanda(d.net)}
        </div>
        <p className="mt-2 text-[13px] leading-snug text-zinc-500 dark:text-zinc-400">{kalimat}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ArusTile jenis="masuk" value={d.masuk} />
          <ArusTile jenis="keluar" value={d.keluar} />
        </div>
        {d.masuk > 0 && !loading && (
          <div className="mt-3.5">
            <div className="h-2 rounded-full bg-zinc-100 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, rasio))}%`, background: WARNA_KELUAR }} />
            </div>
            <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
              {rasio <= 100 ? (
                <>Uang keluar <b className="text-zinc-800 dark:text-zinc-100">{persen(rasio)}</b> dari uang masuk</>
              ) : (
                <>Uang keluar <b className="text-zinc-800 dark:text-zinc-100">{(rasio / 100).toFixed(1).replace(".", ",")}×</b> uang masuk</>
              )}
            </p>
          </div>
        )}
      </section>

      {/* PER MODEL USAHA */}
      <div className="grid gap-3 sm:grid-cols-2">
        <KartuBisnis
          judul="Rental"
          sub="Pembukuan harian & owner"
          icon={<Gamepad2 className="w-[18px] h-[18px]" />}
          masuk={d.rental.masuk}
          keluar={d.rental.keluar}
          rows={[
            { jenis: "masuk", label: "Pembukuan harian", v: d.r.buku },
            { jenis: "masuk", label: "Pemasukan lain", v: d.r.lain },
            { jenis: "keluar", label: "Pengeluaran admin", v: d.r.admin },
            { jenis: "keluar", label: "Pengeluaran owner", v: d.r.owner },
          ]}
        />
        <KartuBisnis
          judul="Usaha"
          sub="POS, jasa & stok jualan"
          icon={<Store className="w-[18px] h-[18px]" />}
          loading={loading}
          masuk={d.usaha.masuk}
          keluar={d.usaha.keluar}
          rows={[
            { jenis: "masuk", label: "Penjualan POS", note: `${d.u.nota} nota`, v: d.u.pos },
            { jenis: "masuk", label: "Rincian pembukuan", note: `${d.u.bukuN} input`, v: d.u.buku },
            { jenis: "masuk", label: "Pemasukan lain", v: d.u.lain },
            { jenis: "keluar", label: "Belanja stok", v: d.u.stok },
            { jenis: "keluar", label: "Biaya operasional", v: d.u.ops },
          ]}
        />
      </div>

      {kosong ? (
        <div className="rounded-[22px] border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
          <BarChart3 className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600" />
          <div className="mt-2 text-[15px] font-black text-zinc-800 dark:text-zinc-100">Belum ada transaksi di periode ini</div>
          <p className="text-[12.5px] text-zinc-500 mt-1 max-w-sm mx-auto">
            Pembukuan rental, nota POS, dan transaksi di Input › Transaksi otomatis terhitung di sini.
          </p>
        </div>
      ) : (
        <>
          {/* Grafik arus uang */}
          <KartuAnalitik title={grafik.per === "hari" ? "Arus uang per hari" : "Arus uang per bulan"} icon={<BarChart3 className="w-4 h-4 text-zinc-500" />} right={<LegendaArus />}>
            <div className="h-[220px] -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafik.data} stackOffset="sign" margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} interval="preserveStartEnd" minTickGap={6} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tick }} tickFormatter={(v) => rpShort(Math.abs(Number(v)))} width={44} />
                  <ReferenceLine y={0} stroke={axis} />
                  <Tooltip cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }} content={<TipArus />} />
                  <Bar dataKey="masuk" stackId="arus" fill={WARNA_MASUK} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="keluarNeg" stackId="arus" fill={WARNA_KELUAR} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-xl bg-zinc-50 dark:bg-white/5 px-3 py-2 flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                <ArrowUpRight className="w-4 h-4 text-zinc-400" />
                <span><b className="text-zinc-900 dark:text-white tabular-nums">{hariSurplus}</b> {grafik.per} surplus</span>
              </div>
              <div className="rounded-xl bg-zinc-50 dark:bg-white/5 px-3 py-2 flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                <ArrowDownLeft className="w-4 h-4 text-zinc-400" />
                <span><b className="text-zinc-900 dark:text-white tabular-nums">{hariMinus}</b> {grafik.per} minus</span>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 mt-2">Batang di atas garis = uang masuk, di bawah garis = uang keluar.</p>
          </KartuAnalitik>

          {/* Rincian */}
          <div className="grid gap-3 sm:grid-cols-2">
            <KartuAnalitik title="Dari mana uang masuk" icon={<Titik c={WARNA_MASUK} className="w-2.5 h-2.5" />} right={<span className="text-[12px] font-bold tabular-nums text-zinc-500">{rpShort(d.masuk)}</span>}>
              {d.sumber.length === 0 ? (
                <p className="text-[13px] text-zinc-500 py-2">Belum ada uang masuk.</p>
              ) : (
                <div className="space-y-3">
                  {d.sumber.slice(0, 8).map((x) => (
                    <BatangUang key={x.sub + x.label} jenis="masuk" label={x.label} value={x.v} max={d.sumber[0].v} sub={`${x.sub} · ${persen((x.v / Math.max(1, d.masuk)) * 100)}`} />
                  ))}
                </div>
              )}
            </KartuAnalitik>
            <KartuAnalitik title="Ke mana uang keluar" icon={<Titik c={WARNA_KELUAR} className="w-2.5 h-2.5" />} right={<span className="text-[12px] font-bold tabular-nums text-zinc-500">{rpShort(d.keluar)}</span>}>
              {d.kategori.length === 0 ? (
                <p className="text-[13px] text-zinc-500 py-2">Belum ada uang keluar.</p>
              ) : (
                <div className="space-y-3">
                  {d.kategori.slice(0, 8).map((x) => (
                    <BatangUang key={x.sub + x.label} jenis="keluar" label={x.label} value={x.v} max={d.kategori[0].v} sub={`${x.sub} · ${persen((x.v / Math.max(1, d.keluar)) * 100)}`} />
                  ))}
                  {d.kategori.length > 8 && (
                    <p className="text-[11.5px] text-zinc-500">
                      +{d.kategori.length - 8} kategori lain · {rp(d.kategori.slice(8).reduce((s, x) => s + x.v, 0))}
                    </p>
                  )}
                </div>
              )}
            </KartuAnalitik>
          </div>

          <p className="text-[11.5px] text-zinc-400 leading-snug px-1">
            Rental = pembukuan harian + transaksi owner bertanda Rental. Usaha = nota POS (tanpa nota batal) + transaksi owner bertanda Usaha, termasuk belanja stok dari Input › Stok Jualan.
          </p>
        </>
      )}
    </div>
  );
}
