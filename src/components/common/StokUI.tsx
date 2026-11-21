import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { StokStatus } from "../../lib/stokJualan";
import { kartu } from "../../ui";

/**
 * Potongan UI halaman Stok (SSOT) — dipakai STOK RENTAL & STOK JUALAN supaya tampilannya selaras.
 */

export const BADGE_STATUS: Record<StokStatus, string> = {
  habis: "bg-negative/[0.12] text-negative dark:bg-negative/[0.18]",
  menipis: "bg-warning/[0.12] text-warning dark:bg-warning/[0.18]",
  aman: "bg-positive/[0.12] text-positive dark:bg-positive/[0.18]",
};
export const LABEL_STATUS: Record<StokStatus, string> = { habis: "Habis", menipis: "Menipis", aman: "Aman" };
export const DOT_STATUS: Record<StokStatus, string> = { habis: "bg-negative", menipis: "bg-warning", aman: "bg-positive" };

/** Label status kecil: "Habis · beli 2" / "Menipis · beli 1" / "Aman". */
export const StatusChip: React.FC<{ status: StokStatus; kurang?: number; className?: string }> = ({ status, kurang = 0, className = "" }) => (
  <span className={`inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-caption2 font-semibold ${BADGE_STATUS[status]} ${className}`}>
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
      <div className={`flex items-center gap-1.5 text-caption font-semibold ${cls}`}>{icon}{title}</div>
      <div className={`text-title1 font-bold leading-none mt-1.5 tabular-nums ${cls}`}>{value}</div>
      <div className="text-caption2 text-label-2 mt-1 truncate">{sub}</div>
    </>
  );
  const base = "text-left rounded-card apple-card p-3.5 sm:p-4 ring-1 shadow-card min-w-0 transition duration-200";
  if (!onClick) return <div className={`${base} ring-edge`}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={`${base} active:scale-[0.98] ${active ? "ring-2 ring-action" : "ring-edge hover:ring-label-3"}`}
    >
      {body}
    </button>
  );
};

/** Kartu satu kategori: judul huruf besar + keterangan kanan, lalu baris-baris barang. */
export const KartuStok: React.FC<{ judul: string; kanan?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode }> = ({ judul, kanan, children, footer }) => (
  <div className={`${kartu} overflow-hidden`}>
    <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-2 bg-fill/35 border-b border-sep">
      <span className="text-caption font-semibold uppercase tracking-[0.06em] text-label-2 truncate">{judul}</span>
      {kanan && <span className="text-caption font-medium text-label-2 shrink-0">{kanan}</span>}
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
    "w-11 h-11 rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 flex items-center justify-center text-label active:scale-95 transition disabled:opacity-30";
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
          className="w-12 h-11 rounded-field text-center text-headline font-bold bg-surface ring-2 ring-tint focus:outline-none text-label tabular-nums"
        />
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setTeks(String(value)); setEdit(true); }}
          aria-label={`Isi jumlah ${nama}`}
          className="w-12 h-11 rounded-field flex flex-col items-center justify-center leading-none hover:bg-fill/60 transition-colors"
        >
          <span className="text-title3 font-bold text-label tabular-nums">{value}</span>
          {diff !== 0 && (
            <span className={`text-caption2 font-bold mt-0.5 tabular-nums ${diff > 0 ? "text-positive" : "text-negative"}`}>{diff > 0 ? `+${diff}` : diff}</span>
          )}
        </button>
      )}
      <button type="button" onClick={() => onStep(1)} disabled={disabled} aria-label={`Tambah ${nama}`} className={btn}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
