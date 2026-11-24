import React, { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, updateDoc, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import {
  AlertDialog,
  Button,
  EmptyState,
  IconBadge,
  Notice,
  SearchField,
  Sheet,
  Toast,
  Toggle,
} from "../ui";

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
const mediaBlobInflight = new Map<string, Promise<Blob | null>>();

// Tipe file yang diizinkan Web Share API (Chrome Android/Safari) + ekstensinya.
// Tipe lain (mis. .mov dari iPhone) dikirim sebagai mp4/jpeg supaya tetap bisa di-share.
const SHAREABLE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

// Satu unduhan per URL: kalau prefetch otomatis masih jalan, pemanggil berikutnya ikut menunggu
const prefetchMediaBlob = (item: MediaItem): Promise<Blob | null> => {
  if (!item.mediaUrl) return Promise.resolve(null);
  const cached = mediaBlobCache.get(item.mediaUrl);
  if (cached) return Promise.resolve(cached);
  const inflight = mediaBlobInflight.get(item.mediaUrl);
  if (inflight) return inflight;
  const p = fetchMediaBlob(item).finally(() => mediaBlobInflight.delete(item.mediaUrl));
  mediaBlobInflight.set(item.mediaUrl, p);
  return p;
};

// Batas waktu: SDK Storage mencoba ulang sampai ±2 menit kalau jaringan/CORS gagal,
// yang membuat tombol share "loading terus". Lebih baik cepat gagal lalu tampilkan "Coba lagi".
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

const fetchMediaBlob = async (item: MediaItem): Promise<Blob | null> => {

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
  const [confirmSeedOpen, setConfirmSeedOpen] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [editErr, setEditErr] = useState<string | null>(null);

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
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmSeedOpen || deleteTarget || shareTargetItem || openUpload || openEdit) return;
      if (openPreview) {
        setOpenPreview(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, confirmSeedOpen, deleteTarget, shareTargetItem, openUpload, openEdit, openPreview, onClose]);

  // Siapkan file media untuk share (harus sudah di cache sebelum tombol Kirim ditekan)
  const [sharePrepState, setSharePrepState] = useState<"idle" | "preparing" | "ready" | "error">("idle");
  const [shareRetryKey, setShareRetryKey] = useState(0);
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
      prefetchMediaBlob(openPreview);
    }
  }, [openPreview]);

  useEffect(() => {
    if (mediaList.length > 0) {
      // Hanya gambar & dibatasi, supaya tidak menguras kuota HP (video diunduh saat mau di-share)
      mediaList.filter((item) => item.mediaType !== "video").slice(0, 8).forEach((item) => {
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
      
      let unsubFallback: (() => void) | null = null;
      const unsub = onSnapshot(q, (snapshot) => {
        const items: MediaItem[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...(d.data() as any) });
        });
        setMediaList(items);
        setLoading(false);
      }, (err) => {
        console.warn("Firestore gallery query fallback to simple collection:", err);
        unsubFallback?.();
        unsubFallback = onSnapshot(galleryRef, (snapshot) => {
          const items: MediaItem[] = [];
          snapshot.forEach((d) => {
            items.push({ id: d.id, ...(d.data() as any) });
          });
          items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setMediaList(items);
          setLoading(false);
        }, (fallbackErr) => {
          console.error("Gagal memuat galeri:", fallbackErr);
          setLoading(false);
        });
      });

      return () => { unsub(); unsubFallback?.(); };
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
      showToast("Menganalisis video & membuat cover thumbnail...");

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
        showToast("Cover thumbnail video berhasil dibuat!");
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
    showToast("Foto cover kustom berhasil dipilih!");
  };

  const handleSeedDefaults = () => {
    setConfirmSeedOpen(true);
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
      showToast("Template bawaan berhasil ditambahkan!");
    } catch (e: any) {
      showToast("Gagal inisialisasi: " + e.message);
    } finally {
      setSeedLoading(false);
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
    setUploadErr(null);
    if (!uploadFile && !directUrlInput.trim()) {
      setUploadErr("Pilih file media gambar/video atau masukkan URL langsung.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadErr("Masukkan judul media promosi.");
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

      showToast(`Media ${isVideo ? "video" : "gambar"} berhasil diunggah!`);
      
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
      setUploadErr("Gagal mengunggah media: " + e.message);
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
      showToast(item.pinned ? "Pin dilepas" : "Disematkan ke paling atas");
    } catch (e: any) {
      showToast("Gagal mengubah pin: " + e.message);
    }
  };

  const handleDeleteItem = (item: MediaItem) => {
    setDeleteTarget(item);
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
      setDeleteTarget(null);
      showToast("Media berhasil dihapus.");
      if (openPreview?.id === item.id) setOpenPreview(null);
    } catch (e: any) {
      showToast("Gagal menghapus media: " + e.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openEdit) return;
    setEditErr(null);
    try {
      setUpdatingCover(true);
      let newThumbUrl = openEdit.thumbnailUrl || "";
      let newThumbStoragePath = openEdit.thumbStoragePath || "";

      if (editCoverFile) {
        showToast("Mengunggah cover thumbnail baru...");
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

      showToast("Perubahan media berhasil disimpan!");
      setOpenEdit(null);
      setEditCoverFile(null);
      setEditCoverPreviewUrl(null);
    } catch (e: any) {
      setEditErr("Gagal menyimpan perubahan: " + e.message);
    } finally {
      setUpdatingCover(false);
    }
  };

  const handleCopyCaption = async (caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      showToast("Caption promosi berhasil disalin!");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = caption;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Caption promosi berhasil disalin!");
    }
  };

  const handleDownloadMedia = async (item: MediaItem) => {
    const ext = item.mediaType === "video" ? "mp4" : "jpg";
    const filename = `URBAN_GAMING_${(item.title || "media").replace(/\s+/g, "_")}.${ext}`;
    try {
      showToast("Mengunduh media...");
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
      showToast(`Media ${ext.toUpperCase()} berhasil diunduh!`);
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

  // ============================================================
  // SHARE → STORY WHATSAPP BUSINESS (gambar/video + caption)
  // ============================================================
  // Catatan teknis (penting, jangan diubah sembarangan):
  // 1. Dari web, satu-satunya cara mengirim FILE ke aplikasi lain adalah Web Share API
  //    (navigator.share). HP akan menampilkan menu share → pilih "WhatsApp Business" →
  //    pilih "Status saya". Web tidak bisa melompati 2 pilihan itu.
  // 2. navigator.share WAJIB dipanggil saat "user activation" masih aktif (langsung dari tap).
  //    Kalau kita menunggu download file dulu, browser menolak (NotAllowedError) — ini bug
  //    lama. Karena itu file disiapkan dulu ke cache, baru tombol "Kirim" aktif.
  // 3. Caption dikirim sebagai `text` (dipakai WhatsApp sebagai caption) DAN disalin ke
  //    clipboard sebagai cadangan, jadi kalau caption kosong tinggal tekan lama → Tempel.
  const supportsFileShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  const buildShareFile = (item: MediaItem): File | null => {
    const blob = mediaBlobCache.get(item.mediaUrl);
    if (!blob) return null;
    const isVideo = item.mediaType === "video";
    const blobType = (blob.type || "").toLowerCase().split(";")[0].trim();
    const mimeType = SHAREABLE_MIME_EXT[blobType] ? blobType : isVideo ? "video/mp4" : "image/jpeg";
    const ext = SHAREABLE_MIME_EXT[mimeType];
    const cleanTitle = (item.title || "media").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60);
    return new File([blob], `URBAN_${cleanTitle}.${ext}`, { type: mimeType });
  };

  const copyCaptionQuietly = async (caption: string): Promise<boolean> => {
    if (!caption) return false;
    try {
      // Dibatasi 400ms supaya tidak menghabiskan waktu "user activation" untuk navigator.share
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
  };

  const shareToWAStory = async (item: MediaItem) => {
    const file = buildShareFile(item);
    if (!supportsFileShare || !file) {
      // File belum siap / browser tidak mendukung → buka lembar share (menyiapkan file dulu)
      setShareTargetItem(item);
      return;
    }

    const caption = (item.caption || "").trim();
    const withCaption: ShareData = caption ? { files: [file], text: caption } : { files: [file] };
    const filesOnly: ShareData = { files: [file] };
    const data = navigator.canShare(withCaption) ? withCaption : filesOnly;
    if (!navigator.canShare(data)) {
      setShareTargetItem(item);
      showToast("HP/browser ini belum bisa kirim file langsung. Pakai Simpan Media + Salin Caption.");
      return;
    }

    const copied = await copyCaptionQuietly(caption);
    try {
      await navigator.share(data);
      setShareTargetItem(null);
      showToast(
        copied
          ? "Pilih Status saya di WA Business. Caption juga sudah disalin"
          : "Pilih Status saya di WA Business"
      );
    } catch (err: any) {
      if (err?.name === "AbortError") return; // user menutup menu share
      console.warn("navigator.share error:", err);
      setShareTargetItem(item);
      showToast(
        err?.name === "NotAllowedError"
          ? "File sudah siap — ketuk tombol Kirim sekali lagi"
          : "Gagal membuka menu share. Coba lagi."
      );
    }
  };

  const handleShareClick = (item: MediaItem) => {
    // File sudah ada di cache → langsung buka menu share (masih dalam tap yang sama).
    if (supportsFileShare && mediaBlobCache.has(item.mediaUrl)) {
      void shareToWAStory(item);
      return;
    }
    // Belum siap → tampilkan lembar share yang menyiapkan file, lalu tombol Kirim aktif.
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
    <div className={`fixed inset-0 z-[100] items-center justify-center bg-black/45 backdrop-blur-md transition-opacity duration-300 font-sans ${open ? "flex" : "hidden"}`}>
      
      {/* ============================================================
          MAIN CONTAINER (Full-Screen UDS v2 Workspace)
          ============================================================ */}
      <div className="relative w-full h-full bg-canvas overflow-hidden flex flex-col animate-in fade-in duration-200">
        
        {/* ============================================================
            1. TOP BAR (Apple Translucent Chrome)
            ============================================================ */}
        <header className="apple-bar border-b border-sep px-4 sm:px-5 py-3.5 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <IconBadge color="pink" variant="tinted">
              <Icons.Gallery className="w-4 h-4" />
            </IconBadge>
            <h2 className="text-headline font-bold tracking-tight text-label truncate">
              Galeri Media Sosial
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 hit-44 h-8 flex items-center justify-center rounded-full bg-fill hover:brightness-95 text-label-2 hover:text-label active:scale-95 transition"
            aria-label="Tutup Galeri"
          >
            <Icons.X className="w-4 h-4" />
          </button>
        </header>

        {/* ============================================================
            2. TOP CONTROLS & FILTER SECTION
            ============================================================ */}
        <div className="px-3.5 sm:px-5 py-3 bg-chrome border-b border-sep shrink-0">
          <div className="max-w-4xl mx-auto w-full space-y-2.5">
            {/* Segmented Format/Rasio Tabs */}
            <div className="flex apple-segmented p-1 rounded-full gap-1 overflow-x-auto no-scrollbar">
              {ASPECT_RATIOS.map((r) => {
                const active = activeRatio === r.key;
                return (
                  <button
                    type="button"
                    key={r.key}
                    onClick={() => setActiveRatio(r.key)}
                    className={`flex-1 min-w-[78px] py-2 px-3 text-caption font-semibold rounded-full transition ${
                      active
                        ? "apple-segmented-thumb text-label"
                        : "text-label-2 hover:text-label hover:bg-white/30 dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Monochrome Primary Action Button */}
            {isSuperAdminOrOwner && (
              <div className="flex gap-2">
                <Button
                  variant="filled"
                  size="md"
                  icon={<Icons.PlusCircle className="w-4 h-4" />}
                  onClick={() => {
                    setUploadErr(null);
                    setOpenUpload(true);
                  }}
                  className="flex-1"
                >
                  Tambah Media Promosi
                </Button>

                {mediaList.length === 0 && (
                  <Button
                    variant="gray"
                    size="md"
                    icon={<Icons.Upload className="w-4 h-4" />}
                    onClick={handleSeedDefaults}
                    className="flex-1"
                  >
                    Inisialisasi Awal
                  </Button>
                )}
              </div>
            )}

            {/* Search Input Bar */}
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Cari konten promosi, game, atau promo..."
            />

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {CATEGORIES.map((cat) => {
                const count = cat === "Semua" ? mediaList.length : mediaList.filter((m) => m.category === cat).length;
                const active = activeCategory === cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-caption font-semibold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                      active
                        ? "bg-action text-action-label shadow-card"
                        : "bg-surface border border-edge text-label-2 hover:text-label"
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-caption2 px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                      active
                        ? "bg-white/20 dark:bg-black/15 text-action-label"
                        : "bg-fill text-label-2"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ============================================================
            3. MAIN GALLERY GRID
            ============================================================ */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 scrollbar-ios">
          <div className="max-w-4xl mx-auto w-full pb-20">
            
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 text-label-2">
                <div className="w-9 h-9 border-2 border-action border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-footnote font-medium">Memuat galeri media sosial...</p>
              </div>
            ) : filteredMedia.length === 0 ? (
              <EmptyState
                icon={<Icons.Gallery />}
                title="Belum Ada Media di Kategori Ini"
                className="max-w-lg mx-auto my-6"
              >
                <p>
                  Unggah poster promosi, video gameplay seru, atau pricelist rental untuk dibagikan ke Story WhatsApp Business &amp; Instagram.
                </p>
                {isSuperAdminOrOwner && (
                  <div className="mt-5 flex justify-center">
                    <Button
                      variant="filled"
                      size="md"
                      icon={<Icons.PlusCircle className="w-4 h-4" />}
                      onClick={() => {
                        setUploadErr(null);
                        setOpenUpload(true);
                      }}
                    >
                      Tambah Media Promosi
                    </Button>
                  </div>
                )}
              </EmptyState>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
                {filteredMedia.map((item) => (
                  <div
                    key={item.id}
                    onMouseEnter={() => prefetchMediaBlob(item)}
                    onTouchStart={() => prefetchMediaBlob(item)}
                    className="group apple-card rounded-card ring-1 ring-edge shadow-card hover:shadow-float transition duration-200 overflow-hidden flex flex-col p-2 sm:p-2.5 justify-between"
                  >
                    {/* Media Poster Box */}
                    <div
                      onClick={() => setOpenPreview(item)}
                      className={`relative w-full cursor-pointer overflow-hidden rounded-tile bg-black ${
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
                        <div className="relative w-full h-full bg-[#09090B] flex items-center justify-center">
                          {item.thumbnailUrl ? (
                            <>
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fb = e.currentTarget.parentElement?.querySelector(".thumb-fallback");
                                  if (fb) fb.classList.remove("hidden");
                                }}
                              />
                              <div className="thumb-fallback hidden w-full h-full bg-gradient-to-br from-[#CB30E0]/35 via-[#1C1C1E] to-black flex flex-col items-center justify-center p-3 text-center">
                                <Icons.Video className="w-8 h-8 text-[#DB34F2] mb-1 opacity-85" />
                                <span className="text-caption2 text-white/65 font-semibold uppercase tracking-wider">Video Promo</span>
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#CB30E0]/35 via-[#1C1C1E] to-black flex flex-col items-center justify-center p-3 text-center">
                              <Icons.Video className="w-8 h-8 text-[#DB34F2] mb-1 opacity-85" />
                              <span className="text-caption2 text-white/65 font-semibold uppercase tracking-wider">Video Promo</span>
                            </div>
                          )}
                          
                          {/* Play Button Indicator */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center shadow-float border border-white/20 group-hover:scale-110 transition-transform">
                              <Icons.Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative w-full h-full flex items-center justify-center bg-[#1C1C1E]">
                          <img
                            src={item.mediaUrl}
                            alt={item.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const fb = e.currentTarget.parentElement?.querySelector(".media-fallback");
                              if (fb) fb.classList.remove("hidden");
                            }}
                          />
                          <div className="media-fallback hidden flex flex-col items-center justify-center p-3 text-center gap-1.5">
                            <Icons.Gallery className="w-8 h-8 text-white/40" />
                            <span className="text-caption2 text-white/60 font-medium">Gagal memuat</span>
                          </div>
                        </div>
                      )}

                      {/* Top Overlay Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none gap-1">
                        <span className="px-2 py-0.5 rounded-full text-caption2 font-semibold bg-black/60 text-white backdrop-blur-md border border-white/15 truncate max-w-[70%]">
                          {item.category}
                        </span>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.mediaType === "video" && (
                            <div className="w-6 h-6 rounded-full bg-[#CB30E0] text-white shadow-card flex items-center justify-center">
                              <Icons.Video className="w-3 h-3" />
                            </div>
                          )}
                          {item.pinned && (
                            <div className="w-6 h-6 rounded-full bg-warning text-white shadow-card flex items-center justify-center">
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
                          <h4 className="text-subhead font-semibold text-label truncate">
                            {item.title}
                          </h4>
                          <button
                            type="button"
                            onClick={() => setOpenPreview(item)}
                            className="text-label-3 hover:text-label p-1 rounded-full transition-colors"
                            aria-label={`Pratinjau ${item.title}`}
                          >
                            <Icons.MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-caption2 text-label-3 mt-0.5">
                          Story · {item.aspectRatio} · {formatTimeAgo(item.createdAt)}
                        </p>
                      </div>

                      {/* Caption Preview */}
                      <div className="apple-tile rounded-field p-2 sm:p-2.5 border border-sep">
                        <p className="text-caption text-label-2 font-sans line-clamp-2 leading-relaxed">
                          {item.caption || "Tidak ada caption"}
                        </p>
                      </div>

                      {/* Primary Buttons */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleShareClick(item)}
                          className="hit-44 h-9 flex items-center justify-center gap-1.5 px-3 rounded-full bg-[#34C759] hover:opacity-90 active:scale-[0.98] text-white font-semibold text-footnote shadow-card transition"
                          title="Share Media & Caption"
                        >
                          <Icons.Share className="w-3.5 h-3.5 stroke-[2.2]" />
                          <span>Share</span>
                        </button>

                        <Button
                          variant="gray"
                          size="sm"
                          icon={<Icons.Copy className="w-3.5 h-3.5" />}
                          onClick={() => handleCopyCaption(item.caption)}
                          className="h-9 rounded-full justify-center"
                          title="Salin Teks Caption"
                        >
                          Salin
                        </Button>
                      </div>

                      {/* Bottom Toolbar Icons */}
                      <div className="flex items-center justify-between pt-2 border-t border-sep px-1 text-label-3">
                        <button
                          type="button"
                          onClick={() => handleDownloadMedia(item)}
                          className="p-1.5 rounded-full hover:bg-fill hover:text-label transition-colors"
                          title="Download Media"
                          aria-label="Download Media"
                        >
                          <Icons.Download className="w-4 h-4" />
                        </button>

                        {isSuperAdminOrOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTogglePin(item)}
                              className={`p-1.5 rounded-full hover:bg-fill transition-colors ${
                                item.pinned ? "text-warning" : "hover:text-warning"
                              }`}
                              title={item.pinned ? "Lepas Bookmark / Pin" : "Sematkan"}
                              aria-label={item.pinned ? "Lepas Pin" : "Sematkan"}
                            >
                              <Icons.Bookmark className="w-4 h-4" filled={item.pinned} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditErr(null);
                                setOpenEdit(item);
                                setEditCoverFile(null);
                                setEditCoverPreviewUrl(item.thumbnailUrl || null);
                              }}
                              className="p-1.5 rounded-full hover:bg-fill hover:text-tint transition-colors"
                              title="Edit Media"
                              aria-label="Edit Media"
                            >
                              <Icons.Edit className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 rounded-full hover:bg-negative/10 hover:text-negative transition-colors"
                              title="Hapus Media"
                              aria-label="Hapus Media"
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
          <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col md:flex-row bg-[#1C1C1E] border border-white/10 rounded-sheet overflow-hidden shadow-float">
            <button
              type="button"
              onClick={() => setOpenPreview(null)}
              className="md:hidden absolute top-3 right-3 z-30 w-9 hit-44 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/85 active:scale-95 transition"
              aria-label="Tutup Pratinjau"
            >
              <Icons.X className="w-4 h-4" />
            </button>
            
            <div className="flex-1 bg-black flex items-center justify-center p-3 sm:p-6">
              <div className="relative w-full max-w-[280px] sm:max-w-[310px] aspect-[9/16] rounded-[34px] overflow-hidden ring-4 ring-white/15 shadow-float bg-[#121214] flex flex-col justify-between">
                
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

            <div className="w-full md:w-[380px] p-5 sm:p-6 flex flex-col justify-between bg-[#1C1C1E] border-t md:border-t-0 md:border-l border-white/10 text-white">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-caption2 font-semibold bg-[#FF375F]/20 text-[#FF829E] border border-[#FF375F]/30">
                      {openPreview.category}
                    </span>
                    {openPreview.mediaType === "video" && (
                      <span className="px-2 py-0.5 rounded-full text-caption2 font-bold bg-[#CB30E0] text-white">
                        VIDEO
                      </span>
                    )}
                    <span className="text-caption2 text-white/55 font-medium">
                      Rasio {openPreview.aspectRatio}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpenPreview(null)}
                    className="hidden md:flex w-8 hit-44 h-8 rounded-full bg-white/10 hover:bg-white/15 items-center justify-center text-white/65 hover:text-white transition-colors shrink-0"
                    aria-label="Tutup Pratinjau"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-headline font-bold tracking-tight text-white">
                  {openPreview.title}
                </h3>

                <div>
                  <label className="block text-caption2 font-semibold uppercase tracking-wider text-white/55 mb-1.5">
                    Teks Caption Promosi
                  </label>
                  <div className="p-3 bg-black/50 border border-white/10 rounded-tile max-h-48 sm:max-h-56 overflow-y-auto scrollbar-ios">
                    <p className="text-footnote text-white/85 font-mono whitespace-pre-wrap leading-relaxed">
                      {openPreview.caption}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 mt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleShareClick(openPreview)}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-full bg-[#34C759] hover:opacity-90 text-white font-semibold text-subhead shadow-card active:scale-[0.98] transition"
                >
                  <Icons.Share className="w-4 h-4 stroke-[2.2]" />
                  <span>Bagikan Video/Foto ke Story &amp; Chat</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCaption(openPreview.caption)}
                    className="hit-44 h-10 flex items-center justify-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-footnote transition active:scale-95"
                  >
                    <Icons.Copy className="w-3.5 h-3.5" />
                    <span>Salin Caption</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadMedia(openPreview)}
                    className="hit-44 h-10 flex items-center justify-center gap-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-footnote transition active:scale-95"
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
          SHARE SHEET → STORY WHATSAPP BUSINESS
          ============================================================ */}
      <Sheet
        open={Boolean(shareTargetItem)}
        onClose={() => setShareTargetItem(null)}
        title="Kirim ke Story WA Business"
        subtitle="Gambar/video + caption sekaligus"
        icon={<Icons.WhatsAppBusiness className="w-4 h-4" />}
        iconColor="green"
        size="sm"
        variant="surface"
        zClassName="z-[145]"
      >
        {shareTargetItem && (
          <div className="space-y-3.5">
            {/* Pratinjau media + caption yang akan terkirim */}
            <div className="flex gap-3 p-3 apple-tile rounded-tile border border-sep">
              <div className="w-16 h-16 rounded-control overflow-hidden bg-black shrink-0 border border-edge relative">
                {shareTargetItem.mediaType === "video" ? (
                  <div className="w-full h-full flex items-center justify-center bg-[#121214]">
                    {shareTargetItem.thumbnailUrl ? (
                      <img src={shareTargetItem.thumbnailUrl} alt={shareTargetItem.title} className="w-full h-full object-cover" />
                    ) : (
                      <Icons.Video className="w-5 h-5 text-[#DB34F2]" />
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
                <h4 className="font-semibold text-footnote text-label truncate">{shareTargetItem.title}</h4>
                <p className="text-caption leading-snug text-label-2 mt-1 line-clamp-3 whitespace-pre-line">
                  {shareTargetItem.caption?.trim() || "Tanpa caption"}
                </p>
              </div>
            </div>

            {!supportsFileShare ? (
              <Notice tone="warning">
                Browser ini tidak bisa mengirim file langsung ke aplikasi (biasanya di laptop/PC).
                Buka Galeri dari <b>HP</b> untuk kirim ke Story, atau pakai <b>Simpan Media</b> + <b>Salin Caption</b> di bawah.
              </Notice>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => shareToWAStory(shareTargetItem)}
                  disabled={sharePrepState !== "ready"}
                  className="w-full h-[50px] flex items-center justify-center gap-2.5 rounded-tile bg-[#25D366] hover:bg-[#1FB656] disabled:bg-fill disabled:text-label-3 text-white font-semibold text-headline shadow-card disabled:shadow-none active:scale-[0.98] transition"
                >
                  {sharePrepState === "preparing" ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      <span>Menyiapkan file{shareTargetItem.mediaType === "video" ? " video" : ""}…</span>
                    </>
                  ) : sharePrepState === "error" ? (
                    <span>File gagal disiapkan</span>
                  ) : (
                    <>
                      <Icons.WhatsAppBusiness className="w-5 h-5" />
                      <span>Kirim ke Story WA Business</span>
                    </>
                  )}
                </button>

                {sharePrepState === "error" && (
                  <Notice tone="negative">
                    <div className="flex items-center justify-between gap-2">
                      <span>File tidak bisa diunduh dari server. Cek koneksi lalu coba lagi.</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShareRetryKey((k) => k + 1)}
                        className="shrink-0"
                      >
                        Coba lagi
                      </Button>
                    </div>
                  </Notice>
                )}

                <ol className="space-y-1.5 text-caption text-label-2 px-1">
                  <li><b className="text-label">1.</b> Ketuk <b>Kirim</b>, lalu pilih <b>WhatsApp Business</b> di menu share HP.</li>
                  <li><b className="text-label">2.</b> Pilih <b>Status saya</b> (paling atas), lalu kirim.</li>
                  <li><b className="text-label">3.</b> Caption terisi otomatis. Kalau kosong: tekan lama kolom caption → <b>Tempel</b> (sudah disalin).</li>
                </ol>
              </>
            )}

            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-sep">
              <Button
                variant="gray"
                size="md"
                icon={<Icons.Copy className="w-3.5 h-3.5" />}
                onClick={() => handleCopyCaption(shareTargetItem.caption)}
                block
              >
                Salin Caption
              </Button>
              <Button
                variant="gray"
                size="md"
                icon={<Icons.Download className="w-3.5 h-3.5" />}
                onClick={() => handleDownloadMedia(shareTargetItem)}
                block
              >
                Simpan Media
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      {/* ============================================================
          UPLOAD MEDIA SHEET
          ============================================================ */}
      <Sheet
        open={openUpload}
        onClose={() => {
          if (!uploading) {
            setUploadErr(null);
            setOpenUpload(false);
          }
        }}
        title="Unggah Media Baru"
        subtitle="Foto & video disimpan di Firebase Storage"
        icon={<Icons.Upload className="w-4 h-4" />}
        iconColor="indigo"
        size="md"
        variant="surface"
        zClassName="z-[130]"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="gray"
              size="md"
              onClick={() => {
                setUploadErr(null);
                setOpenUpload(false);
              }}
              disabled={uploading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="gallery-upload-form"
              variant="filled"
              size="md"
              loading={uploading}
            >
              {uploading ? "Sedang Mengunggah..." : "Simpan ke Galeri"}
            </Button>
          </div>
        }
      >
        <form id="gallery-upload-form" onSubmit={handleSubmitUpload} className="space-y-4">
          {uploadErr && <Notice tone="negative">{uploadErr}</Notice>}

          <div>
            <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1.5">
              File Gambar atau Video (MP4, MOV, WEBM)
            </label>
            <div className="relative border-2 border-dashed border-sep hover:border-label-2 rounded-tile p-4 text-center apple-tile transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {uploadPreviewUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-control overflow-hidden bg-black shrink-0 border border-edge flex items-center justify-center">
                    {uploadMediaType === "video" ? (
                      uploadThumbnailPreviewUrl ? (
                        <img src={uploadThumbnailPreviewUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#CB30E0]/25 text-[#DB34F2] p-1 text-center">
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
                      <p className="text-footnote font-semibold text-label truncate">
                        {uploadFile?.name}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-caption2 font-bold uppercase bg-action text-action-label">
                        {uploadMediaType}
                      </span>
                    </div>
                    <p className="text-caption2 text-label-2 mt-0.5">
                      Format terdeteksi: <span className="font-semibold text-label">{uploadAspectRatio}</span>
                    </p>
                    <p className="text-caption2 text-positive font-semibold mt-0.5">
                      ✓ Klik untuk ganti file
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-4 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-fill flex items-center justify-center text-label-2 mb-2">
                    <Icons.Upload className="w-6 h-6" />
                  </div>
                  <p className="text-footnote font-semibold text-label">
                    Klik atau seret file gambar / video ke sini
                  </p>
                  <p className="text-caption2 text-label-3 mt-0.5">
                    Foto (JPG, PNG, WEBP) atau Video (MP4, MOV, WEBM)
                  </p>
                </div>
              )}
            </div>
          </div>

          {uploadMediaType === "video" && uploadFile && (
            <div className="p-3 apple-tile border border-sep rounded-tile space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-footnote font-semibold text-label flex items-center gap-1.5">
                  <Icons.Gallery className="w-3.5 h-3.5 text-label-2" />
                  <span>Cover Poster / Thumbnail Video</span>
                </span>
                <span className="text-caption2 text-positive font-semibold">
                  {uploadThumbnailBlob ? "✓ Cover Siap" : "Otomatis"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-control overflow-hidden bg-black shrink-0 border border-edge relative">
                  {uploadThumbnailPreviewUrl ? (
                    <img src={uploadThumbnailPreviewUrl} alt="Thumbnail Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#CB30E0]/30 text-[#EB82FA] text-[9px] text-center p-1 font-bold">
                      Cover
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface hover:brightness-95 text-label text-footnote font-semibold shadow-card cursor-pointer active:scale-95 transition border border-edge">
                    <Icons.Upload className="w-3.5 h-3.5 text-label" />
                    <span>Pilih Foto Cover Sendiri</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomCoverChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-caption2 text-label-3 mt-1">
                    Gunakan hasil snapshot otomatis di atas, atau pilih file gambar/poster khusus.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1">
              Atau Masukkan URL Media Langsung (Opsional)
            </label>
            <input
              type="url"
              value={directUrlInput}
              onChange={(e) => setDirectUrlInput(e.target.value)}
              placeholder="https://..."
              className="w-full px-3.5 py-2.5 text-[16px] sm:text-subhead bg-fill rounded-field text-label placeholder:text-label-3 border border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tint/35 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1">
                Judul Konten *
              </label>
              <input
                type="text"
                required
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Contoh: Video Gameplay FC 25 PS5"
                className="w-full px-3.5 py-2.5 text-[16px] sm:text-subhead bg-fill rounded-field text-label placeholder:text-label-3 border border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tint/35 transition"
              />
            </div>

            <div>
              <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1">
                Kategori
              </label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-[16px] sm:text-subhead bg-fill rounded-field text-label border border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tint/35 transition"
              >
                {CATEGORIES.filter((c) => c !== "Semua").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1.5">
              Format Aspek Rasio
            </label>
            <div className="grid grid-cols-4 gap-1 p-1 rounded-full apple-segmented">
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
                  className={`py-2 px-2 rounded-full text-center transition text-footnote font-semibold ${
                    uploadAspectRatio === r.id
                      ? "apple-segmented-thumb text-label"
                      : "text-label-2 hover:text-label hover:bg-white/30 dark:hover:bg-white/[0.05]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-caption font-semibold text-label-2 uppercase tracking-wider">
                Template Caption Siap Pakai
              </label>
              <span className="text-caption2 text-label-3">1-Klik untuk ganti</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
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
                  className="px-3 py-1.5 rounded-full bg-fill hover:brightness-95 text-caption font-medium whitespace-nowrap text-label border border-sep transition-colors"
                >
                  {preset.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1">
              Teks Caption Promosi
            </label>
            <textarea
              rows={4}
              value={uploadCaption}
              onChange={(e) => setUploadCaption(e.target.value)}
              placeholder="Tulis caption promosi menarik..."
              className="w-full p-3 text-[16px] sm:text-footnote bg-fill rounded-field text-label font-mono leading-relaxed placeholder:text-label-3 border border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tint/35 transition"
            />
          </div>

          <div className="flex items-center justify-between gap-3 p-3.5 apple-tile rounded-tile border border-sep">
            <div className="min-w-0">
              <div className="text-footnote font-semibold text-label flex items-center gap-1.5">
                <Icons.Bookmark className="w-3.5 h-3.5 text-warning" filled />
                <span>Sematkan ke Paling Atas (Pin)</span>
              </div>
              <p className="text-caption2 text-label-2 mt-0.5">
                Konten ini akan selalu muncul di urutan pertama galeri
              </p>
            </div>
            <Toggle
              on={uploadPinned}
              onChange={setUploadPinned}
              label="Sematkan ke Paling Atas"
            />
          </div>

          {uploading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-footnote font-semibold text-label">
                <span>Mengunggah media ke Firebase Storage...</span>
                <span className="tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-fill rounded-full overflow-hidden">
                <div
                  className="h-full bg-action transition-[width] duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </form>
      </Sheet>

      {/* ============================================================
          EDIT METADATA SHEET
          ============================================================ */}
      <Sheet
        open={Boolean(openEdit)}
        onClose={() => {
          if (!updatingCover) {
            setEditErr(null);
            setOpenEdit(null);
          }
        }}
        title="Edit Informasi Media"
        subtitle={openEdit?.title}
        icon={<Icons.Edit className="w-4 h-4" />}
        iconColor="blue"
        size="sm"
        variant="surface"
        zClassName="z-[130]"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="gray"
              size="md"
              onClick={() => {
                setEditErr(null);
                setOpenEdit(null);
              }}
              disabled={updatingCover}
            >
              Batal
            </Button>
            <Button
              type="submit"
              form="gallery-edit-form"
              variant="filled"
              size="md"
              loading={updatingCover}
            >
              {updatingCover ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        }
      >
        {openEdit && (
          <form id="gallery-edit-form" onSubmit={handleUpdateItem} className="space-y-4">
            {editErr && <Notice tone="negative">{editErr}</Notice>}

            <div>
              <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1">Judul</label>
              <input
                type="text"
                required
                value={openEdit.title}
                onChange={(e) => setOpenEdit({ ...openEdit, title: e.target.value })}
                className="w-full px-3.5 py-2.5 text-[16px] sm:text-subhead bg-fill rounded-field text-label border border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tint/35 transition"
              />
            </div>

            {openEdit.mediaType === "video" && (
              <div className="p-3 apple-tile rounded-tile border border-sep space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-footnote font-semibold text-label">
                    Ganti Foto Cover / Thumbnail Video
                  </span>
                  <span className="text-caption2 text-label-3">JPG / PNG</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-control overflow-hidden bg-black shrink-0 border border-edge">
                    {editCoverPreviewUrl ? (
                      <img src={editCoverPreviewUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50 text-[9px] text-center p-1">
                        Tanpa Cover
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex h-11 sm:h-9 cursor-pointer items-center gap-1.5 rounded-full bg-fill px-4 text-footnote font-semibold text-label transition hover:brightness-[0.95] dark:hover:brightness-115 active:scale-95">
                      <Icons.Upload className="w-3.5 h-3.5 text-label" />
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
                    <p className="text-caption2 text-label-3 mt-1">
                      Pilih foto poster agar tampilan thumbnail tidak hitam.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1">Kategori</label>
                <select
                  value={openEdit.category}
                  onChange={(e) => setOpenEdit({ ...openEdit, category: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 text-[16px] sm:text-subhead bg-fill rounded-field text-label border border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tint/35 transition"
                >
                  {CATEGORIES.filter((c) => c !== "Semua").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1">Format Rasio</label>
                <select
                  value={openEdit.aspectRatio}
                  onChange={(e) => setOpenEdit({ ...openEdit, aspectRatio: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 text-[16px] sm:text-subhead bg-fill rounded-field text-label border border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tint/35 transition"
                >
                  <option value="9:16">9:16</option>
                  <option value="3:4">3:4</option>
                  <option value="1:1">1:1</option>
                  <option value="16:9">16:9</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-caption font-semibold text-label-2 uppercase tracking-wider mb-1">Caption</label>
              <textarea
                rows={5}
                value={openEdit.caption}
                onChange={(e) => setOpenEdit({ ...openEdit, caption: e.target.value })}
                className="w-full p-3 text-[16px] sm:text-footnote bg-fill rounded-field text-label font-mono leading-relaxed border border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tint/35 transition"
              />
            </div>
          </form>
        )}
      </Sheet>

      <AlertDialog
        open={confirmSeedOpen}
        onClose={() => !seedLoading && setConfirmSeedOpen(false)}
        title="Inisialisasi Template Promosi?"
        description="Tambahkan 4 template media promosi bawaan URBAN Gaming ke galeri database?"
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
        tone={toastMsg?.startsWith("Gagal") ? "negative" : "positive"}
        onClose={() => setToastMsg(null)}
        zClassName="z-[200]"
      />

    </div>
  );
}
