import React, { useEffect, useMemo, useState } from "react";
import { X, CheckCircle2, Download, Printer, Share2, AlertTriangle, Package, Loader2, MessageCircle, PlusCircle, Link2Off, Handshake, Pencil, RotateCcw, Clock, ArrowLeftRight } from "lucide-react";
import logoBlack from "../assets/urban-logo-black.png";
import { Button, Card, Eyebrow, Notice, Pill, Sheet } from "../ui";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { adaTukarTambah, bayarNota, commitPosSale, infoNego, nilaiTukarNota, isBonus, Kondisi, negoSatuan, PILIH_SAAT_CHECKOUT, PosItem, PosSale, simpanNotaOnline, sisaBayar, StokRef } from "../lib/posSales";
import { UploadTransferProof } from "./TableEditor";
import { barangTukarTambah, barisPembayaran, belumDibayar, belumLunas, statusTegas, buildNotaPdf, fmtTanggalNota, isNotaSewa, judulNota, KETENTUAN_DP, kotakSyarat, labelPembeli, notaFileName, preloadNotaAssets, printNotaThermal, STORE, teksPembayaran, teksPenutup, teksStatusBayar } from "../lib/posReceipt";
import { rupiah } from "../lib/format";
import { toLocalYmd } from "../lib/dateLocal";
import { kunciStok } from "../lib/stokJualan";
import { linkWa, rapikanWa } from "../lib/wa";
import { DraftTukar, KartuTukarTambah, TukarTambahSheet } from "./TukarTambahSheet";
import { labelBayarTukar } from "../lib/posReceipt";

export type CheckoutLine = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  platform?: string;
  subcategory?: string;
  kondisi?: Kondisi;
  stokRef?: StokRef | null;
};


// ============================================================
// Pratinjau nota (sama dengan PDF / thermal)
// ============================================================

