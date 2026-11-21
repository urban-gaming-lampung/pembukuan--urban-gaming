import React, { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cx } from "../foundations/cn";
import { TextField } from "../controls/Field";
import { AlertDialog } from "./AlertDialog";
import { ToastKapsul, type NadaToast } from "./Toast";

/**
 * PEMBERITAHUAN — pengganti alert / confirm / prompt bawaan browser.
 *
 *  - notify(pesan, nada?)          → toast kaca di atas layar, tidak memblok (window.alert diarahkan ke sini)
 *  - await konfirmasi(teks, opsi?) → AlertDialog iOS, hasil true / false
 *  - await tanya(teks, opsi?)      → AlertDialog + TextField, hasil string / null (batal)
 *
 * Semua state disimpan di modul ini; <PemberitahuanHost /> dipasang sekali di main.tsx
 * sehingga fungsi di atas bisa dipanggil dari mana saja (komponen, hook, lib).
 */

export type OpsiKonfirmasi = {
  /** Judul dialog. Default: baris pertama teks. */
  judul?: string;
  /** Label tombol setuju. Default "Lanjutkan" / "Hapus" untuk aksi berbahaya. */
  ya?: string;
  /** Label tombol batal. Default "Batal". */
  batal?: string;
  /** Tombol setuju berwarna merah. Default terdeteksi dari kata (hapus, tolak, coret, timpa…). */
  bahaya?: boolean;
};

export type OpsiTanya = OpsiKonfirmasi & {
  awal?: string;
  placeholder?: string;
  /** Wajib diisi sebelum tombol setuju aktif. */
  wajib?: boolean;
};

type ItemToast = { id: number; pesan: string; nada: NadaToast };
type ItemDialog = {
  id: number;
  jenis: "konfirmasi" | "tanya";
  judul: string;
  deskripsi?: string;
  ya: string;
  batal: string;
  bahaya: boolean;
  awal?: string;
  placeholder?: string;
  wajib?: boolean;
  selesai: (hasil: boolean | string | null) => void;
};

type State = { toasts: ItemToast[]; dialogs: ItemDialog[] };

let state: State = { toasts: [], dialogs: [] };
let nextId = 1;
const listeners = new Set<() => void>();
const setState = (fn: (s: State) => State) => {
  state = fn(state);
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => state;

// ---------- teks ----------

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]️?|️|‍|⃣/gu;

/** Buang emoji dari teks UI & rapikan spasi (baris baru dipertahankan). */
export const tanpaEmoji = (teks: string) =>
  teks
    .replace(EMOJI, "")
    .split("\n")
    .map((b) => b.replace(/[ \t]{2,}/g, " ").replace(/\s+([!?.,:])/g, "$1").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Tebak nada toast dari emoji / kata kunci pesan lama. */
export const tebakNada = (teks: string): NadaToast => {
  if (/[❌⛔🚫]/u.test(teks)) return "negative";
  if (/⚠/u.test(teks)) return "warning";
  if (/[✅🎉👍✔]/u.test(teks)) return "positive";
  const t = teks.toLowerCase();
  if (/\b(gagal|error|galat|tidak dapat|tidak bisa|terjadi kesalahan|ditolak server)\b/.test(t)) return "negative";
  if (/\b(berhasil|sukses|tersimpan|disimpan|terkirim|dikirim|disalin|dihapus|disetujui|diperbarui|diupdate)\b/.test(t)) return "positive";
  if (/\b(harap|mohon|wajib|belum|tidak boleh|minimal|maksimal|tidak valid|tidak cukup|melebihi|pilih|isi)\b/.test(t)) return "warning";
  return "info";
};

const BAHAYA = /\b(hapus|menghapus|dihapus|tolak|menolak|coret|timpa|menimpa|batalkan|membatalkan|reset|kosongkan|keluar)\b/i;

const pecahTeks = (teks: string, judul?: string) => {
  const bersih = tanpaEmoji(teks);
  if (judul) return { judul: tanpaEmoji(judul), deskripsi: bersih || undefined };
  const [baris1, ...sisa] = bersih.split("\n");
  const deskripsi = sisa.join("\n").trim();
  return { judul: baris1.trim() || "Konfirmasi", deskripsi: deskripsi || undefined };
};

// ---------- API ----------

const durasiToast = (pesan: string) => Math.min(9000, Math.max(3500, pesan.length * 45));
const timers = new Map<number, number>();

export const tutupToast = (id: number) => {
  const t = timers.get(id);
  if (t) window.clearTimeout(t);
  timers.delete(id);
  setState((s) => ({ ...s, toasts: s.toasts.filter((x) => x.id !== id) }));
};

/** Toast non-blocking di atas layar. Nada otomatis bila tidak diisi. */
export function notify(pesan: unknown, nada?: NadaToast): void {
  if (typeof window === "undefined") return;
  const mentah = String(pesan ?? "");
  const bersih = tanpaEmoji(mentah);
  if (!bersih) return;
  const id = nextId++;
  const item: ItemToast = { id, pesan: bersih, nada: nada ?? tebakNada(mentah) };
  setState((s) => {
    const toasts = [...s.toasts, item];
    // maksimal 3 bertumpuk; yang paling lama dibuang
    while (toasts.length > 3) {
      const lama = toasts.shift()!;
      const t = timers.get(lama.id);
      if (t) window.clearTimeout(t);
      timers.delete(lama.id);
    }
    return { ...s, toasts };
  });
  timers.set(id, window.setTimeout(() => tutupToast(id), durasiToast(bersih)));
}

const antreDialog = (d: Omit<ItemDialog, "id" | "selesai">) =>
  new Promise<boolean | string | null>((resolve) => {
    const id = nextId++;
    let beres = false;
    const selesai = (hasil: boolean | string | null) => {
      if (beres) return;
      beres = true;
      setState((s) => ({ ...s, dialogs: s.dialogs.filter((x) => x.id !== id) }));
      resolve(hasil);
    };
    setState((s) => ({ ...s, dialogs: [...s.dialogs, { ...d, id, selesai }] }));
  });

/** Dialog Ya/Batal bergaya iOS. Hasil `true` bila disetujui. */
export function konfirmasi(teks: string, opsi: OpsiKonfirmasi = {}): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const { judul, deskripsi } = pecahTeks(teks, opsi.judul);
  const bahaya = opsi.bahaya ?? BAHAYA.test(`${judul} ${opsi.ya ?? ""}`);
  return antreDialog({
    jenis: "konfirmasi",
    judul,
    deskripsi,
    ya: opsi.ya ?? (bahaya ? "Hapus" : "Lanjutkan"),
    batal: opsi.batal ?? "Batal",
    bahaya,
  }).then((h) => h === true);
}

