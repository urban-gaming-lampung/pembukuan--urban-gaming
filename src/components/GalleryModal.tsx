import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, updateDoc, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

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
  aspectRatio: "9:16" | "3:4" | "1:1" | "16:9" | "auto";
  category: "Story Harian" | "Promo & Diskon" | "Daftar Harga & Sewa" | "Game Baru" | "Event & Turnamen" | "Branding";
  createdAt?: any;
  uploadedBy?: string;
  pinned?: boolean;
}

interface GalleryModalProps {
  open: boolean;
  onClose: () => void;
  isSuperAdminOrOwner: boolean;
  adminName: string;
}

const CATEGORIES = [
  "Semua",
  "Story Harian",
  "Promo & Diskon",
  "Daftar Harga & Sewa",
  "Game Baru",
  "Event & Turnamen",
  "Branding",
] as const;

const ASPECT_RATIOS = [
  { key: "all", label: "SEMUA" },
  { key: "9:16", label: "9:16" },
  { key: "3:4", label: "3:4" },
  { key: "1:1", label: "1:1" },
  { key: "16:9", label: "16:9" },
];

const CAPTION_PRESETS = [
  {
    title: "Promo Rental PS Weekend",
    category: "Promo & Diskon" as const,
    aspectRatio: "9:16" as const,
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
    category: "Game Baru" as const,
    aspectRatio: "9:16" as const,
    caption: `⚽ GAME BARU & SQUAD TERBARU READY! ⚽

Update transfer musim terbaru untuk eFootball & EA FC 25 sudah tersedia di semua unit PS URBAN Gaming!
Siap adu skill & gelar turnamen mini bareng tongkrongan kamu! 🏆🔥

🎮 Ready: PS3 • PS4 Slim/Pro • PS5
📍 Fast Response Booking: WhatsApp / DM Instagram
#EAFC25 #eFootball2025 #RentalPS5 #RentalPSLampung #UrbanGaming`,
  },
  {
    title: "Pricelist Resmi Rental PS",
    category: "Daftar Harga & Sewa" as const,
    aspectRatio: "9:16" as const,
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
    category: "Story Harian" as const,
    aspectRatio: "9:16" as const,
    caption: `🎮 UNIT READY SIAP MELUNCUR HARI INI! 🎮

Slot rental hari ini masih tersedia beberapa unit PS4 & PS5!
Yuk amankan sekarang buat nemenin waktu santai kamu.

🛵 Delivery cepat & siap pasang di tempat!
Chat WhatsApp kami sekarang 📲
#UrbanGaming #RentalPSHariIni #PlaystationLampung`,
  },
  {
    title: "Info Turnamen & Event",
    category: "Event & Turnamen" as const,
    aspectRatio: "1:1" as const,
    caption: `🏆 TURNAMEN PLAYSTATION URBAN GAMING 🏆

Siapkan tim terbaikmu dan buktikan siapa raja lapangan hijau!
Turnamen seru berhadiah jutaan rupiah & trophy eksklusif.

Pendaftaran dibuka terbatas! Hubungi admin sekarang!
#TurnamenPSLampung #UrbanGamingTournament`,
  },
  {
    title: "Logo & Branding URBAN Gaming",
    category: "Branding" as const,
    aspectRatio: "1:1" as const,
    caption: `🎮 URBAN GAMING LAMPUNG 🎮
Pusat Rental PlayStation & Konsol Game Terlengkap, Terpercaya, dan Tercepat di Lampung!

Hubungi Admin: 0822-8949-0123
Follow IG: @urbangaming.lampung
#UrbanGamingLampung #RentalPS`,
  },
];

const INITIAL_MEDIA_SEEDS: Omit<MediaItem, "id">[] = [
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
   PURE SVG SF-SYMBOLS & POS-STYLE ICONS
   ============================================================ */
const Icons = {
  Gallery: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="3" rx="4" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  ),

  Share: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  ),

  Copy: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="13" height="13" x="9" y="9" rx="3" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),

  Download: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),

  Upload: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),

  PlusCircle: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),

  Bookmark: ({ className = "w-4 h-4", filled = false }: { className?: string; filled?: boolean }) => (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  ),

  MoreHorizontal: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  ),

  Trash: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  ),

  Edit: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),

  Search: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),

  X: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),

  Check: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),

  Video: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m22 8-6 4 6 4V8Z" />
      <rect width="14" height="12" x="2" y="6" rx="3" />
    </svg>
  ),

  Play: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  ),

  Smartphone: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="14" height="20" x="5" y="2" rx="4" />
      <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
    </svg>
  ),

  External: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),

  WhatsAppBusiness: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.05 15.68c-1.4 0-2.38-.28-3.08-.72l.44-1.22c.58.35 1.44.62 2.45.62 1.38 0 2.22-.68 2.22-1.68 0-.91-.56-1.46-1.95-1.97-1.78-.66-2.58-1.5-2.58-2.69 0-1.53 1.26-2.67 3.23-2.67 1.15 0 2.05.24 2.58.52l-.43 1.21c-.44-.24-1.17-.46-2.09-.46-1.22 0-1.89.65-1.89 1.45 0 .86.58 1.35 1.95 1.87 1.83.69 2.62 1.54 2.62 2.82 0 1.63-1.28 2.72-3.47 2.72z"/>
    </svg>
  ),

  WhatsApp: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm5.79 14.07c-.24.67-1.39 1.29-1.92 1.37-.49.08-1.12.11-3.23-.76-2.69-1.12-4.42-3.84-4.55-4.02-.13-.18-1.09-1.45-1.09-2.77 0-1.32.69-1.97.94-2.23.24-.26.53-.32.71-.32.18 0 .35 0 .51.01.16.01.39-.06.6.46.24.57.81 1.98.88 2.13.07.15.12.32.02.52-.09.2-.14.32-.28.48-.14.16-.3.35-.43.47-.14.14-.29.29-.12.58.17.29.74 1.22 1.6 1.98 1.1 1 2.03 1.31 2.32 1.45.29.14.46.12.63-.07.17-.2.74-.86.94-1.16.2-.29.4-.24.67-.14.27.1 1.73.81 2.03.96.3.15.49.22.56.34.07.12.07.72-.17 1.39z"/>
    </svg>
  ),

  Instagram: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  ),

  Facebook: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),

  TikTok: ({ className = "w-5 h-5" }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.46 2.79 1.25-.01 2.45-.78 2.87-1.96.22-.57.25-1.2.24-1.81V.02h.67z"/>
    </svg>
  ),
};

