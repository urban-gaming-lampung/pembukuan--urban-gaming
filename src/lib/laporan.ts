/**
 * LAPORAN TEKS HARIAN (WhatsApp grup & halaman "LAPORAN TEXT" di PDF) — satu sumber.
 *
 * Pemasukan untuk laporan karyawan: RENTAL (sewa + harian + jajanan) dan JASA (isi game,
 * HEN, servis). Penjualan barang (unit, stik, aksesoris) tidak ikut — uangnya langsung ke
 * owner, dan modal / laba tidak dibagikan ke karyawan.
 */
import type { HistoryItem } from "./types";
import { formatK, rupiah, tanggalAngka, toInt } from "./format";
import { dariYmd } from "./dateLocal";
import { kategoriBarisUsaha } from "./pemasukanUsaha";
import { sebutHen } from "./posPembukuan";
import { pemasukanRental } from "./keuangan";
import { ongkirBaris } from "./sewa";

/** Target pemasukan rental + jasa per hari. Target mingguan = target harian × jumlah hari. */
export const TARGET_HARIAN = 350000;

const formatK0 = (n: number) => formatK(n) || "0";

/** Minggu ke- dalam bulan: 1–7, 8–14, 15–21, 22–28, 29–akhir bulan (Minggu 5). */
export const mingguKe = (tanggalKe: number) => Math.min(5, Math.max(1, Math.ceil(tanggalKe / 7)));

/** Rentang tanggal tiap minggu dalam bulan (Minggu 5 hanya bila bulan punya tanggal 29+). */
export const rentangMinggu = (hariTerakhir: number): [number, number][] => {
  const out: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, Math.min(28, hariTerakhir)]];
  if (hariTerakhir >= 29) out.push([29, hariTerakhir]);
  return out;
};

/**
 * Pemasukan satu hari untuk laporan: rental (sewa + ongkir + harian + jajanan) + jasa (isi game, HEN, servis).
 * Rental = Analitik › Rental › Uang masuk (pemasukanRental); pembagian Sewa PS / Ongkir sama dengan Analitik.
 */
export function rincianHariLaporan(h: any) {
  const ongkirSewa = (Array.isArray(h?.rowsSewa) ? h.rowsSewa : []).reduce((a: number, r: any) => a + Math.min(ongkirBaris(r), Math.max(0, toInt(r?.harga))), 0);
  const ongkirHarian = (Array.isArray(h?.rowsHarian) ? h.rowsHarian : []).reduce((a: number, r: any) => a + Math.min(Math.max(0, toInt(r?._ongkir)), Math.max(0, toInt(r?.harga))), 0);
  const sewa = toInt(h?.totalSewa) - ongkirSewa;
  const harian = toInt(h?.totalHarian) - ongkirHarian;
  const ongkir = ongkirSewa + ongkirHarian;
  const jajanan = toInt(h?.totalJajanan);
  let isiGame = 0, hen = 0, servis = 0;
  (Array.isArray(h?.rowsJasaAks) ? h.rowsJasaAks : []).forEach((r: any) => {
    const v = toInt(r?.harga);
    if (v <= 0) return;
    const { kategori, barang } = kategoriBarisUsaha(r.tipe, r.ket);
    if (barang) return;
    if (kategori === "Isi Game") isiGame += v;
    else if (sebutHen(r.tipe) || sebutHen(r.ket)) hen += v;
    else servis += v;
  });
  const rental = pemasukanRental(h || {});
  const jasa = isiGame + hen + servis;
  return { sewa, ongkir, harian, jajanan, isiGame, hen, servis, rental, jasa, total: rental + jasa };
}

/**
 * Rekap bulan berjalan s.d. tanggal terpilih — SATU sumber untuk laporan teks (WA) & PDF.
 * Hari terpilih yang belum disimpan memakai data form (`dataForm`).
 */
