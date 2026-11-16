import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Check, Clock, ClipboardPaste, Copy, History, Minus, Plus, ShoppingCart, TrendingUp, X } from "lucide-react";
import useStokData from "../hooks/useStokData";
import { Kondisi, kondisiStok, stokBeririsan } from "../lib/posSales";
import { useProdukJualan } from "../lib/barangJualan";
import KondisiSwitch from "./KondisiSwitch";
import StokReportPaste from "./StokReportPaste";
import { Button, Card, EmptyState, Eyebrow, Pill, SearchField, Sheet, SubTabs } from "../ui";
import { KartuStok, StatusChip, StepperStok, TileStok, LABEL_STATUS, DOT_STATUS } from "./common/StokUI";
import {
  ALASAN_LABEL, ALASAN_SHORT, StokAlasan, StokLog, StokRow, StokStatus, buildStokRows, commitStokChanges, defaultMinStok, fmtWaktu, isStale,
  restockText, saveMinStok, shortName, soldMap, useMinStok, useStokLog, STALE_DAYS, kunciStok } from "../lib/stokJualan";
import { buildStokReport } from "../lib/stokReport";

/**
 * STOK JUALAN — satu halaman untuk owner & admin (mobile-first):
 * pantau (habis / menipis / aman), ubah jumlah (draft lalu simpan sekali dengan jenis perubahan),
 * tempel / salin laporan WhatsApp, daftar belanja, dan riwayat.
 */