/* ============================================================
   HELPER: TIME AGO FORMATTER
   ============================================================ */
const formatTimeAgo = (timestamp?: number) => {
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
};

/* ============================================================
   ROBUST CLIENT-SIDE VIDEO THUMBNAIL CAPTURER
   ============================================================ */
const captureVideoThumbnail = (file: File): Promise<{ blob: Blob; previewUrl: string; width: number; height: number }> => {
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

    video.play().then(() => {
      video.pause();
    }).catch(() => {});

    setTimeout(() => {
      if (!finished) {
        if (!drawFrame()) {
          cleanup();
          reject(new Error("Timeout generating thumbnail"));
        }
      }
    }, 4500);
  });
};

/* ============================================================
   MEDIA BLOB CACHE FOR INSTANT NATIVE FULL FILE SHARING
   ============================================================ */
const mediaBlobCache = new Map<string, Blob>();

const prefetchMediaBlob = async (item: MediaItem): Promise<Blob | null> => {
  if (!item.mediaUrl) return null;
  if (mediaBlobCache.has(item.mediaUrl)) {
    return mediaBlobCache.get(item.mediaUrl)!;
  }

  // Method 1: Firebase Storage SDK getBlob (Direct binary download without browser CORS block)
  try {
    if (item.storagePath) {
      const storageRef = ref(storage, item.storagePath);
      const blob = await getBlob(storageRef);
      if (blob) {
        mediaBlobCache.set(item.mediaUrl, blob);
        return blob;
      }
    } else if (item.mediaUrl.includes("firebasestorage.googleapis.com")) {
      const storageRef = ref(storage, item.mediaUrl);
      const blob = await getBlob(storageRef);
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
    const response = await fetch(item.mediaUrl);
    if (response.ok) {
      const blob = await response.blob();
      mediaBlobCache.set(item.mediaUrl, blob);
      return blob;
    }
  } catch (err) {
    console.warn("Standard fetch failed:", err);
  }
  return null;
};

export default function GalleryModal({
  open,
  onClose,
  isSuperAdminOrOwner,
  adminName,
}: GalleryModalProps) {
  useBodyScrollLock(open);

  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("Semua");
  const [activeRatio, setActiveRatio] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [openUpload, setOpenUpload] = useState(false);
  const [openPreview, setOpenPreview] = useState<MediaItem | null>(null);
  const [openEdit, setOpenEdit] = useState<MediaItem | null>(null);
  const [shareTargetItem, setShareTargetItem] = useState<MediaItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCaption, setUploadCaption] = useState(CAPTION_PRESETS[0].caption);
  const [uploadCategory, setUploadCategory] = useState<MediaItem["category"]>("Promo & Diskon");
  const [uploadAspectRatio, setUploadAspectRatio] = useState<MediaItem["aspectRatio"]>("9:16");
  const [uploadMediaType, setUploadMediaType] = useState<"image" | "video">("image");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadThumbnailBlob, setUploadThumbnailBlob] = useState<Blob | null>(null);
  const [uploadThumbnailPreviewUrl, setUploadThumbnailPreviewUrl] = useState<string | null>(null);
  const [directUrlInput, setDirectUrlInput] = useState("");
  const [uploadPinned, setUploadPinned] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Edit Cover Form State
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreviewUrl, setEditCoverPreviewUrl] = useState<string | null>(null);
  const [updatingCover, setUpdatingCover] = useState(false);

  useEffect(() => {
    if (!toastMsg) return;
    const timer = setTimeout(() => setToastMsg(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMsg]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    if (shareTargetItem?.mediaUrl) {
      prefetchMediaBlob(shareTargetItem);
    }
  }, [shareTargetItem]);

  useEffect(() => {
    if (openPreview?.mediaUrl) {
      prefetchMediaBlob(openPreview);
    }
  }, [openPreview]);

  useEffect(() => {
    if (mediaList.length > 0) {
      mediaList.slice(0, 15).forEach((item) => {
        prefetchMediaBlob(item);
      });
    }
  }, [mediaList]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    try {
      const galleryRef = collection(db, "media_gallery");
      const q = query(galleryRef, orderBy("createdAt", "desc"));
      
      const unsub = onSnapshot(q, (snapshot) => {
        const items: MediaItem[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...(d.data() as any) });
        });
        setMediaList(items);
        setLoading(false);
      }, (err) => {
        console.warn("Firestore gallery query fallback to simple collection:", err);
        const unsubFallback = onSnapshot(galleryRef, (snapshot) => {
          const items: MediaItem[] = [];
          snapshot.forEach((d) => {
            items.push({ id: d.id, ...(d.data() as any) });
          });
          items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setMediaList(items);
          setLoading(false);
        });
        return () => unsubFallback();
      });

      return () => unsub();
    } catch (e) {
      console.error("Error loading media gallery:", e);
      setLoading(false);
    }
  }, [open]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    const objectUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(objectUrl);

    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|mkv)$/i.test(file.name);

    if (isVideo) {
      setUploadMediaType("video");
      showToast("Menganalisis video & membuat cover thumbnail... ⏳");

      try {
        const thumbResult = await captureVideoThumbnail(file);
        setUploadThumbnailBlob(thumbResult.blob);
        setUploadThumbnailPreviewUrl(thumbResult.previewUrl);

        const ratio = thumbResult.height / thumbResult.width;
        if (ratio >= 1.5) {
          setUploadAspectRatio("9:16");
        } else if (ratio >= 1.2 && ratio < 1.5) {
          setUploadAspectRatio("3:4");
        } else if (ratio >= 0.85 && ratio <= 1.15) {
          setUploadAspectRatio("1:1");
        } else if (ratio <= 0.7) {
          setUploadAspectRatio("16:9");
        }
        showToast("Cover thumbnail video berhasil dibuat! 📸");
      } catch (err) {
        console.warn("Auto thumbnail fallback:", err);
      }
    } else {
      setUploadMediaType("image");
      setUploadThumbnailBlob(null);
      setUploadThumbnailPreviewUrl(null);

      const img = new Image();
      img.onload = () => {
        const ratio = img.height / img.width;
        if (ratio >= 1.5) {
          setUploadAspectRatio("9:16");
        } else if (ratio >= 1.2 && ratio < 1.5) {
          setUploadAspectRatio("3:4");
        } else if (ratio >= 0.85 && ratio <= 1.15) {
          setUploadAspectRatio("1:1");
        } else if (ratio <= 0.7) {
          setUploadAspectRatio("16:9");
        }
      };
      img.src = objectUrl;
    }

    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "));
    }
  };

  const handleCustomCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadThumbnailBlob(file);
    const url = URL.createObjectURL(file);
    setUploadThumbnailPreviewUrl(url);
    showToast("Foto cover kustom berhasil dipilih! 🖼️");
  };

  const handleSeedDefaults = async () => {
    if (!confirm("Inisialisasi template bawaan promosi URBAN Gaming ke database?")) return;
    try {
      setLoading(true);
      for (const item of INITIAL_MEDIA_SEEDS) {
        await addDoc(collection(db, "media_gallery"), {
          ...item,
          createdAt: Date.now(),
          uploadedBy: adminName,
        });
      }
      showToast("Template bawaan berhasil ditambahkan! ✨");
    } catch (e: any) {
      alert("Gagal inisialisasi: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const compressImage = async (file: File | Blob): Promise<Blob> => {
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
      };
    });
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile && !directUrlInput.trim()) {
      alert("Pilih file media gambar/video atau masukkan URL langsung.");
      return;
    }
    if (!uploadTitle.trim()) {
      alert("Masukkan judul media promosi.");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(15);

      let finalMediaUrl = directUrlInput.trim();
      let finalThumbnailUrl = "";
      let storagePath = "";
      let thumbStoragePath = "";

      const isVideo = uploadMediaType === "video" || /\.(mp4|mov|webm|m4v|mkv)$/i.test(finalMediaUrl);

      if (uploadFile) {
        setUploadProgress(30);
        const timestamp = Date.now();
        const cleanName = uploadFile.name.replace(/[^a-zA-Z0-9.]/g, "_");

        if (isVideo) {
          storagePath = `gallery_media/${timestamp}_${cleanName}`;
          const storageRef = ref(storage, storagePath);
          setUploadProgress(45);
          await uploadBytes(storageRef, uploadFile);
          finalMediaUrl = await getDownloadURL(storageRef);

          if (uploadThumbnailBlob) {
            setUploadProgress(75);
            thumbStoragePath = `gallery_media/${timestamp}_thumb.jpg`;
            const thumbRef = ref(storage, thumbStoragePath);
            const compressedThumb = await compressImage(uploadThumbnailBlob);
            await uploadBytes(thumbRef, compressedThumb);
            finalThumbnailUrl = await getDownloadURL(thumbRef);
          }
        } else {
          const compressedBlob = await compressImage(uploadFile);
          storagePath = `gallery_media/${timestamp}_${cleanName}`;
          const storageRef = ref(storage, storagePath);
          setUploadProgress(60);
          await uploadBytes(storageRef, compressedBlob);
          finalMediaUrl = await getDownloadURL(storageRef);
        }
        setUploadProgress(88);
      }

      setUploadProgress(95);
      await addDoc(collection(db, "media_gallery"), {
        title: uploadTitle.trim(),
        caption: uploadCaption.trim(),
        mediaUrl: finalMediaUrl,
        thumbnailUrl: finalThumbnailUrl || null,
        storagePath: storagePath || null,
        thumbStoragePath: thumbStoragePath || null,
        mediaType: isVideo ? "video" : "image",
        aspectRatio: uploadAspectRatio,
        category: uploadCategory,
        createdAt: Date.now(),
        uploadedBy: adminName,
        pinned: uploadPinned,
      });

      showToast(`Media ${isVideo ? "video" : "gambar"} berhasil diunggah! 🚀`);
      
      setOpenUpload(false);
      setUploadTitle("");
      setUploadCaption(CAPTION_PRESETS[0].caption);
      setUploadFile(null);
      setUploadPreviewUrl(null);
      setUploadThumbnailBlob(null);
      setUploadThumbnailPreviewUrl(null);
      setDirectUrlInput("");
      setUploadPinned(false);
    } catch (e: any) {
      console.error("Upload error:", e);
      alert("Gagal mengunggah media: " + e.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleTogglePin = async (item: MediaItem) => {
    try {
      await updateDoc(doc(db, "media_gallery", item.id), {
        pinned: !item.pinned,
      });
      showToast(item.pinned ? "Pin dilepas" : "Disematkan ke paling atas ⭐");
    } catch (e: any) {
      alert("Gagal mengubah pin: " + e.message);
    }
  };

  const handleDeleteItem = async (item: MediaItem) => {
    if (!confirm(`Hapus media "${item.title}" dari galeri?`)) return;
    try {
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
      showToast("Media berhasil dihapus.");
      if (openPreview?.id === item.id) setOpenPreview(null);
    } catch (e: any) {
      alert("Gagal menghapus media: " + e.message);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openEdit) return;
    try {
      setUpdatingCover(true);
      let newThumbUrl = openEdit.thumbnailUrl || "";
      let newThumbStoragePath = openEdit.thumbStoragePath || "";

      if (editCoverFile) {
        showToast("Mengunggah cover thumbnail baru... ⏳");
        const timestamp = Date.now();
        newThumbStoragePath = `gallery_media/${timestamp}_custom_thumb.jpg`;
        const thumbRef = ref(storage, newThumbStoragePath);
        const compressed = await compressImage(editCoverFile);
        await uploadBytes(thumbRef, compressed);
        newThumbUrl = await getDownloadURL(thumbRef);
      }

      await updateDoc(doc(db, "media_gallery", openEdit.id), {
        title: openEdit.title,
        caption: openEdit.caption,
        category: openEdit.category,
        aspectRatio: openEdit.aspectRatio,
        pinned: openEdit.pinned,
        thumbnailUrl: newThumbUrl || null,
        thumbStoragePath: newThumbStoragePath || null,
      });

      showToast("Perubahan media berhasil disimpan! ✨");
      setOpenEdit(null);
      setEditCoverFile(null);
      setEditCoverPreviewUrl(null);
    } catch (e: any) {
      alert("Gagal menyimpan perubahan: " + e.message);
    } finally {
      setUpdatingCover(false);
    }
  };

  const handleCopyCaption = async (caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      showToast("Caption promosi berhasil disalin! 📋");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = caption;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Caption promosi berhasil disalin! 📋");
    }
  };

  const handleDownloadMedia = async (item: MediaItem) => {
    const ext = item.mediaType === "video" ? "mp4" : "jpg";
    const filename = `URBAN_GAMING_${(item.title || "media").replace(/\s+/g, "_")}.${ext}`;
    try {
      showToast("Mengunduh media...");
      const response = await fetch(item.mediaUrl, { mode: "cors" });
      if (!response.ok) throw new Error("CORS or fetch error");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast(`Media ${ext.toUpperCase()} berhasil diunduh! ⬇️`);
    } catch {
      const a = document.createElement("a");
      a.href = item.mediaUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Mengunduh media ke perangkat...");
    }
  };

  const shareFileDirectly = async (item: MediaItem): Promise<boolean> => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return false;
    }

    try {
      let blob = mediaBlobCache.get(item.mediaUrl);
      if (!blob) {
        showToast("Menyiapkan file media... ⏳");
        blob = (await prefetchMediaBlob(item)) || undefined;
      }

      if (blob) {
        const ext = item.mediaType === "video" ? "mp4" : "jpg";
        const mimeType = item.mediaType === "video" ? "video/mp4" : "image/jpeg";
        const cleanTitle = (item.title || "media").replace(/[^a-zA-Z0-9]/g, "_");
        const file = new File([blob], `URBAN_${cleanTitle}.${ext}`, { type: mimeType });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: item.title,
          });
          showToast("Berhasil membagikan media asli! 🚀");
          setShareTargetItem(null);
          return true;
        }
      }

      // Fallback: If device doesn't support binary file share, save full media to gallery!
      await handleDownloadMedia(item);
      showToast("Media tersimpan di galeri HP! Silakan pasang ke WhatsApp / Story 📸");
      return true;
    } catch (err: any) {
      if (err.name === "AbortError") {
        return true; // User intentionally cancelled share sheet
      }
      console.warn("Direct file share error:", err);
    }

    return false;
  };

  const shareToWhatsAppBusiness = async (item: MediaItem) => {
    // 1. Native OS File Share (Passes actual video/photo into WhatsApp)
    const success = await shareFileDirectly(item);
    if (success) return;

    // 2. Fallback: Download the real media file to gallery first, then open WhatsApp!
    showToast("Mengunduh foto/video ke Galeri HP... ⏳");
    await handleDownloadMedia(item);

    const isAndroid = /android/i.test(navigator.userAgent || "");
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent || "");

    setTimeout(() => {
      if (isAndroid) {
        window.location.href = "intent://#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end";
      } else if (isIOS) {
        window.location.href = "whatsapp://";
      } else {
        window.open("https://web.whatsapp.com", "_blank");
      }
      showToast("Media tersimpan di galeri! Buka Status WA untuk memilih foto/video 📸");
    }, 800);
  };

  const shareToWhatsAppRegular = async (item: MediaItem) => {
    const success = await shareFileDirectly(item);
    if (success) return;

    showToast("Mengunduh foto/video ke Galeri HP... ⏳");
    await handleDownloadMedia(item);

    const isAndroid = /android/i.test(navigator.userAgent || "");

    setTimeout(() => {
      if (isAndroid) {
        window.location.href = "intent://#Intent;package=com.whatsapp;scheme=whatsapp;end";
      } else {
        window.open("https://api.whatsapp.com", "_blank");
      }
      showToast("Media tersimpan di galeri! Buka Status WA untuk memilih foto/video 📸");
    }, 800);
  };

  const shareToInstagram = async (item: MediaItem) => {
    const success = await shareFileDirectly(item);
    if (success) return;

    showToast("Mengunduh foto/video ke Galeri HP... ⏳");
    await handleDownloadMedia(item);

    const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent || "");
    setTimeout(() => {
      if (isMobile) {
        window.location.href = "instagram://app";
      } else {
        window.open("https://instagram.com", "_blank");
      }
      showToast("Media tersimpan di galeri! Silakan pasang Story Instagram 📸");
    }, 800);
  };

  const shareToFacebook = async (item: MediaItem) => {
    const success = await shareFileDirectly(item);
    if (success) return;

    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(item.mediaUrl)}`;
    window.open(fbUrl, "_blank");
    showToast("Membuka Facebook... 🔵");
  };

  const shareToTikTok = async (item: MediaItem) => {
    const success = await shareFileDirectly(item);
    if (success) return;

    await handleDownloadMedia(item);
    window.open("https://www.tiktok.com/upload", "_blank");
    showToast("Media tersimpan di galeri! Silakan upload ke TikTok 🎵");
  };

  const handleShareClick = async (item: MediaItem) => {
    // Directly launch native Web Share API on click
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      const handled = await shareFileDirectly(item);
      if (handled) return;
    }
    // If Web Share API is not supported on this device/browser:
    setShareTargetItem(item);
  };

  const filteredMedia = useMemo(() => {
    return mediaList.filter((item) => {
      if (activeCategory !== "Semua" && item.category !== activeCategory) {
        return false;
      }
      if (activeRatio !== "all" && item.aspectRatio !== activeRatio) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchCaption = item.caption?.toLowerCase().includes(q);
        const matchCategory = item.category?.toLowerCase().includes(q);
        if (!matchTitle && !matchCaption && !matchCategory) return false;
      }
      return true;
    }).sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [mediaList, activeCategory, activeRatio, searchQuery]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-[100] items-center justify-center bg-black/40 backdrop-blur-md transition-opacity duration-300 font-sans ${open ? "flex" : "hidden"}`}>
      
      {/* ============================================================
          MAIN CONTAINER (Full-Screen iOS Style matching POSModal)
          ============================================================ */}
      <div className="relative w-full h-full bg-zinc-50 dark:bg-[#1C1C1E] overflow-hidden flex flex-col animate-in fade-in duration-300">
        
        {/* ============================================================
            1. TOP iOS HEADER BAR (SSOT MATCHING POS)
            ============================================================ */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/50 dark:border-white/5 bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-xl z-20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-black/10 dark:bg-white/20 text-black dark:text-white flex items-center justify-center">
              <Icons.Gallery className="w-4 h-4 stroke-[2.2]" />
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white uppercase">
              GALERI MEDIA SOSIAL
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-300/60 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 active:scale-90 transition-all"
            aria-label="Tutup Galeri"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        {/* ============================================================
            2. TOP CONTROLS & FILTER SECTION (SSOT MATCHING POS TABS)
            ============================================================ */}
        <div className="p-3.5 sm:p-4 bg-white/50 dark:bg-black/10 border-b border-zinc-200/60 dark:border-white/5 shrink-0 max-w-4xl mx-auto w-full space-y-2.5">
          
          {/* Segmented Format/Rasio Tabs (Matching POS Sub-Menu) */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-[14px] gap-1 overflow-x-auto no-scrollbar">
            {ASPECT_RATIOS.map((r) => {
              const active = activeRatio === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setActiveRatio(r.key)}
                  className={`flex-1 min-w-[80px] py-2.5 text-[11px] font-bold rounded-[10px] tracking-wide transition-all ${
                    active
                      ? "bg-white dark:bg-[#2C2C2E] text-black dark:text-white shadow-sm ring-1 ring-black/5"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Large Black Action Button (Matching POS "+ Tambah Produk") */}
          {isSuperAdminOrOwner && (
            <div className="flex gap-2">
              <button 
                onClick={() => setOpenUpload(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black shadow-md shadow-black/25 dark:shadow-white/10 active:scale-95 transition-all font-bold text-xs sm:text-sm"
              >
                <Icons.PlusCircle className="w-4 h-4" />
                <span>Tambah Media Promosi</span>
              </button>

              {mediaList.length === 0 && (
                <button 
                  onClick={handleSeedDefaults}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs active:scale-95 transition-all"
                >
                  <Icons.Upload className="w-4 h-4" />
                  <span>Inisialisasi Awal</span>
                </button>
              )}
            </div>
          )}

          {/* Search Input Bar (Matching POS Search Bar) */}
          <div className="relative">
            <Icons.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari konten promosi, game, atau promo..."
              className="w-full pl-10 pr-8 py-2.5 rounded-2xl bg-zinc-100/90 dark:bg-zinc-800/80 border border-transparent focus:border-zinc-400 text-xs sm:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <Icons.X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter Pills (Matching POS Category Pills) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {CATEGORIES.map((cat) => {
              const count = cat === "Semua" ? mediaList.length : mediaList.filter((m) => m.category === cat).length;
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-black text-white dark:bg-white dark:text-black shadow-sm font-bold"
                      : "bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    active
                      ? "bg-zinc-800 text-zinc-300 dark:bg-zinc-200 dark:text-zinc-800"
                      : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>

        {/* ============================================================
            3. MAIN GALLERY GRID (2-COLUMNS WITH CLEAN CARD DESIGN)
            ============================================================ */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 scrollbar-ios">
          <div className="max-w-4xl mx-auto w-full pb-20">
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
                <div className="w-10 h-10 border-3 border-black dark:border-white border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs font-semibold">Memuat galeri media sosial...</p>
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-[#1C1C1E] rounded-[24px] border border-zinc-200/80 dark:border-zinc-800">
                <div className="w-16 h-16 rounded-[20px] bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
                  <Icons.Gallery className="w-8 h-8 stroke-[1.8]" />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-1">
                  Belum Ada Media di Kategori Ini
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mb-6">
                  Unggah poster promosi, video gameplay seru, atau pricelist rental untuk dibagikan ke Story WhatsApp Business & Instagram.
                </p>
                {isSuperAdminOrOwner && (
                  <button
                    onClick={() => setOpenUpload(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-bold shadow-md active:scale-95 transition-all"
                  >
                    <Icons.PlusCircle className="w-4 h-4" />
                    <span>Tambah Media Promosi</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                {filteredMedia.map((item) => (
                  <div
                    key={item.id}
                    onMouseEnter={() => prefetchMediaBlob(item)}
                    onTouchStart={() => prefetchMediaBlob(item)}
                    className="group bg-white dark:bg-[#1C1C1E] rounded-[24px] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col p-2 sm:p-2.5 justify-between"
                  >
                    {/* Media Poster Box */}
                    <div
                      onClick={() => setOpenPreview(item)}
                      className={`relative w-full cursor-pointer overflow-hidden rounded-[18px] bg-zinc-900 ${
                        item.aspectRatio === "9:16"
                          ? "aspect-[9/16]"
                          : item.aspectRatio === "3:4"
                          ? "aspect-[3/4]"
                          : item.aspectRatio === "16:9"
                          ? "aspect-[16/9]"
                          : "aspect-square"
                      }`}
                    >
                      {item.mediaType === "video" ? (
                        <div className="relative w-full h-full bg-zinc-950 flex items-center justify-center">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-950/80 via-zinc-900 to-black flex flex-col items-center justify-center p-3 text-center">
                              <Icons.Video className="w-8 h-8 text-purple-400 mb-1 opacity-70" />
                              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Video Promo</span>
                            </div>
                          )}
                          
                          {/* Play Button Indicator */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center shadow-lg border border-white/20 group-hover:scale-110 transition-transform">
                              <Icons.Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={item.mediaUrl}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}

                      {/* Top Overlay Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none gap-1">
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/10 shadow-xs truncate max-w-[70%]">
                          {item.category}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.mediaType === "video" && (
                            <div className="w-6 h-6 rounded-full bg-purple-600 text-white shadow-md flex items-center justify-center">
                              <Icons.Video className="w-3 h-3" />
                            </div>
                          )}
                          {item.pinned && (
                            <div className="w-6 h-6 rounded-full bg-amber-500 text-white shadow-md flex items-center justify-center">
                              <Icons.Bookmark className="w-3 h-3" filled />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Content Info */}
                    <div className="pt-2.5 pb-1 px-1 flex flex-col gap-2 flex-1 justify-between">
                      
                      {/* Title & Time */}
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white truncate">
                            {item.title}
                          </h4>
                          <button
                            onClick={() => setOpenPreview(item)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5 rounded"
                          >
                            <Icons.MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                          Story • {item.aspectRatio} • {formatTimeAgo(item.createdAt)}
                        </p>
                      </div>

                      {/* Caption Preview */}
                      <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-2 sm:p-2.5 border border-zinc-100 dark:border-zinc-800/60">
                        <p className="text-[10px] sm:text-[11px] text-zinc-600 dark:text-zinc-300 font-sans line-clamp-2 leading-relaxed">
                          {item.caption || "Tidak ada caption"}
                        </p>
                      </div>

                      {/* Primary Buttons */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handleShareClick(item)}
                          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] active:bg-[#15803D] text-white font-bold text-[11px] sm:text-xs shadow-sm shadow-green-500/20 active:scale-95 transition-all"
                          title="Share Media & Caption"
                        >
                          <Icons.Share className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Share</span>
                        </button>

                        <button
                          onClick={() => handleCopyCaption(item.caption)}
                          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-[11px] sm:text-xs active:scale-95 transition-all border border-zinc-200/50 dark:border-zinc-700/50"
                          title="Salin Teks Caption"
                        >
                          <Icons.Copy className="w-3.5 h-3.5" />
                          <span>Salin</span>
                        </button>
                      </div>

                      {/* Bottom Toolbar Icons */}
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 px-1 text-zinc-400">
                        <button
                          onClick={() => handleDownloadMedia(item)}
                          className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                          title="Download Media"
                        >
                          <Icons.Download className="w-4 h-4" />
                        </button>

                        {isSuperAdminOrOwner && (
                          <>
                            <button
                              onClick={() => handleTogglePin(item)}
                              className={`p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                                item.pinned ? "text-amber-500" : "hover:text-amber-500"
                              }`}
                              title={item.pinned ? "Lepas Bookmark / Pin" : "Sematkan"}
                            >
                              <Icons.Bookmark className="w-4 h-4" filled={item.pinned} />
                            </button>

                            <button
                              onClick={() => {
                                setOpenEdit(item);
                                setEditCoverFile(null);
                                setEditCoverPreviewUrl(item.thumbnailUrl || null);
                              }}
                              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-blue-500 transition-colors"
                              title="Edit Media"
                            >
                              <Icons.Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 rounded-lg hover:bg-red-500/10 hover:text-[#FF3B30] transition-colors"
                              title="Hapus Media"
                            >
                              <Icons.Trash className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* ============================================================
          STORY PREVIEW SIMULATOR (IPHONE 16 PRO STYLE)
          ============================================================ */}
      {openPreview && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col md:flex-row bg-[#1C1C1E] border border-white/10 rounded-[28px] sm:rounded-[32px] overflow-hidden shadow-2xl">
            
            <div className="flex-1 bg-black flex items-center justify-center p-3 sm:p-6">
              <div className="relative w-full max-w-[280px] sm:max-w-[310px] aspect-[9/16] rounded-[32px] sm:rounded-[36px] overflow-hidden ring-4 ring-white/15 shadow-2xl bg-zinc-900 flex flex-col justify-between">
                
                {openPreview.mediaType === "video" ? (
                  <video
                    src={openPreview.mediaUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={openPreview.mediaUrl}
                    alt={openPreview.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                <div className="relative z-10 p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
                  <div className="w-20 h-5 bg-black rounded-full mx-auto mb-2 flex items-center justify-center shadow-inner" />
                  
                  <div className="flex items-center gap-1 mb-2">
                    <div className="flex-1 h-1 rounded-full bg-white/40 overflow-hidden">
                      <div className="h-full bg-white rounded-full w-3/4 animate-pulse" />
                    </div>
                    <div className="flex-1 h-1 rounded-full bg-white/20" />
                  </div>

                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center text-[10px] font-black border border-white/40">
                        UG
                      </div>
                      <div>
                        <p className="text-[11px] font-bold tracking-tight leading-none">URBAN Gaming</p>
                        <p className="text-[9px] text-white/70 leading-none mt-0.5">{openPreview.category}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                  <p className="text-white text-xs font-semibold line-clamp-2 drop-shadow-md">
                    {openPreview.caption}
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full md:w-[380px] p-5 sm:p-6 flex flex-col justify-between bg-zinc-900 border-t md:border-t-0 md:border-l border-white/10 text-white">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-pink-500/20 text-pink-400 border border-pink-500/30">
                      {openPreview.category}
                    </span>
                    {openPreview.mediaType === "video" && (
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-600 text-white">
                        VIDEO
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400 font-medium">
                      Rasio: {openPreview.aspectRatio}
                    </span>
                  </div>

                  <button
                    onClick={() => setOpenPreview(null)}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-sm sm:text-base font-black tracking-tight">
                  {openPreview.title}
                </h3>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Teks Caption Promosi
                  </label>
                  <div className="p-3 bg-black/60 border border-white/10 rounded-2xl max-h-48 sm:max-h-56 overflow-y-auto scrollbar-ios">
                    <p className="text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {openPreview.caption}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 mt-4 border-t border-white/10">
                <button
                  onClick={() => handleShareClick(openPreview)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#22C55E] hover:bg-[#16A34A] active:bg-[#15803D] text-white font-bold text-xs shadow-lg shadow-green-500/20 active:scale-95 transition-all"
                >
                  <Icons.Share className="w-4 h-4 stroke-[2.5]" />
                  <span>Bagikan Video/Foto ke Story & Chat</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyCaption(openPreview.caption)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all active:scale-95"
                  >
                    <Icons.Copy className="w-3.5 h-3.5" />
                    <span>Salin Caption</span>
                  </button>

                  <button
                    onClick={() => handleDownloadMedia(openPreview)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all active:scale-95"
                  >
                    <Icons.Download className="w-3.5 h-3.5" />
                    <span>Download Media</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          SHARE HUB (APPLE ACTION SHEET + PRIORITIZED CHANNELS)
          ============================================================ */}
      {shareTargetItem && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center p-3.5 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 font-sans">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-[28px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-zinc-900 dark:text-white">
            
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Icons.Share className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-base font-black tracking-tight uppercase">
                    Bagikan ke Sosial Media
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-zinc-500 dark:text-zinc-400">
                    Pilih saluran tujuan atau buka Web Share API
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShareTargetItem(null)}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/20 transition-all"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4 flex-1 scrollbar-ios">
              
              <div className="flex items-center gap-3 p-2.5 sm:p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-black/10 dark:border-white/10 relative">
                  {shareTargetItem.mediaType === "video" ? (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                      {shareTargetItem.thumbnailUrl ? (
                        <img src={shareTargetItem.thumbnailUrl} alt={shareTargetItem.title} className="w-full h-full object-cover" />
                      ) : (
                        <Icons.Video className="w-5 h-5 text-purple-400" />
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Icons.Play className="w-3 h-3 text-white" />
                      </div>
                    </div>
                  ) : (
                    <img src={shareTargetItem.mediaUrl} alt={shareTargetItem.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-black uppercase bg-pink-500/10 text-pink-600 dark:text-pink-400">
                      {shareTargetItem.category}
                    </span>
                    {shareTargetItem.mediaType === "video" && (
                      <span className="px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-black bg-purple-600 text-white uppercase">
                        Video
                      </span>
                    )}
                    <span className="text-[9px] sm:text-[10px] text-zinc-400 font-medium">
                      {shareTargetItem.aspectRatio}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs truncate text-zinc-900 dark:text-white">
                    {shareTargetItem.title}
                  </h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Media siap dibagikan langsung
                  </p>
                </div>
              </div>

              <button
                onClick={() => shareFileDirectly(shareTargetItem)}
                className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#007AFF] via-[#5856D6] to-[#AF52DE] hover:opacity-95 text-white shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all group"
              >
                <div className="flex items-center gap-2.5 sm:gap-3 text-left min-w-0">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
                    <Icons.Smartphone className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-xs sm:text-sm tracking-tight">Buka Menu Share HP Sistem</span>
                      <span className="px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-black bg-white/25 uppercase">Semua App</span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-white/80 truncate">
                      Kirim file foto / video langsung ke aplikasi pilihan Anda
                    </p>
                  </div>
                </div>
                <Icons.External className="w-4 h-4 text-white/70 group-hover:text-white transition-colors shrink-0 ml-2" />
              </button>

              <div className="pt-1">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Saluran Favorit
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400">1-Tap Direct Action</span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
                  <button
                    onClick={() => shareToWhatsAppBusiness(shareTargetItem)}
                    className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border-2 border-emerald-500/40 text-left transition-all active:scale-[0.99] group shadow-sm shadow-emerald-500/10"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/30">
                        <Icons.WhatsAppBusiness className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="font-bold text-xs text-zinc-900 dark:text-white">
                            WhatsApp Business (WA Bisnis)
                          </span>
                          <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-[#25D366] text-white uppercase tracking-wider">
                            Prioritas #1
                          </span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-zinc-600 dark:text-zinc-300 truncate mt-0.5">
                          Kirim gambar / video ke WhatsApp Business
                        </p>
                      </div>
                    </div>
                    <Icons.External className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
                  </button>

                  <button
                    onClick={() => shareToInstagram(shareTargetItem)}
                    className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-pink-500/10 hover:bg-pink-500/15 border border-pink-500/20 text-left transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-pink-500/20">
                        <Icons.Instagram className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="font-bold text-xs text-zinc-900 dark:text-white">
                            Instagram Story & Feed
                          </span>
                          <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-pink-500 text-white uppercase tracking-wider">
                            Prioritas #2
                          </span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          Download gambar / video & buka Instagram
                        </p>
                      </div>
                    </div>
                    <Icons.External className="w-3.5 h-3.5 text-pink-500 shrink-0 ml-2" />
                  </button>

                  <button
                    onClick={() => shareToFacebook(shareTargetItem)}
                    className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-left transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
                        <Icons.Facebook className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="font-bold text-xs text-zinc-900 dark:text-white">
                            Facebook Story & Post
                          </span>
                          <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-[#1877F2] text-white uppercase tracking-wider">
                            Prioritas #3
                          </span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          Bagikan gambar / video ke Facebook
                        </p>
                      </div>
                    </div>
                    <Icons.External className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-2" />
                  </button>

                  <button
                    onClick={() => shareToTikTok(shareTargetItem)}
                    className="w-full flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-left transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shrink-0 shadow-md">
                        <Icons.TikTok className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="font-bold text-xs text-zinc-900 dark:text-white">
                            TikTok Video & Foto Slide
                          </span>
                          <span className="px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[8px] sm:text-[9px] font-black bg-zinc-700 dark:bg-zinc-300 text-white dark:text-black uppercase tracking-wider">
                            Prioritas #4
                          </span>
                        </div>
                        <p className="text-[9px] sm:text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          Download gambar / video & buka TikTok
                        </p>
                      </div>
                    </div>
                    <Icons.External className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-2" />
                  </button>

                  <button
                    onClick={() => shareToWhatsAppRegular(shareTargetItem)}
                    className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200/50 dark:border-zinc-700/50 text-left transition-all active:scale-[0.99] group mt-0.5"
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600/80 text-white flex items-center justify-center shrink-0">
                        <Icons.WhatsApp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-xs text-zinc-700 dark:text-zinc-300">
                            WhatsApp Biasa (Personal)
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-400 truncate">
                          Kirim gambar / video ke WhatsApp pribadi
                        </p>
                      </div>
                    </div>
                    <Icons.External className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-2" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                <button
                  onClick={() => handleCopyCaption(shareTargetItem.caption)}
                  className="flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs transition-all active:scale-95"
                >
                  <Icons.Copy className="w-3.5 h-3.5" />
                  <span>Salin Caption</span>
                </button>

                <button
                  onClick={() => handleDownloadMedia(shareTargetItem)}
                  className="flex items-center justify-center gap-1.5 py-2 sm:py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs transition-all active:scale-95"
                >
                  <Icons.Download className="w-3.5 h-3.5" />
                  <span>Download Media</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          UPLOAD MEDIA MODAL
          ============================================================ */}
      {openUpload && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3.5 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 font-sans">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-[28px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-zinc-900 dark:text-white">
            
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-black/10 dark:bg-white/20 text-black dark:text-white flex items-center justify-center">
                  <Icons.Upload className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight">
                    Unggah Media Baru (Foto / Video)
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-zinc-500 dark:text-zinc-400">
                    File video & gambar akan disimpan di Firebase Storage
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpenUpload(false)}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:bg-black/10 dark:hover:bg-white/20 transition-all"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitUpload} className="p-4 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4 flex-1 scrollbar-ios">
              
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  File Gambar atau Video (MP4, MOV, WEBM)
                </label>
                <div className="relative border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-black dark:hover:border-white rounded-2xl p-4 text-center bg-zinc-50 dark:bg-zinc-800/40 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  {uploadPreviewUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-black shrink-0 border border-black/10 dark:border-white/10 flex items-center justify-center">
                        {uploadMediaType === "video" ? (
                          uploadThumbnailPreviewUrl ? (
                            <img src={uploadThumbnailPreviewUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-purple-950/40 text-purple-400 p-1 text-center">
                              <Icons.Video className="w-5 h-5 mb-0.5" />
                              <span className="text-[8px] font-bold">Video File</span>
                            </div>
                          )
                        ) : (
                          <img src={uploadPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="text-left min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                            {uploadFile?.name}
                          </p>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-black text-white dark:bg-white dark:text-black">
                            {uploadMediaType}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          Format terdeteksi: <span className="font-bold text-black dark:text-white">{uploadAspectRatio}</span>
                        </p>
                        <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">
                          ✓ Klik untuk ganti file
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-2">
                        <Icons.Upload className="w-6 h-6 stroke-[2]" />
                      </div>
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                        Klik atau seret file gambar / video ke sini
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        Foto (JPG, PNG, WEBP) atau Video (MP4, MOV, WEBM)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {uploadMediaType === "video" && uploadFile && (
                <div className="p-3 bg-zinc-100/60 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <Icons.Gallery className="w-3.5 h-3.5 text-black dark:text-white" />
                      <span>Cover Poster / Thumbnail Video</span>
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      {uploadThumbnailBlob ? "✓ Cover Siap" : "Otomatis"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-black/10 dark:border-white/10 relative">
                      {uploadThumbnailPreviewUrl ? (
                        <img src={uploadThumbnailPreviewUrl} alt="Thumbnail Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-purple-950 text-purple-300 text-[9px] text-center p-1 font-bold">
                          Cover
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all border border-zinc-200 dark:border-zinc-700">
                        <Icons.Upload className="w-3.5 h-3.5 text-black dark:text-white" />
                        <span>Pilih Foto Cover Sendiri</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCustomCoverChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Gunakan hasil snapshot otomatis di atas, atau pilih file gambar/poster khusus.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Atau Masukkan URL Media Langsung (Opsional)
                </label>
                <input
                  type="url"
                  value={directUrlInput}
                  onChange={(e) => setDirectUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Judul Konten *
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Contoh: Video Gameplay FC 25 PS5"
                    className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Kategori
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                  >
                    {CATEGORIES.filter((c) => c !== "Semua").map((c) => (
                      <option key={c} value={c} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Format Aspek Rasio
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "9:16", label: "9:16" },
                    { id: "3:4", label: "3:4" },
                    { id: "1:1", label: "1:1" },
                    { id: "16:9", label: "16:9" },
                  ].map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setUploadAspectRatio(r.id as any)}
                      className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                        uploadAspectRatio === r.id
                          ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white font-bold shadow-xs"
                          : "bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <div className="text-xs font-semibold">{r.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Template Caption Siap Pakai
                  </label>
                  <span className="text-[10px] text-zinc-400">1-Klik untuk ganti</span>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {CAPTION_PRESETS.map((preset, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => {
                        setUploadCaption(preset.caption);
                        setUploadCategory(preset.category);
                        setUploadAspectRatio(preset.aspectRatio);
                        if (!uploadTitle) setUploadTitle(preset.title.replace(/[^a-zA-Z0-9 ]/g, "").trim());
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] font-medium whitespace-nowrap text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors"
                    >
                      {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                  Teks Caption Promosi
                </label>
                <textarea
                  rows={4}
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Tulis caption promosi menarik..."
                  className="w-full p-3 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-mono leading-relaxed placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Icons.Bookmark className="w-3.5 h-3.5 text-amber-500" filled />
                    <span>Sematkan ke Paling Atas (Pin)</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Konten ini akan selalu muncul di urutan pertama galeri
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={uploadPinned}
                  onChange={(e) => setUploadPinned(e.target.checked)}
                  className="w-5 h-5 rounded text-black focus:ring-black cursor-pointer"
                />
              </div>

              {uploading && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-bold text-zinc-900 dark:text-white">
                    <span>Mengunggah media ke Firebase Storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-black dark:bg-white transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setOpenUpload(false)}
                  disabled={uploading}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  {uploading ? "Sedang Mengunggah..." : "Simpan ke Galeri"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          EDIT METADATA MODAL
          ============================================================ */}
      {openEdit && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3.5 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 font-sans">
          <div className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] border border-black/10 dark:border-white/10 rounded-[28px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col text-zinc-900 dark:text-white">
            
            <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/30">
              <h3 className="text-sm font-black uppercase tracking-tight">
                Edit Informasi Media
              </h3>
              <button
                onClick={() => setOpenEdit(null)}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-zinc-500 dark:text-zinc-400"
              >
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Judul</label>
                <input
                  type="text"
                  required
                  value={openEdit.title}
                  onChange={(e) => setOpenEdit({ ...openEdit, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
                />
              </div>

              {openEdit.mediaType === "video" && (
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                      Ganti Foto Cover / Thumbnail Video
                    </span>
                    <span className="text-[10px] text-zinc-400">JPG / PNG</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-black shrink-0 border border-black/10 dark:border-white/10">
                      {editCoverPreviewUrl ? (
                        <img src={editCoverPreviewUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-500 text-[9px] text-center p-1">
                          Tanpa Cover
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-900 dark:text-white text-xs font-bold shadow-xs cursor-pointer active:scale-95 transition-all border border-zinc-200 dark:border-zinc-700">
                        <Icons.Upload className="w-3.5 h-3.5 text-black dark:text-white" />
                        <span>Pilih Foto Cover Baru</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setEditCoverFile(file);
                              setEditCoverPreviewUrl(URL.createObjectURL(file));
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Pilih foto poster agar tampilan thumbnail tidak hitam.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Kategori</label>
                  <select
                    value={openEdit.category}
                    onChange={(e) => setOpenEdit({ ...openEdit, category: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
                  >
                    {CATEGORIES.filter((c) => c !== "Semua").map((c) => (
                      <option key={c} value={c} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Format Rasio</label>
                  <select
                    value={openEdit.aspectRatio}
                    onChange={(e) => setOpenEdit({ ...openEdit, aspectRatio: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white"
                  >
                    <option value="9:16">9:16</option>
                    <option value="3:4">3:4</option>
                    <option value="1:1">1:1</option>
                    <option value="16:9">16:9</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Caption</label>
                <textarea
                  rows={5}
                  value={openEdit.caption}
                  onChange={(e) => setOpenEdit({ ...openEdit, caption: e.target.value })}
                  className="w-full p-3 text-xs bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white font-mono leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setOpenEdit(null)}
                  disabled={updatingCover}
                  className="px-4 py-2 text-xs font-bold text-zinc-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updatingCover}
                  className="px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs disabled:opacity-50"
                >
                  {updatingCover ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          FLOATING TOAST NOTIFICATION
          ============================================================ */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150] px-4 py-2.5 rounded-full bg-zinc-900/90 dark:bg-white/90 text-white dark:text-zinc-900 text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Icons.Check className="w-3.5 h-3.5 text-[#34C759] stroke-[3]" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
