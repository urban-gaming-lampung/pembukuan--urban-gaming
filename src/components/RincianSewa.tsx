import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import TableEditor from "./TableEditor";
import { RowSewa } from "../lib/types";
import { toInt } from "../lib/format";
import { ChevronDown } from "lucide-react";
import { buildSewaTable } from "../lib/priceLists";
import { isUrbanUserDocId } from "../lib/urbanUsers";

type PriceItem = { label: string; price: number };

function pickKey(row: any, candidates: string[]) {
  const keys = Object.keys(row || {});
  const lower = keys.map((k) => ({ k, l: k.toLowerCase() }));
  for (const c of candidates) {
    const hit = lower.find((x) => x.l === c || x.l.includes(c));
    if (hit) return hit.k;
  }
  return null;
}


function getHargaAuto(row: any, table: Record<string, Record<string, number>>) {
  const jenisKey = pickKey(row, ["jenis sewa", "jenissewa", "jenis ps", "jenisps", "jenis", "ps"]);
  const lamaKey = pickKey(row, ["lama sewa", "lamasewa", "lama", "durasi", "waktu"]);
  const jenis = String(jenisKey ? row[jenisKey] : "");
  const lama = String(lamaKey ? row[lamaKey] : "");
  if (!jenis) return 0;
  if (jenis === "Hanya Ongkir") {
    return toInt(row._ongkir || 0);
  }
  if (!lama) return 0;

  const fromSetting = table?.[lama]?.[jenis];
  if (typeof fromSetting === "number" && fromSetting > 0) return fromSetting;

  // Cek alias 24 JAM <-> 1 HARI
  if (lama === "24 JAM" && table?.["1 HARI"]?.[jenis]) return table["1 HARI"][jenis];
  if (lama === "1 HARI" && table?.["24 JAM"]?.[jenis]) return table["24 JAM"][jenis];

  // Tidak ada harga cadangan di sini: semua harga berasal dari Edit Rincian (lib/priceLists).
  return 0;
}

const SelectWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="relative w-full">
    {children}
    <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 pointer-events-none opacity-60" />
  </div>
);

