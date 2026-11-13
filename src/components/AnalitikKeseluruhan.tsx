import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { Gamepad2, Store, BarChart3, Layers } from "lucide-react";
import FilterComp from "./Filter";
import { dpHangus, gabungNota, isDpTerbuka, nilaiTukarNota, tanggalPenjualan, terjualDalam, totalDibayar, usePosSales, usePosSalesLunas } from "../lib/posSales";
import { Bisnis, bisnisOf, isBelanjaStok, pemasukanRental, pengeluaranAdminRental, periodRange, TransaksiOwner } from "../lib/keuangan";
import type { HistoryItem } from "../lib/types";
import { barisUsahaManual } from "../lib/pemasukanUsaha";
import { persen, rpShort, rupiah, rupiahTanda } from "../lib/format";
import { dariYmd, tanggalHariKerja, toLocalYmd } from "../lib/dateLocal";
import { Amount, BarRow, Card, ChartTip, EmptyState, Footnote, Legend, LineItem, LineList, MARK, Notice, Pill, SectionHeader, sumbu, useTemaGrafik } from "../ui";
import { HeroArus, KartuBisnis } from "./analitik/HeroArus";

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
const kunciHari = (t: string) => (/^\d{4}-\d{2}-\d{2}/.test(String(t || "")) ? String(t).slice(0, 10) : toLocalYmd(new Date(t)));
const LABEL_BISNIS: Record<Bisnis, string> = { RENTAL: "Rental", USAHA: "Usaha" };

type TitikGrafik = { label: string; full: string; masuk: number; keluar: number; keluarNeg: number; net: number };

const TipArus: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as TitikGrafik;
  return (
    <ChartTip
      title={p.full}
      rows={[
        { color: MARK.masuk, label: "Masuk", value: rupiah(p.masuk) },
        { color: MARK.keluar, label: "Keluar", value: rupiah(p.keluar) },
      ]}
      footer={{ label: "Selisih", value: rupiahTanda(p.net) }}
    />
  );
};