export const NotaPreview: React.FC<{ sale: PosSale }> = ({ sale: s }) => {
  const ng = infoNego(s);
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
        <div className="text-[13px] font-black tracking-[0.12em]">{judulNota(s)}</div>
        <div className="text-[11px] font-bold font-mono mt-0.5">{s.noNota}</div>
      </div>
      <div className="mt-2.5 space-y-0.5 text-[11px]">
        <Row l="Tanggal" r={fmtTanggalNota(s.ts)} />
        <Row l={isNotaSewa(s) ? "Admin" : "Kasir"} r={s.kasirNama || s.kasir.split("@")[0]} />
        <Row l={labelPembeli(s)} r={s.pembeli || "Pelanggan"} />
        {s.pembeliWa && <Row l={`WA ${labelPembeli(s)}`} r={s.pembeliWa} />}
        {(s.infoNota || []).map((x) => <Row key={x.l} l={x.l} r={x.r} />)}
        <Row l="Pembayaran" r={teksPembayaran(s)} />
      </div>
      <div className="border-t border-dashed border-zinc-400 my-2.5" />
      <div className="space-y-2">
        {s.items.map((it, i) => (
          <div key={i} className="text-[11px]">
            <div className="font-bold leading-snug">{it.kategori === "ISI GAME" && it.platform ? `${it.nama} (${it.platform})` : it.nama}</div>
            <div className="flex justify-between text-zinc-700 font-mono">
              <span>{it.qty} x {rupiah(it.harga)}{isBonus(it) ? " · BONUS" : ""}</span>
              <span className="text-black">{rupiah(it.subtotal)}</span>
            </div>
            {negoSatuan(it) !== 0 && (
              <div className="text-[9.5px] italic text-zinc-500 font-mono">
                Harga normal {rupiah(it.hargaNormal!)} · nego kasir {negoSatuan(it) > 0 ? "−" : "+"}{rupiah(Math.abs(negoSatuan(it)))}/pcs
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-dashed border-zinc-400 my-2.5" />
      {barangTukarTambah(s).length > 0 && (
        <>
          <div className="text-[10px] font-black tracking-[0.08em] mb-1.5">BARANG TUKAR TAMBAH (MASUK)</div>
          <div className="space-y-2">
            {barangTukarTambah(s).map((t, i) => (
              <div key={i} className="text-[11px]">
                <div className="font-bold leading-snug">{t.nama}</div>
                {t.sn && <div className="text-[9.5px] text-zinc-500 font-mono">SN {t.sn}</div>}
                <div className="flex justify-between text-zinc-700 font-mono">
                  <span>{t.qty} x {rupiah(t.nilai)}</span>
                  <span className="text-black">-{rupiah(t.subtotal)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-zinc-400 my-2.5" />
        </>
      )}
      {(ng.ada || s.diskon > 0) && (
        <div className="space-y-0.5 text-[11px] mb-2 font-mono">
          {ng.ada && (
            <>
              <Row l="Harga normal" r={rupiah(ng.hargaNormal)} />
              <Row l={ng.labelBaris} r={`${ng.total >= 0 ? "-" : "+"}${rupiah(Math.abs(ng.total))}`} />
            </>
          )}
          {s.diskon > 0 && (
            <>
              <Row l="Subtotal" r={rupiah(s.subtotal)} />
              <Row l={`Diskon promo (${s.diskonPersen}%)`} r={`-${rupiah(s.diskon)}`} />
            </>
          )}
        </div>
      )}
      <div className="bg-black text-white flex items-center justify-between px-3 py-2 rounded-[3px]">
        <span className="text-[12px] font-black tracking-wider">TOTAL</span>
        <span className="text-[15px] font-black font-mono">{rupiah(s.total)}</span>
      </div>
      {barisPembayaran(s).length > 0 && (
        <div className="mt-2 space-y-0.5 text-[11px] font-mono">
          {barisPembayaran(s).map((b) => <Row key={b.l} l={b.l} r={b.r} bold={b.bold} />)}
        </div>
      )}
      {statusTegas(s) ? (
        <div className={`mt-2.5 mx-auto w-fit max-w-full text-center rounded-md border-2 px-3 py-1 font-black ${belumLunas(s) ? "border-red-600 text-red-600 text-[13px] tracking-[0.14em]" : s.batal ? "border-zinc-700 text-zinc-700 text-[11px] tracking-wide" : "border-black text-black text-[13px] tracking-[0.14em]"}`}>
          {teksStatusBayar(s).replace(" - ", " · ")}
        </div>
      ) : (
        <div className="text-center text-[10.5px] font-bold mt-2 tracking-wide">
          {teksStatusBayar(s).replace(" - ", " · ")}
        </div>
      )}
      {ng.ada && (
        <div className="mt-2.5 rounded-md border border-dashed border-zinc-500 px-2.5 py-1.5 text-center text-[10px] leading-snug text-zinc-700">
          <b>Catatan:</b> {ng.catatan}.
        </div>
      )}
      <div className="mt-3 rounded-md border-[1.5px] border-black px-3 py-2 text-center">
        <div className="text-[11px] font-black tracking-wide">{kotakSyarat(s).judul}</div>
        {kotakSyarat(s).isi.map((t, i) => (
          <div key={i} className="text-[10px] leading-snug text-zinc-700 mt-0.5">{t}</div>
        ))}
      </div>
      <div className="text-center mt-3.5">
        <div className="text-[12px] font-black">{teksPenutup(s)}</div>
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
    const sewa = isNotaSewa(sale);
    const pesan = (link: string) => [
      `Halo ${sale.pembeli || "Kak"}, terima kasih sudah ${sewa ? "menyewa" : "berbelanja"} di *${STORE.nama}* 🙏`,
      ``,
      `No. Nota: *${sale.noNota}*`,
      ...sale.items.map((it) => `• ${it.nama} (${it.qty}x) ${isBonus(it) ? "BONUS" : rupiah(it.subtotal)}`),
      ...(barangTukarTambah(sale).length
        ? [`Tukar tambah (barang masuk):`, ...barangTukarTambah(sale).map((t) => `• ${t.nama}${t.sn ? ` · SN ${t.sn}` : ""} −${rupiah(t.subtotal)}`)]
        : []),
      ...(sale.infoNota || []).map((x) => `${x.l}: ${x.r}`),
      ...(infoNego(sale).ada ? [`_Catatan: ${infoNego(sale).catatan}._`] : []),
      belumDibayar(sale)
        ? `Total: *${rupiah(sale.total)}* — BELUM DIBAYAR`
        : sale.status === "DP" || sale.status === "BATAL_PEMBELI" || sale.status === "BATAL_URBAN" || sale.pembayaran?.length
          ? `Total: *${rupiah(sale.total)}* — *${teksStatusBayar(sale)}*`
          : adaTukarTambah(sale)
            ? `Total: *${rupiah(sale.total)}* — *${teksStatusBayar(sale)}*`
            : `Total: *${rupiah(sale.total)}* — LUNAS (${sale.metode === "TRANSFER" ? "Transfer/QRIS" : "Tunai"})`,
      ...barisPembayaran(sale).map((b) => (b.bold ? `${b.l}: *${b.r}*` : `${b.l}: ${b.r}`)),
      ``,
      ...(link ? [`📄 Nota PDF: ${link}`, ``] : []),
      ...(sale.status === "DP" || sale.status === "BATAL_PEMBELI" || sale.status === "BATAL_URBAN"
        ? KETENTUAN_DP.isi.map((t) => `_${t}_`)
        : [sewa ? `_Tunjukkan nota ini saat pengembalian unit._` : `_Simpan nota / invoice ini untuk keperluan klaim garansi._`]),
      `IG ${STORE.ig} · WA ${STORE.wa}`,
    ].join("\n");
    const waLink = (link: string) => linkWa(sale.pembeliWa, pesan(link));
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
  const btn = "flex flex-col items-center justify-center gap-1 min-h-[60px] rounded-tile text-caption font-semibold active:scale-[0.98] transition-all disabled:opacity-40";
  return (
    <div className={`grid gap-2 ${sale.pembeliWa || a.canShare ? "grid-cols-3" : "grid-cols-2"}`}>
      <button type="button" disabled={!!a.busy} onClick={a.cetak} className={`${btn} bg-action text-action-label hover:opacity-90`}>
        {a.busy === "thermal" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}Cetak Thermal
      </button>
      <button type="button" disabled={!!a.busy} onClick={a.unduh} className={`${btn} bg-negative text-white hover:opacity-90`}>
        {a.busy === "pdf" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}Unduh PDF
      </button>
      {sale.pembeliWa ? (
        <button type="button" disabled={!!a.busy} onClick={a.kirimWa} className={`${btn} bg-positive text-white hover:opacity-90`}>
          {a.busy === "wa" ? <Loader2 className="w-5 h-5 animate-spin" /> : <MessageCircle className="w-5 h-5" />}Kirim WA
        </button>
      ) : a.canShare ? (
        <button type="button" disabled={!!a.busy} onClick={a.bagikan} className={`${btn} bg-fill text-label hover:brightness-95 dark:hover:brightness-110`}>
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
  /** Barang yang sedang dipesan lewat nota DP: "kategori||item" -> jumlah */
  dipesan?: Map<string, number>;
  /** Hitung ulang diskon promo bila kasir mengubah harga (aturan promo yang sama dengan keranjang). */
  hitungDiskon?: (items: { price: number; quantity: number; platform?: string; category: string }[]) => {
    subtotal: number;
    discountPercent: number;
    discountAmount: number;
    total: number;
  };
};

/** Tanggal (YYYY-MM-DD) n hari dari sekarang. */
const tanggalNanti = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toLocalYmd(d);
};
const JATUH_TEMPO_BAWAAN = 7;

const ribuan = (s: string) => {
  const d = String(s || "").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
};

const PosCheckoutSheet: React.FC<Props> = ({
  open, onClose, lines, subtotal, discountPercent, discountAmount, total, metode, setMetode, kasirNama, categories, data, onCompleted, hitungDiskon, dipesan,
}) => {
  const [pembeli, setPembeli] = useState("");
  const [pembeliWa, setPembeliWa] = useState("");
  const [variant, setVariant] = useState<Record<string, string>>({});
  const [bukti, setBukti] = useState("");
  const [saving, setSaving] = useState<"" | "pdf" | "thermal" | "none">("");
  const [error, setError] = useState("");
  const [sale, setSale] = useState<PosSale | null>(null);
  // Nego: harga satuan baru per baris keranjang (id -> harga)
  const [hargaNego, setHargaNego] = useState<Record<string, number>>({});
  const [editHarga, setEditHarga] = useState<string | null>(null);
  const [draftHarga, setDraftHarga] = useState("");
  // Cara bayar: lunas sekarang, atau DP (stok baru berkurang saat pelunasan)
  const [caraBayar, setCaraBayar] = useState<"LUNAS" | "DP">("LUNAS");
  const [dpStr, setDpStr] = useState("");
  const [jatuhTempo, setJatuhTempo] = useState(() => tanggalNanti(JATUH_TEMPO_BAWAAN));
  // Tukar tambah: barang pembeli yang masuk sebagai potongan (null = lembar tertutup, "" = barang baru)
  const [tukar, setTukar] = useState<DraftTukar[]>([]);
  const [ubahTukar, setUbahTukar] = useState<string | null>(null);
  const actions = useNotaActions(sale);

  useEffect(() => { if (open) preloadNotaAssets(); }, [open]);

  const reset = () => {
    setPembeli(""); setPembeliWa(""); setVariant({}); setBukti(""); setError(""); setSale(null); setSaving(""); actions.setMsg("");
    setHargaNego({}); setEditHarga(null); setDraftHarga("");
    setCaraBayar("LUNAS"); setDpStr(""); setJatuhTempo(tanggalNanti(JATUH_TEMPO_BAWAAN));
    setTukar([]); setUbahTukar(null);
  };

  // ---------- Nego harga oleh kasir ----------
  const hargaAkhir = (l: CheckoutLine) => (typeof hargaNego[l.id] === "number" ? hargaNego[l.id] : l.price);
  const negoBaris = (l: CheckoutLine) => (l.price - hargaAkhir(l)) * l.quantity;
  const totalNego = lines.reduce((s, l) => s + negoBaris(l), 0);
  const adaNego = lines.some((l) => hargaAkhir(l) !== l.price);
  const hitung = useMemo(() => {
    if (!adaNego) return { subtotal, discountPercent, discountAmount, total };
    const items = lines.map((l) => ({ price: hargaAkhir(l), quantity: l.quantity, platform: l.platform, category: l.category }));
    if (hitungDiskon) return hitungDiskon(items);
    const sub = items.reduce((s, it) => s + it.price * it.quantity, 0);
    const disk = Math.min(discountAmount, sub);
    return { subtotal: sub, discountPercent, discountAmount: disk, total: sub - disk };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adaNego, lines, hargaNego, subtotal, discountPercent, discountAmount, total, hitungDiskon]);

  const mulaiUbahHarga = (l: CheckoutLine) => {
    setEditHarga(l.id);
    setDraftHarga(ribuan(String(hargaAkhir(l))));
    setError("");
  };
  const simpanHarga = (l: CheckoutLine) => {
    const digit = draftHarga.replace(/[^\d]/g, "");
    if (!digit) { setEditHarga(null); return; }
    const n = Math.round(Number(digit));
    if (n === 0 && !window.confirm(`Jadikan ${l.name} GRATIS (Rp 0)?`)) return;
    setHargaNego((m) => {
      const x = { ...m };
      if (n === l.price) delete x[l.id];
      else x[l.id] = n;
      return x;
    });
    setEditHarga(null);
  };
  const kembalikanHarga = (id: string) =>
    setHargaNego((m) => {
      const x = { ...m };
      delete x[id];
      return x;
    });
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
    resolved.forEach((x) => { if (x.ref) m.set(kunciStok(x.ref), (m.get(kunciStok(x.ref)) || 0) + x.line.quantity); });
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
  const isDp = caraBayar === "DP";
  // Tukar tambah hanya untuk nota lunas yang menjual barang
  const bisaTukar = !isDp && lines.some((l) => l.category === "JUALAN");
  const adaTukar = bisaTukar && tukar.length > 0;
  const nilaiTukar = adaTukar ? tukar.reduce((a, t) => a + t.nilai * t.qty, 0) : 0;
  const bayar = hitung.total - nilaiTukar; // negatif = URBAN membayar ke pembeli
  const tanpaUang = adaTukar && bayar === 0;
  const butuhBukti = metode === "TRANSFER" && !bukti && !tanpaUang;
  const nominalDp = Math.round(Number(dpStr.replace(/[^\d]/g, "")) || 0);
  const dpSalah = isDp && (!(nominalDp > 0) || nominalDp >= hitung.total);
  const jatuhTempoSalah = isDp && (!/^\d{4}-\d{2}-\d{2}$/.test(jatuhTempo) || jatuhTempo < tanggalNanti(0));
  const dipesanLain = (r: StokRef) => dipesan?.get(kunciStok(r)) || 0;

  const simpan = async (mode: "pdf" | "thermal" | "none") => {
    if (saving || !lines.length) return;
    if (belumPilih.length) { setError(`Pilih varian stok untuk "${belumPilih[0].line.name}".`); return; }
    if (butuhBukti) { setError("Upload foto bukti transfer dulu."); return; }
    if (editHarga) { setError("Selesaikan ubah harga dulu (ketuk OK)."); return; }
    if (dpSalah) { setError(`Nominal DP harus lebih dari Rp 0 dan kurang dari total ${rupiah(hitung.total)}.`); return; }
    if (jatuhTempoSalah) { setError("Pilih tanggal jatuh tempo pelunasan (hari ini atau sesudahnya)."); return; }
    setSaving(mode);
    setError("");
    const items: PosItem[] = resolved.map(({ line: l, ref }) => {
      const h = hargaAkhir(l);
      return {
        id: l.id,
        nama: l.name,
        kategori: l.category,
        subkategori: l.subcategory || null,
        ...(l.kondisi ? { kondisi: l.kondisi } : {}),
        platform: l.platform || null,
        harga: h, // harga akhir (sesudah nego) -> analitik mengikuti harga ini
        ...(h !== l.price ? { hargaNormal: l.price } : {}),
        qty: l.quantity,
        subtotal: h * l.quantity,
        stokRef: ref,
      };
    });
    let s: PosSale;
    try {
      s = await commitPosSale({
        kasirNama,
        pembeli: pembeli.trim() || "Pelanggan",
        pembeliWa: rapikanWa(pembeliWa) || undefined,
        metode: tanpaUang ? "CASH" : metode,
        buktiTransfer: metode === "TRANSFER" && !tanpaUang ? bukti : undefined,
        items,
        subtotal: hitung.subtotal,
        ...(adaNego ? { nego: totalNego, negoOleh: kasirNama } : {}),
        diskonPersen: hitung.discountPercent,
        diskon: hitung.discountAmount,
        total: hitung.total,
      }, isDp ? { dp: { jumlah: nominalDp, jatuhTempo } } : adaTukar ? { tukarTambah: tukar.map(({ key, ...t }) => t) } : {});
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

  const sheetFooter = !sale ? (
    <div className="space-y-2">
      {error && <Notice tone="negative">{error}</Notice>}
      {butuhBukti && !error && (
        <p className="text-caption font-semibold text-warning text-center">
          Upload bukti transfer untuk melanjutkan
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="filled"
          size="lg"
          loading={saving === "thermal"}
          disabled={!!saving || !lines.length || butuhBukti || dpSalah || jatuhTempoSalah}
          icon={<Printer />}
          onClick={() => simpan("thermal")}
        >
          Cetak Struk
        </Button>
        <Button
          variant="destructive"
          size="lg"
          loading={saving === "pdf"}
          disabled={!!saving || !lines.length || butuhBukti || dpSalah || jatuhTempoSalah}
          icon={<Download />}
          onClick={() => simpan("pdf")}
          className="!bg-negative !text-white hover:opacity-90"
        >
          Nota PDF
        </Button>
      </div>
      <Button
        variant="plain"
        size="sm"
        block
        disabled={!!saving || !lines.length || butuhBukti || dpSalah || jatuhTempoSalah}
        onClick={() => simpan("none")}
        className="text-label-2"
      >
        {saving === "none" ? "Menyimpan…" : "Simpan tanpa cetak"}
      </Button>
      <p className="text-caption2 text-center text-label-3">
        {isDp
          ? "Nota DP tersimpan BELUM LUNAS · stok berkurang saat pelunasan."
          : adaTukar
            ? "Stok barang dijual berkurang · barang tukar tambah menunggu konfirmasi stok."
            : "Transaksi tersimpan & stok barang terhubung otomatis berkurang."}
      </p>
    </div>
  ) : (
    <div className="space-y-2">
      <NotaActionButtons sale={sale} actions={actions} />
      <Button
        variant="filled"
        size="lg"
        block
        icon={<PlusCircle />}
        onClick={close}
      >
        Transaksi Baru
      </Button>
    </div>
  );

  return (
    <>
      <Sheet
        open={open}
        onClose={close}
        size="sm"
        variant="grouped"
        zClassName="z-[250]"
        icon={sale ? <CheckCircle2 /> : undefined}
        iconColor={sale ? "green" : undefined}
        title={
          !sale
            ? "Selesaikan Transaksi"
            : sale.status === "DP"
              ? "Nota DP Tersimpan"
              : "Transaksi Tersimpan"
        }
        subtitle={
          !sale
            ? `${jumlahBarang} barang · kasir ${kasirNama}`
            : sale.status === "DP"
              ? `${sale.noNota} · DP ${rupiah(sale.dp || 0)} · sisa ${rupiah(sisaBayar(sale))}`
              : adaTukarTambah(sale)
                ? `${sale.noNota} · ${bayarNota(sale) < 0 ? "ke pembeli " : ""}${rupiah(Math.abs(bayarNota(sale)))}`
                : `${sale.noNota} · ${rupiah(sale.total)}`
        }
        footer={sheetFooter}
      >
        {!sale ? (
          <div className="space-y-3">
            {/* Total */}
            <div className="rounded-card bg-action text-action-label px-4 py-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-70">
                {adaTukar ? labelBayarTukar(bayar) : "Total Bayar"}
              </div>
              <div className="text-display font-mono tracking-tight leading-none mt-1 tabular-nums">
                {rupiah(adaTukar ? Math.abs(bayar) : hitung.total)}
              </div>
              {adaTukar && (
                <div className="text-footnote mt-1.5 opacity-85">
                  Total barang {rupiah(hitung.total)} · tukar tambah −{rupiah(nilaiTukar)}
                </div>
              )}
              {adaNego && (
                <div className="text-footnote mt-1.5 opacity-85 flex items-center gap-1.5 flex-wrap">
                  <Handshake className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Harga normal <span className="line-through opacity-75">{rupiah(hitung.subtotal + totalNego)}</span>
                  </span>
                  <span>
                    · nego {totalNego >= 0 ? "−" : "+"}
                    {rupiah(Math.abs(totalNego))}
                  </span>
                </div>
              )}
              {hitung.discountAmount > 0 && (
                <div className="text-footnote mt-1 opacity-85">
                  <span className="line-through opacity-70 mr-1.5">{rupiah(hitung.subtotal)}</span>
                  hemat promo {rupiah(hitung.discountAmount)} ({hitung.discountPercent}%)
                </div>
              )}
              {isDp && nominalDp > 0 && !dpSalah && (
                <div className="mt-2.5 pt-2.5 border-t border-action-label/15 grid grid-cols-2 gap-2 text-footnote">
                  <div>
                    <div className="opacity-70">Bayar sekarang (DP)</div>
                    <div className="text-subhead font-bold font-mono tabular-nums">{rupiah(nominalDp)}</div>
                  </div>
                  <div className="text-right">
                    <div className="opacity-70">Sisa saat pelunasan</div>
                    <div className="text-subhead font-bold font-mono tabular-nums">{rupiah(hitung.total - nominalDp)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Cara bayar: lunas / DP */}
            <Card bodyClassName="space-y-3">
              <Eyebrow>Cara Bayar</Eyebrow>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-full apple-segmented" role="tablist" aria-label="Cara bayar">
                {(["LUNAS", "DP"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={caraBayar === c}
                    disabled={c === "DP" && tukar.length > 0}
                    onClick={() => {
                      setCaraBayar(c);
                      setError("");
                    }}
                    className={`min-h-[38px] rounded-full text-footnote font-semibold transition-all disabled:opacity-40 ${
                      caraBayar === c ? "apple-segmented-thumb text-label" : "text-label-2 hover:text-label hover:bg-white/30 dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    {c === "LUNAS" ? "Bayar Lunas" : "Bayar DP"}
                  </button>
                ))}
              </div>
              {tukar.length > 0 && !isDp && (
                <p className="text-caption text-label-2">
                  Nota tukar tambah harus lunas — DP belum bisa dipakai.
                </p>
              )}
              {isDp && (
                <div className="space-y-3 pt-0.5">
                  <div>
                    <label htmlFor="nominal-dp" className="text-caption font-semibold text-label-2">
                      Nominal DP
                    </label>
                    <div
                      className={`mt-1 flex items-center h-11 px-3.5 rounded-field bg-fill transition-all focus-within:bg-surface focus-within:ring-2 focus-within:ring-tint/35 ${
                        dpStr && dpSalah ? "ring-2 ring-negative/50" : ""
                      }`}
                    >
                      <span className="text-subhead font-semibold text-label-3 mr-1.5">Rp</span>
                      <input
                        id="nominal-dp"
                        inputMode="numeric"
                        autoComplete="off"
                        value={dpStr}
                        onChange={(e) => {
                          setDpStr(ribuan(e.target.value));
                          setError("");
                        }}
                        placeholder="0"
                        className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-subhead font-semibold tabular-nums text-label placeholder:text-label-3 focus:outline-none"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {[30, 50].map((pct) => (
                        <Button
                          key={pct}
                          size="sm"
                          variant="gray"
                          onClick={() => setDpStr(ribuan(String(Math.round(((hitung.total * pct) / 100) / 1000) * 1000)))}
                        >
                          {pct}%
                        </Button>
                      ))}
                      {dpStr && dpSalah && (
                        <span className="text-caption font-semibold text-negative">Harus kurang dari total</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="jatuh-tempo" className="text-caption font-semibold text-label-2">
                      Jatuh tempo pelunasan
                    </label>
                    <input
                      id="jatuh-tempo"
                      type="date"
                      value={jatuhTempo}
                      min={tanggalNanti(0)}
                      onChange={(e) => {
                        setJatuhTempo(e.target.value);
                        setError("");
                      }}
                      className={`mt-1 w-full h-11 px-3.5 py-0 rounded-field bg-fill text-[16px] sm:text-subhead font-medium text-label focus:outline-none focus:bg-surface focus:ring-2 focus:ring-tint/35 ${
                        jatuhTempoSalah ? "ring-2 ring-negative/50" : ""
                      }`}
                    />
                    <div className="mt-2 flex gap-1.5">
                      {[7, 14].map((n) => (
                        <Button
                          key={n}
                          size="sm"
                          variant={jatuhTempo === tanggalNanti(n) ? "filled" : "gray"}
                          onClick={() => setJatuhTempo(tanggalNanti(n))}
                        >
                          {n} hari
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Notice tone="warning">
                    Nota tercatat <b>BELUM LUNAS</b>. Stok belum berkurang — barang berstatus <b>dipesan</b> sampai pelunasan di Kasir URBAN › Belum Lunas.
                  </Notice>
                </div>
              )}
            </Card>

            {/* Tukar tambah: barang pembeli masuk sebagai potongan */}
            {bisaTukar && <KartuTukarTambah daftar={tukar} onTambah={() => setUbahTukar("")} onUbah={(k) => setUbahTukar(k)} />}

            {/* Pembeli */}
            <Card bodyClassName="space-y-3">
              <Eyebrow>Pembeli</Eyebrow>
              <input
                value={pembeli}
                onChange={(e) => setPembeli(e.target.value)}
                placeholder="Nama pembeli (kosong = Pelanggan)"
                autoComplete="off"
                className="w-full h-11 px-3.5 rounded-field bg-fill text-[16px] sm:text-subhead font-medium text-label placeholder:text-label-3 focus:outline-none focus:bg-surface dark:focus:bg-[#2C2C2E] focus:ring-2 focus:ring-tint/35"
              />
              <input
                value={pembeliWa}
                onChange={(e) => setPembeliWa(e.target.value)}
                inputMode="tel"
                placeholder="No. WhatsApp (opsional, untuk garansi)"
                autoComplete="off"
                className="w-full h-11 px-3.5 rounded-field bg-fill text-[16px] sm:text-subhead font-medium text-label placeholder:text-label-3 focus:outline-none focus:bg-surface dark:focus:bg-[#2C2C2E] focus:ring-2 focus:ring-tint/35"
              />
              {tanpaUang ? (
                <p className="text-caption text-label-2 px-0.5">
                  Nilai tukar tambah sama dengan harga barang — tidak ada uang yang dibayar.
                </p>
              ) : (
                <>
                  {adaTukar && bayar < 0 && (
                    <div className="text-caption font-semibold text-label-2 px-0.5">
                      URBAN membayar ke pembeli lewat
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-full apple-segmented">
                    {(["CASH", "TRANSFER"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMetode(m)}
                        className={`min-h-[44px] rounded-full text-subhead font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                          metode === m ? "apple-segmented-thumb text-label" : "text-label-2 hover:text-label hover:bg-white/30 dark:hover:bg-white/[0.05]"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            metode === m ? (m === "CASH" ? "bg-positive" : "bg-tint") : "bg-label-4"
                          }`}
                          aria-hidden
                        />
                        {m === "CASH" ? "Tunai" : "Transfer / QRIS"}
                      </button>
                    ))}
                  </div>
                  {metode === "TRANSFER" && (
                    <div
                      className={`flex items-center gap-3 rounded-field px-3.5 py-2.5 ${
                        bukti
                          ? "bg-tint/10 dark:bg-tint/15 ring-1 ring-tint/25"
                          : "bg-warning/10 dark:bg-warning/15 ring-1 ring-warning/35"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-subhead font-semibold text-label">
                          {adaTukar && bayar < 0 ? "Bukti transfer ke pembeli" : "Bukti transfer"}
                        </div>
                        <div className={`text-caption ${bukti ? "text-tint" : "text-warning"}`}>
                          {bukti ? "Terupload ✓ · ketuk foto untuk lihat" : "Wajib · foto / screenshot bukti transfer"}
                        </div>
                      </div>
                      <UploadTransferProof value={bukti} onChange={setBukti} />
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* Barang & stok */}
            <Card>
              <div className="flex items-center justify-between mb-2.5">
                <Eyebrow>Barang, Harga & Stok</Eyebrow>
                <Package className="w-4 h-4 text-label-3" />
              </div>
              <div className="divide-y divide-sep">
                {resolved.map(({ line: l, ref, pilih }) => {
                  const sisa = ref ? sisaOf(ref) : null;
                  const need = ref ? needByKey.get(kunciStok(ref)) || 0 : 0;
                  const dip = ref ? dipesanLain(ref) : 0;
                  // Stok yang benar-benar bebas = stok tercatat − barang yang sudah dipesan lewat DP
                  const sesudah = sisa === null ? null : sisa - dip - need;
                  const kategoriItems = pilih ? categories.find((c) => c.kategori === pilih)?.items || [] : [];
                  const h = hargaAkhir(l);
                  const nego = negoBaris(l);
                  const diubah = h !== l.price;
                  return (
                    <div key={l.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 text-subhead font-semibold text-label leading-snug">
                          {l.category === "ISI GAME" && l.platform ? `${l.name} (${l.platform})` : l.name}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-subhead font-bold font-mono tabular-nums text-label">{rupiah(h * l.quantity)}</div>
                          <div className="text-caption text-label-3 tabular-nums">
                            {l.quantity} × {rupiah(h)}
                          </div>
                        </div>
                      </div>

                      {/* Nego harga */}
                      {editHarga === l.id ? (
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <label className="flex-1 min-w-0 flex items-center h-11 px-3 rounded-field bg-fill ring-2 ring-accent/40">
                              <span className="text-footnote font-semibold text-label-3 mr-1.5">Rp</span>
                              <input
                                autoFocus
                                inputMode="numeric"
                                aria-label={`Harga satuan baru ${l.name}`}
                                value={draftHarga}
                                onChange={(e) => setDraftHarga(ribuan(e.target.value))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") simpanHarga(l);
                                  if (e.key === "Escape") setEditHarga(null);
                                }}
                                className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-subhead font-semibold tabular-nums text-label focus:outline-none"
                              />
                              <span className="text-caption font-medium text-label-3 ml-1">/pcs</span>
                            </label>
                            <Button variant="filled" size="md" onClick={() => simpanHarga(l)}>
                              OK
                            </Button>
                            <button
                              type="button"
                              onClick={() => setEditHarga(null)}
                              aria-label="Batal ubah harga"
                              className="h-11 w-11 shrink-0 rounded-full bg-fill text-label-2 hover:text-label flex items-center justify-center active:scale-95"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="mt-1 text-caption text-label-2">
                            Harga normal {rupiah(l.price)}/pcs · harga baru dicatat di nota & analitik
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {!diubah && l.price === 0 && (
                            <Pill color="purple">
                              Bonus paket · stok tetap berkurang
                            </Pill>
                          )}
                          {diubah && (
                            <Pill color="purple" icon={<Handshake />}>
                              Nego {nego >= 0 ? "−" : "+"}
                              {rupiah(Math.abs(nego))}
                              <span className="font-normal opacity-80">
                                · normal <span className="line-through">{rupiah(l.price)}</span>
                              </span>
                            </Pill>
                          )}
                          <Button size="sm" variant="gray" icon={<Pencil />} onClick={() => mulaiUbahHarga(l)}>
                            {diubah ? "Ubah lagi" : "Ubah harga"}
                          </Button>
                          {diubah && (
                            <Button size="sm" variant="plain" icon={<RotateCcw />} onClick={() => kembalikanHarga(l.id)}>
                              Harga normal
                            </Button>
                          )}
                        </div>
                      )}
                      {pilih && (
                        <select
                          value={variant[l.id] || ""}
                          onChange={(e) => {
                            setVariant((v) => ({ ...v, [l.id]: e.target.value }));
                            setError("");
                          }}
                          className={`mt-2 w-full h-11 px-3 rounded-field text-[15px] sm:text-footnote font-semibold focus:outline-none focus:ring-2 focus:ring-tint/35 ${
                            variant[l.id]
                              ? "bg-fill text-label"
                              : "bg-warning/10 dark:bg-warning/15 text-warning ring-1 ring-warning/40"
                          }`}
                        >
                          <option value="">Pilih varian {pilih.toLowerCase()}…</option>
                          {kategoriItems.map((it) => {
                            const n = data?.[pilih]?.[it]?.jumlah;
                            return (
                              <option key={it} value={it}>
                                {it}
                                {typeof n === "number" ? ` — sisa ${n}` : ""}
                              </option>
                            );
                          })}
                        </select>
                      )}
                      {ref && sisa !== null && !data?.[ref.kategori]?.[ref.item] && (
                        <div className="mt-2">
                          <Pill tone="neutral" icon={<Package />}>
                            Stok {ref.item} belum dihitung — isi di menu Stok
                          </Pill>
                        </div>
                      )}
                      {ref && sisa !== null && !!data?.[ref.kategori]?.[ref.item] && (
                        <div className="mt-2">
                          <Pill
                            tone={sesudah! < 0 ? "negative" : sesudah === 0 || isDp ? "warning" : "positive"}
                            icon={sesudah! < 0 ? <AlertTriangle /> : isDp ? <Clock /> : <Package />}
                          >
                            {sesudah! < 0
                              ? `Stok ${sisa}${dip ? `, ${dip} sudah dipesan DP` : ""}, butuh ${need} — cek stok fisik`
                              : isDp
                                ? `Dipesan · stok ${ref.item} tetap ${sisa}${dip ? ` (${dip} dipesan lain)` : ""}`
                                : `Stok ${ref.item}: ${sisa} → ${sisa - need}${dip ? ` · ${dip} dipesan DP` : ""}${sesudah === 0 ? " (habis)" : ""}`}
                          </Pill>
                        </div>
                      )}
                      {ref && sisa === null && (
                        <div className="mt-2">
                          <Pill tone="warning" icon={<AlertTriangle />}>
                            Barang stok "{ref.item}" tidak ditemukan — hubungkan ulang
                          </Pill>
                        </div>
                      )}
                      {!l.stokRef && l.category === "JUALAN" && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-caption text-label-3">
                          <Link2Off className="w-3.5 h-3.5" />
                          Belum terhubung ke stok — stok tidak berkurang
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ) : (
          <div className="space-y-3">
            {actions.msg && <Notice tone="info">{actions.msg}</Notice>}

            {(sale.stokKurang?.length || 0) > 0 && (
              <Notice tone="warning">
                <div className="font-bold mb-1">Stok tercatat kurang</div>
                {sale.stokKurang!.map((k) => (
                  <div key={k.kategori + k.item}>
                    • {k.kategori} › {k.item}: terjual {k.diminta}, tercatat {k.tersedia}. Cek & koreksi stok fisik.
                  </div>
                ))}
              </Notice>
            )}

            {sale.status === "DP" && (
              <Notice tone="warning">
                Barang <b>dipesan</b> — stok berkurang saat pelunasan. Lunasi lewat <b>Kasir URBAN › Belum Lunas</b> paling lambat jatuh tempo.
              </Notice>
            )}

            {adaTukarTambah(sale) && (
              <Card flush className="p-3.5">
                <div className="flex items-start gap-2.5 text-footnote leading-snug text-label">
                  <ArrowLeftRight className="w-4 h-4 shrink-0 mt-0.5 text-tint" />
                  <span>
                    {sale.tukarTambah?.length || 0} barang tukar tambah ({rupiah(nilaiTukarNota(sale))}) menunggu <b>Konfirmasi stok</b> oleh owner / super admin.
                  </span>
                </div>
              </Card>
            )}

            {sale.status !== "DP" && sale.items.some((it) => it.stokRef) && (
              <Card flush className="p-3.5">
                <div className="mb-1.5">
                  <Eyebrow>Stok Berkurang</Eyebrow>
                </div>
                {Array.from(
                  sale.items
                    .reduce((m, it) => {
                      if (it.stokRef) {
                        const k = kunciStok(it.stokRef);
                        m.set(k, { ref: it.stokRef, qty: (m.get(k)?.qty || 0) + it.qty });
                      }
                      return m;
                    }, new Map<string, { ref: StokRef; qty: number }>())
                    .values()
                ).map(({ ref, qty }) => {
                  const now = sale.stokSesudah?.[kunciStok(ref)] ?? sisaOf(ref);
                  const kurang = sale.stokKurang?.find((k) => k.kategori === ref.kategori && k.item === ref.item);
                  const terpotong = kurang ? Math.min(qty, kurang.tersedia) : qty;
                  return (
                    <div key={kunciStok(ref)} className="flex items-center justify-between text-footnote py-0.5">
                      <span className="text-label-2 truncate pr-2">
                        {ref.kategori} › <b className="text-label">{ref.item}</b>
                      </span>
                      <span className="shrink-0 font-mono font-bold tabular-nums">
                        {terpotong > 0 ? (
                          <span className="text-negative">−{terpotong}</span>
                        ) : (
                          <span className="text-warning">tdk terpotong</span>
                        )}
                        <span className="text-label-3"> · sisa {now ?? "-"}</span>
                      </span>
                    </div>
                  );
                })}
              </Card>
            )}

            <div className="rounded-card bg-fill p-3">
              <NotaPreview sale={sale} />
            </div>
          </div>
        )}
      </Sheet>
      {open && ubahTukar !== null && !sale && (() => {
        const awal = tukar.find((t) => t.key === ubahTukar) || null;
        return (
          <TukarTambahSheet
            totalNota={hitung.total}
            nilaiLain={tukar.filter((t) => t.key !== ubahTukar).reduce((a, t) => a + t.nilai * t.qty, 0)}
            awal={awal}
            onClose={() => setUbahTukar(null)}
            onHapus={
              awal
                ? () => {
                    setTukar((l) => l.filter((t) => t.key !== awal.key));
                    setUbahTukar(null);
                  }
                : undefined
            }
            onSimpan={(d) => {
              setTukar((l) => (l.some((t) => t.key === d.key) ? l.map((t) => (t.key === d.key ? d : t)) : [...l, d]));
              setUbahTukar(null);
              setError("");
            }}
          />
        );
      })()}
    </>
  );
};

export default PosCheckoutSheet;
