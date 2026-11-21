import React, { useMemo, useState, useEffect } from "react";
import { Clock, Monitor, Gamepad2, Smartphone, ShieldCheck, Settings2, MessageCircle } from "lucide-react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { HistoryItem, RowSewa } from "../lib/types";
import { Button, Card, cx, Eyebrow, LineItem, LineList, Meter, Pill, Sheet } from "../ui";
import { buildSewaTable } from "../lib/priceLists";
import { formatK } from "../lib/format";
import { formatWa } from "../lib/wa";
import { daftarSewaBerjalan, jenisUnit, perluKonfirmasiKembali, SewaBerjalan, tagihanBelumBayar } from "../lib/sewa";
import { batasKembali, INGATKAN_SEBELUM_MENIT, labelPengingat, tarifTelatPerJam, waktuRelatif } from "../lib/pengingatSewa";
import PeringatanSewaHabis, { bisaIngatkan, kirimPengingatSewa, sumberSewa } from "./PeringatanSewaHabis";

type WidgetMonitoringStatusProps = {
  history: HistoryItem[];
  rowsSewa: RowSewa[];
  activeDate?: string;
  onVerifyActiveRental?: (item: any) => void;
  /** Catat bahwa penyewa sudah diingatkan via WA */
  onPengingat?: (item: any) => void;
  isOwner?: boolean;
  hargaItems?: any[];
  isVerifyingPayment?: boolean;
};

/** Kartu unit di monitoring: data sewa (lib/sewa) + tampilan jam habis, progres & tagihan. */
type KartuUnit = SewaBerjalan & { id: number; end: string; progress: number; _nominalBelumBayar: number };

const jamMenit = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const namaAkun = (email?: string | null) => (email ? email.split("@")[0] : "");
const WARNA_TINT = "rgb(var(--ui-tint))";
const WARNA_WARNING = "rgb(var(--ui-warning))";

