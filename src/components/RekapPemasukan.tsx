import React from "react";
import { Calendar, CircleDollarSign, Coffee, Gamepad2, Wrench } from "lucide-react";
import { totalPemasukanHarian } from "../lib/keuangan";
import { persen } from "../lib/format";
import { useTampilRincian } from "../lib/tampilRincian";
import { Amount, Card, Eyebrow, MARK, SplitBar, StatTile, StatusPill } from "../ui";

interface RekapPemasukanProps {
  totalHarian: number;
  totalJajanan: number;
  totalJasaAks: number;
  totalSewa: number;
  totalCash: number;
  totalTransfer: number;
  totalPengeluaran?: number;
  pendapatanBersih: number;
}

const RekapPemasukan: React.FC<RekapPemasukanProps> = ({
  totalHarian,
  totalJajanan,
  totalJasaAks,
  totalSewa,
  totalCash,
  totalTransfer,
  totalPengeluaran = 0,
  pendapatanBersih,
}) => {
  const grand = totalPemasukanHarian({ totalHarian, totalJajanan, totalJasaAks, totalSewa });
  const tampil = useTampilRincian();
  const totalBayar = totalCash + totalTransfer;

  return (
    <Card
      variant="hero"
      accent="teal"
      title="Rekap pemasukan hari ini"
      subtitle="Ringkasan kategori & metode bayar"
      icon={<CircleDollarSign />}
      iconColor="teal"
      accessory={grand > 0 || totalPengeluaran > 0 ? <StatusPill net={pendapatanBersih} /> : undefined}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {tampil("harian", totalHarian) && <StatTile label="Harian" accent="teal" icon={<Calendar />} value={<Amount value={totalHarian} size="headline" fitAt={13} />} />}
          {tampil("jajanan", totalJajanan) && <StatTile label="Jajanan" accent="orange" icon={<Coffee />} value={<Amount value={totalJajanan} size="headline" fitAt={13} />} />}
          {tampil("jasaAks", totalJasaAks) && <StatTile label="Usaha" accent="red" icon={<Wrench />} value={<Amount value={totalJasaAks} size="headline" fitAt={13} />} />}
          {tampil("sewa", totalSewa) && <StatTile label="Sewa konsol" accent="blue" icon={<Gamepad2 />} value={<Amount value={totalSewa} size="headline" fitAt={13} />} />}
        </div>

        <div className="space-y-2.5 border-t border-sep pt-3.5">
          <Eyebrow>Rekap pembayaran</Eyebrow>
          {totalBayar > 0 && (
            <SplitBar
              ariaLabel="Proporsi Cash dan Transfer"
              segments={[
                { key: "cash", label: "Cash", value: totalCash, color: MARK.tunai, note: persen((totalCash / totalBayar) * 100) },
                { key: "tf", label: "Transfer", value: totalTransfer, color: MARK.transfer, note: persen((totalTransfer / totalBayar) * 100) },
              ]}
            />
          )}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <StatTile label="Cash" dot={MARK.tunai} value={<Amount value={totalCash} size="headline" fitAt={13} />} />
            <StatTile label="Transfer" dot={MARK.transfer} value={<Amount value={totalTransfer} size="headline" fitAt={13} />} />
          </div>
        </div>

        <div className="space-y-2.5 border-t border-sep pt-3.5">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <StatTile label="Total pendapatan" dot={MARK.masuk} value={<Amount value={grand} size="headline" fitAt={13} />} />
            <StatTile label="Total pengeluaran" dot={MARK.keluar} value={<Amount value={totalPengeluaran} size="headline" fitAt={13} />} />
          </div>

          <div className="rounded-tile apple-tile ring-1 ring-black/[0.03] dark:ring-white/[0.04] px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Eyebrow>Pendapatan bersih</Eyebrow>
              <p className="mt-0.5 text-caption text-label-2 truncate">
                {grand === 0 && totalPengeluaran === 0
                  ? "Belum ada transaksi hari ini."
                  : pendapatanBersih >= 0
                    ? "Total pendapatan dikurangi pengeluaran."
                    : "Pengeluaran lebih besar dari pendapatan."}
              </p>
            </div>
            <Amount value={pendapatanBersih} signed tone="auto" size="title2" fitAt={14} />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RekapPemasukan;