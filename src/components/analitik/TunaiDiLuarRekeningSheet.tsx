import React, { useEffect, useState } from "react";
import { Banknote, Check, Loader2, Wallet } from "lucide-react";
import type { ItemOwnerTunai, ItemSetoranBelum, ItemTunaiPos, PosisiDana } from "../../lib/akuntansiUsaha";
import { updateMetodeOwner, updateSetoranBayarHarian } from "../../lib/keuangan";
import { setPosTunaiSudahSetor } from "../../lib/posSales";
import { dariYmd } from "../../lib/dateLocal";
import { rupiah } from "../../lib/format";
import { Amount, Button, EmptyState, MARK, Notice, Pill, SectionHeader, Sheet, StatTile } from "../../ui";

type Props = {
  open: boolean;
  onClose: () => void;
  posisi: PosisiDana;
};

const fmtTgl = (tgl: string): string => {
  const d = dariYmd(tgl);
  if (!d) return tgl || "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

/** Baris kotak centang interaktif untuk menandai item tunai apakah sudah disetor ke rekening. */
const BarisCentangTunai: React.FC<{
  checked: boolean;
  busy: boolean;
  judul: React.ReactNode;
  sub: React.ReactNode;
  nominal: number;
  tanda?: "masuk" | "keluar";
  badge?: React.ReactNode;
  disabled?: boolean;
  onToggle: () => void;
}> = ({ checked, busy, judul, sub, nominal, tanda, badge, disabled, onToggle }) => (
  <button
    type="button"
    disabled={busy || disabled}
    onClick={onToggle}
    aria-pressed={checked}
    className={`w-full apple-tile ring-1 ring-black/[0.04] dark:ring-white/[0.06] px-3.5 py-3 flex items-start gap-3 text-left transition-all min-h-[44px] enabled:hover:bg-fill/60 enabled:active:scale-[0.99] ${
      checked || disabled ? "opacity-75" : ""
    }`}
  >
    <span
      aria-hidden
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition-colors ${
        checked
          ? "bg-positive border-positive text-white"
          : "bg-surface border-label-3/50 text-transparent"
      }`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-label-2" /> : <Check className="h-3.5 w-3.5" strokeWidth={2.75} />}
    </span>

    <span className="min-w-0 flex-1 space-y-1">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-subhead font-semibold text-label">{judul}</span>
        {badge}
        <Pill tone={checked ? "positive" : "warning"}>{checked ? "Sudah di-TF" : "Belum TF"}</Pill>
      </span>
      <span className="block text-caption text-label-2 leading-snug">{sub}</span>
    </span>

    <span className="shrink-0 text-right pt-0.5">
      <Amount
        value={tanda === "keluar" ? -nominal : nominal}
        tone={checked ? "neutral" : tanda === "keluar" ? "negative" : "warning"}
        className={checked ? "line-through opacity-60" : ""}
      />
    </span>
  </button>
);

export const TunaiDiLuarRekeningSheet: React.FC<Props> = ({ open, onClose, posisi }) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Simpan sementara baris setoran/owner yg baru dicentang di sesi sheet ini supaya mudah di-undo bila salah klik
  const [toggledSetoran, setToggledSetoran] = useState<Map<string, ItemSetoranBelum>>(() => new Map());
  const [toggledOwner, setToggledOwner] = useState<Map<string, ItemOwnerTunai>>(() => new Map());

  useEffect(() => {
    if (!open) {
      setErr(null);
      setToggledSetoran(new Map());
      setToggledOwner(new Map());
    }
  }, [open]);

  const setoranKey = (r: Pick<ItemSetoranBelum, "historyId" | "rowIndex">) => `${r.historyId}#${r.rowIndex}`;
  const ownerKey = (r: Pick<ItemOwnerTunai, "jenis" | "id">) => `${r.jenis}#${r.id}`;

  const togglePos = async (item: ItemTunaiPos) => {
    const key = `pos:${item.id}`;
    setErr(null);
    setBusyKey(key);
    try {
      await setPosTunaiSudahSetor(item.id, !item.sudahTf);
    } catch (e: any) {
      setErr(e?.message || "Gagal memperbarui status setor nota POS.");
    } finally {
      setBusyKey(null);
    }
  };

  const toggleSetoran = async (row: ItemSetoranBelum, nextSudahTf: boolean) => {
    const key = `set:${setoranKey(row)}`;
    setErr(null);
    setBusyKey(key);
    try {
      await updateSetoranBayarHarian(row.historyId, row.rowIndex, nextSudahTf);
      setToggledSetoran((prev) => {
        const m = new Map(prev);
        if (nextSudahTf) m.set(setoranKey(row), row);
        else m.delete(setoranKey(row));
        return m;
      });
    } catch (e: any) {
      setErr(e?.message || "Gagal memperbarui status transfer setoran harian.");
    } finally {
      setBusyKey(null);
    }
  };

  const toggleOwner = async (row: ItemOwnerTunai, nextTransfer: boolean) => {
    const key = `own:${ownerKey(row)}`;
    setErr(null);
    setBusyKey(key);
    try {
      await updateMetodeOwner(row.jenis, row.id, nextTransfer ? "TRANSFER" : "CASH");
      setToggledOwner((prev) => {
        const m = new Map(prev);
        if (nextTransfer) m.set(ownerKey(row), row);
        else m.delete(ownerKey(row));
        return m;
      });
    } catch (e: any) {
      setErr(e?.message || "Gagal memperbarui metode dana transaksi owner.");
    } finally {
      setBusyKey(null);
    }
  };

  // Setoran Belum + yang baru dicentang (menunggu data realtime) + yang sudah di-TF (tetap tampil sebagai bukti)
  const aktifSetoranKeys = new Set(posisi.itemSetoran.map(setoranKey));
  const sudahSetoranKeys = new Set(posisi.itemSetoranSudah.map(setoranKey));
  const semuaSetoran = [
    ...posisi.itemSetoran.map((r) => ({ row: r, checked: false })),
    ...Array.from(toggledSetoran.values())
      .filter((r) => !aktifSetoranKeys.has(setoranKey(r)) && !sudahSetoranKeys.has(setoranKey(r)))
      .map((r) => ({ row: r, checked: true })),
    ...posisi.itemSetoranSudah
      .filter((r) => !aktifSetoranKeys.has(setoranKey(r)))
      .map((r) => ({ row: r, checked: true })),
  ];

  const aktifOwnerKeys = new Set(posisi.itemOwner.map(ownerKey));
  const semuaOwner = [
    ...posisi.itemOwner.map((r) => ({ row: r, checked: false })),
    ...Array.from(toggledOwner.values())
      .filter((r) => !aktifOwnerKeys.has(ownerKey(r)))
      .map((r) => ({ row: r, checked: true })),
  ];

  const kosong = posisi.itemPos.length === 0 && semuaSetoran.length === 0 && semuaOwner.length === 0;
  const jumlahBelumPos = posisi.itemPos.filter((x) => !x.sudahTf && !x.hanyaSetoran).length;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Tunai di luar rekening"
      subtitle="Rincian kas tunai & centang jika uang sudah disetor ke rekening"
      icon={<Wallet />}
      iconColor="orange"
      size="md"
      footer={
        <div className="space-y-2.5">
          <p className="text-caption text-label-2">
            Centang <b>Sudah di-TF</b> hanya menandai kas tunai sudah masuk ke rekening pemilik — metode bayar asli di nota pembeli tetap tercatat Tunai.
          </p>
          <Button variant="gray" size="lg" block onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile
            accent="orange"
            dot={MARK.tunai}
            label="Tunai di luar rekening"
            value={<Amount value={posisi.tunaiDiLuarRekening} size="title3" tone={posisi.tunaiDiLuarRekening === 0 ? "neutral" : "warning"} />}
            sub={`${jumlahBelumPos + posisi.itemSetoran.length + posisi.itemOwner.length} item belum TF`}
          />
          <StatTile
            accent="blue"
            dot={MARK.transfer}
            label="Perkiraan di rekening"
            value={<Amount value={posisi.estimasiRekening} signed tone="auto" size="title3" />}
            sub="Saldo bersih − tunai luar"
          />
        </div>

        <div className="rounded-tile apple-tile px-3.5 py-2.5 text-caption text-label-2 flex items-center justify-between gap-2">
          <span>Rumus: Saldo bersih ({rupiah(posisi.totalSaldo)}) − Tunai luar ({rupiah(posisi.tunaiDiLuarRekening)})</span>
          <span className="font-semibold text-label tabular-nums">{rupiah(posisi.estimasiRekening)}</span>
        </div>

        {err && <Notice tone="negative">{err}</Notice>}

        {kosong ? (
          <EmptyState icon={<Banknote />} title="Tidak ada kas tunai di luar rekening">
            Semua nota POS tunai, setoran harian admin, dan transaksi owner di periode ini sudah tercatat masuk ke rekening.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {posisi.itemPos.length > 0 && (
              <div className="space-y-2">
                <SectionHeader title={`Nota POS tunai (${posisi.itemPos.length})`} />
                <div className="space-y-2">
                  {posisi.itemPos.map((item) => (
                    <BarisCentangTunai
                      key={item.id}
                      checked={item.sudahTf}
                      busy={busyKey === `pos:${item.id}`}
                      disabled={item.hanyaSetoran}
                      judul={item.noNota}
                      badge={
                        <>
                          {item.jenis !== "PENJUALAN" && (
                            <Pill tone="neutral">{item.jenis === "DP" ? "DP" : "DP Hangus"}</Pill>
                          )}
                          {item.adaJasa && <Pill tone="tint">Jasa</Pill>}
                          {item.hanyaSetoran && <Pill tone="neutral">Via setoran</Pill>}
                        </>
                      }
                      sub={
                        <>
                          <span className="font-medium text-label">{item.pembeli}</span> · {item.ringkas}
                          <br />
                          <span>{fmtTgl(item.tanggal)}</span>
                          {item.viaSetoran ? (
                            <span>
                              {" · "}
                              {item.hanyaSetoran ? "Tunai" : `Jasa ${rupiah(item.viaSetoran.nominal)}`} ikut Setoran harian {fmtTgl(item.viaSetoran.tanggal)}
                              {item.hanyaSetoran ? " — status mengikuti centang setoran" : ""}
                            </span>
                          ) : (
                            item.adaJasa && !item.sudahTf && <span> · otomatis pindah ke Setoran saat pembukuan disimpan</span>
                          )}
                        </>
                      }
                      nominal={item.nominal}
                      onToggle={() => togglePos(item)}
                    />
                  ))}
                </div>
              </div>
            )}

            {semuaSetoran.length > 0 && (
              <div className="space-y-2">
                <SectionHeader title={`Setoran harian admin (${semuaSetoran.length})`} />
                <div className="space-y-2">
                  {semuaSetoran.map(({ row, checked }) => {
                    const k = setoranKey(row);
                    return (
                      <BarisCentangTunai
                        key={k}
                        checked={checked}
                        busy={busyKey === `set:${k}`}
                        disabled={!row.historyId}
                        judul={row.ket}
                        sub={fmtTgl(row.tanggal)}
                        nominal={row.nominal}
                        onToggle={() => toggleSetoran(row, !checked)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {semuaOwner.length > 0 && (
              <div className="space-y-2">
                <SectionHeader title={`Transaksi owner bertanda Tunai (${semuaOwner.length})`} />
                <div className="space-y-2">
                  {semuaOwner.map(({ row, checked }) => {
                    const k = ownerKey(row);
                    return (
                      <BarisCentangTunai
                        key={k}
                        checked={checked}
                        busy={busyKey === `own:${k}`}
                        disabled={!row.id}
                        judul={row.nama}
                        badge={<Pill tone="neutral">{row.jenis === "PEMASUKAN" ? "Pemasukan" : "Pengeluaran"}</Pill>}
                        sub={`${fmtTgl(row.tanggal)} · ${row.kategori} (ketuk untuk pindah ke Rekening)`}
                        nominal={row.nominal}
                        tanda={row.jenis === "PENGELUARAN" ? "keluar" : "masuk"}
                        onToggle={() => toggleOwner(row, !checked)}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
};
