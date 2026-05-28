// src/constants/prices.ts

export type Price = { label: string; price: number };

// --- DEFAULT HARGA ---
export const DEFAULT_HARGA_HARIAN: Price[] = [
  { label: "PS3 per jam", price: 5000 },
  { label: "PS4 per jam", price: 7000 },
];

export const DEFAULT_HARGA_JAJANAN: Price[] = [
  { label: "Kopi Panas Original", price: 3000 },
  { label: "Teh Panas", price: 3000 },
  { label: "Es Teh", price: 3000 },
  { label: "Kopi Kapal Api", price: 3000 },
  { label: "GoodDay Capuchino Panas", price: 4000 },
  { label: "GoodDay Capuchino Dingin", price: 5000 },
  { label: "Luwak White Cofee Panas", price: 4000 },
  { label: "Luwak White Cofee Dingin", price: 5000 },
  { label: "Torabika Moka Panas", price: 4000 },
  { label: "Torabika Moka Dingin", price: 5000 },
  { label: "Marimas", price: 2000 },
  { label: "Nutrisari", price: 3000 },
  { label: "Mie Pakai Telor (Free Nasi)", price: 10000 },
  { label: "Mie Tanpa Telor (Free Nasi)", price: 7000 },
  { label: "Pop Mie (Free Nasi)", price: 8000 },
];

export const DEFAULT_HARGA_JASA_AKS: Price[] = [
  { label: "Sewa Stick Tambahan", price: 5000 },
  { label: "Sewa Headset", price: 5000 },
  { label: "Ganti Kabel HDMI", price: 15000 },
];

export const DEFAULT_HARGA_SEWA: Price[] = [
  { label: "PS3 12 Jam", price: 40000 },
  { label: "PS4 12 Jam", price: 80000 },
  { label: "PS3+TV 12 Jam", price: 60000 },
  { label: "PS4+TV 12 Jam", price: 100000 },
  { label: "PS3 Portable 12 Jam", price: 60000 },
  { label: "PS4 Portable 12 Jam", price: 100000 },
  { label: "Hanya TV 12 Jam", price: 30000 },

  { label: "PS3 1 Hari", price: 70000 },
  { label: "PS4 1 Hari", price: 140000 },
  { label: "PS3+TV 1 Hari", price: 100000 },
  { label: "PS4+TV 1 Hari", price: 170000 },
  { label: "PS3 Portable 1 Hari", price: 100000 },
  { label: "PS4 Portable 1 Hari", price: 170000 },
  { label: "Hanya TV 1 Hari", price: 50000 },

  { label: "PS3 2 Hari", price: 140000 },
  { label: "PS4 2 Hari", price: 280000 },
  { label: "PS3+TV 2 Hari", price: 200000 },
  { label: "PS4+TV 2 Hari", price: 340000 },
  { label: "PS3 Portable 2 Hari", price: 200000 },
  { label: "PS4 Portable 2 Hari", price: 340000 },
  { label: "Hanya TV 2 Hari", price: 100000 },

  { label: "PS3 3 Hari", price: 210000 },
  { label: "PS4 3 Hari", price: 420000 },
  { label: "PS3+TV 3 Hari", price: 300000 },
  { label: "PS4+TV 3 Hari", price: 510000 },
  { label: "PS3 Portable 3 Hari", price: 300000 },
  { label: "PS4 Portable 3 Hari", price: 510000 },
  { label: "Hanya TV 3 Hari", price: 150000 },
];
