import { runSalaryTransaction } from "../lib/salaryPersistence";
import React, { useState, useEffect } from "react";
import { lazy, Suspense } from "react";
import type { AbsenEvidence } from "./AbsenPopup";
const AbsenPopup = lazy(() => import("./AbsenPopup"));
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../lib/firebase";
import { getAbsenCycleInfo, normalizeBulanTahun } from "../lib/absenPeriod";
import { dariYmd, menitHariKerja, namaHari, toLocalYmd } from "../lib/dateLocal";
import { rupiah } from "../lib/format";
import { RotateCcw } from "lucide-react";
import { AlertDialog, Button } from "../ui";

// === KONSTANTA ABSENSI ===
// (Catatan: Konstanta di bawah sudah dipindah ke dinamis via absenConfig, kecuali yang tidak terkait denda keterlambatan per blok)


interface InputProps {
  tanggal: string;
  setTanggal: (v: string) => void;
  hari: string;
  setHari: (v: string) => void;
  shiftPegawai: string;
  setShiftPegawai: (v: string) => void;
  absenPagi: string;
  setAbsenPagi: (v: string) => void;
  absenSiang: string;
  setAbsenSiang: (v: string) => void;
  rukoBuka: string;
  rukoBukaDate?: string;
  setRukoBuka: (v: string, d?: string) => void;
  rukoTutup: string;
  rukoTutupDate?: string;
  setRukoTutup: (v: string, d?: string) => void;
  catatan: string;
  setCatatan: (v: string) => void;
  onCatatanFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onReset?: () => void;
  onResetRukoBuka?: () => void;
  onResetRukoTutup?: () => void;
  onResetAbsenPagi?: () => void;
  onResetAbsenSiang?: () => void;
  onAbsenSubmit?: () => void;
  isAbsenBlocked?: boolean;
  absenConfig?: { durasiWaktuPotongan: number; waktuToleransi: number; nominalDenda: number };
  isOwner?: boolean;
}

// --- ICONS (SF Symbols Style) ---
const Icons = {
  Calendar: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Sun: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>,
  SunCloud: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/></svg>,
  Store: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>,
  StoreOff: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>,
  Note: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>,
};

function getHariIndonesia(yyyyMmDd: string) {
  const d = dariYmd(yyyyMmDd);
  return d ? namaHari(d) : "";
}

