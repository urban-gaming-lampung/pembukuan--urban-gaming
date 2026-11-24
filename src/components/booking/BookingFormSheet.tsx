import React, { useEffect, useMemo, useState } from "react";
import { ClipboardPaste, RotateCcw } from "lucide-react";
import { Button, Footnote, Notice, SelectField, Sheet, SubTabs, TextAreaField, TextField, cx, notify, konfirmasi } from "../../ui";
import { UploadTransferProof } from "../TableEditor";
import { formatRibuanInput, rupiah, toInt } from "../../lib/format";
import { formatWa, rapikanWa, waValid } from "../../lib/wa";
import type { SewaTable } from "../../lib/priceLists";
import type { SewaBerjalan } from "../../lib/sewa";
import {
  aktif,
  bacaTeksBooking,
  adaBentrokPenuh,
  cekBentrok,
  teksBentrok,
  estimasiHarga,
  fmtHariTanggalLengkap,
  fmtJam,
  fmtRentangSingkat,
  LABEL_UNIT,
  mulaiBooking,
  rentangBooking,
  simpanBooking,
  type BookingSewa,
  type HasilBaca,
  type Kapasitas,
} from "../../lib/bookingSewa";

type Draf = {
  nama: string;
  wa: string;
  jenisPS: string;
  lamaSewa: string;
  tanggal: string;
  jam: string;
  antar: boolean | null;
  alamat: string;
  ongkir: string;
  dpMetode: "" | "TRANSFER" | "CASH";
  dpNominal: string;
  dpBukti: string;
  catatan: string;
  teksAsli: string;
  sumber: "WA" | "MANUAL";
};

const DRAF_KOSONG: Draf = {
  nama: "", wa: "", jenisPS: "", lamaSewa: "", tanggal: "", jam: "", antar: null, alamat: "", ongkir: "",
  dpMetode: "", dpNominal: "", dpBukti: "", catatan: "", teksAsli: "", sumber: "MANUAL",
};

const dariBooking = (b: BookingSewa): Draf => ({
  nama: b.nama || "",
  wa: b.wa || "",
  jenisPS: b.jenisPS || "",
  lamaSewa: b.lamaSewa || "",
  tanggal: b.tanggal || "",
  jam: b.jam || "",
  antar: typeof b.antar === "boolean" ? b.antar : null,
  alamat: b.alamat || "",
  ongkir: b.ongkir ? String(b.ongkir) : "",
  dpMetode: b.dp && b.dp.nominal > 0 ? b.dp.metode : "",
  dpNominal: b.dp && b.dp.nominal > 0 ? String(b.dp.nominal) : "",
  dpBukti: b.dp?.bukti || "",
  catatan: b.catatan || "",
  teksAsli: b.teksAsli || "",
  sumber: b.sumber || "MANUAL",
});

const LABEL_ISIAN: Record<HasilBaca["kosong"][number], string> = {
  nama: "nama",
  wa: "No. WA",
  jenisPS: "jenis",
  lamaSewa: "lama sewa",
  tanggal: "tanggal ambil",
  jam: "jam ambil",
  antar: "antar jemput",
};

/**
 * Form booking sewa: tempel pesan WhatsApp (isian otomatis) atau isi manual.
 * Pilihan jenis & lama sewa sama dengan Rincian Sewa (tabel harga Edit Rincian).
 */
const BookingFormSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  /** Booking yang diubah (kosong = booking baru) */
  booking?: BookingSewa | null;
  /** Nilai awal saat membuka dari panel Slot Kosong */
  prefill?: Partial<Pick<BookingSewa, "tanggal" | "jam" | "jenisPS" | "lamaSewa">> | null;
  bookings: BookingSewa[];
  berjalan: SewaBerjalan[];
  kapasitas: Kapasitas;
  sewaTable: SewaTable;
  onSaved: (id: string) => void;
}> = ({ open, onClose, booking, prefill, bookings, berjalan, kapasitas, sewaTable, onSaved }) => {
  const [d, setD] = useState<Draf>(DRAF_KOSONG);
  const [hasil, setHasil] = useState<HasilBaca | null>(null);
  const [cobaSimpan, setCobaSimpan] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (booking) {
      setD(dariBooking(booking));
    } else if (prefill) {
      setD({
        ...DRAF_KOSONG,
        tanggal: prefill.tanggal || "",
        jam: prefill.jam || "",
        jenisPS: prefill.jenisPS || "",
        lamaSewa: prefill.lamaSewa || "",
      });
    } else {
      setD(DRAF_KOSONG);
    }
    setHasil(null);
    setCobaSimpan(false);
  }, [open, booking, prefill]);

  const set = <K extends keyof Draf>(k: K, v: Draf[K]) => setD((x) => ({ ...x, [k]: v }));

  const jenisOptions = useMemo(() => {
    const o = sewaTable.jenisOptions.filter((j) => j !== "Hanya Ongkir");
    return d.jenisPS && !o.includes(d.jenisPS) ? [...o, d.jenisPS] : o;
  }, [sewaTable.jenisOptions, d.jenisPS]);
  const lamaOptions = useMemo(() => {
    const o = sewaTable.lamaOptions;
    return d.lamaSewa && !o.some((x) => x.toUpperCase() === d.lamaSewa.toUpperCase()) ? [...o, d.lamaSewa] : o;
  }, [sewaTable.lamaOptions, d.lamaSewa]);

  const baca = (teks: string) => {
    if (!teks.trim()) return;
    const h = bacaTeksBooking(teks, { jenisOptions: sewaTable.jenisOptions, lamaOptions: sewaTable.lamaOptions });
    setD((x) => ({
      ...x,
      teksAsli: teks,
      sumber: "WA",
      nama: h.isi.nama ?? x.nama,
      wa: h.isi.wa ?? x.wa,
      jenisPS: h.isi.jenisPS ?? x.jenisPS,
      lamaSewa: h.isi.lamaSewa ?? x.lamaSewa,
      tanggal: h.isi.tanggal ?? x.tanggal,
      jam: h.isi.jam ?? x.jam,
      antar: h.isi.antar ?? x.antar,
      alamat: h.isi.alamat ?? x.alamat,
    }));
    setHasil(h);
  };

  const tempel = async () => {
    try {
      const teks = await navigator.clipboard.readText();
      if (teks.trim()) {
        set("teksAsli", teks);
        baca(teks);
        return;
      }
    } catch {
      /* izin clipboard ditolak: tempel manual di kotak teks */
    }
    document.getElementById("booking-teks-wa")?.focus();
    notify("Tekan lama kotak teks lalu pilih Tempel.", "info");
  };

  // ---- validasi
  const salah = {
    nama: !d.nama.trim() ? "Isi nama penyewa" : "",
    wa: !rapikanWa(d.wa) ? "Isi No. WA" : !waValid(d.wa) ? "No. WA tidak valid (08xx, 10–13 digit)" : "",
    jenisPS: !d.jenisPS ? "Pilih jenis" : "",
    lamaSewa: !d.lamaSewa ? "Pilih lama sewa" : "",
    tanggal: !d.tanggal ? "Isi tanggal" : "",
    jam: !d.jam ? "Isi jam" : "",
    antar: d.antar === null ? "Pilih ambil di toko atau diantar" : "",
    dp: d.dpMetode && toInt(d.dpNominal) <= 0 ? "Isi nominal DP" : "",
  };
  const adaSalah = Object.values(salah).some(Boolean);
  const err = (k: keyof typeof salah) => (cobaSimpan ? salah[k] || undefined : undefined);

  const calon = {
    id: booking?.id,
    jenisPS: d.jenisPS,
    lamaSewa: d.lamaSewa,
    tanggal: d.tanggal,
    jam: d.jam,
    antar: !!d.antar,
    ongkir: toInt(d.ongkir),
  };
  const harga = d.jenisPS && d.lamaSewa ? estimasiHarga(calon, sewaTable) : null;
  const dpNominal = d.dpMetode ? toInt(d.dpNominal) : 0;
  const bentrok = useMemo(
    () => (d.jenisPS && d.tanggal && d.jam && d.lamaSewa ? cekBentrok(calon as any, { bookings, berjalan, kapasitas, now: Date.now() }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.jenisPS, d.tanggal, d.jam, d.lamaSewa, bookings, berjalan, kapasitas, booking?.id]
  );

  const simpan = async () => {
    setCobaSimpan(true);
    if (adaSalah) {
      notify("Lengkapi isian yang ditandai merah.", "warning");
      return;
    }
    const m = mulaiBooking(d);
    if (!booking && m !== null && m < Date.now() - 30 * 60000) {
      const ok = await konfirmasi("Jam ambil sudah lewat. Tetap simpan booking ini?", { judul: "Jam ambil sudah lewat", ya: "Tetap simpan" });
      if (!ok) return;
    }
    const wa = rapikanWa(d.wa);
    const kembar = bookings.find((x) => aktif(x) && x.id !== booking?.id && rapikanWa(x.wa) === wa && x.tanggal === d.tanggal);
    if (kembar) {
      const ok = await konfirmasi(`Sudah ada booking ${kembar.nama} (${kembar.jenisPS}) di tanggal yang sama dengan No. WA ini. Tetap simpan sebagai booking baru?`, {
        judul: "Booking mungkin dobel",
        ya: "Tetap simpan",
      });
      if (!ok) return;
    }
    setMenyimpan(true);
    try {
      const sebelumnya = booking?.dp;
      const id = await simpanBooking(
        {
          nama: d.nama,
          wa,
          jenisPS: d.jenisPS,
          lamaSewa: d.lamaSewa,
          tanggal: d.tanggal,
          jam: d.jam,
          antar: !!d.antar,
          alamat: d.alamat,
          ongkir: toInt(d.ongkir),
          dp: dpNominal > 0
            ? {
                nominal: dpNominal,
                metode: d.dpMetode as "TRANSFER" | "CASH",
                ...(d.dpMetode === "TRANSFER" && d.dpBukti ? { bukti: d.dpBukti } : {}),
                ts: sebelumnya?.ts || Date.now(),
                oleh: sebelumnya?.oleh || "",
              }
            : null,
          catatan: d.catatan,
          sumber: d.sumber,
          teksAsli: d.teksAsli,
          // DP baru masuk: booking otomatis "Pasti jadi"
          ...(booking && booking.status === "BARU" && dpNominal > 0 ? { status: "KONFIRMASI" as const } : {}),
        },
        booking?.id
      );
      notify(booking ? "Booking diperbarui." : "Booking tersimpan.", "positive");
      onSaved(id);
    } catch (e: any) {
      notify(`Gagal menyimpan booking: ${e?.message || e}`, "negative");
    } finally {
      setMenyimpan(false);
    }
  };

  const terbaca = hasil ? 7 - hasil.kosong.length : 0;

  return (
    <Sheet
      open={open}
      onClose={() => !menyimpan && onClose()}
      title={booking ? "Ubah booking" : "Booking baru"}
      size="md"
      zClassName="z-[270]"
      footer={
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="gray" size="lg" block onClick={onClose} disabled={menyimpan}>
            Batal
          </Button>
          <Button variant="filled" size="lg" block onClick={simpan} loading={menyimpan}>
            Simpan
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* ---- Tempel dari WhatsApp */}
        <section className="rounded-tile apple-tile ring-1 ring-edge p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-subhead font-semibold text-label">Tempel dari WhatsApp</div>
              <div className="text-caption text-label-2">Format booking diisi otomatis, cek lagi sebelum simpan.</div>
            </div>
            <Button variant="tinted" size="sm" icon={<ClipboardPaste />} onClick={tempel}>
              Tempel
            </Button>
          </div>
          <TextAreaField
            id="booking-teks-wa"
            rows={d.teksAsli ? 4 : 2}
            placeholder="Atau tempel pesan di sini (boleh beberapa chat sekaligus)"
            value={d.teksAsli}
            onChange={(e) => set("teksAsli", e.target.value)}
            onPaste={(e) => {
              const teks = e.clipboardData.getData("text");
              if (teks) setTimeout(() => baca(teks), 0);
            }}
            textareaClassName="text-footnote"
          />
          {d.teksAsli.trim() && (
            <div className="flex justify-end">
              <Button variant="plain" size="sm" icon={<RotateCcw />} onClick={() => baca(d.teksAsli)}>
                Baca ulang
              </Button>
            </div>
          )}
          {hasil && (
            <Notice tone={hasil.kosong.length ? "warning" : "info"}>
              <div className="space-y-0.5">
                <div className="font-semibold">
                  {hasil.kosong.length ? `Terbaca ${terbaca} dari 7 isian.` : "Semua isian terbaca. Cek lagi sebelum simpan."}
                </div>
                {hasil.kosong.length > 0 && <div>Isi manual: {hasil.kosong.map((k) => LABEL_ISIAN[k]).join(", ")}.</div>}
                {hasil.ragu.map((r) => (
                  <div key={r}>{r}</div>
                ))}
              </div>
            </Notice>
          )}
        </section>

        {/* ---- Penyewa */}
        <section className="space-y-3">
          <TextField label="Nama penyewa" required value={d.nama} onChange={(e) => set("nama", e.target.value)} error={err("nama")} autoComplete="off" />
          <TextField
            label="No. WA"
            required
            type="tel"
            inputMode="tel"
            placeholder="08xx"
            value={d.wa}
            onChange={(e) => set("wa", e.target.value)}
            onBlur={() => waValid(d.wa) && set("wa", formatWa(d.wa))}
            error={err("wa")}
          />
        </section>

        {/* ---- Unit & jadwal */}
        <section className="grid grid-cols-2 gap-3">
          <SelectField label="Jenis" required value={d.jenisPS} onChange={(e) => set("jenisPS", e.target.value)} error={err("jenisPS")}>
            <option value="">Pilih…</option>
            {jenisOptions.map((j) => (
              <option key={j} value={j}>
                {j}
              </option>
            ))}
          </SelectField>
          <SelectField label="Lama sewa" required value={d.lamaSewa} onChange={(e) => set("lamaSewa", e.target.value)} error={err("lamaSewa")}>
            <option value="">Pilih…</option>
            {lamaOptions.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </SelectField>
          <TextField label="Tanggal ambil" required type="date" value={d.tanggal} onChange={(e) => set("tanggal", e.target.value)} error={err("tanggal")} />
          <TextField label="Jam ambil" required type="time" value={d.jam} onChange={(e) => set("jam", e.target.value)} error={err("jam")} />
        </section>

        {(() => {
          const r = d.tanggal && d.jam && d.lamaSewa ? rentangBooking(d) : null;
          const m = d.tanggal && d.jam ? mulaiBooking(d) : null;
          if (m === null) return null;
          return (
            <div className="rounded-field bg-fill/75 px-3 py-2 text-caption text-label-2 tabular-nums">
              <span className="font-semibold text-label">{fmtHariTanggalLengkap(m)}</span>
              <span> · {r ? fmtRentangSingkat(r.mulai, r.selesai) : `pukul ${fmtJam(m)}`}</span>
            </div>
          );
        })()}

        {bentrok.length > 0 && (
          <Notice tone={adaBentrokPenuh(bentrok) ? "negative" : "warning"}>
            <div className="space-y-1">
              {bentrok.map((x) => (
                <div key={x.unit}>
                  <div className="font-semibold">{teksBentrok(x)}</div>
                  <div className="text-caption text-label-2">{x.penyebab.slice(0, 3).join(" · ")}{x.penyebab.length > 3 ? ` · +${x.penyebab.length - 3} lagi` : ""}</div>
                </div>
              ))}
            </div>
          </Notice>
        )}

        {/* ---- Antar jemput */}
        <section className="space-y-2.5">
          <div className="text-caption font-semibold uppercase tracking-[0.06em] text-label-2">
            Antar jemput<span className="ml-0.5 text-negative">*</span>
          </div>
          <SubTabs<"AMBIL" | "ANTAR" | "">
            size="sm"
            ariaLabel="Cara ambil unit"
            value={d.antar === null ? "" : d.antar ? "ANTAR" : "AMBIL"}
            onChange={(k) => set("antar", k === "ANTAR")}
            options={[
              { key: "AMBIL", label: "Ambil di toko" },
              { key: "ANTAR", label: "Diantar" },
            ]}
          />
          {err("antar") && <div className="text-caption text-negative">{err("antar")}</div>}
          {d.antar && (
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <TextField label="Alamat / sharelok" value={d.alamat} onChange={(e) => set("alamat", e.target.value)} placeholder="Link maps atau alamat" />
              <TextField
                label="Ongkir"
                inputMode="numeric"
                placeholder="0"
                leftIcon={<span className="text-footnote font-semibold">Rp</span>}
                value={formatRibuanInput(d.ongkir)}
                onChange={(e) => set("ongkir", e.target.value.replace(/\D/g, ""))}
              />
            </div>
          )}
        </section>

        {/* ---- DP */}
        <section className="space-y-2.5">
          <div className="text-caption font-semibold uppercase tracking-[0.06em] text-label-2">DP</div>
          <SubTabs<"" | "TRANSFER" | "CASH">
            size="sm"
            ariaLabel="DP booking"
            value={d.dpMetode}
            onChange={(k) => set("dpMetode", k)}
            options={[
              { key: "", label: "Belum DP" },
              { key: "TRANSFER", label: "Transfer" },
              { key: "CASH", label: "Cash" },
            ]}
          />
          {d.dpMetode && (
            <div className="flex items-end gap-3">
              <TextField
                wrapperClassName="flex-1"
                label="Nominal DP"
                required
                inputMode="numeric"
                placeholder="0"
                leftIcon={<span className="text-footnote font-semibold">Rp</span>}
                value={formatRibuanInput(d.dpNominal)}
                onChange={(e) => set("dpNominal", e.target.value.replace(/\D/g, ""))}
                error={err("dp")}
              />
              {d.dpMetode === "TRANSFER" && (
                <div className="flex h-11 shrink-0 items-center gap-2">
                  <span className="text-caption text-label-2">Bukti</span>
                  <UploadTransferProof value={d.dpBukti} onChange={(url) => set("dpBukti", url)} />
                </div>
              )}
            </div>
          )}
          {d.dpMetode && (
            <Footnote>
              DP langsung tercatat sebagai pemasukan Rental (Transaksi & Analitik) di tanggal diterima. Saat Mulai sewa, Rincian Sewa hanya berisi sisa bayar. Batal dengan DP dikembalikan menghapus catatan DP.
              {d.dpMetode === "TRANSFER" && !d.dpBukti ? " Bukti TF boleh menyusul." : ""}
              {d.dpMetode === "CASH" ? " Simpan uang DP cash sampai sewa dimulai, lalu ikut setoran hari itu." : ""}
            </Footnote>
          )}
        </section>

        {harga && (
          <div className={cx("rounded-tile apple-tile ring-1 ring-edge px-3.5 py-3")}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-subhead text-label">Perkiraan harga</span>
              <span className="text-headline font-semibold tabular-nums text-label">{harga.dasar > 0 ? rupiah(harga.total) : "—"}</span>
            </div>
            <div className="mt-0.5 text-caption text-label-2">
              {harga.dasar > 0
                ? [
                    `Sewa ${rupiah(harga.dasar)}`,
                    harga.ongkir > 0 ? `ongkir ${rupiah(harga.ongkir)}` : "",
                    dpNominal > 0 ? `sisa sesudah DP ${rupiah(Math.max(0, harga.total - dpNominal))}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Harga tidak ada di tabel Edit Rincian — diisi saat mulai sewa."}
            </div>
          </div>
        )}

        <TextAreaField label="Catatan" rows={2} value={d.catatan} onChange={(e) => set("catatan", e.target.value)} placeholder="Opsional (mis. minta stik tambahan)" />
      </div>
    </Sheet>
  );
};

export default BookingFormSheet;
