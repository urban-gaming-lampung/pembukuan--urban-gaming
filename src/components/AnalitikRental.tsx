import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell } from "recharts";
import { BarChart3, Clock, Gamepad2, Sparkles, Target, Wallet } from "lucide-react";
import FilterComp from "./Filter";
import type { HistoryItem } from "../lib/types";
import { pemasukanRental, periodRange } from "../lib/keuangan";
import { TARGET_HARIAN } from "../lib/laporan";
import { persen, rpShort, rupiah } from "../lib/format";
import { dariYmd, tanggalHariKerja, toLocalYmd } from "../lib/dateLocal";
import {
  BarRow, Card, ChartTip, EmptyState, Footnote, IconBadge, Legend, LineItem, LineList, MARK, Meter, Pill, SectionHeader, SplitBar, StatTile, TileValue, sumbu, useTemaGrafik,
  type Nada, type WarnaIkon,
} from "../ui";
import { HeroArus } from "./analitik/HeroArus";

/** Satu rekomendasi otomatis (dihitung di PageOwner dari angka yang sama). */
export type RekomendasiRental = {
  id: string;
  type: "financial_health" | "asset_optimization" | "peak_strategy";
  severity: "critical" | "warning" | "success" | "info";
  title: string;
  body: string;
  metric?: string;
};

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
  /** Pendapatan kotor rental (harian + jajanan + sewa) */
  masuk: number;
  /** Pengeluaran admin (pembukuan harian) + owner bertanda Rental */
  keluar: number;
  keluarAdmin: number;
  keluarOwner: number;
  /** Rincian pemasukan per kategori (sama dengan lembar Rincian Pendapatan) */
  pemasukanKategori: { name: string; value: number }[];
  /** Rincian pengeluaran per kategori (sama dengan lembar Rincian Pengeluaran) */
  pengeluaranKategori: { name: string; value: number }[];
  tunai: number;
  transfer: number;
  /** unitDihitung = unit PS yang dipakai menghitung kapasitas (master unit, atau 10 bila belum diisi) */
  utilisasi: { percentage: number; totalUsedHours: number; maxCapacityHours: number; totalMachines: number; unitDihitung: number; hariDihitung: number };
  unitLaris: { unit: string; revenue: number; count: number }[];
  jamRamai: { hour: string; count: number; revenue: number }[];
  rekomendasi: RekomendasiRental[];
  /** Buka lembar rincian (kategori opsional langsung terpilih) */
  onBukaPemasukan: (kategori?: string) => void;
  onBukaPengeluaran: (kategori?: string) => void;
};

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const GAYA_REKOMENDASI: Record<RekomendasiRental["severity"], { warna: WarnaIkon; nada: Nada }> = {
  critical: { warna: "red", nada: "negative" },
  warning: { warna: "orange", nada: "warning" },
  success: { warna: "green", nada: "positive" },
  info: { warna: "blue", nada: "tint" },
};
const IKON_REKOMENDASI: Record<RekomendasiRental["type"], { icon: React.ReactNode; label: string }> = {
  financial_health: { icon: <Wallet />, label: "Keuangan" },
  asset_optimization: { icon: <Target />, label: "Pemakaian unit" },
  peak_strategy: { icon: <Clock />, label: "Jam ramai" },
};
/** Judul rekomendasi tanpa emoji di depan (ikon sudah mewakili). */
const tanpaEmoji = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

type TitikHari = { label: string; full: string; total: number; capai: boolean };

const TipHari: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as TitikHari;
  return <ChartTip title={p.full} rows={[{ color: MARK.masuk, label: "Pemasukan", value: rupiah(p.total) }]} />;
};

/**
 * ANALITIK RENTAL — urutan: periode → hasil (masuk / keluar / cara bayar) → pemasukan harian vs target
 * → pengeluaran per kategori → unit & jam ramai → rekomendasi. Angka dihitung di PageOwner (tidak berubah).
 */
