import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Pencil,
  Share,
  Trash2,
  X,
} from "lucide-react";
import { Button, Eyebrow, IconButton, MOTION, Pill, cx } from "../../ui";
import {
  CATEGORY_COLOR,
  formatTimeAgo,
  labelFormatRasio,
  type MediaItem,
} from "./mediaHelpers";

interface MediaPreviewModalProps {
  item: MediaItem | null;
  items: MediaItem[];
  isSuperAdminOrOwner: boolean;
  /** Nonaktifkan pintasan keyboard saat lembar/dialog lain (Edit, Share, Hapus) sedang terbuka di atasnya */
  hasOverlayAbove: boolean;
  onSelect: (item: MediaItem) => void;
  onClose: () => void;
  onShare: (item: MediaItem) => void;
  onCopyCaption: (caption: string) => void;
  onDownload: (item: MediaItem) => void;
  onTogglePin: (item: MediaItem) => void;
  onEdit: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
}

/**
 * Pop-up Pratinjau Story bergaya iPhone (Apple iOS 27 Liquid Glass + Product Bezel).
 * - Stage kiri/atas menampilkan frame HP iPhone Story lengkap (Dynamic Island, bar progress Story,
 *   header URBAN Gaming, caption Story, & Home Indicator).
 * - Panel inspektor kanan/bawah memakai material kaca Apple iOS 27 (.apple-sheet) adaptif Light & Dark Mode.
 */
