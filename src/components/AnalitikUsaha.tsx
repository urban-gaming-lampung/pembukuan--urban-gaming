import React, { useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import {
  Receipt, TrendingUp, TrendingDown, ShoppingBag, Package, Search, X, AlertTriangle, Users, Clock, Wallet, Ban, Loader2, BadgePercent, Store, Trash2, Coins, Image as ImageIcon,
} from "lucide-react";
import FilterComp from "./Filter";
import { useIsDark } from "../hooks/useIsDark";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import useStokData from "../hooks/useStokData";
import type { StokItemValue } from "../hooks/useStokData";
import { getMinStok, statusOf, useMinStok } from "../lib/stokJualan";
import { cancelPosSale, deletePosSale, PosItem, PosSale, StokRef, usePosSales } from "../lib/posSales";
import { resolveMonthYear } from "../lib/dateLocal";
import { fmtTanggalNota } from "../lib/posReceipt";
import { NotaActionButtons, NotaPreview, useNotaActions } from "./PosCheckoutSheet";
import { KATEGORI_PENGELUARAN_STOK, modalPada, useModalProduk } from "../lib/barangJualan";

type FilterProps = {
  mode: string;
  setMode: (v: string) => void;
  month: number;
  setMonth: (v: number) => void;
  rangeStart: string;
  setRangeStart: (v: string) => void;
  rangeEnd: string;
  setRangeEnd: (v: string) => void;
  /** Pengeluaran owner pada periode filter yang sama (untuk "Belanja stok") */
  pengeluaran?: { harga: number | string; kategori?: string }[];
};

const rp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
const rpShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} M`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} rb`;
  return String(Math.round(n));
};
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s: string) => {
  const [y, m, d] = String(s || "").split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};

/** Rentang waktu sesuai filter yang sama dengan Analitik Rental. */
export function periodRange(mode: string, month: number, rs: string, re: string): { from: number; to: number; label: string } {
  const now = new Date();
  const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const eod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
  if (mode === "Bulan Ini") return { from: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), to: eod(now), label: `${BULAN[now.getMonth()]} ${now.getFullYear()}` };
  if (mode === "7 Hari Terakhir") {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { from: sod(s), to: eod(now), label: "7 hari terakhir" };
  }
  if (mode === "Pilih Bulan") {
    const y = resolveMonthYear(month);
    const m = Math.min(12, Math.max(1, Number(month) || 1)) - 1;
    return { from: new Date(y, m, 1).getTime(), to: new Date(y, m + 1, 0, 23, 59, 59, 999).getTime(), label: `${BULAN[m]} ${y}` };
  }
  if (mode === "Rentang") {
    let a = parseYmd(rs), b = parseYmd(re);
    if (a && b) {
      if (a > b) [a, b] = [b, a];
      const f = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      return { from: sod(a), to: eod(b), label: `${f(a)} – ${f(b)}` };
    }
  }
  if (mode === "Semua Bulan") return { from: 0, to: eod(now), label: "semua waktu" };
  return { from: sod(now), to: eod(now), label: "hari ini" };
}

const catLabel = (it: PosItem) =>
  it.kategori === "JUALAN" ? it.subkategori || "Jualan lain" : it.kategori === "ISI GAME" ? "Isi Game" : it.kategori === "SERVIS" ? "Servis" : it.kategori === "RENTAL" ? "Rental (POS)" : it.kategori;
const CAT_COLOR: Record<string, string> = {
  "Unit PS": "bg-red-600", Stik: "bg-blue-600", Hardisk: "bg-violet-600", Aksesoris: "bg-amber-500", BD: "bg-cyan-600",
  "Isi Game": "bg-emerald-600", Servis: "bg-zinc-700 dark:bg-zinc-300", "Rental (POS)": "bg-pink-600",
};
const refKey = (r: StokRef) => `${r.kategori}||${r.item}`;

