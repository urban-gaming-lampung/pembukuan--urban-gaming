import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { createPortal } from "react-dom";
import type JsPDF from "jspdf";
import { Check, Copy, Download, ExternalLink, FileText, Lock, Share2 } from "lucide-react";
import { useTampilRincian } from "../lib/tampilRincian";
import type { MasterStokCategories, StokData } from "../hooks/useStokData";
import { rupiah } from "../lib/format";
import { totalPemasukanHarian } from "../lib/keuangan";
import { buatLaporanHarian } from "../lib/laporan";
import { buildLaporanPdf, type PdfExportData } from "../lib/pdfReportBuilder";
import { AKSEN_TILE, Button, IconBadge, MOTION, Notice, Pill, Sheet, Spinner, notify, tile, cx } from "../ui";

type ImageQuality = "Tinggi" | "Hemat";

type Props = {
  rootRef?: React.RefObject<HTMLDivElement>;
  dark?: boolean;
  kualitasGambar: ImageQuality;
  data: PdfExportData;
  stokData?: StokData;
  masterCategories?: MasterStokCategories;
  onStartExport?: () => void;
  onEndExport?: () => void;
};

export type PdfExporterHandle = {
  share: () => Promise<void>;
  /** Muat modul jsPDF lebih awal (mis. saat pop-up cek stok muncul) agar tap "Ya" langsung sinkron ke Web Share API. */
  preload: () => void;
};

type ReadyPdf = {
  file: File;
  blobUrl: string;
  filename: string;
  pageCount: number;
  sizeBytes: number;
  durationMs: number;
  isProtected: boolean;
  canWebShare: boolean;
  gestureExpired: boolean;
  tanggal: string;
  hari: string;
  grandTotal: number;
};

// Cache modul jsPDF di memori sehingga pemanggilan Web Share API kedua dst (atau setelah preload) berjalan 0ms tanpa await jaringan.
let cachedJsPdfCtor: typeof JsPDF | null = null;
let jsPdfLoading: Promise<typeof JsPDF> | null = null;

