import React from "react";
import { createPortal } from "react-dom";
import { rupiah, toInt, formatRibuanInput } from "../lib/format";
import { AKSEN_ONGKIR, AKSEN_TILE, AlertDialog, Amount, Button, Card, ImagePreviewModal, MOTION, Pill, type WarnaIkon } from "../ui";
import {
  Clock,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Camera,
  Loader2,
  Eye,
  Lock,
  Gamepad2,
  Coffee,
  Wrench,
  CalendarCheck2,
  Wallet,
  Receipt,
} from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";
import { toLocalYmd } from "../lib/dateLocal";

// --- TYPES & UTILS ---

type AnyRow = { [k: string]: any };

function fieldKind(key: string) {
  const k = key.toLowerCase();

  const isRealTime =
    (k === "jam" || k.includes("jam")) &&
    (k === "jam" ||
      k.includes("masuk") ||
      k.includes("keluar") ||
      k.includes("mulai") ||
      k.includes("selesai") ||
      k.includes("start") ||
      k.includes("end") ||
      k.includes("jual"));

  if (isRealTime) return "time" as const;

  if (
    k.includes("jumlah") ||
    k.includes("lama") ||
    k.includes("durasi") ||
    k.includes("hour") ||
    k.includes("qty")
  )
    return "number" as const;

  return "text" as const;
}


function getThemeColors(title: string): {
  iconColor: WarnaIkon;
  icon: React.ReactNode;
} {
  const t = (title || "").toLowerCase();

  if (t.includes("jajanan")) {
    return { iconColor: "orange", icon: <Coffee size={17} /> };
  }
  if (t.includes("harian")) {
    return { iconColor: "teal", icon: <Gamepad2 size={17} /> };
  }
  if (t.includes("sewa")) {
    return { iconColor: "blue", icon: <CalendarCheck2 size={17} /> };
  }
  if (t.includes("jasa") || t.includes("aksesoris") || t.includes("usaha")) {
    return { iconColor: "red", icon: <Wrench size={17} /> };
  }
  if (t.includes("pengeluaran")) {
    return { iconColor: "red", icon: <Wallet size={17} /> };
  }
  if (t.includes("setoran")) {
    return { iconColor: "teal", icon: <Wallet size={17} /> };
  }

  return { iconColor: "gray", icon: <Receipt size={17} /> };
}

function parseBayar(val: any): Set<string> {
  if (typeof val !== "string") return new Set();
  const v = val.trim();
  if (!v) return new Set();
  return new Set(v.split(",").map((s) => s.trim()));
}

export type RenderCellArgs<T> = {
  keyName: string;
  kind: "time" | "number" | "text";
  value: any;
  row: T;
  rowIndex: number;
  inputBase: string;
  isMobile: boolean;
  onKeyNav: (e: React.KeyboardEvent<any>) => void;
  updateRow: (idx: number, patch: Partial<T>) => void;
};

/** Kelas visual field tabel tanpa memaksa w-full supaya AutoFit dapat mengecilkan/memanjangkan lebar sesuai teks. */
export const TABLE_INPUT_VISUAL =
  "h-[44px] min-h-[44px] px-3 rounded-control bg-transparent border border-transparent hover:border-sep focus:bg-surface focus:border-tint/40 focus:outline-none focus:ring-2 focus:ring-tint/25 transition duration-150 text-[16px] sm:text-subhead text-label placeholder:text-label-3";

function extractMirrorClasses(cls: string) {
  return cls
    .split(/\s+/)
    .filter((token) =>
      /^(?:(?:sm|md|lg):)?(?:text-\[|text-(?:xs|sm|base|lg|subhead|footnote|caption2?|headline)|font-(?:sans|mono|normal|medium|semibold|bold)|tracking-|px-|pl-|pr-|py-)/.test(
        token
      )
    )
    .join(" ");
}

function textFromNode(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textFromNode(node.props?.children);
  }
  return "";
}

function collectOptionTexts(children: React.ReactNode): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  React.Children.forEach(children, (child) => {
    if (!child) return;
    if (Array.isArray(child)) {
      out.push(...collectOptionTexts(child));
      return;
    }
    if (React.isValidElement<{ value?: any; children?: React.ReactNode }>(child)) {
      if (child.type === "option") {
        const val = child.props.value !== undefined ? String(child.props.value) : textFromNode(child.props.children);
        out.push({ value: val, label: textFromNode(child.props.children) });
      } else if (child.props?.children) {
        out.push(...collectOptionTexts(child.props.children));
      }
    }
  });
  return out;
}

export type AutoFitInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  isMobile?: boolean;
  prefixText?: string;
  prefixOffsetClass?: string;
  minSample?: string;
  containerClassName?: string;
  rightAdornment?: React.ReactNode;
};

/** Input tabel adaptif: selebar kartu di mobile, menyesuaikan isi/placeholder secara otomatis di mode tabel klasik. */
export const AutoFitInput: React.FC<AutoFitInputProps> = ({
  isMobile = false,
  prefixText,
  prefixOffsetClass = "left-3",
  minSample = "",
  containerClassName = "",
  rightAdornment,
  className = "",
  value,
  placeholder,
  type,
  ...rest
}) => {
  const valStr = value === undefined || value === null ? "" : String(value);
  const phStr = String(placeholder ?? "");
  const longest = valStr.length >= phStr.length ? valStr : phStr;
  const sample =
    type === "time"
      ? "00:00"
      : longest.length >= minSample.length
        ? longest
        : minSample;
  const mirrorStr =
    type === "time"
      ? `${sample}   `
      : type === "number"
        ? `${sample}  `
        : `${sample || " "} `;

  const prefixPad = prefixText && !/\bpl-/.test(className) ? "pl-9" : "";
  const extraMirrorCls = extractMirrorClasses(className);
  const rightInputPad = rightAdornment && !/\bpr-/.test(className) ? "pr-9" : "";
  const rightMirrorPad = type === "time" || rightAdornment ? (!/\bpr-/.test(className) ? "pr-9" : "") : "";

  if (isMobile) {
    return (
      <div className={`relative w-full ${containerClassName}`}>
        {prefixText && (
          <span className={`z-[1] absolute ${prefixOffsetClass} top-1/2 -translate-y-1/2 text-caption text-label-3 font-semibold select-none pointer-events-none`}>
            {prefixText}
          </span>
        )}
        <input
          size={1}
          type={type}
          value={value}
          placeholder={placeholder}
          className={`w-full ${TABLE_INPUT_VISUAL} ${prefixPad} ${rightInputPad} ${className}`}
          {...rest}
        />
        {rightAdornment}
      </div>
    );
  }

  return (
    <div className={`relative inline-grid items-center min-w-full ${containerClassName}`}>
      {prefixText && (
        <span className={`z-[1] absolute ${prefixOffsetClass} top-1/2 -translate-y-1/2 text-caption text-label-3 font-semibold select-none pointer-events-none`}>
          {prefixText}
        </span>
      )}
      <span
        aria-hidden
        className={`col-start-1 row-start-1 invisible pointer-events-none whitespace-pre min-h-[44px] flex items-center px-3 border border-transparent text-[16px] sm:text-subhead ${prefixPad} ${extraMirrorCls} ${rightMirrorPad}`}
      >
        {mirrorStr}
      </span>
      <input
        size={1}
        type={type}
        value={value}
        placeholder={placeholder}
        className={`col-start-1 row-start-1 absolute inset-0 w-full h-full ${TABLE_INPUT_VISUAL} ${prefixPad} ${rightInputPad} ${className}`}
        {...rest}
      />
      {rightAdornment}
    </div>
  );
};

export type AutoFitSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  isMobile?: boolean;
  containerClassName?: string;
};

/** Dropdown tabel adaptif: menyempit saat opsi singkat dan melebar otomatis agar seluruh teks opsi terpilih selalu terbaca. */
export const AutoFitSelect: React.FC<AutoFitSelectProps> = ({
  isMobile = false,
  containerClassName = "",
  className = "",
  value,
  children,
  ...rest
}) => {
  const options = React.useMemo(() => collectOptionTexts(children), [children]);
  const valStr = value === undefined || value === null ? "" : String(value);
  const selected = options.find((o) => o.value === valStr) ?? options[0];
  const displayLabel = selected?.label || "Pilih...";
  const extraMirrorCls = extractMirrorClasses(className);

  if (isMobile) {
    return (
      <div className={`relative w-full ${containerClassName}`}>
        <select
          value={value}
          className={`w-full ${TABLE_INPUT_VISUAL} appearance-none pr-8 cursor-pointer ${className}`}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="z-[1] absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-label-3 pointer-events-none" />
      </div>
    );
  }

  return (
    <div className={`relative inline-grid items-center min-w-full ${containerClassName}`}>
      <span
        aria-hidden
        className={`col-start-1 row-start-1 invisible pointer-events-none whitespace-pre min-h-[44px] flex items-center px-3 border border-transparent text-[16px] sm:text-subhead ${extraMirrorCls} pr-9`}
      >
        {displayLabel}
      </span>
      <select
        value={value}
        className={`col-start-1 row-start-1 absolute inset-0 w-full h-full ${TABLE_INPUT_VISUAL} appearance-none pr-8 cursor-pointer ${className}`}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown className="z-[1] absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-label-3 pointer-events-none" />
    </div>
  );
};

