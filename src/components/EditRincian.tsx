import React, { useState, useEffect, useMemo } from "react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

// --- SF SYMBOL STYLE ICONS (Inline SVGs) ---
const Icons = {
  ChevronLeft: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  MagnifyingGlass: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Plus: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  MinusCircle: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-red-500">
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15" />
      <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Handle: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
    </svg>
  )
};

interface PriceItem {
  id?: string | number;
  label: string;
  price: number;
}

interface EditRincianProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: PriceItem[]) => void;
  title: string;
  initialData: PriceItem[];
  onResetDefault?: () => void;
}

const EditRincian: React.FC<EditRincianProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  initialData,
  onResetDefault,
}) => {
  useBodyScrollLock(isOpen);
  const [items, setItems] = useState<PriceItem[]>([]);
  const [search, setSearch] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  // Sync data & Reset Animation State
  useEffect(() => {
    if (isOpen) {
      setItems(JSON.parse(JSON.stringify(initialData)));
      setSearch("");
      setIsClosing(false);
    }
  }, [isOpen, initialData]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 200); // Match transition duration
  };

  const handleAddItem = () => {
    setItems([...items, { label: "", price: 0 }]);
  };

  const handleChange = (index: number, field: keyof PriceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleDelete = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSave = () => {
    onSave(items);
    handleClose();
  };

  const filteredIndices = useMemo(() => {
    return items
      .map((item, index) => ({ ...item, originalIndex: index }))
      .filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase())
      )
      .map((item) => item.originalIndex);
  }, [items, search]);

  if (!isOpen && !isClosing) return null;

  return (
    <div 
      className={`fixed inset-0 z-[999] flex items-center justify-center sm:py-8 transition-opacity duration-200 ease-in-out ${
        isOpen && !isClosing ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" 
        onClick={handleClose}
      />

      {/* Modal Container - Mimicking iOS Modal / macOS Sheet */}
      <div 
        className={`relative w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-[640px] 
          bg-[#F2F2F7] dark:bg-[#1C1C1E] 
          sm:rounded-[18px] shadow-2xl overflow-hidden flex flex-col
          transition-all duration-300 cubic-bezier(0.32, 0.72, 0, 1) transform
          ${isOpen && !isClosing ? "translate-y-0 scale-100" : "translate-y-8 scale-95"}
        `}
      >
        
        {/* NAVIGATION BAR */}
        <div className="shrink-0 h-[52px] px-4 flex items-center justify-between 
          bg-white/80 dark:bg-[#2C2C2E]/80 backdrop-blur-xl 
          border-b border-gray-300/50 dark:border-white/10 sticky top-0 z-20">
          
          <button
            onClick={handleClose}
            className="flex items-center gap-1 text-[#007AFF] hover:opacity-70 active:opacity-50 transition-opacity"
          >
            <Icons.ChevronLeft />
            <span className="text-[17px] font-normal leading-none -ml-1">Kembali</span>
          </button>

          <h3 className="text-[17px] font-semibold text-black dark:text-white truncate max-w-[200px]">
            {title}
          </h3>

          <button
            onClick={handleSave}
            className="text-[17px] font-semibold text-[#007AFF] hover:opacity-70 active:opacity-50 transition-opacity"
          >
            Selesai
          </button>
        </div>

        {/* CONTENT SCROLL VIEW */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
          
          {/* SEARCH BAR - iOS Style */}
          <div className="mb-6">
            <div className="relative group">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-500 dark:text-gray-400">
                <Icons.MagnifyingGlass />
              </div>
              <input
                type="text"
                placeholder="Cari item..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#767680]/12 dark:bg-[#767680]/24 
                  text-[17px] text-black dark:text-white 
                  rounded-[10px] py-2 pl-10 pr-4 
                  placeholder:text-gray-500 dark:placeholder:text-gray-400 
                  focus:outline-none focus:bg-[#767680]/20 dark:focus:bg-[#767680]/35 transition-colors"
              />
            </div>
          </div>

          {/* LIST GROUP */}
          <div className="space-y-2">
            <div className="px-1 flex justify-between items-end pb-1">
              <span className="text-[13px] font-normal uppercase text-gray-500 dark:text-gray-400 ml-3">
                Rincian Item
              </span>
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1 text-[15px] font-medium text-[#007AFF] hover:opacity-70 active:opacity-50 transition-opacity mr-1"
              >
                <Icons.Plus />
                Tambah
              </button>
            </div>

            {/* Inset Grouped List Container */}
            <div className="bg-white dark:bg-[#2C2C2E] rounded-[10px] overflow-hidden shadow-sm border border-gray-200/50 dark:border-white/5">
              {filteredIndices.length > 0 ? (
                filteredIndices.map((realIndex, i) => {
                  const item = items[realIndex];
                  const isLast = i === filteredIndices.length - 1;
                  
                  return (
                    <div
                      key={realIndex}
                      className="group flex items-center pl-4 bg-white dark:bg-[#2C2C2E] active:bg-gray-50 dark:active:bg-[#3A3A3C] transition-colors"
                    >
                      {/* Delete Action (Left side for strict HIG, but using Right for web convention/ease) */}
                      {/* Using standard inputs designed to look like text */}
                      
                      <div className={`flex-1 flex items-center py-3 pr-4 gap-3 ${
                        !isLast ? "border-b border-gray-200 dark:border-white/10" : ""
                      }`}>
                        
                        {/* Drag Handle (Visual) */}
                        <div className="cursor-grab active:cursor-grabbing">
                           <Icons.Handle />
                        </div>

                        {/* Input Label */}
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) =>
                            handleChange(realIndex, "label", e.target.value)
                          }
                          placeholder="Nama Item"
                          className="flex-1 bg-transparent text-[17px] text-black dark:text-white placeholder:text-gray-400 focus:outline-none"
                        />

                        {/* Input Price */}
                        <div className="flex items-center">
                          <span className="text-[17px] text-gray-400 dark:text-gray-500 mr-1">
                            Rp
                          </span>
                          <input
                            type="number" inputMode="numeric" pattern="[0-9]*"
                            value={item.price}
                            onChange={(e) =>
                              handleChange(realIndex, "price", Number(e.target.value))
                            }
                            className="w-24 bg-transparent text-right text-[17px] text-black dark:text-white focus:outline-none font-medium tabular-nums"
                          />
                        </div>

                        {/* Delete Button - Styled as iOS Delete Accesssory */}
                        <button
                          onClick={() => handleDelete(realIndex)}
                          className="w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-600 active:scale-90 transition-transform"
                          title="Hapus"
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" className="opacity-20" />
                            <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                  <span className="text-4xl mb-2 opacity-50">📂</span>
                  <p className="text-[15px]">
                    {search ? "Item tidak ditemukan" : "Daftar kosong"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SECONDARY ACTIONS GROUP */}
          {onResetDefault && (
            <div className="mt-8">
               <div className="bg-white dark:bg-[#2C2C2E] rounded-[10px] overflow-hidden shadow-sm border border-gray-200/50 dark:border-white/5">
                <button
                  onClick={() => {
                    if (window.confirm("Kembalikan ke pengaturan awal?")) onResetDefault();
                  }}
                  className="w-full py-3 text-[17px] text-red-500 dark:text-red-400 font-normal hover:bg-gray-50 dark:hover:bg-[#3A3A3C] active:bg-gray-100 transition-colors"
                >
                  Reset ke Default
                </button>
              </div>
              <p className="text-[13px] text-gray-400 text-center mt-2 px-4 leading-snug">
                Tindakan ini akan mengembalikan seluruh daftar harga ke kondisi pabrik.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default EditRincian;