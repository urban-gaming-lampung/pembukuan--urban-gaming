import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  X, Image as ImageIcon, Plus, Trash2, Download, Share2, Copy, Check, 
  Sparkles, Pin, Search, ExternalLink, Play, Eye, Filter, 
  Smartphone, Upload, Layers, MessageCircle, AlertCircle, RefreshCw, Edit3
} from "lucide-react";
import { collection, onSnapshot, query, addDoc, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

export interface MediaItem {
  id: string;
  title: string;
  caption: string;
  mediaUrl: string;
  storagePath?: string;
  mediaType: "image" | "video";
  aspectRatio: "9:16" | "1:1" | "16:9" | "auto";
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
  { key: "all", label: "Semua Format" },
  { key: "9:16", label: "📱 Story 9:16" },
  { key: "1:1", label: "🟦 Square 1:1" },
  { key: "16:9", label: "🖥️ Wide 16:9" },
];

const CAPTION_PRESETS = [
  {
    title: "🎮 Promo Rental PS Weekend",
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
    title: "⚽ Update Game eFootball & FC 25",
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
    title: "💰 Pricelist Resmi Rental PS",
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
    title: "✨ Story Harian - Open Slot Ready",
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
    title: "🏆 Info Turnamen & Event",
    category: "Event & Turnamen" as const,
    aspectRatio: "1:1" as const,
    caption: `🏆 TURNAMEN PLAYSTATION URBAN GAMING 🏆

Siapkan tim terbaikmu dan buktikan siapa raja lapangan hijau!
Total hadiah jutaan rupiah + trophy! 🥇🥈🥉

Pendaftaran dibuka sekarang. Slot terbatas!
Hubungi admin untuk syarat & formulir registrasi.
#TurnamenPS #KompetisiPES #TurnamenEAFC #UrbanGamingEvent`,
  },
];

const DEFAULT_MEDIA_ITEMS: Omit<MediaItem, "id">[] = [
  {
    title: "Promo Weekend Gaming Urban",
    category: "Promo & Diskon",
    aspectRatio: "9:16",
    mediaType: "image",
    mediaUrl: "/images/logo.png",
    caption: CAPTION_PRESETS[0].caption,
    uploadedBy: "owner@gmail.com",
    pinned: true,
  },
  {
    title: "Update Game Sepakbola Musim Baru",
    category: "Game Baru",
    aspectRatio: "9:16",
    mediaType: "image",
    mediaUrl: "/images/QRIS.jpeg",
    caption: CAPTION_PRESETS[1].caption,
    uploadedBy: "owner@gmail.com",
    pinned: false,
  },
  {
    title: "Pricelist Resmi Sewa Konsol",
    category: "Daftar Harga & Sewa",
    aspectRatio: "9:16",
    mediaType: "image",
    mediaUrl: "/images/logo.png",
    caption: CAPTION_PRESETS[2].caption,
    uploadedBy: "owner@gmail.com",
    pinned: true,
  }
];

export default function GalleryModal({
  open,
  onClose,
  isSuperAdminOrOwner,
  adminName,
}: GalleryModalProps) {
  useBodyScrollLock(open);

  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("Semua");
  const [activeRatio, setActiveRatio] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals & Drawers
  const [openUpload, setOpenUpload] = useState(false);
  const [openPreview, setOpenPreview] = useState<MediaItem | null>(null);
  const [openEdit, setOpenEdit] = useState<MediaItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Upload Form State
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<MediaItem["category"]>("Story Harian");
  const [uploadAspectRatio, setUploadAspectRatio] = useState<MediaItem["aspectRatio"]>("9:16");
  const [uploadCaption, setUploadCaption] = useState(CAPTION_PRESETS[3].caption);
  const [uploadPinned, setUploadPinned] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [directUrlInput, setDirectUrlInput] = useState("");

  // Toast Timer
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  // Subscribe to Firestore media_gallery
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
        // Fallback without orderBy if index is building
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

  // Handle Image File Selection & Auto Aspect-Ratio Detection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    const objectUrl = URL.createObjectURL(file);
    setUploadPreviewUrl(objectUrl);

    // Auto-detect aspect ratio
    const img = new Image();
    img.onload = () => {
      const ratio = img.height / img.width;
      if (ratio >= 1.4) {
        setUploadAspectRatio("9:16");
      } else if (ratio >= 0.85 && ratio <= 1.15) {
        setUploadAspectRatio("1:1");
      } else if (ratio < 0.85) {
        setUploadAspectRatio("16:9");
      }
    };
    img.src = objectUrl;

    if (!uploadTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setUploadTitle(cleanName);
    }
  };

  // Initialize Default Templates
  const handleInitializeDefaults = async () => {
    if (!confirm("Inisialisasi template media bawaan URBAN Gaming ke galeri?")) return;
    try {
      setLoading(true);
      const galleryRef = collection(db, "media_gallery");
      for (const item of DEFAULT_MEDIA_ITEMS) {
        await addDoc(galleryRef, {
          ...item,
          createdAt: Date.now(),
        });
      }
      showToast("Template media bawaan berhasil ditambahkan!");
    } catch (e: any) {
      alert("Gagal inisialisasi: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Image compressor helper
  const compressImage = async (file: File): Promise<Blob> => {
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
          
          // Max dimension 1440px for super crisp social media stories without bloat
          const MAX_SIZE = 1440;
          if (width > height && width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob || file);
          }, "image/jpeg", 0.88);
        };
      };
    });
  };

  // Submit Upload to Firebase
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      alert("Harap masukkan judul konten.");
      return;
    }
    if (!uploadFile && !directUrlInput.trim()) {
      alert("Harap pilih file gambar/video atau masukkan URL media.");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(20);

      let finalMediaUrl = directUrlInput.trim();
      let storagePath: string | undefined = undefined;

      if (uploadFile) {
        setUploadProgress(40);
        let blobToUpload: Blob = uploadFile;
        if (uploadFile.type.startsWith("image/")) {
          blobToUpload = await compressImage(uploadFile);
        }
        
        setUploadProgress(60);
        const fileName = `${Date.now()}_${uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "")}`;
        storagePath = `gallery_media/${fileName}`;
        const storageRef = ref(storage, storagePath);

        const uploadResult = await uploadBytes(storageRef, blobToUpload);
        finalMediaUrl = await getDownloadURL(uploadResult.ref);
        setUploadProgress(85);
      }

      // Save metadata to Firestore
      await addDoc(collection(db, "media_gallery"), {
        title: uploadTitle.trim(),
        caption: uploadCaption.trim(),
        mediaUrl: finalMediaUrl,
        storagePath: storagePath || null,
        mediaType: uploadFile?.type.startsWith("video/") ? "video" : "image",
        aspectRatio: uploadAspectRatio,
        category: uploadCategory,
        createdAt: Date.now(),
        uploadedBy: adminName || "Super Admin",
        pinned: uploadPinned,
      });

      setUploadProgress(100);
      showToast("Media berhasil diunggah ke Galeri!");
      
      // Reset Form & Close
      setOpenUpload(false);
      setUploadTitle("");
      setUploadCaption(CAPTION_PRESETS[0].caption);
      setUploadFile(null);
      setUploadPreviewUrl(null);
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

  // Toggle Pin Item
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

  // Delete Item
  const handleDeleteItem = async (item: MediaItem) => {
    if (!confirm(`Hapus media "${item.title}" dari galeri?`)) return;
    try {
      await deleteDoc(doc(db, "media_gallery", item.id));
      if (item.storagePath) {
        try {
          const fileRef = ref(storage, item.storagePath);
          await deleteObject(fileRef);
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

  // Update Item Metadata
  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openEdit) return;
    try {
      await updateDoc(doc(db, "media_gallery", openEdit.id), {
        title: openEdit.title,
        caption: openEdit.caption,
        category: openEdit.category,
        aspectRatio: openEdit.aspectRatio,
        pinned: openEdit.pinned,
      });
      showToast("Perubahan media berhasil disimpan.");
      setOpenEdit(null);
    } catch (e: any) {
      alert("Gagal menyimpan perubahan: " + e.message);
    }
  };

  // Copy Caption to Clipboard
  const handleCopyCaption = async (caption: string) => {
    try {
      await navigator.clipboard.writeText(caption);
      showToast("Caption promosi berhasil disalin ke Clipboard! 📋");
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = caption;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Caption promosi berhasil disalin! 📋");
    }
  };

  // Download Media
  const handleDownloadMedia = async (item: MediaItem) => {
    try {
      showToast("Mengunduh media...");
      const response = await fetch(item.mediaUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `URBAN_GAMING_${item.title.replace(/\s+/g, "_")}.${item.mediaType === "video" ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast("Media berhasil diunduh! ⬇️");
    } catch (e) {
      // Fallback direct open
      window.open(item.mediaUrl, "_blank");
    }
  };

  // Native Web Share or WhatsApp Share
  const handleShareMedia = async (item: MediaItem) => {
    // 1. Try Native Web Share API with File (Supported on Android/iOS WhatsApp, Instagram Story, FB)
    if (navigator.share) {
      try {
        const response = await fetch(item.mediaUrl);
        const blob = await response.blob();
        const file = new File([blob], `${item.title.replace(/\s+/g, "_")}.jpg`, { type: blob.type || "image/jpeg" });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: item.title,
            text: item.caption,
            files: [file],
          });
          showToast("Berhasil dibagikan! 🚀");
          return;
        } else {
          // Fallback share text + url
          await navigator.share({
            title: item.title,
            text: item.caption + "\n\n" + item.mediaUrl,
          });
          showToast("Berhasil dibagikan! 🚀");
          return;
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.warn("Web Share API failed, fallback to direct WhatsApp:", err);
        } else {
          return;
        }
      }
    }

    // 2. Direct WhatsApp Share fallback
    const fullText = `${item.caption}\n\n📸 Media: ${item.mediaUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText)}`;
    window.open(waUrl, "_blank");
    showToast("Membuka WhatsApp... 🟢");
  };

  // Filtered & Sorted Media List
  const filteredMedia = useMemo(() => {
    return mediaList.filter((item) => {
      // Category filter
      if (activeCategory !== "Semua" && item.category !== activeCategory) {
        return false;
      }
      // Aspect ratio filter
      if (activeRatio !== "all" && item.aspectRatio !== activeRatio) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchCaption = item.caption?.toLowerCase().includes(q);
        const matchCategory = item.category?.toLowerCase().includes(q);
        if (!matchTitle && !matchCaption && !matchCategory) return false;
      }
      return true;
    }).sort((a, b) => {
      // Pinned items always on top
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [mediaList, activeCategory, activeRatio, searchQuery]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-md transition-opacity duration-300 font-sans">
      
      {/* ============================================================
          MAIN CONTAINER (iOS 18 Glassmorphism Style)
          ============================================================ */}
      <div className="relative w-full h-full bg-zinc-50 dark:bg-[#121214] text-zinc-900 dark:text-zinc-100 overflow-hidden flex flex-col animate-in fade-in duration-300">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-zinc-200/60 dark:border-white/10 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-2xl z-20 shrink-0 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
              <ImageIcon size={20} className="stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-900 dark:text-white uppercase truncate">
                  Galeri Media Sosial
                </h2>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                  Story & Promo Hub
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                Pusat materi postingan WhatsApp Business, Instagram & Facebook Story URBAN Gaming
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSuperAdminOrOwner && (
              <button
                onClick={() => setOpenUpload(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-pink-500/25 active:scale-95 transition-all"
              >
                <Plus size={16} className="stroke-[2.5]" />
                <span className="hidden sm:inline">Upload Konten</span>
                <span className="sm:hidden">Upload</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-zinc-200/70 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 active:scale-90 transition-all"
              aria-label="Tutup Galeri"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-zinc-200/50 dark:border-white/5 bg-white/40 dark:bg-[#18181A]/40 backdrop-blur-xl shrink-0 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Category Tabs (Scrollable) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm shadow-black/10"
                    : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Aspect Ratio & Search */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-xl border border-zinc-200/40 dark:border-white/5">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setActiveRatio(r.key)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                    activeRatio === r.key
                      ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-white"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Cari konten & caption..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-white/5 rounded-xl text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              />
            </div>
          </div>
        </div>

        {/* Content Body / Media Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-ios">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <RefreshCw className="w-8 h-8 text-pink-500 animate-spin" />
              <p className="text-sm font-medium text-zinc-500">Memuat galeri media sosial...</p>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-pink-500/10 dark:bg-pink-500/20 text-pink-500 flex items-center justify-center mb-4">
                <ImageIcon size={36} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
                Belum Ada Media Konten
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
                Mulai unggah foto/video promosi untuk di-share ke WhatsApp Story, Instagram, dan media sosial lainnya.
              </p>
              {isSuperAdminOrOwner && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setOpenUpload(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-bold text-xs shadow-md shadow-pink-500/25 active:scale-95 transition-all"
                  >
                    <Plus size={15} />
                    Upload Media Baru
                  </button>
                  <button
                    onClick={handleInitializeDefaults}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs active:scale-95 transition-all"
                  >
                    <Sparkles size={15} className="text-amber-500" />
                    Inisialisasi Template Bawaan
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredMedia.map((item) => (
                <div
                  key={item.id}
                  className={`group relative bg-white dark:bg-[#1C1C1E] border rounded-[22px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col ${
                    item.pinned 
                      ? "border-pink-500/50 dark:border-pink-500/40 ring-1 ring-pink-500/20" 
                      : "border-zinc-200/70 dark:border-white/10"
                  }`}
                >
                  {/* Media Visual Container */}
                  <div 
                    onClick={() => setOpenPreview(item)}
                    className={`relative w-full overflow-hidden bg-zinc-950 flex items-center justify-center cursor-pointer ${
                      item.aspectRatio === "9:16" ? "aspect-[9/16]" : item.aspectRatio === "16:9" ? "aspect-video" : "aspect-square"
                    }`}
                  >
                    {item.mediaType === "video" ? (
                      <video 
                        src={item.mediaUrl} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        muted 
                        playsInline
                      />
                    ) : (
                      <img
                        src={item.mediaUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    )}

                    {/* Gradient Overlay on Hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/10">
                          {item.aspectRatio === "9:16" ? "Story 9:16" : item.aspectRatio === "1:1" ? "Feed 1:1" : "Wide 16:9"}
                        </span>
                        {item.pinned && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-black shadow-xs">
                            <Pin size={10} className="fill-black" />
                            Pinned
                          </span>
                        )}
                      </div>

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-pink-500/90 text-white backdrop-blur-sm">
                        {item.category}
                      </span>
                    </div>

                    {/* Center Preview Button icon */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-md text-white flex items-center justify-center border border-white/40 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Eye size={20} />
                      </div>
                    </div>

                    {/* Bottom Quick Title on Image */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 pointer-events-none">
                      <h4 className="text-white font-black text-sm tracking-tight drop-shadow-md truncate">
                        {item.title}
                      </h4>
                    </div>
                  </div>

                  {/* Card Content & Action Bar */}
                  <div className="p-3.5 flex flex-col gap-2.5 flex-1 justify-between bg-white dark:bg-[#1C1C1E]">
                    {/* Caption Preview */}
                    <div className="relative bg-zinc-50 dark:bg-zinc-900/60 rounded-xl p-2.5 border border-zinc-100 dark:border-white/5">
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                        {item.caption || "Tidak ada caption"}
                      </p>
                    </div>

                    {/* Primary Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleShareMedia(item)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 active:scale-95 transition-all"
                        title="Share ke WhatsApp / Story"
                      >
                        <Share2 size={13} className="stroke-[2.5]" />
                        <span>Share Story</span>
                      </button>

                      <button
                        onClick={() => handleCopyCaption(item.caption)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold text-xs active:scale-95 transition-all"
                        title="Salin Teks Caption"
                      >
                        <Copy size={13} />
                        <span>Salin Teks</span>
                      </button>
                    </div>

                    {/* Secondary Utility Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-white/5 text-zinc-400">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownloadMedia(item)}
                          className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                          title="Download Gambar"
                        >
                          <Download size={14} />
                        </button>
                        {isSuperAdminOrOwner && (
                          <button
                            onClick={() => handleTogglePin(item)}
                            className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                              item.pinned ? "text-amber-500" : "text-zinc-400 hover:text-amber-500"
                            }`}
                            title={item.pinned ? "Lepas Pin" : "Sematkan ke atas"}
                          >
                            <Pin size={14} className={item.pinned ? "fill-amber-500" : ""} />
                          </button>
                        )}
                      </div>

                      {isSuperAdminOrOwner && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setOpenEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 transition-colors"
                            title="Edit Konten"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors"
                            title="Hapus Media"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          UPLOAD MEDIA DRAWER / MODAL
          ============================================================ */}
      {openUpload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 font-sans">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#1C1C1E] border border-zinc-200 dark:border-white/10 rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-black/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
                  <Upload size={16} />
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Upload Media Konten Baru
                </h3>
              </div>
              <button
                onClick={() => setOpenUpload(false)}
                className="w-8 h-8 rounded-full bg-zinc-200/70 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUploadSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-ios">
              
              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
                  File Media (Gambar / Video)
                </label>
                
                {uploadPreviewUrl ? (
                  <div className="relative rounded-2xl overflow-hidden bg-black/90 aspect-video flex items-center justify-center border border-zinc-200 dark:border-white/10">
                    <img src={uploadPreviewUrl} alt="Preview" className="h-full w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => {
                        setUploadFile(null);
                        setUploadPreviewUrl(null);
                      }}
                      className="absolute top-3 right-3 p-1.5 rounded-full bg-black/70 text-white hover:bg-red-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-pink-500 dark:hover:border-pink-500 rounded-2xl p-6 cursor-pointer bg-zinc-50 dark:bg-zinc-900/40 hover:bg-pink-50/20 dark:hover:bg-pink-500/5 transition-all">
                    <Upload className="w-8 h-8 text-zinc-400 group-hover:text-pink-500 mb-2" />
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Klik untuk pilih gambar/video
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-1">
                      Mendukung format JPG, PNG, WEBP, MP4 (Optimal untuk Story 9:16)
                    </span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Direct URL input option */}
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Atau tempel URL gambar langsung (opsional)..."
                    value={directUrlInput}
                    onChange={(e) => setDirectUrlInput(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-800 dark:text-zinc-200"
                  />
                </div>
              </div>

              {/* Judul & Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Judul Konten
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Promo Weekend PS4 & PS5"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-pink-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Kategori
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-pink-500/40"
                  >
                    {CATEGORIES.filter(c => c !== "Semua").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Aspek Rasio & Pin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                    Format Tampilan
                  </label>
                  <select
                    value={uploadAspectRatio}
                    onChange={(e) => setUploadAspectRatio(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white font-medium focus:ring-2 focus:ring-pink-500/40"
                  >
                    <option value="9:16">📱 Story (9:16 - WhatsApp / IG Story)</option>
                    <option value="1:1">🟦 Feed Persegi (1:1 - Postingan IG/FB)</option>
                    <option value="16:9">🖥️ Landscape (16:9 - Banner / Web)</option>
                  </select>
                </div>

                <div className="pt-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={uploadPinned}
                      onChange={(e) => setUploadPinned(e.target.checked)}
                      className="w-4 h-4 rounded text-pink-500 focus:ring-pink-500"
                    />
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Sematkan ke Paling Atas (Pin ⭐)
                    </span>
                  </label>
                </div>
              </div>

              {/* Caption & Preset Helper */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Teks Caption Siap Kirim
                  </label>
                  
                  {/* Preset Magic Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-zinc-400 font-bold mr-1">Preset:</span>
                    {CAPTION_PRESETS.slice(0, 3).map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setUploadCaption(p.caption);
                          if (!uploadTitle) setUploadTitle(p.title.replace(/^[^\s]+\s/, ""));
                          setUploadCategory(p.category);
                        }}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 hover:bg-pink-100 transition-colors"
                      >
                        {idx === 0 ? "Promo" : idx === 1 ? "Game" : "Pricelist"}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  placeholder="Tulis caption promosi di sini..."
                  className="w-full p-3 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white font-mono leading-relaxed focus:ring-2 focus:ring-pink-500/40"
                />
              </div>

              {/* Upload Progress Bar */}
              {uploading && (
                <div className="w-full space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-pink-500">
                    <span>Mengunggah ke Firebase Storage...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-white/5">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setOpenUpload(false)}
                  className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-white transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 active:bg-pink-700 text-white font-bold text-xs shadow-md shadow-pink-500/25 active:scale-95 transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Mengunggah...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Simpan ke Galeri</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          STORY PREVIEW & DETAIL SIMULATOR MODAL
          ============================================================ */}
      {openPreview && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 font-sans">
          <div className="relative w-full max-w-4xl max-h-[95vh] bg-zinc-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col md:flex-row">
            
            {/* Close Overlay */}
            <button
              onClick={() => setOpenPreview(null)}
              className="absolute top-4 right-4 z-30 w-9 h-9 rounded-full bg-black/60 text-white/80 hover:text-white flex items-center justify-center backdrop-blur-md transition-all"
            >
              <X size={18} />
            </button>

            {/* Left: Smartphone Story Frame Simulator */}
            <div className="flex-1 bg-black flex items-center justify-center p-4 relative overflow-hidden min-h-[350px] md:min-h-[550px]">
              <div className="relative w-full max-w-[320px] aspect-[9/16] rounded-[24px] overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-950 flex items-center justify-center">
                
                {/* Story Top Progress Bar (Simulated) */}
                <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
                  <div className="h-1 flex-1 bg-white/40 rounded-full overflow-hidden">
                    <div className="h-full bg-white animate-pulse" />
                  </div>
                </div>

                {/* Story Account Header */}
                <div className="absolute top-6 left-3 right-3 z-20 flex items-center justify-between text-white pointer-events-none">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-500 p-0.5">
                      <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center font-bold text-[10px]">
                        UG
                      </div>
                    </div>
                    <div>
                      <h5 className="font-bold text-xs leading-none drop-shadow">URBAN GAMING</h5>
                      <span className="text-[9px] text-white/70">Story Promosi</span>
                    </div>
                  </div>
                </div>

                {/* Media Image / Video */}
                {openPreview.mediaType === "video" ? (
                  <video 
                    src={openPreview.mediaUrl} 
                    className="w-full h-full object-cover" 
                    controls 
                    autoPlay 
                    playsInline 
                  />
                ) : (
                  <img
                    src={openPreview.mediaUrl}
                    alt={openPreview.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </div>

            {/* Right: Caption & Sharing Hub */}
            <div className="w-full md:w-[380px] bg-zinc-900 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 text-white overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-pink-500/20 text-pink-400 border border-pink-500/30">
                      {openPreview.category}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Format: {openPreview.aspectRatio}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    {openPreview.title}
                  </h3>
                </div>

                {/* Full Caption Box */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Teks Caption Promosi
                  </label>
                  <div className="p-3 bg-zinc-950/80 border border-white/10 rounded-2xl max-h-56 overflow-y-auto scrollbar-ios">
                    <p className="text-xs text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {openPreview.caption}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons Hub */}
              <div className="space-y-2.5 pt-4 mt-4 border-t border-white/10">
                <button
                  onClick={() => handleShareMedia(openPreview)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
                >
                  <Share2 size={16} />
                  <span>Share Langsung ke WhatsApp / Story</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyCaption(openPreview.caption)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all"
                  >
                    <Copy size={14} />
                    <span>Salin Caption</span>
                  </button>

                  <button
                    onClick={() => handleDownloadMedia(openPreview)}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all"
                  >
                    <Download size={14} />
                    <span>Download Media</span>
                  </button>
                </div>

                {isSuperAdminOrOwner && (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => {
                        setOpenEdit(openPreview);
                        setOpenPreview(null);
                      }}
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Edit3 size={13} />
                      <span>Edit Info</span>
                    </button>
                    <button
                      onClick={() => handleDeleteItem(openPreview)}
                      className="text-xs text-red-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={13} />
                      <span>Hapus dari Galeri</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          EDIT METADATA MODAL
          ============================================================ */}
      {openEdit && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 font-sans">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] border border-zinc-200 dark:border-white/10 rounded-[28px] overflow-hidden shadow-2xl p-6">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-4">
              Edit Konten Galeri
            </h3>
            
            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Judul</label>
                <input
                  type="text"
                  value={openEdit.title}
                  onChange={(e) => setOpenEdit({ ...openEdit, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Kategori</label>
                  <select
                    value={openEdit.category}
                    onChange={(e) => setOpenEdit({ ...openEdit, category: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                  >
                    {CATEGORIES.filter(c => c !== "Semua").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Format Rasio</label>
                  <select
                    value={openEdit.aspectRatio}
                    onChange={(e) => setOpenEdit({ ...openEdit, aspectRatio: e.target.value as any })}
                    className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white"
                  >
                    <option value="9:16">📱 Story (9:16)</option>
                    <option value="1:1">🟦 Feed Persegi (1:1)</option>
                    <option value="16:9">🖥️ Wide (16:9)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Caption</label>
                <textarea
                  rows={5}
                  value={openEdit.caption}
                  onChange={(e) => setOpenEdit({ ...openEdit, caption: e.target.value })}
                  className="w-full p-3 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpenEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-zinc-500"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  Simpan Perubahan
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
          <Check size={14} className="text-emerald-500 stroke-[3]" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
