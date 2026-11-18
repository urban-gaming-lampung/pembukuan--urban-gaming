import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { Image as ImageIcon, Receipt } from "lucide-react";
import { db } from "../lib/firebase";
import { rupiah } from "../lib/format";
import { fmtJatuhTempo, fmtTanggalNota } from "../lib/posReceipt";
import { adaTukarTambah, bayarNota, dpSudahDiSaldoNota, isDpTerbuka, nilaiTukarNota, pernahDp, PosSale, sisaBayar, totalDibayar } from "../lib/posSales";
import { Amount, IconBadge, ImagePreviewModal, Notice, Pill, Sheet, Spinner } from "../ui";
import { DpLamaEditor, NotaActionButtons, NotaPreview, useNotaActions } from "./PosCheckoutSheet";

type Props = {
  open: boolean;
  saleId?: string | null;
  noNota?: string;
  initialSale?: PosSale | null;
  sales?: PosSale[];
  onClose: () => void;
};

type BuktiItem = {
  label: string;
  sub: string;
  url: string;
};

/** Mengambil daftar bukti transfer unik dari pembayaran DP/pelunasan maupun transaksi tunggal. */
function kumpulBuktiTransfer(sale: PosSale): BuktiItem[] {
  const seen = new Set<string>();
  const hasil: BuktiItem[] = [];

  for (const p of sale.pembayaran || []) {
    if (p.metode === "TRANSFER" && p.buktiTransfer && !seen.has(p.buktiTransfer)) {
      seen.add(p.buktiTransfer);
      hasil.push({
        label: p.jenis === "DP" ? "Bukti Transfer · DP" : "Bukti Transfer · Pelunasan",
        sub: `${rupiah(p.jumlah)} · ${fmtTanggalNota(p.ts)}`,
        url: p.buktiTransfer,
      });
    }
  }

  if (sale.metode === "TRANSFER" && sale.buktiTransfer && !seen.has(sale.buktiTransfer)) {
    seen.add(sale.buktiTransfer);
    const bayarHariIni = Math.max(0, bayarNota(sale) - dpSudahDiSaldoNota(sale));
    hasil.push({
      label: "Bukti Transfer",
      sub: `${rupiah(dpSudahDiSaldoNota(sale) > 0 ? bayarHariIni : Math.abs(bayarNota(sale)))} · ${fmtTanggalNota(sale.ts)}`,
      url: sale.buktiTransfer,
    });
  }

  return hasil;
}

/** Menentukan label & warna status ringkas untuk header Nota POS. */
function statusNota(sale: PosSale): { text: string; tone: "positive" | "warning" | "negative" | "tint" | "neutral" } {
  if (sale.status === "BATAL_PEMBELI") return { text: "Batal · DP hangus", tone: "negative" };
  if (sale.status === "BATAL_URBAN") return { text: "Batal · DP kembali", tone: "negative" };
  if (sale.batal) return { text: "Dibatalkan", tone: "negative" };
  if (isDpTerbuka(sale)) return { text: "DP · Belum lunas", tone: "warning" };
  if (adaTukarTambah(sale)) return { text: "Tukar tambah", tone: "tint" };
  if (sale.statusBayar === "BELUM DIBAYAR") return { text: "Belum dibayar", tone: "warning" };
  return { text: sale.metode === "TRANSFER" ? "Lunas · Transfer" : "Lunas · Cash", tone: sale.metode === "TRANSFER" ? "tint" : "positive" };
}