const RincianSewa: React.FC<{
  rows: RowSewa[];
  setRows: React.Dispatch<React.SetStateAction<RowSewa[]>>;
  blank: RowSewa;
  hargaItems?: PriceItem[];
  userEmail?: string | null;
  isMobileTable?: boolean;
}> = ({ rows, setRows, blank, hargaItems, userEmail, isMobileTable }) => {
  const { table, jenisOptions, lamaOptions } = React.useMemo(
    () => buildSewaTable(hargaItems),
    [hargaItems]
  );

  // Fetch registered active users from Firebase
  const [allUsers, setAllUsers] = useState<{ id: string }[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const arr = snap.docs
        .filter(d => {
          const data = d.data();
          // Abaikan akun ProsperoEden (ID dokumen = UID, bukan email)
          if (!isUrbanUserDocId(d.id)) return false;
          const email = d.id.toLowerCase().trim();
          if (email === "owner@gmail.com" || email.includes("fauzanazim56")) return false;
          if (data && (data.role === "super admin" || data.status === "nonaktif")) return false;
          return true;
        })
        .map(d => ({ id: d.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
      setAllUsers(arr);
    });

    return () => unsub();
  }, []);

  return (
    <TableEditor<RowSewa>
      title="4. Rincian Pemasukan SEWA PS"
      columns={["No.", "Jenis Sewa", "Lama Sewa", "Jam Sewa", "Nama Penyewa", "Apakah sudah dibayar?", "Harga (Rp)", "Apakah di antar?", "Siapa Yang antar?", "Cash", "Transfer"]}
      rows={rows}
      setRows={setRows}
      blank={blank}
      minRows={5}
      onClear={() => { }}
      getHarga={(r) => toInt(String((r as any).harga))}
      renderCell={({ keyName, value, row, rowIndex, inputBase, onKeyNav, updateRow }) => {
        const jenisKey = pickKey(row, ["jenis sewa", "jenissewa", "jenis ps", "jenisps", "jenis", "ps"]);
        const lamaKey = pickKey(row, ["lama sewa", "lamasewa", "lama", "durasi", "waktu"]);
        const isHanyaOngkir = String(jenisKey ? (row as any)[jenisKey] : "") === "Hanya Ongkir";
        // Item tambahan (harga tetap, tanpa durasi) dari Edit Rincian, mis. "Tambah Sewa Stik PS4"
        const isAddon = !!table["-"]?.[String(jenisKey ? (row as any)[jenisKey] : "")];
        const isNoDuration = isHanyaOngkir || isAddon;

        if (jenisKey && keyName === jenisKey) {
          return (
            <SelectWrapper>
              <select
                data-fieldid={`sewa-${rowIndex}-jenis`}
                className={`${inputBase} appearance-none pr-8 cursor-pointer font-medium`}
                value={String(value || "")}
                onKeyDown={onKeyNav}
                onChange={(e) => {
                  const nextJenis = e.target.value;
                  const patch: any = { [jenisKey]: nextJenis };
                  const nextAddonPrice = table["-"]?.[nextJenis];
                  if (typeof nextAddonPrice === "number") {
                    patch.lamaSewa = "-";
                    patch.jamMasukSewa = "-";
                    patch.isOngkir = "TIDAK";
                    patch._ongkir = "";
                    patch._bayarOngkir = "";
                    if ((row as any).jenisPS === "Hanya Ongkir") { patch.ket = ""; patch.isPaid = ""; }
                    patch.harga = (row as any).isPaid === "TIDAK" ? 0 : nextAddonPrice;
                  } else if (nextJenis === "Hanya Ongkir") {
                    patch.lamaSewa = "-";
                    patch.jamMasukSewa = "-";
                    patch.ket = "Hanya Ongkir";
                    patch.isPaid = "YA";
                    patch.isOngkir = "YA";
                    patch.harga = toInt((row as any)._ongkir || 0);
                  } else if ((row as any).jenisPS === "Hanya Ongkir" || (row as any)[jenisKey] === "Hanya Ongkir") {
                    patch.lamaSewa = "";
                    patch.jamMasukSewa = "";
                    patch.ket = "";
                    patch.isPaid = "";
                    patch.isOngkir = "TIDAK";
                    patch._ongkir = "";
                    patch._bayarOngkir = "";
                    patch.harga = 0;
                  } else {
                    if (isAddon) {
                      // keluar dari item tambahan: kosongkan lama & jam supaya wajib diisi lagi
                      patch.lamaSewa = "";
                      patch.jamMasukSewa = "";
                    }
                    const nextRow = { ...(row as any), ...patch };
                    const base = getHargaAuto(nextRow, table);
                    const isCustom = nextRow.lamaSewa === "Isi Sendiri";
                    const ongkir = nextRow.isOngkir === "YA" ? toInt(nextRow._ongkir) : 0;

                    if (nextRow.isPaid === "TIDAK") {
                      patch.harga = 0;
                    } else {
                      if (isCustom) {
                        patch.harga = toInt(nextRow._customBase) + ongkir;
                      } else {
                        patch.harga = base > 0 ? base + ongkir : ongkir;
                      }
                    }
                  }

                  patch._addedBy = (row as any)._addedBy || userEmail;
                  updateRow(rowIndex, patch);
                }}
              >
                <option value="">Pilih Jenis Sewa...</option>
                {jenisOptions.length > 0 ? (
                  jenisOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                ) : (
                  <option disabled>List Kosong</option>
                )}
              </select>
            </SelectWrapper>
          );
        }

        if (lamaKey && keyName === lamaKey) {
          if (isNoDuration) {
            return (
              <div className="min-w-[100px]">
                <input
                  disabled
                  className={`${inputBase} bg-zinc-100 dark:bg-black/40 text-zinc-400 cursor-not-allowed border-dashed text-center font-bold`}
                  value="-"
                  readOnly
                />
              </div>
            );
          }

          if (row.lamaSewa === "Isi Sendiri") {
            return (
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <input
                  type="number" inputMode="numeric" pattern="[0-9]*"
                  min="0"
                  className={`${inputBase} w-16 text-center pl-1 pr-1 font-bold text-sky-600 dark:text-sky-400`}
                  value={(row as any)._customDurasi || ""}
                  placeholder="0"
                  onChange={(e) => updateRow(rowIndex, { _customDurasi: e.target.value, _addedBy: (row as any)._addedBy || userEmail } as any)}
                  onKeyDown={onKeyNav}
                />
                <span className="text-[13px] font-bold text-zinc-500 uppercase tracking-wide">Jam</span>
                <button
                  type="button"
                  onClick={() => updateRow(rowIndex, { [lamaKey]: "", _customDurasi: "", _customBase: "" } as any)}
                  className="ml-auto p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-zinc-400 hover:text-red-500 transition-colors"
                  title="Batal Isi Sendiri"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            );
          }

          return (
            <SelectWrapper>
              <select
                data-fieldid={`sewa-${rowIndex}-lamaSewa`}
                className={`${inputBase} appearance-none pr-8 cursor-pointer`}
                value={String(value || "")}
                onKeyDown={onKeyNav}
                onChange={(e) => {
                  const nextLama = e.target.value;
                  const patch: any = { [lamaKey]: nextLama };
                  const nextRow = { ...(row as any), ...patch };
                  const base = getHargaAuto(nextRow, table);
                  const isCustom = nextRow.lamaSewa === "Isi Sendiri";
                  const ongkir = nextRow.isOngkir === "YA" ? toInt(nextRow._ongkir) : 0;

                  if (nextRow.isPaid === "TIDAK") {
                    patch.harga = 0;
                  } else {
                    if (isCustom) {
                      patch.harga = toInt(nextRow._customBase) + ongkir;
                    } else {
                      patch.harga = base > 0 ? base + ongkir : ongkir;
                    }
                  }

                  patch._addedBy = (row as any)._addedBy || userEmail;
                  updateRow(rowIndex, patch);
                }}
              >
                <option value="">Pilih durasi...</option>
                {lamaOptions.length > 0 ? (
                  lamaOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))
                ) : (
                  <option disabled>List Kosong</option>
                )}
                <option value="Isi Sendiri">Isi Sendiri</option>
                {row.lamaSewa === "PELUNASAN" && (
                  <option value="PELUNASAN" className="bg-emerald-100 text-emerald-800 font-bold">
                    PELUNASAN
                  </option>
                )}
              </select>
            </SelectWrapper>
          );
        }

        if (keyName === "jamMasukSewa") {
          if (isNoDuration) {
            return (
              <div className="min-w-[110px]">
                <input
                  disabled
                  className={`${inputBase} w-full text-center bg-zinc-100 dark:bg-black/40 text-zinc-400 cursor-not-allowed border-dashed font-bold`}
                  value="-"
                  readOnly
                />
              </div>
            );
          }
          const isPelunasan = row.lamaSewa === "PELUNASAN";
          return (
            <div className="min-w-[110px]">
              <input
                type={isPelunasan ? "text" : "time"}
                className={`${inputBase} w-full text-center tracking-wider ${isPelunasan ? "bg-zinc-100 dark:bg-black/40 text-zinc-400 cursor-not-allowed border-dashed" : "bg-transparent focus:bg-zinc-50 dark:focus:bg-[#2C2C2E]"}`}
                value={isPelunasan ? "-" : ((row as any).jamMasukSewa || "")}
                disabled={isPelunasan}
                onChange={(e) => {
                  if(!isPelunasan) updateRow(rowIndex, { jamMasukSewa: e.target.value, _addedBy: (row as any)._addedBy || userEmail } as any);
                }}
                onKeyDown={onKeyNav}
              />
            </div>
          );
        }

        if (keyName === "ket") {
          if (isHanyaOngkir) {
            return (
              <div className="min-w-[140px]">
                <input
                  disabled
                  className={`${inputBase} bg-zinc-100 dark:bg-black/40 text-zinc-400 cursor-not-allowed border-dashed text-center font-medium`}
                  value="Hanya Ongkir"
                  readOnly
                />
              </div>
            );
          }
          return (
            <div className="min-w-[140px]">
              <input
                data-fieldid={`table-sewa-${rowIndex}-ket`}
                className={inputBase}
                value={(row as any).ket || ""}
                onChange={(e) =>
                  updateRow(rowIndex, {
                    ket: e.target.value,
                    _addedBy: (row as any)._addedBy || userEmail
                  } as any)
                }
                onKeyDown={onKeyNav}
                placeholder="Nama Penyewa (Wajib)"
              />
            </div>
          );
        }

        if (keyName === "isPaid") {
          if (isHanyaOngkir) {
            return (
              <div className="min-w-[80px]">
                <input
                  disabled
                  className={`${inputBase} bg-zinc-100 dark:bg-black/40 text-emerald-500 font-bold cursor-not-allowed border-dashed text-center`}
                  value="YA"
                  readOnly
                />
              </div>
            );
          }
          return (
            <SelectWrapper>
              <select
                data-fieldid={`sewa-${rowIndex}-isPaid`}
                className={`${inputBase} appearance-none pr-8 cursor-pointer ${(row as any).isPaid === "TIDAK" ? "text-red-500 font-bold" : (row as any).isPaid === "YA" ? "text-emerald-500 font-bold" : ""
                  }`}
                value={String(value || "")}
                onKeyDown={onKeyNav}
                onChange={(e) => {
                  const nextVal = e.target.value;
                  const patch: any = { isPaid: nextVal };
                  const nextRow = { ...(row as any), ...patch };

                  const base = getHargaAuto(nextRow, table);
                  const isCustom = nextRow.lamaSewa === "Isi Sendiri";
                  let totalBase = isCustom ? toInt(nextRow._customBase) : base;

                  if (nextVal === "TIDAK") {
                    patch.harga = 0;
                    patch.bayar = "";
                  } else {
                    const ongkir = nextRow.isOngkir === "YA" ? toInt(nextRow._ongkir) : 0;
                    patch.harga = (totalBase > 0 ? totalBase : 0) + ongkir;
                  }

                  patch._addedBy = (row as any)._addedBy || userEmail;
                  updateRow(rowIndex, patch);
                }}
              >
                <option value="">Pilih...</option>
                <option value="YA">YA</option>
                <option value="TIDAK">TIDAK</option>
              </select>
            </SelectWrapper>
          );
        }

        if (keyName === "isOngkir") {
          if (isAddon) {
            return (
              <div className="min-w-[120px]">
                <input
                  disabled
                  className={`${inputBase} bg-zinc-100 dark:bg-black/40 text-zinc-400 cursor-not-allowed border-dashed text-center font-bold`}
                  value="-"
                  readOnly
                />
              </div>
            );
          }
          return (
            <div className="flex flex-wrap items-center gap-2 min-w-[120px]">
              <div className="flex items-center gap-1 bg-zinc-100/50 dark:bg-zinc-800/50 p-1 rounded-lg shrink-0">
                <button
                  type="button"
                  disabled={isHanyaOngkir}
                  onClick={() => {
                    if (isHanyaOngkir) return;
                    const patch: any = { isOngkir: "YA" };
                    const autoPrice = getHargaAuto(row, table);
                    const isCustom = row.lamaSewa === "Isi Sendiri";
                    const currentHarga = toInt((row as any).harga);
                    const currentOngkir = (row as any).isOngkir === "YA" ? toInt((row as any)._ongkir) : 0;

                    const base = isCustom ? toInt((row as any)._customBase) : (autoPrice > 0 ? autoPrice : Math.max(0, currentHarga - currentOngkir));

                    if (row.isPaid === "TIDAK") {
                      patch.harga = 0;
                    } else {
                      patch.harga = base + toInt((row as any)._ongkir);
                    }
                    patch._addedBy = (row as any)._addedBy || userEmail;
                    updateRow(rowIndex, patch);
                  }}
                  className={`flex items-center justify-center px-4 py-1.5 rounded-md transition-all duration-200 ${(row as any).isOngkir === "YA"
                    ? isHanyaOngkir
                      ? "bg-emerald-500/70 text-white cursor-not-allowed shadow-none"
                      : "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                    : "hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 font-medium"
                    }`}
                >
                  <span className="text-[10px] font-bold tracking-tight">YA</span>
                </button>
                <button
                  type="button"
                  disabled={isHanyaOngkir}
                  onClick={() => {
                    if (isHanyaOngkir) return;
                    const patch: any = { isOngkir: "TIDAK", _ongkir: "", _bayarOngkir: "" };
                    const autoPrice = getHargaAuto(row, table);
                    const isCustom = row.lamaSewa === "Isi Sendiri";
                    const currentHarga = toInt((row as any).harga);
                    const currentOngkir = (row as any).isOngkir === "YA" ? toInt((row as any)._ongkir) : 0;

                    const base = isCustom ? toInt((row as any)._customBase) : (autoPrice > 0 ? autoPrice : Math.max(0, currentHarga - currentOngkir));

                    if (row.isPaid === "TIDAK") {
                      patch.harga = 0;
                    } else {
                      patch.harga = base;
                    }
                    patch._addedBy = (row as any)._addedBy || userEmail;
                    updateRow(rowIndex, patch);
                  }}
                  className={`flex items-center justify-center px-3 py-1.5 rounded-md transition-all duration-200 ${
                    isHanyaOngkir
                      ? "opacity-30 cursor-not-allowed text-zinc-400"
                      : (row as any).isOngkir === "TIDAK"
                        ? "bg-red-500 text-white shadow-sm shadow-red-500/20"
                        : "hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 font-medium"
                    }`}
                >
                  <span className="text-[10px] font-bold tracking-tight">TIDAK</span>
                </button>
              </div>
              {((value === "YA" || isHanyaOngkir) && (row as any).isPaid !== "TIDAK") && (
                <div className="flex items-center gap-1.5 ml-1 animate-in slide-in-from-left-2 fade-in duration-200">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 font-bold">
                      Rp
                    </span>
                    <input
                      data-fieldid={`sewa-${rowIndex}-ongkir`}
                      inputMode="numeric"
                      className={`${inputBase} pl-6 font-mono font-medium text-xs w-[100px] transition-all`}
                      value={(row as any)._ongkir || ""}
                      onChange={(e) => {
                        const val = toInt(e.target.value);
                        const patch: any = { _ongkir: val };
                        if (isHanyaOngkir) {
                          patch.harga = val;
                        } else {
                          const autoPrice = getHargaAuto(row, table);
                          const isCustom = row.lamaSewa === "Isi Sendiri";
                          const currentHarga = toInt((row as any).harga);
                          const currentOngkir = (row as any).isOngkir === "YA" ? toInt((row as any)._ongkir) : 0;
                          const base = isCustom ? toInt((row as any)._customBase) : (autoPrice > 0 ? autoPrice : Math.max(0, currentHarga - currentOngkir));
                          if (row.isPaid === "TIDAK") {
                            patch.harga = 0;
                          } else {
                            patch.harga = base + val;
                          }
                        }
                        patch._addedBy = (row as any)._addedBy || userEmail;
                        updateRow(rowIndex, patch);
                      }}
                      onKeyDown={onKeyNav}
                      placeholder="Ongkir"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-100/50 dark:bg-zinc-800/50 p-1 rounded-lg shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const current = (row as any)._bayarOngkir;
                        const next = current === "Cash" ? "" : "Cash";
                        const patch: any = { _bayarOngkir: next };
                        if (isHanyaOngkir) {
                          patch.bayar = next;
                        }
                        patch._addedBy = (row as any)._addedBy || userEmail;
                        updateRow(rowIndex, patch);
                      }}
                      className={`flex items-center justify-center p-1.5 rounded-md transition-all duration-200 ${(row as any)._bayarOngkir === "Cash"
                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                        : "hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400"
                        }`}
                      title="Cash"
                    >
                      <span className="text-[10px] font-bold tracking-tight">CASH</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const current = (row as any)._bayarOngkir;
                        const next = current === "Transfer" ? "" : "Transfer";
                        const patch: any = { _bayarOngkir: next };
                        if (isHanyaOngkir) {
                          patch.bayar = next;
                        }
                        patch._addedBy = (row as any)._addedBy || userEmail;
                        updateRow(rowIndex, patch);
                      }}
                      className={`flex items-center justify-center p-1.5 rounded-md transition-all duration-200 ${(row as any)._bayarOngkir === "Transfer"
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                        : "hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400"
                        }`}
                      title="Transfer"
                    >
                      <span className="text-[10px] font-bold tracking-tight">TF</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        }

        // ✅ Diantar Oleh
        if (keyName === "diantarOleh") {
          const isOngkirTidak = (row as any).isOngkir === "TIDAK" && !isHanyaOngkir;
          return (
            <SelectWrapper>
              <select
                data-fieldid={`table-sewa-${rowIndex}-diantarOleh`}
                className={`${inputBase} appearance-none pr-8 cursor-pointer ${isOngkirTidak ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed opacity-50" : ""
                  }`}
                value={(row as any).diantarOleh || ""}
                disabled={isOngkirTidak}
                onChange={(e) =>
                  updateRow(rowIndex, {
                    diantarOleh: e.target.value,
                    _addedBy: (row as any)._addedBy || userEmail
                  } as any)
                }
              >
                <option value="">-- Pilih --</option>
                {allUsers.map((u, i) => (
                  <option key={i} value={u.id}>{u.id.split("@")[0]}</option>
                ))}
              </select>
            </SelectWrapper>
          );
        }

        if (keyName === "harga") {
          const currentTotal = toInt(String((row as any).harga ?? ""));
          const isCustom = row.lamaSewa === "Isi Sendiri";

          if (isHanyaOngkir) {
            const fmtStr = (n: number | string) => new Intl.NumberFormat("id-ID").format(Number(n) || 0);
            return (
              <div className="relative px-2 py-1.5 min-w-[120px] bg-zinc-100/50 dark:bg-black/20 rounded-lg border border-dashed border-zinc-200/80 dark:border-zinc-800">
                <span className="font-bold text-zinc-400 dark:text-zinc-500">
                  {currentTotal > 0 ? `Rp ${fmtStr(currentTotal)}` : "-"}
                </span>
              </div>
            );
          }

          if (isCustom) {
            const fmt = (n: number | string) =>
              new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(n) || 0).replace("Rp", "Rp ");

            return (
              <div className="flex flex-col gap-1 min-w-[140px]">
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-medium">Rp</span>
                  <input
                    data-fieldid={`sewa-${rowIndex}-customBase`}
                    type="number" inputMode="numeric" pattern="[0-9]*"
                    className={`${inputBase} pl-8 font-mono font-bold text-sky-600 dark:text-sky-400`}
                    value={(row as any)._customBase || ""}
                    placeholder="Hrg Dasar"
                    onChange={(e) => {
                      const val = toInt(e.target.value);
                      const patch: any = { _customBase: val };
                      // Hitung total dengan ongkir
                      const ongkir = row.isOngkir === "YA" ? toInt((row as any)._ongkir) : 0;
                      if (row.isPaid === "TIDAK") {
                        patch.harga = 0;
                      } else {
                        patch.harga = val + ongkir;
                      }
                      patch._addedBy = (row as any)._addedBy || userEmail;
                      updateRow(rowIndex, patch);
                    }}
                    onKeyDown={onKeyNav}
                  />
                </div>
                {row.isOngkir === "YA" && (
                  <div className="text-[10px] text-zinc-500 font-bold ml-1 tracking-tight">Total: {fmt(currentTotal)}</div>
                )}
              </div>
            );
          }

          // Kunci Readonly Permanen
          const fmtStr = (n: number | string) => new Intl.NumberFormat("id-ID").format(Number(n) || 0);
          return (
            <div className="relative px-2 py-1.5 min-w-[120px]">
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                {currentTotal > 0 ? `Rp ${fmtStr(currentTotal)}` : "-"}
              </span>
            </div>
          );
        }

        return undefined;
      }}
      isMobileTable={isMobileTable}
    />
  );
};

export default RincianSewa;