/** Dialog dengan kolom isian. Hasil teks (boleh kosong bila tidak wajib) atau `null` bila dibatalkan. */
export function tanya(teks: string, opsi: OpsiTanya = {}): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const { judul, deskripsi } = pecahTeks(teks, opsi.judul);
  return antreDialog({
    jenis: "tanya",
    judul,
    deskripsi,
    ya: opsi.ya ?? "OK",
    batal: opsi.batal ?? "Batal",
    bahaya: opsi.bahaya ?? false,
    awal: opsi.awal,
    placeholder: opsi.placeholder,
    wajib: opsi.wajib,
  }).then((h) => (typeof h === "string" ? h : null));
}

// ---------- Host ----------

const DialogTanya: React.FC<{ d: ItemDialog }> = ({ d }) => {
  const [nilai, setNilai] = useState(d.awal ?? "");
  const kosong = d.wajib && !nilai.trim();
  return (
    <AlertDialog
      open
      onClose={() => d.selesai(null)}
      title={d.judul}
      description={d.deskripsi}
      zClassName="z-[100001]"
      actions={[
        { label: d.batal, role: "cancel", onClick: () => d.selesai(null) },
        { label: d.ya, role: d.bahaya ? "destructive" : "primary", disabled: kosong, onClick: () => d.selesai(nilai) },
      ]}
    >
      <TextField
        autoFocus
        value={nilai}
        placeholder={d.placeholder}
        onChange={(e) => setNilai(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !kosong) {
            e.preventDefault();
            d.selesai(nilai);
          }
        }}
      />
    </AlertDialog>
  );
};

export const PemberitahuanHost: React.FC = () => {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (typeof document === "undefined") return null;
  const d = s.dialogs[0];

  return (
    <>
      {d &&
        (d.jenis === "tanya" ? (
          <DialogTanya key={d.id} d={d} />
        ) : (
          <AlertDialog
            key={d.id}
            open
            onClose={() => d.selesai(false)}
            title={d.judul}
            description={d.deskripsi ? <span className="whitespace-pre-line">{d.deskripsi}</span> : undefined}
            zClassName="z-[100001]"
            actions={[
              { label: d.batal, role: "cancel", onClick: () => d.selesai(false) },
              { label: d.ya, role: d.bahaya ? "destructive" : "primary", onClick: () => d.selesai(true) },
            ]}
          />
        ))}
      {s.toasts.length > 0 &&
        createPortal(
          <div
            className={cx(
              "pointer-events-none fixed inset-x-0 top-[max(12px,env(safe-area-inset-top))] z-[100002] flex flex-col items-center gap-2 px-4"
            )}
          >
            {[...s.toasts].reverse().map((t) => (
              <ToastKapsul key={t.id} message={t.pesan} tone={t.nada} onClose={() => tutupToast(t.id)} dari="atas" />
            ))}
          </div>,
          document.body
        )}
    </>
  );
};