const SwipeableRow = ({ isMobile, className, style, children, onSwipe, disabled }: any) => {
  const [swipeX, setSwipeX] = React.useState(0);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const touchStartX = React.useRef(0);

  if (!isMobile) {
     return <tr className={className} style={style}>{children}</tr>;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || !isMobile) return;
    touchStartX.current = e.touches[0].clientX;
    setIsAnimating(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || !isMobile) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    setSwipeX(diff);
  };

  const handleTouchEnd = () => {
    if (disabled || !isMobile) return;
    setIsAnimating(true);
    if (Math.abs(swipeX) > 100) {
      onSwipe();
    }
    setSwipeX(0);
  };

  const opacity = Math.max(0.2, 1 - Math.abs(swipeX) / 150);
  const isSwiping = Math.abs(swipeX) > 20;

  return (
    <tr
      className={`${className} ${isSwiping ? "!bg-negative/20 dark:!bg-negative/30 !ring-negative/50" : ""}`}
      style={{
        ...style,
        ...(swipeX !== 0 ? { transform: `translateX(${swipeX}px)` } : {}),
        ...(isSwiping ? { opacity } : {}),
        transition: isAnimating ? "transform 0.3s ease-out, opacity 0.3s ease-out, background-color 0.3s ease-out" : "none"
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {children}
    </tr>
  );
};

// --- UPLOAD TRANSFER PROOF COMPONENT ---

interface UploadTransferProofProps {
  value?: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export const UploadTransferProof: React.FC<UploadTransferProofProps> = ({ value, onChange, disabled }) => {
  const [uploading, setUploading] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [uploadAlert, setUploadAlert] = React.useState("");

  React.useEffect(() => {
    if (!showPreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPreview(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPreview]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadAlert("Format berkas harus berupa gambar (JPEG/PNG/WEBP).");
      return;
    }

    try {
      setUploading(true);

      const dateStr = toLocalYmd();
      const timeStr = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const path = `bukti_transfer/${dateStr}/${timeStr}_${safeName}`;

      const downloadUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 1000;
            const MAX_HEIGHT = 1000;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              async (blob) => {
                if (!blob) {
                  reject(new Error("Canvas compression failed"));
                  return;
                }
                try {
                  const fileRef = ref(storage, path);
                  await uploadBytes(fileRef, blob);
                  const url = await getDownloadURL(fileRef);
                  resolve(url);
                } catch (err) {
                  reject(err);
                }
              },
              "image/jpeg",
              0.7
            );
          };
          img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
      });

      onChange(downloadUrl);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadAlert("Gagal mengunggah bukti transfer. Silakan coba lagi.");
    } finally {
      setUploading(false);
    }
  };

  const dialogPortal = (uploadAlert || confirmDelete)
    ? createPortal(
        <>
          <AlertDialog
            open={!!uploadAlert}
            onClose={() => setUploadAlert("")}
            zClassName="z-[10000]"
            icon={<AlertCircle />}
            iconColor="red"
            title="Upload Gagal"
            description={uploadAlert}
            actions={[{ label: "Mengerti", role: "primary", onClick: () => setUploadAlert("") }]}
          />
          <AlertDialog
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            zClassName="z-[10000]"
            icon={<Trash2 />}
            iconColor="red"
            title="Hapus Bukti Transfer?"
            description="Lampiran foto bukti transfer ini akan dihapus dari baris."
            actions={[
              { label: "Batal", role: "cancel", onClick: () => setConfirmDelete(false) },
              {
                label: "Hapus",
                role: "destructive",
                onClick: () => {
                  onChange("");
                  setConfirmDelete(false);
                  setShowPreview(false);
                },
              },
            ]}
          />
        </>,
        document.body
      )
    : null;

  if (uploading) {
    return (
      <>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tint/10 text-tint flex-shrink-0 shadow-sm animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        {dialogPortal}
      </>
    );
  }

  if (value) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          title="Lihat bukti transfer"
          aria-label="Lihat bukti transfer"
          className="relative h-9 w-9 rounded-full overflow-hidden ring-2 ring-tint active:scale-95 transition cursor-pointer shrink-0 group"
        >
          <img src={value} alt="Bukti" className="h-full w-full object-cover" />
          <span className="absolute inset-0 bg-black/10 group-hover:bg-black/30 flex items-center justify-center transition-colors">
            <Eye size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </button>

        <ImagePreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          src={value}
          title="Pratinjau Bukti Transfer"
          alt="Bukti Transfer"
          onDelete={() => setConfirmDelete(true)}
          deleteLabel="Hapus Bukti"
          deleteDisabled={disabled}
          zClassName="z-[9999]"
        />
        {dialogPortal}
      </>
    );
  }

  return (
    <>
      <label
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-tint/10 text-tint hover:bg-tint/15 dark:bg-tint/15 active:scale-95 transition cursor-pointer shrink-0 ${disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
        title="Upload Bukti Transfer"
      >
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={handleFileChange}
        />
        <Camera size={17} />
      </label>
      {dialogPortal}
    </>
  );
};

// --- MAIN COMPONENT ---

/** Baris otomatis (mis. dari nota POS): tampil di dalam tabel, hanya-baca, tidak ikut rows/setRows. */
export type BarisTerkunci = {
  key: string;
  /** Isi sel per kolom (key dari `blank`) */
  nilai: Record<string, React.ReactNode>;
  bayar: string;
  /** URL bukti transfer (jika metode Transfer/QRIS dari POS) */
  buktiTransfer?: string;
  /** Label di kolom No. / kepala kartu, mis. "POS" */
  label: string;
  /** Info kecil di kepala kartu (mis. nomor nota & jam) */
  info?: string;
  /** Ringkasan di kepala kartu (mode kartu) */
  ringkasan: string;
  /** Isi kartu (mode kartu) */
  detail?: React.ReactNode;
  /** Tombol aksi kecil di kolom No. / kepala kartu (mis. buka nota POS) */
  renderNo?: () => React.ReactNode;
};

export type ExtraColumnDef<T> = {
  header: string;
  center?: boolean;
  mobileLabel?: string;
  render: (args: {
    row: T;
    rowIndex: number;
    locked: boolean;
    isMobile: boolean;
    inputBase: string;
    onKeyNav: (e: React.KeyboardEvent<any>) => void;
    updateRow: (idx: number, patch: Partial<T>) => void;
  }) => React.ReactNode;
};

