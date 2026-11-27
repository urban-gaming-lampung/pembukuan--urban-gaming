import React, { useMemo, useState, useEffect } from "react";
import { Clock, Gamepad2, MessageCircle, Monitor, Smartphone } from "lucide-react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { HistoryItem, RowSewa } from "../lib/types";
import { Button, Card, cx, Eyebrow, IconBadge, LineItem, LineList, ListGroup, Meter, Pill, Sheet, Stepper, tile, tileInteractive, type WarnaIkon } from "../ui";
import { buildSewaTable } from "../lib/priceLists";
import { formatK } from "../lib/format";
import { formatWa } from "../lib/wa";
import { daftarSewaBerjalan, jenisUnit, perluKonfirmasiKembali, SewaBerjalan, tagihanBelumBayar } from "../lib/sewa";
import { batasKembali, hitungDendaTelat, INGATKAN_SEBELUM_MENIT, labelLamaTelat, labelPengingat, tarifTelatPerJam, waktuRelatif } from "../lib/pengingatSewa";
import PeringatanSewaHabis, { bisaIngatkan, kirimPengingatSewa, sumberSewa } from "./PeringatanSewaHabis";

/**
 * MONITORING STATUS UNIT — iOS 27, padat untuk mobile (390px).
 * Satu kartu: strip ready / total per jenis unit (satu baris), lalu kartu biling 2 kolom
 * (progress 4px, status ringkas). Jumlah unit diatur lewat lembar (owner). Logika data tetap.
 */
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
/** Kolom strip per jenis unit (sesuai jumlah jenis yang tampil). */
const KOLOM: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" };

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
  /** Tutup lembar jumlah unit tanpa menyimpan: isian kembali ke angka tersimpan. */
  const batalEditMaster = () => {
    setTempPs3(String(masterUnit.ps3));
    setTempPs4(String(masterUnit.ps4));
    setTempPs5(String(masterUnit.ps5));
    setTempTv(String(masterUnit.tv));
    setTempPortabel(String(masterUnit.portabel));
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

  const masterItems: { key: string; label: string; nama: string; icon: React.ReactNode; color: WarnaIkon; total: number; temp: string; setTemp: (v: string) => void; ready: number; rented: number }[] = [
    { key: "ps3", label: "PS3", nama: "PlayStation 3", icon: <Gamepad2 />, color: "gray", total: masterUnit.ps3, temp: tempPs3, setTemp: setTempPs3, ready: readyPS3, rented: rentedPS3 },
    { key: "ps4", label: "PS4", nama: "PlayStation 4", icon: <Gamepad2 />, color: "blue", total: masterUnit.ps4, temp: tempPs4, setTemp: setTempPs4, ready: readyPS4, rented: rentedPS4 },
    { key: "ps5", label: "PS5", nama: "PlayStation 5", icon: <Gamepad2 />, color: "indigo", total: masterUnit.ps5, temp: tempPs5, setTemp: setTempPs5, ready: readyPS5, rented: rentedPS5 },
    { key: "portabel", label: "PTB", nama: "PS portabel", icon: <Smartphone />, color: "teal", total: masterUnit.portabel, temp: tempPortabel, setTemp: setTempPortabel, ready: readyPortabel, rented: rentedPortabel },
    { key: "tv", label: "TV", nama: "Televisi", icon: <Monitor />, color: "orange", total: masterUnit.tv, temp: tempTv, setTemp: setTempTv, ready: readyTV, rented: rentedTV },
  ];
  const jenisTampil = masterItems.filter((it) => it.total > 0 || it.rented > 0);
  const totalUnit = masterItems.reduce((s, it) => s + it.total, 0);
  const totalJalan = masterItems.reduce((s, it) => s + it.rented, 0);
  const totalReady = masterItems.reduce((s, it) => s + it.ready, 0);

  // Urutan tampil: perlu konfirmasi dulu, lalu yang paling cepat selesai (nomor biling tetap)
  const daftarJalan = useMemo(
    () =>
      [...activeRentals].sort(
        (a, b) => Number(b.isDone && !b.isVerified) - Number(a.isDone && !a.isVerified) || (a.endMs ?? Infinity) - (b.endMs ?? Infinity) || a.id - b.id
      ),
    [activeRentals]
  );

  return (
    <>
      <Card
        title="Status unit"
        subtitle={totalUnit ? `${totalReady} ready · ${totalJalan} jalan · ${totalUnit} unit` : "Jumlah unit belum diatur"}
        icon={<Monitor />}
        iconColor="indigo"
        accessory={
          isOwner ? (
            <Button variant="tinted" size="sm" onClick={() => setIsEditingMaster(true)}>
              Atur unit
            </Button>
          ) : undefined
        }
      >
        {/* Strip ketersediaan: angka besar = ready, kecil = total unit */}
        {jenisTampil.length > 0 ? (
          <div className={cx("grid gap-1.5", KOLOM[jenisTampil.length] || "grid-cols-5")}>
            {jenisTampil.map((it) => (
              <div
                key={it.key}
                className={cx(tile, "min-w-0 px-1.5 py-2.5 text-center")}
                aria-label={`${it.label}: ${it.ready} ready, ${it.rented} jalan dari ${it.total} unit`}
              >
                <div className="truncate text-caption2 font-semibold uppercase tracking-wide text-label-2">{it.label}</div>
                <div className="mt-1 leading-none tabular-nums">
                  <span className={cx("text-title2 font-bold", it.ready > 0 ? "text-positive" : "text-label-3")}>{it.ready}</span>
                  <span className="text-caption font-medium text-label-3">/{it.total}</span>
                </div>
                <div className={cx("mt-1 truncate text-caption2 font-medium tabular-nums", it.rented > 0 ? "text-negative" : "text-label-3")}>
                  {it.rented} jalan
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-footnote text-label-2">
            {isOwner ? "Ketuk Atur unit untuk mengisi jumlah PS, portabel, dan TV yang dimiliki." : "Jumlah unit belum diatur owner."}
          </p>
        )}

        {/* Biling berjalan: 2 kolom, yang perlu konfirmasi & paling cepat selesai di depan */}
        <div className="mt-4 mb-2 flex items-center justify-between gap-2 px-0.5">
          <Eyebrow>Sedang jalan</Eyebrow>
          {daftarJalan.length > 0 && <span className="text-caption font-medium text-label-2 tabular-nums">{daftarJalan.length} biling</span>}
        </div>
        {daftarJalan.length === 0 ? (
          <div className={cx(tile, "px-4 py-5 text-center text-footnote text-label-2")}>Tidak ada unit jalan. Semua unit ready di toko.</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {daftarJalan.map((u) => {
              const isWarning = u.isDone && !u.isVerified;
              const ingatkan = waktunyaIngatkan(u);
              const telat = isWarning && u.endMs ? hitungDendaTelat(u.jenis, u.endMs, now) : null;
              return (
                <div
                  key={u.uid}
                  role="button"
                  tabIndex={0}
                  aria-label={`Biling ${u.id}, ${u.jenis}, ${u.namaPenyewa || "tanpa nama"}`}
                  onClick={() => setSelectedUnit(u)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedUnit(u);
                    }
                  }}
                  className={cx(
                    tileInteractive,
                    "flex min-w-0 cursor-pointer flex-col p-3 text-left active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                    isWarning && "ring-warning/50 dark:ring-warning/50"
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span
                      className={cx(
                        "flex h-6 min-w-[24px] items-center justify-center rounded-full px-1.5 text-caption2 font-bold tabular-nums",
                        isWarning ? "bg-warning/15 text-warning" : "bg-fill text-label-2"
                      )}
                    >
                      {u.id}
                    </span>
                    <span className={cx("inline-flex min-w-0 items-center gap-1 truncate text-footnote font-semibold tabular-nums", isWarning ? "text-warning" : "text-label")}>
                      <Clock className="h-3 w-3 shrink-0" aria-hidden />
                      {u.end}
                    </span>
                  </div>

                  <div className="mt-2 truncate text-subhead font-semibold text-label">{u.jenis}</div>
                  <div className="truncate text-caption text-label-2">{u.namaPenyewa || "Tanpa nama"}</div>
                  <div className="truncate text-caption2 text-label-3 tabular-nums">
                    {namaAkun(u.addedBy) || "admin"} · mulai {u.start}
                  </div>

                  <Meter
                    size="sm"
                    className="mt-2"
                    fraction={u.progress / 100}
                    color={isWarning ? WARNA_WARNING : WARNA_TINT}
                    label={`Waktu sewa berjalan ${Math.round(u.progress)} persen`}
                  />

                  <div className="mt-2 flex flex-wrap gap-1">
                    {isWarning && <Pill tone="warning">Konfirmasi</Pill>}
                    {u.isPaid === "TIDAK" && <Pill tone="negative">Belum{u._nominalBelumBayar ? ` Rp ${formatK(u._nominalBelumBayar)}` : " bayar"}</Pill>}
                    {u.isPaid === "YA" && <Pill tone="positive">Lunas</Pill>}
                    {u.diantarOleh ? (
                      <Pill tone="tint">Antar {namaAkun(u.diantarOleh)}</Pill>
                    ) : u.isOngkir === "TIDAK" ? (
                      <Pill tone="neutral">Ambil</Pill>
                    ) : null}
                  </div>

                  {telat && telat.menit > 0 && (
                    <p className="mt-1.5 truncate text-caption2 font-semibold text-negative tabular-nums">
                      Telat {labelLamaTelat(telat.menit, true)}{telat.nominal > 0 ? ` · denda ${formatK(telat.nominal)}` : ""}
                    </p>
                  )}

                  {u.diingatkan?.length > 0 && (
                    <p className="mt-1.5 truncate text-caption2 font-medium text-positive">{labelPengingat(u.diingatkan)}</p>
                  )}

                  {ingatkan && (
                    <Button
                      variant="filled"
                      size="md"
                      block
                      icon={<MessageCircle />}
                      className="mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        kirimPengingat(u);
                      }}
                    >
                      Ingatkan
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Lembar jumlah unit (owner) */}
      {isOwner && (
        <Sheet
          open={isEditingMaster}
          onClose={batalEditMaster}
          size="sm"
          variant="grouped"
          zClassName="z-[700]"
          title="Atur unit"
          subtitle="Jumlah unit rental yang dimiliki toko"
          footer={
            <Button variant="filled" size="lg" block onClick={handleSaveMaster}>
              Simpan
            </Button>
          }
        >
          <ListGroup>
            {masterItems.map((it) => {
              const nilai = parseInt(it.temp) || 0;
              return (
                <div key={it.key} className="group/row flex items-center gap-3 pl-4 pr-3.5 sm:pr-4">
                  <IconBadge color={it.color}>{it.icon}</IconBadge>
                  <div className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 border-b border-sep py-2.5 group-last/row:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-callout text-label">{it.label}</div>
                      <div className="truncate text-footnote text-label-2">{it.rented} sedang jalan</div>
                    </div>
                    <Stepper
                      value={nilai}
                      min={0}
                      max={999}
                      onChange={(n) => it.setTemp(String(n))}
                      ariaLabel={`jumlah ${it.nama}`}
                    />
                  </div>
                </div>
              );
            })}
          </ListGroup>
          <p className="mt-2 px-4 text-footnote text-label-2 leading-snug">Unit ready = jumlah unit dikurangi yang sedang jalan.</p>
        </Sheet>
      )}

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
