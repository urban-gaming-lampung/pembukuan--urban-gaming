import React, { useEffect, useMemo, useState } from "react";
import { X, CheckCircle2, Download, Printer, Share2, AlertTriangle, Package, Loader2, MessageCircle, PlusCircle, Link2Off } from "lucide-react";
import logoBlack from "../assets/urban-logo-black.png";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { commitPosSale, PILIH_SAAT_CHECKOUT, PosItem, PosSale, simpanNotaOnline, StokRef } from "../lib/posSales";
import { UploadTransferProof } from "./TableEditor";
import { buildNotaPdf, fmtTanggalNota, GARANSI_JUDUL, GARANSI_TEKS, notaFileName, preloadNotaAssets, printNotaThermal, STORE } from "../lib/posReceipt";

export type CheckoutLine = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  platform?: string;
  subcategory?: string;
  stokRef?: StokRef | null;
};

const rp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
const waDigits = (s: string) => String(s || "").replace(/[^\d]/g, "");
const waIntl = (s: string) => {
  const d = waDigits(s);
  return d.startsWith("0") ? "62" + d.slice(1) : d.startsWith("8") ? "62" + d : d;
};
const refKey = (r: StokRef) => `${r.kategori}||${r.item}`;

// ============================================================
// Pratinjau nota (sama dengan PDF / thermal)
// ============================================================