/** Sheet pratinjau nota POS lengkap (preview thermal, bukti transfer, cetak, PDF, & WhatsApp). */
export const NotaPosSheet: React.FC<Props> = ({ open, saleId, noNota, initialSale, sales = [], onClose }) => {
  const liveMatch = useMemo(() => {
    if (!open) return null;
    const targetId = (saleId || "").trim();
    const targetNo = (noNota || "").trim();
    return (
      sales.find((s) => (targetId && (s.id === targetId || s.noNota === targetId)) || (targetNo && s.noNota === targetNo)) ||
      (initialSale && (!targetId || initialSale.id === targetId || initialSale.noNota === targetId) ? initialSale : null)
    );
  }, [open, saleId, noNota, sales, initialSale]);

  const [fetched, setFetched] = useState<PosSale | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFetched(null);
      setError("");
      setLoading(false);
      setZoomUrl(null);
      return;
    }
    if (liveMatch) {
      setFetched(null);
      setError("");
      setLoading(false);
      return;
    }
    const targetId = (saleId || "").trim();
    const targetNo = (noNota || "").trim();
    if (!targetId && !targetNo) {
      setError("Referensi nota tidak ditemukan.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        if (targetId) {
          const snap = await getDoc(doc(db, "pos_transaksi", targetId));
          if (!cancelled && snap.exists()) {
            setFetched({ ...(snap.data() as PosSale), id: snap.id });
            setLoading(false);
            return;
          }
        }
        const qNo = targetNo || targetId;
        if (qNo) {
          const qs = await getDocs(query(collection(db, "pos_transaksi"), where("noNota", "==", qNo), limit(1)));
          if (!cancelled && !qs.empty) {
            const d = qs.docs[0];
            setFetched({ ...(d.data() as PosSale), id: d.id });
            setLoading(false);
            return;
          }
        }
        if (!cancelled) {
          setError(`Data nota ${qNo || ""} tidak ditemukan di database.`);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Gagal memuat detail nota.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, liveMatch, saleId, noNota]);

  const sale = liveMatch || fetched;
  const actions = useNotaActions(sale);

  const badge = sale ? statusNota(sale) : null;
  const buktiList = sale ? kumpulBuktiTransfer(sale) : [];
  const batalPakaiDp = sale ? sale.status === "BATAL_PEMBELI" || sale.status === "BATAL_URBAN" || pernahDp(sale) : false;

  return (
    <>
      <Sheet
        open={open}
        onClose={() => {
          if (zoomUrl) setZoomUrl(null);
          else onClose();
        }}
        size="md"
        zClassName="z-[260]"
        headerLeft={
          <IconBadge color={sale?.batal ? "gray" : sale?.metode === "TRANSFER" ? "blue" : "teal"} size="md">
            <Receipt size={18} />
          </IconBadge>
        }
        title={
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono">{sale?.noNota || noNota || "Detail Nota POS"}</span>
            {badge && <Pill tone={badge.tone}>{badge.text}</Pill>}
          </span>
        }
        subtitle={sale ? `${sale.pembeli || "Pelanggan"} · ${fmtTanggalNota(sale.ts)}` : "Memuat informasi nota..."}
        footer={sale && (!sale.batal || batalPakaiDp) ? <NotaActionButtons sale={sale} actions={actions} /> : undefined}
      >
        <div className="space-y-4">
          {actions.msg && (
            <Notice tone="info">
              <p className="font-medium">{actions.msg}</p>
            </Notice>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-tile apple-card py-12 text-label-2 ring-1 ring-edge shadow-card">
              <Spinner size="md" label="Memuat detail nota..." />
            </div>
          ) : error ? (
            <Notice tone="warning">
              <p className="font-semibold">Nota tidak dapat ditampilkan</p>
              <p className="mt-0.5 text-label-2">{error}</p>
            </Notice>
          ) : sale ? (
            <>
              {sale.batal && (
                <Notice tone="negative">
                  <p className="font-semibold">
                    {sale.status === "BATAL_PEMBELI"
                      ? "Dibatalkan pembeli · DP hangus"
                      : sale.status === "BATAL_URBAN"
                        ? "Dibatalkan URBAN · DP dikembalikan"
                        : "Nota dibatalkan"}
                  </p>
                  {sale.batalAlasan && <p className="mt-0.5 text-label-2">Alasan: {sale.batalAlasan}</p>}
                </Notice>
              )}

              {!sale.batal && isDpTerbuka(sale) && (
                <Notice tone="warning">
                  <p className="font-semibold">Menunggu pelunasan DP</p>
                  <p className="mt-0.5 text-label-2">
                    Sudah dibayar {rupiah(totalDibayar(sale))} · Sisa {rupiah(sisaBayar(sale))}
                    {sale.jatuhTempo ? ` · Jatuh tempo ${fmtJatuhTempo(sale.jatuhTempo)}` : ""}
                  </p>
                </Notice>
              )}

              {!sale.batal && adaTukarTambah(sale) && (
                <Notice tone="info">
                  <p className="font-semibold">Transaksi tukar tambah</p>
                  <p className="mt-0.5 text-label-2">
                    Potongan tukar {rupiah(nilaiTukarNota(sale))} · Nilai bayar{" "}
                    <Amount value={bayarNota(sale)} size="footnote" className="font-semibold" />
                    {dpSudahDiSaldoNota(sale) > 0 && (
                      <> · masuk hari ini <b className="font-semibold text-label">{rupiah(Math.max(0, bayarNota(sale) - dpSudahDiSaldoNota(sale)))}</b></>
                    )}
                  </p>
                </Notice>
              )}

              <DpLamaEditor
                sale={sale}
                onSaved={(m, dpBaru) => {
                  actions.setMsg(m);
                  setFetched((cur) => (cur ? { ...cur, dpSudahDiSaldo: dpBaru } : cur));
                }}
              />

              {buktiList.length > 0 && (
                <div className="space-y-2">
                  <div className="px-1 text-caption font-semibold uppercase tracking-[0.04em] text-label-2">
                    Bukti Transfer Terlampir
                  </div>
                  <div className="space-y-2">
                    {buktiList.map((b, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 rounded-tile apple-card p-2.5 ring-1 ring-edge shadow-card"
                      >
                        <button
                          type="button"
                          onClick={() => setZoomUrl(b.url)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:opacity-80"
                        >
                          <img
                            src={b.url}
                            alt={b.label}
                            className="h-12 w-12 shrink-0 rounded-field object-cover ring-1 ring-edge"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-subhead font-semibold text-label">{b.label}</div>
                            <div className="truncate text-caption text-label-2">{b.sub}</div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setZoomUrl(b.url)}
                          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-tint/10 px-3.5 text-caption font-semibold text-tint transition hover:bg-tint/15 dark:bg-tint/15"
                        >
                          <ImageIcon size={14} />
                          <span>Lihat</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={`flex justify-center overflow-x-auto rounded-tile bg-surface p-3.5 ring-1 ring-edge ${sale.batal && !batalPakaiDp ? "opacity-60" : ""}`}>
                <NotaPreview sale={sale} />
              </div>
            </>
          ) : null}
        </div>
      </Sheet>

      <ImagePreviewModal
        open={Boolean(zoomUrl)}
        onClose={() => setZoomUrl(null)}
        src={zoomUrl}
        title="Pratinjau Bukti Transfer"
        alt="Bukti Transfer"
        zClassName="z-[280]"
      />
    </>
  );
};
