/**
 * KONFIRMASI STOK — barang tukar tambah dari nota POS (owner / super admin).
 * Daftar antrean (Atur Stok › chip "Konfirmasi stok") + lembar konfirmasi satu barang:
 * produk dicocokkan otomatis (atau dibuat baru), harga jual ditentukan owner,
 * harga modal otomatis = Modal Sisa Tertahan (Opsi A: HPP keluar − uang pembeli), atau Nilai Tukar Nota (Opsi B).
 */
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Check, ChevronRight, ImageOff, Loader2, Package, Plus, X } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { ModalMap, ProdukJualan, StokMasuk, useSemuaStokMasuk } from "../lib/barangJualan";
import { bayarNota, kondisiProduk, namaJualan, nilaiTukarNota, PILIH_SAAT_CHECKOUT, PosSale, stokRefLabel, StokRef, usePosSales } from "../lib/posSales";
import { cocokProdukSeken, konfirmasiTukarTambah, subKategoriTukar, TukarTambah, tujuanStokBaru } from "../lib/tukarTambah";
import { hitungFifoHppPenjualan, hitungModalTertahan } from "../lib/akuntansiUsaha";
import { persen, rupiah } from "../lib/format";
import { Button, LineItem, LineList, Notice, Pill, SubTabs } from "../ui";

type Data = Record<string, Record<string, StokItemValue>>;

const angka = (s: string) => Math.round(Number(String(s || "").replace(/[^\d]/g, "")) || 0);
const ribuan = (s: string) => {
  const d = String(s || "").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
};
const tgl = (ts: number) => new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const LABEL_SUB: Record<string, string> = { "Unit PS": "Unit konsol", Stik: "Stik", Hardisk: "Hardisk", Aksesoris: "Aksesoris", BD: "Kaset BD" };

