import React, { useState } from "react";
import { Check, Loader2, Lock } from "lucide-react";
import { auth } from "../lib/firebase";
import { verifikasiPasswordAkun } from "../lib/akun";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";

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

  const tombol = "h-12 flex items-center justify-center text-[16px] active:bg-zinc-100 dark:active:bg-white/5 disabled:opacity-40";
  const warnaAksi = bahaya ? "text-red-600 dark:text-red-500" : "text-blue-600 dark:text-blue-400";

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !busy && onBatal()} />
      <form
        onSubmit={kirim}
        className="relative w-full max-w-[320px] overflow-hidden rounded-[22px] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200"
      >
        {terverifikasi && langkahLanjut ? (
          <div className="px-5 pt-6 pb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/15">
              <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white">{judul}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{langkahLanjut.pesan}</p>
          </div>
        ) : (
          <div className="px-5 pt-6 pb-4 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/10">
              <Lock className="w-5 h-5 text-zinc-700 dark:text-zinc-200" />
            </div>
            <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white">{judul}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{pesan}</p>
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
              className="mt-4 w-full h-11 rounded-[12px] bg-zinc-100 dark:bg-white/10 px-3.5 text-center text-[16px] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            {email && <p className="mt-2 truncate text-[12px] text-zinc-400">Masuk sebagai {email}</p>}
            {err && <p role="alert" className="mt-2 text-[13px] font-medium text-red-600 dark:text-red-400">{err}</p>}
          </div>
        )}
        <div className="grid grid-cols-2 border-t border-zinc-200/70 dark:border-white/10">
          <button type="button" onClick={onBatal} disabled={busy} className={`${tombol} border-r border-zinc-200/70 dark:border-white/10 text-blue-600 dark:text-blue-400`}>
            Batal
          </button>
          {terverifikasi && langkahLanjut ? (
            <button type="button" autoFocus onClick={onBerhasil} className={`${tombol} font-semibold ${warnaAksi}`}>
              {langkahLanjut.labelTombol}
            </button>
          ) : (
            <button type="submit" disabled={!password || busy} className={`${tombol} font-semibold ${warnaAksi}`}>
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : labelTombol}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
