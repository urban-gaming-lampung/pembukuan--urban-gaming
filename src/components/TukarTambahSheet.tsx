/**
 * TUKAR TAMBAH di checkout POS — kartu daftar "barang masuk" + lembar input satu barang.
 * Barang pembeli dinilai sebagai potongan nota; detail & foto disimpan di koleksi tukar_tambah
 * lalu dikonfirmasi owner di Atur Stok › Konfirmasi stok. Aturan: src/lib/tukarTambah.ts.
 */
import React, { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Camera, ChevronRight, Loader2, Plus, Trash2, X } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import type { TukarTambahInput } from "../lib/posSales";
import { namaJualan } from "../lib/posSales";
import { subKategoriTukar, uploadFotoTukarTambah } from "../lib/tukarTambah";
import { labelBayarTukar } from "../lib/posReceipt";
import { rupiah } from "../lib/format";
import { Button, Notice, SubTabs } from "../ui";

export type DraftTukar = TukarTambahInput & { key: string };

const angka = (s: string) => Math.round(Number(String(s || "").replace(/[^\d]/g, "")) || 0);
const ribuan = (s: string) => {
  const d = String(s || "").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
};

// ============================================================
// Kartu "Tukar tambah" di lembar checkout
// ============================================================

export const KartuTukarTambah: React.FC<{
  daftar: DraftTukar[];
  onTambah: () => void;
  onUbah: (key: string) => void;
}> = ({ daftar, onTambah, onUbah }) => (
  <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-3.5">
    <div className="flex items-center justify-between">
      <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Tukar tambah</div>
      <ArrowLeftRight className="w-4 h-4 text-zinc-300" />
    </div>
    {daftar.length === 0 ? (
      <p className="mt-1 text-[12.5px] leading-snug text-zinc-500">Pembeli menukar barangnya sebagai potongan harga. Barangnya masuk stok setelah dikonfirmasi owner.</p>
    ) : (
      <div className="mt-2 divide-y divide-zinc-100 dark:divide-white/5">
        {daftar.map((t) => (
          <button key={t.key} type="button" onClick={() => onUbah(t.key)} className="w-full flex items-center gap-3 py-2.5 first:pt-0.5 text-left active:opacity-60">
            <img src={t.fotoBarang} alt="" className="w-11 h-11 rounded-[10px] object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-bold text-zinc-900 dark:text-white leading-snug truncate">{t.nama}</div>
              <div className="text-[11.5px] text-zinc-500 font-mono truncate">SN {t.sn}</div>
            </div>
            <div className="shrink-0 text-[13px] font-black font-mono text-zinc-900 dark:text-white">−{rupiah(t.nilai * t.qty)}</div>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>
        ))}
      </div>
    )}
    <button type="button" onClick={onTambah}
      className="mt-2.5 w-full h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[13px] font-bold text-zinc-800 dark:text-zinc-100 flex items-center justify-center gap-1.5 active:scale-[0.98]">
      <Plus className="w-4 h-4" />{daftar.length ? "Tambah barang lain" : "Barang masuk"}
    </button>
  </div>
);

// ============================================================
// Lembar input satu barang tukar tambah
// ============================================================

type Mode = "PEMBELI" | "URBAN" | "NILAI";

const FotoTile: React.FC<{ label: string; value: string; onChange: (url: string) => void; onError: (m: string) => void }> = ({ label, value, onChange, onError }) => {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pilih = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    try {
      onChange(await uploadFotoTukarTambah(f, label.includes("SN") ? "sn" : "barang"));
    } catch (e: any) {
      onError(`Foto gagal diunggah: ${e?.message || e}`);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <button type="button" onClick={() => !busy && ref.current?.click()} aria-label={value ? `Ganti ${label}` : `Ambil ${label}`}
      className={`relative aspect-[4/3] rounded-tile overflow-hidden flex flex-col items-center justify-center gap-1 active:opacity-70 bg-fill ${value ? "" : "border-[1.5px] border-dashed border-sep"}`}>
      {value ? (
        <>
          <img src={value} alt={label} className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute left-1.5 bottom-1.5 rounded-full bg-black/60 px-2 py-0.5 text-caption2 font-semibold text-white">{label} · Ganti</span>
        </>
      ) : busy ? (
        <Loader2 className="w-5 h-5 animate-spin text-label-2" />
      ) : (
        <>
          <Camera className="w-5 h-5 text-tint" />
          <span className="text-footnote font-semibold text-label">{label}</span>
          <span className="text-caption2 text-label-3">Wajib</span>
        </>
      )}
      {busy && value && <span className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-white" /></span>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pilih(e.target.files?.[0])} />
    </button>
  );
};

const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <label className="block">
    <span className="text-footnote font-semibold text-label-2">{label}</span>
    <div className="mt-1">{children}</div>
    {hint && <div className="mt-1 text-caption text-label-2">{hint}</div>}
  </label>
);
const inputCls = "w-full h-12 px-3.5 rounded-field bg-fill text-[16px] font-semibold text-label placeholder:text-label-3 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-tint/30";

