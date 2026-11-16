import React from "react";
import { Zap } from "lucide-react";
import TableEditor from "./TableEditor";
import { rupiah, toInt } from "../lib/format";
import { AKSEN_TILE, Pill } from "../ui";

interface Props {
  rows: any[];
  setRows: React.Dispatch<React.SetStateAction<any[]>>;
  currentDate?: string;
  currentDay?: string;
  isMobileTable?: boolean;
  userEmail?: string;
  isOwner?: boolean;
}

const BLANK_PENGELUARAN = { ket: "", harga: "", bayar: "", buktiTransfer: "" };

export default function RincianPengeluaran({
  rows,
  setRows,
  isMobileTable,
  userEmail,
  isOwner: isOwnerProp,
}: Props) {
  const isOwner = isOwnerProp ?? (userEmail?.toLowerCase() === "owner@gmail.com");
  const isAutoRow = (r: any) => !!r?._autoOngkirKey;

  // Group auto-ongkir by employee name (Single Source of Truth)
  const ongkirGroup = React.useMemo(() => {
    const groups: Record<string, number> = {};
    rows.forEach((r) => {
      if (r._autoOngkirKey || (r.ket && r.ket.startsWith("Ongkir"))) {
        let name = r._namaPengantar || "";
        if (!name && r.ket) {
          const match = r.ket.match(/Ongkir \(([^)]+)\)/);
          if (match) name = match[1];
        }
        if (!name) name = "Admin";

        const price = toInt(r.harga);
        groups[name] = (groups[name] || 0) + price;
      }
    });
    return groups;
  }, [rows]);

  const hasOngkir = Object.keys(ongkirGroup).length > 0;
  const filledCount = rows.filter(
    (r) => toInt(r.harga) > 0 || String(r.ket || "").trim() !== ""
  ).length;

  const subtitle = [
    filledCount > 0 ? `${filledCount} item terisi` : "Belum ada pengeluaran",
    hasOngkir ? "termasuk ongkir" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const ongkirTableFooter = hasOngkir ? (
    <tfoot className="border-t border-[#CB30E0]/20 bg-[#CB30E0]/[0.05]">
      {Object.entries(ongkirGroup).map(([name, totalOngkir]) => (
        <tr key={name} className={`font-semibold text-caption ${AKSEN_TILE.purple.iconText}`}>
          <td className="py-2.5 px-2 text-center">
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-caption2 font-bold ${AKSEN_TILE.purple.pill}`}>
              ∑
            </span>
          </td>
          <td className="py-2.5 px-3">
            Total Ongkir <span className="font-bold uppercase">({name})</span>
          </td>
          <td className={`py-2.5 px-3 font-mono tabular-nums font-bold text-subhead ${AKSEN_TILE.purple.iconText}`}>
            {rupiah(totalOngkir)}
          </td>
          <td colSpan={isOwner ? 3 : 2} className="py-2.5 px-2" />
        </tr>
      ))}
    </tfoot>
  ) : undefined;

  const ongkirCardSummary = hasOngkir && isMobileTable ? (
    <div className={`p-3.5 sm:p-4 rounded-tile flex flex-col gap-2 ${AKSEN_TILE.purple.bg}`}>
      <div className={`text-caption font-bold tracking-wider uppercase ${AKSEN_TILE.purple.iconText}`}>
        Rangkuman Ongkir Pegawai
      </div>
      <div className="divide-y divide-[#CB30E0]/15">
        {Object.entries(ongkirGroup).map(([name, totalOngkir]) => (
          <div key={name} className="flex justify-between items-center py-2 first:pt-0 last:pb-0">
            <span className={`text-caption font-semibold uppercase ${AKSEN_TILE.purple.iconText}`}>
              Total Ongkir ({name})
            </span>
            <span className={`font-mono tabular-nums font-bold text-subhead ${AKSEN_TILE.purple.iconText}`}>
              {rupiah(totalOngkir)}
            </span>
          </div>
        ))}
      </div>
    </div>
  ) : undefined;

  return (
    <TableEditor<any>
      title="Rincian Pengeluaran Hari Ini"
      subtitle={subtitle}
      totalLabel="Total Keluar"
      columns={["No.", "Keterangan (Wajib)", "Nominal (Rp)", "Cash", "Transfer"]}
      rows={rows}
      setRows={setRows}
      blank={{ ...BLANK_PENGELUARAN }}
      minRows={1}
      onClear={() => {}}
      getHarga={(r) => toInt(String(r?.harga ?? ""))}
      isMobileTable={isMobileTable}
      hideRowActions={!isOwner}
      isRowLocked={isAutoRow}
      allowProofOnLocked
      placeholders={{ ket: "Keterangan pengeluaran..." }}
      renderNo={(r) =>
        isAutoRow(r) ? (
          <Pill color="purple" icon={<Zap size={10} className="fill-current" />}>
            <span className="whitespace-nowrap">AUTO</span>
          </Pill>
        ) : null
      }
      renderCell={({ keyName, row }) => {
        if (!isAutoRow(row)) return undefined;
        if (keyName === "ket") {
          return (
            <div className={`min-h-[44px] flex items-center rounded-control px-3 py-2 text-subhead font-medium select-none ${AKSEN_TILE.purple.bg} ${AKSEN_TILE.purple.iconText}`}>
              {row.ket}
            </div>
          );
        }
        if (keyName === "harga") {
          return (
            <div className={`min-h-[44px] flex items-center rounded-control px-3 py-2 text-subhead font-mono tabular-nums font-bold select-none ${AKSEN_TILE.purple.bg} ${AKSEN_TILE.purple.iconText}`}>
              {rupiah(toInt(row.harga))}
            </div>
          );
        }
        return undefined;
      }}
      onResetRows={() =>
        setRows((prev) => [{ ...BLANK_PENGELUARAN }, ...prev.filter(isAutoRow)])
      }
      tableFooter={ongkirTableFooter}
      slotBawahTable={ongkirCardSummary}
    />
  );
}
