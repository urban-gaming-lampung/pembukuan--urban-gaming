import React from "react";
import { Loader2 } from "lucide-react";
import { rupiah, persen } from "../../lib/format";
import { Amount, Card, Eyebrow, IconBadge, LineList, LineItem, MARK, Meter, StatTile, StatusPill, type WarnaIkon } from "../../ui";

/**
 * KARTU UTAMA ANALITIK (SSOT) — dipakai Analitik Keseluruhan, Rental, dan Usaha supaya ketiganya
 * simetris: label periode · status, hasil besar berwarna, kalimat penjelas, tile masuk / keluar.
 */
export const HeroArus: React.FC<{
  eyebrow: React.ReactNode;
  eyebrowIcon?: React.ReactNode;
  net: number;
  masuk: number;
  keluar: number;
  loading?: boolean;
  /** Kalimat penjelas; bawaan dibuat dari selisih */
  kalimat?: React.ReactNode;
  masukLabel?: string;
  keluarLabel?: string;
  masukSub?: React.ReactNode;
  keluarSub?: React.ReactNode;
  onMasuk?: () => void;
  onKeluar?: () => void;
  /** Tampilkan bar "uang keluar x% dari uang masuk" */
  rasio?: boolean;
  children?: React.ReactNode;
}> = ({ eyebrow, eyebrowIcon, net, masuk, keluar, loading, kalimat, masukLabel = "Uang masuk", keluarLabel = "Uang keluar", masukSub, keluarSub, onMasuk, onKeluar, rasio, children }) => {
  const kosong = !loading && masuk === 0 && keluar === 0;
  const teks =
    kalimat ??
    (loading
      ? "Menghitung…"
      : net > 0
      ? `Uang masuk lebih besar ${rupiah(net)} dari uang keluar.`
      : net < 0
      ? `Uang keluar melebihi uang masuk sebesar ${rupiah(-net)}.`
      : kosong
      ? "Belum ada uang masuk atau keluar di periode ini."
      : "Uang masuk sama dengan uang keluar.");
  const r = masuk > 0 ? (keluar / masuk) * 100 : 0;
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow icon={eyebrowIcon}>{eyebrow}</Eyebrow>
        {!loading && !kosong && <StatusPill net={net} />}
      </div>
      <div className="mt-2 min-h-[40px]">
        {loading ? <Loader2 className="h-8 w-8 animate-spin text-label-3" aria-label="Memuat" /> : <Amount value={net} signed tone="auto" size="display" fitAt={15} />}
      </div>
      <p className="mt-1 text-footnote text-label-2">{teks}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <StatTile
          label={masukLabel}
          dot={MARK.masuk}
          value={<Amount value={masuk} size="headline" fitAt={13} />}
          sub={masukSub}
          onClick={onMasuk}
          ariaLabel={onMasuk ? `Rincian ${masukLabel.toLowerCase()}` : undefined}
        />
        <StatTile
          label={keluarLabel}
          dot={MARK.keluar}
          value={<Amount value={keluar} size="headline" fitAt={13} />}
          sub={keluarSub}
          onClick={onKeluar}
          ariaLabel={onKeluar ? `Rincian ${keluarLabel.toLowerCase()}` : undefined}
        />
      </div>
      {rasio && masuk > 0 && !loading && (
        <div className="mt-4">
          <Meter fraction={Math.min(1, r / 100)} color={MARK.keluar} label="Uang keluar dibanding uang masuk" />
          <p className="mt-1.5 text-caption text-label-2">
            {r <= 100 ? (
              <>Uang keluar <b className="font-semibold text-label">{persen(r)}</b> dari uang masuk</>
            ) : (
              <>Uang keluar <b className="font-semibold text-label">{(r / 100).toFixed(1).replace(".", ",")}×</b> uang masuk</>
            )}
          </p>
        </div>
      )}
      {children}
    </Card>
  );
};

/** Kartu ringkas satu model usaha (Rental / Usaha) — dua kartu ini selalu tampil berdampingan & simetris. */
export const KartuBisnis: React.FC<{
  judul: string;
  sub: string;
  icon: React.ReactNode;
  iconColor: WarnaIkon;
  masuk: number;
  keluar: number;
  rows: { jenis: "masuk" | "keluar"; label: string; note?: string; v: number }[];
  loading?: boolean;
}> = ({ judul, sub, icon, iconColor, masuk, keluar, rows, loading }) => {
  const net = masuk - keluar;
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconBadge color={iconColor}>{icon}</IconBadge>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-headline text-label">{judul}</h3>
          <p className="truncate text-footnote text-label-2">{sub}</p>
        </div>
        {!loading && (masuk > 0 || keluar > 0) && <StatusPill net={net} />}
      </div>
      <div className="mt-3">
        {loading ? <Loader2 className="h-6 w-6 animate-spin text-label-3" aria-label="Memuat" /> : <Amount value={net} signed tone="auto" size="title2" fitAt={15} />}
      </div>
      <p className="mt-0.5 text-caption text-label-2 tabular-nums">
        Masuk {rupiah(masuk)} · Keluar {rupiah(keluar)}
      </p>
      <LineList className="mt-2 border-t border-sep">
        {rows.map((r) => (
          <LineItem
            key={r.jenis + r.label}
            dot={r.jenis === "masuk" ? MARK.masuk : MARK.keluar}
            label={r.label}
            note={r.note}
            value={`${r.jenis === "keluar" && r.v > 0 ? "−" : ""}${rupiah(r.v)}`}
            muted={r.v === 0}
          />
        ))}
      </LineList>
    </Card>
  );
};
