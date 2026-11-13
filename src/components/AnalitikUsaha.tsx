import React, { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import {
  Receipt, TrendingUp, TrendingDown, X, AlertTriangle, Users, Clock, Ban, Loader2, BadgePercent, Store, Trash2, Coins, Image as ImageIcon, Handshake, ChevronRight,
} from "lucide-react";
import FilterComp from "./Filter";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import useStokData from "../hooks/useStokData";
import type { StokItemValue } from "../hooks/useStokData";
import { getMinStok, kunciStok, statusOf, useMinStok } from "../lib/stokJualan";
import { bayarNota, cancelPosSale, deletePosSale, gabungNota, nilaiTukarNota, infoNego, isDpTerbuka, PosItem, PosSale, ringkasanDp, StokRef, tanggalPenjualan, terjualDalam, usePosSales, usePosSalesLunas, waktuPenjualan } from "../lib/posSales";
import { BatalDp } from "./NotaDpSheet";
import { fmtTanggalNota } from "../lib/posReceipt";
import { NotaActionButtons, NotaPreview, useNotaActions } from "./PosCheckoutSheet";
import { modalPada, useModalProduk, useProdukJualan } from "../lib/barangJualan";
import { Kondisi, kondisiProduk } from "../lib/posSales";
import { isBelanjaStok, periodRange, TransaksiOwner } from "../lib/keuangan";
import { tebakModalBaris, useBarisUsahaManual } from "../lib/pemasukanUsaha";
import { pad, persen, rpShort, rupiah } from "../lib/format";
import { dariYmd, tanggalHariKerja, toLocalYmd } from "../lib/dateLocal";
import { Amount, BarRow, Button, Card, ChartTip, EmptyState, IconBadge, LineItem, LineList, MARK, Notice, Pill, SearchField, SectionHeader, SplitBar, StatTile, SubTabs, TileValue, sumbu, useTemaGrafik } from "../ui";
import { HeroArus } from "./analitik/HeroArus";

type FilterProps = {
  mode: string;
  setMode: (v: string) => void;
  month: number;
  setMonth: (v: number) => void;
  rangeStart: string;
  setRangeStart: (v: string) => void;
  rangeEnd: string;
  setRangeEnd: (v: string) => void;
  /** Pengeluaran owner bertanda USAHA pada periode filter yang sama (belanja stok + biaya operasional) */
  pengeluaran?: TransaksiOwner[];
  /** Pemasukan owner bertanda USAHA (modal masuk, dll.) pada periode yang sama */
  pemasukan?: TransaksiOwner[];
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const catLabel = (it: PosItem) =>
  it.kategori === "JUALAN" ? it.subkategori || "Jualan lain" : it.kategori === "ISI GAME" ? "Isi Game" : it.kategori === "SERVIS" ? "Servis" : it.kategori === "RENTAL" ? "Rental (POS)" : it.kategori;
/** "Rp 12.300" per Rp 100.000 penjualan. */
const per100 = (v: number, basis: number) => rupiah(Math.round(((v / Math.max(1, basis)) * 100000) / 100) * 100);

export default function AnalitikUsaha(props: FilterProps) {
  const { mode, month, rangeStart, rangeEnd } = props;
  // Hari kerja berganti -> periode "Bulan Ini" / "7 Hari" ikut bergeser
  const hariKerja = tanggalHariKerja();
  const period = useMemo(() => periodRange(mode, month, rangeStart, rangeEnd), [mode, month, rangeStart, rangeEnd, hariKerja]);
  // Ambil juga periode sebelumnya (panjang sama) untuk perbandingan
  const prevFrom = period.from > 0 ? Math.max(1, period.from - (period.to - period.from + 1)) : 0;
  const { sales: raw, loading: loadingPos, error } = usePosSales(prevFrom, period.to, 4000);
  // Nota DP yang dilunasi di periode ini (penjualannya dihitung saat lunas, walau nota dibuat sebelumnya)
  const { sales: lunasRaw, loading: loadingLunas } = usePosSalesLunas(prevFrom, period.to);
  // Rincian Pemasukan Usaha yang diketik admin di pembukuan harian (termasuk riwayat lama)
  const { rows: manualRaw, loading: loadingManual } = useBarisUsahaManual(prevFrom, period.to);
  const loading = loadingPos || loadingManual || loadingLunas;
  const { stokState, masterCategories } = useStokData();
  const minMap = useMinStok();
  const stokData = (stokState?.jualan || {}) as Record<string, Record<string, StokItemValue>>;
  const masterJualan = Array.isArray(masterCategories?.jualan) ? masterCategories.jualan : [];

  const [produkSort, setProdukSort] = useState<"qty" | "omzet">("qty");
  const [cari, setCari] = useState("");
  const [showN, setShowN] = useState(20);
  const [selected, setSelected] = useState<PosSale | null>(null);

  // Riwayat nota = nota yang DIBUAT di periode ini
  const inPeriod = useMemo(() => raw.filter((s) => s.ts >= period.from), [raw, period.from]);
  // Penjualan = nota lunas (nota DP dihitung pada waktu pelunasan)
  const semua = useMemo(() => gabungNota(raw, lunasRaw), [raw, lunasRaw]);
  const cur = useMemo(
    () => semua.filter((s) => terjualDalam(s, period.from, period.to)).sort((a, b) => waktuPenjualan(b) - waktuPenjualan(a)),
    [semua, period.from, period.to]
  );
  const prev = useMemo(() => (period.from > 0 ? semua.filter((s) => terjualDalam(s, prevFrom, period.from - 1)) : []), [semua, period.from, prevFrom]);
  const batalCount = inPeriod.filter((s) => s.batal).length;
  // DP: uang yang sudah diterima tetapi belum menjadi penjualan, dan DP hangus (pembeli batal)
  const dp = useMemo(() => ringkasanDp(inPeriod), [inPeriod]);
  const manualCur = useMemo(() => manualRaw.filter((r) => r.ts >= period.from && r.ts <= period.to), [manualRaw, period.from, period.to]);
  const manualPrev = useMemo(() => (period.from > 0 ? manualRaw.filter((r) => r.ts < period.from) : []), [manualRaw, period.from]);
  const adaData = cur.length > 0 || manualCur.length > 0 || dp.berjalan > 0 || dp.hangus > 0;

  const st = useMemo(() => {
    let omzet = 0, qty = 0, diskon = 0, cash = 0, transfer = 0, cashN = 0, transferN = 0, nego = 0, negoN = 0, posOmzet = 0, manualOmzet = 0, tukar = 0, tukarN = 0;
    const byDay = new Map<string, { omzet: number; nota: number }>();
    const byCat = new Map<string, { omzet: number; qty: number }>();
    const byProduct = new Map<string, { nama: string; kategori: string; qty: number; omzet: number }>();
    const byKasir = new Map<string, { omzet: number; nota: number }>();
    const byHour = Array.from({ length: 24 }, () => ({ nota: 0, omzet: 0 }));
    const soldStok = new Map<string, { ref: StokRef; qty: number }>();
    cur.forEach((s) => {
      omzet += s.total;
      posOmzet += s.total;
      diskon += s.diskon || 0;
      const ng = infoNego(s);
      if (ng.ada) { nego += ng.total; negoN++; }
      // Nota DP yang sudah lunas: tunai / transfer mengikuti tiap pembayaran
      if (s.pembayaran?.length) {
        s.pembayaran.forEach((p) => { if (p.metode === "TRANSFER") transfer += Number(p.jumlah) || 0; else cash += Number(p.jumlah) || 0; });
        if (s.pembayaran[s.pembayaran.length - 1].metode === "TRANSFER") transferN++; else cashN++;
      } else if (s.metode === "TRANSFER") { transfer += bayarNota(s); transferN++; } else { cash += bayarNota(s); cashN++; }
      // Tukar tambah: nilai barang masuk memotong uang yang diterima (dicatat sebagai belanja stok)
      const tt = nilaiTukarNota(s);
      if (tt > 0) { tukar += tt; tukarN++; }
      const tJual = waktuPenjualan(s);
      const day = tanggalPenjualan(s);
      const d = byDay.get(day) || { omzet: 0, nota: 0 };
      d.omzet += s.total; d.nota++; byDay.set(day, d);
      const kas = s.kasirNama || s.kasir?.split("@")[0] || "-";
      const k = byKasir.get(kas) || { omzet: 0, nota: 0 };
      k.omzet += s.total; k.nota++; byKasir.set(kas, k);
      const h = byHour[new Date(tJual).getHours()];
      h.nota++; h.omzet += s.total;
      (s.items || []).forEach((it) => {
        qty += it.qty;
        const cl = catLabel(it);
        const c = byCat.get(cl) || { omzet: 0, qty: 0 };
        c.omzet += it.subtotal; c.qty += it.qty; byCat.set(cl, c);
        const pn = it.kategori === "ISI GAME" && it.platform ? `${it.nama} (${it.platform})` : it.kategori === "JUALAN" ? String(it.nama || "").toUpperCase() : it.nama;
        const p = byProduct.get(pn) || { nama: pn, kategori: cl, qty: 0, omzet: 0 };
        p.qty += it.qty; p.omzet += it.subtotal; byProduct.set(pn, p);
        if (it.stokRef) {
          const rk = kunciStok(it.stokRef);
          const x = soldStok.get(rk) || { ref: it.stokRef, qty: 0 };
          x.qty += it.qty; soldStok.set(rk, x);
        }
      });
    });
    // Baris rincian usaha dari pembukuan harian (input admin, bukan nota POS)
    manualCur.forEach((r) => {
      omzet += r.harga;
      manualOmzet += r.harga;
      if (r.metode === "TRANSFER") { transfer += r.harga; transferN++; } else { cash += r.harga; cashN++; }
      const d = byDay.get(r.tanggal) || { omzet: 0, nota: 0 };
      d.omzet += r.harga; d.nota++; byDay.set(r.tanggal, d);
      const c = byCat.get(r.kategori) || { omzet: 0, qty: 0 };
      c.omzet += r.harga; c.qty += 1; byCat.set(r.kategori, c);
    });
    const transaksi = cur.length + manualCur.length;
    return {
      omzet, qty, diskon, nego, negoN, cash, transfer, cashN, transferN, posOmzet, manualOmzet, tukar, tukarN,
      nota: cur.length, manualN: manualCur.length, transaksi, avg: transaksi ? omzet / transaksi : 0,
      byDay, byCat, byProduct, byKasir, byHour, soldStok,
    };
  }, [cur, manualCur]);

  const prevOmzet = useMemo(() => prev.reduce((s, x) => s + x.total, 0) + manualPrev.reduce((s, x) => s + x.harga, 0), [prev, manualPrev]);

  // Modal & laba barang jualan (harga modal saat transaksi, dari riwayat harga modal)
  const { map: modalMap } = useModalProduk();
  const { products: produkJualan } = useProdukJualan();
  const laba = useMemo(() => {
    let penjualan = 0, denganModal = 0, hpp = 0, qtyTanpa = 0, perkiraan = 0, penjualanTanpaModal = 0;
    const perProduk = new Map<string, number>();
    const perKondisi: Record<Kondisi, { penjualan: number; laba: number; qty: number }> = { BARU: { penjualan: 0, laba: 0, qty: 0 }, SEKEN: { penjualan: 0, laba: 0, qty: 0 } };
    const byId = new Map(produkJualan.map((p) => [p.id, p]));
    cur.forEach((s) =>
      (s.items || []).forEach((it) => {
        if (it.kategori !== "JUALAN") return;
        penjualan += it.subtotal;
        const prod = byId.get(it.id);
        const kd: Kondisi = it.kondisi || (prod ? kondisiProduk(prod) : kondisiProduk({ name: it.nama, stokRef: it.stokRef }));
        perKondisi[kd].penjualan += it.subtotal;
        perKondisi[kd].qty += it.qty;
        const m = modalPada(modalMap[it.id], waktuPenjualan(s));
        if (!m) { qtyTanpa += it.qty; penjualanTanpaModal += it.subtotal; return; }
        if (m.perkiraan) perkiraan += it.qty;
        denganModal += it.subtotal;
        hpp += m.modal * it.qty;
        const key = String(it.nama || "").toUpperCase();
        perProduk.set(key, (perProduk.get(key) || 0) + it.subtotal - m.modal * it.qty);
        perKondisi[kd].laba += it.subtotal - m.modal * it.qty;
      })
    );
    // Barang dari pembukuan harian (stik, kabel, dll.): perkiraan modal dari harga modal barang saat ini
    let manualBarang = 0;
    manualCur.forEach((r) => {
      if (!r.barang) return;
      manualBarang++;
      penjualan += r.harga;
      const t = tebakModalBaris(r, produkJualan, modalMap);
      const kd: Kondisi = t?.kondisi || "BARU";
      perKondisi[kd].penjualan += r.harga;
      perKondisi[kd].qty += t?.qty || 1;
      if (!t) { qtyTanpa += 1; penjualanTanpaModal += r.harga; return; }
      perkiraan += t.qty;
      denganModal += r.harga;
      hpp += t.modal;
      const key = String(t.produk.name || "").toUpperCase();
      perProduk.set(key, (perProduk.get(key) || 0) + r.harga - t.modal);
      perKondisi[kd].laba += r.harga - t.modal;
    });
    const kotor = denganModal - hpp;
    return { penjualan, denganModal, hpp, kotor, margin: denganModal > 0 ? (kotor / denganModal) * 100 : 0, qtyTanpa, perkiraan, perProduk, perKondisi, penjualanTanpaModal, manualBarang };
  }, [cur, manualCur, modalMap, produkJualan]);

  // ===== Arus uang usaha (uang masuk vs uang keluar) =====
  const uang = useMemo(() => {
    let belanjaStok = 0, operasional = 0, lain = 0;
    (props.pengeluaran || []).forEach((e) => {
      const v = Number(e.harga) || 0;
      if (isBelanjaStok(e)) belanjaStok += v;
      else operasional += v;
    });
    (props.pemasukan || []).forEach((e) => { lain += Number(e.harga) || 0; });
    const masuk = st.omzet + lain + dp.berjalan + dp.hangus;
    // Barang tukar tambah = belanja stok yang dibayar dengan potongan nota
    const tukar = st.tukar;
    const keluar = belanjaStok + tukar + operasional;
    return { belanjaStok, tukar, operasional, lain, masuk, keluar, selisih: masuk - keluar };
  }, [props.pengeluaran, props.pemasukan, st.omzet, st.tukar, dp.berjalan, dp.hangus]);

  // ===== Laba & margin usaha =====
  // Penjualan terhitung = omzet POS tanpa barang jualan yang belum punya harga modal.
  // Isi game, servis & rental POS dihitung tanpa modal barang.
  const untung = useMemo(() => {
    // DP hangus = pemasukan tanpa modal (barang tidak diserahkan)
    const terhitung = Math.max(0, st.omzet - laba.penjualanTanpaModal) + dp.hangus;
    const kotor = terhitung - laba.hpp;
    const bersih = kotor - uang.operasional;
    return {
      terhitung,
      kotor,
      bersih,
      marginKotor: terhitung > 0 ? (kotor / terhitung) * 100 : 0,
      marginBersih: terhitung > 0 ? (bersih / terhitung) * 100 : 0,
    };
  }, [st.omzet, laba.penjualanTanpaModal, laba.hpp, uang.operasional, dp.hangus]);
  const growth = period.from > 0 && prevOmzet > 0 ? ((st.omzet - prevOmzet) / prevOmzet) * 100 : null;

  // Grafik omzet: harian (<= 62 hari) atau bulanan — per hari kerja (sama dengan pembukuan)
  const chart = useMemo(() => {
    const akhir = tanggalHariKerja(Math.min(period.to, Date.now()));
    const awalData = Array.from(st.byDay.keys()).sort()[0] || akhir;
    const endD = dariYmd(akhir)!;
    const startD = dariYmd(period.dari || awalData)!;
    const days = Math.round((endD.getTime() - startD.getTime()) / 86400000) + 1;
    if (days <= 62) {
      const out: { label: string; full: string; omzet: number; nota: number }[] = [];
      const d = new Date(startD);
      for (let i = 0; i < days; i++) {
        const key = toLocalYmd(d);
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
  }, [st.byDay, period.dari, period.to]);
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
  // Riwayat = nota dibuat di periode + nota DP (dibuat sebelumnya) yang dilunasi di periode, terbaru dulu
  const riwayat = useMemo(() => {
    const aktivitas = (s: PosSale) => Math.max(s.ts, Number(s.lunasTs) || 0);
    const daftar = gabungNota(inPeriod, cur).sort((a, b) => aktivitas(b) - aktivitas(a));
    return !q
      ? daftar
      : daftar.filter((s) =>
          [s.noNota, s.pembeli, s.pembeliWa, s.kasirNama, ...(s.items || []).map((i) => i.nama)].some((v) => String(v || "").toLowerCase().includes(q))
        );
  }, [inPeriod, cur, q]);

  const tema = useTemaGrafik();
  const totalKotor = st.omzet + st.diskon;

  return (
    <div className="space-y-3">
      <FilterComp
        mode={props.mode} setMode={props.setMode} month={props.month} setMonth={props.setMonth}
        rangeStart={props.rangeStart} setRangeStart={props.setRangeStart} rangeEnd={props.rangeEnd} setRangeEnd={props.setRangeEnd}
      />

      {error && <Notice tone="negative">Gagal memuat transaksi POS: {error}</Notice>}

      {/* HASIL USAHA: uang masuk vs keluar */}
      <HeroArus
        eyebrow={`Usaha · ${period.label}`}
        eyebrowIcon={<Store />}
        net={uang.selisih}
        masuk={uang.masuk}
        keluar={uang.keluar}
        loading={loading}
        masukSub="uang didapat"
        keluarSub="uang dikeluarkan"
      >
        <LineList className="mt-3 border-t border-sep">
          <LineItem dot={MARK.masuk} label="Penjualan POS" note={`${st.nota} nota`} value={rupiah(st.posOmzet)} muted={st.posOmzet === 0} />
          {st.manualOmzet > 0 && <LineItem dot={MARK.masuk} label="Rincian pembukuan" note={`${st.manualN} input admin`} value={rupiah(st.manualOmzet)} />}
          {dp.berjalan > 0 && <LineItem dot={MARK.masuk} label="DP belum lunas" note={`${dp.berjalanN} nota · sisa ${rpShort(dp.sisa)}`} value={rupiah(dp.berjalan)} />}
          {dp.hangus > 0 && <LineItem dot={MARK.masuk} label="DP hangus" note={`${dp.hangusN} nota batal`} value={rupiah(dp.hangus)} />}
          <LineItem dot={MARK.masuk} label="Pemasukan lain" note="modal dll." value={rupiah(uang.lain)} muted={uang.lain === 0} />
          <LineItem dot={MARK.keluar} label="Belanja stok" value={`${uang.belanjaStok > 0 ? "−" : ""}${rupiah(uang.belanjaStok)}`} muted={uang.belanjaStok === 0} />
          {uang.tukar > 0 && <LineItem dot={MARK.keluar} label="Barang tukar tambah" note={`${st.tukarN} nota · potongan harga`} value={`−${rupiah(uang.tukar)}`} />}
          <LineItem dot={MARK.keluar} label="Biaya operasional" value={`${uang.operasional > 0 ? "−" : ""}${rupiah(uang.operasional)}`} muted={uang.operasional === 0} />
        </LineList>
        {growth !== null && !loading && (
          <div className="mt-3 flex items-center gap-2 border-t border-sep pt-3 text-footnote text-label-2">
            <Pill tone={growth >= 0 ? "positive" : "negative"} icon={growth >= 0 ? <TrendingUp /> : <TrendingDown />}>
              {growth >= 0 ? "+" : "−"}{persen(Math.abs(growth))}
            </Pill>
            <span className="min-w-0">
              Penjualan {growth >= 0 ? "naik" : "turun"} dari periode sebelumnya ({rupiah(prevOmzet)})
            </span>
          </div>
        )}
      </HeroArus>

      {/* LABA & MARGIN */}
      {(adaData || uang.keluar > 0) && (
        <>
          <SectionHeader title="Laba" />
          <Card title="Laba & margin" subtitle="Sesudah modal barang & biaya operasional" icon={<Coins />} iconColor="green">
            <div className="grid grid-cols-2 gap-2">
              {[
                { l: "Laba kotor", v: untung.kotor, m: untung.marginKotor, s: "penjualan − modal" },
                { l: "Laba bersih", v: untung.bersih, m: untung.marginBersih, s: "laba kotor − biaya" },
              ].map((x) => (
                <StatTile
                  key={x.l}
                  label={x.l}
                  value={<Amount value={x.v} tone="auto" size="headline" fitAt={13} />}
                  sub={
                    <span className="inline-flex items-center gap-1.5">
                      <b className="font-semibold tabular-nums text-label">{untung.terhitung > 0 ? persen(x.m) : "–"}</b> margin
                    </span>
                  }
                />
              ))}
            </div>

            {untung.terhitung > 0 && (
              <div className="mt-4">
                <SplitBar
                  ariaLabel="Proporsi penjualan: modal barang, biaya, laba bersih"
                  total={Math.max(untung.terhitung, laba.hpp + uang.operasional)}
                  segments={[
                    { key: "modal", label: "Modal barang", value: laba.hpp, color: tema.modal, note: persen((laba.hpp / untung.terhitung) * 100) },
                    { key: "biaya", label: "Biaya", value: uang.operasional, color: MARK.keluar, note: persen((uang.operasional / untung.terhitung) * 100) },
                    { key: "laba", label: "Laba bersih", value: Math.max(0, untung.bersih), color: MARK.masuk, note: persen((Math.max(0, untung.bersih) / untung.terhitung) * 100) },
                  ]}
                />
                <p className="mt-2.5 text-footnote text-label-2">
                  {untung.bersih >= 0 ? (
                    <>
                      Dari setiap <b className="font-semibold text-label">Rp 100.000</b> penjualan: {per100(laba.hpp, untung.terhitung)} modal barang, {per100(uang.operasional, untung.terhitung)} biaya,{" "}
                      <b className="font-semibold text-positive">{per100(untung.bersih, untung.terhitung)} untung</b>.
                    </>
                  ) : (
                    <>
                      Modal barang & biaya lebih besar dari penjualan — usaha <b className="font-semibold text-negative">rugi {rupiah(-untung.bersih)}</b> di periode ini.
                    </>
                  )}
                </p>
              </div>
            )}

            <LineList className="mt-3 border-t border-sep">
              <LineItem
                label="Penjualan"
                note={[laba.penjualanTanpaModal > 0 && "di luar barang tanpa harga modal", dp.hangus > 0 && "termasuk DP hangus"].filter(Boolean).join(" · ") || undefined}
                value={rupiah(untung.terhitung)}
              />
              <LineItem label="Modal barang terjual" value={`−${rupiah(laba.hpp)}`} />
              <LineItem label="Laba kotor" total value={<Amount value={untung.kotor} tone="auto" className="font-bold" />} />
              <LineItem label="Biaya operasional usaha" value={`−${rupiah(uang.operasional)}`} />
              <LineItem label="Laba bersih" total value={<Amount value={untung.bersih} tone="auto" className="font-bold" />} />
            </LineList>

            {laba.penjualan > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["BARU", "SEKEN"] as const).map((k) => (
                  <StatTile
                    key={k}
                    label={k === "BARU" ? "Barang baru" : "Barang seken"}
                    value={<TileValue>{rpShort(laba.perKondisi[k].penjualan)}</TileValue>}
                    sub={<>{laba.perKondisi[k].qty} terjual · laba <b className="font-semibold text-label">{rpShort(laba.perKondisi[k].laba)}</b></>}
                  />
                ))}
              </div>
            )}
            {laba.qtyTanpa > 0 && (
              <Notice tone="warning" className="mt-3">
                {laba.qtyTanpa} barang terjual ({rupiah(laba.penjualanTanpaModal)}) belum punya harga modal / tidak dikenali, tidak ikut dihitung laba. Isi di Owner › Input › Atur Stok.
              </Notice>
            )}
            {laba.perkiraan > 0 && (
              <p className="mt-2.5 text-caption text-label-2">
                {laba.perkiraan} barang memakai perkiraan harga modal (modal diisi sesudah transaksi, atau barang dari pembukuan harian memakai harga modal sekarang).
              </p>
            )}
            <p className="mt-2.5 text-caption leading-relaxed text-label-2">
              Laba kotor = penjualan − modal barang yang terjual (isi game, HEN & servis dihitung tanpa modal barang). Laba bersih = laba kotor − biaya operasional usaha. Belanja stok adalah uang keluar, tetapi baru menjadi modal saat barangnya terjual.
            </p>
          </Card>
        </>
      )}

      {!loading && !adaData ? (
        <EmptyState icon={<Receipt />} title="Belum ada penjualan di periode ini">
          Penjualan tercatat otomatis dari nota POS (Selesaikan &amp; Cetak Nota) dan dari Rincian Pemasukan Usaha di pembukuan harian.
        </EmptyState>
      ) : (
        <>
          <SectionHeader title="Penjualan" />
          {/* Ringkasan penjualan */}
          <Card title="Ringkasan" accessory={<span className="tabular-nums">{st.transaksi} transaksi</span>}>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Tunai" dot={MARK.tunai} value={<TileValue>{rpShort(st.cash)}</TileValue>} sub={`${st.cashN} transaksi`} />
              <StatTile label="Transfer / QRIS" dot={MARK.transfer} value={<TileValue>{rpShort(st.transfer)}</TileValue>} sub={`${st.transferN} transaksi`} />
              <StatTile label="Diskon promo" icon={<BadgePercent />} value={<TileValue>{rpShort(st.diskon)}</TileValue>} sub={totalKotor > 0 ? `${persen((st.diskon / totalKotor) * 100)} dari harga normal` : "tidak ada"} />
              <StatTile
                label="Nego kasir"
                icon={<Handshake />}
                value={<TileValue>{`${st.nego < 0 ? "+" : ""}${rpShort(Math.abs(st.nego))}`}</TileValue>}
                sub={st.negoN ? `${st.negoN} nota harga diubah` : "tidak ada nego"}
              />
              <StatTile label="Rata-rata" icon={<Receipt />} value={<TileValue>{rpShort(st.avg)}</TileValue>} sub={st.manualN ? `${st.nota} nota · ${st.manualN} pembukuan` : `${st.nota} nota · ${st.qty} barang`} />
              <StatTile label="Nota batal" icon={<Ban />} value={<TileValue>{batalCount}</TileValue>} sub="tidak dihitung" />
            </div>
          </Card>

          {/* Grafik omzet */}
          <Card
            title={chart.mode === "hari" ? "Omzet per hari" : "Omzet per bulan"}
            subtitle={bestDay && bestDay.omzet > 0 ? `Tertinggi ${bestDay.full} · ${rpShort(bestDay.omzet)}` : "Belum ada penjualan"}
          >
            <div className="-ml-2 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tema.grid} />
                  <XAxis dataKey="label" {...sumbu(tema.tick)} interval="preserveStartEnd" minTickGap={6} />
                  <YAxis {...sumbu(tema.tick)} tickFormatter={(v) => rpShort(Number(v))} width={44} />
                  <Tooltip
                    cursor={{ fill: tema.cursor }}
                    content={({ active, payload }: any) =>
                      active && payload?.length ? (
                        <ChartTip title={payload[0].payload.full} rows={[{ color: MARK.masuk, label: "Omzet", value: rupiah(payload[0].payload.omzet) }, { label: "Transaksi", value: `${payload[0].payload.nota}` }]} />
                      ) : null
                    }
                  />
                  <Bar dataKey="omzet" fill={MARK.masuk} radius={[4, 4, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Perlu restock */}
          {restock.length > 0 && (
            <Card title="Laku & stok menipis" icon={<AlertTriangle />} iconColor="orange" accessory={`${restock.length} barang`} flush>
              {restock.slice(0, 8).map((r) => (
                <div key={kunciStok(r.ref)} className="group/row flex items-center gap-3 pl-4 pr-4">
                  <div className="flex min-h-[52px] min-w-0 flex-1 items-center justify-between gap-3 border-b border-sep py-2 group-last/row:border-b-0">
                    <div className="min-w-0">
                      <div className="truncate text-subhead font-medium text-label">{r.ref.item}</div>
                      <div className="truncate text-caption text-label-2">{r.ref.kategori} · terjual {r.terjual}</div>
                    </div>
                    <Pill tone={r.status === "habis" ? "negative" : "warning"}>{r.status === "habis" ? "Habis" : `Sisa ${r.sisa}`}</Pill>
                  </div>
                </div>
              ))}
              <p className="px-4 pb-3.5 pt-1 text-caption text-label-2">Atur batas minimum & restock di menu Stok.</p>
            </Card>
          )}

          {/* Kategori */}
          <Card title="Omzet per kategori" accessory="sebelum diskon">
            <div className="space-y-3.5">
              {cats.map((c) => (
                <BarRow key={c.label} label={c.label} value={rpShort(c.omzet)} fraction={c.omzet / Math.max(1, cats[0]?.omzet || 1)} color={tema.tint} sub={`${c.qty} terjual · ${persen((c.omzet / Math.max(1, totalKotor)) * 100)}`} />
              ))}
            </div>
          </Card>

          {/* Produk terlaris */}
          <Card
            title="Produk terlaris"
            accessory={
              <SubTabs
                size="sm"
                ariaLabel="Urutkan produk"
                value={produkSort}
                onChange={setProdukSort}
                options={[{ key: "qty", label: "Jumlah" }, { key: "omzet", label: "Omzet" }]}
              />
            }
          >
            <div className="space-y-3.5">
              {produk.map((x, i) => (
                <BarRow
                  key={x.nama}
                  rank={i + 1}
                  label={x.nama}
                  value={produkSort === "qty" ? `${x.qty}×` : rpShort(x.omzet)}
                  fraction={produkSort === "qty" ? x.qty / Math.max(1, produk[0]?.qty || 1) : x.omzet / Math.max(1, produk[0]?.omzet || 1)}
                  color={i < 3 ? tema.tint : tema.netral}
                  sub={`${x.kategori} · ${produkSort === "qty" ? rupiah(x.omzet) : `${x.qty} terjual`}${laba.perProduk.has(x.nama) ? ` · laba ${rpShort(laba.perProduk.get(x.nama)!)}` : ""}`}
                />
              ))}
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Kasir */}
            <Card title="Per kasir" icon={<Users />} iconColor="purple">
              <div className="space-y-3.5">
                {kasir.map((k) => (
                  <BarRow key={k.nama} label={k.nama} value={rpShort(k.omzet)} fraction={k.omzet / Math.max(1, kasir[0]?.omzet || 1)} color={tema.tint} sub={`${k.nota} nota`} />
                ))}
              </div>
            </Card>

            {/* Jam ramai */}
            <Card className="flex flex-col" title="Jam ramai" icon={<Clock />} iconColor="orange" accessory={jamRamai ? <>Puncak <b className="font-semibold text-label">{jamRamai.label}.00</b></> : null}>
              <div className="-ml-2 min-h-[150px] flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jam} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
                    <XAxis dataKey="label" {...sumbu(tema.tick)} interval={0} />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: tema.cursor }}
                      content={({ active, payload }: any) =>
                        active && payload?.length ? (
                          <ChartTip title={`Jam ${payload[0].payload.label}.00`} rows={[{ color: tema.tint, label: "Nota", value: `${payload[0].payload.nota}` }, { label: "Omzet", value: rupiah(payload[0].payload.omzet || 0) }]} />
                        ) : null
                      }
                    />
                    <Bar dataKey="nota" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {jam.map((h, i) => (
                        <Cell key={i} fill={tema.tint} fillOpacity={jamRamai && h.nota >= jamRamai.nota * 0.8 ? 1 : 0.35} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Riwayat nota */}
      <SectionHeader title="Nota" />
      <Card title="Riwayat nota" accessory={<span className="tabular-nums">{riwayat.length} nota</span>} flush>
        <div className="px-4 pb-2">
          <SearchField value={cari} onChange={(v) => { setCari(v); setShowN(20); }} placeholder="Cari no. nota, pembeli, barang…" />
        </div>
        {riwayat.length === 0 ? (
          <div className="px-4 pb-6 pt-4 text-center text-footnote text-label-2">{loading ? "Memuat…" : "Tidak ada nota."}</div>
        ) : (
          <div>
            {riwayat.slice(0, showN).map((s) => (
              <button
                key={s.id || s.noNota}
                type="button"
                onClick={() => setSelected(s)}
                className="group/row flex w-full items-center gap-3 pl-4 pr-3 text-left transition-colors active:bg-fill"
              >
                <IconBadge color={s.batal ? "gray" : s.metode === "TRANSFER" ? "blue" : "teal"}>{s.batal ? <Ban /> : <Receipt />}</IconBadge>
                <div className="flex min-h-[58px] min-w-0 flex-1 items-center gap-3 border-b border-sep py-2.5 group-last/row:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className={`truncate text-subhead font-semibold ${s.batal ? "text-label-3 line-through" : "text-label"}`}>{s.pembeli || "Pelanggan"}</span>
                      {s.batal && <Pill>{s.status === "BATAL_PEMBELI" ? "DP hangus" : s.status === "BATAL_URBAN" ? "DP kembali" : "Batal"}</Pill>}
                      {isDpTerbuka(s) && <Pill tone="warning">Belum lunas</Pill>}
                      {!s.batal && s.lunasTs && <Pill tone="positive">DP · lunas</Pill>}
                      {!s.batal && infoNego(s).ada && <Pill tone="tint">Nego</Pill>}
                    </div>
                    <div className="truncate text-caption text-label-2">
                      {s.noNota} · {new Date(s.ts).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {(s.items || []).reduce((a, i) => a + i.qty, 0)} barang
                    </div>
                  </div>
                  <span className={`shrink-0 text-subhead font-semibold tabular-nums ${s.batal ? "text-label-3 line-through" : "text-label"}`}>{rpShort(s.total)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-label-3" aria-hidden />
                </div>
              </button>
            ))}
          </div>
        )}
        {riwayat.length > showN && (
          <div className="border-t border-sep p-3">
            <Button variant="gray" block onClick={() => setShowN((n) => n + 30)}>
              Tampilkan lebih banyak ({riwayat.length - showN})
            </Button>
          </div>
        )}
      </Card>

      <NotaDetailSheet sale={selected} live={semua.find((s) => s.id && s.id === selected?.id) || selected} onClose={() => setSelected(null)} />
    </div>
  );
}

// ============================================================
// Detail nota: cetak ulang / unduh / kirim / batalkan
// ============================================================
const NotaDetailSheet: React.FC<{ sale: PosSale | null; live: PosSale | null; onClose: () => void }> = ({ sale, live, onClose }) => {
  useBodyScrollLock(!!sale);
  const actions = useNotaActions(live);
  const [busy, setBusy] = useState<"" | "batal" | "hapus">("");
  const [batalDp, setBatalDp] = useState(false);
  useEffect(() => { setBatalDp(false); }, [sale?.id]);
  if (!sale || !live) return null;
  const notaDp = isDpTerbuka(live);
  const batalPakaiDp = live.status === "BATAL_PEMBELI" || live.status === "BATAL_URBAN";

  const hapus = async () => {
    const ok = window.confirm(
      `Hapus permanen nota ${live.noNota}?\n\n` +
        (live.batal || notaDp ? "" : "• Stok barang yang terpotong akan dikembalikan.\n") +
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
          {notaDp && batalDp && (
            <BatalDp sale={live} onKembali={() => setBatalDp(false)} onSelesai={() => { setBatalDp(false); actions.setMsg("Nota DP dibatalkan ✅"); }} />
          )}
          {live.batal && (
            <div className="rounded-2xl bg-zinc-200/70 dark:bg-zinc-800 p-3 text-[12.5px] text-zinc-700 dark:text-zinc-300">
              <b>{live.status === "BATAL_PEMBELI" ? "Dibatalkan pembeli · DP hangus" : live.status === "BATAL_URBAN" ? "Dibatalkan URBAN · DP dikembalikan" : "Nota dibatalkan"}</b>{live.batalOleh ? ` oleh ${live.batalOleh.split("@")[0]}` : ""}{live.batalTs ? ` · ${new Date(live.batalTs).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
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
          <div className={`rounded-[22px] bg-zinc-200/60 dark:bg-black/40 p-3 ${live.batal && !batalPakaiDp ? "opacity-60" : ""}`}>
            <NotaPreview sale={live} />
          </div>
        </div>
        <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-white dark:bg-[#1c1c1e] border-t border-zinc-200/70 dark:border-white/5 space-y-2">
          {(!live.batal || batalPakaiDp) && <NotaActionButtons sale={live} actions={actions} />}
          <div className={`grid gap-2 ${live.batal ? "grid-cols-1" : "grid-cols-[1fr_auto]"}`}>
            {!live.batal && (
              <button type="button" disabled={!!busy || (notaDp && batalDp)} onClick={notaDp ? () => setBatalDp(true) : batalkan} className="h-11 rounded-xl text-[13px] font-bold text-red-600 bg-red-50 dark:bg-red-500/10 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {busy === "batal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}{notaDp ? "Batalkan nota DP" : "Batalkan & kembalikan stok"}
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
