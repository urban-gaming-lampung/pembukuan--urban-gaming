import React from "react";
import { Copy, Download, Film, Play } from "lucide-react";
import { Button, Card, Notice, Pill, Sheet } from "../../ui";
import { CATEGORY_COLOR, type MediaItem } from "./mediaHelpers";

const WhatsAppBusinessIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.05 15.68c-1.4 0-2.38-.28-3.08-.72l.44-1.22c.58.35 1.44.62 2.45.62 1.38 0 2.22-.68 2.22-1.68 0-.91-.56-1.46-1.95-1.97-1.78-.66-2.58-1.5-2.58-2.69 0-1.53 1.26-2.67 3.23-2.67 1.15 0 2.05.24 2.58.52l-.43 1.21c-.44-.24-1.17-.46-2.09-.46-1.22 0-1.89.65-1.89 1.45 0 .86.58 1.35 1.95 1.87 1.83.69 2.62 1.54 2.62 2.82 0 1.63-1.28 2.72-3.47 2.72z" />
  </svg>
);

interface MediaShareSheetProps {
  item: MediaItem | null;
  supportsFileShare: boolean;
  prepState: "idle" | "preparing" | "ready" | "error";
  onClose: () => void;
  onShareNow: (item: MediaItem) => void;
  onRetryPrep: () => void;
  onCopyCaption: (caption: string) => void;
  onDownload: (item: MediaItem) => void;
}

/**
 * Pop-up Activity View untuk Share ke Story WhatsApp Business (Apple iOS 27 Grouped Sheet).
 */
export default function MediaShareSheet({
  item,
  supportsFileShare,
  prepState,
  onClose,
  onShareNow,
  onRetryPrep,
  onCopyCaption,
  onDownload,
}: MediaShareSheetProps) {
  return (
    <Sheet
      open={Boolean(item)}
      onClose={onClose}
      title="Kirim ke Story WA Business"
      subtitle="Foto / video beserta caption sekaligus"
      icon={<WhatsAppBusinessIcon className="w-4 h-4" />}
      iconColor="green"
      size="sm"
      variant="grouped"
      zClassName="z-[155]"
    >
      {item && (
        <div className="space-y-3.5">
          {/* Kartu Pratinjau Media */}
          <Card>
            <div className="flex gap-3.5 items-start">
              <div className="w-16 h-20 rounded-[12px] overflow-hidden bg-[#121214] shrink-0 ring-1 ring-edge relative flex items-center justify-center">
                {item.mediaType === "video" ? (
                  <>
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-5 h-5 text-[#E580FF]" />
                    )}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 text-white fill-white" />
                    </div>
                  </>
                ) : (
                  <img src={item.mediaUrl} alt={item.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Pill color={CATEGORY_COLOR[item.category] || "pink"}>{item.category}</Pill>
                  <Pill tone="neutral">{item.aspectRatio}</Pill>
                </div>
                <h4 className="font-semibold text-subhead text-label truncate">{item.title}</h4>
                <p className="text-caption leading-snug text-label-2 line-clamp-2 whitespace-pre-line">
                  {item.caption?.trim() || "Tanpa caption"}
                </p>
              </div>
            </div>
          </Card>

          {!supportsFileShare ? (
            <Notice tone="warning">
              Browser ini tidak mendukung kirim file langsung ke aplikasi (biasanya di laptop/PC). Buka Galeri dari{" "}
              <b>HP</b> untuk kirim ke Story, atau pakai <b>Simpan Media</b> + <b>Salin Caption</b> di bawah.
            </Notice>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onShareNow(item)}
                disabled={prepState !== "ready"}
                className="w-full h-[50px] flex items-center justify-center gap-2.5 rounded-full bg-[#34C759] dark:bg-[#30D158] hover:brightness-[0.96] disabled:bg-fill disabled:text-label-3 text-white font-semibold text-headline shadow-[0_2px_10px_rgba(52,199,89,0.28),inset_0_1px_0_rgba(255,255,255,0.35)] disabled:shadow-none active:scale-[0.985] transition"
              >
                {prepState === "preparing" ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    <span>Menyiapkan file{item.mediaType === "video" ? " video" : ""}…</span>
                  </>
                ) : prepState === "error" ? (
                  <span>File gagal disiapkan</span>
                ) : (
                  <>
                    <WhatsAppBusinessIcon className="w-5 h-5" />
                    <span>Kirim ke Story WA Business</span>
                  </>
                )}
              </button>

              {prepState === "error" && (
                <Notice tone="negative">
                  <div className="flex items-center justify-between gap-2">
                    <span>File tidak bisa diunduh dari server. Cek koneksi lalu coba lagi.</span>
                    <Button variant="destructive" size="sm" onClick={onRetryPrep} className="shrink-0">
                      Coba lagi
                    </Button>
                  </div>
                </Notice>
              )}

              <div className="p-3.5 rounded-tile apple-tile border border-sep">
                <ol className="space-y-1.5 text-caption text-label-2">
                  <li>
                    <b className="text-label">1.</b> Ketuk <b>Kirim</b>, lalu pilih <b>WhatsApp Business</b> di menu
                    share HP.
                  </li>
                  <li>
                    <b className="text-label">2.</b> Pilih <b>Status saya</b> di bagian atas, lalu kirim.
                  </li>
                  <li>
                    <b className="text-label">3.</b> Caption ikut terisi otomatis. Bila kosong, tekan lama kolom caption
                    → <b>Tempel</b> (sudah tersalin).
                  </li>
                </ol>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant="gray"
              size="md"
              icon={<Copy className="w-4 h-4" />}
              onClick={() => onCopyCaption(item.caption)}
              block
            >
              Salin Caption
            </Button>
            <Button
              variant="gray"
              size="md"
              icon={<Download className="w-4 h-4" />}
              onClick={() => onDownload(item)}
              block
            >
              Simpan Media
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
