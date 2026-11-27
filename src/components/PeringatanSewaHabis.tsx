import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Clock, MessageCircle } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { batasKembali, hitungDendaTelat, labelLamaTelat, pesanPengingat, waktuRelatif } from "../lib/pengingatSewa";
import { rupiah } from "../lib/format";
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
  const dasar = { jenis: u.jenis, namaPenyewa: u.namaPenyewa, start: u.start, isPaid: u.isPaid, endMs: u.endMs, waPenyewa: u.waPenyewa };
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

  const sumber = sumberSewa(u);
  const d = u.endMs ? hitungDendaTelat(u.jenis, u.endMs, now) : null;
  const telat = !!d && d.menit > 0;
  const unit = (
    <>
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-fill text-label font-semibold">{u.jenis}</span>{" "}
      <strong className="text-label font-semibold">{u.namaPenyewa || "Tanpa nama"}</strong>
    </>
  );
  const tombolBelum = (
    <Button
      variant="gray"
      size="lg"
      block
      icon={bisaIngatkan(u) ? <MessageCircle /> : undefined}
      onClick={() => { if (bisaIngatkan(u)) kirimPengingatSewa(u, onPengingat); tundaPeringatan(u.uid); }}
      className={bisaIngatkan(u) ? "!text-positive" : undefined}
    >
      {bisaIngatkan(u) ? "Belum · Ingatkan via WA" : "Belum kembali"}
    </Button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 font-sans" role="alertdialog" aria-modal="true">
      <div className={`absolute inset-0 bg-black/65 backdrop-blur-sm pointer-events-auto ${MOTION.backdrop}`} />
      <div className={`relative w-full max-w-[340px] overflow-hidden rounded-sheet apple-sheet shadow-float border border-white/65 dark:border-white/[0.14] ring-1 ring-black/10 dark:ring-white/10 p-3.5 max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain ${MOTION.dialog}`}>
        <div className="px-2 pt-2.5 pb-4 text-center flex flex-col items-center">
          <div className="mb-4 flex justify-center">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center ring-4 ${telat ? "bg-negative/15 text-negative ring-negative/10" : "bg-warning/15 text-warning ring-warning/10"}`}>
              {telat ? <Clock className="w-8 h-8" /> : <AlertCircle className="w-8 h-8 animate-pulse" />}
            </div>
          </div>
          <h3 className="text-title3 font-bold text-label mb-2 tracking-tight">{telat ? "Lewat batas kembali" : "Waktu sewa habis"}</h3>
          {telat && u.endMs ? (
            <p className="text-subhead leading-relaxed text-label-2 mb-3">
              {unit} seharusnya kembali paling lambat {waktuRelatif(batasKembali(u.endMs), now)}, sekarang sudah lewat{" "}
              <strong className="text-negative font-semibold">{labelLamaTelat(d!.menit)}</strong>.
            </p>
          ) : (
            <p className="text-subhead leading-relaxed text-label-2 mb-3">
              Sewa {unit} selesai{u.endMs ? ` ${waktuRelatif(u.endMs, now)}` : ""}.
              {u.endMs ? ` Batas kembali ${waktuRelatif(batasKembali(u.endMs), now)}.` : ""}
            </p>
          )}
          {telat && (
            <div className="mb-3 w-full rounded-tile bg-negative/10 px-4 py-2.5 flex items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <div className="text-footnote font-semibold text-negative">Denda telat</div>
                <div className="text-caption2 text-label-2 tabular-nums">
                  {d!.tarif ? `${d!.jam} jam × ${rupiah(d!.tarif)}` : "Tarif belum diatur"}
                </div>
              </div>
              <div className="text-headline font-bold tabular-nums text-negative shrink-0">{d!.nominal > 0 ? rupiah(d!.nominal) : "-"}</div>
            </div>
          )}
          <p className="text-callout font-semibold text-label leading-snug">
            {telat ? `Apakah unit ini benar kembali terlambat, ${sapaan}?` : `Unitnya sudah kembali, ${sapaan}?`}
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {telat ? (
            <>
              <Button variant="filled" size="lg" block onClick={() => onVerify(sumber)}>
                Ya, kembali terlambat
              </Button>
              <Button variant="gray" size="lg" block onClick={() => onVerify({ ...sumber, _tanpaDenda: true } as any)}>
                Tidak, kembali tepat waktu
              </Button>
              {tombolBelum}
              <p className="px-2 text-center text-caption2 text-label-3 leading-snug">
                Jawaban ini tercatat atas nama {sapaan}.
              </p>
            </>
          ) : (
            <>
              <Button variant="filled" size="lg" block onClick={() => onVerify(sumber)}>
                Sudah kembali
              </Button>
              {tombolBelum}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PeringatanSewaHabis;
