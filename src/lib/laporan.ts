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

/** Pemasukan satu hari untuk laporan: rental (sewa + harian + jajanan) + jasa (isi game, HEN, servis). */
export function rincianHariLaporan(h: any) {
  const sewa = toInt(h?.totalSewa);
  const harian = toInt(h?.totalHarian);
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
  const rental = sewa + harian + jajanan;
  const jasa = isiGame + hen + servis;
  return { sewa, harian, jajanan, isiGame, hen, servis, rental, jasa, total: rental + jasa };
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
  const prefixBulan = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-`;

  // 1. Pembukuan bulan ini s/d tanggal terpilih
  const monthHistory: any[] = history
    .filter((h) => String(h.tanggal).startsWith(prefixBulan) && h.tanggal <= tanggal)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  const savedToday = history.find((h) => h.tanggal === tanggal);
  if (!savedToday && dataForm && String(tanggal).startsWith(prefixBulan)) monthHistory.push({ ...dataForm, tanggal });
  const todayItem: any = savedToday || dataForm;

  // 2. Per hari, rekap bulan, setor & pengeluaran
  const dataMap: Record<number, number> = {};
  const rekap = { sewa: 0, harian: 0, jajanan: 0, isiGame: 0, hen: 0, servis: 0, rental: 0, jasa: 0, total: 0 };
  let hariTerisi = 0;
  let strSetor = "";
  let strPengeluaran = "";
  let kasBulan = 0;
  let pengeluaranBulan = 0;

  monthHistory.forEach((h) => {
    const dateNum = Number(String(h.tanggal).slice(8, 10));
    const r = rincianHariLaporan(h);
    dataMap[dateNum] = (dataMap[dateNum] || 0) + r.total;
    (Object.keys(rekap) as (keyof typeof rekap)[]).forEach((k) => { rekap[k] += r[k]; });
    if (r.total > 0) hariTerisi++;
    kasBulan += toInt(h.totalCash) + toInt(h.totalTransfer);
    (Array.isArray(h.rowsSetoran) ? h.rowsSetoran : []).forEach((s: any) => {
      const nom = toInt(s.harga);
      if (nom > 0) strSetor += `${tanggalAngka(s.tanggal || h.tanggal)} - ${s.ket || "Setoran"} - ${rupiah(nom)}\n`;
    });
    (Array.isArray(h.rowsPengeluaran) ? h.rowsPengeluaran : []).forEach((p: any) => {
      const nom = toInt(p.harga);
      if (nom <= 0) return;
      pengeluaranBulan += nom;
      strPengeluaran += `${tanggalAngka(p.tanggal || h.tanggal)} - ${p.ket || "Pengeluaran"} - ${rupiah(nom)}\n`;
    });
  });

  // Total saldo bulan ini = kas cash + transfer − pengeluaran
  const saldoBulan = kasBulan - pengeluaranBulan;

  // 3. Hari ini
  const hariIni = todayItem ? rincianHariLaporan(todayItem) : null;
  const pengeluaranHariIni = (Array.isArray(todayItem?.rowsPengeluaran) ? todayItem.rowsPengeluaran : []).reduce((a: number, p: any) => a + toInt(p.harga), 0);
  const kotorHariIni = hariIni?.total || 0;
  // Saldo yang harus disetor = kas cash hari itu (rental + jasa)
  const harusSetor = Math.max(0, toInt(todayItem?.totalCash));

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

  // Dibulatkan ke ribuan supaya mudah dibaca (mis. 397k)
  const rataRata = hariTerisi ? Math.round(rekap.total / hariTerisi / 1000) * 1000 : 0;
  text += GARIS;
  text += `REKAP BULAN INI (1–${anchorDay})\n`;
  text += `Rental : ${formatK0(rekap.rental)}\n`;
  text += `• Sewa PS : ${formatK0(rekap.sewa)}\n`;
  if (rekap.harian > 0) text += `• Harian : ${formatK(rekap.harian)}\n`;
  if (rekap.jajanan > 0) text += `• Jajanan : ${formatK(rekap.jajanan)}\n`;
  text += `Jasa : ${formatK0(rekap.jasa)}\n`;
  text += `• Isi game : ${formatK0(rekap.isiGame)}\n`;
  text += `• Upgrade HEN : ${formatK0(rekap.hen)}\n`;
  if (rekap.servis > 0) text += `• Servis : ${formatK(rekap.servis)}\n`;
  text += `Total : ${formatK0(rekap.total)}\n`;
  text += `Rata-rata/hari : ${formatK0(rataRata)}${hariTerisi ? (rataRata >= TARGET_HARIAN ? " ✅" : " ❌") : ""}\n`;

  text += GARIS;
  text += `*SETOR*\n${strSetor || "-\n"}`;
  text += GARIS;
  text += `*PENGELUARAN*\n${strPengeluaran || "-\n"}`;
  text += GARIS;
  text += `HARI INI\n`;
  text += `Pemasukan kotor : ${rupiah(kotorHariIni)}\n`;
  text += `Pengeluaran : -${rupiah(pengeluaranHariIni)}\n`;
  text += `Pemasukan bersih : ${rupiah(kotorHariIni - pengeluaranHariIni)}\n`;
  text += `Saldo harus disetor : ${rupiah(harusSetor)}\n`;
  text += `Total saldo bulan ini : ${rupiah(saldoBulan)}\n`;
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
