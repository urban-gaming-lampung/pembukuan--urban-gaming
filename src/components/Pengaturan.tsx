import React, { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { collection, addDoc, deleteDoc, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Trash2, Pencil } from "lucide-react";
// import SopPdf from "../SOP/SOP_SewaPS_URBAN.pdf";

interface Price {
  label: string;
  price: number;
}

type ThemeMode = "light" | "dark" | "auto";
type ImageQuality = "Tinggi" | "Hemat";

interface Props {
  open: boolean;
  onClose: () => void;

  hargaHarian: Price[];
  hargaJajanan: Price[];
  hargaJasaAks: Price[];
  hargaSewa: Price[];
  
  ongkirConfig?: { pegawaiPersen: number, masukGaji: boolean };
  setOngkirConfig?: (cfg: any) => void;

  absenConfig?: { durasiWaktuPotongan: number; waktuToleransi: number; nominalDenda: number; dendaTidakAbsenPulang?: number };
  setAbsenConfig?: (cfg: any) => void;

  themeMode?: ThemeMode;
  onThemeChange?: (mode: ThemeMode) => void;
  userProfileColor?: string;
  onProfileColorChange?: (color: string) => void;

  tableMode?: "Lama" | "Baru";
  onTableModeChange?: (mode: "Lama" | "Baru") => void;

  kualitasGambar?: ImageQuality;
  onKualitasGambarChange?: (q: ImageQuality) => void;

  onBackupData?: () => void;
  onRestoreData?: () => void;
  onBackupDrive?: () => Promise<void>;
  onRestoreDrive?: () => Promise<void>;
  onExportCSV?: () => void;
  onResetSetting?: () => void;
  onLogout?: () => void;

  onOpenEditHarian?: () => void;
  onOpenEditJajanan?: () => void;
  onOpenEditJasaAks?: () => void;
  onOpenEditSewa?: () => void;
  userEmail?: string;
  userProfilePic?: string;
  onProfilePicChange?: (dataUrl: string) => void;
  customBgDark?: string;
  onBgDarkChange?: (dataUrl: string | null) => void;
  history?: any[];
}

type TabKey = "general" | "asisten" | "edit" | "backup" | "export" | "reset" | "info" | "profile" | "gaji" | "sop";

const compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const LockIcon = ({ size = 16, className }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
  </svg>
);

// --- Apple Design Components ---
const IOSGroup = ({ children, title, className = "" }: { children: React.ReactNode; title?: string; className?: string }) => (
  <div className={`mb-6 ${className}`}>
    {title && (
      <div className="px-4 pb-2 text-[13px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </div>
    )}
    <div className="overflow-hidden rounded-[18px] border border-zinc-200/60 bg-white/80 dark:border-zinc-700/50 dark:bg-zinc-800/60 shadow-sm backdrop-blur-md">
      {children}
    </div>
  </div>
);

const IOSRow = ({
  icon,
  iconColor,
  label,
  value,
  onClick,
  isLast,
  chevron = true,
  destructive = false,
}: {
  icon?: string;
  iconColor?: string;
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  isLast?: boolean;
  chevron?: boolean;
  destructive?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={!onClick}
    className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 transition-colors ${onClick ? "active:bg-zinc-100 dark:active:bg-zinc-700/50 cursor-pointer" : "cursor-default"
      } ${!isLast ? "border-b border-zinc-100 dark:border-zinc-700/50" : ""}`}
  >
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[15px] shadow-sm text-white ${iconColor || "bg-zinc-500"
            }`}
        >
          {icon}
        </div>
      )}
      <span
        className={`text-[16px] font-medium truncate ${destructive ? "text-red-500" : "text-zinc-900 dark:text-zinc-100"
          }`}
      >
        {label}
      </span>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {value && <span className="text-[15px] text-zinc-500 dark:text-zinc-400">{value}</span>}
      {chevron && onClick && <span className="text-zinc-400 dark:text-zinc-500 text-lg">›</span>}
    </div>
  </button>
);

