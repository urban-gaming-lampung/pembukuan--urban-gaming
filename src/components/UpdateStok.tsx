import React, { useState } from "react";
import { INITIAL_STOK_RENTAL, INITIAL_STOK_JUALAN, StokKategori, StokItemValue, StokData, MasterStokCategories } from "../hooks/useStokData";
import { Package } from "lucide-react";
import WidgetMonitoringDevice from "./WidgetMonitoringDevice";

const StokTable: React.FC<{
  title: string;
  categories: StokKategori[];
  type: "rental" | "jualan";
  colorTheme: "pink" | "lime";
  data: Record<string, Record<string, StokItemValue>>;
  onUpdate: (tipe: "rental" | "jualan", category: string, item: string, val: number, adminName?: string) => void;
  adminName?: string;
}> = ({ title, categories, type, colorTheme, data, onUpdate, adminName }) => {
  const isPink = colorTheme === "pink";
  
  const iconBgClass = isPink ? "bg-pink-100 dark:bg-pink-500/20 border-pink-200/50 dark:border-pink-500/20" : "bg-lime-100 dark:bg-lime-500/20 border-lime-200/50 dark:border-lime-500/20";
  const iconColorClass = isPink ? "text-pink-600 dark:text-pink-400" : "text-lime-600 dark:text-lime-400";
  const textTitleClass = isPink ? "text-pink-600 dark:text-pink-400" : "text-lime-600 dark:text-lime-400";
  const inputFocusClass = isPink ? "focus:border-pink-500 focus:ring-pink-500" : "focus:border-lime-500 focus:ring-lime-500";
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-[24px] shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden relative animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 pb-4 sm:pb-5 bg-zinc-50/80 dark:bg-[#1C1C1E]/80 border-b border-zinc-200/60 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${iconBgClass}`}>
            <Package className={`w-5 h-5 ${iconColorClass}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white capitalize leading-none mb-1.5">
              {title}
            </h2>
            <p className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 leading-none">
              Data stok barang akan tersimpan secara otomatis
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4 sm:p-6 bg-zinc-50/50 dark:bg-black/10">
        {categories.map((cat, catIdx) => {
          const items = cat.items;
          // Calculate category total
          const categoryTotal = items.reduce((acc, item) => {
            const itemData = data[cat.kategori]?.[item];
            return acc + (itemData?.jumlah || 0);
          }, 0);

          return (
            <div key={cat.kategori} className="bg-white dark:bg-[#2C2C2E] rounded-[24px] shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden font-sans">
              {/* Card Header: Category & Large Total */}
              <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/30 dark:bg-black/20 relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${isPink ? "bg-pink-500" : "bg-lime-500"}`}></div>
                <div className="pl-2">
                   <h3 className={`text-[11px] font-bold uppercase tracking-widest ${textTitleClass}`}>
                      {cat.kategori}
                   </h3>
                   <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                      Total {cat.kategori.replace("UPDATE ", "")}
                   </span>
                </div>
                <div className="flex items-baseline gap-1">
                   <span className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
                      {categoryTotal}
                   </span>
                   <span className="text-sm font-bold text-zinc-400 dark:text-zinc-500">pcs</span>
                </div>
              </div>

              {/* Items List */}
              <div className="flex flex-col divide-y divide-zinc-100 dark:divide-white/5">
                {items.map((item, itemIdx) => {
                  const itemData = data[cat.kategori]?.[item] || { jumlah: 0 };
                  const val = itemData.jumlah;
                  const adminStr = itemData.lastEditBy ? ` oleh ${itemData.lastEditBy.split('@')[0]}` : "";
                  const hint = itemData.lastEditDate ? `telah di edit${adminStr}, ${itemData.lastEditDate}, ${(itemData.lastEditDelta && itemData.lastEditDelta > 0) ? `+${itemData.lastEditDelta}` : itemData.lastEditDelta}` : "";

                  return (
                    <div key={`${cat.kategori}-${item}`} className="flex flex-row items-center justify-between p-4 hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                       <div className="flex flex-col flex-1 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600 shrink-0"></span>
                            <span className="font-semibold text-[15px] sm:text-base text-zinc-900 dark:text-zinc-200 leading-tight">
                               {item}
                            </span>
                          </div>
                          {hint && (
                             <div className="text-[11px] text-zinc-500 dark:text-zinc-400 italic mt-1.5 ml-4 leading-relaxed">
                               *{hint}
                             </div>
                          )}
                       </div>
                       
                       <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              const num = val > 0 ? val - 1 : 0;
                              onUpdate(type, cat.kategori, item, num, adminName);
                            }}
                            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-[12px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:bg-zinc-300 dark:active:bg-zinc-600 text-zinc-600 dark:text-zinc-300 font-bold text-[22px] active:scale-95 transition-all outline-none leading-none pb-0.5 select-none`}
                            aria-label="Kurangi stok"
                          >
                            −
                          </button>
                          
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            min="0"
                            className={`w-[50px] sm:w-[70px] bg-zinc-100/80 dark:bg-zinc-800 border border-transparent focus:ring-2 rounded-[12px] px-2 py-2 sm:py-2.5 text-center text-[16px] sm:text-[17px] font-bold text-zinc-900 dark:text-zinc-100 transition-all outline-none font-mono ${inputFocusClass}`}
                            value={val || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const num = parseInt(e.target.value, 10);
                              onUpdate(type, cat.kategori, item, isNaN(num) ? 0 : num, adminName);
                            }}
                          />
                          
                          <button
                            onClick={() => {
                              const num = (val || 0) + 1;
                              onUpdate(type, cat.kategori, item, num, adminName);
                            }}
                            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-[12px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 active:bg-zinc-300 dark:active:bg-zinc-600 text-zinc-600 dark:text-zinc-300 font-bold text-[22px] active:scale-95 transition-all outline-none leading-none pb-0.5 select-none`}
                            aria-label="Tambah stok"
                          >
                            +
                          </button>
                       </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MasterInventarisForm = ({ 
  type, 
  catList, 
  onAdd, 
  isOwner 
}: { 
  type: "rental" | "jualan"; 
  catList: StokKategori[]; 
  onAdd: (tipe: "rental" | "jualan", cat: string, item: string) => Promise<boolean>; 
  isOwner?: boolean;
}) => {
   const [kategori, setKategori] = useState(catList[0]?.kategori || "");
   const [isNewCat, setIsNewCat] = useState(false);
   const [newCatName, setNewCatName] = useState("");
   const [itemName, setItemName] = useState("");
   const [loading, setLoading] = useState(false);
   const [isAdding, setIsAdding] = useState(false);

   // Sync default category if list changes
   React.useEffect(() => {
     if (catList.length > 0 && (!kategori || !catList.some(c => c.kategori === kategori))) {
       setKategori(catList[0].kategori);
     }
   }, [catList]);

   const handleSimpan = async () => {
       if (!itemName.trim()) return;
       const finalCat = isNewCat ? newCatName : kategori;
       if (!finalCat.trim()) return;
       
       setLoading(true);
       const ok = await onAdd(type, finalCat, itemName.trim());
       if (ok) {
           setItemName("");
           if (isNewCat) {
               setIsNewCat(false);
               setKategori(finalCat.toUpperCase());
               setNewCatName("");
           }
           setIsAdding(false); // Close form after successful save
       } else {
           alert("Item sudah ada di kategori ini atau terjadi kesalahan.");
       }
       setLoading(false);
   };

   return (
         <div className="bg-white/70 dark:bg-[#1C1C1E]/60 backdrop-blur-2xl ring-1 ring-zinc-200/50 dark:ring-white/10 p-6 rounded-[32px] mb-6 flex flex-col gap-5 shadow-xl shadow-black/5 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 dark:bg-blue-500/20 blur-3xl rounded-full translate-x-1/4 -translate-y-1/4 pointer-events-none" />
             
             <div className="flex items-center justify-between z-10 w-full">
                <h3 className="text-[13px] font-black text-zinc-800 dark:text-zinc-200 capitalize tracking-wider flex items-center gap-2">
                   <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-sm shadow-blue-500/50"></span>
                   MASTER INVENTARIS {isOwner ? "(OWNER)" : ""}
                </h3>
                {isOwner && (
                   <button
                      onClick={() => setIsAdding(!isAdding)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-black text-blue-600 dark:text-blue-400 font-bold border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all shadow-sm"
                   >
                      {isAdding ? "Batal" : "Tambah Item"}
                   </button>
                )}
             </div>

             {isAdding && isOwner ? (
                <div className="flex flex-col sm:flex-row gap-4 z-10 w-full mt-1 animate-in fade-in slide-in-from-top-2 duration-300">
                   <div className="flex-[1.5] flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Kategori</label>
                      <select 
                         value={isNewCat ? "NEW" : kategori}
                         onChange={(e) => {
                            if (e.target.value === "NEW") setIsNewCat(true);
                            else { setIsNewCat(false); setKategori(e.target.value); }
                         }}
                         className="w-full bg-zinc-100/50 dark:bg-black/20 ring-1 ring-black/5 dark:ring-white/10 rounded-[16px] px-4 py-3 text-[13px] font-bold text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-sm"
                      >
                         {catList.map(c => <option key={c.kategori} value={c.kategori}>{c.kategori}</option>)}
                         <option value="NEW" className="font-bold text-blue-600 dark:text-blue-400">+ BUAT KATEGORI BARU</option>
                      </select>
                      {isNewCat && (
                         <input type="text" placeholder="Ketik nama kategori..." value={newCatName} onChange={e => setNewCatName(e.target.value)} className="w-full mt-1 bg-zinc-100/50 dark:bg-black/20 ring-1 ring-black/5 dark:ring-white/10 rounded-[16px] px-4 py-3 text-[13px] font-bold uppercase text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-sm" />
                      )}
                   </div>
                   <div className="flex-[2] flex flex-col gap-2">
                      <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Nama Barang / Unit Baru</label>
                      <input type="text" placeholder="Contoh: Kopi Susu" value={itemName} onChange={e => setItemName(e.target.value)} className="w-full bg-zinc-100/50 dark:bg-black/20 ring-1 ring-black/5 dark:ring-white/10 rounded-[16px] px-4 py-3 text-[13px] font-bold capitalize text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all shadow-sm" />
                   </div>
                   <div className="flex flex-col gap-2 justify-end">
                      <button disabled={loading || !itemName || (isNewCat && !newCatName)} onClick={handleSimpan} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-[16px] transition-all text-[13px] tracking-wide flex items-center justify-center shadow-lg shadow-blue-500/25 active:scale-95 h-full max-h-[46px] sm:max-h-full sm:h-[46px]">
                         {loading ? "..." : "Simpan Item"}
                      </button>
                   </div>
                </div>
             ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-1 z-10 animate-in fade-in duration-300">
                   {catList.map(c => (
                      <div key={c.kategori} className="bg-zinc-50/50 dark:bg-black/20 p-4 rounded-2xl border border-zinc-200/50 dark:border-white/5 flex flex-col gap-2">
                         <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">
                            {c.kategori.replace("UPDATE ", "")}
                         </span>
                         <div className="flex flex-wrap gap-1.5 mt-1">
                            {c.items.map(item => (
                               <span key={item} className="text-xs px-2.5 py-1 bg-white dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-white/5 text-zinc-700 dark:text-zinc-300 font-bold rounded-lg shadow-sm">
                                  {item}
                               </span>
                            ))}
                         </div>
                      </div>
                   ))}
                </div>
             )}
         </div>
    );
};

type UpdateStokProps = {
  adminName?: string;
  isOwner?: boolean;
  stokState: StokData;
  updateStok: (tipe: "rental" | "jualan", kategori: string, item: string, value: number, adminName?: string) => void;
  masterCategories: MasterStokCategories;
  addStokItem: (tipe: "rental" | "jualan", kategoriName: string, itemName: string) => Promise<boolean>;
};

export default function UpdateStok({ adminName, isOwner, stokState, updateStok, masterCategories, addStokItem }: UpdateStokProps) {
  const [activeSubTab, setActiveSubTab] = useState<"RENTAL" | "JUALAN">("RENTAL");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-both">
      <div className="flex w-full mb-6 bg-zinc-200/50 dark:bg-[#1C1C1E] p-1 rounded-[14px] ring-1 ring-zinc-300/50 dark:ring-white/5 backdrop-blur-sm relative gap-1">
        <button
          onClick={() => setActiveSubTab("RENTAL")}
          className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
            activeSubTab === "RENTAL"
              ? "bg-white dark:bg-[#2C2C2E] text-pink-600 dark:text-pink-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          }`}
        >
          STOK RENTAL
        </button>
        <button
          onClick={() => setActiveSubTab("JUALAN")}
          className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
            activeSubTab === "JUALAN"
              ? "bg-white dark:bg-[#2C2C2E] text-lime-600 dark:text-lime-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          }`}
        >
          STOK JUALAN
        </button>
      </div>

      {activeSubTab === "RENTAL" && (
         <MasterInventarisForm type="rental" catList={masterCategories.rental} onAdd={addStokItem} isOwner={isOwner} />
      )}
      {activeSubTab === "JUALAN" && (
         <MasterInventarisForm type="jualan" catList={masterCategories.jualan} onAdd={addStokItem} isOwner={isOwner} />
      )}

      {activeSubTab === "RENTAL" ? (
         <div className="space-y-8 animate-in fade-in duration-300">
            <StokTable
              title="TABEL UPDATE STOK RENTAL"
              categories={masterCategories.rental}
              type="rental"
              colorTheme="pink"
              data={stokState.rental}
              onUpdate={updateStok}
              adminName={adminName}
            />
            <WidgetMonitoringDevice isOwner={isOwner} />
         </div>
      ) : (
         <StokTable
           title="TABEL UPDATE STOK JUALAN"
           categories={masterCategories.jualan}
           type="jualan"
           colorTheme="lime"
           data={stokState.jualan}
           onUpdate={updateStok}
           adminName={adminName}
         />
      )}
    </div>
  );
}
