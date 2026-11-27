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
  // Unit yang punya stik bonus tidak bisa diretur sebagian (batalkan nota bila seluruh paket kembali)
  const pilihan = useMemo(() => (sale.items || []).map((it, i) => ({ it, i }))
    .filter(({ it }) => bisaDiretur(it) && !(sale.items || []).some((x) => x.bonusUntukProdukId === it.id)), [sale.items]);
  const [idx, setIdx] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [kembali, setKembali] = useState<CaraKembaliRetur>("TRANSFER_OWNER");
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  useEffect(() => {
    if (!open) return;
    setIdx(pilihan.length === 1 ? pilihan[0].i : null);
    setQty(1);
    setKembali("TRANSFER_OWNER");
    setAlasan("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const it = idx !== null ? sale.items[idx] : null;
  const nilai = it ? qty * (Number(it.harga) || 0) : 0;

  const simpan = async () => {
    if (idx === null || !it) return;
    setSibuk(true);
    try {
      await returBarangNota(sale, idx, qty, kembali, alasan);
      notify(`${it.nama} diretur · stok +${qty}`, "positive");
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
          {sibuk ? "Menyimpan…" : it ? `Retur & kembalikan ${rupiah(nilai)}` : "Pilih barang dulu"}
        </Button>
      }
    >
      <FieldLabel>Barang yang dikembalikan</FieldLabel>
      <ListGroup>
        {pilihan.map(({ it: x, i }) => (
          <ListRow
            key={x.id}
            title={x.nama}
            subtitle={`${x.qty} x ${rupiah(x.harga)}`}
            value={idx === i ? <Check className="h-5 w-5 text-tint" /> : <span className="block h-5 w-5 rounded-full ring-[1.5px] ring-inset ring-label-3/60" />}
            chevron={false}
            onClick={() => { setIdx(i); setQty(1); }}
          />
        ))}
      </ListGroup>
      {pilihan.length === 0 && <p className="px-1 text-footnote text-label-2">Tidak ada barang yang bisa diretur.</p>}

      {it && (Number(it.qty) || 0) > 1 && (
        <div className="mt-3 flex items-center justify-between rounded-tile apple-tile px-3.5 py-2">
          <span className="text-subhead font-medium text-label">Jumlah retur</span>
          <span className="flex items-center gap-3">
            <button type="button" aria-label="Kurangi" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="hit-44 grid h-8 w-8 place-items-center rounded-full bg-fill text-label disabled:opacity-40"><Minus className="h-4 w-4" /></button>
            <span className="w-6 text-center text-headline tabular-nums text-label">{qty}</span>
            <button type="button" aria-label="Tambah" disabled={qty >= it.qty} onClick={() => setQty((q) => Math.min(it.qty, q + 1))} className="hit-44 grid h-8 w-8 place-items-center rounded-full bg-fill text-label disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </span>
        </div>
      )}

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
          <ListRow title="Baris di nota" value="Dicoret" />
          <ListRow title="Stok kembali" value={`+${qty}`} valueTone="positive" />
          <ListRow title="Total nota" value={`${rupiah(sale.total)} → ${rupiah(Math.max(0, sale.total - nilai))}`} />
          <ListRow title="Uang ke pembeli" value={rupiah(nilai)} valueTone="negative" />
        </ListGroup>
      )}
    </Sheet>
  );
};

export default ReturNotaSheet;
