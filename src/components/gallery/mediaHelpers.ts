import { ref, getBlob } from "firebase/storage";
import { storage } from "../../lib/firebase";
import type { WarnaIkon } from "../../ui";

export type MediaAspectRatio = "9:16" | "3:4" | "1:1" | "16:9";
export type RatioFilter = MediaAspectRatio | "all";

export type MediaCategory =
  | "Story Harian"
  | "Promo & Diskon"
  | "Daftar Harga & Sewa"
  | "Game Baru"
  | "Event & Turnamen"
  | "Branding";

export interface MediaItem {
  id: string;
  title: string;
  caption: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  storagePath?: string;
  thumbStoragePath?: string;
  mediaType: "image" | "video";
  videoDuration?: number;
  aspectRatio: MediaAspectRatio | "auto";
  category: MediaCategory;
  createdAt?: any;
  uploadedBy?: string;
  pinned?: boolean;
}

export const GALLERY_TITLE = "Galeri Media Sosial URBAN";

export const CATEGORIES: readonly ("Semua" | MediaCategory)[] = [
  "Semua",
  "Story Harian",
  "Promo & Diskon",
  "Daftar Harga & Sewa",
  "Game Baru",
  "Event & Turnamen",
  "Branding",
] as const;

export const FORM_CATEGORIES: readonly MediaCategory[] = [
  "Story Harian",
  "Promo & Diskon",
  "Daftar Harga & Sewa",
  "Game Baru",
  "Event & Turnamen",
  "Branding",
] as const;

/** Urutan tab switch rasio (9:16 paling awal, Semua paling akhir) */
export const ASPECT_RATIO_TABS: readonly { key: RatioFilter; label: string }[] = [
  { key: "9:16", label: "9:16" },
  { key: "3:4", label: "3:4" },
  { key: "1:1", label: "1:1" },
  { key: "16:9", label: "16:9" },
  { key: "all", label: "Semua" },
] as const;

/** Pilihan aspek rasio di form Tambah & Edit Media (SSOT) */
export const FORM_ASPECT_RATIOS: readonly { key: MediaAspectRatio; label: string; hint: string }[] = [
  { key: "9:16", label: "9:16", hint: "Story / Reels" },
  { key: "3:4", label: "3:4", hint: "Feed Potret" },
  { key: "1:1", label: "1:1", hint: "Square" },
  { key: "16:9", label: "16:9", hint: "Landscape" },
] as const;

export const CATEGORY_COLOR: Record<MediaCategory, WarnaIkon> = {
  "Story Harian": "blue",
  "Promo & Diskon": "pink",
  "Daftar Harga & Sewa": "indigo",
  "Game Baru": "purple",
  "Event & Turnamen": "orange",
  Branding: "teal",
};

export function labelFormatRasio(ratio?: string): string {
  if (ratio === "9:16") return "Story";
  if (ratio === "3:4") return "Feed";
  if (ratio === "1:1") return "Square";
  if (ratio === "16:9") return "Wide";
  return "Media";
}

export function normalisasiRasioForm(ratio?: string): MediaAspectRatio {
  if (ratio === "9:16" || ratio === "3:4" || ratio === "1:1" || ratio === "16:9") return ratio;
  return "9:16";
}

export function deteksiRasioDimensi(width: number, height: number): MediaAspectRatio {
  if (!width || !height) return "9:16";
  const ratio = height / width;
  if (ratio >= 1.5) return "9:16";
  if (ratio >= 1.18) return "3:4";
  if (ratio >= 0.85) return "1:1";
  return "16:9";
}

export function kelasAspekPoster(ratio?: string): string {
  if (ratio === "9:16") return "aspect-[9/16]";
  if (ratio === "3:4") return "aspect-[3/4]";
  if (ratio === "16:9") return "aspect-[16/9]";
  return "aspect-square";
}

