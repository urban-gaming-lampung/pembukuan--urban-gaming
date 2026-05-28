import React, { useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import Section from "./common/Section";
import { HistoryItem } from "../lib/types";
import { rupiah } from "../lib/format";

type Props = {
  items: HistoryItem[];
  onClear?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isOwner?: boolean;
};

// --- SECURITY CONFIG ---
const ADMIN_PASSWORD = "707426";

// --- ICONS ---
function TrashIcon({ size = 16, className }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M9 3h6m-8 4h10m-9 0 1 16h6l1-16M10 11v8m4-8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon({ size = 16, className }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
  );
}

function EditIcon({ size = 16, className }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function WarningIcon({ size = 16, className }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// --- MAIN COMPONENT ---

export default function HistoryPembukuan({ items, onClear, onEdit, onDelete, isOwner = false }: Props) {
  // Global Security State
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [securityAction, setSecurityAction] = useState<'clear' | 'delete'>('clear');
  const [actionId, setActionId] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Row Action State (Edit/Delete Popup)
  const [activeAction, setActiveAction] = useState<{
    id: string;
    type: 'edit' | 'delete';
    data: HistoryItem;
  } | null>(null);

  // Mobile Collapse State
  const [expandedMobile, setExpandedMobile] = useState<string[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<number[]>([]);

  const toggleMobileExpand = (id: string) => {
    setExpandedMobile(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleWeekExpand = (w: number) => {
    setExpandedWeeks(prev => prev.includes(w) ? prev.filter(i => i !== w) : [...prev, w]);
  };

  const toggleAllMobile = () => {
    if (expandedWeeks.length === 4) {
      setExpandedWeeks([]);
      setExpandedMobile([]);
    } else {
      setExpandedWeeks([1, 2, 3, 4]);
      setExpandedMobile(items.map(h => h.id));
    }
  };

  // --- LOGIC CALCULATIONS ---
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
    });
  }, [items]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);

    if (passwordInput.trim() === ADMIN_PASSWORD) {
      if (securityAction === 'clear' && onClear) {
        onClear();
      } else if (securityAction === 'delete' && onDelete && actionId) {
        onDelete(actionId);
      }
      setIsSecurityOpen(false);
      setPasswordInput("");
      setSecurityAction('clear');
      setActionId(null);
    } else {
      setErrorMsg("Password salah. Akses ditolak.");
    }

    setIsLoading(false);
  };

  const subtotal = useMemo(() => {
    return items.reduce(
      (acc, h) => {
        acc.harian += h.totalHarian || 0;
        acc.jajanan += h.totalJajanan || 0;
        acc.jasa += h.totalJasaAks || 0;
        acc.sewa += h.totalSewa || 0;
        acc.cash += (h as any).totalCash || 0;
        acc.transfer += (h as any).totalTransfer || 0;
        return acc;
      },
      { harian: 0, jajanan: 0, jasa: 0, sewa: 0, cash: 0, transfer: 0 }
    );
  }, [items]);

  const subtotalGrand = subtotal.harian + subtotal.jajanan + subtotal.jasa + subtotal.sewa;

  const itemsWithNotes = useMemo(() => {
    return sortedItems.filter(h => h.catatan && h.catatan.trim().length > 0);
  }, [sortedItems]);

  const weeklyGroups = useMemo(() => {
    const groups = {
      1: { name: "Minggu 1", total: 0, items: [] as HistoryItem[] },
      2: { name: "Minggu 2", total: 0, items: [] as HistoryItem[] },
      3: { name: "Minggu 3", total: 0, items: [] as HistoryItem[] },
      4: { name: "Minggu 4", total: 0, items: [] as HistoryItem[] }
    };

    sortedItems.forEach(h => {
      // Expect format YYYY-MM-DD or similar date string
      const dateObj = new Date(h.tanggal);
      // if invalid date fallback to 1
      const date = isNaN(dateObj.getTime()) ? parseInt(h.tanggal.split("-")[2] || "1") : dateObj.getDate();
      const grand = (h.totalHarian || 0) + (h.totalJajanan || 0) + (h.totalJasaAks || 0) + (h.totalSewa || 0);

      let week = 4;
      if (date <= 7) week = 1;
      else if (date <= 14) week = 2;
      else if (date <= 21) week = 3;

      groups[week as keyof typeof groups].items.push(h);
      groups[week as keyof typeof groups].total += grand;
    });

    return Object.entries(groups).map(([w, data]) => ({ week: Number(w), ...data }));
  }, [sortedItems]);

  // --- APPLE DESIGN TOKENS ---
  const glassPanel = "bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-white/20 dark:border-white/5 shadow-sm";
  const glassCard = "bg-white/40 dark:bg-zinc-800/40 backdrop-blur-md border border-black/5 dark:border-white/5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]";

  const thStyle = "px-2 py-3 text-[10px] xl:text-[11px] uppercase tracking-wider font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-[#18181B] border-b border-zinc-200/50 dark:border-zinc-800/50 text-left sticky top-0 z-10 whitespace-nowrap";
  const thAksiStyle = `${thStyle} sticky right-0 z-[20] border-l border-zinc-200/50 dark:border-white/5 shadow-[-4px_0_10px_rgba(0,0,0,0.02)] text-center`;
  const tdStyle = "px-2 py-2.5 text-[12px] xl:text-[13px] font-medium text-zinc-700 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-800/50 align-middle whitespace-nowrap";
  const tdAksiStyle = "px-2 py-2.5 text-center sticky right-0 bg-white dark:bg-[#1C1C1E] group-hover:bg-blue-50/50 dark:group-hover:bg-[#202028] transition-colors duration-150 border-b border-l border-zinc-100 dark:border-zinc-800/50 dark:border-l-white/5 align-middle z-[5] shadow-[-6px_0_15px_-3px_rgba(0,0,0,0.05)] dark:shadow-[-6px_0_15px_-3px_rgba(0,0,0,0.3)]";
  const trHover = "hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors duration-150 group";

  // --- HANDLERS FOR POPUPS ---
  const triggerEdit = (item: HistoryItem) => {
    setActiveAction({ id: item.id, type: 'edit', data: item });
  };

  const triggerDelete = (item: HistoryItem) => {
    setActiveAction({ id: item.id, type: 'delete', data: item });
  };

  const confirmAction = () => {
    if (!activeAction) return;

    if (activeAction.type === 'edit' && onEdit) {
      onEdit(activeAction.id);
      setActiveAction(null);
    } else if (activeAction.type === 'delete') {
      // Redirect to Security Modal
      setSecurityAction('delete');
      setActionId(activeAction.id);
      setErrorMsg("");
      setPasswordInput("");
      setIsSecurityOpen(true);
      setActiveAction(null); // Close the confirmation modal
    }
  };

  return (
    <>
      <Section title="History Pembukuan">

        {/* DESKTOP TABLE */}
        <div className={`hidden md:block w-full rounded-[20px] overflow-hidden ${glassPanel}`}>
          <div className="overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thStyle}>Tanggal</th>
                  <th className={thStyle}>Hari</th>
                  <th className={thStyle}>Harian</th>
                  <th className={thStyle}>Jajanan</th>
                  <th className={thStyle}>Jasa/Aks</th>
                  <th className={thStyle}>Sewa PS</th>
                  {isOwner && (
                    <>
                      <th className={thStyle}>Total</th>
                      <th className={thStyle}><span className="text-green-600 dark:text-green-500">Cash</span></th>
                      <th className={thStyle}><span className="text-blue-600 dark:text-blue-500">TF</span></th>
                    </>
                  )}
                  <th className={`${thAksiStyle}`}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Tidak ada data untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((h) => {
                    const grand = (h.totalHarian || 0) + (h.totalJajanan || 0) + (h.totalJasaAks || 0) + (h.totalSewa || 0);
                    return (
                      <tr key={h.id} className={trHover}>
                        <td className={tdStyle}>{h.tanggal}</td>
                        <td className={`${tdStyle} capitalize`}>{h.hari}</td>
                        <td className={tdStyle}>{rupiah(h.totalHarian)}</td>
                        <td className={tdStyle}>{rupiah(h.totalJajanan)}</td>
                        <td className={tdStyle}>{rupiah(h.totalJasaAks)}</td>
                        <td className={tdStyle}>{rupiah(h.totalSewa)}</td>
                        {isOwner && (
                          <>
                            <td className={`${tdStyle} font-semibold`}>{rupiah(grand)}</td>
                            <td className={`${tdStyle} text-green-600 dark:text-green-500 font-medium`}>{(h as any).totalCash ? rupiah((h as any).totalCash) : "-"}</td>
                            <td className={`${tdStyle} text-blue-600 dark:text-blue-500 font-medium`}>{(h as any).totalTransfer ? rupiah((h as any).totalTransfer) : "-"}</td>
                          </>
                        )}

                        <td className={tdAksiStyle}>
                          <div className="flex items-center justify-center gap-1.5">
                            <ActionButton onClick={() => triggerEdit(h)} disabled={!onEdit} icon={<EditIcon size={14} />} label="Load" />
                            {isOwner && (
                              <ActionButton onClick={() => triggerDelete(h)} disabled={!onDelete} variant="destructive" icon={<TrashIcon size={14} />} label="Hapus" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}

                {sortedItems.length > 0 && (
                  <tr className="bg-zinc-100 dark:bg-[#18181B] font-semibold sticky bottom-0 shadow-[0_-1px_0_rgba(0,0,0,0.1)] dark:shadow-[0_-1px_0_rgba(255,255,255,0.05)] z-[30]">
                    <td colSpan={2} className="px-2 py-3 text-[11px] uppercase tracking-wide text-zinc-500 text-right whitespace-nowrap">Grand Total</td>
                    <td className={tdStyle}>{rupiah(subtotal.harian)}</td>
                    <td className={tdStyle}>{rupiah(subtotal.jajanan)}</td>
                    <td className={tdStyle}>{rupiah(subtotal.jasa)}</td>
                    <td className={tdStyle}>{rupiah(subtotal.sewa)}</td>
                    {isOwner && (
                      <>
                        <td className={`${tdStyle} font-bold text-zinc-900 dark:text-white`}>{rupiah(subtotalGrand)}</td>
                        <td className={`${tdStyle} text-green-600 dark:text-green-400`}>{rupiah(subtotal.cash)}</td>
                        <td className={`${tdStyle} text-blue-600 dark:text-blue-400`}>{rupiah(subtotal.transfer)}</td>
                      </>
                    )}
                    <td className="sticky right-0 bg-zinc-100 dark:bg-[#18181B] border-l border-zinc-200/50 dark:border-white/5 z-[35]"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MOBILE VIEW PIECES */}
        <div className="md:hidden flex flex-col gap-4">
          {sortedItems.length > 0 && (
            <div className="flex justify-end mb-[-4px]">
              <button
                onClick={toggleAllMobile}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
              >
                {expandedWeeks.length === 4 ? "Collapse All" : "Expand All"}
              </button>
            </div>
          )}
          {sortedItems.length === 0 ? (
            <div className={`p-8 text-center text-sm text-zinc-500 rounded-2xl ${glassCard}`}>
              Tidak ada data untuk periode ini.
            </div>
          ) : (
            weeklyGroups.map((g) => {
              const isWeekExpanded = expandedWeeks.includes(g.week);

              return (
                <div key={`week-${g.week}`} className={`rounded-[22px] p-4 sm:p-5 ${glassCard} transition-all border border-black/5 dark:border-white/5`}>
                  {/* WEEK HEADER */}
                  <div
                    className={`flex justify-between items-center cursor-pointer active:opacity-70 transition-all ${isWeekExpanded ? 'mb-4 pb-3 border-b border-black/5 dark:border-white/5' : ''}`}
                    onClick={() => toggleWeekExpand(g.week)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm">
                        <span className="text-sm font-black">{g.week}</span>
                      </div>
                      <span className="text-base font-bold text-zinc-800 dark:text-zinc-100">{g.name}</span>
                    </div>
                    {isOwner && (
                      <div className="text-right flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-zinc-400 uppercase tracking-wider font-bold">Pendapatan</span>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{rupiah(g.total)}</span>
                        </div>
                        <svg className={`w-5 h-5 text-zinc-400 transition-transform ${isWeekExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    )}
                  </div>

                  {/* WEEK ITEMS */}
                  {isWeekExpanded && (
                    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                      {g.items.length === 0 ? (
                        <div className="text-center py-4 text-[11px] font-semibold text-zinc-400 bg-white/30 dark:bg-black/20 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">Tidak ada pemasukan di minggu ini</div>
                      ) : (
                        g.items.map(h => {
                          const grand = (h.totalHarian || 0) + (h.totalJajanan || 0) + (h.totalJasaAks || 0) + (h.totalSewa || 0);
                          const isItemExpanded = expandedMobile.includes(h.id);
                          return (
                            <div key={h.id} className="bg-white/80 dark:bg-black/40 rounded-[16px] p-4 border border-zinc-100 dark:border-white/5 shadow-sm">
                              <div
                                className={`flex justify-between items-start cursor-pointer transition-colors active:opacity-70 ${isItemExpanded ? 'border-b border-black/5 dark:border-white/5 pb-3 mb-3' : ''}`}
                                onClick={() => toggleMobileExpand(h.id)}
                              >
                                <div className="flex flex-col">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{h.hari}</div>
                                  <div className="text-base font-bold text-zinc-800 dark:text-zinc-100">{h.tanggal}</div>
                                </div>
                                <div className="text-right flex items-center gap-2 h-full">
                                  {isOwner && (
                                    <div className="flex flex-col justify-center">
                                      <div className="text-[10px] text-zinc-400">Total</div>
                                      <div className="text-sm font-bold text-zinc-900 dark:text-white">
                                        {rupiah(grand)}
                                      </div>
                                    </div>
                                  )}
                                  <svg className={`w-4 h-4 text-zinc-400 transition-transform ${isItemExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                              </div>

                              {isItemExpanded && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs mb-4">
                                    <DetailRow label="Harian" value={rupiah(h.totalHarian)} />
                                    <DetailRow label="Jajanan" value={rupiah(h.totalJajanan)} />
                                    <DetailRow label="Jasa & Aks" value={rupiah(h.totalJasaAks)} />
                                    <DetailRow label="Sewa PS" value={rupiah(h.totalSewa)} />
                                  </div>

                                  {isOwner && (
                                    <div className="flex gap-2 mb-4">
                                      {(h as any).totalCash > 0 && (
                                        <div className="flex-1 rounded-lg bg-green-500/10 px-3 py-2 border border-green-500/20">
                                          <div className="text-[9px] uppercase font-bold text-green-600 dark:text-green-400">Cash</div>
                                          <div className="text-xs font-semibold text-green-700 dark:text-green-300">{rupiah((h as any).totalCash)}</div>
                                        </div>
                                      )}
                                      {(h as any).totalTransfer > 0 && (
                                        <div className="flex-1 rounded-lg bg-blue-500/10 px-3 py-2 border border-blue-500/20">
                                          <div className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-400">Transfer</div>
                                          <div className="text-xs font-semibold text-blue-700 dark:text-blue-300">{rupiah((h as any).totalTransfer)}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      onClick={() => triggerEdit(h)}
                                      disabled={!onEdit}
                                      className="flex items-center justify-center gap-2 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-700/50 text-xs font-medium text-zinc-700 dark:text-zinc-300 active:bg-zinc-200"
                                    >
                                      <EditIcon size={14} /> Load
                                    </button>
                                    {isOwner && (
                                    <button
                                      onClick={() => triggerDelete(h)}
                                      disabled={!onDelete}
                                      className="flex items-center justify-center gap-2 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-xs font-medium text-red-600 dark:text-red-400 active:bg-red-100 border border-red-100 dark:border-red-900/30"
                                    >
                                      <TrashIcon size={14} /> Hapus
                                    </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* NOTES SECTION */}
        {itemsWithNotes.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-4 text-sm font-semibold text-zinc-500 uppercase tracking-wide pl-1">Catatan Tersimpan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {itemsWithNotes.map((h) => (
                <div
                  key={`note-${h.id}`}
                  className={`relative p-4 rounded-2xl ${glassCard} flex flex-col gap-2 group/note`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                      {h.tanggal}
                    </span>
                    {isOwner && (
                      <button
                        onClick={async () => {
                          if (!confirm(`Hapus catatan tanggal ${h.tanggal}?`)) return;
                          try {
                            await updateDoc(doc(db, "history_pembukuan", h.id), { catatan: "" });
                          } catch (e) { console.error(e); }
                        }}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-red-100 dark:bg-zinc-800 dark:hover:bg-red-500/20 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-all md:opacity-0 md:group-hover/note:opacity-100 focus:opacity-100 active:scale-90 shrink-0"
                        title="Hapus catatan"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    "{h.catatan}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BERSIHKAN SEMUA DATA - di bawah Catatan */}
        {isOwner && (
          <div className="mt-6">
            <button
              onClick={() => {
                setErrorMsg("");
                setPasswordInput("");
                setSecurityAction('clear');
                setActionId(null);
                setIsSecurityOpen(true);
              }}
              disabled={!onClear}
              className={`w-full flex items-center justify-center gap-2.5 px-5 py-4 rounded-2xl text-center transition-all active:scale-[0.98] ${!onClear
                  ? "bg-zinc-100 dark:bg-zinc-800/50 opacity-50 cursor-not-allowed text-zinc-400"
                  : "bg-red-500/8 hover:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/15 dark:border-red-500/20"
                }`}
            >
              <LockIcon size={16} />
              <span className="text-sm font-semibold">Bersihkan Semua Data</span>
            </button>
          </div>
        )}
      </Section>

      {/* MODAL: ACTION CONFIRMATION (EDIT / DELETE) */}
      {activeAction && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-[4px] transition-all duration-300"
            onClick={() => setActiveAction(null)}
          />

          {/* Action Sheet / Modal */}
          <div className="relative w-full max-w-sm transform overflow-hidden rounded-[28px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-1 ring-black/5 dark:ring-white/10 transition-all animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300">

            {/* Header Visual */}
            <div className="flex flex-col items-center pt-8 px-6 pb-6 text-center">
              <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full ${activeAction.type === 'delete'
                  ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
                  : 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                }`}>
                {activeAction.type === 'delete' ? <TrashIcon size={28} /> : <EditIcon size={28} />}
              </div>

              <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white mb-2">
                {activeAction.type === 'delete' ? "Hapus Data?" : "Load Data?"}
              </h3>

              <p className="text-[15px] text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                {activeAction.type === 'delete'
                  ? "Data ini akan dihapus permanen dan tidak dapat dikembalikan."
                  : "Data ini akan di-load (dimuat) kembali ke form utama untuk dilanjutkan atau diubah."}
              </p>

              {/* Item Preview Card */}
              <div className="w-full bg-zinc-50 dark:bg-black/30 rounded-2xl p-4 border border-zinc-100 dark:border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold uppercase text-zinc-400">{activeAction.data.hari}</span>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{activeAction.data.tanggal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-500">Total Pendapatan</span>
                  <span className="text-base font-bold text-zinc-900 dark:text-white">
                    {rupiah(
                      (activeAction.data.totalHarian || 0) +
                      (activeAction.data.totalJajanan || 0) +
                      (activeAction.data.totalJasaAks || 0) +
                      (activeAction.data.totalSewa || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons (iOS Style) */}
            <div className="grid grid-cols-2 gap-px bg-zinc-200/50 dark:bg-white/10 pt-px">
              <button
                onClick={() => setActiveAction(null)}
                className="bg-white dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 p-4 text-[17px] font-medium text-zinc-600 dark:text-zinc-400 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={confirmAction}
                className={`bg-white dark:bg-zinc-900/80 hover:bg-zinc-50 dark:hover:bg-zinc-800 p-4 text-[17px] font-bold transition-colors ${activeAction.type === 'delete'
                    ? 'text-red-600 dark:text-red-500'
                    : 'text-blue-600 dark:text-blue-500'
                  }`}
              >
                {activeAction.type === 'delete' ? 'Hapus' : 'Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SECURITY (CLEAR ALL) */}
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
                {securityAction === 'clear'
                  ? "Masukkan password administrator untuk menghapus seluruh data pembukuan secara permanen."
                  : "Masukkan password administrator untuk menghapus data riwayat ini."
                }
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
                    {isLoading ? "..." : (securityAction === 'clear' ? "Hapus Semua" : "Hapus Data")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// --- SUB-COMPONENTS ---

function SummaryCard({ label, value, color }: { label: string; value: string; color: "green" | "blue" | "zinc" }) {
  const colors = {
    green: "text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20",
    blue: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20",
    zinc: "text-zinc-900 dark:text-zinc-100 bg-zinc-500/10 border-zinc-500/20",
  };

  return (
    <div className={`flex flex-col justify-center px-5 py-4 rounded-[20px] border backdrop-blur-md ${colors[color]}`}>
      <span className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</span>
      <span className="text-lg md:text-xl font-bold tracking-tight">{value}</span>
    </div>
  );
}

function ActionButton({ onClick, disabled, icon, label, variant = "default" }: any) {
  const base = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all";
  const styles = variant === "destructive"
    ? "text-red-600 bg-red-50/50 hover:bg-red-50 dark:bg-red-900/10 dark:hover:bg-red-900/20"
    : "text-zinc-700 bg-zinc-100/50 hover:bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800/30 dark:hover:bg-zinc-800";

  if (disabled) return null;

  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`} title={label}>
      {icon} <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wide">{label}</span>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{value}</span>
    </div>
  );
}