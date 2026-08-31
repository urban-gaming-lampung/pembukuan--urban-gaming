import React, { useState, useEffect, useMemo } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc, getDocs, getDoc, serverTimestamp } from "firebase/firestore";
import { db, firebaseConfig } from "../lib/firebase";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie
} from "recharts";
import { Users, Activity, Banknote, Save, Plus, ChevronDown, ChevronUp, Trash2, X, Camera, UserPlus, Shield, UserCheck, AlertTriangle, CalendarDays, CalendarRange, RotateCcw, Ban } from "lucide-react";
import Section from "./common/Section";
import UserAvatar from "./common/UserAvatar";
import { getAbsenCycleInfo, getCycleInfoFromBulanTahun, BULAN_NAMES } from "../lib/absenPeriod";

// === KONSTANTA ABSENSI ===


// Format helper
const rupiah = (val: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(val);

export default function TabPegawai({ history = [], isOwner = false }: { history?: any[]; isOwner?: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [gaji, setGaji] = useState<any[]>([]);
  const [usersProfile, setUsersProfile] = useState<any[]>([]);
  const [isGajiLoaded, setIsGajiLoaded] = useState(false);

  // Helper to check if email is Super Admin or Owner
  const isSuperAdminOrOwnerEmail = (email: string) => {
    const emailLower = email.toLowerCase().trim();
    return emailLower === "owner@gmail.com";
  };

  // 1. Fetch data logs (login)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pegawai_logs"), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(data);
    });
    return () => unsub();
  }, []);

  const [absenConfig, setAbsenConfig] = useState<any>({ dendaTidakAbsenPulang: 40000 });
  const [ongkirConfig, setOngkirConfig] = useState<any>({ pegawaiPersen: 70, masukGaji: false });
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "settings"), (docSnap) => {
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.absenConfig) setAbsenConfig(d.absenConfig);
        if (d.ongkirConfig) {
          setOngkirConfig({
            pegawaiPersen: typeof d.ongkirConfig.pegawaiPersen === "number" ? d.ongkirConfig.pegawaiPersen : 70,
            masukGaji: Boolean(d.ongkirConfig.masukGaji)
          });
        }
      }
    });
    return () => unsub();
  }, []);

  // 2. Fetch data gaji
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "gaji_pegawai"), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGaji(data);
      setIsGajiLoaded(true);
    });
    return () => unsub();
  }, []);

  // 3. Fetch users profile
  const [isUsersLoaded, setIsUsersLoaded] = useState(false);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsersProfile(data);
      setIsUsersLoaded(true);
    });
    return () => unsub();
  }, []);

  // 4. Fetch data log_absensi (REALTIME SSOT)
  const [logAbsensi, setLogAbsensi] = useState<any[]>([]);
  const [isLogAbsensiLoaded, setIsLogAbsensiLoaded] = useState(false);
  const [loadingLogAbsensi, setLoadingLogAbsensi] = useState(false);

  useEffect(() => {
    setLoadingLogAbsensi(true);
    const unsub = onSnapshot(collection(db, "log_absensi"), (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogAbsensi(data);
      setIsLogAbsensiLoaded(true);
      setLoadingLogAbsensi(false);
    }, (err) => {
      console.error("Error subscribing to log_absensi:", err);
      setLoadingLogAbsensi(false);
    });
    return () => unsub();
  }, []);

  // States for Manage Account widget
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "super admin">("admin");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [isDeletingEmail, setIsDeletingEmail] = useState<string | null>(null);

  // States for Delivery Fee (Ongkir) Report Range Filter
  const [ongkirStart, setOngkirStart] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
  const [ongkirEnd, setOngkirEnd] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    const emailTrimmed = newEmail.toLowerCase().trim();
    if (!emailTrimmed || !newPassword) {
      setCreateError("Email dan password wajib diisi.");
      return;
    }
    if (newPassword.length < 6) {
      setCreateError("Password minimal 6 karakter.");
      return;
    }
    if (usersProfile.some(u => u.id.toLowerCase().trim() === emailTrimmed)) {
      setCreateError("Akun dengan email ini sudah terdaftar.");
      return;
    }

    setCreatingAccount(true);
    try {
      const apps = getApps();
      const secondaryApp = apps.find(a => a.name === "secondaryApp") || initializeApp(firebaseConfig, "secondaryApp");
      const secondaryAuth = getAuth(secondaryApp);

      await createUserWithEmailAndPassword(secondaryAuth, emailTrimmed, newPassword);

      await setDoc(doc(db, "users", emailTrimmed), {
        role: newRole,
        status: "aktif",
        createdAt: serverTimestamp(),
        profileColor: "#3b82f6",
        photoUrl: null
      });

      await secondaryAuth.signOut();

      setCreateSuccess(`Akun ${emailTrimmed} berhasil dibuat!`);
      setNewEmail("");
      setNewPassword("");
      setNewRole("admin");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setCreateError("Email sudah digunakan di Firebase.");
      } else {
        setCreateError(err.message || "Gagal membuat akun.");
      }
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleDeleteAccount = async (email: string) => {
    if (email.toLowerCase().trim() === "owner@gmail.com") return;
    if (!confirm(`Apakah Anda yakin ingin menghapus akun ${email}? Pegawai ini tidak akan bisa login lagi dan seluruh datanya akan dibersihkan.`)) return;
    
    setIsDeletingEmail(email);
    try {
      await deleteDoc(doc(db, "users", email));
      await deleteDoc(doc(db, "logs", email)).catch(() => {});
      await deleteDoc(doc(db, "gaji_pegawai", email)).catch(() => {});
      alert(`Akun ${email} dan seluruh datanya berhasil dihapus.`);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Gagal menghapus akun.");
    } finally {
      setIsDeletingEmail(null);
    }
  };

  const handleChangeRole = async (email: string, role: string) => {
    if (email.toLowerCase().trim() === "owner@gmail.com") return;
    try {
      await setDoc(doc(db, "users", email), { role }, { merge: true });
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Gagal mengubah role.");
    }
  };

  const handleChangeStatus = async (email: string, status: string) => {
    if (email.toLowerCase().trim() === "owner@gmail.com") return;
    try {
      await setDoc(doc(db, "users", email), { status }, { merge: true });
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Gagal mengubah status akun.");
    }
  };

  const loadDataAbsensi = async () => {
     setLoadingLogAbsensi(true);
     try {
       const snap = await getDocs(collection(db, "log_absensi"));
       const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
       setLogAbsensi(data);
       setIsLogAbsensiLoaded(true);
     } catch (e) {
       console.error(e);
       alert("Gagal memuat data absensi.");
     } finally {
       setLoadingLogAbsensi(false);
     }
  };

  // === Helper Akun Pegawai Nonaktif / Dihapus (SSOT) ===
  const isPegawaiNonaktif = (email: string) => {
    if (!email) return false;
    const em = email.toLowerCase().trim();
    if (em.includes("fauzanazim56")) return true;
    if (isUsersLoaded) {
      const up = usersProfile.find(u => u.id?.toLowerCase().trim() === em);
      // Jika akun tidak ditemukan di database users (sudah dihapus), otomatis nonaktif / hide!
      if (!up) return true;
      return up.status === "nonaktif";
    }
    const up = usersProfile.find(u => u.id?.toLowerCase().trim() === em);
    return up?.status === "nonaktif";
  };

  const cutoffDay = Number(absenConfig?.tanggalMulaiHitung) || 1;

  // === Classify shift dari string shift field (SSOT) ===
  const classifyShift = (shiftStr: string): 'pagi' | 'sore' | 'libur' => {
    if (!shiftStr) return 'pagi';
    const lower = shiftStr.toLowerCase();
    if (lower.includes('libur')) return 'libur';
    if (lower.includes('sore')) return 'sore';
    return 'pagi';
  };

  // Set-up grouping log_absensi by Bulan/Siklus -> Minggu -> Hari (SSOT)
  type WeekData = {
    weekNum: number;
    weekLabel: string;
    dateRange: string;
    summary: Map<string, { email: string; pagi: number; sore: number; libur: number }>;
    days: Map<string, any[]>;
  };

  const groupedLogAbsensi = useMemo(() => {
     // Step 1: Group semua log ke siklus periode -> hari -> logs (Hanya akun aktif)
     const rawMap = new Map<string, { cycle: any; hariMap: Map<string, any[]> }>();
     
     logAbsensi.forEach(log => {
        if (!log.tanggal) return;
        const em = log.email ? log.email.toLowerCase().trim() : "";
        if (isSuperAdminOrOwnerEmail(em) || isPegawaiNonaktif(em)) return;

        const cycle = getAbsenCycleInfo(log.tanggal, cutoffDay);
        const bulanTahun = cycle.bulanTahun;
        
        let hariIndo = "";
        try {
           const d = new Date(log.tanggal);
           hariIndo = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(d);
        } catch(e) { hariIndo = "" }
        
        const tglStr = `${hariIndo} - ${log.tanggal}`;

        if (!rawMap.has(bulanTahun)) {
          rawMap.set(bulanTahun, { cycle, hariMap: new Map() });
        }
        const cycleEntry = rawMap.get(bulanTahun)!;
        if (!cycleEntry.hariMap.has(tglStr)) {
          cycleEntry.hariMap.set(tglStr, []);
        }
        cycleEntry.hariMap.get(tglStr)!.push(log);
     });

     // Step 2: Transform ke Siklus -> Week[] -> Days
     const finalData: Array<[
        string,
        WeekData[],
        number,
        Map<string, { email: string; pagi: number; sore: number; libur: number }>,
        string, // labelPeriode
        string  // shortLabelPeriode
     ]> = [];

     for (const [bulan, { cycle, hariMap }] of rawMap.entries()) {
        const monthlySummary = new Map<string, { email: string; pagi: number; sore: number; libur: number }>();
        const weekMap = new Map<number, { days: Map<string, any[]>, summary: Map<string, { email: string; pagi: number; sore: number; libur: number }> }>();

        for (const [hari, logs] of hariMap.entries()) {
           const datePart = hari.split(' - ')[1] || hari;
           const dateObj = new Date(datePart);
           
           // Hitung week number relatif terhadap awal siklus
           const diffDays = Math.max(0, Math.floor((dateObj.getTime() - cycle.startDate.getTime()) / (1000 * 60 * 60 * 24)));
           const wn = Math.min(4, Math.max(1, Math.floor(diffDays / 7) + 1));

           if (!weekMap.has(wn)) {
              weekMap.set(wn, { days: new Map(), summary: new Map() });
           }
           const weekEntry = weekMap.get(wn)!;

           // Aggregate pegawai per hari
           const emailMap = new Map<string, any>();
           logs.forEach((l: any) => {
               const em = l.email ? l.email.toLowerCase().trim() : "";
               if (isSuperAdminOrOwnerEmail(em) || isPegawaiNonaktif(em)) return;
               if (!emailMap.has(em)) {
                  emailMap.set(em, { email: em, waktuMasuk: "-", photoMasuk: null, waktuPulang: "-", photoPulang: null, isLibur: false });
               }
               if (l.jenisAbsen === "Masuk") {
                  emailMap.get(em).waktuMasuk = l.waktu;
                  emailMap.get(em).photoMasuk = l.photoUrl;
                  emailMap.get(em).shift = l.shift || "";
               } else if (l.jenisAbsen === "Pulang") {
                  emailMap.get(em).waktuPulang = l.waktu;
                  emailMap.get(em).photoPulang = l.photoUrl;
               } else if (l.jenisAbsen === "Libur") {
                  emailMap.get(em).isLibur = true;
                  emailMap.get(em).shift = "Libur";
               }
           });
           weekEntry.days.set(hari, Array.from(emailMap.values()));

           // Hitung summary shift per pegawai per hari (SSOT: dari emailMap)
           emailMap.forEach((pData, em) => {
              if (!weekEntry.summary.has(em)) {
                 weekEntry.summary.set(em, { email: em, pagi: 0, sore: 0, libur: 0 });
              }
              const s = weekEntry.summary.get(em)!;
              const cls = classifyShift(pData.shift || "");
              if (pData.isLibur || cls === 'libur') s.libur++;
              else if (cls === 'sore') s.sore++;
              else s.pagi++;

              // Monthly summary calculation
              if (!monthlySummary.has(em)) {
                 monthlySummary.set(em, { email: em, pagi: 0, sore: 0, libur: 0 });
              }
              const ms = monthlySummary.get(em)!;
              if (pData.isLibur || cls === 'libur') ms.libur++;
              else if (cls === 'sore') ms.sore++;
              else ms.pagi++;
           });
        }

        // Build WeekData array, sort days within each week
        const weeks: WeekData[] = [];
        const weekNums = Array.from(weekMap.keys()).sort((a, b) => a - b);
        let totalDays = 0;
        for (const wn of weekNums) {
           const entry = weekMap.get(wn)!;
           const sortedDays = new Map(
              Array.from(entry.days.entries()).sort((a, b) => {
                 const dateA = new Date(a[0].split(' - ')[1] || a[0]).getTime();
                 const dateB = new Date(b[0].split(' - ')[1] || b[0]).getTime();
                 return dateB - dateA;
              })
           );
           totalDays += sortedDays.size;

           // Calculate date range for wn
           let wStart = new Date(cycle.startDate.getTime() + (wn - 1) * 7 * 86400000);
           let wEnd = wn === 4 ? cycle.endDate : new Date(cycle.startDate.getTime() + (wn * 7 - 1) * 86400000);
           if (wEnd > cycle.endDate) wEnd = cycle.endDate;

           const rangeStr = `${wStart.getDate()} ${BULAN_NAMES[wStart.getMonth()]} - ${wEnd.getDate()} ${BULAN_NAMES[wEnd.getMonth()]}`;

           weeks.push({
              weekNum: wn,
              weekLabel: `Week ${wn}`,
              dateRange: rangeStr,
              summary: entry.summary,
              days: sortedDays
           });
        }

        finalData.push([
          bulan, 
          weeks, 
          totalDays, 
          monthlySummary,
          cycle.labelPeriode,
          cycle.shortLabelPeriode
        ]);
     }

     // Sort bulan desc
     finalData.sort((a, b) => {
        const [ma, ya] = a[0].split("/");
        const [mb, yb] = b[0].split("/");
        return new Date(2000 + parseInt(yb), parseInt(mb)-1).getTime() - new Date(2000 + parseInt(ya), parseInt(ma)-1).getTime();
     });

     return finalData;
  }, [logAbsensi, cutoffDay, usersProfile, isUsersLoaded]);

  const [expandedLogBulan, setExpandedLogBulan] = useState<string[]>([]);
  const toggleLogBulan = (b: string) => setExpandedLogBulan(p => p.includes(b) ? p.filter(x => x !== b) : [...p, b]);
  
  const [expandedLogMinggu, setExpandedLogMinggu] = useState<string[]>([]);
  const toggleLogMinggu = (k: string) => setExpandedLogMinggu(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  const [expandedLogHari, setExpandedLogHari] = useState<string[]>([]);
  const toggleLogHari = (k: string) => setExpandedLogHari(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  const [photoPopup, setPhotoPopup] = useState<string | null>(null);

  // Merge Data
  const pegawaiData = useMemo(() => {
    const mergedMap = new Map();
    const cutoffDay = Number(absenConfig?.tanggalMulaiHitung) || 1;
    
    // Inisialisasi HANYA dari profil yang aktif dan tidak dicoret
    usersProfile.forEach(u => {
      if (!isSuperAdminOrOwnerEmail(u.id)) {
         if (u.status === "nonaktif") return; // Akun yang dicoret tidak dimasukkan
         const k = u.id.toLowerCase().trim();
         if (k.includes("fauzanazim56")) return;
         mergedMap.set(k, { email: u.id, photoUrl: u.photoUrl || null, profileColor: u.profileColor || "#3b82f6", loginsCount: 0, records: [] });
      }
    });

    logs.forEach(l => {
      if (!isSuperAdminOrOwnerEmail(l.id)) {
        const k = l.id.toLowerCase().trim();
        if (isPegawaiNonaktif(k)) return; // Lewati akun nonaktif
        if (mergedMap.has(k)) {
          const p = mergedMap.get(k);
          p.loginsCount = Array.isArray(l.logins) ? l.logins.length : 0;
        }
      }
    });

    // 1. Kalkulasi Ongkir Otomatis dari history pembukuan (mengikuti siklus)
    const ongkirMap = new Map(); // key: `email_MM/YY`, value: total_ongkir (tampilan saja)
    const ongkirMasukGajiMap = new Map(); // key: `email_MM/YY`, value: total ongkir yg benar-benar masuk Gaji Yang Harus Dibayar

    history.forEach((h) => {
       if (!h.tanggal) return;
       const cycle = getAbsenCycleInfo(h.tanggal, cutoffDay);
       const bulanTahun = cycle.bulanTahun;

       if (Array.isArray(h.rowsSewa)) {
           h.rowsSewa.forEach((r: any) => {
               if (r.isOngkir === "YA" && r._ongkir && r.diantarOleh) {
                   const email = r.diantarOleh.toLowerCase().trim();
                   if (isPegawaiNonaktif(email) || !mergedMap.has(email)) return;
                   const key = `${email}_${bulanTahun}`;
                   const nominalAsli = parseInt(String(r._ongkir).replace(/\D/g, "")) || 0;
                   
                   if (r._isNewOngkirSystem) {
                       const fallbackPersen = r._ongkirPegawaiPersen ?? 70;
                       const fallbackNominal = Math.round((nominalAsli * fallbackPersen) / 100);
                       const pegawaiNominal = r._ongkirPegawaiNominal ?? fallbackNominal;
                       
                       // Tampilan total ongkir di UI
                       ongkirMap.set(key, (ongkirMap.get(key) || 0) + pegawaiNominal);
                       
                       // Jika toggle aktif, tambahkan ke yang wajib dibayar
                        const isMasukGaji = typeof ongkirConfig?.masukGaji === "boolean" ? ongkirConfig.masukGaji : Boolean(r._ongkirMasukGaji);
                       if (isMasukGaji) {
                           ongkirMasukGajiMap.set(key, (ongkirMasukGajiMap.get(key) || 0) + pegawaiNominal);
                       }
                   } else {
                       // Sistem lama: hanya tampil di history, TIDAK MASUK Gaji Yang Harus Dibayar
                       ongkirMap.set(key, (ongkirMap.get(key) || 0) + nominalAsli);
                   }
               }
           });
       }

       // Tangani juga ongkir dari Pemasukan Harian (opsional jika user input ongkir di sana)
       if (Array.isArray(h.rowsHarian)) {
           h.rowsHarian.forEach((r: any) => {
               if (r._ongkir && r.diantarOleh) {
                   const email = r.diantarOleh.toLowerCase().trim();
                   if (isPegawaiNonaktif(email) || !mergedMap.has(email)) return;
                   const key = `${email}_${bulanTahun}`;
                   const nominalAsli = parseInt(String(r._ongkir).replace(/\D/g, "")) || 0;
                   
                   if (nominalAsli > 0) {
                       if (r._isNewOngkirSystem) {
                           const fallbackPersen = r._ongkirPegawaiPersen ?? 70;
                           const fallbackNominal = Math.round((nominalAsli * fallbackPersen) / 100);
                           const pegawaiNominal = r._ongkirPegawaiNominal ?? fallbackNominal;
                           
                           ongkirMap.set(key, (ongkirMap.get(key) || 0) + pegawaiNominal);
                           
                           const isMasukGaji = typeof ongkirConfig?.masukGaji === "boolean" ? ongkirConfig.masukGaji : Boolean(r._ongkirMasukGaji);
                           if (isMasukGaji) {
                               ongkirMasukGajiMap.set(key, (ongkirMasukGajiMap.get(key) || 0) + pegawaiNominal);
                           }
                       } else {
                           ongkirMap.set(key, (ongkirMap.get(key) || 0) + nominalAsli);
                       }
                   }
               }
           });
       }
    });

    // 2. Kalkulasi Denda Keterlambatan Absen Masuk Otomatis dari log_absensi (mengikuti siklus)
    const latePenaltyMap = new Map<string, number>(); // key: `email_MM/YY`, value: total late denda
    const latePenaltyItemsMap = new Map<string, any[]>(); // key: `email_MM/YY`, value: array of denda items

    const toleransiCfg = absenConfig.waktuToleransi ?? 15;
    const durasiBlokCfg = absenConfig.durasiWaktuPotongan ?? 15;
    const nominalDendaCfg = absenConfig.nominalDenda ?? 1500;

    logAbsensi.forEach((l: any) => {
      if (l.jenisAbsen === "Masuk" && l.email && l.tanggal) {
        const em = l.email.toLowerCase().trim();
        if (isSuperAdminOrOwnerEmail(em) || isPegawaiNonaktif(em) || !mergedMap.has(em)) return;

        const cycle = getAbsenCycleInfo(l.tanggal, cutoffDay);
        const bulanTahun = cycle.bulanTahun;
        const key = `${em}_${bulanTahun}`;

        let denda = 0;
        let lateM = 0;
        let effLate = 0;

        if (typeof l.denda === "number" && typeof l.lateMinutes === "number") {
          denda = l.denda;
          lateM = l.lateMinutes;
          effLate = l.effectiveLate || Math.max(0, lateM - (l.toleransi ?? toleransiCfg));
        } else if (l.waktu) {
          const timePart = l.waktu.split(" - ")[0];
          const [jam, menit] = timePart.split(":").map(Number);
          const waktuAbsenMinutes = (jam || 0) * 60 + (menit || 0);
          const shiftStr = String(l.shift || "").toLowerCase();
          const shiftStartMinutes = shiftStr.includes("sore") ? 15 * 60 : 10 * 60;
          lateM = Math.max(0, waktuAbsenMinutes - shiftStartMinutes);

          if (lateM > toleransiCfg) {
            effLate = lateM - toleransiCfg;
            const blockDenda = Math.ceil(effLate / durasiBlokCfg);
            denda = blockDenda * nominalDendaCfg;
          }
        }

        if (denda > 0) {
          latePenaltyMap.set(key, (latePenaltyMap.get(key) || 0) + denda);

          const timeDisplay = l.waktu ? l.waktu.split(" - ")[0] : "";
          const shiftDisplay = l.shift || "Shift Pagi";
          const idempKey = `lateCheckin_${em}_${l.tanggal}_${shiftDisplay.replace(/\s+/g, '')}`;

          const item = {
            id: l.id || `late_${l.tanggal}_${em}`,
            nominal: denda,
            ket: `[Auto-Sistem] Telat absen masuk (${timeDisplay}) - Telat ${lateM}m (efektif ${effLate}m). Shift: ${shiftDisplay}`,
            photoUrl: l.photoUrl || null,
            dateStr: l.timestamp || new Date().toISOString(),
            _isAutoSistem: true,
            _idempKey: idempKey,
            _lateMinutes: lateM,
            _effectiveLate: effLate,
            _shift: shiftDisplay,
            _waktuAbsen: l.waktu,
            _tanggalAbsen: l.tanggal,
            isDibatalkan: false
          };

          if (!latePenaltyItemsMap.has(key)) {
            latePenaltyItemsMap.set(key, []);
          }
          const existingList = latePenaltyItemsMap.get(key)!;
          if (!existingList.some(x => x._idempKey === idempKey)) {
            existingList.push(item);
          }
        }
      }
    });

    // 3. Calculate auto-penalties for missing checkouts (mengikuti siklus)
    const penaltyMap = new Map(); // key: `email_MM/YY`, value: count of missed checkouts * penalty
    logAbsensi.forEach(l => {
        if (l.jenisAbsen === "Masuk" && l.email && l.tanggal) {
             const em = l.email.toLowerCase().trim();
             if (isSuperAdminOrOwnerEmail(em) || isPegawaiNonaktif(em) || !mergedMap.has(em)) return;
             const sameDayPulang = logAbsensi.find(o => o.email === l.email && o.tanggal === l.tanggal && o.jenisAbsen === "Pulang");
             if (!sameDayPulang) {
                 const cycle = getAbsenCycleInfo(l.tanggal, cutoffDay);
                 const bulanTahun = cycle.bulanTahun;
                 const key = `${em}_${bulanTahun}`;
                 penaltyMap.set(key, (penaltyMap.get(key) || 0) + (absenConfig.dendaTidakAbsenPulang ?? 40000));
             }
        }
    });

    gaji.forEach(g => {
      const k = g.id.toLowerCase().trim();
      if (isPegawaiNonaktif(k) || isSuperAdminOrOwnerEmail(g.id) || !mergedMap.has(k)) return;
      let records = Array.isArray(g.records) ? g.records : [];
      if (records.length === 0 && (g.gajiPokok || g.bonus || g.potongan)) {
          // Migrasi data lama on the fly
          const d = new Date();
          const cycle = getAbsenCycleInfo(d.toISOString().slice(0, 10), cutoffDay);
          const bulanTahun = cycle.bulanTahun;
          records = [{
             id: `migrated-${bulanTahun}`,
             bulanTahun: bulanTahun,
             gajiPokok: Number(g.gajiPokok) || 0,
             gajiTambahan: (Number(g.bonus) || 0) > 0 ? [{ id: Date.now() + 'tb', nominal: Number(g.bonus) || 0, ket: g.ketPemasukan || g.ket || "Gaji Tambahan" }] : [],
             gajiPengurangan: (Number(g.potongan) || 0) > 0 ? [{ id: Date.now() + 'pg', nominal: Number(g.potongan) || 0, ket: g.ketPengeluaran || "Gaji Pengurangan" }] : [],
             buktiTransfer: g.buktiTransfer || "",
             updatedAt: g.updatedAt || Date.now()
          }];
      } else {
          // Transform if already array but using old schema internally
          records = records.map((r: any) => {
              let tb = Array.isArray(r.gajiTambahan) ? [...r.gajiTambahan] : [];
              let pg = Array.isArray(r.gajiPengurangan) ? [...r.gajiPengurangan] : [];
              if (r.bonus && tb.length === 0) tb.push({ id: Date.now() + 'tb', nominal: Number(r.bonus) || 0, ket: r.ketPemasukan || "Gaji Tambahan" });
              if (r.potongan && pg.length === 0) pg.push({ id: Date.now() + 'tb2', nominal: Number(r.potongan) || 0, ket: r.ketPengeluaran || "Gaji Pengurangan" });
              
              const res = { ...r, gajiTambahan: tb, gajiPengurangan: pg };
              delete res.bonus;
              delete res.potongan;
              delete res.ketPemasukan;
              delete res.ketPengeluaran;
              return res;
          });
      }

      mergedMap.get(k).records = records;
      mergedMap.get(k).gajiPokok = Number(g.gajiPokok) || 0;
    });
    // Attach ongkir yang belum tercover di records, dan rekap total
    Array.from(mergedMap.values()).forEach((p: any) => {
        const up = usersProfile.find(u => u.id?.toLowerCase().trim() === p.email?.toLowerCase().trim());
        if (up) {
            p.photoUrl = up.photoUrl || p.photoUrl || null;
            p.profileColor = up.profileColor || p.profileColor || "#3b82f6";
        }
        if (!p.records) p.records = [];

        // Resolusi Gaji Pokok Dasar Pegawai yang cerdas dan konsisten
        let resolvedBasePokok = 0;
        for (const r of p.records) {
            const v = Number(r.gajiPokok) || 0;
            if (v > 0) { resolvedBasePokok = v; break; }
        }
        if (resolvedBasePokok === 0) {
            resolvedBasePokok = Number(p.gajiPokok) || 1500000;
        }
        p.gajiPokok = resolvedBasePokok;
        
        let totalOngkir = 0;
        
        // Populate ongkirBulanIni, late penalties to existing records
        p.records.forEach((rec: any) => {
           const k = `${p.email.toLowerCase()}_${rec.bulanTahun}`;
           rec.ongkirBulanIni = ongkirMap.get(k) || 0;
           rec.ongkirMasukGajiBulanIni = ongkirMasukGajiMap.get(k) || 0;
           rec.dendaAbsen = penaltyMap.get(k) || 0;
           rec.dendaTelat = latePenaltyMap.get(k) || 0;

           // Auto-merge late penalty items into rec.gajiPengurangan
           const lateItems = latePenaltyItemsMap.get(k) || [];
           let currentPg = Array.isArray(rec.gajiPengurangan) ? [...rec.gajiPengurangan] : [];
           
           lateItems.forEach(lateItem => {
             const existingIdx = currentPg.findIndex((x: any) => 
               x._idempKey === lateItem._idempKey || 
               (x._isAutoSistem && x.ket && x.ket.includes(lateItem._tanggalAbsen || ""))
             );
             if (existingIdx >= 0) {
               currentPg[existingIdx] = {
                 ...lateItem,
                 ...currentPg[existingIdx],
                 isDibatalkan: Boolean(currentPg[existingIdx].isDibatalkan),
                 nominal: currentPg[existingIdx].nominal !== undefined ? currentPg[existingIdx].nominal : lateItem.nominal,
                 photoUrl: currentPg[existingIdx].photoUrl || lateItem.photoUrl
               };
             } else {
               currentPg.push({
                 ...lateItem,
                 isDibatalkan: false
               });
             }
           });
           rec.gajiPengurangan = currentPg;

           // Jika record auto-generated sebelumnya sempat tersimpan 0, perbaiki ke gaji pokok pegawai
           if ((Number(rec.gajiPokok) || 0) === 0 && rec.isAutoGenerated) {
               rec.gajiPokok = resolvedBasePokok;
           }
           totalOngkir += rec.ongkirBulanIni;
           ongkirMap.delete(k); // remove processed keys
           ongkirMasukGajiMap.delete(k);
           penaltyMap.delete(k);
           latePenaltyMap.delete(k);
           latePenaltyItemsMap.delete(k);
        });

        // Any remaining keys in ongkirMap, latePenaltyMap, or penaltyMap for this specific email
        // means there is activity in a month where owner hasn't created a 'gaji record' for yet!
        // We create a stub "dummy" record automatically.
        const allRemainingMonthKeys = new Set([
          ...Array.from(ongkirMap.keys()).filter(k => k.startsWith(`${p.email.toLowerCase()}_`)),
          ...Array.from(latePenaltyMap.keys()).filter(k => k.startsWith(`${p.email.toLowerCase()}_`)),
          ...Array.from(penaltyMap.keys()).filter(k => k.startsWith(`${p.email.toLowerCase()}_`))
        ]);

        allRemainingMonthKeys.forEach((key) => {
           const bTahun = key.split("_")[1];
           const valOngkir = ongkirMap.get(key) || 0;
           const valMasukGaji = ongkirMasukGajiMap.get(key) || 0;
           const lateItems = (latePenaltyItemsMap.get(key) || []).map(li => ({ ...li, isDibatalkan: false }));
           const valLate = latePenaltyMap.get(key) || 0;
           const valPenaltyPulang = penaltyMap.get(key) || 0;

           p.records.push({
               id: `auto-rec-${bTahun}`,
               bulanTahun: bTahun,
               gajiPokok: resolvedBasePokok,
               gajiTambahan: [],
               gajiPengurangan: [...lateItems],
               buktiTransfer: "",
               ongkirBulanIni: valOngkir,
               ongkirMasukGajiBulanIni: valMasukGaji,
               dendaAbsen: valPenaltyPulang,
               dendaTelat: valLate,
               isAutoGenerated: true
           });
           totalOngkir += valOngkir;
           ongkirMap.delete(key);
           ongkirMasukGajiMap.delete(key);
           penaltyMap.delete(key);
           latePenaltyMap.delete(key);
           latePenaltyItemsMap.delete(key);
        });

        // Rekap untuk PieChart Nanti
        p.totalOngkirGlobal = totalOngkir;
        p.totalPokok = p.records.reduce((acc: number, r: any) => acc + (Number(r.gajiPokok)||0), 0);
        p.totalBonus = p.records.reduce((acc: number, r: any) => acc + (r.gajiTambahan?.reduce((sum: number, t: any) => sum + (Number(t.nominal) || 0), 0) || 0), 0);
        p.totalPotongan = p.records.reduce((acc: number, r: any) => acc + (r.gajiPengurangan?.filter((pg: any) => !pg.isDibatalkan).reduce((sum: number, pg: any) => sum + (Number(pg.nominal) || 0), 0) || 0), 0);
        p.grandTotalPendapatan = p.totalPokok + p.totalBonus + p.totalOngkirGlobal - p.totalPotongan;
        
        // Re-sort records by bulantahun (assuming "MM/YY") so new stub records appear correctly
        p.records.sort((a: any, b: any) => {
           const [ma, ya] = a.bulanTahun.split("/");
           const [mb, yb] = b.bulanTahun.split("/");
           const da = new Date(2000 + parseInt(ya), parseInt(ma) - 1);
           const db = new Date(2000 + parseInt(yb), parseInt(mb) - 1);
           return db.getTime() - da.getTime();
        });
    });

    return Array.from(mergedMap.values()).filter((p: any) => !isPegawaiNonaktif(p.email));
  }, [logs, gaji, usersProfile, history, logAbsensi, ongkirConfig, absenConfig]);

  const chartData = pegawaiData.map((p: any) => ({
     name: p.email.split("@")[0].toUpperCase(),
     BukaAplikasi: p.loginsCount,
     color: p.profileColor || "#ec4899"
  }));

  const groupedByMonth = useMemo(() => {
      const map = new Map<string, any[]>();
      pegawaiData.forEach((p: any) => {
         p.records?.forEach((r: any) => {
             if (!map.has(r.bulanTahun)) map.set(r.bulanTahun, []);
             map.get(r.bulanTahun)!.push({ email: p.email, photoUrl: p.photoUrl, profileColor: p.profileColor, ...r });
         });
      });
      return Array.from(map.entries()).sort((a,b) => {
         const [ma, ya] = a[0].split("/");
         const [mb, yb] = b[0].split("/");
         return new Date(2000 + parseInt(yb), parseInt(mb)-1).getTime() - new Date(2000 + parseInt(ya), parseInt(ma)-1).getTime();
      });
  }, [pegawaiData]);

  // Memoized delivery fee (ongkir) report by date range
  const ongkirReport = useMemo(() => {
     const map = new Map<string, number>();
     history.forEach((h) => {
        if (!h.tanggal) return;
        if (h.tanggal < ongkirStart || h.tanggal > ongkirEnd) return;

        if (Array.isArray(h.rowsSewa)) {
            h.rowsSewa.forEach((r: any) => {
                if (r.isOngkir === "YA" && r._ongkir && r.diantarOleh) {
                    const email = r.diantarOleh.toLowerCase().trim();
                    if (isPegawaiNonaktif(email)) return;
                    const nominalAsli = parseInt(String(r._ongkir).replace(/\D/g, "")) || 0;
                    
                    let amount = nominalAsli;
                    if (r._isNewOngkirSystem) {
                        const fallbackPersen = r._ongkirPegawaiPersen ?? 70;
                        const fallbackNominal = Math.round((nominalAsli * fallbackPersen) / 100);
                        amount = r._ongkirPegawaiNominal ?? fallbackNominal;
                    }
                    map.set(email, (map.get(email) || 0) + amount);
                }
            });
        }

        if (Array.isArray(h.rowsHarian)) {
            h.rowsHarian.forEach((r: any) => {
                if (r._ongkir && r.diantarOleh) {
                    const email = r.diantarOleh.toLowerCase().trim();
                    if (isPegawaiNonaktif(email)) return;
                    const nominalAsli = parseInt(String(r._ongkir).replace(/\D/g, "")) || 0;
                    
                    if (nominalAsli > 0) {
                        let amount = nominalAsli;
                        if (r._isNewOngkirSystem) {
                            const fallbackPersen = r._ongkirPegawaiPersen ?? 70;
                            const fallbackNominal = Math.round((nominalAsli * fallbackPersen) / 100);
                            amount = r._ongkirPegawaiNominal ?? fallbackNominal;
                        }
                        map.set(email, (map.get(email) || 0) + amount);
                    }
                }
            });
        }
     });

     return Array.from(map.entries())
       .filter(([email]) => !isPegawaiNonaktif(email))
       .map(([email, total]) => {
         const profile = usersProfile.find(u => u.id.toLowerCase().trim() === email);
         return {
             email,
             name: email.split("@")[0],
             total,
             photoUrl: profile?.photoUrl || null,
             profileColor: profile?.profileColor || "#3b82f6"
         };
     }).sort((a, b) => b.total - a.total);
  }, [history, ongkirStart, ongkirEnd, usersProfile, isUsersLoaded]);

  // Auto-clean ghost records in Firestore (like deleted accounts fauzanazim56, etc.)
  useEffect(() => {
    if (!isOwner || !isUsersLoaded) return;
    
    // Check logs collection for deleted accounts
    logs.forEach(async (l) => {
      const email = l.id?.toLowerCase().trim() || "";
      if (email.includes("fauzanazim56") || (!isSuperAdminOrOwnerEmail(email) && !usersProfile.some(u => u.id?.toLowerCase().trim() === email))) {
        try {
          await deleteDoc(doc(db, "logs", l.id));
        } catch (err) {
          console.warn("Auto cleanup logs error:", err);
        }
      }
    });

    // Check gaji_pegawai collection for deleted accounts
    gaji.forEach(async (g) => {
      const email = g.id?.toLowerCase().trim() || "";
      if (email.includes("fauzanazim56") || (!isSuperAdminOrOwnerEmail(email) && !usersProfile.some(u => u.id?.toLowerCase().trim() === email))) {
        try {
          await deleteDoc(doc(db, "gaji_pegawai", g.id));
        } catch (err) {
          console.warn("Auto cleanup gaji error:", err);
        }
      }
    });
  }, [isOwner, isUsersLoaded, usersProfile, logs, gaji]);

  // Auto-persist ongkir stub records to Firestore when detected
  const autoPersistedRef = React.useRef<Set<string>>(new Set());
  
  useEffect(() => {
    // Guard: don't run if gaji hasn't loaded yet to avoid resetting existing data
    if (!isGajiLoaded) return;
    if (pegawaiData.length === 0) return;
    
    pegawaiData.forEach(async (p: any) => {
      const autoRecords = p.records?.filter((r: any) => r.isAutoGenerated);
      if (!autoRecords || autoRecords.length === 0) return;

      // Debounce: skip if we've already persisted for this employee in this session
      const persistKey = `${p.email}_${autoRecords.map((r: any) => r.bulanTahun).join(',')}`;
      if (autoPersistedRef.current.has(persistKey)) return;

      // Get existing records DIRECTLY from the gaji Firestore snapshot (not computed data)
      const existingGajiDoc = gaji.find(g => g.id === p.email);
      const existingRecords: any[] = existingGajiDoc?.records || [];

      // Determine robust base salary
      let basePokok = Number(p.gajiPokok) || 0;
      if (basePokok === 0) {
        for (const r of existingRecords) {
          const v = Number(r.gajiPokok) || 0;
          if (v > 0) { basePokok = v; break; }
        }
      }
      if (basePokok === 0) basePokok = Number(existingGajiDoc?.gajiPokok) || 1500000;

      // Only add stubs for months that have NO existing record at all, and repair 0 gajiPokok
      let needsUpdate = false;
      const updatedRecords = existingRecords.map((r: any) => {
        if ((Number(r.gajiPokok) || 0) === 0 && r.isAutoGenerated) {
          needsUpdate = true;
          return { ...r, gajiPokok: basePokok };
        }
        return r;
      });

      autoRecords.forEach((autoRec: any) => {
        const alreadyExists = updatedRecords.some((r: any) => r.bulanTahun === autoRec.bulanTahun);
        if (!alreadyExists) {
          updatedRecords.push({
            id: autoRec.id,
            bulanTahun: autoRec.bulanTahun,
            gajiPokok: basePokok,
            gajiTambahan: autoRec.gajiTambahan || [],
            gajiPengurangan: autoRec.gajiPengurangan || [],
            buktiTransfer: "",
            updatedAt: Date.now(),
            isAutoGenerated: true
          });
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        autoPersistedRef.current.add(persistKey);
        await setDoc(doc(db, "gaji_pegawai", p.email), {
          records: updatedRecords,
          gajiPokok: basePokok,
          updatedAt: Date.now()
        }, { merge: true });
      }
    });
  }, [pegawaiData, gaji, isGajiLoaded]);

  // === AUTO PENALTY: Tidak Absen Pulang ===
  // Jika pegawai absen Masuk tapi tidak Pulang, dan sudah lewat 03:00 hari berikutnya
  const autoPenaltyPulangRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isLogAbsensiLoaded || !isGajiLoaded) return;
    if (logAbsensi.length === 0) return;

    const now = new Date();
    const currentHour = now.getHours();

    // Group absen by email+tanggal
    const absenMap = new Map<string, { masuk: boolean; pulang: boolean; shift: string; tanggal: string; email: string }>();
    logAbsensi.forEach(l => {
      const key = `${l.email.toLowerCase()}_${l.tanggal}`;
      if (!absenMap.has(key)) absenMap.set(key, { masuk: false, pulang: false, shift: l.shift || "", tanggal: l.tanggal, email: l.email.toLowerCase() });
      if (l.jenisAbsen === "Masuk") { absenMap.get(key)!.masuk = true; absenMap.get(key)!.shift = l.shift || ""; }
      if (l.jenisAbsen === "Pulang") absenMap.get(key)!.pulang = true;
    });

    absenMap.forEach(async (entry, key) => {
      // Only process if: has Masuk, no Pulang
      if (!entry.masuk || entry.pulang) return;
      
      // Check if the deadline has passed: 03:00 the NEXT day after absen date
      const absenDate = new Date(entry.tanggal);
      const deadline = new Date(absenDate);
      deadline.setDate(deadline.getDate() + 1);
      deadline.setHours(3, 0, 0, 0);
      
      if (now < deadline) return; // Belum lewat batas waktu

      // Idempotency: skip if already processed
      const idempKey = `noCheckOut_${entry.email}_${entry.tanggal}`;
      if (autoPenaltyPulangRef.current.has(idempKey)) return;
      autoPenaltyPulangRef.current.add(idempKey);

      try {
        const docRef = doc(db, "gaji_pegawai", entry.email);
        const docSnap = await getDoc(docRef);

        const d = new Date(entry.tanggal);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const currentBulanTahun = `${mm}/${yy}`;

        const dendaItem = {
          id: `autoPulang_${entry.tanggal}_${Date.now()}`,
          nominal: absenConfig.dendaTidakAbsenPulang ?? 40000,
          ket: `[Auto-Sistem] Tidak absen pulang tanggal ${entry.tanggal}. Shift: ${entry.shift}`,
          dateStr: new Date().toISOString(),
          _isAutoSistem: true,
          _idempKey: idempKey
        };

        let records: any[] = [];
        let basePokok = 0;
        if (docSnap.exists()) {
          const dData = docSnap.data();
          records = Array.isArray(dData.records) ? dData.records : [];
          // Check if this penalty was already injected before
          const alreadyInjected = records.some((r: any) => 
            r.gajiPengurangan?.some((pg: any) => pg._idempKey === idempKey)
          );
          if (alreadyInjected) return;

          for (const r of records) {
            const v = Number(r.gajiPokok) || 0;
            if (v > 0) { basePokok = v; break; }
          }
          if (basePokok === 0) basePokok = Number(dData.gajiPokok) || 1500000;
        } else {
          basePokok = 1500000;
        }

        const monthIndex = records.findIndex((r: any) => r.bulanTahun === currentBulanTahun);
        if (monthIndex >= 0) {
          const pg = Array.isArray(records[monthIndex].gajiPengurangan) ? records[monthIndex].gajiPengurangan : [];
          records[monthIndex] = { ...records[monthIndex], gajiPengurangan: [...pg, dendaItem] };
        } else {
          records.push({
            id: `rec-auto-${Date.now()}`,
            bulanTahun: currentBulanTahun,
            gajiPokok: basePokok,
            gajiTambahan: [],
            gajiPengurangan: [dendaItem],
            isAutoGenerated: true
          });
        }

        await setDoc(docRef, { records, gajiPokok: basePokok, updatedAt: Date.now() }, { merge: true });
        console.log(`[Auto-Penalty] Tidak absen pulang: ${entry.email} tanggal ${entry.tanggal}`);
      } catch (e) {
        console.error("Auto penalty pulang error:", e);
        autoPenaltyPulangRef.current.delete(idempKey); // Allow retry
      }
    });
  }, [logAbsensi, isLogAbsensiLoaded, isGajiLoaded]);

  const handleSaveGaji = async (email: string, records: any[]) => {
      try {
        const docRef = doc(db, "gaji_pegawai", email);
        const docSnap = await getDoc(docRef);
        
        let mergedRecords = [...records];
        let latestGajiPokok = 0;

        // Find latest non-zero gajiPokok in the records being saved
        for (const r of records) {
          const v = Number(r.gajiPokok) || 0;
          if (v > 0) { latestGajiPokok = v; break; }
        }

        if (docSnap.exists()) {
          const dbRecords = Array.isArray(docSnap.data().records) ? docSnap.data().records : [];
          
          if (latestGajiPokok === 0) {
            latestGajiPokok = Number(docSnap.data().gajiPokok) || 1500000;
          }

          // Smart merge: ensure auto-deductions from db are preserved if not explicitly deleted
          mergedRecords = mergedRecords.map(localRec => {
            const dbRec = dbRecords.find((dr: any) => dr.bulanTahun === localRec.bulanTahun);
            if (!dbRec) return localRec;

            const localPg = Array.isArray(localRec.gajiPengurangan) ? localRec.gajiPengurangan : [];
            const dbPg = Array.isArray(dbRec.gajiPengurangan) ? dbRec.gajiPengurangan : [];

            // Find auto-system items in DB that might have been added in real-time
            const localIds = new Set(localPg.map((p: any) => p.id || p._idempKey));
            const missingAutoItems = dbPg.filter((p: any) => p._isAutoSistem && p._idempKey && !localIds.has(p._idempKey) && !localIds.has(p.id));

            // Merge any missing auto items that were added after local snapshot
            const combinedPg = [...localPg, ...missingAutoItems];

            return {
              ...localRec,
              gajiPokok: Number(localRec.gajiPokok) || latestGajiPokok,
              gajiPengurangan: combinedPg
            };
          });
        }

        // Sanitize numbers
        const sanitizedRecords = mergedRecords.map(r => ({
          ...r,
          gajiPokok: Number(r.gajiPokok) || latestGajiPokok,
          gajiTambahan: (r.gajiTambahan || []).map((t: any) => ({ ...t, nominal: Number(t.nominal) || 0 })),
          gajiPengurangan: (r.gajiPengurangan || []).map((p: any) => ({ 
            ...p, 
            nominal: Number(p.nominal) || 0,
            isDibatalkan: Boolean(p.isDibatalkan)
          })),
          updatedAt: Date.now()
        }));

        await setDoc(docRef, {
          records: sanitizedRecords,
          gajiPokok: latestGajiPokok,
          updatedAt: Date.now()
        }, { merge: true });

        alert(`Gaji ${email.split("@")[0]} berhasil disimpan!`);
      } catch (err) {
        console.error("Gagal menyimpan gaji pegawai:", err);
        alert("Gagal menyimpan gaji. Silakan coba lagi.");
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* WIDGET PERFORMA */}
      <Section title="Performa Pegawai (Kunjungan Aplikasi)">
         <div className="bg-white dark:bg-[#1C1C1E] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-sm h-[320px] flex flex-col">
            {chartData.length > 0 ? (
               <>
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4d4d8" className="dark:opacity-20" opacity={0.5} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                       cursor={{ fill: 'rgba(0,0,0,0.04)' }} 
                       content={({ active, payload }) => {
                         if (!active || !payload || !payload.length) return null;
                         const d = payload[0].payload;
                         const color = d.color || '#71717a';
                         return (
                           <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl px-4 py-3 shadow-xl min-w-[140px]" style={{ borderTop: `3px solid ${color}` }}>
                             <div className="flex items-center gap-2 mb-1.5">
                               <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                               <span className="text-[13px] font-bold text-zinc-800 dark:text-zinc-100">{d.name}</span>
                             </div>
                             <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-0.5">Total Buka Aplikasi</div>
                             <div className="text-xl font-black" style={{ color }}>{d.BukaAplikasi}×</div>
                           </div>
                         );
                       }}
                    />
                    <Bar dataKey="BukaAplikasi" radius={[6, 6, 0, 0]} barSize={40} name="Total Buka Aplikasi">
                       {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                    </Bar>
                 </BarChart>
               </ResponsiveContainer>
               {/* Custom Legend — shows each employee's profile color */}
               <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-2 pb-1">
                  {chartData.map((entry, i) => (
                     <div key={i} className="flex items-center gap-1.5">
                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{entry.name}</span>
                        <span className="text-[11px] font-black ml-0.5" style={{ color: entry.color }}>{entry.BukaAplikasi}</span>
                     </div>
                  ))}
               </div>
               </>
            ) : (
                <div className="flex h-full items-center justify-center text-zinc-500 text-sm">Belum ada aktivitas pegawai</div>
            )}
         </div>
      </Section>

      {/* WIDGET: KELOLA AKUN PEGAWAI */}
      {isOwner && (
        <Section title="Kelola Akun Pegawai (Owner & Super Admin)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* PANEL DAFTAR AKUN */}
            <div className="bg-white dark:bg-[#1C1C1E] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col">
              <h3 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <span>Akun Terdaftar ({usersProfile.length})</span>
              </h3>
              
              <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
                {usersProfile.map((u) => {
                  const isOwnerAccount = u.id.toLowerCase().trim() === "owner@gmail.com";
                  const roleLabel = u.role === "super admin" ? "Super Admin" : "Admin";
                  const initialName = u.id.split("@")[0].substring(0, 2).toUpperCase();
                  
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-black/30 border border-zinc-100 dark:border-white/5 rounded-xl shadow-sm hover:scale-[1.01] transition-transform">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          photoUrl={u.photoUrl}
                          email={u.id}
                          profileColor={u.profileColor}
                          size="md"
                          showStatusBadge={true}
                          statusBadgeActive={u.status !== "nonaktif"}
                        />
                        <div className="min-w-0 flex flex-col">
                          <span className={`font-bold text-sm truncate ${u.status === "nonaktif" ? "text-zinc-400 dark:text-zinc-500 line-through decoration-red-500/80 decoration-2" : "text-zinc-800 dark:text-zinc-200"}`}>
                            {u.id}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Role: {roleLabel}</span>
                            {u.status === "nonaktif" && (
                              <span className="text-[9px] font-black text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                Nonaktif
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {/* ROLE PICKER */}
                        {isOwnerAccount ? (
                          <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-md">
                            Root Owner
                          </span>
                        ) : (
                          <>
                            <select
                              value={u.role || "admin"}
                              onChange={(e) => handleChangeRole(u.id, e.target.value)}
                              className="text-[11px] font-bold bg-white dark:bg-[#2C2C2E] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="admin">Admin</option>
                              <option value="super admin">Super Admin</option>
                            </select>

                            <select
                              value={u.status || "aktif"}
                              onChange={(e) => handleChangeStatus(u.id, e.target.value)}
                              className="text-[11px] font-bold bg-white dark:bg-[#2C2C2E] border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                            >
                              <option value="aktif">Aktif</option>
                              <option value="nonaktif">Nonaktif</option>
                            </select>
                          </>
                        )}

                        {/* DELETE BUTTON */}
                        {!isOwnerAccount && (
                          <button
                            onClick={() => handleDeleteAccount(u.id)}
                            disabled={isDeletingEmail === u.id}
                            className="p-1.5 bg-red-50 dark:bg-red-950/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors disabled:opacity-50"
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PANEL TAMBAH AKUN BARU */}
            <div className="bg-white dark:bg-[#1C1C1E] border border-zinc-200 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-green-500" />
                  <span>Daftarkan Akun Baru</span>
                </h3>
                
                <form onSubmit={handleCreateAccount} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1 ml-0.5">Email Akun</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="pegawai@gmail.com"
                      required
                      className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1 ml-0.5">Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 karakter"
                      required
                      className="w-full bg-zinc-50 dark:bg-black/40 border border-zinc-200 dark:border-white/5 text-zinc-900 dark:text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1 ml-0.5">Role / Hak Akses</label>
                    <div className="flex bg-zinc-100 dark:bg-black/50 p-1 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => setNewRole("admin")}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          newRole === "admin"
                            ? "bg-white dark:bg-[#2C2C2E] text-blue-600 dark:text-blue-400 shadow-sm"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        }`}
                      >
                        Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRole("super admin")}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                          newRole === "super admin"
                            ? "bg-white dark:bg-[#2C2C2E] text-purple-600 dark:text-purple-400 shadow-sm"
                            : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        }`}
                      >
                        Super Admin
                      </button>
                    </div>
                  </div>

                  {createError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <p className="font-semibold leading-none">{createError}</p>
                    </div>
                  )}

                  {createSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
                      <UserCheck className="w-4 h-4 shrink-0" />
                      <p className="font-semibold leading-none">{createSuccess}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={creatingAccount}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 text-sm mt-2"
                  >
                    {creatingAccount ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Mendaftarkan...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        <span>Daftarkan Akun</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-4 leading-normal flex items-start gap-1">
                <Shield className="w-3.5 h-3.5 shrink-0 text-blue-500 mt-0.5" />
                <span>Super Admin memiliki hak penuh untuk mengakses Page Owner & Pengaturan. Akun Root Owner (owner@gmail.com) diproteksi dan tidak dapat dihapus.</span>
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* NEW WIDGET: MONITORING ABSEN */}
      <Section title="Monitoring Absen Pegawai">
         {/* TOP CONTROL: TANGGAL MULAI HITUNG ABSENSI (CUTOFF) */}
         <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-500/15 dark:via-indigo-500/15 dark:to-purple-500/15 border border-blue-200/80 dark:border-blue-500/20 rounded-2xl p-4 sm:p-5 mb-4 shadow-sm w-full">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex items-start sm:items-center gap-3">
               <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20 shrink-0">
                 <CalendarDays className="w-5 h-5" />
               </div>
               <div>
                 <div className="flex items-center gap-2 flex-wrap">
                   <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wide">
                     Tanggal Mulai Hitung Absensi
                   </h4>
                   <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                     Siklus 1 Bulan
                   </span>
                 </div>
                 <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                   {cutoffDay <= 1 
                     ? "Absensi & potongan denda dihitung normal (Tanggal 1 s/d Akhir Bulan)."
                     : `Absensi & potongan denda dihitung per siklus 1 bulan (Tgl ${cutoffDay} bulan lalu s/d Tgl ${cutoffDay - 1} bulan ini).`}
                 </p>
               </div>
             </div>

             {/* SELECTOR / CONTROLLER */}
             <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
               <div className="flex flex-col items-end">
                 <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tanggal Cutoff</span>
                 <div className="flex items-center gap-2 mt-1">
                   {isOwner ? (
                     <select
                       value={cutoffDay}
                       onChange={async (e) => {
                         const val = Number(e.target.value);
                         const newCfg = { ...absenConfig, tanggalMulaiHitung: val };
                         setAbsenConfig(newCfg);
                         try {
                           await setDoc(doc(db, "data", "settings"), { absenConfig: newCfg }, { merge: true });
                         } catch (err) {
                           console.error("Gagal simpan tanggal cutoff:", err);
                         }
                       }}
                       className="bg-white dark:bg-[#1C1C1E] border border-blue-300 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 font-black text-sm rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                     >
                       <option value={1}>Tgl 1 (Awal Bulan Normal)</option>
                       {Array.from({ length: 30 }, (_, i) => i + 2).map((tgl) => (
                         <option key={tgl} value={tgl}>
                           Tanggal {tgl}
                         </option>
                       ))}
                     </select>
                   ) : (
                     <span className="bg-white dark:bg-[#1C1C1E] border border-blue-300 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 font-black text-sm rounded-xl px-3 py-2 shadow-sm">
                       Tanggal {cutoffDay}
                     </span>
                   )}
                 </div>
               </div>
             </div>
           </div>
         </div>

         {!isLogAbsensiLoaded ? (
            <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1C1C1E] border border-zinc-200 dark:border-white/10 rounded-2xl p-8 text-center shadow-sm w-full">
                <p className="text-zinc-500 font-medium text-sm mb-4 max-w-md">Data absensi (log waktu & bukti foto) tidak dimuat secara otomatis untuk mengoptimalkan kuota pembacaan _database_ Bapak.</p>
                <button onClick={loadDataAbsensi} disabled={loadingLogAbsensi} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2">
                    {loadingLogAbsensi ? (
                       <>
                         <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         Memuat Data...
                       </>
                    ) : "Muat Riwayat Absensi"}
                </button>
            </div>
         ) : (
            <div className="flex flex-col gap-4 w-full animate-in fade-in duration-500">
               {groupedLogAbsensi.length === 0 && (
                   <div className="bg-white dark:bg-[#1C1C1E] border border-zinc-200 dark:border-white/10 rounded-2xl p-8 text-center shadow-sm">
                      <p className="text-zinc-500 font-medium">Belum ada rekam jejak absensi (waktu dan foto).</p>
                   </div>
               )}
            
               {groupedLogAbsensi.map(([bulan, weeks, totalDays, monthlySummary, labelPeriode]) => {
                 const isBulanExpanded = expandedLogBulan.includes(bulan);

                 return (
                    <div key={bulan} className="bg-white dark:bg-[#1C1C1E] rounded-3xl border border-zinc-200 dark:border-white/10 overflow-hidden shadow-sm transition-all duration-300">
                       
                       {/* HEADER BULAN / SIKLUS */}
                       <div 
                          onClick={() => toggleLogBulan(bulan)}
                          className="flex items-center justify-between p-5 cursor-pointer active:bg-zinc-50 dark:active:bg-white/5 transition-colors"
                       >
                          <div className="flex items-center gap-4">
                             <div className={`p-2.5 rounded-[14px] border transition-colors ${isBulanExpanded ? 'bg-blue-100 border-blue-200 text-blue-600 dark:bg-blue-500/20 dark:border-blue-500/30 dark:text-blue-400' : 'bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-white/5 dark:border-white/5 dark:text-zinc-400'}`}>
                                <svg className={`w-5 h-5 transition-transform duration-300 ${isBulanExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                   <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                             </div>
                             <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="text-sm font-black uppercase tracking-wider text-zinc-900 dark:text-white">Bulan <span className="text-blue-500">{bulan}</span></h3>
                                  {labelPeriode && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                      {labelPeriode}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] font-bold text-zinc-400 mt-0.5">{totalDays} Hari · {weeks.length} Minggu</p>
                             </div>
                          </div>
                       </div>

                       {/* LIST WEEK */}
                       {isBulanExpanded && (
                          <div className="flex flex-col gap-3 p-5 pt-0 bg-zinc-50/50 dark:bg-black/10 border-t border-zinc-200 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                             
                             {/* MONTHLY SUMMARY TABLE */}
                             {monthlySummary && monthlySummary.size > 0 && (
                                <div className="mt-4 mb-2 bg-gradient-to-br from-indigo-50/80 to-blue-50/50 dark:from-indigo-500/10 dark:to-blue-500/5 rounded-2xl border border-indigo-100/80 dark:border-indigo-500/20 overflow-hidden shadow-sm">
                                   <div className="px-4 py-3 border-b border-indigo-100/60 dark:border-indigo-500/10 flex items-center gap-2">
                                      <Activity size={14} className="text-indigo-500" />
                                      <span className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Ringkasan Shift Bulan {bulan}</span>
                                   </div>
                                   <div className="overflow-x-auto bg-white/20 dark:bg-black/20">
                                      <table className="w-full text-xs">
                                         <thead>
                                            <tr className="border-b border-indigo-100/40 dark:border-indigo-500/10 bg-indigo-50/30 dark:bg-white/2">
                                               <th className="text-left px-4 py-2.5 font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Pegawai</th>
                                               <th className="text-center px-3 py-2.5 font-bold text-blue-500 uppercase tracking-wider">Pagi</th>
                                               <th className="text-center px-3 py-2.5 font-bold text-orange-500 uppercase tracking-wider">Sore</th>
                                               <th className="text-center px-3 py-2.5 font-bold text-amber-500 uppercase tracking-wider">Libur</th>
                                               <th className="text-center px-3 py-2.5 font-bold text-zinc-400 uppercase tracking-wider">Total</th>
                                            </tr>
                                         </thead>
                                         <tbody>
                                            {Array.from(monthlySummary.values()).map((s: any) => (
                                               <tr key={s.email} className="border-b border-indigo-50/60 dark:border-indigo-500/5 last:border-0 hover:bg-indigo-50/20 dark:hover:bg-white/1">
                                                  <td className="px-4 py-2.5 font-bold text-zinc-800 dark:text-zinc-200 capitalize">{s.email.split("@")[0]}</td>
                                                  <td className="text-center px-3 py-2.5">
                                                     <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md font-black ${s.pagi > 0 ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{s.pagi}</span>
                                                  </td>
                                                  <td className="text-center px-3 py-2.5">
                                                     <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md font-black ${s.sore > 0 ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{s.sore}</span>
                                                  </td>
                                                  <td className="text-center px-3 py-2.5">
                                                     <span className={`inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md font-black ${s.libur > 0 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{s.libur}</span>
                                                  </td>
                                                  <td className="text-center px-3 py-2.5">
                                                     <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-md font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">{s.pagi + s.sore + s.libur}</span>
                                                  </td>
                                               </tr>
                                            ))}
                                         </tbody>
                                      </table>
                                   </div>
                                </div>
                             )}

                             {weeks.map((week) => {
                                const keyMinggu = `${bulan}_w${week.weekNum}`;
                                const isMingguExpanded = expandedLogMinggu.includes(keyMinggu);
                                const jumlahHariMinggu = week.days.size;

                                return (
                                   <div key={keyMinggu} className="bg-white dark:bg-[#202022] rounded-2xl border border-zinc-200/60 dark:border-white/5 overflow-hidden shadow-sm hover:border-zinc-300 dark:hover:border-white/10 transition-all">
                                      {/* HEADER WEEK */}
                                      <div 
                                         onClick={() => toggleLogMinggu(keyMinggu)}
                                         className="flex items-center justify-between p-4 cursor-pointer active:bg-zinc-50 dark:active:bg-white/5 transition-colors"
                                      >
                                         <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl border transition-colors ${
                                              isMingguExpanded 
                                                ? 'bg-indigo-100 border-indigo-200 text-indigo-600 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-400' 
                                                : 'bg-zinc-100 border-zinc-200 text-zinc-400 dark:bg-white/5 dark:border-white/5 dark:text-zinc-500'
                                            }`}>
                                               <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
                                               </svg>
                                            </div>
                                            <div>
                                               <div className="text-[13px] font-black text-zinc-800 dark:text-zinc-200">
                                                  {week.weekLabel} <span className="font-bold text-indigo-500 dark:text-indigo-400">({week.dateRange})</span>
                                               </div>
                                               <div className="text-[10px] font-bold text-zinc-400 mt-0.5">{jumlahHariMinggu} Hari Tercatat</div>
                                            </div>
                                         </div>
                                         <ChevronDown size={18} className={`text-zinc-400 transition-transform duration-300 ${isMingguExpanded ? 'rotate-180 text-indigo-500' : ''}`} />
                                      </div>

                                      {/* WEEK CONTENT: Summary + Days */}
                                      {isMingguExpanded && (
                                         <div className="border-t border-zinc-100 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                                            
                                            {/* LIST HARI DALAM WEEK */}
                                            <div className="flex flex-col gap-2.5 p-4">
                                               {Array.from(week.days.entries()).map(([hari, listPegawai]) => {
                                                  const keyHari = `${keyMinggu}_${hari}`;
                                                  const isHariExpanded = expandedLogHari.includes(keyHari);

                                                  return (
                                                     <div key={keyHari} className="bg-zinc-50 dark:bg-[#1C1C1E] rounded-xl border border-zinc-200/50 dark:border-white/5 overflow-hidden shadow-sm hover:border-zinc-300 dark:hover:border-white/10 transition-all">
                                                        <div 
                                                           onClick={() => toggleLogHari(keyHari)}
                                                           className="flex items-center justify-between p-3.5 cursor-pointer active:bg-zinc-100 dark:active:bg-white/5 transition-colors"
                                                        >
                                                           <div className="flex items-center gap-3">
                                                              <div className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300">{hari}</div>
                                                              <div className="px-2 py-0.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg">{listPegawai.length} Pegawai</div>
                                                           </div>
                                                           <ChevronDown size={16} className={`text-zinc-400 transition-transform duration-300 ${isHariExpanded ? 'rotate-180 text-blue-500' : ''}`} />
                                                        </div>

                                                        {/* LIST ORANG DALAM HARI TERSEBUT */}
                                                        {isHariExpanded && (
                                                           <div className="flex flex-col gap-3 p-3.5 pt-1 border-t border-zinc-100 dark:border-white/5 bg-white/50 dark:bg-black/20">
                                                              {listPegawai.map((pData: any, idx: number) => (
                                                                 <div key={`pegawai-${idx}`} className="flex flex-col sm:flex-row items-center gap-4 bg-white dark:bg-[#1C1C1E] border border-zinc-200/50 dark:border-white/5 p-4 rounded-xl shadow-sm">
                                                                    {/* Nama Admin */}
                                                                    <div className="flex items-center gap-3 w-full sm:w-[220px] shrink-0">
                                                                       <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold font-mono text-sm border-2 border-white dark:border-[#2C2C2E] shadow-sm uppercase shrink-0">
                                                                          {pData.email.charAt(0)}
                                                                       </div>
                                                                       <div className="flex flex-col min-w-0">
                                                                          <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 capitalize truncate">{pData.email.split("@")[0]}</span>
                                                                          <span className={`text-[10px] font-bold uppercase tracking-wider ${pData.shift?.includes('Sore') ? 'text-orange-500' : pData.shift?.includes('Pagi') ? 'text-blue-500' : 'text-zinc-500 dark:text-zinc-400'}`}>{pData.shift || 'Shift belum tercatat'}</span>
                                                                       </div>
                                                                    </div>

                                                                    {/* Status Absen */}
                                                                    <div className="flex w-full items-center gap-3 bg-zinc-50 dark:bg-[#252528] rounded-xl border border-zinc-200/50 dark:border-white/5 p-1.5 flex-1 overflow-x-auto min-w-0">
                                                                        
                                                                        {pData.isLibur ? (
                                                                           <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg w-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[13px] italic">
                                                                               <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 11-1 9"></path><path d="m19 11-4-7"></path><path d="M2 11h20"></path><path d="m3 11 1.67-5.38a2 2 0 0 1 1.9-1.39h7.18a2 2 0 0 1 1.8 1.11L19 11"></path><path d="m9 11 1 9"></path></svg>
                                                                               Pegawai Sedang Libur
                                                                           </div>
                                                                        ) : (
                                                                          <>
                                                                            {/* Masuk */}
                                                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg w-1/2 min-w-[130px] border-r border-zinc-200/50 dark:border-white/5">
                                                                                <div className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                                                   <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                   <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Jam Masuk</span>
                                                                                   <div className="flex items-center gap-1.5 mt-0.5">
                                                                                       <span className={`text-[13px] font-black tabular-nums ${pData.waktuMasuk === '-' ? 'text-zinc-400' : 'text-emerald-500 dark:text-emerald-400'}`}>{pData.waktuMasuk}</span>
                                                                                       {pData.photoMasuk && (
                                                                                           <button onClick={() => setPhotoPopup(pData.photoMasuk)} className="group flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer" title="Lihat Foto Bukti">
                                                                                              <Camera className="w-3 h-3 group-active:scale-95 transition-transform" />
                                                                                           </button>
                                                                                       )}
                                                                                   </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* Pulang */}
                                                                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg w-1/2 min-w-[130px]">
                                                                                <div className={`w-6 h-6 rounded-md ${pData.waktuPulang !== '-' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'} flex items-center justify-center shrink-0`}>
                                                                                   {pData.waktuPulang !== '-' ? (
                                                                                       <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                                                                   ) : (
                                                                                       <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                                                   )}
                                                                                </div>
                                                                                <div className="flex flex-col">
                                                                                   <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Jam Pulang</span>
                                                                                   <div className="flex items-center gap-1.5 mt-0.5">
                                                                                       <span className={`text-[13px] font-black tabular-nums ${pData.waktuPulang === '-' ? 'text-orange-500 dark:text-orange-400 italic font-medium opacity-80' : 'text-indigo-500 dark:text-indigo-400'}`}>
                                                                                           {pData.waktuPulang === '-' ? 'Belum' : pData.waktuPulang}
                                                                                       </span>
                                                                                       {pData.photoPulang && (
                                                                                           <button onClick={() => setPhotoPopup(pData.photoPulang)} className="group flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer" title="Lihat Foto Bukti">
                                                                                              <Camera className="w-3 h-3 group-active:scale-95 transition-transform" />
                                                                                           </button>
                                                                                       )}
                                                                                   </div>
                                                                                </div>
                                                                            </div>
                                                                          </>
                                                                        )}

                                                                    </div>
                                                                 </div>
                                                              ))}
                                                           </div>
                                                        )}
                                                     </div>
                                                  );
                                               })}
                                            </div>
                                         </div>
                                      )}
                                   </div>
                                );
                             })}
                          </div>
                       )}
                    </div>
                 );
             })}
         </div>
         )}
      </Section>

      {/* WIDGET GAJI */}
      <Section title="Manajemen Gaji Pegawai">
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
            {pegawaiData.length === 0 && <p className="text-zinc-500 text-sm px-2">Belum ada pegawai terdeteksi di sistem.</p>}
            {pegawaiData.map((p, i) => (
                <PegawaiCard key={i} pegawai={p} onSave={handleSaveGaji} isOwner={isOwner} />
            ))}
         </div>
      </Section>

      {/* WIDGET RANGKUMAN GAJI PEGAWAI */}
      <Section title="Rangkuman Gaji Pegawai">
         <div className="flex flex-col gap-8 w-full">
            {groupedByMonth.length === 0 && <p className="text-zinc-500 text-sm px-2">Belum ada riwayat gaji di sistem.</p>}
            {groupedByMonth.map(([bulan, records]) => (
                <RangkumanBulanItem key={bulan} bulan={bulan} records={records} cutoffDay={cutoffDay} />
            ))}
         </div>
      </Section>

      {/* WIDGET RANGKUMAN ONGKIR PEGAWAI */}
      <Section title="Rangkuman Ongkir Pegawai (Berdasarkan Tanggal)">
         <div className="flex flex-col gap-6 w-full animate-in fade-in duration-300">
            {/* Date Pickers - Apple style layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full bg-zinc-50 dark:bg-zinc-900/30 p-4 rounded-2xl border border-zinc-200/50 dark:border-white/5">
               <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/5 transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
                  <CalendarDays className="text-zinc-400 dark:text-zinc-500" size={18} />
                  <div className="flex flex-col flex-1">
                     <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Dari Tanggal</span>
                     <input
                        type="date"
                        value={ongkirStart}
                        onChange={(e) => setOngkirStart(e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none dark:text-zinc-100 min-h-[20px] font-mono p-0 border-none focus:ring-0"
                     />
                  </div>
               </div>

               <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/5 transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
                  <CalendarRange className="text-zinc-400 dark:text-zinc-500" size={18} />
                  <div className="flex flex-col flex-1">
                     <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Sampai Tanggal</span>
                     <input
                        type="date"
                        value={ongkirEnd}
                        onChange={(e) => setOngkirEnd(e.target.value)}
                        className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none dark:text-zinc-100 min-h-[20px] font-mono p-0 border-none focus:ring-0"
                     />
                  </div>
               </div>
            </div>

             {/* Total Delivery Fees Report List */}
             {ongkirReport.length === 0 ? (
                <div className="text-center py-8 bg-zinc-50 dark:bg-zinc-900/10 rounded-2xl border border-dashed border-zinc-200 dark:border-white/5">
                   <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium">Tidak ada data ongkir pegawai dalam rentang tanggal ini.</p>
                </div>
             ) : (
                <div className="flex flex-col gap-3">
                   <div className="flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      <span>Pegawai</span>
                      <span>Total Ongkir</span>
                   </div>
                   
                   <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] border border-zinc-200 dark:border-white/10 overflow-hidden divide-y divide-zinc-200 dark:divide-white/5">
                      {ongkirReport.map((item) => (
                         <div key={item.email} className="flex items-center justify-between px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <UserAvatar
                                  photoUrl={item.photoUrl}
                                  email={item.email}
                                  name={item.name}
                                  profileColor={item.profileColor}
                                  size="lg"
                                />
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 capitalize">{item.name}</span>
                                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{item.email}</span>
                               </div>
                            </div>
                            <div className="text-right flex flex-col">
                               <span className="text-sm font-black text-purple-600 dark:text-purple-400">{rupiah(item.total)}</span>
                            </div>
                         </div>
                      ))}
                   </div>

                   <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-200 dark:border-purple-500/20 rounded-2xl px-6 py-4 flex items-center justify-between mt-2">
                      <div className="flex flex-col">
                         <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-widest">Total Ongkir Keseluruhan</span>
                         <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-300/80 mt-0.5">Dari {new Date(ongkirStart).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })} s/d {new Date(ongkirEnd).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <span className="text-lg font-black text-purple-700 dark:text-purple-400">
                         {rupiah(ongkirReport.reduce((acc, item) => acc + item.total, 0))}
                      </span>
                   </div>
                </div>
             )}
         </div>
      </Section>

      {/* POPUP FOTO BUKTI */}
      {photoPopup && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPhotoPopup(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setPhotoPopup(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-md transition-all z-10"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
            <img src={photoPopup} alt="Bukti Absen" className="w-full object-contain" style={{ maxHeight: '70vh' }} />
            <div className="p-4 text-center bg-zinc-50 dark:bg-[#252528] border-t border-zinc-200 dark:border-white/5">
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Foto Bukti Kehadiran</p>
              <p className="text-[11px] font-medium text-zinc-500 mt-0.5">Disimpan secara real-time saat absen</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const PegawaiCard = ({ pegawai, onSave, isOwner = false }: any) => {
    const [records, setRecords] = useState<any[]>(pegawai.records || []);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);

    // Sync state when DB updates
    useEffect(() => {
        setRecords(pegawai.records || []);
    }, [pegawai]);

    const handleAddRecord = () => {
        const d = new Date();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yy = String(d.getFullYear()).slice(-2);
        const newId = `rec-${Date.now()}`;

        let defaultPokok = Number(pegawai.gajiPokok) || 0;
        if (defaultPokok === 0 && records.length > 0) {
            for (const r of records) {
                const v = Number(r.gajiPokok) || 0;
                if (v > 0) { defaultPokok = v; break; }
            }
        }
        if (defaultPokok === 0) defaultPokok = 1500000;

        const newRecord = {
             id: newId,
             bulanTahun: `${mm}/${yy}`,
             gajiPokok: defaultPokok,
             bonus: 0,
             potongan: 0,
             gajiTambahan: [],
             gajiPengurangan: [],
             ketPemasukan: "",
             ketPengeluaran: "",
             buktiTransfer: ""
        };
        setRecords([newRecord, ...records]);
        setExpandedRecordId(newId);
    };

    const handleUpdateRecord = (id: string, patch: any) => {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    };

    const handleDeleteRecord = (id: string) => {
        if(confirm("Yakin ingin menghapus rekam gaji ini?")) {
            setRecords(prev => prev.filter(r => r.id !== id));
        }
    };

    const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => handleUpdateRecord(id, { buktiTransfer: reader.result as string });
            reader.readAsDataURL(file);
        }
    };

    const isChanged = JSON.stringify(records) !== JSON.stringify(pegawai.records || []);

    const handleSave = () => {
        onSave(pegawai.email, records);
    };

    return (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-4">
            
            {/* Header User */}
            <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-3 w-full">
                    <UserAvatar
                      photoUrl={pegawai.photoUrl}
                      email={pegawai.email}
                      profileColor={pegawai.profileColor}
                      size="xl"
                    />
                    <div className="flex-1 min-w-0">
                       <h3 className="text-sm font-bold text-zinc-900 dark:text-white truncate">{pegawai.email.split("@")[0].toUpperCase()}</h3>
                       <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{pegawai.email}</p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 pl-2 border-l border-zinc-100 dark:border-white/5">
                        <span className="text-[10px] uppercase font-bold text-pink-500">Logins</span>
                        <span className="text-sm font-black text-zinc-900 dark:text-white">{pegawai.loginsCount}</span>
                    </div>
                </div>
            </div>

            {/* List Gaji with internal scrolling if too long */}
            <div className="flex flex-col gap-3 min-h-[150px] w-full">
                {records.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-xs font-medium text-zinc-400 italic py-8 border-2 border-dashed border-zinc-200 dark:border-white/5 rounded-2xl">
                        Belum ada riwayat gaji.
                    </div>
                )}
                {records.map(r => {
                    const isExpanded = expandedRecordId === r.id;
                    const hitungTambahanBelumDibayar = (r.gajiTambahan || []).filter((t: any) => t.status !== 'sudah').reduce((sum: number, item: any) => sum + (Number(item.nominal) || 0), 0);
                    const hitungPengurangan = (r.gajiPengurangan || []).filter((item: any) => !item.isDibatalkan).reduce((sum: number, item: any) => sum + (Number(item.nominal) || 0), 0);
                    const totalBersih = (Number(r.gajiPokok) || 0) + hitungTambahanBelumDibayar + (Number(r.ongkirMasukGajiBulanIni) || 0) - hitungPengurangan;
                    return (
                        <div key={r.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-zinc-50/50 dark:bg-black/30 transition-colors w-full">
                            <div 
                                className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors select-none" 
                                onClick={() => setExpandedRecordId(isExpanded ? null : r.id)}
                            >
                                <span className="font-bold text-[13px] text-zinc-900 dark:text-white uppercase tracking-wide">
                                    Gaji bulan {r.bulanTahun}
                                </span>
                                <div className="flex items-center gap-3">
                                    <span className="text-[13px] font-black text-emerald-600 dark:text-emerald-400">{rupiah(Math.max(0, totalBersih))}</span>
                                    <ChevronDown size={14} className={`text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                   
                                   <div className="flex justify-between items-end gap-3 w-full">
                                      <div className="flex-1">
                                        <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 mb-1.5 block">Bulan & Tahun</label>
                                        <input type="text" value={r.bulanTahun} onChange={e => handleUpdateRecord(r.id, { bulanTahun: e.target.value })} placeholder="MM/YY" className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/50" />
                                      </div>
                                      <button onClick={() => handleDeleteRecord(r.id)} className="h-9 w-9 flex items-center justify-center shrink-0 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors" title="Hapus Gaji Ini">
                                         <Trash2 size={16} />
                                      </button>
                                   </div>

                                   <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 mb-1.5 block">Gaji Pokok</label>
                                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={r.gajiPokok} onChange={e => handleUpdateRecord(r.id, { gajiPokok: e.target.value })} className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
                                   </div>

                                   <div className="w-full space-y-2">
                                       <div className="flex items-center justify-between">
                                           <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 block">Gaji Tambahan</label>
                                              <button onClick={() => {
                                                  const newTb = [...(r.gajiTambahan || []), { id: Date.now() + 'tb', nominal: 0, ket: "Tambahan", status: "belum" }];
                                                  handleUpdateRecord(r.id, { gajiTambahan: newTb });
                                              }} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded-md">
                                                <Plus size={10} strokeWidth={3} /> Tambah
                                              </button>
                                       </div>
                                       {(r.gajiTambahan || []).map((tb: any, i: number) => (
                                          <div key={tb.id || i} className="flex flex-col gap-2 w-full bg-zinc-50 dark:bg-zinc-900/30 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                              <div className="flex gap-2 items-center w-full">
                                                  <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={tb.nominal} onChange={e => {
                                                      const newTb = [...r.gajiTambahan];
                                                      newTb[i] = { ...newTb[i], nominal: e.target.value };
                                                      handleUpdateRecord(r.id, { gajiTambahan: newTb });
                                                  }} className="flex-1 min-w-0 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 outline-none" placeholder="Nominal" />
                                                  <input type="text" value={tb.ket} onChange={e => {
                                                      const newTb = [...r.gajiTambahan];
                                                      newTb[i] = { ...newTb[i], ket: e.target.value };
                                                      handleUpdateRecord(r.id, { gajiTambahan: newTb });
                                                  }} className="flex-1 min-w-0 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm font-medium text-zinc-900 dark:text-white outline-none" placeholder="Keterangan" />
                                                  <button onClick={() => {
                                                      const newTb = r.gajiTambahan.filter((_: any, idx: number) => idx !== i);
                                                      handleUpdateRecord(r.id, { gajiTambahan: newTb });
                                                  }} className="h-9 w-9 flex items-center justify-center shrink-0 bg-red-100 text-red-500 rounded-lg hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20 transition-colors">
                                                      <Trash2 size={14} />
                                                  </button>
                                              </div>
                                              <div className="flex bg-zinc-200/50 dark:bg-black/40 p-1 rounded-lg">
                                                  <button onClick={() => {
                                                      const newTb = [...r.gajiTambahan];
                                                      newTb[i] = { ...newTb[i], status: 'belum' };
                                                      handleUpdateRecord(r.id, { gajiTambahan: newTb });
                                                  }} className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-colors ${tb.status !== 'sudah' ? 'bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200/50 dark:border-amber-500/10' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Belum Dibayar</button>
                                                  <button onClick={() => {
                                                      const newTb = [...r.gajiTambahan];
                                                      newTb[i] = { ...newTb[i], status: 'sudah' };
                                                      handleUpdateRecord(r.id, { gajiTambahan: newTb });
                                                  }} className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-colors ${tb.status === 'sudah' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-200/50 dark:border-emerald-500/10' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Sudah Dibayar</button>
                                              </div>
                                          </div>
                                       ))}
                                   </div>

                                   {(Boolean(r.isAutoGenerated) || r.ongkirBulanIni > 0) && (
                                     <div className="grid grid-cols-2 gap-3 w-full mt-2 mb-3">
                                        <div className="w-full">
                                           <label className="text-[10px] font-bold uppercase tracking-wide text-purple-500 mb-1.5 block">Total Ongkir (Otomatis)</label>
                                           <div className="w-full bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20 rounded-lg px-3 py-2 flex items-center justify-between overflow-hidden">
                                              <span className="text-sm font-bold text-purple-600 dark:text-purple-400">+ Rp {Number(r.ongkirBulanIni || 0).toLocaleString("id-ID")}</span>
                                              <span className="text-[8px] sm:text-[9px] font-bold uppercase text-purple-600/50 dark:text-purple-400/50 text-right shrink-0 ml-1">Dari Histori</span>
                                           </div>
                                        </div>
                                        <div className="w-full flex flex-col justify-end">
                                            {(Number(r.ongkirMasukGajiBulanIni) || 0) > 0 ? (
                                               <span className="text-[9px] font-extrabold uppercase bg-emerald-100/80 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-md w-fit">✓ Masuk Gaji</span>
                                            ) : (
                                               <span className="text-[9px] font-extrabold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded-md w-fit">Tidak Masuk Gaji</span>
                                            )}
                                        </div>
                                     </div>
                                   )}
                                   {(() => {
                                     const dendaTelatAktif = (r.gajiPengurangan || []).filter((pg: any) => pg._isAutoSistem && !pg.isDibatalkan).reduce((sum: number, pg: any) => sum + (Number(pg.nominal) || 0), 0);
                                     const dendaAbsenAktif = Number(r.dendaAbsen) || 0;
                                     const totalDendaAktif = dendaTelatAktif + dendaAbsenAktif;
                                     if (totalDendaAktif <= 0) return null;
                                     return (
                                       <div className="w-full bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-xl p-3 flex items-center justify-between">
                                         <div className="flex flex-col">
                                           <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">Total Denda Absensi (⚡ Auto)</span>
                                           <span className="text-sm font-black text-rose-600 dark:text-rose-400">- Rp {totalDendaAktif.toLocaleString("id-ID")}</span>
                                         </div>
                                         <span className="text-[9px] font-bold uppercase bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-md">
                                           {dendaTelatAktif > 0 && `Telat: -Rp ${dendaTelatAktif.toLocaleString("id-ID")}`}
                                           {dendaTelatAktif > 0 && dendaAbsenAktif > 0 && ' · '}
                                           {dendaAbsenAktif > 0 && `Bolos/Pulang: -Rp ${dendaAbsenAktif.toLocaleString("id-ID")}`}
                                         </span>
                                       </div>
                                     );
                                   })()}

                                   <div className="w-full space-y-2">
                                       <div className="flex items-center justify-between">
                                           <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 block">Gaji Pengurangan</label>
                                               <button onClick={() => {
                                                   const newPg = [...(r.gajiPengurangan || []), { id: Date.now() + 'pg', nominal: 0, ket: "Pengurangan", isDibatalkan: false }];
                                                   handleUpdateRecord(r.id, { gajiPengurangan: newPg });
                                               }} className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1 bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-md">
                                                 <Plus size={10} strokeWidth={3} /> Tambah
                                               </button>
                                       </div>
                                       {(r.gajiPengurangan || []).map((pg: any, i: number) => {
                                          const isCanceled = Boolean(pg.isDibatalkan);
                                          return (
                                            <div 
                                              key={pg.id || pg._idempKey || i} 
                                              className={`flex flex-col gap-2 w-full p-2.5 rounded-xl border transition-all ${
                                                isCanceled 
                                                  ? 'bg-zinc-100/70 dark:bg-zinc-900/30 border-dashed border-zinc-300 dark:border-zinc-700/60 opacity-75' 
                                                  : 'bg-zinc-50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800'
                                              }`}
                                            >
                                                <div className="flex gap-2 items-center w-full">
                                                    <input 
                                                      type="number" 
                                                      inputMode="numeric" 
                                                      pattern="[0-9]*" 
                                                      min="0" 
                                                      value={pg.nominal} 
                                                      onChange={e => {
                                                        const newPg = [...r.gajiPengurangan];
                                                        newPg[i] = { ...newPg[i], nominal: e.target.value };
                                                        handleUpdateRecord(r.id, { gajiPengurangan: newPg });
                                                      }} 
                                                      className={`flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm font-bold outline-none transition-colors ${
                                                        isCanceled
                                                          ? 'line-through text-zinc-400 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700'
                                                          : 'bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 text-red-500'
                                                      }`} 
                                                      placeholder="Nominal" 
                                                    />
                                                    <input 
                                                      type="text" 
                                                      value={pg.ket} 
                                                      onChange={e => {
                                                        const newPg = [...r.gajiPengurangan];
                                                        newPg[i] = { ...newPg[i], ket: e.target.value };
                                                        handleUpdateRecord(r.id, { gajiPengurangan: newPg });
                                                      }} 
                                                      className={`flex-1 min-w-0 border rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors ${
                                                        isCanceled
                                                          ? 'line-through text-zinc-400 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700'
                                                          : 'bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white'
                                                      }`} 
                                                      placeholder="Keterangan" 
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 justify-end flex-wrap">
                                                    {pg._isAutoSistem && (
                                                      <span className="text-[9px] font-bold uppercase tracking-wider text-orange-500 bg-orange-50 dark:bg-orange-500/10 px-2 py-0.5 rounded-md mr-auto">
                                                        ⚡ Auto-Sistem
                                                      </span>
                                                    )}
                                                    {isCanceled && (
                                                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-md mr-auto flex items-center gap-1">
                                                        <Ban size={10} /> Dicoret (Tidak Memotong Gaji)
                                                      </span>
                                                    )}
                                                    {pg.photoUrl && (
                                                      <a href={pg.photoUrl} target="_blank" rel="noreferrer" className="h-8 w-8 flex items-center justify-center shrink-0 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20 transition-colors" title="Lihat Foto Bukti Telat">
                                                          <Camera size={14} />
                                                      </a>
                                                    )}
                                                    {isOwner && (
                                                      <>
                                                        {isCanceled ? (
                                                          <button 
                                                            onClick={() => {
                                                              const newPg = [...r.gajiPengurangan];
                                                              newPg[i] = { ...newPg[i], isDibatalkan: false };
                                                              handleUpdateRecord(r.id, { gajiPengurangan: newPg });
                                                            }} 
                                                            className="h-8 px-3 flex items-center justify-center gap-1.5 shrink-0 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20 transition-colors text-[11px] font-bold" 
                                                            title="Lepas Coretan (Aktifkan Kembali Pemotongan)"
                                                          >
                                                              <RotateCcw size={12} /> Undo Coret
                                                          </button>
                                                        ) : (
                                                          <button 
                                                            onClick={() => {
                                                              const isAuto = Boolean(pg._isAutoSistem);
                                                              if (confirm(isAuto ? "Coret pengurangan otomatis ini? (Pengurangan tidak akan memotong gaji, dan bisa di-undo kapan saja)" : "Yakin ingin menghapus / mencoret pengurangan ini?")) {
                                                                if (isAuto) {
                                                                  const newPg = [...r.gajiPengurangan];
                                                                  newPg[i] = { ...newPg[i], isDibatalkan: true };
                                                                  handleUpdateRecord(r.id, { gajiPengurangan: newPg });
                                                                } else {
                                                                  const newPg = r.gajiPengurangan.filter((_: any, idx: number) => idx !== i);
                                                                  handleUpdateRecord(r.id, { gajiPengurangan: newPg });
                                                                }
                                                              }
                                                            }} 
                                                            className="h-8 px-3 flex items-center justify-center gap-1.5 shrink-0 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 transition-colors text-[11px] font-bold" 
                                                            title={pg._isAutoSistem ? "Coret Pengurangan Otomatis (Bisa di-Undo)" : "Hapus Pengurangan"}
                                                          >
                                                              <Trash2 size={12} /> {pg._isAutoSistem ? "Coret" : "Hapus"}
                                                          </button>
                                                        )}
                                                        {isCanceled && !pg._isAutoSistem && (
                                                          <button 
                                                            onClick={() => {
                                                              if (confirm("Hapus permanen pengurangan manual ini?")) {
                                                                const newPg = r.gajiPengurangan.filter((_: any, idx: number) => idx !== i);
                                                                handleUpdateRecord(r.id, { gajiPengurangan: newPg });
                                                              }
                                                            }} 
                                                            className="h-8 w-8 flex items-center justify-center shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-red-500 rounded-lg transition-colors text-[11px] font-bold" 
                                                            title="Hapus Permanen Baris Manual"
                                                          >
                                                              <Trash2 size={12} />
                                                          </button>
                                                        )}
                                                      </>
                                                    )}
                                                </div>
                                            </div>
                                          );
                                       })}
                                   </div>

                                   {/* NEW FIELD: Gaji yang harus saya bayar */}
                                   <div className="w-full mt-4 mb-2">
                                       <label className="text-[10px] font-bold uppercase tracking-wide text-amber-500 mb-1.5 block">Gaji Yang Harus Saya Bayar</label>
                                       <div className="w-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-4 py-3 flex justify-between items-center">
                                           <span className="text-[10px] font-bold text-amber-600/60 dark:text-amber-400/60 hidden sm:block">POKOK + TAMBAHAN + ONGKIR (JIKA AKTIF) - PENGURANGAN</span>
                                           <span className="text-[10px] font-bold text-amber-600/60 dark:text-amber-400/60 sm:hidden">PK+TB+ONG-KT</span>
                                           <span className="text-lg font-black text-amber-600 dark:text-amber-400">Rp {Math.max(0, totalBersih).toLocaleString("id-ID")}</span>
                                       </div>
                                   </div>

                                   <div>
                                      <label className="text-[10px] font-bold uppercase text-zinc-500 block mb-1">Bukti Transfer (Opsional)</label>
                                      <div className="mt-2 flex items-center gap-4">
                                         {r.buktiTransfer ? (
                                            <div className="relative group w-fit">
                                              <img src={r.buktiTransfer} alt="Bukti Transfer" className="h-16 w-16 object-cover rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm" />
                                              <button 
                                                onClick={() => handleUpdateRecord(r.id, { buktiTransfer: "" })} 
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                                title="Hapus gambar"
                                              >
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                              </button>
                                            </div>
                                         ) : (
                                            <label className="h-16 w-16 flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-black rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                                               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-zinc-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                               <input type="file" accept="image/*" onChange={(e) => handleFileChange(r.id, e)} className="hidden" />
                                            </label>
                                         )}
                                         <div className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[180px]">
                                            {r.buktiTransfer ? "Gambar siap disimpan." : "Upload foto bukti transfer / mutasi."}
                                         </div>
                                      </div>
                                   </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Actions Footer */}
            <div className="flex items-center justify-between pt-4 mt-1 border-t border-zinc-100 dark:border-zinc-800 w-full">
                <button 
                    onClick={handleAddRecord} 
                    className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors active:scale-95"
                >
                    <Plus size={14} strokeWidth={3} /> Gaji
                </button>
                <button 
                  disabled={!isChanged} 
                  onClick={handleSave} 
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 transition-colors text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-1.5 active:scale-95 shadow-md shadow-blue-500/20 disabled:shadow-none"
                >
                   <Save className="w-3.5 h-3.5" /> Simpan
                </button>
            </div>
            
        </div>
    );
};

const RangkumanBulanItem = ({ bulan, records, cutoffDay = 1 }: { bulan: string, records: any[], cutoffDay?: number }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const cycleInfo = useMemo(() => getCycleInfoFromBulanTahun(bulan, cutoffDay), [bulan, cutoffDay]);
    
    let totalSatuBulan = 0;
    records.forEach(r => {
       const pokok = Number(r.gajiPokok) || 0;
       const tambahan = (r.gajiTambahan || []).reduce((sum: number, t: any) => sum + (Number(t.nominal)||0), 0);
       const potongan = (r.gajiPengurangan || []).filter((pg: any) => !pg.isDibatalkan).reduce((sum: number, pg: any) => sum + (Number(pg.nominal)||0), 0);
       const ongkirMasukGaji = Number(r.ongkirMasukGajiBulanIni) || 0;
       totalSatuBulan += Math.max(0, pokok + tambahan + ongkirMasukGaji - potongan);
    });

    return (
       <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] border border-zinc-200 dark:border-white/10 shadow-sm overflow-hidden transition-all duration-300">
           <div 
               onClick={() => setIsExpanded(!isExpanded)}
               className="bg-zinc-100/50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-white/10 px-6 py-5 flex items-center justify-between cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
           >
               <div className="flex items-center gap-3 flex-wrap">
                   <div className="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 p-2 rounded-xl">
                       <Banknote size={20} strokeWidth={2.5} />
                   </div>
                   <div className="flex items-center gap-2 flex-wrap">
                       <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">GAJI {bulan}</h3>
                       {cycleInfo.labelPeriode && (
                           <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                               {cycleInfo.labelPeriode}
                           </span>
                       )}
                   </div>
               </div>
               <div className="flex items-center gap-4">
                   {!isExpanded && (
                       <span className="text-base font-black text-amber-600 dark:text-amber-400">{rupiah(totalSatuBulan)}</span>
                   )}
                   <div className="text-zinc-400 dark:text-zinc-500 bg-white dark:bg-black p-1 rounded-full shadow-sm">
                       {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                   </div>
               </div>
           </div>
           
           {isExpanded && (
               <>
                   <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
                       {records.map((r, i) => {
                           const pokok = Number(r.gajiPokok) || 0;
                           const tambahan = (r.gajiTambahan || []).reduce((sum: number, t: any) => sum + (Number(t.nominal)||0), 0);
                           const potongan = (r.gajiPengurangan || []).filter((pg: any) => !pg.isDibatalkan).reduce((sum: number, pg: any) => sum + (Number(pg.nominal)||0), 0);
                           const ongkirMasukGaji = Number(r.ongkirMasukGajiBulanIni) || 0;
                           const ongkirDisplay = Number(r.ongkirBulanIni) || 0;
                           const bersih = Math.max(0, pokok + tambahan + ongkirMasukGaji - potongan);

                           const pieData = [
                             { name: 'Gaji Pokok', value: pokok },
                             { name: 'Gaji Tambahan', value: tambahan },
                             { name: 'Total Ongkir', value: ongkirDisplay },
                           ];
                                   const chartDataPie = pieData.reduce((acc, curr) => acc + curr.value, 0) > 0 ? pieData : [{ name: 'Belum Ada', value: 1 }];
                           const PIE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6'];

                           return (
                              <div key={i} className="bg-zinc-50 dark:bg-[#202022] p-5 rounded-[20px] border border-zinc-200/50 dark:border-white/5 flex flex-col items-center relative overflow-hidden group">
                                  <div className="flex items-center gap-4 w-full mb-6">
                                      <UserAvatar
                                        photoUrl={r.photoUrl}
                                        email={r.email}
                                        profileColor={r.profileColor}
                                        size="xl"
                                      />
                                     <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate capitalize">{r.email.split("@")[0]}</span>
                                        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">{r.email}</span>
                                     </div>
                                  </div>
                                  <div className="relative w-[140px] h-[140px] mx-auto mb-4">
                                     <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                           <Pie data={chartDataPie} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={2} dataKey="value" stroke="none">
                                              {chartDataPie.map((_, idx) => (
                                                 <Cell key={`cell-${idx}`} fill={chartDataPie[0].name === 'Belum Ada' ? '#52525b' : PIE_COLORS[idx % PIE_COLORS.length]} />
                                              ))}
                                           </Pie>
                                           {chartDataPie[0].name !== 'Belum Ada' && <RechartsTooltip formatter={(val: number) => rupiah(val)} contentStyle={{ borderRadius: '12px', background: 'rgba(28,28,30,0.95)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600 }} itemStyle={{ color: '#e4e4e7' }} />}
                                        </PieChart>
                                     </ResponsiveContainer>
                                     <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Bersih</span>
                                        <span className="text-[12px] font-black text-emerald-500">{rupiah(bersih)}</span>
                                     </div>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-2 w-full mt-2">
                                     <div className="bg-white dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-100 dark:border-white/5 flex flex-col">
                                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Gaji Pokok</div>
                                        <div className="text-xs font-black text-blue-500">{rupiah(pokok)}</div>
                                     </div>
                                     <div className="bg-white dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-100 dark:border-white/5 flex flex-col">
                                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Penambahan</div>
                                        <div className="text-xs font-black text-emerald-500">{rupiah(tambahan)}</div>
                                     </div>
                                     <div className="bg-white dark:bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-100 dark:border-white/5 flex flex-col">
                                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5">Ongkir</div>
                                        <div className="text-xs font-black text-purple-500">{rupiah(ongkirDisplay)}</div>
                                     </div>
                                     <div className="bg-red-50 dark:bg-red-900/10 p-2.5 rounded-xl border border-red-100 dark:border-red-900/20 flex flex-col">
                                        <div className="text-[9px] font-bold text-red-500/80 uppercase tracking-wider mb-0.5">Pengurangan</div>
                                        <div className="text-xs font-black text-red-500">-{rupiah(potongan)}</div>
                                     </div>
                                  </div>
                              </div>
                           );
                       })}
                   </div>

                   <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-t border-amber-200 dark:border-amber-500/20 px-6 py-5 flex items-center justify-between">
                       <span className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-widest">Total Keseluruhan</span>
                       <span className="text-xl font-black text-amber-600 dark:text-amber-400">{rupiah(totalSatuBulan)}</span>
                   </div>
               </>
           )}
       </div>
    );
};
