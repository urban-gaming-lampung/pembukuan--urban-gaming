import React, { useMemo, useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { collection, addDoc, deleteDoc, onSnapshot, query, doc, updateDoc, where } from "firebase/firestore";
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
  ChevronLeft,
  X,
  ChevronDown,
  Download,
  Pencil,
  ChevronRight,
  AlertTriangle
} from "lucide-react";
// import SopPdf from "../SOP/SOP_SewaPS_URBAN.pdf";
import versionData from "../version.json";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import KonfirmasiAkun from "./KonfirmasiAkun";
import { getAbsenCycleInfo, normalizeBulanTahun, normalizeDateStr } from "../lib/absenPeriod";
import { toLocalYmd } from "../lib/dateLocal";
import { ongkirPengantarTersimpan } from "../lib/sewa";
import { toInt, rupiah } from "../lib/format";
import {
  AlertDialog,
  Button,
  EmptyState,
  Footnote,
  IconBadge,
  ListGroup,
  ListRow,
  Notice,
  Pill,
  SectionHeader,
  Toggle,
} from "../ui";
import type { WarnaIkon } from "../ui";

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
  rincianVisibility?: Record<string, boolean>;
  onRincianVisibilityChange?: (key: "harian" | "jajanan" | "jasaAks" | "sewa" | "pengeluaran" | "setoran", visible: boolean) => void;
  userEmail?: string;
  userProfilePic?: string;
  onProfilePicChange?: (dataUrl: string) => void;
  customBgDark?: string;
  onBgDarkChange?: (dataUrl: string | null) => void;
  history?: any[];
}

type TabKey = "general" | "asisten" | "edit" | "backup" | "export" | "reset" | "info" | "profile" | "gaji" | "sop";

/** Aksi Backup & Restore / Reset yang wajib dikonfirmasi password akun. */
type AksiAman = "backup" | "restore" | "restoreDrive" | "reset";
const AKSI_AMAN: Record<AksiAman, { judul: string; pesan: string; tombol: string; bahaya: boolean }> = {
  backup: { judul: "Backup Data", pesan: "Masukkan password akun Anda untuk mengunduh backup seluruh data pembukuan.", tombol: "Unduh", bahaya: false },
  restore: { judul: "Restore dari File", pesan: "Masukkan password akun Anda untuk me-restore pembukuan dari file backup.", tombol: "Lanjutkan", bahaya: true },
  restoreDrive: { judul: "Restore dari Drive", pesan: "Pembukuan dengan tanggal yang sama akan ditimpa data dari Google Drive. Masukkan password akun Anda untuk melanjutkan.", tombol: "Restore", bahaya: true },
  reset: { judul: "Reset Pengaturan", pesan: "Semua pengaturan kembali ke bawaan. Data transaksi tetap aman. Masukkan password akun Anda untuk melanjutkan.", tombol: "Reset", bahaya: true },
};

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

// --- Apple Design Components (backed by URBAN Design System) ---
const IOSGroup = ({ children, title, className = "" }: { children: React.ReactNode; title?: string; className?: string }) => (
  <div className={`mb-5 ${className}`}>
    {title && <SectionHeader title={title} className="pt-0" />}
    <ListGroup>{children}</ListGroup>
  </div>
);

