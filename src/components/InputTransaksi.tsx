import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Package, Trash2 } from "lucide-react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { rupiah, formatRibuanInput } from "../lib/format";
import { toLocalYmd } from "../lib/dateLocal";
import { Bisnis, bisnisOf, JenisTransaksi, KOLEKSI, TransaksiOwner } from "../lib/keuangan";
import SubTabs from "./common/SubTabs";
import RupiahIcon from "./common/RupiahIcon";
import StokMasukSheet from "./StokMasukSheet";
import { ambilStokMasuk, StokMasuk, useProdukJualan } from "../lib/barangJualan";
import { AlertDialog, Button, Card, EmptyState, Footnote, Notice, Pill } from "../ui";

const TEMA = {
  PENGELUARAN: {
    judul: "Input Pengeluaran",
    angka: "text-negative",
    iconColor: "red" as const,
    pillTone: "tint" as const,
    contohNama: "Contoh: Bayar Wi-Fi",
    contohKat: "Ketik kategori pengeluaran...",
  },
  PEMASUKAN: {
    judul: "Input Pemasukan",
    angka: "text-positive",
    iconColor: "green" as const,
    pillTone: "positive" as const,
    contohNama: "Contoh: Tambahan modal owner",
    contohKat: "Ketik kategori pemasukan...",
  },
} as const;

const kosong = (bisnis: Bisnis) => ({ nama: "", harga: "", kategori: "", tanggal: toLocalYmd(), bisnis });
const bulanKey = (tanggal: string) => {
  const d = new Date(tanggal);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
};

/**
 * Form + histori transaksi owner (PENGELUARAN / PEMASUKAN) — satu komponen untuk keduanya (SSOT).
 * Histori dipisah per model usaha: RENTAL dan USAHA.
 */
