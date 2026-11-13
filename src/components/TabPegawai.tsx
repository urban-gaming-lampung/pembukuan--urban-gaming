import { mergeSalaryEdits, runSalaryTransaction } from "../lib/salaryPersistence";
import React, { useState, useEffect, useMemo } from "react";
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db, firebaseConfig } from "../lib/firebase";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { Users, Banknote, Save, Plus, ChevronDown, ChevronRight, Trash2, X, Camera, UserPlus, AlertTriangle, CalendarDays, RotateCcw, Ban } from "lucide-react";
import UserAvatar from "./common/UserAvatar";
import { getAbsenCycleInfo, getCycleInfoFromBulanTahun, getTodayYmd, BULAN_NAMES, normalizeBulanTahun, normalizeDateStr } from "../lib/absenPeriod";
import { isUrbanUserDocId } from "../lib/urbanUsers";
import { tanggalHariKerja, toLocalYmd } from "../lib/dateLocal";
import { rpShort, rupiah, toInt } from "../lib/format";
import { Amount, Button, Card, EmptyState, Eyebrow, Footnote, IconBadge, kartu, LineItem, LineList, ListGroup, Notice, Pill, SectionHeader, SubTabs, TileValue } from "../ui";
import { ongkirPengantarTersimpan } from "../lib/sewa";

