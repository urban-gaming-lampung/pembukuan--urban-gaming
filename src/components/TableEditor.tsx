import React from "react";
import { toInt } from "../lib/format";
import Section from "./common/Section";
import {
  Clock,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  Circle,
  AlertCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";

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

const currency = (n: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  })
    .format(n)
    .replace("Rp", "Rp ");

function getThemeColors(title: string) {
  const t = (title || "").toLowerCase();

  // Custom hex accent per table
  if (t.includes("jajanan")) {
    return { color: "#F1A41D", borderFocus: "focus:ring-[#F1A41D]/30 focus:border-[#F1A41D]" };
  }
  if (t.includes("harian")) {
    return { color: "#25BE8D", borderFocus: "focus:ring-[#25BE8D]/30 focus:border-[#25BE8D]" };
  }
  if (t.includes("sewa")) {
    return { color: "#0EA5E8", borderFocus: "focus:ring-[#0EA5E8]/30 focus:border-[#0EA5E8]" };
  }
  if (t.includes("jasa") || t.includes("aksesoris")) {
    return { color: "#ED4343", borderFocus: "focus:ring-[#ED4343]/30 focus:border-[#ED4343]" };
  }
  if (t.includes("pengeluaran")) {
    return { color: "#E11D48", borderFocus: "focus:ring-[#E11D48]/30 focus:border-[#E11D48]" };
  }
  if (t.includes("setoran")) {
    return { color: "#0D9488", borderFocus: "focus:ring-[#0D9488]/30 focus:border-[#0D9488]" };
  }

  return { color: "#71717A", borderFocus: "focus:ring-zinc-400/20 focus:border-zinc-400" };
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

const SwipeableRow = ({ isMobile, className, style, children, onSwipe, disabled, isRed }: any) => {
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
        transform: `translateX(${swipeX}px)`, 
        opacity: isSwiping ? opacity : 1,
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

// --- MAIN COMPONENT ---

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
  } = props;

  const [isMobileScreen, setIsMobileScreen] = React.useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  React.useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = isMobileTable; // Card mode for all screen sizes if 'Baru'
  const actualMinRows = minRows;

  // Mendapatkan tema warna berdasarkan Judul Tabel
  const theme = React.useMemo(() => getThemeColors(title), [title]);
  const total = React.useMemo(
    () => rows.reduce((s, r) => s + getHarga(r), 0),
    [rows, getHarga]
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

  // Header Table
  const thBase = `px-3 py-3 text-[13px] font-bold uppercase tracking-wider text-white whitespace-nowrap sticky top-0 z-10 shadow-sm`;

  const inputBase = `w-full h-9 px-2 rounded-lg bg-transparent border border-transparent
    hover:border-zinc-200 dark:hover:border-zinc-700
    focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-300 dark:focus:border-zinc-600
    focus:shadow-sm focus:outline-none focus:ring-2 ${theme.borderFocus}
    transition-all duration-200 text-sm placeholder:text-zinc-300 dark:placeholder:text-zinc-600`;

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

  const onRemoveLastRow = () => {
    setRows((prev) => {
      if (prev.length <= (actualMinRows || 1)) return prev;
      return prev.slice(0, -1);
    });
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
    
    if (finalHrg > 0) text += `- ${currency(finalHrg)}`;

    return text.trim();
  }, [getHarga]);

  return (
    <Section>
      <div className="flex flex-col gap-4">
        {/* Header Section */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 rounded-full" style={{ backgroundColor: theme.color }} />
            <h2
              className={`text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100`}
            >
              {title}
            </h2>
          </div>
          <div className="text-right">
             {props.title.toLowerCase().includes("pengeluaran") ? (
               <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Total Keluar</div>
             ) : (
                <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">Total</div>
             )}
            <div className="text-lg font-bold tracking-tight" style={{ color: theme.color }}>
              {currency(total)}
            </div>
          </div>
        </div>

        {/* Table Wrapper controlled entirely by isMobile state */}
        <div className={`relative overflow-hidden ${isMobile ? "bg-transparent shadow-none" : "border border-zinc-200/60 bg-white shadow-sm dark:border-zinc-800 dark:bg-[#1C1C1E]/40 rounded-[20px]"}`}>
          <div ref={wrapRef} className="overflow-x-auto overflow-y-visible" style={{ maxHeight: "70vh" }}>
            <table className="min-w-full text-sm">
              <thead className={isMobile ? "hidden" : "table-header-group"}>
                <tr>
                  {columns.map((c, i) => (
                    <th key={i} className={thBase} style={{ backgroundColor: theme.color }}>
                      {c}
                    </th>
                  ))}
                  <th className={`${thBase} text-center`} style={{ backgroundColor: theme.color }}>Aksi</th>
                </tr>
              </thead>
              
              <tbody className={isMobile ? "flex flex-col gap-4" : "table-row-group divide-y divide-zinc-100 dark:divide-zinc-800/50"}>
                {rows.map((r, i) => {
                  const rowAny = r as any;
                  const hargaKeluar = isHargaKeluar(rowAny);
                  const bayarSet = parseBayar(rowAny.bayar);
                  const payInvalid = hargaKeluar && bayarSet.size === 0 && showPayErrors;

                  const summary = getSmartSummary(rowAny);
                  const hasData = summary !== "";
                  const expanded = isExpanded(i);
                  const isCollapsedEmpty = !expanded && !hasData;

                  const cardClass = `flex flex-col rounded-[24px] ring-1 overflow-hidden transition-all duration-300 ${
                    payInvalid ? "ring-red-500/50 bg-red-50/50 dark:bg-red-900/10 shadow-sm" : 
                    isCollapsedEmpty ? "bg-zinc-50/50 dark:bg-[#1C1C1E]/50 ring-black/5 dark:ring-white/5 opacity-80 shadow-none scale-[0.98]" : 
                    "bg-white dark:bg-[#1C1C1E] ring-black/5 dark:ring-white/10 shadow-sm hover:shadow-md"
                  }`;
                  const rowClass = `table-row group transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 ${payInvalid ? "bg-red-50/50 dark:bg-red-900/10" : ""}`;

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
                          ? `flex justify-between items-center px-4 py-3.5 ${!isAlwaysExpanded ? 'cursor-pointer active:scale-[0.98]' : ''} ${isCollapsedEmpty ? 'bg-zinc-100/80 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400' : 'text-white'} transition-all duration-300 select-none` 
                          : `table-cell w-[50px] text-center px-1.5 py-1.5 align-middle`
                        }
                        style={isMobile ? (isCollapsedEmpty ? {} : { backgroundColor: theme.color }) : {}}
                      >
                         {isMobile ? (
                            <div className="flex flex-col gap-1 w-full max-w-[85%]">
                              <div className="flex items-center gap-2">
                                <span className={`font-extrabold text-[12px] tracking-widest uppercase ${isCollapsedEmpty ? 'text-zinc-500 dark:text-zinc-400' : 'text-white/95'}`}>
                                  <span className={isCollapsedEmpty ? "bg-zinc-200/50 dark:bg-zinc-700/50 px-2.5 py-1 rounded-full text-[10px]" : "bg-white/20 px-2.5 py-1 rounded-full shadow-inner shadow-black/10 text-[10px]"}>BARIS {i + 1}</span>
                                </span>
                                {!expanded && hasData && (
                                   <div className="flex items-center justify-center bg-white/20 backdrop-blur-md rounded-full p-0.5 shadow-sm animate-in zoom-in-95">
                                      <Check size={12} strokeWidth={3} className="text-white drop-shadow-sm" />
                                   </div>
                                )}
                              </div>
                              {!expanded && hasData && (
                                <span className="text-[14px] font-bold leading-relaxed line-clamp-1 truncate mt-0.5 text-white/95 drop-shadow-sm">{summary}</span>
                              )}
                              {isCollapsedEmpty && (
                                <span className="text-[13px] font-medium opacity-80 leading-relaxed mt-0.5 italic text-zinc-400 dark:text-zinc-500">Kosong — ketuk untuk mengisi data...</span>
                              )}
                            </div>
                         ) : (
                            <div className="flex justify-center items-center h-full">
                               <span className="font-mono text-sm tracking-widest font-bold text-zinc-500 dark:text-zinc-400">{i + 1}</span>
                            </div>
                         )}

                         {isMobile && !isAlwaysExpanded && (
                            <div className={`flex flex-shrink-0 items-center justify-center w-8 h-8 rounded-full shadow-inner transition-transform ${isCollapsedEmpty ? 'bg-black/5 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/5' : 'bg-black/10 ring-1 ring-white/10 backdrop-blur-sm'}`}>
                               {expanded ? <ChevronUp size={20} className={isCollapsedEmpty ? 'opacity-50 text-current' : 'opacity-90 text-white'} /> : <ChevronDown size={20} className={isCollapsedEmpty ? 'opacity-50 text-current' : 'opacity-90 text-white'} />}
                            </div>
                         )}

                         {payInvalid && !isMobile && <AlertCircle size={18} className="text-red-500 animate-pulse absolute left-2 top-1/2 -translate-y-1/2" />}
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
                                     <td key={k} className={`flex flex-col px-4 py-3 border-b border-zinc-100 dark:border-white/5 animate-in slide-in-from-top-2 fade-in duration-200 zoom-in-95 ${addClass}`}>
                                        <span className="block text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
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
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-zinc-400 font-bold tracking-widest select-none pointer-events-none">Rp</span>
                                        <input
                                          data-fieldid={`table-${title.replace(/\s+/g,'-')}-${i}-${k}`}
                                          inputMode="numeric"
                                          className={`${inputBase} pl-10 font-mono font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600`}
                                          value={rowAny.harga ?? ""}
                                          onChange={(e) => updateRow(i, { harga: toInt(e.target.value) } as any)}
                                          onKeyDown={onKeyNav}
                                          placeholder="0"
                                        />
                                      </div>,
                                      !isMobile ? "w-[120px] lg:w-[140px]" : ""
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
                                        {!value && <Clock className="absolute right-3 h-4 w-4 text-zinc-300 pointer-events-none" />}
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
                            <td className={isMobile ? `flex justify-between items-center px-4 py-3.5 animate-in fade-in` : `table-cell w-[80px] text-center align-middle px-2 py-1.5`}>
                               {isMobile && <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">Metode CASH</span>}
                               <button
                                 type="button"
                                 disabled={rowAny.isPaid === "TIDAK"}
                                 onClick={() => {
                                   if (rowAny.isPaid === "TIDAK") return;
                                   updateRow(i, { bayar: bayarSet.has("Cash") ? "" : "Cash" } as any)
                                 }}
                                 className={`inline-flex items-center justify-center transition-all duration-200 active:scale-95 ${
                                   isMobile 
                                    ? `h-[42px] w-[80px] rounded-xl font-bold text-[13px] ${rowAny.isPaid === "TIDAK" ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 opacity-50 cursor-not-allowed" : bayarSet.has("Cash") ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/40" : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400"}`
                                    : `h-9 w-9 rounded-full ${rowAny.isPaid === "TIDAK" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-50 cursor-not-allowed" : bayarSet.has("Cash") ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/40" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-400"}`
                                 }`}
                               >
                                 {bayarSet.has("Cash") ? (
                                   isMobile ? "CASH" : <Check size={20} strokeWidth={3} />
                                 ) : (
                                   isMobile ? "---" : <Circle size={20} strokeWidth={2} />
                                 )}
                               </button>
                            </td>
                            
                            {/* Transfer Toggle */}
                            <td className={isMobile ? `flex justify-between items-center px-4 py-3.5 animate-in fade-in bg-zinc-50/50 dark:bg-black/5` : `table-cell w-[80px] text-center align-middle px-2 py-1.5`}>
                               {isMobile && <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">Metode TRF/QRIS</span>}
                               <button
                                 type="button"
                                 disabled={rowAny.isPaid === "TIDAK"}
                                 onClick={() => {
                                   if (rowAny.isPaid === "TIDAK") return;
                                   updateRow(i, { bayar: bayarSet.has("Transfer") ? "" : "Transfer" } as any)
                                 }}
                                 className={`inline-flex items-center justify-center transition-all duration-200 active:scale-95 ${
                                   isMobile 
                                    ? `h-[42px] w-[80px] rounded-xl font-bold text-[13px] ${rowAny.isPaid === "TIDAK" ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 opacity-50 cursor-not-allowed" : bayarSet.has("Transfer") ? "bg-blue-500 text-white shadow-md shadow-blue-500/40" : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400"}`
                                    : `h-9 w-9 rounded-full ${rowAny.isPaid === "TIDAK" ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-50 cursor-not-allowed" : bayarSet.has("Transfer") ? "bg-blue-500 text-white shadow-md shadow-blue-500/40" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-400"}`
                                 }`}
                               >
                                 {bayarSet.has("Transfer") ? (
                                   isMobile ? "TF/QRIS" : <Check size={20} strokeWidth={3} />
                                 ) : (
                                   isMobile ? "---" : <Circle size={20} strokeWidth={2} />
                                 )}
                               </button>
                            </td>

                            {/* Per-Row Action Buttons (Card Mode) */}
                            {isMobile && (
                              <td className="flex justify-center items-center gap-3 px-4 py-3 animate-in fade-in">
                                {hasData && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateRow(i, { ...blank } as any);
                                    }}
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 hover:text-orange-500 dark:hover:text-orange-400 transition-colors active:scale-95 px-3 py-1.5 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10"
                                  >
                                    <RotateCcw size={12} strokeWidth={2.5} />
                                    Reset
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteRow(i);
                                  }}
                                  className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors active:scale-95 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 size={12} strokeWidth={2.5} />
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
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-orange-100 dark:hover:bg-orange-500/15 hover:text-orange-500 dark:hover:text-orange-400 active:scale-90 transition-all duration-200"
                                    title="Reset baris ini"
                                  >
                                    <RotateCcw size={14} strokeWidth={2.2} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteRow(i)}
                                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:bg-red-100 dark:hover:bg-red-500/15 hover:text-red-500 dark:hover:text-red-400 active:scale-90 transition-all duration-200"
                                    title="Hapus baris ini"
                                  >
                                    <Trash2 size={14} strokeWidth={2.2} />
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

        {/* Action Bar — Apple-style: reset left, delete + tambah baris right */}
        <div className={`flex w-full items-center justify-between gap-3 ${isMobile ? "px-1" : ""}`}>
          {/* Left: Reset */}
          {showResetConfirm ? (
            <div className="flex animate-in slide-in-from-left fade-in items-center gap-2.5">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Reset tabel?</span>
              <button
                onClick={() => {
                  handleReset();
                  setShowResetConfirm(false);
                }}
                className="py-1.5 px-3.5 rounded-xl text-xs font-bold bg-red-500 text-white shadow-md shadow-red-500/30 active:scale-95 uppercase tracking-wider transition-all"
              >
                Ya, Reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="py-1.5 px-3.5 rounded-xl text-xs font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-white active:scale-95 uppercase tracking-wider transition-all"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { onClear?.(); setShowResetConfirm(true); }}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-90 transition-all duration-200 shadow-sm"
              title="Reset / Clear Tabel"
            >
              <RotateCcw size={17} strokeWidth={2.2} />
            </button>
          )}

          {/* Right: Tambah Baris (delete button removed — per-row delete replaces it) */}
          <div className="flex items-center gap-2">
            <button
              onClick={onAddRow}
              className="flex h-10 items-center gap-2 rounded-full bg-zinc-900 dark:bg-white border border-zinc-900 dark:border-white px-5 text-[13px] font-bold text-white dark:text-zinc-900 shadow-sm hover:shadow-md hover:bg-zinc-800 dark:hover:bg-zinc-100 active:scale-[0.96] transition-all duration-200"
            >
              <Plus size={16} strokeWidth={2.5} />
              Tambah Baris
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}
