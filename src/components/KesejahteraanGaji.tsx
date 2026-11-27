import React, { useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { Button, FieldLabel, kartu, ListGroup, ListRow, Meter, Sheet, TextField, notify } from "../ui";
import { formatRibuanInput, rpShort, rupiah, toInt } from "../lib/format";
import {
  bacaKonfigIku, faktorDisiplin, fraksiTunjangan, IKU_BATAS, IKU_SEJAK, isTunjanganIku, jumlahTelat, labelYm,
  simpanKonfigIku, sinkronIku, tunjanganMaks, ymDariBt, type HasilIku, type IkuRingkas, type KonfigIku,
} from "../lib/kesejahteraan";
import { urutBulan } from "../lib/gajiBuku";

const WARNA = { naik: "rgb(var(--ui-positive))", tunggu: "rgb(var(--ui-warning))", tint: "rgb(var(--ui-tint))" };
const bulanPanjang = (bt: string) => labelYm(ymDariBt(bt)).replace(/\.$/, "");

/** Cincin skor 0–100 dengan penanda batas 60. */
export const CincinSkor: React.FC<{ skor: number; size?: number }> = ({ skor, size = 76 }) => {
  const r = (size - 8) / 2;
  const kel = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, skor / 100));
  const sudut = (IKU_BATAS / 100) * 2 * Math.PI - Math.PI / 2;
  const c = size / 2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Skor ${Math.floor(skor)} dari 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--ui-fill)" strokeWidth={7} />
        <circle
          cx={c} cy={c} r={r} fill="none" strokeWidth={7} strokeLinecap="round"
          stroke={skor >= IKU_BATAS ? WARNA.naik : WARNA.tunggu}
          strokeDasharray={`${kel * f} ${kel}`} transform={`rotate(-90 ${c} ${c})`}
          className="transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none"
        />
        <line
          x1={c + (r - 6) * Math.cos(sudut)} y1={c + (r - 6) * Math.sin(sudut)}
          x2={c + (r + 6) * Math.cos(sudut)} y2={c + (r + 6) * Math.sin(sudut)}
          stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="text-label/50"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-title2 tabular-nums text-label leading-none">{Math.floor(skor)}</span>
        <span className="text-caption2 text-label-3 mt-0.5">/100</span>
      </div>
    </div>
  );
};

/** Kartu IKU untuk karyawan (Pengaturan › Gaji Saya) — hanya skor, tanpa nominal laba toko. */
export const KartuIkuKaryawan: React.FC<{ iku?: IkuRingkas | null; record?: any }> = ({ iku, record }) => {
  if (!iku || typeof iku.skor !== "number") return null;
  const skor = iku.skor;
  const berlaku = urutBulan(iku.bulan) >= urutBulan(IKU_SEJAK);
  const item = (record?.gajiTambahan || []).find(isTunjanganIku);
  const nominal = toInt(item?.nominal);
  const maks = tunjanganMaks({ gajiPokok: record?.gajiPokok, iku });
  const telat = jumlahTelat(record);
  const disiplin = Math.round(faktorDisiplin(record) * 100);
  const progres = Math.max(0, Number(iku.progres) || 0);
  const kurang = Math.max(1, Math.ceil(IKU_BATAS - skor));

  let judul: React.ReactNode, sub: string;
  if (!berlaku) { judul = `Skor ${Math.floor(skor)}`; sub = `Tunjangan mulai gaji ${bulanPanjang(IKU_SEJAK)}`; }
  else if (iku.ditahan) { judul = "Tunjangan ditahan"; sub = "Bulan lalu toko sedang turun. Skor tetap berjalan."; }
  else if (skor < IKU_BATAS) { judul = `Kurang ${kurang} poin`; sub = `Tunjangan mulai di skor ${IKU_BATAS}`; }
  else { judul = <span className="text-positive">{rupiah(nominal)}</span>; sub = `Tunjangan bulan ini · maks ${rpShort(maks)}`; }

  return (
    <section className={`${kartu} p-4`} aria-label="Indeks kesejahteraan">
      <div className="flex items-center gap-4">
        <CincinSkor skor={skor} />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-label-2">Indeks kesejahteraan · {bulanPanjang(iku.bulan)}</p>
          <p className="text-title3 tabular-nums text-label truncate mt-0.5">{judul}</p>
          <p className="text-footnote text-label-2 leading-snug">{sub}</p>
        </div>
      </div>
      <div className="mt-3.5 space-y-3 border-t border-sep pt-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-subhead font-medium text-label">Dorongan bulan ini</span>
            <span className="text-subhead font-semibold tabular-nums text-label">{progres >= 1 ? "Tembus" : `${Math.round(progres * 100)}%`}</span>
          </div>
          <Meter className="mt-1.5" size="sm" fraction={Math.min(1, progres)} color={progres >= 1 ? WARNA.naik : WARNA.tint} label="Dorongan bulan ini" />
          <p className="mt-1 text-caption text-label-2">{progres >= 1 ? "Bulan ini sudah mendorong skor bulan depan naik." : "Tembus 100% = skor bulan depan naik."}</p>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0">
            <span className="block text-subhead font-medium text-label">Disiplin</span>
            <span className="block text-caption text-label-2">{telat ? `${telat}× telat absen · −${100 - disiplin}% tunjangan` : "Tanpa telat absen"}</span>
          </span>
          <span className={`text-subhead font-semibold tabular-nums ${telat ? "text-warning" : "text-positive"}`}>{disiplin}%</span>
        </div>
      </div>
      <p className="mt-3 text-caption text-label-3 leading-snug">Dihitung dari kinerja toko (rental + usaha) 6 bulan terakhir, diperbarui otomatis.</p>
    </section>
  );
};

