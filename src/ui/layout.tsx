import React from "react";
import { ChevronRight } from "lucide-react";
import { BG_IKON, TEKS_NADA, type Nada, type WarnaIkon } from "./tokens";

/**
 * TATA LETAK — kartu, judul seksi, daftar ala iOS. Semua halaman memakai potongan ini
 * supaya jarak, sudut, dan hierarki teks sama di setiap fitur (lihat src/ui/DESIGN.md).
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Ikon kotak berwarna ala menu Pengaturan (28px, glyph putih 16px). */
export const IconBadge: React.FC<{ color?: WarnaIkon; size?: "sm" | "md"; children: React.ReactNode; className?: string }> = ({
  color = "gray",
  size = "md",
  children,
  className,
}) => (
  <span
    aria-hidden
    className={cx(
      "inline-flex shrink-0 items-center justify-center text-white shadow-sm [&>svg]:shrink-0",
      size === "sm" ? "h-6 w-6 rounded-[6px] [&>svg]:h-3.5 [&>svg]:w-3.5" : "h-7 w-7 rounded-icon [&>svg]:h-4 [&>svg]:w-4",
      BG_IKON[color],
      className
    )}
  >
    {children}
  </span>
);

/** Permukaan kartu dasar (putih / #1C1C1E, sudut 22px, tepi tipis). */
export const kartu = "rounded-card bg-surface ring-1 ring-edge shadow-card";

/**
 * Kartu standar. Judul memakai gaya Headline; ikon opsional berupa IconBadge.
 * `flush` = tanpa padding (untuk daftar baris yang menempel ke tepi kartu).
 */
export const Card: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: WarnaIkon;
  accessory?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
}> = ({ title, subtitle, icon, iconColor, accessory, flush, className, children, ...rest }) => (
  <section className={cx(kartu, "min-w-0", !flush && "p-4", flush && "overflow-hidden", className)} aria-label={rest["aria-label"]}>
    {(title || accessory) && (
      <header className={cx("flex items-center gap-3", flush ? "px-4 pt-4 pb-2" : "mb-3")}>
        {icon && <IconBadge color={iconColor}>{icon}</IconBadge>}
        <div className="min-w-0 flex-1">
          {title && <h3 className="text-headline text-label truncate">{title}</h3>}
          {subtitle && <p className="text-footnote text-label-2 truncate">{subtitle}</p>}
        </div>
        {accessory && <div className="shrink-0 text-footnote text-label-2">{accessory}</div>}
      </header>
    )}
    {children}
  </section>
);

/** Judul seksi di luar kartu (huruf kecil kapital, abu) — sama dengan judul grup di Pengaturan. */
export const SectionHeader: React.FC<{ title: React.ReactNode; accessory?: React.ReactNode; className?: string }> = ({ title, accessory, className }) => (
  <div className={cx("flex items-end justify-between gap-3 px-4 pt-4 pb-1.5", className)}>
    <h2 className="text-footnote font-medium uppercase tracking-[0.04em] text-label-2">{title}</h2>
    {accessory && <div className="text-footnote text-label-2 shrink-0">{accessory}</div>}
  </div>
);

/** Label kecil di atas angka utama (mis. "HASIL · NOVEMBER 2026"). */
export const Eyebrow: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex min-w-0 items-center gap-1.5 text-caption font-semibold uppercase tracking-[0.06em] text-label-2 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0">
    {icon}
    <span className="truncate">{children}</span>
  </div>
);

/** Grup daftar ala iOS: kartu tanpa padding berisi ListRow. */
export const ListGroup: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx(kartu, "overflow-hidden", className)}>{children}</div>
);

/**
 * Satu baris daftar (tinggi ≥ 44px). Garis pemisah mulai sesudah ikon (inset ala iOS)
 * dan hilang otomatis di baris terakhir.
 */
export const ListRow: React.FC<{
  icon?: React.ReactNode;
  iconColor?: WarnaIkon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  valueTone?: Nada;
  chevron?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}> = ({ icon, iconColor, title, subtitle, value, valueTone, chevron, onClick, ariaLabel }) => {
  const isi = (
    <>
      {icon && <IconBadge color={iconColor}>{icon}</IconBadge>}
      <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-3 border-b border-sep py-2.5 group-last/row:border-b-0">
        <div className="min-w-0 flex-1 text-left">
          <div className="text-callout text-label truncate">{title}</div>
          {subtitle && <div className="text-footnote text-label-2 truncate">{subtitle}</div>}
        </div>
        {value !== undefined && value !== null && (
          <div className={cx("shrink-0 text-callout tabular-nums", valueTone ? cx("font-semibold", TEKS_NADA[valueTone]) : "text-label-2")}>{value}</div>
        )}
        {(chevron ?? !!onClick) && <ChevronRight className="h-4 w-4 shrink-0 text-label-3" aria-hidden />}
      </div>
    </>
  );
  const base = "group/row flex w-full items-center gap-3 pl-4 pr-3";
  return onClick ? (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className={cx(base, "transition-colors active:bg-fill")}>
      {isi}
    </button>
  ) : (
    <div className={base}>{isi}</div>
  );
};

/** Kumpulan LineItem dengan garis pemisah tipis. */
export const LineList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx("divide-y divide-sep", className)}>{children}</div>
);

/**
 * Baris rincian angka: (titik) label (+ catatan kecil di bawahnya) ........ nilai.
 * `total` = baris jumlah (huruf lebih tebal). `muted` = nilai 0 dibuat samar.
 */
export const LineItem: React.FC<{
  label: React.ReactNode;
  note?: React.ReactNode;
  value: React.ReactNode;
  dot?: string;
  tone?: Nada;
  total?: boolean;
  muted?: boolean;
  onClick?: () => void;
}> = ({ label, note, value, dot, tone, total, muted, onClick }) => {
  const isi = (
    <>
      <span className="flex min-w-0 items-start gap-2">
        {dot && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />}
        <span className="min-w-0">
          <span className={cx("block truncate text-subhead text-label", total && "font-semibold")}>{label}</span>
          {note && <span className="block truncate text-caption text-label-2">{note}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span className={cx("tabular-nums text-subhead", total ? "font-bold" : "font-semibold", tone ? TEKS_NADA[tone] : "text-label", muted && "opacity-40")}>{value}</span>
        {onClick && <ChevronRight className="h-4 w-4 text-label-3" aria-hidden />}
      </span>
    </>
  );
  const base = "flex w-full items-center justify-between gap-3 py-2.5 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(base, "transition-opacity active:opacity-50")}>
      {isi}
    </button>
  ) : (
    <div className={base}>{isi}</div>
  );
};