const IOSRow = ({
  icon,
  iconColor = "gray",
  label,
  value,
  onClick,
  chevron,
  destructive = false,
}: {
  icon?: React.ReactNode;
  iconColor?: WarnaIkon;
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
  isLast?: boolean;
  chevron?: boolean;
  destructive?: boolean;
}) => (
  <ListRow
    icon={icon}
    iconColor={iconColor}
    title={label}
    value={value}
    onClick={onClick}
    chevron={chevron}
    destructive={destructive}
  />
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
  <div className="p-[3px] apple-segmented rounded-full flex relative gap-0.5">
    {options.map((opt) => {
      const isActive = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 min-h-[32px] py-1 px-3 text-caption2 font-bold uppercase tracking-wide rounded-full transition-all duration-200 flex items-center justify-center gap-1.5 ${
            isActive
              ? "apple-segmented-thumb text-label"
              : "text-label-2 hover:text-label hover:bg-white/30 dark:hover:bg-white/[0.05]"
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
      <ul className="list-disc pl-5 space-y-2 text-footnote text-label-2">
        <li>Wajib memberikan 2 jaminan (pilih salah satu kombinasi):
          <ul className="list-disc pl-5 mt-1">
            <li>KTP + SIM</li>
            <li>KTP + STNK</li>
            <li>KTP + KK</li>
            <li>KTP + KTP lain</li>
          </ul>
        </li>
        <li className="italic text-caption">Catatan: Nama dan alamat pada jaminan wajib sama. Jika berbeda, harus konfirmasi terlebih dahulu kepada owner.</li>
        <li>Wajib mengisi form sewa di buku.</li>
        <li>Wajib melakukan tes unit sebelum barang diserahkan.</li>
      </ul>
    )
  },
  {
    id: 2,
    title: "2. Sewa Antar Jemput",
    content: (
      <ul className="list-disc pl-5 space-y-2 text-footnote text-label-2">
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
      <ul className="list-disc pl-5 space-y-2 text-footnote text-label-2">
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
      <div className="space-y-2 text-footnote text-label-2">
        <div className="flex justify-between border-b border-sep pb-1 text-label">
          <span className="font-semibold">Tipe Sewa</span>
          <span className="font-semibold">Harga/Jam</span>
        </div>
        <div className="flex justify-between"><span>PS3 Only</span><span className="tabular-nums">Rp 3.000</span></div>
        <div className="flex justify-between"><span>PS3 + TV/Portable</span><span className="tabular-nums">Rp 4.000</span></div>
        <div className="flex justify-between"><span>PS4 Only</span><span className="tabular-nums">Rp 5.000</span></div>
        <div className="flex justify-between"><span>PS4 + TV/Portable</span><span className="tabular-nums">Rp 6.000</span></div>
      </div>
    )
  },
  {
    id: 5,
    title: "5. Denda Penyewa",
    content: (
      <ul className="list-disc pl-5 space-y-2 text-footnote text-label-2">
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
  rincianVisibility,
  onRincianVisibilityChange,
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

  // Aksi penting: dikonfirmasi password akun yang sedang login (tanpa password bersama di kode)
  const [aksiAman, setAksiAman] = useState<AksiAman | null>(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [deleteAsistenId, setDeleteAsistenId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  };

  useEffect(() => {
    if (open) setMobileView("menu");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !aksiAman && !confirmLogoutOpen && !deleteAsistenId) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, aksiAman, confirmLogoutOpen, deleteAsistenId, onClose]);

  const menu = useMemo(() => {
    const allMenus: { key: TabKey; label: string; icon: React.ReactNode; color: WarnaIkon }[] = [
      { key: "general", label: "Umum", icon: <Settings size={15} />, color: "gray" },
      { key: "asisten", label: "Asisten", icon: <Bot size={15} />, color: "cyan" },
      { key: "gaji", label: "Gaji Saya", icon: <Wallet size={15} />, color: "green" },
      { key: "edit", label: "Edit Rincian", icon: <FileText size={15} />, color: "blue" },
      { key: "backup", label: "Backup & Restore", icon: <Cloud size={15} />, color: "green" },
      { key: "export", label: "Export Data", icon: <Upload size={15} />, color: "orange" },
      { key: "reset", label: "Reset", icon: <Trash2 size={15} />, color: "red" },
      { key: "sop", label: "Panduan", icon: <ClipboardList size={15} />, color: "teal" },
      { key: "info", label: "Info", icon: <Info size={15} />, color: "indigo" },
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
    if (!formAsisten.nama_pengeluaran.trim()) return;
    // Tanggal kosong/di luar 1-31 dulu tersimpan NaN sehingga pengingat tidak pernah jalan
    const tgl = Math.min(31, Math.max(1, parseInt(formAsisten.tanggal, 10) || 1));
    const nominal = Math.max(0, parseInt(String((formAsisten as any).nominal || "0").replace(/\D/g, ""), 10) || 0);
    setIsLoading(true);
    try {
    if (editingAsistenId) {
      // Update existing
      await updateDoc(doc(db, "owner_assistants", editingAsistenId), {
        nama_pengeluaran: formAsisten.nama_pengeluaran,
        kategori: formAsisten.kategori || "Lainnya",
        tanggal: tgl,
        nominal,
      });
      setEditingAsistenId(null);
    } else {
      // Add new
      await addDoc(collection(db, "owner_assistants"), {
        nama_pengeluaran: formAsisten.nama_pengeluaran,
        kategori: formAsisten.kategori || "Lainnya",
        tanggal: tgl,
        nominal,
        status: "aktif",
        last_triggered: 0
      });
    }
    setFormAsisten({ nama_pengeluaran: "", kategori: "", tanggal: "1" });
    } catch (e: any) {
      showToast("Gagal menyimpan pengingat: " + (e?.message || e));
    } finally {
      setIsLoading(false);
    }
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
  const handleDeleteAsisten = (id: string) => setDeleteAsistenId(id);
  const konfirmasiHapusAsisten = async () => {
    if (!deleteAsistenId) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, "owner_assistants", deleteAsistenId));
      showToast("Pengingat asisten dihapus");
      setDeleteAsistenId(null);
    } catch (e: any) {
      showToast("Gagal menghapus: " + (e?.message || e));
    } finally {
      setIsLoading(false);
    }
  };
  // --- Google Drive State ---
  const [driveConnected, setDriveConnected] = useState(false);

  const [gajiKu, setGajiKu] = useState<{ records?: any[] } | null>(null);
  const [gajiExpandedId, setGajiExpandedId] = useState<string | null>(null);
  // Data mentah Gaji Saya (diisi listener Firestore di bawah). Perhitungan ulang dipisah dari
  // listener supaya perubahan `history` tidak membuat 3 listener berlangganan ulang terus-menerus.
  const gajiSrcRef = React.useRef<{ data: any; logs: any[]; uDoc: any }>({ data: { records: [] }, logs: [], uDoc: {} });
  const recomputeGajiRef = React.useRef<() => void>(() => {});
  useEffect(() => {
    if (open && userEmail && !isOwner) {
      const emailTrimmed = userEmail.toLowerCase().trim();

      const updateGajiKuState = (data: any, logs: any[], uDoc: any = gajiSrcRef.current.uDoc) => {
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
                const nominalAsli = toInt(r._ongkir);
                if (nominalAsli > 0) {
                    if (r._isNewOngkirSystem) {
                        const pegawaiNominal = ongkirPengantarTersimpan(r) ?? 0;
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
                const nominalAsli = toInt(r._ongkir);
                if (nominalAsli > 0) {
                    if (r._isNewOngkirSystem) {
                        const pegawaiNominal = ongkirPengantarTersimpan(r) ?? 0;
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
        const todayNorm = normalizeDateStr(toLocalYmd());

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

      recomputeGajiRef.current = () => {
        const src = gajiSrcRef.current;
        updateGajiKuState(src.data, src.logs, src.uDoc);
      };
      recomputeGajiRef.current();
    }
  }, [open, userEmail, isOwner, history, absenConfig, ongkirConfig]);

  useEffect(() => {
    if (!(open && userEmail && !isOwner)) return;
    const emailTrimmed = userEmail.toLowerCase().trim();
    gajiSrcRef.current = { data: { records: [] }, logs: [], uDoc: {} };
    const unsubUser = onSnapshot(doc(db, "users", emailTrimmed), userSnap => {
      gajiSrcRef.current.uDoc = userSnap.exists() ? userSnap.data() : {};
      recomputeGajiRef.current();
    }, (err) => console.error("Gaji Saya (users):", err));
    const unsubGaji = onSnapshot(doc(db, "gaji_pegawai", emailTrimmed), docSnap => {
      gajiSrcRef.current.data = docSnap.exists() ? docSnap.data() : { records: [] };
      recomputeGajiRef.current();
    }, (err) => console.error("Gaji Saya (gaji):", err));
    // Hanya log absensi milik pegawai ini, bukan seluruh koleksi
    const unsubLogs = onSnapshot(query(collection(db, "log_absensi"), where("email", "==", emailTrimmed)), snap => {
      gajiSrcRef.current.logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeGajiRef.current();
    }, (err) => console.error("Gaji Saya (log_absensi):", err));
    return () => { unsubUser(); unsubGaji(); unsubLogs(); };
  }, [open, userEmail, isOwner]);

  const runOrAlert = (fn?: () => void, msg?: string) => {
    if (fn) return fn();
    showToast(msg || "Fitur ini belum dihubungkan.");
  };

  const openEditModal = (fn?: () => void, msg?: string) => {
    if (!fn) {
      showToast(msg || "Fitur edit belum dihubungkan.");
      return;
    }
    fn();
  };

  const jalankanAksiAman = async (aksi: AksiAman) => {
    setAksiAman(null);
    if (aksi === "backup") runOrAlert(onBackupData);
    else if (aksi === "restore") runOrAlert(onRestoreData);
    else if (aksi === "reset") runOrAlert(onResetSetting);
    else if (aksi === "restoreDrive") {
      if (!onRestoreDrive) return runOrAlert(undefined);
      setIsLoading(true);
      try { await onRestoreDrive(); } finally { setIsLoading(false); }
    }
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
        showToast("Gagal memproses gambar profil.");
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
        showToast("Gagal memproses gambar background. (Mungkin terlalu besar)");
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!open) return null;

  const renderContent = () => (
    <div className="space-y-5 animate-fadeIn pb-6">

      {tab === "profile" && (
        <div className="space-y-5">
          <IOSGroup title="URBAN Gaming Account">
            <div className="p-6 flex flex-col items-center justify-center text-center">
              <div className="relative mb-4 group cursor-pointer">
                <div
                  className="w-24 h-24 rounded-full overflow-hidden shadow-card flex items-center justify-center relative border-4 transition-colors"
                  style={{ borderColor: userProfileColor || "#0088FF", backgroundColor: userProfilePic ? undefined : (userProfileColor || "#0088FF") }}
                >
                  {userProfilePic ? (
                    <img src={userProfilePic} alt="Foto profil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-white text-2xl uppercase tracking-wider select-none">
                      {(userEmail?.split("@")[0] || "U").substring(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-caption text-white font-semibold">Ubah</span>
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={handleProfilePhotoSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <h3 className="text-title3 font-bold text-label mb-0.5">{userEmail?.split("@")[0] || "User"}</h3>
              <p className="text-footnote text-label-2">{userEmail}</p>
            </div>
          </IOSGroup>

          <IOSGroup title="Profil Indikator">
            <div className="p-4">
              <div className="text-callout font-medium text-label mb-1">Pilih Warna Indikator</div>
              <div className="text-footnote text-label-2 leading-relaxed mb-4">Warna profil untuk indikator online</div>
              <div className="flex flex-wrap gap-4 justify-center py-2">
                {["#0088FF", "#34C759", "#FF8D28", "#FF383C", "#CB30E0", "#FF2D55", "#00C8B3", "#6155F5", "#8E8E93"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => runOrAlert(() => onProfileColorChange?.(c))}
                    className={`shrink-0 w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-tint/50 transform transition-transform hover:scale-110 flex items-center justify-center shadow-card border border-edge ${
                      userProfileColor === c ? "scale-125 ring-2 ring-offset-2 ring-offset-surface ring-tint z-10" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {userProfileColor === c && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ mixBlendMode: "difference" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}

                <div
                  className={`shrink-0 relative w-8 h-8 rounded-full shadow-card border border-edge flex items-center justify-center transform transition-transform hover:scale-110 ${
                    userProfileColor && !["#0088FF", "#34C759", "#FF8D28", "#FF383C", "#CB30E0", "#FF2D55", "#00C8B3", "#6155F5", "#8E8E93"].includes(userProfileColor)
                      ? "scale-125 ring-2 ring-offset-2 ring-offset-surface ring-tint z-10"
                      : ""
                  }`}
                  title="Custom Color"
                >
                  <div className="absolute inset-0 bg-[conic-gradient(from_90deg,red,yellow,green,cyan,blue,magenta,red)] rounded-full opacity-90 pointer-events-none" />
                  <input
                    type="color"
                    value={userProfileColor || "#ffffff"}
                    onChange={(e) => runOrAlert(() => onProfileColorChange?.(e.target.value))}
                    className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] opacity-0 cursor-pointer"
                  />
                  {userProfileColor && !["#0088FF", "#34C759", "#FF8D28", "#FF383C", "#CB30E0", "#FF2D55", "#00C8B3", "#6155F5", "#8E8E93"].includes(userProfileColor) ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 drop-shadow-md pointer-events-none" style={{ mixBlendMode: "difference" }}>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="relative z-10 drop-shadow-md pointer-events-none">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </IOSGroup>

          <IOSGroup title="Kustomisasi Aplikasi">
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-callout font-medium text-label">Ubah Background</div>
                <div className="text-caption text-label-2 leading-tight">Latar belakang khusus mode gelap</div>
              </div>
              <div className="flex gap-2 items-center shrink-0">
                {customBgDark && (
                  <Button variant="destructive" size="sm" onClick={() => runOrAlert(() => onBgDarkChange && onBgDarkChange(""))}>
                    Reset
                  </Button>
                )}
                <div className="relative">
                  <Button variant="tinted" size="sm" className="pointer-events-none">
                    Pilih File
                  </Button>
                  <input type="file" accept="image/*" onChange={handleCustomBgSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>
            </div>
          </IOSGroup>

          <IOSGroup title="Otentikasi">
            <IOSRow
              label="Keluar (Logout)"
              icon={<LogOut size={16} />}
              iconColor="red"
              destructive
              chevron={false}
              onClick={() => setConfirmLogoutOpen(true)}
            />
          </IOSGroup>
        </div>
      )}

      {tab === "gaji" && !isOwner && (
        <div className="space-y-5">
          <IOSGroup title="Gaji Saya">
            <div className="p-5">
              {(!gajiKu || !gajiKu.records || gajiKu.records.length === 0) ? (
                <EmptyState title="Belum ada riwayat gaji untuk Anda" />
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
                              { name: "Pokok", value: totalPokok, color: "#34C759" },
                              { name: "Tambahan", value: totalBonus, color: "#0088FF" },
                              { name: "Total Ongkir", value: totalOngkir, color: "#CB30E0" },
                              { name: "Pengurangan", value: totalPotongan, color: "#FF383C" }
                            ].filter((d) => d.value > 0)}
                            innerRadius={60} outerRadius={85} paddingAngle={4}
                            dataKey="value" stroke="none"
                          >
                            {[
                              { name: "Pokok", value: totalPokok, color: "#34C759" },
                              { name: "Tambahan", value: totalBonus, color: "#0088FF" },
                              { name: "Total Ongkir", value: totalOngkir, color: "#CB30E0" },
                              { name: "Pengurangan", value: totalPotongan, color: "#FF383C" }
                            ].filter((d) => d.value > 0).map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip formatter={(val: number) => `${rupiah(val)}`} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-1">
                        <span className="text-caption2 text-label-2 font-bold uppercase tracking-widest text-center">Total<br />Sepanjang Waktu</span>
                        <span className="text-headline font-bold tabular-nums text-positive">{rupiah(totalDiterima)}</span>
                      </div>
                    </div>

                    {/* List Monthly Salary Records */}
                    <div className="w-full space-y-2.5 pt-4 border-t border-sep">
                      <h4 className="text-caption font-bold text-label-2 uppercase tracking-wider mb-1">Riwayat Gaji Bulanan</h4>
                      {gajiKu.records.map((r: any) => {
                        const isExpanded = gajiExpandedId === r.id;
                        const tPokok = Number(r.gajiPokok) || 0;
                        const tbArr = r.gajiTambahan || [];
                        const pgArr = r.gajiPengurangan || [];
                        const tBonus = tbArr.reduce((sum: number, t: any) => sum + (Number(t.nominal) || 0), 0);
                        const tOngkir = Number(r.ongkirBulanIni) || 0;
                        const tPotongan = pgArr.filter((p: any) => !p.isDibatalkan).reduce((sum: number, p: any) => sum + (Number(p.nominal) || 0), 0);
                        const tBonusBelumDibayar = tbArr.filter((t: any) => t.status !== "sudah").reduce((sum: number, t: any) => sum + (Number(t.nominal) || 0), 0);
                        const tDiterimaSemua = Math.max(0, tPokok + tBonus + tOngkir - tPotongan);
                        const tDitransfer = Math.max(0, tPokok + tBonusBelumDibayar - tPotongan);
                        return (
                          <div key={r.id} className="apple-tile rounded-tile border border-sep overflow-hidden w-full transition-all">
                            <button
                              type="button"
                              className="w-full p-3.5 flex justify-between items-center text-left hover:bg-fill/60 active:bg-fill transition-colors"
                              onClick={() => setGajiExpandedId(isExpanded ? null : r.id)}
                            >
                              <span className="font-semibold text-subhead text-label uppercase tracking-wide">
                                Gaji {r.bulanTahun}
                              </span>
                              <div className="flex items-center gap-2.5">
                                <span className="text-subhead font-bold tabular-nums text-positive">{rupiah(tDiterimaSemua)}</span>
                                <ChevronDown className={`w-4 h-4 text-label-3 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="p-4 border-t border-sep space-y-3 bg-surface animate-in slide-in-from-top-2 duration-200">
                                <div className="flex justify-between items-center">
                                  <span className="text-footnote font-semibold text-label-2">Gaji Pokok</span>
                                  <span className="text-subhead font-bold tabular-nums text-label">{rupiah(tPokok)}</span>
                                </div>
                                {tbArr.map((tb: any, i: number) => Number(tb.nominal) > 0 && (
                                  <div key={`tb-${i}`} className="flex justify-between items-center gap-2">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-footnote font-semibold tabular-nums text-tint">Tambahan: +{rupiah(Number(tb.nominal))}</span>
                                      <Pill tone={tb.status === "sudah" ? "positive" : "warning"}>
                                        {tb.status === "sudah" ? "SUDAH DIBAYAR" : "BELUM DIBAYAR"}
                                      </Pill>
                                    </div>
                                    <span className="text-right text-caption font-medium text-label-2 max-w-[150px] italic">"{tb.ket || "-"}"</span>
                                  </div>
                                ))}
                                {tOngkir > 0 && (
                                  <div className="flex justify-between items-center flex-wrap gap-2">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-footnote font-semibold tabular-nums text-label">Total Ongkir: +{rupiah(tOngkir)}</span>
                                      <Pill tone="neutral">Tidak masuk transfer</Pill>
                                    </div>
                                    <span className="text-right text-caption font-medium text-label-2 max-w-[150px] italic">"Otomatis dari Sistem"</span>
                                  </div>
                                )}
                                {pgArr.map((pg: any, i: number) => {
                                  const isCanceled = Boolean(pg.isDibatalkan);
                                  if (Number(pg.nominal) <= 0) return null;
                                  return (
                                    <div key={`pg-${i}`} className={`flex justify-between items-center gap-2 py-1 ${isCanceled ? "opacity-60" : ""}`}>
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className={`text-footnote font-semibold tabular-nums ${isCanceled ? "line-through text-label-3" : "text-negative"}`}>
                                            Pengurangan: -{rupiah(Number(pg.nominal))}
                                          </span>
                                          {pg._isAutoSistem && <Pill tone="warning">⚡ Auto</Pill>}
                                          {isCanceled && <Pill tone="warning">Dicoret Owner</Pill>}
                                        </div>
                                        {pg.photoUrl && (
                                          <a href={pg.photoUrl} target="_blank" rel="noreferrer" className="text-caption text-tint hover:underline flex items-center gap-1 font-semibold">
                                            📷 Lihat Bukti Foto
                                          </a>
                                        )}
                                      </div>
                                      <span className={`text-right text-caption font-medium max-w-[150px] italic ${isCanceled ? "line-through text-label-3" : "text-label-2"}`}>
                                        "{pg.ket || "-"}"
                                      </span>
                                    </div>
                                  );
                                })}

                                <div className="mt-3 p-3 bg-warning/10 border border-warning/25 rounded-field flex justify-between items-center">
                                  <span className="text-caption font-bold uppercase tracking-wider text-warning">Yang Harus Ditransfer</span>
                                  <span className="text-headline font-bold tabular-nums text-warning">{rupiah(tDitransfer)}</span>
                                </div>

                                {r.buktiTransfer && (
                                  <div className="mt-3 pt-3 border-t border-sep flex flex-col items-center">
                                    <span className="text-caption2 font-bold text-label-2 mb-2 uppercase tracking-widest">Bukti Transfer</span>
                                    <img src={r.buktiTransfer} alt="Bukti Transfer" className="rounded-field border border-sep shadow-card max-w-[200px]" />
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
            <div className="flex flex-col px-4 pt-5 pb-4 items-center border-b border-sep">
              <div className="flex justify-center gap-10 mb-2">
                <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => runOrAlert(() => onThemeChange?.("light"))}>
                  <div className="w-20 h-[130px] rounded-card bg-gradient-to-br from-[#3CD3FE] to-[#0088FF] p-1 shadow-card border border-edge">
                    <div className="w-full h-full rounded-tile bg-white/45 flex flex-col p-2 gap-2 backdrop-blur-md">
                      <div className="w-full h-4 bg-white shadow-sm rounded-md border border-black/5" />
                      <div className="w-full h-6 bg-white/80 shadow-sm rounded-md flex items-center justify-center text-[10px] font-bold text-[#004099] border border-black/5">09.41</div>
                    </div>
                  </div>
                  <span className="text-subhead font-medium text-label">Light</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${themeMode === "light" ? "bg-tint border-tint" : "border-sep-opaque bg-transparent"}`}>
                    {themeMode === "light" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={() => runOrAlert(() => onThemeChange?.("dark"))}>
                  <div className="w-20 h-[130px] rounded-card bg-gradient-to-br from-[#0091FF] via-[#1C3B8B] to-[#090D1F] p-1 shadow-card border border-edge">
                    <div className="w-full h-full rounded-tile bg-black/45 flex flex-col p-2 gap-2 backdrop-blur-md border border-white/10">
                      <div className="w-full h-4 bg-white/20 shadow-sm rounded-md" />
                      <div className="w-full h-6 bg-white/15 shadow-sm rounded-md flex items-center justify-center text-[10px] font-bold text-[#E5F0FF]">09.41</div>
                    </div>
                  </div>
                  <span className="text-subhead font-medium text-label">Dark</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${themeMode === "dark" ? "bg-tint border-tint" : "border-sep-opaque bg-transparent"}`}>
                    {themeMode === "dark" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => runOrAlert(() => onThemeChange?.(themeMode === "auto" ? "dark" : "auto"))}>
                <span className="text-callout font-medium text-label">Otomatis</span>
              </div>
              <Toggle
                on={themeMode === "auto"}
                onChange={(v) => runOrAlert(() => onThemeChange?.(v ? "auto" : "dark"))}
                label="Tema otomatis"
              />
            </div>
          </IOSGroup>

          <IOSGroup title="Pengaturan Tabel & Kualitas">
            <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-sep">
              <div className="space-y-0.5 min-w-0">
                <div className="text-callout font-medium text-label">Mode Tabel Rincian</div>
                <div className="text-caption text-label-2">Ubah gaya tabel di layar HP</div>
              </div>
              <div className="w-40 shrink-0">
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

            {isOwner && (
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-callout font-medium text-label">Kualitas Gambar</div>
                  <div className="text-caption text-label-2">Pengaruh ke ukuran file PDF</div>
                </div>
                <div className="w-40 shrink-0">
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
              <div className="px-4 py-4 flex flex-col gap-3 border-b border-sep">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-callout font-medium text-label">Bagi Hasil Pegawai</div>
                    <div className="text-caption text-label-2">Porsi ongkir untuk pegawai (Owner: {100 - localPegawaiPersen}%)</div>
                  </div>
                  <div className="text-headline font-bold tabular-nums text-tint dark:text-[#45ADFF] bg-tint/[0.12] dark:bg-tint/[0.22] ring-1 ring-inset ring-tint/20 px-3 py-1 rounded-full shrink-0">{localPegawaiPersen}%</div>
                </div>
                <div className="relative pt-1 pb-1 touch-pan-y">
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
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div
                  className="space-y-0.5 flex-1 min-w-0 cursor-pointer select-none"
                  onClick={() => {
                    const nextVal = !localMasukGaji;
                    setLocalMasukGaji(nextVal);
                    runOrAlert(() => setOngkirConfig && setOngkirConfig({ pegawaiPersen: localPegawaiPersen, masukGaji: nextVal }));
                  }}
                >
                  <div className="text-callout font-medium text-label">Masuk Total Gaji</div>
                  <div className="text-caption text-label-2">Otomatis tambahkan porsi pegawai ke "Gaji Yang Harus Ditransfer"</div>
                </div>
                <Toggle
                  on={localMasukGaji}
                  onChange={(nextVal) => {
                    setLocalMasukGaji(nextVal);
                    runOrAlert(() => setOngkirConfig && setOngkirConfig({ pegawaiPersen: localPegawaiPersen, masukGaji: nextVal }));
                  }}
                  label="Masuk total gaji"
                />
              </div>
            </IOSGroup>
          )}

          {isOwner && (
            <IOSGroup title="Potongan Gaji Absen (Keterlambatan)">
              <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-sep">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-callout font-medium text-label">Tanggal Mulai Hitung Absensi (Cutoff)</div>
                  <div className="text-caption text-label-2">Siklus 1 bulan absensi &amp; potongan denda dihitung dari tanggal ini</div>
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
                  className="min-h-[44px] bg-fill dark:bg-white/[0.09] border border-sep text-tint dark:text-[#45ADFF] font-semibold text-[16px] sm:text-subhead rounded-field px-3 py-2 focus:outline-none focus:bg-surface dark:focus:bg-[#2C2C2E] focus:ring-2 focus:ring-tint/35 cursor-pointer self-start sm:self-auto"
                >
                  <option value={1} className="bg-surface text-label">Tgl 1 (Awal Bulan Normal)</option>
                  {Array.from({ length: 30 }, (_, i) => i + 2).map((tgl) => (
                    <option key={tgl} value={tgl} className="bg-surface text-label">
                      Tanggal {tgl}
                    </option>
                  ))}
                </select>
              </div>
              <div className="px-4 py-4 flex flex-col gap-3 border-b border-sep">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-callout font-medium text-label">Nominal Denda (Rp)</div>
                    <div className="text-caption text-label-2">Jumlah denda per blok waktu</div>
                  </div>
                  <div className="text-subhead font-bold tabular-nums text-negative bg-negative/10 px-3 py-1 rounded-control shrink-0">{rupiah(localNominalDenda)}</div>
                </div>
                <div className="relative pt-1 pb-1 touch-pan-y">
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
              <div className="px-4 py-4 flex flex-col gap-3 border-b border-sep">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-callout font-medium text-label">Waktu Toleransi (Menit)</div>
                    <div className="text-caption text-label-2">Toleransi awal sebelum mulai didenda</div>
                  </div>
                  <div className="text-subhead font-bold tabular-nums text-warning bg-warning/10 px-3 py-1 rounded-control shrink-0">{localWaktuToleransi} mnt</div>
                </div>
                <div className="relative pt-1 pb-1 touch-pan-y">
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
              <div className="px-4 py-4 flex flex-col gap-3 border-b border-sep">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-callout font-medium text-label">Durasi Blok Potongan (Menit)</div>
                    <div className="text-caption text-label-2">Denda dikalikan setiap kelipatan durasi ini</div>
                  </div>
                  <div className="text-subhead font-bold tabular-nums text-tint bg-tint/10 px-3 py-1 rounded-control shrink-0">{localDurasiWaktuPotongan} mnt</div>
                </div>
                <div className="relative pt-1 pb-1 touch-pan-y">
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
              <div className="px-4 py-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex flex-col min-w-0">
                    <span className="text-subhead font-semibold text-label">Denda Tidak Full Absen (Bolos/Lupa)</span>
                    <span className="text-caption text-label-2">Potongan gaji jika tidak absen masuk/pulang sampai tutup buku</span>
                  </div>
                  <div className="text-subhead font-bold tabular-nums text-negative bg-negative/10 px-3 py-1 rounded-control shrink-0">{rupiah(localDendaTidakAbsenPulang)}</div>
                </div>
                <div className="relative pt-2 pb-2 touch-pan-y">
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
                  <div className="flex justify-between mt-2 text-caption2 font-medium text-label-3 tabular-nums">
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
          <Footnote className="px-1 mb-4">
            Pilih kategori untuk mengubah harga atau nama item. Perubahan tersimpan otomatis.
          </Footnote>
          <IOSGroup title="Kategori Item">
            <IOSRow label="Pemasukan Harian" value={`${sHarian.count} Item`} icon={<Gamepad2 size={16} />} iconColor="blue" onClick={() => openEditModal(onOpenEditHarian)} />
            <IOSRow label="Jajanan" value={`${sJajanan.count} Item`} icon={<Coffee size={16} />} iconColor="orange" onClick={() => openEditModal(onOpenEditJajanan)} />
            <IOSRow label="Pemasukan Usaha" value={`${sJasa.count} Item`} icon={<Wrench size={16} />} iconColor="gray" onClick={() => openEditModal(onOpenEditJasaAks)} />
            <IOSRow label="Sewa PS" value={`${sSewa.count} Item`} icon={<Truck size={16} />} iconColor="green" onClick={() => openEditModal(onOpenEditSewa)} />
          </IOSGroup>

          <IOSGroup title="Tampilkan Tabel di Pembukuan">
            {([
              { key: "harian", label: "1. Pemasukan Harian" },
              { key: "jajanan", label: "2. Pemasukan Jajanan" },
              { key: "jasaAks", label: "3. Pemasukan Usaha" },
              { key: "sewa", label: "4. Sewa PS" },
              { key: "pengeluaran", label: "Rincian Pengeluaran" },
              { key: "setoran", label: "Rincian Setoran" },
            ] as const).map((t, i, arr) => {
              const on = rincianVisibility?.[t.key] !== false;
              const toggleVis = () => runOrAlert(onRincianVisibilityChange && (() => onRincianVisibilityChange(t.key, !on)));
              return (
                <div
                  key={t.key}
                  className={`px-4 py-3 flex items-center justify-between gap-3 ${i < arr.length - 1 ? "border-b border-sep" : ""}`}
                >
                  <div className="space-y-0.5 flex-1 min-w-0 cursor-pointer select-none" onClick={toggleVis}>
                    <div className="text-subhead font-medium text-label">{t.label}</div>
                    <div className="text-caption text-label-2">{on ? "Tampil di halaman Pembukuan" : "Disembunyikan"}</div>
                  </div>
                  <Toggle on={on} onChange={() => toggleVis()} label={`Tampilkan ${t.label}`} />
                </div>
              );
            })}
          </IOSGroup>
          <Footnote className="px-1 -mt-2">
            Tabel yang disembunyikan tidak tampil untuk semua admin. Data yang sudah terisi tetap tersimpan &amp; ikut terhitung di rekap.
          </Footnote>
        </>
      )}

      {tab === "asisten" && (
        <div className="space-y-5">
          <Footnote className="px-1">
            Asisten akan mengingatkan Anda berupa Pop-up saat Anda Login setiap bulannya untuk otomatis menyimpan pengeluaran.
          </Footnote>
          <IOSGroup title="Tambah Pengingat Asisten">
            <div className="p-4 flex flex-col gap-3">
              <input
                type="text"
                value={formAsisten.nama_pengeluaran}
                onChange={(e) => setFormAsisten({ ...formAsisten, nama_pengeluaran: e.target.value })}
                placeholder="Nama Pengeluaran (misal: Tagihan Wi-Fi)"
                className="w-full min-h-[44px] bg-fill border border-sep rounded-field px-3.5 py-2 text-[16px] sm:text-subhead text-label placeholder:text-label-3 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35"
              />
              <input
                type="text"
                value={formAsisten.kategori}
                onChange={(e) => setFormAsisten({ ...formAsisten, kategori: e.target.value })}
                placeholder="Kategori (misal: Listrik / Air / Internet)"
                className="w-full min-h-[44px] bg-fill border border-sep rounded-field px-3.5 py-2 text-[16px] sm:text-subhead text-label placeholder:text-label-3 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35"
              />
              <div className="flex items-center gap-2.5">
                <span className="text-footnote font-semibold text-label-2 shrink-0">Tgl Aktif:</span>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formAsisten.tanggal}
                  onChange={(e) => setFormAsisten({ ...formAsisten, tanggal: e.target.value })}
                  className="w-20 min-h-[44px] bg-fill border border-sep rounded-field px-3 py-2 text-[16px] sm:text-subhead text-center tabular-nums text-label focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35"
                />
                <input
                  type="number"
                  value={(formAsisten as any).nominal || ""}
                  onChange={(e) => setFormAsisten({ ...formAsisten, nominal: e.target.value } as any)}
                  placeholder="Nominal (Opsional)"
                  className="flex-1 min-w-0 min-h-[44px] bg-fill border border-sep rounded-field px-3.5 py-2 text-[16px] sm:text-subhead tabular-nums text-label placeholder:text-label-3 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35"
                />
              </div>
              <Button
                variant="filled"
                size="lg"
                block
                disabled={!formAsisten.nama_pengeluaran || isLoading}
                loading={isLoading}
                onClick={handleAddAsisten}
                className="mt-1"
              >
                {editingAsistenId ? "Simpan Perubahan" : "Tambahkan Asisten"}
              </Button>
              {editingAsistenId && (
                <Button
                  variant="gray"
                  size="md"
                  block
                  onClick={() => { setEditingAsistenId(null); setFormAsisten({ nama_pengeluaran: "", kategori: "", tanggal: "1" }); }}
                >
                  Batal Edit
                </Button>
              )}
            </div>
          </IOSGroup>
          {assistants.length > 0 && (
            <IOSGroup title="Daftar Pengingat">
              {assistants.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between gap-3 p-4 ${i !== assistants.length - 1 ? "border-b border-sep" : ""} ${editingAsistenId === a.id ? "bg-tint/10" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-subhead text-label truncate">{a.nama_pengeluaran}</div>
                    <div className="text-caption font-medium text-label-2 uppercase tabular-nums">
                      Tgl {a.tanggal} | {a.kategori}{a.nominal ? ` | ${rupiah(Number(a.nominal))}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditAsisten(a)}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-tint/10 text-tint hover:bg-tint/20 active:scale-90 transition-all"
                      aria-label={`Edit ${a.nama_pengeluaran}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAsisten(a.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-full bg-negative/10 text-negative hover:bg-negative/20 active:scale-90 transition-all"
                      aria-label={`Hapus ${a.nama_pengeluaran}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </IOSGroup>
          )}
        </div>
      )}

      {tab === "backup" && (
        <div className="space-y-5">
          <IOSGroup title="Backup & Restore Online (Google Drive)">
            <div className="px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="text-callout font-medium text-label">Koneksi Cloud</div>
                <div className="text-caption text-label-2">{driveConnected ? "Sudah disetujui" : "Sinkronisasi via Google Auth"}</div>
              </div>
              <Button
                variant={driveConnected ? "destructive" : "filled"}
                size="sm"
                loading={isLoading}
                disabled={isLoading}
                onClick={async () => {
                  if (!driveConnected) {
                    setIsLoading(true);
                    try {
                      const { authenticateDrive } = await import("../lib/googleDrive");
                      await authenticateDrive();
                      setDriveConnected(true);
                      showToast("Google Drive terhubung");
                    } catch (e: any) {
                      showToast("Login Google dibatalkan atau gagal: " + (e.message || "Unknown Error"));
                    }
                    setIsLoading(false);
                  } else {
                    setDriveConnected(false);
                  }
                }}
              >
                {driveConnected ? "Putuskan" : "Hubungkan"}
              </Button>
            </div>

            {driveConnected && (
              <div className="p-3 bg-surface-2 border-t border-sep flex gap-2">
                <Button
                  variant="tinted"
                  size="md"
                  className="flex-1"
                  disabled={isLoading}
                  loading={isLoading}
                  icon={<Upload size={15} />}
                  onClick={async () => {
                    setIsLoading(true);
                    if (onBackupDrive) await onBackupDrive();
                    setIsLoading(false);
                  }}
                >
                  Backup ke Drive
                </Button>
                <Button
                  variant="gray"
                  size="md"
                  className="flex-1"
                  disabled={isLoading}
                  icon={<Download size={15} />}
                  onClick={() => setAksiAman("restoreDrive")}
                >
                  Restore dari Drive
                </Button>
              </div>
            )}
          </IOSGroup>
          <IOSGroup title="Pencadangan File (Lokal/Flashdisk)">
            <IOSRow label="Backup Data ke File" icon={<Save size={16} />} iconColor="blue" onClick={() => setAksiAman("backup")} />
            <IOSRow label="Restore dari File" icon={<FolderOpen size={16} />} iconColor="green" onClick={() => setAksiAman("restore")} />
          </IOSGroup>
        </div>
      )}

      {tab === "export" && (
        <IOSGroup title="Laporan">
          <IOSRow label="Download Laporan CSV" icon={<FileSpreadsheet size={16} />} iconColor="indigo" onClick={() => runOrAlert(onExportCSV)} />
        </IOSGroup>
      )}

      {tab === "reset" && (
        <IOSGroup title="Zona Bahaya">
          <IOSRow
            label="Reset Semua Pengaturan"
            icon={<Trash2 size={16} />}
            iconColor="red"
            destructive
            chevron={false}
            onClick={() => setAksiAman("reset")}
          />
        </IOSGroup>
      )}

      {tab === "sop" && (
        <div className="space-y-5">
          <IOSGroup title="Panduan & SOP Pembukuan">
            <div className="p-4 space-y-3">
              {/* Card 0: SOP Sewa */}
              <div className="border border-sep rounded-tile overflow-hidden">
                <div
                  className="p-3 apple-tile flex justify-between items-center cursor-pointer hover:bg-fill/70 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 0 ? null : 0)}
                >
                  <span className="font-semibold text-subhead text-label">SOP SEWA PLAYSTATION (URBAN)</span>
                  <ChevronDown className={`w-4 h-4 text-label-3 transition-transform duration-200 ${sopExpanded === 0 ? "rotate-180" : ""}`} />
                </div>
                {sopExpanded === 0 && (
                  <div className="p-4 bg-surface border-t border-sep animate-in slide-in-from-top-2 duration-200 space-y-5">
                    {sopData.map((sop) => (
                      <div key={sop.id} className="space-y-2">
                        <div className="font-semibold text-footnote text-label border-b border-sep pb-1">
                          {sop.title}
                        </div>
                        {sop.content}
                      </div>
                    ))}
                    <div className="pt-3 flex justify-center border-t border-sep">
                      <a
                        href="#"
                        download="SOP_SewaPS_URBAN.pdf"
                        className="bg-tint/10 text-tint font-semibold py-2.5 px-6 rounded-field text-footnote flex items-center justify-center gap-2 hover:bg-tint/20 transition-colors"
                      >
                        <Download size={14} />
                        Download SOP ini
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 1: PS3 CFW */}
              <div className="border border-sep rounded-tile overflow-hidden">
                <div
                  className="p-3 apple-tile flex justify-between items-center cursor-pointer hover:bg-fill/70 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 1 ? null : 1)}
                >
                  <span className="font-semibold text-subhead text-label">CARA ISI GAME PS3 CFW</span>
                  <ChevronDown className={`w-4 h-4 text-label-3 transition-transform duration-200 ${sopExpanded === 1 ? "rotate-180" : ""}`} />
                </div>
                {sopExpanded === 1 && (
                  <div className="p-4 bg-surface border-t border-sep animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div>
                      <h4 className="font-bold text-caption text-tint uppercase mb-1">A. Format PKG (Instal via XMB)</h4>
                      <ul className="list-decimal pl-5 space-y-1 text-footnote text-label-2">
                        <li>Pastikan USB Flashdisk / Hardisk Eksternal diformat ke file sistem <b>FAT32</b>.</li>
                        <li>Copy/salin file game berformat <code>.pkg</code> ke direktori terluar (root) USB Flashdisk.</li>
                        <li>Colokkan USB ke port USB PS3.</li>
                        <li>Di menu utama XMB PS3, masuk ke menu <b>Package Manager</b> &gt; <b>Install Package Files</b> &gt; <b>Standard</b>.</li>
                        <li>Pilih file game <code>.pkg</code> dan tunggu proses instalasi selesai. Jika game memiliki beberapa part, instal berurutan (Part 1, Part 2, dst).</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-bold text-caption text-tint uppercase mb-1">B. Format Folder (Copy via MultiMan)</h4>
                      <ul className="list-decimal pl-5 space-y-1 text-footnote text-label-2">
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
              <div className="border border-sep rounded-tile overflow-hidden">
                <div
                  className="p-3 apple-tile flex justify-between items-center cursor-pointer hover:bg-fill/70 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 2 ? null : 2)}
                >
                  <span className="font-semibold text-subhead text-label">CARA ISI GAME PS3 HEN</span>
                  <ChevronDown className={`w-4 h-4 text-label-3 transition-transform duration-200 ${sopExpanded === 2 ? "rotate-180" : ""}`} />
                </div>
                {sopExpanded === 2 && (
                  <div className="p-4 bg-surface border-t border-sep animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <Notice tone="negative">
                      <b>PENTING:</b> Sebelum melakukan instalasi game PKG atau menyalin folder via MultiMan, Anda <b>wajib mengaktifkan HEN terlebih dahulu</b>.
                    </Notice>
                    <ul className="list-decimal pl-5 space-y-2 text-footnote text-label-2">
                      <li>Di menu utama XMB PS3, navigasikan ke kolom Game, lalu pilih menu <b>Enable HEN</b>. Tunggu hingga proses exploit sukses.</li>
                      <li>Jika HEN tidak aktif, aplikasi homebrew (seperti MultiMan, WebMan, Package Manager) akan <b>hang/crash / menyebabkan PS3 mati otomatis</b>.</li>
                      <li><b>Proses Pengisian Game:</b> Setelah HEN dalam keadaan aktif, Anda dapat mengikuti metode pengisian format <b>PKG</b> maupun format <b>Folder (MultiMan)</b> yang sama persis seperti pada panduan <b>PS3 CFW</b>.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Card 3: PS4 HEN */}
              <div className="border border-sep rounded-tile overflow-hidden">
                <div
                  className="p-3 apple-tile flex justify-between items-center cursor-pointer hover:bg-fill/70 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 3 ? null : 3)}
                >
                  <span className="font-semibold text-subhead text-label">CARA ISI GAME PS4 HEN</span>
                  <ChevronDown className={`w-4 h-4 text-label-3 transition-transform duration-200 ${sopExpanded === 3 ? "rotate-180" : ""}`} />
                </div>
                {sopExpanded === 3 && (
                  <div className="p-4 bg-surface border-t border-sep animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <ul className="list-decimal pl-5 space-y-2 text-footnote text-label-2">
                      <li>Pastikan PS4 sudah dalam kondisi jailbreak/explot aktif (GoldHEN/HEN aktif di dashboard).</li>
                      <li>Siapkan USB Flashdisk / Hardisk Eksternal dengan format file sistem <b>exFAT</b> (format FAT32 tidak didukung karena file game PS4 biasanya berukuran &gt;4GB).</li>
                      <li>Copy file game berformat <code>.pkg</code> ke direktori terluar (root) USB Flashdisk.</li>
                      <li>Hubungkan USB Flashdisk ke salah satu port USB di PS4.</li>
                      <li>Masuk ke menu <b>Settings</b> di PS4 &gt; scroll ke paling bawah dan buka menu <b>Debug Settings</b> (atau menu <b>GoldHEN</b>).</li>
                      <li>Pilih menu <b>Game</b> &gt; <b>Package Installer</b>.</li>
                      <li>Pilih file game <code>.pkg</code> yang ingin diinstal.
                        <div className="text-caption2 text-warning mt-1 italic font-semibold">
                          *Tips: Selalu instal file "Base Game" terlebih dahulu, diikuti dengan file "Update", kemudian file "DLC" (jika ada).
                        </div>
                      </li>
                      <li>Tunggu hingga proses instalasi di dashboard selesai. Ikon game akan muncul di halaman depan PS4 dan siap dimainkan.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Card 4: Hardisk External PNP PS4 */}
              <div className="border border-sep rounded-tile overflow-hidden">
                <div
                  className="p-3 apple-tile flex justify-between items-center cursor-pointer hover:bg-fill/70 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 4 ? null : 4)}
                >
                  <span className="font-semibold text-subhead text-label">CARA MEMBUAT HDD EXTERNAL PNP PS4</span>
                  <ChevronDown className={`w-4 h-4 text-label-3 transition-transform duration-200 ${sopExpanded === 4 ? "rotate-180" : ""}`} />
                </div>
                {sopExpanded === 4 && (
                  <div className="p-4 bg-surface border-t border-sep animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <Notice tone="info">
                      <span className="font-bold">Apa itu HDD External PNP (Plug and Play) PS4?</span>
                      <p className="mt-1">
                        Hardisk External PNP adalah media penyimpanan luar (USB 3.0) yang diformat khusus agar dapat langsung terdeteksi di PS4. Ada 2 tipe PNP:
                      </p>
                      <ul className="list-disc pl-4 mt-1.5 space-y-1">
                        <li><b>Tipe exFAT (Untuk Installer Game):</b> Bisa dibaca di PC/Laptop dan PS4. Berguna untuk memindahkan file game <code>.pkg</code> dari PC ke PS4 untuk diinstal.</li>
                        <li><b>Tipe Extended Storage (Untuk Langsung Main):</b> Diformat langsung oleh PS4. Game diinstal dan dimainkan langsung dari HDD eksternal ini, menghemat memori internal PS4 (tidak bisa dibaca di PC).</li>
                      </ul>
                    </Notice>

                    <div>
                      <h4 className="font-bold text-caption text-tint uppercase mb-1">A. Pembuatan Tipe exFAT (Untuk Copy &amp; Install PKG)</h4>
                      <ul className="list-decimal pl-5 space-y-1.5 text-footnote text-label-2">
                        <li>Hubungkan Hardisk Eksternal ke PC / Laptop Windows menggunakan port USB 3.0.</li>
                        <li>Buka <b>This PC</b> / <b>File Explorer</b> &gt; klik kanan pada drive Hardisk Eksternal tersebut, lalu pilih <b>Format...</b></li>
                        <li>Pada bagian <b>File System</b>, ubah nilainya menjadi <b>exFAT</b> (jangan pilih NTFS atau FAT32).</li>
                        <li>Pada bagian <b>Allocation Unit Size</b>, biarkan default, beri nama drive pada <i>Volume Label</i> (misal: "PS4-GAME"), centang <b>Quick Format</b>, lalu klik <b>Start</b>.</li>
                        <li>Setelah selesai format, buat folder atau langsung copy file game berformat <code>.pkg</code> ke direktori terluar (root) hardisk tersebut.</li>
                        <li>Eject hardisk dengan aman dari PC, lalu colokkan ke port USB PS4 HEN untuk mulai instalasi lewat <i>Package Installer</i>.</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-caption text-tint uppercase mb-1">B. Pembuatan Tipe Extended Storage (Untuk Simpan &amp; Main Langsung)</h4>
                      <ul className="list-decimal pl-5 space-y-1.5 text-footnote text-label-2">
                        <li>Pastikan Hardisk Eksternal mendukung minimal <b>USB 3.0</b> dengan kapasitas antara <b>250 GB - 8 TB</b>.</li>
                        <li>Hubungkan Hardisk Eksternal ke salah satu port USB di konsol PS4 Anda.</li>
                        <li>Di PS4, masuk ke menu <b>Settings</b> &gt; <b>Devices</b> &gt; <b>USB Storage Devices</b>.</li>
                        <li>Pilih nama Hardisk Eksternal Anda, lalu pilih opsi <b>Format as Extended Storage</b>.</li>
                        <li>Ikuti petunjuk di layar dan pilih <b>Next</b> lalu <b>Format</b>. Setelah selesai, hardisk Anda akan menjadi penyimpanan default baru untuk instalasi game.</li>
                        <li><span className="font-semibold text-warning">*Catatan:</span> Ketika Anda menginstal game <code>.pkg</code> via <i>Package Installer</i>, game tersebut akan otomatis terpasang dan berjalan langsung dari Hardisk Eksternal ini.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 5: Pengertian CFW, HEN, ODE, Matrix */}
              <div className="border border-sep rounded-tile overflow-hidden">
                <div
                  className="p-3 apple-tile flex justify-between items-center cursor-pointer hover:bg-fill/70 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 5 ? null : 5)}
                >
                  <span className="font-semibold text-subhead text-label">PENGERTIAN CFW, HEN, ODE, &amp; MATRIX</span>
                  <ChevronDown className={`w-4 h-4 text-label-3 transition-transform duration-200 ${sopExpanded === 5 ? "rotate-180" : ""}`} />
                </div>
                {sopExpanded === 5 && (
                  <div className="p-4 bg-surface border-t border-sep animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <div className="text-caption text-label-2 leading-relaxed">
                      Berikut adalah istilah modifikasi/jailbreak yang umum digunakan pada konsol PlayStation (PS2, PS3, dan PS4):
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h4 className="font-bold text-caption text-tint uppercase">1. CFW (Custom Firmware)</h4>
                        <p className="text-footnote text-label-2 mt-0.5">
                          Sistem operasi (firmware) konsol yang sudah dimodifikasi secara permanen agar bisa menjalankan homebrew dan game bajakan langsung dari HDD.
                          <br /><b>Kelebihan:</b> Permanen (tidak perlu diaktifkan ulang setelah PS dimatikan), fitur sangat lengkap (control fan, temperatur, dll).
                          <br /><b>Penerapan:</b> Hanya tersedia di <b>PS3</b> tipe Fat dan Slim seri tertentu (seri 20xx/21xx/25xx dengan minver down 3.56). Di PS4 tidak ada istilah CFW murni.
                        </p>
                      </div>

                      <div className="border-t border-sep pt-3">
                        <h4 className="font-bold text-caption text-tint uppercase">2. HEN (Homebrew Enabler)</h4>
                        <p className="text-footnote text-label-2 mt-0.5">
                          Jailbreak berbasis software (aplikasi/browser exploit) yang bersifat non-permanen. Fitur jailbreak hanya aktif selama konsol menyala.
                          <br /><b>Karakteristik:</b> Setiap kali konsol dinyalakan atau di-restart, Anda <b>wajib mengaktifkan HEN terlebih dahulu</b> (klik ikon "Enable HEN" di PS3 atau buka exploit via browser/PPPwn di PS4). Jika tidak, game bajakan tidak akan bisa dibuka.
                          <br /><b>Penerapan:</b> Digunakan pada <b>PS3</b> Slim seri akhir (30xx) / Super Slim (40xx) yang tidak bisa dipasang CFW, serta semua jenis exploit di <b>PS4</b> (GoldHEN).
                        </p>
                      </div>

                      <div className="border-t border-sep pt-3">
                        <h4 className="font-bold text-caption text-tint uppercase">3. ODE (Optical Drive Emulator)</h4>
                        <p className="text-footnote text-label-2 mt-0.5">
                          Modifikasi berbasis hardware (perangkat keras tambahan berupa chip emulasi) yang dipasang untuk memanipulasi pembacaan Bluray Drive agar konsol membaca game dari hardisk eksternal.
                          <br /><b>Karakteristik:</b> Sangat populer dulu untuk membobol PS3 seri Super Slim sebelum HEN ditemukan. Saat ini sudah jarang digunakan karena HEN gratis dan lebih praktis.
                          <br /><b>Penerapan:</b> Umumnya dipasang di <b>PS3</b> Fat/Slim/Super Slim.
                        </p>
                      </div>

                      <div className="border-t border-sep pt-3">
                        <h4 className="font-bold text-caption text-tint uppercase">4. MATRIX (Modchip PS2)</h4>
                        <p className="text-footnote text-label-2 mt-0.5">
                          Modchip (IC tambahan) yang disolder pada motherboard PS2 untuk membypass proteksi region lock dan membolehkan pembacaan kaset bajakan.
                          <br /><b>Penerapan di Hardisk:</b> Di rental/toko Indonesia, "PS2 Matrix" berarti PS2 yang dipasang chip Matrix v5.0 (atau sejenis) agar saat dinyalakan langsung otomatis melakukan boot ke <b>Open PS2 Loader (OPL)</b> dari hardisk eksternal/internal tanpa memerlukan MC Boot (memory card exploit).
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Card 6: Cara HEN BD-JB PS4 */}
              <div className="border border-sep rounded-tile overflow-hidden">
                <div
                  className="p-3 apple-tile flex justify-between items-center cursor-pointer hover:bg-fill/70 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 6 ? null : 6)}
                >
                  <span className="font-semibold text-subhead text-label">CARA HEN BD-JB PS4 (FW 9.00 - 11.00+)</span>
                  <ChevronDown className={`w-4 h-4 text-label-3 transition-transform duration-200 ${sopExpanded === 6 ? "rotate-180" : ""}`} />
                </div>
                {sopExpanded === 6 && (
                  <div className="p-4 bg-surface border-t border-sep animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <Notice tone="warning">
                      <span className="font-semibold">Informasi Awal (Asumsi Sudah Memiliki Kaset BD-JB):</span>
                      <p className="mt-1">
                        Panduan ini ditujukan bagi Anda yang sudah memiliki kaset Blu-ray Disc khusus exploit BD-JB (biasanya dibeli pre-burn/siap pakai di toko online). Anda tidak perlu melakukan burning disc lagi di PC.
                      </p>
                    </Notice>

                    <ul className="list-decimal pl-5 space-y-2 text-footnote text-label-2">
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
                      <li><span className="font-semibold text-warning">*Tips Rental:</span> Agar tidak perlu memancing ulang exploit setiap kali PS4 dinyalakan, gunakan fitur <b>Rest Mode</b> (Mode Istirahat) saat mematikan PS4. Selama konsol tidak mati total, status HEN akan tetap aktif.</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Card 7: Cara Install HEN di PS3 */}
              <div className="border border-sep rounded-tile overflow-hidden">
                <div
                  className="p-3 apple-tile flex justify-between items-center cursor-pointer hover:bg-fill/70 transition-colors"
                  onClick={() => setSopExpanded(sopExpanded === 7 ? null : 7)}
                >
                  <span className="font-semibold text-subhead text-label">CARA INSTALL HEN DI PS3 (FW 4.90 / 4.91 HFW)</span>
                  <ChevronDown className={`w-4 h-4 text-label-3 transition-transform duration-200 ${sopExpanded === 7 ? "rotate-180" : ""}`} />
                </div>
                {sopExpanded === 7 && (
                  <div className="p-4 bg-surface border-t border-sep animate-in slide-in-from-top-2 duration-200 space-y-4">
                    <Notice tone="info">
                      <b>Catatan:</b> Proses instalasi HEN terbagi menjadi 2 tahap besar, yaitu <b>install Hybrid Firmware (HFW)</b> terlebih dahulu lewat USB flashdisk, kemudian mengaktifkan <b>explot HEN via Browser internet PS3</b>.
                    </Notice>

                    <div>
                      <h4 className="font-bold text-caption text-tint uppercase mb-1">Tahap 1: Instalasi Hybrid Firmware (HFW)</h4>
                      <ul className="list-decimal pl-5 space-y-1.5 text-footnote text-label-2">
                        <li>Siapkan USB Flashdisk (format ke <b>FAT32</b>).</li>
                        <li>Download file HFW yang sesuai dengan versi sistem Anda (misal: 4.91 HFW).</li>
                        <li>Di dalam flashdisk, buat struktur folder: <code>PS3</code> &gt; <code>UPDATE</code> (gunakan huruf kapital).</li>
                        <li>Copy/salin file HFW ke dalam folder <code>UPDATE</code> dan ubah nama filenya menjadi <code>PS3UPDAT.PUP</code>.</li>
                        <li>Hubungkan USB Flashdisk ke port USB kanan PS3, masuk ke menu <b>Settings</b> &gt; <b>System Update</b> &gt; <b>Update via Storage Media</b>. Ikuti petunjuk untuk menyelesaikan update. *(Disarankan install HFW 2x berturut-turut agar instalasi bersih).*</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-bold text-caption text-tint uppercase mb-1">Tahap 2: Pemasangan PS3HEN via Web Browser</h4>
                      <ul className="list-decimal pl-5 space-y-1.5 text-footnote text-label-2">
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
            <div className="w-16 h-16 bg-action text-action-label rounded-card mx-auto shadow-card flex items-center justify-center">
              <Gamepad2 size={32} />
            </div>
            <div>
              <h3 className="text-title3 font-bold text-label">URBAN Console</h3>
              <div className="text-caption font-medium text-label-2 mt-0.5 tabular-nums">Build v{versionData.version}</div>
            </div>
          </div>

          {/* 2. Content Wrapper (Scrollable Box) */}
          <IOSGroup title="Informasi & Panduan" className="mb-0">
            <div className="max-h-[380px] overflow-y-auto p-5 scrollbar-ios">
              <h4 className="text-subhead font-semibold text-label flex items-center gap-2 mb-2">
                <Pin size={16} className="text-label-2 shrink-0" /> Tentang Aplikasi
              </h4>
              <p className="text-subhead leading-relaxed text-label-2 mb-6">
                Aplikasi ini digunakan untuk mencatat transaksi, pemasukan, dan pengeluaran <b>URBAN PlayStation Lampung</b>. Aplikasi bersifat pribadi untuk kebutuhan internal.
              </p>

              <h4 className="text-subhead font-semibold text-label flex items-center gap-2 mb-2">
                <BookOpen size={16} className="text-label-2 shrink-0" /> Panduan Singkat
              </h4>
              <div className="text-subhead leading-relaxed text-label-2 space-y-3 mb-6">
                <p>
                  Aplikasi ini sudah dilengkapi fitur <b>penjumlahan otomatis</b>, <b>grafik</b>, <b>tarik data</b>, <b>backup &amp; restore</b>, <b>filter tanggal</b>, serta pilihan <b>tema Gelap/Terang</b>.
                </p>
                <ul className="list-disc ml-4 space-y-1.5 marker:text-label-3">
                  <li>Untuk <b>mengganti tema</b>, tekan tombol <b>Gelap/Terang</b> di pojok kanan atas.</li>
                  <li>Menambah atau mengedit item rincian (PS, jajanan, jasa, sewa) bisa diakses melalui menu <b>Edit Rincian</b>.</li>
                  <li><b>Backup seluruh data</b> bisa dilakukan lewat menu <b>Backup &amp; Restore Data</b>.</li>
                  <li><b>Ekspor data ke CSV</b> dapat diakses pada menu <b>Export Data</b>.</li>
                  <li><b>Reset Setting</b> tersedia di menu <b>Reset Setting</b> untuk mengembalikan pengaturan default (data transaksi tetap aman).</li>
                </ul>
                <Notice tone="warning" className="mt-2">
                  <div className="flex gap-2 items-start">
                    <Lightbulb size={15} className="shrink-0 mt-0.5" />
                    <span><b>Tips:</b> Jangan lupa lakukan backup data secara berkala agar catatan tidak hilang.</span>
                  </div>
                </Notice>
              </div>

              <h4 className="text-subhead font-semibold text-label flex items-center gap-2 mb-2">
                <Phone size={16} className="text-label-2 shrink-0" /> Kontak
              </h4>
              <div className="text-subhead text-label-2">
                <div className="font-medium text-label">URBAN PlayStation Lampung</div>
                <div>Telp/WA: <span className="text-tint font-medium tabular-nums">085709647790</span></div>
              </div>
            </div>
          </IOSGroup>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-black/40 dark:bg-black/75 backdrop-blur-[8px] transition-all duration-300">
      <style dangerouslySetInnerHTML={{__html: `
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

      <div className="w-full h-full md:h-[640px] md:max-w-[850px] apple-sheet-grouped md:border md:border-white/50 md:dark:border-white/[0.12] md:rounded-[32px] shadow-float ring-1 ring-black/10 dark:ring-white/15 overflow-hidden flex flex-col md:flex-row">

        {/* SIDEBAR (Desktop) */}
        <div className="hidden md:flex flex-col w-[260px] apple-bar border-r border-sep py-5 px-3">
          <div className="px-3 mb-5"><h2 className="text-title2 text-label tracking-tight">Pengaturan</h2></div>

          {/* iOS Profile Head (Desktop) */}
          <div className="px-1 mb-4">
            <button
              type="button"
              onClick={() => setTab("profile")}
              className={`w-full text-left apple-card rounded-tile p-3 flex items-center gap-3 cursor-pointer shadow-card ring-1 ring-edge transition-all ${
                tab === "profile" ? "ring-2 ring-tint border-transparent" : "hover:bg-fill/40"
              }`}
            >
              <div
                className="w-11 h-11 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-edge shadow-card"
                style={{ backgroundColor: userProfilePic ? undefined : (userProfileColor || "#0088FF") }}
              >
                {userProfilePic ? (
                  <img src={userProfilePic} alt="Foto profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-white text-sm uppercase">
                    {(userEmail?.split("@")[0] || "U").substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 w-0">
                <h3 className="text-subhead font-bold text-label truncate leading-tight">{userEmail?.split("@")[0] || "User"}</h3>
                <p className="text-caption2 text-label-2 truncate leading-tight mt-0.5">Edit akun, cek detail...</p>
              </div>
              <ChevronRight className="w-4 h-4 text-label-3 mr-0.5 shrink-0" />
            </button>
          </div>

          <div className="space-y-1 flex-1 overflow-y-auto scrollbar-ios">
            {menu.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setTab(m.key)}
                className={`w-full min-h-[42px] flex items-center gap-3 px-3 py-2 rounded-full text-subhead transition-colors ${
                  tab === m.key
                    ? "bg-surface dark:bg-white/[0.12] text-tint dark:text-[#45ADFF] font-semibold shadow-card"
                    : "text-label-2 font-medium hover:bg-fill/60 hover:text-label"
                }`}
              >
                <IconBadge color={m.color} className="w-6 h-6 rounded-[6px] sidebar-icon-squircle [&>svg]:h-3.5 [&>svg]:w-3.5">
                  {m.icon}
                </IconBadge>
                <span className="truncate">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MOBILE MENU */}
        <div className={`flex flex-col flex-1 bg-transparent h-full md:hidden ${mobileView === "content" ? "hidden" : "flex"}`}>
          <div className="px-5 py-4 apple-bar sticky top-0 z-10 border-b border-sep flex justify-between items-center">
            <h2 className="text-title2 text-label">Pengaturan</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Pengaturan"
              className="w-8 h-8 rounded-full bg-fill flex items-center justify-center text-label-2 hover:text-label transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 scrollbar-ios">
            <IOSGroup className="!mb-6">
              <button
                type="button"
                onClick={() => { setTab("profile"); setMobileView("content"); }}
                className="w-full p-4 flex flex-row items-center gap-4 text-left active:bg-fill/60 transition-colors"
              >
                <div
                  className="w-16 h-16 rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-edge shadow-card"
                  style={{ backgroundColor: userProfilePic ? undefined : (userProfileColor || "#0088FF") }}
                >
                  {userProfilePic ? (
                    <img src={userProfilePic} alt="Foto profil" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-white text-xl uppercase">
                      {(userEmail?.split("@")[0] || "U").substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-title3 font-bold text-label truncate">{userEmail?.split("@")[0] || "User"}</h3>
                  <p className="text-footnote text-label-2 truncate mt-0.5">Edit akun, cek detail...</p>
                </div>
                <ChevronRight className="w-5 h-5 text-label-3 mr-1 shrink-0" />
              </button>
            </IOSGroup>

            <IOSGroup>{menu.map((m) => (<IOSRow key={m.key} label={m.label} icon={m.icon} iconColor={m.color} onClick={() => { setTab(m.key); setMobileView("content"); }} />))}</IOSGroup>
            <IOSGroup><IOSRow label="Tutup Pengaturan" icon={<X size={16} />} iconColor="gray" chevron={false} onClick={onClose} /></IOSGroup>
          </div>
        </div>

        {/* CONTENT */}
        <div className={`flex flex-col flex-1 bg-transparent h-full overflow-hidden ${mobileView === "menu" ? "hidden md:flex" : "flex"}`}>
          <div className="shrink-0 h-14 md:h-16 px-4 md:px-7 border-b border-sep flex items-center justify-between apple-bar">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setMobileView("menu")}
                className="md:hidden text-tint flex items-center gap-0.5 font-normal text-callout -ml-2 pr-2 active:opacity-60 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" /> Kembali
              </button>
              <h3 className="text-headline md:text-title3 text-label truncate">
                {tab === "profile" ? "Akun" : menu.find((m) => m.key === tab)?.label}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-fill text-label-2 hover:text-label transition-colors"
              title="Tutup (Esc)"
              aria-label="Tutup Pengaturan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 md:p-7 scrollbar-ios">
            <div className="max-w-2xl mx-auto md:mx-0">
              <div key={tab} className="animate-tab-change">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {aksiAman && (
        <KonfirmasiAkun
          judul={AKSI_AMAN[aksiAman].judul}
          pesan={AKSI_AMAN[aksiAman].pesan}
          labelTombol={AKSI_AMAN[aksiAman].tombol}
          bahaya={AKSI_AMAN[aksiAman].bahaya}
          // Pemilih file harus dibuka dari ketukan langsung (diblokir browser HP sesudah menunggu jaringan)
          langkahLanjut={aksiAman === "restore" ? { pesan: "Password benar. Pilih file backup URBAN (.json). Pembukuan dengan tanggal yang sama akan ditimpa.", labelTombol: "Pilih File" } : undefined}
          onBatal={() => setAksiAman(null)}
          onBerhasil={() => jalankanAksiAman(aksiAman)}
        />
      )}

      <AlertDialog
        open={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        title="Keluar dari akun?"
        description="Yakin ingin keluar dari akun Admin?"
        icon={<LogOut />}
        iconColor="red"
        zClassName="z-[270]"
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setConfirmLogoutOpen(false) },
          {
            label: "Keluar",
            role: "destructive",
            onClick: () => {
              setConfirmLogoutOpen(false);
              runOrAlert(onLogout);
            },
          },
        ]}
      />

      <AlertDialog
        open={!!deleteAsistenId}
        onClose={() => !isLoading && setDeleteAsistenId(null)}
        title="Hapus pengingat asisten?"
        description="Pengingat pengeluaran bulanan ini akan dihapus permanen."
        icon={<AlertTriangle />}
        iconColor="red"
        dismissible={!isLoading}
        zClassName="z-[270]"
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setDeleteAsistenId(null), disabled: isLoading },
          { label: isLoading ? "Menghapus..." : "Hapus", role: "destructive", onClick: konfirmasiHapusAsisten, disabled: isLoading },
        ]}
      />

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(24px+env(safe-area-inset-bottom))] z-[400] px-4 py-2.5 rounded-full bg-action text-action-label text-subhead font-medium shadow-float max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
};

export default Pengaturan;