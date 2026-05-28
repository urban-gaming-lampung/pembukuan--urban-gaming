import React from "react";
import Section from "./common/Section";
import { 
  Filter as FilterIcon, 
  CalendarDays, 
  CalendarRange, 
  ChevronDown,
  LayoutGrid
} from "lucide-react";

const Filter: React.FC<{
  mode: string;
  setMode: (v: string) => void;
  month: number;
  setMonth: (v: number) => void;
  rangeStart: string;
  setRangeStart: (v: string) => void;
  rangeEnd: string;
  setRangeEnd: (v: string) => void;
}> = ({ mode, setMode, month, setMonth, rangeStart, setRangeStart, rangeEnd, setRangeEnd }) => {
  
  // --- Styling Constants ---
  const containerBase = "rounded-[24px] border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";
  
  const inputWrapperBase = `
    group relative flex items-center gap-3 rounded-2xl 
    bg-zinc-100/80 px-4 py-3 transition-all duration-200 
    hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800
    focus-within:bg-white dark:focus-within:bg-black
    focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:shadow-md
  `;

  const labelClass = "text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5";
  const selectClass = "relative z-10 w-full appearance-none bg-transparent text-sm font-semibold text-zinc-900 outline-none dark:text-zinc-100 cursor-pointer focus:ring-0 border-none p-0";
  const dateClass = "w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none dark:text-zinc-100 min-h-[20px] font-mono p-0 border-none focus:ring-0";
  const iconBase = "text-zinc-400 transition-colors group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300";
  const optionClass = "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 py-2";

  return (
    <Section>
      <div className={containerBase}>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
          
          {/* 1. MAIN FILTER MODE */}
          <div className={`${mode === "Rentang" ? "md:col-span-4" : mode === "Pilih Bulan" ? "md:col-span-8" : "md:col-span-12"}`}>
            <div className={inputWrapperBase}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-sm ${iconBase}`}>
                <FilterIcon size={16} />
              </div>
              <div className="flex w-full flex-col justify-center">
                <span className={labelClass}>Tampilkan Data</span>
                <div className="relative grid grid-cols-1">
                  {/* Select Layer */}
                  <select 
                    value={mode} 
                    onChange={(e) => setMode(e.target.value)} 
                    className={selectClass}
                  >
                    <option className={optionClass} value="Bulan Ini">Bulan Ini (Default)</option>
                    <option className={optionClass} value="7 Hari Terakhir">7 Hari Terakhir</option>
                    <option className={optionClass} value="Semua Bulan">Semua Periode</option>
                    <option className={optionClass} value="Pilih Bulan">Pilih Bulan Tertentu</option>
                    <option className={optionClass} value="Rentang">Rentang Tanggal</option>
                  </select>
                  {/* Icon Layer */}
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
                </div>
              </div>
            </div>
          </div>

          {/* 2. CONDITIONAL INPUTS */}
          
          {/* Mode: Pilih Bulan */}
          {mode === "Pilih Bulan" && (
            <div className="md:col-span-4 animate-in fade-in slide-in-from-left-2 duration-300">
              <div className={inputWrapperBase}>
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-sm ${iconBase}`}>
                  <LayoutGrid size={16} />
                </div>
                <div className="flex w-full flex-col justify-center">
                  <span className={labelClass}>Bulan Ke-</span>
                  <div className="relative grid grid-cols-1">
                    <select
                      value={month}
                      onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                      className={selectClass}
                    >
                      {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={i + 1} className={optionClass}>
                           {new Date(0, i).toLocaleString('id-ID', { month: 'long' })} ({i + 1})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mode: Rentang Tanggal */}
          {mode === "Rentang" && (
            <>
              <div className="md:col-span-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div className={inputWrapperBase}>
                   <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-sm ${iconBase}`}>
                    <CalendarDays size={16} />
                  </div>
                  <div className="flex w-full flex-col justify-center">
                    <span className={labelClass}>Dari Tanggal</span>
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(e) => setRangeStart(e.target.value)}
                      className={dateClass}
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-4 animate-in fade-in slide-in-from-left-2 duration-300 delay-75">
                <div className={inputWrapperBase}>
                   <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-sm ${iconBase}`}>
                    <CalendarRange size={16} />
                  </div>
                  <div className="flex w-full flex-col justify-center">
                    <span className={labelClass}>Sampai Tanggal</span>
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(e.target.value)}
                      className={dateClass}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </Section>
  );
};

export default Filter;