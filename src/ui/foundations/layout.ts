/**
 * Layout Guides — standar margin, celah, radius, dan target sentuh (Apple iOS 27 UI Kit).
 */
export const LAYOUT = {
  /** Padding halaman utama: HP 16px (`px-4`), tablet/desktop 24–32px. */
  pagePadding: "px-4 py-4 md:px-6 md:py-6 lg:px-8",
  /** Padding dalam kartu: HP 16px, desktop 20px (`p-4 sm:p-5`). */
  cardPadding: "p-4 sm:p-5",
  /** Celah vertikal antar kartu kaca / seksi. */
  stackGap: "space-y-4 sm:space-y-5",
  /** Celah standar antar tile di grid. */
  gridGap: "gap-2.5 sm:gap-3",
  /** Target sentuh minimum Apple HIG (`44×44px`). */
  touchMin: "min-h-[44px]",
} as const;
