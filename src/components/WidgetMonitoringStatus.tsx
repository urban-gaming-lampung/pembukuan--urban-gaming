import React, { useMemo, useState, useEffect } from "react";
import { Clock, Monitor, Gamepad2, Smartphone, ShieldCheck, Settings2, MessageCircle } from "lucide-react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { HistoryItem, RowSewa } from "../lib/types";
import Section from "./common/Section";
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

  const { activeRentals, rentedPS3, rentedPS4, rentedPS5, rentedPortabel, rentedTV, readyPS3, readyPS4, readyPS5, readyPortabel, readyTV } = useMemo(() => {
    const sewaTable = buildSewaTable(hargaItems);
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
  }, [rowsSewa, history, activeDate, now, masterUnit, hargaItems]);

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

  return (
    <>
      <Section title="Monitoring Status Unit">
        <div className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-white/10 rounded-2xl md:rounded-[32px] p-4 sm:p-6 lg:p-8 flex flex-col gap-8 w-full overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-black/20">

          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 dark:bg-purple-500/5 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 z-10 w-full">
            <div className="lg:w-5/12 flex flex-col gap-4">
              <div className="bg-zinc-50 dark:bg-[#1C1C1E] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold tracking-widest uppercase text-zinc-900 dark:text-white flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-blue-500" /> Master Inventaris
                  </h3>
                  {isOwner && (
                    <button
                      onClick={() => {
                        if (isEditingMaster) handleSaveMaster();
                        else setIsEditingMaster(true);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-black text-blue-600 dark:text-blue-400 font-bold border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                    >
                      {isEditingMaster ? "Simpan" : "Edit"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="text-[9px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-center truncate">PS3</label>
                    {isEditingMaster && isOwner ? (
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tempPs3} onChange={e => setTempPs3(e.target.value)} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-bold text-sm sm:text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : (
                      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-black text-sm sm:text-base shadow-sm flex items-center justify-center gap-1">
                        <Gamepad2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" /> {masterUnit.ps3}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="text-[9px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-center truncate">PS4</label>
                    {isEditingMaster && isOwner ? (
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tempPs4} onChange={e => setTempPs4(e.target.value)} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-bold text-sm sm:text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : (
                      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-black text-sm sm:text-base shadow-sm flex items-center justify-center gap-1">
                        <Gamepad2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500 shrink-0" /> {masterUnit.ps4}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="text-[9px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-center truncate">PS5</label>
                    {isEditingMaster && isOwner ? (
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tempPs5} onChange={e => setTempPs5(e.target.value)} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-bold text-sm sm:text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : (
                      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-black text-sm sm:text-base shadow-sm flex items-center justify-center gap-1">
                        <Gamepad2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-500 shrink-0" /> {masterUnit.ps5}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="text-[9px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-center truncate">PTB</label>
                    {isEditingMaster && isOwner ? (
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tempPortabel} onChange={e => setTempPortabel(e.target.value)} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-bold text-sm sm:text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : (
                      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-black text-sm sm:text-base shadow-sm flex items-center justify-center gap-1">
                        <Smartphone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500 shrink-0" /> {masterUnit.portabel}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <label className="text-[9px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-center truncate">TV</label>
                    {isEditingMaster && isOwner ? (
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tempTv} onChange={e => setTempTv(e.target.value)} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-bold text-sm sm:text-base text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : (
                      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1 py-2 text-zinc-900 dark:text-white font-mono font-black text-sm sm:text-base shadow-sm flex items-center justify-center gap-1">
                        <Monitor className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-500 shrink-0" /> {masterUnit.tv}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 min-[480px]:grid-cols-5 gap-2 mt-1 w-full">
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-emerald-600 dark:text-emerald-400 uppercase text-center leading-tight">PS3 Ready</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">{readyPS3}</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-emerald-600 dark:text-emerald-400 uppercase text-center leading-tight">PS4 Ready</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">{readyPS4}</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-emerald-600 dark:text-emerald-400 uppercase text-center leading-tight">PS5 Ready</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">{readyPS5}</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-emerald-600 dark:text-emerald-400 uppercase text-center leading-tight">PTB Ready</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">{readyPortabel}</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-emerald-600 dark:text-emerald-400 uppercase text-center leading-tight">TV Ready</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">{readyTV}</span>
                </div>

                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-red-600 dark:text-red-400 uppercase text-center leading-tight whitespace-nowrap">PS3 Jalan</span>
                  <span className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400">{rentedPS3}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-red-600 dark:text-red-400 uppercase text-center leading-tight whitespace-nowrap">PS4 Jalan</span>
                  <span className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400">{rentedPS4}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-red-600 dark:text-red-400 uppercase text-center leading-tight whitespace-nowrap">PS5 Jalan</span>
                  <span className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400">{rentedPS5}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-red-600 dark:text-red-400 uppercase text-center leading-tight whitespace-nowrap">PTB Jalan</span>
                  <span className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400">{rentedPortabel}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2 sm:p-2.5 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-wider text-red-600 dark:text-red-400 uppercase text-center leading-tight whitespace-nowrap">TV Jalan</span>
                  <span className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400">{rentedTV}</span>
                </div>
              </div>
            </div>

            <div className="lg:w-7/12 bg-zinc-50 dark:bg-[#1C1C1E] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-inner w-full">
              <div className="flex items-center justify-between mb-4 w-full">
                <h3 className="text-sm font-bold tracking-widest uppercase text-zinc-900 dark:text-white flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-purple-500" /> Status Unit
                </h3>
                <div className="flex flex-wrap gap-3 items-center" style={{ width: 'auto' }}>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div><span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Jalan</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Ready</span></div>
                </div>
              </div>

              <div
                className="grid grid-cols-[repeat(auto-fill,minmax(124px,1fr))] gap-3 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar w-full items-start max-h-[600px]"
              >
                {activeRentals.map(u => {
                  const adminName = u.addedBy ? u.addedBy.split('@')[0].toUpperCase() : 'ADMIN';
                  return (
                    <div
                      key={u.uid}
                      onClick={() => setSelectedUnit(u)}
                      className={`relative bg-white dark:bg-black border rounded-[18px] p-3 shadow-md overflow-hidden flex flex-col min-w-0 max-w-full group cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ${u.isDone && !u.isVerified ? "border-amber-400 dark:border-amber-500/50 hover:shadow-amber-500/20" : "border-red-200 dark:border-red-500/30 hover:shadow-red-500/20"}`}
                    >
                      <div className="absolute top-0 left-0 w-full h-1 bg-zinc-100 dark:bg-zinc-800">
                        <div className={`h-full transition-all duration-1000 ease-linear ${u.isDone && !u.isVerified ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" : "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]"}`} style={{ width: `${u.progress}%` }} />
                      </div>
                      <div className="flex items-start justify-between mt-1 mb-2">
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded text-center w-full max-w-[80%] mx-auto block mb-1 uppercase tracking-wider truncate ${u.isDone && !u.isVerified ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"}`}>
                          BILING {u.id}
                        </span>
                      </div>
                      <h4 className="text-center text-[13px] font-bold text-zinc-900 dark:text-white truncate" title={u.jenis}>{u.jenis}</h4>
                      <div className="flex flex-col gap-1 mt-2 items-center justify-center text-center">
                        <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate w-full px-1">{u.namaPenyewa}</p>
                        {u.waPenyewa && <p className="text-[9.5px] font-mono font-semibold text-zinc-500 dark:text-zinc-400 truncate w-full -mt-0.5">{formatWa(u.waPenyewa)}</p>}

                        <div className="bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5">
                          <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400">BY: {adminName}</span>
                        </div>
                        {u.diantarOleh && (
                          <div className="bg-purple-100 dark:bg-purple-500/10 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5">
                            <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400">Diantar oleh : {u.diantarOleh.split("@")[0]}</span>
                          </div>
                        )}
                        {!u.diantarOleh && u.isOngkir === "TIDAK" && (
                          <div className="bg-lime-100 dark:bg-lime-500/15 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5 ring-1 ring-lime-300 dark:ring-lime-500/30">
                            <span className="text-[9px] font-black text-lime-700 dark:text-lime-400">Diambil sendiri</span>
                          </div>
                        )}
                        {u.isPaid === "TIDAK" && (
                          <div className="bg-red-100 dark:bg-red-500/15 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5 ring-1 ring-red-300 dark:ring-red-500/30">
                            <span className="text-[9px] font-black text-red-700 dark:text-red-400">Belum dibayar {u._nominalBelumBayar ? `(Rp ${formatK(u._nominalBelumBayar)})` : ""}</span>
                          </div>
                        )}
                        {u.isPaid === "YA" && (
                          <div className="bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5 ring-1 ring-emerald-300 dark:ring-emerald-500/30">
                            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400">Sudah dibayar</span>
                          </div>
                        )}

                        {waktunyaIngatkan(u) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); kirimPengingat(u); }}
                            className="mt-1.5 w-full inline-flex items-center justify-center gap-1 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black active:scale-95 transition shadow-sm"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />Ingatkan
                          </button>
                        )}
                        {u.diingatkan?.length > 0 && <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 truncate w-full">{labelPengingat(u.diingatkan)}</p>}
                        {u.isDone && !u.isVerified ? (
                          <div className="text-[10px] font-black tracking-widest text-[#FFF] bg-amber-500 px-2 py-0.5 rounded animate-bounce mt-1.5 shadow-sm">WARNING</div>
                        ) : (
                          <div className="mt-1">
                            <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 justify-center">
                              <span className="text-[10px] font-bold font-mono tracking-tight">{u.start}</span>
                            </div>
                            <div className="flex items-center gap-1 text-red-500 justify-center">
                              <Clock className="w-3 h-3 text-red-500" />
                              <span className="text-[11px] font-black font-mono tracking-tight">{u.end}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {Array.from({ length: readyPS3 }).map((_, i) => (
                  <div key={`ready3-${i}`} className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[18px] p-3 shadow-sm flex flex-col justify-center items-center min-w-0 max-w-full opacity-80 hover:opacity-100 transition-opacity min-h-[110px]">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mb-2" />
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">PS3 READY</h4>
                  </div>
                ))}
                {Array.from({ length: readyPS4 }).map((_, i) => (
                  <div key={`ready4-${i}`} className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[18px] p-3 shadow-sm flex flex-col justify-center items-center min-w-0 max-w-full opacity-80 hover:opacity-100 transition-opacity min-h-[110px]">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mb-2" />
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">PS4 READY</h4>
                  </div>
                ))}
                {Array.from({ length: readyPS5 }).map((_, i) => (
                  <div key={`ready5-${i}`} className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[18px] p-3 shadow-sm flex flex-col justify-center items-center min-w-0 max-w-full opacity-80 hover:opacity-100 transition-opacity min-h-[110px]">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mb-2" />
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">PS5 READY</h4>
                  </div>
                ))}
                {Array.from({ length: readyPortabel }).map((_, i) => (
                  <div key={`readyptb-${i}`} className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[18px] p-3 shadow-sm flex flex-col justify-center items-center min-w-0 max-w-full opacity-80 hover:opacity-100 transition-opacity min-h-[110px]">
                    <Smartphone className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mb-2" />
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">PORTABEL READY</h4>
                  </div>
                ))}
                {Array.from({ length: readyTV }).map((_, i) => (
                  <div key={`readytv-${i}`} className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[18px] p-3 shadow-sm flex flex-col justify-center items-center min-w-0 max-w-full opacity-80 hover:opacity-100 transition-opacity min-h-[110px]">
                    <Monitor className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mb-2" />
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">TV READY</h4>
                  </div>
                ))}

              </div>
            </div>
          </div>
        </div>
      </Section>

      {selectedUnit && (() => {
        // Data terbaru unit yang dibuka (mis. sesudah "Ingatkan" dicatat)
        const sel: KartuUnit = activeRentals.find((r) => r.uid === selectedUnit.uid) || selectedUnit;
        const tarif = tarifTelatPerJam(sel.jenis);
        return (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedUnit(null)}></div>
          <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl rounded-[32px] p-6 max-w-sm w-full shadow-2xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/10 relative z-10 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-5"></div>
            <h3 className="text-xl font-black text-center text-zinc-900 dark:text-white mb-2">{sel.jenis}</h3>
            <p className="text-sm font-bold text-center text-blue-600 dark:text-blue-400 mb-1">{sel.namaPenyewa}</p>
            <p className={`text-[12px] font-mono font-bold text-center mb-1 ${sel.waPenyewa ? "text-zinc-700 dark:text-zinc-200" : "text-red-500"}`}>
              {sel.waPenyewa ? `WA ${formatWa(sel.waPenyewa)}` : "No. WA penyewa belum diisi"}
            </p>
            <p className="text-[11px] font-bold text-center text-zinc-500 dark:text-zinc-400 tracking-wide">
              ADMIN: {sel.addedBy ? sel.addedBy.split('@')[0].toUpperCase() : 'UNKNOWN'}
            </p>
            {sel.diantarOleh && (
              <p className="text-[11px] font-bold text-center text-purple-600 dark:text-purple-400 tracking-wide mt-1 mb-5">
                Diantar oleh: {sel.diantarOleh.split("@")[0]}
              </p>
            )}
            {!sel.diantarOleh && sel.isOngkir === "TIDAK" && (
              <p className="text-[12px] font-black text-center text-lime-700 dark:text-lime-400 tracking-wide mt-1 mb-5 bg-lime-100 dark:bg-lime-500/15 px-3 py-1 rounded-lg ring-1 ring-lime-300 dark:ring-lime-500/30">
                Diambil sendiri
              </p>
            )}
            {sel.isPaid === "TIDAK" && (
               <p className="text-[12px] font-black text-center text-red-700 dark:text-red-400 tracking-wide mt-1 mb-5 bg-red-100 dark:bg-red-500/15 px-3 py-1 rounded-lg ring-1 ring-red-300 dark:ring-red-500/30">
                 Belum dibayar {sel._nominalBelumBayar ? `(Rp ${formatK(sel._nominalBelumBayar)})` : ""}
               </p>
            )}
            {sel.isPaid === "YA" && (
               <p className="text-[12px] font-black text-center text-emerald-700 dark:text-emerald-400 tracking-wide mt-1 mb-5 bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1 rounded-lg ring-1 ring-emerald-300 dark:ring-emerald-500/30">
                 Sudah dibayar
               </p>
            )}
            {!sel.diantarOleh && sel.isOngkir !== "TIDAK" && <div className="mb-6" />}

            <div className="bg-zinc-100/50 dark:bg-black/20 rounded-[20px] p-4 mb-5">
              <p className="text-[13px] font-bold text-zinc-600 dark:text-zinc-300 text-center leading-relaxed">
                {teksPerkiraanKembali(sel.endMs)}
              </p>
              {sel.endMs && (
                <p className="text-[11.5px] font-semibold text-zinc-500 dark:text-zinc-400 text-center leading-snug mt-1.5">
                  Batas kembali {waktuRelatif(batasKembali(sel.endMs), now)}{tarif ? ` · telat Rp${formatK(tarif).replace("k", "rb")}/jam` : ""}
                </p>
              )}
            </div>

            {bisaIngatkan(sel) && !sel.isVerified && (
              <button
                type="button"
                onClick={() => kirimPengingat(sel)}
                className="w-full mb-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl py-3.5 transition-all outline-none focus:ring-4 focus:ring-emerald-500/20 active:scale-95 shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-[18px] h-[18px]" />Ingatkan via WA
              </button>
            )}
            {sel.diingatkan?.length > 0 && (
              <p className="text-[11.5px] font-semibold text-center text-emerald-600 dark:text-emerald-400 mb-2.5">{labelPengingat(sel.diingatkan)}</p>
            )}
            <button onClick={() => setSelectedUnit(null)} className={`w-full font-bold rounded-2xl py-3.5 transition-all outline-none active:scale-95 ${bisaIngatkan(sel) && !sel.isVerified ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100" : "bg-blue-600 hover:bg-blue-700 text-white focus:ring-4 focus:ring-blue-500/20 shadow-md shadow-blue-500/20"}`}>
              Tutup
            </button>
          </div>
        </div>
        );
      })()}

      <PeringatanSewaHabis items={perluKonfirmasi} userEmail={currentUserEmail} jeda={isVerifyingPayment} onVerify={verifikasi} onPengingat={onPengingat} />
    </>
  );
};

export default WidgetMonitoringStatus;
