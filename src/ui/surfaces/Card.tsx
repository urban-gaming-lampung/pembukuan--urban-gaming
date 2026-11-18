import React from "react";
import { ChevronRight } from "lucide-react";
import { cx } from "../foundations/cn";
import { AKSEN_TILE, BG_IKON, nadaKeAksen, TEKS_NADA, type Nada, type WarnaIkon } from "../foundations/tokens";

/**
 * SURFACES — Kartu, judul seksi, lencana ikon, dan daftar ala Apple iOS 27 & macOS.
 */

const resolveAccent = (a?: WarnaIkon | Nada): WarnaIkon => {
  if (!a) return "gray";
  if (a === "positive" || a === "negative" || a === "warning" || a === "tint" || a === "neutral") {
    return nadaKeAksen(a);
  }
  return a;
};

/** Ikon kotak (squircle) ala Pengaturan Apple: `solid` (ikon aplikasi) atau `tinted` (lencana lembut). */
export const IconBadge: React.FC<{
  color?: WarnaIkon;
  variant?: "solid" | "tinted";
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}> = ({ color = "gray", variant = "solid", size = "md", children, className }) => {
  const toneCls =
    variant === "tinted"
      ? cx(AKSEN_TILE[color].iconBg, AKSEN_TILE[color].iconText)
      : cx("text-white shadow-sm", BG_IKON[color]);
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center [&>svg]:shrink-0",
        size === "sm" ? "h-6 w-6 rounded-[6px] [&>svg]:h-3.5 [&>svg]:w-3.5" : "h-7 w-7 rounded-icon [&>svg]:h-4 [&>svg]:w-4",
        toneCls,
        className
      )}
    >
      {children}
    </span>
  );
};

/** Permukaan kartu dasar (iOS 27 Liquid Glass, sudut 26px, bezel kaca + specular highlight). */
export const kartu =
  "rounded-card apple-card ring-1 ring-edge shadow-card dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_8px_24px_rgba(0,0,0,0.34)]";

/** Permukaan tile nested kaca di dalam kartu (sudut 16px, selaras dengan tile Input). */
export const tile =
  "rounded-tile apple-tile ring-1 ring-black/[0.04] dark:ring-white/[0.06]";

/** Variasi tile interaktif (hover lebih cerah + transisi halus). */
export const tileInteractive =
  "rounded-tile apple-tile apple-tile-interactive ring-1 ring-black/[0.04] dark:ring-white/[0.06] transition-colors duration-150";

/**
 * Kartu standar Apple.
 * - `variant="default"`: permukaan putih/gelap netral bersih.
 * - `variant="hero"` + `accent`: sapuan cahaya radial tipis di sudut ala Apple Wallet / Health.
 * - `variant="tinted"` + `accent`: permukaan tinted lembut untuk kartu sorotan / ringkasan penting.
 * - `flush`: tanpa padding (untuk daftar baris yang menempel ke tepi kartu).
 */
export const Card: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: WarnaIkon;
  iconVariant?: "solid" | "tinted";
  accent?: WarnaIkon | Nada;
  variant?: "default" | "hero" | "tinted";
  accessory?: React.ReactNode;
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
  "aria-label"?: string;
}> = ({
  title,
  subtitle,
  icon,
  iconColor,
  iconVariant = "solid",
  accent,
  variant = "default",
  accessory,
  flush,
  className,
  bodyClassName,
  children,
  ...rest
}) => {
  const resolved = resolveAccent(accent ?? iconColor);
  const isTinted = variant === "tinted";
  const isHero = variant === "hero";
  const hasHeader = !!(title || accessory);
  const surfaceCls = isTinted
    ? cx("rounded-card md:backdrop-blur-lg border border-white/55 dark:border-white/[0.13] shadow-card", AKSEN_TILE[resolved].bg)
    : kartu;

  return (
    <section
      className={cx(surfaceCls, "relative min-w-0", !flush && "p-4 sm:p-5", flush && "overflow-hidden", className)}
      aria-label={rest["aria-label"]}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-card bg-gradient-to-br from-white/45 via-transparent to-transparent dark:from-white/[0.06]"
      />
      {isHero && accent && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-card"
          style={{ background: AKSEN_TILE[resolved].glow }}
        />
      )}
      <div className={cx("relative z-[1] flex-1 flex flex-col min-w-0", !hasHeader && bodyClassName)}>
        {hasHeader && (
          <header className={cx("flex items-center gap-3 shrink-0", flush ? "px-4 sm:px-5 pt-4 pb-2.5" : "mb-3.5")}>
            {icon && (
              <IconBadge color={iconColor ?? resolved} variant={iconVariant}>
                {icon}
              </IconBadge>
            )}
            <div className="min-w-0 flex-1">
              {title && <h3 className="text-headline font-semibold tracking-tight text-label truncate">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-footnote text-label-2 truncate">{subtitle}</p>}
            </div>
            {accessory && <div className="shrink-0 text-footnote text-label-2">{accessory}</div>}
          </header>
        )}
        {hasHeader && bodyClassName ? <div className={cx("min-w-0 flex-1", bodyClassName)}>{children}</div> : children}
      </div>
    </section>
  );
};

/** Judul seksi di luar kartu (huruf kecil kapital, abu) — sama dengan judul grup di Pengaturan. */
export const SectionHeader: React.FC<{ title: React.ReactNode; accessory?: React.ReactNode; className?: string }> = ({ title, accessory, className }) => (
  <div className={cx("flex items-end justify-between gap-3 px-4 pt-4 pb-1.5", className)}>
    <h2 className="text-footnote font-semibold uppercase tracking-[0.06em] text-label-2">{title}</h2>
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
 * Satu baris daftar (tinggi >= 44px). Garis pemisah mulai sesudah ikon (inset ala iOS)
 * dan hilang otomatis di baris terakhir.
 */
export const ListRow: React.FC<{
  icon?: React.ReactNode;
  iconColor?: WarnaIkon;
  iconVariant?: "solid" | "tinted";
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  valueTone?: Nada;
  chevron?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}> = ({ icon, iconColor, iconVariant = "solid", title, subtitle, value, valueTone, chevron, destructive, onClick, ariaLabel }) => {
  const isi = (
    <>
      {icon && (
        <IconBadge color={destructive ? "red" : iconColor} variant={iconVariant}>
          {icon}
        </IconBadge>
      )}
      <div className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 border-b border-sep py-3 group-last/row:border-b-0">
        <div className="min-w-0 flex-1 text-left">
          <div className={cx("text-callout truncate", destructive ? "font-medium text-negative" : "text-label")}>{title}</div>
          {subtitle && <div className="text-footnote text-label-2 truncate">{subtitle}</div>}
        </div>
        {value !== undefined && value !== null && (
          <div className={cx("shrink-0 text-callout tabular-nums", valueTone ? cx("font-semibold", TEKS_NADA[valueTone]) : "text-label-2")}>{value}</div>
        )}
        {(chevron ?? (!!onClick && !destructive)) && <ChevronRight className="h-4 w-4 shrink-0 text-label-3" aria-hidden />}
      </div>
    </>
  );
  const base = "group/row flex w-full items-center gap-3 pl-4 pr-3.5 sm:pr-4";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cx(
        base,
        "transition-colors hover:bg-fill/55 active:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tint"
      )}
    >
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
