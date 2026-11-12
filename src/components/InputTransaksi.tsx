import React, { useMemo, useState } from "react";
import { ChevronDown, Package } from "lucide-react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { rupiah } from "../lib/format";
import { toLocalYmd } from "../lib/dateLocal";
import { Bisnis, bisnisOf, JenisTransaksi, KOLEKSI, TransaksiOwner } from "../lib/keuangan";
import SubTabs from "./common/SubTabs";
import RupiahIcon from "./common/RupiahIcon";

const TEMA = {
  PENGELUARAN: {
    judul: "Input Pengeluaran",
    angka: "text-rose-500",
    aksen: "text-purple-600 dark:text-purple-400",
    tombol: "bg-purple-600 hover:bg-purple-700 shadow-purple-500/20",
    chip: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200/50 dark:border-purple-500/20",
    chipAktif: "bg-purple-600 text-white border-purple-600 dark:bg-purple-500 dark:border-purple-500",
    contohNama: "Contoh: Bayar Wi-Fi",
    contohKat: "Ketik kategori pengeluaran...",
  },
  PEMASUKAN: {
    judul: "Input Pemasukan",
    angka: "text-emerald-600 dark:text-emerald-400",
    aksen: "text-emerald-600 dark:text-emerald-400",
    tombol: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20",
    chip: "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-500/20",
    chipAktif: "bg-emerald-600 text-white border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500",
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
const InputTransaksi: React.FC<{ jenis: JenisTransaksi; items: TransaksiOwner[] }> = ({ jenis, items }) => {
  const t = TEMA[jenis];
  const label = jenis === "PENGELUARAN" ? "Pengeluaran" : "Pemasukan";
  const [tab, setTab] = useState<Bisnis>("RENTAL");
  const [form, setForm] = useState(kosong("RENTAL"));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [kategoriAuto, setKategoriAuto] = useState(false);
  const [bukaBulan, setBukaBulan] = useState<string[]>([]);
  const [bukaKat, setBukaKat] = useState<string[]>([]);

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
    try {
      const data = { nama: form.nama.trim(), harga: nominal, kategori: form.kategori.trim() || "Lainnya", tanggal: form.tanggal, bisnis: form.bisnis };
      if (editingId) await updateDoc(doc(db, KOLEKSI[jenis], editingId), data);
      else await addDoc(collection(db, KOLEKSI[jenis]), { ...data, timestamp: Date.now() });
      setTab(form.bisnis);
      setEditingId(null);
      setKategoriAuto(false);
      setForm(kosong(form.bisnis));
    } catch (e: any) {
      alert(`Gagal menyimpan ${label.toLowerCase()}: ` + (e?.message || e));
    }
    setSaving(false);
  };
  const edit = (o: TransaksiOwner) => {
    setForm({ nama: o.nama, harga: String(o.harga), kategori: o.kategori, tanggal: o.tanggal, bisnis: bisnisOf(o) });
    setEditingId(o.id);
    setKategoriAuto(false);
    document.getElementById(`input-${jenis.toLowerCase()}-section`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const hapus = async (o: TransaksiOwner) => {
    if (!confirm(`Hapus ${label.toLowerCase()} "${o.nama}"?`)) return;
    try { await deleteDoc(doc(db, KOLEKSI[jenis], o.id)); } catch (e: any) { alert("Gagal menghapus: " + (e?.message || e)); }
  };
  const batal = () => { setEditingId(null); setKategoriAuto(false); setForm(kosong(form.bisnis)); };

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

  const input = "bg-zinc-50 dark:bg-black rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-800 text-sm font-bold w-full";
  const lbl = "text-xs font-bold text-zinc-500 uppercase";

  return (
    <div className="space-y-4">
      <div id={`input-${jenis.toLowerCase()}-section`} className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 sm:p-6 border border-zinc-200 dark:border-white/10 shadow-sm">
        <h2 className={`text-xl font-black mb-5 flex items-center gap-2 ${t.aksen}`}>
          <RupiahIcon /> {editingId ? `Edit ${label}` : t.judul}
        </h2>
        <div className="grid grid-cols-1 gap-4 mb-5">
          <div className="flex flex-col gap-2">
            <label className={lbl}>Untuk usaha</label>
            <SubTabs<Bisnis>
              value={form.bisnis}
              onChange={(b) => setForm((f) => ({ ...f, bisnis: b }))}
              options={[{ key: "RENTAL", label: "Rental" }, { key: "USAHA", label: "Usaha" }]}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className={lbl}>Tanggal</label>
            <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} className={`${input} custom-date-input`} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={lbl}>Nominal {label}</label>
            <input type="text" inputMode="numeric" value={form.harga === "" ? "" : rupiah(nominal)} onChange={(e) => setForm({ ...form, harga: e.target.value })} className={input} placeholder="Rp 0" />
          </div>
          <div className="flex flex-col gap-2">
            <label className={lbl}>Nama {label}</label>
            <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className={input} placeholder={t.contohNama} />
            {saranNama.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {saranNama.map((n) => (
                  <button key={n} type="button" onClick={() => pilihNama(n)} className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors border active:scale-95 ${t.chip}`}>{n}</button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className={`${lbl} flex items-center gap-2`}>
              Kategori
              {kategoriAuto && form.kategori && <span className={`normal-case px-2 py-0.5 rounded-md text-[10px] font-bold border ${t.chip}`}>Otomatis dari riwayat</span>}
            </label>
            <input type="text" value={form.kategori} onChange={(e) => { setKategoriAuto(false); setForm({ ...form, kategori: e.target.value }); }} className={input} placeholder={t.contohKat} />
            {saranKategori.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {saranKategori.map((c) => (
                  <button key={c} type="button" onClick={() => { setKategoriAuto(false); setForm({ ...form, kategori: c }); }}
                    className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors border active:scale-95 ${c.toLowerCase() === form.kategori.trim().toLowerCase() ? t.chipAktif : "bg-zinc-100 hover:bg-zinc-200 dark:bg-[#2C2C2E] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 border-zinc-200/50 dark:border-white/5"}`}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button disabled={saving || !form.nama.trim() || !nominal} onClick={simpan} className={`flex-1 disabled:opacity-50 text-white font-bold rounded-xl py-3.5 shadow-lg transition-all active:scale-95 ${t.tombol}`}>
            {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : `Simpan ${label}`}
          </button>
          {editingId && (
            <button onClick={batal} className="px-6 bg-zinc-200 hover:bg-zinc-300 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl py-3.5 transition-all active:scale-95">Batal</button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 sm:p-6 border border-zinc-200 dark:border-white/10 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-3 uppercase tracking-wider">Histori {label}</h3>
        <SubTabs<Bisnis>
          className="mb-4"
          value={tab}
          onChange={setTab}
          options={[
            { key: "RENTAL", label: `${label} Rental`, count: perUsaha.RENTAL.length },
            { key: "USAHA", label: `${label} Usaha`, count: perUsaha.USAHA.length },
          ]}
        />
        <div className="flex flex-col gap-3">
          {bulanan.length === 0 && <p className="text-center text-sm text-zinc-500 py-6">Belum ada {label.toLowerCase()} {tab === "RENTAL" ? "rental" : "usaha"} pada periode ini.</p>}
          {bulanan.map(([bk, list]) => {
            const buka = bukaBulan.includes(`${tab}-${bk}`);
            const total = list.reduce((s, o) => s + o.harga, 0);
            const perKat = Array.from(
              list.reduce((m, o) => m.set(o.kategori || "Lainnya", [...(m.get(o.kategori || "Lainnya") || []), o]), new Map<string, TransaksiOwner[]>())
            ).sort((a, b) => b[1].reduce((s, x) => s + x.harga, 0) - a[1].reduce((s, x) => s + x.harga, 0));
            return (
              <div key={bk} className="bg-zinc-50 dark:bg-[#18181A] rounded-[20px] overflow-hidden border border-zinc-200 dark:border-white/5">
                <button type="button" onClick={() => toggle(bukaBulan, setBukaBulan, `${tab}-${bk}`)} className="w-full flex items-center justify-between p-4 text-left active:bg-zinc-100 dark:active:bg-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`p-2 rounded-xl border shrink-0 ${buka ? "bg-white dark:bg-[#2C2C2E] border-zinc-300 dark:border-white/10" : "bg-white dark:bg-[#2C2C2E] border-zinc-200 dark:border-white/5"} text-zinc-500`}>
                      <ChevronDown className={`w-5 h-5 transition-transform ${buka ? "rotate-180" : ""}`} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">Bulan <span className={t.aksen}>{bk}</span></div>
                      <div className="text-[11px] font-bold text-zinc-400 mt-0.5">{list.length} Transaksi</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 pl-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Total</div>
                    <div className={`text-base sm:text-lg font-black whitespace-nowrap tabular-nums ${t.angka}`}>{rupiah(total)}</div>
                  </div>
                </button>
                {buka && (
                  <div className="flex flex-col gap-3 p-3 pt-1 bg-zinc-100/50 dark:bg-black/20 border-t border-zinc-200 dark:border-white/5">
                    {perKat.map(([kat, kl]) => {
                      const kk = `${tab}-${bk}-${kat}`;
                      const bukaK = bukaKat.includes(kk);
                      return (
                        <div key={kk} className="bg-white dark:bg-[#1C1C1E] border border-zinc-200/60 dark:border-white/5 rounded-[16px] overflow-hidden shadow-sm">
                          <button type="button" onClick={() => toggle(bukaKat, setBukaKat, kk)} className="w-full flex items-center justify-between p-3 text-left active:bg-zinc-50 dark:active:bg-white/5">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="p-1.5 rounded-lg border shrink-0 bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-[#2C2C2E] dark:border-white/5"><ChevronDown className={`w-4 h-4 transition-transform ${bukaK ? "rotate-180" : ""}`} /></span>
                              <div className="min-w-0">
                                <div className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 truncate">{kat}</div>
                                <div className="text-[10px] font-semibold text-zinc-400">{kl.length} Transaksi</div>
                              </div>
                            </div>
                            <div className={`text-[14px] font-black whitespace-nowrap tabular-nums shrink-0 pl-2 ${t.angka}`}>{rupiah(kl.reduce((s, x) => s + x.harga, 0))}</div>
                          </button>
                          {bukaK && (
                            <div className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-[#18181A] border-t border-zinc-200/60 dark:border-white/5">
                              {kl.map((o) => (
                                <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-[#1C1C1E] border border-zinc-200/60 dark:border-white/5 p-3 rounded-xl gap-3 shadow-sm">
                                  <div className="min-w-0">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{o.tanggal}</div>
                                    <div className="text-[13px] font-bold text-zinc-900 dark:text-white leading-tight break-words">{o.nama}</div>
                                  </div>
                                  <div className="flex items-center justify-between sm:justify-end gap-3">
                                    <div className={`text-[14px] font-black whitespace-nowrap ${t.angka}`}>{rupiah(o.harga)}</div>
                                    {o.sumber === "input_stok" ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-white/10 px-2 py-1.5 rounded-lg" title="Ubah lewat Input › Stok Jualan › Riwayat stok masuk">
                                        <Package className="w-3 h-3" />Dari stok masuk
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => edit(o)} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 px-2 py-1.5 rounded-lg border border-blue-100 dark:border-blue-500/20 active:scale-95">Edit</button>
                                        <button onClick={() => hapus(o)} className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 px-2 py-1.5 rounded-lg border border-red-100 dark:border-red-500/20 active:scale-95">Hapus</button>
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
        {tab === "USAHA" && jenis === "PENGELUARAN" && (
          <p className="mt-3 text-[12px] text-zinc-400 leading-snug">Pengeluaran “Dari stok masuk” diubah / dihapus lewat Input › Stok Jualan › Edit Barang › Riwayat stok masuk, supaya stok ikut sinkron.</p>
        )}
      </div>
    </div>
  );
};

export default InputTransaksi;