// === Helper tampilan & gaji (SSOT dashboard pegawai) ===
const namaPegawai = (email: string) => String(email || "").split("@")[0];
/** "10:12 - Shift Pagi" -> "10:12" */
const jamDari = (waktu: any) => String(waktu || "-").split(" - ")[0];
/** "11/26" -> "November 2026" */
const namaBulanGaji = (bt: string) => {
  const [m, y] = String(bt || "").split("/").map(Number);
  const N = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return m >= 1 && m <= 12 && y >= 0 ? `${N[m - 1]} ${2000 + y}` : bt;
};
/** "Sabtu - 2026-11-07" -> "Sabtu, 7 Nov 2026" */
const labelHari = (key: string) => {
  const [hari, tgl] = String(key || "").split(" - ");
  const d = tgl ? new Date(`${tgl}T12:00:00`) : null;
  return d && !isNaN(d.getTime()) ? `${hari}, ${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : key;
};
/** "Shift Pagi" -> "Pagi · " (kosong bila tidak ada) */
const shiftPendek = (shift: any) => { const s = String(shift || "").toLowerCase(); return s.includes("sore") ? "Sore · " : s.includes("pagi") ? "Pagi · " : ""; };
/** Gaji yang harus dibayar satu bulan: pokok + tambahan belum dibayar + ongkir masuk gaji − potongan aktif. */
export const gajiBersih = (r: any) => {
  const tambahanBelum = (r?.gajiTambahan || []).filter((t: any) => t.status !== "sudah").reduce((a: number, t: any) => a + (Number(t.nominal) || 0), 0);
  const potongan = (r?.gajiPengurangan || []).filter((x: any) => !x.isDibatalkan).reduce((a: number, x: any) => a + (Number(x.nominal) || 0), 0);
  return Math.max(0, (Number(r?.gajiPokok) || 0) + tambahanBelum + (Number(r?.ongkirMasukGajiBulanIni) || 0) - potongan);
};
/** Jumlah denda otomatis aktif (telat masuk / tidak absen pulang) di satu bulan gaji. */
const rinciDenda = (r: any) => {
  const auto = (r?.gajiPengurangan || []).filter((x: any) => x._isAutoSistem && !x.isDibatalkan);
  return {
    telat: auto.filter((x: any) => !x._isDendaPulang).length,
    pulang: auto.filter((x: any) => x._isDendaPulang).length,
    nominal: auto.reduce((a: number, x: any) => a + (Number(x.nominal) || 0), 0),
  };
};



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
      // Hanya akun URBAN (ID dokumen = email). Akun ProsperoEden (ID = UID) diabaikan.
      const data = snap.docs
        .filter(doc => isUrbanUserDocId(doc.id))
        .map(doc => ({ id: doc.id, ...doc.data() }));
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
  const [ongkirStart, setOngkirStart] = useState(() => toLocalYmd().slice(0, 8) + "01");
  const [ongkirEnd, setOngkirEnd] = useState(() => toLocalYmd());

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
    if (!confirm(`Apakah Anda yakin ingin menghapus profil akun ${email}? Riwayat gaji tetap disimpan untuk arsip.`)) return;

    setIsDeletingEmail(email);
    try {
      await deleteDoc(doc(db, "users", email));
      await deleteDoc(doc(db, "logs", email)).catch(() => {});
      // Removing a profile must never delete the employee's financial history.
      alert(`Profil akun ${email} berhasil dihapus. Riwayat gaji tetap disimpan.`);
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

  // === Helper Tanggal Cutoff Per-Akun Pegawai (SSOT) ===
  const getEmployeeCutoff = (email: string): number => {
    if (!email) return 1;
    const em = email.toLowerCase().trim();
    const up = usersProfile.find(u => u.id?.toLowerCase().trim() === em);
    if (up && typeof up.tanggalMulaiHitung === "number" && up.tanggalMulaiHitung >= 1 && up.tanggalMulaiHitung <= 31) {
      return up.tanggalMulaiHitung;
    }
    return Number(absenConfig?.tanggalMulaiHitung) || 1;
  };

  const handleUpdateEmployeeCutoff = async (email: string, tanggal: number) => {
    if (!email || email.toLowerCase().trim() === "owner@gmail.com") return;
    try {
      await setDoc(doc(db, "users", email), { tanggalMulaiHitung: Number(tanggal) || 1 }, { merge: true });
    } catch (err) {
      console.error("Gagal mengubah tanggal cutoff pegawai:", err);
      alert("Gagal mengubah tanggal cutoff pegawai.");
    }
  };

  const activeEmployees = useMemo(() => {
    return usersProfile.filter(u => !isSuperAdminOrOwnerEmail(u.id) && u.status !== "nonaktif" && !u.id.toLowerCase().includes("fauzanazim56"));
  }, [usersProfile]);

  const [filterPegawaiAbsen, setFilterPegawaiAbsen] = useState<string>("all");

  // === Classify shift dari string shift field (SSOT) ===
  const classifyShift = (shiftStr: string): 'pagi' | 'sore' | 'libur' => {
    if (!shiftStr) return 'pagi';
    const lower = shiftStr.toLowerCase();
    if (lower.includes('libur')) return 'libur';
    if (lower.includes('sore')) return 'sore';
    return 'pagi';
  };

  // Set-up grouping log_absensi by Bulan/Siklus -> Minggu -> Hari (SSOT Per-Pegawai)
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

     const filteredLogs = filterPegawaiAbsen === "all"
       ? logAbsensi
       : logAbsensi.filter(l => l.email?.toLowerCase().trim() === filterPegawaiAbsen.toLowerCase().trim());

     filteredLogs.forEach(log => {
        if (!log.tanggal) return;
        const em = log.email ? log.email.toLowerCase().trim() : "";
        if (isSuperAdminOrOwnerEmail(em) || isPegawaiNonaktif(em)) return;

        const normDate = normalizeDateStr(log.tanggal);
        // Monitoring absen = SSOT bulan kalender untuk SEMUA pegawai (cutoff gaji tidak dipakai di sini)
        const cycle = getAbsenCycleInfo(normDate, 1);
        const bulanTahun = cycle.bulanTahun;

        let hariIndo = "";
        try {
           const d = new Date(normDate);
           hariIndo = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(d);
        } catch(e) { hariIndo = "" }

        const tglStr = `${hariIndo} - ${normDate}`;

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
                  emailMap.get(em).evidencePulang = Array.isArray(l.evidence) ? l.evidence : [];
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
  }, [logAbsensi, filterPegawaiAbsen, usersProfile, isUsersLoaded, absenConfig]);

  const [expandedLogBulan, setExpandedLogBulan] = useState<string[]>([]);
  const toggleLogBulan = (b: string) => setExpandedLogBulan(p => p.includes(b) ? p.filter(x => x !== b) : [...p, b]);

  const [expandedLogMinggu, setExpandedLogMinggu] = useState<string[]>([]);
  const toggleLogMinggu = (k: string) => setExpandedLogMinggu(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  const [expandedLogHari, setExpandedLogHari] = useState<string[]>([]);
  const toggleLogHari = (k: string) => setExpandedLogHari(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k]);

  const [photoPopup, setPhotoPopup] = useState<any | null>(null);

  // Merge Data
  const pegawaiData = useMemo(() => {
    const mergedMap = new Map();

    // Inisialisasi HANYA dari profil yang aktif dan tidak dicoret
    usersProfile.forEach(u => {
      if (!isSuperAdminOrOwnerEmail(u.id)) {
         if (u.status === "nonaktif") return; // Akun yang dicoret tidak dimasukkan
         const k = u.id.toLowerCase().trim();
         if (k.includes("fauzanazim56")) return;
         mergedMap.set(k, { email: u.id, photoUrl: u.photoUrl || null, profileColor: u.profileColor || "#3b82f6", loginsCount: 0, records: [], cutoffDay: getEmployeeCutoff(u.id) });
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

    // 1. Kalkulasi Ongkir Otomatis dari history pembukuan (mengikuti siklus per pegawai)
    const ongkirMap = new Map(); // key: `email_MM/YY`, value: total_ongkir (tampilan saja)
    const ongkirMasukGajiMap = new Map(); // key: `email_MM/YY`, value: total ongkir yg benar-benar masuk Gaji Yang Harus Dibayar

    history.forEach((h) => {
       if (!h.tanggal) return;

       if (Array.isArray(h.rowsSewa)) {
           h.rowsSewa.forEach((r: any) => {
               if (r.isOngkir === "YA" && r._ongkir && r.diantarOleh) {
                   const email = r.diantarOleh.toLowerCase().trim();
                   if (isPegawaiNonaktif(email) || !mergedMap.has(email)) return;

                   const empCutoff = getEmployeeCutoff(email);
                   const cycle = getAbsenCycleInfo(h.tanggal, empCutoff);
                   const bulanTahun = cycle.bulanTahun;
                   const key = `${email}_${bulanTahun}`;
                   const nominalAsli = toInt(r._ongkir);

                   if (r._isNewOngkirSystem) {
                       const pegawaiNominal = ongkirPengantarTersimpan(r) ?? 0;

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

                   const empCutoff = getEmployeeCutoff(email);
                   const cycle = getAbsenCycleInfo(h.tanggal, empCutoff);
                   const bulanTahun = cycle.bulanTahun;
                   const key = `${email}_${bulanTahun}`;
                   const nominalAsli = toInt(r._ongkir);

                   if (nominalAsli > 0) {
                       if (r._isNewOngkirSystem) {
                           const pegawaiNominal = ongkirPengantarTersimpan(r) ?? 0;

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

    // 2. Kalkulasi Denda Keterlambatan Absen Masuk Otomatis dari log_absensi (mengikuti siklus per pegawai)
    const latePenaltyMap = new Map<string, number>(); // key: `email_MM/YY`, value: total late denda
    const latePenaltyItemsMap = new Map<string, any[]>(); // key: `email_MM/YY`, value: array of denda items

    const toleransiCfg = absenConfig.waktuToleransi ?? 15;
    const durasiBlokCfg = absenConfig.durasiWaktuPotongan ?? 15;
    const nominalDendaCfg = absenConfig.nominalDenda ?? 1500;

    logAbsensi.forEach((l: any) => {
      if (l.jenisAbsen === "Masuk" && l.email && l.tanggal) {
        const em = l.email.toLowerCase().trim();
        if (isSuperAdminOrOwnerEmail(em) || isPegawaiNonaktif(em) || !mergedMap.has(em)) return;

        const empCutoff = getEmployeeCutoff(em);
        const cycle = getAbsenCycleInfo(l.tanggal, empCutoff);
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

    // 3. Calculate auto-penalties for missing checkouts (mengikuti siklus per pegawai)
    const penaltyMap = new Map(); // key: `email_MM/YY`, value: count of missed checkouts * penalty
    const todayNorm = normalizeDateStr(toLocalYmd());

    logAbsensi.forEach(l => {
        if (l.jenisAbsen === "Masuk" && l.email && l.tanggal) {
             const em = l.email.toLowerCase().trim();
             if (isSuperAdminOrOwnerEmail(em) || isPegawaiNonaktif(em) || !mergedMap.has(em)) return;

             const normLogTgl = normalizeDateStr(l.tanggal);
             // Jangan kenakan denda tidak absen pulang jika tanggalnya adalah hari ini (shift masih berjalan)
             if (normLogTgl >= todayNorm) return;

             const sameDayPulang = logAbsensi.find(o => o.email?.toLowerCase().trim() === em && normalizeDateStr(o.tanggal) === normLogTgl && o.jenisAbsen === "Pulang");
             if (!sameDayPulang) {
                 const empCutoff = getEmployeeCutoff(em);
                 const cycle = getAbsenCycleInfo(l.tanggal, empCutoff);
                 const bulanTahun = cycle.bulanTahun;
                 const key = `${em}_${bulanTahun}`;
                 const nominalDendaPulang = absenConfig.dendaTidakAbsenPulang ?? 40000;

                 penaltyMap.set(key, (penaltyMap.get(key) || 0) + nominalDendaPulang);

                 const shiftDisplay = l.shift || "Shift";
                 const idempKey = `missedCheckout_${em}_${normLogTgl}`;
                 const item = {
                   id: `missed_checkout_${normLogTgl}_${em}`,
                   nominal: nominalDendaPulang,
                   ket: `[Auto-Sistem] Tidak Absen Pulang (Tgl ${l.tanggal || normLogTgl}). Shift: ${shiftDisplay}`,
                   photoUrl: null,
                   dateStr: l.timestamp || new Date().toISOString(),
                   _isAutoSistem: true,
                   _isDendaPulang: true,
                   _idempKey: idempKey,
                   _tanggalAbsen: l.tanggal || normLogTgl,
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

    gaji.forEach(g => {
      const k = g.id.toLowerCase().trim();
      if (isPegawaiNonaktif(k) || isSuperAdminOrOwnerEmail(g.id) || !mergedMap.has(k)) return;
      let records = Array.isArray(g.records) ? g.records : [];
      if (records.length === 0 && (g.gajiPokok || g.bonus || g.potongan)) {
          // Migrasi data lama on the fly
          const d = new Date();
          const empCutoff = getEmployeeCutoff(k);
          const cycle = getAbsenCycleInfo(toLocalYmd(d), empCutoff);
          const bulanTahun = normalizeBulanTahun(cycle.bulanTahun);
          records = [{
             id: `migrated-${bulanTahun}`,
             bulanTahun: bulanTahun,
             gajiPokok: Number(g.gajiPokok) || 0,
             gajiTambahan: (Number(g.bonus) || 0) > 0 ? [{ id: `tb_${Date.now()}_init`, nominal: Number(g.bonus) || 0, ket: g.ketPemasukan || g.ket || "Gaji Tambahan", status: "belum" }] : [],
             gajiPengurangan: (Number(g.potongan) || 0) > 0 ? [{ id: `pg_${Date.now()}_init`, nominal: Number(g.potongan) || 0, ket: g.ketPengeluaran || "Gaji Pengurangan", isDibatalkan: false }] : [],
             buktiTransfer: g.buktiTransfer || "",
             updatedAt: g.updatedAt || Date.now()
          }];
      } else {
          // Transform if already array but using old schema internally
          records = records.map((r: any) => {
              const normBulan = normalizeBulanTahun(r.bulanTahun);
              let tb = Array.isArray(r.gajiTambahan) ? [...r.gajiTambahan] : [];
              let pg = Array.isArray(r.gajiPengurangan) ? [...r.gajiPengurangan] : [];
              if (r.bonus && tb.length === 0) tb.push({ id: `tb_${normBulan}_init`, nominal: Number(r.bonus) || 0, ket: r.ketPemasukan || "Gaji Tambahan", status: "belum" });
              if (r.potongan && pg.length === 0) pg.push({ id: `pg_${normBulan}_init`, nominal: Number(r.potongan) || 0, ket: r.ketPengeluaran || "Gaji Pengurangan", isDibatalkan: false });

              // Ensure tb items have id and status
              tb = tb.map((t: any, idx: number) => ({
                id: t.id || `tb_${normBulan}_${idx}`,
                nominal: Number(t.nominal) || 0,
                ket: t.ket || "Gaji Tambahan",
                status: t.status === "sudah" ? "sudah" : "belum"
              }));

              const res = { ...r, bulanTahun: normBulan, gajiTambahan: tb, gajiPengurangan: pg };
              delete res.bonus;
              delete res.potongan;
              delete res.ketPemasukan;
              delete res.ketPengeluaran;
              return res;
          });
      }

      mergedMap.get(k).sourceRecords = g.records || [];
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
        p.cutoffDay = getEmployeeCutoff(p.email);
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
           rec.bulanTahun = normalizeBulanTahun(rec.bulanTahun);
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
        // We create a stub "dummy" record automatically IF AND ONLY IF it doesn't already exist.
        const existingMonths = new Set(p.records.map((r: any) => normalizeBulanTahun(r.bulanTahun)));

        const allRemainingMonthKeys = new Set([
          ...Array.from(ongkirMap.keys()).filter(k => k.startsWith(`${p.email.toLowerCase()}_`)),
          ...Array.from(latePenaltyMap.keys()).filter(k => k.startsWith(`${p.email.toLowerCase()}_`)),
          ...Array.from(penaltyMap.keys()).filter(k => k.startsWith(`${p.email.toLowerCase()}_`))
        ]);

        allRemainingMonthKeys.forEach((key) => {
           const rawMonth = key.split("_")[1];
           const bTahun = normalizeBulanTahun(rawMonth);

           if (existingMonths.has(bTahun)) {
             // Already covered, just delete the map keys
             ongkirMap.delete(key);
             ongkirMasukGajiMap.delete(key);
             penaltyMap.delete(key);
             latePenaltyMap.delete(key);
             latePenaltyItemsMap.delete(key);
             return;
           }
           existingMonths.add(bTahun);

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
           const [ma, ya] = (a.bulanTahun || "").split("/");
           const [mb, yb] = (b.bulanTahun || "").split("/");
           const da = new Date(2000 + parseInt(ya), parseInt(ma) - 1);
           const db = new Date(2000 + parseInt(yb), parseInt(mb) - 1);
           return db.getTime() - da.getTime();
        });
    });

    return Array.from(mergedMap.values()).filter((p: any) => !isPegawaiNonaktif(p.email));
  }, [logs, gaji, usersProfile, history, logAbsensi, ongkirConfig, absenConfig]);

  const groupedByMonth = useMemo(() => {
      const map = new Map<string, any[]>();
      pegawaiData.forEach((p: any) => {
         p.records?.forEach((r: any) => {
             const normBulan = normalizeBulanTahun(r.bulanTahun);
             if (!map.has(normBulan)) map.set(normBulan, []);
             map.get(normBulan)!.push({ email: p.email, photoUrl: p.photoUrl, profileColor: p.profileColor, cutoffDay: p.cutoffDay, ...r });
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
                    const nominalAsli = toInt(r._ongkir);

                    let amount = nominalAsli;
                    if (r._isNewOngkirSystem) {
                        amount = ongkirPengantarTersimpan(r) ?? nominalAsli;
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
                    const nominalAsli = toInt(r._ongkir);

                    if (nominalAsli > 0) {
                        let amount = nominalAsli;
                        if (r._isNewOngkirSystem) {
                            amount = ongkirPengantarTersimpan(r) ?? nominalAsli;
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

  // Never delete financial history based on missing/cached user profiles.

  // Auto-persist ongkir stub records to Firestore when detected
  const autoPersistedRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    // Guard: don't run if gaji hasn't loaded yet to avoid resetting existing data
    if (!isOwner || !isGajiLoaded) return;
    if (pegawaiData.length === 0) return;

    pegawaiData.forEach(async (p: any) => {
      const autoRecords = p.records?.filter((r: any) => r.isAutoGenerated);
      if (!autoRecords || autoRecords.length === 0) return;

      // Debounce: skip if we've already persisted for this employee in this session
      const persistKey = `${p.email}_${autoRecords.map((r: any) => r.bulanTahun).join(',')}`;
      if (autoPersistedRef.current.has(persistKey)) return;

      autoPersistedRef.current.add(persistKey);
      try {
      await runSalaryTransaction(db, async transaction => {
      const salaryRef = doc(db, "gaji_pegawai", p.email);
      const salarySnap = await transaction.get(salaryRef);
      // Read salary records inside the transaction, never from a UI snapshot.
      const existingGajiDoc = salarySnap.data();
      const existingRecords: any[] = existingGajiDoc?.records || [];

      // Determine robust base salary
      let basePokok = Number(existingGajiDoc?.gajiPokok) || 0;
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
        const alreadyExists = updatedRecords.some((r: any) => normalizeBulanTahun(r.bulanTahun) === normalizeBulanTahun(autoRec.bulanTahun));
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
        transaction.set(salaryRef, {
          salaryRevision: (Number(salarySnap.data()?.salaryRevision) || 0) + 1,
          records: updatedRecords,
          gajiPokok: basePokok,
          updatedAt: Date.now()
        }, { merge: true });
      }
      });
      } catch (error) {
        autoPersistedRef.current.delete(persistKey);
        console.error("Gagal menyimpan bulan gaji otomatis:", error);
      }
    });
  }, [pegawaiData, gaji, isGajiLoaded, isOwner]);

  // Batch missing checkout penalties once per employee, rather than racing
  // one transaction per historical attendance date against the same document.
  const penaltyInFlight = React.useRef(new Set<string>());
  useEffect(() => {
    if (!isOwner || !isLogAbsensiLoaded || !isGajiLoaded) return;
    const days = new Map<string, any>();
    for (const log of logAbsensi) {
      const email = String(log.email || '').toLowerCase().trim();
      if (!email || !log.tanggal) continue;
      const key = email + '_' + log.tanggal;
      const day = days.get(key) || { email, tanggal: log.tanggal, shift: '', masuk: false, pulang: false };
      if (log.jenisAbsen === 'Masuk') { day.masuk = true; day.shift = log.shift || ''; }
      if (log.jenisAbsen === 'Pulang') day.pulang = true;
      days.set(key, day);
    }
    const pending = new Map<string, any[]>();
    for (const day of days.values()) {
      const deadline = new Date(day.tanggal);
      deadline.setDate(deadline.getDate() + 1);
      deadline.setHours(3, 0, 0, 0);
      if (!day.masuk || day.pulang || !Number.isFinite(deadline.getTime()) || new Date() < deadline) continue;
      const idempKey = 'noCheckOut_' + day.email + '_' + day.tanggal;
      const stored = gaji.find(g => g.id.toLowerCase().trim() === day.email);
      if (stored?.records?.some((r: any) => r.gajiPengurangan?.some((p: any) => p._idempKey === idempKey))) continue;
      const items = pending.get(day.email) || [];
      items.push({ ...day, idempKey });
      pending.set(day.email, items);
    }
    for (const [email, entries] of pending) {
      if (penaltyInFlight.current.has(email)) continue;
      penaltyInFlight.current.add(email);
      const ref = doc(db, 'gaji_pegawai', email);
      void runSalaryTransaction(db, async transaction => {
        const snap = await transaction.get(ref);
        const data = snap.data() || {};
        const records = Array.isArray(data.records) ? data.records.map((r: any) => ({ ...r })) : [];
        const basePokok = Number(data.gajiPokok) || Number(records.find((r: any) => Number(r.gajiPokok) > 0)?.gajiPokok) || 1500000;
        let changed = false;
        for (const entry of entries) {
          if (records.some((r: any) => r.gajiPengurangan?.some((p: any) => p._idempKey === entry.idempKey))) continue;
          const month = normalizeBulanTahun(getAbsenCycleInfo(entry.tanggal, getEmployeeCutoff(email)).bulanTahun);
          let record = records.find((r: any) => normalizeBulanTahun(r.bulanTahun) === month);
          if (!record) {
            record = { id: 'rec-auto-' + month, bulanTahun: month, gajiPokok: basePokok, gajiTambahan: [], gajiPengurangan: [], isAutoGenerated: true };
            records.push(record);
          }
          record.gajiPengurangan = [...(record.gajiPengurangan || []), {
            id: entry.idempKey, _idempKey: entry.idempKey, _isAutoSistem: true, _isDendaPulang: true,
            _tanggalAbsen: entry.tanggal, nominal: absenConfig.dendaTidakAbsenPulang ?? 40000,
            ket: '[Auto-Sistem] Tidak absen pulang tanggal ' + entry.tanggal + '. Shift: ' + entry.shift,
            dateStr: new Date().toISOString(), isDibatalkan: false
          }];
          changed = true;
        }
        if (changed) transaction.set(ref, { records, gajiPokok: basePokok, salaryRevision: (Number(data.salaryRevision) || 0) + 1, updatedAt: Date.now() }, { merge: true });
      }).catch(error => console.error('Gagal menyimpan denda pulang:', error))
        .finally(() => penaltyInFlight.current.delete(email));
    }
  }, [logAbsensi, gaji, isOwner, isLogAbsensiLoaded, isGajiLoaded, absenConfig, usersProfile]);

  const handleSaveGaji = async (email: string, records: any[], sourceRecords: any[], baseline: any[]) => {
      try {
        const cleanEmail = String(email || "").toLowerCase().trim();
        if (!cleanEmail) {
          throw new Error("Email pegawai tidak valid.");
        }
        if (!isOwner) throw new Error("Hanya super admin yang dapat mengubah gaji.");

        const docRef = doc(db, "gaji_pegawai", cleanEmail);
        await runSalaryTransaction(db, async transaction => {
        const docSnap = await transaction.get(docRef);

        let dbRecords: any[] = [];
        let latestGajiPokok = 0;

        if (docSnap.exists()) {
          const dData = docSnap.data();
          dbRecords = Array.isArray(dData.records) ? dData.records : [];
          latestGajiPokok = Number(dData.gajiPokok) || 0;
        }

        const finalRecordsToSave = mergeSalaryEdits(sourceRecords, baseline, records, dbRecords);
        latestGajiPokok = Number(finalRecordsToSave[0]?.gajiPokok) || latestGajiPokok || 1500000;

        transaction.set(docRef, {
          salaryRevision: (Number(docSnap.data()?.salaryRevision) || 0) + 1,
          records: finalRecordsToSave,
          gajiPokok: latestGajiPokok,
          updatedAt: Date.now()
        }, { merge: true });

        });
        alert(`✅ Gaji ${cleanEmail.split("@")[0]} berhasil disimpan!`);
      } catch (err: any) {
        console.error("Gagal menyimpan gaji pegawai:", err);
        alert(`Gagal menyimpan gaji: ${err?.message || "Terjadi kesalahan jaringan."}`);
        throw err;
      }
  };

  // ======================= RINGKASAN (owner) =======================
  const [tabDash, setTabDash] = useState<"RINGKASAN" | "ABSENSI" | "GAJI" | "AKUN">("RINGKASAN");
  const hariIni = normalizeDateStr(tanggalHariKerja());
  const labelHariIni = new Date(`${tanggalHariKerja()}T12:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });

  /** Menit telat absen masuk (0 bila tepat waktu / dalam toleransi) — aturan sama dengan denda otomatis. */
  const telatMenit = (l: any): number => {
    if (!l) return 0;
    if (typeof l.denda === "number" && typeof l.lateMinutes === "number") return l.denda > 0 ? l.lateMinutes : 0;
    if (!l.waktu) return 0;
    const [jam, menit] = jamDari(l.waktu).split(":").map(Number);
    const mulai = String(l.shift || "").toLowerCase().includes("sore") ? 15 * 60 : 10 * 60;
    const lateM = Math.max(0, (jam || 0) * 60 + (menit || 0) - mulai);
    return lateM > (absenConfig.waktuToleransi ?? 15) ? lateM : 0;
  };

  const statusHariIni = useMemo(() => {
    const urut: Record<string, number> = { belum: 0, kerja: 1, pulang: 2, libur: 3 };
    return activeEmployees
      .map((u) => {
        const em = u.id.toLowerCase().trim();
        const hari = logAbsensi.filter((l) => l.email?.toLowerCase().trim() === em && normalizeDateStr(l.tanggal) === hariIni);
        const masuk = hari.find((l) => l.jenisAbsen === "Masuk");
        const pulang = hari.find((l) => l.jenisAbsen === "Pulang");
        const libur = hari.some((l) => l.jenisAbsen === "Libur");
        const state: "belum" | "kerja" | "pulang" | "libur" = libur ? "libur" : pulang ? "pulang" : masuk ? "kerja" : "belum";
        return { email: u.id, photoUrl: u.photoUrl, profileColor: u.profileColor, masuk, pulang, state, telat: telatMenit(masuk) };
      })
      .sort((a, b) => urut[a.state] - urut[b.state] || a.email.localeCompare(b.email));
  }, [activeEmployees, logAbsensi, hariIni, absenConfig]);
  const hitungStatus = (s: string) => statusHariIni.filter((x) => x.state === s).length;

  /** Gaji periode berjalan tiap pegawai (siklus cutoff masing-masing). */
  const gajiPeriodeIni = useMemo(
    () =>
      pegawaiData.map((p: any) => {
        const cyc = getAbsenCycleInfo(getTodayYmd(), p.cutoffDay || 1);
        const bt = normalizeBulanTahun(cyc.bulanTahun);
        const rec = (p.records || []).find((r: any) => normalizeBulanTahun(r.bulanTahun) === bt);
        const d = rec ? rinciDenda(rec) : { telat: 0, pulang: 0, nominal: 0 };
        return { p, rec, periode: cyc.shortLabelPeriode, bersih: rec ? gajiBersih(rec) : Number(p.gajiPokok) || 0, ...d, ongkir: Number(rec?.ongkirBulanIni) || 0, bukti: Boolean(rec?.buktiTransfer) };
      }),
    [pegawaiData]
  );
  const totalGajiIni = gajiPeriodeIni.reduce((a, x) => a + x.bersih, 0);
  const totalTelat = gajiPeriodeIni.reduce((a, x) => a + x.telat, 0);
  const totalLupaPulang = gajiPeriodeIni.reduce((a, x) => a + x.pulang, 0);

  const bukaFotoAbsen = (s: { masuk?: any; pulang?: any }) => {
    const items: { label: string; url: string }[] = [];
    if (s.masuk?.photoUrl) items.push({ label: `Masuk · ${jamDari(s.masuk.waktu)}`, url: s.masuk.photoUrl });
    if (s.pulang?.photoUrl) items.push({ label: `Pulang · ${jamDari(s.pulang.waktu)}`, url: s.pulang.photoUrl });
    (Array.isArray(s.pulang?.evidence) ? s.pulang.evidence : []).forEach((e: any) => e?.url && items.push({ label: e.label || "Bukti", url: e.url }));
    if (items.length === 1) setPhotoPopup(items[0].url);
    else if (items.length > 1) setPhotoPopup({ title: "Foto absen hari ini", items });
  };

  const totalOngkirRentang = ongkirReport.reduce((acc, item) => acc + item.total, 0);
  const fmtTgl = (s: string) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-");

  return (
    <div className="space-y-3">
      <SubTabs
        ariaLabel="Bagian dashboard pegawai"
        value={tabDash}
        onChange={setTabDash}
        options={[
          { key: "RINGKASAN", label: "Ringkasan" },
          { key: "ABSENSI", label: "Absensi" },
          { key: "GAJI", label: "Gaji" },
          ...(isOwner ? [{ key: "AKUN" as const, label: "Akun" }] : []),
        ]}
      />

      {/* ============ RINGKASAN ============ */}
      {tabDash === "RINGKASAN" && (
        <>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <Eyebrow icon={<CalendarDays />}>Hari ini · {labelHariIni}</Eyebrow>
              {statusHariIni.length > 0 && hitungStatus("belum") > 0 && <Pill tone="warning">{hitungStatus("belum")} belum absen</Pill>}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-display tabular-nums text-label">{hitungStatus("kerja") + hitungStatus("pulang")}</span>
              <span className="text-headline font-medium text-label-2">/ {statusHariIni.length} pegawai hadir</span>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { l: "Bekerja", v: hitungStatus("kerja"), t: "tint" as const },
                { l: "Pulang", v: hitungStatus("pulang"), t: "positive" as const },
                { l: "Libur", v: hitungStatus("libur"), t: "neutral" as const },
                { l: "Belum", v: hitungStatus("belum"), t: hitungStatus("belum") ? ("warning" as const) : ("neutral" as const) },
              ].map((x) => (
                <div key={x.l} className="rounded-tile bg-surface-2 px-2 py-2.5 text-center">
                  <TileValue tone={x.v ? x.t : "neutral"}>{x.v}</TileValue>
                  <div className="text-caption text-label-2">{x.l}</div>
                </div>
              ))}
            </div>
          </Card>

          <SectionHeader title="Status pegawai hari ini" />
          {statusHariIni.length === 0 ? (
            <EmptyState icon={<Users />} title="Belum ada pegawai aktif">Tambahkan akun pegawai di bagian Akun.</EmptyState>
          ) : (
            <ListGroup>
              {statusHariIni.map((s) => {
                const ada = s.masuk?.photoUrl || s.pulang?.photoUrl;
                const sub =
                  s.state === "belum"
                    ? "Belum absen masuk"
                    : s.state === "libur"
                    ? "Libur hari ini"
                    : `${shiftPendek(s.masuk?.shift)}masuk ${jamDari(s.masuk?.waktu)}${s.telat ? ` · telat ${s.telat} mnt` : ""}${s.pulang ? ` · pulang ${jamDari(s.pulang.waktu)}` : ""}`;
                const pill =
                  s.state === "kerja" ? <Pill tone="tint">Bekerja</Pill> : s.state === "pulang" ? <Pill tone="positive">Pulang</Pill> : s.state === "libur" ? <Pill>Libur</Pill> : <Pill tone="warning">Belum absen</Pill>;
                const isi = (
                  <>
                    <UserAvatar photoUrl={s.photoUrl} email={s.email} profileColor={s.profileColor} size="md" />
                    <div className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 border-b border-sep py-2.5 group-last/row:border-b-0">
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate text-callout font-medium capitalize text-label">{namaPegawai(s.email)}</div>
                        <div className={`text-footnote ${s.telat ? "text-warning" : "text-label-2"}`}>{sub}</div>
                      </div>
                      {pill}
                      {ada && <Camera className="h-4 w-4 shrink-0 text-label-3" aria-label="Ada foto" />}
                    </div>
                  </>
                );
                return ada ? (
                  <button key={s.email} type="button" onClick={() => bukaFotoAbsen(s)} className="group/row flex w-full items-center gap-3 pl-4 pr-3 transition-colors active:bg-fill">{isi}</button>
                ) : (
                  <div key={s.email} className="group/row flex w-full items-center gap-3 pl-4 pr-3">{isi}</div>
                );
              })}
            </ListGroup>
          )}

          <SectionHeader title="Gaji periode berjalan" accessory={<button type="button" onClick={() => setTabDash("GAJI")} className="text-footnote font-medium text-tint">Kelola</button>} />
          <Card>
            <Eyebrow icon={<Banknote />}>Perlu dibayar</Eyebrow>
            <div className="mt-2"><Amount value={totalGajiIni} size="display" fitAt={15} /></div>
            <p className="mt-1 text-footnote text-label-2">Pokok + tambahan belum dibayar + ongkir (bila masuk gaji) − potongan, per siklus gaji masing-masing pegawai.</p>
            {(totalTelat > 0 || totalLupaPulang > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {totalTelat > 0 && <Pill tone="warning" icon={<AlertTriangle />}>{totalTelat}× telat masuk</Pill>}
                {totalLupaPulang > 0 && <Pill tone="negative" icon={<AlertTriangle />}>{totalLupaPulang}× tidak absen pulang</Pill>}
              </div>
            )}
            <LineList className="mt-3 border-t border-sep">
              {gajiPeriodeIni.map((g) => (
                <button key={g.p.email} type="button" onClick={() => setTabDash("GAJI")} className="flex w-full items-center gap-3 py-2.5 text-left transition-opacity active:opacity-50">
                  <UserAvatar photoUrl={g.p.photoUrl} email={g.p.email} profileColor={g.p.profileColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-subhead font-medium capitalize text-label">{namaPegawai(g.p.email)}</div>
                    <div className="truncate text-caption text-label-2">{g.periode}</div>
                    {g.nominal > 0 && (
                      <div className="text-caption text-warning">
                        {[g.telat && `telat ${g.telat}×`, g.pulang && `lupa pulang ${g.pulang}×`].filter(Boolean).join(" · ")} · −{rpShort(g.nominal)}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-subhead font-semibold tabular-nums text-label">{rupiah(g.bersih)}</div>
                    <div className={`text-caption ${g.bukti ? "text-positive" : "text-label-2"}`}>{g.bukti ? "Ada bukti transfer" : "Belum ada bukti"}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-label-3" aria-hidden />
                </button>
              ))}
            </LineList>
          </Card>
          <Footnote>Hari kerja berganti pukul 06.00. Denda telat & tidak absen pulang dihitung otomatis dari absensi dan bisa dicoret di bagian Gaji.</Footnote>
        </>
      )}

      {/* ============ ABSENSI ============ */}
      {tabDash === "ABSENSI" && (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar" role="tablist" aria-label="Pilih pegawai">
            {[{ id: "all", label: `Semua (${activeEmployees.length})` }, ...activeEmployees.map((e) => ({ id: e.id, label: namaPegawai(e.id) }))].map((x) => {
              const aktif = filterPegawaiAbsen === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  onClick={() => setFilterPegawaiAbsen(x.id)}
                  className={`h-9 shrink-0 rounded-full px-4 text-footnote font-semibold capitalize transition-colors ${aktif ? "bg-label text-surface" : "bg-surface text-label ring-1 ring-edge"}`}
                >
                  {x.label}
                </button>
              );
            })}
          </div>

          {!isLogAbsensiLoaded ? (
            <EmptyState icon={<CalendarDays />} title="Riwayat absensi belum dimuat">
              <span className="mb-3 block">Data absensi (jam & foto) dimuat saat dibutuhkan supaya hemat kuota database.</span>
              <Button onClick={loadDataAbsensi} disabled={loadingLogAbsensi}>{loadingLogAbsensi ? "Memuat…" : "Muat riwayat absensi"}</Button>
            </EmptyState>
          ) : groupedLogAbsensi.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title="Belum ada riwayat absensi" />
          ) : (
            groupedLogAbsensi.map(([bulan, weeks, totalDays, monthlySummary, labelPeriode]) => {
              const buka = expandedLogBulan.includes(bulan);
              return (
                <section key={bulan} className={`${kartu} overflow-hidden`}>
                  <button type="button" onClick={() => toggleLogBulan(bulan)} aria-expanded={buka} className="flex w-full items-center gap-3 p-4 text-left transition-colors active:bg-fill">
                    <IconBadge color="blue"><CalendarDays /></IconBadge>
                    <div className="min-w-0 flex-1">
                      <div className="text-headline text-label">{labelPeriode || `Bulan ${bulan}`}</div>
                      <div className="text-footnote text-label-2">{totalDays} hari tercatat · {weeks.length} minggu</div>
                    </div>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-label-3 transition-transform ${buka ? "rotate-180" : ""}`} />
                  </button>
                  {buka && (
                    <div className="space-y-3 border-t border-sep p-4">
                      {monthlySummary && monthlySummary.size > 0 && (
                        <div className="overflow-hidden rounded-tile bg-surface-2">
                          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,3.25rem)] gap-1 px-3.5 py-2 text-caption font-medium text-label-2">
                            <span>Pegawai</span><span className="text-center">Pagi</span><span className="text-center">Sore</span><span className="text-center">Libur</span>
                          </div>
                          {Array.from(monthlySummary.values()).map((s) => (
                            <div key={s.email} className="grid grid-cols-[minmax(0,1fr)_repeat(3,3.25rem)] items-center gap-1 border-t border-sep px-3.5 py-2 text-subhead">
                              <span className="truncate capitalize text-label">{namaPegawai(s.email)}</span>
                              <span className="text-center font-semibold tabular-nums text-label">{s.pagi}</span>
                              <span className="text-center font-semibold tabular-nums text-label">{s.sore}</span>
                              <span className="text-center font-semibold tabular-nums text-label-2">{s.libur}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {weeks.map((week) => {
                        const keyMinggu = `${bulan}_w${week.weekNum}`;
                        const bukaM = expandedLogMinggu.includes(keyMinggu);
                        return (
                          <div key={keyMinggu} className="overflow-hidden rounded-tile ring-1 ring-sep">
                            <button type="button" onClick={() => toggleLogMinggu(keyMinggu)} aria-expanded={bukaM} className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-fill">
                              <div className="min-w-0 flex-1">
                                <div className="text-subhead font-semibold text-label">Minggu {week.weekNum}</div>
                                <div className="truncate text-caption text-label-2">{week.dateRange} · {week.days.size} hari tercatat</div>
                              </div>
                              <ChevronDown className={`h-4 w-4 shrink-0 text-label-3 transition-transform ${bukaM ? "rotate-180" : ""}`} />
                            </button>
                            {bukaM &&
                              Array.from(week.days.entries()).map(([hari, listPegawai]) => {
                                const keyHari = `${keyMinggu}_${hari}`;
                                const bukaH = expandedLogHari.includes(keyHari);
                                return (
                                  <div key={keyHari} className="border-t border-sep">
                                    <button type="button" onClick={() => toggleLogHari(keyHari)} aria-expanded={bukaH} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-fill">
                                      <span className="min-w-0 flex-1 truncate text-subhead text-label">{labelHari(hari)}</span>
                                      <Pill>{listPegawai.length} pegawai</Pill>
                                      <ChevronDown className={`h-4 w-4 shrink-0 text-label-3 transition-transform ${bukaH ? "rotate-180" : ""}`} />
                                    </button>
                                    {bukaH && (
                                      <div className="space-y-2 bg-surface-2 p-2.5">
                                        {listPegawai.map((pData: any, idx: number) => (
                                          <div key={idx} className="rounded-tile bg-surface p-3">
                                            <div className="flex items-center gap-2.5">
                                              <span className="min-w-0 flex-1 truncate text-subhead font-semibold capitalize text-label">{namaPegawai(pData.email)}</span>
                                              {!pData.isLibur && <span className="shrink-0 text-caption text-label-2">{pData.shift || "Shift belum tercatat"}</span>}
                                            </div>
                                            {pData.isLibur ? (
                                              <div className="mt-2"><Pill>Libur</Pill></div>
                                            ) : (
                                              <div className="mt-2 grid grid-cols-2 gap-2">
                                                <button
                                                  type="button"
                                                  disabled={!pData.photoMasuk}
                                                  onClick={() => setPhotoPopup(pData.photoMasuk)}
                                                  className="flex items-center justify-between rounded-control bg-surface-2 px-3 py-2 text-left disabled:cursor-default"
                                                >
                                                  <span>
                                                    <span className="block text-caption text-label-2">Masuk</span>
                                                    <span className={`text-subhead font-semibold tabular-nums ${pData.waktuMasuk === "-" ? "text-label-3" : "text-label"}`}>{jamDari(pData.waktuMasuk)}</span>
                                                  </span>
                                                  {pData.photoMasuk && <Camera className="h-4 w-4 text-tint" aria-label="Lihat foto masuk" />}
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={!pData.photoPulang}
                                                  onClick={() => {
                                                    const items = [{ label: "Identitas", url: pData.photoPulang }];
                                                    (Array.isArray(pData.evidencePulang) ? pData.evidencePulang : []).forEach((e: any) => e?.url && items.push({ label: e.label || "Bukti", url: e.url }));
                                                    setPhotoPopup(items.length > 1 ? { title: `Foto absen pulang (${pData.shift || "shift"})`, items } : pData.photoPulang);
                                                  }}
                                                  className="flex items-center justify-between rounded-control bg-surface-2 px-3 py-2 text-left disabled:cursor-default"
                                                >
                                                  <span>
                                                    <span className="block text-caption text-label-2">Pulang</span>
                                                    <span className={`text-subhead font-semibold tabular-nums ${pData.waktuPulang === "-" ? "text-warning" : "text-label"}`}>{pData.waktuPulang === "-" ? "Belum" : jamDari(pData.waktuPulang)}</span>
                                                  </span>
                                                  {pData.photoPulang && (
                                                    <span className="flex items-center gap-0.5 text-caption font-semibold text-tint">
                                                      <Camera className="h-4 w-4" aria-label="Lihat foto pulang" />
                                                      {Array.isArray(pData.evidencePulang) && pData.evidencePulang.length > 0 && `+${pData.evidencePulang.length}`}
                                                    </span>
                                                  )}
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}
          <Footnote>Riwayat absensi per bulan kalender (sama untuk semua pegawai). Ketuk jam untuk melihat foto bukti.</Footnote>
        </>
      )}

      {/* ============ GAJI ============ */}
      {tabDash === "GAJI" && (
        <>
          <SectionHeader title="Gaji per pegawai" className="pt-1" />
          <div className="grid gap-3 lg:grid-cols-2">
            {pegawaiData.length === 0 && <EmptyState icon={<Users />} title="Belum ada pegawai" />}
            {pegawaiData.map((p) => (
              <PegawaiCard key={p.email} pegawai={p} onSave={handleSaveGaji} isOwner={isOwner} onUpdateCutoff={handleUpdateEmployeeCutoff} />
            ))}
          </div>

          <SectionHeader title="Rangkuman per bulan" />
          {groupedByMonth.length === 0 ? (
            <EmptyState icon={<Banknote />} title="Belum ada riwayat gaji" />
          ) : (
            <ListGroup>
              {groupedByMonth.map(([bulan, records]) => (
                <RangkumanBulanItem key={bulan} bulan={bulan} records={records} />
              ))}
            </ListGroup>
          )}

          <SectionHeader title="Ongkir antar pegawai" />
          <ListGroup>
            {[
              { l: "Dari", v: ongkirStart, set: setOngkirStart },
              { l: "Sampai", v: ongkirEnd, set: setOngkirEnd },
            ].map((x) => (
              <div key={x.l} className="group/row flex w-full items-center gap-3 pl-4 pr-3">
                <div className="flex min-h-[48px] min-w-0 flex-1 items-center justify-between gap-3 border-b border-sep py-1.5 group-last/row:border-b-0">
                  <span className="text-callout text-label">{x.l}</span>
                  <input type="date" value={x.v} onChange={(e) => x.set(e.target.value)} aria-label={`${x.l} tanggal ongkir`} className="!w-auto !min-h-0 h-9 min-w-[132px] rounded-control bg-fill px-3 text-center text-[16px] tabular-nums text-label outline-none focus:ring-2 focus:ring-tint/40" />
                </div>
              </div>
            ))}
          </ListGroup>
          {ongkirReport.length === 0 ? (
            <EmptyState icon={<Banknote />} title="Tidak ada ongkir">Belum ada antar sewa oleh pegawai pada rentang tanggal ini.</EmptyState>
          ) : (
            <Card flush>
              {ongkirReport.map((item) => (
                <div key={item.email} className="group/row flex items-center gap-3 pl-4 pr-4">
                  <UserAvatar photoUrl={item.photoUrl} email={item.email} name={item.name} profileColor={item.profileColor} size="md" />
                  <div className="flex min-h-[56px] min-w-0 flex-1 items-center justify-between gap-3 border-b border-sep py-2.5">
                    <span className="truncate text-callout font-medium capitalize text-label">{item.name}</span>
                    <span className="shrink-0 text-subhead font-semibold tabular-nums text-label">{rupiah(item.total)}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="text-subhead font-semibold text-label">Total ongkir</div>
                  <div className="truncate text-caption text-label-2">{fmtTgl(ongkirStart)} – {fmtTgl(ongkirEnd)}</div>
                </div>
                <Amount value={totalOngkirRentang} size="headline" />
              </div>
            </Card>
          )}
        </>
      )}

      {/* ============ AKUN ============ */}
      {tabDash === "AKUN" && isOwner && (
        <>
          <SectionHeader title={`Akun terdaftar · ${usersProfile.length}`} className="pt-1" />
          <ListGroup>
            {usersProfile.map((u) => {
              const isOwnerAccount = u.id.toLowerCase().trim() === "owner@gmail.com";
              const nonaktif = u.status === "nonaktif";
              const p = pegawaiData.find((x: any) => x.email.toLowerCase().trim() === u.id.toLowerCase().trim());
              const pilih = "h-8 rounded-control bg-fill pl-2.5 pr-7 text-footnote font-semibold text-label outline-none focus:ring-2 focus:ring-tint/40";
              const panah = <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-label-2" aria-hidden />;
              return (
                <div key={u.id} className="group/row flex w-full items-start gap-3 pl-4 pr-3">
                  <UserAvatar photoUrl={u.photoUrl} email={u.id} profileColor={u.profileColor} size="md" showStatusBadge statusBadgeActive={!nonaktif} className="mt-2.5" />
                  <div className="min-w-0 flex-1 border-b border-sep py-2.5 group-last/row:border-b-0">
                    <div className="flex items-center gap-2">
                      <span className={`min-w-0 flex-1 truncate text-callout font-medium ${nonaktif ? "text-label-3 line-through" : "text-label"}`}>{u.id}</span>
                      {isOwnerAccount ? <Pill tone="tint">Pemilik</Pill> : nonaktif ? <Pill tone="negative">Nonaktif</Pill> : null}
                    </div>
                    <div className="text-caption text-label-2">
                      {u.role === "super admin" ? "Super Admin" : isOwnerAccount ? "Root Owner" : "Admin"}
                      {p ? ` · buka aplikasi ${p.loginsCount}×` : ""}
                    </div>
                    {!isOwnerAccount && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="relative">
                          <select aria-label={`Hak akses ${u.id}`} value={u.role || "admin"} onChange={(e) => handleChangeRole(u.id, e.target.value)} className={pilih}>
                            <option value="admin">Admin</option>
                            <option value="super admin">Super Admin</option>
                          </select>
                          {panah}
                        </span>
                        <span className="relative">
                          <select aria-label={`Status ${u.id}`} value={u.status || "aktif"} onChange={(e) => handleChangeStatus(u.id, e.target.value)} className={pilih}>
                            <option value="aktif">Aktif</option>
                            <option value="nonaktif">Nonaktif</option>
                          </select>
                          {panah}
                        </span>
                        <Button variant="destructive" size="sm" icon={<Trash2 />} className="ml-auto" onClick={() => handleDeleteAccount(u.id)} disabled={isDeletingEmail === u.id}>
                          Hapus
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </ListGroup>

          <SectionHeader title="Daftarkan akun baru" />
          <Card>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block px-1 text-footnote font-medium text-label-2">Email akun</span>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="pegawai@gmail.com" required autoComplete="off" className="h-11 w-full rounded-field bg-fill px-3.5 text-[16px] text-label outline-none placeholder:text-label-3 focus:ring-2 focus:ring-tint/40" />
              </label>
              <label className="block">
                <span className="mb-1.5 block px-1 text-footnote font-medium text-label-2">Password</span>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" required autoComplete="new-password" className="h-11 w-full rounded-field bg-fill px-3.5 text-[16px] text-label outline-none placeholder:text-label-3 focus:ring-2 focus:ring-tint/40" />
              </label>
              <div>
                <span className="mb-1.5 block px-1 text-footnote font-medium text-label-2">Hak akses</span>
                <SubTabs size="sm" ariaLabel="Hak akses akun baru" value={newRole} onChange={setNewRole} options={[{ key: "admin", label: "Admin" }, { key: "super admin", label: "Super Admin" }]} />
              </div>
              {createError && <Notice tone="negative">{createError}</Notice>}
              {createSuccess && <Notice tone="info">{createSuccess}</Notice>}
              <Button type="submit" size="lg" block disabled={creatingAccount} icon={<UserPlus />}>
                {creatingAccount ? "Mendaftarkan…" : "Daftarkan akun"}
              </Button>
            </form>
          </Card>
          <Footnote>Super Admin bisa membuka Page Owner & Pengaturan. Akun pemilik (owner@gmail.com) dilindungi dan tidak bisa dihapus. Menghapus akun tidak menghapus riwayat gaji.</Footnote>
        </>
      )}

      {/* POPUP FOTO BUKTI */}
      {photoPopup && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 font-sans">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPhotoPopup(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <button 
              onClick={() => setPhotoPopup(null)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-md transition-all z-20"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
            {typeof photoPopup === "string" ? (
              <>
                <img src={photoPopup} alt="Bukti Absen" className="w-full object-contain" style={{ maxHeight: '70vh' }} />
                <div className="p-4 text-center bg-zinc-50 dark:bg-[#252528] border-t border-zinc-200 dark:border-white/5 shrink-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">Foto Bukti Kehadiran</p>
                  <p className="text-[11px] font-medium text-zinc-500 mt-0.5">Disimpan secara real-time saat absen</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 text-center bg-zinc-50 dark:bg-[#252528] border-b border-zinc-200 dark:border-white/5 shrink-0">
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">{photoPopup.title || "Foto Bukti Kehadiran"}</p>
                  <p className="text-[11px] font-medium text-zinc-500 mt-0.5">{photoPopup.items?.length || 0} Foto Bukti Lengkap</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {photoPopup.items?.map((it: any, idx: number) => (
                    <div key={idx} className="bg-zinc-100 dark:bg-[#2C2C2E]/60 rounded-2xl p-2.5 border border-black/5 dark:border-white/5">
                      <div className="text-[12px] font-bold text-zinc-800 dark:text-zinc-200 mb-2 px-1 flex items-center justify-between">
                        <span>{it.label}</span>
                        <span className="text-[10px] text-zinc-400 font-medium">#{idx + 1}</span>
                      </div>
                      <div className="rounded-xl overflow-hidden aspect-[4/3] bg-black">
                        <img src={it.url} alt={it.label} className="w-full h-full object-cover" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

const PegawaiCard = ({ pegawai, onSave, isOwner = false, onUpdateCutoff }: any) => {
    const [records, setRecords] = useState<any[]>(pegawai.records || []);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const isDirtyRef = React.useRef(false);
    const sourceRecordsRef = React.useRef(pegawai.sourceRecords || []);
    const baselineRef = React.useRef(pegawai.records || []);

    // Sync state when DB updates ONLY IF user is not actively editing
    useEffect(() => {
        if (!isDirtyRef.current) {
            setRecords(pegawai.records || []);
            sourceRecordsRef.current = pegawai.sourceRecords || [];
            baselineRef.current = pegawai.records || [];
        }
    }, [pegawai, isSaving]);

    const handleAddRecord = () => {
        isDirtyRef.current = true;
        const newId = `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newBulanTahun = normalizeBulanTahun(getAbsenCycleInfo(getTodayYmd(), pegawai.cutoffDay || 1).bulanTahun);

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
             bulanTahun: newBulanTahun,
             gajiPokok: defaultPokok,
             gajiTambahan: [],
             gajiPengurangan: [],
             buktiTransfer: ""
        };
        setRecords([newRecord, ...records]);
        setExpandedRecordId(newId);
    };

    const handleUpdateRecord = (id: string, patch: any) => {
        isDirtyRef.current = true;
        setRecords(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
    };

    const handleDeleteRecord = (id: string) => {
        if(confirm("Yakin ingin menghapus rekam gaji ini?")) {
            isDirtyRef.current = true;
            setRecords(prev => prev.filter(r => r.id !== id));
        }
    };

    const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            isDirtyRef.current = true;
            const reader = new FileReader();
            reader.onloadend = () => handleUpdateRecord(id, { buktiTransfer: reader.result as string });
            reader.readAsDataURL(file);
        }
    };

    const isChanged = JSON.stringify(records) !== JSON.stringify(pegawai.records || []);

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await onSave(pegawai.email, records, sourceRecordsRef.current, baselineRef.current);
            isDirtyRef.current = false;
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error("Save error:", err);
        } finally {
            setIsSaving(false);
        }
    };

    const todayStr = getTodayYmd();
    const empCutoff = pegawai.cutoffDay || 1;
    const currentCycle = getAbsenCycleInfo(todayStr, empCutoff);

    return (
        <fieldset disabled={isSaving} className={`min-w-0 rounded-card bg-surface p-4 shadow-card flex flex-col gap-3 transition-all ${
            isChanged ? 'ring-2 ring-warning/50' : 'ring-1 ring-edge'
        }`}>

            {/* Header User */}
            <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-3 w-full">
                    <UserAvatar
                      photoUrl={pegawai.photoUrl}
                      email={pegawai.email}
                      profileColor={pegawai.profileColor}
                      size="xl"
                    />
                    <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-headline text-label truncate capitalize">{pegawai.email.split("@")[0]}</h3>
                          {saveSuccess && (
                              <Pill tone="positive">Tersimpan</Pill>
                          )}
                       </div>
                       <p className="text-footnote text-label-2 truncate">{pegawai.email}</p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                        <span className="text-caption text-label-2">Buka aplikasi</span>
                        <span className="text-subhead font-semibold tabular-nums text-label">{pegawai.loginsCount}×</span>
                    </div>
                </div>
            </div>

            {/* Unsaved Changes Banner */}
            {isChanged && (
                <div className="flex items-center justify-between gap-2 rounded-tile bg-warning/10 px-3.5 py-2.5 text-footnote text-label dark:bg-warning/15">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                        <AlertTriangle size={15} className="shrink-0 text-warning" /> Ada perubahan belum disimpan
                    </span>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>{isSaving ? "Menyimpan…" : "Simpan"}</Button>
                </div>
            )}

            {/* Cutoff Setting & Siklus Badge Row */}
            <div className="flex items-center justify-between gap-2 rounded-tile bg-surface-2 px-3.5 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="w-4 h-4 text-tint shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-caption text-label-2">Siklus berjalan · gaji {currentCycle.bulanTahun}</span>
                        <span className="text-subhead font-semibold text-label truncate">
                           {currentCycle.shortLabelPeriode}
                        </span>
                    </div>
                </div>
                {isOwner ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                          value={empCutoff}
                          onChange={(e) => onUpdateCutoff?.(pegawai.email, Number(e.target.value))}
                          className="h-8 rounded-control bg-fill px-2.5 text-footnote font-semibold text-tint outline-none focus:ring-2 focus:ring-tint/40 cursor-pointer"
                          title="Ubah Tanggal Cutoff Gaji & Absensi"
                      >
                          <option value={1}>Tgl 1 (Normal)</option>
                          {Array.from({ length: 30 }, (_, i) => i + 2).map((tgl) => (
                              <option key={tgl} value={tgl}>
                                  Tgl {tgl}
                              </option>
                          ))}
                      </select>
                    </div>
                ) : (
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-500/20 px-2 py-0.5 rounded-md shrink-0">
                        Tgl {empCutoff}
                    </span>
                )}
            </div>

            {/* List Gaji with internal scrolling if too long */}
            <div className="flex flex-col gap-2 w-full">
                {records.length === 0 && (
                    <div className="flex-1 flex items-center justify-center rounded-tile bg-surface-2 py-8 text-footnote text-label-2">
                        Belum ada riwayat gaji.
                    </div>
                )}
                {records.map(r => {
                    const isExpanded = expandedRecordId === r.id;
                    const totalBersih = gajiBersih(r);
                    return (
                        <div key={r.id} className="overflow-hidden rounded-tile bg-surface-2 transition-colors w-full">
                            <div 
                                className="flex items-center justify-between gap-3 px-3.5 py-3 cursor-pointer active:bg-fill transition-colors select-none" 
                                onClick={() => setExpandedRecordId(isExpanded ? null : r.id)}
                            >
                                <span className="min-w-0">
                                    <span className="block text-subhead font-semibold text-label">Gaji bulan {r.bulanTahun}</span>
                                    <span className={`block text-caption ${r.buktiTransfer ? "text-positive" : "text-label-2"}`}>{r.buktiTransfer ? "Ada bukti transfer" : "Belum ada bukti transfer"}</span>
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-subhead font-semibold tabular-nums text-label">{rupiah(Math.max(0, totalBersih))}</span>
                                    <ChevronDown size={16} className={`text-label-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="p-3.5 border-t border-sep space-y-4 animate-in slide-in-from-top-2 duration-200">

                                   <div className="flex justify-between items-end gap-3 w-full">
                                      <div className="flex-1">
                                        <label className="mb-1.5 block text-footnote font-medium text-label-2">Bulan & Tahun</label>
                                        <input type="text" value={r.bulanTahun} onChange={e => handleUpdateRecord(r.id, { bulanTahun: e.target.value })} placeholder="MM/YY" className="w-full bg-surface rounded-control px-3 py-2 text-[16px] border-0 font-bold text-blue-600 dark:text-blue-400 outline-none focus:ring-2 focus:ring-blue-500/50" />
                                      </div>
                                      <button onClick={() => handleDeleteRecord(r.id)} className="h-9 w-9 flex items-center justify-center shrink-0 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors" title="Hapus Gaji Ini">
                                         <Trash2 size={16} />
                                      </button>
                                   </div>

                                   <div>
                                      <label className="mb-1.5 block text-footnote font-medium text-label-2">Gaji Pokok</label>
                                      <input type="number" inputMode="numeric" pattern="[0-9]*" min="0" value={r.gajiPokok} onChange={e => handleUpdateRecord(r.id, { gajiPokok: e.target.value })} className="w-full bg-surface rounded-control px-3 py-2 text-[16px] border-0 font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/50" />
                                   </div>

                                   <div className="w-full space-y-2">
                                       <div className="flex items-center justify-between">
                                           <label className="block text-footnote font-medium text-label-2">Gaji Tambahan</label>
                                              <button onClick={() => {
                                                  const newTb = [...(r.gajiTambahan || []), { id: `tb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, nominal: 0, ket: "Tambahan", status: "belum" }];
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
                                                  }} className="w-28 shrink-0 bg-surface rounded-control px-3 py-2 text-[16px] border-0 font-bold text-positive outline-none" placeholder="Nominal" />
                                                  <input type="text" value={tb.ket} onChange={e => {
                                                      const newTb = [...r.gajiTambahan];
                                                      newTb[i] = { ...newTb[i], ket: e.target.value };
                                                      handleUpdateRecord(r.id, { gajiTambahan: newTb });
                                                  }} className="flex-1 min-w-0 bg-surface rounded-control px-3 py-2 text-[16px] border-0 font-medium text-zinc-900 dark:text-white outline-none" placeholder="Keterangan" />
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
                                              <span className="text-sm font-bold text-purple-600 dark:text-purple-400">+ {rupiah(Number(r.ongkirBulanIni || 0))}</span>
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
                                      const dendaTelatAktif = (r.gajiPengurangan || []).filter((pg: any) => pg._isAutoSistem && !pg._isDendaPulang && !pg.isDibatalkan).reduce((sum: number, pg: any) => sum + (Number(pg.nominal) || 0), 0);
                                      const dendaAbsenAktif = (r.gajiPengurangan || []).filter((pg: any) => pg._isAutoSistem && pg._isDendaPulang && !pg.isDibatalkan).reduce((sum: number, pg: any) => sum + (Number(pg.nominal) || 0), 0);
                                      const totalDendaAktif = dendaTelatAktif + dendaAbsenAktif;
                                      if (totalDendaAktif <= 0) return null;
                                      return (
                                        <div className="w-full bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20 rounded-xl p-3 flex items-center justify-between">
                                          <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 dark:text-rose-400">Total Denda Absensi (⚡ Auto)</span>
                                            <span className="text-sm font-black text-rose-600 dark:text-rose-400">- {rupiah(totalDendaAktif)}</span>
                                          </div>
                                          <span className="text-[9px] font-bold uppercase bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-md">
                                            {dendaTelatAktif > 0 && `Telat: -${rupiah(dendaTelatAktif)}`}
                                            {dendaTelatAktif > 0 && dendaAbsenAktif > 0 && ' · '}
                                            {dendaAbsenAktif > 0 && `Bolos/Pulang: -${rupiah(dendaAbsenAktif)}`}
                                          </span>
                                        </div>
                                      );
                                    })()}

                                   <div className="w-full space-y-2">
                                       <div className="flex items-center justify-between">
                                           <label className="block text-footnote font-medium text-label-2">Gaji Pengurangan</label>
                                               <button onClick={() => {
                                                   const newPg = [...(r.gajiPengurangan || []), { id: `pg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, nominal: 0, ket: "Pengurangan", isDibatalkan: false }];
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
                                                      className={`w-28 shrink-0 border rounded-control px-3 py-2 text-[16px] font-bold outline-none transition-colors ${
                                                        isCanceled
                                                          ? 'line-through text-zinc-400 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700'
                                                          : 'bg-surface border-transparent text-negative'
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
                                                      className={`flex-1 min-w-0 border rounded-control px-3 py-2 text-[16px] outline-none transition-colors ${
                                                        isCanceled
                                                          ? 'line-through text-zinc-400 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-800/50 border-zinc-300 dark:border-zinc-700'
                                                          : 'bg-surface border-transparent text-label'
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
                                           <span className="text-lg font-black text-amber-600 dark:text-amber-400">{rupiah(Math.max(0, totalBersih))}</span>
                                       </div>
                                   </div>

                                   <div>
                                      <label className="mb-1 block text-footnote font-medium text-label-2">Bukti Transfer (Opsional)</label>
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
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 pt-1 w-full">
                <Button variant="gray" icon={<Plus />} onClick={handleAddRecord}>Bulan gaji</Button>
                <Button variant={isChanged ? "filled" : "tinted"} icon={<Save />} disabled={isSaving} onClick={handleSave}>
                   {isSaving ? "Menyimpan…" : isChanged ? "Simpan perubahan" : "Simpan gaji"}
                </Button>
            </div>

        </fieldset>
    );
};

const RangkumanBulanItem = ({ bulan, records }: { bulan: string, records: any[] }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // Periode header hanya ditampilkan jika semua pegawai di bulan ini memakai cutoff yang sama.
    const cycleInfo = useMemo(() => {
        const cutoffs = Array.from(new Set(records.map((r: any) => Number(r.cutoffDay) || 1)));
        return cutoffs.length === 1 ? getCycleInfoFromBulanTahun(bulan, cutoffs[0]) : null;
    }, [bulan, records]);

    const rinci = records.map((r: any) => {
       const pokok = Number(r.gajiPokok) || 0;
       const tambahan = (r.gajiTambahan || []).reduce((sum: number, t: any) => sum + (Number(t.nominal)||0), 0);
       const potongan = (r.gajiPengurangan || []).filter((pg: any) => !pg.isDibatalkan).reduce((sum: number, pg: any) => sum + (Number(pg.nominal)||0), 0);
       const ongkirMasukGaji = Number(r.ongkirMasukGajiBulanIni) || 0;
       const ongkirDisplay = Number(r.ongkirBulanIni) || 0;
       return { r, pokok, tambahan, potongan, ongkirDisplay, bersih: Math.max(0, pokok + tambahan + ongkirMasukGaji - potongan) };
    });
    const totalSatuBulan = rinci.reduce((a, x) => a + x.bersih, 0);

    return (
       <div className="group/row">
           <button type="button" onClick={() => setIsExpanded(!isExpanded)} aria-expanded={isExpanded} className="flex w-full items-center gap-3 pl-4 pr-3 text-left transition-colors active:bg-fill">
               <IconBadge color="green"><Banknote /></IconBadge>
               <div className={`flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-2.5 ${isExpanded ? "" : "border-b border-sep group-last/row:border-b-0"}`}>
                   <div className="min-w-0 flex-1">
                       <div className="truncate text-callout font-medium text-label">Gaji {namaBulanGaji(bulan)}</div>
                       <div className="truncate text-footnote text-label-2">{records.length} pegawai{cycleInfo?.shortLabelPeriode ? ` · ${cycleInfo.shortLabelPeriode}` : ""}</div>
                   </div>
                   <span className="shrink-0 text-subhead font-semibold tabular-nums text-label">{rupiah(totalSatuBulan)}</span>
                   <ChevronDown className={`h-4 w-4 shrink-0 text-label-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
               </div>
           </button>
           {isExpanded && (
               <div className="border-b border-sep bg-surface-2 px-4 py-1 group-last/row:border-b-0">
                   <LineList>
                       {rinci.map((x, i) => (
                           <LineItem
                               key={i}
                               label={<span className="capitalize">{namaPegawai(x.r.email)}</span>}
                               note={`Pokok ${rpShort(x.pokok)} · tambahan ${rpShort(x.tambahan)} · ongkir ${rpShort(x.ongkirDisplay)} · potongan −${rpShort(x.potongan)} · ${getCycleInfoFromBulanTahun(bulan, Number(x.r.cutoffDay) || 1).shortLabelPeriode}`}
                               value={rupiah(x.bersih)}
                           />
                       ))}
                       <LineItem label="Total bulan ini" total value={rupiah(totalSatuBulan)} />
                   </LineList>
               </div>
           )}
       </div>
    );
};
