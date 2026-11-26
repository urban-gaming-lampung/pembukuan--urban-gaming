import React, { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Bookmark, Film, ImagePlus, Link2, Pencil, RotateCcw, Sparkles, Upload } from "lucide-react";
import { db, storage } from "../../lib/firebase";
import {
  Button,
  Card,
  FieldLabel,
  IconBadge,
  ListGroup,
  Notice,
  Pill,
  SelectField,
  Sheet,
  SubTabs,
  TextAreaField,
  TextField,
  Toggle,
} from "../../ui";
import {
  CAPTION_PRESETS,
  FORM_ASPECT_RATIOS,
  FORM_CATEGORIES,
  captureVideoThumbnail,
  compressImage,
  deteksiRasioDimensi,
  isVideoFileName,
  mediaBlobCache,
  normalisasiRasioForm,
  type MediaAspectRatio,
  type MediaCategory,
  type MediaItem,
} from "./mediaHelpers";

export type MediaFormState =
  | { mode: "add"; defaultRatio?: MediaAspectRatio }
  | { mode: "edit"; item: MediaItem }
  | null;

interface MediaFormSheetProps {
  state: MediaFormState;
  adminName: string;
  onClose: () => void;
  onNotify: (msg: string) => void;
  onSaved: (info: { mode: "add" | "edit"; aspectRatio: MediaAspectRatio; title: string }) => void;
}

const revokeIfBlob = (url: string | null) => {
  if (url && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // abaikan error cleanup blob
    }
  }
};

/**
 * SSOT Form Sheet untuk Tambah Media & Edit Media (Apple iOS 27 Grouped Sheet).
 * Kedua aksi memakai komponen, validasi, field, rasio, preset caption, cover, dan pin yang identik.
 */
