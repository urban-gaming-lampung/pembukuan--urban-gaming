import React, { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, MessageCircle, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button, Footnote, LineItem, LineList, ListGroup, Notice, Pill, Sheet, SubTabs, TextField, konfirmasi, notify, type Nada } from "../../ui";
import { UploadTransferProof } from "../TableEditor";
import { rupiah } from "../../lib/format";
import { auth } from "../../lib/firebase";
import { bukaWa, formatWa, waValid } from "../../lib/wa";
import type { SewaTable } from "../../lib/priceLists";
import type { SewaBerjalan } from "../../lib/sewa";
import {
  aktif,
  catatPesanBooking,
  adaBentrokPenuh,
  cekBentrok,
  teksBentrok,
  estimasiHarga,
  fmtHariTanggalLengkap,
  fmtJam,
  fmtRentangSingkat,
  fmtWaktu,
  hapusBooking,
  LABEL_STATUS,
  LABEL_UNIT,
  mulaiBooking,
  namaStaf,
  pesanBooking,
  pesanTerakhir,
  rentangBooking,
  sisaWaktu,
  ubahBooking,
  type BookingSewa,
  type JenisPesanBooking,
  type Kapasitas,
} from "../../lib/bookingSewa";

export const NADA_STATUS: Record<BookingSewa["status"], Nada> = {
  BARU: "warning",
  KONFIRMASI: "positive",
  DIAMBIL: "tint",
  BATAL: "neutral",
};

const jamTitik = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
};
const isLink = (s?: string) => /^https?:\/\//i.test(String(s || "").trim());