export function rekapBulanLaporan(history: HistoryItem[], tanggal: string, dataForm?: any) {
  const prefixBulan = String(tanggal).slice(0, 8);
  const monthHistory: any[] = history
    .filter((h) => String(h.tanggal).startsWith(prefixBulan) && h.tanggal <= tanggal)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const savedToday = history.find((h) => h.tanggal === tanggal);
  if (!savedToday && dataForm) monthHistory.push({ ...dataForm, tanggal });
  const todayItem: any = savedToday || dataForm || null;

  const dataMap: Record<number, number> = {};
  const rekap = { sewa: 0, ongkir: 0, harian: 0, jajanan: 0, isiGame: 0, hen: 0, servis: 0, rental: 0, jasa: 0, total: 0 };
  const listSetor: { tanggal: string; ket: string; nom: number }[] = [];
  const listKeluar: { tanggal: string; ket: string; nom: number }[] = [];
  let hariTerisi = 0;
  monthHistory.forEach((h) => {
    const r = rincianHariLaporan(h);
    const dateNum = Number(String(h.tanggal).slice(8, 10));
    dataMap[dateNum] = (dataMap[dateNum] || 0) + r.total;
    (Object.keys(rekap) as (keyof typeof rekap)[]).forEach((k) => { rekap[k] += r[k]; });
    if (r.total > 0) hariTerisi++;
    (Array.isArray(h.rowsSetoran) ? h.rowsSetoran : []).forEach((x: any) => {
      const nom = toInt(x?.harga || x?.nominal);
      if (nom > 0) listSetor.push({ tanggal: x.tanggal || h.tanggal, ket: x.ket || "Setoran", nom });
    });
    (Array.isArray(h.rowsPengeluaran) ? h.rowsPengeluaran : []).forEach((x: any) => {
      const nom = toInt(x?.harga || x?.nominal);
      if (nom > 0) listKeluar.push({ tanggal: x.tanggal || h.tanggal, ket: x.ket || "Pengeluaran", nom });
    });
  });
  const pengeluaran = listKeluar.reduce((a, x) => a + x.nom, 0);
  const totalSetor = listSetor.reduce((a, x) => a + x.nom, 0);

  const hariIni = todayItem ? rincianHariLaporan(todayItem) : null;
  const pengeluaranHariIni = (Array.isArray(todayItem?.rowsPengeluaran) ? todayItem.rowsPengeluaran : []).reduce((a: number, x: any) => a + toInt(x?.harga || x?.nominal), 0);
  // Harus disetor = baris Setoran hari itu (dihitung form pembukuan: kas tunai − pengeluaran tunai manual)
  const setoranHariIni = toInt(Array.isArray(todayItem?.rowsSetoran) ? (todayItem.rowsSetoran[0]?.harga ?? todayItem.rowsSetoran[0]?.nominal) : 0);

  return {
    monthHistory, todayItem, dataMap, rekap, hariTerisi, listSetor, listKeluar, totalSetor,
    /** Pengeluaran admin bulan ini (dicatat di pembukuan harian) */
    pengeluaran,
    /** Rental + jasa − pengeluaran admin (bukan laba: pengeluaran owner & gaji ada di Analitik) */
    bersih: rekap.total - pengeluaran,
    rataRata: hariTerisi ? Math.round(rekap.total / hariTerisi / 1000) * 1000 : 0,
    hariIni: {
      kotor: hariIni?.total || 0,
      pengeluaran: pengeluaranHariIni,
      bersih: (hariIni?.total || 0) - pengeluaranHariIni,
      harusSetor: Math.max(0, setoranHariIni || toInt(todayItem?.totalCash)),
    },
  };
}

/**
 * Susun laporan teks bulan berjalan s.d. tanggal pembukuan terpilih.
 * Hari terpilih yang belum disimpan memakai data form (`dataForm`).
 */
