import React, { useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle, Plus, Wrench, X, EyeOff } from "lucide-react";
import useStokData from "../hooks/useStokData";
import { auth } from "../lib/firebase";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { buildStokRows, fmtWaktu, parseLastEdit, useMinStok, StokRow, kunciStok } from "../lib/stokJualan";
import {
  barisPerangkat, kategoriBarangRental, labelKategoriRental, GrupPerangkat, LABEL_GRUP, isKategoriMonitoring, isKategoriDihapus, isKategoriJajanan,
} from "../lib/stokRental";
import { KartuStok, StatusChip, StepperStok, TileStok, DOT_STATUS } from "./common/StokUI";

/**
 * STOK RENTAL — gaya UI sama dengan Stok Jualan.
 * - Perangkat (konsol, stik, TV, playbox) dihitung otomatis dari Monitoring → hanya dibaca.
 * - Barang habis pakai (jajanan / kategori lain) diubah langsung dan tersimpan otomatis.
 */
const GRUP_URUT: GrupPerangkat[] = ["KONSOL", "STIK", "PERANGKAT"];
const SATUAN: Record<GrupPerangkat, string> = { KONSOL: "unit", STIK: "pcs", PERANGKAT: "unit" };

const StokRental: React.FC<{ isOwner?: boolean; tampilJajanan: boolean }> = ({ isOwner, tampilJajanan }) => {
  const { stokState, masterCategories, updateStok, addStokItem } = useStokData();
  const minMap = useMinStok();
  const [tambahOpen, setTambahOpen] = useState(false);

  const master = Array.isArray(masterCategories?.rental) ? masterCategories.rental : [];
  const dataRental = (stokState?.rental || {}) as Record<string, Record<string, any>>;

  const perangkat = useMemo(() => barisPerangkat(master, dataRental, parseLastEdit), [master, dataRental]);
  const kategoriBarang = useMemo(() => kategoriBarangRental(master, tampilJajanan), [master, tampilJajanan]);
  const barang = useMemo(() => buildStokRows(kategoriBarang, dataRental, minMap), [kategoriBarang, dataRental, minMap]);
  const jajananDisembunyikan = !tampilJajanan && master.some((c) => isKategoriJajanan(c.kategori));

  const totalBagus = perangkat.reduce((s, p) => s + p.bagus, 0);
  const totalRusak = perangkat.reduce((s, p) => s + p.rusak, 0);
  const habis = barang.filter((r) => r.status === "habis").length;
  const menipis = barang.filter((r) => r.status === "menipis").length;

  const ubah = (r: StokRow, n: number) => updateStok("rental", r.kategori, r.item, Math.max(0, n), auth.currentUser?.email || "Admin");

  const grupList = GRUP_URUT.map((g) => ({ grup: g, rows: perangkat.filter((p) => p.grup === g) })).filter((g) => g.rows.length);

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-2.5">
        <TileStok title="Siap disewa" value={totalBagus} sub="perangkat kondisi bagus" cls="text-emerald-600 dark:text-emerald-400" icon={<CheckCircle className="w-4 h-4" />} />
        <TileStok title="Rusak" value={totalRusak} sub={totalRusak ? "perlu servis" : "semua perangkat baik"} cls="text-red-600 dark:text-red-400" icon={<Wrench className="w-4 h-4" />} />
        {barang.length > 0 && (
          <>
            <TileStok title="Habis" value={habis} sub="harus beli" cls="text-red-600 dark:text-red-400" icon={<AlertCircle className="w-4 h-4" />} />
            <TileStok title="Menipis" value={menipis} sub="di bawah minimum" cls="text-amber-600 dark:text-amber-400" icon={<AlertCircle className="w-4 h-4" />} />
          </>
        )}
      </div>

      {/* Perangkat dari Monitoring */}
      {grupList.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[12px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Perangkat rental</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              <Activity className="w-3.5 h-3.5" aria-hidden /> Otomatis dari Monitoring
            </span>
          </div>
          {grupList.map((g) => (
            <KartuStok key={g.grup} judul={LABEL_GRUP[g.grup]} kanan={`${g.rows.reduce((s, r) => s + r.bagus + r.rusak, 0)} ${SATUAN[g.grup]}`}>
              {g.rows.map((p) => (
                <div key={p.kategori} className="px-4 py-3 flex items-center gap-3 border-t border-zinc-100 dark:border-white/5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${p.rusak ? "bg-red-500" : "bg-emerald-500"}`} aria-hidden />
                      <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{p.label}</span>
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate pl-4">
                      {p.bagus + p.rusak} total · {fmtWaktu(p.lastTs)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="min-w-[64px] text-center px-2 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-[12px] font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {p.bagus} bagus
                    </span>
                    <span
                      className={`min-w-[64px] text-center px-2 py-1.5 rounded-lg text-[12px] font-bold tabular-nums ${
                        p.rusak ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400" : "bg-zinc-100 dark:bg-white/5 text-zinc-400"
                      }`}
                    >
                      {p.rusak} rusak
                    </span>
                  </div>
                </div>
              ))}
            </KartuStok>
          ))}
          <p className="text-[11.5px] text-zinc-400 px-1 leading-snug">Jumlah dihitung dari stiker perangkat. Ubah kondisi bagus / rusak lewat Monitoring › Kondisi Unit.</p>
        </div>
      )}

      {/* Barang habis pakai (jajanan, dll.) */}
      {(barang.length > 0 || isOwner) && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="text-[12px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Barang rental</span>
            {isOwner ? (
              <button
                type="button"
                onClick={() => setTambahOpen(true)}
                className="h-9 px-3 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[12px] font-black flex items-center gap-1 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" /> Barang
              </button>
            ) : (
              <span className="text-[11px] font-bold text-zinc-400">Tersimpan otomatis</span>
            )}
          </div>

          {kategoriBarang.map((c) => {
            const list = barang.filter((r) => r.kategori === c.kategori);
            if (!list.length) return null;
            return (
              <KartuStok key={c.kategori} judul={labelKategoriRental(c.kategori)} kanan={`${list.reduce((s, r) => s + r.jumlah, 0)} pcs`}>
                {list.map((r) => (
                  <div key={kunciStok(r)} className="pl-4 pr-3 py-2.5 flex items-center gap-2 border-t border-zinc-100 dark:border-white/5">
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_STATUS[r.status]}`} aria-hidden />
                        <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{r.item}</span>
                      </div>
                      <div className="mt-0.5 pl-4 flex items-center gap-1.5 min-w-0">
                        {r.status !== "aman" && <StatusChip status={r.status} kurang={r.kurang} />}
                        <span className="text-[11px] text-zinc-400 truncate">
                          {fmtWaktu(r.lastTs)}{r.lastBy ? ` · ${String(r.lastBy).split("@")[0]}` : ""}
                        </span>
                      </div>
                    </div>
                    <StepperStok value={r.jumlah} nama={r.item} onStep={(s) => ubah(r, r.jumlah + s)} onSet={(n) => ubah(r, n)} />
                  </div>
                ))}
              </KartuStok>
            );
          })}

          {barang.length === 0 && (
            <div className="text-center text-[13px] text-zinc-500 py-8 rounded-2xl border border-dashed border-zinc-300 dark:border-white/10 px-6">
              Belum ada barang rental yang dihitung manual.
            </div>
          )}
          {isOwner && barang.length > 0 && <p className="text-[11.5px] text-zinc-400 px-1">Perubahan jumlah barang rental langsung tersimpan.</p>}
        </div>
      )}

      {isOwner && jajananDisembunyikan && (
        <div className="rounded-2xl bg-zinc-100 dark:bg-white/5 px-4 py-3 flex items-start gap-2.5 text-[12.5px] leading-snug text-zinc-600 dark:text-zinc-300">
          <EyeOff className="w-4 h-4 mt-0.5 shrink-0 text-zinc-400" />
          <span>Stok jajanan disembunyikan karena tabel <b className="text-zinc-900 dark:text-white">Pemasukan Jajanan</b> dimatikan di Pengaturan › Tampilkan Tabel di Usaha Rental.</span>
        </div>
      )}

      {tambahOpen && (
        <TambahBarangRental
          kategori={master.filter((c) => !isKategoriMonitoring(c.kategori) && !isKategoriDihapus(c.kategori) && (tampilJajanan || !isKategoriJajanan(c.kategori))).map((c) => c.kategori)}
          onClose={() => setTambahOpen(false)}
          onAdd={(kat, nama) => addStokItem("rental", kat, nama)}
        />
      )}
    </div>
  );
};

/** Lembar tambah barang rental (owner) — menggantikan "Master Inventaris". */
const TambahBarangRental: React.FC<{ kategori: string[]; onClose: () => void; onAdd: (kat: string, nama: string) => Promise<boolean> }> = ({ kategori, onClose, onAdd }) => {
  useBodyScrollLock(true);
  const BARU = "__baru__";
  const [kat, setKat] = useState(kategori[0] || BARU);
  const [katBaru, setKatBaru] = useState("");
  const [nama, setNama] = useState("");
  const [saving, setSaving] = useState(false);
  const katFinal = kat === BARU ? katBaru.trim().toUpperCase() : kat;
  const bisa = !!nama.trim() && !!katFinal && !saving;

  const simpan = async () => {
    if (!bisa) return;
    setSaving(true);
    const ok = await onAdd(katFinal, nama.trim());
    setSaving(false);
    if (ok) onClose();
    else alert("Barang sudah ada di kategori ini atau gagal menyimpan.");
  };

  const input = "w-full h-12 px-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[15px] font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-blue-500";
  return (
    <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !saving && onClose()} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#1c1c1e] rounded-t-[24px] sm:rounded-[24px] max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
        <div className="px-5 pt-3 pb-2 flex items-center justify-between">
          <h3 className="text-[17px] font-black text-zinc-900 dark:text-white">Tambah barang rental</h3>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Tutup" className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-4 space-y-3 overflow-y-auto">
          <label className="block">
            <span className="block text-[12px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Kategori</span>
            <select value={kat} onChange={(e) => setKat(e.target.value)} className={input}>
              {kategori.map((k) => <option key={k} value={k}>{labelKategoriRental(k)}</option>)}
              <option value={BARU}>+ Kategori baru</option>
            </select>
          </label>
          {kat === BARU && (
            <input value={katBaru} onChange={(e) => setKatBaru(e.target.value)} placeholder="Nama kategori baru, mis. ALAT KEBERSIHAN" className={`${input} uppercase`} />
          )}
          <label className="block">
            <span className="block text-[12px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Nama barang</span>
            <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Mis. Kopi Susu" className={input} onKeyDown={(e) => e.key === "Enter" && simpan()} />
          </label>
        </div>
        <div className="px-5 pt-2 pb-4 border-t border-zinc-100 dark:border-white/5">
          <button type="button" onClick={simpan} disabled={!bisa} className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[15px] font-black active:scale-[0.98] disabled:opacity-50">
            {saving ? "Menyimpan…" : "Simpan barang"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StokRental;