export default function TableEditor<T extends AnyRow>(props: {
  title: string;
  columns: string[];
  rows: T[];
  setRows: React.Dispatch<React.SetStateAction<T[]>>;
  getHarga: (r: T) => number;
  onClear: () => void;
  blank: T;
  renderCell?: (args: RenderCellArgs<T>) => React.ReactNode | undefined;
  keyboardNav?: boolean;
  minRows?: number;
  isMobileTable?: boolean;
  /** Tambahan ke total header (mis. baris nota POS yang ditampilkan di luar tabel). */
  extraTotal?: number;
  /** Konten di antara judul dan tabel (mis. baris terkunci dari POS). */
  slotAtas?: React.ReactNode;
  /** Konten di bawah tabel (mis. ringkasan ongkir mode kartu). */
  slotBawahTable?: React.ReactNode;
  /** Footer tabel opsional (<tfoot>) untuk mode tabel klasik. */
  tableFooter?: React.ReactNode;
  /** Tombol kecil di kolom No. / kepala kartu (klik tidak membuka-tutup kartu). */
  renderNo?: (row: T, rowIndex: number) => React.ReactNode;
  /** Baris otomatis hanya-baca di bagian atas tabel (totalnya lewat extraTotal). */
  barisTerkunci?: BarisTerkunci[];
  /** Override subtitle kartu (mis. info ongkir atau rumus kalkulasi setoran). */
  subtitle?: string;
  /** Label nominal total di kanan atas (bawaan Total / Total Keluar). */
  totalLabel?: string;
  /** Placeholder per key field pada `blank`. */
  placeholders?: Record<string, string>;
  /** Menandai baris yang terkunci / otomatis (tidak bisa diubah atau dihapus). */
  isRowLocked?: (row: T, rowIndex: number) => boolean;
  /** Tetap izinkan upload bukti transfer meski baris terkunci (mis. auto-ongkir). */
  allowProofOnLocked?: boolean;
  /** Sembunyikan kolom Cash & Transfer standar (mis. Setoran pakai kolom khusus). */
  hidePayColumns?: boolean;
  /** Kolom tambahan sebelum Aksi (mis. "Sudah di TF?"). */
  extraColumns?: ExtraColumnDef<T>[];
  /** Sembunyikan kolom & tombol Reset/Hapus per baris. */
  hideRowActions?: boolean;
  /** Tampilkan tombol + Tambah Baris (bawaan true). */
  showAddRow?: boolean;
  /** Tampilkan tombol Reset tabel di pojok kiri bawah (bawaan true). */
  showReset?: boolean;
  /** Custom reset handler (mis. pertahankan baris otomatis saat reset). */
  onResetRows?: () => void;
}) {
  const {
    title,
    columns,
    rows,
    setRows,
    getHarga,
    onClear,
    blank,
    renderCell,
    keyboardNav = true,
    minRows = 1,
    isMobileTable = true,
    extraTotal = 0,
    slotAtas,
    slotBawahTable,
    tableFooter,
    renderNo,
    barisTerkunci = [],
    subtitle: subtitleProp,
    totalLabel: totalLabelProp,
    placeholders,
    isRowLocked,
    allowProofOnLocked = false,
    hidePayColumns = false,
    extraColumns = [],
    hideRowActions = false,
    showAddRow = true,
    showReset = true,
    onResetRows,
  } = props;

  const isMobile = isMobileTable; // Card mode for all screen sizes if 'Baru'
  const actualMinRows = minRows;

  // Mendapatkan tema warna berdasarkan Judul Tabel
  const theme = React.useMemo(() => getThemeColors(title), [title]);
  const total = React.useMemo(
    () => rows.reduce((s, r) => s + getHarga(r), 0) + (Number(extraTotal) || 0),
    [rows, getHarga, extraTotal]
  );

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [showPayErrors, setShowPayErrors] = React.useState(false);
  const [showPayAlert, setShowPayAlert] = React.useState(false);
  const [resetConfirm, setResetConfirm] = React.useState<{ type: "table" } | { type: "row"; index: number } | null>(null);
  const [expandedRows, setExpandedRows] = React.useState<number[]>([]);

  const catAccent = AKSEN_TILE[theme.iconColor];

  const filledRowsCount = React.useMemo(() => {
    return rows.filter((r) => {
      if (getHarga(r) > 0) return true;
      return Object.keys(blank).some((k) => {
        if (k.startsWith("_") || k === "harga" || k === "bayar" || k === "buktiTransfer") return false;
        const val = String((r as any)[k] ?? "").trim();
        const base = String((blank as any)[k] ?? "").trim();
        return val !== "" && val !== base;
      });
    }).length;
  }, [rows, blank, getHarga]);

  const subtitleText = React.useMemo(
    () =>
      subtitleProp ??
      ([
        filledRowsCount > 0 ? `${filledRowsCount} transaksi terisi` : "Belum ada transaksi",
        barisTerkunci.length > 0 ? `${barisTerkunci.length} POS` : "",
      ]
        .filter(Boolean)
        .join(" · ")),
    [subtitleProp, filledRowsCount, barisTerkunci.length]
  );

  const isAlwaysExpanded = title.toLowerCase().includes("pengeluaran") || title.toLowerCase().includes("setoran");

  const isExpanded = React.useCallback(
    (rowIndex: number) => isAlwaysExpanded || !isMobile || expandedRows.includes(rowIndex),
    [isMobile, expandedRows, isAlwaysExpanded]
  );

  const toggleExpand = (rowIndex: number) => {
    setExpandedRows((prev) =>
      prev.includes(rowIndex)
        ? prev.filter((id) => id !== rowIndex)
        : [...prev, rowIndex]
    );
  };

  // Header Table frosted glass + garis aksen kategori halus
  const thBase = `apple-bar px-3 py-3 text-caption font-semibold uppercase tracking-[0.05em] text-label-2 whitespace-nowrap sticky top-0 z-10 border-b border-sep`;

  const inputBase = `w-full ${TABLE_INPUT_VISUAL}`;

  React.useEffect(() => {
    if (rows.length < actualMinRows) {
      setRows((prev) => {
        if (prev.length >= actualMinRows) return prev;
        const deficit = actualMinRows - prev.length;
        const newRows = Array(deficit)
          .fill(null)
          .map(() => ({ ...blank }));
        return [...prev, ...newRows];
      });
    }
  }, [rows.length, actualMinRows, blank, setRows]);

  const handleReset = () => {
    if (onResetRows) {
      onResetRows();
      setExpandedRows([]);
      return;
    }
    const resetRows = Array.from({ length: actualMinRows }, () => ({ ...blank }));
    setRows(resetRows);
  };

  const isHargaKeluar = React.useCallback(
    (row: AnyRow) => {
      const h1 =
        typeof row.harga === "number" ? row.harga : toInt(String(row.harga ?? ""));
      const h2 = getHarga(row as any);
      return (h2 ?? 0) > 0 || h1 > 0;
    },
    [getHarga]
  );

  const invalidPayRows = React.useMemo(() => {
    if (hidePayColumns) return [];
    const out: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      if (isRowLocked?.(row, i)) continue;
      if (!isHargaKeluar(row)) continue;
      if (parseBayar(row.bayar).size === 0) out.push(i);
    }
    return out;
  }, [rows, isHargaKeluar, hidePayColumns, isRowLocked]);

  React.useEffect(() => {
    if (invalidPayRows.length > 0) setShowPayErrors(true);
  }, [invalidPayRows]);

  const updateRow = (rowIndex: number, patch: Partial<T>) =>
    setRows((prev) =>
      prev.map((row, idx) => (idx === rowIndex ? ({ ...row, ...patch } as T) : row))
    );

  const focusMove = React.useCallback((current: HTMLElement, dir: 1 | -1) => {
    const root = wrapRef.current;
    if (!root) return;
    const fields = Array.from(
      root.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(
        "input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])"
      )
    ).filter((el) => {
      const type = (el as HTMLInputElement).type;
      return !(type === "button" || type === "submit" || type === "reset");
    });
    const idx = fields.findIndex((el) => el === current);
    if (idx < 0) return;
    const nextIdx = Math.max(0, Math.min(fields.length - 1, idx + dir));
    const next = fields[nextIdx];
    next?.focus();
    try {
      (next as HTMLInputElement).select();
    } catch {}
  }, []);

  const onKeyNav = (e: React.KeyboardEvent<any>) => {
    if (!keyboardNav) return;
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    focusMove(target, e.shiftKey ? -1 : 1);
  };

  const onAddRow = () => {
    if (invalidPayRows.length > 0) {
      setShowPayErrors(true);
      setShowPayAlert(true);
      return;
    }
    setRows((prev) => [...prev, { ...(blank as any) }]);
  };

  const onDeleteRow = (rowIndex: number) => {
    setRows((prev) => {
      const targetRow = prev[rowIndex];
      if (targetRow && isRowLocked?.(targetRow, rowIndex)) return prev;
      const unlockedCount = prev.filter((row, idx) => !isRowLocked?.(row, idx)).length;
      if (unlockedCount <= (actualMinRows || 1)) {
        // Jika tinggal minimum baris manual, reset nilainya alih-alih menghapus semua
        return prev.map((row, idx) => (idx === rowIndex ? ({ ...blank } as T) : row));
      }
      return prev.filter((_, idx) => idx !== rowIndex);
    });
    // Also remove from expanded list
    setExpandedRows((prev) => prev.filter((id) => id !== rowIndex).map(id => id > rowIndex ? id - 1 : id));
  };

  const getSmartSummary = React.useCallback((r: any) => {
    let text = "";
    
    // Fallback detection for summary
    const jenisKey = Object.keys(r).find(k => k.toLowerCase().includes("jenis") || k.toLowerCase() === "ps" || k.toLowerCase().includes("tipe") || k.toLowerCase().includes("ket"));
    if (jenisKey && (r[jenisKey] || r[jenisKey] !== "")) text += String(r[jenisKey]).toUpperCase() + " ";

    const qtyKey = Object.keys(r).find(k => k.toLowerCase().includes("lama") || k.toLowerCase().includes("qty") || k.toLowerCase().includes("jumlah"));
    if (qtyKey && r[qtyKey]) text += `(${r[qtyKey]})  `;

    const jamKey = Object.keys(r).find(k => k.toLowerCase() === "jam" || k.toLowerCase().includes("jammasuk") || k.toLowerCase().includes("waktu"));
    if (jamKey && r[jamKey]) text += `@${r[jamKey]}  `;

    const hrg = getHarga(r);
    const rowHarga = toInt(String(r.harga ?? ""));
    const finalHrg = hrg > 0 ? hrg : (rowHarga > 0 ? rowHarga : 0);
    
    if (finalHrg > 0) text += `- ${rupiah(finalHrg)}`;

    return text.trim();
  }, [getHarga]);

  /** Isi satu field (dipakai mode tabel klasik & mode kartu) — renderCell khusus tabel didahulukan. */
  const isiField = (k: string, r: T, i: number, locked: boolean): React.ReactNode => {
    const rowAny = r as any;
    const kind = fieldKind(k);
    const value = rowAny[k] ?? "";
    const overridden = renderCell?.({
      keyName: k,
      kind,
      value,
      row: r,
      rowIndex: i,
      inputBase,
      isMobile,
      onKeyNav,
      updateRow,
    });

    if (overridden !== undefined) return overridden;

    if (k === "harga") {
      const formattedHarga =
        rowAny.harga === "" || rowAny.harga === undefined || rowAny.harga === null
          ? ""
          : formatRibuanInput(rowAny.harga, { allowZero: true });
      return (
        <AutoFitInput
          isMobile={isMobile}
          prefixText="Rp"
          minSample="00.000"
          data-fieldid={`table-${title.replace(/\s+/g, "-")}-${i}-${k}`}
          type="text"
          inputMode="numeric"
          readOnly={locked}
          className={`font-mono font-medium text-label placeholder:text-label-3 ${locked ? "opacity-75 cursor-not-allowed" : ""}`}
          value={formattedHarga}
          onChange={(e) => {
            if (!locked) {
              const raw = e.target.value.replace(/\D/g, "");
              updateRow(i, { harga: raw === "" ? "" : toInt(raw) } as any);
            }
          }}
          onKeyDown={onKeyNav}
          placeholder="0"
        />
      );
    }

    if (kind === "time") {
      return (
        <AutoFitInput
          isMobile={isMobile}
          data-fieldid={`table-${title.replace(/\s+/g, "-")}-${i}-${k}`}
          type="time"
          readOnly={locked}
          className={`font-mono ${locked ? "opacity-75 cursor-not-allowed" : ""}`}
          value={value}
          onChange={(e) => { if (!locked) updateRow(i, { [k]: e.target.value } as any); }}
          onKeyDown={onKeyNav}
          rightAdornment={
            !value ? <Clock className="z-[1] absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-label-3 pointer-events-none" /> : undefined
          }
        />
      );
    }

    if (kind === "number") {
      return (
        <AutoFitInput
          isMobile={isMobile}
          minSample="00"
          data-fieldid={`table-${title.replace(/\s+/g, "-")}-${i}-${k}`}
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min={0}
          readOnly={locked}
          className={`font-mono ${locked ? "opacity-75 cursor-not-allowed" : ""}`}
          value={value}
          onChange={(e) => { if (!locked) updateRow(i, { [k]: e.target.value } as any); }}
          onKeyDown={onKeyNav}
          placeholder={placeholders?.[k] ?? "0"}
        />
      );
    }

    return (
      <AutoFitInput
        isMobile={isMobile}
        minSample="Ket..."
        data-fieldid={`table-${title.replace(/\s+/g, "-")}-${i}-${k}`}
        readOnly={locked}
        className={`${locked ? "opacity-75 cursor-not-allowed" : ""}`}
        value={value}
        onChange={(e) => { if (!locked) updateRow(i, { [k]: e.target.value } as any); }}
        onKeyDown={onKeyNav}
        placeholder={placeholders?.[k] ?? k.replace(/_/g, " ")}
      />
    );
  };

  // ===================== MODE KARTU (pilihan "Kartu" di Pengaturan) =====================
  // Daftar ringkas ala iOS: satu baris per transaksi, ketuk untuk mengubah (satu baris terbuka),
  // geser ke kiri untuk menghapus. Mode tabel klasik tidak memakai bagian ini.
  const uidKartu = React.useId();
  const [bukaKartu, setBukaKartu] = React.useState<number | null>(null);
  const [geserKartu, setGeserKartu] = React.useState<number | null>(null);
  const [geserDx, setGeserDx] = React.useState(0);
  const geserRef = React.useRef<{ i: number; x: number; y: number; arah: "" | "x" | "y" } | null>(null);
  const LEBAR_HAPUS = 88;

  const barisTerisi = (r: T, i: number) => {
    const row = r as any;
    if (isRowLocked?.(r, i)) return true;
    if (getHarga(r) > 0 || toInt(String(row.harga ?? "")) > 0) return true;
    if (parseBayar(row.bayar).size > 0 || row.buktiTransfer) return true;
    return Object.keys(blank).some((k) => {
      if (k.startsWith("_") || k === "harga" || k === "bayar" || k === "buktiTransfer") return false;
      const v = String(row[k] ?? "").trim();
      return v !== "" && v !== String((blank as any)[k] ?? "").trim();
    });
  };

  const kolomKartu = Object.keys(blank).filter((k) => k !== "bayar" && k !== "buktiTransfer" && !k.startsWith("_"));

  /** Judul & info singkat baris (mis. "PS4 + TV · Andi" / "24 JAM · 20:17"). */
  const ringkasKartu = (r: T) => {
    const row = r as any;
    const judul: string[] = [];
    const info: string[] = [];
    const tanda: { teks: string; nada: "negative" | "tint" }[] = [];
    kolomKartu.forEach((k, idx) => {
      const v = String(row[k] ?? "").trim();
      if (!v || v === "-" || k === "harga") return;
      const kl = k.toLowerCase();
      const label = String(columns[idx + 1] || "").toLowerCase();
      if (kl === "ispaid") {
        if (v === "TIDAK") tanda.push({ teks: "Belum bayar", nada: "negative" });
        return;
      }
      if (kl === "isongkir") {
        const pengantar = String(row.diantarOleh || "").split("@")[0];
        if (v === "YA") tanda.push({ teks: pengantar ? `Antar ${pengantar}` : "Antar", nada: "tint" });
        return;
      }
      if (kl === "diantaroleh" || kl.startsWith("wa") || label.includes("wa ")) return;
      const kind = fieldKind(k);
      if (kind === "time") info.push(v);
      else if (kind === "number") info.push(/^\d+([.,]\d+)?$/.test(v) ? (label.includes("qty") ? `${v}×` : label.includes("jam") ? `${v} jam` : v) : v);
      else judul.push(v);
    });
    return { judul: judul.join(" · "), info: info.join(" · "), tanda };
  };

  /** Lebar field di editor kartu: jam / angka / harga setengah baris bila ada pasangannya. */
  const tataField = () => {
    const setengah = (k: string) => {
      const kind = fieldKind(k);
      return kind === "time" || kind === "number" || k === "harga" || k.toLowerCase() === "ispaid";
    };
    const out: { k: string; idx: number; penuh: boolean }[] = [];
    for (let n = 0; n < kolomKartu.length; n++) {
      const k = kolomKartu[n];
      const lanjut = kolomKartu[n + 1];
      if (setengah(k) && lanjut && setengah(lanjut)) {
        out.push({ k, idx: n, penuh: false }, { k: lanjut, idx: n + 1, penuh: false });
        n++;
      } else out.push({ k, idx: n, penuh: true });
    }
    return out;
  };

  const pilihBayarKartu = (i: number, row: any, metode: "Cash" | "Transfer") => {
    if (isRowLocked?.(row, i) || row.isPaid === "TIDAK") return;
    const nextVal = parseBayar(row.bayar).has(metode) ? "" : metode;
    const patch: any = metode === "Transfer" ? { bayar: nextVal, ...(nextVal === "" ? { buktiTransfer: "" } : {}) } : { bayar: nextVal };
    if (row.jenisPS === "Hanya Ongkir") patch._bayarOngkir = nextVal;
    updateRow(i, patch);
  };

  const bukaBarisKartu = (i: number | null) => {
    setGeserKartu(null);
    setBukaKartu(i);
    if (i === null) return;
    requestAnimationFrame(() =>
      document.getElementById(`${uidKartu}-${i}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    );
  };

  const tambahKartu = () => {
    if (invalidPayRows.length > 0) {
      setShowPayErrors(true);
      setShowPayAlert(true);
      return;
    }
    const kosong = rows.findIndex((r, i) => !barisTerisi(r, i));
    if (kosong >= 0) return bukaBarisKartu(kosong);
    setRows((prev) => [...prev, { ...(blank as any) }]);
    bukaBarisKartu(rows.length);
  };

  const hapusKartu = (i: number) => {
    setGeserKartu(null);
    setBukaKartu((b) => (b === null ? null : b === i ? null : b > i ? b - 1 : b));
    onDeleteRow(i);
  };

  const sentuhMulai = (i: number) => (e: React.TouchEvent) => {
    geserRef.current = { i, x: e.touches[0].clientX, y: e.touches[0].clientY, arah: "" };
  };
  const sentuhGerak = (i: number) => (e: React.TouchEvent) => {
    const g = geserRef.current;
    if (!g || g.i !== i) return;
    const dx = e.touches[0].clientX - g.x;
    const dy = e.touches[0].clientY - g.y;
    if (!g.arah && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) g.arah = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (g.arah !== "x") return;
    const dasar = geserKartu === i ? -LEBAR_HAPUS : 0;
    setGeserDx(Math.max(-LEBAR_HAPUS - 16, Math.min(0, dasar + dx)));
  };
  const sentuhSelesai = (i: number) => () => {
    const g = geserRef.current;
    geserRef.current = null;
    if (!g || g.i !== i || g.arah !== "x") return;
    setGeserKartu(geserDx < -LEBAR_HAPUS / 2 ? i : null);
    setGeserDx(0);
  };

  const labelKecil = "mb-1 block px-1 text-caption font-medium text-label-2";

  const renderKartu = () => {
    const tampil = rows
      .map((r, i) => i)
      .filter((i) => !showAddRow || barisTerisi(rows[i], i) || bukaKartu === i);
    const bukaKosong = bukaKartu !== null && !!rows[bukaKartu] && !barisTerisi(rows[bukaKartu], bukaKartu);
    const kosongSemua = tampil.length === 0 && barisTerkunci.length === 0;

    return (
      <div
        className={`overflow-hidden rounded-tile bg-surface ring-1 ring-edge shadow-card divide-y divide-sep`}
      >
        {/* Baris otomatis dari POS (hanya-baca) */}
        {barisTerkunci.map((b) => {
          const tf = parseBayar(b.bayar).has("Transfer");
          return (
            <div key={b.key} className="flex min-h-[56px] items-center gap-3 px-3.5 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fill text-label-2" title="Otomatis dari POS">
                <Lock size={13} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-subhead font-semibold text-label">{b.ringkasan}</span>
                <span className="block truncate text-caption text-label-2">
                  {b.label}
                  {b.info ? ` · ${b.info}` : ""}
                </span>
                {b.detail && <span className="mt-0.5 line-clamp-2 block text-caption text-label-2">{b.detail}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {b.renderNo?.()}
                <Pill tone={tf ? "tint" : "positive"}>{tf ? "TF" : "Cash"}</Pill>
                {tf && b.buktiTransfer && <UploadTransferProof value={b.buktiTransfer} onChange={() => {}} disabled />}
              </span>
            </div>
          );
        })}

        {tampil.map((i) => {
          const r = rows[i];
          const row = r as any;
          const locked = !!isRowLocked?.(r, i);
          const terisi = barisTerisi(r, i);
          const bayar = parseBayar(row.bayar);
          const payInvalid = !hidePayColumns && !locked && isHargaKeluar(row) && bayar.size === 0 && showPayErrors;
          const buka = bukaKartu === i;
          const bisaGeser = terisi && !locked && !buka;
          const tx = geserRef.current?.i === i && geserRef.current.arah === "x" ? geserDx : geserKartu === i ? -LEBAR_HAPUS : 0;
          const { judul, info, tanda } = ringkasKartu(r);
          const harga = getHarga(r) || toInt(String(row.harga ?? ""));
          const canResetRow = terisi || bayar.size > 0 || !!row.buktiTransfer;

          return (
            <div
              key={row._autoOngkirKey || row._rowId || i}
              id={`${uidKartu}-${i}`}
              className="scroll-mt-[calc(var(--app-header-height,148px)+12px)]"
            >
              <div className="relative overflow-hidden">
                {bisaGeser && (
                  <button
                    type="button"
                    onClick={() => hapusKartu(i)}
                    aria-label={`Hapus baris ${i + 1}`}
                    className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 bg-negative text-footnote font-semibold text-white"
                    style={{ width: LEBAR_HAPUS }}
                  >
                    <Trash2 size={15} /> Hapus
                  </button>
                )}
                <div
                  className={`relative bg-surface ${geserRef.current?.i === i ? "" : "transition-transform duration-200"}`}
                  style={{ transform: tx ? `translateX(${tx}px)` : undefined, touchAction: "pan-y" }}
                  onTouchStart={bisaGeser ? sentuhMulai(i) : undefined}
                  onTouchMove={bisaGeser ? sentuhGerak(i) : undefined}
                  onTouchEnd={bisaGeser ? sentuhSelesai(i) : undefined}
                >
                  <button
                    type="button"
                    aria-expanded={buka}
                    onClick={() => (geserKartu === i ? setGeserKartu(null) : bukaBarisKartu(buka ? null : i))}
                    className={`flex min-h-[56px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-fill ${
                      payInvalid ? "bg-negative/[0.07]" : locked ? AKSEN_ONGKIR.latar : buka ? "bg-fill/50" : ""
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-caption font-semibold tabular-nums ${
                        locked ? AKSEN_TILE.purple.pill : !terisi ? "bg-tint/10 text-tint" : payInvalid ? "bg-negative/15 text-negative" : catAccent.pill
                      }`}
                    >
                      {locked ? <Lock size={12} /> : !terisi ? <Plus size={15} /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      {terisi ? (
                        <>
                          <span className="block truncate text-subhead font-semibold text-label">{judul || `Baris ${i + 1}`}</span>
                          {(info || tanda.length > 0) && (
                            <span className="flex min-w-0 items-center gap-1.5 text-caption text-label-2">
                              {info && <span className="shrink-0">{info}</span>}
                              {tanda.map((t) => (
                                <span key={t.teks} className={`truncate font-semibold ${t.nada === "negative" ? "text-negative" : "text-tint"}`}>
                                  {t.teks}
                                </span>
                              ))}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="block text-subhead font-medium text-tint">Isi transaksi baru</span>
                      )}
                    </span>
                    {terisi && (
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className={`text-subhead font-semibold tabular-nums ${harga > 0 ? "text-label" : "text-label-3"}`}>{harga > 0 ? rupiah(harga) : "Rp 0"}</span>
                        {!hidePayColumns &&
                          (bayar.has("Transfer") ? (
                            <span className="text-caption2 font-semibold text-tint">TF / QRIS</span>
                          ) : bayar.has("Cash") ? (
                            <span className="text-caption2 font-semibold text-positive">Cash</span>
                          ) : payInvalid ? (
                            <span className="text-caption2 font-semibold text-negative">Pilih bayar</span>
                          ) : null)}
                      </span>
                    )}
                    <ChevronDown size={16} className={`shrink-0 text-label-3 transition-transform duration-200 ${buka ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                </div>
              </div>

              {buka && (
                <div
                  className={`border-t border-sep bg-fill/40 px-3 pb-3 pt-3 [&_input]:bg-surface [&_select]:bg-surface [&_input]:ring-1 [&_input]:ring-inset [&_input]:ring-edge [&_select]:ring-1 [&_select]:ring-inset [&_select]:ring-edge ${MOTION.panel}`}
                >
                  <div className="grid grid-cols-2 gap-x-2.5 gap-y-3">
                    {tataField().map(({ k, idx, penuh }) => (
                      <div key={k} className={`min-w-0 ${penuh ? "col-span-2" : ""}`}>
                        <span className={labelKecil}>{columns[idx + 1] || k}</span>
                        {isiField(k, r, i, locked)}
                      </div>
                    ))}
                  </div>

                  {!hidePayColumns && (
                    <div className="mt-3">
                      <span className={labelKecil}>Pembayaran</span>
                      <div className="flex items-center gap-2">
                        <div className={`grid flex-1 grid-cols-2 gap-1 rounded-full apple-segmented p-1 ${payInvalid ? "ring-2 ring-negative/40" : ""}`}>
                          {(["Cash", "Transfer"] as const).map((m) => {
                            const aktif = bayar.has(m);
                            const mati = locked || row.isPaid === "TIDAK";
                            return (
                              <button
                                key={m}
                                type="button"
                                disabled={mati}
                                aria-pressed={aktif}
                                onClick={() => pilihBayarKartu(i, row, m)}
                                className={`hit-44 min-h-[36px] rounded-full text-footnote font-semibold transition ${
                                  aktif ? (m === "Cash" ? "bg-positive text-white shadow-sm" : "bg-tint text-white shadow-sm") : "text-label-2"
                                } ${mati ? "cursor-not-allowed opacity-60" : "active:scale-[0.98]"}`}
                              >
                                {m === "Cash" ? "Cash" : "TF / QRIS"}
                              </button>
                            );
                          })}
                        </div>
                        {bayar.has("Transfer") && (
                          <UploadTransferProof
                            value={row.buktiTransfer}
                            onChange={(url) => updateRow(i, { buktiTransfer: url } as any)}
                            disabled={locked && !allowProofOnLocked}
                          />
                        )}
                      </div>
                      {payInvalid && <p className="mt-1 px-1 text-caption font-medium text-negative">Pilih Cash atau TF / QRIS dulu.</p>}
                    </div>
                  )}

                  {extraColumns.map((ec, n) => (
                    <div key={`ec-${n}`} className="mt-3 flex min-h-[44px] items-center justify-between gap-3 px-1">
                      <span className="text-caption font-medium text-label-2">{ec.mobileLabel ?? ec.header}</span>
                      {ec.render({ row: r, rowIndex: i, locked, isMobile: true, inputBase, onKeyNav, updateRow })}
                    </div>
                  ))}

                  <div className="mt-3 flex items-center gap-2">
                    {renderNo && <span className="contents">{renderNo(r, i)}</span>}
                    <div className="ml-auto flex items-center gap-1">
                      {locked ? (
                        <Pill tone="neutral" icon={<Lock />}>Otomatis</Pill>
                      ) : (
                        !hideRowActions && (
                          <>
                            {canResetRow && (
                              <button
                                type="button"
                                onClick={() => setResetConfirm({ type: "row", index: i })}
                                aria-label={`Kosongkan baris ${i + 1}`}
                                title="Kosongkan baris"
                                className="hit-44 flex h-8 w-8 items-center justify-center rounded-full text-label-2 transition-colors active:bg-fill"
                              >
                                <RotateCcw size={15} />
                              </button>
                            )}
                            <Button variant="plain" size="sm" icon={<Trash2 />} className="!text-negative" onClick={() => hapusKartu(i)}>
                              Hapus
                            </Button>
                          </>
                        )
                      )}
                      <Button variant="tinted" size="sm" onClick={() => bukaBarisKartu(null)}>
                        Selesai
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Baris bawah: tambah transaksi + reset tabel (menggantikan bilah tombol di mode kartu) */}
        {((showAddRow && !bukaKosong) || showReset) && (
          <div className="flex min-h-[52px] items-center">
            {showAddRow && !bukaKosong ? (
              <button
                type="button"
                onClick={tambahKartu}
                className="flex min-h-[52px] flex-1 items-center gap-3 px-3.5 text-left text-tint transition-colors active:bg-fill"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint/10">
                  <Plus size={15} />
                </span>
                <span className="text-subhead font-medium">{kosongSemua ? "Isi transaksi pertama" : "Tambah transaksi"}</span>
              </button>
            ) : (
              <span className="flex-1" />
            )}
            {showReset && (
              <button
                type="button"
                onClick={() => setResetConfirm({ type: "table" })}
                aria-label={`Reset ${title}`}
                className="mr-2 flex min-h-[44px] items-center gap-1 rounded-full px-3 text-footnote font-medium text-label-2 transition-colors active:bg-fill"
              >
                <RotateCcw size={14} /> Reset
              </button>
            )}
          </div>
        )}
        {!showAddRow && kosongSemua && <div className="px-4 py-5 text-center text-footnote text-label-3">Belum ada data.</div>}
      </div>
    );
  };

  return (
    <>
      <Card
        variant="hero"
        accent={theme.iconColor}
        icon={theme.icon}
        iconColor={theme.iconColor}
        title={title}
        subtitle={subtitleText}
        accessory={
          <div className="text-right shrink-0">
            <div className="text-caption2 font-semibold uppercase tracking-[0.04em] text-label-2">
              {totalLabelProp ?? (props.title.toLowerCase().includes("pengeluaran") ? "Total Keluar" : "Total")}
            </div>
            <Amount
              value={total}
              size="headline"
              tone={props.title.toLowerCase().includes("pengeluaran") ? "negative" : "neutral"}
              fitAt={12}
              className="font-bold whitespace-nowrap"
            />
          </div>
        }
      >
        <div className="flex flex-col gap-4 sm:gap-5">
          {slotAtas}

          {isMobile ? (
            renderKartu()
          ) : (
            <>
            {/* Table Wrapper controlled entirely by isMobile state */}
            <div className={`relative overflow-hidden ${isMobile ? "bg-transparent" : "rounded-tile border border-sep apple-tile"}`}>
              <div ref={wrapRef} className="overflow-x-auto overflow-y-visible" style={{ maxHeight: "70vh" }}>
                <table className="min-w-full text-subhead">
                  <thead className={isMobile ? "hidden" : "table-header-group"}>
                    <tr>
                      {columns.map((c, i) => {
                        const lower = c.toLowerCase();
                        const centered = i === 0 || lower === "cash" || lower === "transfer";
                        const compactCol = i === 0 || lower === "cash" || lower === "transfer" ? "w-px" : "";
                        return (
                          <th
                            key={i}
                            className={`${thBase} ${compactCol} ${centered ? "text-center" : "text-left"}`}
                            style={{ boxShadow: `inset 0 -2px 0 ${catAccent.bar}55` }}
                          >
                            {c}
                          </th>
                        );
                      })}
                      {extraColumns.map((ec, idx) => (
                        <th
                          key={`extra-h-${idx}`}
                          className={`${thBase} ${ec.center ? "w-px text-center" : "text-left"}`}
                          style={{ boxShadow: `inset 0 -2px 0 ${catAccent.bar}55` }}
                        >
                          {ec.header}
                        </th>
                      ))}
                      {!hideRowActions && (
                        <th
                          className={`${thBase} w-px text-center`}
                          style={{ boxShadow: `inset 0 -2px 0 ${catAccent.bar}55` }}
                        >
                          Aksi
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody className={isMobile ? "flex flex-col gap-3" : "table-row-group divide-y divide-sep"}>
                    {/* Baris otomatis (terkunci) */}
                    {barisTerkunci.map((b) => {
                      const cash = parseBayar(b.bayar).has("Cash");
                      const tf = parseBayar(b.bayar).has("Transfer");
                      const kolom = Object.keys(blank).filter((k) => k !== "bayar" && !k.startsWith("_"));
                      if (isMobile) {
                        return (
                          <tr key={b.key} className="flex flex-col rounded-tile ring-1 ring-edge overflow-hidden apple-tile">
                            <td
                              className={`flex justify-between items-center gap-3 px-4 py-3 ${catAccent.bg} !ring-0 border-b border-sep text-label select-none`}
                            >
                              <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption2 font-semibold tracking-wide shrink-0 ${catAccent.pill}`}>
                                    <Lock size={10} />{b.label}
                                  </span>
                                  {b.renderNo?.()}
                                  {b.info && <span className="text-caption font-mono text-label-2 truncate">{b.info}</span>}
                                </div>
                                <span className="text-subhead font-semibold leading-snug truncate text-label">{b.ringkasan}</span>
                              </div>
                              <span className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-fill text-label-2" title="Otomatis — tidak bisa diubah di sini">
                                <Lock size={14} />
                              </span>
                            </td>
                            <td className="flex items-center justify-between gap-3 px-4 py-3 bg-transparent">
                              <div className="min-w-0 flex-1 text-footnote leading-snug text-label-2">{b.detail}</div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Pill tone={tf ? "tint" : "positive"}>
                                  {tf ? "TF / QRIS" : "Cash"}
                                </Pill>
                                {tf && b.buktiTransfer && (
                                  <UploadTransferProof value={b.buktiTransfer} onChange={() => {}} disabled />
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={b.key} className="table-row bg-fill/40 hover:bg-fill/60 transition-colors">
                          <td className="table-cell w-[56px] text-center px-1.5 py-2 align-middle" title="Otomatis — tidak bisa diubah di sini">
                            <div className="flex flex-col items-center justify-center gap-1 text-label-2">
                              <span className="inline-flex items-center gap-0.5 text-caption2 font-semibold tracking-wider uppercase">
                                <Lock size={10} />{b.label}
                              </span>
                              {b.renderNo?.()}
                            </div>
                          </td>
                          {kolom.map((k) => (
                            <td key={k} className="table-cell px-2 py-2 align-middle">
                              <div className="min-h-[36px] px-1.5 flex items-center text-subhead text-label">{b.nilai[k] ?? "-"}</div>
                            </td>
                          ))}
                          <td className="table-cell w-[80px] text-center align-middle px-2 py-2">
                            <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${cash ? "bg-positive text-white" : "bg-fill text-label-3"}`} aria-label={cash ? "Cash" : "Bukan cash"}>
                              {cash ? <Check size={18} strokeWidth={2.8} /> : <Circle size={18} strokeWidth={2} />}
                            </span>
                          </td>
                          <td className="table-cell min-w-[100px] text-center align-middle px-2 py-2">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full shrink-0 ${tf ? "bg-tint text-white" : "bg-fill text-label-3"}`} aria-label={tf ? "Transfer" : "Bukan transfer"}>
                                {tf ? <Check size={18} strokeWidth={2.8} /> : <Circle size={18} strokeWidth={2} />}
                              </span>
                              {tf && b.buktiTransfer && (
                                <UploadTransferProof value={b.buktiTransfer} onChange={() => {}} disabled />
                              )}
                            </div>
                          </td>
                          <td className="table-cell text-center align-middle px-2 py-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2.5 py-1 text-caption font-medium text-label-2 whitespace-nowrap">
                              <Lock size={11} />Otomatis
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {rows.map((r, i) => {
                      const rowAny = r as any;
                      const locked = !!isRowLocked?.(r, i);
                      const hargaKeluar = isHargaKeluar(rowAny);
                      const bayarSet = parseBayar(rowAny.bayar);
                      const payInvalid = !hidePayColumns && !locked && hargaKeluar && bayarSet.size === 0 && showPayErrors;

                      const summary = getSmartSummary(rowAny);
                      const hasData = summary !== "";
                      const canResetRow = hasData || bayarSet.size > 0 || !!rowAny.buktiTransfer;
                      const expanded = isExpanded(i);
                      const isCollapsedEmpty = !expanded && !hasData;

                      const cardClass = `flex flex-col rounded-tile ring-1 overflow-hidden transition duration-200 ${
                        payInvalid ? "ring-negative/50 bg-negative/[0.06] backdrop-blur-xl" :
                        locked ? `${AKSEN_TILE.purple.bg} ring-edge` :
                        isCollapsedEmpty ? "apple-tile ring-edge opacity-80" :
                        "apple-tile ring-edge"
                      }`;
                      const rowClass = `table-row group transition-colors ${
                        payInvalid ? "bg-negative/[0.06] hover:bg-negative/[0.09]" :
                        locked ? AKSEN_ONGKIR.baris :
                        "hover:bg-fill/40"
                      }`;

                      return (
                        <SwipeableRow
                          key={rowAny._autoOngkirKey || i}
                          isMobile={isMobile}
                          disabled={!hasData || locked}
                          onSwipe={() => onDeleteRow(i)}
                          className={isMobile ? cardClass : rowClass}
                          style={{ borderBottom: isMobile ? 'none' : '' }}
                        >
                          {/* CARD HEADER OR NO. ROW */}
                          <td
                            onClick={() => { if (isMobile && !isAlwaysExpanded) toggleExpand(i) }}
                            className={isMobile
                              ? `flex justify-between items-center px-4 py-3 ${!isAlwaysExpanded ? 'cursor-pointer active:opacity-90' : ''} ${locked ? `${AKSEN_TILE.purple.bg} !ring-0 border-b ${AKSEN_ONGKIR.garis} text-label` : isCollapsedEmpty ? 'bg-transparent text-label-2' : `${catAccent.bg} !ring-0 border-b border-sep text-label`} transition-colors select-none`
                              : `table-cell w-[56px] text-center px-1.5 py-1.5 align-middle relative`
                            }
                          >
                             {isMobile ? (
                                <div className="flex flex-col gap-1 w-full max-w-[85%]">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-caption2 font-semibold tracking-wider uppercase ${locked ? AKSEN_TILE.purple.pill : isCollapsedEmpty ? "bg-fill text-label-2" : catAccent.pill}`}>
                                      Baris {i + 1}
                                    </span>
                                    {renderNo && (
                                      <span className="contents" onClick={(e) => e.stopPropagation()}>
                                        {renderNo(r, i)}
                                      </span>
                                    )}
                                    {!expanded && hasData && (
                                       <span className="flex items-center justify-center rounded-full bg-positive/15 text-positive p-1">
                                          <Check size={12} strokeWidth={2.8} />
                                       </span>
                                    )}
                                  </div>
                                  {!expanded && hasData && (
                                    <span className="text-subhead font-semibold leading-snug line-clamp-1 truncate mt-0.5 text-label">{summary}</span>
                                  )}
                                  {isCollapsedEmpty && (
                                    <span className="text-footnote leading-snug mt-0.5 text-label-3">Kosong — ketuk untuk mengisi</span>
                                  )}
                                </div>
                             ) : (
                                <div className="flex flex-col justify-center items-center gap-1 h-full">
                                   <span className="font-mono text-footnote font-semibold text-label-2">{i + 1}</span>
                                   {renderNo?.(r, i)}
                                </div>
                             )}

                             {isMobile && !isAlwaysExpanded && (
                                <div className="flex shrink-0 items-center justify-center w-8 h-8 rounded-full bg-fill text-label-2">
                                   {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                                </div>
                             )}

                             {payInvalid && !isMobile && <AlertCircle size={16} className="text-negative animate-pulse absolute left-1 top-1/2 -translate-y-1/2" />}
                          </td>

                          {expanded && (
                             <>
                                {Object.keys(blank)
                                  .filter((k) => k !== "bayar" && k !== "buktiTransfer" && !k.startsWith("_"))
                                  .map((k, idx) => {
                                    const kind = fieldKind(k);
                                    const value = (r as any)[k] ?? "";
                                    
                                    const rawLabel = columns[idx + 1] || k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                                    const tdWrapper = (content: React.ReactNode, addClass = "") => {
                                       if (!isMobile) {
                                          return (
                                            <td key={k} className={`table-cell px-2 py-1.5 align-middle ${addClass}`}>
                                              <div className="w-full relative">{content}</div>
                                            </td>
                                          )
                                       }
                                       return (
                                         <td key={k} className={`flex flex-col px-4 py-2.5 border-b border-sep ${addClass}`}>
                                            <span className="block text-caption2 font-semibold text-label-2 uppercase tracking-[0.04em] mb-1">
                                               {rawLabel}
                                            </span>
                                            <div className="w-full relative">{content}</div>
                                         </td>
                                       )
                                    };

                                    return tdWrapper(isiField(k, r, i, locked));
                                })}
                                
                                {!hidePayColumns && (
                                  <>
                                    {/* Cash Toggle */}
                                    <td className={isMobile ? `flex justify-between items-center px-4 py-2.5 border-b border-sep` : `table-cell w-px whitespace-nowrap text-center align-middle px-2 py-1.5`}>
                                       {isMobile && <span className="text-caption2 font-semibold text-label-2 uppercase tracking-[0.04em]">Metode Cash</span>}
                                       <button
                                         type="button"
                                         disabled={locked || rowAny.isPaid === "TIDAK"}
                                         onClick={() => {
                                           if (locked || rowAny.isPaid === "TIDAK") return;
                                           const nextVal = bayarSet.has("Cash") ? "" : "Cash";
                                           const patch: any = { bayar: nextVal };
                                           if (rowAny.jenisPS === "Hanya Ongkir") {
                                             patch._bayarOngkir = nextVal;
                                           }
                                           updateRow(i, patch as any);
                                         }}
                                         className={`inline-flex items-center justify-center transition active:scale-95 ${
                                           isMobile
                                            ? `hit-44 h-10 min-w-[92px] px-3 rounded-field font-semibold text-subhead ${locked || rowAny.isPaid === "TIDAK" ? (bayarSet.has("Cash") ? "bg-positive/85 text-white opacity-90 cursor-not-allowed" : "bg-fill text-label-3 opacity-50 cursor-not-allowed") : bayarSet.has("Cash") ? "bg-positive text-white shadow-xs" : "bg-fill text-label-2"}`
                                            : `h-9 w-9 rounded-full ${locked || rowAny.isPaid === "TIDAK" ? (bayarSet.has("Cash") ? "bg-positive/85 text-white opacity-90 cursor-not-allowed" : "bg-fill text-label-3 opacity-50 cursor-not-allowed") : bayarSet.has("Cash") ? "bg-positive text-white" : "bg-fill text-label-3 hover:text-label-2"}`
                                         }`}
                                       >
                                         {bayarSet.has("Cash") ? (
                                           isMobile ? "Cash" : <Check size={18} strokeWidth={2.8} />
                                         ) : (
                                           isMobile ? "Pilih" : <Circle size={18} strokeWidth={2} />
                                         )}
                                       </button>
                                    </td>

                                    {/* Transfer Toggle */}
                                    <td className={isMobile ? `flex justify-between items-center px-4 py-2.5 ${hideRowActions && extraColumns.length === 0 ? "bg-transparent" : "border-b border-sep bg-transparent"}` : `table-cell w-px whitespace-nowrap text-center align-middle px-2 py-1.5`}>
                                       {isMobile && <span className="text-caption2 font-semibold text-label-2 uppercase tracking-[0.04em] shrink-0">Metode TF / QRIS</span>}
                                       <div className={`flex items-center gap-2 ${isMobile ? "justify-end" : "justify-center w-full"}`}>
                                         <button
                                           type="button"
                                           disabled={locked || rowAny.isPaid === "TIDAK"}
                                           onClick={() => {
                                             if (locked || rowAny.isPaid === "TIDAK") return;
                                             const nextVal = bayarSet.has("Transfer") ? "" : "Transfer";
                                             const patch: any = {
                                               bayar: nextVal,
                                               ...(nextVal === "" ? { buktiTransfer: "" } : {})
                                             };
                                             if (rowAny.jenisPS === "Hanya Ongkir") {
                                               patch._bayarOngkir = nextVal;
                                             }
                                             updateRow(i, patch as any);
                                           }}
                                           className={`inline-flex items-center justify-center transition active:scale-95 ${
                                             isMobile
                                              ? `h-10 min-w-[92px] px-3 rounded-field font-semibold text-subhead ${locked || rowAny.isPaid === "TIDAK" ? (bayarSet.has("Transfer") ? "bg-tint/85 text-white opacity-90 cursor-not-allowed" : "bg-fill text-label-3 opacity-50 cursor-not-allowed") : bayarSet.has("Transfer") ? "bg-tint text-white shadow-xs" : "bg-fill text-label-2"}`
                                              : `h-9 w-9 rounded-full ${locked || rowAny.isPaid === "TIDAK" ? (bayarSet.has("Transfer") ? "bg-tint/85 text-white opacity-90 cursor-not-allowed" : "bg-fill text-label-3 opacity-50 cursor-not-allowed") : bayarSet.has("Transfer") ? "bg-tint text-white" : "bg-fill text-label-3 hover:text-label-2"}`
                                           }`}
                                         >
                                           {bayarSet.has("Transfer") ? (
                                             isMobile ? "TF / QRIS" : <Check size={18} strokeWidth={2.8} />
                                           ) : (
                                             isMobile ? "Pilih" : <Circle size={18} strokeWidth={2} />
                                           )}
                                         </button>
                                         {bayarSet.has("Transfer") && (
                                           <UploadTransferProof
                                             value={rowAny.buktiTransfer}
                                             onChange={(url) => updateRow(i, { buktiTransfer: url } as any)}
                                             disabled={locked && !allowProofOnLocked}
                                           />
                                         )}
                                       </div>
                                    </td>
                                  </>
                                )}

                                {extraColumns.map((ec, idx) => (
                                  <td
                                    key={`extra-c-${idx}`}
                                    className={
                                      isMobile
                                        ? `flex justify-between items-center px-4 py-2.5 ${idx < extraColumns.length - 1 || !hideRowActions ? "border-b border-sep" : "bg-transparent"}`
                                        : `table-cell ${ec.center ? "w-px whitespace-nowrap text-center" : ""} align-middle px-2 py-1.5`
                                    }
                                  >
                                    {isMobile && (
                                      <span className="text-caption2 font-semibold text-label-2 uppercase tracking-[0.04em] shrink-0">
                                        {ec.mobileLabel ?? ec.header}
                                      </span>
                                    )}
                                    {ec.render({ row: r, rowIndex: i, locked, isMobile, inputBase, onKeyNav, updateRow })}
                                  </td>
                                ))}

                                {/* Per-Row Action Buttons (Card Mode) */}
                                {isMobile && !hideRowActions && (
                                  <td className="flex justify-center items-center gap-3 px-4 py-2 border-t border-sep">
                                    {locked ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2.5 py-1 text-caption font-medium text-label-2 whitespace-nowrap">
                                        <Lock size={11} />Otomatis
                                      </span>
                                    ) : (
                                      <>
                                        {canResetRow && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setResetConfirm({ type: "row", index: i });
                                            }}
                                            className="flex min-h-[38px] items-center gap-1.5 text-caption font-semibold text-label-2 hover:text-negative transition-colors active:scale-95 px-3.5 rounded-full hover:bg-negative/10"
                                          >
                                            <RotateCcw size={13} />
                                            Reset
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteRow(i);
                                          }}
                                          className="flex min-h-[38px] items-center gap-1.5 text-caption font-semibold text-label-2 hover:text-negative transition-colors active:scale-95 px-3.5 rounded-full hover:bg-negative/10"
                                        >
                                          <Trash2 size={13} />
                                          Hapus Baris
                                        </button>
                                      </>
                                    )}
                                  </td>
                                )}

                                {/* Per-Row Action Buttons (Classic Mode) */}
                                {!isMobile && !hideRowActions && (
                                  <td className="table-cell w-px whitespace-nowrap text-center align-middle px-2 py-1.5">
                                    {locked ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2.5 py-1 text-caption font-medium text-label-2 whitespace-nowrap">
                                        <Lock size={11} />Otomatis
                                      </span>
                                    ) : (
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          disabled={!canResetRow}
                                          onClick={() => setResetConfirm({ type: "row", index: i })}
                                          className="flex items-center justify-center w-8 hit-44 h-8 rounded-full bg-fill text-label-2 hover:bg-negative/10 hover:text-negative active:scale-90 transition disabled:opacity-35 disabled:pointer-events-none"
                                          title="Reset baris ini"
                                          aria-label={`Reset baris ${i + 1}`}
                                        >
                                          <RotateCcw size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onDeleteRow(i)}
                                          className="flex items-center justify-center w-8 hit-44 h-8 rounded-full bg-fill text-label-2 hover:bg-negative/15 hover:text-negative active:scale-90 transition"
                                          title="Hapus baris ini"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                )}
                          </>
                          )}
                        </SwipeableRow>
                      );
                    })}
                  </tbody>
                  {!isMobile && tableFooter}
                </table>
              </div>
            </div>
            </>
          )}

          {slotBawahTable}

          {/* Action Bar — UDS SSOT: tombol Reset kiri (AlertDialog), Tambah Baris kanan */}
          {(showReset || showAddRow) && !isMobile && (
            <div className="flex w-full items-center justify-between gap-3 pt-1">
              {showReset ? (
                <Button
                  variant="gray"
                  size="md"
                  icon={<RotateCcw />}
                  onClick={() => setResetConfirm({ type: "table" })}
                  title="Reset Semua Baris"
                  aria-label={`Reset ${title}`}
                >
                  Reset
                </Button>
              ) : (
                <div />
              )}

              {showAddRow && !isMobile && (
                <Button
                  variant="filled"
                  size="md"
                  icon={<Plus size={17} />}
                  onClick={onAddRow}
                  className="rounded-full"
                >
                  Tambah Baris
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      <AlertDialog
        open={showPayAlert}
        onClose={() => setShowPayAlert(false)}
        zClassName="z-[700]"
        icon={<AlertCircle />}
        iconColor="red"
        title="Metode Pembayaran Belum Lengkap"
        description="Mohon pilih metode pembayaran (Cash atau Transfer) pada baris yang ditandai terlebih dahulu sebelum menambah baris baru."
        actions={[
          { label: "Mengerti", role: "primary", onClick: () => setShowPayAlert(false) },
        ]}
      />

      <AlertDialog
        open={!!resetConfirm}
        onClose={() => setResetConfirm(null)}
        zClassName="z-[700]"
        icon={<RotateCcw />}
        iconColor="red"
        title={
          resetConfirm?.type === "row"
            ? `Reset Baris No. ${resetConfirm.index + 1}?`
            : "Reset Semua Baris?"
        }
        description={
          resetConfirm?.type === "row"
            ? `Seluruh isian pada baris no. ${resetConfirm.index + 1} akan dikosongkan ke nilai awal.`
            : `Seluruh isian pada ${title} akan dikosongkan ke baris awal. Tindakan ini tidak dapat dibatalkan.`
        }
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setResetConfirm(null) },
          {
            label: "Reset",
            role: "destructive",
            onClick: () => {
              const current = resetConfirm;
              setResetConfirm(null);
              if (!current) return;
              if (current.type === "row") {
                updateRow(current.index, { ...blank } as any);
              } else {
                onClear?.();
                handleReset();
              }
            },
          },
        ]}
      />
    </>
  );
}