export function buatLaporanHarian(history: HistoryItem[], tanggal: string, dataForm?: any): string {
  const anchorDate = dariYmd(tanggal) || new Date();
  const currentMonth = anchorDate.getMonth();
  const currentYear = anchorDate.getFullYear();
  const anchorDay = anchorDate.getDate();
  const R = rekapBulanLaporan(history, tanggal, dataForm);
  const { dataMap, rekap, hariTerisi, rataRata } = R;
  const strSetor = R.listSetor.map((x) => `${tanggalAngka(x.tanggal)} - ${x.ket} - ${rupiah(x.nom)}\n`).join("");
  const strPengeluaran = R.listKeluar.map((x) => `${tanggalAngka(x.tanggal)} - ${x.ket} - ${rupiah(x.nom)}\n`).join("");

  // 4. Teks
  const headerDateStr = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(anchorDate);
  const GARIS = "==============================\n";
  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const minggu = rentangMinggu(lastDay);

  let text = `📌 LAPORAN RENTAL & JASA URBAN\n`;
  text += `🗓 ${headerDateStr}\n`;
  text += `🎯 Target: ${rupiah(TARGET_HARIAN)}/hari · ${rupiah(TARGET_HARIAN * 7)}/minggu\n`;
  text += GARIS;
  text += `PEMASUKAN HARIAN (Rental + Jasa)\n\n`;

  minggu.forEach(([start, end], idx) => {
    const target = TARGET_HARIAN * (end - start + 1);
    let total = 0;
    text += `Minggu ${idx + 1} (${start}–${end})\n`;
    for (let i = start; i <= end; i++) {
      const val = dataMap[i] || 0;
      total += val;
      text += `${i}. ${val > 0 ? formatK(val) : ""}\n`;
    }
    const status = end <= anchorDay ? (total >= target ? " ✅" : " ❌") : start <= anchorDay ? " ⏳" : "";
    const angka = start > anchorDay ? "-" : formatK0(total);
    text += `Total : ${angka}${status} (target ${formatK(target)})\n\n`;
  });

  text += GARIS;
  text += `REKAP BULAN INI (1–${anchorDay})\n`;
  text += `Rental : ${formatK0(rekap.rental)}\n`;
  text += `• Sewa PS : ${formatK0(rekap.sewa)}\n`;
  if (rekap.ongkir > 0) text += `• Ongkir : ${formatK(rekap.ongkir)}\n`;
  if (rekap.harian > 0) text += `• Harian : ${formatK(rekap.harian)}\n`;
  if (rekap.jajanan > 0) text += `• Jajanan : ${formatK(rekap.jajanan)}\n`;
  text += `Jasa : ${formatK0(rekap.jasa)}\n`;
  text += `• Isi game : ${formatK0(rekap.isiGame)}\n`;
  text += `• Upgrade HEN : ${formatK0(rekap.hen)}\n`;
  if (rekap.servis > 0) text += `• Servis : ${formatK(rekap.servis)}\n`;
  text += `Total pemasukan : ${formatK0(rekap.total)}\n`;
  text += `Pengeluaran admin : -${rupiah(R.pengeluaran)}\n`;
  text += `Pemasukan bersih : ${rupiah(R.bersih)}\n`;
  text += `Rata-rata/hari : ${formatK0(rataRata)}${hariTerisi ? (rataRata >= TARGET_HARIAN ? " ✅" : " ❌") : ""}\n`;

  text += GARIS;
  text += `*SETOR*\n${strSetor || "-\n"}`;
  text += GARIS;
  text += `*PENGELUARAN*\n${strPengeluaran || "-\n"}`;
  text += GARIS;
  text += `HARI INI\n`;
  text += `Pemasukan kotor : ${rupiah(R.hariIni.kotor)}\n`;
  text += `Pengeluaran : -${rupiah(R.hariIni.pengeluaran)}\n`;
  text += `Pemasukan bersih : ${rupiah(R.hariIni.bersih)}\n`;
  text += `Saldo harus disetor : ${rupiah(R.hariIni.harusSetor)}\n`;
  text += `Pemasukan bersih bulan ini : ${rupiah(R.bersih)}\n`;
  return text;
}

/** Versi untuk PDF (font standar hanya ASCII): emoji status diganti teks. */
export const laporanUntukPdf = (teks: string) =>
  teks
    .replace(/📌\s?/g, "")
    .replace(/🗓\s?/g, "")
    .replace(/🎯\s?/g, "")
    .replace(/✅/g, "[OK]")
    .replace(/❌/g, "[X]")
    .replace(/⏳/g, "[..]");