export const CAPTION_PRESETS: readonly {
  title: string;
  category: MediaCategory;
  aspectRatio: MediaAspectRatio;
  caption: string;
}[] = [
  {
    title: "Promo Rental PS Weekend",
    category: "Promo & Diskon",
    aspectRatio: "9:16",
    caption: `🔥 WEEKEND VIBES BARENG URBAN GAMING! 🔥

Mau mabar seru bareng temen atau keluarga tanpa ribet?
Konsol PS4 & PS5 ter-update siap diantar langsung ke rumah kamu! 🚚💨

✨ Keuntungan Sewa di URBAN Gaming:
✅ Konsol bersih, terawat, & full game terbaru
✅ Free antar jemput area Bandar Lampung*
✅ Stik original & responsif
✅ Paket harian, 3 hari, & mingguan hemat!

📲 Booking sekarang sebelum kehabisan slot:
WhatsApp: 0822-8949-0123 / DM Instagram @urbangaming.lampung
#UrbanGaming #RentalPSLampung #RentalPS4 #RentalPS5 #MabarLampung`,
  },
  {
    title: "Update Game eFootball & FC 25",
    category: "Game Baru",
    aspectRatio: "9:16",
    caption: `⚽ GAME BARU & SQUAD TERBARU READY! ⚽

Update transfer musim terbaru untuk eFootball & EA FC 25 sudah tersedia di semua unit PS URBAN Gaming!
Siap adu skill & gelar turnamen mini bareng tongkrongan kamu! 🏆🔥

🎮 Ready: PS3 • PS4 Slim/Pro • PS5
📍 Fast Response Booking: WhatsApp / DM Instagram
#EAFC25 #eFootball2025 #RentalPS5 #RentalPSLampung #UrbanGaming`,
  },
  {
    title: "Pricelist Resmi Rental PS",
    category: "Daftar Harga & Sewa",
    aspectRatio: "9:16",
    caption: `📋 DAFTAR HARGA & PAKET SEWA URBAN GAMING 📋

Pilihan paket rental konsol terjangkau dengan pelayanan bintang lima:

🎮 PS3 Slim Full Game: Mulai Rp 40k/hari
🎮 PS4 Slim / Pro HEN: Mulai Rp 70k/hari
🎮 PS5 Digital / Disc: Mulai Rp 130k/hari

📦 Paket 3 Hari & Mingguan LEBIH HEMAT!
🚚 Tersedia layanan delivery antar ke alamat kamu.

Info & Pemesanan: WhatsApp 0822-8949-0123
#PricelistRentalPS #RentalPSLampung #UrbanGamingLampung`,
  },
  {
    title: "Story Harian - Open Slot Ready",
    category: "Story Harian",
    aspectRatio: "9:16",
    caption: `🎮 UNIT READY SIAP MELUNCUR HARI INI! 🎮

Slot rental hari ini masih tersedia beberapa unit PS4 & PS5!
Yuk amankan sekarang buat nemenin waktu santai kamu.

🛵 Delivery cepat & siap pasang di tempat!
Chat WhatsApp kami sekarang 📲
#UrbanGaming #RentalPSHariIni #PlaystationLampung`,
  },
  {
    title: "Info Turnamen & Event",
    category: "Event & Turnamen",
    aspectRatio: "1:1",
    caption: `🏆 TURNAMEN PLAYSTATION URBAN GAMING 🏆

Siapkan tim terbaikmu dan buktikan siapa raja lapangan hijau!
Turnamen seru berhadiah jutaan rupiah & trophy eksklusif.

Pendaftaran dibuka terbatas! Hubungi admin sekarang!
#TurnamenPSLampung #UrbanGamingTournament`,
  },
  {
    title: "Logo & Branding URBAN Gaming",
    category: "Branding",
    aspectRatio: "1:1",
    caption: `🎮 URBAN GAMING LAMPUNG 🎮
Pusat Rental PlayStation & Konsol Game Terlengkap, Terpercaya, dan Tercepat di Lampung!

Hubungi Admin: 0822-8949-0123
Follow IG: @urbangaming.lampung
#UrbanGamingLampung #RentalPS`,
  },
];

export const INITIAL_MEDIA_SEEDS: Omit<MediaItem, "id">[] = [
  {
    title: "Story Promo Weekend PS5",
    caption: `🔥 WEEKEND VIBES BARENG URBAN GAMING! 🔥\n\nBooking sekarang unit PS5 Disc / Digital siap antar ke rumah kamu! 🚚💨\n\nWhatsApp: 0822-8949-0123`,
    mediaUrl: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    aspectRatio: "9:16",
    category: "Promo & Diskon",
    pinned: true,
  },
  {
    title: "Update Game EA FC 25",
    caption: `⚽ SQUAD TERBARU & UPDATE TRANSFER READY! ⚽\n\neFootball & EA FC 25 siap dimainkan dengan grafis memukau 4K 60FPS!`,
    mediaUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    aspectRatio: "9:16",
    category: "Game Baru",
    pinned: false,
  },
  {
    title: "Pricelist Resmi Rental PS",
    caption: `📋 DAFTAR HARGA SEWA RESMI URBAN GAMING 📋\n\nPS3, PS4, dan PS5 dengan harga bersahabat & stik original!`,
    mediaUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80",
    mediaType: "image",
    aspectRatio: "1:1",
    category: "Daftar Harga & Sewa",
    pinned: true,
  },
  {
    title: "Unit Ready Hari Ini",
    caption: `✨ Siap antar langsung ke rumah kamu hari ini! Hubungi admin untuk booking slot sekarang.`,
    mediaUrl: "https://images.unsplash.com/photo-1592840496073-b50f607b36f7?auto=format&fit=crop&w=1080&q=80",
    mediaType: "image",
    aspectRatio: "9:16",
    category: "Story Harian",
    pinned: false,
  },
];

/* ============================================================
   HELPER: TIME AGO FORMATTER
   ============================================================ */
export function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "Baru saja";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return new Date(timestamp).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export const isVideoFileName = (nameOrUrl: string) => /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(nameOrUrl);

