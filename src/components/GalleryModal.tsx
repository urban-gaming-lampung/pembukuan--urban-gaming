import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import {
  Bookmark,
  Copy,
  Download,
  Film,
  Images,
  Maximize2,
  Pencil,
  Play,
  Plus,
  Share,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { db, storage } from "../lib/firebase";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import {
  AlertDialog,
  Button,
  EmptyState,
  IconBadge,
  IconButton,
  MOTION,
  SearchField,
  Spinner,
  SubTabs,
  Toast,
  cx,
} from "../ui";
import MediaFormSheet, { type MediaFormState } from "./gallery/MediaFormSheet";
import MediaPreviewModal from "./gallery/MediaPreviewModal";
import MediaShareSheet from "./gallery/MediaShareSheet";
import {
  ASPECT_RATIO_TABS,
  CATEGORIES,
  GALLERY_TITLE,
  INITIAL_MEDIA_SEEDS,
  buildShareFile,
  copyCaptionQuietly,
  copyCaptionWithFeedback,
  formatTimeAgo,
  kelasAspekPoster,
  labelFormatRasio,
  mediaBlobCache,
  prefetchMediaBlob,
  supportsNativeFileShare,
  type MediaAspectRatio,
  type MediaItem,
  type RatioFilter,
} from "./gallery/mediaHelpers";

export type { MediaItem };

interface GalleryModalProps {
  open: boolean;
  onClose: () => void;
  isSuperAdminOrOwner: boolean;
  adminName: string;
}

export default function GalleryModal({
  open,
  onClose,
  isSuperAdminOrOwner,
  adminName,
}: GalleryModalProps) {
  useBodyScrollLock(open);

  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Tab switch: 9:16 paling awal (default), Semua paling akhir
  const [activeRatio, setActiveRatio] = useState<RatioFilter>("9:16");
  const [activeCategory, setActiveCategory] = useState<string>("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  // Pop-ups & SSOT Form State (Tambah & Edit satu sumber)
  const [formState, setFormState] = useState<MediaFormState>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [shareTargetItem, setShareTargetItem] = useState<MediaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmSeedOpen, setConfirmSeedOpen] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"positive" | "negative" | "info">("positive");

  // Persiapan file Web Share API
  const [sharePrepState, setSharePrepState] = useState<"idle" | "preparing" | "ready" | "error">("idle");
  const [shareRetryKey, setShareRetryKey] = useState(0);

  const showToast = (msg: string, tone?: "positive" | "negative" | "info") => {
    setToastTone(tone ?? (msg.startsWith("Gagal") ? "negative" : "positive"));
    setToastMsg(msg);
  };

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  // Sinkronkan pratinjau aktif secara realtime dengan Firestore mediaList
  const openPreview = useMemo(
    () => (previewId ? mediaList.find((m) => m.id === previewId) ?? null : null),
    [mediaList, previewId]
  );

  // Tutup modal utama dengan Escape saat tidak ada pop-up lain terbuka di atasnya
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmSeedOpen || deleteTarget || shareTargetItem || formState || openPreview) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, confirmSeedOpen, deleteTarget, shareTargetItem, formState, openPreview, onClose]);

  // Prefetch blob untuk lembar Share
  useEffect(() => {
    if (!shareTargetItem?.mediaUrl) {
      setSharePrepState("idle");
      return;
    }
    if (mediaBlobCache.has(shareTargetItem.mediaUrl)) {
      setSharePrepState("ready");
      return;
    }
    let cancelled = false;
    setSharePrepState("preparing");
    prefetchMediaBlob(shareTargetItem).then((blob) => {
      if (!cancelled) setSharePrepState(blob ? "ready" : "error");
    });
    return () => {
      cancelled = true;
    };
  }, [shareTargetItem, shareRetryKey]);

  useEffect(() => {
    if (openPreview?.mediaUrl) {
      void prefetchMediaBlob(openPreview);
    }
  }, [openPreview]);

  useEffect(() => {
    if (mediaList.length > 0) {
      // Prefetch terbatas untuk gambar agar hemat kuota HP (video diunduh saat akan di-share)
      mediaList
        .filter((item) => item.mediaType !== "video")
        .slice(0, 8)
        .forEach((item) => {
          void prefetchMediaBlob(item);
        });
    }
  }, [mediaList]);

  // Listener Firestore koleksi media_gallery
  useEffect(() => {
    if (!open) return;
    setLoading(true);

    try {
      const galleryRef = collection(db, "media_gallery");
      const q = query(galleryRef, orderBy("createdAt", "desc"));

      let unsubFallback: (() => void) | null = null;
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const items: MediaItem[] = [];
          snapshot.forEach((d) => {
            items.push({ id: d.id, ...(d.data() as any) });
          });
          setMediaList(items);
          setLoading(false);
        },
        (err) => {
          console.warn("Firestore gallery query fallback to simple collection:", err);
          unsubFallback?.();
          unsubFallback = onSnapshot(
            galleryRef,
            (snapshot) => {
              const items: MediaItem[] = [];
              snapshot.forEach((d) => {
                items.push({ id: d.id, ...(d.data() as any) });
              });
              items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
              setMediaList(items);
              setLoading(false);
            },
            (fallbackErr) => {
              console.error("Gagal memuat galeri:", fallbackErr);
              setLoading(false);
            }
          );
        }
      );

      return () => {
        unsub();
        unsubFallback?.();
      };
    } catch (e) {
      console.error("Error loading media gallery:", e);
      setLoading(false);
    }
  }, [open]);

  // Daftar media berdasarkan rasio aktif (untuk hitung badge kategori secara akurat)
  const ratioScopedMedia = useMemo(() => {
    if (activeRatio === "all") return mediaList;
    return mediaList.filter((item) => item.aspectRatio === activeRatio);
  }, [mediaList, activeRatio]);

  // Filter akhir (rasio + kategori + pencarian + urut pin lalu terbaru)
  const filteredMedia = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ratioScopedMedia
      .filter((item) => {
        if (activeCategory !== "Semua" && item.category !== activeCategory) return false;
        if (q) {
          const matchTitle = item.title?.toLowerCase().includes(q);
          const matchCaption = item.caption?.toLowerCase().includes(q);
          const matchCategory = item.category?.toLowerCase().includes(q);
          if (!matchTitle && !matchCaption && !matchCategory) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [ratioScopedMedia, activeCategory, searchQuery]);

  // SSOT Pembuka Form Tambah & Edit
  const openAddForm = () => {
    const defaultRatio: MediaAspectRatio = activeRatio === "all" ? "9:16" : activeRatio;
    setFormState({ mode: "add", defaultRatio });
  };

  const openEditForm = (item: MediaItem) => {
    setFormState({ mode: "edit", item });
  };

  const handleFormSaved = (info: { mode: "add" | "edit"; aspectRatio: MediaAspectRatio; title: string }) => {
    if (activeRatio !== "all" && activeRatio !== info.aspectRatio) {
      setActiveRatio(info.aspectRatio);
    }
    showToast(
      info.mode === "edit"
        ? `Perubahan "${info.title}" berhasil disimpan.`
        : `"${info.title}" berhasil ditambahkan ke galeri.`
    );
  };

  const executeSeedDefaults = async () => {
    try {
      setSeedLoading(true);
      setLoading(true);
      for (const item of INITIAL_MEDIA_SEEDS) {
        await addDoc(collection(db, "media_gallery"), {
          ...item,
          createdAt: Date.now(),
          uploadedBy: adminName,
        });
      }
      setConfirmSeedOpen(false);
      showToast("Template bawaan berhasil ditambahkan.");
    } catch (e: any) {
      showToast("Gagal inisialisasi: " + (e?.message || e), "negative");
    } finally {
      setSeedLoading(false);
      setLoading(false);
    }
  };

  const handleTogglePin = async (item: MediaItem) => {
    try {
      await updateDoc(doc(db, "media_gallery", item.id), {
        pinned: !item.pinned,
      });
      showToast(item.pinned ? "Pin dilepas." : "Disematkan ke paling atas.");
    } catch (e: any) {
      showToast("Gagal mengubah pin: " + (e?.message || e), "negative");
    }
  };

  const confirmDeleteItem = async () => {
    if (!deleteTarget) return;
    const item = deleteTarget;
    try {
      setDeleteBusy(true);
      await deleteDoc(doc(db, "media_gallery", item.id));
      if (item.storagePath) {
        try {
          await deleteObject(ref(storage, item.storagePath));
          if (item.thumbStoragePath) {
            await deleteObject(ref(storage, item.thumbStoragePath));
          }
        } catch (storageErr) {
          console.warn("Storage deletion skipped:", storageErr);
        }
      }
      if (item.mediaUrl) mediaBlobCache.delete(item.mediaUrl);
      setDeleteTarget(null);
      if (previewId === item.id) setPreviewId(null);
      showToast("Media berhasil dihapus.");
    } catch (e: any) {
      showToast("Gagal menghapus media: " + (e?.message || e), "negative");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleCopyCaption = async (caption: string) => {
    const ok = await copyCaptionWithFeedback(caption);
    showToast(ok ? "Caption promosi berhasil disalin." : "Gagal menyalin caption.", ok ? "positive" : "negative");
  };

  const handleDownloadMedia = async (item: MediaItem) => {
    const ext = item.mediaType === "video" ? "mp4" : "jpg";
    const filename = `URBAN_GAMING_${(item.title || "media").replace(/\s+/g, "_")}.${ext}`;
    try {
      showToast("Mengunduh media...", "info");
      const blob = await prefetchMediaBlob(item);
      if (!blob) throw new Error("CORS or fetch error");
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`Media ${ext.toUpperCase()} berhasil diunduh.`);
    } catch {
      const a = document.createElement("a");
      a.href = item.mediaUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Mengunduh media ke perangkat...", "info");
    }
  };

  // ============================================================
  // SHARE → STORY WHATSAPP BUSINESS (gambar/video + caption)
  // ============================================================
  const supportsFileShare = supportsNativeFileShare();

  const shareToWAStory = async (item: MediaItem) => {
    const file = buildShareFile(item);
    if (!supportsFileShare || !file) {
      setShareTargetItem(item);
      return;
    }

    const caption = (item.caption || "").trim();
    const withCaption: ShareData = caption ? { files: [file], text: caption } : { files: [file] };
    const filesOnly: ShareData = { files: [file] };
    const data = navigator.canShare(withCaption) ? withCaption : filesOnly;
    if (!navigator.canShare(data)) {
      setShareTargetItem(item);
      showToast("Browser ini belum bisa kirim file langsung. Pakai Simpan Media + Salin Caption.", "info");
      return;
    }

    const copied = await copyCaptionQuietly(caption);
    try {
      await navigator.share(data);
      setShareTargetItem(null);
      showToast(
        copied
          ? "Pilih Status saya di WA Business. Caption juga sudah disalin."
          : "Pilih Status saya di WA Business."
      );
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.warn("navigator.share error:", err);
      setShareTargetItem(item);
      showToast(
        err?.name === "NotAllowedError"
          ? "File sudah siap — ketuk tombol Kirim sekali lagi."
          : "Gagal membuka menu share. Coba lagi.",
        err?.name === "NotAllowedError" ? "info" : "negative"
      );
    }
  };

  const handleShareClick = (item: MediaItem) => {
    if (supportsFileShare && mediaBlobCache.has(item.mediaUrl)) {
      void shareToWAStory(item);
      return;
    }
    setShareTargetItem(item);
  };

  const resetAllFilters = () => {
    setActiveRatio("all");
    setActiveCategory("Semua");
    setSearchQuery("");
  };

  const hasActiveFilter = activeRatio !== "all" || activeCategory !== "Semua" || searchQuery.trim().length > 0;

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 lg:p-6 font-sans"
      role="dialog"
      aria-modal="true"
      aria-label={GALLERY_TITLE}
    >
      {/* Backdrop Apple iOS 27 */}
      <div
        className={cx("absolute inset-0 bg-black/45 dark:bg-black/75 backdrop-blur-md", MOTION.backdrop)}
        onClick={onClose}
        aria-hidden
      />

      {/* ============================================================
          MAIN WORKSPACE (Apple iOS 27 / iPadOS Floating Liquid Glass Window)
          ============================================================ */}
      <div
        className={cx(
          "relative z-10 w-full h-full md:max-w-6xl md:h-[min(92vh,880px)] apple-canvas md:rounded-[34px] md:ring-1 md:ring-white/55 dark:md:ring-white/[0.14] md:border md:border-white/60 dark:md:border-white/[0.10] shadow-float overflow-hidden flex flex-col",
          MOTION.sheet
        )}
      >
        {/* 1. TOP NAVIGATION BAR (Apple iOS 27 Translucent Chrome) */}
        <header className="apple-bar border-b border-sep px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <IconBadge color="pink" variant="solid">
              <Images className="w-4 h-4" />
            </IconBadge>
            <div className="min-w-0">
              <h2 className="text-headline font-bold tracking-tight text-label truncate">{GALLERY_TITLE}</h2>
              <p className="text-caption text-label-2 truncate tabular-nums">
                {loading
                  ? "Menyinkronkan media..."
                  : `${filteredMedia.length} dari ${mediaList.length} konten${
                      activeRatio !== "all" ? ` · rasio ${activeRatio}` : ""
                    }`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSuperAdminOrOwner && (
              <>
                {mediaList.length === 0 && !loading && (
                  <Button
                    variant="gray"
                    size="sm"
                    icon={<Sparkles className="w-3.5 h-3.5" />}
                    onClick={() => setConfirmSeedOpen(true)}
                    className="hidden sm:inline-flex"
                  >
                    Template Awal
                  </Button>
                )}
                <Button
                  variant="filled"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={openAddForm}
                >
                  <span className="hidden sm:inline">Tambah Media</span>
                  <span className="sm:hidden">Tambah</span>
                </Button>
              </>
            )}

            <IconButton label="Tutup Galeri" variant="gray" size="sm" onClick={onClose}>
              <X />
            </IconButton>
          </div>
        </header>

        {/* 2. CONTROLS SHELF (Segmented Aspect Ratio + Search + Category Chips) */}
        <div className="apple-bar border-b border-sep px-3.5 sm:px-6 py-3 z-10 shrink-0">
          <div className="max-w-5xl mx-auto w-full space-y-2.5">
            {/* Segmented Format Rasio — 9:16 paling awal, Semua paling akhir */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <SubTabs
                  size="sm"
                  ariaLabel="Filter aspek rasio media"
                  value={activeRatio}
                  onChange={setActiveRatio}
                  options={ASPECT_RATIO_TABS.map((r) => ({
                    key: r.key,
                    label: r.label,
                  }))}
                />
              </div>

              <div className="sm:w-72 md:w-80 shrink-0">
                <SearchField
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Cari judul, game, atau promo..."
                />
              </div>
            </div>

            {/* Category Filter Pills (hitungan mengikuti rasio aktif) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {CATEGORIES.map((cat) => {
                const count =
                  cat === "Semua"
                    ? ratioScopedMedia.length
                    : ratioScopedMedia.filter((m) => m.category === cat).length;
                const active = activeCategory === cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cx(
                      "px-3 py-1.5 rounded-full text-caption font-semibold transition-[color,background-color,box-shadow] duration-150 flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                      active
                        ? "bg-action text-action-label shadow-card"
                        : "apple-tile text-label-2 hover:text-label hover:bg-surface/90 dark:hover:bg-surface-elevated/90"
                    )}
                  >
                    <span>{cat}</span>
                    <span
                      className={cx(
                        "text-caption2 px-1.5 py-0.5 rounded-full font-bold tabular-nums",
                        active ? "bg-white/20 dark:bg-black/15 text-action-label" : "bg-fill text-label-2"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. MAIN GALLERY GRID */}
        <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-5 scrollbar-ios">
          <div className="max-w-5xl mx-auto w-full pb-12">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-label-2">
                <Spinner size="lg" />
                <p className="text-footnote font-medium">Memuat {GALLERY_TITLE}...</p>
              </div>
            ) : filteredMedia.length === 0 ? (
              <EmptyState
                icon={<Images />}
                title={
                  mediaList.length === 0
                    ? "Galeri Media Masih Kosong"
                    : activeRatio !== "all" && ratioScopedMedia.length === 0
                      ? `Belum Ada Media Rasio ${activeRatio}`
                      : "Tidak Ada Media yang Cocok"
                }
                className="max-w-lg mx-auto my-6"
              >
                <p>
                  {mediaList.length === 0
                    ? "Unggah poster promosi, video gameplay, atau pricelist rental URBAN untuk dibagikan ke Story WhatsApp Business dan Instagram."
                    : "Coba ubah tab rasio, kategori, atau kata kunci pencarian untuk melihat konten lainnya."}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {mediaList.length > 0 && hasActiveFilter && (
                    <Button variant="gray" size="md" onClick={resetAllFilters}>
                      Lihat Semua ({mediaList.length})
                    </Button>
                  )}

                  {isSuperAdminOrOwner && (
                    <Button
                      variant="filled"
                      size="md"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={openAddForm}
                    >
                      Tambah Media Promosi
                    </Button>
                  )}

                  {isSuperAdminOrOwner && mediaList.length === 0 && (
                    <Button
                      variant="gray"
                      size="md"
                      icon={<Sparkles className="w-4 h-4" />}
                      onClick={() => setConfirmSeedOpen(true)}
                    >
                      Muat Template Awal
                    </Button>
                  )}
                </div>
              </EmptyState>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredMedia.map((item) => (
                  <article
                    key={item.id}
                    onMouseEnter={() => prefetchMediaBlob(item)}
                    onTouchStart={() => prefetchMediaBlob(item)}
                    className="group apple-card rounded-card ring-1 ring-edge shadow-card hover:shadow-float transition-[box-shadow,transform] duration-200 overflow-hidden flex flex-col p-2.5 justify-between"
                  >
                    {/* Poster Concentric Frame (rounded-tile 16px inside rounded-card 26px + 10px padding) */}
                    <button
                      type="button"
                      onClick={() => setPreviewId(item.id)}
                      aria-label={`Buka pratinjau ${item.title}`}
                      className={cx(
                        "relative w-full text-left cursor-pointer overflow-hidden rounded-tile bg-[#111113] ring-1 ring-black/5 dark:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                        kelasAspekPoster(item.aspectRatio)
                      )}
                    >
                      {item.mediaType === "video" ? (
                        <div className="relative w-full h-full bg-[#09090B] flex items-center justify-center">
                          {item.thumbnailUrl ? (
                            <>
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fb = e.currentTarget.parentElement?.querySelector(".thumb-fallback");
                                  if (fb) fb.classList.remove("hidden");
                                }}
                              />
                              <div className="thumb-fallback hidden w-full h-full bg-gradient-to-br from-[#CB30E0]/35 via-[#1C1C1E] to-black flex flex-col items-center justify-center p-3 text-center">
                                <Film className="w-7 h-7 text-[#E580FF] mb-1 opacity-90" />
                                <span className="text-caption2 text-white/70 font-semibold uppercase tracking-wider">
                                  Video Promo
                                </span>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#CB30E0]/35 via-[#1C1C1E] to-black flex flex-col items-center justify-center p-3 text-center">
                              <Film className="w-7 h-7 text-[#E580FF] mb-1 opacity-90" />
                              <span className="text-caption2 text-white/70 font-semibold uppercase tracking-wider">
                                Video Promo
                              </span>
                            </div>
                          )}

                          {/* Apple Liquid Glass Play Indicator */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/15 group-hover:bg-black/5 transition-colors">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/25 backdrop-blur-xl text-white flex items-center justify-center shadow-float border border-white/40 group-hover:scale-105 transition-transform">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center bg-[#1C1C1E]">
                          <img
                            src={item.mediaUrl}
                            alt={item.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const fb = e.currentTarget.parentElement?.querySelector(".media-fallback");
                              if (fb) fb.classList.remove("hidden");
                            }}
                          />
                          <div className="media-fallback hidden flex flex-col items-center justify-center p-3 text-center gap-1.5">
                            <Images className="w-7 h-7 text-white/40" />
                            <span className="text-caption2 text-white/60 font-medium">Gagal memuat</span>
                          </div>
                        </div>
                      )}

                      {/* Top Translucent Liquid Glass Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none gap-1">
                        <span className="px-2.5 py-0.5 rounded-full text-caption2 font-semibold bg-black/55 text-white backdrop-blur-md border border-white/20 truncate max-w-[74%]">
                          {item.category}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.mediaType === "video" && (
                            <span className="w-6 h-6 rounded-full bg-[#CB30E0]/90 backdrop-blur-md text-white border border-white/25 shadow-card flex items-center justify-center">
                              <Film className="w-3 h-3" />
                            </span>
                          )}
                          {item.pinned && (
                            <span className="w-6 h-6 rounded-full bg-[#FF8D28] text-white border border-white/25 shadow-card flex items-center justify-center">
                              <Bookmark className="w-3 h-3 fill-current" />
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Card Details & Actions */}
                    <div className="pt-2.5 pb-0.5 px-0.5 flex flex-col gap-2.5 flex-1 justify-between">
                      {/* Title & Meta */}
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-subhead font-semibold text-label truncate">{item.title}</h4>
                          <button
                            type="button"
                            onClick={() => setPreviewId(item.id)}
                            className="hit-44 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-label-3 hover:text-label hover:bg-fill transition-colors"
                            title="Pratinjau Penuh"
                            aria-label={`Pratinjau penuh ${item.title}`}
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-caption2 text-label-3 mt-0.5 truncate">
                          {labelFormatRasio(item.aspectRatio)} · {item.aspectRatio} · {formatTimeAgo(item.createdAt)}
                        </p>
                      </div>

                      {/* Nested Caption Preview Tile */}
                      <div className="apple-tile rounded-field px-2.5 py-2 border border-sep">
                        <p className="text-caption text-label-2 line-clamp-2 leading-relaxed">
                          {item.caption || "Belum ada caption"}
                        </p>
                      </div>

                      {/* Primary Action Pills */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleShareClick(item)}
                          className="hit-44 h-9 flex items-center justify-center gap-1.5 px-3 rounded-full bg-[#34C759] dark:bg-[#30D158] hover:brightness-[0.96] active:scale-[0.98] text-white font-semibold text-footnote shadow-[0_1px_6px_rgba(52,199,89,0.28),inset_0_1px_0_rgba(255,255,255,0.3)] transition"
                          title="Bagikan Media & Caption"
                        >
                          <Share className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Share</span>
                        </button>

                        <Button
                          variant="gray"
                          size="sm"
                          icon={<Copy className="w-3.5 h-3.5" />}
                          onClick={() => handleCopyCaption(item.caption)}
                          className="h-9 justify-center"
                          title="Salin Teks Caption"
                        >
                          Salin
                        </Button>
                      </div>

                      {/* Bottom Utility Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-sep px-0.5 text-label-3">
                        <button
                          type="button"
                          onClick={() => handleDownloadMedia(item)}
                          className="hit-44 w-8 h-8 rounded-full flex items-center justify-center hover:bg-fill hover:text-label transition-colors"
                          title="Unduh Media"
                          aria-label="Unduh Media"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {isSuperAdminOrOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTogglePin(item)}
                              className={cx(
                                "hit-44 w-8 h-8 rounded-full flex items-center justify-center hover:bg-fill transition-colors",
                                item.pinned ? "text-warning" : "hover:text-warning"
                              )}
                              title={item.pinned ? "Lepas Sematan" : "Sematkan ke Atas"}
                              aria-label={item.pinned ? "Lepas Sematan" : "Sematkan ke Atas"}
                            >
                              <Bookmark className={cx("w-4 h-4", item.pinned && "fill-current")} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditForm(item)}
                              className="hit-44 w-8 h-8 rounded-full flex items-center justify-center hover:bg-fill hover:text-tint transition-colors"
                              title="Edit Media"
                              aria-label="Edit Media"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="hit-44 w-8 h-8 rounded-full flex items-center justify-center hover:bg-negative/10 hover:text-negative transition-colors"
                              title="Hapus Media"
                              aria-label="Hapus Media"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          POP-UP 1: PRATINJAU MEDIA & INSPEKTOR (Apple iOS 27 Photos Style)
          ============================================================ */}
      <MediaPreviewModal
        item={openPreview}
        items={filteredMedia}
        isSuperAdminOrOwner={isSuperAdminOrOwner}
        hasOverlayAbove={Boolean(formState || shareTargetItem || deleteTarget || confirmSeedOpen)}
        onSelect={(it) => setPreviewId(it.id)}
        onClose={() => setPreviewId(null)}
        onShare={handleShareClick}
        onCopyCaption={handleCopyCaption}
        onDownload={handleDownloadMedia}
        onTogglePin={handleTogglePin}
        onEdit={openEditForm}
        onDelete={(it) => setDeleteTarget(it)}
      />

      {/* ============================================================
          POP-UP 2: SHARE ACTIVITY VIEW → STORY WA BUSINESS
          ============================================================ */}
      <MediaShareSheet
        item={shareTargetItem}
        supportsFileShare={supportsFileShare}
        prepState={sharePrepState}
        onClose={() => setShareTargetItem(null)}
        onShareNow={shareToWAStory}
        onRetryPrep={() => setShareRetryKey((k) => k + 1)}
        onCopyCaption={handleCopyCaption}
        onDownload={handleDownloadMedia}
      />

      {/* ============================================================
          POP-UP 3: SSOT TAMBAH & EDIT MEDIA SHEET
          ============================================================ */}
      <MediaFormSheet
        state={formState}
        adminName={adminName}
        onClose={() => setFormState(null)}
        onNotify={(msg) => showToast(msg, "info")}
        onSaved={handleFormSaved}
      />

      {/* ============================================================
          POP-UP 4 & 5: KONFIRMASI (Apple iOS 27 AlertDialog)
          ============================================================ */}
      <AlertDialog
        open={confirmSeedOpen}
        onClose={() => !seedLoading && setConfirmSeedOpen(false)}
        title="Muat Template Promosi Awal?"
        description="Tambahkan 4 template media promosi bawaan URBAN Gaming ke Galeri Media Sosial URBAN?"
        zClassName="z-[180]"
        actions={[
          { label: "Batal", onClick: () => setConfirmSeedOpen(false), role: "cancel", disabled: seedLoading },
          {
            label: seedLoading ? "Menambahkan..." : "Tambahkan",
            onClick: executeSeedDefaults,
            role: "primary",
            disabled: seedLoading,
          },
        ]}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        title="Hapus Media dari Galeri?"
        description={deleteTarget ? `Media "${deleteTarget.title}" akan dihapus permanen dari galeri.` : ""}
        zClassName="z-[180]"
        actions={[
          { label: "Batal", onClick: () => setDeleteTarget(null), role: "cancel", disabled: deleteBusy },
          {
            label: deleteBusy ? "Menghapus..." : "Hapus",
            onClick: confirmDeleteItem,
            role: "destructive",
            disabled: deleteBusy,
          },
        ]}
      />

      {/* FLOATING TOAST NOTIFICATION */}
      <Toast
        open={Boolean(toastMsg)}
        message={toastMsg}
        tone={toastTone}
        onClose={() => setToastMsg(null)}
        zClassName="z-[200]"
      />
    </div>,
    document.body
  );
}
