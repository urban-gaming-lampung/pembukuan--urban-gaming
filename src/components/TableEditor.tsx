import React from "react";
import { createPortal } from "react-dom";
import { rupiah, toInt } from "../lib/format";
import Section from "./common/Section";
import { Amount, Button, IconBadge, Pill } from "../ui";
import type { WarnaIkon } from "../ui/tokens";
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
  ExternalLink,
  Lock,
  Gamepad2,
  Coffee,
  Wrench,
  CalendarCheck2,
  Wallet,
  Receipt,
  X,
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
  borderFocus: string;
} {
  const t = (title || "").toLowerCase();

  if (t.includes("jajanan")) {
    return { iconColor: "orange", icon: <Coffee size={17} />, borderFocus: "focus:ring-tint/20 focus:border-tint/50" };
  }
  if (t.includes("harian")) {
    return { iconColor: "teal", icon: <Gamepad2 size={17} />, borderFocus: "focus:ring-tint/20 focus:border-tint/50" };
  }
  if (t.includes("sewa")) {
    return { iconColor: "blue", icon: <CalendarCheck2 size={17} />, borderFocus: "focus:ring-tint/20 focus:border-tint/50" };
  }
  if (t.includes("jasa") || t.includes("aksesoris") || t.includes("usaha")) {
    return { iconColor: "indigo", icon: <Wrench size={17} />, borderFocus: "focus:ring-tint/20 focus:border-tint/50" };
  }
  if (t.includes("pengeluaran")) {
    return { iconColor: "red", icon: <Wallet size={17} />, borderFocus: "focus:ring-tint/20 focus:border-tint/50" };
  }
  if (t.includes("setoran")) {
    return { iconColor: "teal", icon: <Wallet size={17} />, borderFocus: "focus:ring-tint/20 focus:border-tint/50" };
  }

  return { iconColor: "gray", icon: <Receipt size={17} />, borderFocus: "focus:ring-tint/20 focus:border-tint/50" };
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
  onKeyNav: (e: React.KeyboardEvent<any>) => void;
  updateRow: (idx: number, patch: Partial<T>) => void;
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
      className={`${className} ${isSwiping ? "!bg-red-500/20 dark:!bg-red-500/30 !ring-red-500/50" : ""}`}
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
      alert("Format berkas harus berupa gambar (JPEG/PNG/dsb)!");
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
      alert("Gagal mengunggah bukti transfer ❌");
    } finally {
      setUploading(false);
    }
  };

  if (uploading) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500 flex-shrink-0 shadow-sm animate-pulse">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
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

        {showPreview && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-4"
            onClick={() => setShowPreview(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Pratinjau Bukti Transfer"
              className="relative w-full max-w-md bg-surface text-label p-4 rounded-card ring-1 ring-edge shadow-float flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full flex justify-between items-center mb-3 pb-2.5 border-b border-sep">
                <span className="text-headline text-label">Pratinjau Bukti Transfer</span>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  aria-label="Tutup pratinjau"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-fill text-label-2 hover:text-label transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="w-full flex items-center justify-center rounded-tile bg-canvas p-2 ring-1 ring-edge">
                <img
                  src={value}
                  alt="Bukti Transfer"
                  className="w-full max-h-[52vh] rounded-field object-contain"
                />
              </div>

              <div className="flex gap-2.5 mt-4 w-full justify-between">
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-11 px-4 text-center bg-tint/10 dark:bg-tint/15 text-tint text-subhead font-semibold rounded-field transition active:opacity-75 flex items-center justify-center gap-1.5"
                >
                  <ExternalLink size={15} />
                  Buka Penuh
                </a>
                {!disabled && (
                  <Button
                    variant="destructive"
                    size="md"
                    className="flex-1"
                    icon={<Trash2 size={15} />}
                    onClick={() => {
                      if (confirm("Hapus bukti transfer ini?")) {
                        onChange("");
                        setShowPreview(false);
                      }
                    }}
                  >
                    Hapus Bukti
                  </Button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
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
  /** Tombol kecil di kolom No. / kepala kartu (klik tidak membuka-tutup kartu). */
  renderNo?: (row: T, rowIndex: number) => React.ReactNode;
  /** Baris otomatis hanya-baca di bagian atas tabel (totalnya lewat extraTotal). */
  barisTerkunci?: BarisTerkunci[];
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
    renderNo,
    barisTerkunci = [],
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
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);
  const [expandedRows, setExpandedRows] = React.useState<number[]>([]);

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

  // Header Table (tenang ala UDS: latar surface-2 + huruf label-2 + pemisah sep)
  const thBase = `px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-label-2 bg-surface-2 border-b border-sep whitespace-nowrap sticky top-0 z-10`;

  const inputBase = `w-full min-h-[40px] px-2.5 rounded-control bg-transparent border border-transparent
    hover:border-sep focus:bg-surface focus:border-tint/40
    focus:outline-none focus:ring-2 ${theme.borderFocus}
    transition-all duration-150 text-[16px] sm:text-subhead text-label placeholder:text-label-3`;

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
    const out: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      if (!isHargaKeluar(row)) continue;
      if (parseBayar(row.bayar).size === 0) out.push(i);
    }
    return out;
  }, [rows, isHargaKeluar]);

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
      alert("Mohon lengkapi metode pembayaran pada baris yang ditandai.");
      return;
    }
    setRows((prev) => [...prev, { ...(blank as any) }]);
  };

  const onDeleteRow = (rowIndex: number) => {
    setRows((prev) => {
      if (prev.length <= (actualMinRows || 1)) {
        // If at minimum, just reset instead of removing
        return prev.map((row, idx) => idx === rowIndex ? ({ ...blank } as T) : row);
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

  return (
    <Section>
      <div className="flex flex-col gap-4">
        {/* Header Section — UDS: IconBadge + judul netral + total netral */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <IconBadge color={theme.iconColor} size="md">
              {theme.icon}
            </IconBadge>
            <h2 className="text-headline text-label truncate">
              {title}
            </h2>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-label-2">
              {props.title.toLowerCase().includes("pengeluaran") ? "Total Keluar" : "Total"}
            </div>
            <Amount
              value={total}
              size="headline"
              tone={props.title.toLowerCase().includes("pengeluaran") ? "negative" : "neutral"}
              fitAt={12}
              className="font-bold whitespace-nowrap"
            />
          </div>
        </div>

        {slotAtas}

        {/* Table Wrapper controlled entirely by isMobile state */}
        <div className={`relative overflow-hidden ${isMobile ? "bg-transparent" : "rounded-tile border border-sep bg-surface"}`}>
          <div ref={wrapRef} className="overflow-x-auto overflow-y-visible" style={{ maxHeight: "70vh" }}>
            <table className="min-w-full text-subhead">
              <thead className={isMobile ? "hidden" : "table-header-group"}>
                <tr>
                  {columns.map((c, i) => {
                    const lower = c.toLowerCase();
                    const centered = i === 0 || lower === "cash" || lower === "transfer";
                    return (
                      <th key={i} className={`${thBase} ${centered ? "text-center" : "text-left"}`}>
                        {c}
                      </th>
                    );
                  })}
                  <th className={`${thBase} text-center`}>Aksi</th>
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
                      <tr key={b.key} className="flex flex-col rounded-tile ring-1 ring-edge overflow-hidden bg-surface-2">
                        <td className="flex justify-between items-center gap-3 px-4 py-3 border-b border-sep bg-surface-2 select-none">
                          <div className="flex flex-col gap-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-label-2 shrink-0">
                                <Lock size={10} />{b.label}
                              </span>
                              {b.renderNo?.()}
                              {b.info && <span className="text-caption font-mono text-label-2 truncate">{b.info}</span>}
                            </div>
                            <span className="text-subhead font-semibold leading-snug truncate text-label">{b.ringkasan}</span>
                          </div>
                          <span className="flex shrink-0 items-center justify-center w-9 h-9 rounded-full bg-fill text-label-2" title="Otomatis — tidak bisa diubah di sini">
                            <Lock size={14} />
                          </span>
                        </td>
                        <td className="flex items-center justify-between gap-3 px-4 py-3 bg-surface">
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
                    <tr key={b.key} className="table-row bg-surface-2/60 dark:bg-white/[0.02]">
                      <td className="table-cell w-[56px] text-center px-1.5 py-2 align-middle" title="Otomatis — tidak bisa diubah di sini">
                        <div className="flex flex-col items-center justify-center gap-1 text-label-2">
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold tracking-wider uppercase">
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
                  const hargaKeluar = isHargaKeluar(rowAny);
                  const bayarSet = parseBayar(rowAny.bayar);
                  const payInvalid = hargaKeluar && bayarSet.size === 0 && showPayErrors;

                  const summary = getSmartSummary(rowAny);
                  const hasData = summary !== "";
                  const expanded = isExpanded(i);
                  const isCollapsedEmpty = !expanded && !hasData;

                  const cardClass = `flex flex-col rounded-tile ring-1 overflow-hidden transition-all duration-200 ${
                    payInvalid ? "ring-negative/50 bg-negative/5" :
                    isCollapsedEmpty ? "bg-surface-2/60 ring-edge opacity-80" :
                    "bg-surface ring-edge"
                  }`;
                  const rowClass = `table-row group transition-colors hover:bg-surface-2/60 ${payInvalid ? "bg-negative/5" : ""}`;

                  return (
                    <SwipeableRow
                      key={i}
                      isMobile={isMobile}
                      disabled={!hasData}
                      onSwipe={() => onDeleteRow(i)}
                      className={isMobile ? cardClass : rowClass}
                      style={{ borderBottom: isMobile ? 'none' : '' }}
                    >
                      {/* CARD HEADER OR NO. ROW */}
                      <td
                        onClick={() => { if (isMobile && !isAlwaysExpanded) toggleExpand(i) }}
                        className={isMobile
                          ? `flex justify-between items-center px-4 py-3 ${!isAlwaysExpanded ? 'cursor-pointer active:opacity-80' : ''} ${isCollapsedEmpty ? 'bg-surface-2/50 text-label-2' : 'bg-surface-2 text-label border-b border-sep'} transition-colors select-none`
                          : `table-cell w-[56px] text-center px-1.5 py-1.5 align-middle relative`
                        }
                      >
                         {isMobile ? (
                            <div className="flex flex-col gap-1 w-full max-w-[85%]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center rounded-full bg-fill px-2.5 py-0.5 text-[11px] font-semibold tracking-wider uppercase text-label-2">
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
                                <span className="text-footnote leading-snug mt-0.5 text-label-2">Kosong — ketuk untuk mengisi</span>
                              )}
                            </div>
                         ) : (
                            <div className="flex flex-col justify-center items-center gap-1 h-full">
                               <span className="font-mono text-footnote font-semibold text-label-2">{i + 1}</span>
                               {renderNo?.(r, i)}
                            </div>
                         )}

                         {isMobile && !isAlwaysExpanded && (
                            <div className="flex shrink-0 items-center justify-center w-9 h-9 rounded-full bg-fill text-label-2">
                               {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                         )}

                         {payInvalid && !isMobile && <AlertCircle size={16} className="text-negative animate-pulse absolute left-1 top-1/2 -translate-y-1/2" />}
                      </td>

                      {expanded && (
                         <>
                            {Object.keys(blank)
                              .filter((k) => k !== "bayar" && !k.startsWith("_"))
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
                                     <td key={k} className={`flex flex-col px-4 py-3 border-b border-sep ${addClass}`}>
                                        <span className="block text-caption font-semibold text-label-2 uppercase tracking-[0.04em] mb-1">
                                           {rawLabel}
                                        </span>
                                        <div className="w-full relative">{content}</div>
                                     </td>
                                   )
                                };

                                const overridden = renderCell?.({
                                  keyName: k,
                                  kind,
                                  value,
                                  row: r,
                                  rowIndex: i,
                                  inputBase,
                                  onKeyNav,
                                  updateRow,
                                });

                                if (overridden !== undefined) return tdWrapper(overridden);

                                if (k === "harga") {
                                  return tdWrapper(
                                      <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-caption text-label-3 font-semibold select-none pointer-events-none">Rp</span>
                                        <input
                                          data-fieldid={`table-${title.replace(/\s+/g,'-')}-${i}-${k}`}
                                          inputMode="numeric"
                                          className={`${inputBase} pl-9 font-mono font-medium text-label placeholder:text-label-3`}
                                          value={rowAny.harga ?? ""}
                                          onChange={(e) => updateRow(i, { harga: toInt(e.target.value) } as any)}
                                          onKeyDown={onKeyNav}
                                          placeholder="0"
                                        />
                                      </div>,
                                      !isMobile ? "w-[124px] lg:w-[144px]" : ""
                                  );
                                }

                                if (kind === "time") {
                                  return tdWrapper(
                                      <div className="relative flex items-center">
                                        <input
                                          data-fieldid={`table-${title.replace(/\s+/g,'-')}-${i}-${k}`}
                                          type="time"
                                          className={`${inputBase} font-mono`}
                                          value={value}
                                          onChange={(e) => updateRow(i, { [k]: e.target.value } as any)}
                                          onKeyDown={onKeyNav}
                                        />
                                        {!value && <Clock className="absolute right-3 h-4 w-4 text-label-3 pointer-events-none" />}
                                      </div>
                                  );
                                }
                                
                                if (kind === "number") {
                                  return tdWrapper(
                                      <input
                                        data-fieldid={`table-${title.replace(/\s+/g,'-')}-${i}-${k}`}
                                        type="number" inputMode="numeric" pattern="[0-9]*"
                                        min={0}
                                        className={`${inputBase} font-mono`}
                                        value={value}
                                        onChange={(e) => updateRow(i, { [k]: e.target.value } as any)}
                                        onKeyDown={onKeyNav}
                                        placeholder="0"
                                      />
                                  );
                                }
                                
                                return tdWrapper(
                                    <input
                                      data-fieldid={`table-${title.replace(/\s+/g,'-')}-${i}-${k}`}
                                      className={inputBase}
                                      value={value}
                                      onChange={(e) => updateRow(i, { [k]: e.target.value } as any)}
                                      onKeyDown={onKeyNav}
                                      placeholder={k.replace(/_/g, " ")}
                                    />
                                );
                            })}
                            
                            {/* Cash Toggle */}
                            <td className={isMobile ? `flex justify-between items-center px-4 py-3 border-b border-sep` : `table-cell w-[80px] text-center align-middle px-2 py-1.5`}>
                               {isMobile && <span className="text-caption font-semibold text-label-2 uppercase tracking-[0.04em]">Metode Cash</span>}
                               <button
                                 type="button"
                                 disabled={rowAny.isPaid === "TIDAK"}
                                 onClick={() => {
                                   if (rowAny.isPaid === "TIDAK") return;
                                   const nextVal = bayarSet.has("Cash") ? "" : "Cash";
                                   const patch: any = { bayar: nextVal };
                                   if (rowAny.jenisPS === "Hanya Ongkir") {
                                     patch._bayarOngkir = nextVal;
                                   }
                                   updateRow(i, patch as any);
                                 }}
                                 className={`inline-flex items-center justify-center transition active:scale-95 ${
                                   isMobile
                                    ? `h-11 min-w-[92px] px-3 rounded-field font-semibold text-subhead ${rowAny.isPaid === "TIDAK" ? "bg-fill text-label-3 opacity-50 cursor-not-allowed" : bayarSet.has("Cash") ? "bg-positive text-white" : "bg-fill text-label-2"}`
                                    : `h-9 w-9 rounded-full ${rowAny.isPaid === "TIDAK" ? "bg-fill text-label-3 opacity-50 cursor-not-allowed" : bayarSet.has("Cash") ? "bg-positive text-white" : "bg-fill text-label-3 hover:text-label-2"}`
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
                            <td className={isMobile ? `flex justify-between items-center px-4 py-3 bg-surface-2/40` : `table-cell min-w-[100px] text-center align-middle px-2 py-1.5`}>
                               {isMobile && <span className="text-caption font-semibold text-label-2 uppercase tracking-[0.04em] shrink-0">Metode TF / QRIS</span>}
                               <div className={`flex items-center gap-2 ${isMobile ? "justify-end" : "justify-center w-full"}`}>
                                 <button
                                   type="button"
                                   disabled={rowAny.isPaid === "TIDAK"}
                                   onClick={() => {
                                     if (rowAny.isPaid === "TIDAK") return;
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
                                      ? `h-11 min-w-[92px] px-3 rounded-field font-semibold text-subhead ${rowAny.isPaid === "TIDAK" ? "bg-fill text-label-3 opacity-50 cursor-not-allowed" : bayarSet.has("Transfer") ? "bg-tint text-white" : "bg-fill text-label-2"}`
                                      : `h-9 w-9 rounded-full ${rowAny.isPaid === "TIDAK" ? "bg-fill text-label-3 opacity-50 cursor-not-allowed" : bayarSet.has("Transfer") ? "bg-tint text-white" : "bg-fill text-label-3 hover:text-label-2"}`
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
                                   />
                                 )}
                               </div>
                            </td>

                            {/* Per-Row Action Buttons (Card Mode) */}
                            {isMobile && (
                              <td className="flex justify-center items-center gap-3 px-4 py-2.5 border-t border-sep">
                                {hasData && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateRow(i, { ...blank } as any);
                                    }}
                                    className="flex min-h-[40px] items-center gap-1.5 text-caption font-semibold text-label-2 hover:text-warning transition-colors active:scale-95 px-3 rounded-field hover:bg-warning/10"
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
                                  className="flex min-h-[40px] items-center gap-1.5 text-caption font-semibold text-label-2 hover:text-negative transition-colors active:scale-95 px-3 rounded-field hover:bg-negative/10"
                                >
                                  <Trash2 size={13} />
                                  Hapus Baris
                                </button>
                              </td>
                            )}

                            {/* Per-Row Action Buttons (Classic Mode) */}
                            {!isMobile && (
                              <td className="table-cell text-center align-middle px-2 py-1.5">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updateRow(i, { ...blank } as any)}
                                    className="flex items-center justify-center w-8 h-8 rounded-control bg-fill text-label-2 hover:bg-warning/15 hover:text-warning active:scale-90 transition"
                                    title="Reset baris ini"
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteRow(i)}
                                    className="flex items-center justify-center w-8 h-8 rounded-control bg-fill text-label-2 hover:bg-negative/15 hover:text-negative active:scale-90 transition"
                                    title="Hapus baris ini"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            )}
                      </>
                      )}
                    </SwipeableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Bar — UDS: reset kiri, tambah baris kanan */}
        <div className="flex w-full items-center justify-between gap-3">
          {showResetConfirm ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-footnote font-semibold text-label-2">Reset tabel?</span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  handleReset();
                  setShowResetConfirm(false);
                }}
              >
                Ya, Reset
              </Button>
              <Button
                variant="gray"
                size="sm"
                onClick={() => setShowResetConfirm(false)}
              >
                Batal
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { onClear?.(); setShowResetConfirm(true); }}
              className="flex items-center justify-center w-11 h-11 rounded-full bg-fill text-label-2 hover:text-label active:scale-95 transition"
              title="Reset / Clear Tabel"
              aria-label="Reset tabel"
            >
              <RotateCcw size={17} />
            </button>
          )}

          <Button
            variant="filled"
            size="md"
            icon={<Plus size={16} />}
            onClick={onAddRow}
            className="rounded-full"
          >
            Tambah Baris
          </Button>
        </div>
      </div>
    </Section>
  );
}
