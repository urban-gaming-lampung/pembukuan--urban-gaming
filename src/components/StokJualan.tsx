import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Check, Clock, ClipboardPaste, Copy, History, Minus, Plus, Search, ShoppingCart, TrendingUp, X } from "lucide-react";
import useStokData from "../hooks/useStokData";
import { Kondisi, kondisiStok } from "../lib/posSales";
import { useProdukJualan } from "../lib/barangJualan";
import KondisiSwitch from "./KondisiSwitch";
import StokReportPaste from "./StokReportPaste";
import SubTabs from "./common/SubTabs";
import { KartuStok, StatusChip, StepperStok, TileStok, BADGE_STATUS, LABEL_STATUS, DOT_STATUS } from "./common/StokUI";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import {
  ALASAN_LABEL, ALASAN_SHORT, StokAlasan, StokLog, StokRow, StokStatus, buildStokRows, commitStokChanges, defaultMinStok, fmtWaktu, isStale,
  restockText, saveMinStok, shortName, soldMap, useMinStok, useStokLog, STALE_DAYS,
} from "../lib/stokJualan";
import { buildStokReport } from "../lib/stokReport";

/**
 * STOK JUALAN — satu halaman untuk owner & admin (mobile-first):
 * pantau (habis / menipis / aman), ubah jumlah (draft lalu simpan sekali dengan jenis perubahan),
 * tempel / salin laporan WhatsApp, daftar belanja, dan riwayat.
 */
type Filter = "semua" | StokStatus | "cek";
type Draft = { delta: number; setTo?: number };
const keyOf = (r: { kategori: string; item: string }) => `${r.kategori}||${r.item}`;
const STATUS_RANK: Record<StokStatus, number> = { habis: 0, menipis: 1, aman: 2 };
const ALASAN_COLOR: Record<string, string> = {
  masuk: "text-emerald-600 dark:text-emerald-400",
  terjual: "text-blue-600 dark:text-blue-400",
  rusak: "text-red-600 dark:text-red-400",
  koreksi: "text-zinc-500",
};

async function shareOrCopy(text: string, okMsg: string) {
  try {
    if (navigator.share && /android|iphone|ipad/i.test(navigator.userAgent)) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    alert(okMsg);
  } catch (e: any) {
    if (e?.name === "AbortError") return;
    try { await navigator.clipboard.writeText(text); alert(okMsg); } catch { alert(text); }
  }
}

const dayLabel = (ts: number) => {
  const d = new Date(ts), t = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (same(d, t)) return "Hari ini";
  if (same(d, y)) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
};