const LABEL_SUB: Record<string, string> = { "Unit PS": "Unit konsol", Stik: "Stik", Hardisk: "Hardisk", Aksesoris: "Aksesoris", BD: "Kaset BD" };

export const TukarTambahSheet: React.FC<{
  /** Total harga barang yang dijual di nota */
  totalNota: number;
  /** Nilai barang tukar tambah lain di nota ini (selain yang sedang diubah) */
  nilaiLain: number;
  awal: DraftTukar | null;
  onSimpan: (d: DraftTukar) => void;
  onHapus?: () => void;
  onClose: () => void;
}> = ({ totalNota, nilaiLain, awal, onSimpan, onHapus, onClose }) => {
  useBodyScrollLock(true);
  const [nama, setNama] = useState(awal?.nama || "");
  const [mode, setMode] = useState<Mode>(awal ? "NILAI" : "PEMBELI");
  const [uangStr, setUangStr] = useState(awal ? ribuan(String(awal.nilai)) : "");
  const [sn, setSn] = useState(awal?.sn || "");
  const [fotoSn, setFotoSn] = useState(awal?.fotoSn || "");
  const [fotoBarang, setFotoBarang] = useState(awal?.fotoBarang || "");
  const [catatan, setCatatan] = useState(awal?.catatan || "");
  const [error, setError] = useState("");

  useEffect(() => { setError(""); }, [mode]);

  const sisa = totalNota - nilaiLain; // harga yang masih harus "dibayar" sebelum barang ini
  const uang = angka(uangStr);
  const isi = uangStr.trim() !== "";
  const nilai = !isi ? 0 : mode === "PEMBELI" ? sisa - uang : mode === "URBAN" ? sisa + uang : uang;
  const bayar = sisa - nilai; // positif = pembeli bayar, negatif = URBAN bayar
  const nilaiSalah = isi && !(nilai > 0);
  const namaBersih = namaJualan(nama);
  const sub = namaBersih ? subKategoriTukar(namaBersih) : null;
  const kurang = [
    !namaBersih && "nama barang",
    !(nilai > 0) && "nilai",
    !sn.trim() && "nomor seri",
    !fotoSn && "foto SN",
    !fotoBarang && "foto barang",
  ].filter(Boolean) as string[];

  const simpan = () => {
    if (kurang.length) { setError(`Lengkapi ${kurang.join(", ")}.`); return; }
    onSimpan({
      key: awal?.key || `tt_${Date.now()}`,
      nama: namaBersih, qty: 1, nilai, sn: sn.trim().toUpperCase(), fotoSn, fotoBarang, catatan: catatan.trim(),
    });
  };

  const labelUang = mode === "PEMBELI" ? "Uang tambah dari pembeli" : mode === "URBAN" ? "Uang dari URBAN ke pembeli" : "Nilai barang pembeli";

  return (
    <div className="fixed inset-0 z-[260] flex items-end sm:items-center justify-center font-sans">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-canvas rounded-t-[26px] sm:rounded-[26px] max-h-[92vh] flex flex-col overflow-hidden shadow-float">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-sep" /></div>
        <div className="px-4 pt-2 pb-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-title3 font-bold text-label leading-tight">Barang masuk</h3>
            <p className="text-footnote text-label-2">Tukar tambah · kondisi seken</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-9 h-9 rounded-full bg-fill flex items-center justify-center text-label-2"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
          <div className="rounded-card bg-surface p-3.5 space-y-3">
            <Field label="Nama barang" hint={sub ? <>Terdeteksi <b className="font-semibold text-label">{LABEL_SUB[sub] || sub}</b> · produk & stok dicocokkan saat konfirmasi</> : "Contoh: SWITCH 1 OLED, PS4 SLIM 500GB"}>
              <input value={nama} onChange={(e) => { setNama(e.target.value); setError(""); }} placeholder="Nama & tipe barang" autoComplete="off" autoCapitalize="characters" className={`${inputCls} uppercase placeholder-shown:normal-case`} />
            </Field>
          </div>

          <div className="rounded-card bg-surface p-3.5 space-y-3">
            <SubTabs<Mode>
              size="sm"
              value={mode}
              onChange={(m) => { setMode(m); setUangStr(""); }}
              ariaLabel="Siapa yang menambah uang"
              options={[{ key: "PEMBELI", label: "Pembeli" }, { key: "URBAN", label: "URBAN" }, { key: "NILAI", label: "Nilai barang" }]}
            />
            <Field label={labelUang}>
              <div className={`flex items-center h-12 px-3.5 rounded-field bg-fill ${nilaiSalah ? "ring-2 ring-negative/40" : ""}`}>
                <span className="text-subhead font-semibold text-label-3 mr-1.5">Rp</span>
                <input inputMode="numeric" autoComplete="off" value={uangStr} onChange={(e) => { setUangStr(ribuan(e.target.value)); setError(""); }} placeholder="0" aria-label={labelUang}
                  className="flex-1 min-w-0 bg-transparent text-[17px] font-bold tabular-nums text-label focus:outline-none" />
              </div>
            </Field>
            <div className="rounded-tile bg-fill/60 px-3.5 py-2.5 space-y-1 text-footnote">
              <div className="flex justify-between gap-3 text-label-2"><span>Harga barang dijual{nilaiLain ? " (sisa)" : ""}</span><span className="tabular-nums">{rupiah(sisa)}</span></div>
              <div className="flex justify-between gap-3 text-label-2"><span>Nilai barang masuk</span><span className={`tabular-nums ${nilaiSalah ? "text-negative" : ""}`}>{isi ? `−${rupiah(Math.max(0, nilai))}` : "—"}</span></div>
              <div className="flex justify-between gap-3 pt-1 border-t border-sep text-subhead font-semibold text-label">
                <span>{isi && nilai > 0 ? labelBayarTukar(bayar) : "Dibayar pembeli"}</span>
                <span className="tabular-nums">{isi && nilai > 0 ? rupiah(Math.abs(bayar)) : "—"}</span>
              </div>
            </div>
            {nilaiSalah && <p className="text-caption font-semibold text-negative">Uang tambah tidak boleh melebihi harga barang yang dijual — pilih URBAN tambah bila URBAN yang membayar.</p>}
          </div>

          <div className="rounded-card bg-surface p-3.5 space-y-3">
            <Field label="Nomor seri (SN)">
              <input value={sn} onChange={(e) => { setSn(e.target.value.toUpperCase()); setError(""); }} placeholder="Lihat label di bawah / belakang unit" autoComplete="off" autoCapitalize="characters" spellCheck={false} className={`${inputCls} font-mono placeholder:font-sans`} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <FotoTile label="Foto SN" value={fotoSn} onChange={(u) => { setFotoSn(u); setError(""); }} onError={setError} />
              <FotoTile label="Foto barang" value={fotoBarang} onChange={(u) => { setFotoBarang(u); setError(""); }} onError={setError} />
            </div>
            <Field label="Catatan (opsional)">
              <input value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Kelengkapan, minus, dll." autoComplete="off" className={inputCls} />
            </Field>
          </div>

          <Notice>Barang masuk antrean <b className="font-semibold">Atur Stok › Konfirmasi stok</b>. Owner menentukan harga jualnya; stok bertambah setelah dikonfirmasi.</Notice>
        </div>

        <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-surface border-t border-sep space-y-2">
          {error && <div className="text-footnote font-semibold text-negative bg-negative/10 rounded-field px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            {onHapus && <Button variant="destructive" size="lg" onClick={onHapus} aria-label="Hapus barang ini" icon={<Trash2 />} className="w-[52px] px-0" />}
            <Button size="lg" block onClick={simpan}>{awal ? "Simpan perubahan" : "Tambahkan ke nota"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
