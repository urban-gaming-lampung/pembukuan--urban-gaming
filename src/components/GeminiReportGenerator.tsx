import React, { useState } from "react";
import { HistoryItem } from "../lib/types";

// Helper format "1.919k"
const formatK = (num: number) => {
  if (num === 0) return "";
  const k = num / 1000;
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(k) + "k";
};

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
      // Gunakan currentDate (tanggal yang dipilih) sebagai acuan waktu, bukan new Date() real-time
      const anchorDate = new Date(currentDate);
      const currentMonth = anchorDate.getMonth();
      const currentYear = anchorDate.getFullYear();

      // 1. FILTER HISTORY BULAN INI SAMPAI TANGGAL TERPILIH
      // Logic: Bulan & Tahun sama, TAPI tanggal tidak boleh melebihi currentDate
      const monthHistory = history.filter((h) => {
        const d = new Date(h.tanggal);
        const sameMonthYear = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        // String comparison "YYYY-MM-DD" works for date limitation
        const isBeforeOrSame = h.tanggal <= currentDate;

        return sameMonthYear && isBeforeOrSame;
      }).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

      // 2. AMBIL DATA HARI INI (Sesuai Tanggal Terpilih)
      // Cari history yang tanggalnya persis sama dengan tanggal yang dipilih user, atau fallback ke live data jika tanggal dipilih adalah tanggal hari ini
      const todayItem = history.find((h) => h.tanggal === currentDate) || currentData;

      // --- CALCULATE WEEKLY DATA & LIST STRING ---
      const dataMap: Record<number, number> = {};

      // String builder untuk Setor & Pengeluaran (Akumulasi Bulan Ini s/d Tanggal Terpilih)
      let strSetor = "";
      let strPengeluaranList = "";

      // Variabel untuk menghitung Total Saldo Bulan Ini (Tanggal 1 - Tanggal Terpilih)
      let monthTotalCash = 0;
      let monthTotalTransfer = 0;
      let monthTotalPengeluaran = 0;

      monthHistory.forEach((h) => {
        const d = new Date(h.tanggal);
        const dateNum = d.getDate();

        // Pemasukan Harian (Omzet per hari)
        const totalHariIni =
          (h.totalHarian || 0) +
          (h.totalJajanan || 0) +
          (h.totalJasaAks || 0) +
          (h.totalSewa || 0);

        dataMap[dateNum] = (dataMap[dateNum] || 0) + totalHariIni;

        // Akumulasi Saldo Bulan Ini
        monthTotalCash += (Number(h.totalCash) || 0);
        monthTotalTransfer += (Number(h.totalTransfer) || 0);

        // Build List Setoran (Bulanan)
        const item = h as any;
        if (Array.isArray(item.rowsSetoran)) {
          item.rowsSetoran.forEach((s: any) => {
            const nom = Number(String(s.harga).replace(/\D/g,"")) || 0;
            if (nom > 0) {
              strSetor += `${formatDateShort(s.tanggal || h.tanggal)} - ${s.ket || "Setoran"} - ${formatRp(nom)}\n`;
            }
          });
        }

        // Build List Pengeluaran (Bulanan) & Hitung Total Pengeluaran Bulan Ini
        if (Array.isArray(item.rowsPengeluaran)) {
          item.rowsPengeluaran.forEach((p: any) => {
            const nom = Number(String(p.harga).replace(/\D/g,"")) || 0;
            if (nom > 0) {
              monthTotalPengeluaran += nom;
              strPengeluaranList += `${formatDateShort(p.tanggal || h.tanggal)} - ${p.ket || "Pengeluaran"} - ${formatRp(nom)}\n`;
            }
          });
        }
      });

      // Hitung Total Saldo Bulan Ini (Sampai tanggal terpilih)
      const totalSaldoBulanIni = (monthTotalCash + monthTotalTransfer) - monthTotalPengeluaran;

      // --- HITUNG LOGIKA SALDO HARI INI (BAGIAN BAWAH) ---
      // Ini mengambil data spesifik dari tanggal yang dipilih (jika ada di history)

      let hariIniPemasukanKotor = 0;
      let hariIniPengeluaran = 0;
      let hariIniPengeluaranCash = 0;
      let hariIniPengeluaranManualCash = 0;
      let hariIniCash = 0;
      let hariIniSetorYa = 0; // Nominal yang sudah di setor (Transfer 'Ya')

      if (todayItem) {
        // 1. Pemasukan Kotor Hari Ini
        hariIniPemasukanKotor =
          (todayItem.totalHarian || 0) +
          (todayItem.totalJajanan || 0) +
          (todayItem.totalJasaAks || 0) +
          (todayItem.totalSewa || 0);

        hariIniCash = Number(todayItem.totalCash) || 0;

        // 2. Pengeluaran Hari Ini
        if (Array.isArray((todayItem as any).rowsPengeluaran)) {
          (todayItem as any).rowsPengeluaran.forEach((p: any) => {
            const nom = Number(String(p.harga).replace(/\D/g, "")) || 0;
            hariIniPengeluaran += nom;
            if (!p.bayar || String(p.bayar).toLowerCase() === "cash") {
              hariIniPengeluaranCash += nom;
              if (!p._autoOngkirKey) {
                 hariIniPengeluaranManualCash += nom;
              }
            }
          });
        }

        // 3. Cek Setoran Hari Ini (Untuk Saldo Belum Setor)
        if (Array.isArray((todayItem as any).rowsSetoran)) {
          (todayItem as any).rowsSetoran.forEach((s: any) => {
            const isTf = String(s.bayar || "").toLowerCase();
            // Jika user bilang "Ya", "Sudah", dsb.
            if (isTf.includes("ya") || isTf.includes("sudah")) {
              hariIniSetorYa += (Number(String(s.harga).replace(/\D/g,"")) || 0);
            }
          });
        }
      }

      // Hitung Pemasukan Bersih Hari Ini
      const hariIniPemasukanBersih = hariIniPemasukanKotor - hariIniPengeluaran;

      // Hitung Saldo Belum Setor (Hanya Hari Ini)
      // KEBIJAKAN BARU (≥ 29 April 2026): Setoran = Total Cash, tanpa dikurangi pengeluaran
      const POLICY_DATE = "2026-04-29";
      const isNewPolicy = currentDate >= POLICY_DATE;
      
      let hariIniBelumSetor: number;
      if (isNewPolicy) {
        // Kebijakan baru: cash - pengeluaran manual cash - sudah setor
        hariIniBelumSetor = hariIniCash - hariIniPengeluaranManualCash - hariIniSetorYa;
      } else {
        // Kebijakan lama: cash - pengeluaran cash - sudah setor
        hariIniBelumSetor = hariIniCash - hariIniSetorYa - hariIniPengeluaranCash;
      }
      if (hariIniBelumSetor < 0) hariIniBelumSetor = 0;


      // --- GENERATE STRING HEADER ---
      // Format tanggal header: dd MMMM yyyy (ex: 17 Februari 2026) -> Menggunakan Anchor Date
      const headerDateStr = new Intl.DateTimeFormat("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }).format(anchorDate);

      let text = `📌 UPDATE PEMASUKAN & KONDISI RENTAL PS URBAN\n`;
      text += `🗓 ${headerDateStr}\n`;
      text += `🎯 Target Harian: Rp250.000\n`;
      text += `🎯 Target Mingguan: Rp1.750.000\n`;
      text += `==============================\n`;
      text += `PEMASUKAN\n`;

      const renderWeek = (start: number, end: number, weekLabel: string) => {
        let weekTotal = 0;
        let weekText = `${weekLabel}\n`;

        for (let i = start; i <= end; i++) {
          const val = dataMap[i] || 0;
          weekTotal += val;
          // Hanya render angka jika ada value (agar rapi), tapi layout minggu tetap full
          weekText += `${i}. ${val > 0 ? formatK(val) : ""}\n`;
        }
        weekText += `Total : ${formatK(weekTotal)}\n\n`;
        return { text: weekText, total: weekTotal };
      };

      const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();

      const w1 = renderWeek(1, 7, "Minggu 1");
      const w2 = renderWeek(8, 14, "Minggu 2");
      const w3 = renderWeek(15, 21, "Minggu 3");
      const w4 = renderWeek(22, lastDay, "Minggu 4");

      text += w1.text;
      text += w2.text;
      text += w3.text;
      text += w4.text;

      text += `==============================\n`;
      text += `TOTAL PEMASUKAN MINGGUAN\n`;
      text += `Minggu 1 : ${formatK(w1.total)}\n`;
      text += `Minggu 2 : ${formatK(w2.total)}\n`;
      text += `Minggu 3 : ${formatK(w3.total)}\n`;
      text += `Minggu 4 : ${formatK(w4.total)}\n`;

      text += `==============================\n`;
      text += `*SETOR*\n`;
      text += strSetor || "";

      text += `==============================\n`;
      text += `*PENGELUARAN*\n`;
      text += strPengeluaranList || "";

      text += `==============================\n`;
      // FOOTER SESUAI REQUEST
      text += `PENGELUARAN HARI INI : -${formatRp(hariIniPengeluaran).replace("Rp", "Rp")}\n`;
      text += `PEMASUKAN KOTOR HARI INI : ${formatRp(hariIniPemasukanKotor)}\n`;
      text += `PEMASUKAN BERSIH HARI INI : ${formatRp(hariIniPemasukanBersih)}\n`;
      text += `SALDO YANG BELUM DI SETOR : ${formatRp(hariIniBelumSetor)}\n`;
      text += `TOTAL SALDO BULAN INI = ${formatRp(totalSaldoBulanIni)}\n`;

      setReport(text);
      setLoading(false);
    }, 1000);
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
                {loading ? "Sedang Memproses..." : "笨ｨ Generate Laporan"}
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