export default function AnalitikRental(p: Props) {
  const tema = useTemaGrafik();
  const hariKerja = tanggalHariKerja();
  const period = useMemo(() => periodRange(p.mode, p.month, p.rangeStart, p.rangeEnd), [p.mode, p.month, p.rangeStart, p.rangeEnd, hariKerja]);
  const net = p.masuk - p.keluar;
  const sumKategori = p.pemasukanKategori.reduce((a, x) => a + x.value, 0);
  const tanpaRincian = p.masuk - sumKategori;
  const hariTercatat = useMemo(() => new Set(p.filteredHistory.map((h) => h.tanggal)).size, [p.filteredHistory]);

  // Pemasukan rental per hari kerja (<= 62 hari) atau per bulan
  const grafik = useMemo(() => {
    const perHari = new Map<string, number>();
    p.filteredHistory.forEach((h) => {
      const k = String(h.tanggal || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      perHari.set(k, (perHari.get(k) || 0) + pemasukanRental(h));
    });
    const keys = Array.from(perHari.keys()).sort();
    const akhir = tanggalHariKerja(Math.min(period.to, Date.now()));
    const a = dariYmd(period.dari || keys[0] || akhir)!;
    const b = dariYmd(akhir)!;
    const days = Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000) + 1);
    const terisi = Array.from(perHari.values()).filter((v) => v > 0);
    const total = terisi.reduce((s, v) => s + v, 0);
    const rata = terisi.length ? total / terisi.length : 0;
    const capai = terisi.filter((v) => v >= TARGET_HARIAN).length;
    let terbaik: { tgl: string; v: number } | null = null;
    perHari.forEach((v, k) => { if (v > 0 && (!terbaik || v > terbaik.v)) terbaik = { tgl: k, v }; });
    const fmt = (ymd: string) => dariYmd(ymd)!.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
    if (days <= 62) {
      const data: TitikHari[] = [];
      const c = new Date(a);
      for (let i = 0; i < days; i++) {
        const k = toLocalYmd(c);
        const v = perHari.get(k) || 0;
        data.push({ label: String(c.getDate()), full: fmt(k), total: v, capai: v >= TARGET_HARIAN });
        c.setDate(c.getDate() + 1);
      }
      return { per: "hari" as const, data, rata, capai, terisi: terisi.length, terbaik: terbaik as { tgl: string; v: number } | null, fmt };
    }
    const bulan = new Map<string, number>();
    perHari.forEach((v, k) => bulan.set(k.slice(0, 7), (bulan.get(k.slice(0, 7)) || 0) + v));
    const data: TitikHari[] = Array.from(bulan.entries())
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([k, v]) => {
        const [y, m] = k.split("-").map(Number);
        return { label: BULAN[m - 1].slice(0, 3), full: `${BULAN[m - 1]} ${y}`, total: v, capai: true };
      });
    return { per: "bulan" as const, data, rata, capai, terisi: terisi.length, terbaik: terbaik as { tgl: string; v: number } | null, fmt };
  }, [p.filteredHistory, period.dari, period.to]);

  const totalKeluarKategori = p.pengeluaranKategori.reduce((a, x) => a + x.value, 0);
  const maxJam = Math.max(0, ...p.jamRamai.map((h) => h.count));
  const puncak = p.jamRamai.reduce((b, x) => (x.count > (b?.count || 0) ? x : b), null as null | Props["jamRamai"][number]);
  const kosong = p.masuk === 0 && p.keluar === 0 && p.filteredHistory.length === 0;

  return (
    <div className="space-y-3">
      <FilterComp mode={p.mode} setMode={p.setMode} month={p.month} setMonth={p.setMonth} rangeStart={p.rangeStart} setRangeStart={p.setRangeStart} rangeEnd={p.rangeEnd} setRangeEnd={p.setRangeEnd} />

      {/* HASIL RENTAL */}
      <HeroArus
        eyebrow={`Rental · ${period.label}`}
        eyebrowIcon={<Gamepad2 />}
        net={net}
        masuk={p.masuk}
        keluar={p.keluar}
        masukSub="pendapatan kotor"
        keluarSub="admin + owner"
        onMasuk={() => p.onBukaPemasukan()}
        onKeluar={() => p.onBukaPengeluaran()}
        kalimat={
          kosong
            ? "Belum ada pembukuan rental di periode ini."
            : net >= 0
            ? <>Laba bersih rental {rupiah(net)} dari {hariTercatat} hari tercatat.</>
            : <>Pengeluaran rental melebihi pendapatan sebesar {rupiah(-net)}.</>
        }
      >
        {(p.masuk > 0 || p.keluar > 0) && (
          <LineList className="mt-3 border-t border-sep">
            {p.pemasukanKategori.map((x) => (
              <LineItem key={x.name} dot={MARK.masuk} label={x.name} value={rupiah(x.value)} onClick={() => p.onBukaPemasukan(x.name)} />
            ))}
            {tanpaRincian !== 0 && <LineItem dot={MARK.masuk} label="Tanpa rincian" note="total pembukuan" value={rupiah(tanpaRincian)} />}
            <LineItem dot={MARK.keluar} label="Pengeluaran admin" value={`${p.keluarAdmin > 0 ? "−" : ""}${rupiah(p.keluarAdmin)}`} muted={p.keluarAdmin === 0} onClick={() => p.onBukaPengeluaran()} />
            <LineItem dot={MARK.keluar} label="Pengeluaran owner" value={`${p.keluarOwner > 0 ? "−" : ""}${rupiah(p.keluarOwner)}`} muted={p.keluarOwner === 0} onClick={() => p.onBukaPengeluaran()} />
          </LineList>
        )}
        {p.tunai + p.transfer > 0 && (
          <div className="mt-3 border-t border-sep pt-3">
            <div className="mb-2 flex items-center justify-between text-caption text-label-2">
              <span className="font-medium">Cara bayar</span>
              <span>{hariTercatat} hari tercatat</span>
            </div>
            <SplitBar
              ariaLabel="Pembayaran tunai dan transfer"
              segments={[
                { key: "tunai", label: "Tunai", value: p.tunai, color: MARK.tunai, note: rupiah(p.tunai) },
                { key: "tf", label: "Transfer", value: p.transfer, color: MARK.transfer, note: rupiah(p.transfer) },
              ]}
            />
          </div>
        )}
      </HeroArus>

      {kosong ? (
        <EmptyState icon={<BarChart3 />} title="Belum ada pembukuan di periode ini">
          Pembukuan harian rental dan pengeluaran owner bertanda Rental otomatis terhitung di sini.
        </EmptyState>
      ) : (
        <>
          {/* PEMASUKAN HARIAN vs TARGET */}
          <SectionHeader title="Pemasukan" />
          <Card
            title={grafik.per === "hari" ? "Pemasukan per hari" : "Pemasukan per bulan"}
            subtitle={grafik.per === "hari" ? `Target ${rupiah(TARGET_HARIAN)} / hari` : "Total per bulan"}
            accessory={
              grafik.per === "hari" ? (
                <Legend items={[{ color: MARK.masuk, label: "Capai" }, { color: tema.netral, label: "Belum" }]} />
              ) : undefined
            }
          >
            <div className="-ml-2 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafik.data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={tema.grid} />
                  <XAxis dataKey="label" {...sumbu(tema.tick)} interval="preserveStartEnd" minTickGap={6} />
                  <YAxis {...sumbu(tema.tick)} tickFormatter={(v) => rpShort(Number(v))} width={44} />
                  <Tooltip cursor={{ fill: tema.cursor }} content={<TipHari />} />
                  {grafik.per === "hari" && (
                    <ReferenceLine y={TARGET_HARIAN} stroke={tema.axis} strokeDasharray="4 3" ifOverflow="extendDomain" label={{ value: "Target", position: "insideTopLeft", fill: tema.tick, fontSize: 10 }} />
                  )}
                  <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={22}>
                    {grafik.data.map((x, i) => (
                      <Cell key={i} fill={x.capai ? MARK.masuk : tema.netral} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <StatTile label="Rata-rata" value={<TileValue>{rpShort(grafik.rata)}</TileValue>} sub="per hari terisi" />
              <StatTile label="Capai target" value={<TileValue tone={grafik.capai > 0 ? "positive" : "neutral"}>{grafik.capai}<span className="text-footnote font-medium text-label-2"> / {grafik.terisi}</span></TileValue>} sub="hari" />
              <StatTile label="Terbaik" value={<TileValue>{grafik.terbaik ? rpShort(grafik.terbaik.v) : "–"}</TileValue>} sub={grafik.terbaik ? grafik.fmt(grafik.terbaik.tgl) : "belum ada"} />
            </div>
          </Card>

          {/* PENGELUARAN PER KATEGORI */}
          <SectionHeader title="Pengeluaran" />
          <Card title="Per kategori" subtitle="Ketuk untuk lihat transaksinya" accessory={<span className="tabular-nums">{rupiah(p.keluar)}</span>}>
            {p.pengeluaranKategori.length === 0 ? (
              <p className="py-1 text-footnote text-label-2">Belum ada pengeluaran di periode ini.</p>
            ) : (
              <div className="space-y-3.5">
                {p.pengeluaranKategori.map((x) => (
                  <BarRow
                    key={x.name}
                    label={x.name}
                    value={rupiah(x.value)}
                    fraction={x.value / Math.max(1, p.pengeluaranKategori[0].value)}
                    color={MARK.keluar}
                    sub={persen((x.value / Math.max(1, totalKeluarKategori)) * 100)}
                    onClick={() => p.onBukaPengeluaran(x.name)}
                  />
                ))}
              </div>
            )}
          </Card>

          {/* UNIT & JAM RAMAI */}
          <SectionHeader title="Unit & jam ramai" />
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Pemakaian unit" icon={<Gamepad2 />} iconColor="blue" accessory={<span className="tabular-nums">{p.utilisasi.unitDihitung} unit</span>}>
              <div className="flex items-baseline gap-1">
                <span className="text-title1 tabular-nums text-label">{p.utilisasi.percentage}</span>
                <span className="text-headline text-label-2">%</span>
              </div>
              <Meter className="mt-2" fraction={p.utilisasi.percentage / 100} color={tema.tint} marker={0.8} label="Tingkat pemakaian unit" />
              <p className="mt-2 text-footnote text-label-2">
                Dipakai ±<b className="font-semibold text-label tabular-nums">{p.utilisasi.totalUsedHours.toLocaleString("id-ID")}</b> jam dari kapasitas{" "}
                <b className="font-semibold text-label tabular-nums">{p.utilisasi.maxCapacityHours.toLocaleString("id-ID")}</b> jam. Garis = target 80%.
              </p>
              <p className="mt-0.5 text-caption text-label-2">Perkiraan: {p.utilisasi.unitDihitung} unit PS × 14 jam × {p.utilisasi.hariDihitung} hari tercatat{p.utilisasi.totalMachines === 0 ? " (jumlah unit belum diisi di Master Inventaris, dipakai 10)" : ""}.</p>

              <div className="mt-4 border-t border-sep pt-3">
                <div className="mb-2.5 text-footnote font-medium text-label-2">Unit paling laris</div>
                {p.unitLaris.length === 0 ? (
                  <p className="text-footnote text-label-2">Belum ada sewa di periode ini.</p>
                ) : (
                  <div className="space-y-3">
                    {p.unitLaris.map((u, i) => (
                      <BarRow key={u.unit} rank={i + 1} label={u.unit} value={rupiah(u.revenue)} fraction={u.revenue / Math.max(1, p.unitLaris[0].revenue)} color={tema.tint} sub={`${u.count}× sewa`} />
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card title="Jam ramai" icon={<Clock />} iconColor="orange" accessory={puncak && puncak.count > 0 ? <>Puncak <b className="font-semibold text-label">{puncak.hour.replace(":00", ".00")}</b></> : undefined}>
              {maxJam > 0 ? (
                <div className="-ml-2 h-[170px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={p.jamRamai} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
                      <XAxis dataKey="hour" {...sumbu(tema.tick)} tickFormatter={(v) => String(v).slice(0, 2)} interval={0} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: tema.cursor }}
                        content={({ active, payload }: any) =>
                          active && payload?.length ? (
                            <ChartTip title={`Jam ${String(payload[0].payload.hour).replace(":00", ".00")}`} rows={[{ color: tema.tint, label: "Transaksi", value: `${payload[0].payload.count}×` }, { label: "Pemasukan", value: rupiah(payload[0].payload.revenue) }]} />
                          ) : null
                        }
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={22}>
                        {p.jamRamai.map((h, i) => (
                          <Cell key={i} fill={tema.tint} fillOpacity={h.count >= maxJam * 0.8 ? 1 : 0.35} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-6 text-center text-footnote text-label-2">Belum ada jam masuk tercatat.</p>
              )}
              <p className="mt-2 text-caption text-label-2">Dari jam masuk pemasukan harian & sewa. Batang tegas = jam tersibuk.</p>
            </Card>
          </div>

          {/* REKOMENDASI OTOMATIS */}
          {p.rekomendasi.length > 0 && (
            <>
              <SectionHeader title="Rekomendasi" accessory={<span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" />otomatis</span>} />
              <Card flush>
                {p.rekomendasi.map((r) => {
                  const g = GAYA_REKOMENDASI[r.severity];
                  const t = IKON_REKOMENDASI[r.type];
                  return (
                    <div key={r.id} className="group/row flex gap-3 pl-4 pr-4">
                      <IconBadge color={g.warna} className="mt-3.5">{t.icon}</IconBadge>
                      <div className="min-w-0 flex-1 border-b border-sep py-3.5 group-last/row:border-b-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-caption font-medium text-label-2">{t.label}</div>
                            <div className="text-subhead font-semibold text-label">{tanpaEmoji(r.title)}</div>
                          </div>
                          {r.metric && <Pill tone={g.nada} className="mt-0.5 tabular-nums">{r.metric.replace(/^-/, "\u2212")}</Pill>}
                        </div>
                        <p className="mt-1 text-footnote text-label-2">{r.body}</p>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </>
          )}

          <Footnote className="pt-1">
            Pendapatan rental = pemasukan harian + jajanan + sewa PS (ongkir sewa termasuk; biaya antarnya tercatat di pengeluaran). Rincian pemasukan usaha (isi game, servis, aksesoris) dihitung di Analitik › Usaha.
          </Footnote>
        </>
      )}
    </div>
  );
}