const WidgetMonitoringStatus: React.FC<WidgetMonitoringStatusProps> = ({
  history,
  rowsSewa,
  activeDate,
  onVerifyActiveRental,
  onPengingat,
  isOwner = false,
  hargaItems,
  isVerifyingPayment = false,
}) => {
  const [masterUnit, setMasterUnit] = useState({ ps3: 0, ps4: 0, ps5: 0, tv: 0, portabel: 0 });
  const [tempPs3, setTempPs3] = useState("0");
  const [tempPs4, setTempPs4] = useState("0");
  const [tempPs5, setTempPs5] = useState("0");
  const [tempTv, setTempTv] = useState("0");
  const [tempPortabel, setTempPortabel] = useState("0");
  const [isEditingMaster, setIsEditingMaster] = useState(false);

  const [now, setNow] = useState(Date.now());
  const notifiedRefs = React.useRef<Set<string>>(new Set());
  const [selectedUnit, setSelectedUnit] = useState<KartuUnit | null>(null);

  // Sync auth state
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setCurrentUserEmail(u?.email || null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "master_unit"), (snap) => {
      if (!snap.exists()) {
        console.warn("[MonitoringStatus] master_unit doc does not exist yet.");
        return;
      }
      const data = snap.data();
      setMasterUnit({ ps3: data.ps3 || 0, ps4: data.ps4 || 0, ps5: data.ps5 || 0, tv: data.tv || 0, portabel: data.portabel || 0 });
      setTempPs3(String(data.ps3 || 0));
      setTempPs4(String(data.ps4 || 0));
      setTempPs5(String(data.ps5 || 0));
      setTempTv(String(data.tv || 0));
      setTempPortabel(String(data.portabel || 0));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
      Notification.requestPermission();
    }
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const handleSaveMaster = () => {
    if (!isOwner) return;
    const ps3 = parseInt(tempPs3) || 0;
    const ps4 = parseInt(tempPs4) || 0;
    const ps5 = parseInt(tempPs5) || 0;
    const tv = parseInt(tempTv) || 0;
    const portabel = parseInt(tempPortabel) || 0;
    setDoc(doc(db, "data", "master_unit"), { ps3, ps4, ps5, tv, portabel }, { merge: true });
    setIsEditingMaster(false);
  };

  // Tabel harga hanya dibangun ulang saat harga berubah (bukan tiap 15 detik)
  const sewaTable = useMemo(() => buildSewaTable(hargaItems), [hargaItems]);

  const { activeRentals, rentedPS3, rentedPS4, rentedPS5, rentedPortabel, rentedTV, readyPS3, readyPS4, readyPS5, readyPortabel, readyTV } = useMemo(() => {
    const nowD = new Date(now);
    let rPS3 = 0, rPS4 = 0, rPS5 = 0, rPortabel = 0, rTV = 0;
    // Satu sumber data unit berjalan (sama dengan peringatan "waktu sewa habis" di halaman Usaha Rental)
    const rentals: KartuUnit[] = daftarSewaBerjalan({ history, rowsSewa, activeDate, now }).map((u, i) => {
      // Unit yang belum dikonfirmasi kembali TETAP dihitung jalan (tidak otomatis READY)
      const unit = jenisUnit(u.jenis);
      if (unit.tv) rTV++;
      if (unit.portabel) rPortabel++;
      if (unit.konsol === "PS5") rPS5++;
      else if (unit.konsol === "PS4") rPS4++;
      else if (unit.konsol === "PS3") rPS3++;

      let end = "-";
      let progress = 0;
      if (u.endMs !== null && u.mulaiMs !== null) {
        const endD = new Date(u.endMs);
        const hariIni = endD.toDateString() === nowD.toDateString();
        end = hariIni ? jamMenit(endD) : `${String(endD.getDate()).padStart(2, "0")}/${String(endD.getMonth() + 1).padStart(2, "0")} ${jamMenit(endD)}`;
        progress = u.isDone ? 100 : now >= u.mulaiMs ? ((now - u.mulaiMs) / (u.endMs - u.mulaiMs)) * 100 : 0;
      }
      return {
        ...u,
        id: i + 1,
        end,
        progress: Math.min(100, Math.max(0, progress)),
        _nominalBelumBayar: hargaItems ? tagihanBelumBayar(u._rawRow, sewaTable) : 0,
      };
    });

    return {
      activeRentals: rentals,
      rentedPS3: rPS3,
      rentedPS4: rPS4,
      rentedPS5: rPS5,
      rentedPortabel: rPortabel,
      rentedTV: rTV,
      readyPS3: Math.max(0, masterUnit.ps3 - rPS3),
      readyPS4: Math.max(0, masterUnit.ps4 - rPS4),
      readyPS5: Math.max(0, masterUnit.ps5 - rPS5),
      readyPortabel: Math.max(0, masterUnit.portabel - rPortabel),
      readyTV: Math.max(0, masterUnit.tv - rTV)
    };
  }, [rowsSewa, history, activeDate, now, masterUnit, hargaItems, sewaTable]);

  // Notifikasi browser sekali per unit saat waktunya habis
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted" || !currentUserEmail) return;
    activeRentals.forEach(r => {
      if (r.isDone && !r.isVerified && r.addedBy === currentUserEmail && !notifiedRefs.current.has(r.uid)) {
        try {
          new Notification(`Waktu Sewa Habis!`, {
            body: `BILING ${r.id}: PS ${r.jenis} a.n ${r.namaPenyewa} telah habis durasinya. Mohon konfirmasi pengembalian.`,
            icon: "/favicon.ico"
          });
        } catch (e) { }
        notifiedRefs.current.add(r.uid);
      }
    });
  }, [activeRentals, currentUserEmail]);

  // Peringatan "waktu sewa habis" untuk sewa yang dicatat admin ini
  const perluKonfirmasi = useMemo(() => activeRentals.filter((u) => perluKonfirmasiKembali(u, currentUserEmail, now)), [activeRentals, currentUserEmail, now]);

  // ===== Pengingat WhatsApp penyewa =====
  const waktunyaIngatkan = (u: KartuUnit) => bisaIngatkan(u) && !u.isVerified && now >= (u.endMs || 0) - INGATKAN_SEBELUM_MENIT * 60000;
  const kirimPengingat = (u: KartuUnit) => kirimPengingatSewa(u, onPengingat);
  const verifikasi = (item: ReturnType<typeof sumberSewa>) => onVerifyActiveRental?.(item);

  /** "Unit diperkirakan kembali besok pukul 10.00." */
  const teksPerkiraanKembali = (endMs: number | null) => {
    if (!endMs) return "Waktu estimasi tidak spesifik.";
    if (now >= endMs) return "Waktu biling sudah habis, unit seharusnya sudah kembali.";
    return `Unit diperkirakan kembali ${waktuRelatif(endMs, now)}.`;
  };

  const masterItems = [
    { key: "ps3", label: "PS3", Icon: Gamepad2, total: masterUnit.ps3, temp: tempPs3, setTemp: setTempPs3, ready: readyPS3, rented: rentedPS3, readyTitle: "PS3 ready" },
    { key: "ps4", label: "PS4", Icon: Gamepad2, total: masterUnit.ps4, temp: tempPs4, setTemp: setTempPs4, ready: readyPS4, rented: rentedPS4, readyTitle: "PS4 ready" },
    { key: "ps5", label: "PS5", Icon: Gamepad2, total: masterUnit.ps5, temp: tempPs5, setTemp: setTempPs5, ready: readyPS5, rented: rentedPS5, readyTitle: "PS5 ready" },
    { key: "portabel", label: "PTB", Icon: Smartphone, total: masterUnit.portabel, temp: tempPortabel, setTemp: setTempPortabel, ready: readyPortabel, rented: rentedPortabel, readyTitle: "Portabel ready" },
    { key: "tv", label: "TV", Icon: Monitor, total: masterUnit.tv, temp: tempTv, setTemp: setTempTv, ready: readyTV, rented: rentedTV, readyTitle: "TV ready" },
  ];

  return (
    <>
      <Card title="Monitoring status unit" icon={<Monitor />} iconColor="indigo">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-6">
          {/* Kolom kiri: Master inventaris & ringkasan Ready/Jalan */}
          <div className="flex flex-col gap-4 lg:w-5/12">
            <div className="rounded-tile apple-tile p-4 ring-1 ring-edge">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-tint" />
                  <Eyebrow>Master inventaris</Eyebrow>
                </div>
                {isOwner && (
                  <Button
                    variant={isEditingMaster ? "filled" : "tinted"}
                    size="sm"
                    onClick={() => {
                      if (isEditingMaster) handleSaveMaster();
                      else setIsEditingMaster(true);
                    }}
                    className="min-h-[44px] sm:min-h-[32px]"
                  >
                    {isEditingMaster ? "Simpan" : "Edit"}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {masterItems.map((it) => {
                  const ItemIcon = it.Icon;
                  return (
                    <div key={it.key} className="flex min-w-0 flex-col gap-1.5">
                      <label
                        htmlFor={`master-unit-${it.key}`}
                        className="truncate text-center text-caption2 font-semibold uppercase tracking-wide text-label-3"
                      >
                        {it.label}
                      </label>
                      {isEditingMaster && isOwner ? (
                        <input
                          id={`master-unit-${it.key}`}
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          min="0"
                          value={it.temp}
                          onChange={(e) => it.setTemp(e.target.value)}
                          className="w-full min-h-[44px] rounded-control bg-surface px-1 py-2 text-center font-mono text-[16px] font-semibold tabular-nums text-label ring-1 ring-edge focus:outline-none focus:ring-2 focus:ring-tint"
                        />
                      ) : (
                        <div className="flex min-h-[44px] w-full items-center justify-center gap-1 rounded-control bg-surface px-1 py-2 font-mono text-callout font-bold tabular-nums text-label ring-1 ring-edge">
                          <ItemIcon className="h-3.5 w-3.5 shrink-0 text-label-3" />
                          {it.total}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 min-[480px]:grid-cols-5">
              {masterItems.map((it) => (
                <div
                  key={`ready-stat-${it.key}`}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-tile bg-positive/10 px-2 py-2.5 text-center"
                >
                  <span className="text-caption2 font-semibold leading-tight text-positive">{it.label} Ready</span>
                  <span className="text-title3 font-bold tabular-nums text-positive">{it.ready}</span>
                </div>
              ))}
              {masterItems.map((it) => (
                <div
                  key={`rented-stat-${it.key}`}
                  className="flex flex-col items-center justify-center gap-0.5 rounded-tile bg-negative/10 px-2 py-2.5 text-center"
                >
                  <span className="whitespace-nowrap text-caption2 font-semibold leading-tight text-negative">{it.label} Jalan</span>
                  <span className="text-title3 font-bold tabular-nums text-negative">{it.rented}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kolom kanan: Status unit aktif & ready */}
          <div className="w-full rounded-tile apple-tile p-4 ring-1 ring-edge lg:w-7/12">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-tint" />
                <Eyebrow>Status unit</Eyebrow>
              </div>
              <div className="flex items-center gap-3 text-caption font-medium text-label-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-negative" />
                  Jalan
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-positive" />
                  Ready
                </span>
              </div>
            </div>

            <div className="grid max-h-[600px] w-full grid-cols-[repeat(auto-fill,minmax(132px,1fr))] items-start gap-3 overflow-x-hidden overflow-y-auto pr-1 custom-scrollbar">
              {activeRentals.map((u) => {
                const adminName = u.addedBy ? u.addedBy.split("@")[0].toUpperCase() : "ADMIN";
                const isWarning = u.isDone && !u.isVerified;
                return (
                  <div
                    key={u.uid}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedUnit(u)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedUnit(u);
                      }
                    }}
                    className={`relative flex min-w-0 max-w-full cursor-pointer flex-col overflow-hidden rounded-tile apple-card p-3 pt-3.5 text-center shadow-card ring-1 transition-transform duration-150 active:scale-[0.98] ${
                      isWarning ? "ring-warning/60" : "ring-edge"
                    }`}
                  >
                    <div className="absolute top-0 left-0 h-1 w-full bg-fill">
                      <div
                        className={`h-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${isWarning ? "bg-warning" : "bg-negative"}`}
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>

                    <div className="flex justify-center">
                      <Pill tone={isWarning ? "warning" : "negative"}>Biling {u.id}</Pill>
                    </div>

                    <h4 className="mt-1.5 truncate text-subhead font-semibold text-label" title={u.jenis}>
                      {u.jenis}
                    </h4>

                    <div className="mt-1.5 flex flex-col items-center gap-1 text-center">
                      <p className="w-full truncate px-1 text-caption font-semibold text-tint">{u.namaPenyewa}</p>
                      {u.waPenyewa && (
                        <p className="w-full truncate font-mono text-caption2 text-label-3">{formatWa(u.waPenyewa)}</p>
                      )}

                      <span className="inline-block rounded-full bg-fill px-2 py-0.5 text-caption2 font-medium text-label-2">
                        By: {adminName}
                      </span>

                      {u.diantarOleh && (
                        <Pill tone="tint">Diantar: {u.diantarOleh.split("@")[0]}</Pill>
                      )}
                      {!u.diantarOleh && u.isOngkir === "TIDAK" && (
                        <Pill tone="positive">Diambil sendiri</Pill>
                      )}
                      {u.isPaid === "TIDAK" && (
                        <div className="flex flex-col items-center gap-0.5">
                          <Pill tone="negative">Belum dibayar</Pill>
                          {u._nominalBelumBayar ? (
                            <span className="text-caption2 font-semibold tabular-nums text-negative">
                              Rp {formatK(u._nominalBelumBayar)}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {u.isPaid === "YA" && (
                        <Pill tone="positive">Sudah dibayar</Pill>
                      )}

                      {waktunyaIngatkan(u) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            kirimPengingat(u);
                          }}
                          className="mt-1 inline-flex min-h-[36px] w-full items-center justify-center gap-1 rounded-full bg-positive px-2.5 text-caption font-semibold text-white transition-opacity active:opacity-80"
                        >
                          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                          Ingatkan
                        </button>
                      )}

                      {u.diingatkan?.length > 0 && (
                        <p className="w-full truncate text-caption2 font-medium text-positive">
                          {labelPengingat(u.diingatkan)}
                        </p>
                      )}

                      {isWarning ? (
                        <div className="mt-1">
                          <Pill tone="warning">Perlu konfirmasi</Pill>
                        </div>
                      ) : (
                        <div className="mt-1 flex flex-col items-center font-mono tabular-nums">
                          <span className="text-caption2 font-medium text-label-3">{u.start}</span>
                          <span className="inline-flex items-center gap-1 text-caption font-bold text-negative">
                            <Clock className="h-3 w-3 shrink-0" />
                            {u.end}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {masterItems.flatMap((it) => {
                const ReadyIcon = it.key === "portabel" ? Smartphone : it.key === "tv" ? Monitor : ShieldCheck;
                return Array.from({ length: it.ready }).map((_, i) => (
                  <div
                    key={`ready-${it.key}-${i}`}
                    className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-tile bg-positive/10 p-3 text-center ring-1 ring-positive/20"
                  >
                    <ReadyIcon className="h-7 w-7 text-positive" />
                    <span className="text-caption font-semibold text-positive">{it.readyTitle}</span>
                  </div>
                ));
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Rincian satu biling */}
      {selectedUnit && (() => {
        const sel: KartuUnit = activeRentals.find((r) => r.uid === selectedUnit.uid) || selectedUnit;
        const tarif = tarifTelatPerJam(sel.jenis);
        const adaReminder = bisaIngatkan(sel) && !sel.isVerified;
        const isWarning = sel.isDone && !sel.isVerified;
        return (
          <Sheet
            open={Boolean(selectedUnit)}
            onClose={() => setSelectedUnit(null)}
            size="sm"
            variant="grouped"
            zClassName="z-[700]"
            title={sel.jenis}
            subtitle={`Biling ${sel.id} · ${sel.namaPenyewa || "Tanpa nama"}`}
            footer={
              <div className="flex flex-col gap-2.5">
                {adaReminder && (
                  <Button
                    variant="filled"
                    size="lg"
                    block
                    icon={<MessageCircle />}
                    onClick={() => kirimPengingat(sel)}
                  >
                    Ingatkan via WA
                  </Button>
                )}
                {sel.diingatkan?.length > 0 && (
                  <p className="text-center text-footnote font-medium text-positive">{labelPengingat(sel.diingatkan)}</p>
                )}
                <Button
                  variant={adaReminder ? "gray" : "filled"}
                  size="lg"
                  block
                  onClick={() => setSelectedUnit(null)}
                >
                  Tutup
                </Button>
              </div>
            }
          >
            <div className="space-y-3">
              <Card>
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <div className={cx("text-caption font-semibold", isWarning ? "text-warning" : "text-label-2")}>{isWarning ? "Waktu habis" : "Selesai"}</div>
                    <div className="text-title1 font-bold tabular-nums text-label">{sel.end}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-caption font-semibold text-label-2">Mulai</div>
                    <div className="text-headline font-semibold tabular-nums text-label">{sel.start || "-"}</div>
                  </div>
                </div>
                <Meter
                  size="sm"
                  className="mt-3"
                  fraction={sel.progress / 100}
                  color={isWarning ? WARNA_WARNING : WARNA_TINT}
                  label={`Waktu sewa berjalan ${Math.round(sel.progress)} persen`}
                />
                <p className="mt-2.5 text-footnote leading-snug text-label-2">{teksPerkiraanKembali(sel.endMs)}</p>
              </Card>

              <Card>
                <LineList>
                  <LineItem
                    label="WhatsApp"
                    value={sel.waPenyewa ? formatWa(sel.waPenyewa) : "Belum diisi"}
                    tone={sel.waPenyewa ? undefined : "negative"}
                  />
                  <LineItem label="Dicatat oleh" value={namaAkun(sel.addedBy).toUpperCase() || "UNKNOWN"} />
                  <LineItem
                    label="Pengantaran"
                    value={sel.diantarOleh ? `Diantar ${namaAkun(sel.diantarOleh)}` : sel.isOngkir === "TIDAK" ? "Diambil sendiri" : "-"}
                  />
                  <LineItem
                    label="Pembayaran"
                    value={
                      sel.isPaid === "TIDAK"
                        ? `Belum dibayar${sel._nominalBelumBayar ? ` · Rp ${formatK(sel._nominalBelumBayar)}` : ""}`
                        : sel.isPaid === "YA"
                          ? "Sudah dibayar"
                          : "-"
                    }
                    tone={sel.isPaid === "TIDAK" ? "negative" : sel.isPaid === "YA" ? "positive" : undefined}
                  />
                  {sel.endMs ? (
                    <LineItem
                      label="Batas kembali"
                      note={tarif ? `Telat Rp${formatK(tarif).replace("k", "rb")}/jam` : undefined}
                      value={waktuRelatif(batasKembali(sel.endMs), now)}
                    />
                  ) : null}
                </LineList>
              </Card>
            </div>
          </Sheet>
        );
      })()}

      <PeringatanSewaHabis items={perluKonfirmasi} userEmail={currentUserEmail} jeda={isVerifyingPayment} onVerify={verifikasi} onPengingat={onPengingat} />
    </>
  );
};

export default WidgetMonitoringStatus;
