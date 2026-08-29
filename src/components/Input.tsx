import React, { useState, useEffect } from "react";
import AbsenPopup from "./AbsenPopup";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "../lib/firebase";
import { atomicAddDenda, normalizeEmail } from "../lib/salaryService";

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
  if (!yyyyMmDd) return "";
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  const hari = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(d);
  return hari.charAt(0).toUpperCase() + hari.slice(1);
}

const convertToYmd = (dateStr: string) => {
  if (!dateStr) return "";
  const clean = dateStr.replace(/\//g, "-");
  const parts = clean.split("-");
  if (parts.length === 3) {
    if (parts[0].length === 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return clean;
};

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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [popupAbsen, setPopupAbsen] = useState<"Masuk" | "Pulang" | null>(null);
  const [showAbsenBlockedAlert, setShowAbsenBlockedAlert] = useState(false);
  const [isProcessingAbsen, setIsProcessingAbsen] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000 * 30);
    return () => clearInterval(timer);
  }, []);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  const isSudahWaktuPulang = (() => {
    if (shiftPegawai === "Libur" || shiftPegawai === "") return false;
    if (shiftPegawai.includes("Pagi")) {
      return currentHour >= 20 || currentHour <= 3;
    } else {
      if (currentHour === 23 && currentMinute >= 59) return true;
      if (currentHour < 6) return true;
      return false;
    }
  })();

  const handleTanggalChange = (value: string) => {
    setTanggal(value);
    setHari(getHariIndonesia(value));
  };

  // Auto-fill rukoBuka dan rukoTutup jika belum terisi tapi sudah absen masuk/pulang
  useEffect(() => {
    if (absenPagi && !rukoBuka) {
      const timeOnly = absenPagi.split(" - ")[0];
      const dateOnly = absenPagi.split(" - ")[1]?.replace(/\//g, "-");
      const dStr = dateOnly && dateOnly.includes("-") ? `${dateOnly.split("-")[2]}-${dateOnly.split("-")[1].padStart(2, '0')}-${dateOnly.split("-")[0].padStart(2, '0')}` : undefined;
      setRukoBuka(timeOnly, dStr);
    }
  }, [absenPagi, rukoBuka, setRukoBuka]);

  useEffect(() => {
    if (absenSiang && !rukoTutup) {
      const timeOnly = absenSiang.split(" - ")[0];
      const dateOnly = absenSiang.split(" - ")[1]?.replace(/\//g, "-");
      const dStr = dateOnly && dateOnly.includes("-") ? `${dateOnly.split("-")[2]}-${dateOnly.split("-")[1].padStart(2, '0')}-${dateOnly.split("-")[0].padStart(2, '0')}` : undefined;
      setRukoTutup(timeOnly, dStr);
    }
  }, [absenSiang, rukoTutup, setRukoTutup]);

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
    const currentUserEmail = rawEmail ? normalizeEmail(rawEmail) : "owner@gmail.com";

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
      const dateOnly = new Date().toISOString().split("T")[0];
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
    const rawEmail = auth.currentUser?.email;
    if (!rawEmail) return;
    const currentUserEmail = normalizeEmail(rawEmail);
    try {
      const dateStr = new Date().toISOString().split("T")[0];
      const logData = {
         email: currentUserEmail,
         tanggal: tanggal,
         tanggalReal: dateStr,
         shift: "Libur",
         jenisAbsen: "Libur",
         waktu: "-",
         photoUrl: "",
         timestamp: new Date().toISOString(),
         _serverTs: serverTimestamp()
      };
      const logId = `${dateStr}_Libur_${currentUserEmail}`;
      await setDoc(doc(db, "log_absensi", logId), logData);
    } catch(e) {
      console.error("Gagal menyimpan log libur", e);
    }
  };

  const handlePotongGaji = async (waktuAbsen: string, fotoBase64: string, jenisAbsen: "Masuk" | "Pulang") => {
    if (shiftPegawai === "Libur") return;
    
    // Default the active email, with fallback check
    const rawEmail = auth.currentUser?.email;
    if (!rawEmail) {
       console.warn("User email belum tersedia, menggunakan mode lokal.");
       return;
    }
    const currentUserEmail = normalizeEmail(rawEmail);

    try {
      setIsProcessingAbsen(true);
      // 1. Upload photo to Firebase Storage
      const dateStr = new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 10);
      const safeTimeStr = waktuAbsen.replace(/[^a-zA-Z0-9]/g, "_");
      const imageRef = ref(storage, `absensi/${currentUserEmail}/${dateStr}_${jenisAbsen}_${safeTimeStr}.jpg`);
      await uploadString(imageRef, fotoBase64, 'data_url');
      const imageUrl = await getDownloadURL(imageRef);

      // 1.5. Injeksi Data ke log_absensi (Rekam jejak semua absensi masuk & pulang)
      try {
        const logData = {
           email: currentUserEmail,
           tanggal: tanggal,
           tanggalReal: new Date().toISOString().split("T")[0],
           shift: shiftPegawai,
           jenisAbsen: jenisAbsen,
           waktu: waktuAbsen,
           photoUrl: imageUrl,
           timestamp: new Date().toISOString(),
           _serverTs: serverTimestamp() // Server timestamp untuk konsistensi
        };
        const logId = `${dateStr}_${jenisAbsen}_${safeTimeStr}_${currentUserEmail}`;
        await setDoc(doc(db, "log_absensi", logId), logData);
      } catch(e) {
        console.error("Gagal menyimpan log_absensi", e);
      }

       // AUTO RUKO BUKA / TUTUP dihapus dari sini (SSOT).
       // Logika auto-fill sekarang hanya ada di onSubmit callback AbsenPopup
       // untuk menghindari race condition dan inkonsistensi tanggal saat absen
       // melewati tengah malam.

      // 2. Kalkulasi Denda Keterlambatan Absen Masuk
      if (jenisAbsen === "Masuk" && absenConfig) {
        const timePart = waktuAbsen.split(" - ")[0]; // Extract HH:MM
        const [jam, menit] = timePart.split(":").map(Number);
        const waktuAbsenMinutes = jam * 60 + menit;
        // Gunakan shift yang DIPILIH admin sebagai acuan (bukan default Pagi)
        const shiftStartMinutes = shiftPegawai.includes("Pagi") ? 10 * 60 : 15 * 60;
        
        const lateMinutes = waktuAbsenMinutes - shiftStartMinutes;

        // RULE TOLERANSI: Sesuai pengaturan
        // Denda dihitung dari menit setelah toleransi
        if (lateMinutes > (absenConfig.waktuToleransi ?? 15)) {
           const toleransi = absenConfig.waktuToleransi ?? 15;
           const durasiPotongan = absenConfig.durasiWaktuPotongan > 0 ? absenConfig.durasiWaktuPotongan : 15;
           const nominalDenda = absenConfig.nominalDenda ?? 1500;

           const effectiveLate = lateMinutes - toleransi;
           const blockDenda = Math.ceil(effectiveLate / durasiPotongan);
           const denda = blockDenda * nominalDenda;
           
            if (denda > 0) {
               const dateStrToday = new Date().toISOString().split("T")[0];
               const idempKey = `lateCheckin_${currentUserEmail}_${dateStrToday}_${shiftPegawai.replace(/\s+/g, '')}`;

               const newDenda = {
                  id: `denda_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  nominal: denda,
                  ket: `[Auto-Sistem] Telat absen masuk (${waktuAbsen}) - Telat ${lateMinutes}m (efektif ${effectiveLate}m). Shift: ${shiftPegawai}`,
                  photoUrl: imageUrl,
                  dateStr: new Date().toISOString(),
                  _isAutoSistem: true,
                  _idempKey: idempKey
               };

               const d = new Date();
               const mm = String(d.getMonth() + 1).padStart(2, '0');
               const yy = String(d.getFullYear()).slice(-2);
               const currentBulanTahun = `${mm}/${yy}`;

               // Gunakan atomic transaction agar tidak pernah menimpa atau terhapus
               const res = await atomicAddDenda(currentUserEmail, newDenda, currentBulanTahun);
               if (!res.alreadyExisted) {
                 alert(`🚨 PERINGATAN SISTEM\nAnda telat absen ${lateMinutes} menit (toleransi ${toleransi}m, efektif telat ${effectiveLate}m)!\nGaji Anda otomatis dipotong Rp ${denda.toLocaleString("id-ID")}`);
               }
            }
        }
      }
      
    } catch (err) {
      console.error("Gagal memproses backend absen:", err);
      alert("Terjadi kendala saat upload foto/denda. Silakan coba lagi.");
    } finally {
      setIsProcessingAbsen(false);
    }
  };

  // --- STYLES ---
  // Container utama dengan efek glass material yang smooth
  const glassPanel = "rounded-3xl border border-white/20 dark:border-white/10 bg-white/60 dark:bg-zinc-900/40 p-1 shadow-xl shadow-zinc-200/50 dark:shadow-black/20 backdrop-blur-2xl";
  
  // Style untuk setiap "Tile" input
  const tileBase = "group relative flex flex-col justify-center px-4 py-3 rounded-2xl bg-white/50 dark:bg-zinc-800/40 hover:bg-white/80 dark:hover:bg-zinc-800/60 border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-700/50 transition-all duration-200";
  const focusRing = "focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white dark:focus-within:bg-zinc-800 focus-within:border-blue-500/30";
  
  const labelStyle = "text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1 flex items-center gap-1.5";
  const inputStyle = "w-full bg-transparent p-0 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none border-none ring-0 appearance-none relative z-[1] min-h-[44px]";

  return (
    <div className={glassPanel}>
      <div className="flex flex-col gap-1">
        
        {/* --- SECTION 1: DATE & SHIFT --- */}
        <div className={`${tileBase} ${focusRing} flex flex-col md:flex-row items-center justify-between !py-3 gap-3 md:gap-4`}>
          <div className="flex flex-col w-full flex-1 md:pr-4">
            <label className={labelStyle}>
              <Icons.Calendar />
              <span>Tanggal Pembukuan</span>
            </label>
            <div className="flex items-center gap-3 mt-1.5">
              <input
                data-fieldid="tanggal"
                type="date"
                value={tanggal}
                onChange={(e) => handleTanggalChange(e.target.value)}
                className={`${inputStyle} text-[15px] max-w-[140px] tracking-tight`}
              />
              {/* Day Badge */}
              {hari && (
                <div className="shrink-0 px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/10 text-[11px] font-bold tracking-wide text-zinc-600 dark:text-zinc-300 animate-in fade-in slide-in-from-left-2 duration-300 uppercase">
                  {hari}
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:block w-[1px] self-stretch bg-zinc-200/50 dark:bg-zinc-700/50" />

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
                 className="w-full bg-transparent border-none p-0 text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 outline-none appearance-none cursor-pointer h-11 pb-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:text-zinc-400 dark:disabled:text-zinc-500"
               >
                 <option value="" disabled hidden className="bg-white dark:bg-[#1C1C1E] text-zinc-900 dark:text-zinc-100">Pilih Shift</option>
                 <option value="Shift Pagi" className="bg-white dark:bg-[#1C1C1E] text-zinc-900 dark:text-zinc-100">Shift Pagi (10:00 - 20:00)</option>
                 <option value="Shift Sore" className="bg-white dark:bg-[#1C1C1E] text-zinc-900 dark:text-zinc-100">Shift Sore (15:00 - 24:00)</option>
                 <option value="Libur" className="bg-white dark:bg-[#1C1C1E] text-zinc-900 dark:text-zinc-100">Libur</option>
               </select>
               <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 ${absenPagi !== "" || absenSiang !== "" ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400 dark:text-zinc-500"}`}>
                 <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
               </div>
             </div>
          </div>
        </div>

        {/* --- SECTION 2: GRID TIME INPUTS --- */}
        <div className="grid grid-cols-2 gap-1">
          {/* Absen Masuk */}
          <div className={`${tileBase} ${focusRing} overflow-hidden relative`}>
            {onResetAbsenPagi && isOwner && absenPagi && (
              <button 
                onClick={onResetAbsenPagi}
                className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors z-10"
                title="Reset Absen Masuk"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            )}
            <label className={labelStyle}>
              <Icons.Sun />
              <span>Absen Masuk</span>
            </label>
            {absenPagi ? (
              <div className="flex flex-col mt-2 mb-1">
                 <span className="text-[17px] font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{absenPagi}</span>
                 <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Sistem mendeteksi potong gaji jika telat</span>
              </div>
            ) : isManualPagi && isOwner ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  data-fieldid="manualAbsenPagi"
                  type="time"
                  defaultValue={rukoBuka || "10:00"}
                  onChange={(e) => handleManualAbsenChange("Masuk", e.target.value)}
                  className={`${inputStyle} cursor-pointer`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsManualPagi(false)}
                  className="px-2.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-semibold shrink-0 transition-colors"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-2.5 w-full">
                <button 
                  onClick={() => {
                    if (isAbsenBlocked) { setShowAbsenBlockedAlert(true); return; }
                    setPopupAbsen("Masuk");
                  }}
                  disabled={shiftPegawai === "Libur" || shiftPegawai === ""}
                  className="flex-1 group relative flex items-center justify-center gap-2 rounded-[10px] transition-all duration-200 active:scale-[0.96] disabled:opacity-50 font-semibold select-none overflow-hidden px-3 py-2.5 text-[13px] sm:text-[14px] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md shadow-zinc-500/10 disabled:bg-zinc-100 dark:disabled:bg-white/5 disabled:text-zinc-400 dark:disabled:text-zinc-600"
                >
                  {shiftPegawai === "" ? (
                     <span className="relative z-0 text-[12px] opacity-70">Pilih Shift Dahulu</span>
                  ) : shiftPegawai === "Libur" ? (
                     <span className="relative z-0 text-[13px]">Selamat Berlibur</span>
                  ) : (
                     <>
                       <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 dark:via-black/10 to-transparent z-10" />
                       <span className="relative z-0">Klik untuk Absen</span>
                     </>
                  )}
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setIsManualPagi(true)}
                    className="px-2.5 sm:px-3 py-2.5 rounded-[10px] bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[11px] sm:text-[12px] font-bold shrink-0 shadow-md shadow-red-600/25 flex items-center gap-1.5 transition-all"
                    title="Emergency Absen (Set Jam Masuk Manual)"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span className="whitespace-nowrap">Emergency Absen</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Absen Pulang */}
          <div className={`${tileBase} ${focusRing} overflow-hidden relative`}>
            {onResetAbsenSiang && isOwner && absenSiang && (
              <button 
                onClick={onResetAbsenSiang}
                className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors z-10"
                title="Reset Absen Pulang"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            )}
            <label className={labelStyle}>
              <Icons.SunCloud />
              <span>Absen Pulang</span>
            </label>
            {absenSiang ? (
              <div className="flex flex-col mt-2 mb-1">
                 <span className="text-[17px] font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{absenSiang}</span>
                 <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Sistem mendeteksi potong gaji jika telat</span>
              </div>
            ) : isManualSiang && isOwner ? (
              <div className="flex items-center gap-2 mt-2">
                <input
                  data-fieldid="manualAbsenSiang"
                  type="time"
                  defaultValue={rukoTutup || "20:00"}
                  onChange={(e) => handleManualAbsenChange("Pulang", e.target.value)}
                  className={`${inputStyle} cursor-pointer`}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsManualSiang(false)}
                  className="px-2.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-semibold shrink-0 transition-colors"
                >
                  Batal
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-2.5 w-full">
                <button 
                  onClick={() => {
                    if (isAbsenBlocked) { setShowAbsenBlockedAlert(true); return; }
                    setPopupAbsen("Pulang");
                  }}
                  disabled={shiftPegawai === "Libur" || shiftPegawai === "" || !isSudahWaktuPulang}
                  className="flex-1 group relative flex items-center justify-center gap-2 rounded-[10px] transition-all duration-200 active:scale-[0.96] disabled:opacity-50 font-semibold select-none overflow-hidden px-3 py-2.5 text-[13px] sm:text-[14px] bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md shadow-zinc-500/10 disabled:bg-zinc-100 dark:disabled:bg-white/5 disabled:text-zinc-400 dark:disabled:text-zinc-600"
                >
                  {shiftPegawai === "" ? (
                     <span className="relative z-0 text-[12px] opacity-70">Pilih Shift Dahulu</span>
                  ) : shiftPegawai === "Libur" ? (
                     <span className="relative z-0 text-[13px]">Selamat Berlibur</span>
                  ) : !isSudahWaktuPulang ? (
                     <span className="relative z-0 text-[12px] opacity-70">Belum Waktu Pulang</span>
                  ) : (
                     <>
                       <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 dark:via-black/10 to-transparent z-10" />
                       <span className="relative z-0">Klik untuk Absen</span>
                     </>
                  )}
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => setIsManualSiang(true)}
                    className="px-2.5 sm:px-3 py-2.5 rounded-[10px] bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[11px] sm:text-[12px] font-bold shrink-0 shadow-md shadow-red-600/25 flex items-center gap-1.5 transition-all"
                    title="Emergency Absen (Set Jam Pulang Manual)"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    <span className="whitespace-nowrap">Emergency Absen</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Ruko Buka */}
          <div className={`${tileBase} ${focusRing} relative`}>
            {onResetRukoBuka && isOwner && rukoBuka && (
              <button 
                onClick={onResetRukoBuka}
                className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors z-10"
                title="Reset Ruko Buka"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            )}
            <label className={labelStyle}>
              <Icons.Store />
              <span>Ruko Buka</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                data-fieldid="rukoBuka"
                type="time"
                value={rukoBuka}
                onChange={(e) => setRukoBuka(e.target.value)}
                readOnly={!isOwner && !!rukoBuka}
                className={`${inputStyle} ${!isOwner && !!rukoBuka ? 'opacity-70 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
              />
              {rukoBukaDate && rukoBuka && (
                <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md shrink-0">
                  {rukoBukaDate}
                </span>
              )}
            </div>
          </div>

          {/* Ruko Tutup */}
          <div className={`${tileBase} ${focusRing} relative`}>
            {onResetRukoTutup && isOwner && rukoTutup && (
              <button 
                onClick={onResetRukoTutup}
                className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors z-10"
                title="Reset Ruko Tutup"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            )}
            <label className={labelStyle}>
              <Icons.StoreOff />
              <span>Ruko Tutup</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                data-fieldid="rukoTutup"
                type="time"
                value={rukoTutup}
                onChange={(e) => setRukoTutup(e.target.value)}
                readOnly={!isOwner && !!rukoTutup}
                className={`${inputStyle} ${!isOwner && !!rukoTutup ? 'opacity-70 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
              />
              {rukoTutupDate && rukoTutup && (
                <span className="text-[11px] font-medium text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md shrink-0">
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

      {/* --- FOOTER: Reset Button --- */}
      {onReset && isOwner && (
        <div className="flex items-center justify-start px-1 pt-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="group flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-100 hover:text-zinc-900 active:scale-95 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>Reset Input</span>
          </button>
        </div>
      )}

      {/* Apple-style Reset Confirmation */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setShowResetConfirm(false)} />
          <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              </div>
              <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Reset Semua Input?</h3>
              <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Absen Pagi, Absen Siang, Ruko Buka, Ruko Tutup, dan Catatan akan dikosongkan. Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-300/30 dark:border-white/10">
              <button onClick={() => setShowResetConfirm(false)} className="py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10 border-r border-gray-300/30 dark:border-white/10">Batal</button>
              <button onClick={() => { setShowResetConfirm(false); onReset?.(); }} className="py-3.5 text-[15px] font-semibold text-red-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Absen Popup (Realtime Location) */}
      <AbsenPopup 
        isOpen={popupAbsen !== null}
        jenisAbsen={popupAbsen}
        onClose={() => setPopupAbsen(null)}
        onSubmit={async (waktu, fotoBase64, coord) => {
           const currentMode = popupAbsen;
           setPopupAbsen(null);
           if (onAbsenSubmit) onAbsenSubmit(); // Clear suppress flag — admin aktif absen
           
           const toMinutes = (timeStr: string) => {
              if (!timeStr) return 0;
              const timePart = timeStr.split(" - ")[0]; // Extract HH:MM
              const [h, m] = timePart.split(':').map(Number);
              // Jika jam kurang dari 6 pagi (misal 00:xx, 01:xx, 02:xx), 
              // anggap ini shift malam yang menyeberang hari (24 + h) agar perbandingannya valid paling besar.
              const adjustedHour = h < 6 ? h + 24 : h;
              return adjustedHour * 60 + m;
           };

           const convertToYmd = (dStr: string) => {
             const [d, m, y] = dStr.split("-");
             return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
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
           if (currentMode) {
              await handlePotongGaji(waktu, fotoBase64, currentMode);
           }
        }}
      />

      {/* WARNING POPUP: Absen Blocked di Jam Awal */}
      {showAbsenBlockedAlert && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setShowAbsenBlockedAlert(false)} />
          <div className="relative w-full max-w-[300px] sm:max-w-[340px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 className="text-[17px] font-bold text-zinc-900 dark:text-white mb-2">Absen Belum Tersedia</h3>
              <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400 mb-1">
                Data hari sebelumnya sudah tersimpan. Absen untuk hari baru akan tersedia mulai jam <strong className="text-zinc-900 dark:text-white">09:45 WIB</strong>.
              </p>
              <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 mt-2">
                Ini untuk mencegah data absen tercampur antar hari kerja.
              </p>
            </div>
            <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
              <button onClick={() => setShowAbsenBlockedAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Oke, Mengerti</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Input;