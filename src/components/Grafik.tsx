import React, { useEffect, useMemo, useState } from "react";
import Section from "./common/Section";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import { HistoryItem } from "../lib/types";
import { rupiah } from "../lib/format";

// ─── UTILS ──────────────────────────────────────────
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const formatCurrencyCompact = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);

const getTotal = (h: HistoryItem) =>
  Number(h.totalHarian ?? 0) +
  Number(h.totalJajanan ?? 0) +
  Number(h.totalJasaAks ?? 0) +
  Number(h.totalSewa ?? 0);

const getBarColor = (total: number, isDark: boolean) => {
  if (total === 0) return "transparent";
  if (total < 100_000) return isDark ? "#ff453a" : "#ff3b30";
  if (total < 150_000) return isDark ? "#ffd60a" : "#ffcc00";
  if (total < 200_000) return isDark ? "#64d2ff" : "#5ac8fa";
  if (total <= 250_000) return isDark ? "#0a84ff" : "#007aff";
  return isDark ? "#30d158" : "#34c759";
};

const getGradientId = (total: number) => {
  if (total < 100_000) return "grad-red";
  if (total < 150_000) return "grad-yellow";
  if (total < 200_000) return "grad-cyan";
  if (total <= 250_000) return "grad-blue";
  return "grad-green";
};

// ─── HOOKS ──────────────────────────────────────────
const useIsDark = () => {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setIsDark(document.documentElement.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
};

// ─── SUB-COMPONENTS ─────────────────────────────────

const StatCard = ({ label, value, caption, accent }: { label: string; value: string; caption?: string; accent?: string }) => (
  <div className="relative overflow-hidden flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-100 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md group">
    <div className="absolute top-0 left-0 right-0 h-[2.5px] transition-opacity" style={{ backgroundColor: accent || "#6366f1", opacity: 0.6 }} />
    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500 mb-1.5">
      {label}
    </span>
    <div>
      <div className="text-lg sm:text-xl font-extrabold tracking-tight text-zinc-900 dark:text-white tabular-nums leading-tight">
        {value}
      </div>
      {caption && <div className="text-[9px] sm:text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">{caption}</div>}
    </div>
  </div>
);

const ChartTooltipDaily = ({ active, payload }: any) => {
  if (!active || !payload?.length || payload[0].value === 0) return null;
  const data = payload[0].payload;
  if (data.isGap) return null;
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div className="min-w-[160px] overflow-hidden rounded-xl bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-2xl">
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/80 dark:bg-white/5">
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{data.tooltipLabel || data.dateLabel}</p>
      </div>
      <div className="p-3 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBarColor(data.total, isDark) }} />
            <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Pendapatan</span>
          </div>
          <span className="text-[12px] font-bold text-zinc-900 dark:text-white tabular-nums">
            {rupiah(data.total)}
          </span>
        </div>
      </div>
    </div>
  );
};

const ChartTooltipMonthly = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div className="min-w-[180px] overflow-hidden rounded-xl bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-2xl">
      <div className="px-3 py-2 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/80 dark:bg-white/5">
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{data.fullLabel}</p>
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-500">Total</span>
          <span className="text-[12px] font-bold text-zinc-900 dark:text-white tabular-nums">{rupiah(data.total)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-500">Hari aktif</span>
          <span className="text-[12px] font-bold text-zinc-900 dark:text-white tabular-nums">{data.days} hari</span>
        </div>
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-white/5 pt-1.5">
          <span className="text-[11px] font-medium text-zinc-500">Rerata/hari</span>
          <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{rupiah(data.avg)}</span>
        </div>
      </div>
    </div>
  );
};

// Legend pills
const ColorLegend = ({ isDark }: { isDark: boolean }) => (
  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4">
    {[
      { c: isDark ? "#ff453a" : "#ff3b30", t: "<100rb" },
      { c: isDark ? "#ffd60a" : "#ffcc00", t: "100rb+" },
      { c: isDark ? "#64d2ff" : "#5ac8fa", t: "150rb+" },
      { c: isDark ? "#0a84ff" : "#007aff", t: "200rb+" },
      { c: isDark ? "#30d158" : "#34c759", t: ">250rb" }
    ].map(i => (
      <div key={i.t} className="flex items-center gap-1.5">
        <div className="w-[6px] h-[6px] rounded-full" style={{ backgroundColor: i.c }} />
        <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 tabular-nums">{i.t}</span>
      </div>
    ))}
  </div>
);

// ─── MAIN COMPONENT ─────────────────────────────────
type GrafikProps = {
  history: HistoryItem[];
  filterMode?: string;
};