const LogRow: React.FC<{ l: StokLog; showItem?: boolean }> = ({ l, showItem = true }) => (
  <div className="px-4 py-3 flex items-start gap-3 border-t border-zinc-100 dark:border-white/5 first:border-t-0">
    <div className={`w-12 shrink-0 text-right text-[15px] font-black tabular-nums ${l.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
      {l.delta > 0 ? `+${l.delta}` : l.delta}
    </div>
    <div className="min-w-0 flex-1">
      {showItem && <div className="text-[14px] font-semibold text-zinc-900 dark:text-white truncate">{l.item}</div>}
      <div className="text-[12px] text-zinc-500 truncate">
        <span className={`font-bold ${ALASAN_COLOR[l.alasan] || ""}`}>{ALASAN_SHORT[l.alasan] || l.alasan}</span>
        {" · "}{l.sebelum} → {l.sesudah}{" · "}{shortName(l.oleh)}{" · "}
        {new Date(l.ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":")}
      </div>
      {showItem && <div className="text-[11px] text-zinc-400 truncate">{l.kategori}</div>}
      {l.catatan && <div className="text-[11px] italic text-zinc-500 truncate">“{l.catatan}”</div>}
    </div>
  </div>
);

const StokJualan: React.FC<{ isOwner?: boolean }> = ({ isOwner }) => {
  const { stokState, masterCategories } = useStokData();
  const minMap = useMinStok();
  const { logs, loading: logsLoading } = useStokLog(400);
  const [tab, setTab] = useState<"barang" | "riwayat">("barang");
  const [filter, setFilter] = useState<Filter>("semua");
  const [cari, setCari] = useState("");
  const [selected, setSelected] = useState<StokRow | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);

  // Draft perubahan jumlah (disimpan sekali lewat bar Simpan)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alasan, setAlasan] = useState<StokAlasan | null>(null);
  const [catatanSimpan, setCatatanSimpan] = useState("");
  const [saving, setSaving] = useState(false);
  useBodyScrollLock(sheetOpen);

  const kategoriJualan = Array.isArray(masterCategories?.jualan) ? masterCategories.jualan : [];
  const dataJualan = (stokState?.jualan || {}) as Record<string, Record<string, any>>;

  const { products } = useProdukJualan();
  const [kondisi, setKondisi] = useState<Kondisi>("BARU");
  const rowsAll = useMemo(() => buildStokRows(kategoriJualan, dataJualan, minMap), [kategoriJualan, dataJualan, minMap]);
  // Halaman Baru / Seken (draft di halaman lain tetap ikut tersimpan)
  const kondisiOf = (r: { kategori: string; item: string }) => kondisiStok(r.kategori, r.item, products);
  const rows = useMemo(() => rowsAll.filter((r) => kondisiOf(r) === kondisi), [rowsAll, products, kondisi]); // eslint-disable-line react-hooks/exhaustive-deps
  const kondisiCount = { BARU: rowsAll.filter((r) => kondisiOf(r) === "BARU").length, SEKEN: rowsAll.filter((r) => kondisiOf(r) === "SEKEN").length };
  const sold30 = useMemo(() => soldMap(logs, 30), [logs]);
  const catatanOf = (r: { kategori: string; item: string }) => String(dataJualan?.[r.kategori]?.[r.item]?.catatan || "");

  // ---------- Draft ----------
  const nextQty = (r: StokRow) => {
    const d = drafts[keyOf(r)];
    if (!d) return r.jumlah;
    return Math.max(0, (typeof d.setTo === "number" ? d.setTo : r.jumlah) + d.delta);
  };
  const bump = (r: StokRow, step: number) =>
    setDrafts((prev) => {
      const k = keyOf(r);
      const cur = prev[k] || { delta: 0 };
      const base = typeof cur.setTo === "number" ? cur.setTo : r.jumlah;
      const delta = Math.max(-base, cur.delta + step);
      const next = { ...prev, [k]: { ...cur, delta } };
      if (delta === 0 && typeof cur.setTo !== "number") delete next[k];
      return next;
    });
  const setJumlah = (r: StokRow, n: number) =>
    setDrafts((prev) => {
      const next = { ...prev };
      if (n === r.jumlah) delete next[keyOf(r)];
      else next[keyOf(r)] = { delta: 0, setTo: n };
      return next;
    });
  const changed = rowsAll.filter((r) => drafts[keyOf(r)] && nextQty(r) !== r.jumlah);
  const autoAlasan: StokAlasan = (() => {
    if (changed.some((r) => typeof drafts[keyOf(r)]?.setTo === "number")) return "koreksi";
    const ups = changed.filter((r) => nextQty(r) > r.jumlah).length;
    if (ups === changed.length) return "masuk";
    if (ups === 0) return "terjual";
    return "koreksi";
  })();
  const simpan = async () => {
    setSaving(true);
    try {
      const n = await commitStokChanges(
        changed.map((r) => {
          const d = drafts[keyOf(r)];
          return typeof d.setTo === "number"
            ? { kategori: r.kategori, item: r.item, setTo: Math.max(0, d.setTo + d.delta) }
            : { kategori: r.kategori, item: r.item, delta: d.delta };
        }),
        alasan || autoAlasan,
        catatanSimpan
      );
      setDrafts({});
      setSheetOpen(false);
      setAlasan(null);
      setCatatanSimpan("");
      alert(`Stok tersimpan (${n} barang) ✅`);
    } catch (e: any) {
      alert("Gagal menyimpan stok: " + (e?.message || e) + "\nPerubahan Anda masih ada, coba simpan lagi.");
    } finally {
      setSaving(false);
    }
  };

  // ---------- Ringkasan & daftar ----------
  const count = {
    habis: rows.filter((r) => r.status === "habis").length,
    menipis: rows.filter((r) => r.status === "menipis").length,
    aman: rows.filter((r) => r.status === "aman").length,
    cek: rows.filter((r) => isStale(r.lastTs)).length,
  };
  const perluBeli = rows.filter((r) => r.status !== "aman");

  const terlaris = useMemo(
    () =>
      Array.from(sold30.entries())
        .filter(([k]) => kondisiStok(k.split("||")[0], k.split("||")[1], products) === kondisi)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, n]) => ({ item: k.split("||")[1], kategori: k.split("||")[0], n })),
    [sold30, products, kondisi]
  );

  const q = cari.trim().toLowerCase();
  const visible = rows
    .filter((r) => (filter === "semua" ? true : filter === "cek" ? isStale(r.lastTs) : r.status === filter) || !!drafts[keyOf(r)])
    .filter((r) => !q || r.item.toLowerCase().includes(q) || r.kategori.toLowerCase().includes(q));
  const grouped = kategoriJualan
    .map((c) => ({
      kategori: c.kategori,
      items: visible
        .filter((r) => r.kategori === c.kategori)
        .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.jumlah - b.jumlah),
    }))
    .filter((g) => g.items.length);

  const logsByDay = useMemo(() => {
    const m = new Map<string, StokLog[]>();
    logs.slice(0, 150).forEach((l) => {
      const k = dayLabel(l.ts);
      m.set(k, [...(m.get(k) || []), l]);
    });
    return Array.from(m.entries());
  }, [logs]);

  const tiles: { key: Filter; title: string; value: number; sub: string; cls: string; icon: React.ReactNode }[] = [
    { key: "habis", title: "Habis", value: count.habis, sub: "harus beli", cls: "text-red-600 dark:text-red-400", icon: <AlertCircle className="w-4 h-4" /> },
    { key: "menipis", title: "Menipis", value: count.menipis, sub: "di bawah minimum", cls: "text-amber-600 dark:text-amber-400", icon: <AlertCircle className="w-4 h-4" /> },
    { key: "aman", title: "Aman", value: count.aman, sub: "stok cukup", cls: "text-emerald-600 dark:text-emerald-400", icon: <CheckCircle className="w-4 h-4" /> },
    { key: "cek", title: "Perlu dicek", value: count.cek, sub: `> ${STALE_DAYS} hari tak diupdate`, cls: "text-zinc-700 dark:text-zinc-200", icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className={`space-y-4 ${changed.length ? "pb-24" : ""}`}>
      {/* Halaman Baru / Seken */}
      <KondisiSwitch value={kondisi} onChange={(k) => { setKondisi(k); setFilter("semua"); }} counts={kondisiCount} />

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-2.5">
        {tiles.map((t) => (
          <TileStok
            key={t.key}
            title={t.title}
            value={t.value}
            sub={t.sub}
            cls={t.cls}
            icon={t.icon}
            active={filter === t.key}
            onClick={() => { setFilter(filter === t.key ? "semua" : t.key); setTab("barang"); }}
          />
        ))}
      </div>

      {/* Aksi */}
      <div className="space-y-2">
        <button
          type="button"
          disabled={!perluBeli.length}
          onClick={() => shareOrCopy(restockText(rows), "Daftar belanja disalin 📋")}
          className="w-full h-12 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[14px] font-black flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98]"
        >
          <ShoppingCart className="w-4 h-4" /> Daftar Belanja ({perluBeli.length} barang)
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="h-12 rounded-2xl bg-blue-600 text-white text-[14px] font-black flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <ClipboardPaste className="w-4 h-4" /> Tempel Laporan
          </button>
          <button
            type="button"
            onClick={() => shareOrCopy(buildStokReport(kategoriJualan, dataJualan as any), "Laporan stok disalin 📋")}
            className="h-12 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 text-zinc-800 dark:text-zinc-100 text-[14px] font-black flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Copy className="w-4 h-4" /> Salin Laporan
          </button>
        </div>
      </div>
      <StokReportPaste open={pasteOpen} onClose={() => setPasteOpen(false)} categories={kategoriJualan} data={dataJualan as any} isOwner={isOwner} />

      {/* Barang / Riwayat */}
      <SubTabs
        ariaLabel="Halaman stok jualan"
        value={tab}
        onChange={setTab}
        options={[{ key: "barang", label: "Barang" }, { key: "riwayat", label: "Riwayat" }]}
      />

      {tab === "barang" ? (
        <>
          {terlaris.length > 0 && filter === "semua" && !q && (
            <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-3.5">
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-500 mb-2"><TrendingUp className="w-4 h-4" /> Paling laku 30 hari</div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {terlaris.map((t) => (
                  <div key={t.kategori + t.item} className="shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 px-3 py-2">
                    <div className="text-[13px] font-bold text-zinc-900 dark:text-white whitespace-nowrap">{t.item}</div>
                    <div className="text-[11px] text-zinc-500 whitespace-nowrap">{t.n} terjual · {t.kategori}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang…" className="flex-1 min-w-0 bg-transparent text-[15px] focus:outline-none text-zinc-900 dark:text-white" />
            {cari && <button type="button" onClick={() => setCari("")} aria-label="Hapus pencarian" className="p-1 text-zinc-400"><X className="w-4 h-4" /></button>}
          </div>
          {filter !== "semua" && (
            <button type="button" onClick={() => setFilter("semua")} className="h-8 px-3 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[12px] font-bold flex items-center gap-1.5">
              Filter: {tiles.find((t) => t.key === filter)?.title} <X className="w-3.5 h-3.5" />
            </button>
          )}

          {grouped.length === 0 ? (
            <div className="text-center text-sm text-zinc-500 py-10 rounded-2xl border border-dashed border-zinc-300 dark:border-white/10">
              {filter === "habis" || filter === "menipis" ? "Tidak ada barang dengan status ini 👍" : "Tidak ada barang yang cocok."}
            </div>
          ) : (
            grouped.map((g) => (
              <KartuStok key={g.kategori} judul={g.kategori} kanan={`${g.items.reduce((s, r) => s + r.jumlah, 0)} pcs`}>
                {g.items.map((r) => {
                  const sold = sold30.get(keyOf(r)) || 0;
                  const note = catatanOf(r);
                  const nq = nextQty(r);
                  const diff = nq - r.jumlah;
                  return (
                    <div key={keyOf(r)} className={`pl-4 pr-3 py-2.5 flex items-center gap-2 border-t border-zinc-100 dark:border-white/5 ${diff ? "bg-blue-50/60 dark:bg-blue-500/5" : ""}`}>
                      <button type="button" onClick={() => setSelected(r)} className="flex-1 min-w-0 text-left py-0.5 active:opacity-70">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_STATUS[r.status]}`} aria-hidden />
                          <span className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 truncate">{r.item}</span>
                        </div>
                        {note && <div className="text-[11px] italic text-amber-600 dark:text-amber-400 truncate pl-4">“{note}”</div>}
                        <div className="mt-0.5 pl-4 flex items-center gap-1.5 min-w-0">
                          {r.status !== "aman" && <StatusChip status={r.status} kurang={r.kurang} />}
                          <span className="text-[11px] text-zinc-400 truncate">
                            min {r.min}{sold ? ` · ${sold} laku/30h` : ""} · <span className={isStale(r.lastTs) ? "text-amber-600" : ""}>{fmtWaktu(r.lastTs)}</span>
                          </span>
                        </div>
                      </button>
                      <StepperStok value={nq} diff={diff} nama={r.item} onStep={(s) => bump(r, s)} onSet={(n) => setJumlah(r, n)} />
                    </div>
                  );
                })}
              </KartuStok>
            ))
          )}
          <p className="text-center text-[11.5px] text-zinc-400 px-4">Ketuk nama barang untuk lihat riwayat{isOwner ? " & atur stok minimum" : ""}. Ubah jumlah dengan − / +, lalu tekan Simpan.</p>
        </>
      ) : (
        <div className="space-y-3">
          {logsLoading ? (
            <div className="text-center text-sm text-zinc-500 py-10">Memuat riwayat…</div>
          ) : logsByDay.length === 0 ? (
            <div className="text-center text-sm text-zinc-500 py-10 rounded-2xl border border-dashed border-zinc-300 dark:border-white/10">
              <History className="w-6 h-6 mx-auto mb-2 text-zinc-400" />
              Belum ada riwayat. Riwayat tercatat setiap kali stok jualan diubah, terjual di POS, atau dari tempel laporan.
            </div>
          ) : (
            logsByDay.map(([day, list]) => (
              <div key={day}>
                <div className="px-1 pb-1.5 text-[12px] font-bold text-zinc-500">{day}</div>
                <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 overflow-hidden">
                  {list.map((l) => <LogRow key={l.id} l={l} />)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bar simpan (muncul bila ada perubahan) */}
      {changed.length > 0 && !sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[300] px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-xl border-t border-zinc-200 dark:border-white/10 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          <div className="max-w-xl mx-auto flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-black text-zinc-900 dark:text-white">{changed.length} barang diubah</div>
              <div className="text-[11px] text-zinc-500 truncate">Belum tersimpan</div>
            </div>
            <button type="button" onClick={() => setDrafts({})} className="h-11 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[14px] font-bold text-zinc-700 dark:text-zinc-200">
              Batal
            </button>
            <button type="button" onClick={() => setSheetOpen(true)} className="h-11 px-5 rounded-xl bg-blue-600 text-white text-[14px] font-black active:scale-95">
              Simpan
            </button>
          </div>
        </div>
      )}

      {/* Lembar konfirmasi simpan */}
      {sheetOpen && (
        <div className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !saving && setSheetOpen(false)} />
          <div className="relative w-full sm:max-w-md bg-white dark:bg-[#1c1c1e] rounded-t-[24px] sm:rounded-[24px] max-h-[88vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
            <div className="px-5 pt-3 pb-2 flex items-center justify-between">
              <h3 className="text-[17px] font-black text-zinc-900 dark:text-white">Simpan perubahan stok</h3>
              <button type="button" onClick={() => setSheetOpen(false)} disabled={saving} aria-label="Tutup" className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 overflow-y-auto space-y-4 pb-4">
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 divide-y divide-zinc-100 dark:divide-white/5">
                {changed.map((r) => {
                  const nq = nextQty(r);
                  const d = nq - r.jumlah;
                  return (
                    <div key={keyOf(r)} className="px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-zinc-900 dark:text-white truncate">{r.item}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{r.kategori}</div>
                      </div>
                      <div className="text-[13px] font-bold tabular-nums shrink-0 text-zinc-700 dark:text-zinc-200">
                        {r.jumlah} → {nq} <span className={d > 0 ? "text-emerald-600" : "text-red-500"}>({d > 0 ? `+${d}` : d})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Jenis perubahan</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ALASAN_LABEL) as StokAlasan[]).map((a) => {
                    const active = (alasan || autoAlasan) === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAlasan(a)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl text-[13px] font-bold text-left border flex items-center gap-2 ${
                          active ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        {active && <Check className="w-4 h-4 shrink-0" />}
                        {ALASAN_LABEL[a]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Catatan (opsional)</div>
                <input
                  value={catatanSimpan}
                  onChange={(e) => setCatatanSimpan(e.target.value)}
                  placeholder="Mis. restock dari supplier, dijual ke Budi…"
                  className="w-full h-11 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white"
                />
              </div>
            </div>
            <div className="px-5 pt-2 pb-4 border-t border-zinc-100 dark:border-white/5">
              <button type="button" onClick={simpan} disabled={saving} className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[15px] font-black active:scale-[0.98] disabled:opacity-60">
                {saving ? "Menyimpan…" : `Simpan ${changed.length} perubahan`}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <ItemSheet
          row={rowsAll.find((r) => keyOf(r) === keyOf(selected)) || selected}
          catatan={catatanOf(selected)}
          logs={logs.filter((l) => l.kategori === selected.kategori && l.item === selected.item)}
          isOwner={isOwner}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};

const ItemSheet: React.FC<{ row: StokRow; catatan: string; logs: StokLog[]; isOwner?: boolean; onClose: () => void }> = ({ row, catatan, logs, isOwner, onClose }) => {
  useBodyScrollLock(true);
  const [min, setMin] = useState(row.min);
  const [saving, setSaving] = useState(false);
  const since = Date.now() - 30 * 86400000;
  const recent = logs.filter((l) => l.ts >= since);
  const terjual = recent.filter((l) => l.alasan === "terjual").reduce((s, l) => s - Math.min(0, l.delta), 0);
  const masuk = recent.filter((l) => l.alasan === "masuk").reduce((s, l) => s + Math.max(0, l.delta), 0);

  const simpanMin = async () => {
    setSaving(true);
    try { await saveMinStok(row.kategori, row.item, min); alert("Stok minimum disimpan ✅"); }
    catch (e: any) { alert("Gagal menyimpan: " + (e?.message || e)); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[320] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white dark:bg-[#1c1c1e] rounded-t-[24px] sm:rounded-[24px] max-h-[90vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
        <div className="px-5 pt-2 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 truncate">{row.kategori}</div>
            <h3 className="text-[19px] font-black text-zinc-900 dark:text-white">{row.item}</h3>
            {catatan && <div className="text-[12px] italic text-amber-600 dark:text-amber-400">“{catatan}”</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-9 h-9 shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 pb-5 overflow-y-auto space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 p-3 text-center">
              <div className="text-[24px] font-black text-zinc-900 dark:text-white">{row.jumlah}</div>
              <div className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${BADGE_STATUS[row.status]}`}>{LABEL_STATUS[row.status]}</div>
            </div>
            <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 p-3 text-center">
              <div className="text-[24px] font-black text-blue-600 dark:text-blue-400">{terjual}</div>
              <div className="text-[10px] font-bold text-zinc-500">terjual 30h</div>
            </div>
            <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 p-3 text-center">
              <div className="text-[24px] font-black text-emerald-600 dark:text-emerald-400">{masuk}</div>
              <div className="text-[10px] font-bold text-zinc-500">masuk 30h</div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-white/10 p-3.5">
            <div className="text-[14px] font-bold text-zinc-900 dark:text-white">Stok minimum</div>
            <div className="text-[12px] text-zinc-500 mb-3">Di bawah angka ini barang ditandai “Menipis” & masuk Daftar Belanja. Bawaan: {defaultMinStok(row.kategori)}.</div>
            {isOwner ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMin((m) => Math.max(0, m - 1))} aria-label="Kurangi minimum" className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                <div className="w-14 text-center text-[22px] font-black tabular-nums text-zinc-900 dark:text-white">{min}</div>
                <button type="button" onClick={() => setMin((m) => Math.min(999, m + 1))} aria-label="Tambah minimum" className="w-11 h-11 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                <button type="button" disabled={saving || min === row.min} onClick={simpanMin} className="ml-auto h-11 px-4 rounded-xl bg-blue-600 text-white text-[14px] font-black disabled:opacity-40">
                  {saving ? "…" : "Simpan"}
                </button>
              </div>
            ) : (
              <div className="text-[22px] font-black tabular-nums text-zinc-900 dark:text-white">{row.min} <span className="text-[12px] font-semibold text-zinc-400">diatur owner</span></div>
            )}
          </div>

          <div>
            <div className="text-[12px] font-bold uppercase tracking-wider text-zinc-400 mb-2">Riwayat barang ini</div>
            {logs.length === 0 ? (
              <div className="text-[13px] text-zinc-500 rounded-xl bg-zinc-50 dark:bg-white/5 p-3">
                Belum ada riwayat. Terakhir diubah: {fmtWaktu(row.lastTs)}{row.lastBy ? ` oleh ${shortName(row.lastBy)}` : ""}.
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                {logs.slice(0, 20).map((l) => (
                  <div key={l.id}>
                    <div className="px-4 pt-2 text-[10px] font-bold text-zinc-400">{dayLabel(l.ts)}</div>
                    <LogRow l={l} showItem={false} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {isOwner && <p className="text-center text-[12px] text-zinc-400 leading-snug px-2">Ubah nama, harga, atau hapus barang lewat Owner › Input › Stok Jualan.</p>}
        </div>
      </div>
    </div>
  );
};

export default StokJualan;
