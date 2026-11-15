import React, { useState, useMemo } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { CalendarDays, ChevronDown, Pencil, Trash2, X } from "lucide-react";
import { db } from "../lib/firebase";
import { HistoryItem } from "../lib/types";
import { rupiah } from "../lib/format";
import { totalPemasukanHarian } from "../lib/keuangan";
import { mingguKe } from "../lib/laporan";
import KonfirmasiAkun from "./KonfirmasiAkun";
import { Amount, Button, Card, Pill, SectionHeader } from "../ui";

type Props = {
  items: HistoryItem[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isOwner?: boolean;
};

// --- MAIN COMPONENT ---

export default function HistoryPembukuan({ items, onEdit, onDelete, isOwner = false }: Props) {
  // Pembukuan yang akan dihapus (menunggu konfirmasi password akun)
  const [hapusTarget, setHapusTarget] = useState<HistoryItem | null>(null);

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

  // --- LOGIC CALCULATIONS ---
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      return new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
    });
  }, [items]);

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

  const subtotalGrand = totalPemasukanHarian({ totalHarian: subtotal.harian, totalJajanan: subtotal.jajanan, totalJasaAks: subtotal.jasa, totalSewa: subtotal.sewa });

  const itemsWithNotes = useMemo(() => {
    return sortedItems.filter(h => h.catatan && h.catatan.trim().length > 0);
  }, [sortedItems]);

  const weeklyGroups = useMemo(() => {
    // Pembagian minggu sama dengan laporan teks (Minggu 5 = tanggal 29 ke atas)
    const groups = {
      1: { name: "Minggu 1", total: 0, items: [] as HistoryItem[] },
      2: { name: "Minggu 2", total: 0, items: [] as HistoryItem[] },
      3: { name: "Minggu 3", total: 0, items: [] as HistoryItem[] },
      4: { name: "Minggu 4", total: 0, items: [] as HistoryItem[] },
      5: { name: "Minggu 5", total: 0, items: [] as HistoryItem[] }
    };

    sortedItems.forEach(h => {
      const week = mingguKe(Number(String(h.tanggal).slice(8, 10)) || 1);
      const grand = totalPemasukanHarian(h);

      groups[week as keyof typeof groups].items.push(h);
      groups[week as keyof typeof groups].total += grand;
    });

    return Object.entries(groups)
      .map(([w, data]) => ({ week: Number(w), ...data }))
      .filter((g) => g.week < 5 || g.items.length > 0);
  }, [sortedItems]);

  // Expand / Collapse semua minggu yang tampil (termasuk Minggu 5)
  const semuaTerbuka = weeklyGroups.every((g) => expandedWeeks.includes(g.week));
  const toggleAllMobile = () => {
    if (semuaTerbuka) {
      setExpandedWeeks([]);
      setExpandedMobile([]);
    } else {
      setExpandedWeeks(weeklyGroups.map((g) => g.week));
      setExpandedMobile(items.map(h => h.id));
    }
  };

  // --- UDS TABLE TOKENS ---
  const thStyle = "px-2.5 py-3 text-caption2 uppercase tracking-[0.04em] font-semibold text-label-2 bg-surface-2 border-b border-sep text-left sticky top-0 z-10 whitespace-nowrap";
  const thAksiStyle = `${thStyle} sticky right-0 z-[20] border-l border-sep text-center`;
  const tdStyle = "px-2.5 py-2.5 text-footnote font-medium text-label border-b border-sep align-middle whitespace-nowrap tabular-nums";
  const tdAksiStyle = "px-2.5 py-2.5 text-center sticky right-0 bg-surface group-hover:bg-fill transition-colors duration-150 border-b border-l border-sep align-middle z-[5]";
  const trHover = "hover:bg-fill/60 transition-colors duration-150 group";

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
      // Lanjut ke konfirmasi password akun
      setHapusTarget(activeAction.data);
      setActiveAction(null);
    }
  };

  return (
    <>
      <Card
        title="History pembukuan"
        icon={<CalendarDays />}
        iconColor="blue"
        accessory={
          sortedItems.length > 0 ? (
            <Button variant="tinted" size="sm" onClick={toggleAllMobile} className="md:hidden">
              {semuaTerbuka ? "Tutup semua" : "Buka semua"}
            </Button>
          ) : undefined
        }
      >

        {/* DESKTOP TABLE */}
        <div className="hidden md:block w-full rounded-tile border border-sep overflow-hidden bg-surface">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thStyle}>Tanggal</th>
                  <th className={thStyle}>Hari</th>
                  <th className={thStyle}>Harian</th>
                  <th className={thStyle}>Jajanan</th>
                  <th className={thStyle}>Usaha</th>
                  <th className={thStyle}>Sewa PS</th>
                  {isOwner && (
                    <>
                      <th className={thStyle}>Total</th>
                      <th className={thStyle}><span className="text-positive">Cash</span></th>
                      <th className={thStyle}><span className="text-tint">TF</span></th>
                    </>
                  )}
                  <th className={thAksiStyle}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-subhead text-label-2">
                      Tidak ada data untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  sortedItems.map((h) => {
                    const grand = totalPemasukanHarian(h);
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
                            <td className={`${tdStyle} font-semibold text-label`}>{rupiah(grand)}</td>
                            <td className={`${tdStyle} text-positive font-semibold`}>{(h as any).totalCash ? rupiah((h as any).totalCash) : "—"}</td>
                            <td className={`${tdStyle} text-tint font-semibold`}>{(h as any).totalTransfer ? rupiah((h as any).totalTransfer) : "—"}</td>
                          </>
                        )}

                        <td className={tdAksiStyle}>
                          <div className="flex items-center justify-center gap-1.5">
                            <ActionButton onClick={() => triggerEdit(h)} disabled={!onEdit} icon={<Pencil size={13} />} label="Load" />
                            {isOwner && (
                              <ActionButton onClick={() => triggerDelete(h)} disabled={!onDelete} variant="destructive" icon={<Trash2 size={13} />} label="Hapus" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}

                {sortedItems.length > 0 && (
                  <tr className="bg-surface-2 font-semibold sticky bottom-0 border-t border-sep z-[30]">
                    <td colSpan={2} className="px-2.5 py-3 text-caption2 uppercase tracking-[0.04em] text-label-2 text-right whitespace-nowrap">Grand Total</td>
                    <td className={tdStyle}>{rupiah(subtotal.harian)}</td>
                    <td className={tdStyle}>{rupiah(subtotal.jajanan)}</td>
                    <td className={tdStyle}>{rupiah(subtotal.jasa)}</td>
                    <td className={tdStyle}>{rupiah(subtotal.sewa)}</td>
                    {isOwner && (
                      <>
                        <td className={`${tdStyle} font-bold text-label`}>{rupiah(subtotalGrand)}</td>
                        <td className={`${tdStyle} font-bold text-positive`}>{rupiah(subtotal.cash)}</td>
                        <td className={`${tdStyle} font-bold text-tint`}>{rupiah(subtotal.transfer)}</td>
                      </>
                    )}
                    <td className="sticky right-0 bg-surface-2 border-l border-sep z-[35]"></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MOBILE VIEW */}
        <div className="md:hidden flex flex-col gap-3">
          {sortedItems.length === 0 ? (
            <div className="p-8 text-center text-subhead text-label-2 rounded-tile bg-surface-2">
              Tidak ada data untuk periode ini.
            </div>
          ) : (
            weeklyGroups.map((g) => {
              const isWeekExpanded = expandedWeeks.includes(g.week);

              return (
                <div key={`week-${g.week}`} className="rounded-tile p-3.5 bg-surface-2 transition-all">
                  <button
                    type="button"
                    className={`w-full min-h-[44px] flex justify-between items-center text-left active:opacity-70 transition-all ${isWeekExpanded ? 'mb-3 pb-3 border-b border-sep' : ''}`}
                    onClick={() => toggleWeekExpand(g.week)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-full bg-tint/10 flex items-center justify-center text-tint text-footnote font-bold tabular-nums shrink-0">
                        {g.week}
                      </span>
                      <span className="text-callout font-semibold text-label truncate">{g.name}</span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      {isOwner && (
                        <div className="text-right">
                          <div className="text-caption2 text-label-2 uppercase tracking-[0.04em] font-semibold">Pendapatan</div>
                          <Amount value={g.total} tone="positive" size="subhead" />
                        </div>
                      )}
                      <ChevronDown className={`w-4 h-4 text-label-3 transition-transform ${isWeekExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {isWeekExpanded && (
                    <div className="flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
                      {g.items.length === 0 ? (
                        <div className="text-center py-4 text-caption font-semibold text-label-2 bg-surface/60 rounded-field border border-dashed border-sep">
                          Tidak ada pemasukan di minggu ini
                        </div>
                      ) : (
                        g.items.map(h => {
                          const grand = totalPemasukanHarian(h);
                          const isItemExpanded = expandedMobile.includes(h.id);
                          return (
                            <div key={h.id} className="bg-surface rounded-field p-3.5 ring-1 ring-edge">
                              <button
                                type="button"
                                className={`w-full min-h-[44px] flex justify-between items-center text-left active:opacity-70 transition-opacity ${isItemExpanded ? 'border-b border-sep pb-3 mb-3' : ''}`}
                                onClick={() => toggleMobileExpand(h.id)}
                              >
                                <div className="flex flex-col min-w-0">
                                  <div className="text-caption2 font-semibold uppercase tracking-[0.04em] text-label-2">{h.hari}</div>
                                  <div className="text-callout font-semibold text-label">{h.tanggal}</div>
                                </div>
                                <div className="text-right flex items-center gap-2 shrink-0">
                                  {isOwner && (
                                    <div>
                                      <div className="text-caption2 text-label-2">Total</div>
                                      <Amount value={grand} size="subhead" />
                                    </div>
                                  )}
                                  <ChevronDown className={`w-4 h-4 text-label-3 transition-transform ${isItemExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </button>

                              {isItemExpanded && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                  <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-3.5">
                                    <DetailRow label="Harian" value={rupiah(h.totalHarian)} />
                                    <DetailRow label="Jajanan" value={rupiah(h.totalJajanan)} />
                                    <DetailRow label="Usaha" value={rupiah(h.totalJasaAks)} />
                                    <DetailRow label="Sewa PS" value={rupiah(h.totalSewa)} />
                                  </div>

                                  {isOwner && ((h as any).totalCash > 0 || (h as any).totalTransfer > 0) && (
                                    <div className="flex gap-2 mb-3.5">
                                      {(h as any).totalCash > 0 && (
                                        <div className="flex-1 rounded-control bg-positive/10 px-3 py-2">
                                          <div className="text-caption2 uppercase font-semibold text-positive">Cash</div>
                                          <Amount value={(h as any).totalCash} tone="positive" size="footnote" />
                                        </div>
                                      )}
                                      {(h as any).totalTransfer > 0 && (
                                        <div className="flex-1 rounded-control bg-tint/10 px-3 py-2">
                                          <div className="text-caption2 uppercase font-semibold text-tint">Transfer</div>
                                          <Amount value={(h as any).totalTransfer} tone="tint" size="footnote" />
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className={`grid gap-2.5 ${isOwner ? "grid-cols-2" : "grid-cols-1"}`}>
                                    <Button variant="gray" size="md" block onClick={() => triggerEdit(h)} disabled={!onEdit} icon={<Pencil />}>
                                      Load
                                    </Button>
                                    {isOwner && (
                                      <Button variant="destructive" size="md" block onClick={() => triggerDelete(h)} disabled={!onDelete} icon={<Trash2 />}>
                                        Hapus
                                      </Button>
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
          <div className="mt-5">
            <SectionHeader title="Catatan tersimpan" className="px-1 pt-2 pb-2" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {itemsWithNotes.map((h) => (
                <div
                  key={`note-${h.id}`}
                  className="relative p-3.5 rounded-tile bg-surface-2 flex flex-col gap-2 group/note"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Pill tone="neutral">{h.tanggal}</Pill>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm(`Hapus catatan tanggal ${h.tanggal}?`)) return;
                          try {
                            await updateDoc(doc(db, "history_pembukuan", h.id), { catatan: "" });
                          } catch (e) { console.error(e); }
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-fill hover:bg-negative/15 text-label-3 hover:text-negative transition-all md:opacity-0 md:group-hover/note:opacity-100 focus:opacity-100 active:scale-90 shrink-0"
                        title="Hapus catatan"
                        aria-label={`Hapus catatan ${h.tanggal}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-subhead text-label leading-relaxed">
                    "{h.catatan}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </Card>

      {/* MODAL: ACTION CONFIRMATION (EDIT / DELETE) */}
      {activeAction && (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 sm:p-6 font-sans">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[4px] transition-all duration-300"
            onClick={() => setActiveAction(null)}
          />

          <div className="relative w-full max-w-sm transform overflow-hidden rounded-card bg-surface/95 backdrop-blur-xl shadow-float ring-1 ring-edge transition-all animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            <div className="flex flex-col items-center pt-7 px-6 pb-5 text-center">
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full ${activeAction.type === 'delete'
                  ? 'bg-negative/10 text-negative'
                  : 'bg-tint/10 text-tint'
                }`}>
                {activeAction.type === 'delete' ? <Trash2 className="w-6 h-6" /> : <Pencil className="w-6 h-6" />}
              </div>

              <h3 className="text-title3 font-bold text-label mb-1.5">
                {activeAction.type === 'delete' ? "Hapus data?" : "Load data?"}
              </h3>

              <p className="text-subhead text-label-2 leading-relaxed mb-4">
                {activeAction.type === 'delete'
                  ? "Data ini akan dihapus permanen dan tidak dapat dikembalikan."
                  : "Data ini akan dimuat kembali ke form utama untuk dilanjutkan atau diubah."}
              </p>

              <div className="w-full bg-surface-2 rounded-tile p-3.5 border border-sep">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-caption font-semibold uppercase text-label-2">{activeAction.data.hari}</span>
                  <span className="text-caption font-semibold text-label tabular-nums">{activeAction.data.tanggal}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-footnote text-label-2">Total pendapatan</span>
                  <Amount value={totalPemasukanHarian(activeAction.data)} size="headline" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-sep border-t border-sep">
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                className="min-h-[48px] px-4 py-3 text-callout font-medium text-label-2 hover:bg-fill active:bg-fill transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmAction}
                className={`min-h-[48px] px-4 py-3 text-callout font-semibold hover:bg-fill active:bg-fill transition-colors ${activeAction.type === 'delete'
                    ? 'text-negative'
                    : 'text-tint'
                  }`}
              >
                {activeAction.type === 'delete' ? 'Hapus' : 'Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Konfirmasi password akun sebelum menghapus */}
      {hapusTarget && (
        <KonfirmasiAkun
          judul="Hapus Pembukuan"
          pesan={<>Masukkan password akun Anda untuk menghapus pembukuan <b className="text-label">{hapusTarget.hari}, {hapusTarget.tanggal}</b> secara permanen.</>}
          labelTombol="Hapus"
          bahaya
          onBatal={() => setHapusTarget(null)}
          onBerhasil={() => { onDelete?.(hapusTarget.id); setHapusTarget(null); }}
        />
      )}
    </>
  );
}

// --- SUB-COMPONENTS ---

function ActionButton({ onClick, disabled, icon, label, variant = "default" }: any) {
  const base = "inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-control text-caption font-semibold transition-colors";
  const styles = variant === "destructive"
    ? "text-negative bg-negative/10 hover:bg-negative/15"
    : "text-label bg-fill hover:bg-fill/80";

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
      <span className="text-caption2 uppercase font-semibold text-label-2 tracking-[0.04em]">{label}</span>
      <span className="text-subhead font-semibold tabular-nums text-label">{value}</span>
    </div>
  );
}