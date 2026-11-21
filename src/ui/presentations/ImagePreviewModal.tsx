import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Image as ImageIcon, Trash2, X } from "lucide-react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { Button, IconButton } from "../controls/Button";
import { cx } from "../foundations/cn";
import { MOTION } from "../foundations/motion";
import { IconBadge } from "../surfaces/Card";

/**
 * Lightbox / Modal Pratinjau Foto & Bukti Transfer (SSOT — menggantikan overlay zoom duplikat).
 */
export const ImagePreviewModal: React.FC<{
  open: boolean;
  onClose: () => void;
  src: string | null | undefined;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  alt?: string;
  showOpenExternal?: boolean;
  openExternalLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
  footerExtra?: React.ReactNode;
  zClassName?: string;
}> = ({
  open,
  onClose,
  src,
  title = "Pratinjau Gambar",
  subtitle,
  alt = "Pratinjau Gambar",
  showOpenExternal = true,
  openExternalLabel = "Buka penuh",
  onDelete,
  deleteLabel = "Hapus",
  deleteDisabled = false,
  footerExtra,
  zClassName = "z-[265]",
}) => {
  const visible = Boolean(open && src);
  useBodyScrollLock(visible);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible || !src || typeof document === "undefined") return null;

  const hasFooter = Boolean(showOpenExternal || onDelete || footerExtra);

  return createPortal(
    <div
      className={cx("fixed inset-0 flex items-center justify-center p-4 sm:p-6", zClassName)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cx("absolute inset-0 bg-black/55 dark:bg-black/80 backdrop-blur-[10px]", MOTION.backdrop)}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cx(
          "relative z-10 flex w-full max-w-[540px] flex-col overflow-hidden rounded-[28px] apple-sheet shadow-float border border-white/65 dark:border-white/[0.14] ring-1 ring-black/10 dark:ring-white/10",
          MOTION.dialog
        )}
      >
        <header className="apple-bar flex items-center justify-between gap-3 border-b border-sep px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <IconBadge color="blue" size="sm" variant="tinted">
              <ImageIcon />
            </IconBadge>
            <div className="min-w-0">
              <h3 className="truncate text-headline text-label">{title}</h3>
              {subtitle && <p className="truncate text-caption text-label-2">{subtitle}</p>}
            </div>
          </div>
          <IconButton label="Tutup pratinjau" variant="gray" size="sm" onClick={onClose}>
            <X />
          </IconButton>
        </header>

        <div className="flex items-center justify-center bg-black/[0.04] dark:bg-black/35 p-3 sm:p-4">
          <img
            src={src}
            alt={alt}
            className="max-h-[66vh] w-full rounded-[14px] object-contain shadow-sm"
          />
        </div>

        {hasFooter && (
          <footer className="apple-bar flex flex-wrap items-center justify-between gap-2 border-t border-sep px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {showOpenExternal && (
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hit-44 inline-flex h-8 items-center gap-1.5 rounded-full bg-action/[0.08] px-3 text-footnote font-semibold text-action transition-opacity hover:bg-action/[0.14] active:opacity-75 dark:bg-action/[0.15]"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {openExternalLabel}
                </a>
              )}
              {footerExtra}
            </div>
            {onDelete && !deleteDisabled && (
              <Button variant="destructive" size="sm" icon={<Trash2 />} onClick={onDelete}>
                {deleteLabel}
              </Button>
            )}
          </footer>
        )}
      </div>
    </div>,
    document.body
  );
};
