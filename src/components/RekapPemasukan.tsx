import React from "react";
import Section from "./common/Section";
import { rupiah } from "../lib/format";
import {
  Wallet,
  CreditCard,
  Gamepad2,
  Coffee,
  Wrench,
  Calendar,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
} from "lucide-react";

interface RekapPemasukanProps {
  totalHarian: number;
  totalJajanan: number;
  totalJasaAks: number;
  totalSewa: number;
  totalCash: number;
  totalTransfer: number;
  totalPengeluaran?: number;
  pendapatanBersih: number;
}

const RekapPemasukan: React.FC<RekapPemasukanProps> = ({
  totalHarian,
  totalJajanan,
  totalJasaAks,
  totalSewa,
  totalCash,
  totalTransfer,
  totalPengeluaran = 0,
  pendapatanBersih,
}) => {
  const grand = totalHarian + totalJajanan + totalJasaAks + totalSewa;
  const isProfit = pendapatanBersih >= 0;

  /* ───────────────────────────────────────────────
   *  iOS-style Stat Tile  —  rounded card with
   *  generous padding, subtle depth, icon + label + value
   * ─────────────────────────────────────────────── */
  const StatTile = ({
    label,
    value,
    icon: Icon,
    accentBg,
    accentText,
  }: {
    label: string;
    value: number;
    icon: React.ElementType;
    accentBg: string;
    accentText: string;
  }) => (
    <div
      className="
        rounded-2xl p-3 sm:p-3.5
        bg-white/60 dark:bg-zinc-800/60
        backdrop-blur-xl
        border border-white/40 dark:border-zinc-700/50
        shadow-[0_1px_3px_rgba(0,0,0,0.04)]
        dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]
        transition-all duration-200
        active:scale-[0.97] active:shadow-none
      "
    >
      <div className={`inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl ${accentBg} mb-2`}>
        <Icon size={15} strokeWidth={2.2} className={accentText} />
      </div>
      <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-0.5">
        {label}
      </p>
      <p className="text-sm sm:text-[15px] font-bold text-zinc-900 dark:text-zinc-50 tabular-nums leading-tight">
        {rupiah(value)}
      </p>
    </div>
  );

  /* ───────────────────────────────────────────────
   *  iOS-style Gradient Pill  —  Cash / Transfer
   *  wide rounded bar with frosted icon badge
   * ─────────────────────────────────────────────── */
  const GradientPill = ({
    label,
    value,
    icon: Icon,
    gradient,
  }: {
    label: string;
    value: number;
    icon: React.ElementType;
    gradient: string;
  }) => (
    <div
      className={`
        relative overflow-hidden rounded-2xl ${gradient}
        shadow-sm
        transition-transform duration-200
        active:scale-[0.98]
      `}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
            <Icon size={13} strokeWidth={2.5} className="text-white" />
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-white/95 tracking-wide">
            {label}
          </span>
        </div>
        <span className="text-sm sm:text-[15px] font-extrabold text-white tabular-nums tracking-tight">
          {rupiah(value)}
        </span>
      </div>
    </div>
  );

  /* ───────────────────────────────────────────────
   *  Full-width Summary Bar  —  Pendapatan / Pengeluaran
   * ─────────────────────────────────────────────── */
  const SummaryBar = ({
    label,
    value,
    icon: Icon,
    gradient,
  }: {
    label: string;
    value: number;
    icon: React.ElementType;
    gradient: string;
  }) => (
    <div
      className={`
        relative overflow-hidden rounded-2xl ${gradient}
        shadow-sm
        transition-transform duration-200
        active:scale-[0.98]
      `}
    >
      <div className="flex items-center justify-between px-3.5 py-3 sm:px-5 sm:py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
            <Icon size={14} strokeWidth={2.5} className="text-white" />
          </div>
          <span className="text-[11px] sm:text-sm font-bold text-white/95 tracking-wide">
            {label}
          </span>
        </div>
        <span className="text-sm sm:text-base font-extrabold text-white tabular-nums tracking-tight">
          {rupiah(value)}
        </span>
      </div>
    </div>
  );

  return (
    <Section title="Rekap Pemasukan Hari Ini">
      <div className="space-y-3 sm:space-y-4">

        {/* ── 2×2 Grid — iOS Widget-style tiles ── */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <StatTile label="Harian"        value={totalHarian}  icon={Calendar} accentBg="bg-zinc-500/15 dark:bg-zinc-400/15" accentText="text-zinc-600 dark:text-zinc-300" />
          <StatTile label="Jajanan"       value={totalJajanan} icon={Coffee}   accentBg="bg-pink-500/15 dark:bg-pink-400/15" accentText="text-pink-600 dark:text-pink-400" />
          <StatTile label="Jasa & Aks"    value={totalJasaAks} icon={Wrench}   accentBg="bg-purple-500/15 dark:bg-purple-400/15" accentText="text-purple-600 dark:text-purple-400" />
          <StatTile label="Sewa Console"  value={totalSewa}    icon={Gamepad2} accentBg="bg-indigo-500/15 dark:bg-indigo-400/15" accentText="text-indigo-600 dark:text-indigo-400" />
        </div>

        {/* ── Separator ── */}
        <div className="flex items-center gap-3 py-0.5">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300/60 to-transparent dark:via-zinc-700/60" />
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500 select-none">
            Rekap Pembayaran
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-300/60 to-transparent dark:via-zinc-700/60" />
        </div>

        {/* ── Cash & Transfer — side-by-side ── */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <GradientPill label="CASH"     value={totalCash}     icon={Wallet}     gradient="bg-gradient-to-br from-emerald-500 to-teal-600" />
          <GradientPill label="TRANSFER" value={totalTransfer} icon={CreditCard} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
        </div>

        {/* ── Totals — full width stacked ── */}
        <div className="space-y-2 sm:space-y-2.5">
          <SummaryBar label="TOTAL PENDAPATAN"  value={grand}            icon={TrendingUp}   gradient="bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500" />
          <SummaryBar label="TOTAL PENGELUARAN" value={totalPengeluaran} icon={TrendingDown}  gradient="bg-gradient-to-r from-rose-500 via-red-500 to-pink-500" />
        </div>

        {/* ── Laba Bersih — Hero card ── */}
        <div className="pt-1.5 sm:pt-2 border-t border-zinc-200/80 dark:border-zinc-700/60">
          <div className="flex items-center gap-2 mb-2 px-0.5">
            <span className={`flex h-2 w-2 rounded-full ${isProfit ? "bg-emerald-500" : "bg-red-500"} animate-pulse`} />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
              Laba Bersih Hari Ini
            </span>
          </div>

          <div
            className={`
              relative overflow-hidden rounded-2xl shadow-lg
              transition-transform duration-200 active:scale-[0.98]
              ${isProfit
                ? "bg-zinc-900 dark:bg-white"
                : "bg-gradient-to-r from-red-600 to-rose-600"
              }
            `}
          >
            <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
              <div className="flex items-center gap-2.5">
                <div
                  className={`
                    flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center
                    rounded-full backdrop-blur-md
                    ${isProfit
                      ? "bg-white/10 dark:bg-black/5 text-white dark:text-zinc-900"
                      : "bg-white/20 text-white"
                    }
                  `}
                >
                  <CircleDollarSign size={16} strokeWidth={2.2} />
                </div>
                <span
                  className={`text-[11px] sm:text-sm font-bold tracking-wide ${
                    isProfit
                      ? "text-zinc-400 dark:text-zinc-500"
                      : "text-white/90"
                  }`}
                >
                  PENDAPATAN BERSIH
                </span>
              </div>
              <span
                className={`text-base sm:text-lg font-extrabold tabular-nums tracking-tight ${
                  isProfit
                    ? "text-white dark:text-zinc-900"
                    : "text-white"
                }`}
              >
                {rupiah(Math.max(0, pendapatanBersih))}
              </span>
            </div>
          </div>
        </div>

      </div>
    </Section>
  );
};

export default RekapPemasukan;