const InputTransaksi: React.FC<{ jenis: JenisTransaksi; items: TransaksiOwner[]; onJenisChange?: (j: JenisTransaksi) => void }> = ({ jenis, items, onJenisChange }) => {
  const t = TEMA[jenis];
  const label = jenis === "PENGELUARAN" ? "Pengeluaran" : "Pemasukan";
  const [tab, setTab] = useState<Bisnis>("RENTAL");
  const [form, setForm] = useState(kosong("RENTAL"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [kategoriAuto, setKategoriAuto] = useState(false);
  const [bukaBulan, setBukaBulan] = useState<string[]>([]);
  const [bukaKat, setBukaKat] = useState<string[]>([]);
  // Histori ikut usaha yang dipilih di form (Untuk usaha: Rental / Usaha)
  useEffect(() => { setTab(form.bisnis); }, [form.bisnis]);

  // Pengeluaran "Dari stok masuk": dibuka di lembar stok masuk supaya stok & pengeluaran tetap sinkron
  const { products } = useProdukJualan();
  const [stokMasuk, setStokMasuk] = useState<StokMasuk | null>(null);
  const [hapusTarget, setHapusTarget] = useState<{ o: TransaksiOwner; missingStok?: boolean } | null>(null);
  const [hapusBusy, setHapusBusy] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const tampilToast = (m: string) => {
    setToast(m);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  };
  const bukaStokMasuk = async (o: TransaksiOwner) => {
    try {
      const rec = o.stokMasukId ? await ambilStokMasuk(o.stokMasukId) : null;
      if (rec) { setStokMasuk(rec); return; }
      setHapusTarget({ o, missingStok: true });
    } catch (e: any) { tampilToast("Gagal membuka stok masuk: " + (e?.message || e)); }
  };

  // Ganti Pengeluaran <-> Pemasukan: kosongkan isian, pertahankan usaha & tanggal yang dipilih
  const jenisAwal = useRef(jenis);
  useEffect(() => {
    if (jenisAwal.current === jenis) return;
    jenisAwal.current = jenis;
    setEditingId(null);
    setKategoriAuto(false);
    setBukaBulan([]);
    setBukaKat([]);
    setForm((f) => ({ ...kosong(f.bisnis), tanggal: f.tanggal }));
  }, [jenis]);

  // Saran nama & kategori dari riwayat manual (bukan yang dibuat otomatis oleh stok masuk)
  const manual = useMemo(() => items.filter((o) => o.sumber !== "input_stok"), [items]);
  // Saran mengikuti usaha yang dipilih (Rental / Usaha); usaha baru tanpa riwayat -> pakai semua
  const manualBisnis = useMemo(() => {
    const x = manual.filter((o) => bisnisOf(o) === form.bisnis);
    return x.length ? x : manual;
  }, [manual, form.bisnis]);
  const saranNama = useMemo(() => {
    const c = new Map<string, number>();
    manualBisnis.forEach((e) => e.nama && c.set(e.nama.trim(), (c.get(e.nama.trim()) || 0) + 1));
    let arr = Array.from(c.entries()).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const q = form.nama.trim().toLowerCase();
    if (q) arr = Array.from(new Set(manual.map((e) => (e.nama || "").trim()))).filter((x) => x && x.toLowerCase().includes(q));
    return arr.slice(0, 10);
  }, [manual, manualBisnis, form.nama]);
  const saranKategori = useMemo(() => {
    const c = new Map<string, number>();
    manualBisnis.forEach((e) => e.kategori && c.set(e.kategori.trim(), (c.get(e.kategori.trim()) || 0) + 1));
    let arr = Array.from(c.entries()).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    const q = form.kategori.trim().toLowerCase();
    if (q) arr = Array.from(new Set(manual.map((e) => (e.kategori || "").trim()))).filter((x) => x && x.toLowerCase().includes(q));
    return arr;
  }, [manual, manualBisnis, form.kategori]);
  // Nama -> kategori & usaha yang paling sering dipakai (seri: paling baru; "Lainnya" hanya bila tak ada lain)
  const ingatan = useMemo(() => {
    const stats = new Map<string, Map<string, { kat: string; bisnis: Bisnis; count: number; last: number }>>();
    manual.forEach((e) => {
      const nk = (e.nama || "").trim().toLowerCase();
      const kat = (e.kategori || "").trim();
      if (!nk || !kat) return;
      const ts = Number(e.timestamp) || Date.parse(e.tanggal) || 0;
      if (!stats.has(nk)) stats.set(nk, new Map());
      const per = stats.get(nk)!;
      const cur = per.get(kat.toLowerCase());
      if (cur) { cur.count++; if (ts >= cur.last) { cur.last = ts; cur.kat = kat; cur.bisnis = bisnisOf(e); } }
      else per.set(kat.toLowerCase(), { kat, bisnis: bisnisOf(e), count: 1, last: ts });
    });
    const out = new Map<string, { kat: string; bisnis: Bisnis }>();
    stats.forEach((per, nk) => {
      const ranked = Array.from(per.entries()).sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last);
      const best = ranked.find(([k]) => k !== "lainnya") || ranked[0];
      if (best) out.set(nk, { kat: best[1].kat, bisnis: best[1].bisnis });
    });
    return out;
  }, [manual]);

  const pilihNama = (n: string) => {
    const m = ingatan.get(n.trim().toLowerCase());
    setForm((f) => ({ ...f, nama: n, kategori: m?.kat ?? f.kategori, bisnis: m?.bisnis ?? f.bisnis }));
    setKategoriAuto(!!m);
  };

  const nominal = parseInt(form.harga.replace(/\D/g, "") || "0", 10);
  const simpan = async () => {
    if (!form.nama.trim() || !nominal || !form.tanggal) return;
    setSaving(true);
    setFormErr("");
    try {
      const data = { nama: form.nama.trim(), harga: nominal, kategori: form.kategori.trim() || "Lainnya", tanggal: form.tanggal, bisnis: form.bisnis };
      if (editingId) await updateDoc(doc(db, KOLEKSI[jenis], editingId), data);
      else await addDoc(collection(db, KOLEKSI[jenis]), { ...data, timestamp: Date.now() });
      tampilToast(editingId ? `${label} diperbarui` : `${label} disimpan`);
      setEditingId(null);
      setKategoriAuto(false);
      setForm(kosong(form.bisnis));
    } catch (e: any) {
      setFormErr(`Gagal menyimpan ${label.toLowerCase()}: ` + (e?.message || e));
    }
    setSaving(false);
  };
  const edit = (o: TransaksiOwner) => {
    setFormErr("");
    setForm({ nama: o.nama, harga: String(o.harga), kategori: o.kategori, tanggal: o.tanggal, bisnis: bisnisOf(o) });
    setEditingId(o.id);
    setKategoriAuto(false);
    document.getElementById(`input-${jenis.toLowerCase()}-section`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const hapus = (o: TransaksiOwner) => setHapusTarget({ o });
  const konfirmasiHapus = async () => {
    if (!hapusTarget) return;
    setHapusBusy(true);
    try {
      await deleteDoc(doc(db, KOLEKSI[jenis], hapusTarget.o.id));
      tampilToast(hapusTarget.missingStok ? "Pengeluaran dihapus" : `${label} dihapus`);
      setHapusTarget(null);
    } catch (e: any) {
      tampilToast("Gagal menghapus: " + (e?.message || e));
    } finally {
      setHapusBusy(false);
    }
  };
  const batal = () => { setFormErr(""); setEditingId(null); setKategoriAuto(false); setForm(kosong(form.bisnis)); };

  // Histori per usaha -> per bulan -> per kategori
  const perUsaha = { RENTAL: items.filter((o) => bisnisOf(o) === "RENTAL"), USAHA: items.filter((o) => bisnisOf(o) === "USAHA") };
  const bulanan = useMemo(() => {
    const m = new Map<string, TransaksiOwner[]>();
    perUsaha[tab].forEach((o) => { const k = bulanKey(o.tanggal); m.set(k, [...(m.get(k) || []), o]); });
    return Array.from(m.entries()).sort((a, b) => {
      const [m1, y1] = a[0].split("/"); const [m2, y2] = b[0].split("/");
      return y1 !== y2 ? Number(y2) - Number(y1) : Number(m2) - Number(m1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tab]);
  const toggle = (arr: string[], set: (v: string[]) => void, k: string) => set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);

  const inputCls = "w-full h-12 px-3.5 py-0 rounded-field bg-surface-2 border border-sep text-[16px] sm:text-subhead font-medium text-label placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-tint/30";
  const lblCls = "block text-footnote font-medium text-label-2 px-0.5";

  return (
    <div className="space-y-4">
      <div id={`input-${jenis.toLowerCase()}-section`} className="scroll-mt-4">
        <Card
          title={editingId ? `Edit ${label}` : t.judul}
          subtitle={editingId ? "Perbarui catatan transaksi yang dipilih" : undefined}
          icon={<RupiahIcon />}
          iconColor={t.iconColor}
        >
          <div className="grid grid-cols-1 gap-4 mb-5">
            {onJenisChange && !editingId && (
              <div className="flex flex-col gap-1.5">
                <label className={lblCls}>Jenis transaksi</label>
                <SubTabs<JenisTransaksi>
                  ariaLabel="Jenis transaksi"
                  value={jenis}
                  onChange={onJenisChange}
                  options={[
                    { key: "PENGELUARAN", label: "Pengeluaran", tone: "text-negative" },
                    { key: "PEMASUKAN", label: "Pemasukan", tone: "text-positive" },
                  ]}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className={lblCls}>Untuk usaha</label>
              <SubTabs<Bisnis>
                value={form.bisnis}
                onChange={(b) => setForm((f) => ({ ...f, bisnis: b }))}
                options={[{ key: "RENTAL", label: "Rental" }, { key: "USAHA", label: "Usaha" }]}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className={lblCls}>Tanggal</label>
                <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} className={`${inputCls} custom-date-input tabular-nums`} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={lblCls}>Nominal {label}</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[16px] sm:text-subhead font-semibold text-label-3">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.harga === "" ? "" : formatRibuanInput(form.harga, { allowZero: true })}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setForm({ ...form, harga: raw });
                    }}
                    className={`${inputCls} pl-10 tabular-nums font-semibold`}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={lblCls}>Nama {label}</label>
              <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className={inputCls} placeholder={t.contohNama} />
              {saranNama.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {saranNama.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => pilihNama(n)}
                      className="min-h-[34px] px-3 py-1 rounded-full text-caption font-semibold bg-fill hover:bg-surface-2 text-label-2 hover:text-label border border-sep transition-colors active:scale-95"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 px-0.5">
                <label className="text-footnote font-medium text-label-2">Kategori</label>
                {kategoriAuto && form.kategori && <Pill tone={t.pillTone}>Otomatis dari riwayat</Pill>}
              </div>
              <input type="text" value={form.kategori} onChange={(e) => { setKategoriAuto(false); setForm({ ...form, kategori: e.target.value }); }} className={inputCls} placeholder={t.contohKat} />
              {saranKategori.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {saranKategori.map((c) => {
                    const aktif = c.toLowerCase() === form.kategori.trim().toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { setKategoriAuto(false); setForm({ ...form, kategori: c }); }}
                        className={`min-h-[34px] px-3 py-1 rounded-full text-caption font-semibold border transition-colors active:scale-95 ${
                          aktif
                            ? "bg-action text-action-label border-action"
                            : "bg-surface-2 hover:bg-fill text-label-2 hover:text-label border-sep"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {formErr && (
            <Notice tone="negative" className="mb-4">{formErr}</Notice>
          )}

          <div className="flex gap-2.5">
            <Button
              variant="filled"
              size="lg"
              className="flex-1"
              loading={saving}
              disabled={saving || !form.nama.trim() || !nominal}
              onClick={simpan}
            >
              {editingId ? "Simpan Perubahan" : `Simpan ${label}`}
            </Button>
            {editingId && (
              <Button variant="gray" size="lg" onClick={batal}>
                Batal
              </Button>
            )}
          </div>
        </Card>
      </div>

      <Card title={`Histori ${label}`} subtitle={`${perUsaha[tab].length} transaksi tercatat`}>
        <SubTabs<Bisnis>
          className="mb-4"
          value={tab}
          onChange={setTab}
          options={[
            { key: "RENTAL", label: `${label} Rental`, count: perUsaha.RENTAL.length },
            { key: "USAHA", label: `${label} Usaha`, count: perUsaha.USAHA.length },
          ]}
        />

        {bulanan.length === 0 ? (
          <EmptyState title={`Belum ada ${label.toLowerCase()} ${tab === "RENTAL" ? "rental" : "usaha"}`}>
            Tidak ada catatan pada periode ini.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {bulanan.map(([bk, list]) => {
              const buka = bukaBulan.includes(`${tab}-${bk}`);
              const total = list.reduce((s, o) => s + o.harga, 0);
              const perKat = Array.from(
                list.reduce((m, o) => m.set(o.kategori || "Lainnya", [...(m.get(o.kategori || "Lainnya") || []), o]), new Map<string, TransaksiOwner[]>())
              ).sort((a, b) => b[1].reduce((s, x) => s + x.harga, 0) - a[1].reduce((s, x) => s + x.harga, 0));
              return (
                <div key={bk} className="rounded-tile apple-tile border border-sep overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(bukaBulan, setBukaBulan, `${tab}-${bk}`)}
                    className="w-full flex items-center justify-between gap-3 p-3.5 text-left transition-colors active:bg-fill/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-control bg-surface border border-sep flex items-center justify-center text-label-2 shrink-0">
                        <ChevronDown className={`w-4 h-4 transition-transform ${buka ? "rotate-180" : ""}`} />
                      </span>
                      <div className="min-w-0">
                        <div className="text-subhead font-semibold text-label">
                          Bulan <span className="tabular-nums font-bold">{bk}</span>
                        </div>
                        <div className="text-caption text-label-3">{list.length} transaksi</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <div className="text-caption2 font-semibold uppercase tracking-wider text-label-3">Total</div>
                      <div className={`text-headline font-bold whitespace-nowrap tabular-nums ${t.angka}`}>{rupiah(total)}</div>
                    </div>
                  </button>
                  {buka && (
                    <div className="flex flex-col gap-2.5 p-3 border-t border-sep bg-canvas/50">
                      {perKat.map(([kat, kl]) => {
                        const kk = `${tab}-${bk}-${kat}`;
                        const bukaK = bukaKat.includes(kk);
                        return (
                          <div key={kk} className="rounded-tile apple-tile border border-sep overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggle(bukaKat, setBukaKat, kk)}
                              className="w-full flex items-center justify-between gap-3 p-3 text-left transition-colors active:bg-fill/60"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="w-7 h-7 rounded-control bg-surface-2 border border-sep flex items-center justify-center text-label-2 shrink-0">
                                  <ChevronDown className={`w-4 h-4 transition-transform ${bukaK ? "rotate-180" : ""}`} />
                                </span>
                                <div className="min-w-0">
                                  <div className="text-subhead font-semibold text-label truncate">{kat}</div>
                                  <div className="text-caption text-label-3">{kl.length} transaksi</div>
                                </div>
                              </div>
                              <div className={`text-subhead font-bold whitespace-nowrap tabular-nums shrink-0 pl-2 ${t.angka}`}>
                                {rupiah(kl.reduce((s, x) => s + x.harga, 0))}
                              </div>
                            </button>
                            {bukaK && (
                              <div className="divide-y divide-sep border-t border-sep">
                                {kl.map((o) => (
                                  <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3.5 py-3">
                                    <div className="min-w-0">
                                      <div className="text-caption font-medium text-label-3 tabular-nums">{o.tanggal}</div>
                                      <div className="text-subhead font-semibold text-label leading-snug break-words">{o.nama}</div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                      <div className={`text-subhead font-bold whitespace-nowrap tabular-nums ${t.angka}`}>{rupiah(o.harga)}</div>
                                      {o.sumber === "input_stok" ? (
                                        <Button
                                          variant="gray"
                                          size="sm"
                                          icon={<Package className="w-3.5 h-3.5" />}
                                          onClick={() => bukaStokMasuk(o)}
                                          title="Ubah / hapus stok masuk"
                                        >
                                          Dari stok masuk
                                          <ChevronRight className="w-3.5 h-3.5 -mr-1" />
                                        </Button>
                                      ) : (
                                        <div className="flex items-center gap-1.5">
                                          <Button variant="tinted" size="sm" onClick={() => edit(o)}>Edit</Button>
                                          <Button variant="destructive" size="sm" onClick={() => hapus(o)}>Hapus</Button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "USAHA" && jenis === "PENGELUARAN" && (
          <Footnote className="mt-3">
            Ketuk “Dari stok masuk” untuk mengubah jumlah, modal, atau menghapus belanja stok — jumlah stok ikut sinkron.
          </Footnote>
        )}
      </Card>

      {stokMasuk && (
        <StokMasukSheet
          rec={stokMasuk}
          produkDihapus={!products.some((p) => p.id === stokMasuk.produkId)}
          onClose={() => setStokMasuk(null)}
          onDone={(m) => { setStokMasuk(null); tampilToast(m); }}
        />
      )}

      <AlertDialog
        open={!!hapusTarget}
        onClose={() => !hapusBusy && setHapusTarget(null)}
        title={hapusTarget?.missingStok ? "Stok masuk sudah tidak ada" : `Hapus ${label.toLowerCase()}?`}
        description={
          hapusTarget?.missingStok
            ? `Catatan stok masuk untuk “${hapusTarget.o.nama}” sudah tidak ada. Hapus pengeluaran ini?`
            : `Catatan ${label.toLowerCase()} “${hapusTarget?.o.nama ?? ""}” akan dihapus permanen.`
        }
        icon={<Trash2 />}
        iconColor="red"
        dismissible={!hapusBusy}
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setHapusTarget(null), disabled: hapusBusy },
          { label: hapusBusy ? "Menghapus..." : "Hapus", role: "destructive", onClick: konfirmasiHapus, disabled: hapusBusy },
        ]}
      />

      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(86px+env(safe-area-inset-bottom))] md:bottom-6 z-[400] px-4 py-2.5 rounded-full bg-action text-action-label text-subhead font-medium shadow-float max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
};

export default InputTransaksi;
