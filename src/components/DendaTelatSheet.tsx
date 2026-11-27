import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Button, ListGroup, ListRow, Sheet, TextField } from "../ui";
import { formatRibuanInput, rupiah, toInt } from "../lib/format";
import { labelLamaTelat } from "../lib/pengingatSewa";

type DataDenda = { nama: string; jenis: string; menit: number; jam: number; tarif: number | null; nominal: number };


/** Unit kembali lewat batas: catat denda (Cash / Transfer) ke Rincian Sewa, atau bebaskan. */
const DendaTelatSheet: React.FC<{
  data: DataDenda | null;
  onCatat: (nominal: number, metode: "Cash" | "Transfer") => void;
  onTutup: () => void;
}> = ({ data, onCatat, onTutup }) => {
  const [nominal, setNominal] = useState(0);
  useEffect(() => setNominal(data?.nominal || 0), [data]);
  if (!data) return null;
  const bisa = nominal > 0;
  return (
    <Sheet
      open
      onClose={onTutup}
      size="sm"
      variant="grouped"
      zClassName="z-[702]"
      icon={<Clock />}
      iconColor="orange"
      title="Denda telat kembali"
      subtitle={`${data.jenis} · ${data.nama || "Tanpa nama"}`}
      footer={
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="filled" disabled={!bisa} onClick={() => onCatat(nominal, "Cash")}>Cash</Button>
            <Button variant="filled" disabled={!bisa} onClick={() => onCatat(nominal, "Transfer")}>Transfer</Button>
          </div>
          <Button variant="gray" onClick={onTutup}>Bebaskan denda</Button>
        </div>
      }
    >
      <ListGroup>
        <ListRow title="Lewat batas kembali" value={labelLamaTelat(data.menit)} />
        <ListRow
          title="Dihitung"
          subtitle="Lewat 10 menit = 1 jam"
          value={data.tarif ? `${data.jam} jam × ${rupiah(data.tarif)}` : "Tarif belum ada"}
        />
      </ListGroup>
      <div className="mt-4">
        <TextField
          label="Nominal denda"
          inputMode="numeric"
          value={formatRibuanInput(nominal || "")}
          onChange={(e) => setNominal(toInt(e.target.value.replace(/\D/g, "")))}
          leftIcon={<span className="text-footnote font-semibold text-label-2">Rp</span>}
          inputClassName="text-title3 font-bold tabular-nums"
        />
        <p className="mt-2 px-1 text-footnote text-label-2 leading-snug">
          Masuk Rincian Sewa hari ini sebagai Jenis PS "Denda", ikut setoran & Analitik. Nominal bisa diubah.
        </p>
      </div>
    </Sheet>
  );
};

export default DendaTelatSheet;
