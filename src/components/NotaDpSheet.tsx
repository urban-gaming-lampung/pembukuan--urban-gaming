import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Receipt,
  Undo2,
  Wallet,
} from "lucide-react";
import type { StokItemValue } from "../hooks/useStokData";
import { batalkanNotaDp, hariKeJatuhTempo, lunasiNotaDp, PosSale, sisaBayar, totalDibayar } from "../lib/posSales";
import { fmtJatuhTempo } from "../lib/posReceipt";
import { NotaActionButtons, NotaPreview, useNotaActions } from "./PosCheckoutSheet";
import { UploadTransferProof } from "./TableEditor";
import { rupiah } from "../lib/format";
import { Button, EmptyState, IconBadge, Notice, Pill, Sheet } from "../ui";

/** Label jatuh tempo: lewat / hari ini / H-n. */
export function labelJatuhTempo(s: PosSale): { teks: string; tone: "lewat" | "dekat" | "aman" } {
  const h = hariKeJatuhTempo(s.jatuhTempo);
  if (h === null) return { teks: "Tanpa jatuh tempo", tone: "aman" };
  if (h < 0) return { teks: `Lewat ${-h} hari`, tone: "lewat" };
  if (h === 0) return { teks: "Jatuh tempo hari ini", tone: "dekat" };
  if (h <= 2) return { teks: `${h} hari lagi`, tone: "dekat" };
  return { teks: `Jatuh tempo ${fmtJatuhTempo(s.jatuhTempo).replace(/^\w+, /, "")}`, tone: "aman" };
}

/**
 * Pilihan pembatalan nota DP (owner / super admin):
 * dibatalkan pembeli = DP hangus (pemasukan usaha) · dibatalkan URBAN = DP dikembalikan.
 */
