import React, { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { collection, addDoc, deleteDoc, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Settings,
  Bot,
  Wallet,
  FileText,
  Cloud,
  Upload,
  Trash2,
  ClipboardList,
  Info,
  User,
  LogOut,
  CreditCard,
  Sparkles,
  Zap,
  Gamepad2,
  Coffee,
  Wrench,
  Truck,
  Save,
  FolderOpen,
  FileSpreadsheet,
  Pin,
  BookOpen,
  Lightbulb,
  Phone,
  Lock,
  ChevronLeft,
  X,
  ChevronDown,
  ChevronUp,
  Download,
  Check,
  Pencil,
  Plus,
  ChevronRight
} from "lucide-react";
// import SopPdf from "../SOP/SOP_SewaPS_URBAN.pdf";
import versionData from "../version.json";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { getAbsenCycleInfo, getCycleInfoFromBulanTahun, BULAN_NAMES, normalizeBulanTahun, normalizeDateStr } from "../lib/absenPeriod";

interface Price {
  label: string;
  price: number;
}

type ThemeMode = "light" | "dark" | "auto";
type ImageQuality = "Tinggi" | "Hemat";

interface Props {
  open: boolean;
  onClose: () => void;
  isOwner?: boolean;

  hargaHarian: Price[];
  hargaJajanan: Price[];
  hargaJasaAks: Price[];
  hargaSewa: Price[];
  
  ongkirConfig?: { pegawaiPersen: number, masukGaji: boolean };
  setOngkirConfig?: (cfg: any) => void;

  absenConfig?: { durasiWaktuPotongan: number; waktuToleransi: number; nominalDenda: number; dendaTidakAbsenPulang?: number; tanggalMulaiHitung?: number };
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
  icon?: React.ReactNode;
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
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] shadow-sm text-white ${iconColor || "bg-zinc-500"
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
      {chevron && onClick && <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />}
    </div>
  </button>
);

const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
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
          {opt.icon && <span className="flex items-center justify-center">{opt.icon}</span>}
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
  isOwner: isOwnerProp,
}) => {
  useBodyScrollLock(open);
  const [tab, setTab] = useState<TabKey>("general");
  const [mobileView, setMobileView] = useState<"menu" | "content">("menu");
  const [sopExpanded, setSopExpanded] = useState<number | null>(null);

  // Local states for range sliders & toggle to avoid Firestore lagging and prevent overwrite race conditions
  const [localPegawaiPersen, setLocalPegawaiPersen] = useState<number>(ongkirConfig?.pegawaiPersen ?? 70);
  const [localMasukGaji, setLocalMasukGaji] = useState<boolean>(Boolean(ongkirConfig?.masukGaji));
  const [localNominalDenda, setLocalNominalDenda] = useState<number>(1500);
  const [localWaktuToleransi, setLocalWaktuToleransi] = useState<number>(15);
  const [localDurasiWaktuPotongan, setLocalDurasiWaktuPotongan] = useState<number>(15);
  const [localDendaTidakAbsenPulang, setLocalDendaTidakAbsenPulang] = useState<number>(40000);
  const [localTanggalMulaiHitung, setLocalTanggalMulaiHitung] = useState<number>(1);

  // Sync props to local states
  useEffect(() => {
    if (ongkirConfig) {
      setLocalPegawaiPersen(typeof ongkirConfig.pegawaiPersen === "number" ? ongkirConfig.pegawaiPersen : 70);
      setLocalMasukGaji(Boolean(ongkirConfig.masukGaji));
    }
  }, [ongkirConfig]);

  useEffect(() => {
    if (absenConfig) {
      setLocalNominalDenda(absenConfig.nominalDenda ?? 1500);
      setLocalWaktuToleransi(absenConfig.waktuToleransi ?? 15);
      setLocalDurasiWaktuPotongan(absenConfig.durasiWaktuPotongan ?? 15);
      setLocalDendaTidakAbsenPulang(absenConfig.dendaTidakAbsenPulang ?? 40000);
      setLocalTanggalMulaiHitung(absenConfig.tanggalMulaiHitung ?? 1);
    }
  }, [absenConfig]);

  const isOwner = isOwnerProp ?? (userEmail?.toLowerCase().trim() === "owner@gmail.com");

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
      { key: "general" as const, label: "Umum", icon: <Settings size={15} />, color: "bg-zinc-500" },
      { key: "asisten" as const, label: "Asisten", icon: <Bot size={15} />, color: "bg-cyan-500" },
      { key: "gaji" as const, label: "Gaji Saya", icon: <Wallet size={15} />, color: "bg-emerald-500" },
      { key: "edit" as const, label: "Edit Rincian", icon: <FileText size={15} />, color: "bg-blue-500" },
      { key: "backup" as const, label: "Backup & Restore", icon: <Cloud size={15} />, color: "bg-green-500" },
      { key: "export" as const, label: "Export Data", icon: <Upload size={15} />, color: "bg-orange-500" },
      { key: "reset" as const, label: "Reset", icon: <Trash2 size={15} />, color: "bg-red-500" },
      { key: "sop" as const, label: "Panduan", icon: <ClipboardList size={15} />, color: "bg-teal-500" },
      { key: "info" as const, label: "Info", icon: <Info size={15} />, color: "bg-indigo-500" },
    ];
    if (!isOwner) {
      const filtered = allMenus.filter(m => !["asisten", "edit", "backup", "export", "reset"].includes(m.key));
      const infoItem = filtered.find(m => m.key === "info");
      const sopItem = filtered.find(m => m.key === "sop");
      const rest = filtered.filter(m => !["info", "sop"].includes(m.key));
      return [...rest, sopItem!, infoItem!];
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
      const emailTrimmed = userEmail.toLowerCase().trim();
      let latestDocData: any = { records: [] };
      let latestLogAbsensi: any[] = [];
      let latestUserDoc: any = {};

      const updateGajiKuState = (data: any, logs: any[], uDoc: any = latestUserDoc) => {
        let recs = Array.isArray(data.records) ? data.records : [];
        const cutoffDay = (typeof uDoc?.tanggalMulaiHitung === "number" && uDoc.tanggalMulaiHitung >= 1 && uDoc.tanggalMulaiHitung <= 31)
          ? uDoc.tanggalMulaiHitung
          : (Number(absenConfig?.tanggalMulaiHitung) || 1);

        // 1. Kalkulasi Ongkir Otomatis dari history pembukuan khusus untuk user ini
        const ongkirMap = new Map();
        history.forEach((h: any) => {
          if (!h.tanggal) return;
          const cycle = getAbsenCycleInfo(h.tanggal, cutoffDay);
          const bulanTahun = cycle.bulanTahun;

          if (Array.isArray(h.rowsSewa)) {
            h.rowsSewa.forEach((r: any) => {
              if (r.isOngkir === "YA" && r._ongkir && r.diantarOleh && r.diantarOleh.toLowerCase() === emailTrimmed) {
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

          if (Array.isArray(h.rowsHarian)) {
            h.rowsHarian.forEach((r: any) => {
              if (r._ongkir && r.diantarOleh && r.diantarOleh.toLowerCase() === emailTrimmed) {
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

        // 1.5. Kalkulasi Keterlambatan Otomatis dari log_absensi
        const latePenaltyMap = new Map<string, number>();
        const latePenaltyItemsMap = new Map<string, any[]>();
        const toleransiCfg = absenConfig?.waktuToleransi ?? 15;
        const durasiBlokCfg = absenConfig?.durasiWaktuPotongan ?? 15;
        const nominalDendaCfg = absenConfig?.nominalDenda ?? 1500;

        logs.forEach((l: any) => {
          if (l.jenisAbsen === "Masuk" && l.email && l.email.toLowerCase().trim() === emailTrimmed && l.tanggal) {
            const cycle = getAbsenCycleInfo(l.tanggal, cutoffDay);
            const bulanTahun = cycle.bulanTahun;
            const key = bulanTahun;

            let denda = 0;
            let lateM = 0;
            let effLate = 0;

            if (typeof l.denda === "number" && typeof l.lateMinutes === "number") {
              denda = l.denda;
              lateM = l.lateMinutes;
              effLate = l.effectiveLate || Math.max(0, lateM - (l.toleransi ?? toleransiCfg));
            } else if (l.waktu) {
              const timePart = l.waktu.split(" - ")[0];
              const [jam, menit] = timePart.split(":").map(Number);
              const waktuAbsenMinutes = (jam || 0) * 60 + (menit || 0);
              const shiftStr = String(l.shift || "").toLowerCase();
              const shiftStartMinutes = shiftStr.includes("sore") ? 15 * 60 : 10 * 60;
              lateM = Math.max(0, waktuAbsenMinutes - shiftStartMinutes);

              if (lateM > toleransiCfg) {
                effLate = lateM - toleransiCfg;
                const blockDenda = Math.ceil(effLate / durasiBlokCfg);
                denda = blockDenda * nominalDendaCfg;
              }
            }

            if (denda > 0) {
              latePenaltyMap.set(key, (latePenaltyMap.get(key) || 0) + denda);

              const timeDisplay = l.waktu ? l.waktu.split(" - ")[0] : "";
              const shiftDisplay = l.shift || "Shift Pagi";
              const idempKey = `lateCheckin_${emailTrimmed}_${l.tanggal}_${shiftDisplay.replace(/\s+/g, '')}`;

              const item = {
                id: l.id || `late_${l.tanggal}_${emailTrimmed}`,
                nominal: denda,
                ket: `[Auto-Sistem] Telat absen masuk (${timeDisplay}) - Telat ${lateM}m (efektif ${effLate}m). Shift: ${shiftDisplay}`,
                photoUrl: l.photoUrl || null,
                dateStr: l.timestamp || new Date().toISOString(),
                _isAutoSistem: true,
                _idempKey: idempKey,
                _lateMinutes: lateM,
                _effectiveLate: effLate,
                _shift: shiftDisplay,
                _waktuAbsen: l.waktu,
                _tanggalAbsen: l.tanggal,
                isDibatalkan: false
              };

              if (!latePenaltyItemsMap.has(key)) {
                latePenaltyItemsMap.set(key, []);
              }
              const existingList = latePenaltyItemsMap.get(key)!;
              if (!existingList.some(x => x._idempKey === idempKey)) {
                existingList.push(item);
              }
            }
          }
        });

        // 2. Kalkulasi Denda Tidak Absen Pulang
        const penaltyMap = new Map();
        const todayNorm = normalizeDateStr(new Date().toISOString().slice(0, 10));

        logs.forEach((l: any) => {
          if (l.jenisAbsen === "Masuk" && l.email && l.email.toLowerCase().trim() === emailTrimmed && l.tanggal) {
            const normLogTgl = normalizeDateStr(l.tanggal);
            if (normLogTgl >= todayNorm) return; // Skip today's active shift

            const sameDayPulang = logs.find((o: any) => o.email?.toLowerCase().trim() === emailTrimmed && normalizeDateStr(o.tanggal) === normLogTgl && o.jenisAbsen === "Pulang");
            if (!sameDayPulang) {
              const cycle = getAbsenCycleInfo(l.tanggal, cutoffDay);
              const bulanTahun = cycle.bulanTahun;
              const key = bulanTahun;
              const nominalDendaPulang = absenConfig?.dendaTidakAbsenPulang ?? 40000;

              penaltyMap.set(key, (penaltyMap.get(key) || 0) + nominalDendaPulang);

              const shiftDisplay = l.shift || "Shift";
              const idempKey = `missedCheckout_${emailTrimmed}_${normLogTgl}`;
              const item = {
                id: `missed_checkout_${normLogTgl}_${emailTrimmed}`,
                nominal: nominalDendaPulang,
                ket: `[Auto-Sistem] Tidak Absen Pulang (Tgl ${l.tanggal || normLogTgl}). Shift: ${shiftDisplay}`,
                photoUrl: null,
                dateStr: l.timestamp || new Date().toISOString(),
                _isAutoSistem: true,
                _isDendaPulang: true,
                _idempKey: idempKey,
                _tanggalAbsen: l.tanggal || normLogTgl,
                isDibatalkan: false
              };

              if (!latePenaltyItemsMap.has(key)) {
                latePenaltyItemsMap.set(key, []);
              }
              const existingList = latePenaltyItemsMap.get(key)!;
              if (!existingList.some((x: any) => x._idempKey === idempKey)) {
                existingList.push(item);
              }
            }
          }
        });

        // Populate to records
        recs.forEach((r: any) => {
          r.bulanTahun = normalizeBulanTahun(r.bulanTahun);
          const key = r.bulanTahun;
          r.ongkirBulanIni = ongkirMap.get(key) || 0;
          r.ongkirMasukGajiBulanIni = typeof ongkirConfig?.masukGaji === "boolean" ? (ongkirConfig.masukGaji ? r.ongkirBulanIni : 0) : r.ongkirBulanIni;
          r.dendaAbsen = penaltyMap.get(key) || 0;
          r.dendaTelat = latePenaltyMap.get(key) || 0;

          // Merge late penalty items into r.gajiPengurangan
          const lateItems = latePenaltyItemsMap.get(key) || [];
          let currentPg = Array.isArray(r.gajiPengurangan) ? [...r.gajiPengurangan] : [];
          
          lateItems.forEach(lateItem => {
            const existingIdx = currentPg.findIndex((x: any) => 
              x._idempKey === lateItem._idempKey || 
              (x._isAutoSistem && x.ket && x.ket.includes(lateItem._tanggalAbsen || ""))
            );
            if (existingIdx >= 0) {
              currentPg[existingIdx] = {
                ...lateItem,
                ...currentPg[existingIdx],
                isDibatalkan: Boolean(currentPg[existingIdx].isDibatalkan),
                nominal: currentPg[existingIdx].nominal !== undefined ? currentPg[existingIdx].nominal : lateItem.nominal,
                photoUrl: currentPg[existingIdx].photoUrl || lateItem.photoUrl
              };
            } else {
              currentPg.push({
                ...lateItem,
                isDibatalkan: false
              });
            }
          });
          r.gajiPengurangan = currentPg;

          ongkirMap.delete(key);
          penaltyMap.delete(key);
          latePenaltyMap.delete(key);
          latePenaltyItemsMap.delete(key);
        });

        // If remaining months have auto penalties or ongkir
        const existingMonths = new Set(recs.map((r: any) => normalizeBulanTahun(r.bulanTahun)));

        const allRemainingKeys = new Set([
          ...Array.from(ongkirMap.keys()),
          ...Array.from(latePenaltyMap.keys()),
          ...Array.from(penaltyMap.keys())
        ]);

        allRemainingKeys.forEach(key => {
          const normKey = normalizeBulanTahun(key);
          if (existingMonths.has(normKey)) {
            ongkirMap.delete(key);
            penaltyMap.delete(key);
            latePenaltyMap.delete(key);
            latePenaltyItemsMap.delete(key);
            return;
          }
          existingMonths.add(normKey);

          const valOngkir = ongkirMap.get(key) || 0;
          const valLate = latePenaltyMap.get(key) || 0;
          const valPenalty = penaltyMap.get(key) || 0;
          const lateItems = (latePenaltyItemsMap.get(key) || []).map(li => ({ ...li, isDibatalkan: false }));
          const valMasukGaji = typeof ongkirConfig?.masukGaji === "boolean" ? (ongkirConfig.masukGaji ? valOngkir : 0) : valOngkir;

          recs.push({
            id: `auto-rec-${normKey}`,
            bulanTahun: normKey,
            gajiPokok: 1500000,
            gajiTambahan: [],
            gajiPengurangan: [...lateItems],
            buktiTransfer: "",
            ongkirBulanIni: valOngkir,
            ongkirMasukGajiBulanIni: valMasukGaji,
            dendaAbsen: valPenalty,
            dendaTelat: valLate,
            isAutoGenerated: true
          });
          ongkirMap.delete(key);
          penaltyMap.delete(key);
          latePenaltyMap.delete(key);
          latePenaltyItemsMap.delete(key);
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
        setGajiKu({ ...data });
      };

      const unsubUser = onSnapshot(doc(db, "users", emailTrimmed), userSnap => {
        latestUserDoc = userSnap.exists() ? userSnap.data() : {};
        updateGajiKuState(latestDocData, latestLogAbsensi, latestUserDoc);
      });

      const unsubGaji = onSnapshot(doc(db, "gaji_pegawai", emailTrimmed), docSnap => {
        latestDocData = docSnap.exists() ? docSnap.data() : { records: [] };
        updateGajiKuState(latestDocData, latestLogAbsensi, latestUserDoc);
      });

      const unsubLogs = onSnapshot(collection(db, "log_absensi"), snap => {
        latestLogAbsensi = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateGajiKuState(latestDocData, latestLogAbsensi, latestUserDoc);
      });

      return () => {
        unsubUser();
        unsubGaji();
        unsubLogs();
      };
    }
  }, [open, userEmail, isOwner, history, absenConfig]);

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
                <div 
                  className="w-24 h-24 rounded-full overflow-hidden shadow-inner flex items-center justify-center relative border-4 transition-colors" 
                  style={{ borderColor: userProfileColor || '#3b82f6', backgroundColor: userProfilePic ? undefined : (userProfileColor || '#3b82f6') }}
                >
                  {userProfilePic ? (
                    <img src={userProfilePic} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-white text-2xl uppercase tracking-wider select-none">
                      {(userEmail?.split('@')[0] || "U").substring(0, 2).toUpperCase()}
                    </span>
                  )}
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
              label="Keluar (Logout)" icon={<LogOut size={16} />} iconColor="bg-red-500" destructive isLast
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
                const totalPotongan = gajiKu.records.reduce((acc: any, r: any) => acc + (r.gajiPengurangan?.filter((p: any) => !p.isDibatalkan).reduce((sum: number, p: any) => sum + (Number(p.nominal) || 0), 0) || 0), 0);
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
                        const tPotongan = pgArr.filter((p: any) => !p.isDibatalkan).reduce((sum: number, p: any) => sum + (Number(p.nominal) || 0), 0);
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
                                <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
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
                                 {pgArr.map((pg: any, i: number) => {
                                   const isCanceled = Boolean(pg.isDibatalkan);
                                   if (Number(pg.nominal) <= 0) return null;
                                   return (
                                     <div key={`pg-${i}`} className={`flex justify-between items-center py-1.5 ${isCanceled ? 'opacity-60' : ''}`}>
                                       <div className="flex flex-col gap-0.5">
                                         <div className="flex items-center gap-1.5 flex-wrap">
                                           <span className={`text-[12px] font-bold ${isCanceled ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-red-500'}`}>
                                             Pengurangan: -Rp {Number(pg.nominal).toLocaleString("id-ID")}
                                           </span>
                                           {pg._isAutoSistem && (
                                             <span className="text-[8px] font-extrabold uppercase tracking-wider text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-1.5 py-0.5 rounded">⚡ Auto</span>
                                           )}
                                           {isCanceled && (
                                             <span className="text-[8px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                               Dicoret Owner (Tidak Memotong Gaji)
                                             </span>
                                           )}
                                         </div>
                                         {pg.photoUrl && (
                                           <a href={pg.photoUrl} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-0.5 font-semibold">
                                             📷 Lihat Bukti Foto
                                           </a>
                                         )}
                                       </div>
                                       <span className={`text-right text-[11px] font-medium max-w-[150px] italic ${isCanceled ? 'line-through text-zinc-400 dark:text-zinc-600' : 'text-zinc-500'}`}>
                                         "{pg.ket || "-"}"
                                       </span>
                                     </div>
                                   );
                                 })}

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
                    { value: "Lama", label: "Klasik", icon: <FileText size={14} /> },
                    { value: "Baru", label: "Kartu", icon: <CreditCard size={14} /> },
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
                      { value: "Tinggi", label: "HD", icon: <Sparkles size={14} /> },
                      { value: "Hemat", label: "Low", icon: <Zap size={14} /> },
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
                    onMouseUp={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setOngkirConfig && setOngkirConfig({ pegawaiPersen: val, masukGaji: localMasukGaji }));
                    }}
                    onTouchEnd={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setOngkirConfig && setOngkirConfig({ pegawaiPersen: val, masukGaji: localMasukGaji }));
                    }}
                    className="w-full ios-slider cursor-pointer"
                  />
                </div>
              </div>
              <div
                className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
                onClick={() => {
                  const nextVal = !localMasukGaji;
                  setLocalMasukGaji(nextVal);
                  runOrAlert(() => setOngkirConfig && setOngkirConfig({ pegawaiPersen: localPegawaiPersen, masukGaji: nextVal }));
                }}
              >
                <div className="space-y-0.5">
                  <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">Masuk Total Gaji</div>
                  <div className="text-xs text-zinc-500">Otomatis tambahkan porsi pegawai ke "Gaji Yang Harus Ditransfer"</div>
                </div>
                <div className={`w-12 h-7 rounded-full transition-colors flex items-center px-[3px] ${localMasukGaji ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${localMasukGaji ? 'translate-x-[20px]' : 'translate-x-0'}`}></div>
                </div>
              </div>
            </IOSGroup>
          )}

          {isOwner && (
            <IOSGroup title="Potongan Gaji Absen (Keterlambatan)">
              <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-700/50">
                <div className="space-y-0.5">
                  <div className="text-[16px] font-medium text-zinc-900 dark:text-zinc-100">Tanggal Mulai Hitung Absensi (Cutoff)</div>
                  <div className="text-xs text-zinc-500">Siklus 1 bulan absensi & potongan denda dihitung dari tanggal ini</div>
                </div>
                <select
                  value={localTanggalMulaiHitung}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setLocalTanggalMulaiHitung(val);
                    runOrAlert(() => setAbsenConfig && setAbsenConfig({
                      nominalDenda: localNominalDenda,
                      waktuToleransi: localWaktuToleransi,
                      durasiWaktuPotongan: localDurasiWaktuPotongan,
                      dendaTidakAbsenPulang: localDendaTidakAbsenPulang,
                      tanggalMulaiHitung: val
                    }));
                  }}
                  className="bg-white dark:bg-[#2C2C2E] border border-blue-300 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 font-black text-sm rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer self-start sm:self-auto"
                >
                  <option value={1}>Tgl 1 (Awal Bulan Normal)</option>
                  {Array.from({ length: 30 }, (_, i) => i + 2).map((tgl) => (
                    <option key={tgl} value={tgl}>
                      Tanggal {tgl}
                    </option>
                  ))}
                </select>
              </div>
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
                    onMouseUp={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setAbsenConfig && setAbsenConfig({
                        nominalDenda: val,
                        waktuToleransi: localWaktuToleransi,
                        durasiWaktuPotongan: localDurasiWaktuPotongan,
                        dendaTidakAbsenPulang: localDendaTidakAbsenPulang
                      }));
                    }}
                    onTouchEnd={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setAbsenConfig && setAbsenConfig({
                        nominalDenda: val,
                        waktuToleransi: localWaktuToleransi,
                        durasiWaktuPotongan: localDurasiWaktuPotongan,
                        dendaTidakAbsenPulang: localDendaTidakAbsenPulang
                      }));
                    }}
                    className="w-full ios-slider cursor-pointer"
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
                    onMouseUp={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setAbsenConfig && setAbsenConfig({
                        nominalDenda: localNominalDenda,
                        waktuToleransi: val,
                        durasiWaktuPotongan: localDurasiWaktuPotongan,
                        dendaTidakAbsenPulang: localDendaTidakAbsenPulang
                      }));
                    }}
                    onTouchEnd={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setAbsenConfig && setAbsenConfig({
                        nominalDenda: localNominalDenda,
                        waktuToleransi: val,
                        durasiWaktuPotongan: localDurasiWaktuPotongan,
                        dendaTidakAbsenPulang: localDendaTidakAbsenPulang
                      }));
                    }}
                    className="w-full ios-slider cursor-pointer"
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
                    onMouseUp={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setAbsenConfig && setAbsenConfig({
                        nominalDenda: localNominalDenda,
                        waktuToleransi: localWaktuToleransi,
                        durasiWaktuPotongan: val,
                        dendaTidakAbsenPulang: localDendaTidakAbsenPulang
                      }));
                    }}
                    onTouchEnd={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setAbsenConfig && setAbsenConfig({
                        nominalDenda: localNominalDenda,
                        waktuToleransi: localWaktuToleransi,
                        durasiWaktuPotongan: val,
                        dendaTidakAbsenPulang: localDendaTidakAbsenPulang
                      }));
                    }}
                    className="w-full ios-slider cursor-pointer"
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
                    onMouseUp={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setAbsenConfig && setAbsenConfig({
                        nominalDenda: localNominalDenda,
                        waktuToleransi: localWaktuToleransi,
                        durasiWaktuPotongan: localDurasiWaktuPotongan,
                        dendaTidakAbsenPulang: val
                      }));
                    }}
                    onTouchEnd={(e) => {
                      const val = Number(e.currentTarget.value);
                      runOrAlert(() => setAbsenConfig && setAbsenConfig({
                        nominalDenda: localNominalDenda,
                        waktuToleransi: localWaktuToleransi,
                        durasiWaktuPotongan: localDurasiWaktuPotongan,
                        dendaTidakAbsenPulang: val
                      }));
                    }}
                    className="w-full ios-slider cursor-pointer"
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
            <IOSRow label="Pemasukan Harian" value={`${sHarian.count} Item`} icon={<Gamepad2 size={16} />} iconColor="bg-blue-500" onClick={() => openEditModal(onOpenEditHarian)} />
            <IOSRow label="Jajanan" value={`${sJajanan.count} Item`} icon={<Coffee size={16} />} iconColor="bg-orange-500" onClick={() => openEditModal(onOpenEditJajanan)} />
            <IOSRow label="Jasa & Aksesoris" value={`${sJasa.count} Item`} icon={<Wrench size={16} />} iconColor="bg-slate-500" onClick={() => openEditModal(onOpenEditJasaAks)} />
            <IOSRow label="Sewa PS" value={`${sSewa.count} Item`} icon={<Truck size={16} />} iconColor="bg-green-500" isLast onClick={() => openEditModal(onOpenEditSewa)} />
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
            <IOSRow label="Backup Data ke File" icon={<Save size={16} />} iconColor="bg-blue-500" onClick={() => triggerSecurity("backup")} />
            <IOSRow label="Restore dari File" icon={<FolderOpen size={16} />} iconColor="bg-green-500" isLast onClick={() => triggerSecurity("restore")} />
          </IOSGroup>
        </div>
      )}

      {tab === "export" && (
        <IOSGroup title="Laporan">
          <IOSRow label="Download Laporan CSV" icon={<FileSpreadsheet size={16} />} iconColor="bg-indigo-500" isLast onClick={() => runOrAlert(onExportCSV)} />
        </IOSGroup>
      )}

      {tab === "reset" && (
        <IOSGroup title="Zona Bahaya">
          <IOSRow
            label="Reset Semua Pengaturan" icon={<Trash2 size={16} />} iconColor="bg-red-500" destructive isLast
            onClick={() => triggerSecurity("reset")}
          />
        </IOSGroup>
      )}

      {tab === "sop" && (
        <div className="space-y-5">
          <IOSGroup title="Panduan & SOP Pembukuan">
            <div className="p-4 space-y-3">
              {/* Card 0: SOP Sewa */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 0 ? null : 0)}
                >
                  <span className="font-bold text-[14px] text-zinc-800 dark:text-zinc-100">SOP SEWA PLAYSTATION (URBAN)</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${sopExpanded === 0 ? 'rotate-180' : ''}`} />
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
                        <Download size={14} />
                        Download SOP ini
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 1: PS3 CFW */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 1 ? null : 1)}
                >
                  <span className="font-bold text-[14px] text-zinc-800 dark:text-zinc-100">CARA ISI GAME PS3 CFW</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${sopExpanded === 1 ? 'rotate-180' : ''}`} />
                </div>
                {sopExpanded === 1 && (
                  <div className="p-4 bg-white dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div>
                      <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase mb-1">A. Format PKG (Instal via XMB)</h4>
                      <ul className="list-decimal pl-5 space-y-1 text-[13px] text-zinc-600 dark:text-zinc-300">
                        <li>Pastikan USB Flashdisk / Hardisk Eksternal diformat ke file sistem <b>FAT32</b>.</li>
                        <li>Copy/salin file game berformat <code>.pkg</code> ke direktori terluar (root) USB Flashdisk.</li>
                        <li>Colokkan USB ke port USB PS3.</li>
                        <li>Di menu utama XMB PS3, masuk ke menu <b>Package Manager</b> &gt; <b>Install Package Files</b> &gt; <b>Standard</b>.</li>
                        <li>Pilih file game <code>.pkg</code> dan tunggu proses instalasi selesai. Jika game memiliki beberapa part, instal berurutan (Part 1, Part 2, dst).</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase mb-1">B. Format Folder (Copy via MultiMan)</h4>
                      <ul className="list-decimal pl-5 space-y-1 text-[13px] text-zinc-600 dark:text-zinc-300">
                        <li>Siapkan USB Flashdisk / Hardisk Eksternal berisi folder game (berisi folder <code>PS3_GAME</code> di dalamnya).</li>
                        <li>Hubungkan USB ke PS3, lalu buka aplikasi <b>MultiMan</b>.</li>
                        <li>Masuk ke menu <b>mmOS (File Manager)</b> &gt; buka <b>PS3 Root</b> &gt; double click di <b>dev_usb000</b> atau <b>dev_usb001</b>.</li>
                        <li>Arahkan stik ke folder game, tekan tombol <b>O (Lingkar)</b>, lalu pilih <b>Copy</b>.</li>
                        <li>Buka jendela baru: double click <b>PS3 Root</b> &gt; <b>dev_hdd0</b> &gt; masuk ke folder <b>GAMES</b>.</li>
                        <li>Tekan tombol <b>O (Lingkar)</b> di area kosong dalam folder GAMES, lalu pilih <b>Paste</b>.</li>
                        <li>Setelah selesai memindahkan, keluar ke menu game MultiMan, lalu tekan <b>L1</b> untuk me-refresh daftar game.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 2: PS3 HEN */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 2 ? null : 2)}
                >
                  <span className="font-bold text-[14px] text-zinc-800 dark:text-zinc-100">CARA ISI GAME PS3 HEN</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${sopExpanded === 2 ? 'rotate-180' : ''}`} />
                </div>
                {sopExpanded === 2 && (
                  <div className="p-4 bg-white dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950/40 p-3 rounded-xl flex gap-2.5">
                      <Info className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-red-800 dark:text-red-300">
                        <b>PENTING:</b> Sebelum melakukan instalasi game PKG atau menyalin folder via MultiMan, Anda <b>wajib mengaktifkan HEN terlebih dahulu</b>.
                      </span>
                    </div>
                    <ul className="list-decimal pl-5 space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
                      <li>Di menu utama XMB PS3, navigasikan ke kolom Game, lalu pilih menu <b>Enable HEN</b>. Tunggu hingga proses exploit sukses.</li>
                      <li>Jika HEN tidak aktif, aplikasi homebrew (seperti MultiMan, WebMan, Package Manager) akan <b>hang/crash / menyebabkan PS3 mati otomatis</b>.</li>
                      <li><b>Proses Pengisian Game:</b> Setelah HEN dalam keadaan aktif, Anda dapat mengikuti metode pengisian format <b>PKG</b> maupun format <b>Folder (MultiMan)</b> yang sama persis seperti pada panduan <b>PS3 CFW</b>.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Card 3: PS4 HEN */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 3 ? null : 3)}
                >
                  <span className="font-bold text-[14px] text-zinc-800 dark:text-zinc-100">CARA ISI GAME PS4 HEN</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${sopExpanded === 3 ? 'rotate-180' : ''}`} />
                </div>
                {sopExpanded === 3 && (
                  <div className="p-4 bg-white dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <ul className="list-decimal pl-5 space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
                      <li>Pastikan PS4 sudah dalam kondisi jailbreak/explot aktif (GoldHEN/HEN aktif di dashboard).</li>
                      <li>Siapkan USB Flashdisk / Hardisk Eksternal dengan format file sistem <b>exFAT</b> (format FAT32 tidak didukung karena file game PS4 biasanya berukuran &gt;4GB).</li>
                      <li>Copy file game berformat <code>.pkg</code> ke direktori terluar (root) USB Flashdisk.</li>
                      <li>Hubungkan USB Flashdisk ke salah satu port USB di PS4.</li>
                      <li>Masuk ke menu <b>Settings</b> di PS4 &gt; scroll ke paling bawah dan buka menu <b>Debug Settings</b> (atau menu <b>GoldHEN</b>).</li>
                      <li>Pilih menu <b>Game</b> &gt; <b>Package Installer</b>.</li>
                      <li>Pilih file game <code>.pkg</code> yang ingin diinstal.
                        <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 italic font-semibold">
                          *Tips: Selalu instal file "Base Game" terlebih dahulu, diikuti dengan file "Update", kemudian file "DLC" (jika ada).
                        </div>
                      </li>
                      <li>Tunggu hingga proses instalasi di dashboard selesai. Ikon game akan muncul di halaman depan PS4 dan siap dimainkan.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Card 4: Hardisk External PNP PS4 */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 4 ? null : 4)}
                >
                  <span className="font-bold text-[14px] text-zinc-800 dark:text-zinc-100">CARA MEMBUAT HDD EXTERNAL PNP PS4</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${sopExpanded === 4 ? 'rotate-180' : ''}`} />
                </div>
                {sopExpanded === 4 && (
                  <div className="p-4 bg-white dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-950/40 p-3 rounded-xl flex gap-2.5">
                      <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-blue-800 dark:text-blue-300">
                        <span className="font-bold">Apa itu HDD External PNP (Plug and Play) PS4?</span>
                        <p className="mt-1">
                          Hardisk External PNP adalah media penyimpanan luar (USB 3.0) yang diformat khusus agar dapat langsung terdeteksi di PS4. Ada 2 tipe PNP:
                        </p>
                        <ul className="list-disc pl-4 mt-1.5 space-y-1">
                          <li><b>Tipe exFAT (Untuk Installer Game):</b> Bisa dibaca di PC/Laptop dan PS4. Berguna untuk memindahkan file game <code>.pkg</code> dari PC ke PS4 untuk diinstal.</li>
                          <li><b>Tipe Extended Storage (Untuk Langsung Main):</b> Diformat langsung oleh PS4. Game diinstal dan dimainkan langsung dari HDD eksternal ini, menghemat memori internal PS4 (tidak bisa dibaca di PC).</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase mb-1">A. Pembuatan Tipe exFAT (Untuk Copy & Install PKG)</h4>
                      <ul className="list-decimal pl-5 space-y-1.5 text-[13px] text-zinc-600 dark:text-zinc-300">
                        <li>Hubungkan Hardisk Eksternal ke PC / Laptop Windows menggunakan port USB 3.0.</li>
                        <li>Buka <b>This PC</b> / <b>File Explorer</b> &gt; klik kanan pada drive Hardisk Eksternal tersebut, lalu pilih <b>Format...</b></li>
                        <li>Pada bagian <b>File System</b>, ubah nilainya menjadi <b>exFAT</b> (jangan pilih NTFS atau FAT32).</li>
                        <li>Pada bagian <b>Allocation Unit Size</b>, biarkan default, beri nama drive pada <i>Volume Label</i> (misal: "PS4-GAME"), centang <b>Quick Format</b>, lalu klik <b>Start</b>.</li>
                        <li>Setelah selesai format, buat folder atau langsung copy file game berformat <code>.pkg</code> ke direktori terluar (root) hardisk tersebut.</li>
                        <li>Eject hardisk dengan aman dari PC, lalu colokkan ke port USB PS4 HEN untuk mulai instalasi lewat <i>Package Installer</i>.</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase mb-1">B. Pembuatan Tipe Extended Storage (Untuk Simpan & Main Langsung)</h4>
                      <ul className="list-decimal pl-5 space-y-1.5 text-[13px] text-zinc-600 dark:text-zinc-300">
                        <li>Pastikan Hardisk Eksternal mendukung minimal <b>USB 3.0</b> dengan kapasitas antara <b>250 GB - 8 TB</b>.</li>
                        <li>Hubungkan Hardisk Eksternal ke salah satu port USB di konsol PS4 Anda.</li>
                        <li>Di PS4, masuk ke menu <b>Settings</b> &gt; <b>Devices</b> &gt; <b>USB Storage Devices</b>.</li>
                        <li>Pilih nama Hardisk Eksternal Anda, lalu pilih opsi <b>Format as Extended Storage</b>.</li>
                        <li>Ikuti petunjuk di layar dan pilih <b>Next</b> lalu <b>Format</b>. Setelah selesai, hardisk Anda akan menjadi penyimpanan default baru untuk instalasi game.</li>
                        <li><span className="font-semibold text-amber-600 dark:text-amber-400">*Catatan:</span> Ketika Anda menginstal game <code>.pkg</code> via <i>Package Installer</i>, game tersebut akan otomatis terpasang dan berjalan langsung dari Hardisk Eksternal ini.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 5: Pengertian CFW, HEN, ODE, Matrix */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 5 ? null : 5)}
                >
                  <span className="font-bold text-[14px] text-zinc-800 dark:text-zinc-100">PENGERTIAN CFW, HEN, ODE, & MATRIX</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${sopExpanded === 5 ? 'rotate-180' : ''}`} />
                </div>
                {sopExpanded === 5 && (
                  <div className="p-4 bg-white dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="text-xs text-zinc-500 leading-relaxed">
                      Berikut adalah istilah modifikasi/jailbreak yang umum digunakan pada konsol PlayStation (PS2, PS3, dan PS4):
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase">1. CFW (Custom Firmware)</h4>
                        <p className="text-[13px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                          Sistem operasi (firmware) konsol yang sudah dimodifikasi secara permanen agar bisa menjalankan homebrew dan game bajakan langsung dari HDD.
                          <br /><b>Kelebihan:</b> Permanen (tidak perlu diaktifkan ulang setelah PS dimatikan), fitur sangat lengkap (control fan, temperatur, dll).
                          <br /><b>Penerapan:</b> Hanya tersedia di <b>PS3</b> tipe Fat dan Slim seri tertentu (seri 20xx/21xx/25xx dengan minver down 3.56). Di PS4 tidak ada istilah CFW murni.
                        </p>
                      </div>

                      <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                        <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase">2. HEN (Homebrew Enabler)</h4>
                        <p className="text-[13px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                          Jailbreak berbasis software (aplikasi/browser exploit) yang bersifat non-permanen. Fitur jailbreak hanya aktif selama konsol menyala.
                          <br /><b>Karakteristik:</b> Setiap kali konsol dinyalakan atau di-restart, Anda <b>wajib mengaktifkan HEN terlebih dahulu</b> (klik ikon "Enable HEN" di PS3 atau buka exploit via browser/PPPwn di PS4). Jika tidak, game bajakan tidak akan bisa dibuka.
                          <br /><b>Penerapan:</b> Digunakan pada <b>PS3</b> Slim seri akhir (30xx) / Super Slim (40xx) yang tidak bisa dipasang CFW, serta semua jenis exploit di <b>PS4</b> (GoldHEN).
                        </p>
                      </div>

                      <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                        <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase">3. ODE (Optical Drive Emulator)</h4>
                        <p className="text-[13px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                          Modifikasi berbasis hardware (perangkat keras tambahan berupa chip emulasi) yang dipasang untuk memanipulasi pembacaan Bluray Drive agar konsol membaca game dari hardisk eksternal.
                          <br /><b>Karakteristik:</b> Sangat populer dulu untuk membobol PS3 seri Super Slim sebelum HEN ditemukan. Saat ini sudah jarang digunakan karena HEN gratis dan lebih praktis.
                          <br /><b>Penerapan:</b> Umumnya dipasang di <b>PS3</b> Fat/Slim/Super Slim.
                        </p>
                      </div>

                      <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                        <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase">4. MATRIX (Modchip PS2)</h4>
                        <p className="text-[13px] text-zinc-600 dark:text-zinc-300 mt-0.5">
                          Modchip (IC tambahan) yang disolder pada motherboard PS2 untuk membypass proteksi region lock dan membolehkan pembacaan kaset bajakan.
                          <br /><b>Penerapan di Hardisk:</b> Di rental/toko Indonesia, "PS2 Matrix" berarti PS2 yang dipasang chip Matrix v5.0 (atau sejenis) agar saat dinyalakan langsung otomatis melakukan boot ke <b>Open PS2 Loader (OPL)</b> dari hardisk eksternal/internal tanpa memerlukan MC Boot (memory card exploit).
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 6: Cara HEN BD-JB PS4 */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 6 ? null : 6)}
                >
                  <span className="font-bold text-[14px] text-zinc-800 dark:text-zinc-100">CARA HEN BD-JB PS4 (FW 9.00 - 11.00+)</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${sopExpanded === 6 ? 'rotate-180' : ''}`} />
                </div>
                {sopExpanded === 6 && (
                  <div className="p-4 bg-white dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-950/40 p-3 rounded-xl flex gap-2.5">
                      <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800 dark:text-amber-300">
                        <span className="font-semibold">Informasi Awal (Asumsi Sudah Memiliki Kaset BD-JB):</span>
                        <p className="mt-1">
                          Panduan ini ditujukan bagi Anda yang sudah memiliki kaset Blu-ray Disc khusus exploit BD-JB (biasanya dibeli pre-burn/siap pakai di toko online). Anda tidak perlu melakukan burning disc lagi di PC.
                        </p>
                      </div>
                    </div>

                    <ul className="list-decimal pl-5 space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
                      <li>
                        <b>Persiapan USB Payload:</b>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          <li>Siapkan USB Flashdisk kosong, format ke sistem file <b>FAT32</b> atau <b>exFAT</b>.</li>
                          <li>Download file payload GoldHEN terbaru (biasanya berupa file <code>goldhen.bin</code>).</li>
                          <li>Copy/salin file <code>goldhen.bin</code> tersebut ke direktori terluar (root) USB Flashdisk.</li>
                        </ul>
                      </li>
                      <li>Colokkan USB Flashdisk berisi payload <code>goldhen.bin</code> ke salah satu port USB pada PS4 Anda.</li>
                      <li>Nyalakan konsol PS4 Anda, lalu masukkan kaset Blu-ray <b>BD-JB Exploit</b> ke dalam disc drive PS4.</li>
                      <li>Buka pemutar Blu-ray (disc player) dari dashboard menu utama PS4 untuk memutar disc tersebut.</li>
                      <li>Tunggu beberapa saat. Program Java di dalam kaset akan berjalan otomatis, memicu kernel exploit, dan mencari file <code>goldhen.bin</code> pada USB Flashdisk Anda.</li>
                      <li>Setelah exploit berhasil dipicu, notifikasi **"GoldHEN Loaded / Exploit Success"** akan muncul di pojok kiri atas layar.</li>
                      <li><b>Selesai!</b> Keluarkan kaset BD-JB dan cabut USB Flashdisk Anda. Game bajakan sekarang sudah aktif dan siap dimainkan.</li>
                      <li><span className="font-semibold text-amber-600 dark:text-amber-400">*Tips Rental:</span> Agar tidak perlu memancing ulang exploit setiap kali PS4 dinyalakan, gunakan fitur <b>Rest Mode</b> (Mode Istirahat) saat mematikan PS4. Selama konsol tidak mati total, status HEN akan tetap aktif.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Card 7: Cara Install HEN di PS3 */}
              <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                <div
                  className="p-3 bg-zinc-50 dark:bg-zinc-800/50 flex justify-between items-center cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 7 ? null : 7)}
                >
                  <span className="font-bold text-[14px] text-zinc-800 dark:text-zinc-100">CARA INSTALL HEN DI PS3 (FW 4.90 / 4.91 HFW)</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${sopExpanded === 7 ? 'rotate-180' : ''}`} />
                </div>
                {sopExpanded === 7 && (
                  <div className="p-4 bg-white dark:bg-black/20 border-t border-zinc-200 dark:border-zinc-700 animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-950/40 p-3 rounded-xl flex gap-2.5">
                      <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                      <span className="text-xs text-blue-800 dark:text-blue-300">
                        <b>Catatan:</b> Proses instalasi HEN terbagi menjadi 2 tahap besar, yaitu <b>install Hybrid Firmware (HFW)</b> terlebih dahulu lewat USB flashdisk, kemudian mengaktifkan <b>explot HEN via Browser internet PS3</b>.
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase mb-1">Tahap 1: Instalasi Hybrid Firmware (HFW)</h4>
                      <ul className="list-decimal pl-5 space-y-1.5 text-[13px] text-zinc-600 dark:text-zinc-300">
                        <li>Siapkan USB Flashdisk (format ke <b>FAT32</b>).</li>
                        <li>Download file HFW yang sesuai dengan versi sistem Anda (misal: 4.91 HFW).</li>
                        <li>Di dalam flashdisk, buat struktur folder: <code>PS3</code> &gt; <code>UPDATE</code> (gunakan huruf kapital).</li>
                        <li>Copy/salin file HFW ke dalam folder <code>UPDATE</code> dan ubah nama filenya menjadi <code>PS3UPDAT.PUP</code>.</li>
                        <li>Hubungkan USB Flashdisk ke port USB kanan PS3, masuk ke menu <b>Settings</b> &gt; <b>System Update</b> &gt; <b>Update via Storage Media</b>. Ikuti petunjuk untuk menyelesaikan update. *(Disarankan install HFW 2x berturut-turut agar instalasi bersih).*</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase mb-1">Tahap 2: Pemasangan PS3HEN via Web Browser</h4>
                      <ul className="list-decimal pl-5 space-y-1.5 text-[13px] text-zinc-600 dark:text-zinc-300">
                        <li>Hubungkan PS3 ke jaringan Internet yang stabil (Wi-Fi/LAN).</li>
                        <li>Buka aplikasi <b>Internet Browser</b> bawaan PS3.</li>
                        <li>Tekan tombol <b>Triangle (Segitiga)</b> &gt; masuk ke <b>Tools</b> &gt; bersihkan semua <b>Cookies, Search History, Cache, dan Authentication Info</b>.</li>
                        <li>Tekan <b>Start</b>, masukkan alamat situs exploit terpercaya (misal: <code>https://ps3xploit.me</code> atau <code>https://ps3addict.github.io/autohen</code>).</li>
                        <li>Pilih menu **PS3HEN** &gt; **HEN Auto Installer** (atau ikuti instruksi auto-installer di layar).</li>
                        <li>Klik tombol <b>Initialize HEN Installer</b>, lalu klik <b>Install HEN</b> setelah inisialisasi selesai.</li>
                        <li>Browser akan mendownload package dan menginstalnya otomatis. Setelah sukses 100%, keluar dari browser atau restart PS3 Anda.</li>
                        <li>Setelah restart, ikon <b>Enable HEN (Telur Emas)</b> akan muncul di menu Game XMB. Klik ikon tersebut setiap kali PS3 baru dinyalakan untuk mengaktifkan mode jailbreak.</li>
                      </ul>
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
            <div className="w-16 h-16 bg-zinc-900 dark:bg-zinc-800 rounded-[18px] mx-auto shadow-lg flex items-center justify-center text-white">
              <Gamepad2 size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">URBAN Console</h3>
              <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">Build v{versionData.version}</div>
            </div>
          </div>

          {/* 2. Content Wrapper (Scrollable Box) */}
          <IOSGroup title="Informasi & Panduan" className="mb-0">
            {/* Gunakan max-h yg pas supaya tidak overflow keluar dari tinggi modal fixed */}
            <div className="max-h-[380px] overflow-y-auto p-5 scrollbar-thin">
              {/* Tentang */}
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
                <Pin size={16} className="text-zinc-500 shrink-0" /> Tentang Aplikasi
              </h4>
              <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-300 mb-6">
                Aplikasi ini digunakan untuk mencatat transaksi, pemasukan, dan pengeluaran <b>URBAN PlayStation Lampung</b>. Aplikasi bersifat pribadi untuk kebutuhan internal.
              </p>

              {/* Panduan */}
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
                <BookOpen size={16} className="text-zinc-500 shrink-0" /> Panduan Singkat
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
                  <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-yellow-800 dark:text-yellow-200/80">
                    <b>Tips:</b> Jangan lupa lakukan backup data secara berkala agar catatan tidak hilang.
                  </span>
                </div>
              </div>

              {/* Kontak */}
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2 mb-2">
                <Phone size={16} className="text-zinc-500 shrink-0" /> Kontak
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
      <style dangerouslySetInnerHTML={{__html: `
        /* Custom iOS range inputs styling */
        input[type="range"].ios-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 9999px;
          background: #E5E5EA;
          outline: none;
          transition: background 0.2s ease;
        }
        .dark input[type="range"].ios-slider {
          background: #2C2C2E;
        }
        input[type="range"].ios-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 0.5px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0px 3px 8px rgba(0, 0, 0, 0.12), 0px 3px 1px rgba(0, 0, 0, 0.04);
          cursor: pointer;
          transition: transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        input[type="range"].ios-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 50%;
          background: #FFFFFF;
          border: 0.5px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0px 3px 8px rgba(0, 0, 0, 0.12), 0px 3px 1px rgba(0, 0, 0, 0.04);
          cursor: pointer;
          transition: transform 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        input[type="range"].ios-slider:active::-webkit-slider-thumb {
          transform: scale(1.15);
        }
        input[type="range"].ios-slider:active::-moz-range-thumb {
          transform: scale(1.15);
        }

        /* Tab change transitions */
        .animate-tab-change {
          animation: iosTabSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes iosTabSlide {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.995);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        /* Smooth squircle bounce */
        .sidebar-icon-squircle {
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        button:hover .sidebar-icon-squircle {
          transform: scale(1.08) rotate(3deg);
        }
        
        /* Custom iOS-style scrollbars */
        .scrollbar-ios::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .scrollbar-ios::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-ios::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.12);
          border-radius: 9999px;
        }
        .dark .scrollbar-ios::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.12);
        }
        .scrollbar-ios::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.25);
        }
        .dark .scrollbar-ios::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}} />

      {/* ✅ FIX: Tinggi Desktop dikunci di 640px (md:h-[640px]).
        Jadi walaupun isi kontennya sedikit (seperti tab 'Export'), kotak modal tetap besar.
        Ini menjaga layout tidak berubah-ubah (jumping).
      */}
      <div className="w-full h-full md:h-[640px] md:max-w-[850px] bg-[#F2F2F7]/95 dark:bg-black/95 backdrop-blur-2xl md:rounded-[20px] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-zinc-200/50 dark:border-zinc-800">

        {/* SIDEBAR (Desktop) */}
        <div className="hidden md:flex flex-col w-[260px] bg-[#F2F2F7]/40 dark:bg-[#1c1c1e]/40 border-r border-zinc-200 dark:border-zinc-800 py-6 px-3 backdrop-blur-xl">
          <div className="px-3 mb-6"><h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Pengaturan</h2></div>

          {/* iOS Profile Head (Desktop) */}
          <div className="px-1 mb-5">
            <div onClick={() => setTab("profile")} className={`bg-white/80 dark:bg-[#2C2C2E]/80 backdrop-blur-md rounded-2xl p-3 flex items-center gap-3 cursor-pointer shadow-sm border border-black/5 dark:border-white/5 transition-all ${tab === 'profile' ? 'ring-2 ring-blue-500 border-transparent dark:ring-blue-400' : 'hover:bg-white dark:hover:bg-[#2C2C2E]'}`}>
              <div 
                className="w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-black/5 dark:border-white/5 shadow-sm"
                style={{ backgroundColor: userProfilePic ? undefined : (userProfileColor || "#3b82f6") }}
              >
                {userProfilePic ? (
                  <img src={userProfilePic} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-white text-sm uppercase">
                    {(userEmail?.split('@')[0] || "U").substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 w-0">
                <h3 className="text-[15px] font-bold text-zinc-900 dark:text-white truncate leading-tight">{userEmail?.split('@')[0] || "User"}</h3>
                <p className="text-[11px] text-zinc-500 truncate leading-tight mt-0.5">Edit akun, cek detail...</p>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400 opacity-60 mr-1" />
            </div>
          </div>

          <div className="space-y-1 flex-1 overflow-y-auto scrollbar-ios">
            {menu.map((m) => (
              <button key={m.key} onClick={() => setTab(m.key)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${tab === m.key ? "bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"}`}>
                <div className={`w-6 h-6 rounded-[6px] flex items-center justify-center text-[12px] text-white shadow-sm sidebar-icon-squircle ${m.color}`}>{m.icon}</div>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MOBILE MENU */}
        <div className={`flex flex-col flex-1 bg-[#F2F2F7] dark:bg-black h-full md:hidden ${mobileView === 'content' ? 'hidden' : 'flex'}`}>
          <div className="px-5 py-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Pengaturan</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 scrollbar-ios">
            {/* iOS Profile Head (Mobile) */}
            <IOSGroup className="!mb-8">
              <div onClick={() => { setTab("profile"); setMobileView("content"); }} className="p-4 flex flex-row items-center gap-4 cursor-pointer active:bg-zinc-100 dark:active:bg-zinc-700/50 transition-colors">
                <div 
                  className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-black/5 dark:border-white/5 shadow-sm"
                  style={{ backgroundColor: userProfilePic ? undefined : (userProfileColor || "#3b82f6") }}
                >
                  {userProfilePic ? (
                    <img src={userProfilePic} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-white text-xl uppercase">
                      {(userEmail?.split('@')[0] || "U").substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[20px] font-bold text-zinc-900 dark:text-white truncate">{userEmail?.split('@')[0] || "User"}</h3>
                  <p className="text-[13px] text-zinc-500 truncate mt-0.5">Edit akun, cek detail...</p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-400 opacity-60 mr-1" />
              </div>
            </IOSGroup>

            <IOSGroup>{menu.map((m, i) => (<IOSRow key={m.key} label={m.label} icon={m.icon} iconColor={m.color} isLast={i === menu.length - 1} onClick={() => { setTab(m.key); setMobileView("content"); }} />))}</IOSGroup>
            <IOSGroup><IOSRow label="Tutup Pengaturan" icon={<X size={16} />} iconColor="bg-zinc-400" isLast onClick={onClose} /></IOSGroup>
          </div>
        </div>

        {/* CONTENT */}
        <div className={`flex flex-col flex-1 bg-[#F2F2F7] dark:bg-black h-full overflow-hidden ${mobileView === 'menu' ? 'hidden md:flex' : 'flex'}`}>
          <div className="shrink-0 h-14 md:h-16 px-4 md:px-8 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <button onClick={() => setMobileView('menu')} className="md:hidden text-[#007AFF] dark:text-[#0A84FF] flex items-center gap-0.5 font-normal text-[17px] -ml-2 pr-2 active:opacity-60 transition-opacity"><ChevronLeft className="w-6 h-6 -ml-1" /> Kembali</button>
              <h3 className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white">{menu.find(m => m.key === tab)?.label}</h3>
            </div>
            <button onClick={onClose} className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors shadow-sm" title="Tutup (Esc)"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-ios">
            <div className="max-w-2xl mx-auto md:mx-0">
              <div key={tab} className="animate-tab-change">
                {renderContent()}
              </div>
            </div>
          </div>
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
                <Lock className="text-red-600 dark:text-red-500" size={24} />
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