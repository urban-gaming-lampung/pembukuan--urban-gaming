export interface PromoRule {
  id: string;
  minGames: number;
  percent: number;
  title: string;
  subtitle: string;
  desc: string;
  platforms?: string[];
}

export interface PromosConfig {
  enabled: boolean;
  targetPlatforms: string[];
  rules: PromoRule[];
  updatedAt?: any;
}

export const DEFAULT_PROMOS_CONFIG: PromosConfig = {
  enabled: true,
  targetPlatforms: ['PS3 CFW/HEN', 'PS4 HEN'],
  rules: [
    {
      id: 'p15',
      minGames: 15,
      percent: 20,
      title: 'Promo 15 Game',
      subtitle: 'Diskon 20%',
      desc: 'Minimal beli 15 game dapat diskon 20% (PS3/PS4). Diskon otomatis dihitung di keranjang.',
    },
    {
      id: 'p10',
      minGames: 10,
      percent: 15,
      title: 'Promo 10 Game',
      subtitle: 'Diskon 15%',
      desc: 'Minimal beli 10 game dapat diskon 15% (PS3/PS4). Diskon otomatis dihitung di keranjang.',
    },
    {
      id: 'p5',
      minGames: 5,
      percent: 10,
      title: 'Promo 5 Game',
      subtitle: 'Diskon 10%',
      desc: 'Minimal beli 5 game dapat diskon 10% (PS3/PS4). Diskon otomatis dihitung di keranjang.',
    },
  ],
};

export interface POSCartItemLike {
  price: number;
  quantity: number;
  platform?: string;
  category: string;
}

export interface POSDiscountCalculationResult {
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  qualifyingCount: number;
  qualifyingSubtotal: number;
  activeRule: PromoRule | null;
  nextRule: PromoRule | null;
  gamesNeededForNext: number;
}

/**
 * Kalkulasi diskon keranjang POS berdasarkan konfigurasi promo SSOT dari List Game
 */
export function calculatePOSDiscount(
  items: POSCartItemLike[],
  config: PromosConfig = DEFAULT_PROMOS_CONFIG
): POSDiscountCalculationResult {
  const subtotal = items.reduce((sum, it) => sum + (it.price || 0) * (it.quantity || 1), 0);

  if (!config || !config.enabled || !Array.isArray(config.rules) || config.rules.length === 0) {
    return {
      subtotal,
      discountPercent: 0,
      discountAmount: 0,
      total: subtotal,
      qualifyingCount: 0,
      qualifyingSubtotal: 0,
      activeRule: null,
      nextRule: null,
      gamesNeededForNext: 0,
    };
  }

  const targetPlatforms = config.targetPlatforms || ['PS3 CFW/HEN', 'PS4 HEN'];

  // Item yang memenuhi syarat: hanya kategori "ISI GAME" dengan platform yang ditentukan
  const qualifyingItems = items.filter((it) => {
    return it.category === 'ISI GAME' && it.platform && targetPlatforms.includes(it.platform);
  });

  const qualifyingCount = qualifyingItems.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const qualifyingSubtotal = qualifyingItems.reduce((acc, it) => acc + (it.price || 0) * (it.quantity || 1), 0);

  // Urutkan rules dari minGames terbesar ke terkecil
  const sortedRules = [...config.rules].sort((a, b) => b.minGames - a.minGames);
  const activeRule = sortedRules.find((r) => qualifyingCount >= r.minGames) || null;

  // Cari rule berikutnya yang belum tercapai (untuk rekomendasi kasir)
  const ascendingRules = [...config.rules].sort((a, b) => a.minGames - b.minGames);
  const nextRule = ascendingRules.find((r) => r.minGames > qualifyingCount) || null;
  const gamesNeededForNext = nextRule ? nextRule.minGames - qualifyingCount : 0;

  const discountPercent = activeRule ? activeRule.percent : 0;
  const discountAmount = Math.floor((qualifyingSubtotal * discountPercent) / 100);
  const total = subtotal - discountAmount;

  return {
    subtotal,
    discountPercent,
    discountAmount,
    total,
    qualifyingCount,
    qualifyingSubtotal,
    activeRule,
    nextRule,
    gamesNeededForNext,
  };
}
