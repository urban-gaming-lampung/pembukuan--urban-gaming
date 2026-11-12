import React, { useState } from "react";
import { HistoryItem } from "../lib/types";
import { kategoriBarisUsaha } from "../lib/pemasukanUsaha";
import { sebutHen } from "../lib/posPembukuan";

// Helper format "1.919k"
const formatK = (num: number) => {
  if (num === 0) return "";
  const k = num / 1000;
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(k) + "k";
};
const formatK0 = (num: number) => formatK(num) || "0";

// Helper format uang Rupiah penuh
const formatRp = (num: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
};

// Helper format tanggal pendek untuk list (dd/mm/yy)
const formatDateShort = (dateString: string) => {
  try {
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch { return dateString; }
};

const toNum = (v: unknown) => Number(String(v ?? "").replace(/\D/g, "")) || 0;

/** Target pemasukan rental + jasa per hari. Target mingguan = target harian × jumlah hari. */
export const TARGET_HARIAN = 350000;

/**
 * Pemasukan satu hari untuk laporan karyawan: RENTAL (sewa + harian + jajanan) dan
 * JASA (isi game, HEN, servis). Penjualan barang (unit, stik, aksesoris) tidak ikut —
 * uangnya langsung ke owner, dan modal / laba tidak dibagikan ke karyawan.
 */
const rincianHari = (h: any) => {
  const sewa = toNum(h?.totalSewa);
  const harian = toNum(h?.totalHarian);
  const jajanan = toNum(h?.totalJajanan);
  let isiGame = 0, hen = 0, servis = 0;
  (Array.isArray(h?.rowsJasaAks) ? h.rowsJasaAks : []).forEach((r: any) => {
    const v = toNum(r?.harga);
    if (v <= 0) return;
    const { kategori, barang } = kategoriBarisUsaha(r.tipe, r.ket);
    if (barang) return;
    if (kategori === "Isi Game") isiGame += v;
    else if (/hen/i.test(String(r.tipe || "")) || sebutHen(r.ket)) hen += v;
    else servis += v;
  });
  const rental = sewa + harian + jajanan;
  const jasa = isiGame + hen + servis;
  return { sewa, harian, jajanan, isiGame, hen, servis, rental, jasa, total: rental + jasa };
};

export default function GeminiReportGenerator({
  history,
  currentDate,
  currentData,
}: {
  history: HistoryItem[];
  currentDate: string; // Format YYYY-MM-DD
  currentData?: any;
}) {
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateLaporan = () => {
    setLoading(true);
    setCopied(false);

    setTimeout(() => {
      // Tanggal yang dipilih di form = acuan laporan (bukan jam sekarang)
      const [ay, am, ad] = String(currentDate || "").split("-").map(Number);
      const anchorDate = ay && am && ad ? new Date(ay, am - 1, ad) : new Date();
      const currentMonth = anchorDate.getMonth();
      const currentYear = anchorDate.getFullYear();
      const anchorDay = anchorDate.getDate();
      const prefixBulan = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-`;

      // 1. Pembukuan bulan ini s/d tanggal terpilih. Hari terpilih yang belum disimpan memakai data form.
      const monthHistory: any[] = history
        .filter((h) => String(h.tanggal).startsWith(prefixBulan) && h.tanggal <= currentDate)
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
      const savedToday = history.find((h) => h.tanggal === currentDate);
      if (!savedToday && currentData && String(currentDate).startsWith(prefixBulan)) {
        monthHistory.push({ ...currentData, tanggal: currentDate });
      }
      const todayItem: any = savedToday || currentData;

      // 2. Hitung per hari, rekap bulan, setor & pengeluaran
      const dataMap: Record<number, number> = {};
      const rekap = { sewa: 0, harian: 0, jajanan: 0, isiGame: 0, hen: 0, servis: 0, rental: 0, jasa: 0, total: 0 };
      let hariTerisi = 0;
      let strSetor = "";
      let strPengeluaranList = "";
      let monthTotalCash = 0;
      let monthTotalTransfer = 0;
      let monthTotalPengeluaran = 0;

      monthHistory.forEach((h) => {
        const dateNum = Number(String(h.tanggal).slice(8, 10));
        const r = rincianHari(h);
        dataMap[dateNum] = (dataMap[dateNum] || 0) + r.total;
        (Object.keys(rekap) as (keyof typeof rekap)[]).forEach((k) => { rekap[k] += r[k]; });
        if (r.total > 0) hariTerisi++;

        monthTotalCash += Number(h.totalCash) || 0;
        monthTotalTransfer += Number(h.totalTransfer) || 0;

        if (Array.isArray(h.rowsSetoran)) {
          h.rowsSetoran.forEach((s: any) => {
            const nom = toNum(s.harga);
            if (nom > 0) strSetor += `${formatDateShort(s.tanggal || h.tanggal)} - ${s.ket || "Setoran"} - ${formatRp(nom)}\n`;
          });
        }
        if (Array.isArray(h.rowsPengeluaran)) {
          h.rowsPengeluaran.forEach((p: any) => {
            const nom = toNum(p.harga);
            if (nom > 0) {
              monthTotalPengeluaran += nom;
              strPengeluaranList += `${formatDateShort(p.tanggal || h.tanggal)} - ${p.ket || "Pengeluaran"} - ${formatRp(nom)}\n`;
            }
          });
        }
      });

      // Total saldo bulan ini (kas cash + transfer − pengeluaran), sama seperti sebelumnya
      const totalSaldoBulanIni = (monthTotalCash + monthTotalTransfer) - monthTotalPengeluaran;

      // 3. Hari ini
      const hariIni = todayItem ? rincianHari(todayItem) : null;
      let hariIniPengeluaran = 0;
      if (todayItem && Array.isArray(todayItem.rowsPengeluaran)) {
        todayItem.rowsPengeluaran.forEach((p: any) => { hariIniPengeluaran += toNum(p.harga); });
      }
      const hariIniKotor = hariIni?.total || 0;
      const hariIniBersih = hariIniKotor - hariIniPengeluaran;
      // Saldo yang harus disetor = kas cash hari itu (rental + jasa), sama seperti sebelumnya
      const hariIniHarusSetor = Math.max(0, Number(todayItem?.totalCash) || 0);

      // 4. Susun teks
      const headerDateStr = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(anchorDate);
      const GARIS = "==============================\n";
      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
      const minggu: [number, number][] = [[1, 7], [8, 14], [15, 21], [22, Math.min(28, lastDay)]];
      if (lastDay >= 29) minggu.push([29, lastDay]);

      let text = `📌 LAPORAN RENTAL & JASA URBAN\n`;
      text += `🗓 ${headerDateStr}\n`;
      text += `🎯 Target: ${formatRp(TARGET_HARIAN)}/hari · ${formatRp(TARGET_HARIAN * 7)}/minggu\n`;
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
      text += `*SETOR*\n`;
      text += strSetor || "-\n";

      text += GARIS;
      text += `*PENGELUARAN*\n`;
      text += strPengeluaranList || "-\n";

      text += GARIS;
      text += `HARI INI\n`;
      text += `Pemasukan kotor : ${formatRp(hariIniKotor)}\n`;
      text += `Pengeluaran : -${formatRp(hariIniPengeluaran)}\n`;
      text += `Pemasukan bersih : ${formatRp(hariIniBersih)}\n`;
      text += `Saldo harus disetor : ${formatRp(hariIniHarusSetor)}\n`;
      text += `Total saldo bulan ini : ${formatRp(totalSaldoBulanIni)}\n`;

      setReport(text);
      setLoading(false);
    }, 600);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- UI COMPONENTS ---
  return (
    <div className="w-full mt-6">
      <div className="group relative overflow-hidden rounded-[32px] bg-white/80 dark:bg-zinc-900/60 backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-xl shadow-black/5 transition-all duration-500">

        <div className="relative z-10 p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
              <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7 text-white drop-shadow-md">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                AI Report Generator
              </h3>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                Tinggal pencet tombol aja, sistem hitung otomatis!
              </p>
            </div>
          </div>

          <div className="flex w-full md:w-auto gap-3">
            {!report ? (
              <button
                onClick={generateLaporan}
                disabled={loading}
                className={`group/btn relative w-full md:w-auto h-11 px-6 flex items-center justify-center gap-2 rounded-full font-medium text-white shadow-md transition-all duration-300 active:scale-95
                  ${loading
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed shadow-none"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:shadow-blue-500/30"
                  }`}
              >
                {loading ? "Sedang Memproses..." : "✨ Generate Laporan"}
              </button>
            ) : (
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setReport("")}
                  className="flex-1 md:flex-none h-11 px-5 rounded-full text-sm font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors active:scale-95"
                >
                  Reset
                </button>
                <button
                  onClick={copyToClipboard}
                  className={`flex-1 md:flex-none h-11 px-6 rounded-full font-medium text-white shadow-md transition-all duration-300 active:scale-95 flex items-center justify-center gap-2
                    ${copied
                      ? "bg-emerald-500 shadow-emerald-500/30"
                      : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/30"
                    }`}
                >
                  {copied ? "Disalin!" : "Salin Laporan"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`relative overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${report ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"}`}>
          {report && (
            <div className="p-6 sm:p-8 pt-0">
              <div className="relative rounded-2xl bg-zinc-50 dark:bg-black/40 ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-9 bg-white/50 dark:bg-white/5 border-b border-black/5 dark:border-white/5 flex items-center px-4 gap-1.5 z-10 backdrop-blur-md">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-sm"></div>
                  <div className="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-sm"></div>
                  <div className="w-3 h-3 rounded-full bg-[#28C840] shadow-sm"></div>
                </div>

                <textarea
                  readOnly
                  value={report}
                  className="w-full h-[400px] mt-9 p-6 text-[13px] leading-relaxed font-mono text-zinc-700 dark:text-zinc-300 bg-transparent focus:outline-none resize-none selection:bg-blue-500/20"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}