export const NotaPreview: React.FC<{ sale: PosSale }> = ({ sale: s }) => {
  const Row = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
    <div className={`flex justify-between gap-3 ${bold ? "font-bold" : ""}`}>
      <span className="text-zinc-600 shrink-0">{l}</span>
      <span className="text-right">{r}</span>
    </div>
  );
  return (
    <div className="mx-auto w-full max-w-[330px] bg-white text-black rounded-md px-4 pt-5 pb-5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
      <img src={logoBlack} alt="URBAN Gaming Lampung" className="w-[118px] mx-auto select-none" draggable={false} />
      <p className="mt-2 text-[10px] leading-snug text-center text-zinc-600">{STORE.alamat}</p>
      <p className="mt-0.5 text-[10px] font-bold text-center">WA {STORE.wa} &nbsp;|&nbsp; IG {STORE.ig}</p>
      <div className="h-[2px] bg-black my-3" />
      <div className="text-center leading-tight">
        <div className="text-[13px] font-black tracking-[0.12em]">NOTA PENJUALAN</div>
        <div className="text-[11px] font-bold font-mono mt-0.5">{s.noNota}</div>
      </div>
      <div className="mt-2.5 space-y-0.5 text-[11px]">
        <Row l="Tanggal" r={fmtTanggalNota(s.ts)} />
        <Row l="Kasir" r={s.kasirNama || s.kasir.split("@")[0]} />
        <Row l="Pembeli" r={s.pembeli || "Pelanggan"} />
        {s.pembeliWa && <Row l="WA Pembeli" r={s.pembeliWa} />}
        <Row l="Pembayaran" r={s.metode === "TRANSFER" ? "Transfer / QRIS" : "Tunai"} />
      </div>
      <div className="border-t border-dashed border-zinc-400 my-2.5" />
      <div className="space-y-2">
        {s.items.map((it, i) => (
          <div key={i} className="text-[11px]">
            <div className="font-bold leading-snug">{it.kategori === "ISI GAME" && it.platform ? `${it.nama} (${it.platform})` : it.nama}</div>
            <div className="flex justify-between text-zinc-700 font-mono">
              <span>{it.qty} x {rp(it.harga)}</span>
              <span className="text-black">{rp(it.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-zinc-400 my-2.5" />
      {s.diskon > 0 && (
        <div className="space-y-0.5 text-[11px] mb-2 font-mono">
          <Row l="Subtotal" r={rp(s.subtotal)} />
          <Row l={`Diskon promo (${s.diskonPersen}%)`} r={`-${rp(s.diskon)}`} />
        </div>
      )}
      <div className="bg-black text-white flex items-center justify-between px-3 py-2 rounded-[3px]">
        <span className="text-[12px] font-black tracking-wider">TOTAL</span>
        <span className="text-[15px] font-black font-mono">{rp(s.total)}</span>
      </div>
      <div className="text-center text-[10.5px] font-bold mt-2 tracking-wide">
        LUNAS · {s.metode === "TRANSFER" ? "TRANSFER / QRIS" : "TUNAI"}
      </div>
      <div className="mt-3 rounded-md border-[1.5px] border-black px-3 py-2 text-center">
        <div className="text-[11px] font-black tracking-wide">{GARANSI_JUDUL}</div>
        <div className="text-[10px] leading-snug text-zinc-700 mt-0.5">{GARANSI_TEKS}</div>
      </div>
      <div className="text-center mt-3.5">
        <div className="text-[12px] font-black">Terima kasih telah berbelanja!</div>
        <div className="text-[10px] text-zinc-600 mt-0.5">Instagram {STORE.ig}</div>
        <div className="text-[10px] text-zinc-600">WhatsApp {STORE.wa}</div>
        <div className="flex justify-center gap-[5px] mt-2" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className="w-[5px] h-[5px] bg-black" />)}
        </div>
      </div>
    </div>
  );
};

/** Unduh / bagikan / cetak ulang nota yang sudah tersimpan. */
export function useNotaActions(sale: PosSale | null) {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"" | "pdf" | "thermal" | "share" | "wa">("");
  const [msg, setMsg] = useState("");
  const [notaUrl, setNotaUrl] = useState<string>("");
  const uploading = React.useRef<Promise<string> | null>(null);
  useEffect(() => {
    setPdfFile(null);
    setNotaUrl(sale?.notaUrl || "");
    uploading.current = null;
    if (!sale) return;
    let alive = true;
    // PDF disiapkan lebih dulu supaya tombol Bagikan tetap dalam "gesture" pengguna
    buildNotaPdf(sale)
      .then((p) => {
        if (!alive) return;
        const file = new File([p.output("blob")], notaFileName(sale), { type: "application/pdf" });
        setPdfFile(file);
        // Ada nomor WA pembeli -> PDF langsung diunggah supaya "Kirim WA" instan
        if (sale.pembeliWa && !sale.notaUrl && !uploading.current) {
          uploading.current = simpanNotaOnline(sale, file);
          uploading.current.then((u) => { if (alive) setNotaUrl(u); }).catch(() => { uploading.current = null; });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [sale]);

  const canShare = !!pdfFile && typeof navigator !== "undefined" && !!(navigator as any).canShare?.({ files: [pdfFile] });

  const unduh = async () => {
    if (!sale) return;
    setBusy("pdf");
    try {
      if (pdfFile) {
        const url = URL.createObjectURL(pdfFile);
        const a = document.createElement("a");
        a.href = url;
        a.download = pdfFile.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      } else (await buildNotaPdf(sale)).save(notaFileName(sale));
      setMsg("PDF nota diunduh ✅");
    } catch (e: any) {
      setMsg("Gagal membuat PDF: " + (e?.message || e));
    } finally { setBusy(""); }
  };
  const cetak = async () => {
    if (!sale) return;
    setBusy("thermal");
    try {
      const r = await printNotaThermal(sale);
      setMsg(r === "bluetooth" ? "Nota terkirim ke printer ✅" : r === "rawbt" ? "Nota dibuka di aplikasi RawBT 🖨️" : "");
    } catch (e: any) {
      setMsg(e?.message || String(e));
    } finally { setBusy(""); }
  };
  const bagikan = async () => {
    if (!sale || !pdfFile) return;
    setBusy("share");
    try {
      await (navigator as any).share({ files: [pdfFile], title: `Nota ${sale.noNota}`, text: `Nota ${sale.noNota} · ${STORE.nama}` });
    } catch (e: any) {
      if (e?.name !== "AbortError") setMsg("Gagal membagikan: " + (e?.message || e));
    } finally { setBusy(""); }
  };
  const kirimWa = async () => {
    if (!sale?.pembeliWa) return;
    const pesan = (link: string) => [
      `Halo ${sale.pembeli || "Kak"}, terima kasih sudah berbelanja di *${STORE.nama}* 🙏`,
      ``,
      `No. Nota: *${sale.noNota}*`,
      ...sale.items.map((it) => `• ${it.nama} (${it.qty}x) ${rp(it.subtotal)}`),
      `Total: *${rp(sale.total)}* — LUNAS (${sale.metode === "TRANSFER" ? "Transfer/QRIS" : "Tunai"})`,
      ``,
      ...(link ? [`📄 Nota PDF: ${link}`, ``] : []),
      `_Simpan nota / invoice ini untuk keperluan klaim garansi._`,
      `IG ${STORE.ig} · WA ${STORE.wa}`,
    ].join("\n");
    const waLink = (link: string) => `https://wa.me/${waIntl(sale.pembeliWa!)}?text=${encodeURIComponent(pesan(link))}`;
    const siap = notaUrl || sale.notaUrl;
    if (siap) { window.open(waLink(siap), "_blank"); return; }
    // Buka tab dulu (masih dalam ketukan pengguna), isi alamatnya setelah PDF terunggah
    const w = window.open("", "_blank");
    setBusy("wa");
    let link = "";
    try {
      if (!uploading.current) {
        const file = pdfFile || new File([(await buildNotaPdf(sale)).output("blob")], notaFileName(sale), { type: "application/pdf" });
        uploading.current = simpanNotaOnline(sale, file);
      }
      link = await uploading.current;
      setNotaUrl(link);
    } catch (e: any) {
      uploading.current = null;
      setMsg("PDF gagal diunggah, nota dikirim tanpa link: " + (e?.message || e));
    } finally {
      setBusy("");
    }
    if (w) w.location.href = waLink(link);
    else window.location.href = waLink(link);
  };
  return { pdfFile, canShare, busy, msg, setMsg, unduh, cetak, bagikan, kirimWa };
}

export const NotaActionButtons: React.FC<{ sale: PosSale; actions: ReturnType<typeof useNotaActions> }> = ({ sale, actions: a }) => {
  const btn = "flex flex-col items-center justify-center gap-1 h-[62px] rounded-2xl text-[11.5px] font-bold active:scale-[0.97] transition disabled:opacity-50";
  return (
    <div className={`grid gap-2 ${sale.pembeliWa || a.canShare ? "grid-cols-3" : "grid-cols-2"}`}>
      <button type="button" disabled={!!a.busy} onClick={a.cetak} className={`${btn} bg-zinc-900 text-white dark:bg-white dark:text-zinc-900`}>
        {a.busy === "thermal" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}Cetak Thermal
      </button>
      <button type="button" disabled={!!a.busy} onClick={a.unduh} className={`${btn} bg-red-600 text-white`}>
        {a.busy === "pdf" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}Unduh PDF
      </button>
      {sale.pembeliWa ? (
        <button type="button" disabled={!!a.busy} onClick={a.kirimWa} className={`${btn} bg-emerald-600 text-white`}>
          {a.busy === "wa" ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}Kirim WA
        </button>
      ) : a.canShare ? (
        <button type="button" disabled={!!a.busy} onClick={a.bagikan} className={`${btn} bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white`}>
          <Share2 className="w-5 h-5" />Bagikan PDF
        </button>
      ) : null}
    </div>
  );
};

// ============================================================
// Lembar checkout
// ============================================================

type Props = {
  open: boolean;
  onClose: () => void;
  lines: CheckoutLine[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  metode: "CASH" | "TRANSFER";
  setMetode: (m: "CASH" | "TRANSFER") => void;
  kasirNama: string;
  categories: StokKategori[];
  data: Record<string, Record<string, StokItemValue>>;
  /** Dipanggil begitu transaksi tersimpan (kosongkan keranjang). */
  onCompleted: (sale: PosSale) => void;
};

const PosCheckoutSheet: React.FC<Props> = ({
  open, onClose, lines, subtotal, discountPercent, discountAmount, total, metode, setMetode, kasirNama, categories, data, onCompleted,
}) => {
  useBodyScrollLock(open);
  const [pembeli, setPembeli] = useState("");
  const [pembeliWa, setPembeliWa] = useState("");
  const [variant, setVariant] = useState<Record<string, string>>({});
  const [bukti, setBukti] = useState("");
  const [saving, setSaving] = useState<"" | "pdf" | "thermal" | "none">("");
  const [error, setError] = useState("");
  const [sale, setSale] = useState<PosSale | null>(null);
  const actions = useNotaActions(sale);

  useEffect(() => { if (open) preloadNotaAssets(); }, [open]);

  const reset = () => {
    setPembeli(""); setPembeliWa(""); setVariant({}); setBukti(""); setError(""); setSale(null); setSaving(""); actions.setMsg("");
  };
  const close = () => {
    if (saving) return;
    const wasDone = !!sale;
    if (wasDone) reset();
    onClose();
  };

  const resolved = useMemo(
    () =>
      lines.map((l) => {
        const r = l.stokRef || null;
        if (!r) return { line: l, ref: null as StokRef | null, pilih: null as string | null };
        if (r.item === PILIH_SAAT_CHECKOUT) {
          const v = variant[l.id];
          return { line: l, ref: v ? { kategori: r.kategori, item: v } : null, pilih: r.kategori };
        }
        return { line: l, ref: r, pilih: null };
      }),
    [lines, variant]
  );
  const needByKey = useMemo(() => {
    const m = new Map<string, number>();
    resolved.forEach((x) => { if (x.ref) m.set(refKey(x.ref), (m.get(refKey(x.ref)) || 0) + x.line.quantity); });
    return m;
  }, [resolved]);
  // Barang ada di master tapi belum pernah diisi stoknya = 0; null = barang sudah tidak ada di master
  const sisaOf = (r: StokRef): number | null => {
    const v = data?.[r.kategori]?.[r.item];
    if (v) return Math.max(0, Math.round(Number(v.jumlah) || 0));
    return categories.some((c) => c.kategori === r.kategori && c.items.includes(r.item)) ? 0 : null;
  };
  const belumPilih = resolved.filter((x) => x.pilih && !x.ref);
  const jumlahBarang = lines.reduce((s, l) => s + l.quantity, 0);
  const butuhBukti = metode === "TRANSFER" && !bukti;

  const simpan = async (mode: "pdf" | "thermal" | "none") => {
    if (saving || !lines.length) return;
    if (belumPilih.length) { setError(`Pilih varian stok untuk "${belumPilih[0].line.name}".`); return; }
    if (butuhBukti) { setError("Upload foto bukti transfer dulu."); return; }
    setSaving(mode);
    setError("");
    const items: PosItem[] = resolved.map(({ line: l, ref }) => ({
      id: l.id,
      nama: l.name,
      kategori: l.category,
      subkategori: l.subcategory || null,
      platform: l.platform || null,
      harga: l.price,
      qty: l.quantity,
      subtotal: l.price * l.quantity,
      stokRef: ref,
    }));
    let s: PosSale;
    try {
      s = await commitPosSale({
        kasirNama,
        pembeli: pembeli.trim() || "Pelanggan",
        pembeliWa: waDigits(pembeliWa) || undefined,
        metode,
        buktiTransfer: metode === "TRANSFER" ? bukti : undefined,
        items,
        subtotal,
        diskonPersen: discountPercent,
        diskon: discountAmount,
        total,
      });
    } catch (e: any) {
      setError("Transaksi gagal disimpan: " + (e?.message || e) + ". Stok tidak berubah, coba lagi.");
      setSaving("");
      return;
    }
    setSale(s);
    onCompleted(s);
    try {
      if (mode === "pdf") (await buildNotaPdf(s)).save(notaFileName(s));
      if (mode === "thermal") {
        const r = await printNotaThermal(s);
        actions.setMsg(r === "bluetooth" ? "Nota terkirim ke printer ✅" : r === "rawbt" ? "Nota dibuka di aplikasi RawBT 🖨️" : "Cetak dibatalkan — ketuk Cetak Thermal untuk mencoba lagi.");
      }
    } catch (e: any) {
      actions.setMsg((e?.message || String(e)) + " — transaksi tetap tersimpan.");
    }
    setSaving("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center font-sans">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={close} />
      <div className="relative w-full sm:max-w-md bg-zinc-50 dark:bg-[#141416] rounded-t-[26px] sm:rounded-[26px] max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex justify-center pt-2 sm:hidden"><div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>

        {!sale ? (
          <>
            <div className="px-4 pt-2 pb-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-[18px] font-black text-zinc-900 dark:text-white leading-tight">Selesaikan Transaksi</h3>
                <p className="text-[12px] text-zinc-500">{jumlahBarang} barang · kasir {kasirNama}</p>
              </div>
              <button type="button" onClick={close} aria-label="Tutup" className="w-9 h-9 rounded-full bg-zinc-200/70 dark:bg-zinc-800 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
              {/* Total */}
              <div className="rounded-[20px] bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-3.5">
                <div className="text-[11px] font-bold uppercase tracking-widest opacity-60">Total bayar</div>
                <div className="text-[30px] font-black font-mono tracking-tight leading-none mt-1">{rp(total)}</div>
                {discountAmount > 0 && (
                  <div className="text-[12px] mt-1.5 opacity-80">
                    <span className="line-through opacity-60 mr-1.5">{rp(subtotal)}</span>hemat {rp(discountAmount)} ({discountPercent}%)
                  </div>
                )}
              </div>

              {/* Pembeli */}
              <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-3.5 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Pembeli</div>
                <input value={pembeli} onChange={(e) => setPembeli(e.target.value)} placeholder="Nama pembeli (kosong = Pelanggan)" autoComplete="off"
                  className="w-full h-12 px-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[15px] font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-white/20" />
                <input value={pembeliWa} onChange={(e) => setPembeliWa(e.target.value)} inputMode="tel" placeholder="No. WhatsApp (opsional, untuk garansi)" autoComplete="off"
                  className="w-full h-12 px-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[15px] font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-zinc-900/20 dark:focus:ring-white/20" />
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800">
                  {(["CASH", "TRANSFER"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMetode(m)}
                      className={`h-10 rounded-[10px] text-[13px] font-bold transition ${metode === m ? (m === "CASH" ? "bg-emerald-600 text-white shadow" : "bg-blue-600 text-white shadow") : "text-zinc-500"}`}>
                      {m === "CASH" ? "Tunai" : "Transfer / QRIS"}
                    </button>
                  ))}
                </div>
                {metode === "TRANSFER" && (
                  <div className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 ${bukti ? "bg-blue-50 dark:bg-blue-500/10" : "bg-amber-50 dark:bg-amber-500/10 ring-1 ring-amber-300/60 dark:ring-amber-500/30"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-bold text-zinc-900 dark:text-white">Bukti transfer</div>
                      <div className={`text-[12px] ${bukti ? "text-blue-700 dark:text-blue-300" : "text-amber-700 dark:text-amber-400"}`}>
                        {bukti ? "Terupload ✓ · ketuk foto untuk lihat" : "Wajib · foto / screenshot bukti transfer"}
                      </div>
                    </div>
                    <UploadTransferProof value={bukti} onChange={setBukti} />
                  </div>
                )}
              </div>

              {/* Barang & stok */}
              <div className="rounded-[20px] bg-white dark:bg-[#1c1c1e] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Barang & stok</div>
                  <Package className="w-4 h-4 text-zinc-300" />
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-white/5">
                  {resolved.map(({ line: l, ref, pilih }) => {
                    const sisa = ref ? sisaOf(ref) : null;
                    const need = ref ? needByKey.get(refKey(ref)) || 0 : 0;
                    const sesudah = sisa === null ? null : sisa - need;
                    const kategoriItems = pilih ? categories.find((c) => c.kategori === pilih)?.items || [] : [];
                    return (
                      <div key={l.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 text-[13.5px] font-bold text-zinc-900 dark:text-white leading-snug">
                            {l.category === "ISI GAME" && l.platform ? `${l.name} (${l.platform})` : l.name}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[13px] font-black font-mono text-zinc-900 dark:text-white">{rp(l.price * l.quantity)}</div>
                            <div className="text-[11px] text-zinc-400">{l.quantity} × {rp(l.price)}</div>
                          </div>
                        </div>
                        {pilih && (
                          <select value={variant[l.id] || ""} onChange={(e) => { setVariant((v) => ({ ...v, [l.id]: e.target.value })); setError(""); }}
                            className={`mt-2 w-full h-11 px-3 rounded-xl text-[13px] font-semibold ${variant[l.id] ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white" : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-1 ring-amber-300/60"}`}>
                            <option value="">Pilih varian {pilih.toLowerCase()}…</option>
                            {kategoriItems.map((it) => {
                              const n = data?.[pilih]?.[it]?.jumlah;
                              return <option key={it} value={it}>{it}{typeof n === "number" ? ` — sisa ${n}` : ""}</option>;
                            })}
                          </select>
                        )}
                        {ref && sisa !== null && !data?.[ref.kategori]?.[ref.item] && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11.5px] font-bold bg-zinc-100 text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
                            <Package className="w-3.5 h-3.5" />Stok {ref.item} belum dihitung — isi di menu Stok
                          </div>
                        )}
                        {ref && sisa !== null && !!data?.[ref.kategori]?.[ref.item] && (
                          <div className={`mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11.5px] font-bold ${sesudah! < 0 ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : sesudah === 0 ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"}`}>
                            {sesudah! < 0 ? <AlertTriangle className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                            {sesudah! < 0 ? `Stok tercatat ${sisa}, butuh ${need} — cek stok fisik` : `Stok ${ref.item}: ${sisa} → ${sesudah}${sesudah === 0 ? " (habis)" : ""}`}
                          </div>
                        )}
                        {ref && sisa === null && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11.5px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" />Barang stok "{ref.item}" tidak ditemukan — hubungkan ulang
                          </div>
                        )}
                        {!l.stokRef && l.category === "JUALAN" && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                            <Link2Off className="w-3.5 h-3.5" />Belum terhubung ke stok — stok tidak berkurang
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-white dark:bg-[#1c1c1e] border-t border-zinc-200/70 dark:border-white/5 space-y-2">
              {error && <div className="text-[12.5px] font-semibold text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}
              {butuhBukti && !error && <div className="text-[12.5px] font-semibold text-amber-700 dark:text-amber-400 text-center">Upload bukti transfer untuk melanjutkan</div>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={!!saving || !lines.length || butuhBukti} onClick={() => simpan("thermal")}
                  className="h-[52px] rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[14px] font-black flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]">
                  {saving === "thermal" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}Cetak Struk
                </button>
                <button type="button" disabled={!!saving || !lines.length || butuhBukti} onClick={() => simpan("pdf")}
                  className="h-[52px] rounded-2xl bg-red-600 text-white text-[14px] font-black flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]">
                  {saving === "pdf" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}Nota PDF
                </button>
              </div>
              <button type="button" disabled={!!saving || !lines.length || butuhBukti} onClick={() => simpan("none")}
                className="w-full h-9 text-[12.5px] font-bold text-zinc-500 disabled:opacity-50">
                {saving === "none" ? "Menyimpan…" : "Simpan tanpa cetak"}
              </button>
              <p className="text-[11px] text-center text-zinc-400 -mt-1">Transaksi tersimpan & stok barang terhubung otomatis berkurang.</p>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 pt-2 pb-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0"><CheckCircle2 className="w-6 h-6" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[17px] font-black text-zinc-900 dark:text-white leading-tight">Transaksi tersimpan</h3>
                <p className="text-[12px] text-zinc-500 font-mono">{sale.noNota} · {rp(sale.total)}</p>
              </div>
              <button type="button" onClick={close} aria-label="Tutup" className="w-9 h-9 rounded-full bg-zinc-200/70 dark:bg-zinc-800 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
              {actions.msg && <div className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-[#1c1c1e] rounded-xl px-3 py-2">{actions.msg}</div>}

              {(sale.stokKurang?.length || 0) > 0 && (
                <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 text-[12px] text-amber-800 dark:text-amber-300">
                  <div className="font-black flex items-center gap-1.5 mb-1"><AlertTriangle className="w-4 h-4" />Stok tercatat kurang</div>
                  {sale.stokKurang!.map((k) => (
                    <div key={k.kategori + k.item}>• {k.kategori} › {k.item}: terjual {k.diminta}, tercatat {k.tersedia}. Cek & koreksi stok fisik.</div>
                  ))}
                </div>
              )}

              {sale.items.some((it) => it.stokRef) && (
                <div className="rounded-2xl bg-white dark:bg-[#1c1c1e] p-3">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Stok berkurang</div>
                  {Array.from(
                    sale.items.reduce((m, it) => {
                      if (it.stokRef) { const k = refKey(it.stokRef); m.set(k, { ref: it.stokRef, qty: (m.get(k)?.qty || 0) + it.qty }); }
                      return m;
                    }, new Map<string, { ref: StokRef; qty: number }>()).values()
                  ).map(({ ref, qty }) => {
                    const now = sale.stokSesudah?.[refKey(ref)] ?? sisaOf(ref);
                    const kurang = sale.stokKurang?.find((k) => k.kategori === ref.kategori && k.item === ref.item);
                    const terpotong = kurang ? Math.min(qty, kurang.tersedia) : qty;
                    return (
                      <div key={refKey(ref)} className="flex items-center justify-between text-[12.5px] py-0.5">
                        <span className="text-zinc-700 dark:text-zinc-300 truncate pr-2">{ref.kategori} › <b>{ref.item}</b></span>
                        <span className="shrink-0 font-mono font-bold">
                          {terpotong > 0 ? <span className="text-red-600">−{terpotong}</span> : <span className="text-amber-600">tdk terpotong</span>}
                          <span className="text-zinc-400"> · sisa {now ?? "-"}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="rounded-[22px] bg-zinc-200/60 dark:bg-black/40 p-3">
                <NotaPreview sale={sale} />
              </div>
            </div>

            <div className="px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-white dark:bg-[#1c1c1e] border-t border-zinc-200/70 dark:border-white/5 space-y-2">
              <NotaActionButtons sale={sale} actions={actions} />
              <button type="button" onClick={close}
                className="w-full h-12 rounded-2xl bg-blue-600 text-white text-[15px] font-black flex items-center justify-center gap-2 active:scale-[0.98]">
                <PlusCircle className="w-5 h-5" />Transaksi Baru
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PosCheckoutSheet;
