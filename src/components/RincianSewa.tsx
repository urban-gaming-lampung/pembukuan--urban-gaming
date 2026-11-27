import React, { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import TableEditor, { AutoFitInput, AutoFitSelect } from "./TableEditor";
import { RowSewa } from "../lib/types";
import { rupiah, toInt, formatRibuanInput } from "../lib/format";
import { Receipt } from "lucide-react";
import { buildSewaTable } from "../lib/priceLists";
import { dasarDariHarga, dpBookingBaris, hargaDasarSewa, hargaKolomSewa, JENIS_DENDA, LAMA_DP_BOOKING } from "../lib/sewa";
import { formatWa, rapikanWa, waValid } from "../lib/wa";
import { isUrbanUserDocId } from "../lib/urbanUsers";
import NotaSewaSheet from "./NotaSewaSheet";
import { barisSiapNota, BarisSewaNota } from "../lib/notaSewa";
import { kunciNama, wajibWaPenyewa } from "../lib/pengingatSewa";

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


const RincianSewa: React.FC<{
  rows: RowSewa[];
  setRows: React.Dispatch<React.SetStateAction<RowSewa[]>>;
  blank: RowSewa;
  hargaItems?: PriceItem[];
  userEmail?: string | null;
  isMobileTable?: boolean;
  /** Tanggal pembukuan (YYYY-MM-DD) — untuk jam kembali di nota sewa & aturan wajib WA */
  tanggal?: string;
  /** Nama penyewa (huruf kecil) -> No. WA terakhir, untuk saran isi cepat */
  waTerakhir?: Record<string, string>;
}> = ({ rows, setRows, blank, hargaItems, userEmail, isMobileTable, tanggal = "", waTerakhir = {} }) => {
  const sewaTable = React.useMemo(() => buildSewaTable(hargaItems), [hargaItems]);
  const { table, jenisOptions, lamaOptions } = sewaTable;

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

  // ===== Nota sewa per baris (ikon di kolom No.) =====
  const [notaIdx, setNotaIdx] = useState<number | null>(null);
  const notaRow = notaIdx !== null ? ((rows[notaIdx] as BarisSewaNota) || null) : null;
  // Harga dasar dari Edit Rincian (SSOT lib/priceLists) — semua harga baris dihitung lewat lib/sewa
  const hargaDasarOf = (r: any) => hargaDasarSewa(r, sewaTable);
  const patchNota = (patch: Partial<BarisSewaNota>) => {
    if (notaIdx === null) return;
    const target = rows[notaIdx] as any;
    setRows((prev) =>
      prev.map((r: any, i) => ((target?._rowId ? r._rowId === target._rowId : i === notaIdx) ? { ...r, ...patch } : r))
    );
  };
  const tombolNota = (row: RowSewa, i: number) => {
    if (!barisSiapNota(row as BarisSewaNota, hargaDasarOf(row))) return null;
    const ada = !!(row as any)._noNota;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setNotaIdx(i); }}
        aria-label={`Nota sewa baris ${i + 1}`}
        title={ada ? `Nota ${(row as any)._noNota}` : "Buat nota sewa"}
        className={
          isMobileTable === false
            ? "inline-flex items-center justify-center w-8 hit-44 h-8 rounded-full bg-tint/10 text-tint hover:bg-tint/15 dark:bg-tint/15 active:scale-90 transition"
            : "inline-flex items-center gap-1 hit-44 h-7 px-2.5 rounded-full bg-fill/90 hover:bg-fill text-tint ring-1 ring-edge text-caption2 font-semibold active:scale-95 transition"
        }
      >
        <Receipt size={13} strokeWidth={2.4} />
        {isMobileTable !== false && <span>Nota</span>}
      </button>
    );
  };

  return (
    <>
    <TableEditor<RowSewa>
      title="4. Rincian Pemasukan SEWA PS"
      columns={["No.", "Jenis Sewa", "Lama Sewa", "Jam Sewa", "Nama Penyewa", "No. WA Penyewa", "Sudah Bayar?", "Harga (Rp)", "Apakah di antar?", "Siapa Yang antar?", "Cash", "Transfer"]}
      rows={rows}
      setRows={setRows}
      blank={blank}
      minRows={5}
      onClear={() => { }}
      getHarga={(r) => toInt(String((r as any).harga))}
      renderCell={({ keyName, value, row, rowIndex, isMobile, onKeyNav, updateRow }) => {
        const jenisKey = pickKey(row, ["jenis sewa", "jenissewa", "jenis ps", "jenisps", "jenis", "ps"]);
        const lamaKey = pickKey(row, ["lama sewa", "lamasewa", "lama", "durasi", "waktu"]);
        const isHanyaOngkir = String(jenisKey ? (row as any)[jenisKey] : "") === "Hanya Ongkir";
        // Item tambahan (harga tetap, tanpa durasi) dari Edit Rincian, mis. "Tambah Sewa Stik PS4"
        const isAddon = !!table["-"]?.[String(jenisKey ? (row as any)[jenisKey] : "")];
        const isDenda = String(jenisKey ? (row as any)[jenisKey] : "") === JENIS_DENDA;
        const isNoDuration = isHanyaOngkir || isAddon || isDenda;

        if (jenisKey && keyName === jenisKey) {
          return (
            <AutoFitSelect
              isMobile={isMobile}
              data-fieldid={`sewa-${rowIndex}-jenis`}
              className="font-medium"
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
                } else if (nextJenis === JENIS_DENDA) {
                  // Denda telat: tanpa unit & durasi, nominal diisi di kolom harga
                  patch.lamaSewa = "-";
                  patch.jamMasukSewa = "-";
                  patch.isOngkir = "TIDAK";
                  patch._ongkir = "";
                  patch._bayarOngkir = "";
                  if ((row as any).jenisPS === "Hanya Ongkir") patch.ket = "";
                  patch.isPaid = (row as any).isPaid && (row as any).jenisPS !== "Hanya Ongkir" ? (row as any).isPaid : "YA";
                  patch.harga = hargaKolomSewa({ ...(row as any), ...patch }, sewaTable);
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
                  if (isAddon || isDenda) {
                    // keluar dari item tambahan / denda: kosongkan lama & jam supaya wajib diisi lagi
                    patch.lamaSewa = "";
                    patch.jamMasukSewa = "";
                    if (isDenda) patch._customBase = "";
                  }
                  patch.harga = hargaKolomSewa({ ...(row as any), ...patch }, sewaTable);
                }

                patch._addedBy = (row as any)._addedBy || userEmail;
                updateRow(rowIndex, patch);
              }}
            >
              <option value="" className="bg-surface text-label">Pilih jenis...</option>
              {jenisOptions.length > 0 ? (
                jenisOptions.map((m) => (
                  <option key={m} value={m} className="bg-surface text-label">
                    {m}
                  </option>
                ))
              ) : (
                <option disabled className="bg-surface text-label-3">List Kosong</option>
              )}
              <option value={JENIS_DENDA} className="bg-surface text-label">{JENIS_DENDA}</option>
            </AutoFitSelect>
          );
        }

        if (lamaKey && keyName === lamaKey) {
          if (isNoDuration) {
            return (
              <AutoFitInput
                isMobile={isMobile}
                disabled
                className="bg-fill text-label-3 cursor-not-allowed border-dashed text-center font-bold"
                value="-"
                readOnly
              />
            );
          }

          if (row.lamaSewa === "Isi Sendiri") {
            return (
              <div className="flex items-center gap-1.5">
                <AutoFitInput
                  isMobile={false}
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  minSample="00"
                  className="text-center pl-2 pr-2 font-bold text-tint"
                  containerClassName="!min-w-0 shrink-0"
                  value={(row as any)._customDurasi || ""}
                  placeholder="0"
                  onChange={(e) => updateRow(rowIndex, { _customDurasi: e.target.value, _addedBy: (row as any)._addedBy || userEmail } as any)}
                  onKeyDown={onKeyNav}
                />
                <span className="text-footnote font-bold text-label-2 uppercase tracking-wide shrink-0">Jam</span>
                <button
                  type="button"
                  onClick={() => updateRow(rowIndex, { [lamaKey]: "", _customDurasi: "", _customBase: "" } as any)}
                  className="ml-auto min-w-[32px] min-h-[32px] p-1.5 rounded-full hover:bg-fill text-label-3 hover:text-negative transition-colors flex items-center justify-center shrink-0"
                  title="Batal Isi Sendiri"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            );
          }

          return (
            <AutoFitSelect
              isMobile={isMobile}
              data-fieldid={`sewa-${rowIndex}-lamaSewa`}
              value={String(value || "")}
              onKeyDown={onKeyNav}
              onChange={(e) => {
                const nextLama = e.target.value;
                const patch: any = { [lamaKey]: nextLama };
                patch.harga = hargaKolomSewa({ ...(row as any), ...patch }, sewaTable);
                patch._addedBy = (row as any)._addedBy || userEmail;
                updateRow(rowIndex, patch);
              }}
            >
              <option value="" className="bg-surface text-label">Pilih durasi...</option>
              {lamaOptions.length > 0 ? (
                lamaOptions.map((m) => (
                  <option key={m} value={m} className="bg-surface text-label">
                    {m}
                  </option>
                ))
              ) : (
                <option disabled className="bg-surface text-label-3">List Kosong</option>
              )}
              <option value="Isi Sendiri" className="bg-surface text-label">Isi Sendiri</option>
              {row.lamaSewa === "PELUNASAN" && (
                <option value="PELUNASAN" className="bg-surface text-positive font-bold">
                  PELUNASAN
                </option>
              )}
              {row.lamaSewa === LAMA_DP_BOOKING && (
                <option value={LAMA_DP_BOOKING} className="bg-surface text-positive font-bold">
                  {LAMA_DP_BOOKING}
                </option>
              )}
            </AutoFitSelect>
          );
        }

        if (keyName === "jamMasukSewa") {
          if (isNoDuration) {
            return (
              <AutoFitInput
                isMobile={isMobile}
                disabled
                className="text-center bg-fill text-label-3 cursor-not-allowed border-dashed font-bold"
                value="-"
                readOnly
              />
            );
          }
          // Pelunasan & DP booking: uang saja, tanpa jam ambil
          const isPelunasan = row.lamaSewa === "PELUNASAN" || row.lamaSewa === LAMA_DP_BOOKING;
          return (
            <AutoFitInput
              isMobile={isMobile}
              type={isPelunasan ? "text" : "time"}
              className={`text-center tracking-wider ${isPelunasan ? "bg-fill text-label-3 cursor-not-allowed border-dashed font-bold" : "font-mono"}`}
              value={isPelunasan ? "-" : ((row as any).jamMasukSewa || "")}
              disabled={isPelunasan}
              onChange={(e) => {
                if (!isPelunasan) updateRow(rowIndex, { jamMasukSewa: e.target.value, _addedBy: (row as any)._addedBy || userEmail } as any);
              }}
              onKeyDown={onKeyNav}
            />
          );
        }

        if (keyName === "ket") {
          if (isHanyaOngkir) {
            return (
              <AutoFitInput
                isMobile={isMobile}
                disabled
                className="bg-fill text-label-3 cursor-not-allowed border-dashed text-center font-medium"
                value="Hanya Ongkir"
                readOnly
              />
            );
          }
          return (
            <AutoFitInput
              isMobile={isMobile}
              data-fieldid={`table-sewa-${rowIndex}-ket`}
              minSample="Nama"
              value={(row as any).ket || ""}
              onChange={(e) =>
                updateRow(rowIndex, {
                  ket: e.target.value,
                  _addedBy: (row as any)._addedBy || userEmail
                } as any)
              }
              onKeyDown={onKeyNav}
              placeholder="Nama penyewa"
            />
          );
        }

        if (keyName === "waPenyewa") {
          if (isHanyaOngkir) {
            return (
              <AutoFitInput
                isMobile={isMobile}
                disabled
                readOnly
                value="-"
                className="bg-fill text-label-3 cursor-not-allowed border-dashed text-center font-bold"
              />
            );
          }
          const v = String(value || "");
          const wajib = wajibWaPenyewa(row, tanggal);
          const aktif = !!(String((row as any).ket || "").trim() || (row as any).jenisPS);
          const salah = aktif && (v ? !waValid(v) : wajib);
          const saran = !v && (row as any).ket ? waTerakhir[kunciNama((row as any).ket)] : "";
          return (
            <div>
              <AutoFitInput
                isMobile={isMobile}
                data-fieldid={`table-sewa-${rowIndex}-wa`}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                className={`font-mono tracking-wide ${salah ? "!border-negative/50 bg-negative/10 focus:!ring-negative/30" : ""}`}
                value={v}
                onChange={(e) =>
                  updateRow(rowIndex, { waPenyewa: e.target.value.replace(/[^\d+\s-]/g, ""), _addedBy: (row as any)._addedBy || userEmail } as any)
                }
                onBlur={() => { if (v && rapikanWa(v) !== v) updateRow(rowIndex, { waPenyewa: rapikanWa(v) } as any); }}
                onKeyDown={onKeyNav}
                placeholder={wajib ? "08xx (wajib)" : "08xx"}
              />
              {saran && (
                <button
                  type="button"
                  onClick={() => updateRow(rowIndex, { waPenyewa: saran, _addedBy: (row as any)._addedBy || userEmail } as any)}
                  className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tint/10 text-tint text-caption2 font-semibold whitespace-nowrap active:scale-95 transition"
                >
                  Pakai {formatWa(saran)} · sewa terakhir
                </button>
              )}
              {v && !waValid(v) && <div className="mt-1 text-caption2 font-semibold text-negative whitespace-nowrap">Format 08xx, 10–13 angka</div>}
            </div>
          );
        }

        if (keyName === "isPaid") {
          if (isHanyaOngkir) {
            return (
              <AutoFitInput
                isMobile={isMobile}
                disabled
                className="bg-fill text-positive font-bold cursor-not-allowed border-dashed text-center"
                value="YA"
                readOnly
              />
            );
          }
          return (
            <AutoFitSelect
              isMobile={isMobile}
              data-fieldid={`sewa-${rowIndex}-isPaid`}
              className={(row as any).isPaid === "TIDAK" ? "text-negative font-bold" : (row as any).isPaid === "YA" ? "text-positive font-bold" : ""}
              value={String(value || "")}
              onKeyDown={onKeyNav}
              onChange={(e) => {
                const nextVal = e.target.value;
                const patch: any = { isPaid: nextVal };
                if (nextVal === "TIDAK") patch.bayar = "";
                patch.harga = hargaKolomSewa({ ...(row as any), ...patch }, sewaTable);

                patch._addedBy = (row as any)._addedBy || userEmail;
                updateRow(rowIndex, patch);
              }}
            >
              <option value="" className="bg-surface text-label">Pilih...</option>
              <option value="YA" className="bg-surface text-label">YA</option>
              <option value="TIDAK" className="bg-surface text-label">TIDAK</option>
            </AutoFitSelect>
          );
        }

        if (keyName === "isOngkir") {
          if (isAddon || isDenda) {
            return (
              <AutoFitInput
                isMobile={isMobile}
                disabled
                className="bg-fill text-label-3 cursor-not-allowed border-dashed text-center font-bold"
                value="-"
                readOnly
              />
            );
          }
          return (
            <div className={isMobile ? "flex flex-wrap items-center gap-2" : "inline-flex items-center gap-2 whitespace-nowrap"}>
              <div className="flex items-center gap-1 apple-segmented p-1 rounded-full shrink-0">
                <button
                  type="button"
                  disabled={isHanyaOngkir}
                  onClick={() => {
                    if (isHanyaOngkir) return;
                    const patch: any = { isOngkir: "YA" };
                    patch.harga = hargaKolomSewa({ ...(row as any), ...patch }, sewaTable, dasarDariHarga(row));
                    patch._addedBy = (row as any)._addedBy || userEmail;
                    updateRow(rowIndex, patch);
                  }}
                  className={`flex items-center justify-center min-h-[32px] px-3 py-1 rounded-full transition duration-200 ${(row as any).isOngkir === "YA"
                    ? isHanyaOngkir
                      ? "bg-positive/75 text-white cursor-not-allowed shadow-none"
                      : "bg-positive text-white shadow-sm"
                    : "hover:bg-surface/60 text-label-2 font-medium"
                    }`}
                >
                  <span className="text-caption2 font-bold tracking-tight">YA</span>
                </button>
                <button
                  type="button"
                  disabled={isHanyaOngkir}
                  onClick={() => {
                    if (isHanyaOngkir) return;
                    const patch: any = { isOngkir: "TIDAK", _ongkir: "", _bayarOngkir: "" };
                    patch.harga = hargaKolomSewa({ ...(row as any), ...patch }, sewaTable, dasarDariHarga(row));
                    patch._addedBy = (row as any)._addedBy || userEmail;
                    updateRow(rowIndex, patch);
                  }}
                  className={`flex items-center justify-center min-h-[32px] px-3 py-1 rounded-full transition duration-200 ${
                    isHanyaOngkir
                      ? "opacity-30 cursor-not-allowed text-label-3"
                      : (row as any).isOngkir === "TIDAK"
                        ? "bg-negative text-white shadow-sm"
                        : "hover:bg-surface/60 text-label-2 font-medium"
                    }`}
                >
                  <span className="text-caption2 font-bold tracking-tight">TIDAK</span>
                </button>
              </div>
              {((value === "YA" || isHanyaOngkir) && (row as any).isPaid !== "TIDAK") && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <AutoFitInput
                    isMobile={false}
                    prefixText="Rp"
                    prefixOffsetClass="left-2"
                    minSample="00.000"
                    containerClassName="!min-w-0 shrink-0"
                    data-fieldid={`sewa-${rowIndex}-ongkir`}
                    type="text"
                    inputMode="numeric"
                    className="pl-7 pr-2.5 font-mono font-medium text-[16px] sm:text-footnote"
                    value={formatRibuanInput((row as any)._ongkir)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      const val = raw === "" ? "" : toInt(raw);
                      const patch: any = { _ongkir: val };
                      patch.harga = hargaKolomSewa({ ...(row as any), ...patch }, sewaTable, dasarDariHarga(row));
                      patch._addedBy = (row as any)._addedBy || userEmail;
                      updateRow(rowIndex, patch);
                    }}
                    onKeyDown={onKeyNav}
                    placeholder="0"
                  />
                  <div className="flex items-center gap-1 apple-segmented p-1 rounded-full shrink-0">
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
                      className={`flex items-center justify-center min-h-[32px] px-2.5 py-1 rounded-full transition duration-200 ${(row as any)._bayarOngkir === "Cash"
                        ? "bg-positive text-white shadow-sm"
                        : "hover:bg-surface/60 text-label-2"
                        }`}
                      title="Cash"
                    >
                      <span className="text-caption2 font-bold tracking-tight">CASH</span>
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
                      className={`flex items-center justify-center min-h-[32px] px-2.5 py-1 rounded-full transition duration-200 ${(row as any)._bayarOngkir === "Transfer"
                        ? "bg-tint text-white shadow-sm"
                        : "hover:bg-surface/60 text-label-2"
                        }`}
                      title="Transfer"
                    >
                      <span className="text-caption2 font-bold tracking-tight">TF</span>
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
            <AutoFitSelect
              isMobile={isMobile}
              data-fieldid={`table-sewa-${rowIndex}-diantarOleh`}
              className={isOngkirTidak ? "bg-fill text-label-3 cursor-not-allowed opacity-60" : ""}
              value={(row as any).diantarOleh || ""}
              disabled={isOngkirTidak}
              onChange={(e) =>
                updateRow(rowIndex, {
                  diantarOleh: e.target.value,
                  _addedBy: (row as any)._addedBy || userEmail
                } as any)
              }
            >
              <option value="" className="bg-surface text-label">Pilih...</option>
              {allUsers.map((u, i) => (
                <option key={i} value={u.id} className="bg-surface text-label">{u.id.split("@")[0]}</option>
              ))}
            </AutoFitSelect>
          );
        }

        if (keyName === "harga") {
          const currentTotal = toInt(String((row as any).harga ?? ""));
          const isCustom = row.lamaSewa === "Isi Sendiri" || isDenda;

          if (isHanyaOngkir) {
            return (
              <div className="relative px-2.5 py-1.5 whitespace-nowrap bg-fill rounded-control border border-dashed border-sep text-center">
                <span className="font-bold tabular-nums text-label-2">
                  {currentTotal > 0 ? rupiah(currentTotal) : "-"}
                </span>
              </div>
            );
          }

          if (isCustom) {
            return (
              <div className="flex flex-col gap-1">
                <AutoFitInput
                  isMobile={isMobile}
                  prefixText="Rp"
                  prefixOffsetClass="left-2.5"
                  minSample="00.000"
                  data-fieldid={`sewa-${rowIndex}-customBase`}
                  type="text"
                  inputMode="numeric"
                  className="pl-8 font-mono font-bold text-tint"
                  value={formatRibuanInput((row as any)._customBase)}
                  placeholder={isDenda ? "Nominal" : "Hrg Dasar"}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    const patch: any = { _customBase: raw === "" ? "" : toInt(raw) };
                    patch.harga = hargaKolomSewa({ ...(row as any), ...patch }, sewaTable);
                    patch._addedBy = (row as any)._addedBy || userEmail;
                    updateRow(rowIndex, patch);
                  }}
                  onKeyDown={onKeyNav}
                />
                {row.isOngkir === "YA" && (
                  <div className="text-caption2 text-label-2 font-bold ml-1 tabular-nums whitespace-nowrap">Total: {rupiah(currentTotal)}</div>
                )}
              </div>
            );
          }

          // Kunci Readonly Permanen
          const dpBooking = dpBookingBaris(row);
          const dpInfo = dpBooking === 0 ? toInt((row as any)._dpBookingInfo) : 0;
          return (
            <div className="relative px-2 py-1.5 whitespace-nowrap">
              <span className="font-bold tabular-nums text-label">
                {currentTotal > 0 ? rupiah(currentTotal) : dpBooking > 0 && row.isPaid === "YA" ? rupiah(0) : "-"}
              </span>
              {dpBooking > 0 && (
                <div className="text-caption2 text-label-2 font-medium tabular-nums">sesudah DP {rupiah(dpBooking)}</div>
              )}
              {dpInfo > 0 && (
                <div className="text-caption2 text-label-2 font-medium tabular-nums">full (termasuk DP {rupiah(dpInfo)})</div>
              )}
            </div>
          );
        }

        return undefined;
      }}
      isMobileTable={isMobileTable}
      renderNo={tombolNota}
    />
    <NotaSewaSheet
      row={notaRow}
      hargaDasar={notaRow ? hargaDasarOf(notaRow) : 0}
      tanggal={tanggal}
      kasirEmail={userEmail}
      onPatch={patchNota}
      onClose={() => setNotaIdx(null)}
    />
    </>
  );
};

export default RincianSewa;
