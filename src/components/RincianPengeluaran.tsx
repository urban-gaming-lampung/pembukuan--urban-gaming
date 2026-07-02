import React from "react";
import {
  Trash2,
  Plus,
  Circle,
  CheckCircle2,
  Zap,
  RotateCcw,
} from "lucide-react";
import { UploadTransferProof } from "./TableEditor";

interface Props {
  rows: any[];
  setRows: React.Dispatch<React.SetStateAction<any[]>>;
  currentDate?: string;
  currentDay?: string;
  isMobileTable?: boolean;
  userEmail?: string;
  isOwner?: boolean;
}

export default function RincianPengeluaran({
  rows,
  setRows,
  currentDate,
  currentDay,
  isMobileTable,
  userEmail,
  isOwner: isOwnerProp,
}: Props) {
  const minRows = 1;
  const blank = { ket: "", harga: "", bayar: "", buktiTransfer: "" };

  const isAutoRow = (r: any) => !!r._autoOngkirKey;

  const updateRow = (i: number, patch: any) => {
    if (isAutoRow(rows[i])) {
      if (patch && "buktiTransfer" in patch) {
        setRows((p) => p.map((r, idx) => (idx === i ? { ...r, buktiTransfer: patch.buktiTransfer } : r)));
      }
      return; // Cegah edit auto entry lainnya
    }
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const total = rows.reduce(
    (acc, r) => acc + (parseInt(String(r.harga).replace(/\D/g, "")) || 0),
    0,
  );

  // Group auto-ongkir by employee name (Single Source of Truth)
  const ongkirGroup = React.useMemo(() => {
    const groups: Record<string, number> = {};
    rows.forEach(r => {
      if (r._autoOngkirKey || (r.ket && r.ket.startsWith("Ongkir"))) {
        let name = r._namaPengantar || "";
        if (!name && r.ket) {
          const match = r.ket.match(/Ongkir \(([^)]+)\)/);
          if (match) name = match[1];
        }
        if (!name) name = "Admin";
        
        const price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
        groups[name] = (groups[name] || 0) + price;
      }
    });
    return groups;
  }, [rows]);

  const hasOngkir = Object.keys(ongkirGroup).length > 0;

  // Hapus hanya baris manual terakhir (bukan auto)
  const handleRemoveLastManual = () => {
    setRows((prev) => {
      const manualIndices = prev
        .map((r, i) => (isAutoRow(r) ? -1 : i))
        .filter((i) => i >= 0);
      if (manualIndices.length <= minRows) return prev;
      const lastManualIdx = manualIndices[manualIndices.length - 1];
      return prev.filter((_, i) => i !== lastManualIdx);
    });
  };

  const manualCount = rows.filter((r) => !isAutoRow(r)).length;
  const isOwner = isOwnerProp ?? (userEmail?.toLowerCase() === "owner@gmail.com");

  return (
    <div
      className={`filter drop-shadow-sm ${isMobileTable ? "bg-transparent" : "bg-white dark:bg-[#1C1C1E] rounded-[24px] overflow-hidden ring-1 ring-zinc-200 dark:ring-white/5"}`}
    >
      {/* HEADER */}
      {!isMobileTable && (
        <div className="flex items-center justify-between p-6 bg-zinc-50 dark:bg-[#1C1C1E] border-b border-zinc-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-rose-500 rounded-full" />
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Rincian Pengeluaran Hari Ini
            </h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">
              Total Pengeluaran
            </div>
            <div className="text-xl font-black text-rose-500">
              Rp {total.toLocaleString("id-ID")}
            </div>
          </div>
        </div>
      )}

      {isMobileTable ? (
        // MOBILE CARD VIEW — satu panel terpadu
        <div className="bg-zinc-50 dark:bg-[#1C1C1E] rounded-[24px] overflow-hidden ring-1 ring-black/8 dark:ring-white/10 shadow-sm border border-zinc-200 dark:border-white/5">
          {/* Header strip — menempel di atas, tidak terpisah */}
          <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-[#202021] border-b border-zinc-200 dark:border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-5 bg-rose-500 rounded-full" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Pengeluaran Hari Ini
              </h2>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                TOTAL
              </div>
              <div className="text-sm font-black text-rose-500">
                Rp {total.toLocaleString("id-ID")}
              </div>
            </div>
          </div>

          {/* Cards inside */}
          <div className="flex flex-col gap-3 p-4">
            {rows.map((r, i) => {
              const isAuto = isAutoRow(r);
              return (
                <div
                  key={r._autoOngkirKey || i}
                  className={`rounded-2xl overflow-hidden ring-1 flex flex-col pointer-events-auto shadow-sm ${isAuto ? "bg-purple-50 dark:bg-purple-500/5 ring-purple-200 dark:ring-purple-500/20" : "bg-white dark:bg-black/30 ring-black/5 dark:ring-white/8"}`}
                >
                  {/* Header Card */}
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-b ${isAuto ? "bg-purple-100/50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20" : "bg-zinc-50 dark:bg-white/5 border-zinc-100 dark:border-white/5"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full ${isAuto ? "text-purple-700 dark:text-purple-300 bg-purple-200 dark:bg-purple-500/20" : "text-zinc-800 dark:text-white bg-zinc-200 dark:bg-white/15"}`}
                      >
                        #{i + 1}
                      </span>
                      {isAuto && (
                        <span className="flex items-center gap-1 text-[9px] font-black tracking-widest uppercase text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20 px-2 py-0.5 rounded-full">
                          <Zap
                            size={9}
                            className="fill-purple-500 stroke-purple-500"
                          />{" "}
                          AUTO
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 font-mono">
                      {currentDate} ({currentDay})
                    </span>
                  </div>
                  {/* Body Card */}
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                        Keterangan {isAuto ? "(Otomatis)" : "(Wajib)"}
                      </label>
                      {isAuto ? (
                        <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl px-4 py-2.5 text-sm font-medium text-purple-700 dark:text-purple-300 select-none">
                          {r.ket}
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={r.ket}
                          onChange={(e) =>
                            updateRow(i, { ket: e.target.value })
                          }
                          placeholder="Keterangan pengeluaran..."
                          className="bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-sm text-zinc-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                        Nominal (Rp)
                      </label>
                      {isAuto ? (
                        <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-purple-700 dark:text-purple-300 select-none">
                          Rp {Number(r.harga || 0).toLocaleString("id-ID")}
                        </div>
                      ) : (
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-zinc-400">
                            Rp
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            min="0"
                            value={r.harga}
                            onChange={(e) =>
                              updateRow(i, { harga: e.target.value })
                            }
                            placeholder="0"
                            className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-zinc-900 dark:text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {isAuto ? (
                      <div className="pt-3 border-t border-purple-100 dark:border-purple-500/10">
                        <div
                          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border ${r.bayar === "Cash" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-500" : r.bayar === "Transfer" ? "bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-500" : "bg-zinc-50 border-zinc-200 text-zinc-500"}`}
                        >
                          <CheckCircle2
                            size={15}
                            className={
                              r.bayar === "Cash"
                                ? "fill-emerald-500 stroke-white dark:stroke-black"
                                : "fill-blue-500 stroke-white dark:stroke-black"
                            }
                          />
                          <span className="text-[11px] font-bold tracking-widest uppercase">
                            {r.bayar || "-"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-3 border-t border-zinc-100 dark:border-white/5 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(i, {
                                bayar: r.bayar === "Cash" ? "" : "Cash",
                                buktiTransfer: ""
                              })
                            }
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${r.bayar === "Cash" ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-500 shadow-sm" : "bg-zinc-50 dark:bg-black/30 border-zinc-200 dark:border-white/5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-black/50"}`}
                          >
                            {r.bayar === "Cash" ? (
                              <CheckCircle2
                                size={15}
                                className="fill-emerald-500 stroke-white dark:stroke-black"
                              />
                            ) : (
                              <Circle size={15} />
                            )}
                            <span className="text-[11px] font-bold tracking-widest uppercase">
                              Cash
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = r.bayar === "Transfer" ? "" : "Transfer";
                              updateRow(i, {
                                bayar: nextVal,
                                ...(nextVal === "" ? { buktiTransfer: "" } : {})
                              });
                            }}
                            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border transition-all ${r.bayar === "Transfer" ? "bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-500 shadow-sm" : "bg-zinc-50 dark:bg-black/30 border-zinc-200 dark:border-white/5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-black/50"}`}
                          >
                            {r.bayar === "Transfer" ? (
                              <CheckCircle2
                                size={15}
                                className="fill-blue-500 stroke-white dark:stroke-black"
                              />
                            ) : (
                              <Circle size={15} />
                            )}
                            <span className="text-[11px] font-bold tracking-widest uppercase">
                              Transfer
                            </span>
                          </button>
                        </div>
                        {r.bayar === "Transfer" && (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100/50 dark:border-blue-500/10">
                            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 pl-1">Bukti Transfer:</span>
                            <UploadTransferProof 
                              value={r.buktiTransfer}
                              onChange={(url) => updateRow(i, { buktiTransfer: url })}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rangkuman Ongkir Harian Pegawai */}
          {hasOngkir && (
            <div className="mx-4 mb-4 p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/15 border border-purple-100 dark:border-purple-900/30 flex flex-col gap-2.5 shadow-inner">
              <div className="text-[10px] font-black tracking-widest text-purple-600 dark:text-purple-400 uppercase">
                Rangkuman Ongkir Pegawai
              </div>
              <div className="divide-y divide-purple-100 dark:divide-purple-900/30">
                {Object.entries(ongkirGroup).map(([name, totalOngkir]) => (
                  <div key={name} className="flex justify-between items-center py-2 first:pt-0 last:pb-0">
                    <span className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase">
                      {name}
                    </span>
                    <span className="text-xs font-black text-purple-700 dark:text-purple-400 font-mono">
                      Rp {totalOngkir.toLocaleString("id-ID")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action bar — menempel di bawah, bagian dari panel */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-zinc-200 dark:border-white/5 bg-white dark:bg-[#202021]">
            <button
              onClick={handleRemoveLastManual}
              disabled={manualCount <= minRows}
              className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 dark:text-zinc-400 active:scale-95 disabled:opacity-30 transition-all border border-zinc-200 dark:border-zinc-600 shrink-0"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setRows((p) => [...p, { ...blank }])}
              className="h-10 flex-1 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-[13px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-sm"
            >
              <Plus size={17} strokeWidth={2.5} /> Tambah Baris
            </button>
          </div>
        </div>
      ) : (
        // DESKTOP TABLE VIEW
        <>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead className="bg-[#fb1f56]">
                <tr>
                  <th className="py-3 px-4 text-[11px] font-black text-white/90 tracking-widest w-[60px] text-center border-b border-black/10">
                    NO
                  </th>
                  <th className="py-3 px-4 text-[11px] font-black text-white/90 tracking-widest w-[160px] border-b border-black/10">
                    TANGGAL & HARI
                  </th>
                  <th className="py-3 px-4 text-[11px] font-black text-white/90 tracking-widest border-b border-black/10">
                    KETERANGAN (WAJIB)
                  </th>
                  <th className="py-3 px-4 text-[11px] font-black text-white/90 tracking-widest w-[90px] text-center border-b border-black/10">
                    CASH
                  </th>
                  <th className="py-3 px-4 text-[11px] font-black text-white/90 tracking-widest w-[100px] text-center border-b border-black/10">
                    TRANSFER
                  </th>
                  <th className="py-3 px-4 text-[11px] font-black text-white/90 tracking-widest w-[170px] border-b border-black/10">
                    NOMINAL (RP)
                  </th>
                  {isOwner && (
                    <th className="py-3 px-4 text-[11px] font-black text-white/90 tracking-widest w-[100px] text-center border-b border-black/10">
                      AKSI
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/5 bg-white dark:bg-[#18181A]">
                {rows.map((r, i) => {
                  const isAuto = isAutoRow(r);
                  return (
                    <tr
                      key={r._autoOngkirKey || i}
                      className={`transition-colors group ${isAuto ? "bg-purple-50/50 dark:bg-purple-500/[0.03] hover:bg-purple-50 dark:hover:bg-purple-500/[0.06]" : "hover:bg-zinc-50 dark:hover:bg-white/[0.02]"}`}
                    >
                      <td className="py-3 px-4 text-center">
                        <div
                          className={`w-7 h-7 rounded-full mx-auto flex items-center justify-center text-[11px] font-bold transition-all ${isAuto ? "bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400" : "bg-zinc-100 dark:bg-white/5 text-zinc-500 group-hover:bg-zinc-200 dark:group-hover:bg-white/10 group-hover:text-zinc-900 dark:group-hover:text-white"}`}
                        >
                          {i + 1}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="bg-zinc-50 dark:bg-black/30 rounded-lg px-3 py-2 text-[13px] font-mono text-zinc-600 dark:text-zinc-400 select-none flex items-center border border-zinc-200 dark:border-white/5 flex-1">
                            {currentDate} ({currentDay})
                          </div>
                          {isAuto && (
                            <span className="flex items-center gap-1 text-[8px] font-black tracking-widest uppercase text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-500/20 px-1.5 py-0.5 rounded shrink-0">
                              <Zap
                                size={8}
                                className="fill-purple-500 stroke-purple-500"
                              />
                              AUTO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {isAuto ? (
                          <div className="text-[13px] font-medium text-purple-700 dark:text-purple-300 px-3 py-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-200 dark:border-purple-500/20 select-none">
                            {r.ket}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={r.ket}
                            onChange={(e) =>
                              updateRow(i, { ket: e.target.value })
                            }
                            placeholder="Keterangan pengeluaran..."
                            className="w-full bg-transparent outline-none text-[13px] font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-zinc-50 dark:focus:bg-white/5 rounded-lg px-3 py-2 transition-all border border-transparent focus:border-zinc-200 dark:focus:border-white/10"
                          />
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isAuto ? (
                          r.bayar === "Cash" ? (
                            <CheckCircle2
                              size={20}
                              className="fill-emerald-500 stroke-white dark:stroke-black drop-shadow-sm mx-auto"
                            />
                          ) : (
                            <Circle
                              size={20}
                              strokeWidth={2}
                              className="text-zinc-300 dark:text-zinc-600 mx-auto"
                            />
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(i, {
                                bayar: r.bayar === "Cash" ? "" : "Cash",
                                buktiTransfer: ""
                              })
                            }
                            className="active:scale-90 transition-transform flex items-center justify-center p-1 w-full text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                          >
                            {r.bayar === "Cash" ? (
                              <CheckCircle2
                                size={20}
                                className="fill-emerald-500 stroke-white dark:stroke-black drop-shadow-sm"
                              />
                            ) : (
                              <Circle size={20} strokeWidth={2} />
                            )}
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isAuto ? (
                            r.bayar === "Transfer" ? (
                              <CheckCircle2
                                size={20}
                                className="fill-blue-500 stroke-white dark:stroke-black drop-shadow-sm"
                              />
                            ) : (
                              <Circle
                                size={20}
                                strokeWidth={2}
                                className="text-zinc-300 dark:text-zinc-600"
                              />
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = r.bayar === "Transfer" ? "" : "Transfer";
                                updateRow(i, {
                                  bayar: nextVal,
                                  ...(nextVal === "" ? { buktiTransfer: "" } : {})
                                });
                              }}
                              className="active:scale-90 transition-transform flex items-center justify-center p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                            >
                              {r.bayar === "Transfer" ? (
                                <CheckCircle2
                                  size={20}
                                  className="fill-blue-500 stroke-white dark:stroke-black drop-shadow-sm"
                                />
                              ) : (
                                <Circle size={20} strokeWidth={2} />
                              )}
                            </button>
                          )}
                          {r.bayar === "Transfer" && (
                            <UploadTransferProof 
                              value={r.buktiTransfer}
                              onChange={(url) => updateRow(i, { buktiTransfer: url })}
                              disabled={false}
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 relative group/input">
                        {isAuto ? (
                          <div className="text-[13px] font-mono font-bold text-purple-700 dark:text-purple-300 px-3 py-2 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-200 dark:border-purple-500/20 select-none">
                            Rp {Number(r.harga || 0).toLocaleString("id-ID")}
                          </div>
                        ) : (
                          <>
                            <span className="absolute left-7 top-1/2 -translate-y-1/2 text-[13px] font-bold text-zinc-400 dark:text-zinc-600 pointer-events-none">
                              Rp
                            </span>
                            <input
                              type="number"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              min="0"
                              value={r.harga}
                              onChange={(e) =>
                                updateRow(i, { harga: e.target.value })
                              }
                              placeholder="0"
                              className="w-full bg-zinc-50 dark:bg-black/30 outline-none text-[13px] font-mono font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-700 rounded-lg pl-9 pr-3 py-2 focus:ring-1 focus:ring-rose-500 transition-all shadow-inner border border-zinc-200 dark:border-white/5"
                            />
                          </>
                        )}
                      </td>
                      {isOwner && (
                        <td className="py-3 px-4">
                          {!isAuto && (
                            <div className="flex items-center justify-center gap-1.5 bg-zinc-50 dark:bg-black/30 rounded-lg p-1 border border-zinc-200 dark:border-white/5 w-fit mx-auto shadow-inner">
                              <button
                                type="button"
                                onClick={() => updateRow(i, { ket: "", harga: "", bayar: "" })}
                                className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all active:scale-95"
                                title="Reset Baris"
                              >
                                <RotateCcw size={14} strokeWidth={2.5} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                                className="p-1.5 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-rose-500 dark:hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-95"
                                title="Hapus Baris"
                              >
                                <Trash2 size={14} strokeWidth={2.5} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {hasOngkir && (
                <tfoot className="border-t-2 border-purple-200 dark:border-purple-900/50 bg-purple-50/10 dark:bg-purple-950/5">
                  {Object.entries(ongkirGroup).map(([name, totalOngkir]) => (
                    <tr key={name} className="font-semibold text-xs text-purple-700 dark:text-purple-400">
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-[10px] font-bold">
                          ∑
                        </span>
                      </td>
                      <td colSpan={2} className="py-3 px-4">
                        Total Ongkir <span className="font-black uppercase text-purple-800 dark:text-purple-300">({name})</span>
                      </td>
                      <td colSpan={2} className="py-3 px-4 text-right">
                        {/* Empty spacing for cash/transfer columns */}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-sm text-purple-600 dark:text-purple-400">
                        Rp {totalOngkir.toLocaleString("id-ID")}
                      </td>
                      {isOwner && <td className="py-3 px-4"></td>}
                    </tr>
                  ))}
                </tfoot>
              )}
            </table>
          </div>

          {/* DESKTOP Actions — OUTSIDE overflow-x-auto so they stay fixed */}
          <div className="flex items-center justify-end gap-3 p-5 bg-zinc-50 dark:bg-[#1C1C1E] border-t border-zinc-200 dark:border-white/10">
            <button
              onClick={handleRemoveLastManual}
              disabled={manualCount <= minRows}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-200 dark:bg-black/20 text-zinc-600 dark:text-zinc-400 text-xs font-bold hover:bg-zinc-300 dark:hover:bg-black/40 hover:text-zinc-900 dark:hover:text-white active:scale-95 disabled:opacity-50 transition-all border border-zinc-300 dark:border-white/5"
            >
              <Trash2 size={14} /> Hapus
            </button>
            <button
              onClick={() => setRows((p) => [...p, { ...blank }])}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-[13px] font-black hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-95 transition-all shadow-md dark:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
            >
              <Plus size={16} strokeWidth={2.5} /> Tambah Baris
            </button>
          </div>
        </>
      )}
    </div>
  );
}