// ======================= OWNER =======================
const isiAngka = (v: number) => (v ? formatRibuanInput(v) : "");

/** Baris ringkas di Pegawai › Gaji (owner) → lembar rincian laba, skor & pengaturan. */
export const PanelIkuOwner: React.FC<{ demo?: { hasil: HasilIku; konfig: KonfigIku } }> = ({ demo }) => {
  const [hasil, setHasil] = useState<HasilIku | null>(demo?.hasil || null);
  const [buka, setBuka] = useState(!!demo);
  const [k, setK] = useState<KonfigIku | null>(demo?.konfig || null);
  const [sibuk, setSibuk] = useState(false);
  const [siap, setSiap] = useState(false);

  useEffect(() => { if (!demo) sinkronIku().then(setHasil).catch((e) => console.warn("[iku]", e)).finally(() => setSiap(true)); }, [demo]);
  useEffect(() => { if (buka && !demo) bacaKonfigIku().then(setK); }, [buka, demo]);

  const simpan = async () => {
    if (!k) return;
    setSibuk(true);
    try {
      await simpanKonfigIku(k);
      setHasil(await sinkronIku(true));
      notify("Pengaturan indeks disimpan.", "positive");
    } catch (e: any) {
      notify(e?.message || "Gagal menyimpan.", "negative");
    } finally { setSibuk(false); }
  };

  const skor = hasil?.skor ?? 0;
  const pratinjau = k && hasil ? Math.floor((fraksiTunjangan(skor) * k.persenMaks * 1500000) / 100 / 1000) * 1000 : 0;
  return (
    <>
      <ListGroup>
        <ListRow
          icon={<HeartHandshake size={16} />}
          iconColor="pink"
          title="Indeks kesejahteraan"
          subtitle={hasil ? `Laba rata-rata 6 bln ${rpShort(hasil.rataRata)}` : siap ? "Hanya bisa dibuka akun owner" : "Menghitung…"}
          value={hasil ? `Skor ${Math.floor(skor)}` : ""}
          valueTone={skor >= IKU_BATAS ? "positive" : "warning"}
          chevron
          onClick={hasil ? () => setBuka(true) : undefined}
        />
      </ListGroup>
      <Sheet
        open={buka}
        onClose={() => setBuka(false)}
        size="sm"
        variant="grouped"
        icon={<HeartHandshake />}
        iconColor="pink"
        title="Indeks kesejahteraan"
        subtitle="Hanya owner yang melihat nominal laba"
        footer={<Button variant="filled" block disabled={!k || sibuk} onClick={simpan}>{sibuk ? "Menghitung…" : "Simpan & hitung ulang"}</Button>}
      >
        {hasil && (
          <div className="flex items-center gap-4 px-1 pb-4">
            <CincinSkor skor={skor} />
            <div className="min-w-0">
              <p className="text-caption font-semibold text-label-2">Skor gaji {bulanPanjang(hasil.bulan)}</p>
              <p className="text-title3 tabular-nums text-label">{rupiah(hasil.rataRata)}</p>
              <p className="text-footnote text-label-2">Laba bersih rata-rata / bulan{hasil.ditahan ? " · tunjangan ditahan (bulan lalu rugi)" : ""}</p>
            </div>
          </div>
        )}
        {hasil && (
          <ListGroup>
            {hasil.perBulan.map((b) => (
              <ListRow key={b.ym} title={labelYm(b.ym)} subtitle={`Rental ${rpShort(b.rental)} · Usaha ${rpShort(b.usaha)} · Gaji ${rpShort(b.gaji)}`} value={rpShort(b.total)} valueTone={b.total < 0 ? "negative" : undefined} />
            ))}
            <ListRow title={`${labelYm(hasil.berjalan.ym)} (berjalan)`} subtitle={`Dorongan ${hasil.progres >= 1 ? "tembus" : `${Math.round(hasil.progres * 100)}%`} terhadap ${labelYm(hasil.perBulan[0].ym)}`} value={rpShort(hasil.berjalan.total)} />
          </ListGroup>
        )}
        {k && (
          <div className="mt-4 space-y-3">
            <TextField label={`Ambang aman (skor ${IKU_BATAS})`} inputMode="numeric" value={isiAngka(k.ambang)} onChange={(e) => setK({ ...k, ambang: toInt(e.target.value.replace(/\D/g, "")) })} leftIcon={<span className="text-footnote font-semibold text-label-2">Rp</span>} />
            <TextField label="Batas atas (skor 100)" inputMode="numeric" value={isiAngka(k.atas)} onChange={(e) => setK({ ...k, atas: toInt(e.target.value.replace(/\D/g, "")) })} leftIcon={<span className="text-footnote font-semibold text-label-2">Rp</span>} />
            <TextField label="Tunjangan maksimal (% gaji pokok)" inputMode="numeric" value={k.persenMaks ? String(k.persenMaks) : ""} onChange={(e) => setK({ ...k, persenMaks: Math.min(100, toInt(e.target.value.replace(/\D/g, ""))) })} />
            <p className="px-1 text-footnote text-label-2 leading-snug">
              Skor sekarang: gaji pokok Rp1,5 jt dapat {rupiah(pratinjau)}. Laba tidak menghitung ambilan owner, belanja unit/alat/game, dan belanja stok (barang dihitung untungnya). Usaha dihitung mulai Nov 2026. Tiap telat absen −10% (min 50%).
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
};

// ======================= GAJI POKOK SEKALI ATUR =======================
export const UbahGajiPokokSheet: React.FC<{
  open: boolean;
  nama: string;
  sekarang: number;
  pilihan: { bt: string; label: string }[];
  riwayat: { dari: string; nominal: number }[];
  onTutup: () => void;
  onSimpan: (nominal: number, dari: string) => Promise<void>;
}> = ({ open, nama, sekarang, pilihan, riwayat, onTutup, onSimpan }) => {
  const [nominal, setNominal] = useState(sekarang);
  const [dari, setDari] = useState(pilihan[0]?.bt || "");
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => { if (open) { setNominal(sekarang); setDari(pilihan[0]?.bt || ""); } }, [open, sekarang]); // eslint-disable-line react-hooks/exhaustive-deps
  const simpan = async () => {
    setSibuk(true);
    try { await onSimpan(nominal, dari); onTutup(); } catch (e: any) { notify(e?.message || "Gagal menyimpan.", "negative"); } finally { setSibuk(false); }
  };
  return (
    <Sheet
      open={open}
      onClose={onTutup}
      size="sm"
      variant="grouped"
      title="Gaji pokok"
      subtitle={nama}
      footer={<Button variant="filled" block disabled={sibuk || !(nominal > 0) || (nominal === sekarang && !riwayat.length)} onClick={simpan}>{sibuk ? "Menyimpan…" : "Simpan"}</Button>}
    >
      <TextField
        label="Gaji pokok per bulan"
        inputMode="numeric"
        value={isiAngka(nominal)}
        onChange={(e) => setNominal(toInt(e.target.value.replace(/\D/g, "")))}
        leftIcon={<span className="text-footnote font-semibold text-label-2">Rp</span>}
        inputClassName="text-title3 font-bold tabular-nums"
      />
      <FieldLabel className="mt-4">Berlaku mulai</FieldLabel>
      <div className="flex apple-segmented p-1 rounded-full gap-1" role="radiogroup">
        {pilihan.map((p) => (
          <button key={p.bt} type="button" role="radio" aria-checked={dari === p.bt} onClick={() => setDari(p.bt)}
            className={`flex-1 min-h-[36px] px-2 text-footnote font-semibold rounded-full transition ${dari === p.bt ? "apple-segmented-thumb text-label" : "text-label-2"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="mt-2 px-1 text-footnote text-label-2 leading-snug">Bulan yang sudah dibayar tetap memakai angka lama. Bulan yang diubah khusus tidak ikut berubah.</p>
      {riwayat.length > 0 && (
        <>
          <FieldLabel className="mt-4">Riwayat</FieldLabel>
          <ListGroup>
            {[...riwayat].reverse().map((x) => <ListRow key={x.dari} title={`Mulai ${bulanPanjang(x.dari)}`} value={rupiah(x.nominal)} />)}
          </ListGroup>
        </>
      )}
    </Sheet>
  );
};