/* ============================================================
   ROBUST CLIENT-SIDE VIDEO THUMBNAIL CAPTURER & IMAGE COMPRESSOR
   ============================================================ */
export function captureVideoThumbnail(
  file: File
): Promise<{ blob: Blob; previewUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.preload = "auto";

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.top = "-9999px";
    video.style.width = "200px";
    video.style.height = "200px";
    video.style.opacity = "0.01";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);

    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(objectUrl);
        if (document.body.contains(video)) {
          document.body.removeChild(video);
        }
      } catch (e) {
        console.warn("Cleanup error:", e);
      }
    };

    const drawFrame = () => {
      if (finished) return true;
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return false;

        const canvas = document.createElement("canvas");
        canvas.width = Math.min(w, 1080);
        canvas.height = Math.round(canvas.width * (h / w));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return false;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 500) {
              const previewUrl = URL.createObjectURL(blob);
              cleanup();
              resolve({ blob, previewUrl, width: w, height: h });
            }
          },
          "image/jpeg",
          0.88
        );
        return true;
      } catch (err) {
        console.warn("drawFrame error:", err);
        return false;
      }
    };

    video.onloadeddata = () => {
      const seekTime = Math.min(1.0, Math.max(0.5, (video.duration || 2) / 2));
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      if (!drawFrame()) {
        setTimeout(drawFrame, 250);
      }
    };

    video
      .play()
      .then(() => {
        video.pause();
      })
      .catch(() => {});

    setTimeout(() => {
      if (!finished) {
        if (!drawFrame()) {
          cleanup();
          reject(new Error("Timeout generating thumbnail"));
        }
      }
    }, 4500);
  });
}

export function compressImage(file: File | Blob): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 1920;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            resolve(blob || file);
          },
          "image/jpeg",
          0.88
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

/* ============================================================
   MEDIA BLOB CACHE FOR INSTANT NATIVE FULL FILE SHARING
   ============================================================ */
export const mediaBlobCache = new Map<string, Blob>();
const mediaBlobInflight = new Map<string, Promise<Blob | null>>();

const SHAREABLE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

async function fetchMediaBlob(item: MediaItem): Promise<Blob | null> {
  // Method 1: Firebase Storage SDK getBlob (Direct binary download without browser CORS block)
  try {
    if (item.storagePath) {
      const storageRef = ref(storage, item.storagePath);
      const blob = await withTimeout(getBlob(storageRef), 20000);
      if (blob) {
        mediaBlobCache.set(item.mediaUrl, blob);
        return blob;
      }
    } else if (item.mediaUrl.includes("firebasestorage.googleapis.com")) {
      const storageRef = ref(storage, item.mediaUrl);
      const blob = await withTimeout(getBlob(storageRef), 20000);
      if (blob) {
        mediaBlobCache.set(item.mediaUrl, blob);
        return blob;
      }
    }
  } catch (err) {
    console.warn("Firebase getBlob failed, falling back to fetch:", err);
  }

  // Method 2: Standard fetch fallback
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const response = await fetch(item.mediaUrl, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    if (response.ok) {
      const blob = await response.blob();
      mediaBlobCache.set(item.mediaUrl, blob);
      return blob;
    }
  } catch (err) {
    console.warn("Standard fetch failed:", err);
  }
  return null;
}

export function prefetchMediaBlob(item: MediaItem): Promise<Blob | null> {
  if (!item.mediaUrl) return Promise.resolve(null);
  const cached = mediaBlobCache.get(item.mediaUrl);
  if (cached) return Promise.resolve(cached);
  const inflight = mediaBlobInflight.get(item.mediaUrl);
  if (inflight) return inflight;
  const p = fetchMediaBlob(item).finally(() => mediaBlobInflight.delete(item.mediaUrl));
  mediaBlobInflight.set(item.mediaUrl, p);
  return p;
}

export const supportsNativeFileShare = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function" &&
  typeof navigator.canShare === "function";

export function buildShareFile(item: MediaItem): File | null {
  const blob = mediaBlobCache.get(item.mediaUrl);
  if (!blob) return null;
  const isVideo = item.mediaType === "video";
  const blobType = (blob.type || "").toLowerCase().split(";")[0].trim();
  const mimeType = SHAREABLE_MIME_EXT[blobType] ? blobType : isVideo ? "video/mp4" : "image/jpeg";
  const ext = SHAREABLE_MIME_EXT[mimeType];
  const cleanTitle = (item.title || "media").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);
  return new File([blob], `URBAN_${cleanTitle}.${ext}`, { type: mimeType });
}

export async function copyCaptionQuietly(caption: string): Promise<boolean> {
  if (!caption) return false;
  try {
    await Promise.race([
      navigator.clipboard.writeText(caption),
      new Promise((_, reject) => setTimeout(() => reject(new Error("clipboard-timeout")), 400)),
    ]);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = caption;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, caption.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function copyCaptionWithFeedback(caption: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(caption);
    return true;
  } catch {
    return copyCaptionQuietly(caption);
  }
}