/** Detail booking + aksi: pesan WA, mulai sewa, ubah, batal, hapus (owner / super admin). */
const BookingDetailSheet: React.FC<{
  booking: BookingSewa | null;
  onClose: () => void;
  /** Owner / super admin: boleh hapus permanen */
  bolehHapus: boolean;
  bookings: BookingSewa[];
  berjalan: SewaBerjalan[];
  kapasitas: Kapasitas;
  sewaTable: SewaTable;
  onUbah: (b: BookingSewa) => void;
  onMulaiSewa: (b: BookingSewa) => Promise<boolean>;
  onDpHangus: (b: BookingSewa, alasan: string) => Promise<boolean>;
  onUrungkan: (b: BookingSewa) => Promise<boolean>;
}> = ({ booking: b, onClose, bolehHapus, bookings, berjalan, kapasitas, sewaTable, onUbah, onMulaiSewa, onDpHangus, onUrungkan }) => {
  const [modeBatal, setModeBatal] = useState(false);
  const [alasan, setAlasan] = useState("");
  const [nasibDp, setNasibDp] = useState<"" | "HANGUS" | "KEMBALI">("");
  const [sibuk, setSibuk] = useState(false);
  const now = Date.now();

  useEffect(() => {
    setModeBatal(false);
    setAlasan("");
    setNasibDp("");
  }, [b?.id]);

  const bentrok = useMemo(() => (b && aktif(b) ? cekBentrok(b, { bookings, berjalan, kapasitas, now: Date.now() }) : []), [b, bookings, berjalan, kapasitas]);
  if (!b) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;

  const m = mulaiBooking(b);
  const harga = estimasiHarga(b, sewaTable);
  const dp = b.dp && b.dp.nominal > 0 ? b.dp : null;
  const bisaAksi = aktif(b);

  const jalankan = async (fn: () => Promise<unknown>) => {
    setSibuk(true);
    try {
      await fn();
    } catch (e: any) {
      notify(e?.code === "permission-denied" ? "Tidak punya izin untuk aksi ini." : `Gagal: ${e?.message || e}`, "negative");
    } finally {
      setSibuk(false);
    }
  };

  const kirimWa = (jenis: JenisPesanBooking) => {
    if (!waValid(b.wa)) {
      notify("No. WA penyewa tidak valid. Ubah booking dulu.", "warning");
      return;
    }
    bukaWa(b.wa, pesanBooking(b, jenis));
    catatPesanBooking(b.id, jenis).catch((e) => console.error("Gagal mencatat pesan booking:", e));
  };

  const mulai = () =>
    jalankan(async () => {
      if (m !== null && m - Date.now() > 2 * 3600000) {
        const ok = await konfirmasi(`Jam ambil masih ${sisaWaktu(m, Date.now())} (${fmtWaktu(m)}). Mulai sewa sekarang?`, { judul: "Belum jam ambil", ya: "Mulai sekarang" });
        if (!ok) return;
      }
      if (dp && dp.metode === "TRANSFER" && !dp.bukti) notify("Bukti TF DP belum ada — unggah lewat Ubah booking.", "warning");
      if (await onMulaiSewa(b)) onClose();
    });

  const batalkan = () =>
    jalankan(async () => {
      if (dp && !nasibDp) {
        notify("Pilih DP hangus atau dikembalikan.", "warning");
        return;
      }
      if (dp && nasibDp === "HANGUS") {
        if (await onDpHangus(b, alasan.trim())) onClose();
        return;
      }
      await ubahBooking(b.id, {
        status: "BATAL",
        batal: { alasan: alasan.trim(), oleh: auth.currentUser?.email || "admin", ts: Date.now(), dp: dp ? "KEMBALI" : null },
      });
      notify("Booking dibatalkan.", "info");
      onClose();
    });

  const hapus = () =>
    jalankan(async () => {
      const ok = await konfirmasi(`Booking ${b.nama} (${b.jenisPS}, ${m !== null ? fmtWaktu(m) : b.tanggal}) dihapus permanen. Pakai hanya untuk salah input.`, {
        judul: "Hapus booking?",
        ya: "Hapus",
        bahaya: true,
      });
      if (!ok) return;
      await hapusBooking(b.id);
      notify("Booking dihapus.", "info");
      onClose();
    });

  const tandaiPasti = () => jalankan(() => ubahBooking(b.id, { status: "KONFIRMASI" }));

  const pesanKonfirmasi = pesanTerakhir(b, "KONFIRMASI");
  const pesanIngat = pesanTerakhir(b, "PENGINGAT");

  return (
    <Sheet
      open
      onClose={() => !sibuk && onClose()}
      title={b.nama || "Booking"}
      subtitle={`${b.jenisPS} · ${String(b.lamaSewa || "").toLowerCase()}`}
      size="md"
      zClassName="z-[260]"
      headerRight={<Pill tone={NADA_STATUS[b.status]}>{LABEL_STATUS[b.status]}</Pill>}
    >
      <div className="space-y-4">
        {/* ---- Waktu ambil */}
        {(() => {
          const r = rentangBooking(b);
          return (
            <div className="rounded-tile apple-tile ring-1 ring-edge px-4 py-3.5">
              <div className="text-caption font-semibold uppercase tracking-[0.06em] text-label-2">Jadwal ambil</div>
              <div className="mt-0.5 text-headline font-bold text-label">
                {m !== null ? fmtHariTanggalLengkap(m) : "Belum ada jadwal"}
              </div>
              {m !== null && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-subhead font-semibold tabular-nums text-label-2">
                  <span>{r ? fmtRentangSingkat(r.mulai, r.selesai) : `Pukul ${fmtJam(m)}`}</span>
                  {bisaAksi && (
                    <span className={m < now ? "text-footnote font-semibold text-warning" : "text-footnote font-normal text-label-3"}>
                      · {sisaWaktu(m, now)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {bisaAksi && bentrok.length > 0 && (
          <Notice tone={adaBentrokPenuh(bentrok) ? "negative" : "warning"}>
            {bentrok.map((x) => (
              <div key={x.unit}>
                {teksBentrok(x)} ({x.penyebab.slice(0, 2).join(" · ")})
              </div>
            ))}
          </Notice>
        )}

        {b.status === "DIAMBIL" && b.diambil && (
          <Notice tone="info">
            Sewa dimulai {jamTitik(b.diambil.ts)} oleh {namaStaf(b.diambil.oleh)} — masuk Rincian Sewa tanggal {b.diambil.tanggal}.
          </Notice>
        )}
        {b.status === "BATAL" && b.batal && (
          <Notice tone="negative">
            Dibatalkan {jamTitik(b.batal.ts)}
            {b.batal.alasan ? ` · ${b.batal.alasan}` : ""}
            {b.batal.dp === "HANGUS" ? " · DP hangus (tetap tercatat sebagai pemasukan)" : b.batal.dp === "KEMBALI" ? " · DP dikembalikan (catatan DP dihapus)" : ""}
          </Notice>
        )}

        {/* ---- Rincian */}
        <ListGroup>
          <LineList className="px-4">
            <LineItem
              label="No. WA"
              note={waValid(b.wa) ? "Ketuk untuk chat" : "Tidak valid, ubah booking"}
              value={b.wa ? formatWa(b.wa) : "—"}
              onClick={waValid(b.wa) ? () => bukaWa(b.wa, "") : undefined}
            />
            <LineItem
              label="Cara ambil"
              note={b.antar ? (b.alamat ? (isLink(b.alamat) ? "Sharelok terlampir" : b.alamat) : "Alamat belum diisi") : undefined}
              value={b.antar ? "Diantar" : "Ambil di toko"}
              onClick={b.antar && isLink(b.alamat) ? () => window.open(b.alamat, "_blank", "noopener") : undefined}
            />
            <LineItem
              label="Perkiraan harga"
              note={harga.dasar > 0 ? [`sewa ${rupiah(harga.dasar)}`, harga.ongkir > 0 ? `ongkir ${rupiah(harga.ongkir)}` : ""].filter(Boolean).join(" · ") : "Tidak ada di tabel harga"}
              value={harga.dasar > 0 ? rupiah(harga.total) : "—"}
            />
            <LineItem
              label="DP"
              note={dp ? `${dp.metode === "CASH" ? "Cash" : "Transfer"}${dp.metode === "TRANSFER" ? (dp.bukti ? " · bukti ada" : " · bukti belum ada") : ""}` : "Belum dibayar"}
              value={dp ? rupiah(dp.nominal) : "—"}
              tone={dp ? "positive" : undefined}
            />
            {dp && harga.dasar > 0 && <LineItem label="Sisa bayar saat ambil" value={rupiah(Math.max(0, harga.total - dp.nominal))} total />}
          </LineList>
        </ListGroup>

        {dp?.bukti && (
          <div className="flex items-center gap-2.5 px-1">
            <UploadTransferProof value={dp.bukti} onChange={() => {}} disabled />
            <span className="text-footnote text-label-2">Bukti TF DP</span>
          </div>
        )}

        {b.catatan && (
          <div className="rounded-tile apple-tile ring-1 ring-edge px-4 py-3 text-subhead text-label whitespace-pre-line">{b.catatan}</div>
        )}

        {/* ---- Pesan WA */}
        {bisaAksi && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="tinted" icon={<MessageCircle />} onClick={() => kirimWa("KONFIRMASI")} disabled={sibuk}>
                Konfirmasi
              </Button>
              <Button variant="tinted" icon={<BellRing />} onClick={() => kirimWa("PENGINGAT")} disabled={sibuk}>
                Ingatkan
              </Button>
            </div>
            <Footnote>
              {[
                pesanKonfirmasi ? `Konfirmasi terkirim ${jamTitik(pesanKonfirmasi.ts)} (${namaStaf(pesanKonfirmasi.oleh)})` : "Konfirmasi belum dikirim",
                pesanIngat ? `pengingat terkirim ${jamTitik(pesanIngat.ts)} (${namaStaf(pesanIngat.oleh)})` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              .
            </Footnote>
          </div>
        )}

        {/* ---- Aksi */}
        {bisaAksi && !modeBatal && (
          <div className="space-y-2.5">
            <Button variant="filled" size="lg" block icon={<Play />} onClick={mulai} loading={sibuk}>
              Mulai sewa
            </Button>
            <div className={b.status === "BARU" ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-1"}>
              <Button variant="gray" icon={<Pencil />} onClick={() => onUbah(b)} disabled={sibuk}>
                Ubah
              </Button>
              {b.status === "BARU" && (
                <Button variant="gray" icon={<CheckCircle2 />} onClick={tandaiPasti} disabled={sibuk}>
                  Pasti jadi
                </Button>
              )}
            </div>
            <Button variant="plain" block className="text-negative" onClick={() => setModeBatal(true)} disabled={sibuk}>
              Batalkan booking
            </Button>
          </div>
        )}

        {bisaAksi && modeBatal && (
          <div className="rounded-tile apple-tile ring-1 ring-edge p-3.5 space-y-3">
            <div className="text-subhead font-semibold text-label">Batalkan booking</div>
            <TextField label="Alasan" placeholder="Opsional (mis. penyewa tidak jadi)" value={alasan} onChange={(e) => setAlasan(e.target.value)} />
            {dp && (
              <div className="space-y-2">
                <SubTabs<"" | "HANGUS" | "KEMBALI">
                  size="sm"
                  ariaLabel="DP booking batal"
                  value={nasibDp}
                  onChange={setNasibDp}
                  options={[
                    { key: "HANGUS", label: "DP hangus" },
                    { key: "KEMBALI", label: "Dikembalikan" },
                  ]}
                />
                <Footnote>
                  {nasibDp === "HANGUS"
                    ? `DP ${rupiah(dp.nominal)} tetap tercatat sebagai pemasukan (sudah masuk sejak diterima).`
                    : nasibDp === "KEMBALI"
                      ? "DP dikembalikan ke penyewa; catatan DP di Transaksi & Analitik dihapus."
                      : `Penyewa sudah DP ${rupiah(dp.nominal)}. Pilih hangus atau dikembalikan.`}
                </Footnote>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="gray" onClick={() => setModeBatal(false)} disabled={sibuk}>
                Kembali
              </Button>
              <Button variant="destructive" onClick={batalkan} loading={sibuk}>
                Batalkan
              </Button>
            </div>
          </div>
        )}

        {!bisaAksi && (
          <Button variant="gray" block icon={<RotateCcw />} onClick={() => jalankan(async () => { if (await onUrungkan(b)) onClose(); })} disabled={sibuk}>
            {b.status === "DIAMBIL" ? "Urungkan mulai sewa" : "Aktifkan lagi"}
          </Button>
        )}

        <Footnote>
          Dicatat {namaStaf(b.dibuatOleh)} · {jamTitik(b.dibuatTs)}
          {b.diubahTs ? ` · diubah ${namaStaf(b.diubahOleh)} ${jamTitik(b.diubahTs)}` : ""}
          {b.sumber === "WA" ? " · dari pesan WhatsApp" : ""}
        </Footnote>

        {bolehHapus && (
          <Button variant="destructive" block icon={<Trash2 />} onClick={hapus} disabled={sibuk}>
            Hapus booking
          </Button>
        )}
      </div>
    </Sheet>
  );
};

export default BookingDetailSheet;