function preloadJsPdf(): Promise<typeof JsPDF> {
  if (cachedJsPdfCtor) return Promise.resolve(cachedJsPdfCtor);
  if (!jsPdfLoading) {
    jsPdfLoading = import("jspdf")
      .then((m) => {
        cachedJsPdfCtor = m.default;
        return m.default;
      })
      .catch((e) => {
        jsPdfLoading = null;
        throw e;
      });
  }
  return jsPdfLoading;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/**
 * Negosiasi payload Web Share API yang paling kompatibel (Android Chrome, iOS Safari, WebView).
 * Beberapa browser menolak `{ files, title, text }` namun menerima `{ files }`.
 */
function resolveSharePayload(file: File, tanggal: string): ShareData | null {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return null;
  if (typeof navigator.canShare !== "function") return null;
  const withText: ShareData = {
    files: [file],
    title: `Laporan Harian URBAN (${tanggal})`,
    text: `Laporan harian URBAN Gaming Lampung tanggal ${tanggal}`,
  };
  const filesOnly: ShareData = { files: [file] };
  try {
    if (navigator.canShare(withText)) return withText;
  } catch {
    /* lanjut cek filesOnly */
  }
  try {
    if (navigator.canShare(filesOnly)) return filesOnly;
  } catch {
    return null;
  }
  return null;
}

const PdfExporter = forwardRef<PdfExporterHandle, Props>(function PdfExporter(
  { kualitasGambar, data, stokData, masterCategories },
  ref
) {
  const tampil = useTampilRincian();
  const [isGenerating, setIsGenerating] = useState(false);
  const [readyPdf, setReadyPdf] = useState<ReadyPdf | null>(null);
  const [sharingNow, setSharingNow] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  const closeReadySheet = useCallback(() => {
    setReadyPdf((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
    setCopiedText(false);
  }, []);

  // Bersihkan Blob URL saat unmount agar ramah RAM di perangkat low-end
  useEffect(() => {
    return () => {
      setReadyPdf((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return null;
      });
    };
  }, []);

  const triggerDownload = useCallback((target: ReadyPdf) => {
    const a = document.createElement("a");
    a.href = target.blobUrl;
    a.download = target.filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify("PDF berhasil diunduh.", "positive");
  }, []);

  const triggerFreshWebShare = useCallback(async (target: ReadyPdf) => {
    const payload = resolveSharePayload(target.file, target.tanggal);
    if (!payload) {
      triggerDownload(target);
      return;
    }
    setSharingNow(true);
    try {
      await navigator.share(payload);
      notify("Laporan PDF berhasil dibagikan.", "positive");
      closeReadySheet();
    } catch (err: any) {
      if (err?.name === "AbortError" || /cancel/i.test(String(err?.message || ""))) {
        return; // Pengguna menutup menu share sendiri
      }
      console.warn("[PdfExporter] Web Share gagal dari sheet:", err);
      notify("Menu bagikan tidak tersedia di browser ini. Gunakan Unduh PDF.", "warning");
    } finally {
      setSharingNow(false);
    }
  }, [closeReadySheet, triggerDownload]);

  const copyTextReport = useCallback(async () => {
    try {
      const text = buatLaporanHarian(data.history, data.tanggal, data);
      await navigator.clipboard.writeText(text);
      setCopiedText(true);
      notify("Laporan teks WhatsApp disalin.", "positive");
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      notify("Gagal menyalin teks laporan.", "warning");
    }
  }, [data]);

  const shareOrOpenSheet = useCallback(async () => {
    const perluLoad = !cachedJsPdfCtor;
    if (perluLoad) setIsGenerating(true);

    try {
      // Bila sudah di-preload saat pop-up cek stok terbuka, ini langsung sinkron tanpa menunggu jaringan!
      const JsPDFCtor = cachedJsPdfCtor || (await preloadJsPdf());
      const built = buildLaporanPdf(JsPDFCtor, {
        data,
        stokData,
        masterCategories,
        kualitasGambar,
        tampil,
      });

      if (perluLoad) setIsGenerating(false);

      const file = new File([built.blob], built.filename, {
        type: "application/pdf",
        lastModified: Date.now(),
      });
      const payload = resolveSharePayload(file, data.tanggal);
      const canWebShare = payload !== null;

      // Coba panggil Web Share API langsung selama user-gesture masih aktif!
      if (payload) {
        try {
          await navigator.share(payload);
          notify(`PDF (${formatBytes(built.sizeBytes)}) siap dibagikan.`, "positive");
          return;
        } catch (shareErr: any) {
          // Pengguna membatalkan menu share OS: selesai dengan tenang
          if (shareErr?.name === "AbortError" || /cancel/i.test(String(shareErr?.message || ""))) {
            return;
          }
          // NotAllowedError (gesture kedaluwarsa di HP lambat / cold load): tampilkan Sheet dengan tombol Bagikan 1 ketuk!
          console.warn("[PdfExporter] Direct Web Share tertunda, membuka Sheet siap-bagikan:", shareErr);
          const blobUrl = URL.createObjectURL(built.blob);
          setReadyPdf((prev) => {
            if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
            return {
              file,
              blobUrl,
              filename: built.filename,
              pageCount: built.pageCount,
              sizeBytes: built.sizeBytes,
              durationMs: built.durationMs,
              isProtected: built.isProtected,
              canWebShare: true,
              gestureExpired: shareErr?.name === "NotAllowedError",
              tanggal: data.tanggal,
              hari: data.hari,
              grandTotal: totalPemasukanHarian(data),
            };
          });
          return;
        }
      }

      // Perangkat/browser tanpa Web Share file (mis. desktop browser): buka Sheet Apple iOS 27 (Unduh / Lihat / Salin Teks)
      const blobUrl = URL.createObjectURL(built.blob);
      setReadyPdf((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return {
          file,
          blobUrl,
          filename: built.filename,
          pageCount: built.pageCount,
          sizeBytes: built.sizeBytes,
          durationMs: built.durationMs,
          isProtected: built.isProtected,
          canWebShare,
          gestureExpired: false,
          tanggal: data.tanggal,
          hari: data.hari,
          grandTotal: totalPemasukanHarian(data),
        };
      });
    } catch (err: any) {
      console.error("[PdfExporter] Critical PDF Generation Error:", err);
      notify(`Gagal membuat PDF: ${err?.message || "Terjadi kesalahan"}`, "negative");
    } finally {
      setIsGenerating(false);
    }
  }, [data, stokData, masterCategories, kualitasGambar, tampil]);

  useImperativeHandle(
    ref,
    () => ({
      share: shareOrOpenSheet,
      preload: () => {
        preloadJsPdf().catch(() => {});
      },
    }),
    [shareOrOpenSheet]
  );

  return (
    <>
      {/* Overlay ringan hanya tampil saat modul jsPDF pertama kali dimuat dari jaringan */}
      {isGenerating &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6" role="dialog" aria-modal="true">
            <div className={`absolute inset-0 bg-black/45 dark:bg-black/75 backdrop-blur-[8px] ${MOTION.backdrop}`} />
            <div
              className={`relative z-10 w-full max-w-[300px] apple-sheet rounded-sheet p-6 shadow-float border border-white/65 dark:border-white/[0.14] ring-1 ring-black/10 dark:ring-white/10 flex flex-col items-center text-center gap-3 ${MOTION.dialog}`}
            >
              <IconBadge color="blue" variant="tinted" className="h-12 w-12 rounded-full [&>svg]:h-6 [&>svg]:w-6">
                <FileText />
              </IconBadge>
              <div className="space-y-1">
                <h3 className="text-headline text-label">Menyiapkan PDF</h3>
                <p className="text-footnote text-label-2">Membuat dokumen vektor ringan...</p>
              </div>
              <Spinner />
            </div>
          </div>,
          document.body
        )}

      {/* Apple iOS 27 Sheet: PDF Siap Dibagikan (fresh-gesture Web Share + Unduh + Pratinjau) */}
      <Sheet
        open={Boolean(readyPdf)}
        onClose={() => !sharingNow && closeReadySheet()}
        title="Laporan PDF Siap"
        subtitle={readyPdf ? `${readyPdf.hari}, ${readyPdf.tanggal}` : undefined}
        icon={<FileText />}
        iconColor="blue"
        size="sm"
        zClassName="z-[9998]"
      >
        {readyPdf && (
          <div className="space-y-4">
            {/* Kartu pratinjau dokumen */}
            <div className={cx(tile, "p-4 space-y-3")}>
              <div className="flex items-start gap-3">
                <div
                  className={cx(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-field",
                    AKSEN_TILE.blue.iconBg,
                    AKSEN_TILE.blue.iconText
                  )}
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-subhead font-semibold text-label">{readyPdf.filename}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Pill tone="positive">{formatBytes(readyPdf.sizeBytes)}</Pill>
                    <Pill tone="neutral">{readyPdf.pageCount} halaman A4</Pill>
                    {readyPdf.isProtected && (
                      <Pill tone="warning" icon={<Lock className="h-3 w-3" />}>
                        Terkunci PW
                      </Pill>
                    )}
                    {kualitasGambar === "Hemat" && <Pill tone="tint">Mode Hemat</Pill>}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-sep pt-2.5 text-footnote">
                <span className="text-label-2">Total pemasukan</span>
                <span className="font-bold text-label tabular-nums">{rupiah(readyPdf.grandTotal)}</span>
              </div>
            </div>

            {readyPdf.canWebShare && readyPdf.gestureExpired && (
              <Notice tone="info">
                File PDF sudah tersimpan di memori ({formatBytes(readyPdf.sizeBytes)}). Ketuk tombol{" "}
                <strong className="font-semibold text-label">Bagikan PDF</strong> di bawah untuk langsung membuka menu kirim WhatsApp / aplikasi lain.
              </Notice>
            )}

            {/* Tombol aksi utama */}
            <div className="space-y-2.5">
              {readyPdf.canWebShare ? (
                <>
                  <Button
                    variant="filled"
                    size="lg"
                    block
                    icon={<Share2 />}
                    loading={sharingNow}
                    onClick={() => triggerFreshWebShare(readyPdf)}
                  >
                    Bagikan PDF
                  </Button>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button variant="gray" size="md" icon={<Download />} onClick={() => triggerDownload(readyPdf)}>
                      Unduh
                    </Button>
                    <Button
                      variant="gray"
                      size="md"
                      icon={<ExternalLink />}
                      onClick={() => window.open(readyPdf.blobUrl, "_blank", "noopener")}
                    >
                      Lihat PDF
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button variant="filled" size="lg" block icon={<Download />} onClick={() => triggerDownload(readyPdf)}>
                    Unduh PDF
                  </Button>
                  <Button
                    variant="gray"
                    size="md"
                    block
                    icon={<ExternalLink />}
                    onClick={() => window.open(readyPdf.blobUrl, "_blank", "noopener")}
                  >
                    Lihat Pratinjau PDF
                  </Button>
                </>
              )}

              <Button
                variant="tinted"
                size="md"
                block
                icon={copiedText ? <Check /> : <Copy />}
                onClick={copyTextReport}
              >
                {copiedText ? "Laporan Teks Disalin" : "Salin Laporan Teks WA"}
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
});

export default PdfExporter;