type Filter = "semua" | StokStatus | "cek";
type Draft = { delta: number; setTo?: number };
const STATUS_RANK: Record<StokStatus, number> = { habis: 0, menipis: 1, aman: 2 };
const ALASAN_COLOR: Record<string, string> = {
  masuk: "text-positive",
  terjual: "text-tint",
  rusak: "text-negative",
  koreksi: "text-label-2",
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
  <div className="px-4 py-3 flex items-start gap-3 border-t border-sep first:border-t-0">
    <div className={`w-12 shrink-0 text-right text-subhead font-bold tabular-nums ${l.delta > 0 ? "text-positive" : "text-negative"}`}>
      {l.delta > 0 ? `+${l.delta}` : l.delta}
    </div>
    <div className="min-w-0 flex-1">
      {showItem && <div className="text-footnote font-semibold text-label truncate">{l.item}</div>}
      <div className="text-caption text-label-2 truncate">
        <span className={`font-semibold ${ALASAN_COLOR[l.alasan] || ""}`}>{ALASAN_SHORT[l.alasan] || l.alasan}</span>
        {" · "}{l.sebelum} → {l.sesudah}{" · "}{shortName(l.oleh)}{" · "}
        {new Date(l.ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":")}
      </div>
      {showItem && <div className="text-caption2 text-label-3 truncate">{l.kategori}</div>}
      {l.catatan && <div className="text-caption2 italic text-label-2 truncate">“{l.catatan}”</div>}
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

  const kategoriJualan = Array.isArray(masterCategories?.jualan) ? masterCategories.jualan : [];
  const dataJualan = (stokState?.jualan || {}) as Record<string, Record<string, any>>;

  const { products } = useProdukJualan();
  const [kondisi, setKondisi] = useState<Kondisi>("BARU");
  const rowsAll = useMemo(() => buildStokRows(kategoriJualan, dataJualan, minMap), [kategoriJualan, dataJualan, minMap]);
  // Halaman Baru / Seken (draft di halaman lain tetap ikut tersimpan)
  const kondisiOf = (r: { kategori: string; item: string }) => kondisiStok(r.kategori, r.item, products);
  const rows = useMemo(() => rowsAll.filter((r) => kondisiOf(r) === kondisi), [rowsAll, products, kondisi]); // eslint-disable-line react-hooks/exhaustive-deps
  // Barang stok yang belum dijual di POS (sama dengan "Stok tanpa produk" di Input › Atur Stok)
  const tanpaProduk = (r: { kategori: string; item: string }) => !products.some((p) => stokBeririsan(p.stokRef, r));
  const sold30 = useMemo(() => soldMap(logs, 30), [logs]);
  const catatanOf = (r: { kategori: string; item: string }) => String(dataJualan?.[r.kategori]?.[r.item]?.catatan || "");

  // ---------- Draft ----------
  const nextQty = (r: StokRow) => {
    const d = drafts[kunciStok(r)];
    if (!d) return r.jumlah;
    return Math.max(0, (typeof d.setTo === "number" ? d.setTo : r.jumlah) + d.delta);
  };
  const bump = (r: StokRow, step: number) =>
    setDrafts((prev) => {
      const k = kunciStok(r);
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
      if (n === r.jumlah) delete next[kunciStok(r)];
      else next[kunciStok(r)] = { delta: 0, setTo: n };
      return next;
    });
  const changed = rowsAll.filter((r) => drafts[kunciStok(r)] && nextQty(r) !== r.jumlah);
  const autoAlasan: StokAlasan = (() => {
    if (changed.some((r) => typeof drafts[kunciStok(r)]?.setTo === "number")) return "koreksi";
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
          const d = drafts[kunciStok(r)];
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
  const cocokFilter = (r: StokRow, f: Filter = filter) => (f === "semua" ? true : f === "cek" ? isStale(r.lastTs) : r.status === f);
  // Ringkasan = SELURUH barang jualan (baru + seken), sama seperti Input › Atur Stok
  const count = {
    habis: rowsAll.filter((r) => cocokFilter(r, "habis")).length,
    menipis: rowsAll.filter((r) => cocokFilter(r, "menipis")).length,
    aman: rowsAll.filter((r) => cocokFilter(r, "aman")).length,
    cek: rowsAll.filter((r) => cocokFilter(r, "cek")).length,
  };
  // Angka di saklar Baru / Seken mengikuti filter ringkasan yang aktif
  const kondisiCount = {
    BARU: rowsAll.filter((r) => kondisiOf(r) === "BARU" && cocokFilter(r)).length,
    SEKEN: rowsAll.filter((r) => kondisiOf(r) === "SEKEN" && cocokFilter(r)).length,
  };
  const pilihFilter = (f: Filter) => {
    const next = filter === f ? "semua" : f;
    setFilter(next);
    setTab("barang");
    // Halaman ini tidak punya barang dengan status itu tapi halaman lain punya -> pindah ke sana
    if (next !== "semua") {
      const lain: Kondisi = kondisi === "BARU" ? "SEKEN" : "BARU";
      const di = (k: Kondisi) => rowsAll.filter((r) => kondisiOf(r) === k && cocokFilter(r, next)).length;
      if (!di(kondisi) && di(lain)) setKondisi(lain);
    }
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
    .filter((r) => cocokFilter(r) || !!drafts[kunciStok(r)])
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
    { key: "habis", title: "Habis", value: count.habis, sub: "harus beli", cls: "text-negative", icon: <AlertCircle className="w-4 h-4" /> },
    { key: "menipis", title: "Menipis", value: count.menipis, sub: "di bawah minimum", cls: "text-warning", icon: <AlertCircle className="w-4 h-4" /> },
    { key: "aman", title: "Aman", value: count.aman, sub: "stok cukup", cls: "text-positive", icon: <CheckCircle className="w-4 h-4" /> },
    { key: "cek", title: "Perlu dicek", value: count.cek, sub: `> ${STALE_DAYS} hari tak diupdate`, cls: "text-label", icon: <Clock className="w-4 h-4" /> },
  ];

  return (
    <div className={`space-y-4 ${changed.length ? "pb-24" : ""}`}>
      {/* Ringkasan seluruh barang jualan (baru + seken) */}
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
            onClick={() => pilihFilter(t.key)}
          />
        ))}
      </div>

      {/* Halaman Baru / Seken: daftar belanja & daftar barang di bawah ini mengikuti halaman terpilih */}
      <KondisiSwitch value={kondisi} onChange={setKondisi} counts={kondisiCount} />

      {/* Aksi */}
      <div className="space-y-2">
        <Button
          variant="filled"
          size="lg"
          block
          disabled={!perluBeli.length}
          icon={<ShoppingCart />}
          onClick={() => shareOrCopy(restockText(rows), "Daftar belanja disalin 📋")}
        >
          Daftar Belanja ({perluBeli.length} barang)
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="tinted"
            size="lg"
            block
            icon={<ClipboardPaste />}
            onClick={() => setPasteOpen(true)}
          >
            Tempel Laporan
          </Button>
          <Button
            variant="gray"
            size="lg"
            block
            icon={<Copy />}
            onClick={() => shareOrCopy(buildStokReport(kategoriJualan, dataJualan as any), "Laporan stok disalin 📋")}
            className="bg-surface ring-1 ring-edge"
          >
            Salin Laporan
          </Button>
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
            <Card>
              <div className="mb-2.5">
                <Eyebrow icon={<TrendingUp />}>Paling laku 30 hari</Eyebrow>
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {terlaris.map((t) => (
                  <div key={t.kategori + t.item} className="shrink-0 rounded-field bg-fill px-3 py-2">
                    <div className="text-footnote font-semibold text-label whitespace-nowrap">{t.item}</div>
                    <div className="text-caption2 text-label-2 whitespace-nowrap tabular-nums">{t.n} terjual · {t.kategori}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <SearchField value={cari} onChange={setCari} placeholder="Cari barang…" />

          {filter !== "semua" && (
            <button
              type="button"
              onClick={() => setFilter("semua")}
              className="h-8 px-3 rounded-full bg-tint/15 text-tint text-caption font-semibold inline-flex items-center gap-1.5"
            >
              Filter: {tiles.find((t) => t.key === filter)?.title} <X className="w-3.5 h-3.5" />
            </button>
          )}

          {grouped.length === 0 ? (
            <EmptyState
              title={
                filter === "habis" || filter === "menipis"
                  ? `Tidak ada barang ${kondisi === "BARU" ? "baru" : "seken"} dengan status ini 👍`
                  : "Tidak ada barang yang cocok."
              }
            />
          ) : (
            grouped.map((g) => (
              <KartuStok key={g.kategori} judul={g.kategori} kanan={`${g.items.reduce((s, r) => s + r.jumlah, 0)} pcs`}>
                {g.items.map((r) => {
                  const sold = sold30.get(kunciStok(r)) || 0;
                  const note = catatanOf(r);
                  const nq = nextQty(r);
                  const diff = nq - r.jumlah;
                  return (
                    <div key={kunciStok(r)} className={`pl-4 pr-3 py-2.5 flex items-center gap-2 border-t border-sep ${diff ? "bg-tint/[0.06] dark:bg-tint/10" : ""}`}>
                      <button type="button" onClick={() => setSelected(r)} className="flex-1 min-w-0 text-left py-0.5 active:opacity-70">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_STATUS[r.status]}`} aria-hidden />
                          <span className="text-subhead font-semibold text-label truncate">{r.item}</span>
                        </div>
                        {note && <div className="text-caption2 italic text-warning truncate pl-4">“{note}”</div>}
                        <div className="mt-0.5 pl-4 flex items-center gap-1.5 min-w-0">
                          {r.status !== "aman" && <StatusChip status={r.status} kurang={r.kurang} />}
                          <span className="text-caption2 text-label-3 truncate">
                            min {r.min}{sold ? ` · ${sold} laku/30h` : ""} · <span className={isStale(r.lastTs) ? "text-warning" : ""}>{fmtWaktu(r.lastTs)}</span>
                            {isOwner && tanpaProduk(r) ? " · tanpa produk" : ""}
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
          <p className="text-center text-caption text-label-3 px-4">Ketuk nama barang untuk lihat riwayat{isOwner ? " & atur stok minimum" : ""}. Ubah jumlah dengan − / +, lalu tekan Simpan.</p>
        </>
      ) : (
        <div className="space-y-3">
          {logsLoading ? (
            <div className="text-center text-footnote text-label-2 py-10">Memuat riwayat…</div>
          ) : logsByDay.length === 0 ? (
            <EmptyState icon={<History />} title="Belum ada riwayat">
              Riwayat tercatat setiap kali stok jualan diubah, terjual di POS, atau dari tempel laporan.
            </EmptyState>
          ) : (
            logsByDay.map(([day, list]) => (
              <div key={day} className="space-y-1.5">
                <div className="px-1">
                  <Eyebrow>{day}</Eyebrow>
                </div>
                <Card flush>
                  {list.map((l) => <LogRow key={l.id} l={l} />)}
                </Card>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bar simpan (muncul bila ada perubahan) */}
      {changed.length > 0 && !sheetOpen && (
        <div className="fixed inset-x-0 bottom-0 z-[300] px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] apple-bar border-t border-sep shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          <div className="max-w-xl mx-auto flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-footnote font-bold text-label">{changed.length} barang diubah</div>
              <div className="text-caption2 text-label-2 truncate">Belum tersimpan</div>
            </div>
            <Button variant="gray" size="md" onClick={() => setDrafts({})}>
              Batal
            </Button>
            <Button variant="filled" size="md" onClick={() => setSheetOpen(true)}>
              Simpan
            </Button>
          </div>
        </div>
      )}

      {/* Lembar konfirmasi simpan */}
      <Sheet
        open={sheetOpen}
        onClose={() => !saving && setSheetOpen(false)}
        title="Simpan Perubahan Stok"
        size="sm"
        variant="grouped"
        zClassName="z-[310]"
        footer={
          <Button variant="filled" size="lg" block loading={saving} onClick={simpan}>
            {saving ? "Menyimpan…" : `Simpan ${changed.length} perubahan`}
          </Button>
        }
      >
        <div className="space-y-3.5">
          <Card flush bodyClassName="divide-y divide-sep">
            {changed.map((r) => {
              const nq = nextQty(r);
              const d = nq - r.jumlah;
              return (
                <div key={kunciStok(r)} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-footnote font-semibold text-label truncate">{r.item}</div>
                    <div className="text-caption2 text-label-3 truncate">{r.kategori}</div>
                  </div>
                  <div className="text-footnote font-semibold tabular-nums shrink-0 text-label">
                    {r.jumlah} → {nq}{" "}
                    <span className={d > 0 ? "text-positive" : "text-negative"}>({d > 0 ? `+${d}` : d})</span>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card bodyClassName="space-y-3">
            <div>
              <div className="mb-2">
                <Eyebrow>Jenis Perubahan</Eyebrow>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(ALASAN_LABEL) as StokAlasan[]).map((a) => {
                  const active = (alasan || autoAlasan) === a;
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAlasan(a)}
                      className={`min-h-[44px] px-3 py-2 rounded-field text-caption font-semibold text-left flex items-center gap-2 transition-all ring-1 ${
                        active
                          ? "ring-2 ring-action bg-action/[0.06] text-label"
                          : "ring-edge bg-fill/50 text-label-2 hover:text-label"
                      }`}
                    >
                      {active && <Check className="w-4 h-4 shrink-0 text-label" />}
                      {ALASAN_LABEL[a]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5">
                <Eyebrow>Catatan (opsional)</Eyebrow>
              </div>
              <input
                value={catatanSimpan}
                onChange={(e) => setCatatanSimpan(e.target.value)}
                placeholder="Mis. restock dari supplier, dijual ke Budi…"
                className="w-full h-11 px-3.5 rounded-field bg-fill text-[16px] sm:text-footnote text-label placeholder:text-label-3 focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35"
              />
            </div>
          </Card>
        </div>
      </Sheet>

      {selected && (
        <ItemSheet
          row={rowsAll.find((r) => kunciStok(r) === kunciStok(selected)) || selected}
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
    <Sheet
      open
      onClose={onClose}
      title={row.item}
      subtitle={catatan ? `${row.kategori} · “${catatan}”` : row.kategori}
      size="sm"
      variant="grouped"
      zClassName="z-[320]"
    >
      <div className="space-y-3.5">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-tile apple-tile ring-1 ring-edge p-3 text-center">
            <div className="text-title2 font-bold text-label tabular-nums">{row.jumlah}</div>
            <div className="mt-1 flex justify-center">
              <Pill tone={row.status === "habis" ? "negative" : row.status === "menipis" ? "warning" : "positive"}>
                {LABEL_STATUS[row.status]}
              </Pill>
            </div>
          </div>
          <div className="rounded-tile apple-tile ring-1 ring-edge p-3 text-center">
            <div className="text-title2 font-bold text-tint tabular-nums">{terjual}</div>
            <div className="text-caption2 font-semibold text-label-2 mt-1">terjual 30h</div>
          </div>
          <div className="rounded-tile apple-tile ring-1 ring-edge p-3 text-center">
            <div className="text-title2 font-bold text-positive tabular-nums">{masuk}</div>
            <div className="text-caption2 font-semibold text-label-2 mt-1">masuk 30h</div>
          </div>
        </div>

        <Card>
          <div className="text-footnote font-bold text-label">Stok minimum</div>
          <div className="text-caption text-label-2 mb-3">
            Di bawah angka ini barang ditandai “Menipis” & masuk Daftar Belanja. Bawaan: {defaultMinStok(row.kategori)}.
          </div>
          {isOwner ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMin((m) => Math.max(0, m - 1))}
                aria-label="Kurangi minimum"
                className="w-11 h-11 rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 text-label flex items-center justify-center active:scale-95 transition-all"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-14 text-center text-title2 font-bold tabular-nums text-label">{min}</div>
              <button
                type="button"
                onClick={() => setMin((m) => Math.min(999, m + 1))}
                aria-label="Tambah minimum"
                className="w-11 h-11 rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 text-label flex items-center justify-center active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
              <Button
                variant="filled"
                size="md"
                loading={saving}
                disabled={saving || min === row.min}
                onClick={simpanMin}
                className="ml-auto"
              >
                Simpan
              </Button>
            </div>
          ) : (
            <div className="text-title2 font-bold tabular-nums text-label">
              {row.min} <span className="text-caption font-medium text-label-2">diatur owner</span>
            </div>
          )}
        </Card>

        <div>
          <div className="mb-2 px-1">
            <Eyebrow>Riwayat barang ini</Eyebrow>
          </div>
          {logs.length === 0 ? (
            <Card>
              <div className="text-footnote text-label-2">
                Belum ada riwayat. Terakhir diubah: {fmtWaktu(row.lastTs)}{row.lastBy ? ` oleh ${shortName(row.lastBy)}` : ""}.
              </div>
            </Card>
          ) : (
            <Card flush>
              {logs.slice(0, 20).map((l) => (
                <div key={l.id}>
                  <div className="px-4 pt-2 text-caption2 font-semibold text-label-3">{dayLabel(l.ts)}</div>
                  <LogRow l={l} showItem={false} />
                </div>
              ))}
            </Card>
          )}
        </div>

        {isOwner && (
          <p className="text-center text-caption text-label-3 leading-snug px-2">
            Ubah nama, harga, atau hapus barang lewat Owner › Input › Atur Stok.
          </p>
        )}
      </div>
    </Sheet>
  );
};

export default StokJualan;