const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: string }[];
  value: T;
  onChange: (val: T) => void;
}) => (
  <div className="p-0.5 bg-zinc-200/50 dark:bg-zinc-700/50 rounded-lg flex relative">
    {options.map((opt) => {
      const isActive = value === opt.value;
      return (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 px-3 text-[13px] font-medium rounded-[6px] transition-all duration-200 flex items-center justify-center gap-1.5 ${isActive
            ? "bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm scale-[1.02]"
            : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            }`}
        >
          {opt.icon && <span>{opt.icon}</span>}
          {opt.label}
        </button>
      );
    })}
  </div>
);

// --- Main Component ---
const sopData = [
  {
    id: 1,
    title: "1. Sewa di Tempat",
    content: (
      <ul className="list-disc pl-5 space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
        <li>Wajib memberikan 2 jaminan (pilih salah satu kombinasi):
          <ul className="list-disc pl-5 mt-1">
            <li>KTP + SIM</li>
            <li>KTP + STNK</li>
            <li>KTP + KK</li>
            <li>KTP + KTP lain</li>
          </ul>
        </li>
        <li className="italic text-[12px]">Catatan: Nama dan alamat pada jaminan wajib sama. Jika berbeda, harus konfirmasi terlebih dahulu kepada owner.</li>
        <li>Wajib mengisi form sewa di buku.</li>
        <li>Wajib melakukan tes unit sebelum barang diserahkan.</li>
      </ul>
    )
  },
  {
    id: 2,
    title: "2. Sewa Antar Jemput",
    content: (
      <ul className="list-disc pl-5 space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
        <li>Wajib memberikan 2 jaminan (aturan sama seperti di atas).</li>
        <li>Wajib tes unit sebelum driver pulang. Jika tidak memungkinkan, wajib difoto bersama penyewa + unit PS.</li>
        <li>Wajib foto saat PS sedang digunakan (bukti kondisi normal).</li>
        <li>Wajib tes unit lagi sebelum diambil kembali (untuk menghindari klaim kerusakan).</li>
      </ul>
    )
  },
  {
    id: 3,
    title: "3. Ketentuan Jam Tanggung",
    content: (
      <ul className="list-disc pl-5 space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
        <li>Waktu mulai sewa dan pengambilan PS dimulai pukul 10.00 WIB.</li>
        <li>Sewa 12 jam tidak bisa fleksibel apabila dimulai pada jam tertentu.</li>
        <li>Khusus jam 13.00 - 21.00 disebut jam tanggung.</li>
        <li>Artinya, penyewa tidak bisa pas 12 jam, karena otomatis akan ada tambahan jam.</li>
        <li>Contoh: Jika mulai sewa jam 15.00, maka dihitung menjadi 19 jam.</li>
      </ul>
    )
  },
  {
    id: 4,
    title: "4. Biaya Tambahan Per Jam",
    content: (
      <div className="space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
        <div className="flex justify-between border-b border-zinc-200 dark:border-zinc-700 pb-1">
          <span className="font-semibold">Tipe Sewa</span>
          <span className="font-semibold">Harga/Jam</span>
        </div>
        <div className="flex justify-between"><span>PS3 Only</span><span>Rp 3.000</span></div>
        <div className="flex justify-between"><span>PS3 + TV/Portable</span><span>Rp 4.000</span></div>
        <div className="flex justify-between"><span>PS4 Only</span><span>Rp 5.000</span></div>
        <div className="flex justify-between"><span>PS4 + TV/Portable</span><span>Rp 6.000</span></div>
      </div>
    )
  },
  {
    id: 5,
    title: "5. Denda Penyewa",
    content: (
      <ul className="list-disc pl-5 space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
        <li>Jika penyewa terlambat mengembalikan unit PS, maka akan dikenakan denda.</li>
        <li>Perhitungan denda dimulai dari waktu seharusnya PS dikembalikan.</li>
        <li>Besaran denda mengikuti tarif tambahan per jam yang tertera pada poin nomor 4.</li>
      </ul>
    )
  }
];

const Pengaturan: React.FC<Props> = ({
  open,
  onClose,
  hargaHarian,
  hargaJajanan,
  hargaJasaAks,
  hargaSewa,
  ongkirConfig,
  setOngkirConfig,
  absenConfig,
  setAbsenConfig,
  themeMode = "dark",
  onThemeChange,
  tableMode = "Baru",
  onTableModeChange,
  kualitasGambar = "Tinggi",
  onKualitasGambarChange,
  onBackupData,
  onRestoreData,
  onBackupDrive,
  onRestoreDrive,
  onExportCSV,
  onResetSetting,
  onLogout,
  onOpenEditHarian,
  onOpenEditJajanan,
  onOpenEditJasaAks,
  onOpenEditSewa,
  userEmail,
  userProfilePic,
  onProfilePicChange,
  customBgDark,
  onBgDarkChange,
  userProfileColor,
  onProfileColorChange,
  history = [],
}) => {
  const [tab, setTab] = useState<TabKey>("general");
  const [mobileView, setMobileView] = useState<"menu" | "content">("menu");
  const [sopExpanded, setSopExpanded] = useState<number | null>(null);

  // Local states for range sliders to avoid Firestore lagging while dragging
  const [localPegawaiPersen, setLocalPegawaiPersen] = useState<number>(70);
  const [localNominalDenda, setLocalNominalDenda] = useState<number>(1500);
  const [localWaktuToleransi, setLocalWaktuToleransi] = useState<number>(15);
  const [localDurasiWaktuPotongan, setLocalDurasiWaktuPotongan] = useState<number>(15);
  const [localDendaTidakAbsenPulang, setLocalDendaTidakAbsenPulang] = useState<number>(40000);

  // Sync props to local states
  useEffect(() => {
    if (ongkirConfig) {
      setLocalPegawaiPersen(ongkirConfig.pegawaiPersen ?? 70);
    }
  }, [ongkirConfig]);

  useEffect(() => {
    if (absenConfig) {
      setLocalNominalDenda(absenConfig.nominalDenda ?? 1500);
      setLocalWaktuToleransi(absenConfig.waktuToleransi ?? 15);
      setLocalDurasiWaktuPotongan(absenConfig.durasiWaktuPotongan ?? 15);
      setLocalDendaTidakAbsenPulang(absenConfig.dendaTidakAbsenPulang ?? 40000);
    }
  }, [absenConfig]);

  const isOwner = userEmail?.toLowerCase().trim() === "owner@gmail.com";

  const ADMIN_PASSWORD = "707426";
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [securityAction, setSecurityAction] = useState<"backup" | "restore" | "reset" | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) setMobileView("menu");
  }, [open]);

  const menu = useMemo(() => {
    const allMenus = [
      { key: "general" as const, label: "Umum", icon: "⚙️", color: "bg-zinc-500" },
      { key: "asisten" as const, label: "Asisten", icon: "🤖", color: "bg-cyan-500" },
      { key: "gaji" as const, label: "Gaji Saya", icon: "💰", color: "bg-emerald-500" },
      { key: "edit" as const, label: "Edit Rincian", icon: "📝", color: "bg-blue-500" },
      { key: "backup" as const, label: "Backup & Restore", icon: "☁️", color: "bg-green-500" },
      { key: "export" as const, label: "Export Data", icon: "📤", color: "bg-orange-500" },
      { key: "reset" as const, label: "Reset", icon: "🗑️", color: "bg-red-500" },
      { key: "sop" as const, label: "SOP", icon: "📋", color: "bg-teal-500" },
      { key: "info" as const, label: "Info", icon: "ℹ️", color: "bg-indigo-500" },
    ];
    if (!isOwner) {
      const filtered = allMenus.filter(m => !["asisten", "edit", "backup", "export", "reset"].includes(m.key));
      const infoItem = filtered.find(m => m.key === "info");
      const sopItem = filtered.find(m => m.key === "sop");
      const rest = filtered.filter(m => !["info", "sop"].includes(m.key));
      return [...rest, infoItem!, sopItem!];
    }
    return allMenus.filter(m => m.key !== "gaji");
  }, [isOwner]);

  // --- Asisten State ---
  const [assistants, setAssistants] = useState<any[]>([]);
  const [formAsisten, setFormAsisten] = useState({ nama_pengeluaran: "", kategori: "", tanggal: "1" });
  const [editingAsistenId, setEditingAsistenId] = useState<string | null>(null);

  useEffect(() => {
    if (isOwner) {
      const q = query(collection(db, "owner_assistants"));
      const unsub = onSnapshot(q, (snap) => setAssistants(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      return () => unsub();
    }
  }, [isOwner]);

  const handleAddAsisten = async () => {
    if (!formAsisten.nama_pengeluaran) return;
    setIsLoading(true);
    if (editingAsistenId) {
      // Update existing
      await updateDoc(doc(db, "owner_assistants", editingAsistenId), {
        nama_pengeluaran: formAsisten.nama_pengeluaran,
        kategori: formAsisten.kategori || "Lainnya",
        tanggal: parseInt(formAsisten.tanggal),
        nominal: parseInt((formAsisten as any).nominal || "0"),
      });
      setEditingAsistenId(null);
    } else {
      // Add new
      await addDoc(collection(db, "owner_assistants"), {
        nama_pengeluaran: formAsisten.nama_pengeluaran,
        kategori: formAsisten.kategori || "Lainnya",
        tanggal: parseInt(formAsisten.tanggal),
        nominal: parseInt((formAsisten as any).nominal || "0"),
        status: "aktif",
        last_triggered: 0
      });
    }
    setFormAsisten({ nama_pengeluaran: "", kategori: "", tanggal: "1" });
    setIsLoading(false);
  };
  const handleEditAsisten = (a: any) => {
    setFormAsisten({
      nama_pengeluaran: a.nama_pengeluaran || "",
      kategori: a.kategori || "",
      tanggal: String(a.tanggal || "1"),
      nominal: String(a.nominal || ""),
    } as any);
    setEditingAsistenId(a.id);
  };
  const handleDeleteAsisten = async (id: string) => {
    if (confirm("Hapus pengingat asisten ini?")) await deleteDoc(doc(db, "owner_assistants", id));
  };
  // --- Google Drive State ---
  const [driveConnected, setDriveConnected] = useState(false);

  const [gajiKu, setGajiKu] = useState<{ records?: any[] } | null>(null);
  const [gajiExpandedId, setGajiExpandedId] = useState<string | null>(null);
  useEffect(() => {
    if (open && userEmail && !isOwner) {
      const unsub = onSnapshot(doc(db, "gaji_pegawai", userEmail.toLowerCase().trim()), docSnap => {
        const data = docSnap.exists() ? docSnap.data() : { records: [] };
        let recs = Array.isArray(data.records) ? data.records : [];

        // 1. Kalkulasi Ongkir Otomatis dari history pembukuan khusus untuk user ini
        const ongkirMap = new Map();
        history.forEach((h: any) => {
          if (!h.tanggal) return;
          const d = new Date(h.tanggal);
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yy = String(d.getFullYear()).slice(-2);
          const bulanTahun = `${mm}/${yy}`;

          if (Array.isArray(h.rowsSewa)) {
            h.rowsSewa.forEach((r: any) => {
              if (r.isOngkir === "YA" && r._ongkir && r.diantarOleh && r.diantarOleh.toLowerCase() === userEmail.toLowerCase().trim()) {
                const key = bulanTahun;
                const nominalAsli = parseInt(String(r._ongkir).replace(/\D/g, "")) || 0;
                if (r._isNewOngkirSystem) {
                    const fallbackPersen = r._ongkirPegawaiPersen ?? 70;
                    const fallbackNominal = Math.round((nominalAsli * fallbackPersen) / 100);
                    const pegawaiNominal = r._ongkirPegawaiNominal ?? fallbackNominal;
                    ongkirMap.set(key, (ongkirMap.get(key) || 0) + pegawaiNominal);
                } else {
                    ongkirMap.set(key, (ongkirMap.get(key) || 0) + nominalAsli);
                }
              }
            });
          }

          if (Array.isArray(h.rowsHarian)) {
            h.rowsHarian.forEach((r: any) => {
              if (r._ongkir && r.diantarOleh && r.diantarOleh.toLowerCase() === userEmail.toLowerCase().trim()) {
                const key = bulanTahun;
                const nominalAsli = parseInt(String(r._ongkir).replace(/\D/g, "")) || 0;
                if (nominalAsli > 0) {
                    if (r._isNewOngkirSystem) {
                        const fallbackPersen = r._ongkirPegawaiPersen ?? 70;
                        const fallbackNominal = Math.round((nominalAsli * fallbackPersen) / 100);
                        const pegawaiNominal = r._ongkirPegawaiNominal ?? fallbackNominal;
                        ongkirMap.set(key, (ongkirMap.get(key) || 0) + pegawaiNominal);
                    } else {
                        ongkirMap.set(key, (ongkirMap.get(key) || 0) + nominalAsli);
                    }
                }
              }
            });
          }
        });

        // 2. Populate ongkirBulanIni ke records
        recs.forEach((r: any) => {
          r.ongkirBulanIni = ongkirMap.get(r.bulanTahun) || 0;
          ongkirMap.delete(r.bulanTahun);
        });

        // 3. Tambahkan sisa ongkir ke dalam dummy records baru
        Array.from(ongkirMap.entries()).forEach(([bTahun, val]) => {
          recs.push({
            id: `auto-ongkir-${bTahun}`,
            bulanTahun: bTahun,
            gajiPokok: 0, bonus: 0, potongan: 0,
            ketPemasukan: "", ketPengeluaran: "", buktiTransfer: "",
            ongkirBulanIni: val, isAutoGenerated: true
          });
        });

        // Sort records descending
        recs.sort((a: any, b: any) => {
          const [ma, ya] = (a.bulanTahun || "").split("/");
          const [mb, yb] = (b.bulanTahun || "").split("/");
          if (!ma || !mb) return 0;
          const da = new Date(2000 + parseInt(ya), parseInt(ma) - 1);
          const db = new Date(2000 + parseInt(yb), parseInt(mb) - 1);
          return db.getTime() - da.getTime();
        });

        data.records = recs;
        setGajiKu(data as any);
      });
      return () => unsub();
    }
  }, [open, userEmail, isOwner, history]);

  const runOrAlert = (fn?: () => void, msg?: string) => {
    if (fn) return fn();
    alert(msg || "Fitur ini belum dihubungkan.");
  };

  const openEditModal = (fn?: () => void, msg?: string) => {
    if (!fn) {
      alert(msg || "Fitur edit belum dihubungkan.");
      return;
    }
    fn();
  };

  const triggerSecurity = (action: "backup" | "restore" | "reset") => {
    setSecurityAction(action);
    setPasswordInput("");
    setErrorMsg("");
    setIsSecurityOpen(true);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    if (passwordInput.trim() === ADMIN_PASSWORD) {
      if (securityAction === "backup") runOrAlert(onBackupData);
      else if (securityAction === "restore") runOrAlert(onRestoreData);
      else if (securityAction === "reset") runOrAlert(onResetSetting);

      setIsSecurityOpen(false);
      setPasswordInput("");
      setSecurityAction(null);
    } else {
      setErrorMsg("Password salah. Akses ditolak.");
    }

    setIsLoading(false);
  };

  const summarizeList = (list: Price[]) => {
    const prices = (Array.isArray(list) ? list : []).map((x) => Number(x.price) || 0);
    const min = prices.length ? Math.min(...prices) : 0;
    const max = prices.length ? Math.max(...prices) : 0;
    return { count: prices.length, min, max };
  };

  const sHarian = useMemo(() => summarizeList(hargaHarian), [hargaHarian]);
  const sJajanan = useMemo(() => summarizeList(hargaJajanan), [hargaJajanan]);
  const sJasa = useMemo(() => summarizeList(hargaJasaAks), [hargaJasaAks]);
  const sSewa = useMemo(() => summarizeList(hargaSewa), [hargaSewa]);

  const handleProfilePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onProfilePicChange) {
      try {
        setIsLoading(true);
        const compressedUrl = await compressImage(file, 200, 200, 0.7);
        onProfilePicChange(compressedUrl);
      } catch (error) {
        console.error(error);
        alert("Gagal memproses gambar profil.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCustomBgSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onBgDarkChange) {
      try {
        setIsLoading(true);
        const compressedUrl = await compressImage(file, 1920, 1080, 0.7);
        onBgDarkChange(compressedUrl);
      } catch (error) {
        console.error(error);
        alert("Gagal memproses gambar background. (Mungkin terlalu besar)");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!open) return null;

  const renderContent = () => (
    <div className="space-y-6 animate-fadeIn pb-6">

      {tab === "profile" && (
        <div className="space-y-6">
          <IOSGroup title="URBAN Gaming Acoount">
            <div className="p-6 flex flex-col items-center justify-center text-center border-b border-zinc-100 dark:border-zinc-700/50">
              <div className="relative mb-4 group cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden shadow-inner flex items-center justify-center relative border-4 transition-colors" style={{ borderColor: userProfileColor || '#3b82f6' }}>
                  {userProfilePic ? <img src={userProfilePic} className="w-full h-full object-cover" /> : <div className="text-4xl text-zinc-400">👤</div>}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-white font-medium">Ubah</span>
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={handleProfilePhotoSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-0.5">{userEmail?.split('@')[0] || "User"}</h3>
              <p className="text-[13px] text-zinc-500">{userEmail}</p>
            </div>
          </IOSGroup>

          <IOSGroup title="Profil Indikator">
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-700/50">
              <div className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100 mb-1">Pilih Warna Indikator</div>
              <div className="text-[13px] text-zinc-500 leading-relaxed mb-4">Warna prfil untuk indikator online</div>
              <div className="flex flex-wrap gap-4 justify-center py-2">
                {["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#3f3f46"].map(c => (
                  <button key={c} onClick={() => runOrAlert(() => onProfileColorChange?.(c))} className={`shrink-0 w-8 h-8 rounded-full focus:outline-none focus:ring-4 focus:ring-white/20 transform transition-transform hover:scale-110 flex items-center justify-center shadow-lg border border-black/10 dark:border-white/10 ${userProfileColor === c ? 'scale-125 ring-2 ring-offset-2 ring-offset-zinc-100 dark:ring-offset-zinc-900 ring-zinc-500 z-10' : ''}`} style={{ backgroundColor: c }}>
                    {userProfileColor === c && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ mixBlendMode: 'difference' }}><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </button>
                ))}

                <div className={`shrink-0 relative w-8 h-8 rounded-full shadow-lg border border-black/10 dark:border-white/10 flex items-center justify-center transform transition-transform hover:scale-110 ${userProfileColor && !["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#3f3f46"].includes(userProfileColor) ? 'scale-125 ring-2 ring-offset-2 ring-offset-zinc-100 dark:ring-offset-zinc-900 ring-zinc-500 z-10' : ''}`} title="Custom Color">
                  <div className="absolute inset-0 bg-[conic-gradient(from_90deg,red,yellow,green,cyan,blue,magenta,red)] rounded-full opacity-90 pointer-events-none"></div>
                  <input type="color" value={userProfileColor || "#ffffff"} onChange={(e) => runOrAlert(() => onProfileColorChange?.(e.target.value))} className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] opacity-0 cursor-pointer" />
                  {userProfileColor && !["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#3f3f46"].includes(userProfileColor) ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 drop-shadow-md pointer-events-none" style={{ mixBlendMode: 'difference' }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 drop-shadow-md pointer-events-none"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  )}
                </div>
              </div>
            </div>
          </IOSGroup>

          <IOSGroup title="Kustomisasi Aplikasi">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">
                  Ubah Background
                </div>
                <div className="text-[12px] text-zinc-500 leading-tight">Ubah background</div>
              </div>
              <div className="flex gap-2 items-center">
                {customBgDark && (
                  <button onClick={() => runOrAlert(() => onBgDarkChange && onBgDarkChange(''))} className="bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 font-medium text-[13px] px-4 py-1.5 rounded-full hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors">
                    Reset
                  </button>
                )}
                <div className="relative">
                  <button className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-medium text-[13px] px-4 py-1.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors pointer-events-none">
                    Pilih File
                  </button>
                  <input type="file" accept="image/*" onChange={handleCustomBgSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>
            </div>
          </IOSGroup>
          <IOSGroup title="Otentikasi">
            <IOSRow
              label="Keluar (Logout)" icon="🚪" iconColor="bg-red-500" destructive isLast
              onClick={() => { if (confirm("Yakin ingin keluar dari akun Admin?")) runOrAlert(onLogout); }}
            />
          </IOSGroup>
        </div>
      )}

      {tab === "gaji" && !isOwner && (
        <div className="space-y-6">
          <IOSGroup title="Gaji Saya">
            <div className="p-6">
              {(!gajiKu || !gajiKu.records || gajiKu.records.length === 0) ? (
                <div className="text-center text-zinc-500 py-8 text-sm">Belum ada history data gaji untuk Anda.</div>
              ) : (() => {
                const totalPokok = gajiKu.records.reduce((acc: any, r: any) => acc + (Number(r.gajiPokok) || 0), 0);
                const totalBonus = gajiKu.records.reduce((acc: any, r: any) => acc + (r.gajiTambahan?.reduce((sum: number, t: any) => sum + (Number(t.nominal) || 0), 0) || 0), 0);
                const totalOngkir = gajiKu.records.reduce((acc: any, r: any) => acc + (Number(r.ongkirBulanIni) || 0), 0);
                const totalPotongan = gajiKu.records.reduce((acc: any, r: any) => acc + (r.gajiPengurangan?.reduce((sum: number, p: any) => sum + (Number(p.nominal) || 0), 0) || 0), 0);
                const totalDiterima = totalPokok + totalBonus + totalOngkir - totalPotongan;

                return (
                  <div className="flex flex-col items-center">
                    {/* Pie Chart (Total All Months) */}
                    <div className="w-full max-w-[280px] h-[220px] mx-auto relative mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Pokok", value: totalPokok, color: "#10b981" },
                              { name: "Tambahan", value: totalBonus, color: "#3b82f6" },
                              { name: "Total Ongkir", value: totalOngkir, color: "#8b5cf6" },
                              { name: "Pengurangan", value: totalPotongan, color: "#ef4444" }
                            ].filter(d => d.value > 0)}
                            innerRadius={60} outerRadius={85} paddingAngle={4}
                            dataKey="value" stroke="none"
                          >
                            {[
                              { name: "Pokok", value: totalPokok, color: "#10b981" },
                              { name: "Tambahan", value: totalBonus, color: "#3b82f6" },
                              { name: "Total Ongkir", value: totalOngkir, color: "#8b5cf6" },
                              { name: "Pengurangan", value: totalPotongan, color: "#ef4444" }
                            ].filter(d => d.value > 0).map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(val: number) => `Rp ${val.toLocaleString("id-ID")}`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-1">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-center">Total<br />Sepanjang Waktu</span>
                        <span className="text-lg font-black text-emerald-500">Rp {totalDiterima.toLocaleString("id-ID")}</span>
                      </div>
                    </div>

                    {/* List Monthly Salary Records */}
                    <div className="w-full space-y-3 pt-4 border-t border-zinc-100 dark:border-white/5">
                      <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Riwayat Gaji Bulanan</h4>
                      {gajiKu.records.map((r: any) => {
                        const isExpanded = gajiExpandedId === r.id;
                        const tPokok = Number(r.gajiPokok) || 0;
                        const tbArr = r.gajiTambahan || [];
                        const pgArr = r.gajiPengurangan || [];
                        const tBonus = tbArr.reduce((sum: number, t: any) => sum + (Number(t.nominal) || 0), 0);
                        const tOngkir = Number(r.ongkirBulanIni) || 0;
                        const tPotongan = pgArr.reduce((sum: number, p: any) => sum + (Number(p.nominal) || 0), 0);
                        const tBonusBelumDibayar = tbArr.filter((t: any) => t.status !== 'sudah').reduce((sum: number, t: any) => sum + (Number(t.nominal) || 0), 0);
                        const tDiterimaSemua = Math.max(0, tPokok + tBonus + tOngkir - tPotongan);
                        const tDitransfer = Math.max(0, tPokok + tBonusBelumDibayar - tPotongan);
                        return (
                          <div key={r.id} className="bg-zinc-50 dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden w-full transition-all">
                            {/* Header Collapsed */}
                            <div
                              className="p-3.5 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors select-none"
                              onClick={() => setGajiExpandedId(isExpanded ? null : r.id)}
                            >
                              <span className="font-bold text-[13px] text-zinc-900 dark:text-white uppercase tracking-wide">
                                Gaji {r.bulanTahun}
                              </span>
                              <div className="flex items-center gap-3">
                                <span className="text-[13px] font-black text-emerald-600 dark:text-emerald-400">Rp {tDiterimaSemua.toLocaleString("id-ID")}</span>
                                <span className={`text-zinc-400 transition-transform duration-200 inline-block ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                              </div>
                            </div>

                            {/* Body Expanded */}
                            {isExpanded && (
                              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3 bg-white/50 dark:bg-zinc-900/50 animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs font-bold text-zinc-500">Gaji Pokok</span>
                                  <span className="text-sm font-black text-zinc-900 dark:text-white">Rp {tPokok.toLocaleString("id-ID")}</span>
                                </div>
                                {tbArr.map((tb: any, i: number) => Number(tb.nominal) > 0 && (
                                  <div key={`tb-${i}`} className="flex justify-between items-center">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[12px] font-bold text-blue-500">Tambahan: +Rp {Number(tb.nominal).toLocaleString("id-ID")}</span>
                                      {tb.status === 'sudah' ? (
                                          <span className="text-[9px] font-extrabold w-fit uppercase bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">SUDAH DIBAYAR</span>
                                      ) : (
                                          <span className="text-[9px] font-extrabold w-fit uppercase bg-amber-100/80 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">BELUM DIBAYAR</span>
                                      )}
                                    </div>
                                    <span className="text-right text-[11px] font-medium text-zinc-500 max-w-[140px] italic">"{tb.ket || "-"}"</span>
                                  </div>
                                ))}
                                {(tOngkir > 0) && (
                                  <div className="flex justify-between items-center flex-wrap gap-1">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[12px] font-bold text-purple-500">Total Ongkir: +Rp {tOngkir.toLocaleString("id-ID")}</span>
                                      <span className="text-[9px] font-extrabold w-fit uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded">Tidak masuk transfer</span>
                                    </div>
                                    <span className="text-right text-[11px] font-medium text-purple-400 max-w-[140px] italic">"Otomatis dari Sistem"</span>
                                  </div>
                                )}
                                {pgArr.map((pg: any, i: number) => Number(pg.nominal) > 0 && (
                                  <div key={`pg-${i}`} className="flex justify-between items-center">
                                    <span className="text-[12px] font-bold text-red-500">Pengurangan: -Rp {Number(pg.nominal).toLocaleString("id-ID")}</span>
                                    <span className="text-right text-[11px] font-medium text-zinc-500 max-w-[140px] italic">"{pg.ket || "-"}"</span>
                                  </div>
                                ))}

                                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex justify-between items-center">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80">Yang Harus Ditransfer</span>
                                  <span className="text-lg font-black text-amber-600 dark:text-amber-400">Rp {tDitransfer.toLocaleString("id-ID")}</span>
                                </div>

                                {r.buktiTransfer && (
                                  <div className="mt-4 pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50 flex flex-col items-center">
                                    <span className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Bukti Transfer</span>
                                    <img src={r.buktiTransfer} alt="Bukti Transfer" className="rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm max-w-[200px]" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </IOSGroup>
        </div>
      )}

      {tab === "general" && (
        <>
          <IOSGroup title="Tampilan">
            <div className="flex flex-col px-4 pt-5 pb-4 items-center border-b border-zinc-100 dark:border-zinc-700/50">
              <div className="flex justify-center gap-10 mb-2">
                <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => runOrAlert(() => onThemeChange?.("light"))}>
                  <div className="w-20 h-[130px] rounded-[18px] bg-gradient-to-br from-[#cce5ff] to-[#60a5fa] p-1 shadow-md border border-black/5 dark:border-white/10">
                    <div className="w-full h-full rounded-[14px] bg-white/40 flex flex-col p-2 gap-2 backdrop-blur-md">
                      <div className="w-full h-4 bg-white shadow-sm rounded-md border border-black/5"></div>
                      <div className="w-full h-6 bg-white/70 shadow-sm rounded-md flex items-center justify-center text-[10px] font-bold text-blue-900 border border-black/5">09.41</div>
                    </div>
                  </div>
                  <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">Light</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${themeMode === 'light' ? 'bg-blue-500 border-blue-500' : 'border-zinc-300 dark:border-zinc-600 bg-transparent'}`}>
                    {themeMode === 'light' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => runOrAlert(() => onThemeChange?.("dark"))}>
                  <div className="w-20 h-[130px] rounded-[18px] bg-gradient-to-br from-[#1e3a8a] to-[#0f172a] p-1 shadow-md border border-black/5 dark:border-white/10">
                    <div className="w-full h-full rounded-[14px] bg-black/40 flex flex-col p-2 gap-2 backdrop-blur-md border border-white/5">
                      <div className="w-full h-4 bg-white/20 shadow-sm rounded-md"></div>
                      <div className="w-full h-6 bg-white/10 shadow-sm rounded-md flex items-center justify-center text-[10px] font-bold text-blue-100">09.41</div>
                    </div>
                  </div>
                  <span className="text-[15px] font-medium text-zinc-900 dark:text-zinc-100">Dark</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${themeMode === 'dark' ? 'bg-blue-500 border-blue-500' : 'border-zinc-300 dark:border-zinc-600 bg-transparent'}`}>
                    {themeMode === 'dark' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-700/50 cursor-pointer" onClick={() => runOrAlert(() => onThemeChange?.(themeMode === "auto" ? "dark" : "auto"))}>
              <span className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">Otomatis</span>
              <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-[3px] ${themeMode === 'auto' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${themeMode === 'auto' ? 'translate-x-[20px]' : 'translate-x-0'}`}></div>
              </div>
            </div>
          </IOSGroup>

          <IOSGroup title="Pengaturan Tabel & Kualitas">
            <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-700/50">
              <div className="space-y-0.5">
                <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">
                  Mode Tabel Rincian
                </div>
                <div className="text-xs text-zinc-500">Ubah gaya tabel di layar HP</div>
              </div>
              <div className="w-40">
                <SegmentedControl
                  value={tableMode}
                  onChange={(val) => runOrAlert(() => onTableModeChange?.(val as "Lama" | "Baru"))}
                  options={[
                    { value: "Lama", label: "Klasik", icon: "📄" },
                    { value: "Baru", label: "Kartu", icon: "💳" },
                  ]}
                />
              </div>
            </div>

            {/* Kualitas Gambar khusus Owner */}
            {isOwner && (
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">
                    Kualitas Gambar
                  </div>
                  <div className="text-xs text-zinc-500">Pengaruh ke ukuran file PDF</div>
                </div>
                <div className="w-40">
                  <SegmentedControl
                    value={kualitasGambar}
                    onChange={(val) =>
                      runOrAlert(() => onKualitasGambarChange?.(val as ImageQuality))
                    }
                    options={[
                      { value: "Tinggi", label: "HD", icon: "✨" },
                      { value: "Hemat", label: "Low", icon: "⚡" },
                    ]}
                  />
                </div>
              </div>
            )}
          </IOSGroup>

          {isOwner && (
            <IOSGroup title="Atur Ongkir (Sistem Baru)">
              <div className="px-4 py-4 flex flex-col gap-4 border-b border-zinc-100 dark:border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">Bagi Hasil Pegawai</div>
                    <div className="text-xs text-zinc-500">Porsi ongkir untuk pegawai (Owner: {100 - localPegawaiPersen}%)</div>
                  </div>
                  <div className="text-xl font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-lg">{localPegawaiPersen}%</div>
                </div>
                <div className="relative pt-2 pb-1 touch-pan-y">
                  <input 
                    type="range" 
                    min="0" max="100" step="5" 
                    value={localPegawaiPersen} 
                    onChange={(e) => setLocalPegawaiPersen(Number(e.target.value))}
                    onMouseUp={() => runOrAlert(() => setOngkirConfig && setOngkirConfig({ ...ongkirConfig, pegawaiPersen: localPegawaiPersen }))}
                    onTouchEnd={() => runOrAlert(() => setOngkirConfig && setOngkirConfig({ ...ongkirConfig, pegawaiPersen: localPegawaiPersen }))}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-500"
                  />
                </div>
              </div>
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer" onClick={() => runOrAlert(() => setOngkirConfig && setOngkirConfig({ ...ongkirConfig, masukGaji: !ongkirConfig?.masukGaji }))}>
                <div className="space-y-0.5">
                  <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">Masuk Total Gaji</div>
                  <div className="text-xs text-zinc-500">Otomatis tambahkan porsi pegawai ke "Gaji Yang Harus Ditransfer"</div>
                </div>
                <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-[3px] ${ongkirConfig?.masukGaji ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${ongkirConfig?.masukGaji ? 'translate-x-[20px]' : 'translate-x-0'}`}></div>
                </div>
              </div>
            </IOSGroup>
          )}

          {isOwner && (
            <IOSGroup title="Potongan Gaji Absen (Keterlambatan)">
              <div className="px-4 py-4 flex flex-col gap-4 border-b border-zinc-100 dark:border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">Nominal Denda (Rp)</div>
                    <div className="text-xs text-zinc-500">Jumlah denda per blok waktu</div>
                  </div>
                  <div className="text-[15px] font-bold text-red-500 bg-red-50 dark:bg-red-500/10 px-3 py-1 rounded-lg">Rp {localNominalDenda.toLocaleString("id-ID")}</div>
                </div>
                <div className="relative pt-2 pb-1 touch-pan-y">
                  <input 
                    type="range" min="0" max="10000" step="500" 
                    value={localNominalDenda} 
                    onChange={(e) => setLocalNominalDenda(Number(e.target.value))}
                    onMouseUp={() => runOrAlert(() => setAbsenConfig && setAbsenConfig({ ...absenConfig, nominalDenda: localNominalDenda }))}
                    onTouchEnd={() => runOrAlert(() => setAbsenConfig && setAbsenConfig({ ...absenConfig, nominalDenda: localNominalDenda }))}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-red-500"
                  />
                </div>
              </div>
              <div className="px-4 py-4 flex flex-col gap-4 border-b border-zinc-100 dark:border-zinc-700/50">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">Waktu Toleransi (Menit)</div>
                    <div className="text-xs text-zinc-500">Toleransi awal sebelum mulai didenda</div>
                  </div>
                  <div className="text-[15px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-lg">{localWaktuToleransi} mnt</div>
                </div>
                <div className="relative pt-2 pb-1 touch-pan-y">
                  <input 
                    type="range" min="0" max="60" step="5" 
                    value={localWaktuToleransi} 
                    onChange={(e) => setLocalWaktuToleransi(Number(e.target.value))}
                    onMouseUp={() => runOrAlert(() => setAbsenConfig && setAbsenConfig({ ...absenConfig, waktuToleransi: localWaktuToleransi }))}
                    onTouchEnd={() => runOrAlert(() => setAbsenConfig && setAbsenConfig({ ...absenConfig, waktuToleransi: localWaktuToleransi }))}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-amber-500"
                  />
                </div>
              </div>
              <div className="px-4 py-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">Durasi Blok Potongan (Menit)</div>
                    <div className="text-xs text-zinc-500">Denda dikalikan setiap kelipatan durasi ini</div>
                  </div>
                  <div className="text-[15px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-lg">{localDurasiWaktuPotongan} mnt</div>
                </div>
                <div className="relative pt-2 pb-1 touch-pan-y">
                  <input 
                    type="range" min="5" max="60" step="5" 
                    value={localDurasiWaktuPotongan} 
                    onChange={(e) => setLocalDurasiWaktuPotongan(Number(e.target.value))}
                    onMouseUp={() => runOrAlert(() => setAbsenConfig && setAbsenConfig({ ...absenConfig, durasiWaktuPotongan: localDurasiWaktuPotongan }))}
                    onTouchEnd={() => runOrAlert(() => setAbsenConfig && setAbsenConfig({ ...absenConfig, durasiWaktuPotongan: localDurasiWaktuPotongan }))}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-500"
                  />
                </div>
              </div>
              <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-semibold text-zinc-900 dark:text-white">Denda Tidak Full Absen (Bolos/Lupa)</span>
                    <span className="text-[12px] text-zinc-500 dark:text-zinc-400">Potongan gaji jika tidak absen masuk/pulang sampai tutup buku</span>
                  </div>
                  <div className="text-[15px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-3 py-1 rounded-lg">Rp {localDendaTidakAbsenPulang.toLocaleString("id-ID")}</div>
                </div>
                <div className="relative pt-2 pb-6 touch-pan-y">
                  <input 
                    type="range" min="0" max="100000" step="5000"
                    value={localDendaTidakAbsenPulang}
                    onChange={(e) => setLocalDendaTidakAbsenPulang(Number(e.target.value))}
                    onMouseUp={() => runOrAlert(() => setAbsenConfig && setAbsenConfig({ ...absenConfig, dendaTidakAbsenPulang: localDendaTidakAbsenPulang }))}
                    onTouchEnd={() => runOrAlert(() => setAbsenConfig && setAbsenConfig({ ...absenConfig, dendaTidakAbsenPulang: localDendaTidakAbsenPulang }))}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] font-medium text-zinc-400">
                    <span>Rp 0</span>
                    <span>Rp 100.000</span>
                  </div>
                </div>
              </div>
            </IOSGroup>
          )}
        </>
      )}

      {tab === "edit" && (
        <>
          <div className="px-1 mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            Pilih kategori untuk mengubah harga atau nama item. Perubahan tersimpan otomatis.
          </div>
          <IOSGroup title="Kategori Item">
            <IOSRow label="Pemasukan Harian" value={`${sHarian.count} Item`} icon="🎮" iconColor="bg-blue-500" onClick={() => openEditModal(onOpenEditHarian)} />
            <IOSRow label="Jajanan" value={`${sJajanan.count} Item`} icon="🍜" iconColor="bg-orange-500" onClick={() => openEditModal(onOpenEditJajanan)} />
            <IOSRow label="Jasa & Aksesoris" value={`${sJasa.count} Item`} icon="🧰" iconColor="bg-slate-500" onClick={() => openEditModal(onOpenEditJasaAks)} />
            <IOSRow label="Sewa PS" value={`${sSewa.count} Item`} icon="🚚" iconColor="bg-green-500" isLast onClick={() => openEditModal(onOpenEditSewa)} />
          </IOSGroup>
        </>
      )}

      {tab === "asisten" && (
        <div className="space-y-6">
          <div className="px-1 mb-2 text-sm text-zinc-500 dark:text-zinc-400">
            Asisten akan mengingatkan Anda berupa Pop-up saat Anda Login setiap bulannya untuk otomatis menyimpan pengeluaran.
          </div>
          <IOSGroup title="Tambah Pengingat Asisten">
            <div className="p-4 flex flex-col gap-3 bg-white/50 dark:bg-black/20">
              <input type="text" value={formAsisten.nama_pengeluaran} onChange={e => setFormAsisten({ ...formAsisten, nama_pengeluaran: e.target.value })} placeholder="Nama Pengeluaran (misal: Tagihan Wi-Fi)" className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white" />
              <input type="text" value={formAsisten.kategori} onChange={e => setFormAsisten({ ...formAsisten, kategori: e.target.value })} placeholder="Kategori (misal: Listrik / Air / Internet)" className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white" />
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">Tgl Aktif:</span>
                <input type="number" min="1" max="31" value={formAsisten.tanggal} onChange={e => setFormAsisten({ ...formAsisten, tanggal: e.target.value })} className="w-20 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-center text-zinc-900 dark:text-white" />
                <input type="number" value={(formAsisten as any).nominal || ""} onChange={e => setFormAsisten({ ...formAsisten, nominal: e.target.value } as any)} placeholder="Nominal (Opsi)" className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white" />
              </div>
              <button disabled={!formAsisten.nama_pengeluaran || isLoading} onClick={handleAddAsisten} className="w-full mt-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2.5 rounded-lg disabled:opacity-50">{editingAsistenId ? "Simpan Perubahan" : "Tambahkan Asisten"}</button>
              {editingAsistenId && (
                <button onClick={() => { setEditingAsistenId(null); setFormAsisten({ nama_pengeluaran: "", kategori: "", tanggal: "1" }); }} className="w-full mt-1 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 font-bold py-2.5 rounded-lg">Batal Edit</button>
              )}
            </div>
          </IOSGroup>
          {assistants.length > 0 && (
            <IOSGroup title="Daftar Pengingat">
              {assistants.map((a, i) => (
                <div key={a.id} className={`flex items-center justify-between p-4 ${i !== assistants.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-700/50' : ''} ${editingAsistenId === a.id ? 'bg-cyan-50 dark:bg-cyan-500/10' : ''}`}>
                  <div>
                    <div className="font-bold text-[14px] text-zinc-800 dark:text-white">{a.nama_pengeluaran}</div>
                    <div className="text-[11px] font-medium text-zinc-500 uppercase">Tgl {a.tanggal} | {a.kategori}{a.nominal ? ` | Rp ${Number(a.nominal).toLocaleString("id-ID")}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEditAsisten(a)} className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-500 active:scale-90"><Pencil size={14} /></button>
                    <button onClick={() => handleDeleteAsisten(a.id)} className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20 text-red-500 active:scale-90"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </IOSGroup>
          )}
        </div>
      )}

      {tab === "backup" && (
        <div className="space-y-6">
          <IOSGroup title="Backup & Restore Online (Google Drive)">
            <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-700/50">
              <div className="space-y-0.5">
                <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">Koneksi Cloud</div>
                <div className="text-xs text-zinc-500">{driveConnected ? "Sudah disetujui" : "Sinkronisasi via Google Auth"}</div>
              </div>
              <button disabled={isLoading} onClick={async () => {
                if (!driveConnected) {
                  setErrorMsg("");
                  setIsLoading(true);
                  try {
                    const { authenticateDrive } = await import("../lib/googleDrive");
                    await authenticateDrive();
                    setDriveConnected(true);
                  } catch (e: any) {
                    alert("Login Google dibatalkan atau gagal: " + (e.message || "Unknown Error"));
                  }
                  setIsLoading(false);
                } else {
                  setDriveConnected(false);
                }
              }} className={`px-4 py-1.5 font-bold text-[12px] rounded-full transition-all disabled:opacity-50 ${driveConnected ? 'bg-red-100 text-red-600 dark:bg-red-500/20' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                {isLoading ? "Memproses..." : driveConnected ? "Putuskan" : "Hubungkan"}
              </button>
            </div>

            {driveConnected && (
              <div className="p-3 bg-zinc-50 dark:bg-black/20 flex gap-2">
                <button onClick={async () => {
                  setIsLoading(true);
                  if (onBackupDrive) await onBackupDrive();
                  setIsLoading(false);
                }} disabled={isLoading} className="flex-1 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-900/30 dark:hover:bg-cyan-800/40 text-cyan-700 dark:text-cyan-400 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                  {isLoading ? "Mengunggah..." : "Backup ke Drive"}
                </button>
                <button onClick={async () => {
                  setIsLoading(true);
                  if (onRestoreDrive) await onRestoreDrive();
                  setIsLoading(false);
                }} disabled={isLoading} className="flex-1 bg-teal-100 hover:bg-teal-200 dark:bg-teal-900/30 dark:hover:bg-teal-800/40 text-teal-700 dark:text-teal-400 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-all">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  {isLoading ? "Menarik..." : "Restore dari Drive"}
                </button>
              </div>
            )}
          </IOSGroup>
          <IOSGroup title="Pencadangan File (Lokal/Flashdisk)">
            <IOSRow label="Backup Data ke File" icon="💾" iconColor="bg-blue-500" onClick={() => triggerSecurity("backup")} />
            <IOSRow label="Restore dari File" icon="📁" iconColor="bg-green-500" isLast onClick={() => triggerSecurity("restore")} />
          </IOSGroup>
        </div>
      )}

      {tab === "export" && (
        <IOSGroup title="Laporan">
          <IOSRow label="Download Laporan CSV" icon="🧾" iconColor="bg-indigo-500" isLast onClick={() => runOrAlert(onExportCSV)} />
        </IOSGroup>
      )}

      {tab === "reset" && (
        <IOSGroup title="Zona Bahaya">
          <IOSRow
            label="Reset Semua Pengaturan" icon="🗑️" iconColor="bg-red-500" destructive isLast
            onClick={() => triggerSecurity("reset")}
          />
        </IOSGroup>
      )}

      {tab === "sop" && (
        <div className="space-y-5">
          <IOSGroup title="Standar Operasional Prosedur (SOP)">
            <div className="p-4 space-y-3">
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 0 ? null : 0)}
                >
                  <span className="font-bold text-[14px] text-zinc-800 dark:text-zinc-100">SOP SEWA PLAYSTATION (URBAN)</span>
                  <span className={`text-zinc-400 transition-transform duration-200 inline-block ${sopExpanded === 0 ? 'rotate-180' : ''}`}>▼</span>
                </div>
                {sopExpanded === 0 && (
                  <div className="p-4 bg-white dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2 duration-200 space-y-6">
                    {sopData.map((sop) => (
                      <div key={sop.id} className="space-y-2">
                        <div className="font-bold text-[13px] text-zinc-800 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-1">
                          {sop.title}
                        </div>
                        {sop.content}
                      </div>
                    ))}
                    <div className="pt-4 flex justify-center border-t border-zinc-100 dark:border-zinc-800 mt-2">
                      <a
                        href="#"
                        download="SOP_SewaPS_URBAN.pdf"
                        className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold py-2.5 px-6 rounded-xl text-[13px] flex items-center justify-center gap-2 hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        Download SOP ini
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </IOSGroup>
        </div>
      )}

      {/* --- INFO SECTION (WRAPPED) --- */}
      {tab === "info" && (
        <div className="space-y-5">
          {/* 1. Header Logo (Tetap Fixed/Diluar Scroll) */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-zinc-900 dark:bg-white rounded-[18px] mx-auto shadow-lg flex items-center justify-center text-3xl">
              🎮
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">URBAN Console</h3>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">Build v3.5</div>
            </div>
          </div>

          {/* 2. Content Wrapper (Scrollable Box) */}
          <IOSGroup title="Informasi & Panduan" className="mb-0">
            {/* Gunakan max-h yg pas supaya tidak overflow keluar dari tinggi modal fixed */}
            <div className="max-h-[380px] overflow-y-auto p-5 scrollbar-thin">
              {/* Tentang */}
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
                <span>📌</span> Tentang Aplikasi
              </h4>
              <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-300 mb-6">
                Aplikasi ini digunakan untuk mencatat transaksi, pemasukan, dan pengeluaran <b>URBAN PlayStation Lampung</b>. Aplikasi bersifat pribadi untuk kebutuhan internal.
              </p>

              {/* Panduan */}
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
                <span>📝</span> Panduan Singkat
              </h4>
              <div className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-300 space-y-3 mb-6">
                <p>
                  Aplikasi ini sudah dilengkapi fitur <b>penjumlahan otomatis</b>, <b>grafik</b>, <b>tarik data</b>, <b>backup & restore</b>, <b>filter tanggal</b>, serta pilihan <b>tema Gelap/Terang</b>.
                </p>
                <ul className="list-disc ml-4 space-y-1.5 marker:text-zinc-400">
                  <li>Untuk <b>mengganti tema</b>, tekan tombol <b>Gelap/Terang</b> di pojok kanan atas.</li>
                  <li>Menambah atau mengedit item rincian (PS, jajanan, jasa, sewa) bisa diakses melalui menu <b>Edit Rincian</b>.</li>
                  <li><b>Backup seluruh data</b> bisa dilakukan lewat menu <b>Backup & Restore Data</b>.</li>
                  <li><b>Ekspor data ke CSV</b> dapat diakses pada menu <b>Export Data</b>.</li>
                  <li><b>Reset Setting</b> tersedia di menu <b>Reset Setting</b> untuk mengembalikan pengaturan default (data transaksi tetap aman).</li>
                </ul>
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 p-3 rounded-xl flex gap-2.5 mt-2">
                  <span className="shrink-0">💡</span>
                  <span className="text-xs text-yellow-800 dark:text-yellow-200/80">
                    <b>Tips:</b> Jangan lupa lakukan backup data secara berkala agar catatan tidak hilang.
                  </span>
                </div>
              </div>

              {/* Kontak */}
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
                <span>📞</span> Kontak
              </h4>
              <div className="text-[14px] text-zinc-600 dark:text-zinc-300">
                <div className="font-medium">URBAN PlayStation Lampung</div>
                <div>Telp/WA: <span className="text-blue-600 dark:text-blue-400 font-medium">085709647790</span></div>
              </div>
            </div>
          </IOSGroup>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/40 backdrop-blur-sm transition-all duration-300">
      {/* ✅ FIX: Tinggi Desktop dikunci di 640px (md:h-[640px]).
        Jadi walaupun isi kontennya sedikit (seperti tab 'Export'), kotak modal tetap besar.
        Ini menjaga layout tidak berubah-ubah (jumping).
      */}
      <div className="w-full h-full md:h-[640px] md:max-w-[850px] bg-[#F2F2F7] dark:bg-black md:rounded-[20px] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-zinc-200/50 dark:border-zinc-800">

        {/* SIDEBAR (Desktop) */}
        <div className="hidden md:flex flex-col w-[260px] bg-[#F2F2F7]/50 dark:bg-[#1c1c1e]/50 border-r border-zinc-200 dark:border-zinc-800 py-6 px-3 backdrop-blur-xl">
          <div className="px-3 mb-6"><h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Pengaturan</h2></div>

          {/* iOS Profile Head (Desktop) */}
          <div className="px-1 mb-5">
            <div onClick={() => setTab("profile")} className={`bg-white/80 dark:bg-[#2C2C2E]/80 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3 cursor-pointer shadow-sm border border-black/5 dark:border-white/5 transition-all ${tab === 'profile' ? 'ring-2 ring-blue-500 border-transparent dark:ring-blue-400' : 'hover:bg-white dark:hover:bg-[#2C2C2E]'}`}>
              <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                {userProfilePic ? <img src={userProfilePic} className="w-full h-full object-cover" /> : <div className="text-zinc-400">👤</div>}
              </div>
              <div className="flex-1 w-0">
                <h3 className="text-[15px] font-bold text-zinc-900 dark:text-white truncate leading-tight">{userEmail?.split('@')[0] || "User"}</h3>
                <p className="text-[11px] text-zinc-500 truncate leading-tight mt-0.5">Edit akun, cek detail...</p>
              </div>
              <div className="text-zinc-400 text-lg mr-1 opacity-60">›</div>
            </div>
          </div>

          <div className="space-y-1 flex-1 overflow-y-auto">
            {menu.map((m) => (
              <button key={m.key} onClick={() => setTab(m.key)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${tab === m.key ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"}`}>
                <div className={`w-6 h-6 rounded-[6px] flex items-center justify-center text-[12px] text-white shadow-sm ${m.color}`}>{m.icon}</div>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MOBILE MENU */}
        <div className={`flex flex-col flex-1 bg-[#F2F2F7] dark:bg-black h-full md:hidden ${mobileView === 'content' ? 'hidden' : 'flex'}`}>
          <div className="px-5 py-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Pengaturan</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-500">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {/* iOS Profile Head (Mobile) */}
            <IOSGroup className="!mb-8">
              <div onClick={() => { setTab("profile"); setMobileView("content"); }} className="p-4 flex flex-row items-center gap-4 cursor-pointer active:bg-zinc-100 dark:active:bg-zinc-700/50 transition-colors">
                <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center">
                  {userProfilePic ? <img src={userProfilePic} className="w-full h-full object-cover" /> : <div className="text-2xl text-zinc-400">👤</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[20px] font-bold text-zinc-900 dark:text-white truncate">{userEmail?.split('@')[0] || "User"}</h3>
                  <p className="text-[13px] text-zinc-500 truncate mt-0.5">Edit akun, cek detail...</p>
                </div>
                <div className="text-zinc-400 text-2xl mr-1 opacity-60">›</div>
              </div>
            </IOSGroup>

            <IOSGroup>{menu.map((m, i) => (<IOSRow key={m.key} label={m.label} icon={m.icon} iconColor={m.color} isLast={i === menu.length - 1} onClick={() => { setTab(m.key); setMobileView("content"); }} />))}</IOSGroup>
            <IOSGroup><IOSRow label="Tutup Pengaturan" icon="✕" iconColor="bg-zinc-400" isLast onClick={onClose} /></IOSGroup>
          </div>
        </div>

        {/* CONTENT */}
        <div className={`flex flex-col flex-1 bg-[#F2F2F7] dark:bg-black h-full overflow-hidden ${mobileView === 'menu' ? 'hidden md:flex' : 'flex'}`}>
          <div className="shrink-0 h-14 md:h-16 px-4 md:px-8 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <button onClick={() => setMobileView('menu')} className="md:hidden text-blue-500 flex items-center gap-1 font-medium -ml-2 pr-2"><span className="text-2xl">‹</span> Kembali</button>
              <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white">{menu.find(m => m.key === tab)?.label}</h3>
            </div>
            <button onClick={onClose} className="hidden md:flex text-xs font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-3 py-1.5 rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-700 transition">Esc</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-8"><div className="max-w-2xl mx-auto md:mx-0">{renderContent()}</div></div>
        </div>
      </div>

      {isSecurityOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-zinc-900/20 dark:bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSecurityOpen(false)}
          />
          <div className="relative w-full max-w-[320px] overflow-hidden rounded-[24px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <LockIcon className="text-red-600 dark:text-red-500" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Restricted Access
              </h3>
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
                {securityAction === 'backup' && "Masukkan password administrator untuk mendownload backup data lengkap."}
                {securityAction === 'restore' && "Masukkan password administrator untuk me-restore riwayat data sistem."}
                {securityAction === 'reset' && "Masukkan password administrator untuk me-reset semua pengaturan. Data transaksi tetap aman."}
              </p>

              <form onSubmit={handleVerify}>
                <input
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Password..."
                  className="w-full text-center rounded-xl bg-zinc-100 dark:bg-black/50 border-0 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-red-500 mb-2 dark:text-white placeholder:text-zinc-400"
                />
                {errorMsg && (
                  <p className="text-xs font-medium text-red-600 mb-4 animate-pulse">
                    {errorMsg}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsSecurityOpen(false)}
                    className="w-full rounded-xl py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!passwordInput || isLoading}
                    className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
                  >
                    {isLoading ? "..." : "Lanjutkan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pengaturan;