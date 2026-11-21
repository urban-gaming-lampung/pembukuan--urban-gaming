import React from "react";
import { cx } from "../foundations/cn";
import { AKSEN_TILE, type WarnaIkon } from "../foundations/tokens";
import { IconBadge } from "../surfaces/Card";

/**
 * CHROME — Shell adaptif Apple (iOS Top Bar + Bottom Tab Bar / macOS Sidebar Source List + Header Halaman).
 */

export type NavItem = {
  key: string;
  label: string;
  /** Label lebih singkat untuk tab bar bawah di layar HP */
  shortLabel?: string;
  icon: React.ReactNode;
  color?: WarnaIkon;
  badge?: number | string;
  dot?: boolean;
};

export type NavSection = {
  title?: string;
  items: NavItem[];
};

const MAX_LEBAR = {
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

/** Pembungkus halaman utama adaptif (macOS Sidebar + Toolbar / iOS Top Bar + Bottom Tab Bar). */
export const AppShell: React.FC<{
  activeKey: string;
  /** Kunci aktif untuk tab bar bawah bila berbeda dari sidebar (mis. sidebar memilih sub-menu). */
  mobileActiveKey?: string;
  onSelectKey: (key: string) => void;
  sidebarSections?: NavSection[];
  sidebarHeader?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  mobileTabs?: NavItem[];
  topBar?: React.ReactNode;
  floatingTopBar?: boolean;
  maxWidth?: keyof typeof MAX_LEBAR;
  children: React.ReactNode;
}> = ({
  activeKey,
  mobileActiveKey,
  onSelectKey,
  sidebarSections = [],
  sidebarHeader,
  sidebarFooter,
  mobileTabs = [],
  topBar,
  floatingTopBar = false,
  maxWidth = "6xl",
  children,
}) => {
  const hasSidebar = sidebarSections.length > 0;
  const hasBottomTabs = mobileTabs.length > 0;

  return (
    <div className="flex min-h-screen bg-transparent text-label">
      {hasSidebar && (
        <aside
          aria-label="Navigasi utama"
          className="hidden md:flex md:w-[244px] lg:w-[260px] shrink-0 sticky top-0 h-screen flex-col border-r border-sep apple-bar select-none"
        >
          {sidebarHeader && <div className="shrink-0 px-4 pt-4 pb-3">{sidebarHeader}</div>}

          <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
            {sidebarSections.map((sec, sIdx) => (
              <div key={sec.title ?? sIdx}>
                {sec.title && (
                  <div className="px-2.5 pb-1.5 text-caption2 font-semibold uppercase tracking-[0.06em] text-label-3">
                    {sec.title}
                  </div>
                )}
                <div className="space-y-0.5">
                  {sec.items.map((item) => {
                    const active = item.key === activeKey;
                    const color = item.color ?? "blue";
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onSelectKey(item.key)}
                        aria-current={active ? "page" : undefined}
                        className={cx(
                          "group flex min-h-[44px] w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-subhead transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                          active
                            ? cx("font-semibold", AKSEN_TILE[color].pill)
                            : "font-medium text-label-2 hover:bg-fill/70 hover:text-label"
                        )}
                      >
                        <IconBadge color={color} size="sm" variant={active ? "solid" : "tinted"}>
                          {item.icon}
                        </IconBadge>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.dot && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-positive" />}
                        {item.badge !== undefined && (
                          <span className="shrink-0 rounded-full bg-fill px-1.5 py-0.5 text-caption2 font-semibold tabular-nums text-label-2">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {sidebarFooter && <div className="shrink-0 border-t border-sep px-3 py-3">{sidebarFooter}</div>}
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {topBar && (
          floatingTopBar ? (
            <header
              className={cx(
                "fixed top-0 right-0 z-30 pointer-events-none",
                hasSidebar ? "left-0 md:left-[244px] lg:left-[260px]" : "left-0"
              )}
            >
              <div className="pointer-events-auto">{topBar}</div>
            </header>
          ) : (
            <header className="sticky top-0 z-30 border-b border-sep apple-bar pt-[env(safe-area-inset-top)]">
              <div className={cx("mx-auto w-full px-4 md:px-6 lg:px-8", MAX_LEBAR[maxWidth])}>{topBar}</div>
            </header>
          )
        )}

        <main
          style={floatingTopBar && topBar ? { paddingTop: "calc(var(--app-header-height, 148px) + 14px)" } : undefined}
          className={cx(
            "mx-auto w-full flex-1 px-4 py-4 md:px-6 md:py-6 lg:px-8 space-y-5 sm:space-y-6",
            hasBottomTabs ? "pb-[calc(92px+env(safe-area-inset-bottom))] md:pb-10" : "pb-10",
            MAX_LEBAR[maxWidth]
          )}
        >
          {children}
        </main>
      </div>

      {hasBottomTabs && (
        <nav
          aria-label="Tab navigasi"
          className="md:hidden fixed inset-x-0 bottom-0 z-40 px-4 pt-1 pb-[max(10px,env(safe-area-inset-bottom))] pointer-events-none select-none"
        >
          <div className="mx-auto max-w-md pointer-events-auto rounded-full apple-glass border border-[var(--ui-glass-border)] shadow-float p-1">
            {/* 5 tab: celah & padding dirapatkan supaya label (Monitoring, Pembukuan) tetap utuh di HP 360px */}
            <div className={cx("grid", mobileTabs.length >= 5 ? "gap-0.5" : "gap-1")} style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0, 1fr))` }}>
              {mobileTabs.map((item) => {
                const active = item.key === (mobileActiveKey ?? activeKey);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onSelectKey(item.key)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-full py-1 transition duration-200",
                      mobileTabs.length >= 5 ? "px-0" : "px-2",
                      " active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                      active
                        ? "bg-[var(--ui-fill-2)] text-tint shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                        : "text-label-2 hover:text-label"
                    )}
                  >
                    <span className="relative flex h-6 w-6 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                      {item.icon}
                      {item.dot && <span aria-hidden className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-negative ring-2 ring-surface" />}
                    </span>
                    <span className={cx("max-w-full truncate text-caption2 leading-tight", active ? "font-semibold" : "font-medium")}>
                      {item.shortLabel ?? item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}
    </div>
  );
};

/** Kepala halaman bergaya iOS Large Title / macOS View Header. */
export const PageHeader: React.FC<{
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconColor?: WarnaIkon;
  badge?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}> = ({ eyebrow, title, subtitle, icon, iconColor = "blue", badge, right, className }) => (
  <div className={cx("flex flex-wrap items-center justify-between gap-3", className)}>
    <div className="flex min-w-0 items-center gap-3">
      {icon && (
        <IconBadge color={iconColor} className="h-9 w-9 rounded-[10px] [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </IconBadge>
      )}
      <div className="min-w-0">
        {eyebrow && <div className="text-caption2 font-semibold uppercase tracking-[0.06em] text-label-2">{eyebrow}</div>}
        <div className="flex items-center gap-2">
          <h1 className="truncate font-display text-title2 sm:text-title1 text-label">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="truncate text-footnote text-label-2">{subtitle}</p>}
      </div>
    </div>
    {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
  </div>
);
