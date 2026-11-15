import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { ExternalLink, Image as ImageIcon, Loader2, Receipt, X } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { db } from "../lib/firebase";
import { rupiah } from "../lib/format";
import { fmtJatuhTempo, fmtTanggalNota } from "../lib/posReceipt";
import { adaTukarTambah, bayarNota, isDpTerbuka, nilaiTukarNota, pernahDp, PosSale, sisaBayar, totalDibayar } from "../lib/posSales";
import { Amount, IconBadge, Notice, Pill } from "../ui";
import { NotaActionButtons, NotaPreview, useNotaActions } from "./PosCheckoutSheet";

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
    hasil.push({
      label: "Bukti Transfer",
      sub: `${rupiah(Math.abs(bayarNota(sale)))} · ${fmtTanggalNota(sale.ts)}`,
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
  useBodyScrollLock(open);

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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomUrl) setZoomUrl(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, zoomUrl, onClose]);

  const sale = liveMatch || fetched;
  const actions = useNotaActions(sale);

  if (!open) return null;

  const badge = sale ? statusNota(sale) : null;
  const buktiList = sale ? kumpulBuktiTransfer(sale) : [];
  const batalPakaiDp = sale ? sale.status === "BATAL_PEMBELI" || sale.status === "BATAL_URBAN" || pernahDp(sale) : false;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Detail Nota ${noNota || sale?.noNota || ""}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-card sm:rounded-card bg-canvas text-label ring-1 ring-edge shadow-float sm:max-w-lg"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-sep bg-surface px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <IconBadge color={sale?.batal ? "gray" : sale?.metode === "TRANSFER" ? "blue" : "teal"} size="md">
              <Receipt size={18} />
            </IconBadge>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate font-mono text-headline text-label">
                  {sale?.noNota || noNota || "Detail Nota POS"}
                </h3>
                {badge && <Pill tone={badge.tone}>{badge.text}</Pill>}
              </div>
              <p className="truncate text-caption text-label-2">
                {sale ? `${sale.pembeli || "Pelanggan"} · ${fmtTanggalNota(sale.ts)}` : "Memuat informasi nota..."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup detail nota"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 transition hover:text-label active:scale-95"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {actions.msg && (
            <Notice tone="info">
              <p className="font-medium">{actions.msg}</p>
            </Notice>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-tile bg-surface py-12 text-label-2 ring-1 ring-edge">
              <Loader2 className="h-6 w-6 animate-spin text-tint" />
              <span className="text-footnote">Memuat detail nota...</span>
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
                    Potongan tukar {rupiah(nilaiTukarNota(sale))} · Nilai bayar bersih{" "}
                    <Amount value={bayarNota(sale)} size="footnote" className="font-semibold" />
                  </p>
                </Notice>
              )}

              {buktiList.length > 0 && (
                <div className="space-y-2">
                  <div className="px-1 text-caption font-semibold uppercase tracking-[0.04em] text-label-2">
                    Bukti Transfer Terlampir
                  </div>
                  <div className="space-y-2">
                    {buktiList.map((b, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-3 rounded-tile bg-surface p-2.5 ring-1 ring-edge"
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
                          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-field bg-tint/10 px-3 text-caption font-semibold text-tint transition hover:bg-tint/15 dark:bg-tint/15"
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

        {sale && (!sale.batal || batalPakaiDp) && (
          <footer className="shrink-0 border-t border-sep bg-surface px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <NotaActionButtons sale={sale} actions={actions} />
          </footer>
        )}
      </div>

      {zoomUrl && (
        <div
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            setZoomUrl(null);
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-card bg-surface shadow-float ring-1 ring-edge"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-sep px-4 py-3">
              <span className="text-subhead font-semibold text-label">Pratinjau Bukti Transfer</span>
              <button
                type="button"
                onClick={() => setZoomUrl(null)}
                aria-label="Tutup pratinjau bukti transfer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-fill text-label-2 hover:text-label"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center justify-center bg-canvas p-4">
              <img src={zoomUrl} alt="Bukti Transfer" className="max-h-[65dvh] max-w-full rounded-tile object-contain" />
            </div>
            <div className="flex justify-end gap-2 border-t border-sep px-4 py-3">
              <a
                href={zoomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center gap-1.5 rounded-field bg-tint/10 px-4 text-subhead font-semibold text-tint dark:bg-tint/15"
              >
                <ExternalLink size={15} />
                <span>Buka Penuh</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
