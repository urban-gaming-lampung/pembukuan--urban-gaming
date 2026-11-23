import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, MessageCircle } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { pesanPengingat } from "../lib/pengingatSewa";
import { bukaWa } from "../lib/wa";
import type { SewaBerjalan } from "../lib/sewa";
import { Button, MOTION } from "../ui";

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
  bukaWa(u.waPenyewa, pesan);
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 font-sans" role="alertdialog" aria-modal="true">
      <div className={`absolute inset-0 bg-black/65 backdrop-blur-sm pointer-events-auto ${MOTION.backdrop}`} />
      <div className={`relative w-full max-w-[340px] overflow-hidden rounded-sheet apple-sheet shadow-float border border-white/65 dark:border-white/[0.14] ring-1 ring-black/10 dark:ring-white/10 p-3.5 ${MOTION.dialog}`}>
        <div className="px-2 pt-2.5 pb-4 text-center flex flex-col items-center">
          <div className="mb-4 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-negative/15 text-negative ring-4 ring-negative/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 animate-pulse" />
            </div>
          </div>
          <h3 className="text-title3 font-bold text-label mb-2 tracking-tight">Waktu Sewa Habis!</h3>
          <p className="text-subhead leading-relaxed text-label-2 mb-3">
            Unit{" "}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-fill text-label font-semibold">
              {u.jenis}
            </span>{" "}
            atas nama <strong className="text-label font-semibold">{u.namaPenyewa}</strong> telah selesai durasi sewanya.
          </p>
          <p className="text-callout font-semibold text-label leading-snug">
            Apakah sewa sudah habis atau belum, {sapaan}?
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <Button
            variant="filled"
            size="lg"
            block
            onClick={() => onVerify(sumberSewa(u))}
          >
            Ya, Sudah Habis &amp; Kembali
          </Button>
          {bisaIngatkan(u) && (
            <Button
              variant="gray"
              size="lg"
              block
              icon={<MessageCircle />}
              onClick={() => { kirimPengingatSewa(u, onPengingat); tundaPeringatan(u.uid); }}
              className="!text-positive"
            >
              Belum Kembali · Ingatkan via WA
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PeringatanSewaHabis;
