import React, { useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle, Plus, Wrench, EyeOff } from "lucide-react";
import useStokData from "../hooks/useStokData";
import { auth } from "../lib/firebase";
import { buildStokRows, fmtWaktu, parseLastEdit, useMinStok, StokRow, kunciStok } from "../lib/stokJualan";
import {
  barisPerangkat, kategoriBarangRental, labelKategoriRental, GrupPerangkat, LABEL_GRUP, isKategoriMonitoring, isKategoriDihapus, isKategoriJajanan,
} from "../lib/stokRental";
import { Button, Card, EmptyState, Eyebrow, Pill, Sheet } from "../ui";
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
        <TileStok title="Siap disewa" value={totalBagus} sub="perangkat kondisi bagus" cls="text-positive" icon={<CheckCircle className="w-4 h-4" />} />
        <TileStok title="Rusak" value={totalRusak} sub={totalRusak ? "perlu servis" : "semua perangkat baik"} cls="text-negative" icon={<Wrench className="w-4 h-4" />} />
        {barang.length > 0 && (
          <>
            <TileStok title="Habis" value={habis} sub="harus beli" cls="text-negative" icon={<AlertCircle className="w-4 h-4" />} />
            <TileStok title="Menipis" value={menipis} sub="di bawah minimum" cls="text-warning" icon={<AlertCircle className="w-4 h-4" />} />
          </>
        )}
      </div>

      {/* Perangkat dari Monitoring */}
      {grupList.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <Eyebrow>Perangkat rental</Eyebrow>
            <Pill tone="positive" icon={<Activity />}>Otomatis dari Monitoring</Pill>
          </div>
          {grupList.map((g) => (
            <KartuStok key={g.grup} judul={LABEL_GRUP[g.grup]} kanan={`${g.rows.reduce((s, r) => s + r.bagus + r.rusak, 0)} ${SATUAN[g.grup]}`}>
              {g.rows.map((p) => (
                <div key={p.kategori} className="px-4 py-3 flex items-center gap-3 border-t border-sep">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${p.rusak ? "bg-negative" : "bg-positive"}`} aria-hidden />
                      <span className="text-subhead font-semibold text-label truncate">{p.label}</span>
                    </div>
                    <div className="text-caption2 text-label-3 truncate pl-4">
                      {p.bagus + p.rusak} total · {fmtWaktu(p.lastTs)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Pill tone="positive" className="min-w-[68px] justify-center py-1 tabular-nums">
                      {p.bagus} bagus
                    </Pill>
                    <Pill tone={p.rusak ? "negative" : "neutral"} className="min-w-[64px] justify-center py-1 tabular-nums">
                      {p.rusak} rusak
                    </Pill>
                  </div>
                </div>
              ))}
            </KartuStok>
          ))}
          <p className="text-caption text-label-3 px-1 leading-snug">Jumlah dihitung dari stiker perangkat. Ubah kondisi bagus / rusak lewat Monitoring › Kondisi Unit.</p>
        </div>
      )}

      {/* Barang habis pakai (jajanan, dll.) */}
      {(barang.length > 0 || isOwner) && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <Eyebrow>Barang rental</Eyebrow>
            {isOwner ? (
              <Button variant="filled" size="sm" icon={<Plus />} onClick={() => setTambahOpen(true)}>
                Barang
              </Button>
            ) : (
              <span className="text-caption font-medium text-label-3">Tersimpan otomatis</span>
            )}
          </div>

          {kategoriBarang.map((c) => {
            const list = barang.filter((r) => r.kategori === c.kategori);
            if (!list.length) return null;
            return (
              <KartuStok key={c.kategori} judul={labelKategoriRental(c.kategori)} kanan={`${list.reduce((s, r) => s + r.jumlah, 0)} pcs`}>
                {list.map((r) => (
                  <div key={kunciStok(r)} className="pl-4 pr-3 py-2.5 flex items-center gap-2 border-t border-sep">
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_STATUS[r.status]}`} aria-hidden />
                        <span className="text-subhead font-semibold text-label truncate">{r.item}</span>
                      </div>
                      <div className="mt-0.5 pl-4 flex items-center gap-1.5 min-w-0">
                        {r.status !== "aman" && <StatusChip status={r.status} kurang={r.kurang} />}
                        <span className="text-caption2 text-label-3 truncate">
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
            <EmptyState title="Belum ada barang rental">
              Belum ada barang rental yang dihitung manual.
            </EmptyState>
          )}
          {isOwner && barang.length > 0 && <p className="text-caption text-label-3 px-1">Perubahan jumlah barang rental langsung tersimpan.</p>}
        </div>
      )}

      {isOwner && jajananDisembunyikan && (
        <Card>
          <div className="flex items-start gap-2.5 text-footnote leading-snug text-label-2">
            <EyeOff className="w-4 h-4 mt-0.5 shrink-0 text-label-3" />
            <span>Stok jajanan disembunyikan karena tabel <b className="text-label">Pemasukan Jajanan</b> dimatikan di Pengaturan › Tampilkan Tabel di Pembukuan.</span>
          </div>
        </Card>
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

  const input = "w-full h-11 px-3.5 rounded-field bg-fill text-[16px] sm:text-subhead font-medium text-label placeholder:text-label-3 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35";
  return (
    <Sheet
      open
      onClose={() => !saving && onClose()}
      title="Tambah Barang Rental"
      size="sm"
      variant="grouped"
      zClassName="z-[320]"
      footer={
        <Button variant="filled" size="lg" block loading={saving} disabled={!bisa} onClick={simpan}>
          {saving ? "Menyimpan…" : "Simpan barang"}
        </Button>
      }
    >
      <Card bodyClassName="space-y-3">
        <label className="block">
          <span className="block text-caption font-semibold uppercase tracking-[0.04em] text-label-2 mb-1.5">Kategori</span>
          <select value={kat} onChange={(e) => setKat(e.target.value)} className={input}>
            {kategori.map((k) => <option key={k} value={k}>{labelKategoriRental(k)}</option>)}
            <option value={BARU}>+ Kategori baru</option>
          </select>
        </label>
        {kat === BARU && (
          <input value={katBaru} onChange={(e) => setKatBaru(e.target.value)} placeholder="Nama kategori baru, mis. ALAT KEBERSIHAN" className={`${input} uppercase`} />
        )}
        <label className="block">
          <span className="block text-caption font-semibold uppercase tracking-[0.04em] text-label-2 mb-1.5">Nama barang</span>
          <input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Mis. Kopi Susu" className={input} onKeyDown={(e) => e.key === "Enter" && simpan()} />
        </label>
      </Card>
    </Sheet>
  );
};

export default StokRental;
