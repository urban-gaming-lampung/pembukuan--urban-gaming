import React from "react";
import { useIsDark } from "../hooks/useIsDark";
import { temaGrafik } from "./tokens";

/**
 * GRAFIK — tema sumbu & tooltip bersama untuk semua grafik recharts.
 * Aturan: satu sumbu Y, garis grid samar, label sumbu 10px abu, tooltip satu gaya.
 */

/** Warna sumbu / grid / kursor mengikuti mode terang-gelap secara realtime. */
export function useTemaGrafik() {
  return temaGrafik(useIsDark());
}

/** Properti sumbu standar (tanpa garis sumbu & tick). */
export const sumbu = (tick: string) => ({ axisLine: false, tickLine: false, tick: { fontSize: 10, fill: tick } });

/** Kotak tooltip standar: judul + baris (titik · label · nilai) + baris penutup opsional. */
export const ChartTip: React.FC<{
  title: React.ReactNode;
  rows: { color?: string; label: React.ReactNode; value: React.ReactNode }[];
  footer?: { label: React.ReactNode; value: React.ReactNode };
}> = ({ title, rows, footer }) => (
  <div className="min-w-[170px] rounded-tile bg-surface/95 px-3 py-2 shadow-float ring-1 ring-edge backdrop-blur-xl">
    <div className="mb-1 text-footnote font-semibold text-label">{title}</div>
    {rows.map((r, i) => (
      <div key={i} className="flex items-center justify-between gap-3 text-caption text-label-2">
        <span className="flex items-center gap-1.5">
          {r.color && <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          {r.label}
        </span>
        <span className="font-semibold tabular-nums text-label">{r.value}</span>
      </div>
    ))}
    {footer && (
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-sep pt-1 text-caption">
        <span className="font-medium text-label-2">{footer.label}</span>
        <span className="font-bold tabular-nums text-label">{footer.value}</span>
      </div>
    )}
  </div>
);