/** Normalisasi "10.10" / "9:5" ke format HTML <input type="time"> ("HH:mm") agar validasi DOM tidak error. */
function toTimeInputValue(val: string) {
  const m = (val || "").trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

const Input: React.FC<InputProps> = ({
  tanggal,
  setTanggal,
  hari,
  setHari,
  shiftPegawai,
  setShiftPegawai,
  absenPagi,
  setAbsenPagi,
  absenSiang,
  setAbsenSiang,
  rukoBuka,
  rukoBukaDate,
  setRukoBuka,
  rukoTutup,
  rukoTutupDate,
  setRukoTutup,
  catatan,
  setCatatan,
  onCatatanFocus,
  onReset,
  onResetRukoBuka,
  onResetRukoTutup,
  onResetAbsenPagi,
  onResetAbsenSiang,
  onAbsenSubmit,
  isAbsenBlocked = false,
  absenConfig = { durasiWaktuPotongan: 15, waktuToleransi: 15, nominalDenda: 1500 },
  isOwner = false
}) => {
  const [resetTarget, setResetTarget] = useState<
    "all" | "absenPagi" | "absenSiang" | "rukoBuka" | "rukoTutup" | null
  >(null);
  const [popupAbsen, setPopupAbsen] = useState<"Masuk" | "Pulang" | null>(null);
  const [showAbsenBlockedAlert, setShowAbsenBlockedAlert] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  const currentHour = currentTime.getHours();

  const isSudahWaktuPulang = (() => {
    if (shiftPegawai === "Libur" || shiftPegawai === "") return false;
    if (shiftPegawai.includes("Pagi")) {
      return currentHour >= 19 || currentHour <= 3;
    } else {
      return currentHour >= 23 || currentHour < 6;
    }
  })();

  const handleTanggalChange = (value: string) => {
    setTanggal(value);
    setHari(getHariIndonesia(value));
  };

  const [isManualPagi, setIsManualPagi] = useState(false);
  const [isManualSiang, setIsManualSiang] = useState(false);

  const handleManualAbsenChange = async (jenisAbsen: "Masuk" | "Pulang", timeValue: string) => {
    if (!timeValue) return;

    let dateStr = "";
    if (tanggal) {
      const parts = tanggal.split("-");
      if (parts.length === 3) {
        dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    if (!dateStr) {
      const now = new Date();
      dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }
    const fullAbsenStr = `${timeValue} - ${dateStr}`;

    const rawEmail = auth.currentUser?.email;
    const currentUserEmail = rawEmail ? rawEmail.toLowerCase().trim() : "owner@gmail.com";

    if (jenisAbsen === "Masuk") {
      setAbsenPagi(fullAbsenStr);
      setRukoBuka(timeValue, tanggal);
      setIsManualPagi(false);
    } else {
      setAbsenSiang(fullAbsenStr);
      setRukoTutup(timeValue, tanggal);
      setIsManualSiang(false);
    }

    if (onAbsenSubmit) onAbsenSubmit();

    try {
      const dateOnly = new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 10);
      const safeTimeStr = timeValue.replace(/[^a-zA-Z0-9]/g, "_");
      const logData = {
        email: currentUserEmail,
        tanggal: tanggal,
        tanggalReal: dateOnly,
        shift: shiftPegawai || (jenisAbsen === "Masuk" ? "Shift Pagi" : "Shift Sore"),
        jenisAbsen: jenisAbsen,
        waktu: fullAbsenStr,
        photoUrl: "",
        _isEmergency: true,
        timestamp: new Date().toISOString(),
        _serverTs: serverTimestamp()
      };
      const logId = `${dateOnly}_${jenisAbsen}_manual_${safeTimeStr}_${currentUserEmail}`;
      await setDoc(doc(db, "log_absensi", logId), logData);
    } catch (e) {
      console.error("Gagal menyimpan emergency log_absensi", e);
    }
  };

  const handleLiburLog = async () => {
    const currentUserEmail = auth.currentUser?.email;
    if (!currentUserEmail) return;
    const emailTrimmed = currentUserEmail.toLowerCase().trim();
    try {
      const dateStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 10);
      const logData = {
         email: emailTrimmed,
         tanggal: tanggal,
         tanggalReal: dateStr,
         shift: "Libur",
         jenisAbsen: "Libur",
         waktu: "-",
         photoUrl: "",
         timestamp: new Date().toISOString(),
         _serverTs: serverTimestamp()
      };
      const logId = `${dateStr}_Libur_${emailTrimmed}`;
      await setDoc(doc(db, "log_absensi", logId), logData);
    } catch(e) {
      console.error("Gagal menyimpan log libur", e);
    }
  };

  const handlePotongGaji = async (waktuAbsen: string, fotoBase64: string, jenisAbsen: "Masuk" | "Pulang", evidence: AbsenEvidence[] = []): Promise<boolean> => {
    if (shiftPegawai === "Libur") return true;

    // Default the active email, with fallback check
    const currentUserEmail = auth.currentUser?.email;
    if (!currentUserEmail) {
       console.warn("User email belum tersedia, menggunakan mode lokal.");
       return true;
    }

    const emailTrimmed = currentUserEmail.toLowerCase().trim();

    try {
      // 1. Upload photo to Firebase Storage
      const dateStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 10);
      const safeTimeStr = waktuAbsen.replace(/[^a-zA-Z0-9]/g, "_");
      const imageRef = ref(storage, `absensi/${emailTrimmed}/${dateStr}_${jenisAbsen}_${safeTimeStr}.jpg`);
      await uploadString(imageRef, fotoBase64, 'data_url');
      const imageUrl = await getDownloadURL(imageRef);

      // 1.1. Upload evidence kebersihan (hanya Absen Pulang), paralel. Gagal satu = gagal semua.
      const evidenceUrls: { key: string; label: string; url: string }[] = await Promise.all(
        evidence.map(async (ev) => {
          const evRef = ref(storage, `absensi/${emailTrimmed}/${dateStr}_${jenisAbsen}_${safeTimeStr}_${ev.key}.jpg`);
          await uploadString(evRef, ev.foto, 'data_url');
          const url = await getDownloadURL(evRef);
          return { key: ev.key, label: ev.label, url };
        })
      );

      // 1.2. Hitung keterlambatan jika jenisAbsen === "Masuk"
      let lateMinutes = 0;
      let effectiveLate = 0;
      let blockDenda = 0;
      let denda = 0;
      const toleransi = absenConfig.waktuToleransi ?? 15;
      const durasiBlok = absenConfig.durasiWaktuPotongan ?? 15;
      const nominal = absenConfig.nominalDenda ?? 1500;

      if (jenisAbsen === "Masuk") {
        const timePart = waktuAbsen.split(" - ")[0]; // Extract HH:MM
        const [jam, menit] = timePart.split(":").map(Number);
        const waktuAbsenMinutes = (jam || 0) * 60 + (menit || 0);
        // Shift Pagi acuan 10:00 (600m), Shift Sore acuan 15:00 (900m)
        const shiftStartMinutes = shiftPegawai.toLowerCase().includes("sore") ? 15 * 60 : 10 * 60;

        lateMinutes = Math.max(0, waktuAbsenMinutes - shiftStartMinutes);

        if (lateMinutes > toleransi) {
           effectiveLate = lateMinutes - toleransi;
           blockDenda = Math.ceil(effectiveLate / durasiBlok);
           denda = blockDenda * nominal;
        }
      }

      // 1.5. Injeksi Data ke log_absensi (Rekam jejak semua absensi masuk & pulang)
      try {
        const logData = {
           email: emailTrimmed,
           tanggal: tanggal,
           tanggalReal: dateStr,
           shift: shiftPegawai,
           jenisAbsen: jenisAbsen,
           waktu: waktuAbsen,
           photoUrl: imageUrl,
            evidence: evidenceUrls,
           lateMinutes: lateMinutes,
           effectiveLate: effectiveLate,
           blockDenda: blockDenda,
           denda: denda,
           toleransi: toleransi,
           durasiWaktuPotongan: durasiBlok,
           nominalDenda: nominal,
           timestamp: new Date().toISOString(),
           _serverTs: serverTimestamp() // Server timestamp untuk konsistensi
        };
        const logId = `${dateStr}_${jenisAbsen}_${safeTimeStr}_${emailTrimmed}`;
        await setDoc(doc(db, "log_absensi", logId), logData);
      } catch(e) {
        console.error("Gagal menyimpan log_absensi", e);
        if (jenisAbsen === "Pulang" && evidenceUrls.length > 0) throw e; // evidence wajib tersinkron
      }

      // 2. Kalkulasi Denda Keterlambatan Absen Masuk & Injeksi ke gaji_pegawai
      if (jenisAbsen === "Masuk" && denda > 0) {
         const docRef = doc(db, "gaji_pegawai", emailTrimmed);


         const dateStrToday = toLocalYmd();
         const effectiveDate = tanggal || dateStrToday;
         const idempKey = `lateCheckin_${emailTrimmed}_${effectiveDate}_${shiftPegawai.replace(/\s+/g, '')}`;

         const newDenda = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
            nominal: denda,
            ket: `[Auto-Sistem] Telat absen masuk (${waktuAbsen.split(" - ")[0]}) - Telat ${lateMinutes}m (efektif ${effectiveLate}m). Shift: ${shiftPegawai}`,
            photoUrl: imageUrl,
            dateStr: new Date().toISOString(),
            _isAutoSistem: true,
            _idempKey: idempKey,
            _lateMinutes: lateMinutes,
            _effectiveLate: effectiveLate,
            _shift: shiftPegawai,
            _waktuAbsen: waktuAbsen
         };

         // Get employee cutoff
         let empCutoff = 1;
         try {
            const userSnap = await getDoc(doc(db, "users", emailTrimmed));
            if (userSnap.exists() && typeof userSnap.data()?.tanggalMulaiHitung === "number") {
               empCutoff = userSnap.data().tanggalMulaiHitung;
            }
         } catch (e) {
            console.warn("Gagal mengambil cutoff user:", e);
         }

         const cycle = getAbsenCycleInfo(effectiveDate, empCutoff);
         const currentBulanTahun = normalizeBulanTahun(cycle.bulanTahun);

         await runSalaryTransaction(db, async transaction => {
              const docSnap = await transaction.get(docRef);
              let basePokok = 0;
         if (docSnap.exists()) {
            const data = docSnap.data();
            let records = Array.isArray(data.records) ? data.records : [];

            // Check if already injected
            const alreadyInjected = records.some((r: any) => 
               r.gajiPengurangan?.some((pg: any) => pg._idempKey === idempKey)
            );
            if (alreadyInjected) {
               console.log("Denda telat sudah pernah masuk:", idempKey);
               return;
            }

            for (const r of records) {
               const v = Number(r.gajiPokok) || 0;
               if (v > 0) { basePokok = v; break; }
            }
            if (basePokok === 0) basePokok = Number(data.gajiPokok) || 1500000;

            const monthIndex = records.findIndex((r: any) => normalizeBulanTahun(r.bulanTahun) === currentBulanTahun);
            if (monthIndex >= 0) {
               const currentMonth = records[monthIndex];
               const gajiPengurangan = Array.isArray(currentMonth.gajiPengurangan) ? currentMonth.gajiPengurangan : [];
               records[monthIndex] = currentMonth.tutupBuku ? currentMonth : { ...currentMonth, gajiPengurangan: [...gajiPengurangan, newDenda] };
            } else {
               records = [{
                   id: `rec-${Date.now()}`,
                   bulanTahun: currentBulanTahun,
                   gajiPokok: basePokok,
                   gajiTambahan: [],
                   gajiPengurangan: [newDenda],
                   isAutoGenerated: true
               }, ...records];
            }
            transaction.set(docRef, { salaryRevision: (Number(docSnap.data()?.salaryRevision) || 0) + 1, records, gajiPokok: basePokok, lastUpdated: new Date().toISOString() }, { merge: true });
         } else {
            basePokok = 1500000;
            const newMonth = {
                id: `rec-${Date.now()}`,
                bulanTahun: currentBulanTahun,
                gajiPokok: basePokok,
                gajiTambahan: [],
                gajiPengurangan: [newDenda],
                isAutoGenerated: true
            };
            transaction.set(docRef, { salaryRevision: 1, records: [newMonth], gajiPokok: basePokok, lastUpdated: new Date().toISOString() }, { merge: true });
         }

              });
         alert(`🚨 PERINGATAN SISTEM\nAnda telat absen ${lateMinutes} menit (toleransi ${toleransi}m, efektif telat ${effectiveLate}m)!\nGaji Anda otomatis dipotong ${rupiah(denda)}`);
      }
      return true;

    } catch (err) {
      console.error("Gagal memproses backend absen:", err);
      alert("Terjadi kendala saat upload foto/denda. Silakan coba lagi.");
      return false;
    }
  };

  // --- STYLES ---
  const glassPanel =
    "rounded-card apple-card ring-1 ring-edge shadow-card p-1.5 sm:p-2";
  const tileBase =
    "group relative flex flex-col justify-center px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-tile apple-tile apple-tile-interactive";
  const focusRing =
    "focus-within:ring-2 focus-within:ring-tint/20 focus-within:bg-surface dark:focus-within:bg-surface-elevated/90 focus-within:border-tint/30";

  const labelStyle =
    "text-caption2 font-semibold uppercase tracking-wider text-label-3 mb-1.5 flex items-center gap-1.5";
  const inputStyle =
    "w-full bg-transparent p-0 text-[16px] sm:text-subhead font-medium text-label placeholder:text-label-3 outline-none border-none ring-0 appearance-none relative z-[1] min-h-[44px]";

  return (
    <div className={glassPanel}>
      <div className="flex flex-col gap-1.5">
        {/* --- SECTION 1: DATE & SHIFT --- */}
        <div
          className={`${tileBase} ${focusRing} flex flex-col md:flex-row items-center justify-between !py-3 sm:!py-3.5 gap-3 md:gap-4`}
        >
          <div className="flex flex-col w-full flex-1 md:pr-4">
            <label className={labelStyle}>
              <Icons.Calendar />
              <span>Tanggal Pembukuan</span>
            </label>
            <div className="flex items-center gap-2.5 sm:gap-3 mt-1.5">
              <input
                data-fieldid="tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => handleTanggalChange(e.target.value)}
                className={`${inputStyle} max-w-[160px] tracking-tight`}
              />
              {hari && (
                <div className="shrink-0 px-2.5 py-1 rounded-full bg-fill border border-sep text-caption2 font-bold tracking-wide text-label-2 uppercase">
                  {hari}
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:block w-px self-stretch bg-sep" />

          <div className="flex flex-col w-full flex-1 relative">
            <label className={labelStyle}>
              <Icons.Note />
              <span>Shift Apa?</span>
            </label>
            <div className="relative mt-1">
              <select
                value={shiftPegawai}
                onChange={(e) => {
                  setShiftPegawai(e.target.value);
                  if (e.target.value === "Libur") {
                    handleLiburLog();
                  }
                }}
                disabled={absenPagi !== "" || absenSiang !== ""}
                className="w-full bg-transparent border-none p-0 text-[16px] sm:text-subhead font-semibold text-label outline-none appearance-none cursor-pointer h-11 pb-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="" disabled hidden className="bg-surface text-label">
                  Pilih Shift
                </option>
                <option value="Shift Pagi" className="bg-surface text-label">
                  Shift Pagi (10:00 - 20:00)
                </option>
                <option value="Shift Sore" className="bg-surface text-label">
                  Shift Sore (15:00 - 24:00)
                </option>
                <option value="Libur" className="bg-surface text-label">
                  Libur
                </option>
              </select>
              <div
                className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 ${
                  absenPagi !== "" || absenSiang !== "" ? "text-label-3/50" : "text-label-3"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION 2: GRID TIME INPUTS (2 COLUMNS MOBILE + PC) --- */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* Absen Masuk */}
          <div className={`${tileBase} ${focusRing} overflow-hidden relative min-w-0`}>
            {onResetAbsenPagi && isOwner && absenPagi && (
              <button
                type="button"
                onClick={() => setResetTarget("absenPagi")}
                className="absolute top-2 right-2 flex hit-44 h-7 w-7 items-center justify-center text-label-3 hover:text-negative hover:bg-negative/10 rounded-full transition-colors z-10"
                title="Reset Absen Masuk"
                aria-label="Reset Absen Masuk"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <label className={labelStyle}>
              <Icons.Sun />
              <span>Absen Masuk</span>
            </label>
            {absenPagi ? (
              <div className="flex flex-col mt-2 mb-0.5">
                <span className="text-callout sm:text-headline font-bold tracking-tight text-positive tabular-nums">
                  {absenPagi}
                </span>
                <span className="text-caption2 text-label-3 font-medium leading-tight mt-0.5">
                  Sistem mendeteksi potong gaji jika telat
                </span>
              </div>
            ) : isManualPagi && isOwner ? (
              <div className="flex items-center gap-1.5 mt-2">
                <input
                  data-fieldid="manualAbsenPagi"
                  type="time"
                  defaultValue={toTimeInputValue(rukoBuka) || "10:00"}
                  onChange={(e) => handleManualAbsenChange("Masuk", e.target.value)}
                  className={`${inputStyle} flex-1 min-w-0 cursor-pointer`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsManualPagi(false)}
                  className="px-3 py-2 rounded-full bg-fill hover:brightness-95 text-label text-caption font-semibold shrink-0 transition-colors"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-2 w-full">
                <button
                  type="button"
                  onClick={() => {
                    if (isAbsenBlocked) {
                      setShowAbsenBlockedAlert(true);
                      return;
                    }
                    setPopupAbsen("Masuk");
                  }}
                  disabled={shiftPegawai === "Libur" || shiftPegawai === ""}
                  className="group relative flex items-center justify-center gap-1.5 w-full rounded-full transition duration-200 active:scale-[0.97] disabled:opacity-50 font-semibold select-none overflow-hidden px-3 py-2.5 min-h-[44px] text-footnote sm:text-subhead bg-action text-action-label hover:opacity-90 shadow-card disabled:bg-fill disabled:text-label-3"
                >
                  {shiftPegawai === "" ? (
                    <span className="relative z-0 opacity-75 truncate">Pilih Shift Dahulu</span>
                  ) : shiftPegawai === "Libur" ? (
                    <span className="relative z-0 truncate">Selamat Berlibur</span>
                  ) : (
                    <>
                      <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/15 dark:via-black/15 to-transparent z-10" />
                      <span className="relative z-0 truncate">Klik untuk Absen</span>
                    </>
                  )}
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setIsManualPagi(true)}
                    className="w-full py-2 px-3 rounded-full bg-negative text-white text-caption font-semibold flex items-center justify-center gap-1 hover:opacity-90 active:scale-[0.97] transition"
                    title="Emergency Absen (Set Jam Masuk Manual)"
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="truncate">Emergency Absen</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Absen Pulang */}
          <div className={`${tileBase} ${focusRing} overflow-hidden relative min-w-0`}>
            {onResetAbsenSiang && isOwner && absenSiang && (
              <button
                type="button"
                onClick={() => setResetTarget("absenSiang")}
                className="absolute top-2 right-2 flex hit-44 h-7 w-7 items-center justify-center text-label-3 hover:text-negative hover:bg-negative/10 rounded-full transition-colors z-10"
                title="Reset Absen Pulang"
                aria-label="Reset Absen Pulang"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <label className={labelStyle}>
              <Icons.SunCloud />
              <span>Absen Pulang</span>
            </label>
            {absenSiang ? (
              <div className="flex flex-col mt-2 mb-0.5">
                <span className="text-callout sm:text-headline font-bold tracking-tight text-positive tabular-nums">
                  {absenSiang}
                </span>
                <span className="text-caption2 text-label-3 font-medium leading-tight mt-0.5">
                  Sistem mendeteksi potong gaji jika telat
                </span>
              </div>
            ) : isManualSiang && isOwner ? (
              <div className="flex items-center gap-1.5 mt-2">
                <input
                  data-fieldid="manualAbsenSiang"
                  type="time"
                  defaultValue={toTimeInputValue(rukoTutup) || "20:00"}
                  onChange={(e) => handleManualAbsenChange("Pulang", e.target.value)}
                  className={`${inputStyle} flex-1 min-w-0 cursor-pointer`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsManualSiang(false)}
                  className="px-3 py-2 rounded-full bg-fill hover:brightness-95 text-label text-caption font-semibold shrink-0 transition-colors"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mt-2 w-full">
                <button
                  type="button"
                  onClick={() => setPopupAbsen("Pulang")}
                  disabled={shiftPegawai === "Libur" || shiftPegawai === "" || !isSudahWaktuPulang}
                  className="group relative flex items-center justify-center gap-1.5 w-full rounded-full transition duration-200 active:scale-[0.97] disabled:opacity-50 font-semibold select-none overflow-hidden px-3 py-2.5 min-h-[44px] text-footnote sm:text-subhead bg-action text-action-label hover:opacity-90 shadow-card disabled:bg-fill disabled:text-label-3"
                >
                  {shiftPegawai === "" ? (
                    <span className="relative z-0 opacity-75 truncate">Pilih Shift Dahulu</span>
                  ) : shiftPegawai === "Libur" ? (
                    <span className="relative z-0 truncate">Selamat Berlibur</span>
                  ) : !isSudahWaktuPulang ? (
                    <span className="relative z-0 opacity-75 truncate">Belum Waktu Pulang</span>
                  ) : (
                    <>
                      <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/15 dark:via-black/15 to-transparent z-10" />
                      <span className="relative z-0 truncate">Klik untuk Absen</span>
                    </>
                  )}
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setIsManualSiang(true)}
                    className="w-full py-2 px-3 rounded-full bg-negative text-white text-caption font-semibold flex items-center justify-center gap-1 hover:opacity-90 active:scale-[0.97] transition"
                    title="Emergency Absen (Set Jam Pulang Manual)"
                  >
                    <svg
                      className="w-3.5 h-3.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="truncate">Emergency Absen</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Ruko Buka */}
          <div className={`${tileBase} ${focusRing} relative min-w-0`}>
            {onResetRukoBuka && isOwner && rukoBuka && (
              <button
                type="button"
                onClick={() => setResetTarget("rukoBuka")}
                className="absolute top-2 right-2 flex hit-44 h-7 w-7 items-center justify-center text-label-3 hover:text-negative hover:bg-negative/10 rounded-full transition-colors z-10"
                title="Reset Ruko Buka"
                aria-label="Reset Ruko Buka"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <label className={labelStyle}>
              <Icons.Store />
              <span>Ruko Buka</span>
            </label>
            <div className="flex items-center gap-1.5 mt-1">
              <input
                data-fieldid="rukoBuka"
                type="time"
                value={toTimeInputValue(rukoBuka)}
                onChange={(e) => setRukoBuka(e.target.value)}
                readOnly={!isOwner}
                className={`${inputStyle} min-w-0 ${!isOwner ? "opacity-75 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
              />
              {rukoBukaDate && rukoBuka && (
                <span className="text-caption2 font-medium text-label-2 bg-fill border border-sep px-2.5 py-0.5 rounded-full shrink-0">
                  {rukoBukaDate}
                </span>
              )}
            </div>
          </div>

          {/* Ruko Tutup */}
          <div className={`${tileBase} ${focusRing} relative min-w-0`}>
            {onResetRukoTutup && isOwner && rukoTutup && (
              <button
                type="button"
                onClick={() => setResetTarget("rukoTutup")}
                className="absolute top-2 right-2 flex hit-44 h-7 w-7 items-center justify-center text-label-3 hover:text-negative hover:bg-negative/10 rounded-full transition-colors z-10"
                title="Reset Ruko Tutup"
                aria-label="Reset Ruko Tutup"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <label className={labelStyle}>
              <Icons.StoreOff />
              <span>Ruko Tutup</span>
            </label>
            <div className="flex items-center gap-1.5 mt-1">
              <input
                data-fieldid="rukoTutup"
                type="time"
                value={toTimeInputValue(rukoTutup)}
                onChange={(e) => setRukoTutup(e.target.value)}
                readOnly={!isOwner}
                className={`${inputStyle} min-w-0 ${!isOwner ? "opacity-75 cursor-not-allowed pointer-events-none" : "cursor-pointer"}`}
              />
              {rukoTutupDate && rukoTutup && (
                <span className="text-caption2 font-medium text-label-2 bg-fill border border-sep px-2.5 py-0.5 rounded-full shrink-0">
                  {rukoTutupDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* --- SECTION 3: NOTES --- */}
        <div className={`${tileBase} ${focusRing}`}>
          <label className={labelStyle}>
            <Icons.Note />
            <span>Catatan Tambahan</span>
          </label>
          <input
            data-fieldid="catatan"
            type="text"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            onFocus={onCatatanFocus}
            placeholder="Keterangan (misal: ada yang bon, kendala teknis, dll)"
            className={`${inputStyle} mt-1`}
          />
        </div>
      </div>

      {/* --- FOOTER: Reset Button (UDS SSOT) --- */}
      {onReset && isOwner && (
        <div className="flex items-center justify-start px-1 pt-2 pb-1">
          <Button
            variant="gray"
            size="md"
            icon={<RotateCcw />}
            onClick={() => setResetTarget("all")}
            title="Reset Semua Input"
          >
            Reset Input
          </Button>
        </div>
      )}

      <AlertDialog
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        zClassName="z-[700]"
        icon={<RotateCcw />}
        iconColor="red"
        title={
          resetTarget === "absenPagi"
            ? "Reset Absen Masuk?"
            : resetTarget === "absenSiang"
              ? "Reset Absen Pulang?"
              : resetTarget === "rukoBuka"
                ? "Reset Jam Ruko Buka?"
                : resetTarget === "rukoTutup"
                  ? "Reset Jam Ruko Tutup?"
                  : "Reset Semua Input?"
        }
        description={
          resetTarget === "absenPagi"
            ? "Data Absen Masuk & jam Ruko Buka hari ini akan dikosongkan dari catatan absensi. Tindakan ini tidak dapat dibatalkan."
            : resetTarget === "absenSiang"
              ? "Data Absen Pulang & jam Ruko Tutup hari ini akan dikosongkan dari catatan absensi. Tindakan ini tidak dapat dibatalkan."
              : resetTarget === "rukoBuka"
                ? "Jam Ruko Buka hari ini akan dikosongkan."
                : resetTarget === "rukoTutup"
                  ? "Jam Ruko Tutup hari ini akan dikosongkan."
                  : "Absen Pagi, Absen Siang, Ruko Buka, Ruko Tutup, dan Catatan akan dikosongkan. Tindakan ini tidak dapat dibatalkan."
        }
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setResetTarget(null) },
          {
            label: "Reset",
            role: "destructive",
            onClick: () => {
              const target = resetTarget;
              setResetTarget(null);
              if (target === "all") onReset?.();
              else if (target === "absenPagi") onResetAbsenPagi?.();
              else if (target === "absenSiang") onResetAbsenSiang?.();
              else if (target === "rukoBuka") onResetRukoBuka?.();
              else if (target === "rukoTutup") onResetRukoTutup?.();
            },
          },
        ]}
      />

      {/* Absen Popup (Realtime Location) */}
      {popupAbsen !== null && (
        <Suspense fallback={null}>
          <AbsenPopup
            isOpen={popupAbsen !== null}
            jenisAbsen={popupAbsen}
            onClose={() => setPopupAbsen(null)}
            shift={shiftPegawai}
            tanggal={tanggal}
        onSubmit={async (waktu, fotoBase64, _coord, evidence) => {
          const currentMode = popupAbsen;
          if (!currentMode) return;

          // 1. Eksekusi backend & upload foto (storage + log_absensi + denda)
          const ok = await handlePotongGaji(waktu, fotoBase64, currentMode, evidence);
          if (ok === false) return; // Jika gagal, popup tetap terbuka dan foto tidak hilang

          if (onAbsenSubmit) onAbsenSubmit(); // Clear suppress flag — admin aktif absen

          // Urutan jam dalam satu hari kerja (00:xx dini hari lebih malam dari 23:xx; "10.30" = "10:30")
          const toMinutes = menitHariKerja;

          const convertToYmd = (dStr: string) => {
            const [d, m, y] = dStr.split("-");
            return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
          };

          if (currentMode === "Masuk") {
            setAbsenPagi(waktu);
            // Auto-fill Ruko Buka: selalu isi saat Masuk (ambil yang paling awal)
            const timeOnly = waktu.split(" - ")[0];
            const dateOnly = waktu.split(" - ")[1]?.replace(/\//g, "-");
            if (!rukoBuka || toMinutes(timeOnly) < toMinutes(rukoBuka)) {
              setRukoBuka(timeOnly, convertToYmd(dateOnly));
            }
          } else if (currentMode === "Pulang") {
            setAbsenSiang(waktu);
            // Auto-fill Ruko Tutup: ambil yang paling akhir (date-aware)
            // SSOT: bandingkan tanggal aktual + waktu, bukan hanya waktu saja.
            // Ini mencegah waktu 00:00 (tanggal beda) menimpa 20:25 (tanggal pembukuan).
            const timeOnly = waktu.split(" - ")[0];
            const dateOnly = waktu.split(" - ")[1]?.replace(/\//g, "-");
            const newDateYmd = dateOnly ? convertToYmd(dateOnly) : "";

            // Bandingkan dengan tanggal+waktu existing
            const existingDateYmd = rukoTutupDate || tanggal; // fallback ke tanggal pembukuan

            if (!rukoTutup) {
              // Belum ada ruko tutup → langsung set
              setRukoTutup(timeOnly, newDateYmd);
            } else if (newDateYmd > existingDateYmd) {
              // Tanggal aktual lebih baru → pasti lebih larut (cross-midnight)
              setRukoTutup(timeOnly, newDateYmd);
            } else if (newDateYmd === existingDateYmd && toMinutes(timeOnly) > toMinutes(rukoTutup)) {
              // Tanggal sama → bandingkan waktu (ambil yang lebih malam)
              setRukoTutup(timeOnly, newDateYmd);
            }
            // else: waktu baru lebih awal dari yang existing → abaikan
          }

          // 2. Tutup popup hanya setelah backend dan local state sukses tersimpan
          setPopupAbsen(null);
        }}
          />
        </Suspense>
      )}

      <AlertDialog
        open={showAbsenBlockedAlert}
        onClose={() => setShowAbsenBlockedAlert(false)}
        zClassName="z-[300]"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
        iconColor="yellow"
        title="Absen Belum Tersedia"
        description={
          <div className="space-y-1.5">
            <p>
              Data hari sebelumnya sudah tersimpan. Absen untuk hari baru akan tersedia mulai jam{" "}
              <strong className="font-semibold text-label">09:45 WIB</strong>.
            </p>
            <p className="text-caption2 text-label-3">
              Ini untuk mencegah data absen tercampur antar hari kerja.
            </p>
          </div>
        }
        actions={[
          { label: "Oke, Mengerti", role: "primary", onClick: () => setShowAbsenBlockedAlert(false) },
        ]}
      />
    </div>
  );
};

export default Input;