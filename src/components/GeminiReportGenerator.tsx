import { useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { HistoryItem } from "../lib/types";
import { buatLaporanHarian } from "../lib/laporan";
import { Button, Card } from "../ui";

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
    <div className="w-full">
      <Card
        variant="hero"
        accent="indigo"
        icon={<Sparkles />}
        iconColor="indigo"
        title="AI Report Generator"
        subtitle="Tinggal pencet tombol aja, sistem hitung otomatis!"
        accessory={
          <div className="flex flex-wrap items-center gap-2">
            {!report ? (
              <Button
                variant="filled"
                size="md"
                onClick={generateLaporan}
                loading={loading}
                icon={!loading ? <Sparkles className="w-4 h-4" /> : undefined}
              >
                {loading ? "Sedang Memproses..." : "Generate Laporan"}
              </Button>
            ) : (
              <>
                <Button variant="gray" size="md" onClick={() => setReport("")}>
                  Reset
                </Button>
                <Button
                  variant="filled"
                  size="md"
                  onClick={copyToClipboard}
                  icon={copied ? <Check className="w-4 h-4 text-positive" /> : <Copy className="w-4 h-4" />}
                >
                  {copied ? "Disalin!" : "Salin Laporan"}
                </Button>
              </>
            )}
          </div>
        }
      >
        {report && (
          <div className="rounded-tile apple-tile ring-1 ring-edge overflow-hidden">
            <div className="h-9 apple-bar border-b border-sep flex items-center justify-between px-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57] shadow-xs" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E] shadow-xs" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#28C840] shadow-xs" />
              </div>
              <span className="text-caption2 font-semibold uppercase tracking-[0.06em] text-label-3">
                Laporan Harian
              </span>
            </div>
            <textarea
              readOnly
              value={report}
              aria-label="Hasil Laporan Harian"
              className="w-full h-[400px] p-4 sm:p-5 text-[16px] sm:text-footnote leading-relaxed font-mono text-label bg-transparent focus:outline-none resize-none selection:bg-tint/20"
            />
          </div>
        )}
      </Card>
    </div>
  );
}