// ---------- UI kecil ----------
const Card: React.FC<{ title: string; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, right, children }) => (
  <section className="rounded-[22px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
    <div className="flex items-center justify-between gap-2 mb-3">
      <h3 className="flex items-center gap-2 text-[15px] font-black text-zinc-900 dark:text-white">{icon}{title}</h3>
      {right}
    </div>
    {children}
  </section>
);
const Tile: React.FC<{ label: string; value: string; sub?: string; icon: React.ReactNode }> = ({ label, value, sub, icon }) => (
  <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-3.5">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 dark:text-zinc-400">{label}</p>
      <span className="p-1.5 rounded-lg bg-zinc-50 dark:bg-white/5">{icon}</span>
    </div>
    <div className="text-[18px] font-black tabular-nums tracking-tight text-zinc-900 dark:text-white mt-1.5 leading-none">{value}</div>
    {sub && <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{sub}</div>}
  </div>
);
const BarRow: React.FC<{ label: string; value: number; max: number; right: string; sub?: string; color?: string }> = ({ label, value, max, right, sub, color = "bg-red-600" }) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 text-[13px]">
      <span className="font-bold text-zinc-800 dark:text-zinc-100 min-w-0 truncate">{label}</span>
      <span className="font-black font-mono tabular-nums text-zinc-900 dark:text-white shrink-0">{right}</span>
    </div>
    <div className="mt-1 h-2 rounded-full bg-zinc-100 dark:bg-white/5 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, (value / Math.max(1, max)) * 100)}%` }} />
    </div>
    {sub && <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{sub}</div>}
  </div>
);

