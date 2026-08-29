import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import TableEditor from "./TableEditor";
import { RowSewa } from "../lib/types";
import { toInt } from "../lib/format";
import { ChevronDown } from "lucide-react";

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

function normText(s: unknown) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeJenisFromLabel(label: string): string | null {
  const s = normText(label);
  if (s.includes("hanya tv") || s === "tv" || (s.includes("tv") && !s.includes("ps")))
    return "Hanya TV";

  const psMatch = s.match(/ps\s*(\d+)/);
  const psVer = psMatch ? `PS${psMatch[1]}` : null;

  if (!psVer && !s.includes("hanya tv")) return null;

  const isPortable = s.includes("portable");
  const hasTv = s.includes("+ tv") || s.includes("tv") || s.includes("plus tv");

  if (psVer) {
    if (isPortable) return `${psVer} Portable`;
    if (hasTv) return `${psVer} + TV`;
    return psVer;
  }
  return null;
}

function normalizeLamaFromLabel(label: string): string | null {
  const s = normText(label);
  const jamMatch = s.match(/(\d+)\s*jam/);
  if (jamMatch) {
    const n = parseInt(jamMatch[1], 10);
    if (Number.isFinite(n) && n > 0) return `${n} JAM`.toUpperCase();
  }
  const hariMatch = s.match(/(\d+)\s*hari/);
  if (hariMatch) {
    const n = parseInt(hariMatch[1], 10);
    if (Number.isFinite(n) && n > 0) return `${n} HARI`.toUpperCase();
  }
  if (s.includes("semalam")) return "1 HARI";
  if (s.includes("sehari")) return "1 HARI";
  return null;
}

function normalizeHargaItems(items?: PriceItem[]) {
  const src = Array.isArray(items) ? items : [];
  return src
    .map((x) => ({ label: String(x?.label ?? "").trim(), price: Math.max(0, Number(x?.price) || 0) }))
    .filter((x) => x.label.length > 0);
}

function buildSewaTableFromHarga(items?: PriceItem[]) {
  const cleaned = normalizeHargaItems(items);
  const table: Record<string, Record<string, number>> = {};
  const jenisSet = new Set<string>();
  const lamaSet = new Set<string>();

  for (const it of cleaned) {
    const jenis = normalizeJenisFromLabel(it.label);
    const lama = normalizeLamaFromLabel(it.label);
    if (!jenis || !lama) continue;

    if (!table[lama]) table[lama] = {};
    table[lama][jenis] = it.price;
    jenisSet.add(jenis);
    lamaSet.add(lama);
  }

  const jenisOptions = Array.from(jenisSet).sort();
  const lamaOptions = Array.from(lamaSet).sort();

  return { table, jenisOptions, lamaOptions };
}

function getHargaAuto(row: any, table: Record<string, Record<string, number>>) {
  const jenisKey = pickKey(row, ["jenis ps", "jenisps", "jenis", "ps"]);
  const lamaKey = pickKey(row, ["lama sewa", "lamasewa", "lama", "durasi", "waktu"]);
  const jenis = String(jenisKey ? row[jenisKey] : "");
  const lama = String(lamaKey ? row[lamaKey] : "");
  if (!jenis || !lama) return 0;

  const fromSetting = table?.[lama]?.[jenis];
  if (typeof fromSetting === "number" && fromSetting > 0) return fromSetting;

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
    () => buildSewaTableFromHarga(hargaItems),
    [hargaItems]
  );

  // Fetch ALL registered users from Firebase (merge users, pegawai_logs, gaji_pegawai)
  const [allUsers, setAllUsers] = useState<{ id: string }[]>([]);
  useEffect(() => {
    const emailSet = new Set<string>();
    const rebuild = () => {
      const arr = Array.from(emailSet)
        .filter(e => e.toLowerCase() !== "owner@gmail.com")
        .sort()
        .map(e => ({ id: e }));
      setAllUsers(arr);
    };

    const unsub1 = onSnapshot(collection(db, "users"), (snap) => {
      snap.docs.forEach(d => {
        const data = d.data();
        const cleanId = d.id.toLowerCase().trim();
        if (data && data.role === "super admin") {
          emailSet.delete(cleanId);
        } else {
          emailSet.add(cleanId);
        }
      });
      rebuild();
    });
    const unsub2 = onSnapshot(collection(db, "pegawai_logs"), (snap) => {
      snap.docs.forEach(d => emailSet.add(d.id.toLowerCase().trim()));
      rebuild();
    });
    const unsub3 = onSnapshot(collection(db, "gaji_pegawai"), (snap) => {
      snap.docs.forEach(d => emailSet.add(d.id.toLowerCase().trim()));
      rebuild();
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  return (
    <TableEditor<RowSewa>
      title="4. Rincian Pemasukan SEWA PS"
      columns={["No.", "Jenis PS", "Lama Sewa", "Jam Sewa", "Nama Penyewa", "Apakah sudah dibayar?", "Harga (Rp)", "Apakah di antar?", "Siapa Yang antar?", "Cash", "Transfer"]}
      rows={rows}
      setRows={setRows}
      blank={blank}
      minRows={5}
      onClear={() => { }}
      getHarga={(r) => toInt(String((r as any).harga))}
      renderCell={({ keyName, value, row, rowIndex, inputBase, onKeyNav, updateRow }) => {
        const jenisKey = pickKey(row, ["jenis ps", "jenisps", "jenis", "ps"]);
        const lamaKey = pickKey(row, ["lama sewa", "lamasewa", "lama", "durasi", "waktu"]);

        if (jenisKey && keyName === jenisKey) {
          return (
            <SelectWrapper>
              <select
                data-fieldid={`sewa-${rowIndex}-jenis`}
                className={`${inputBase} appearance-none pr-8 cursor-pointer`}
                value={String(value || "")}
                onKeyDown={onKeyNav}
                onChange={(e) => {
                  const nextJenis = e.target.value;
                  const patch: any = { [jenisKey]: nextJenis };
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
                <option value="">Pilih PS...</option>
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
          return (
            <div className="flex flex-wrap items-center gap-2 min-w-[120px]">
              <div className="flex items-center gap-1 bg-zinc-100/50 dark:bg-zinc-800/50 p-1 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => {
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
                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                    : "hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 font-medium"
                    }`}
                >
                  <span className="text-[10px] font-bold tracking-tight">YA</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
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
                  className={`flex items-center justify-center px-3 py-1.5 rounded-md transition-all duration-200 ${(row as any).isOngkir === "TIDAK"
                    ? "bg-red-500 text-white shadow-sm shadow-red-500/20"
                    : "hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 font-medium"
                    }`}
                >
                  <span className="text-[10px] font-bold tracking-tight">TIDAK</span>
                </button>
              </div>
              {value === "YA" && (row as any).isPaid !== "TIDAK" && (
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
                        updateRow(rowIndex, { _bayarOngkir: current === "Cash" ? "" : "Cash", _addedBy: (row as any)._addedBy || userEmail } as any);
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
                        updateRow(rowIndex, { _bayarOngkir: current === "Transfer" ? "" : "Transfer", _addedBy: (row as any)._addedBy || userEmail } as any);
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

        // ✅ Harga menyesuaikan Readonly Kecuali Isi Sendiri
        if (keyName === "diantarOleh") {
          const isOngkirTidak = (row as any).isOngkir === "TIDAK";
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
