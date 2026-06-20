import React, { useMemo, useState, useEffect } from "react";
import { AlertCircle, Clock, Monitor, Gamepad2, Smartphone, ShieldCheck, Settings2 } from "lucide-react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { HistoryItem, RowSewa } from "../lib/types";
import Section from "./common/Section";

type WidgetMonitoringStatusProps = {
  history: HistoryItem[];
  rowsSewa: RowSewa[];
  activeDate?: string;
  onVerifyActiveRental?: (item: any) => void;
  isOwner?: boolean;
  hargaItems?: any[];
  isVerifyingPayment?: boolean;
};

const WidgetMonitoringStatus: React.FC<WidgetMonitoringStatusProps> = ({
  history,
  rowsSewa,
  activeDate,
  onVerifyActiveRental,
  isOwner = false,
  hargaItems,
  isVerifyingPayment = false,
}) => {
  const [masterUnit, setMasterUnit] = useState({ ps3: 0, ps4: 0, tv: 0, portabel: 0 });
  const [tempPs3, setTempPs3] = useState("0");
  const [tempPs4, setTempPs4] = useState("0");
  const [tempTv, setTempTv] = useState("0");
  const [tempPortabel, setTempPortabel] = useState("0");
  const [isEditingMaster, setIsEditingMaster] = useState(false);

  const [now, setNow] = useState(Date.now());
  const notifiedRefs = React.useRef<Set<number>>(new Set());
  const [selectedUnit, setSelectedUnit] = useState<any | null>(null);

  // Sync auth state
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setCurrentUserEmail(u?.email || null);
    });
    return () => unsub();
  }, []);

  const [masterUnitLoaded, setMasterUnitLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "master_unit"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMasterUnit({ ps3: data.ps3 || 0, ps4: data.ps4 || 0, tv: data.tv || 0, portabel: data.portabel || 0 });
        setTempPs3(String(data.ps3 || 0));
        setTempPs4(String(data.ps4 || 0));
        setTempTv(String(data.tv || 0));
        setTempPortabel(String(data.portabel || 0));
        setMasterUnitLoaded(true);
      } else if (!masterUnitLoaded) {
        // Only init if we've NEVER successfully loaded data before
        // This prevents race conditions from overwriting real data
        console.warn("[MonitoringStatus] master_unit doc does not exist yet.");
      }
    });
    return () => unsub();
  }, [masterUnitLoaded]);

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
    const tv = parseInt(tempTv) || 0;
    const portabel = parseInt(tempPortabel) || 0;
    setDoc(doc(db, "data", "master_unit"), { ps3, ps4, tv, portabel }, { merge: true });
    setIsEditingMaster(false);
  };

  const { activeRentals, rentedPS3, rentedPS4, rentedPortabel, rentedTV, readyPS3, readyPS4, readyPortabel, readyTV } = useMemo(() => {
    let rPS3 = 0;
    let rPS4 = 0;
    let rPortabel = 0;
    let rTV = 0;
    const rentals: any[] = [];
    const timeNow = new Date(now);

    const allRowsMap = new Map<string, any>();

    if (history && history.length > 0) {
      history.forEach(h => {
        const hd = new Date(h.tanggal);
        const diffDays = (timeNow.getTime() - hd.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 31) return;

        if (h.rowsSewa && h.rowsSewa.length > 0) {
          h.rowsSewa.forEach((r: any) => {
            if (r.lamaSewa === "PELUNASAN") return;
            const price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
            if ((price > 0 || r.isPaid === "TIDAK") && r.jenisPS && r.jamMasukSewa && r.lamaSewa) {
              const key = `${String(r.jenisPS).trim()}-${String(r.jamMasukSewa).trim()}-${String(r.ket || "").trim()}-${h.tanggal}`;
              allRowsMap.set(key, { ...r, _tanggal: h.tanggal, _historyId: h.id });
            }
          });
        }
      });
    }

    rowsSewa.forEach((r: any, idx) => {
      if (r.lamaSewa === "PELUNASAN") return;
      const price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
      if ((price > 0 || r.isPaid === "TIDAK") && r.jenisPS && r.jamMasukSewa && r.lamaSewa) {
        const tgl = activeDate || timeNow.toISOString().slice(0, 10);
        const key = `${String(r.jenisPS).trim()}-${String(r.jamMasukSewa).trim()}-${String(r.ket || "").trim()}-${tgl}`;
        allRowsMap.set(key, { ...r, _tanggal: tgl, _isActiveSession: true, _sourceIdx: idx });
      }
    });

    const allRowsArr = Array.from(allRowsMap.values());

    allRowsArr.forEach((r, idx) => {
      const price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
      if ((price > 0 || r.isPaid === "TIDAK") && r.jenisPS && r.jamMasukSewa && r.lamaSewa) {
        const isCustom = r.lamaSewa === "Isi Sendiri";
        let durationHours = 0;
        if (isCustom) {
          durationHours = parseFloat(String((r as any)._customDurasi)) || 0;
        } else {
          const matchJam = String(r.lamaSewa).match(/(\d+)\s*JAM/i);
          durationHours = matchJam ? parseInt(matchJam[1]) : 0;
          if (!durationHours) {
            const matchHari = String(r.lamaSewa).match(/(\d+)\s*HARI/i);
            if (matchHari) {
              durationHours = parseInt(matchHari[1]) * 24;
            } else if (String(r.lamaSewa).match(/HARI|SEHARI|SEMALAM/i)) {
              durationHours = 24;
            }
          }
        }

        let endTimeStr = "-";
        let isDone = false;
        let progress = 0;
        let endD: Date | null = null;

        if (durationHours > 0) {
          const [hStr, mStr] = r.jamMasukSewa.split(":");
          const jamNum = parseInt(hStr || "0");
          const mntNum = parseInt(mStr || "0");

          let baseDateStr = (r as any)._tanggal || activeDate;
          let startD: Date;

          if (baseDateStr) {
            const parts = baseDateStr.split("-");
            startD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), jamNum, mntNum, 0, 0);
          } else {
            startD = new Date(timeNow);
            startD.setHours(jamNum, mntNum, 0, 0);
            if (startD.getTime() > timeNow.getTime() + 12 * 3600000) {
              startD.setDate(startD.getDate() - 1);
            }
          }

          endD = new Date(startD.getTime() + durationHours * 3600000);

          const isToday = endD.getDate() === timeNow.getDate() && endD.getMonth() === timeNow.getMonth() && endD.getFullYear() === timeNow.getFullYear();

          const endH = String(endD.getHours()).padStart(2, '0');
          const endM = String(endD.getMinutes()).padStart(2, '0');

          if (isToday) {
            endTimeStr = `${endH}:${endM}`;
          } else {
            const dd = String(endD.getDate()).padStart(2, '0');
            const mm = String(endD.getMonth() + 1).padStart(2, '0');
            endTimeStr = `${dd}/${mm} ${endH}:${endM}`;
          }

          isDone = endD ? timeNow >= endD : false;
          if (!isDone && endD && timeNow >= startD) {
            progress = ((timeNow.getTime() - startD.getTime()) / (durationHours * 3600000)) * 100;
          } else if (isDone) {
            progress = 100;
          }
        }

        if (!isDone || !(r as any)._verifiedReturn) {
          if (isDone && endD) {
            const diffEndDays = (timeNow.getTime() - endD.getTime()) / (1000 * 3600 * 24);
            if (diffEndDays > 2) return;
          }

          const s = String(r.jenisPS).toLowerCase();

          const hasTV = s.includes("tv");
          const hasPortabel = s.includes("portabel") || s.includes("portable") || s.includes("switch") || s.includes("rog") || s.includes("steam");
          const hasPS3 = s.includes("ps3") || s.includes("ps 3");
          const hasPS4 = s.includes("ps4") || s.includes("ps 4") || s.includes("pro") || s.includes("fat") || s.includes("slim") || s.includes("ps5") || s.includes("ps 5");

          const hasGenericPS = s.includes("ps") && !hasPS3 && !hasPS4;
          const isOnlyTV = (s === "tv" || s === "hanya tv" || s === "tv only") || (hasTV && !hasPortabel && !s.includes("ps"));

          if (hasTV) rTV++;
          if (hasPortabel) rPortabel++;

          if (hasPS3) rPS3++;
          if (hasPS4) rPS4++;

          if (hasGenericPS && !isOnlyTV) {
            rPS3++;
          }
          let nominalBelumBayar = 0;
          if ((r as any).isPaid === "TIDAK") {
              const isCustom = r.lamaSewa === "Isi Sendiri";
              if (isCustom) {
                  nominalBelumBayar = parseInt(String((r as any)._customBase).replace(/\D/g, "")) || 0;
              } else if (hargaItems) {
                  const targetStr = `${r.jenisPS} - ${r.lamaSewa}`;
                  const found = hargaItems.find((h: any) => h.nama === targetStr);
                  nominalBelumBayar = found ? found.harga : 0;
              }
              if ((r as any).isOngkir === "YA") {
                  nominalBelumBayar += parseInt(String((r as any)._ongkir).replace(/\D/g, "")) || 0;
              }
          }

          rentals.push({
            id: idx + 1,
            jenis: r.jenisPS,
            isTv: hasTV,
            start: r.jamMasukSewa,
            end: endTimeStr,
            endMs: endD ? endD.getTime() : null,
            progress: Math.min(100, Math.max(0, progress)),
            namaPenyewa: (r as any).ket || "Tanpa Nama",
            isDone,
            isVerified: !!(r as any)._verifiedReturn,
            addedBy: (r as any)._addedBy,
            _historyId: (r as any)._historyId,
            _isActiveSession: (r as any)._isActiveSession,
            _sourceIdx: (r as any)._sourceIdx,
            diantarOleh: (r as any).diantarOleh || "",
            isOngkir: (r as any).isOngkir || "",
            isPaid: (r as any).isPaid || "",
            _nominalBelumBayar: nominalBelumBayar,
            _rawRow: r
          });
        }
      }
    });

    return {
      activeRentals: rentals,
      rentedPS3: rPS3,
      rentedPS4: rPS4,
      rentedPortabel: rPortabel,
      rentedTV: rTV,
      readyPS3: Math.max(0, masterUnit.ps3 - rPS3),
      readyPS4: Math.max(0, masterUnit.ps4 - rPS4),
      readyPortabel: Math.max(0, masterUnit.portabel - rPortabel),
      readyTV: Math.max(0, masterUnit.tv - rTV)
    };
  }, [rowsSewa, history, activeDate, now, masterUnit]);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted" || !currentUserEmail) return;

    activeRentals.forEach(r => {
      if (r.isDone && !r.isVerified && r.addedBy === currentUserEmail && !notifiedRefs.current.has(r.id)) {
        try {
          new Notification(`Waktu Sewa Habis!`, {
            body: `BILING ${r.id}: PS ${r.jenis} a.n ${r.namaPenyewa} telah habis durasinya. Mohon konfirmasi pengembalian.`,
            icon: "/favicon.ico"
          });
        } catch (e) { }
        notifiedRefs.current.add(r.id);
      }
    });
  }, [activeRentals, currentUserEmail]);

  const [unverifiedAdminRentals, setUnverifiedAdminRentals] = useState<any[]>([]);

  useEffect(() => {
    if (!currentUserEmail) return;
    const unverified = activeRentals.filter(r => r.isDone && !r.isVerified && r.addedBy === currentUserEmail);
    setUnverifiedAdminRentals(unverified);
  }, [activeRentals, currentUserEmail]);

  const handleVerifyPopupReturn = async (ru: any) => {
    if (onVerifyActiveRental) {
      if (ru._isActiveSession && typeof ru._sourceIdx === "number") {
        onVerifyActiveRental({
          isLive: true,
          sourceIdx: ru._sourceIdx,
          jenis: ru.jenis,
          namaPenyewa: ru.namaPenyewa,
          start: ru.start,
          isPaid: ru.isPaid,
          _rawRow: ru._rawRow
        });
      } else if (ru._historyId) {
        onVerifyActiveRental({
          isLive: false,
          historyId: ru._historyId,
          jenis: ru.jenis,
          namaPenyewa: ru.namaPenyewa,
          start: ru.start,
          isPaid: ru.isPaid,
          _rawRow: ru._rawRow
        });
      }
    }
  };

  const getHumanizedTime = (endMs: number | null) => {
    if (!endMs) return "Waktu estimasi tidak spesifik.";
    const nowD = new Date(now);
    const end = new Date(endMs);

    if (nowD >= end) return "Waktu biling sudah habis, unit seharusnya sudah kembali.";

    const startOfToday = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate());
    const startOfEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    const diffD = Math.round((startOfEnd.getTime() - startOfToday.getTime()) / (24 * 3600 * 1000));

    let dayStr = "";
    if (diffD === 0) {
      const h = end.getHours();
      if (h >= 18 || h < 4) dayStr = "malam ini";
      else if (h >= 15) dayStr = "sore ini";
      else if (h >= 10) dayStr = "siang ini";
      else dayStr = "pagi ini";
    } else if (diffD === 1) {
      const h = end.getHours();
      if (h >= 18 || h < 4) dayStr = "besok malam";
      else if (h >= 15) dayStr = "besok sore";
      else if (h >= 10) dayStr = "besok siang";
      else dayStr = "besok pagi";
    } else {
      const hariNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      dayStr = `${diffD} hari lagi, hari ${hariNames[end.getDay()]}`;
    }

    const jam = String(end.getHours()).padStart(2, '0');
    const mnt = String(end.getMinutes()).padStart(2, '0');
    return `Unit diperkirakan kembali pada ${dayStr}, pukul ${jam}:${mnt}.`;
  };

  return (
    <>
      <Section title="Monitoring Status Unit">
        <div className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-white/10 rounded-2xl md:rounded-[32px] p-4 sm:p-6 lg:p-8 flex flex-col gap-8 w-full overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-black/20">

          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 dark:bg-blue-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 dark:bg-purple-500/5 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 z-10 w-full">
            <div className="lg:w-1/3 flex flex-col gap-4">
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

                <div className="flex gap-2 sm:gap-4">
                  <div className="flex flex-col gap-1.5 flex-1 w-1/4">
                    <label className="text-[10px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-widest text-center truncate">PS3</label>
                    {isEditingMaster && isOwner ? (
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tempPs3} onChange={e => setTempPs3(e.target.value)} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1.5 py-2 text-zinc-900 dark:text-white font-mono font-bold text-base sm:text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : (
                      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1.5 py-2 text-zinc-900 dark:text-white font-mono font-black text-base sm:text-lg shadow-sm flex items-center justify-center gap-1.5">
                        <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" /> {masterUnit.ps3}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 w-1/4">
                    <label className="text-[10px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-widest text-center truncate">PS4</label>
                    {isEditingMaster && isOwner ? (
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tempPs4} onChange={e => setTempPs4(e.target.value)} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1.5 py-2 text-zinc-900 dark:text-white font-mono font-bold text-base sm:text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : (
                      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1.5 py-2 text-zinc-900 dark:text-white font-mono font-black text-base sm:text-lg shadow-sm flex items-center justify-center gap-1.5">
                        <Gamepad2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" /> {masterUnit.ps4}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 w-1/4">
                    <label className="text-[10px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-widest text-center truncate">PTB</label>
                    {isEditingMaster && isOwner ? (
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tempPortabel} onChange={e => setTempPortabel(e.target.value)} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1.5 py-2 text-zinc-900 dark:text-white font-mono font-bold text-base sm:text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : (
                      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1.5 py-2 text-zinc-900 dark:text-white font-mono font-black text-base sm:text-lg shadow-sm flex items-center justify-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" /> {masterUnit.portabel}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1 w-1/4">
                    <label className="text-[10px] sm:text-[11px] font-bold text-zinc-500 uppercase tracking-widest text-center truncate">TV</label>
                    {isEditingMaster && isOwner ? (
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tempTv} onChange={e => setTempTv(e.target.value)} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1.5 py-2 text-zinc-900 dark:text-white font-mono font-bold text-base sm:text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    ) : (
                      <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-1.5 py-2 text-zinc-900 dark:text-white font-mono font-black text-base sm:text-lg shadow-sm flex items-center justify-center gap-1.5">
                        <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" /> {masterUnit.tv}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 min-[400px]:grid-cols-4 gap-2 mt-1 w-full">
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2 sm:p-3 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase text-center leading-tight">PS3 Ready</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{readyPS3}</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2 sm:p-3 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase text-center leading-tight">PS4 Ready</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{readyPS4}</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2 sm:p-3 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase text-center leading-tight">PTB Ready</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{readyPortabel}</span>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-2 sm:p-3 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-emerald-600 dark:text-emerald-400 uppercase text-center leading-tight">TV Ready</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{readyTV}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2 sm:p-3 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-red-600 dark:text-red-400 uppercase text-center leading-tight whitespace-nowrap">PS3 Jalan</span>
                  <span className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">{rentedPS3}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2 sm:p-3 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-red-600 dark:text-red-400 uppercase text-center leading-tight whitespace-nowrap">PS4 Jalan</span>
                  <span className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">{rentedPS4}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2 sm:p-3 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-red-600 dark:text-red-400 uppercase text-center leading-tight whitespace-nowrap">PTB Jalan</span>
                  <span className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">{rentedPortabel}</span>
                </div>
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-2 sm:p-3 rounded-[16px] flex flex-col justify-center items-center gap-1">
                  <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-red-600 dark:text-red-400 uppercase text-center leading-tight whitespace-nowrap">TV Jalan</span>
                  <span className="text-xl sm:text-2xl font-black text-red-600 dark:text-red-400">{rentedTV}</span>
                </div>
              </div>
            </div>

            <div className="lg:w-2/3 bg-zinc-50 dark:bg-[#1C1C1E] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-inner w-full">
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
                className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar w-full items-start max-h-[600px]"
              >
                {activeRentals.map(u => {
                  const adminName = u.addedBy ? u.addedBy.split('@')[0].toUpperCase() : 'ADMIN';
                  return (
                    <div
                      key={u.id}
                      onClick={() => setSelectedUnit(u)}
                      className={`relative bg-white dark:bg-black border rounded-[18px] p-3 shadow-md overflow-hidden flex flex-col min-w-[140px] max-w-full group cursor-pointer hover:-translate-y-1 hover:shadow-lg transition-all duration-300 ${u.isDone && !u.isVerified ? "border-amber-400 dark:border-amber-500/50 hover:shadow-amber-500/20" : "border-red-200 dark:border-red-500/30 hover:shadow-red-500/20"}`}
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

                        <div className="bg-zinc-100 dark:bg-zinc-800/50 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5">
                          <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400">BY: {adminName}</span>
                        </div>
                        {u.diantarOleh && (
                          <div className="bg-purple-100 dark:bg-purple-500/10 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5">
                            <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400">Diantar oleh : {u.diantarOleh.split("@")[0]}</span>
                          </div>
                        )}
                        {!u.diantarOleh && (u as any).isOngkir === "TIDAK" && (
                          <div className="bg-lime-100 dark:bg-lime-500/15 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5 ring-1 ring-lime-300 dark:ring-lime-500/30">
                            <span className="text-[9px] font-black text-lime-700 dark:text-lime-400">Diambil sendiri</span>
                          </div>
                        )}
                        {(u as any).isPaid === "TIDAK" && (
                          <div className="bg-red-100 dark:bg-red-500/15 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5 ring-1 ring-red-300 dark:ring-red-500/30">
                            <span className="text-[9px] font-black text-red-700 dark:text-red-400">Belum dibayar {(u as any)._nominalBelumBayar ? `(Rp ${(u as any)._nominalBelumBayar / 1000}k)` : ''}</span>
                          </div>
                        )}
                        {(u as any).isPaid === "YA" && (
                          <div className="bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded flex items-center justify-center gap-1 mt-0.5 ring-1 ring-emerald-300 dark:ring-emerald-500/30">
                            <span className="text-[9px] font-black text-emerald-700 dark:text-emerald-400">Sudah dibayar</span>
                          </div>
                        )}

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
                  )
                })}

                {Array.from({ length: readyPS3 }).map((_, i) => (
                  <div key={`ready3-${i}`} className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[18px] p-3 shadow-sm flex flex-col justify-center items-center min-w-[140px] max-w-full opacity-80 hover:opacity-100 transition-opacity min-h-[110px]">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mb-2" />
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">PS3 READY</h4>
                  </div>
                ))}
                {Array.from({ length: readyPS4 }).map((_, i) => (
                  <div key={`ready4-${i}`} className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[18px] p-3 shadow-sm flex flex-col justify-center items-center min-w-[140px] max-w-full opacity-80 hover:opacity-100 transition-opacity min-h-[110px]">
                    <ShieldCheck className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mb-2" />
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">PS4 READY</h4>
                  </div>
                ))}
                {Array.from({ length: readyPortabel }).map((_, i) => (
                  <div key={`readyptb-${i}`} className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[18px] p-3 shadow-sm flex flex-col justify-center items-center min-w-[140px] max-w-full opacity-80 hover:opacity-100 transition-opacity min-h-[110px]">
                    <Smartphone className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mb-2" />
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">PORTABEL READY</h4>
                  </div>
                ))}
                {Array.from({ length: readyTV }).map((_, i) => (
                  <div key={`readytv-${i}`} className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-[18px] p-3 shadow-sm flex flex-col justify-center items-center min-w-[140px] max-w-full opacity-80 hover:opacity-100 transition-opacity min-h-[110px]">
                    <Monitor className="w-8 h-8 text-emerald-400 dark:text-emerald-500 mb-2" />
                    <h4 className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest text-center">TV READY</h4>
                  </div>
                ))}

              </div>
            </div>
          </div>
        </div>
      </Section>

      {selectedUnit && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedUnit(null)}></div>
          <div className="bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-2xl rounded-[32px] p-6 max-w-sm w-full shadow-2xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/10 relative z-10 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-5"></div>
            <h3 className="text-xl font-black text-center text-zinc-900 dark:text-white mb-2">{selectedUnit.jenis}</h3>
            <p className="text-sm font-bold text-center text-blue-600 dark:text-blue-400 mb-1">{selectedUnit.namaPenyewa}</p>
            <p className="text-[11px] font-bold text-center text-zinc-500 dark:text-zinc-400 tracking-wide">
              ADMIN: {selectedUnit.addedBy ? selectedUnit.addedBy.split('@')[0].toUpperCase() : 'UNKNOWN'}
            </p>
            {selectedUnit.diantarOleh && (
              <p className="text-[11px] font-bold text-center text-purple-600 dark:text-purple-400 tracking-wide mt-1 mb-5">
                Diantar oleh: {selectedUnit.diantarOleh.split("@")[0]}
              </p>
            )}
            {!selectedUnit.diantarOleh && (selectedUnit as any).isOngkir === "TIDAK" && (
              <p className="text-[12px] font-black text-center text-lime-700 dark:text-lime-400 tracking-wide mt-1 mb-5 bg-lime-100 dark:bg-lime-500/15 px-3 py-1 rounded-lg ring-1 ring-lime-300 dark:ring-lime-500/30">
                Diambil sendiri
              </p>
            )}
            {(selectedUnit as any).isPaid === "TIDAK" && (
               <p className="text-[12px] font-black text-center text-red-700 dark:text-red-400 tracking-wide mt-1 mb-5 bg-red-100 dark:bg-red-500/15 px-3 py-1 rounded-lg ring-1 ring-red-300 dark:ring-red-500/30">
                 Belum dibayar {(selectedUnit as any)._nominalBelumBayar ? `(Rp ${(selectedUnit as any)._nominalBelumBayar / 1000}k)` : ''}
               </p>
            )}
            {(selectedUnit as any).isPaid === "YA" && (
               <p className="text-[12px] font-black text-center text-emerald-700 dark:text-emerald-400 tracking-wide mt-1 mb-5 bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1 rounded-lg ring-1 ring-emerald-300 dark:ring-emerald-500/30">
                 Sudah dibayar
               </p>
            )}
            {!selectedUnit.diantarOleh && (selectedUnit as any).isOngkir !== "TIDAK" && <div className="mb-6" />}

            <div className="bg-zinc-100/50 dark:bg-black/20 rounded-[20px] p-4 mb-6">
              <p className="text-[13px] font-bold text-zinc-600 dark:text-zinc-300 text-center leading-relaxed">
                {getHumanizedTime(selectedUnit.endMs)}
              </p>
            </div>

            <button onClick={() => setSelectedUnit(null)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl py-3.5 transition-all outline-none focus:ring-4 focus:ring-blue-500/20 active:scale-95 shadow-md shadow-blue-500/20">
              Tutup
            </button>
          </div>
        </div>
      )}

      {unverifiedAdminRentals.length > 0 && !isVerifyingPayment && (
        <div className="fixed inset-0 z-[800] flex items-center justify-center p-6 font-sans">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px] pointer-events-auto" />
          <div className="relative w-full max-w-[320px] overflow-hidden rounded-[24px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-90 duration-300">
            <div className="p-6 text-center flex flex-col items-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 ring-4 ring-red-500/10">
                <AlertCircle className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-[19px] font-black text-zinc-900 dark:text-white mb-2 leading-tight tracking-tight">Waktu Sewa Habis!</h3>
              {unverifiedAdminRentals.length > 0 && (() => {
                const profileName = (currentUserEmail || "").split("@")[0];
                const capitalizedName = profileName ? profileName.charAt(0).toUpperCase() + profileName.slice(1) : "Admin";
                return (
                  <>
                    <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400 mb-4">
                      Unit <strong className="text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{unverifiedAdminRentals[0]?.jenis}</strong> atas nama <strong className="text-blue-600 dark:text-blue-400">{unverifiedAdminRentals[0]?.namaPenyewa}</strong> telah selesai durasi sewanya.
                    </p>
                    <p className="text-[16px] font-bold text-zinc-900 dark:text-white mb-4 leading-tight tracking-tight">Apakah sewa sudah habis atau belum, {capitalizedName}?</p>
                  </>
                );
              })()}
            </div>
            <div className="flex flex-col border-t border-gray-200/50 dark:border-white/10">
              <button
                onClick={() => handleVerifyPopupReturn(unverifiedAdminRentals[0])}
                className="w-full py-4 text-[15px] shadow-inner font-black text-blue-600 dark:text-blue-500 bg-white/50 dark:bg-black/20 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors active:bg-blue-100 dark:active:bg-blue-500/20"
              >
                YA, SUDAH HABIS & KEMBALI
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WidgetMonitoringStatus;