export default function AnalitikUsaha(props: FilterProps) {
  const { mode, month, rangeStart, rangeEnd } = props;
  const isDark = useIsDark();
  const period = useMemo(() => periodRange(mode, month, rangeStart, rangeEnd), [mode, month, rangeStart, rangeEnd]);
  // Ambil juga periode sebelumnya (panjang sama) untuk perbandingan
  const prevFrom = period.from > 0 ? Math.max(1, period.from - (period.to - period.from + 1)) : 0;
  const { sales: raw, loading, error } = usePosSales(prevFrom, period.to, 4000);
  const { stokState, masterCategories } = useStokData();
  const minMap = useMinStok();
  const stokData = (stokState?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
  const masterJualan = Array.isArray(masterCategories?.jualan) ? masterCategories.jualan : [];

  const [produkSort, setProdukSort] = useState<"qty" | "omzet">("qty");
  const [cari, setCari] = useState("");
  const [showN, setShowN] = useState(20);
  const [selected, setSelected] = useState<PosSale | null>(null);

  const inPeriod = useMemo(() => raw.filter((s) => s.ts >= period.from), [raw, period.from]);
  const cur = useMemo(() => inPeriod.filter((s) => !s.batal), [inPeriod]);
  const prev = useMemo(() => (period.from > 0 ? raw.filter((s) => !s.batal && s.ts < period.from) : []), [raw, period.from]);
  const batalCount = inPeriod.length - cur.length;

  const st = useMemo(() => {
    let omzet = 0, qty = 0, diskon = 0, cash = 0, transfer = 0, cashN = 0, transferN = 0;
    const byDay = new Map<string, { omzet: number; nota: number }>();
    const byCat = new Map<string, { omzet: number; qty: number }>();
    const byProduct = new Map<string, { nama: string; kategori: string; qty: number; omzet: number }>();
    const byKasir = new Map<string, { omzet: number; nota: number }>();
    const byHour = Array.from({ length: 24 }, () => ({ nota: 0, omzet: 0 }));
    const soldStok = new Map<string, { ref: StokRef; qty: number }>();
    cur.forEach((s) => {
      omzet += s.total;
      diskon += s.diskon || 0;
      if (s.metode === "TRANSFER") { transfer += s.total; transferN++; } else { cash += s.total; cashN++; }
      const day = s.tanggal || ymd(new Date(s.ts));
      const d = byDay.get(day) || { omzet: 0, nota: 0 };
      d.omzet += s.total; d.nota++; byDay.set(day, d);
      const kas = s.kasirNama || s.kasir?.split("@")[0] || "-";
      const k = byKasir.get(kas) || { omzet: 0, nota: 0 };
      k.omzet += s.total; k.nota++; byKasir.set(kas, k);
      const h = byHour[new Date(s.ts).getHours()];
      h.nota++; h.omzet += s.total;
      (s.items || []).forEach((it) => {
        qty += it.qty;
        const cl = catLabel(it);
        const c = byCat.get(cl) || { omzet: 0, qty: 0 };
        c.omzet += it.subtotal; c.qty += it.qty; byCat.set(cl, c);
        const pn = it.kategori === "ISI GAME" && it.platform ? `${it.nama} (${it.platform})` : it.nama;
        const p = byProduct.get(pn) || { nama: pn, kategori: cl, qty: 0, omzet: 0 };
        p.qty += it.qty; p.omzet += it.subtotal; byProduct.set(pn, p);
        if (it.stokRef) {
          const rk = refKey(it.stokRef);
          const x = soldStok.get(rk) || { ref: it.stokRef, qty: 0 };
          x.qty += it.qty; soldStok.set(rk, x);
        }
      });
    });
    return { omzet, qty, diskon, cash, transfer, cashN, transferN, nota: cur.length, avg: cur.length ? omzet / cur.length : 0, byDay, byCat, byProduct, byKasir, byHour, soldStok };
  }, [cur]);

  const prevOmzet = useMemo(() => prev.reduce((s, x) => s + x.total, 0), [prev]);

  // Modal & laba barang jualan (harga modal saat transaksi, dari riwayat harga modal)
  const { map: modalMap } = useModalProduk();
  const laba = useMemo(() => {
    let penjualan = 0, denganModal = 0, hpp = 0, qtyTanpa = 0, perkiraan = 0;
    const perProduk = new Map<string, number>();
    cur.forEach((s) =>
      (s.items || []).forEach((it) => {
        if (it.kategori !== "JUALAN") return;
        penjualan += it.subtotal;
        const m = modalPada(modalMap[it.id], s.ts);
        if (!m) { qtyTanpa += it.qty; return; }
        if (m.perkiraan) perkiraan += it.qty;
        denganModal += it.subtotal;
        hpp += m.modal * it.qty;
        perProduk.set(it.nama, (perProduk.get(it.nama) || 0) + it.subtotal - m.modal * it.qty);
      })
    );
    const kotor = denganModal - hpp;
    return { penjualan, denganModal, hpp, kotor, margin: denganModal > 0 ? (kotor / denganModal) * 100 : 0, qtyTanpa, perkiraan, perProduk };
  }, [cur, modalMap]);
  const belanjaStok = useMemo(
    () => (props.pengeluaran || []).filter((e) => e.kategori === KATEGORI_PENGELUARAN_STOK).reduce((s, e) => s + (Number(e.harga) || 0), 0),
    [props.pengeluaran]
  );
  const growth = period.from > 0 && prevOmzet > 0 ? ((st.omzet - prevOmzet) / prevOmzet) * 100 : null;

  // Grafik omzet: harian (<= 62 hari) atau bulanan
  const chart = useMemo(() => {
    const end = Math.min(period.to, Date.now());
    const start = period.from > 0 ? period.from : cur.length ? cur[cur.length - 1].ts : end;
    const days = Math.round((end - start) / 86400000) + 1;
    if (days <= 62) {
      const out: { label: string; full: string; omzet: number; nota: number }[] = [];
      const d = new Date(start);
      d.setHours(0, 0, 0, 0);
      for (let i = 0; i < days && i < 62; i++) {
        const key = ymd(d);
        const v = st.byDay.get(key);
        out.push({ label: String(d.getDate()), full: d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }), omzet: v?.omzet || 0, nota: v?.nota || 0 });
        d.setDate(d.getDate() + 1);
      }
      return { mode: "hari" as const, data: out };
    }
    const m = new Map<string, { omzet: number; nota: number }>();
    st.byDay.forEach((v, k) => {
      const mk = k.slice(0, 7);
      const x = m.get(mk) || { omzet: 0, nota: 0 };
      x.omzet += v.omzet; x.nota += v.nota; m.set(mk, x);
    });
    const data = Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => {
      const [y, mo] = k.split("-").map(Number);
      return { label: BULAN[mo - 1].slice(0, 3), full: `${BULAN[mo - 1]} ${y}`, ...v };
    });
    return { mode: "bulan" as const, data };
  }, [st.byDay, period.from, period.to, cur]);
  const bestDay = chart.data.reduce((b, x) => (x.omzet > (b?.omzet || 0) ? x : b), null as null | (typeof chart.data)[number]);

  const cats = useMemo(() => Array.from(st.byCat.entries()).map(([label, v]) => ({ label, ...v })).sort((a, b) => b.omzet - a.omzet), [st.byCat]);
  const produk = useMemo(
    () => Array.from(st.byProduct.values()).sort((a, b) => (produkSort === "qty" ? b.qty - a.qty || b.omzet - a.omzet : b.omzet - a.omzet)).slice(0, 10),
    [st.byProduct, produkSort]
  );
  const kasir = useMemo(() => Array.from(st.byKasir.entries()).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.omzet - a.omzet), [st.byKasir]);
  const jam = useMemo(() => {
    const act = st.byHour.map((h, i) => ({ jam: i, ...h })).filter((h) => h.nota > 0);
    if (!act.length) return [];
    const lo = Math.min(...act.map((h) => h.jam)), hi = Math.max(...act.map((h) => h.jam));
    return st.byHour.slice(lo, hi + 1).map((h, i) => ({ label: pad(lo + i), ...h }));
  }, [st.byHour]);
  const jamRamai = jam.reduce((b, x) => (x.nota > (b?.nota || 0) ? x : b), null as null | (typeof jam)[number]);

  // Laku di periode ini & stoknya sekarang menipis / habis
  const restock = useMemo(() => {
    const out: { ref: StokRef; terjual: number; sisa: number; min: number; status: "habis" | "menipis" }[] = [];
    st.soldStok.forEach(({ ref, qty }) => {
      const inMaster = masterJualan.some((c) => c.kategori === ref.kategori && c.items.includes(ref.item));
      if (!inMaster) return;
      const sisa = Math.max(0, Math.round(Number(stokData?.[ref.kategori]?.[ref.item]?.jumlah) || 0));
      const min = getMinStok(minMap, ref.kategori, ref.item);
      const status = statusOf(sisa, min);
      if (status !== "aman") out.push({ ref, terjual: qty, sisa, min, status });
    });
    return out.sort((a, b) => (a.status === b.status ? b.terjual - a.terjual : a.status === "habis" ? -1 : 1));
  }, [st.soldStok, stokData, minMap, masterJualan]);

  const q = cari.trim().toLowerCase();
  const riwayat = useMemo(
    () =>
      !q
        ? inPeriod
        : inPeriod.filter((s) =>
            [s.noNota, s.pembeli, s.pembeliWa, s.kasirNama, ...(s.items || []).map((i) => i.nama)].some((v) => String(v || "").toLowerCase().includes(q))
          ),
    [inPeriod, q]
  );

  const tickColor = isDark ? "#a1a1aa" : "#71717a";
  const gridColor = isDark ? "#27272a" : "#f0f0f0";

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

      {/* HERO OMZET */}
      <section className="rounded-[24px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-red-600/30 dark:bg-red-600/15 blur-2xl" aria-hidden />
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest opacity-60">
          <Store className="w-3.5 h-3.5" />Omzet usaha · {period.label}
        </div>
        <div className="mt-2 flex items-end gap-3 flex-wrap">
          <div className="text-[32px] sm:text-[40px] font-black tabular-nums tracking-tight leading-none">
            {loading ? <Loader2 className="w-8 h-8 animate-spin opacity-60" /> : rp(st.omzet)}
          </div>
          {growth !== null && !loading && (
            <span className={`mb-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-black ${growth >= 0 ? "bg-emerald-500/20 text-emerald-300 dark:text-emerald-700" : "bg-red-500/20 text-red-300 dark:text-red-700"}`}>
              {growth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {growth >= 0 ? "+" : ""}{growth.toFixed(0)}%
            </span>
          )}
        </div>
        <div className="mt-1 text-[12px] opacity-60">
          {growth !== null ? `vs ${rp(prevOmzet)} periode sebelumnya` : period.from > 0 ? "Belum ada data periode sebelumnya" : "Seluruh transaksi POS"}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Nota", String(st.nota)],
            ["Rata-rata", rpShort(st.avg)],
            ["Barang", String(st.qty)],
          ].map(([l, v]) => (
            <div key={l} className="rounded-2xl bg-white/10 dark:bg-zinc-900/5 py-2.5">
              <div className="text-[18px] font-black tabular-nums leading-none">{v}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {(cur.length > 0 || belanjaStok > 0) && (
        <section className="rounded-[22px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-3">
          <h3 className="flex items-center gap-2 text-[15px] font-black text-zinc-900 dark:text-white"><Coins className="w-4 h-4 text-emerald-600" />Modal & laba barang jualan</h3>
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-700/70 dark:text-emerald-400/70">Laba kotor</div>
            <div className="flex items-end justify-between gap-2 mt-1">
              <div className={`text-[26px] font-black tabular-nums tracking-tight leading-none ${laba.kotor >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}>{rp(laba.kotor)}</div>
              {laba.denganModal > 0 && <div className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">margin {laba.margin.toFixed(0)}%</div>}
            </div>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-white/5 text-[13.5px]">
            <div className="flex justify-between py-2"><span className="text-zinc-500">Penjualan barang jualan</span><span className="font-bold tabular-nums text-zinc-900 dark:text-white">{rp(laba.penjualan)}</span></div>
            <div className="flex justify-between py-2"><span className="text-zinc-500">Modal barang terjual</span><span className="font-bold tabular-nums text-zinc-900 dark:text-white">− {rp(laba.hpp)}</span></div>
            <div className="flex justify-between py-2">
              <span className="text-zinc-500">Belanja stok <span className="text-zinc-400">(uang keluar)</span></span>
              <span className="font-bold tabular-nums text-zinc-900 dark:text-white">{rp(belanjaStok)}</span>
            </div>
          </div>
          {laba.qtyTanpa > 0 && (
            <p className="flex items-start gap-1.5 text-[12px] text-amber-700 dark:text-amber-400"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{laba.qtyTanpa} barang terjual belum punya harga modal, belum masuk hitungan laba. Isi di Owner › Input › Stok Jualan.</p>
          )}
          {laba.perkiraan > 0 && <p className="text-[12px] text-zinc-500">{laba.perkiraan} barang memakai harga modal yang diisi sesudah transaksi (perkiraan).</p>}
          <p className="text-[11.5px] text-zinc-400 leading-snug">Laba = penjualan − modal barang yang terjual. Belanja stok diambil dari Pengeluaran kategori “{KATEGORI_PENGELUARAN_STOK}” pada periode yang sama.</p>
        </section>
      )}

      {!loading && cur.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
          <Receipt className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600" />
          <div className="mt-2 text-[15px] font-black text-zinc-800 dark:text-zinc-100">Belum ada penjualan di periode ini</div>
          <p className="text-[12.5px] text-zinc-500 mt-1 max-w-sm mx-auto">
            Penjualan tercatat otomatis setiap kali nota dibuat dari POS (Selesaikan &amp; Cetak Nota). Transaksi sebelum fitur ini aktif tidak ikut terhitung.
          </p>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-2.5">
            <Tile label="Tunai" value={rpShort(st.cash)} sub={`${st.cashN} nota`} icon={<Wallet className="w-4 h-4 text-emerald-500" />} />
            <Tile label="Transfer/QRIS" value={rpShort(st.transfer)} sub={`${st.transferN} nota`} icon={<Wallet className="w-4 h-4 text-blue-500" />} />
            <Tile label="Diskon promo" value={rpShort(st.diskon)} sub={st.omzet + st.diskon > 0 ? `${((st.diskon / (st.omzet + st.diskon)) * 100).toFixed(1)}% dari harga normal` : undefined} icon={<BadgePercent className="w-4 h-4 text-amber-500" />} />
            <Tile label="Nota batal" value={String(batalCount)} sub="tidak dihitung" icon={<Ban className="w-4 h-4 text-zinc-400" />} />
          </div>

          {/* Grafik omzet */}
          <Card
            title={chart.mode === "hari" ? "Omzet per hari" : "Omzet per bulan"}
            icon={<TrendingUp className="w-4 h-4 text-red-600" />}
            right={bestDay && bestDay.omzet > 0 ? <span className="text-[11px] text-zinc-500 text-right">Tertinggi <b className="text-zinc-800 dark:text-zinc-100">{bestDay.full}</b></span> : null}
          >
            <div className="h-[200px] -ml-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} interval="preserveStartEnd" minTickGap={6} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} tickFormatter={(v) => rpShort(Number(v))} width={44} />
                  <Tooltip
                    cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                    contentStyle={{ borderRadius: 12, border: "none", background: isDark ? "#18181b" : "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.15)", fontSize: 12 }}
                    labelFormatter={(_, p) => (p && p[0] ? (p[0].payload as any).full : "")}
                    formatter={(v: any, _n: any, p: any) => [`${rp(Number(v))} · ${p?.payload?.nota || 0} nota`, "Omzet"]}
                  />
                  <Bar dataKey="omzet" fill="#dc2626" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Perlu restock */}
          {restock.length > 0 && (
            <Card title="Laku & stok menipis" icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} right={<span className="text-[11px] text-zinc-500">{restock.length} barang</span>}>
              <div className="space-y-2">
                {restock.slice(0, 8).map((r) => (
                  <div key={refKey(r.ref)} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 dark:bg-white/5 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-zinc-900 dark:text-white truncate">{r.ref.item}</div>
                      <div className="text-[11px] text-zinc-500 truncate">{r.ref.kategori} · terjual {r.terjual}</div>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-lg text-[11.5px] font-black ${r.status === "habis" ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950"}`}>
                      {r.status === "habis" ? "Habis" : `Sisa ${r.sisa}`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">Atur batas minimum & restock di menu Stok.</p>
            </Card>
          )}

          {/* Kategori */}
          <Card title="Omzet per kategori" icon={<Package className="w-4 h-4 text-blue-600" />} right={<span className="text-[10.5px] text-zinc-400">sebelum diskon</span>}>
            <div className="space-y-3">
              {cats.map((c) => (
                <BarRow key={c.label} label={c.label} value={c.omzet} max={cats[0]?.omzet || 1} right={rpShort(c.omzet)} sub={`${c.qty} terjual · ${((c.omzet / Math.max(1, st.omzet + st.diskon)) * 100).toFixed(0)}%`} color={CAT_COLOR[c.label] || "bg-zinc-500"} />
              ))}
            </div>
          </Card>

          {/* Produk terlaris */}
          <Card
            title="Produk terlaris"
            icon={<ShoppingBag className="w-4 h-4 text-red-600" />}
            right={
              <div className="flex p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold">
                {(["qty", "omzet"] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setProdukSort(k)} className={`px-2.5 py-1 rounded-md ${produkSort === k ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-500"}`}>
                    {k === "qty" ? "Jumlah" : "Omzet"}
                  </button>
                ))}
              </div>
            }
          >
            <ol className="space-y-3">
              {produk.map((p, i) => (
                <li key={p.nama} className="flex gap-3">
                  <span className={`w-6 h-6 shrink-0 rounded-lg text-[11px] font-black flex items-center justify-center ${i < 3 ? "bg-red-600 text-white" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <BarRow
                      label={p.nama}
                      value={produkSort === "qty" ? p.qty : p.omzet}
                      max={produkSort === "qty" ? produk[0]?.qty || 1 : produk[0]?.omzet || 1}
                      right={produkSort === "qty" ? `${p.qty}x` : rpShort(p.omzet)}
                      sub={`${p.kategori} · ${produkSort === "qty" ? rp(p.omzet) : `${p.qty} terjual`}${laba.perProduk.has(p.nama) ? ` · laba ${rpShort(laba.perProduk.get(p.nama)!)}` : ""}`}
                      color={i < 3 ? "bg-red-600" : "bg-zinc-400 dark:bg-zinc-600"}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Kasir */}
            <Card title="Per kasir" icon={<Users className="w-4 h-4 text-violet-600" />}>
              <div className="space-y-3">
                {kasir.map((k) => (
                  <BarRow key={k.nama} label={k.nama} value={k.omzet} max={kasir[0]?.omzet || 1} right={rpShort(k.omzet)} sub={`${k.nota} nota`} color="bg-violet-600" />
                ))}
              </div>
            </Card>

            {/* Jam ramai */}
            <Card title="Jam ramai" icon={<Clock className="w-4 h-4 text-emerald-600" />} right={jamRamai ? <span className="text-[11px] text-zinc-500">puncak <b className="text-zinc-800 dark:text-zinc-100">{jamRamai.label}.00</b></span> : null}>
              <div className="h-[140px] -ml-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jam} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: tickColor }} interval={0} />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
                      contentStyle={{ borderRadius: 12, border: "none", background: isDark ? "#18181b" : "#fff", boxShadow: "0 8px 24px rgba(0,0,0,.15)", fontSize: 12 }}
                      labelFormatter={(l) => `Jam ${l}.00`}
                      formatter={(v: any, _n: any, p: any) => [`${v} nota · ${rp(p?.payload?.omzet || 0)}`, "Transaksi"]}
                    />
                    <Bar dataKey="nota" fill="#059669" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Riwayat nota */}
      <Card title="Riwayat nota" icon={<Receipt className="w-4 h-4 text-zinc-500" />} right={<span className="text-[11px] text-zinc-500">{riwayat.length} nota</span>}>
        <div className="flex items-center gap-2 h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 mb-3">
          <Search className="w-4 h-4 text-zinc-400 shrink-0" />
          <input value={cari} onChange={(e) => { setCari(e.target.value); setShowN(20); }} placeholder="Cari no. nota, pembeli, barang…"
            className="flex-1 min-w-0 bg-transparent text-[14px] focus:outline-none text-zinc-900 dark:text-white" />
          {cari && <button type="button" onClick={() => setCari("")} aria-label="Hapus"><X className="w-4 h-4 text-zinc-400" /></button>}
        </div>
        {riwayat.length === 0 ? (
          <div className="text-center text-[13px] text-zinc-500 py-6">{loading ? "Memuat…" : "Tidak ada nota."}</div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-white/5 -mx-1">
            {riwayat.slice(0, showN).map((s) => (
              <button key={s.id || s.noNota} type="button" onClick={() => setSelected(s)} className="w-full text-left px-1 py-2.5 flex items-center gap-3 active:bg-zinc-50 dark:active:bg-white/5 rounded-lg">
                <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${s.batal ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400" : s.metode === "TRANSFER" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600" : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"}`}>
                  {s.batal ? <Ban className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[13.5px] font-bold truncate ${s.batal ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-white"}`}>{s.pembeli || "Pelanggan"}</span>
                    {s.batal && <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">BATAL</span>}
                  </div>
                  <div className="text-[11.5px] text-zinc-500 truncate">
                    {s.noNota} · {new Date(s.ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {(s.items || []).reduce((a, i) => a + i.qty, 0)} barang
                  </div>
                </div>
                <div className={`text-[13.5px] font-black font-mono tabular-nums shrink-0 ${s.batal ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-white"}`}>{rpShort(s.total)}</div>
              </button>
            ))}
          </div>
        )}
        {riwayat.length > showN && (
          <button type="button" onClick={() => setShowN((n) => n + 30)} className="mt-2 w-full h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[13px] font-bold text-zinc-700 dark:text-zinc-200">
            Tampilkan lebih banyak ({riwayat.length - showN})
          </button>
        )}
      </Card>

      <NotaDetailSheet sale={selected} live={raw.find((s) => s.id && s.id === selected?.id) || selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// ============================================================
// Detail nota: cetak ulang / unduh / kirim / batalkan
// ============================================================
const NotaDetailSheet: React.FC<{ sale: PosSale | null; live: PosSale | null; onClose: () => void }> = ({ sale, live, onClose }) => {
  useBodyScrollLock(!!sale);
  const actions = useNotaActions(sale);
  const [busy, setBusy] = useState<"" | "batal" | "hapus">("");
  if (!sale || !live) return null;

  const hapus = async () => {
    const ok = window.confirm(
      `Hapus permanen nota ${live.noNota}?\n\n` +
        (live.batal ? "" : "• Stok barang yang terpotong akan dikembalikan.\n") +
        "• Riwayat stok nota ini ikut dihapus.\n• Tidak bisa dibatalkan."
    );
    if (!ok) return;
    setBusy("hapus");
    try {
      await deletePosSale(live);
      onClose();
      window.alert(`Nota ${live.noNota} dihapus ✅`);
    } catch (e: any) {
      actions.setMsg("Gagal menghapus: " + (e?.message || e));
    } finally {
      setBusy("");
    }
  };

  const batalkan = async () => {
    const alasan = window.prompt(`Batalkan nota ${live.noNota}?\nStok barang yang terpotong akan dikembalikan.\n\nAlasan pembatalan (opsional):`, "");
    if (alasan === null) return;
    setBusy("batal");
    try {
      await cancelPosSale(live, alasan);
      actions.setMsg("Nota dibatalkan & stok dikembalikan ✅");
    } catch (e: any) {
      actions.setMsg("Gagal membatalkan: " + (e?.message || e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-zinc-50 dark:bg-[#141416] rounded-t-[26px] sm:rounded-[26px] max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
        <div className="px-4 pt-2 pb-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-[17px] font-black text-zinc-900 dark:text-white font-mono">{live.noNota}</h3>
            <p className="text-[12px] text-zinc-500">{fmtTanggalNota(live.ts)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-9 h-9 rounded-full bg-zinc-200/70 dark:bg-zinc-800 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          {actions.msg && <div className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#1c1c1e] rounded-xl px-3 py-2">{actions.msg}</div>}
          {live.batal && (
            <div className="rounded-2xl bg-zinc-200/70 dark:bg-zinc-800 p-3 text-[12.5px] text-zinc-700 dark:text-zinc-300">
              <b>Nota dibatalkan</b>{live.batalOleh ? ` oleh ${live.batalOleh.split("@")[0]}` : ""}{live.batalTs ? ` · ${new Date(live.batalTs).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
              {live.batalAlasan ? <div className="mt-0.5">Alasan: {live.batalAlasan}</div> : null}
            </div>
          )}
          {live.buktiTransfer && (
            <a href={live.buktiTransfer} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl bg-white dark:bg-[#1c1c1e] p-3 active:opacity-80">
              <img src={live.buktiTransfer} alt="Bukti transfer" className="w-14 h-14 rounded-xl object-cover bg-zinc-100" />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-bold text-zinc-900 dark:text-white">Bukti transfer</div>
                <div className="text-[12px] text-zinc-500">Ketuk untuk lihat ukuran penuh</div>
              </div>
              <ImageIcon className="w-4 h-4 text-zinc-400" />
            </a>
          )}
          {live.metode === "TRANSFER" && !live.buktiTransfer && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-3 text-[12px] text-amber-800 dark:text-amber-300">Transfer tanpa bukti (nota lama sebelum bukti transfer diwajibkan).</div>
          )}
          {(live.stokKurang?.length || 0) > 0 && (
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 p-3 text-[12px] text-amber-800 dark:text-amber-300">
              Saat transaksi, stok tercatat kurang: {live.stokKurang!.map((k) => `${k.item} (terjual ${k.diminta}, tercatat ${k.tersedia})`).join(", ")}
            </div>
          )}
          <div className={`rounded-[22px] bg-zinc-200/60 dark:bg-black/40 p-3 ${live.batal ? "opacity-60" : ""}`}>
            <NotaPreview sale={live} />
          </div>
        </div>
        <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-white dark:bg-[#1c1c1e] border-t border-zinc-200/70 dark:border-white/5 space-y-2">
          {!live.batal && <NotaActionButtons sale={live} actions={actions} />}
          <div className={`grid gap-2 ${live.batal ? "grid-cols-1" : "grid-cols-[1fr_auto]"}`}>
            {!live.batal && (
              <button type="button" disabled={!!busy} onClick={batalkan} className="h-11 rounded-xl text-[13px] font-bold text-red-600 bg-red-50 dark:bg-red-500/10 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {busy === "batal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}Batalkan & kembalikan stok
              </button>
            )}
            <button type="button" disabled={!!busy} onClick={hapus} className="h-11 px-4 rounded-xl text-[13px] font-bold text-white bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {busy === "hapus" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}Hapus nota
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