export default function AnalitikKeseluruhan(props: Props) {
  const { mode, month, rangeStart, rangeEnd, filteredHistory, pengeluaran, pemasukan } = props;
  const tema = useTemaGrafik();
  // Hari kerja berganti -> periode "Bulan Ini" / "7 Hari" ikut bergeser
  const hariKerja = tanggalHariKerja();
  const period = useMemo(() => periodRange(mode, month, rangeStart, rangeEnd), [mode, month, rangeStart, rangeEnd, hariKerja]);
  const { sales, loading: loadingPos, error } = usePosSales(period.from, period.to, 4000);
  // Nota DP yang dilunasi di periode ini (dibuat sebelumnya) — penjualan dihitung saat lunas
  const { sales: lunas, loading: loadingLunas } = usePosSalesLunas(period.from, period.to);
  const loading = loadingPos || loadingLunas;

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
    const u = { pos: 0, nota: 0, buku: 0, bukuN: 0, dp: 0, dpN: 0, lain: 0, stok: 0, ops: 0 };
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

    // USAHA — nota POS lunas (nota DP dihitung saat pelunasan), per hari kerja
    gabungNota(sales, lunas).forEach((s) => {
      if (!terjualDalam(s, period.from, period.to)) return;
      u.pos += s.total;
      u.nota++;
      tambah(tanggalPenjualan(s), "um", s.total);
      // Tukar tambah: barang pembeli dibayar dengan potongan nota = belanja stok di hari nota
      const tt = nilaiTukarNota(s);
      if (tt > 0) {
        u.stok += tt;
        tambah(tanggalPenjualan(s), "uk", tt);
        keluarKe("USAHA|Barang tukar tambah", "Barang tukar tambah", LABEL_BISNIS.USAHA, tt);
      }
    });
    if (u.pos) masukKe("USAHA|pos", "Penjualan POS", `Usaha · ${u.nota} nota`, u.pos);
    // DP yang sudah diterima: masih berjalan (belum lunas) atau hangus (pembeli batal)
    sales.forEach((s) => {
      if (s.ts < period.from || s.ts > period.to) return;
      const v = isDpTerbuka(s) ? totalDibayar(s) : dpHangus(s);
      if (!v) return;
      u.dp += v;
      u.dpN++;
      tambah(tanggalHariKerja(s.ts), "um", v);
    });
    if (u.dp) masukKe("USAHA|dp", "DP pembeli", `Usaha · ${u.dpN} nota belum lunas / hangus`, u.dp);
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
    const usaha = { masuk: u.pos + u.buku + u.dp + u.lain, keluar: u.stok + u.ops };
    const masuk = rental.masuk + usaha.masuk;
    const keluar = rental.keluar + usaha.keluar;
    return {
      harian, r, u, rental, usaha, masuk, keluar, net: masuk - keluar,
      sumber: Array.from(sumber.values()).sort((a, b) => b.v - a.v),
      kategori: Array.from(kategori.values()).sort((a, b) => b.v - a.v),
    };
  }, [filteredHistory, pemasukan, pengeluaran, sales, lunas, period.from, period.to]);

  // Grafik arus uang: harian (<= 62 hari) atau bulanan
  const grafik = useMemo(() => {
    const keys = Array.from(d.harian.keys()).sort();
    const akhir = tanggalHariKerja(Math.min(period.to, Date.now()));
    const a = dariYmd(period.dari || keys[0] || akhir)!;
    const b = dariYmd(akhir)!;
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
        out.push(titik(String(c.getDate()), c.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }), d.harian.get(toLocalYmd(c))));
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
  }, [d.harian, period.dari, period.to]);

  const hariSurplus = grafik.data.filter((x) => x.net > 0).length;
  const hariMinus = grafik.data.filter((x) => x.net < 0).length;
  const kosong = !loading && d.masuk === 0 && d.keluar === 0;
  // Belanja stok = uang keluar yang berubah jadi barang dagangan (bukan biaya habis pakai)
  const tanpaStok = d.net + d.u.stok;

  return (
    <div className="space-y-3">
      <FilterComp
        mode={props.mode} setMode={props.setMode} month={props.month} setMonth={props.setMonth}
        rangeStart={props.rangeStart} setRangeStart={props.setRangeStart} rangeEnd={props.rangeEnd} setRangeEnd={props.setRangeEnd}
      />

      {error && <Notice tone="negative">Gagal memuat transaksi POS: {error}</Notice>}

      {/* HASIL KESELURUHAN */}
      <HeroArus eyebrow={`Hasil · ${period.label}`} eyebrowIcon={<Layers />} net={d.net} masuk={d.masuk} keluar={d.keluar} loading={loading} rasio>
        {!loading && d.u.stok > 0 && (
          <LineList className="mt-3 border-t border-sep">
            <LineItem label="Belanja stok" note="jadi barang di toko" value={`−${rupiah(d.u.stok)}`} />
            <LineItem label="Hasil tanpa belanja stok" total value={<Amount value={tanpaStok} signed tone="auto" size="subhead" className="font-bold" />} />
          </LineList>
        )}
      </HeroArus>

      {/* PER MODEL USAHA */}
      <SectionHeader title="Per usaha" />
      <div className="grid gap-3 sm:grid-cols-2">
        <KartuBisnis
          judul="Rental"
          sub="Pembukuan harian & owner"
          icon={<Gamepad2 />}
          iconColor="blue"
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
          icon={<Store />}
          iconColor="orange"
          loading={loading}
          masuk={d.usaha.masuk}
          keluar={d.usaha.keluar}
          rows={[
            { jenis: "masuk", label: "Penjualan POS", note: `${d.u.nota} nota`, v: d.u.pos },
            { jenis: "masuk", label: "Rincian pembukuan", note: `${d.u.bukuN} input`, v: d.u.buku },
            ...(d.u.dp ? [{ jenis: "masuk" as const, label: "DP pembeli", note: `${d.u.dpN} nota`, v: d.u.dp }] : []),
            { jenis: "masuk", label: "Pemasukan lain", v: d.u.lain },
            { jenis: "keluar", label: "Belanja stok", v: d.u.stok },
            { jenis: "keluar", label: "Biaya operasional", v: d.u.ops },
          ]}
        />
      </div>

      {kosong ? (
        <EmptyState icon={<BarChart3 />} title="Belum ada transaksi di periode ini">
          Pembukuan rental, nota POS, dan transaksi di Input › Transaksi otomatis terhitung di sini.
        </EmptyState>
      ) : (
        <>
          {/* Grafik arus uang */}
          <SectionHeader title="Arus uang" />
          <Card
            title={grafik.per === "hari" ? "Per hari" : "Per bulan"}
            accessory={<Legend items={[{ color: MARK.masuk, label: "Masuk" }, { color: MARK.keluar, label: "Keluar" }]} />}
          >
            <div className="-ml-2 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafik.data} stackOffset="sign" margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tema.grid} />
                  <XAxis dataKey="label" {...sumbu(tema.tick)} interval="preserveStartEnd" minTickGap={6} />
                  <YAxis {...sumbu(tema.tick)} tickFormatter={(v) => rpShort(Math.abs(Number(v)))} width={44} />
                  <ReferenceLine y={0} stroke={tema.axis} />
                  <Tooltip cursor={{ fill: tema.cursor }} content={<TipArus />} />
                  <Bar dataKey="masuk" stackId="arus" fill={MARK.masuk} radius={[4, 4, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="keluarNeg" stackId="arus" fill={MARK.keluar} radius={[0, 0, 4, 4]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone="positive">{hariSurplus} {grafik.per} surplus</Pill>
              <Pill tone="negative">{hariMinus} {grafik.per} minus</Pill>
            </div>
          </Card>

          {/* Rincian sumber & tujuan uang */}
          <SectionHeader title="Rincian" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Card title="Dari mana uang masuk" accessory={<span className="tabular-nums">{rupiah(d.masuk)}</span>}>
              {d.sumber.length === 0 ? (
                <p className="py-1 text-footnote text-label-2">Belum ada uang masuk.</p>
              ) : (
                <div className="space-y-3.5">
                  {d.sumber.slice(0, 8).map((x) => (
                    <BarRow key={x.sub + x.label} label={x.label} value={rupiah(x.v)} fraction={x.v / Math.max(1, d.sumber[0].v)} color={MARK.masuk} sub={`${x.sub} · ${persen((x.v / Math.max(1, d.masuk)) * 100)}`} />
                  ))}
                </div>
              )}
            </Card>
            <Card title="Ke mana uang keluar" accessory={<span className="tabular-nums">{rupiah(d.keluar)}</span>}>
              {d.kategori.length === 0 ? (
                <p className="py-1 text-footnote text-label-2">Belum ada uang keluar.</p>
              ) : (
                <div className="space-y-3.5">
                  {d.kategori.slice(0, 8).map((x) => (
                    <BarRow key={x.sub + x.label} label={x.label} value={rupiah(x.v)} fraction={x.v / Math.max(1, d.kategori[0].v)} color={MARK.keluar} sub={`${x.sub} · ${persen((x.v / Math.max(1, d.keluar)) * 100)}`} />
                  ))}
                  {d.kategori.length > 8 && (
                    <p className="text-caption text-label-2">
                      +{d.kategori.length - 8} kategori lain · {rupiah(d.kategori.slice(8).reduce((s, x) => s + x.v, 0))}
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>

          <Footnote className="pt-1">
            Rental = pembukuan harian + transaksi owner bertanda Rental. Usaha = nota POS (tanpa nota batal) + transaksi owner bertanda Usaha, termasuk belanja stok dari Input › Atur Stok.
            {d.u.stok > 0 && " Belanja stok tercatat sebagai uang keluar saat dibeli, walau barangnya masih ada di toko."}
          </Footnote>
        </>
      )}
    </div>
  );
}
