import React from 'react';
import { Trash2, Plus, Calculator, Check, X } from 'lucide-react';

interface Props {
  rows: any[];
  setRows: React.Dispatch<React.SetStateAction<any[]>>;
  currentDate?: string;
  currentDay?: string;
  isMobileTable?: boolean;
}

export default function RincianSetoran({ rows, setRows, currentDate, currentDay, isMobileTable }: Props) {
  const minRows = 1;
  const blank = { ket: "", harga: "", bayar: "" };

  const updateRow = (i: number, patch: any) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const total = rows.reduce((acc, r) => acc + (parseInt(String(r.harga).replace(/\D/g, "")) || 0), 0);

  return (
    <div className={`filter drop-shadow-sm ${isMobileTable ? "bg-transparent" : "bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10"}`}>
        {/* HEADER DESKTOP */}
        {!isMobileTable && (
           <div className="flex items-center justify-between p-6 bg-white dark:bg-[#1C1C1E]">
               <div className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-teal-500 rounded-full" />
                  <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Rincian Setoran Hari Ini</h2>
               </div>
               <div className="text-right">
                  <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Total Setoran</div>
                  <div className="text-xl font-black text-teal-500">Rp {total.toLocaleString('id-ID')}</div>
               </div>
           </div>
        )}

        {isMobileTable ? (
           // MOBILE CARD VIEW — satu panel terpadu
           <div className="bg-zinc-50 dark:bg-[#1C1C1E] rounded-[24px] overflow-hidden ring-1 ring-black/8 dark:ring-white/10 shadow-sm border border-zinc-200 dark:border-white/5">
              {/* Header strip — menempel di atas */}
              <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-[#202021] border-b border-zinc-200 dark:border-white/5">
                 <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-5 bg-teal-500 rounded-full" />
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Setoran Hari Ini</h2>
                 </div>
                 <div className="text-right">
                    <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">TOTAL</div>
                    <div className="text-sm font-black text-teal-500">Rp {total.toLocaleString('id-ID')}</div>
                 </div>
              </div>

              {/* Cards inside */}
              <div className="flex flex-col gap-3 p-4">
              {rows.map((r, i) => (
                 <div key={i} className="bg-white dark:bg-black/30 rounded-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/8 flex flex-col pointer-events-auto shadow-sm">
                    {/* Header Card */}
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5">
                       <span className="text-[11px] font-black text-zinc-800 dark:text-white px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/15">#{i+1}</span>
                       <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 font-mono">{currentDate} ({currentDay})</span>
                    </div>
                    {/* Body Card */}
                    <div className="p-4 flex flex-col gap-3">
                       <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Keterangan (Wajib)</label>
                          <input type="text" value={r.ket} onChange={e => updateRow(i, { ket: e.target.value })} placeholder="Keterangan setoran..." className="bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                       </div>
                       <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Nominal (Rp)</label>
                          <div className="relative">
                             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-zinc-400">Rp</span>
                             <input type={i===0 ? "text" : "number"} readOnly={i===0} value={r.harga} onChange={e => { if(i!==0) updateRow(i, { harga: e.target.value }); }} placeholder="0" className={`w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-zinc-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none ${i===0 ? "opacity-70 bg-zinc-100 cursor-not-allowed" : ""}`} />
                             {i === 0 && <Calculator size={15} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400" />}
                          </div>
                          {i === 0 && <span className="text-[10px] text-zinc-500 italic ml-1 mt-0.5">{currentDate && currentDate >= "2026-04-29" ? "Kalkulasi otomatis (Total Cash - Pengeluaran Manual)" : "Kalkulasi otomatis (Cash - Pengeluaran)"}</span>}
                       </div>
                       <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-white/5">
                          <label className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Sudah di TF?</label>
                          <div className="flex bg-zinc-100 dark:bg-black/50 rounded-lg p-1">
                             <button type="button" onClick={() => updateRow(i, { bayar: 'Ya' })} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${r.bayar === 'Ya' ? 'bg-zinc-800 dark:bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'}`}><Check size={12}/> Ya</button>
                             <button type="button" onClick={() => updateRow(i, { bayar: 'Belum' })} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold transition-all ${r.bayar === 'Belum' ? 'bg-zinc-800 dark:bg-zinc-700 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-white'}`}><X size={12}/> Belum</button>
                          </div>
                       </div>
                    </div>
                 </div>
              ))}
              </div>
           </div>
        ) : (
           // DESKTOP TABLE VIEW
           <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                 <thead className="bg-[#14b8a6]">
                    <tr>
                       <th className="py-3 px-4 text-[11px] font-black text-black/70 tracking-widest w-[60px] text-center border-b border-black/10">NO</th>
                       <th className="py-3 px-4 text-[11px] font-black text-black/70 tracking-widest w-[160px] border-b border-black/10">TANGGAL & HARI</th>
                       <th className="py-3 px-4 text-[11px] font-black text-black/70 tracking-widest border-b border-black/10">KETERANGAN (WAJIB)</th>
                       <th className="py-3 px-4 text-[11px] font-black text-black/70 tracking-widest w-[180px] border-b border-black/10">NOMINAL (RP)</th>
                       <th className="py-3 px-4 text-[11px] font-black text-black/70 tracking-widest w-[180px] text-center border-b border-black/10">SUDAH DI TF?</th>
                     </tr>
                  </thead>
                 <tbody className="divide-y divide-zinc-100 dark:divide-white/5 bg-white dark:bg-[#18181A]">
                    {rows.map((r, i) => (
                       <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="py-3 px-4 text-center">
                             <div className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-white/5 mx-auto flex items-center justify-center text-[11px] font-bold text-zinc-500 group-hover:bg-zinc-200 dark:group-hover:bg-white/10 group-hover:text-zinc-900 dark:group-hover:text-white transition-all">{i + 1}</div>
                          </td>
                          <td className="py-3 px-4">
                             <div className="bg-zinc-50 dark:bg-black/30 w-full rounded-lg px-3 py-2 text-[13px] font-mono text-zinc-600 dark:text-zinc-400 select-none flex items-center border border-zinc-200 dark:border-white/5">{currentDate} ({currentDay})</div>
                          </td>
                          <td className="py-3 px-4">
                             <input type="text" value={r.ket} onChange={e => updateRow(i, { ket: e.target.value })} placeholder="Keterangan setoran..." className="w-full bg-transparent outline-none text-[13px] font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-zinc-50 dark:focus:bg-white/5 rounded-lg px-3 py-2 transition-all border border-transparent focus:border-zinc-200 dark:focus:border-white/10" />
                          </td>
                          <td className="py-3 px-4 relative group/input">
                             <span className="absolute left-7 top-1/2 -translate-y-1/2 text-[13px] font-bold text-zinc-400 dark:text-zinc-600 pointer-events-none">Rp</span>
                             <input type={i===0 ? "text" : "number"} min="0" readOnly={i===0} value={r.harga} onChange={e => { if(i!==0) updateRow(i, { harga: e.target.value }); }} placeholder="0" className={`w-full bg-zinc-50 dark:bg-black/30 outline-none text-[13px] font-mono font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 rounded-lg pl-9 pr-8 py-2 focus:ring-1 focus:ring-teal-500 transition-all border border-zinc-200 dark:border-white/5 shadow-inner ${i===0 ? 'opacity-80' : ''}`} />
                             {i===0 && (
                                <span className="absolute right-7 top-1/2 -translate-y-1/2" title={currentDate && currentDate >= "2026-04-29" ? "Kalkulasi Otomatis (Total Cash - Pengeluaran Manual)" : "Kalkulasi Otomatis (Cash - Pengeluaran)"}>
                                   <Calculator size={14} className="text-zinc-400 dark:text-zinc-500" />
                                </span>
                             )}
                          </td>
                          <td className="py-3 px-4">
                             <div className="flex items-center justify-center gap-1.5 bg-zinc-50 dark:bg-black/30 rounded-lg p-1 w-fit mx-auto border border-zinc-200 dark:border-white/5 shadow-inner">
                                <button type="button" onClick={() => updateRow(i, { bayar: 'Ya' })} className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${r.bayar === 'Ya' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}><Check size={12} strokeWidth={3}/> Ya</button>
                                <button type="button" onClick={() => updateRow(i, { bayar: 'Belum' })} className={`flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md text-[11px] font-bold transition-all ${r.bayar === 'Belum' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white'}`}><X size={12} strokeWidth={3}/> Belum</button>
                             </div>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>

              {/* Actions Removed */}
           </div>
        )}
    </div>
  );
}
