import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle, ChevronRight, Clock, Copy, History, Loader2, Minus, Plus, ShoppingCart, TrendingUp, X } from "lucide-react";
import useStokData, { type StokKategori } from "../hooks/useStokData";
import { Kondisi, kondisiStok, stokBeririsan } from "../lib/posSales";
import { useProdukJualan } from "../lib/barangJualan";
import KondisiSwitch from "./KondisiSwitch";
import { Button, Card, EmptyState, Eyebrow, Pill, SearchField, SelectField, Sheet, SubTabs, TextField } from "../ui";
import { KartuStok, StatusChip, TileStok, LABEL_STATUS, DOT_STATUS } from "./common/StokUI";
import {
  ALASAN_SHORT, StokLog, StokRow, StokStatus, buildStokRows, defaultMinStok, fmtWaktu, gantiNamaKategoriStok, isStale, pindahBarangStok,
  pulihkanStokJualanDariRiwayat, rapikanNamaStok, restockText, saveMinStok, shortName, soldMap, useMinStok, useStokLog, STALE_DAYS, kunciStok } from "../lib/stokJualan";
import { buildStokReport } from "../lib/stokReport";

/**
 * STOK JUALAN — pantau & atur kategori (owner & admin, mobile-first).
 *
 * Jumlah stok TIDAK diubah di halaman ini. Satu jalur: Owner › Input › Atur Stok (stok masuk dengan
 * modal & pengeluaran, koreksi) dan otomatis berkurang dari penjualan kasir — supaya stok, modal,
 * dan pengeluaran selalu sinkron.
 * Di sini: ringkasan habis / menipis / aman, daftar belanja, salin laporan, riwayat, stok minimum,
 * dan (owner) pindah barang ke kategori lain / ganti nama kategori.
 */