const Grafik: React.FC<GrafikProps> = ({ history, filterMode = "Bulan Ini" }) => {
  const isDark = useIsDark();

  // ── MODE: 7 Hari Terakhir ──────────────────────
  const last7Data = useMemo(() => {
    const now = new Date();
    const days: any[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const dayName = HARI[d.getDay()];
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");

      let total = 0;
      history.forEach(h => {
        if (h.tanggal === iso) total += getTotal(h);
      });

      days.push({
        dateLabel: `${dayName}\n${dd}/${mm}`,
        shortLabel: dayName,
        dateNum: `${dd}/${mm}`,
        tooltipLabel: `${dayName}, ${dd}/${mm}`,
        total,
        isGap: false,
        isToday: i === 0,
      });
    }
    return days;
  }, [history]);

  // ── MODE: Bulan Ini (default) ──────────────────
  const monthlyData = useMemo(() => {
    const rawMap: Record<number, number> = {};
    history.forEach(h => {
      if (!h.tanggal) return;
      const d = new Date(h.tanggal);
      rawMap[d.getDate()] = (rawMap[d.getDate()] || 0) + getTotal(h);
    });

    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const rows: any[] = [];

    for (let i = 1; i <= lastDay; i++) {
      if (i === 8 || i === 15 || i === 22) {
        rows.push({ dateLabel: "", total: 0, isGap: true });
      }
      const totalVal = rawMap[i] || 0;
      const dateObj = new Date(now.getFullYear(), now.getMonth(), i);
      const dayName = HARI[dateObj.getDay()];
      rows.push({
        dateISO: i,
        dateLabel: i,
        tooltipLabel: `${dayName}, ${i} ${BULAN_SHORT[now.getMonth()]}`,
        total: totalVal,
        isGap: false,
        isToday: i === now.getDate(),
      });
    }
    return rows;
  }, [history]);

  // ── MODE: Semua Bulan ──────────────────────────
  const allMonthsData = useMemo(() => {
    const monthMap = new Map<string, { total: number; days: Set<number> }>();

    history.forEach(h => {
      if (!h.tanggal) return;
      const d = new Date(h.tanggal);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthMap.has(key)) monthMap.set(key, { total: 0, days: new Set() });
      const entry = monthMap.get(key)!;
      entry.total += getTotal(h);
      entry.days.add(d.getDate());
    });

    const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([key, val]) => {
      const [y, m] = key.split("-");
      const monthIdx = parseInt(m) - 1;
      return {
        dateLabel: `${BULAN_SHORT[monthIdx]} '${y.slice(-2)}`,
        fullLabel: `${BULAN_SHORT[monthIdx]} ${y}`,
        total: val.total,
        days: val.days.size,
        avg: val.days.size > 0 ? Math.round(val.total / val.days.size) : 0,
        isGap: false,
      };
    });
  }, [history]);

  // ── MODE: Pilih Bulan / Rentang → same as Bulan Ini ──
  const genericData = useMemo(() => {
    const rawMap: Record<string, number> = {};
    history.forEach(h => {
      if (!h.tanggal) return;
      rawMap[h.tanggal] = (rawMap[h.tanggal] || 0) + getTotal(h);
    });

    const sorted = Object.entries(rawMap).sort((a, b) => a[0].localeCompare(b[0]));
    return sorted.map(([date, total]) => {
      const d = new Date(date);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dayName = HARI[d.getDay()];
      return {
        dateLabel: `${dd}/${mm}`,
        tooltipLabel: `${dayName}, ${dd}/${mm}`,
        total,
        isGap: false,
      };
    });
  }, [history]);

  // ── Pick data by filter ────────────────────────
  const isLast7 = filterMode === "7 Hari Terakhir";
  const isAllMonths = filterMode === "Semua Bulan";
  const isDefault = filterMode === "Bulan Ini";

  const chartData = isLast7 ? last7Data : isAllMonths ? allMonthsData : isDefault ? monthlyData : genericData;

  // ── Stats ──────────────────────────────────────
  const stats = useMemo(() => {
    const validData = chartData.filter((d: any) => !d.isGap && d.total > 0);
    const total = validData.reduce((s: number, r: any) => s + r.total, 0);
    const count = validData.length;
    const avg = count ? Math.round(total / count) : 0;
    const max = Math.max(0, ...validData.map((d: any) => d.total));
    const maxEntry = validData.find((d: any) => d.total === max);
    const maxLabel = maxEntry ? (maxEntry.tooltipLabel || maxEntry.dateLabel || maxEntry.fullLabel || "-") : "-";

    // Trend calc (compare first half vs second half)
    let trend = 0;
    if (count >= 4) {
      const mid = Math.floor(count / 2);
      const firstHalf = validData.slice(0, mid).reduce((s: number, r: any) => s + r.total, 0) / mid;
      const secondHalf = validData.slice(mid).reduce((s: number, r: any) => s + r.total, 0) / (count - mid);
      trend = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;
    }

    return { total, avg, max, maxLabel, count, trend };
  }, [chartData]);

  // ── TITLE by mode ──────────────────────────────
  const chartTitle = isLast7 ? "7 Hari Terakhir" : isAllMonths ? "Pendapatan Per Bulan" : isDefault ? "Grafik Harian" : "Grafik Periode";
  const chartSubtitle = isLast7
    ? "Tren pendapatan minggu ini"
    : isAllMonths
      ? "Perbandingan antar bulan"
      : isDefault
        ? "Kalo banyak yang merah, harus lebih semangat lagi!"
        : "Data sesuai filter yang dipilih";

  return (
    <Section title="Analitik">
      <div className="relative overflow-hidden rounded-[28px] bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-zinc-200 dark:border-white/10 shadow-sm">
        <div className="p-5 sm:p-8 space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">{chartTitle}</h2>
              <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium uppercase tracking-wider">{chartSubtitle}</p>
            </div>
            {stats.trend !== 0 && stats.count >= 4 && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold ${stats.trend > 0
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                }`}>
                <span>{stats.trend > 0 ? "↑" : "↓"} {Math.abs(stats.trend)}%</span>
                <span className="opacity-60">vs paruh awal</span>
              </div>
            )}
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <StatCard
              label="Total Periode"
              value={rupiah(stats.total)}
              caption={`${stats.count} ${isAllMonths ? "bulan" : "hari"} aktif`}
              accent="#6366f1"
            />
            <StatCard
              label={isAllMonths ? "Rerata / Bulan" : "Rerata / Hari"}
              value={rupiah(stats.avg)}
              caption={isAllMonths ? "Per bulan aktif" : "Per hari transaksi"}
              accent="#0ea5e9"
            />
            <StatCard
              label="Tertinggi"
              value={rupiah(stats.max)}
              caption={stats.maxLabel}
              accent="#10b981"
            />
            <StatCard
              label="Tren"
              value={stats.trend === 0 ? "—" : `${stats.trend > 0 ? "+" : ""}${stats.trend}%`}
              caption={stats.count < 4 ? "Data belum cukup" : stats.trend > 0 ? "Naik ↑" : stats.trend < 0 ? "Turun ↓" : "Stabil"}
              accent={stats.trend > 0 ? "#10b981" : stats.trend < 0 ? "#ef4444" : "#6b7280"}
            />
          </div>

          {/* ═══════════ CHART ═══════════ */}
          <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl p-3 sm:p-4 border border-zinc-100 dark:border-zinc-800 shadow-inner">

            {/* ── 7 Hari Terakhir ── */}
            {isLast7 && (
              <>
                <div className="h-[220px] sm:h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={last7Data} margin={{ top: 10, right: 5, left: -20, bottom: 5 }} barCategoryGap="18%">
                      <defs>
                        <linearGradient id="grad-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff453a" /><stop offset="100%" stopColor="#ff453a" stopOpacity={0.6} /></linearGradient>
                        <linearGradient id="grad-yellow" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffd60a" /><stop offset="100%" stopColor="#ffd60a" stopOpacity={0.6} /></linearGradient>
                        <linearGradient id="grad-cyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#64d2ff" /><stop offset="100%" stopColor="#64d2ff" stopOpacity={0.6} /></linearGradient>
                        <linearGradient id="grad-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a84ff" /><stop offset="100%" stopColor="#0a84ff" stopOpacity={0.6} /></linearGradient>
                        <linearGradient id="grad-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30d158" /><stop offset="100%" stopColor="#30d158" stopOpacity={0.6} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#2a2a2a" : "#f0f0f0"} />
                      <XAxis
                        dataKey="shortLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={({ x, y, payload, index }) => {
                          const item = last7Data[index];
                          return (
                            <g>
                              <text x={x} y={y + 12} fill={item?.isToday ? (isDark ? "#60a5fa" : "#2563eb") : (isDark ? "#666" : "#999")} fontSize={10} fontWeight={item?.isToday ? 800 : 600} textAnchor="middle">
                                {payload.value}
                              </text>
                              <text x={x} y={y + 24} fill={isDark ? "#555" : "#aaa"} fontSize={8} fontWeight={500} textAnchor="middle">
                                {item?.dateNum}
                              </text>
                            </g>
                          );
                        }}
                        height={35}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? "#555" : "#bbb", fontSize: 9 }} tickFormatter={v => formatCurrencyCompact(v)} />
                      {stats.avg > 0 && (
                        <ReferenceLine y={stats.avg} stroke={isDark ? "#555" : "#ddd"} strokeDasharray="4 3" label={{ value: `Avg ${formatCurrencyCompact(stats.avg)}`, position: "insideTopRight", fill: isDark ? "#666" : "#999", fontSize: 9, fontWeight: 600 }} />
                      )}
                      <Tooltip cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", radius: 8 }} content={<ChartTooltipDaily />} />
                      <Bar dataKey="total" radius={[6, 6, 4, 4]} isAnimationActive={true} animationDuration={600}>
                        {last7Data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`url(#${getGradientId(entry.total)})`} stroke={getBarColor(entry.total, isDark)} strokeWidth={entry.isToday ? 2 : 0} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ColorLegend isDark={isDark} />
              </>
            )}

            {/* ── Semua Bulan ── */}
            {isAllMonths && (
              <>
                <div className="h-[220px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={allMonthsData} margin={{ top: 10, right: 5, left: -15, bottom: 5 }} barCategoryGap={allMonthsData.length > 8 ? "12%" : "20%"}>
                      <defs>
                        <linearGradient id="gradMonth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={isDark ? "#818cf8" : "#6366f1"} />
                          <stop offset="100%" stopColor={isDark ? "#818cf8" : "#6366f1"} stopOpacity={0.4} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#2a2a2a" : "#f0f0f0"} />
                      <XAxis
                        dataKey="dateLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: isDark ? "#666" : "#999", fontSize: 9, fontWeight: 600 }}
                        interval={0}
                        angle={allMonthsData.length > 10 ? -35 : 0}
                        textAnchor={allMonthsData.length > 10 ? "end" : "middle"}
                        height={allMonthsData.length > 10 ? 50 : 30}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? "#555" : "#bbb", fontSize: 9 }} tickFormatter={v => formatCurrencyCompact(v)} />
                      {stats.avg > 0 && (
                        <ReferenceLine y={stats.avg} stroke={isDark ? "#4f46e5" : "#a5b4fc"} strokeDasharray="4 3" strokeWidth={1.5} label={{ value: `Avg ${formatCurrencyCompact(stats.avg)}`, position: "insideTopRight", fill: isDark ? "#818cf8" : "#6366f1", fontSize: 9, fontWeight: 700 }} />
                      )}
                      <Tooltip cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", radius: 8 }} content={<ChartTooltipMonthly />} />
                      <Bar dataKey="total" radius={[6, 6, 4, 4]} isAnimationActive={true} animationDuration={600} fill="url(#gradMonth)">
                        {allMonthsData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill="url(#gradMonth)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Monthly summary table */}
                {allMonthsData.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(allMonthsData.length, 6)}, 1fr)` }}>
                      {allMonthsData.slice(-6).map((m, i) => (
                        <div key={i} className="text-center p-2 rounded-xl bg-zinc-50 dark:bg-white/5 border border-zinc-100 dark:border-white/5">
                          <div className="text-[9px] font-bold text-zinc-400 uppercase">{m.dateLabel}</div>
                          <div className="text-[11px] font-extrabold text-zinc-800 dark:text-white tabular-nums mt-0.5">{formatCurrencyCompact(m.total)}</div>
                          <div className="text-[8px] font-semibold text-zinc-400 mt-0.5">{m.days} hari</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Bulan Ini / Pilih Bulan / Rentang ── */}
            {!isLast7 && !isAllMonths && (
              <>
                <div className="h-[220px] sm:h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }} barGap={0}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#2a2a2a" : "#f0f0f0"} />
                      <XAxis
                        dataKey="dateLabel"
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                        tick={({ x, y, payload }) => (
                          <text x={x} y={y + 12} fill={isDark ? "#666" : "#999"} fontSize={9} fontWeight={600} textAnchor="middle">
                            {payload.value}
                          </text>
                        )}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? "#555" : "#bbb", fontSize: 9 }} tickFormatter={v => formatCurrencyCompact(v)} />
                      {stats.avg > 0 && (
                        <ReferenceLine y={stats.avg} stroke={isDark ? "#555" : "#ddd"} strokeDasharray="4 3" label={{ value: `Avg`, position: "insideTopRight", fill: isDark ? "#666" : "#aaa", fontSize: 9 }} />
                      )}
                      <Tooltip cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)", radius: 8 }} content={<ChartTooltipDaily />} />
                      <Bar dataKey="total" radius={[3, 3, 3, 3]} isAnimationActive={false}>
                        {chartData.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.isGap ? "transparent" : getBarColor(entry.total, isDark)}
                            style={{ pointerEvents: entry.isGap ? 'none' : 'auto' }}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {isDefault && (
                  <div className="mt-4 flex justify-between items-center text-[9px] sm:text-[10px] font-bold text-zinc-400 dark:text-zinc-600 px-2 uppercase tracking-tighter">
                    <span>Minggu 1</span>
                    <span>Minggu 2</span>
                    <span>Minggu 3</span>
                    <span>Minggu 4+</span>
                  </div>
                )}

                <ColorLegend isDark={isDark} />
              </>
            )}

          </div>

        </div>
      </div>
    </Section>
  );
};

export default Grafik;