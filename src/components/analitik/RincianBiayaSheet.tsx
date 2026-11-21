import React, { useEffect, useMemo, useState } from "react";
import { Receipt, X } from "lucide-react";
import { BarRow, Card, EmptyState, Eyebrow, LineItem, LineList, MARK, SectionHeader, Sheet } from "../../ui";
import { metodeOwner, type TransaksiOwner } from "../../lib/keuangan";
import { persen, rupiah } from "../../lib/format";
import { dariYmd } from "../../lib/dateLocal";

const hariPanjang = (ymd: string) => {
  const d = dariYmd(ymd);
  return !d || isNaN(d.getTime()) ? ymd : d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

/**
 * Rincian biaya (transaksi owner) per kategori + daftar transaksi per tanggal.
 * Dipakai Analitik › Usaha untuk "Biaya operasional usaha".
 */
const RincianBiayaSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  periode: string;
  items: TransaksiOwner[];
  keterangan?: React.ReactNode;
}> = ({ open, onClose, title, periode, items, keterangan }) => {
  const [kategori, setKategori] = useState<string | null>(null);
  useEffect(() => {
    if (!open) setKategori(null);
  }, [open]);

  const total = useMemo(() => items.reduce((s, x) => s + (Number(x.harga) || 0), 0), [items]);

  const perKategori = useMemo(() => {
    const m = new Map<string, { total: number; n: number }>();
    items.forEach((x) => {
      const k = String(x.kategori || "").trim() || "Tanpa kategori";
      const v = m.get(k) || { total: 0, n: 0 };
      v.total += Number(x.harga) || 0;
      v.n += 1;
      m.set(k, v);
    });
    return Array.from(m.entries())
      .map(([k, v]) => ({ kategori: k, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  const terpilih = useMemo(
    () => (kategori ? items.filter((x) => (String(x.kategori || "").trim() || "Tanpa kategori") === kategori) : items),
    [items, kategori]
  );
  const totalTerpilih = terpilih.reduce((s, x) => s + (Number(x.harga) || 0), 0);

  const perTanggal = useMemo(() => {
    const m = new Map<string, TransaksiOwner[]>();
    [...terpilih]
      .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || "") || (b.timestamp || 0) - (a.timestamp || 0))
      .forEach((x) => m.set(x.tanggal, [...(m.get(x.tanggal) || []), x]));
    return Array.from(m.entries());
  }, [terpilih]);

  const maks = perKategori[0]?.total || 1;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="md"
      variant="grouped"
      title={title}
      subtitle={`${periode} · ${items.length} transaksi`}
      icon={<Receipt />}
      iconColor="red"
    >
      {items.length === 0 ? (
        <EmptyState icon={<Receipt />} title="Belum ada biaya">
          Tidak ada biaya operasional usaha pada periode ini.
        </EmptyState>
      ) : (
        <div className="space-y-1">
          <Card>
            <Eyebrow>Total biaya</Eyebrow>
            <div className="mt-0.5 text-title2 tabular-nums text-label">−{rupiah(total)}</div>
            {keterangan && <p className="mt-1 text-footnote text-label-2">{keterangan}</p>}
          </Card>

          <SectionHeader title="Per kategori" />
          <Card>
            <div className="space-y-3.5">
              {perKategori.map((k, i) => (
                <BarRow
                  key={k.kategori}
                  rank={i + 1}
                  label={k.kategori}
                  value={rupiah(k.total)}
                  fraction={k.total / maks}
                  color={kategori && kategori !== k.kategori ? "rgb(var(--ui-label-3))" : MARK.keluar}
                  sub={`${k.n} transaksi · ${persen((k.total / Math.max(1, total)) * 100)} dari total`}
                  onClick={() => setKategori(kategori === k.kategori ? null : k.kategori)}
                />
              ))}
            </div>
          </Card>

          <SectionHeader
            title={kategori ? `Transaksi · ${kategori}` : "Semua transaksi"}
            accessory={
              kategori ? (
                <button
                  type="button"
                  onClick={() => setKategori(null)}
                  className="hit-44 inline-flex items-center gap-1 text-footnote font-semibold text-tint active:opacity-60"
                >
                  Semua <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : (
                <span className="tabular-nums">−{rupiah(totalTerpilih)}</span>
              )
            }
          />
          <div className="space-y-3">
            {perTanggal.map(([tgl, list]) => (
              <div key={tgl}>
                <div className="mb-1.5 flex items-baseline justify-between px-1">
                  <Eyebrow>{hariPanjang(tgl)}</Eyebrow>
                  {list.length > 1 && (
                    <span className="text-caption tabular-nums text-label-2">
                      −{rupiah(list.reduce((s, x) => s + (Number(x.harga) || 0), 0))}
                    </span>
                  )}
                </div>
                <Card className="py-0">
                  <LineList>
                    {list.map((x) => (
                      <LineItem
                        key={x.id}
                        label={x.nama || "Tanpa nama"}
                        note={[kategori || x.kategori === x.nama ? null : x.kategori, metodeOwner(x) === "CASH" ? "Tunai" : "Transfer"].filter(Boolean).join(" · ")}
                        value={`−${rupiah(Number(x.harga) || 0)}`}
                      />
                    ))}
                  </LineList>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
};

export default RincianBiayaSheet;
