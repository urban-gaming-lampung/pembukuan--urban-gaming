import React, { useEffect, useState } from "react";
import { AlertCircle, MessageCircle } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { pesanPengingat } from "../lib/pengingatSewa";
import { linkWa } from "../lib/wa";
import type { SewaBerjalan } from "../lib/sewa";

const KUNCI_TUNDA = "urban:tunda-pengingat-sewa";
const TUNDA_MENIT = 30;
const bacaTunda = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(KUNCI_TUNDA) || "{}") || {}; } catch { return {}; }
};

/** Sumber baris sewa untuk dicatat (verifikasi kembali / pengingat WA). */
export const sumberSewa = (u: SewaBerjalan) => {
  const dasar = { jenis: u.jenis, namaPenyewa: u.namaPenyewa, start: u.start, isPaid: u.isPaid };
  return u.isLive && typeof u.sourceIdx === "number"
    ? { ...dasar, isLive: true, sourceIdx: u.sourceIdx, _rawRow: { ...u._rawRow, _isActiveSession: true, _sourceIdx: u.sourceIdx } }
    : { ...dasar, isLive: false, historyId: u.historyId, _rawRow: { ...u._rawRow, _historyId: u.historyId } };
};

export const bisaIngatkan = (u: SewaBerjalan | null | undefined) => !!(u && u.waPenyewa && u.endMs);

/** Buka WhatsApp penyewa dengan pesan pengingat, lalu catat "sudah diingatkan". */
export function kirimPengingatSewa(u: SewaBerjalan, onPengingat?: (item: ReturnType<typeof sumberSewa>) => void) {
  if (!bisaIngatkan(u)) return;
  const pesan = pesanPengingat({ nama: u.namaPenyewa, jenis: u.jenis, endMs: u.endMs!, now: Date.now(), noNota: u._rawRow?._noNota });
  window.open(linkWa(u.waPenyewa, pesan), "_blank");
  onPengingat?.(sumberSewa(u));
}

/**
 * Peringatan "Waktu Sewa Habis!" — satu komponen untuk halaman Usaha Rental & Monitoring.
 * Daftar `items` = unit milik admin ini yang waktunya habis & belum dikonfirmasi kembali.
 * "Belum kembali · ingatkan via WA" menunda peringatan unit itu 30 menit.
 */
const PeringatanSewaHabis: React.FC<{
  items: SewaBerjalan[];
  userEmail?: string | null;
  /** Sembunyikan sementara (mis. popup status pembayaran sedang tampil) */
  jeda?: boolean;
  onVerify: (item: ReturnType<typeof sumberSewa>) => void;
  onPengingat?: (item: ReturnType<typeof sumberSewa>) => void;
}> = ({ items, userEmail, jeda, onVerify, onPengingat }) => {
  const [tunda, setTunda] = useState<Record<string, number>>(() => bacaTunda());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const tampil = items.filter((u) => !((tunda[u.uid] || 0) > now));
  const u = !jeda ? tampil[0] : undefined;
  useBodyScrollLock(!!u);
  if (!u) return null;

  const tundaPeringatan = (uid: string) => {
    const t = Date.now();
    const next = { ...tunda, [uid]: t + TUNDA_MENIT * 60000 };
    Object.keys(next).forEach((k) => { if (next[k] < t) delete next[k]; });
    setTunda(next);
    try { localStorage.setItem(KUNCI_TUNDA, JSON.stringify(next)); } catch { /* abaikan */ }
  };

  const nama = (userEmail || "").split("@")[0];
  const sapaan = nama ? nama.charAt(0).toUpperCase() + nama.slice(1) : "Admin";

  return (
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px] pointer-events-auto" />
      <div className="relative w-full max-w-[320px] overflow-hidden rounded-[24px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-90 duration-300">
        <div className="p-6 text-center flex flex-col items-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 ring-4 ring-red-500/10">
            <AlertCircle className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-[19px] font-black text-zinc-900 dark:text-white mb-2 leading-tight tracking-tight">Waktu Sewa Habis!</h3>
          <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400 mb-4">
            Unit <strong className="text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{u.jenis}</strong> atas nama <strong className="text-blue-600 dark:text-blue-400">{u.namaPenyewa}</strong> telah selesai durasi sewanya.
          </p>
          <p className="text-[16px] font-bold text-zinc-900 dark:text-white mb-4 leading-tight tracking-tight">Apakah sewa sudah habis atau belum, {sapaan}?</p>
        </div>
        <div className="flex flex-col border-t border-gray-200/50 dark:border-white/10">
          <button
            type="button"
            onClick={() => onVerify(sumberSewa(u))}
            className="w-full py-4 text-[15px] shadow-inner font-black text-blue-600 dark:text-blue-500 bg-white/50 dark:bg-black/20 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors active:bg-blue-100 dark:active:bg-blue-500/20"
          >
            YA, SUDAH HABIS & KEMBALI
          </button>
          {bisaIngatkan(u) && (
            <button
              type="button"
              onClick={() => { kirimPengingatSewa(u, onPengingat); tundaPeringatan(u.uid); }}
              className="w-full py-3.5 text-[14px] font-bold text-emerald-700 dark:text-emerald-400 border-t border-gray-200/50 dark:border-white/10 bg-white/30 dark:bg-black/10 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />BELUM KEMBALI · INGATKAN VIA WA
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PeringatanSewaHabis;
