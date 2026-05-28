export type Payment = "Cash" | "QRIS" | "Transfer" | "Lainnya" | "";
export const payOptions: Payment[] = ["Cash", "QRIS", "Transfer", "Lainnya", ""];

export interface RowHarian {
  jenisPS: string;
  jamMasuk: string; 
  jumlahJam: number | string;
  harga: number | string;
  bayar: Payment;
}

export interface RowJajanan {
  jenisJajanan: string;
  qtyJam: string;
  harga: number | string;
  bayar: Payment;
}

export interface RowJasaAks {
  tipe: string;
  ket: string;
  harga: number | string;
  bayar: Payment;
}

export interface RowSewa {
  jenisPS: string;
  lamaSewa: string;
  jamMasukSewa: string;
  ket: string;
  isPaid: "YA" | "TIDAK" | "";
  isOngkir: "YA" | "TIDAK" | "";
  _ongkir: number | string;
  _bayarOngkir: "Cash" | "Transfer" | "";
  harga: number | string;
  bayar: Payment;
  _customDurasi?: string;
  diantarOleh?: string;
  _rowId?: string;
}

export interface HistoryItem {
  id: string;
  tanggal: string;
  hari: string;
  totalHarian: number;
  totalJajanan: number;
  totalJasaAks: number;
  totalSewa: number;
  totalCash?: number;
  totalTransfer?: number;
  catatan?: string;
  rowsHarian?: RowHarian[];
  rowsJajanan?: RowJajanan[];
  rowsJasaAks?: RowJasaAks[];
  rowsSewa?: RowSewa[];
  absenPagi?: string;
  absenSiang?: string;
  rukoBuka?: string;
  rukoTutup?: string;
}

// ✅ WAJIB ADA INI AGAR ERROR PERTAMA HILANG:
export type Price = { label: string; price: number };
export type PriceListKey = "harian" | "jajanan" | "jasaAks" | "sewa";