export const BatalDp: React.FC<{ sale: PosSale; onSelesai: (s: PosSale) => void; onKembali?: () => void }> = ({
  sale,
  onSelesai,
  onKembali,
}) => {
  const [pihak, setPihak] = useState<"PEMBELI" | "URBAN" | null>(null);
  const [alasan, setAlasan] = useState("");
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  const dp = totalDibayar(sale);
  const pilihan = [
    {
      k: "PEMBELI" as const,
      judul: "Dibatalkan pembeli",
      isi: `DP ${rupiah(dp)} hangus — dicatat sebagai pemasukan usaha.`,
      icon: <Ban className="w-5 h-5" />,
    },
    {
      k: "URBAN" as const,
      judul: "Dibatalkan URBAN",
      isi: `DP ${rupiah(dp)} dikembalikan penuh ke pembeli — bukan pemasukan.`,
      icon: <Undo2 className="w-5 h-5" />,
    },
  ];
  const simpan = async () => {
    if (!pihak) return;
    setBusy(true);
    setGalat("");
    try {
      onSelesai(await batalkanNotaDp(sale, pihak, alasan));
    } catch (e: any) {
      setGalat("Gagal membatalkan: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2.5">
      <div className="text-caption2 font-semibold uppercase tracking-wider text-label-3 px-1">
        Siapa yang membatalkan?
      </div>
      {pilihan.map((p) => (
        <button
          key={p.k}
          type="button"
          onClick={() => setPihak(p.k)}
          aria-pressed={pihak === p.k}
          className={`w-full text-left flex items-start gap-3 rounded-card p-3.5 transition-colors ring-1 ${
            pihak === p.k
              ? "bg-action text-action-label ring-transparent shadow-card"
              : "apple-card text-label ring-edge hover:brightness-[0.98]"
          }`}
        >
          <span
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              pihak === p.k ? "bg-white/15 dark:bg-black/10" : "bg-fill"
            }`}
          >
            {p.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-subhead font-semibold">{p.judul}</span>
            <span className={`block text-caption leading-snug mt-0.5 ${pihak === p.k ? "opacity-80" : "text-label-2"}`}>
              {p.isi}
            </span>
          </span>
        </button>
      ))}
      <input
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        placeholder="Alasan (opsional)"
        autoComplete="off"
        className="w-full h-11 px-3.5 rounded-field bg-surface border border-sep text-[16px] sm:text-subhead font-medium text-label placeholder:text-label-3 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-tint/30"
      />
      {galat && <Notice tone="negative">{galat}</Notice>}
      <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
        {onKembali && (
          <Button variant="gray" size="lg" onClick={onKembali} disabled={busy}>
            Batal
          </Button>
        )}
        <Button
          variant="destructive"
          size="lg"
          onClick={simpan}
          disabled={!pihak || busy}
          loading={busy}
          icon={!busy ? <Ban className="w-4 h-4" /> : undefined}
          className={onKembali ? "w-full" : "col-span-2 w-full"}
        >
          Batalkan nota DP
        </Button>
      </div>
    </div>
  );
};

type Mode =
  | { k: "list" }
  | { k: "lunasi"; id: string }
  | { k: "nota"; id: string }
  | { k: "batal"; id: string }
  | { k: "selesai"; sale: PosSale; judul: string };

/**
 * BELUM LUNAS — daftar nota DP: pelunasan (kasir), lihat/cetak nota, batalkan (owner).
 */
const NotaDpSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  list: PosSale[];
  isOwner?: boolean;
  kasirNama: string;
  data: Record<string, Record<string, StokItemValue>>;
}> = ({ open, onClose, list, isOwner, kasirNama, data }) => {
  const [mode, setMode] = useState<Mode>({ k: "list" });
  const [metode, setMetode] = useState<"CASH" | "TRANSFER">("CASH");
  const [bukti, setBukti] = useState("");
  const [busy, setBusy] = useState(false);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    if (!open) {
      setMode({ k: "list" });
      setGalat("");
    }
  }, [open]);

  const aktif =
    mode.k === "lunasi" || mode.k === "nota" || mode.k === "batal"
      ? list.find((s) => s.id === mode.id) || null
      : null;
  const notaTampil = mode.k === "selesai" ? mode.sale : mode.k === "nota" ? aktif : null;
  const actions = useNotaActions(notaTampil);
  // Nota yang sedang dibuka sudah dilunasi / dibatalkan dari HP lain
  useEffect(() => {
    if ((mode.k === "lunasi" || mode.k === "nota" || mode.k === "batal") && !aktif) setMode({ k: "list" });
  }, [mode, aktif]);

  const totalSisa = useMemo(() => list.reduce((a, s) => a + sisaBayar(s), 0), [list]);

  const mulaiLunasi = (s: PosSale) => {
    setMetode("CASH");
    setBukti("");
    setGalat("");
    setMode({ k: "lunasi", id: s.id! });
  };
  const lunasi = async () => {
    if (!aktif) return;
    if (metode === "TRANSFER" && !bukti) {
      setGalat("Upload foto bukti transfer dulu.");
      return;
    }
    setBusy(true);
    setGalat("");
    try {
      const s = await lunasiNotaDp(aktif, { metode, buktiTransfer: metode === "TRANSFER" ? bukti : undefined, kasirNama });
      setMode({ k: "selesai", sale: s, judul: "Pelunasan tersimpan" });
    } catch (e: any) {
      setGalat("Pelunasan gagal: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const judul =
    mode.k === "lunasi"
      ? "Pelunasan"
      : mode.k === "nota"
      ? "Nota DP"
      : mode.k === "batal"
      ? "Batalkan nota DP"
      : mode.k === "selesai"
      ? mode.judul
      : "Belum Lunas";
  const sub =
    mode.k === "list"
      ? list.length
        ? `${list.length} nota DP · sisa tagihan ${rupiah(totalSisa)}`
        : "Tidak ada nota DP"
      : aktif
      ? `${aktif.noNota} · ${aktif.pembeli || "Pelanggan"}`
      : mode.k === "selesai"
      ? mode.sale.noNota
      : "";

  const jtColor = (tone: "lewat" | "dekat" | "aman") =>
    tone === "lewat" ? "red" : tone === "dekat" ? "yellow" : "gray";

  return (
    <Sheet
      open={open}
      onClose={() => !busy && onClose()}
      size="sm"
      zClassName="z-[255]"
      title={judul}
      subtitle={sub}
      headerLeft={
        mode.k !== "list" ? (
          <button
            type="button"
            onClick={() => setMode({ k: "list" })}
            disabled={busy}
            aria-label="Kembali ke daftar"
            className="w-9 h-9 rounded-full bg-fill text-label-2 hover:text-label flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <IconBadge color="yellow">
            <Clock className="w-4 h-4" />
          </IconBadge>
        )
      }
      footer={
        mode.k === "lunasi" && aktif ? (
          <Button
            variant="filled"
            size="lg"
            block
            onClick={lunasi}
            disabled={busy || (metode === "TRANSFER" && !bukti)}
            loading={busy}
            icon={!busy ? <CheckCircle2 className="w-5 h-5" /> : undefined}
          >
            Lunasi {rupiah(sisaBayar(aktif))}
          </Button>
        ) : notaTampil ? (
          <NotaActionButtons sale={notaTampil} actions={actions} />
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* ===== Daftar ===== */}
        {mode.k === "list" &&
          (list.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="text-positive" />}
              title="Semua nota sudah lunas"
            >
              Nota DP dibuat dari Selesaikan Transaksi › Bayar DP.
            </EmptyState>
          ) : (
            list.map((s) => {
              const jt = labelJatuhTempo(s);
              const barang = (s.items || []).map((it) => `${it.qty > 1 ? `${it.qty}× ` : ""}${it.nama}`);
              return (
                <div key={s.id} className="rounded-card apple-card ring-1 ring-edge p-3.5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-subhead font-semibold text-label truncate">{s.pembeli || "Pelanggan"}</div>
                      <div className="text-caption2 font-mono text-label-3">{s.noNota}</div>
                    </div>
                    <Pill color={jtColor(jt.tone)}>{jt.teks}</Pill>
                  </div>
                  <p className="mt-1.5 text-caption leading-snug text-label-2 line-clamp-2">{barang.join(", ")}</p>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-caption2">
                    <div>
                      <div className="text-label-3">Total</div>
                      <div className="font-semibold tabular-nums text-label">{rupiah(s.total)}</div>
                    </div>
                    <div>
                      <div className="text-label-3">DP</div>
                      <div className="font-semibold tabular-nums text-label">{rupiah(totalDibayar(s))}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-label-3">Sisa</div>
                      <div className="font-bold tabular-nums text-negative">{rupiah(sisaBayar(s))}</div>
                    </div>
                  </div>
                  <div className={`mt-3 grid gap-2 ${isOwner ? "grid-cols-[1fr_auto_auto]" : "grid-cols-[1fr_auto]"}`}>
                    <Button
                      variant="filled"
                      size="md"
                      onClick={() => mulaiLunasi(s)}
                      icon={<Wallet className="w-4 h-4" />}
                    >
                      Pelunasan
                    </Button>
                    <Button
                      variant="gray"
                      size="md"
                      onClick={() => setMode({ k: "nota", id: s.id! })}
                      aria-label={`Nota ${s.noNota}`}
                      icon={<Receipt className="w-4 h-4" />}
                    >
                      Nota
                    </Button>
                    {isOwner && (
                      <Button
                        variant="tinted"
                        size="md"
                        onClick={() => setMode({ k: "batal", id: s.id! })}
                        aria-label={`Batalkan ${s.noNota}`}
                        className="!bg-negative/10 !text-negative hover:!bg-negative/15 !px-3.5"
                        icon={<Ban className="w-4 h-4" />}
                      />
                    )}
                  </div>
                </div>
              );
            })
          ))}

        {/* ===== Pelunasan ===== */}
        {mode.k === "lunasi" && aktif && (
          <>
            <div className="rounded-card bg-action text-action-label px-4 py-3.5 shadow-card">
              <div className="text-caption2 font-semibold uppercase tracking-wider opacity-70">Sisa yang dibayar</div>
              <div className="text-[28px] font-bold font-mono tabular-nums tracking-tight leading-none mt-1">
                {rupiah(sisaBayar(aktif))}
              </div>
              <div className="text-caption mt-1.5 opacity-80">
                Total {rupiah(aktif.total)} · DP {rupiah(totalDibayar(aktif))}
              </div>
            </div>

            <div className="rounded-card apple-card ring-1 ring-edge p-3.5 shadow-card space-y-2.5">
              <div className="text-caption2 font-semibold uppercase tracking-wider text-label-3">Metode pelunasan</div>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-full apple-segmented">
                {(["CASH", "TRANSFER"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMetode(m);
                      setGalat("");
                    }}
                    className={`min-h-[42px] rounded-full text-caption font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                      metode === m
                        ? "apple-segmented-thumb text-label"
                        : "text-label-2 hover:text-label hover:bg-white/30 dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        metode === m ? (m === "CASH" ? "bg-positive" : "bg-tint") : "bg-label-3/40"
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
                      ? "bg-tint/10 ring-1 ring-tint/30"
                      : "bg-warning/10 ring-1 ring-warning/35"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-subhead font-semibold text-label">Bukti transfer</div>
                    <div className={`text-caption ${bukti ? "text-tint" : "text-warning"}`}>
                      {bukti ? "Terupload ✓" : "Wajib · foto / screenshot bukti transfer"}
                    </div>
                  </div>
                  <UploadTransferProof value={bukti} onChange={setBukti} />
                </div>
              )}
            </div>

            <div className="rounded-card apple-card ring-1 ring-edge p-3.5 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <div className="text-caption2 font-semibold uppercase tracking-wider text-label-3">
                  Barang diserahkan · stok berkurang
                </div>
                <Package className="w-4 h-4 text-label-3" />
              </div>
              <div className="divide-y divide-sep">
                {(aktif.items || []).map((it, i) => {
                  const r = it.stokRef;
                  const v = r ? data?.[r.kategori]?.[r.item] : undefined;
                  const sisa = v ? Math.max(0, Math.round(Number(v.jumlah) || 0)) : null;
                  const kurang = sisa !== null && sisa < it.qty;
                  return (
                    <div key={i} className="py-2 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-subhead font-semibold text-label leading-snug">{it.nama}</div>
                        {r && sisa !== null && (
                          <div className={`text-caption2 font-medium ${kurang ? "text-negative" : "text-label-2"}`}>
                            {kurang ? (
                              <>
                                <AlertTriangle className="inline w-3.5 h-3.5 -mt-0.5 mr-1" />
                                Stok tercatat {sisa}, butuh {it.qty} — cek stok fisik
                              </>
                            ) : (
                              `Stok ${r.item}: ${sisa} → ${sisa - it.qty}`
                            )}
                          </div>
                        )}
                        {r && sisa === null && (
                          <div className="text-caption2 text-label-3">Stok {r.item} belum dihitung</div>
                        )}
                      </div>
                      <div className="shrink-0 text-caption font-bold font-mono tabular-nums text-label-2">
                        {it.qty}×
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {galat && <Notice tone="negative">{galat}</Notice>}
          </>
        )}

        {/* ===== Batalkan ===== */}
        {mode.k === "batal" && aktif && (
          <BatalDp
            sale={aktif}
            onKembali={() => setMode({ k: "list" })}
            onSelesai={(s) =>
              setMode({ k: "selesai", sale: s, judul: s.status === "BATAL_PEMBELI" ? "DP hangus" : "DP dikembalikan" })
            }
          />
        )}

        {/* ===== Nota (DP / hasil pelunasan / pembatalan) ===== */}
        {notaTampil && (
          <>
            {mode.k === "selesai" && (
              <div
                className={`flex items-start gap-2 rounded-card p-3 text-caption leading-snug ring-1 ${
                  mode.sale.status === "LUNAS"
                    ? "bg-positive/10 text-positive ring-positive/25"
                    : "bg-fill text-label-2 ring-edge"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {mode.sale.status === "LUNAS"
                    ? "Nota sekarang LUNAS & stok barang sudah berkurang. Kirim / cetak nota lunas untuk pembeli."
                    : mode.sale.status === "BATAL_PEMBELI"
                    ? "Nota dibatalkan pembeli — DP hangus & tercatat sebagai pemasukan usaha."
                    : "Nota dibatalkan URBAN — kembalikan DP ke pembeli."}
                </span>
              </div>
            )}
            {actions.msg && <Notice tone="info">{actions.msg}</Notice>}
            <div className="rounded-card apple-tile ring-1 ring-edge p-3">
              <NotaPreview sale={notaTampil} />
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
};

export default NotaDpSheet;
