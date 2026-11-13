import React, { useState } from "react";
import { AlertTriangle, Loader2, Minus, Plus } from "lucide-react";
import useStokData from "../hooks/useStokData";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { dariTukarTambah, hapusStokMasuk, KATEGORI_PENGELUARAN_STOK, StokMasuk, ubahStokMasuk } from "../lib/barangJualan";
import { rupiah } from "../lib/format";
import { Toggle } from "../ui/feedback";

/** Angka saja dari input bebas ("01.500" -> "1500"). */
export const digits = (s: string) => s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
/** "1500" -> "1.500" (kosong tetap kosong). */
export const fmtDigits = (s: string) => (s ? Number(s).toLocaleString("id-ID") : "");

/** Saklar ala iOS — satu komponen di Design System (src/ui). */
export { Toggle };

/**
 * Lembar ubah / hapus SATU catatan stok masuk — satu komponen untuk Atur Stok › Edit Barang
 * dan histori Pengeluaran (baris "Dari stok masuk"). Pengeluarannya selalu ikut; jumlah stok
 * ikut disesuaikan kecuali "Stok ikut disesuaikan" dimatikan (stok sudah dikoreksi sendiri).
 */
const StokMasukSheet: React.FC<{
  rec: StokMasuk;
  /** Nama untuk teks pengeluaran (bawaan: nama produk saat stok masuk dicatat) */
  produkNama?: string;
  /** Produk asal catatan ini sudah dihapus */
  produkDihapus?: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ rec, produkNama, produkDihapus, onClose, onDone }) => {
  useBodyScrollLock(true);
  const { stokState } = useStokData();
  const [qty, setQty] = useState(rec.qty);
  const [modal, setModal] = useState(String(rec.modalSatuan || ""));
  const [tanggal, setTanggal] = useState(rec.tanggal);
  const [catat, setCatat] = useState(rec.catatPengeluaran);
  const [ikutStok, setIkutStok] = useState(true);
  const [busy, setBusy] = useState<"" | "simpan" | "hapus">("");
  const [err, setErr] = useState("");
  const namaUntukPengeluaran = produkNama || rec.produkNama;
  // Barang tukar tambah: jumlah, stok & nilainya mengikuti nota POS (hanya-baca di sini)
  const dariTukar = dariTukarTambah(rec);
  const modalN = Number(modal || 0);
  const selisih = qty - rec.qty;
  const berubah = qty !== rec.qty || modalN !== rec.modalSatuan || tanggal !== rec.tanggal || catat !== rec.catatPengeluaran;
  const stokSekarang = Math.max(0, Math.round(Number((stokState?.jualan as any)?.[rec.kategori]?.[rec.item]?.jumlah) || 0));
  const field = "w-full h-12 px-4 rounded-[14px] bg-zinc-100 dark:bg-white/10 text-[16px] text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40";

  const simpan = async () => {
    setErr("");
    if (!(qty > 0)) return setErr("Jumlah minimal 1. Untuk membatalkan, pakai Hapus.");
    setBusy("simpan");
    try {
      const r = await ubahStokMasuk(rec, { qty, modalSatuan: modalN, tanggal, catatPengeluaran: catat }, namaUntukPengeluaran, ikutStok);
      onDone(`Stok masuk diperbarui${r.selisih ? ` · stok ${r.selisih > 0 ? "+" : "−"}${Math.abs(r.selisih)}` : ""} ✓`);
    } catch (e: any) { setErr(e?.message || String(e)); setBusy(""); }
  };
  const hapus = async () => {
    const efekStok = ikutStok ? `Stok ${rec.item} berkurang ${rec.qty} (${stokSekarang} → ${Math.max(0, stokSekarang - rec.qty)})` : `Stok ${rec.item} tetap ${stokSekarang}`;
    const efekUang = rec.catatPengeluaran ? `\nPengeluaran ${rupiah(rec.qty * (rec.modalSatuan || 0))} ikut dihapus.` : "";
    if (!confirm(`Hapus stok masuk +${rec.qty} (${rec.item})?\n${efekStok}.${efekUang}`)) return;
    setBusy("hapus"); setErr("");
    try { await hapusStokMasuk(rec, ikutStok); onDone(`Stok masuk dihapus${ikutStok ? ` · stok −${rec.qty}` : ""} ✓`); }
    catch (e: any) { setErr(e?.message || String(e)); setBusy(""); }
  };

  return (
    <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className="relative w-full sm:max-w-md bg-[#f2f2f7] dark:bg-black rounded-t-[22px] sm:rounded-[22px] max-h-[90vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pt-2"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-700" /></div>
        <div className="px-4 pt-1 pb-2 flex items-center justify-between">
          <button type="button" onClick={onClose} disabled={!!busy} className="text-[16px] text-blue-600 dark:text-blue-400 disabled:opacity-40 min-w-[56px] text-left">Batal</button>
          <h3 className="text-[16px] font-semibold text-zinc-900 dark:text-white">Stok Masuk</h3>
          {dariTukar ? <span className="min-w-[56px]" /> : (
            <button type="button" onClick={simpan} disabled={!!busy || !berubah} className="text-[16px] font-semibold text-blue-600 dark:text-blue-400 disabled:opacity-40 min-w-[56px] text-right">
              {busy === "simpan" ? <Loader2 className="w-5 h-5 animate-spin ml-auto" /> : "Simpan"}
            </button>
          )}
        </div>
        {dariTukar ? (
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
            <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] px-4 py-1 divide-y divide-zinc-100 dark:divide-white/5">
              {[
                { l: "Barang stok", r: `${rec.kategori} › ${rec.item}` },
                { l: "Jumlah", r: `+${rec.qty}` },
                { l: "Modal / barang", r: rupiah(rec.modalSatuan || 0) },
                { l: "Tanggal nota", r: rec.tanggal },
                { l: "Nota", r: rec.noNota || "-" },
              ].map((x) => (
                <div key={x.l} className="flex items-center justify-between gap-3 py-2.5 text-[15px]">
                  <span className="text-zinc-500 shrink-0">{x.l}</span>
                  <span className="text-zinc-900 dark:text-white font-medium tabular-nums text-right truncate">{x.r}</span>
                </div>
              ))}
            </div>
            <p className="px-1 text-[12.5px] text-zinc-500 leading-snug">
              Barang dari <b className="font-semibold text-zinc-700 dark:text-zinc-200">tukar tambah</b>. Nilainya sudah tercatat di nota sebagai belanja stok, jadi tidak ada pengeluaran terpisah. Jumlahnya mengikuti nota — membatalkan nota menarik barang ini dari stok.
            </p>
          </div>
        ) : (<>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 space-y-4">
          <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-zinc-900 dark:text-white truncate">{rec.item}</div>
                <div className="text-[12.5px] text-zinc-500 truncate">{rec.kategori}</div>
              </div>
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-white/10 rounded-full p-1 shrink-0">
                <button type="button" aria-label="Kurangi" onClick={() => setQty((n) => Math.max(1, n - 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-700 dark:text-zinc-200"><Minus className="w-4 h-4" /></button>
                <input inputMode="numeric" aria-label="Jumlah stok masuk" value={qty || ""} onChange={(e) => setQty(Math.min(9999, Number(digits(e.target.value) || 0)))} className="w-10 bg-transparent text-center text-[17px] font-semibold tabular-nums text-zinc-900 dark:text-white focus:outline-none" />
                <button type="button" aria-label="Tambah" onClick={() => setQty((n) => Math.min(9999, n + 1))} className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-700 dark:text-zinc-200"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <div>
                <span className="block text-[13px] font-medium text-zinc-500 mb-1.5 px-1">Modal / barang</span>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-zinc-400">Rp</span>
                  <input inputMode="numeric" value={fmtDigits(modal)} onChange={(e) => setModal(digits(e.target.value))} placeholder="0" className={`${field} pl-10 tabular-nums`} />
                </div>
              </div>
              <div>
                <span className="block text-[13px] font-medium text-zinc-500 mb-1.5 px-1">Tanggal beli</span>
                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value || rec.tanggal)} className={`${field} text-[15px]`} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <div className="text-[15px] text-zinc-900 dark:text-white">Catat ke Pengeluaran</div>
                <div className="text-[12.5px] text-zinc-500">Kategori “{KATEGORI_PENGELUARAN_STOK}” · {rupiah(modalN * qty)}</div>
              </div>
              <Toggle on={catat} onChange={setCatat} label="Catat ke pengeluaran" />
            </div>
          </div>

          {/* Stok ikut disesuaikan saat jumlah diubah / catatan dihapus */}
          <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] text-zinc-900 dark:text-white">Stok ikut disesuaikan</div>
              <div className="text-[12.5px] text-zinc-500 leading-snug">
                {!ikutStok
                  ? <>Stok {rec.item} tetap <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{stokSekarang}</b>. Pilih ini bila jumlah stok sudah dikoreksi.</>
                  : selisih !== 0
                    ? <>Stok {rec.item}: <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{stokSekarang} → {Math.max(0, stokSekarang + selisih)}</b></>
                    : <>Saat jumlah diubah atau catatan dihapus · stok sekarang <b className="text-zinc-700 dark:text-zinc-200 tabular-nums">{stokSekarang}</b></>}
              </div>
            </div>
            <Toggle on={ikutStok} onChange={setIkutStok} label="Stok ikut disesuaikan" />
          </div>

          <p className="px-1 text-[12px] text-zinc-400 leading-snug">
            {rec.produkNama ? <>Produk: {rec.produkNama}{produkDihapus ? " (sudah dihapus)" : ""} · </> : null}
            Dicatat {new Date(rec.ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} oleh {String(rec.oleh || "").split("@")[0]}
            {rec.updatedAt ? ` · diubah ${new Date(rec.updatedAt).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
          {err && <div className="flex items-start gap-2 rounded-[14px] bg-red-50 dark:bg-red-500/10 px-3.5 py-3 text-[13.5px] text-red-600 dark:text-red-400"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{err}</div>}
          <button type="button" onClick={simpan} disabled={!!busy || !berubah}
            className="w-full h-[52px] rounded-[16px] bg-blue-600 text-white text-[17px] font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            {busy === "simpan" && <Loader2 className="w-5 h-5 animate-spin" />}Simpan perubahan
          </button>
          <button type="button" onClick={hapus} disabled={!!busy} className="w-full h-11 text-[15px] text-red-600 dark:text-red-400 disabled:opacity-40 flex items-center justify-center gap-2">
            {busy === "hapus" && <Loader2 className="w-4 h-4 animate-spin" />}Hapus stok masuk
          </button>
        </div>
        </>)}
      </div>
    </div>
  );
};

export default StokMasukSheet;
