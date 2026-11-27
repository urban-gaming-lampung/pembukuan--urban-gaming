import React, { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, Undo2 } from "lucide-react";
import { Button, FieldLabel, ListGroup, ListRow, Sheet, TextField, notify } from "../ui";
import { rupiah } from "../lib/format";
import { bisaDiretur, LABEL_KEMBALI_RETUR, returBarangNota, type CaraKembaliRetur, type PosSale } from "../lib/posSales";

/**
 * RETUR BARANG (owner / super admin): pilih barang di nota → dicoret dari nota, stok kembali,
 * uang kembali ke pembeli lewat transfer owner atau tunai kas toko.
 */
const ReturNotaSheet: React.FC<{ sale: PosSale; open: boolean; onClose: () => void }> = ({ sale, open, onClose }) => {
  const pilihan = useMemo(() => (sale.items || []).map((it, i) => ({
    it, i,
    // Stik bonus ikut kembali bersama unitnya (unit berbonus diretur utuh)
    bonus: (sale.items || []).filter((x) => x.bonusUntukProdukId && x.bonusUntukProdukId === it.id).reduce((a, x) => a + (Number(x.qty) || 0), 0),
  })).filter(({ it }) => bisaDiretur(it)), [sale.items]);
  /** index barang → jumlah yang diretur */
  const [pilih, setPilih] = useState<Record<number, number>>({});
  const [kembali, setKembali] = useState<CaraKembaliRetur>("TRANSFER_OWNER");
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPilih(pilihan.length === 1 ? { [pilihan[0].i]: pilihan[0].it.qty } : {});
    setKembali("TRANSFER_OWNER");
    setAlasan("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const dipilih = pilihan.filter(({ i }) => pilih[i] > 0);
  const nilai = dipilih.reduce((a, { it, i }) => a + pilih[i] * (Number(it.harga) || 0), 0);
  const jumlahStok = dipilih.reduce((a, { i, bonus }) => a + pilih[i] + bonus, 0);
  const it = dipilih[0]?.it || null;
  const ubahQty = (i: number, q: number) => setPilih((p) => ({ ...p, [i]: q }));

  const simpan = async () => {
    if (!dipilih.length) return;
    setSibuk(true);
    try {
      await returBarangNota(sale, dipilih.map(({ i }) => ({ itemIndex: i, qty: pilih[i] })), kembali, alasan);
      notify(`${dipilih.length} barang diretur · stok +${jumlahStok}`, "positive");
      onClose();
    } catch (e: any) {
      notify(e?.message || "Retur gagal.", "negative");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="sm"
      variant="grouped"
      zClassName="z-[270]"
      icon={<Undo2 />}
      iconColor="orange"
      title="Retur barang"
      subtitle={<span className="font-mono">{sale.noNota}</span>}
      footer={
        <Button variant="destructive" size="lg" block disabled={!it || sibuk} onClick={simpan}>
          {sibuk ? "Menyimpan…" : it ? `Retur ${dipilih.length} barang · ${rupiah(nilai)}` : "Pilih barang dulu"}
        </Button>
      }
    >
      <FieldLabel>Barang yang dikembalikan</FieldLabel>
      <ListGroup>
        {pilihan.map(({ it: x, i, bonus }, k) => {
          const aktif = pilih[i] > 0;
          const bisaAturQty = aktif && x.qty > 1 && !bonus;
          return (
            <div key={x.id + i} className={k ? "relative before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-sep" : undefined}>
              <ListRow
                title={x.nama}
                subtitle={`${x.qty} x ${rupiah(x.harga)}${bonus ? ` · ${bonus} stik bonus ikut kembali` : ""}`}
                value={aktif ? <Check className="h-5 w-5 text-tint" /> : <span className="block h-5 w-5 rounded-full ring-[1.5px] ring-inset ring-label-3/60" />}
                chevron={false}
                onClick={() => setPilih((p) => ({ ...p, [i]: p[i] > 0 ? 0 : x.qty }))}
              />
              {bisaAturQty && (
                <div className="flex items-center justify-between px-4 pb-2.5 -mt-1">
                  <span className="text-footnote text-label-2">Jumlah retur</span>
                  <span className="flex items-center gap-3">
                    <button type="button" aria-label="Kurangi" disabled={pilih[i] <= 1} onClick={() => ubahQty(i, pilih[i] - 1)} className="hit-44 grid h-8 w-8 place-items-center rounded-full bg-fill text-label disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                    <span className="w-6 text-center text-headline tabular-nums text-label">{pilih[i]}</span>
                    <button type="button" aria-label="Tambah" disabled={pilih[i] >= x.qty} onClick={() => ubahQty(i, pilih[i] + 1)} className="hit-44 grid h-8 w-8 place-items-center rounded-full bg-fill text-label disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </ListGroup>
      {pilihan.length === 0 && <p className="px-1 text-footnote text-label-2">Tidak ada barang yang bisa diretur.</p>}
      {pilihan.length > 1 && <p className="mt-1.5 px-1 text-caption text-label-2">Bisa pilih lebih dari satu barang.</p>}

      <FieldLabel className="mt-4">Uang dikembalikan lewat</FieldLabel>
      <div className="flex apple-segmented p-1 rounded-full gap-1" role="radiogroup">
        {(Object.keys(LABEL_KEMBALI_RETUR) as CaraKembaliRetur[]).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kembali === k} onClick={() => setKembali(k)}
            className={`flex-1 min-h-[36px] px-2 text-footnote font-semibold rounded-full transition ${kembali === k ? "apple-segmented-thumb text-label" : "text-label-2"}`}>
            {LABEL_KEMBALI_RETUR[k]}
          </button>
        ))}
      </div>
      <p className="mt-1.5 px-1 text-caption text-label-2 leading-snug">
        {kembali === "TUNAI_TOKO" ? "Mengurangi setoran tunai hari ini." : "Tidak mengurangi kas toko; dicatat sebagai uang keluar transfer hari ini."}
      </p>

      <div className="mt-4">
        <TextField label="Alasan" value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="mis. seri salah (20, bukan 25)" />
      </div>

      {it && (
        <ListGroup className="mt-4">
          <ListRow title="Baris di nota" value={`${dipilih.length} dicoret`} />
          <ListRow title="Stok kembali" value={`+${jumlahStok}`} valueTone="positive" />
          <ListRow title="Total nota" value={`${rupiah(sale.total)} → ${rupiah(Math.max(0, sale.total - nilai))}`} />
          <ListRow title="Uang ke pembeli" value={rupiah(nilai)} valueTone="negative" />
        </ListGroup>
      )}
    </Sheet>
  );
};

export default ReturNotaSheet;
