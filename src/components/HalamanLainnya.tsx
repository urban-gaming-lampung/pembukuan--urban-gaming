import React from "react";
import { ArrowLeftRight, ChevronLeft, ClipboardEdit, Settings, Terminal, Users } from "lucide-react";
import { ListGroup, ListRow, Pill, SectionHeader, type WarnaIkon } from "../ui";
import type { HalamanLainnya } from "../lib/navigasi";

/** Isi menu Lainnya (owner / super admin) — dipakai daftar HP & sidebar laptop. */
export const MENU_LAINNYA: { key: HalamanLainnya; judul: string; sub: string; icon: React.ReactNode; warna: WarnaIkon }[] = [
  { key: "TRANSAKSI", judul: "Transaksi", sub: "Pengeluaran & pemasukan owner", icon: <ArrowLeftRight />, warna: "blue" },
  { key: "PEGAWAI", judul: "Pegawai", sub: "Ringkasan, absensi, gaji, akun", icon: <Users />, warna: "indigo" },
  { key: "REQUEST", judul: "Request edit", sub: "Permintaan ubah dari admin", icon: <ClipboardEdit />, warna: "orange" },
  { key: "LOG", judul: "Log aktivitas", sub: "Riwayat simpan, ubah & hapus pembukuan", icon: <Terminal />, warna: "gray" },
];

export const JUDUL_LAINNYA = Object.fromEntries(MENU_LAINNYA.map((m) => [m.key, m.judul])) as Record<HalamanLainnya, string>;

/**
 * HALAMAN LAINNYA — daftar ala iOS (tab "Lainnya" di HP). Halaman yang jarang dibuka
 * dikumpulkan di sini supaya tab bar tetap satu lapis.
 */
const HalamanLainnyaDaftar: React.FC<{
  pending: number;
  onBuka: (h: HalamanLainnya) => void;
  onPengaturan: () => void;
}> = ({ pending, onBuka, onPengaturan }) => (
  <div className="animate-in fade-in duration-200">
    <SectionHeader title="Owner" />
    <ListGroup>
      {MENU_LAINNYA.map((m) => (
        <ListRow
          key={m.key}
          icon={m.icon}
          iconColor={m.warna}
          title={m.judul}
          subtitle={m.sub}
          value={m.key === "REQUEST" && pending > 0 ? <Pill tone="warning" aria-label={`${pending} menunggu persetujuan`}>{pending}</Pill> : undefined}
          onClick={() => onBuka(m.key)}
        />
      ))}
    </ListGroup>

    <SectionHeader title="Aplikasi" />
    <ListGroup>
      <ListRow icon={<Settings />} iconColor="gray" title="Pengaturan" subtitle="Akun, tampilan, harga & tabel" onClick={onPengaturan} />
    </ListGroup>
  </div>
);

/** Tombol kembali ke daftar Lainnya (HP). Di laptop menu Lainnya ada langsung di sidebar. */
export const KembaliLainnya: React.FC<{ onKembali: () => void }> = ({ onKembali }) => (
  <button
    type="button"
    onClick={onKembali}
    className="-ml-2 -my-1 flex min-h-[44px] items-center gap-0.5 rounded-full pl-1 pr-3 text-callout text-tint transition-opacity active:opacity-60 md:hidden"
  >
    <ChevronLeft className="h-5 w-5" aria-hidden />
    Lainnya
  </button>
);

export default HalamanLainnyaDaftar;
