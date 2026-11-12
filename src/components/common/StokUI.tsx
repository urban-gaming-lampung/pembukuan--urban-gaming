import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { StokStatus } from "../../lib/stokJualan";

/**
 * Potongan UI halaman Stok (SSOT) — dipakai STOK RENTAL & STOK JUALAN supaya tampilannya selaras.
 */

export const BADGE_STATUS: Record<StokStatus, string> = {
  habis: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  menipis: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  aman: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
};
export const LABEL_STATUS: Record<StokStatus, string> = { habis: "Habis", menipis: "Menipis", aman: "Aman" };
export const DOT_STATUS: Record<StokStatus, string> = { habis: "bg-red-500", menipis: "bg-amber-500", aman: "bg-emerald-500" };

/** Label status kecil: "Habis · beli 2" / "Menipis · beli 1" / "Aman". */
export const StatusChip: React.FC<{ status: StokStatus; kurang?: number; className?: string }> = ({ status, kurang = 0, className = "" }) => (
  <span className={`inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${BADGE_STATUS[status]} ${className}`}>
    {status === "aman" ? LABEL_STATUS.aman : `${LABEL_STATUS[status]} · beli ${Math.max(1, kurang)}`}
  </span>
);

/** Kotak ringkasan (Habis / Menipis / Aman / ...). Bisa diketuk bila ada onClick. */
export const TileStok: React.FC<{
  title: string;
  value: number | string;
  sub: string;
  cls: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}> = ({ title, value, sub, cls, icon, active, onClick }) => {
  const body = (
    <>
      <div className={`flex items-center gap-1.5 text-[12px] font-bold ${cls}`}>{icon}{title}</div>
      <div className={`text-[28px] leading-none font-black mt-1.5 tabular-nums ${cls}`}>{value}</div>
      <div className="text-[11px] text-zinc-400 mt-1 truncate">{sub}</div>
    </>
  );
  const base = "text-left rounded-2xl p-3.5 border bg-white dark:bg-[#1c1c1e] min-w-0";
  if (!onClick) return <div className={`${base} border-zinc-200 dark:border-white/10`}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={`${base} active:scale-[0.98] transition-all ${active ? "border-blue-500 ring-2 ring-blue-500/20" : "border-zinc-200 dark:border-white/10"}`}
    >
      {body}
    </button>
  );
};

/** Kartu satu kategori: judul huruf besar + keterangan kanan, lalu baris-baris barang. */
export const KartuStok: React.FC<{ judul: string; kanan?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }> = ({ judul, kanan, children, footer }) => (
  <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 overflow-hidden">
    <div className="px-4 py-2.5 flex items-center justify-between gap-2 bg-zinc-50 dark:bg-white/5">
      <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">{judul}</span>
      {kanan && <span className="text-[11px] font-bold text-zinc-400 shrink-0">{kanan}</span>}
    </div>
    {children}
    {footer}
  </div>
);

/**
 * Pengubah jumlah: − [angka] +. Angka bisa diketuk untuk diketik langsung.
 * `diff` (opsional) menampilkan selisih yang belum disimpan.
 */
export const StepperStok: React.FC<{
  value: number;
  nama: string;
  diff?: number;
  onStep: (step: number) => void;
  onSet: (n: number) => void;
  disabled?: boolean;
}> = ({ value, nama, diff = 0, onStep, onSet, disabled }) => {
  const [edit, setEdit] = useState(false);
  const [teks, setTeks] = useState("");
  const selesai = () => {
    setEdit(false);
    const n = parseInt(teks, 10);
    if (!isNaN(n) && n >= 0 && n !== value) onSet(n);
  };
  const btn =
    "w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 active:scale-95 transition disabled:opacity-30";
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button type="button" onClick={() => onStep(-1)} disabled={disabled || value <= 0} aria-label={`Kurangi ${nama}`} className={btn}>
        <Minus className="w-4 h-4" />
      </button>
      {edit ? (
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={0}
          value={teks}
          aria-label={`Jumlah ${nama}`}
          onChange={(e) => setTeks(e.target.value)}
          onBlur={selesai}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEdit(false);
          }}
          className="w-12 h-11 rounded-xl text-center text-[17px] font-black bg-white dark:bg-black border-2 border-blue-500 focus:outline-none text-zinc-900 dark:text-white"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setTeks(String(value)); setEdit(true); }}
          aria-label={`Isi jumlah ${nama}`}
          className="w-12 h-11 rounded-xl flex flex-col items-center justify-center leading-none"
        >
          <span className="text-[18px] font-black text-zinc-900 dark:text-white tabular-nums">{value}</span>
          {diff !== 0 && (
            <span className={`text-[10px] font-bold mt-0.5 tabular-nums ${diff > 0 ? "text-emerald-600" : "text-red-500"}`}>{diff > 0 ? `+${diff}` : diff}</span>
          )}
        </button>
      )}
      <button type="button" onClick={() => onStep(1)} disabled={disabled} aria-label={`Tambah ${nama}`} className={btn}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
