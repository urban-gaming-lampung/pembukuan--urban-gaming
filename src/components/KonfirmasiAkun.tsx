import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Lock } from "lucide-react";
import { auth } from "../lib/firebase";
import { verifikasiPasswordAkun } from "../lib/akun";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { IconBadge } from "../ui";

/**
 * Konfirmasi aksi penting dengan password akun yang sedang login (satu komponen untuk
 * hapus pembukuan dan Backup / Restore / Reset). Password diperiksa Firebase, tidak disimpan.
 *
 * `langkahLanjut`: sesudah password benar, tampilkan satu tombol lagi. Dipakai bila aksinya
 * harus berasal dari ketukan langsung (mis. membuka pemilih file — diblokir browser HP bila
 * dipanggil sesudah menunggu jaringan).
 */
export default function KonfirmasiAkun({
  judul,
  pesan,
  labelTombol = "Lanjutkan",
  bahaya = false,
  langkahLanjut,
  onBatal,
  onBerhasil,
}: {
  judul: string;
  pesan: React.ReactNode;
  labelTombol?: string;
  /** Tombol merah untuk aksi yang menghapus / menimpa data */
  bahaya?: boolean;
  langkahLanjut?: { pesan: React.ReactNode; labelTombol: string };
  onBatal: () => void;
  onBerhasil: () => void;
}) {
  useBodyScrollLock(true);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [terverifikasi, setTerverifikasi] = useState(false);
  const email = auth.currentUser?.email || "";

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      await verifikasiPasswordAkun(password);
    } catch (er: any) {
      setErr(er?.message || String(er));
      setBusy(false);
      return;
    }
    setBusy(false);
    if (langkahLanjut) setTerverifikasi(true);
    else onBerhasil();
  };

  const tombol =
    "min-h-[48px] w-full rounded-full px-4 flex items-center justify-center text-subhead transition-all active:opacity-75 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint";
  const warnaAksi = bahaya
    ? "bg-negative/[0.13] text-negative dark:bg-negative/[0.22] font-semibold hover:bg-negative/[0.20]"
    : "bg-action text-action-label font-semibold shadow-sm hover:opacity-85";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 font-sans" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-[8px]" onClick={() => !busy && onBatal()} />
      <form
        onSubmit={kirim}
        className="relative w-full max-w-[320px] overflow-hidden rounded-sheet apple-sheet p-3.5 shadow-float border border-white/65 dark:border-white/[0.14] ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-200"
      >
        {terverifikasi && langkahLanjut ? (
          <div className="px-2 pt-2.5 pb-4 text-center">
            <div className="mb-3 flex justify-center">
              <IconBadge color="green" variant="tinted" className="h-12 w-12 rounded-full [&>svg]:h-5 [&>svg]:w-5">
                <Check />
              </IconBadge>
            </div>
            <h3 className="text-headline text-label">{judul}</h3>
            <p className="mt-1.5 text-footnote leading-relaxed text-label-2">{langkahLanjut.pesan}</p>
          </div>
        ) : (
          <div className="px-2 pt-2.5 pb-4 text-center">
            <div className="mb-3 flex justify-center">
              <IconBadge color="gray" variant="tinted" className="h-12 w-12 rounded-full [&>svg]:h-5 [&>svg]:w-5">
                <Lock />
              </IconBadge>
            </div>
            <h3 className="text-headline text-label">{judul}</h3>
            <p className="mt-1.5 text-footnote leading-relaxed text-label-2">{pesan}</p>
            {/* Nama akun untuk isi otomatis pengelola password */}
            <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErr(""); }}
              placeholder="Password akun"
              aria-label="Password akun"
              className="mt-4 w-full h-12 rounded-full bg-fill border border-sep px-4 text-center text-[16px] text-label placeholder:text-label-3 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/40"
            />
            {email && <p className="mt-2 truncate text-caption text-label-3">Masuk sebagai {email}</p>}
            {err && <p role="alert" className="mt-2 text-footnote font-medium text-negative">{err}</p>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onBatal} disabled={busy} className={`${tombol} bg-fill text-label font-medium hover:brightness-95 dark:hover:brightness-115`}>
            Batal
          </button>
          {terverifikasi && langkahLanjut ? (
            <button type="button" autoFocus onClick={onBerhasil} className={`${tombol} ${warnaAksi}`}>
              {langkahLanjut.labelTombol}
            </button>
          ) : (
            <button type="submit" disabled={!password || busy} className={`${tombol} ${warnaAksi}`}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : labelTombol}
            </button>
          )}
        </div>
      </form>
    </div>,
    document.body
  );
}
