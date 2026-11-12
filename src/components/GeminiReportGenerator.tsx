import { useState } from "react";
import { HistoryItem } from "../lib/types";
import { buatLaporanHarian } from "../lib/laporan";

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
      setReport(buatLaporanHarian(history, currentDate, currentData));
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