const Foto: React.FC<{ url?: string; size?: number; className?: string }> = ({ url, size = 48, className = "" }) => (
  <div className={`shrink-0 rounded-field bg-fill overflow-hidden flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
    {url ? <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Package className="w-5 h-5 text-label-3" />}
  </div>
);

// ============================================================
// Daftar antrean
// ============================================================

export const DaftarKonfirmasiTukar: React.FC<{ list: TukarTambah[]; loading: boolean; onPilih: (t: TukarTambah) => void }> = ({ list, loading, onPilih }) => (
  <section>
    <p className="px-1 pb-2 text-footnote text-label-2 leading-snug">
      Barang dari tukar tambah di Kasir URBAN. Tentukan produk, harga jual &amp; modal barang masuk — stok bertambah setelah dikonfirmasi tanpa pengeluaran kas baru.
    </p>
    <div className="rounded-card apple-card ring-1 ring-edge shadow-card overflow-hidden divide-y divide-sep">
      {loading && <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-label-3" /></div>}
      {!loading && list.length === 0 && <div className="py-10 text-center text-subhead text-label-2">Tidak ada barang yang menunggu konfirmasi 👍</div>}
      {list.map((t) => (
        <button key={t.id} type="button" onClick={() => onPilih(t)} className="w-full min-h-[44px] flex items-center gap-3 px-3.5 py-3 text-left active:bg-fill">
          <Foto url={t.fotoBarang} size={44} />
          <div className="flex-1 min-w-0">
            <div className="text-subhead font-semibold text-label leading-snug line-clamp-2">{t.nama}</div>
            <div className="text-footnote text-label-2 mt-0.5 truncate">{tgl(t.ts)}{t.kasirNama ? ` · ${t.kasirNama}` : ""}</div>
            <div className="text-caption text-label-3 font-mono truncate">{t.noNota}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-footnote font-semibold tabular-nums text-label">{rupiah(t.nilai * (t.qty || 1))}</div>
            <div className="text-caption2 text-label-2">nilai tukar</div>
          </div>
          <ChevronRight className="w-4 h-4 text-label-3 shrink-0" />
        </button>
      ))}
    </div>
  </section>
);

// ============================================================
// Lembar konfirmasi satu barang
// ============================================================

const BARU = "__baru__";

export const KonfirmasiTukarSheet: React.FC<{
  tt: TukarTambah;
  products: ProdukJualan[];
  modalMap: ModalMap;
  stokMasukList?: StokMasuk[];
  cats: StokKategori[];
  data: Data;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ tt, products, modalMap, stokMasukList, cats, data, onClose, onDone }) => {
  useBodyScrollLock(true);
  const kandidat = useMemo(() => cocokProdukSeken(tt.nama, products), [tt.nama, products]);
  const seken = useMemo(() => products.filter((p) => kondisiProduk(p) === "SEKEN").sort((a, b) => a.name.localeCompare(b.name, "id")), [products]);
  const [pilih, setPilih] = useState<string>(() => (kandidat[0]?.yakin ? kandidat[0].produk.id : BARU));
  const produk = pilih === BARU ? null : products.find((p) => p.id === pilih) || null;
  const [namaBaru, setNamaBaru] = useState(tt.nama);
  const qty = Math.max(1, tt.qty || 1);
  const [jualStr, setJualStr] = useState(() => (kandidat[0]?.yakin && kandidat[0].produk.price ? ribuan(String(kandidat[0].produk.price)) : ""));
  const [modalStr, setModalStr] = useState(ribuan(String(tt.nilai)));
  const [modalMode, setModalMode] = useState<"TERTAHAN" | "NILAI_TUKAR" | "MANUAL">("TERTAHAN");
  const [editedModal, setEditedModal] = useState(false);
  const [varian, setVarian] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Baca nota POS asal & histori HPP FIFO agar Opsi A (Modal Sisa Tertahan) dihitung otomatis
  const [saleDoc, setSaleDoc] = useState<PosSale | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    getDoc(doc(db, "pos_transaksi", tt.saleId))
      .then((s) => {
        if (!alive) return;
        setSaleDoc(s.exists() ? ({ id: s.id, ...(s.data() as Omit<PosSale, "id">) }) : null);
      })
      .catch(() => { if (alive) setSaleDoc(null); });
    return () => { alive = false; };
  }, [tt.saleId]);
  const { sales: salesSampaiNota, loading: loadingSales } = usePosSales(0, (tt.ts || Date.now()) + 60000, 3000);
  const { list: stokMasukFallback, loading: loadingMasuk } = useSemuaStokMasuk(!stokMasukList);
  const allMasuk = stokMasukList || stokMasukFallback;

  const infoOpsi = useMemo(() => {
    if (!saleDoc) return null;
    const gabungan = new Map<string, PosSale>();
    salesSampaiNota.forEach((s) => gabungan.set(s.id || s.noNota, s));
    gabungan.set(saleDoc.id || saleDoc.noNota, saleDoc);
    const hppMap = hitungFifoHppPenjualan(Array.from(gabungan.values()), allMasuk, modalMap);
    const hNota = hppMap.get(saleDoc.id || saleDoc.noNota);
    const hppKeluar = hNota?.hppTotal ?? 0;
    const hppLengkap = hNota ? hNota.hppLengkap : false;
    const kasPembeli = bayarNota(saleDoc);
    const totalTertahan = hppLengkap ? hitungModalTertahan(hppKeluar, kasPembeli) : tt.nilai * qty;
    const totalNilaiTt = nilaiTukarNota(saleDoc);
    const jumlahTt = saleDoc.tukarTambah?.length || 1;
    const share = jumlahTt <= 1 ? 1 : totalNilaiTt > 0 ? (tt.nilai * qty) / totalNilaiTt : 1 / jumlahTt;
    const tertahanSatuan = hppLengkap ? Math.max(0, Math.round((totalTertahan * share) / qty)) : tt.nilai;
    return { hppKeluar, hppLengkap, kasPembeli, totalNilaiTt, tertahanSatuan, multiItemTt: jumlahTt > 1 };
  }, [saleDoc, salesSampaiNota, allMasuk, modalMap, tt.nilai, qty]);

  useEffect(() => {
    if (editedModal || modalMode !== "TERTAHAN") return;
    if (infoOpsi?.hppLengkap) setModalStr(ribuan(String(infoOpsi.tertahanSatuan)));
  }, [editedModal, modalMode, infoOpsi]);

  const loadingHitung = saleDoc === undefined || loadingSales || (!stokMasukList && loadingMasuk);

  const pilihProduk = (id: string) => {
    setPilih(id);
    setVarian("");
    setErr("");
    const p = products.find((x) => x.id === id);
    if (p?.price) setJualStr(ribuan(String(p.price)));
  };

  const jual = angka(jualStr);
  const modal = angka(modalStr);
  const untung = jual > 0 ? jual - modal : null;
  const modalLama = produk ? modalMap[produk.id]?.hargaModal ?? null : null;

  // Barang stok tujuan
  const tujuan: { ref: StokRef | null; baru: boolean } = produk
    ? { ref: produk.stokRef || tujuanStokBaru(produk.name, cats)?.ref || null, baru: !produk.stokRef && !!tujuanStokBaru(produk.name, cats)?.baru }
    : (() => { const x = tujuanStokBaru(namaBaru, cats); return { ref: x?.ref || null, baru: !!x?.baru }; })();
  const varianList = tujuan.ref?.item === PILIH_SAAT_CHECKOUT ? cats.find((c) => c.kategori === tujuan.ref!.kategori)?.items || [] : [];
  const jumlahDi = (r: StokRef | null) => (r && r.item !== PILIH_SAAT_CHECKOUT ? Math.max(0, Math.round(Number(data?.[r.kategori]?.[r.item]?.jumlah) || 0)) : null);
  const sekarang = jumlahDi(tujuan.ref);
  const subBaru = subKategoriTukar(namaBaru);

  const simpan = async () => {
    setErr("");
    if (!produk && !namaJualan(namaBaru)) return setErr("Nama produk wajib diisi.");
    if (!(jual > 0)) return setErr("Isi harga jual dulu.");
    if (varianList.length && !varian) return setErr("Pilih varian stok.");
    setSaving(true);
    try {
      const r = await konfirmasiTukarTambah(
        tt,
        { produk, namaBaru, hargaJual: jual, modalSatuan: modal, modalMode, varian: varian || undefined },
        products,
        modalMap,
        (x) => data?.[x.kategori]?.[x.item]?.jumlah
      );
      onDone(`Stok ${r.stokRef.item} +${qty} · ${produk ? "produk diperbarui" : "produk baru dibuat"}`);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setSaving(false);
    }
  };

  const rowPilih = (id: string, isi: React.ReactNode, aktif: boolean) => (
    <button key={id} type="button" onClick={() => pilihProduk(id)} aria-pressed={aktif}
      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-fill">
      {isi}
      <span className={`shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center ${aktif ? "bg-tint text-white" : "ring-[1.5px] ring-inset ring-sep"}`}>
        {aktif && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </span>
    </button>
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center font-sans">
      <div className="absolute inset-0 bg-black/45 dark:bg-black/70 backdrop-blur-[8px]" onClick={() => !saving && onClose()} />
      <div className="relative w-full sm:max-w-md apple-sheet-grouped border border-white/50 dark:border-white/[0.12] rounded-t-sheet sm:rounded-[32px] max-h-[94vh] flex flex-col overflow-hidden shadow-float">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-sep" /></div>
        <div className="px-4 pt-2 pb-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-title3 font-bold text-label leading-tight">Konfirmasi stok</h3>
            <p className="text-footnote text-label-2 truncate">Tukar tambah · {tt.noNota}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Tutup" className="w-11 h-11 rounded-full bg-fill flex items-center justify-center text-label-2 hover:text-label active:opacity-70"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
          {/* Barang dari pembeli */}
          <div className="rounded-card apple-card ring-1 ring-edge shadow-card p-3.5">
            <div className="grid grid-cols-2 gap-2">
              {[{ l: "Barang", u: tt.fotoBarang }, { l: "Nomor seri", u: tt.fotoSn }].map((f) => (
                <a key={f.l} href={f.u || undefined} target="_blank" rel="noreferrer" className="relative aspect-[4/3] rounded-tile overflow-hidden bg-fill flex items-center justify-center">
                  {f.u ? <img src={f.u} alt={`Foto ${f.l.toLowerCase()}`} className="absolute inset-0 w-full h-full object-cover" /> : <ImageOff className="w-5 h-5 text-label-3" />}
                  <span className="absolute left-1.5 bottom-1.5 rounded-full bg-black/60 px-2 py-0.5 text-caption2 font-semibold text-white">{f.l}</span>
                </a>
              ))}
            </div>
            <div className="mt-3 text-headline font-semibold text-label leading-snug">{tt.nama}</div>
            <LineList className="mt-1">
              <LineItem label="Nomor seri" value={<span className="font-mono">{tt.sn || "-"}</span>} />
              <LineItem label="Nilai tukar tambah" value={rupiah(tt.nilai * qty)} note={qty > 1 ? `${qty} × ${rupiah(tt.nilai)}` : undefined} />
              <LineItem label="Pembeli" value={tt.pembeli || "Pelanggan"} note={tt.pembeliWa || undefined} />
              <LineItem label="Kasir" value={tt.kasirNama || tt.kasir.split("@")[0]} note={tgl(tt.ts)} />
            </LineList>
            {tt.catatan && <p className="pt-2 border-t border-sep text-footnote text-label-2">Catatan kasir: <span className="text-label">{tt.catatan}</span></p>}
          </div>

          {/* Produk tujuan */}
          <div>
            <h4 className="px-4 pb-1.5 text-caption font-semibold uppercase tracking-[0.04em] text-label-2">Masuk ke produk</h4>
            <div className="rounded-card apple-card ring-1 ring-edge shadow-card overflow-hidden divide-y divide-sep">
              {kandidat.map((k) =>
                rowPilih(
                  k.produk.id,
                  <>
                    <Foto url={k.produk.imageUrl} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-subhead font-semibold text-label leading-snug line-clamp-2">{k.produk.name}</div>
                      <div className="text-caption text-label-2 tabular-nums">
                        {rupiah(k.produk.price)} · stok {jumlahDi(k.produk.stokRef || null) ?? "?"}
                      </div>
                    </div>
                    {k.yakin && <Pill tone="positive">Cocok</Pill>}
                  </>,
                  pilih === k.produk.id
                )
              )}
              {produk && !kandidat.some((k) => k.produk.id === produk.id) &&
                rowPilih(
                  produk.id,
                  <>
                    <Foto url={produk.imageUrl} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="text-subhead font-semibold text-label leading-snug line-clamp-2">{produk.name}</div>
                      <div className="text-caption text-label-2 tabular-nums">{rupiah(produk.price)}</div>
                    </div>
                  </>,
                  true
                )}
              {rowPilih(
                BARU,
                <>
                  <span className="shrink-0 w-10 h-10 rounded-field bg-tint/10 text-tint flex items-center justify-center"><Plus className="w-5 h-5" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-subhead font-semibold text-label">Produk baru</div>
                    <div className="text-caption text-label-2">{kandidat.length ? "Bila belum ada yang sama persis" : "Belum ada produk seken yang mirip"}</div>
                  </div>
                </>,
                pilih === BARU
              )}
              <label className="relative flex items-center gap-3 px-3.5 h-11">
                <span className="text-subhead text-tint flex-1">Pilih produk seken lain…</span>
                <ChevronRight className="w-4 h-4 text-label-3" />
                <select value="" onChange={(e) => e.target.value && pilihProduk(e.target.value)} aria-label="Pilih produk seken lain" className="absolute inset-0 opacity-0 cursor-pointer text-[16px]">
                  <option value="">Pilih produk…</option>
                  {seken.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Detail produk & stok */}
          <div className="rounded-card apple-card ring-1 ring-edge shadow-card p-3.5 space-y-3">
            {!produk && (
              <label className="block">
                <span className="text-footnote font-semibold text-label-2">Nama produk</span>
                <input value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} autoCapitalize="characters"
                  className="mt-1 w-full h-12 px-3.5 rounded-field bg-fill text-[16px] font-semibold text-label uppercase focus:outline-none focus:ring-2 focus:ring-tint/30" />
                <span className="mt-1 block text-caption text-label-2">{LABEL_SUB[subBaru] || subBaru} · Seken · foto barang dipakai sebagai foto produk</span>
              </label>
            )}
            <div className="flex items-start gap-3 rounded-tile bg-fill/60 px-3.5 py-2.5">
              <ArrowLeftRight className="w-4 h-4 mt-0.5 shrink-0 text-tint" />
              <div className="min-w-0 flex-1 text-footnote">
                <div className="text-label-2">Stok tujuan</div>
                <div className="font-semibold text-label leading-snug">{tujuan.ref ? stokRefLabel(tujuan.ref) : "—"}</div>
                <div className="text-label-2 tabular-nums">
                  {tujuan.baru ? `Barang stok baru · 0 → ${qty}` : sekarang !== null ? `${sekarang} → ${sekarang + qty}` : varianList.length ? "Pilih varian di bawah" : ""}
                </div>
              </div>
            </div>
            {varianList.length > 0 && (
              <select value={varian} onChange={(e) => { setVarian(e.target.value); setErr(""); }} aria-label="Varian stok"
                className={`w-full h-12 px-3 rounded-field text-[16px] sm:text-subhead font-semibold ${varian ? "bg-fill text-label" : "bg-warning/10 text-label ring-1 ring-warning/40"}`}>
                <option value="">Pilih varian {tujuan.ref?.kategori.toLowerCase()}…</option>
                {varianList.map((it) => <option key={it} value={it}>{it} — stok {Math.max(0, Math.round(Number(data?.[tujuan.ref!.kategori]?.[it]?.jumlah) || 0))}</option>)}
              </select>
            )}
          </div>

          {/* Harga */}
          <div className="rounded-card apple-card ring-1 ring-edge shadow-card p-3.5 space-y-3">
            <label className="block">
              <span className="text-footnote font-semibold text-label-2">Harga jual</span>
              <div className={`mt-1 flex items-center h-12 px-3.5 rounded-field bg-fill ${err && !(jual > 0) ? "ring-2 ring-negative/40" : ""}`}>
                <span className="text-subhead font-semibold text-label-3 mr-1.5">Rp</span>
                <input inputMode="numeric" value={jualStr} onChange={(e) => { setJualStr(ribuan(e.target.value)); setErr(""); }} placeholder="0" aria-label="Harga jual"
                  className="flex-1 min-w-0 bg-transparent text-headline font-bold tabular-nums text-label focus:outline-none" />
              </div>
              {produk && produk.price > 0 && jual !== produk.price && jual > 0 && (
                <span className="mt-1 block text-caption text-label-2">Harga produk sekarang {rupiah(produk.price)} — ikut berubah untuk semua stok produk ini.</span>
              )}
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-footnote font-semibold text-label-2">Harga modal / barang</span>
                {loadingHitung && <span className="text-caption text-label-3">Menghitung modal…</span>}
              </div>
              <SubTabs<"TERTAHAN" | "NILAI_TUKAR">
                size="sm"
                value={modalMode === "NILAI_TUKAR" ? "NILAI_TUKAR" : "TERTAHAN"}
                onChange={(m) => {
                  setEditedModal(false);
                  setModalMode(m);
                  if (m === "NILAI_TUKAR") setModalStr(ribuan(String(tt.nilai)));
                  else if (infoOpsi?.hppLengkap) setModalStr(ribuan(String(infoOpsi.tertahanSatuan)));
                }}
                ariaLabel="Cara hitung modal barang masuk"
                options={[
                  { key: "TERTAHAN", label: "Modal tertahan" },
                  { key: "NILAI_TUKAR", label: "Nilai tukar nota" },
                ]}
              />
              <label className="block">
                <div className="flex items-center h-12 px-3.5 rounded-field bg-fill">
                  <span className="text-subhead font-semibold text-label-3 mr-1.5">Rp</span>
                  <input
                    inputMode="numeric"
                    value={modalStr}
                    onChange={(e) => {
                      setEditedModal(true);
                      setModalMode("MANUAL");
                      setModalStr(ribuan(e.target.value));
                      setErr("");
                    }}
                    placeholder="0"
                    aria-label="Harga modal"
                    className="flex-1 min-w-0 bg-transparent text-headline font-bold tabular-nums text-label focus:outline-none"
                  />
                </div>
              </label>

              {infoOpsi && infoOpsi.hppLengkap ? (
                <div className="rounded-tile bg-fill/60 px-3.5 py-2.5 space-y-1 text-caption text-label-2 tabular-nums">
                  <div className="flex justify-between gap-2">
                    <span>Modal barang keluar ({tt.noNota})</span>
                    <span className="text-label font-medium">{rupiah(infoOpsi.hppKeluar)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>{infoOpsi.kasPembeli >= 0 ? "Uang dibayar pembeli" : "Uang ditambah URBAN"}</span>
                    <span className="text-label font-medium">
                      {infoOpsi.kasPembeli >= 0 ? `−${rupiah(infoOpsi.kasPembeli)}` : `+${rupiah(Math.abs(infoOpsi.kasPembeli))}`}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 pt-1 border-t border-sep font-semibold text-label">
                    <span>Sisa modal tertahan (Opsi A){infoOpsi.multiItemTt ? " · porsi unit" : ""}</span>
                    <span>{rupiah(infoOpsi.tertahanSatuan)}</span>
                  </div>
                  {modalMode === "NILAI_TUKAR" && (
                    <div className="pt-1 text-label-3 leading-snug">
                      Opsi B (Nilai tukar nota {rupiah(tt.nilai)}) langsung mengakui laba dari selisih harga tukar saat ini; di Analitik tetap aman tanpa pengeluaran kas ganda.
                    </div>
                  )}
                </div>
              ) : !loadingHitung && saleDoc ? (
                <Notice tone="warning">
                  Sebagian barang keluar di nota {tt.noNota} belum punya harga modal, sehingga Modal Sisa Tertahan belum bisa dihitung otomatis. Isi modal barang keluar dulu atau isi modal secara manual.
                </Notice>
              ) : null}

              {modalLama !== null && modalLama !== modal && (
                <span className="block text-caption text-label-2">
                  Modal stok lama {rupiah(modalLama)} — tersimpan terpisah per batch (FIFO), tidak menimpa unit lama.
                </span>
              )}
            </div>

            {untung !== null && (
              <div className="flex items-center justify-between rounded-tile bg-fill/60 px-3.5 py-2.5 text-footnote">
                <span className="text-label-2">Perkiraan untung saat terjual</span>
                <span className={`font-semibold tabular-nums ${untung >= 0 ? "text-positive" : "text-negative"}`}>
                  {untung >= 0 ? "+" : "−"}{rupiah(Math.abs(untung))} · {persen((untung / jual) * 100)}
                </span>
              </div>
            )}
          </div>

          <Notice>Stok bertambah {qty} dan masuk sebagai batch modal {rupiah(modal)}/pcs tanpa pengeluaran kas baru — di Analitik, laba penuh baru diakui saat barang ini terjual nanti.</Notice>
        </div>

        <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] apple-bar border-t border-sep space-y-2">
          {err && <div className="text-footnote font-semibold text-negative bg-negative/10 rounded-field px-3 py-2">{err}</div>}
          <Button size="lg" block disabled={saving} onClick={simpan} icon={saving ? <Loader2 className="animate-spin" /> : <Check />}>
            {saving ? "Menyimpan…" : "Konfirmasi & tambah stok"}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