export default function MediaPreviewModal({
  item,
  items,
  isSuperAdminOrOwner,
  hasOverlayAbove,
  onSelect,
  onClose,
  onShare,
  onCopyCaption,
  onDownload,
  onTogglePin,
  onEdit,
  onDelete,
}: MediaPreviewModalProps) {
  const [justCopied, setJustCopied] = useState(false);

  const currentIdx = item ? items.findIndex((x) => x.id === item.id) : -1;
  const canPrev = currentIdx > 0;
  const canNext = currentIdx >= 0 && currentIdx < items.length - 1;

  useEffect(() => {
    setJustCopied(false);
  }, [item?.id]);

  useEffect(() => {
    if (!item || hasOverlayAbove) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && canPrev) {
        e.preventDefault();
        onSelect(items[currentIdx - 1]);
      } else if (e.key === "ArrowRight" && canNext) {
        e.preventDefault();
        onSelect(items[currentIdx + 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, hasOverlayAbove, onClose, canPrev, canNext, items, currentIdx, onSelect]);

  if (!item || typeof document === "undefined") return null;

  const isPortraitStory = item.aspectRatio === "9:16";
  const isVideo = item.mediaType === "video";

  const handleQuickCopy = () => {
    onCopyCaption(item.caption || "");
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1800);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center sm:p-5 md:p-6 font-sans"
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau Story ${item.title}`}
    >
      {/* Backdrop Apple iOS 27 */}
      <div
        className={cx("absolute inset-0 bg-black/65 dark:bg-black/80 backdrop-blur-xl", MOTION.backdrop)}
        onClick={onClose}
        aria-hidden
      />

      {/* Container Split Sheet (Mobile: Bottom Sheet, Desktop: Floating iOS 27 Split Window) */}
      <div
        className={cx(
          "relative z-10 w-full max-w-5xl max-h-[94vh] md:h-[min(88vh,740px)] flex flex-col md:flex-row overflow-hidden rounded-t-sheet sm:rounded-[34px] shadow-float ring-1 ring-white/25 dark:ring-white/[0.14] border border-white/20 dark:border-white/[0.10] bg-[#0B0B0D]",
          MOTION.sheet
        )}
      >
        {/* Mobile grabber */}
        <div className="flex justify-center pt-2 pb-1 bg-[#0B0B0D] md:hidden shrink-0" aria-hidden>
          <div className="h-[5px] w-9 rounded-full bg-white/30" />
        </div>

        {/* ============================================================
            LEFT / TOP: STAGE PREVIEW STORY IPHONE (APPLE PRODUCT BEZEL)
            ============================================================ */}
        <div className="relative md:flex-1 bg-[#09090B] flex items-center justify-center px-4 py-3.5 sm:py-5 md:p-6 overflow-hidden shrink-0 md:shrink select-none">
          {/* Ambient soft glow di belakang HP iPhone */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(62% 58% at 50% 48%, rgba(97, 85, 245, 0.16), transparent 72%), radial-gradient(46% 42% at 84% 85%, rgba(255, 45, 85, 0.11), transparent 70%)",
            }}
          />

          {/* Counter posisi media (top-left stage) */}
          {items.length > 1 && currentIdx >= 0 && (
            <span className="absolute top-3 left-3.5 sm:top-4 sm:left-4 z-20 inline-flex items-center px-2.5 py-1 rounded-full bg-white/[0.12] backdrop-blur-xl border border-white/15 text-caption2 font-semibold text-white/85 tabular-nums">
              {currentIdx + 1} / {items.length}
            </span>
          )}

          {/* Tombol tutup mobile mengambang (top-right stage) */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Pratinjau"
            className="md:hidden hit-44 absolute top-3 right-3.5 z-20 w-9 h-9 rounded-full bg-white/[0.14] hover:bg-white/[0.22] backdrop-blur-xl border border-white/20 flex items-center justify-center text-white active:scale-95 transition"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Tombol Navigasi Prev / Next (Liquid Glass) */}
          {canPrev && (
            <button
              type="button"
              onClick={() => onSelect(items[currentIdx - 1])}
              aria-label="Media sebelumnya"
              className="hit-44 absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.14] hover:bg-white/[0.24] backdrop-blur-xl border border-white/20 text-white flex items-center justify-center shadow-float active:scale-95 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {canNext && (
            <button
              type="button"
              onClick={() => onSelect(items[currentIdx + 1])}
              aria-label="Media berikutnya"
              className="hit-44 absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.14] hover:bg-white/[0.24] backdrop-blur-xl border border-white/20 text-white flex items-center justify-center shadow-float active:scale-95 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Frame HP iPhone Story Preview (proporsional penuh tanpa terpotong di HP maupun Desktop) */}
          <div className="relative z-10 w-[196px] sm:w-[236px] md:w-auto md:h-full md:max-h-[620px] aspect-[9/16] rounded-[34px] sm:rounded-[38px] overflow-hidden ring-[4px] ring-white/15 border border-white/15 shadow-[0_24px_60px_rgba(0,0,0,0.78)] bg-[#121214] flex flex-col justify-between">
            {/* Media di dalam layar iPhone */}
            {isVideo ? (
              <video
                key={item.id}
                src={item.mediaUrl}
                poster={item.thumbnailUrl}
                controls
                autoPlay
                loop
                playsInline
                className={cx(
                  "absolute inset-0 w-full h-full",
                  isPortraitStory ? "object-cover" : "object-contain bg-black"
                )}
              />
            ) : (
              <img
                src={item.mediaUrl}
                alt={item.title}
                className={cx(
                  "absolute inset-0 w-full h-full",
                  isPortraitStory ? "object-cover" : "object-contain bg-[#121214]"
                )}
              />
            )}

            {/* Top Chrome iPhone Story (Dynamic Island + Progress Bar + Header URBAN Gaming) */}
            <div className="relative z-10 px-2.5 sm:px-3 pt-2 sm:pt-2.5 pb-4 bg-gradient-to-b from-black/75 via-black/35 to-transparent pointer-events-none">
              {/* Dynamic Island */}
              <div className="w-16 sm:w-20 h-4 sm:h-[18px] bg-black rounded-full mx-auto mb-2 shadow-inner border border-white/10" />

              {/* Story Progress Bars */}
              <div className="flex items-center gap-1 mb-2">
                <div className="flex-1 h-[2.5px] rounded-full bg-white/35 overflow-hidden">
                  <div className="h-full bg-white rounded-full w-3/4 animate-pulse" />
                </div>
                <div className="flex-1 h-[2.5px] rounded-full bg-white/25" />
              </div>

              {/* Story Profile Header */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-white">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-tr from-[#FF2D55] to-[#6155F5] flex items-center justify-center text-[9px] sm:text-[10px] font-bold border border-white/40 shrink-0 shadow-sm">
                  UG
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-bold tracking-tight leading-none truncate">
                    URBAN Gaming
                  </p>
                  <p className="text-[8.5px] sm:text-[9.5px] text-white/75 leading-none mt-0.5 truncate">
                    {item.category}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Story Caption & Home Indicator */}
            <div
              className={cx(
                "relative z-10 px-2.5 sm:px-3 pt-5 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none",
                isVideo ? "pb-10 sm:pb-11" : "pb-2 sm:pb-2.5"
              )}
            >
              {item.caption?.trim() && (
                <p className="text-white text-[10.5px] sm:text-[11.5px] font-medium line-clamp-2 leading-snug drop-shadow">
                  {item.caption}
                </p>
              )}
              {!isVideo && (
                <div className="w-20 sm:w-24 h-[3.5px] rounded-full bg-white/55 mx-auto mt-2" />
              )}
            </div>
          </div>
        </div>

        {/* ============================================================
            RIGHT / BOTTOM: APPLE iOS 27 LIQUID GLASS INSPECTOR PANE
            ============================================================ */}
        <aside className="apple-sheet w-full md:w-[370px] lg:w-[396px] flex flex-col border-t md:border-t-0 md:border-l border-sep min-h-0 flex-1 md:flex-none">
          {/* Inspector Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 pt-4 pb-3 space-y-3.5">
            {/* Badges & Desktop Close */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Pill color={CATEGORY_COLOR[item.category] || "pink"}>{item.category}</Pill>
                <Pill color={isVideo ? "purple" : "blue"}>{isVideo ? "Video" : "Foto"}</Pill>
                <Pill tone="neutral">{item.aspectRatio}</Pill>
                {item.pinned && (
                  <Pill color="orange" icon={<Bookmark className="w-3 h-3 fill-current" />}>
                    Disematkan
                  </Pill>
                )}
              </div>

              <IconButton
                label="Tutup Pratinjau"
                variant="gray"
                size="sm"
                onClick={onClose}
                className="hidden md:inline-flex"
              >
                <X />
              </IconButton>
            </div>

            {/* Title & Metadata */}
            <div>
              <h3 className="text-title3 font-bold tracking-tight text-label leading-snug">{item.title}</h3>
              <p className="text-caption text-label-2 mt-0.5">
                {labelFormatRasio(item.aspectRatio)} · {formatTimeAgo(item.createdAt)}
                {item.uploadedBy ? ` · oleh ${item.uploadedBy}` : ""}
              </p>
            </div>

            {/* Caption Box (Nested Concentric Liquid Tile) */}
            <div className="apple-tile rounded-tile border border-sep overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-sep">
                <Eyebrow>Caption Promosi</Eyebrow>
                <button
                  type="button"
                  onClick={handleQuickCopy}
                  className="inline-flex items-center gap-1 text-caption2 font-semibold text-tint hover:opacity-80 transition-opacity"
                >
                  {justCopied ? <Check className="w-3 h-3 text-positive" /> : <Copy className="w-3 h-3" />}
                  <span className={justCopied ? "text-positive" : undefined}>
                    {justCopied ? "Tersalin" : "Salin"}
                  </span>
                </button>
              </div>
              <div className="px-3.5 py-2.5 max-h-32 sm:max-h-48 overflow-y-auto">
                <p className="text-footnote text-label whitespace-pre-wrap leading-relaxed">
                  {item.caption?.trim() || "Belum ada caption promosi."}
                </p>
              </div>
            </div>
          </div>

          {/* Sticky Inspector Footer Actions */}
          <div className="apple-bar shrink-0 border-t border-sep px-4 sm:px-5 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] space-y-2">
            <button
              type="button"
              onClick={() => onShare(item)}
              className="w-full h-11 sm:h-12 flex items-center justify-center gap-2 rounded-full bg-[#34C759] dark:bg-[#30D158] hover:brightness-[0.96] active:scale-[0.985] text-white font-semibold text-subhead shadow-[0_2px_10px_rgba(52,199,89,0.28),inset_0_1px_0_rgba(255,255,255,0.35)] transition"
            >
              <Share className="w-4 h-4 stroke-[2.2]" />
              <span>Bagikan ke Story &amp; Chat</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="gray"
                size="md"
                icon={<Copy className="w-4 h-4" />}
                onClick={handleQuickCopy}
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
                Unduh Media
              </Button>
            </div>

            {isSuperAdminOrOwner && (
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-sep">
                <Button
                  variant="tinted"
                  size="sm"
                  icon={<Pencil className="w-3.5 h-3.5" />}
                  onClick={() => onEdit(item)}
                  block
                >
                  Edit
                </Button>
                <Button
                  variant="gray"
                  size="sm"
                  icon={<Bookmark className={cx("w-3.5 h-3.5", item.pinned && "fill-current text-warning")} />}
                  onClick={() => onTogglePin(item)}
                  block
                >
                  {item.pinned ? "Lepas Pin" : "Sematkan"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => onDelete(item)}
                  block
                >
                  Hapus
                </Button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>,
    document.body
  );
}
