import React from "react";
import { CalendarDays, ChevronsUpDown } from "lucide-react";
import { IconBadge, ListGroup } from "../ui";

/** Pilihan periode (nilai tetap sama dengan data lama; label huruf biasa ala iOS). */
const OPSI: { v: string; l: string }[] = [
  { v: "Bulan Ini", l: "Bulan ini" },
  { v: "7 Hari Terakhir", l: "7 hari terakhir" },
  { v: "Semua Bulan", l: "Semua periode" },
  { v: "Pilih Bulan", l: "Pilih bulan" },
  { v: "Rentang", l: "Rentang tanggal" },
];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Baris daftar ala iOS dengan nilai di kanan; pemilih asli (native) menutupi seluruh baris. */
const BarisPilih: React.FC<{ icon?: React.ReactNode; label: string; nilai: string; children: React.ReactNode }> = ({ icon, label, nilai, children }) => (
  <label className="group/row relative flex w-full cursor-pointer items-center gap-3 pl-4 pr-3 transition-colors active:bg-fill">
    {icon ?? <span className="w-7 shrink-0" aria-hidden />}
    <span className="flex min-h-[48px] min-w-0 flex-1 items-center gap-2 border-b border-sep py-2.5 group-last/row:border-b-0">
      <span className="flex-1 truncate text-callout text-label">{label}</span>
      <span className="truncate text-callout text-label-2">{nilai}</span>
      <ChevronsUpDown className="h-4 w-4 shrink-0 text-label-3" aria-hidden />
    </span>
    {children}
  </label>
);

const BarisTanggal: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div className="group/row flex w-full items-center gap-3 pl-4 pr-3">
    <span className="w-7 shrink-0" aria-hidden />
    <span className="flex min-h-[48px] min-w-0 flex-1 items-center justify-between gap-3 border-b border-sep py-1.5 group-last/row:border-b-0">
      <span className="text-callout text-label">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} tanggal`}
        className="!w-auto !min-h-0 h-9 min-w-[132px] rounded-control bg-fill px-3 text-center text-[16px] tabular-nums text-label outline-none focus:ring-2 focus:ring-tint/40"
      />
    </span>
  </div>
);

/**
 * FILTER PERIODE — satu komponen untuk Analitik & riwayat pembukuan.
 * Tampil sebagai grup daftar ala Pengaturan iOS: Periode ▸ (Bulan / Dari–Sampai).
 */
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
  const labelMode = OPSI.find((o) => o.v === mode)?.l || mode;
  const bulan = Math.min(12, Math.max(1, Number(month) || 1));
  const pilih = "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 text-[16px]";
  return (
    <ListGroup>
      <BarisPilih icon={<IconBadge color="red"><CalendarDays /></IconBadge>} label="Periode" nilai={labelMode}>
        <select aria-label="Periode data" value={mode} onChange={(e) => setMode(e.target.value)} className={pilih}>
          {OPSI.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
      </BarisPilih>
      {mode === "Pilih Bulan" && (
        <BarisPilih label="Bulan" nilai={BULAN[bulan - 1]}>
          <select aria-label="Bulan" value={bulan} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className={pilih}>
            {BULAN.map((b, i) => (
              <option key={b} value={i + 1}>
                {b}
              </option>
            ))}
          </select>
        </BarisPilih>
      )}
      {mode === "Rentang" && (
        <>
          <BarisTanggal label="Dari" value={rangeStart} onChange={setRangeStart} />
          <BarisTanggal label="Sampai" value={rangeEnd} onChange={setRangeEnd} />
        </>
      )}
    </ListGroup>
  );
};

export default Filter;
