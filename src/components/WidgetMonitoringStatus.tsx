import React, { useMemo, useState, useEffect } from "react";
import { CheckCircle2, ChevronRight, Clock, Gamepad2, MessageCircle, Monitor, Smartphone } from "lucide-react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { HistoryItem, RowSewa } from "../lib/types";
import { Button, Card, cx, EmptyState, IconBadge, LineItem, LineList, ListGroup, Meter, Pill, SectionHeader, Sheet, StatTile, Stepper, type WarnaIkon } from "../ui";
import { buildSewaTable } from "../lib/priceLists";
import { formatK } from "../lib/format";
import { formatWa } from "../lib/wa";
import { daftarSewaBerjalan, jenisUnit, perluKonfirmasiKembali, SewaBerjalan, tagihanBelumBayar } from "../lib/sewa";
import { batasKembali, INGATKAN_SEBELUM_MENIT, labelPengingat, tarifTelatPerJam, waktuRelatif } from "../lib/pengingatSewa";
import PeringatanSewaHabis, { bisaIngatkan, kirimPengingatSewa, sumberSewa } from "./PeringatanSewaHabis";

/**
 * MONITORING STATUS UNIT — tampilan iOS 27 (mobile-first 390px).
 * Ringkasan jalan / ready + ketersediaan per jenis unit (titik per unit), lalu daftar sewa
 * berjalan bergaya Grouped List (baris 68px + progress 4px). Logika data tidak berubah.
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
const WARNA_JALAN = "rgb(var(--ui-negative))";
const WARNA_READY = "rgb(var(--ui-positive))";
/** Unit sebanyak ini ke bawah digambar satu titik per unit; lebih dari itu pakai bar. */
const SLOT_MAKS = 24;

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
    { key: "portabel", label: "Portabel", nama: "PS portabel", icon: <Smartphone />, color: "teal", total: masterUnit.portabel, temp: tempPortabel, setTemp: setTempPortabel, ready: readyPortabel, rented: rentedPortabel },
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        {/* Ringkasan & ketersediaan per jenis unit */}
        <Card
          title="Status unit"
          subtitle={totalUnit ? `${totalUnit} unit rental` : "Jumlah unit belum diatur"}
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
          <div className="grid grid-cols-2 gap-2">
            <StatTile
              label="Jalan"
              dot={WARNA_JALAN}
              value={<span className="text-title1 font-bold tabular-nums text-label">{totalJalan}</span>}
              sub={totalUnit ? `dari ${totalUnit} unit` : "unit disewa"}
            />
            <StatTile
              label="Ready"
              dot={WARNA_READY}
              value={<span className="text-title1 font-bold tabular-nums text-label">{totalReady}</span>}
              sub="siap disewa"
            />
          </div>

          {jenisTampil.length > 0 ? (
            <div className="mt-3 divide-y divide-sep">
              {jenisTampil.map((it) => {
                const slot = Math.max(it.total, it.rented);
                return (
                  <div key={it.key} className="flex min-h-[52px] items-center gap-3 py-3">
                    <IconBadge color={it.color}>{it.icon}</IconBadge>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-callout font-semibold text-label">{it.label}</span>
                        <span className="shrink-0 text-footnote tabular-nums text-label-2">
                          <b className="font-semibold text-positive">{it.ready}</b> ready · <b className="font-semibold text-label">{it.rented}</b> jalan
                        </span>
                      </div>
                      {slot <= SLOT_MAKS ? (
                        <div className="mt-1.5 flex flex-wrap gap-1" role="img" aria-label={`${it.label}: ${it.rented} jalan, ${it.ready} ready dari ${it.total} unit`}>
                          {Array.from({ length: slot }, (_, i) => (
                            <span key={i} className={cx("h-2 w-2 rounded-full", i < it.rented ? "bg-negative" : "bg-positive/70")} />
                          ))}
                        </div>
                      ) : (
                        <Meter size="sm" className="mt-2" fraction={it.rented / slot} color={WARNA_JALAN} label={`${it.label} jalan`} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-footnote text-label-2">
              {isOwner ? "Ketuk Atur unit untuk mengisi jumlah PS, portabel, dan TV yang dimiliki." : "Jumlah unit belum diatur owner."}
            </p>
          )}

          <div className="mt-3 flex items-center gap-4 text-caption text-label-2" aria-hidden>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-negative" />Jalan</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-positive/70" />Ready</span>
          </div>
        </Card>

        {/* Daftar sewa berjalan */}
        <section aria-label="Sedang jalan" className="min-w-0">
          <SectionHeader title="Sedang jalan" accessory={daftarJalan.length ? `${daftarJalan.length} biling` : undefined} className="pt-1 lg:pt-0" />
          {daftarJalan.length === 0 ? (
            <EmptyState icon={<CheckCircle2 />} title="Tidak ada unit jalan">
              Semua unit sedang ready di toko.
            </EmptyState>
          ) : (
            <ListGroup>
              {daftarJalan.map((u) => {
                const isWarning = u.isDone && !u.isVerified;
                const admin = namaAkun(u.addedBy) || "admin";
                const ingatkan = waktunyaIngatkan(u);
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
                    className="group/row flex cursor-pointer items-start gap-3 pl-4 pr-3.5 text-left transition-colors hover:bg-fill/55 active:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tint sm:pr-4"
                  >
                    <span
                      className={cx(
                        "mt-3.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-footnote font-semibold tabular-nums",
                        isWarning ? "bg-warning/15 text-warning" : "bg-fill text-label"
                      )}
                      aria-label={`Biling ${u.id}`}
                    >
                      {u.id}
                    </span>
                    <div className="min-w-0 flex-1 border-b border-sep py-3 group-last/row:border-b-0">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="min-w-0 flex-1 truncate text-callout font-semibold text-label">{u.jenis}</span>
                            <span className={cx("inline-flex shrink-0 items-center gap-1 text-subhead font-semibold tabular-nums", isWarning ? "text-warning" : "text-label")}>
                              <Clock className="h-3.5 w-3.5" aria-hidden />
                              {u.end}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-baseline gap-2 text-footnote text-label-2">
                            <span className="min-w-0 flex-1 truncate">{u.namaPenyewa || "Tanpa nama"} · {admin}</span>
                            <span className="shrink-0 tabular-nums text-label-3">mulai {u.start}</span>
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-label-3" aria-hidden />
                      </div>

                      <Meter
                        size="sm"
                        className="mt-2.5 mr-6"
                        fraction={u.progress / 100}
                        color={isWarning ? WARNA_WARNING : WARNA_TINT}
                        label={`Waktu sewa berjalan ${Math.round(u.progress)} persen`}
                      />

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {isWarning && <Pill tone="warning">Perlu konfirmasi</Pill>}
                        {u.isPaid === "TIDAK" && (
                          <Pill tone="negative">Belum bayar{u._nominalBelumBayar ? ` · Rp ${formatK(u._nominalBelumBayar)}` : ""}</Pill>
                        )}
                        {u.isPaid === "YA" && <Pill tone="positive">Sudah dibayar</Pill>}
                        {u.diantarOleh ? (
                          <Pill tone="tint">Diantar {namaAkun(u.diantarOleh)}</Pill>
                        ) : u.isOngkir === "TIDAK" ? (
                          <Pill tone="neutral">Diambil sendiri</Pill>
                        ) : null}
                      </div>

                      {u.diingatkan?.length > 0 && (
                        <p className="mt-1.5 truncate text-caption font-medium text-positive">{labelPengingat(u.diingatkan)}</p>
                      )}

                      {ingatkan && (
                        <Button
                          variant="tinted"
                          size="md"
                          icon={<MessageCircle />}
                          className="mt-2.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            kirimPengingat(u);
                          }}
                        >
                          Ingatkan via WA
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </ListGroup>
          )}
        </section>
      </div>

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