export default function MediaFormSheet({
  state,
  adminName,
  onClose,
  onNotify,
  onSaved,
}: MediaFormSheetProps) {
  const open = Boolean(state);
  const isEdit = state?.mode === "edit";
  const editItem = state?.mode === "edit" ? state.item : null;

  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState(CAPTION_PRESETS[0].caption);
  const [category, setCategory] = useState<MediaCategory>("Promo & Diskon");
  const [aspectRatio, setAspectRatio] = useState<MediaAspectRatio>("9:16");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [pinned, setPinned] = useState(false);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [thumbBlob, setThumbBlob] = useState<Blob | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState("");

  const [dragActive, setDragActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const trackedBlobsRef = useRef<string[]>([]);

  const trackBlobUrl = (url: string) => {
    if (url.startsWith("blob:")) trackedBlobsRef.current.push(url);
  };

  const cleanupTrackedBlobs = () => {
    trackedBlobsRef.current.forEach(revokeIfBlob);
    trackedBlobsRef.current = [];
  };

  // Prefill atau reset saat mode / target item berubah
  useEffect(() => {
    cleanupTrackedBlobs();
    setErrMsg(null);
    setSaving(false);
    setProgress(0);
    setDragActive(false);
    setMediaFile(null);
    setThumbBlob(null);

    if (!state) return;

    if (state.mode === "edit") {
      const it = state.item;
      setTitle(it.title || "");
      setCaption(it.caption || "");
      setCategory(it.category || "Promo & Diskon");
      setAspectRatio(normalisasiRasioForm(it.aspectRatio));
      setMediaType(it.mediaType === "video" ? "video" : "image");
      setPinned(Boolean(it.pinned));
      setMediaPreviewUrl(it.mediaUrl || null);
      setThumbPreviewUrl(it.thumbnailUrl || null);
      // Tampilkan URL langsung hanya bila bukan file internal Firebase Storage
      setDirectUrl(it.storagePath ? "" : it.mediaUrl || "");
    } else {
      setTitle("");
      setCaption(CAPTION_PRESETS[0].caption);
      setCategory("Promo & Diskon");
      setAspectRatio(state.defaultRatio ?? "9:16");
      setMediaType("image");
      setPinned(false);
      setMediaPreviewUrl(null);
      setThumbPreviewUrl(null);
      setDirectUrl("");
    }

    return () => {
      cleanupTrackedBlobs();
    };
  }, [state]);

  const handleSelectedFile = async (file: File) => {
    setErrMsg(null);
    setMediaFile(file);
    const objectUrl = URL.createObjectURL(file);
    trackBlobUrl(objectUrl);
    setMediaPreviewUrl(objectUrl);

    const isVideo = file.type.startsWith("video/") || isVideoFileName(file.name);

    if (isVideo) {
      setMediaType("video");
      onNotify("Menganalisis video dan membuat cover thumbnail...");
      try {
        const thumbResult = await captureVideoThumbnail(file);
        trackBlobUrl(thumbResult.previewUrl);
        setThumbBlob(thumbResult.blob);
        setThumbPreviewUrl(thumbResult.previewUrl);
        setAspectRatio(deteksiRasioDimensi(thumbResult.width, thumbResult.height));
        onNotify("Cover thumbnail video berhasil dibuat.");
      } catch (err) {
        console.warn("Auto thumbnail fallback:", err);
      }
    } else {
      setMediaType("image");
      setThumbBlob(null);
      setThumbPreviewUrl(null);

      const img = new Image();
      img.onload = () => {
        setAspectRatio(deteksiRasioDimensi(img.width, img.height));
      };
      img.src = objectUrl;
    }

    if (!title.trim()) {
      setTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim());
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleSelectedFile(file);
    e.target.value = "";
  };

  const handleCustomCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbBlob(file);
    const url = URL.createObjectURL(file);
    trackBlobUrl(url);
    setThumbPreviewUrl(url);
    onNotify("Foto cover kustom dipilih.");
    e.target.value = "";
  };

  const revertReplacementFile = () => {
    if (!editItem) return;
    setMediaFile(null);
    setThumbBlob(null);
    setMediaType(editItem.mediaType === "video" ? "video" : "image");
    setMediaPreviewUrl(editItem.mediaUrl || null);
    setThumbPreviewUrl(editItem.thumbnailUrl || null);
    setAspectRatio(normalisasiRasioForm(editItem.aspectRatio));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("image/") || file.type.startsWith("video/") || isVideoFileName(file.name))) {
      void handleSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);

    const trimmedTitle = title.trim();
    const trimmedUrl = directUrl.trim();

    if (!trimmedTitle) {
      setErrMsg("Masukkan judul konten terlebih dahulu.");
      return;
    }

    if (!isEdit && !mediaFile && !trimmedUrl) {
      setErrMsg("Pilih file foto/video atau masukkan URL media langsung.");
      return;
    }

    try {
      setSaving(true);
      setProgress(15);

      const timestamp = Date.now();
      let finalMediaUrl = isEdit ? editItem!.mediaUrl : trimmedUrl;
      let finalThumbnailUrl: string | null = isEdit ? editItem!.thumbnailUrl || null : null;
      let finalStoragePath: string | null = isEdit ? editItem!.storagePath || null : null;
      let finalThumbStoragePath: string | null = isEdit ? editItem!.thumbStoragePath || null : null;
      let finalMediaType: "image" | "video" = mediaType;

      const oldStoragePathsToDelete: string[] = [];

      if (mediaFile) {
        // Upload file baru (baik mode Tambah maupun ganti file di mode Edit)
        const isVideo = mediaFile.type.startsWith("video/") || isVideoFileName(mediaFile.name);
        finalMediaType = isVideo ? "video" : "image";
        const cleanName = mediaFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const newPath = `gallery_media/${timestamp}_${cleanName}`;
        const storageRef = ref(storage, newPath);

        if (isEdit && editItem?.storagePath) {
          oldStoragePathsToDelete.push(editItem.storagePath);
        }
        if (isEdit && editItem?.thumbStoragePath) {
          oldStoragePathsToDelete.push(editItem.thumbStoragePath);
        }

        setProgress(35);
        if (isVideo) {
          await uploadBytes(storageRef, mediaFile);
          finalMediaUrl = await getDownloadURL(storageRef);
          finalStoragePath = newPath;

          if (thumbBlob) {
            setProgress(72);
            const newThumbPath = `gallery_media/${timestamp}_thumb.jpg`;
            const thumbRef = ref(storage, newThumbPath);
            const compressedThumb = await compressImage(thumbBlob);
            await uploadBytes(thumbRef, compressedThumb);
            finalThumbnailUrl = await getDownloadURL(thumbRef);
            finalThumbStoragePath = newThumbPath;
          } else {
            finalThumbnailUrl = null;
            finalThumbStoragePath = null;
          }
        } else {
          const compressedBlob = await compressImage(mediaFile);
          setProgress(60);
          await uploadBytes(storageRef, compressedBlob);
          finalMediaUrl = await getDownloadURL(storageRef);
          finalStoragePath = newPath;
          finalThumbnailUrl = null;
          finalThumbStoragePath = null;
        }
        setProgress(88);
      } else if (isEdit) {
        // Mode Edit tanpa ganti file utama: cek apakah URL langsung diubah atau cover video diganti
        const urlChanged = Boolean(trimmedUrl) && trimmedUrl !== editItem!.mediaUrl;
        if (urlChanged) {
          if (editItem?.storagePath) oldStoragePathsToDelete.push(editItem.storagePath);
          finalMediaUrl = trimmedUrl;
          finalStoragePath = null;
          finalMediaType = isVideoFileName(trimmedUrl) ? "video" : "image";
        }

        if (finalMediaType === "video" && thumbBlob) {
          setProgress(55);
          if (editItem?.thumbStoragePath) oldStoragePathsToDelete.push(editItem.thumbStoragePath);
          const newThumbPath = `gallery_media/${timestamp}_custom_thumb.jpg`;
          const thumbRef = ref(storage, newThumbPath);
          const compressedThumb = await compressImage(thumbBlob);
          await uploadBytes(thumbRef, compressedThumb);
          finalThumbnailUrl = await getDownloadURL(thumbRef);
          finalThumbStoragePath = newThumbPath;
          setProgress(85);
        }
      } else {
        // Mode Tambah lewat URL langsung
        finalMediaUrl = trimmedUrl;
        finalMediaType = isVideoFileName(trimmedUrl) ? "video" : "image";
        finalStoragePath = null;
        finalThumbnailUrl = null;
        finalThumbStoragePath = null;
      }

      setProgress(95);

      const payload = {
        title: trimmedTitle,
        caption: caption.trim(),
        mediaUrl: finalMediaUrl,
        thumbnailUrl: finalThumbnailUrl,
        storagePath: finalStoragePath,
        thumbStoragePath: finalThumbStoragePath,
        mediaType: finalMediaType,
        aspectRatio,
        category,
        pinned,
      };

      if (isEdit && editItem) {
        await updateDoc(doc(db, "media_gallery", editItem.id), payload);
        if (editItem.mediaUrl && editItem.mediaUrl !== finalMediaUrl) {
          mediaBlobCache.delete(editItem.mediaUrl);
        }
        // Hapus file Storage lama yang sudah diganti setelah Firestore berhasil diperbarui
        for (const p of oldStoragePathsToDelete) {
          deleteObject(ref(storage, p)).catch((err) => console.warn("Skip delete old media:", err));
        }
      } else {
        await addDoc(collection(db, "media_gallery"), {
          ...payload,
          createdAt: timestamp,
          uploadedBy: adminName,
        });
      }

      onSaved({ mode: isEdit ? "edit" : "add", aspectRatio, title: trimmedTitle });
      onClose();
    } catch (e: any) {
      console.error("Media form save error:", e);
      setErrMsg(`Gagal menyimpan media: ${e?.message || e}`);
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  const activeRatioMeta = FORM_ASPECT_RATIOS.find((r) => r.key === aspectRatio);
  const hasPreview = Boolean(mediaPreviewUrl || directUrl.trim());
  const previewSrc = mediaType === "video" ? thumbPreviewUrl : mediaPreviewUrl || directUrl.trim() || null;

  return (
    <Sheet
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={isEdit ? "Edit Media Promosi" : "Tambah Media Promosi"}
      subtitle={isEdit ? editItem?.title || "Perbarui media & informasi galeri" : "Foto atau video untuk Galeri Media Sosial URBAN"}
      icon={isEdit ? <Pencil className="w-4 h-4" /> : <ImagePlus className="w-4 h-4" />}
      iconColor={isEdit ? "blue" : "pink"}
      size="md"
      variant="grouped"
      zClassName="z-[150]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="gray" size="md" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button type="submit" form="gallery-media-ssot-form" variant="filled" size="md" loading={saving}>
            {saving
              ? mediaFile || thumbBlob
                ? `Mengunggah ${progress}%...`
                : "Menyimpan..."
              : isEdit
                ? "Simpan Perubahan"
                : "Simpan ke Galeri"}
          </Button>
        </div>
      }
    >
      <form id="gallery-media-ssot-form" onSubmit={handleSubmit} className="space-y-4">
        {errMsg && <Notice tone="negative">{errMsg}</Notice>}

        {/* 1. MEDIA FILE, COVER VIDEO & URL */}
        <Card title="Media & Sumber" icon={<Upload className="w-4 h-4" />} iconColor="pink" iconVariant="tinted">
          <div className="space-y-3.5">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`relative rounded-tile p-3.5 transition-colors cursor-pointer border border-dashed ${
                dragActive
                  ? "border-tint bg-tint/[0.08] ring-2 ring-tint/30"
                  : "border-sep apple-tile apple-tile-interactive"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {hasPreview ? (
                <div className="flex items-center gap-3.5">
                  <div className="relative w-16 h-20 rounded-[12px] overflow-hidden bg-[#121214] shrink-0 ring-1 ring-edge flex items-center justify-center">
                    {previewSrc ? (
                      <img src={previewSrc} alt="Pratinjau media" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-[#CB30E0]/25 text-[#E580FF] p-1 text-center">
                        <Film className="w-5 h-5 mb-0.5" />
                        <span className="text-[10px] font-semibold">Video</span>
                      </div>
                    )}
                    {mediaType === "video" && (
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/70 text-white text-[9px] font-semibold backdrop-blur-md">
                        VIDEO
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-subhead font-semibold text-label truncate max-w-full">
                        {mediaFile ? mediaFile.name : isEdit ? "Media tersimpan saat ini" : "Media dari URL"}
                      </p>
                      <Pill color={mediaType === "video" ? "purple" : "blue"}>
                        {mediaType === "video" ? "Video" : "Foto"}
                      </Pill>
                      {isEdit && mediaFile && <Pill tone="positive">File baru</Pill>}
                    </div>
                    <p className="text-caption text-label-2">
                      Rasio <span className="font-semibold text-label">{aspectRatio}</span> · Ketuk untuk{" "}
                      {isEdit ? "ganti foto/video" : "pilih file lain"}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="text-caption font-semibold text-tint">
                        {isEdit ? "Ganti Media" : "Ubah File"}
                      </span>
                      {isEdit && mediaFile && (
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            revertReplacementFile();
                          }}
                          className="inline-flex items-center gap-1 text-caption font-semibold text-label-2 hover:text-label transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Batal ganti</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-5 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-fill flex items-center justify-center text-label-2 mb-2.5">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-subhead font-semibold text-label">Pilih atau seret foto / video ke sini</p>
                  <p className="text-caption text-label-3 mt-1">
                    Foto (JPG, PNG, WEBP) atau Video (MP4, MOV, WEBM)
                  </p>
                </div>
              )}
            </div>

            {/* Cover Thumbnail khusus Video (identik di Tambah & Edit) */}
            {mediaType === "video" && (
              <div className="p-3 rounded-tile apple-tile border border-sep space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-footnote font-semibold text-label flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-label-2" />
                    <span>Cover Poster / Thumbnail Video</span>
                  </span>
                  <Pill tone={thumbBlob || thumbPreviewUrl ? "positive" : "neutral"}>
                    {thumbBlob ? "Cover baru siap" : thumbPreviewUrl ? "Cover aktif" : "Otomatis"}
                  </Pill>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-16 rounded-[10px] overflow-hidden bg-[#121214] shrink-0 ring-1 ring-edge flex items-center justify-center">
                    {thumbPreviewUrl ? (
                      <img src={thumbPreviewUrl} alt="Cover video" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-medium text-white/55 text-center px-1">Tanpa cover</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCustomCoverChange}
                      className="hidden"
                    />
                    <Button
                      variant="gray"
                      size="sm"
                      icon={<ImagePlus className="w-3.5 h-3.5" />}
                      onClick={() => coverInputRef.current?.click()}
                    >
                      Pilih Foto Cover
                    </Button>
                    <p className="text-caption2 text-label-3 leading-snug">
                      Pakai snapshot otomatis video atau unggah poster khusus agar tampilan kartu tajam.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <TextField
              label={isEdit ? "URL Media Langsung (Opsional — ganti sumber eksternal)" : "Atau URL Media Langsung (Opsional)"}
              type="url"
              value={directUrl}
              onChange={(e) => {
                const v = e.target.value;
                setDirectUrl(v);
                if (!mediaFile && v.trim()) {
                  setMediaType(isVideoFileName(v) ? "video" : "image");
                }
              }}
              placeholder="https://..."
              leftIcon={<Link2 />}
            />
          </div>
        </Card>

        {/* 2. DETAIL KONTEN & FORMAT RASIO */}
        <Card title="Detail Konten" icon={<Sparkles className="w-4 h-4" />} iconColor="indigo" iconVariant="tinted">
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                label="Judul Konten"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Pricelist Sewa PS5"
              />

              <SelectField
                label="Kategori"
                value={category}
                onChange={(e) => setCategory(e.target.value as MediaCategory)}
              >
                {FORM_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-surface text-label">
                    {c}
                  </option>
                ))}
              </SelectField>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel className="mb-0">Format Aspek Rasio</FieldLabel>
                {activeRatioMeta && (
                  <span className="text-caption2 font-medium text-label-2">{activeRatioMeta.hint}</span>
                )}
              </div>
              <SubTabs
                size="sm"
                ariaLabel="Pilih format aspek rasio"
                value={aspectRatio}
                onChange={setAspectRatio}
                options={FORM_ASPECT_RATIOS.map((r) => ({ key: r.key, label: r.label }))}
              />
            </div>
          </div>
        </Card>

        {/* 3. CAPTION PROMOSI & TEMPLATE SIAP PAKAI */}
        <Card title="Caption Promosi" subtitle="Template siap pakai — 1 ketuk untuk isi cepat">
          <div className="space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {CAPTION_PRESETS.map((preset, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    setCaption(preset.caption);
                    if (!isEdit) {
                      setCategory(preset.category);
                      setAspectRatio(preset.aspectRatio);
                      if (!title.trim()) setTitle(preset.title);
                    }
                  }}
                  className="hit-44 px-3 py-1.5 rounded-full bg-fill hover:brightness-95 dark:hover:brightness-115 text-caption font-semibold whitespace-nowrap text-label border border-edge transition"
                >
                  {preset.title}
                </button>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel htmlFor="gallery-caption-input" className="mb-0">
                  Teks Caption
                </FieldLabel>
                <div className="flex items-center gap-2.5">
                  <span className="text-caption2 text-label-3 tabular-nums">{caption.length} karakter</span>
                  {caption.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCaption("")}
                      className="text-caption2 font-semibold text-tint hover:opacity-80 transition-opacity"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>
              </div>
              <TextAreaField
                id="gallery-caption-input"
                rows={4}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Tulis caption promosi menarik untuk Story WA Business & Instagram..."
                textareaClassName="font-sans text-footnote leading-relaxed"
              />
            </div>
          </div>
        </Card>

        {/* 4. SEMATKAN / PIN */}
        <ListGroup>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <div className="flex items-center gap-3 min-w-0">
              <IconBadge color="orange" variant="tinted">
                <Bookmark className="w-4 h-4" />
              </IconBadge>
              <div className="min-w-0">
                <p className="text-callout font-medium text-label truncate">Sematkan ke Paling Atas</p>
                <p className="text-caption text-label-2 truncate">
                  Konten ini selalu tampil di urutan pertama galeri
                </p>
              </div>
            </div>
            <Toggle on={pinned} onChange={setPinned} label="Sematkan ke Paling Atas" />
          </div>
        </ListGroup>

        {/* PROGRESS BAR UPLOAD */}
        {saving && (mediaFile || thumbBlob) && (
          <div className="p-3.5 rounded-tile apple-tile border border-sep space-y-2">
            <div className="flex items-center justify-between text-footnote font-semibold text-label">
              <span>Mengunggah media ke Firebase Storage...</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-fill rounded-full overflow-hidden">
              <div
                className="h-full bg-action transition-[width] duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </form>
    </Sheet>
  );
}