type Filter = "semua" | StokStatus | "cek";
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
  const { stokState, stokLoaded, masterLoaded, masterCategories } = useStokData();
  const minMap = useMinStok();
  const { logs, loading: logsLoading } = useStokLog(400);
  const [tab, setTab] = useState<"barang" | "riwayat">("barang");
  const [filter, setFilter] = useState<Filter>("semua");
  const [cari, setCari] = useState("");
  const [selected, setSelected] = useState<StokRow | null>(null);
  const [ubahKategori, setUbahKategori] = useState<string | null>(null);

  const kategoriJualan: StokKategori[] = Array.isArray(masterCategories?.jualan) ? masterCategories.jualan : [];
  const dataJualan = (stokState?.jualan || {}) as Record<string, Record<string, any>>;

  const { products, loaded: productsLoaded } = useProdukJualan();
  const recoveryTried = useRef(false);
  useEffect(() => {
    if (!isOwner || !stokLoaded || !masterLoaded || !productsLoaded || recoveryTried.current || Object.keys(dataJualan).length > 0 || !products.length) return;
    recoveryTried.current = true;
    pulihkanStokJualanDariRiwayat(products).catch((e) => console.warn("Pemulihan stok dari riwayat gagal:", e));
  }, [isOwner, stokLoaded, masterLoaded, productsLoaded, dataJualan, products]);
  const [kondisi, setKondisi] = useState<Kondisi>("BARU");
  const rowsAll = useMemo(() => buildStokRows(kategoriJualan, dataJualan, minMap), [kategoriJualan, dataJualan, minMap]);
  // Halaman Baru / Seken
  const kondisiOf = (r: { kategori: string; item: string }) => kondisiStok(r.kategori, r.item, products);
  const rows = useMemo(() => rowsAll.filter((r) => kondisiOf(r) === kondisi), [rowsAll, products, kondisi]); // eslint-disable-line react-hooks/exhaustive-deps
  // Produk kasir yang memakai barang stok ini (kosong = "Stok tanpa produk" di Input › Atur Stok)
  const produkDari = (r: { kategori: string; item: string }) => products.filter((p) => stokBeririsan(p.stokRef, r)).map((p) => p.name);
  const sold30 = useMemo(() => soldMap(logs, 30), [logs]);
  const catatanOf = (r: { kategori: string; item: string }) => String(dataJualan?.[r.kategori]?.[r.item]?.catatan || "");

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
    .filter((r) => cocokFilter(r))
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
    { key: "cek", title: "Perlu dicek", value: count.cek, sub: `> ${STALE_DAYS} hari tak berubah`, cls: "text-label", icon: <Clock className="w-4 h-4" /> },
  ];

  if (!stokLoaded || !masterLoaded) {
    return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-label-3" /></div>;
  }

  const rowTerpilih = selected ? rowsAll.find((r) => kunciStok(r) === kunciStok(selected)) || selected : null;

  return (
    <div className="space-y-4">
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
          onClick={() => shareOrCopy(restockText(rows), "Daftar belanja disalin")}
        >
          Daftar Belanja ({perluBeli.length} barang)
        </Button>
        <Button
          variant="gray"
          size="md"
          block
          icon={<Copy />}
          onClick={() => shareOrCopy(buildStokReport(kategoriJualan, dataJualan as any), "Laporan stok disalin")}
          className="bg-surface ring-1 ring-edge"
        >
          Salin Laporan Stok
        </Button>
      </div>

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
              className="hit-44 h-8 px-3 rounded-full bg-tint/15 text-tint text-caption font-semibold inline-flex items-center gap-1.5"
            >
              Filter: {tiles.find((t) => t.key === filter)?.title} <X className="w-3.5 h-3.5" />
            </button>
          )}

          {grouped.length === 0 ? (
            <EmptyState
              title={
                filter === "habis" || filter === "menipis"
                  ? `Tidak ada barang ${kondisi === "BARU" ? "baru" : "seken"} dengan status ini`
                  : "Tidak ada barang yang cocok."
              }
            />
          ) : (
            grouped.map((g) => (
              <KartuStok
                key={g.kategori}
                judul={g.kategori}
                kanan={
                  <span className="flex items-center gap-1">
                    <span className="tabular-nums">{g.items.reduce((s, r) => s + r.jumlah, 0)} pcs</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setUbahKategori(g.kategori)}
                        aria-label={`Ganti nama kategori ${g.kategori}`}
                        className="-my-3 -mr-2 h-11 px-2 text-caption font-semibold text-tint active:opacity-60"
                      >
                        Ubah
                      </button>
                    )}
                  </span>
                }
              >
                <div className="divide-y divide-sep">
                  {g.items.map((r) => {
                    const sold = sold30.get(kunciStok(r)) || 0;
                    const note = catatanOf(r);
                    return (
                      <button
                        key={kunciStok(r)}
                        type="button"
                        onClick={() => setSelected(r)}
                        className="w-full min-h-[56px] pl-4 pr-3 py-2.5 flex items-center gap-3 text-left active:bg-fill transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_STATUS[r.status]}`} aria-hidden />
                            <span className="text-subhead font-semibold text-label truncate">{r.item}</span>
                          </div>
                          {note && <div className="text-caption2 italic text-warning truncate pl-4">“{note}”</div>}
                          <div className="mt-0.5 pl-4 flex items-center gap-1.5 min-w-0">
                            {r.status !== "aman" && <StatusChip status={r.status} kurang={r.kurang} />}
                            <span className="text-caption2 text-label-3 truncate">
                              min {r.min}{sold ? ` · ${sold} laku/30h` : ""} · <span className={isStale(r.lastTs) ? "text-warning" : ""}>{fmtWaktu(r.lastTs)}</span>
                              {isOwner && !produkDari(r).length ? " · tanpa produk" : ""}
                            </span>
                          </div>
                        </div>
                        <span className={`text-headline font-semibold tabular-nums ${r.jumlah > 0 ? "text-label" : "text-label-3"}`}>{r.jumlah}</span>
                        <ChevronRight className="w-4 h-4 text-label-3 shrink-0" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              </KartuStok>
            ))
          )}
          <p className="text-center text-caption text-label-3 px-4 leading-snug">
            {isOwner
              ? "Ketuk barang untuk lihat riwayat, atur stok minimum, atau pindah kategori. Jumlah stok diubah lewat Input › Atur Stok."
              : "Ketuk barang untuk lihat riwayat. Stok berkurang otomatis dari kasir; penambahan & koreksi diatur owner."}
          </p>
        </>
      ) : (
        <div className="space-y-3">
          {logsLoading ? (
            <div className="text-center text-footnote text-label-2 py-10">Memuat riwayat…</div>
          ) : logsByDay.length === 0 ? (
            <EmptyState icon={<History />} title="Belum ada riwayat">
              Riwayat tercatat setiap kali stok masuk atau dikoreksi di Atur Stok, dan saat terjual di kasir.
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

      {selected && rowTerpilih && (
        <ItemSheet
          row={rowTerpilih}
          catatan={catatanOf(rowTerpilih)}
          logs={logs.filter((l) => l.kategori === rowTerpilih.kategori && l.item === rowTerpilih.item)}
          produk={produkDari(rowTerpilih)}
          cats={kategoriJualan}
          isOwner={isOwner}
          onPindah={(ke) => setSelected({ ...rowTerpilih, ...ke })}
          onClose={() => setSelected(null)}
        />
      )}

      {ubahKategori && (
        <KategoriSheet
          kategori={ubahKategori}
          items={kategoriJualan.find((c) => c.kategori === ubahKategori)?.items || []}
          onClose={() => setUbahKategori(null)}
        />
      )}
    </div>
  );
};

const KATEGORI_BARU = "__baru__";

const ItemSheet: React.FC<{
  row: StokRow;
  catatan: string;
  logs: StokLog[];
  produk: string[];
  cats: StokKategori[];
  isOwner?: boolean;
  onPindah: (ke: { kategori: string; item: string }) => void;
  onClose: () => void;
}> = ({ row, catatan, logs, produk, cats, isOwner, onPindah, onClose }) => {
  const [min, setMin] = useState(row.min);
  const [saving, setSaving] = useState(false);
  const [tujuan, setTujuan] = useState(row.kategori);
  const [namaBaru, setNamaBaru] = useState("");
  const [pindahSaving, setPindahSaving] = useState(false);
  const [errPindah, setErrPindah] = useState("");
  useEffect(() => { setTujuan(row.kategori); setNamaBaru(""); setErrPindah(""); }, [row.kategori]);
  const since = Date.now() - 30 * 86400000;
  const recent = logs.filter((l) => l.ts >= since);
  const terjual = recent.filter((l) => l.alasan === "terjual").reduce((s, l) => s - Math.min(0, l.delta), 0);
  const masuk = recent.filter((l) => l.alasan === "masuk").reduce((s, l) => s + Math.max(0, l.delta), 0);
  const kategoriTujuan = tujuan === KATEGORI_BARU ? rapikanNamaStok(namaBaru) : tujuan;
  const bisaPindah = !!kategoriTujuan && kategoriTujuan !== row.kategori;

  const simpanMin = async () => {
    setSaving(true);
    try { await saveMinStok(row.kategori, row.item, min); alert("Stok minimum disimpan ✅"); }
    catch (e: any) { alert("Gagal menyimpan: " + (e?.message || e)); }
    finally { setSaving(false); }
  };

  const pindah = async () => {
    if (!bisaPindah) return;
    setPindahSaving(true);
    setErrPindah("");
    try {
      const ke = await pindahBarangStok({ kategori: row.kategori, item: row.item }, { kategori: kategoriTujuan, item: row.item });
      if (ke) onPindah(ke);
      alert(`Dipindah ke ${ke?.kategori || kategoriTujuan} ✅`);
    } catch (e: any) {
      setErrPindah(e?.message || String(e));
    } finally {
      setPindahSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={() => !pindahSaving && onClose()}
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
          <div className="text-footnote font-bold text-label">Dijual di kasir sebagai</div>
          {produk.length ? (
            <div className="mt-1 space-y-0.5">
              {produk.map((n) => <div key={n} className="text-subhead text-label">{n}</div>)}
            </div>
          ) : (
            <div className="mt-1 text-caption text-warning">
              Belum ada produknya, jadi barang ini belum bisa dijual.{isOwner ? " Buat lewat Input › Atur Stok › Stok tanpa produk." : ""}
            </div>
          )}
        </Card>

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
                className="w-11 h-11 rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 text-label flex items-center justify-center active:scale-95 transition"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="w-14 text-center text-title2 font-bold tabular-nums text-label">{min}</div>
              <button
                type="button"
                onClick={() => setMin((m) => Math.min(999, m + 1))}
                aria-label="Tambah minimum"
                className="w-11 h-11 rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 text-label flex items-center justify-center active:scale-95 transition"
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

        {isOwner && (
          <Card>
            <div className="text-footnote font-bold text-label">Kategori</div>
            <div className="text-caption text-label-2 mb-3">
              Pindahkan barang ini ke kategori lain. Jumlah, produk, riwayat, modal, dan nota ikut pindah.
            </div>
            <SelectField value={tujuan} onChange={(e) => { setTujuan(e.target.value); setErrPindah(""); }} aria-label="Kategori tujuan">
              {cats.map((c) => (
                <option key={c.kategori} value={c.kategori}>{c.kategori}</option>
              ))}
              <option value={KATEGORI_BARU}>+ Kategori baru…</option>
            </SelectField>
            {tujuan === KATEGORI_BARU && (
              <TextField
                wrapperClassName="mt-2"
                value={namaBaru}
                onChange={(e) => setNamaBaru(e.target.value.toUpperCase())}
                placeholder="NAMA KATEGORI BARU"
                autoCapitalize="characters"
                aria-label="Nama kategori baru"
              />
            )}
            {errPindah && <p className="mt-2 text-caption font-medium text-negative">{errPindah}</p>}
            <Button variant="tinted" size="md" block className="mt-3" loading={pindahSaving} disabled={!bisaPindah || pindahSaving} onClick={pindah}>
              {bisaPindah ? `Pindahkan ke ${kategoriTujuan}` : "Pindahkan"}
            </Button>
          </Card>
        )}

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

        <p className="text-center text-caption text-label-3 leading-snug px-2">
          {isOwner
            ? "Jumlah stok, nama, harga, dan hapus barang diatur lewat Input › Atur Stok."
            : "Stok berkurang otomatis dari kasir. Penambahan & koreksi diatur owner."}
        </p>
      </div>
    </Sheet>
  );
};

/** Ganti nama satu kategori stok jualan (owner). */
const KategoriSheet: React.FC<{ kategori: string; items: string[]; onClose: () => void }> = ({ kategori, items, onClose }) => {
  const [nama, setNama] = useState(kategori);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const rapi = rapikanNamaStok(nama);

  const simpan = async () => {
    setSaving(true);
    setErr("");
    try {
      const baru = await gantiNamaKategoriStok(kategori, nama, items);
      onClose();
      alert(`Nama kategori jadi ${baru} ✅`);
    } catch (e: any) {
      setErr(e?.message || String(e));
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={() => !saving && onClose()}
      title="Ganti nama kategori"
      subtitle={`${kategori} · ${items.length} barang`}
      size="sm"
      variant="grouped"
      zClassName="z-[320]"
      footer={
        <Button variant="filled" size="lg" block loading={saving} disabled={saving || !rapi || rapi === kategori} onClick={simpan}>
          Simpan
        </Button>
      }
    >
      <Card>
        <TextField
          label="Nama kategori"
          value={nama}
          onChange={(e) => { setNama(e.target.value.toUpperCase()); setErr(""); }}
          autoCapitalize="characters"
          error={err || undefined}
        />
        <p className="mt-2 text-caption text-label-2 leading-snug">
          Semua barang, produk, riwayat, dan nota di kategori ini ikut memakai nama baru. Kata BARU / SEKEN di nama kategori menentukan halaman Baru / Seken.
        </p>
      </Card>
    </Sheet>
  );
};

export default StokJualan;
