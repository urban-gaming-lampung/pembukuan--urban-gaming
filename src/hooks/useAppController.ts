import { runSalaryTransaction } from "../lib/salaryPersistence";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { runTransaction, collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, updateDoc, query, getDocs, getDoc, where, orderBy, serverTimestamp, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth, listGameDb, storage } from "../lib/firebase";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { usePresence } from "./usePresence";
import { useFormDraft } from "./useFormDraft";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { uploadBackupToDrive, downloadBackupFromDrive } from "../lib/googleDrive";
import versionData from "../version.json";
import { useGameConfig } from "../games/hooks/useGameConfig";
import { RowHarian, RowJajanan, RowJasaAks, RowSewa, HistoryItem } from "../lib/types";
import { DEFAULT_HARGA_HARIAN, DEFAULT_HARGA_JAJANAN, DEFAULT_HARGA_JASA_AKS, DEFAULT_HARGA_SEWA } from "../constants/prices";
import { checkCatalogBaselineAndLogUpdates, isVersionLower, SavedCatalogState } from "../lib/catalog";
import useStokData from "./useStokData";
import { bukaHalamanStok } from "../lib/stokRental";
import { isBarisNota, sinkronNotaKePembukuan, useNotaHariKerja } from "../lib/posPembukuan";
import { CatatanPengingat, wajibWaPenyewa } from "../lib/pengingatSewa";
import { waValid } from "../lib/wa";
import { cariBarisSewa, daftarSewaBerjalan, hargaDasarSewa, ONGKIR_BAGI_HASIL_SEJAK, ongkirBaris, ongkirPengantar, perluKonfirmasiKembali, siapkanOngkirSimpan, tagihanBelumBayar, waBaris } from "../lib/sewa";
import { bayarCash, bayarTransfer, catatLogPembukuan, periodRange, saringPeriode, totalBaris } from "../lib/keuangan";
import { rupiah, toInt } from "../lib/format";
import { PdfExporterHandle } from "../components/PdfExporter";
import { getAbsenCycleInfo, normalizeBulanTahun, normalizeDateStr, isLogForDate } from "../lib/absenPeriod";
import { jamDiniHari, menitHariKerja, toLocalYmd } from "../lib/dateLocal";
import { buildSewaTable, effectiveSewaPrices, effectiveJasaPrices, cleanPriceList } from "../lib/priceLists";

type ImageQuality = "Tinggi" | "Hemat";
type Price = { label: string; price: number };
type PriceListKey = "harian" | "jajanan" | "jasaAks" | "sewa";

const getWibDate = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

/** Tanggal hari kerja saat ini (WIB): dini hari (sebelum JAM_GANTI_HARI) masih hari kerja kemarin. */
const getBusinessDate = () => {
  const wib = getWibDate();
  if (jamDiniHari(wib.getHours())) {
    wib.setDate(wib.getDate() - 1); // Mundur 1 hari
  }
  return wib;
};

/** Dokumen history_pembukuan -> HistoryItem (total selalu angka). */
const bacaDokHistory = (snap: { forEach: (cb: (d: any) => void) => void }): HistoryItem[] => {
  const items: HistoryItem[] = [];
  snap.forEach((d) => {
    const data = d.data();
    items.push({
      id: d.id, ...data,
      totalHarian: toInt(data.totalHarian),
      totalJajanan: toInt(data.totalJajanan),
      totalJasaAks: toInt(data.totalJasaAks),
      totalSewa: toInt(data.totalSewa),
      totalCash: toInt(data.totalCash),
      totalTransfer: toInt(data.totalTransfer),
    } as HistoryItem);
  });
  return items;
};

/** Semua dokumen pembukuan (untuk backup lengkap, tidak tergantung filter). */
const ambilSemuaHistory = async () => bacaDokHistory(await getDocs(collection(db, "history_pembukuan")));

export default function useAppController() {
  const rootRef = useRef<HTMLDivElement>(null);
  const appStokData = useStokData();
  const pdfRef = useRef<PdfExporterHandle>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dark, setDark] = useState(true);
  const [themeMode, setThemeMode] = useState<"light"|"dark"|"auto">("dark");
  const [showChallenge, setShowChallenge] = useState(false);
  const { config: gameConfig } = useGameConfig();
  const [kualitasGambar, setKualitasGambar] = useState<ImageQuality>("Tinggi");

  // ===== MODE & EXPORT STATE =====
  const [tableMode, setTableMode] = useState<"Lama" | "Baru">("Baru");
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const isMobileTable = tableMode === "Baru" && !isExportingPDF;

  // ===== AUTH STATE =====
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("admin");
  const isSuperAdminOrOwner = user?.email?.toLowerCase().trim() === "owner@gmail.com" || userRole === "super admin";

  // ===== PROFILE & BG STATE =====
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [userProfileColor, setUserProfileColor] = useState<string>("#3b82f6");
  const [customBgDark, setCustomBgDark] = useState<string | null>(() => {
    try { return localStorage.getItem('custom_bg_dark'); } catch(e) { return null; }
  });

  // ===== ASSISTANT STATE =====
  const [triggeredAssistants, setTriggeredAssistants] = useState<any[]>([]);

  useEffect(() => {
    if (user?.email && isSuperAdminOrOwner) {
      const q = query(collection(db, "owner_assistants"), where("status", "==", "aktif"));
      getDocs(q).then(snap => {
        const triggers = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter((a: any) => {
          const today = new Date();
          if (a.tanggal === today.getDate()) {
            if (!a.last_triggered) return true;
            const last = new Date(a.last_triggered);
            return last.getMonth() !== today.getMonth() || last.getFullYear() !== today.getFullYear();
          }
          return false;
        });
        setTriggeredAssistants(triggers);
      }).catch(console.error);
    }
  }, [user, isSuperAdminOrOwner]);

  const handleRunAssistant = async (a: any) => {
    try {
      const expenseRef = collection(db, "owner_expenses");
      await addDoc(expenseRef, {
        nama: a.nama_pengeluaran,
        kategori: a.kategori || "Lainnya",
        harga: Number(a.nominal || 0),
        tanggal: toLocalYmd(),
        // Asisten = tagihan rutin; tandai usahanya (default Rental) agar analitik terpisah benar
        bisnis: a.bisnis === "USAHA" ? "USAHA" : "RENTAL",
        timestamp: Date.now()
      });
      await updateDoc(doc(db, "owner_assistants", a.id), {
        last_triggered: Date.now()
      });
      setTriggeredAssistants(prev => prev.filter(x => x.id !== a.id));
      alert(`Berhasil menambahkan pengeluaran: ${a.nama_pengeluaran}`);
    } catch(e: any) {
      alert("Gagal menjalankan asisten: " + e.message);
    }
  };

  const handleDismissAssistant = async (id: string) => {
    try {
      await updateDoc(doc(db, "owner_assistants", id), {
        last_triggered: Date.now()
      });
      setTriggeredAssistants(prev => prev.filter(x => x.id !== id));
    } catch(e: any) {
      console.error("Gagal melewati asisten:", e);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser?.email) {
          const email = currentUser.email.toLowerCase().trim();
          if (email === "owner@gmail.com") {
              setActiveTab("PAGE OWNER");
          } else {
              try {
                  const logRef = doc(db, "pegawai_logs", email);
                  await setDoc(logRef, {
                      email: email,
                      logins: arrayUnion(Date.now())
                  }, { merge: true });
              } catch(e) { console.error("Pegawai log failed", e) }
          }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setIsDeactivated(false);
    setUserProfileLoaded(false);
    if (user?.email) {
      const email = user.email.toLowerCase().trim();
      const profileRef = doc(db, "users", email);
      const unsub = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
             const data = snap.data();
             if (data.status === "nonaktif" && email !== "owner@gmail.com") {
                setIsDeactivated(true);
                signOut(auth).catch(console.error);
                return;
             }
             setUserProfilePic(data.photoUrl || null);
             if (data.role) {
                setUserRole(data.role);
                if (data.role === "super admin") {
                   setActiveTab((prev) => prev === "MONITORING" ? "PAGE OWNER" : prev);
                 }
             } else {
                setUserRole("admin");
             }
             if (data.customBgDark !== undefined) {
                setCustomBgDark(data.customBgDark || null);
                try { 
                  if (data.customBgDark) localStorage.setItem('custom_bg_dark', data.customBgDark);
                  else localStorage.removeItem('custom_bg_dark');
                } catch(e) {}
             }
             if (typeof data.themeMode === "string") {
                setThemeMode(data.themeMode as any);
             } else if (typeof data.dark === "boolean") {
                setThemeMode(data.dark ? "dark" : "light");
                setDark(data.dark);
             }
             if (data.profileColor) setUserProfileColor(data.profileColor);

             if (data.kualitasGambar) setKualitasGambar(data.kualitasGambar as ImageQuality);
             if (data.tableMode) setTableMode(data.tableMode as "Lama" | "Baru");

             if (data.posCatalogState) {
                setDbCatalogState(data.posCatalogState);
             } else {
                setDbCatalogState(null);
             }
             setUserProfileLoaded(true);
          } else {
             setUserProfilePic(null);
             setUserRole("admin");
             setDbCatalogState(null);
             if (email !== "owner@gmail.com") {
                setIsDeactivated(true);
                signOut(auth).catch(console.error);
             } else {
                setUserProfileLoaded(true);
             }
          }
      }, (err) => {
         console.error("Error listening to user profile:", err);
         setUserProfileLoaded(true);
      });
      return () => unsub();
    } else {
      setUserProfilePic(null);
      setUserRole("admin");
      setDbCatalogState(null);
      setUserProfileLoaded(false);
    }
  }, [user?.email]);

  // Simpan gambar ke Storage lalu simpan URL-nya (bukan base64) di dokumen users, supaya
  // koleksi users tetap ringan. Kalau upload gagal, jatuh ke cara lama (base64).
  const persistUserImage = async (kind: "avatar" | "bg", dataUrl: string): Promise<string> => {
    if (!user?.email || !dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;
    try {
      const email = user.email.toLowerCase().trim();
      const r = storageRef(storage, `profile_photos/${email}/${kind}_${Date.now()}.jpg`);
      await uploadString(r, dataUrl, "data_url");
      return await getDownloadURL(r);
    } catch (e) {
      console.warn("Upload gambar profil gagal, simpan base64:", e);
      return dataUrl;
    }
  };

  const handleProfilePicChange = async (dataUrl: string) => {
    setUserProfilePic(dataUrl);
    if (user?.email) {
      const photoUrl = await persistUserImage("avatar", dataUrl);
      setDoc(doc(db, "users", user.email), { photoUrl }, { merge: true }).catch(console.error);
    }
  };

  const handleBgDarkChange = async (dataUrl: string | null) => {
    setCustomBgDark(dataUrl);
    try { 
       if (dataUrl) localStorage.setItem('custom_bg_dark', dataUrl);
       else localStorage.removeItem('custom_bg_dark');
    } catch(e) { console.error(e); }

    if (user?.email) {
      persistUserImage("bg", dataUrl || "").then((url) =>
        setDoc(doc(db, "users", user.email!), { customBgDark: url || null }, { merge: true })
      ).catch(console.error);
    }
  };

  const today = getBusinessDate();
  const [tanggal, setTanggal] = useState(toLocalYmd(today));
  const [hari, setHari] = useState(() => {
    const h = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(today);
    return h.charAt(0).toUpperCase() + h.slice(1);
  });

  const systemDateRef = useRef(today.getDate());
  const hasDataRef = useRef(false);
  const historyRef = useRef<any[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (hasDataRef.current) return;

      const bizDate = getBusinessDate();
      const bizDateStr = toLocalYmd(bizDate);

      const bizAlreadySaved = historyRef.current.some(h => h.tanggal === bizDateStr);
      const targetDate = bizAlreadySaved ? getWibDate() : bizDate;

      if (targetDate.getDate() !== systemDateRef.current) {
        systemDateRef.current = targetDate.getDate();
        setTanggal(toLocalYmd(targetDate));
        const h = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(targetDate);
        setHari(h.charAt(0).toUpperCase() + h.slice(1));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ===== TAB STATE =====
  const [activeTab, setActiveTab] = useState<"USAHA RENTAL" | "UPDATE STOK" | "PAGE OWNER" | "MONITORING">("USAHA RENTAL");
  const [adminMonitoringTab, setAdminMonitoringTab] = useState<"status" | "device">("status");
  // Super admin tidak punya tab UPDATE STOK lagi (stok ada di Page Owner › STOK)
  useEffect(() => {
    if (isSuperAdminOrOwner && activeTab === "UPDATE STOK") {
      setActiveTab("PAGE OWNER");
      setTimeout(() => bukaHalamanStok("RENTAL"), 50);
    }
  }, [isSuperAdminOrOwner, activeTab]);

  const handleOpenScan = () => {
    if (isSuperAdminOrOwner) {
      setActiveTab("PAGE OWNER");
    } else {
      setActiveTab("MONITORING");
      setAdminMonitoringTab("device");
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("trigger-device-scan"));
    }, 100);
  };

  const { activeUsers, setFocusedField } = usePresence(user, activeTab, userProfileColor, isSuperAdminOrOwner);

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const fieldId = target.dataset?.fieldid || target.getAttribute("name");
      if (fieldId) setFocusedField(fieldId);
    };
    const handleBlur = () => setFocusedField(null);

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);
    return () => {
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
    };
  }, [setFocusedField]);

  // ===== INPUT FIELD STATE =====
  const [absenPagi, setAbsenPagi] = useState("");
  const [absenSiang, setAbsenSiang] = useState("");
  const [shiftPegawai, _setShiftPegawai] = useState("");
  const [openSettings, setOpenSettings] = useState(false);
  const [openPOS, setOpenPOS] = useState(false);
  const [openGallery, setOpenGallery] = useState(false);
  const [hasVersionUpdate, setHasVersionUpdate] = useState(false);
  const [posUpdates, setPosUpdates] = useState<Record<string, { type: "baru" | "update harga" | "update", timestamp: string }>>({});
  const [posBaseline, setPosBaseline] = useState<SavedCatalogState | null>(null);
  const posBaselineRef = useRef<SavedCatalogState | null>(null);
  const [posBaselineLoaded, setPosBaselineLoaded] = useState(false);

  useEffect(() => {
    posBaselineRef.current = posBaseline;
  }, [posBaseline]);

  const catalogChanges = useMemo(() => {
    const activeChanges: Record<string, "baru" | "update harga" | "update"> = {};
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    Object.entries(posUpdates).forEach(([id, upd]) => {
      if (upd && upd.timestamp) {
        const time = new Date(upd.timestamp).getTime();
        if (time > sevenDaysAgo) {
          activeChanges[id] = upd.type;
        }
      }
    });
    return activeChanges;
  }, [posUpdates]);

  const hasPOSUpdate = useMemo(() => Object.keys(catalogChanges).length > 0 || hasVersionUpdate, [catalogChanges, hasVersionUpdate]);

  const openPOSRef = useRef(openPOS);
  const productsListRef = useRef<any[]>([]);
  const gamesListRef = useRef<any[]>([]);
  const [dbCatalogState, setDbCatalogState] = useState<SavedCatalogState | null>(null);
  const dbCatalogStateRef = useRef<SavedCatalogState | null>(null);
  useEffect(() => {
    dbCatalogStateRef.current = dbCatalogState;
  }, [dbCatalogState]);
  const [userProfileLoaded, setUserProfileLoaded] = useState(false);
  const [isDeactivated, setIsDeactivated] = useState(false);


  useEffect(() => {
    openPOSRef.current = openPOS;
  }, [openPOS]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const setShiftPegawai = useCallback((val: string) => {
    _setShiftPegawai(val);
    if (!editingId && user?.email) {
      setDoc(doc(db, "data", `shift_${user.email.toLowerCase().trim()}`), { shift: val, tanggal }, { merge: true }).catch(console.error);
    }
  }, [editingId, tanggal, user?.email]);

  // ===== REALTIME SSOT ABSENSI LISTENER =====
  const [allLogAbsensi, setAllLogAbsensi] = useState<any[]>([]);

  // Hanya ambil log beberapa hari di sekitar tanggal pembukuan aktif (bukan seluruh koleksi
  // yang terus membesar). Semua pemakai allLogAbsensi memfilter per `tanggal`.
  const logWindowStart = useMemo(() => {
    const now = new Date();
    const base = /^\d{4}-\d{2}-\d{2}$/.test(tanggal || "") ? new Date(`${tanggal}T00:00:00`) : now;
    const start = new Date(Math.min(base.getTime(), now.getTime()));
    start.setDate(start.getDate() - 3);
    return toLocalYmd(start);
  }, [tanggal]);

  useEffect(() => {
    const q = query(
      collection(db, "log_absensi"),
      where("timestamp", ">=", new Date(`${logWindowStart}T00:00:00`).toISOString())
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllLogAbsensi(data);
    }, (err) => console.error("Error fetching log_absensi:", err));
    return () => unsub();
  }, [logWindowStart]);

  // Sync absenPagi, absenSiang, shiftPegawai, and initial rukoBuka/Tutup with log_absensi SSOT (Identical to TabPegawai)
  useEffect(() => {
    if (!tanggal || editingId) return;

    const currentUserEmail = user?.email?.toLowerCase().trim() || "";
    // Owner / super admin / akun tes. JANGAN pakai includes("admin"): pegawai yang emailnya
    // mengandung "admin" ikut tersaring.
    const isSuperAdminOrOwner = (em: string) => {
      if (!em) return false;
      const lower = em.toLowerCase().trim();
      return lower === "owner@gmail.com"
        || lower.includes("superadmin")
        || lower.includes("fauzanazim56")
        || (lower === currentUserEmail && userRole === "super admin");
    };

    const logsForToday = allLogAbsensi.filter((l: any) => isLogForDate(l, tanggal) && l.status !== "deleted" && l.status !== "completed");

    // If no active logs exist today (e.g. fresh day or owner reset logs), reset all attendance states
    if (logsForToday.length === 0) {
      setAbsenPagi("");
      setAbsenSiang("");
      _setRukoBuka("");
      _setRukoBukaDate("");
      _setRukoTutup("");
      _setRukoTutupDate("");
      return;
    }

    // Check if there are real employee logs vs owner test logs
    const hasEmployeeLogs = logsForToday.some((l: any) => l.email && !isSuperAdminOrOwner(l.email));

    // Aggregate logs per employee (SSOT identical to TabPegawai)
    const empMap = new Map<string, { email: string; masuk?: any; pulang?: any; libur?: any; shift?: string }>();

    logsForToday.forEach((l: any) => {
      const em = l.email ? l.email.toLowerCase().trim() : "";
      if (!em) return;
      if (hasEmployeeLogs && isSuperAdminOrOwner(em)) return; // Filter out owner test logs when real employee logs exist

      if (!empMap.has(em)) {
        empMap.set(em, { email: em });
      }
      const entry = empMap.get(em)!;
      if (l.jenisAbsen === "Masuk") {
        entry.masuk = l;
        if (l.shift) entry.shift = l.shift;
      } else if (l.jenisAbsen === "Pulang") {
        entry.pulang = l;
        if (!entry.shift && l.shift) entry.shift = l.shift;
      } else if (l.jenisAbsen === "Libur") {
        entry.libur = l;
        entry.shift = "Libur";
      }
    });

    const entries = Array.from(empMap.values());

    // 1. Urutkan semua Absen Masuk hari ini secara kronologis: PALING PAGI ada di index 0
    const allMasukLogs = logsForToday
      .filter((l: any) => l.jenisAbsen === "Masuk" && l.waktu)
      .sort((a: any, b: any) => menitHariKerja(a.waktu) - menitHariKerja(b.waktu));
    const earliestMasukLog = allMasukLogs[0];

    // 2. Urutkan semua Absen Pulang hari ini secara kronologis: PALING MALAM / DINI HARI (toleransi s.d 03:00) ada di index 0
    const allPulangLogs = logsForToday
      .filter((l: any) => l.jenisAbsen === "Pulang" && l.waktu)
      .sort((a: any, b: any) => menitHariKerja(b.waktu) - menitHariKerja(a.waktu));
    const latestPulangLog = allPulangLogs[0];

    if (currentUserEmail && !isSuperAdminOrOwner(currentUserEmail)) {
      // CURRENT USER IS AN EMPLOYEE (e.g. galang@gmail.com, fauzan@gmail.com)
      if (empMap.has(currentUserEmail)) {
        // This specific employee HAS checked in today!
        const empEntry = empMap.get(currentUserEmail)!;
        setAbsenPagi(empEntry.masuk?.waktu || "");
        setAbsenSiang(empEntry.pulang?.waktu || "");
        if (empEntry.shift) {
          _setShiftPegawai(empEntry.shift);
        }
      } else {
        // This employee has NOT checked in today!
        // NEVER fall back to another employee! Keep attendance clean so they can check in.
        setAbsenPagi("");
        setAbsenSiang("");
      }
    } else {
      // CURRENT USER IS OWNER OR SUPER ADMIN (Tampilan Utama Pembukuan Harian)
      // Wajib mengambil:
      // - Absen Masuk: PALING PAGI (earliest check-in of the day)
      // - Absen Pulang: PALING MALAM / DINI HARI (latest check-out of the day s.d 03:00)
      const pagiPalingPagi = earliestMasukLog?.waktu || "";
      const siangPalingMalam = latestPulangLog?.waktu || "";
      const shiftPagi = earliestMasukLog?.shift || entries[0]?.shift || "";

      setAbsenPagi(pagiPalingPagi);
      setAbsenSiang(siangPalingMalam);
      if (shiftPagi) {
        _setShiftPegawai(shiftPagi);
      }
    }

    // Realtime auto-fill Ruko Buka (Earliest Masuk of the day store-wide)
    if (earliestMasukLog?.waktu) {
      const timePart = earliestMasukLog.waktu.split(" - ")[0]?.trim().replace(':', '.');
      if (timePart) {
        _setRukoBuka(timePart);
        _setRukoBukaDate(normalizeDateStr(tanggal));
      }
    } else {
      _setRukoBuka("");
      _setRukoBukaDate("");
    }

    // Realtime auto-fill Ruko Tutup (Latest Pulang of the day store-wide)
    if (latestPulangLog?.waktu) {
      const timePart = latestPulangLog.waktu.split(" - ")[0]?.trim().replace(':', '.');
      if (timePart) {
        _setRukoTutup(timePart);
        const datePart = latestPulangLog.waktu.split(" - ")[1]?.replace(/\//g, "-");
        _setRukoTutupDate(datePart ? normalizeDateStr(datePart) : normalizeDateStr(tanggal));
      }
    } else {
      _setRukoTutup("");
      _setRukoTutupDate("");
    }
  }, [allLogAbsensi, tanggal, user?.email, editingId, userRole]);

  useEffect(() => {
    if (!user?.email || !tanggal || editingId) return;

    const emailKey = user.email.toLowerCase().trim();
    const unsub = onSnapshot(doc(db, "data", `shift_${emailKey}`), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.tanggal === tanggal && data.shift) {
          _setShiftPegawai(data.shift);
        }
      }
    });
    return () => unsub();
  }, [user?.email, tanggal, editingId]);

  const [rukoBuka, _setRukoBuka] = useState("");
  const [rukoBukaDate, _setRukoBukaDate] = useState("");
  const [rukoTutup, _setRukoTutup] = useState("");
  const [rukoTutupDate, _setRukoTutupDate] = useState("");
  const [rukoStatusDbTanggal, _setRukoStatusDbTanggal] = useState("");
  const [catatan, setCatatan] = useState("");

  const setRukoBuka = useCallback((val: string, dateStr?: string) => {
    _setRukoBuka(val);
    const dStr = dateStr || new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 10);
    if (val) _setRukoBukaDate(dStr);
    if (!editingId && val) {
      const isNewDay = rukoStatusDbTanggal !== tanggal;
      const updateData: any = {
        rukoBuka: val,
        rukoBukaDate: dStr,
        tanggal
      };
      if (isNewDay) {
        updateData.rukoTutup = "";
        updateData.rukoTutupDate = "";
      }
      setDoc(doc(db, "data", "ruko_status"), updateData, { merge: true }).catch(console.error);
    }
  }, [editingId, tanggal, rukoStatusDbTanggal]);

  const setRukoTutup = useCallback((val: string, dateStr?: string) => {
    _setRukoTutup(val);
    const dStr = dateStr || new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 10);
    if (val) _setRukoTutupDate(dStr);
    if (!editingId && val) {
      const isNewDay = rukoStatusDbTanggal !== tanggal;
      const updateData: any = {
        rukoTutup: val,
        rukoTutupDate: dStr,
        tanggal
      };
      if (isNewDay) {
        updateData.rukoBuka = "";
        updateData.rukoBukaDate = "";
      }
      setDoc(doc(db, "data", "ruko_status"), updateData, { merge: true }).catch(console.error);
    }
  }, [editingId, tanggal, rukoStatusDbTanggal]);

  useEffect(() => {
    if (!user) return;

    const unsubUpdates = onSnapshot(doc(db, "data", "pos_updates"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() || {};
        const parsedUpdates: Record<string, any> = {};
        if (data.updates) {
          Object.assign(parsedUpdates, data.updates);
        }
        Object.entries(data).forEach(([key, val]) => {
          if (key.startsWith("updates.")) {
            const id = key.substring(8);
            parsedUpdates[id] = val;
          }
        });
        setPosUpdates(parsedUpdates);
      } else {
        setPosUpdates({});
      }
    }, (err) => {
      console.error("Error listening to pos_updates:", err);
    });

    const unsubBaseline = onSnapshot(doc(db, "data", "pos_baseline"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPosBaseline({
          products: data.products || {},
          games: data.games || {}
        });
      } else {
        setPosBaseline(null);
      }
      setPosBaselineLoaded(true);
    }, (err) => {
      console.error("Error listening to pos_baseline:", err);
      setPosBaselineLoaded(true);
    });

    return () => {
      unsubUpdates();
      unsubBaseline();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let productsLoaded = false;
    let gamesLoaded = false;

    const triggerBaselineCheck = () => {
      if (productsLoaded && gamesLoaded && posBaselineLoaded) {
        checkCatalogBaselineAndLogUpdates(
          productsListRef.current,
          gamesListRef.current,
          posBaselineRef.current
        );
      }
    };

    const qProducts = query(collection(db, "products"));
    const unsubProducts = onSnapshot(qProducts, (snap) => {
      const currentList: any[] = [];
      snap.forEach((docSnap) => {
        currentList.push({ id: docSnap.id, ...docSnap.data() });
      });
      productsListRef.current = currentList;
      productsLoaded = true;
      triggerBaselineCheck();
    }, (err) => {
      console.error("Firestore onSnapshot error (products notification):", err);
    });

    const qGames = query(collection(listGameDb, "games"));
    const unsubGames = onSnapshot(qGames, (snap) => {
      const currentList: any[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        currentList.push({
          id: docSnap.id,
          name: data.name || "",
          price: data.price || 0,
        });
      });
      gamesListRef.current = currentList;
      gamesLoaded = true;
      triggerBaselineCheck();
    }, (err) => {
      console.error("Firestore onSnapshot error (games notification):", err);
    });

    const unsubVersion = onSnapshot(doc(db, "data", "app_version"), (snap) => {
      const clientVersion = versionData.version || "4.0.0";
      if (snap.exists()) {
        const data = snap.data();
        const dbVersion = data.version || "4.0.0";

        if (dbVersion !== clientVersion) {
          if (isVersionLower(clientVersion, dbVersion)) {
            setHasVersionUpdate(true);
          } else {
            setDoc(doc(db, "data", "app_version"), {
              version: clientVersion,
              updatedAt: serverTimestamp(),
              updatedBy: user.email || "System"
            }, { merge: true }).catch(console.error);
          }
        }
      } else {
        setDoc(doc(db, "data", "app_version"), {
          version: clientVersion,
          updatedAt: serverTimestamp(),
          updatedBy: user.email || "System"
        }, { merge: true }).catch(console.error);
      }
    }, (err) => {
      console.error("Firestore onSnapshot error (app_version notification):", err);
    });

    return () => {
      unsubProducts();
      unsubGames();
      unsubVersion();
    };
  }, [user, posBaselineLoaded]);

  useEffect(() => {
    if (productsListRef.current.length > 0 && gamesListRef.current.length > 0 && posBaselineLoaded) {
      checkCatalogBaselineAndLogUpdates(
        productsListRef.current,
        gamesListRef.current,
        posBaselineRef.current
      );
    }
  }, [posBaseline, posBaselineLoaded]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "ruko_status"), (snap) => {
      if (snap.exists() && !editingId) {
        const data = snap.data();
        _setRukoStatusDbTanggal(data.tanggal || "");
        if (data.tanggal && normalizeDateStr(data.tanggal) === normalizeDateStr(tanggal)) {
           if (data.rukoBuka) {
             _setRukoBuka(data.rukoBuka.split(" - ")[0]);
             _setRukoBukaDate(data.rukoBukaDate || normalizeDateStr(tanggal));
           }
           if (data.rukoTutup) {
             _setRukoTutup(data.rukoTutup.split(" - ")[0]);
             _setRukoTutupDate(data.rukoTutupDate || normalizeDateStr(tanggal));
           }
        }
      }
    });
    return () => unsub();
  }, [tanggal, editingId]);

  // State untuk Alert (UI Apple Style)
  const [showDuplicateDateAlert, setShowDuplicateDateAlert] = useState(false);
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
  const [validationAlert, setValidationAlert] = useState<{title: string, message: string} | null>(null);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Data berhasil disimpan!");
  const [showStokConfirmation, setShowStokConfirmation] = useState(false);
  const [showRecheckAlert, setShowRecheckAlert] = useState(false);

  const triggerValidationError = (status: string) => {
      let title = "Data Tidak Lengkap";
      let message = "";
      let targetId = "";

      switch(status) {
          case "mandatory_empty":
              title = "Data Belum Lengkap";
              message = "Absen Pagi, Absen Siang, Ruko Buka, dan Ruko Tutup wajib diisi sebelum export PDF.";
              targetId = "section-input";
              break;
          case "transfer_proof_empty":
              title = "Bukti Transfer Belum Diupload";
              message = "Semua transaksi pemasukan dengan metode pembayaran Transfer wajib meng-upload bukti transfer!";
              targetId = "section-rincian";
              break;
          case "transfer_proof_pengeluaran_empty":
              title = "Bukti Transfer Pengeluaran Kosong";
              message = "Pengeluaran dengan metode pembayaran Transfer wajib meng-upload bukti transfer!";
              targetId = "section-pengeluaran";
              break;
          case "payment_empty":
              title = "Data Tidak Valid";
              message = "Ada item dengan harga tapi tanpa metode bayar.";
              targetId = "section-rincian";
              break;
          case "keterangan_empty_sewa":
              message = "Nama Penyewa wajib diisi pada baris Sewa PS!";
              targetId = "section-rincian";
              break;
          case "wa_penyewa_empty":
              title = "No. WA Penyewa Kosong";
              message = "No. WA penyewa wajib diisi pada setiap baris Sewa PS — dipakai untuk mengingatkan pengembalian unit.";
              targetId = "section-rincian";
              break;
          case "wa_penyewa_invalid":
              title = "No. WA Penyewa Tidak Valid";
              message = "Periksa No. WA penyewa: gunakan nomor HP 08xx / 628xx (10–13 angka).";
              targetId = "section-rincian";
              break;
          case "setoran_ket_empty":
              message = "Keterangan Setoran wajib diisi jika ada nominal!";
              targetId = "section-setoran";
              break;
          case "setoran_tf_empty":
              message = "Status Transfer Setoran (Ya/Belum) wajib dipilih!";
              targetId = "section-setoran";
              break;
          case "pengeluaran_invalid":
              title = "Pengeluaran Tidak Valid";
              message = "Pastikan baris Pengeluaran yang diisi memiliki Keterangan, Nominal yang valid, dan Metode (CASH/TF)!";
              targetId = "section-pengeluaran";
              break;
          case "isPaid_empty":
              title = "Status Pembayaran Kosong";
              message = "Pilihan 'Apakah sudah dibayar?' wajib diisi pada baris Sewa PS yang terisi!";
              targetId = "section-rincian";
              break;
          case "harga_sewa_empty":
              title = "Harga Sewa Kosong";
              message = "Harga Sewa atau durasinya wajib terisi/kalkulasi meskipun unit belum dibayar!";
              targetId = "section-rincian";
              break;
          case "ongkir_empty":
              title = "Ongkir Tidak Valid";
              message = "Pilihan 'Apakah Ada ongkir?' wajib diisi pada baris Sewa PS yang terisi!";
              targetId = "section-rincian";
              break;
          case "ongkir_invalid":
              title = "Ongkir Tidak Valid";
              message = "Nominal Ongkir dan Metode (Cash/TF) wajib diisi jika ada ongkir!";
              targetId = "section-rincian";
              break;
          case "diantar_oleh_empty":
              title = "Pengantar Belum Dipilih";
              message = "Kolom 'Diantar Oleh' wajib diisi pada setiap baris Sewa PS yang memiliki data!";
              targetId = "section-rincian";
              break;
          case "jam_masuk_sewa_empty":
              title = "Jam Masuk Kosong";
              message = "Jam Masuk Sewa pada tabel Pemasukan Sewa wajib diisi sebelum Export/Simpan!";
              targetId = "section-rincian";
              break;
      }

      setValidationAlert({ title, message });

      if (targetId) {
          setTimeout(() => {
              const el = document.getElementById(targetId);
              if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add("ring-2", "ring-red-500", "ring-offset-2", "transition-all", "duration-500", "rounded-2xl");
                  setTimeout(() => {
                      el.classList.remove("ring-2", "ring-red-500", "ring-offset-2");
                  }, 2500);
              }
          }, 100);
      }
  };

  const [savedSignature, setSavedSignature] = useState("");
  const isJustSavedOrLoaded = useRef(true);

  // ===== PRICE SETTINGS =====
  const [hargaHarian, setHargaHarian] = useState<Price[]>(DEFAULT_HARGA_HARIAN as Price[]);
  const [hargaJajanan, setHargaJajanan] = useState<Price[]>(DEFAULT_HARGA_JAJANAN as Price[]);
  const [hargaJasaAks, setHargaJasaAks] = useState<Price[]>(DEFAULT_HARGA_JASA_AKS as Price[]);
  const [hargaSewa, setHargaSewa] = useState<Price[]>(DEFAULT_HARGA_SEWA as Price[]);

  const [ongkirConfig, setOngkirConfig] = useState({ pegawaiPersen: 70, masukGaji: false });
  const [absenConfig, setAbsenConfig] = useState({ durasiWaktuPotongan: 15, waktuToleransi: 15, nominalDenda: 1500, dendaTidakAbsenPulang: 40000, tanggalMulaiHitung: 1 });

  const [openEditRincian, setOpenEditRincian] = useState<PriceListKey | null>(null);

  // Edit Rincian menampilkan daftar yang SAMA PERSIS dengan yang dipakai tabel.
  const getPrices = (key: PriceListKey): Price[] => {
    if (key === "harian") return hargaHarian;
    if (key === "jajanan") return hargaJajanan;
    if (key === "jasaAks") return effectiveJasaPrices(hargaJasaAks);
    return effectiveSewaPrices(hargaSewa);
  };

  // ===== Tampil / sembunyikan tabel rincian di Usaha Rental (diatur super admin) =====
  const DEFAULT_RINCIAN_VISIBILITY = { harian: true, jajanan: true, jasaAks: true, sewa: true, pengeluaran: true, setoran: true };
  type RincianKey = keyof typeof DEFAULT_RINCIAN_VISIBILITY;
  const [rincianVisibility, setRincianVisibility] = useState<Record<RincianKey, boolean>>(DEFAULT_RINCIAN_VISIBILITY);
  const handleUpdateRincianVisibility = async (key: RincianKey, visible: boolean) => {
    if (!isSuperAdminOrOwner) { alert("Hanya super admin yang dapat mengatur tabel rincian."); return; }
    const next = { ...rincianVisibility, [key]: visible };
    setRincianVisibility(next);
    try {
      await setDoc(doc(db, "data", "settings"), { rincianVisibility: next }, { merge: true });
    } catch (e: any) {
      setRincianVisibility(rincianVisibility);
      alert("Gagal menyimpan pengaturan tabel: " + (e?.message || e));
    }
  };

  // Harga sewa dari SUMBER TUNGGAL yang sama dengan tabel (lib/priceLists).
  const sewaPriceTable = useMemo(() => buildSewaTable(hargaSewa), [hargaSewa]);

  const getTitle = (key: PriceListKey | null) => {
    switch (key) {
      case "harian": return "Pemasukan Harian";
      case "jajanan": return "Jajanan";
      case "jasaAks": return "Pemasukan Usaha";
      case "sewa": return "Sewa PS";
      default: return "";
    }
  };

  // Write only explicit edits; snapshots and initial defaults never trigger writes.
  const priceDefaults = { hargaHarian: DEFAULT_HARGA_HARIAN, hargaJajanan: DEFAULT_HARGA_JAJANAN, hargaJasaAks: DEFAULT_HARGA_JASA_AKS, hargaSewa: DEFAULT_HARGA_SEWA };
  const priceFields = { harian: "hargaHarian", jajanan: "hargaJajanan", jasaAks: "hargaJasaAks", sewa: "hargaSewa" } as const;
  const samePriceList = (a: unknown, b: unknown) =>
    JSON.stringify(cleanPriceList(a as Price[])) === JSON.stringify(cleanPriceList(b as Price[]));
  const persistPrices = async (patch: Partial<Record<keyof typeof priceDefaults, Price[]>>, expected = { hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa }) => {
    if (!user || !isSuperAdminOrOwner) {
      throw new Error("Hanya super admin yang dapat mengubah rincian harga.");
    }
    const settingsRef = doc(db, "data", "settings");
    await runTransaction(db, async transaction => {
      const snap = await transaction.get(settingsRef);
      const data = snap.data() || {};
      const current = { ...data.settings?.priceLists, ...data.priceLists };
      for (const field of Object.keys(patch) as (keyof typeof priceDefaults)[]) {
        if (!Array.isArray(patch[field])) throw new Error("Format rincian harga tidak valid.");
        // Bandingkan ISI (nama + harga), bukan teks JSON mentah: urutan key / tipe angka dari
        // Firestore bisa berbeda walau datanya sama, dulu membuat simpan selalu gagal.
        if (!samePriceList(current[field] ?? priceDefaults[field], expected[field])) {
          console.warn("[Edit Rincian] konflik", field, { server: current[field], lokal: expected[field] });
          throw new Error("Rincian berubah di perangkat lain. Salin perubahan Anda dan buka ulang Edit Rincian sebelum menyimpan.");
        }
      }
      transaction.set(settingsRef, { priceLists: patch, priceListsRevision: (Number(data.priceListsRevision) || 0) + 1 }, { merge: true });
    });
  };

  const handleSavePrices = async (key: PriceListKey, next: Price[], baseline: Price[]) => {
    const field = priceFields[key];
    const cleaned = cleanPriceList(next);
    // Label kembar membuat salah satu harga tidak pernah terpakai di tabel
    const seen = new Set<string>();
    const dupes = cleaned.filter((x) => { const k = x.label.toLowerCase(); if (seen.has(k)) return true; seen.add(k); return false; });
    if (dupes.length) throw new Error(`Ada nama item kembar: ${dupes.map((d) => d.label).join(", ")}. Hapus salah satunya.`);
    // Editor dibuka dengan daftar "efektif" (sama dengan tabel); bandingkan dengan data mentah tersimpan.
    const raw = { hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa }[field];
    const effective = key === "sewa" ? effectiveSewaPrices(raw) : key === "jasaAks" ? effectiveJasaPrices(raw) : raw;
    const expectedRaw = samePriceList(baseline, effective) ? raw : baseline;
    await persistPrices({ [field]: cleaned }, { hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa, [field]: expectedRaw });
    setOpenEditRincian(null);
  };

  const handleResetSpecificDefault = async (key: PriceListKey) => {
    try {
      const field = priceFields[key];
      await persistPrices({ [field]: priceDefaults[field] });
      setOpenEditRincian(null);
      setSuccessMessage(`List ${getTitle(key)} berhasil di-reset ke default!`);
      setShowSuccessAlert(true);
    } catch (error: any) { alert(error?.message || "Gagal menyimpan rincian."); }
  };

  // ===== TABLE ROWS STATE =====
  const blankHarian: RowHarian = { jenisPS: "", jamMasuk: "", jumlahJam: "", harga: "", bayar: "" };
  const blankJajanan: RowJajanan = { jenisJajanan: "", qtyJam: "", harga: "", bayar: "" };
  const blankJasaAks: RowJasaAks = { tipe: "", ket: "", harga: "", bayar: "" };
  const blankSewa: RowSewa & { _customBase?: string | number } = { jenisPS: "", lamaSewa: "", jamMasukSewa: "", ket: "", waPenyewa: "", isPaid: "", harga: "", isOngkir: "", _ongkir: "", _bayarOngkir: "", bayar: "", _customDurasi: "", _customBase: "", diantarOleh: "" };

  const genRowId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const newBlankSewa = () => ({ ...blankSewa, _rowId: genRowId() });

  const [rowsHarian, setRowsHarian] = useState(Array.from({ length: 5 }, () => ({ ...blankHarian })));
  const [rowsJajanan, setRowsJajanan] = useState(Array.from({ length: 5 }, () => ({ ...blankJajanan })));
  const [rowsJasaAks, setRowsJasaAks] = useState(Array.from({ length: 5 }, () => ({ ...blankJasaAks })));
  const [rowsSewa, setRowsSewa] = useState<(RowSewa & { _customBase?: string | number })[]>(Array.from({ length: 5 }, () => newBlankSewa()));

  const [rowsSetoran, setRowsSetoran] = useState<any[]>([
    { ket: "", harga: "", bayar: "" }
  ]);
  const [rowsPengeluaran, setRowsPengeluaran] = useState<any[]>([
    { ket: "", harga: "", bayar: "", buktiTransfer: "" }
  ]);

  const totalHarian = useMemo(() => rowsHarian.reduce((s, r) => s + toInt(r.harga), 0), [rowsHarian]);
  const totalJajanan = useMemo(() => rowsJajanan.reduce((s, r) => s + toInt(r.harga), 0), [rowsJajanan]);
  // Rincian Pemasukan Usaha = baris manual (form) + baris jasa dari nota POS hari kerja ini (terkunci)
  const notaHariKerja = useNotaHariKerja(tanggal);
  const barisNotaJasa = notaHariKerja.baris;
  const notaBarangHari = notaHariKerja.barang;
  const totalNotaJasa = useMemo(() => totalBaris(barisNotaJasa), [barisNotaJasa]);
  const totalJasaAksManual = useMemo(() => rowsJasaAks.reduce((s, r) => s + toInt(r.harga), 0), [rowsJasaAks]);
  const totalJasaAks = totalJasaAksManual + totalNotaJasa.total;
  /** Baris rincian usaha yang disimpan: manual + nota POS (SSOT untuk history, PDF & laporan). */
  const rowsJasaAksLengkap = useMemo(
    () => [...rowsJasaAks.filter((r: any) => !isBarisNota(r)), ...barisNotaJasa] as RowJasaAks[],
    [rowsJasaAks, barisNotaJasa]
  );
  const totalSewa = useMemo(() => rowsSewa.reduce((s, r) => s + toInt(r.harga), 0), [rowsSewa]);

  // Kas manual (semua rincian form) — aturan tunai / transfer SSOT lib/keuangan
  const kasManual = useMemo(() => totalBaris([...rowsHarian, ...rowsJajanan, ...rowsJasaAks, ...rowsSewa]), [rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa]);
  const totalCashManual = kasManual.cash;
  const totalTransferManual = kasManual.transfer;

  // Kas harian ikut jasa dari nota POS (barang jualan tidak — langsung disetor ke owner)
  const totalCash = totalCashManual + totalNotaJasa.cash;
  const totalTransfer = totalTransferManual + totalNotaJasa.transfer;

  const totalPengeluaran = useMemo(() => rowsPengeluaran.reduce((s, r) => s + toInt(r.harga), 0), [rowsPengeluaran]);
  const totalPengeluaranCash = useMemo(() => rowsPengeluaran.reduce((sum, r) => (r.bayar === "Cash" ? sum + toInt(r.harga) : sum), 0), [rowsPengeluaran]);
  const manualPengeluaranCash = useMemo(() => rowsPengeluaran.reduce((sum, r: any) => (r.bayar === "Cash" && !r._autoOngkirKey ? sum + toInt(r.harga) : sum), 0), [rowsPengeluaran]);

  useEffect(() => {
    // Ongkir bagi hasil: bagian pengantar dibayar lewat gaji, bukan dari kas harian
    const isNewPolicy = tanggal >= ONGKIR_BAGI_HASIL_SEJAK;

    let sisaKas: number;

    if (isNewPolicy) {
      sisaKas = Math.max(0, totalCash - manualPengeluaranCash);
    } else {
      const ongkirIncomeCash = rowsSewa.reduce((sum, r: any) => (bayarCash(r.bayar) ? sum + ongkirBaris(r) : sum), 0);
      const ongkirExpenseCash = rowsSewa.reduce((sum, r: any) => (r._bayarOngkir === "Cash" ? sum + ongkirPengantar(r, ongkirConfig.pegawaiPersen) : sum), 0);

      const baseIncomeCash = totalCash - ongkirIncomeCash;
      const baseExpenseCash = totalPengeluaranCash - ongkirExpenseCash;
      sisaKas = Math.max(0, baseIncomeCash - baseExpenseCash);
    }

    setRowsSetoran(prev => {
        const newRows = [...prev];
        if (newRows.length > 0) {
            if (newRows[0].harga !== sisaKas) {
                newRows[0] = { ...newRows[0], harga: sisaKas };
                return newRows;
            }
        }
        return prev;
    });
  }, [totalCash, totalPengeluaranCash, manualPengeluaranCash, rowsSewa, ongkirConfig.pegawaiPersen, tanggal]);

  useEffect(() => {
     const ongkirEntries: { key: string; ket: string; harga: number; bayar: string; _namaPengantar?: string }[] = [];

     rowsSewa.forEach((r) => {
       // Pelunasan sewa dari hari lain: ongkir pengantarnya sudah dicatat di pembukuan hari sewa
       if ((r as any)._ongkirSudahDicatat) return;
       if (ongkirBaris(r) > 0 && (r as any).diantarOleh) {
         const ongkirCustomer = ongkirBaris(r);
         const rowId = (r as any)._rowId || `legacy_${(r as any).ket}_${(r as any).jamMasukSewa}`;
         const pegawaiNominal = ongkirPengantar(r, ongkirConfig.pegawaiPersen);

         const namaPengantar = ((r as any).diantarOleh || "").split("@")[0] || "Admin";
         const fmtOngkir = ongkirCustomer.toLocaleString("id-ID");

         ongkirEntries.push({
           key: `_autoOngkir_${rowId}`,
           ket: `Ongkir (${namaPengantar}) ${fmtOngkir}`,
           harga: pegawaiNominal,
           bayar: (r as any)._bayarOngkir || "",
           _namaPengantar: namaPengantar,
         });
       }
     });

     setRowsPengeluaran(prev => {
       const manual = prev.filter(r => !r._autoOngkirKey && r.ket !== "Ongkir ");
       const result = [
         ...manual,
         ...ongkirEntries.map(e => ({
           ket: e.ket,
           harga: e.harga,
           bayar: e.bayar,
           _autoOngkirKey: e.key,
           _namaPengantar: e._namaPengantar,
         }))
       ];
       if (result.length === 0) result.push({ ket: "", harga: "", bayar: "" });

       const prevStr = JSON.stringify(prev.map(r => ({ k: r.ket, h: r.harga, b: r.bayar, a: r._autoOngkirKey })));
       const nextStr = JSON.stringify(result.map(r => ({ k: r.ket, h: r.harga, b: r.bayar, a: r._autoOngkirKey })));
       return prevStr === nextStr ? prev : result;
     });
  }, [rowsSewa, ongkirConfig.pegawaiPersen]);

  const hasData = useMemo(() => {
    if (absenPagi || absenSiang || rukoBuka || rukoTutup || catatan) return true;
    if (totalHarian > 0 || totalJajanan > 0 || totalJasaAks > 0 || totalSewa > 0) return true;
    return false;
  }, [absenPagi, absenSiang, rukoBuka, rukoTutup, catatan, totalHarian, totalJajanan, totalJasaAks, totalSewa]);

  useEffect(() => {
    hasDataRef.current = hasData;
  }, [hasData]);

  const mandatoryFilled = useMemo(() => {
    if (shiftPegawai === "Libur") return !!(rukoBuka && rukoTutup);
    return !!(absenPagi && absenSiang && rukoBuka && rukoTutup);
  }, [absenPagi, absenSiang, rukoBuka, rukoTutup, shiftPegawai]);

  // ===== HISTORY & FILTER =====
  const [histTerbaru, setHistTerbaru] = useState<HistoryItem[]>([]);
  const [histFilter, setHistFilter] = useState<HistoryItem[]>([]);
  const history = useMemo(() => {
    const m = new Map<string, HistoryItem>();
    [...histFilter, ...histTerbaru].forEach((h) => m.set(h.id, h));
    return Array.from(m.values()).sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id.localeCompare(a.id));
  }, [histTerbaru, histFilter]);

  useEffect(() => { historyRef.current = history; }, [history]);



  const [filter, setFilter] = useState("Bulan Ini"); 
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  // Satu aturan periode untuk pembukuan, analitik & transaksi owner (lib/keuangan)
  const filteredHistory = useMemo(() => saringPeriode(history, filter, filterMonth, rangeStart, rangeEnd), [filter, history, filterMonth, rangeStart, rangeEnd]);

  const exportData = useMemo(() => ({
    tanggal, hari, absenPagi, absenSiang, catatan,
    rowsHarian, rowsJajanan, rowsJasaAks: rowsJasaAksLengkap, rowsSewa,
    totalHarian, totalJajanan, totalJasaAks, totalSewa,
    totalCash, totalTransfer, history,
    rowsSetoran, rowsPengeluaran
  }), [
    tanggal, hari, absenPagi, absenSiang, catatan,
    rowsHarian, rowsJajanan, rowsJasaAksLengkap, rowsSewa,
    totalHarian, totalJajanan, totalJasaAks, totalSewa,
    totalCash, totalTransfer, history,
    rowsSetoran, rowsPengeluaran
  ]);

  // --- DIRTY CHECK LOGIC ---
  const currentFormSignature = useMemo(() => {
    return JSON.stringify({
      tanggal, hari, catatan,
      rukoBuka, rukoTutup,
      rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa,
      // Total manual saja: nota POS dibaca realtime oleh tiap HP, jangan sampai memicu tulis draft bersama
      totalHarian, totalJajanan, totalJasaAks: totalJasaAksManual, totalSewa,
      totalCash: totalCashManual, totalTransfer: totalTransferManual,
      rowsSetoran, rowsPengeluaran
    });
  }, [tanggal, hari, rukoBuka, rukoTutup, catatan, rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa, totalHarian, totalJajanan, totalJasaAksManual, totalSewa, totalCashManual, totalTransferManual, rowsSetoran, rowsPengeluaran]);

  useEffect(() => {
    if (isJustSavedOrLoaded.current) {
      setSavedSignature(currentFormSignature);
      isJustSavedOrLoaded.current = false;
    }
  }, [currentFormSignature]);

  const applyRemoteDraft = useCallback((data: any) => {
    if (data.tanggal && historyRef.current.some(h => h.tanggal === data.tanggal)) {
      return;
    }

    if (editingId) {
      if (data.tanggal !== undefined) setTanggal(data.tanggal);
      if (data.hari !== undefined) setHari(data.hari);
    }
    // Catatan: shiftPegawai, absenPagi, absenSiang TIDAK disinkron via draft umum
    // melainkan SSOT murni per-pegawai via log_absensi Firestore agar shift 1 tidak menimpa shift 2.
    if (data.rukoBuka !== undefined) _setRukoBuka(data.rukoBuka ? data.rukoBuka.split(" - ")[0] : "");
    if (data.rukoTutup !== undefined) _setRukoTutup(data.rukoTutup ? data.rukoTutup.split(" - ")[0] : "");
    if (data.catatan !== undefined) setCatatan(data.catatan);

    const cleanRows = (rows: any[], min: number) => {
       if (!Array.isArray(rows)) return [];
       const res = [...rows];
       while (res.length > min) {
          const last = res[res.length - 1];
          const isTrailingEmpty = !last.harga && !last.bayar && (!last.jenisPS && !last.jenisJajanan && !last.tipe && !last.ket);
          if (isTrailingEmpty) {
             res.pop();
          } else {
             break;
          }
       }
       return res;
    };

    if (data.rowsHarian) setRowsHarian(cleanRows(data.rowsHarian, 5));
    if (data.rowsJajanan) setRowsJajanan(cleanRows(data.rowsJajanan, 5));
    if (data.rowsJasaAks) setRowsJasaAks(cleanRows(data.rowsJasaAks.filter((r: any) => !isBarisNota(r)), 5));
    if (data.rowsSewa) setRowsSewa(cleanRows(data.rowsSewa, 5));
    if (data.rowsSetoran) setRowsSetoran(cleanRows(data.rowsSetoran, 1));
    if (data.rowsPengeluaran) setRowsPengeluaran(cleanRows(data.rowsPengeluaran, 1));
  }, [editingId]);

  useFormDraft(currentFormSignature, applyRemoteDraft, activeTab, !!editingId);

  // ===== PERINGATAN "WAKTU SEWA HABIS" (halaman Usaha Rental) =====
  // Data unit dari sumber yang sama dengan Monitoring Status Unit (lib/sewa)
  const [jamCek, setJamCek] = useState(() => Date.now());
  useEffect(() => {
    if (!user || activeTab !== "USAHA RENTAL") return;
    setJamCek(Date.now());
    const t = setInterval(() => setJamCek(Date.now()), 15000);
    return () => clearInterval(t);
  }, [user, activeTab]);
  const unverifiedRentals = useMemo(() => {
    if (!user?.email || activeTab !== "USAHA RENTAL") return [];
    return daftarSewaBerjalan({ history, rowsSewa, activeDate: tanggal, now: jamCek }).filter((u) => perluKonfirmasiKembali(u, user.email, jamCek));
  }, [history, rowsSewa, tanggal, user?.email, activeTab, jamCek]);

  const [paymentVerifyPrompt, setPaymentVerifyPrompt] = useState<any>(null);

  // Lock body scroll on active modals/popups
  useBodyScrollLock(openPOS);
  useBodyScrollLock(openGallery);
  useBodyScrollLock(openSettings);
  useBodyScrollLock(showChallenge);
  useBodyScrollLock(showDuplicateDateAlert);
  useBodyScrollLock(showUnsavedAlert);
  useBodyScrollLock(!!validationAlert);
  useBodyScrollLock(showSuccessAlert);
  useBodyScrollLock(showStokConfirmation);
  useBodyScrollLock(showRecheckAlert);
  useBodyScrollLock(!!openEditRincian);
  useBodyScrollLock(!!paymentVerifyPrompt);

  /**
   * Ubah SATU baris sewa di dokumen history (transaksi: aman bila beberapa HP mengubah bersamaan).
   * `ubah` mengembalikan baris baru, atau null untuk menghapus baris itu.
   */
  const ubahBarisSewaHistory = async (historyId: string, target: any, ubah: (r: any) => any | null) => {
    const ref = doc(db, "history_pembukuan", historyId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const rows = Array.isArray(snap.data().rowsSewa) ? [...snap.data().rowsSewa] : [];
      const idx = cariBarisSewa(rows, target);
      if (idx < 0) return;
      const baru = ubah(rows[idx]);
      if (baru === null) rows.splice(idx, 1);
      else rows[idx] = baru;
      tx.update(ref, { rowsSewa: rows });
    });
  };

  const handleVerifyReturn = async (item: any) => {
      if (item.isPaid === "TIDAK" && !item._skipPaymentCheck) {
         setPaymentVerifyPrompt(item);
         return;
      }

      if (typeof item === "number") {
          const sourceIdx = item;
          setRowsSewa((prev) => {
             const newRows = [...prev];
             if (newRows[sourceIdx]) {
                 newRows[sourceIdx] = { ...newRows[sourceIdx], _verifiedReturn: true } as any;
             }
             return newRows;
          });
          return;
      }

      if (item.isLive && typeof item.sourceIdx === "number") {
          setRowsSewa((prev) => {
             const newRows = [...prev];
             if (newRows[item.sourceIdx]) {
                 newRows[item.sourceIdx] = { ...newRows[item.sourceIdx], _verifiedReturn: true } as any;
             }
             return newRows;
          });
      }

      if (item.historyId) {
          await ubahBarisSewaHistory(item.historyId, item._rawRow, (r) => ({ ...r, _verifiedReturn: true }))
            .catch((e) => console.error("Gagal verifikasi dari history:", e));
      }
  };

  /** Catat "sudah diingatkan via WA" pada baris sewa (form aktif atau history). */
  const handleCatatPengingat = async (item: { isLive?: boolean; sourceIdx?: number; historyId?: string; _rawRow?: any }) => {
    const log: CatatanPengingat = { ts: Date.now(), oleh: user?.email || auth.currentUser?.email || "admin" };
    const tambah = (r: any) => ({ ...r, _diingatkan: [...((r && r._diingatkan) || []), log].slice(-5) });
    if (item.isLive && typeof item.sourceIdx === "number") {
      setRowsSewa((prev) => prev.map((r, i) => (i === item.sourceIdx ? (tambah(r) as any) : r)));
      return;
    }
    if (!item.historyId) return;
    await ubahBarisSewaHistory(item.historyId, item._rawRow, tambah).catch((e) => console.error("Gagal mencatat pengingat:", e));
  };

  useEffect(() => {
    let newNotes = catatan || "";
    let modified = false;

    const removeRegex = /.*?,\s*belum bayar\s*\([^)]*\),\s*sewa\s*.*?(?:\n|$)/gi;
    const preClean = newNotes.replace(removeRegex, "").replace(/\n{2,}/g, "\n").trim();
    if (preClean !== newNotes.trim()) {
        newNotes = preClean;
        modified = true;
    }

    const unpaids = rowsSewa.filter(r => r.isPaid === "TIDAK" && r.ket && r.jenisPS);
    if (unpaids.length > 0) {
        let block = "";
        unpaids.forEach((r) => {
            block += `${r.ket}, belum bayar (${rupiah(tagihanBelumBayar(r, sewaPriceTable))}), sewa ${r.jenisPS}\n`;
        });
        const finalBlock = block.trim();
        newNotes = newNotes ? `${newNotes}\n\n${finalBlock}` : finalBlock;
        modified = true;
    }

    if (modified) {
        setCatatan(newNotes);
    }
  }, [rowsSewa]);

  const validateTransactions = () => {
    const allLists = [ ...rowsHarian, ...rowsJajanan, ...rowsJasaAks, ...rowsSewa ] as any[];
    for (const r of allLists) {
      const price = toInt(r.harga);
      if (price > 0 && !bayarCash(r.bayar) && !bayarTransfer(r.bayar)) return "payment_empty";
    }

    for (const r of allLists) {
      const price = toInt(r.harga);
      if (price > 0 && bayarTransfer(r.bayar) && !r.buktiTransfer) {
        return "transfer_proof_empty";
      }
    }

    for (const r of rowsSewa) {
      const isFilled = r.ket || r.jenisPS || r.lamaSewa || r.jamMasukSewa || toInt(r.harga) > 0 || r.isPaid === "TIDAK";
      if (!isFilled) continue;

      if (r.jenisPS === "Hanya Ongkir") {
        const ong = toInt(r._ongkir);
        if (ong <= 0 || !r._bayarOngkir) return "ongkir_invalid";
        if (!(r as any).diantarOleh) return "diantar_oleh_empty";
        continue;
      }

      if (!r.isPaid) return "isPaid_empty";

      // Belum dibayar: kolom harga 0, jadi cek harga dasarnya (tabel Edit Rincian / isi sendiri)
      const basePrice = r.isPaid === "TIDAK" ? hargaDasarSewa(r, sewaPriceTable) : toInt(r.harga);

      if (basePrice <= 0) return "harga_sewa_empty";

      if (!r.isOngkir) return "ongkir_empty";
      if (r.isOngkir === "YA" && r.isPaid !== "TIDAK") {
          const ong = toInt(r._ongkir);
          if (ong <= 0 || !r._bayarOngkir) return "ongkir_invalid";
      }
      if (!r.jamMasukSewa) return "jam_masuk_sewa_empty";
      if (!(r as any).ket) return "keterangan_empty_sewa";
      // No. WA penyewa wajib untuk sewa unit (pengingat pengembalian)
      if (wajibWaPenyewa(r, tanggal)) {
        if (!waBaris(r)) return "wa_penyewa_empty";
        if (!waValid(waBaris(r))) return "wa_penyewa_invalid";
      }
      if (r.isOngkir !== "TIDAK" && !(r as any).diantarOleh) return "diantar_oleh_empty";
    }

    for (const r of rowsSetoran) {
      const nominal = toInt(r.harga);
      if (nominal > 0) {
        if (!r.ket) return "setoran_ket_empty";
        if (!r.bayar) return "setoran_tf_empty";
      }
    }

    for (const r of rowsPengeluaran) {
      const nominal = toInt(r.harga);
      const hasInput = (r.ket && r.ket.trim() !== "") || nominal > 0;
      if (hasInput && (!r.ket || !r.bayar || nominal <= 0)) return "pengeluaran_invalid";
      if (hasInput && r.bayar === "Transfer" && !r.buktiTransfer) {
        return "transfer_proof_pengeluaran_empty";
      }
    }

    return "ok";
  };

  const handleShareCheck = () => {
    if (!mandatoryFilled) {
      triggerValidationError("mandatory_empty");
      return;
    }

    const valStatus = validateTransactions();
    if (valStatus !== "ok") {
        triggerValidationError(valStatus);
        return;
    }

    // Cek stok dulu: super admin -> Page Owner › STOK, admin -> UPDATE STOK (sub halaman STOK RENTAL)
    if (isSuperAdminOrOwner) {
      setActiveTab("PAGE OWNER");
      setTimeout(() => bukaHalamanStok("RENTAL"), 100);
    } else {
      bukaHalamanStok("RENTAL");
      setActiveTab("UPDATE STOK");
    }
    setShowStokConfirmation(true);
  };

  const logActivity = (action: "CREATE" | "UPDATE" | "DELETE", targetDate: string, targetDay: string, recordData: any) =>
    catatLogPembukuan(action, targetDate, targetDay, recordData, user?.email);

  const addPencatatan = async () => {
    if (!tanggal) return;
    const isDuplicate = history.some((item) => item.tanggal === tanggal);
    if (isDuplicate) {
      setShowDuplicateDateAlert(true);
      return;
    }

    const valStatus = validateTransactions();
    if (valStatus !== "ok") {
        triggerValidationError(valStatus);
        return;
    }

    const uniqueId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : Date.now().toString() + Math.random().toString(36).slice(2);

    // Pastikan histori pembukuan harian menyimpan data yang valid & SSOT:
    // - Absen Masuk PALING PAGI
    // - Absen Pulang PALING MALAM / DINI HARI (toleransi s.d 03:00)
    const logsForToday = allLogAbsensi.filter((l: any) => isLogForDate(l, tanggal) && l.status !== "deleted");
    const sortedMasuk = logsForToday
      .filter((l: any) => l.jenisAbsen === "Masuk" && l.waktu)
      .sort((a: any, b: any) => menitHariKerja(a.waktu) - menitHariKerja(b.waktu));
    const sortedPulang = logsForToday
      .filter((l: any) => l.jenisAbsen === "Pulang" && l.waktu)
      .sort((a: any, b: any) => menitHariKerja(b.waktu) - menitHariKerja(a.waktu));

    const finalAbsenPagi = sortedMasuk[0]?.waktu || absenPagi;
    const finalAbsenSiang = sortedPulang[0]?.waktu || absenSiang;
    const finalRukoBuka = sortedMasuk[0]?.waktu ? sortedMasuk[0].waktu.split(" - ")[0]?.trim().replace(':', '.') : rukoBuka;
    const finalRukoTutup = sortedPulang[0]?.waktu ? sortedPulang[0].waktu.split(" - ")[0]?.trim().replace(':', '.') : rukoTutup;
    const finalShift = sortedMasuk[0]?.shift || shiftPegawai;

    const newItem = {
      id: uniqueId,
      tanggal, hari,
      absenPagi: finalAbsenPagi,
      absenSiang: finalAbsenSiang,
      shiftPegawai: finalShift,
      rukoBuka: finalRukoBuka,
      rukoTutup: finalRukoTutup,
      catatan,
      totalHarian, totalJajanan, totalJasaAks, totalSewa, totalCash, totalTransfer,
      rowsHarian: JSON.parse(JSON.stringify(rowsHarian)),
      rowsJajanan: JSON.parse(JSON.stringify(rowsJajanan)),
      rowsJasaAks: JSON.parse(JSON.stringify(rowsJasaAksLengkap)),
      rowsSewa: JSON.parse(JSON.stringify(rowsSewa.map((row) => siapkanOngkirSimpan(row, tanggal, ongkirConfig)))),
      rowsSetoran: JSON.parse(JSON.stringify(rowsSetoran)),
      rowsPengeluaran: JSON.parse(JSON.stringify(rowsPengeluaran)),
    };

    // Sesudah tersimpan, cocokkan lagi baris nota POS (nota yang dibuat tepat saat menyimpan)
    setDoc(doc(db, "history_pembukuan", newItem.id), newItem)
      .then(() => sinkronNotaKePembukuan(newItem.tanggal))
      .catch(console.error);
    logActivity("CREATE", tanggal, hari, newItem);

    if (!editingId && shiftPegawai !== "Libur" && user?.email) {
      if (!absenPagi || !absenSiang || !shiftPegawai) {
        const dendaAmount = absenConfig?.dendaTidakAbsenPulang ?? 40000;
        if (dendaAmount > 0) {
          try {
             const docRef = doc(db, "gaji_pegawai", user.email.toLowerCase().trim());

             const idempKey = `dendaBolos_${tanggal}_${user.email}`;
             const newDenda = {
                  id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
                  nominal: dendaAmount,
                  ket: `[Auto-Sistem] Tidak Full Absen (Bolos/Lupa) pada ${tanggal}`,
                  photoUrl: "",
                  dateStr: new Date().toISOString(),
                  _isAutoSistem: true,
                  _idempKey: idempKey
             };
              let empCutoff = 1;
              try {
                  const userSnap = await getDoc(doc(db, "users", user.email));
                  if (userSnap.exists() && typeof userSnap.data()?.tanggalMulaiHitung === "number") {
                      empCutoff = userSnap.data().tanggalMulaiHitung;
                  }
              } catch (e) {
                  console.warn("Gagal mengambil cutoff user:", e);
              }

              const cycle = getAbsenCycleInfo(tanggal || toLocalYmd(), empCutoff);
              const currentBulanTahun = normalizeBulanTahun(cycle.bulanTahun);

              await runSalaryTransaction(db, async transaction => {
              const docSnap = await transaction.get(docRef);
              let basePokok = 0;
              if (docSnap.exists()) {
                  const data = docSnap.data();
                  let records = Array.isArray(data.records) ? data.records : [];

                  const alreadyInjected = records.some((r: any) => 
                      r.gajiPengurangan?.some((pg: any) => pg._idempKey === idempKey)
                  );

                  if (!alreadyInjected) {
                       for (const r of records) {
                           const v = Number(r.gajiPokok) || 0;
                           if (v > 0) { basePokok = v; break; }
                       }
                       if (basePokok === 0) basePokok = Number(data.gajiPokok) || 1500000;

                       const monthIndex = records.findIndex((r: any) => normalizeBulanTahun(r.bulanTahun) === currentBulanTahun);
                       if (monthIndex >= 0) {
                           const currentMonth = records[monthIndex];
                           const gajiPengurangan = Array.isArray(currentMonth.gajiPengurangan) ? currentMonth.gajiPengurangan : [];
                           records[monthIndex] = { ...currentMonth, gajiPengurangan: [...gajiPengurangan, newDenda] };
                       } else {
                           records = [{ id: `rec-${Date.now()}`, bulanTahun: currentBulanTahun, gajiPokok: basePokok, gajiTambahan: [], gajiPengurangan: [newDenda], isAutoGenerated: true }, ...records];
                       }
                       transaction.set(docRef, { salaryRevision: (Number(docSnap.data()?.salaryRevision) || 0) + 1, records, gajiPokok: basePokok, lastUpdated: new Date().toISOString() }, { merge: true });
                  }
              } else {
                  basePokok = 1500000;
                  const newMonth = { id: `rec-${Date.now()}`, bulanTahun: currentBulanTahun, gajiPokok: basePokok, gajiTambahan: [], gajiPengurangan: [newDenda], isAutoGenerated: true };
                  transaction.set(docRef, { salaryRevision: 1, records: [newMonth], gajiPokok: basePokok, lastUpdated: new Date().toISOString() }, { merge: true });
              }
              });

          } catch (err) {
              console.error("Gagal menerapkan denda bolos/lupa absen:", err);
          }
        }
      }
    }

    if (editingId) setEditingId(null);

    _setRukoBuka("");
    _setRukoBukaDate("");
    _setRukoTutup("");
    _setRukoTutupDate("");
    setAbsenPagi("");
    setAbsenSiang("");
    _setShiftPegawai("");
    setCatatan("");
    setRowsHarian(Array.from({ length: 5 }, () => ({ ...blankHarian })));
    setRowsJajanan(Array.from({ length: 5 }, () => ({ ...blankJajanan })));
    setRowsJasaAks(Array.from({ length: 5 }, () => ({ ...blankJasaAks })));
    setRowsSewa(Array.from({ length: 5 }, () => newBlankSewa()));
    setRowsSetoran([{ ket: "", harga: "", bayar: "" }]);
    setRowsPengeluaran([{ ket: "", harga: "", bayar: "", buktiTransfer: "" }]);

    setSavedSignature(currentFormSignature);
    isJustSavedOrLoaded.current = false; 

    hasDataRef.current = false;

    allLogAbsensi.filter((l: any) => isLogForDate(l, tanggal) && l.status !== "deleted").forEach((l: any) => {
      if (l.id) {
        updateDoc(doc(db, "log_absensi", l.id), { status: "completed" }).catch(console.error);
      }
    });
    const realNow = getWibDate();
    systemDateRef.current = realNow.getDate();
    setTanggal(toLocalYmd(realNow));
    const nextHari = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(realNow);
    setHari(nextHari.charAt(0).toUpperCase() + nextHari.slice(1));

    setDoc(doc(db, "data", "draft"), {}).catch(console.error);
    setDoc(doc(db, "data", "ruko_status"), { rukoBuka: "", rukoBukaDate: "", rukoTutup: "", rukoTutupDate: "", tanggal: "" }, { merge: false }).catch(console.error);
    if (user?.email) {
      setDoc(doc(db, "data", `shift_${user.email.toLowerCase().trim()}`), { shift: "", tanggal: "" }, { merge: false }).catch(console.error);
    }

    setSuccessMessage("Data berhasil disimpan secara real-time!");
    setShowSuccessAlert(true);
  };

  const updatePencatatan = () => {
    if (!editingId) return;

    const valStatus = validateTransactions();
    if (valStatus !== "ok") {
        triggerValidationError(valStatus);
        return;
    }

    if (!confirm("Simpan perubahan?")) return;
    const updatedData = {
        tanggal, hari, absenPagi, absenSiang, shiftPegawai, rukoBuka, rukoTutup, catatan,
        totalHarian, totalJajanan, totalJasaAks, totalSewa, totalCash, totalTransfer,
        rowsHarian: JSON.parse(JSON.stringify(rowsHarian)),
        rowsJajanan: JSON.parse(JSON.stringify(rowsJajanan)),
        rowsJasaAks: JSON.parse(JSON.stringify(rowsJasaAksLengkap)),
        rowsSewa: JSON.parse(JSON.stringify(rowsSewa.map((row) => siapkanOngkirSimpan(row, tanggal, ongkirConfig)))),
        rowsSetoran: JSON.parse(JSON.stringify(rowsSetoran)),
        rowsPengeluaran: JSON.parse(JSON.stringify(rowsPengeluaran)),
    };

    if (!isSuperAdminOrOwner) {
      const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 6);
      const originalData = history.find(h => h.id === editingId) || null;

      const requestDoc = {
        id: requestId,
        historyId: editingId,
        tanggal,
        hari,
        requestedBy: user?.email || "unknown",
        requestedAt: new Date().toISOString(),
        status: "pending",
        originalData: originalData ? JSON.parse(JSON.stringify(originalData)) : null,
        proposedData: updatedData
      };

      setDoc(doc(db, "edit_requests", requestId), requestDoc)
        .then(() => {
          setSavedSignature(currentFormSignature);
          isJustSavedOrLoaded.current = false;
          setEditingId(null);
          setSuccessMessage("Request edit telah dikirim, menunggu persetujuan owner.");
          setShowSuccessAlert(true);
          setTimeout(() => window.location.reload(), 2000);
        })
        .catch((err) => {
          console.error("Gagal mengirim request edit:", err);
          alert("Gagal mengirim request edit ke server ❌");
        });
      return;
    }

    setDoc(doc(db, "history_pembukuan", editingId), updatedData, { merge: true })
      .then(() => sinkronNotaKePembukuan(updatedData.tanggal))
      .catch(console.error);
    logActivity("UPDATE", tanggal, hari, updatedData);

    setSavedSignature(currentFormSignature);
    isJustSavedOrLoaded.current = false;

    setSuccessMessage("Perubahan berhasil disimpan! Mengembalikan form...");
    setShowSuccessAlert(true);

    setTimeout(() => window.location.reload(), 1500);
  };

  const editHistoryItem = (id: string) => {
    const item = history.find((x) => x.id === id) as any;
    if (!item) return;
    setEditingId(id);
    setTanggal(item.tanggal); setHari(item.hari);
    setAbsenPagi(item.absenPagi || ""); setAbsenSiang(item.absenSiang || "");
    setShiftPegawai(item.shiftPegawai || "");
    _setRukoBuka(item.rukoBuka ? item.rukoBuka.split(" - ")[0] : ""); _setRukoTutup(item.rukoTutup ? item.rukoTutup.split(" - ")[0] : "");
    setCatatan(item.catatan || "");
    setRowsHarian(item.rowsHarian || Array.from({ length: 5 }, () => ({ ...blankHarian })));
    setRowsJajanan(item.rowsJajanan || Array.from({ length: 5 }, () => ({ ...blankJajanan })));
    // Baris nota POS tidak diedit di form: dibaca ulang realtime dari pos_transaksi
    const jasaManual = (item.rowsJasaAks || []).filter((r: any) => !isBarisNota(r));
    setRowsJasaAks(jasaManual.length ? jasaManual : Array.from({ length: 5 }, () => ({ ...blankJasaAks })));
    setRowsSewa(item.rowsSewa || Array.from({ length: 5 }, () => newBlankSewa()));

    const setoranData = (item.rowsSetoran || [{ ket: "", harga: "", bayar: "" }]).map((r: any) => ({
       ket: r.ket || "",
       harga: r.harga ?? r.nominal ?? "",
       bayar: r.bayar ?? (r.isTransfer === "Ya" ? "Transfer" : r.isTransfer === "Belum" ? "" : r.jenis === "cash" ? "Cash" : r.jenis === "transfer" ? "Transfer" : "")
    }));
    setRowsSetoran(setoranData);

    const pengeluaranData = (item.rowsPengeluaran || [{ ket: "", harga: "", bayar: "", buktiTransfer: "" }]).map((r: any) => ({
       ket: r.ket || "",
       harga: r.harga ?? r.nominal ?? "",
       bayar: r.bayar ?? (r.jenis === "cash" ? "Cash" : r.jenis === "transfer" ? "Transfer" : ""),
       buktiTransfer: r.buktiTransfer || "",
       ...(r._autoOngkirKey ? { _autoOngkirKey: r._autoOngkirKey } : {})
    }));
    setRowsPengeluaran(pengeluaranData);

    isJustSavedOrLoaded.current = true;

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteHistoryItem = (id: string) => {
    const itemToDelete = history.find((h) => h.id === id);
    deleteDoc(doc(db, "history_pembukuan", id)).catch(console.error);
    if (itemToDelete) {
      logActivity("DELETE", itemToDelete.tanggal, itemToDelete.hari, itemToDelete);
    }
    if (id === editingId) {
      setTimeout(() => window.location.reload(), 500);
    }
  };

  // THEME EFFECT
  useEffect(() => {
    if (themeMode === "light") {
      setDark(false);
    } else if (themeMode === "dark") {
      setDark(true);
    } else {
      const checkAuto = () => {
        const h = new Date().getHours();
        setDark(h >= 18 || h < 6);
      };
      checkAuto();
      const interval = setInterval(checkAuto, 60000);
      return () => clearInterval(interval);
    }
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    dark ? root.classList.add("dark") : root.classList.remove("dark");
  }, [dark]);

  // HYDRATION & FIREBASE REALTIME SYNC
  useEffect(() => {
    if (!user) return;
    const settingsRef = doc(db, "data", "settings");
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const pl = { ...data.settings?.priceLists, ...data.priceLists };
        if (pl) {
           if (Array.isArray(pl.hargaHarian)) setHargaHarian(pl.hargaHarian);
           if (Array.isArray(pl.hargaJajanan)) setHargaJajanan(pl.hargaJajanan);
           if (Array.isArray(pl.hargaJasaAks)) setHargaJasaAks(pl.hargaJasaAks);
           if (Array.isArray(pl.hargaSewa)) setHargaSewa(pl.hargaSewa);
        }
        if (data.ongkirConfig) {
           setOngkirConfig({
             pegawaiPersen: typeof data.ongkirConfig.pegawaiPersen === "number" ? data.ongkirConfig.pegawaiPersen : 70,
             masukGaji: Boolean(data.ongkirConfig.masukGaji)
           });
        }
        if (data.absenConfig) {
           setAbsenConfig(data.absenConfig);
        }
        setRincianVisibility({ ...DEFAULT_RINCIAN_VISIBILITY, ...(data.rincianVisibility || {}) });
      }
    }, (err) => console.error(err));

    return () => { unsubSettings(); };
  }, [user?.uid]);

  // Riwayat pembukuan = 62 hari terakhir (SELALU: cek tanggal ganda saat simpan, monitoring sewa,
  // laporan bulan berjalan, saran No. WA) + periode filter bila lebih lama (riwayat & analitik).
  useEffect(() => {
    if (!user) return;
    const awal = new Date();
    awal.setDate(awal.getDate() - 62);
    return onSnapshot(
      query(collection(db, "history_pembukuan"), where("tanggal", ">=", toLocalYmd(awal)), orderBy("tanggal", "desc")),
      (snap) => { setHistTerbaru(bacaDokHistory(snap)); setHydrated(true); },
      (err) => console.error("history_pembukuan:", err)
    );
  }, [user?.uid]);
  useEffect(() => {
    if (!user) return;
    const p = periodRange(filter, filterMonth, rangeStart, rangeEnd);
    const base = collection(db, "history_pembukuan");
    let q;
    if (filter === "Semua Bulan") q = query(base, orderBy("tanggal", "desc"));
    else if (filter === "Pilih Bulan" || (filter === "Rentang" && p.dari)) q = query(base, where("tanggal", ">=", p.dari), where("tanggal", "<=", p.sampai), orderBy("tanggal", "desc"));
    if (!q) { setHistFilter([]); return; }
    return onSnapshot(q, (snap) => setHistFilter(bacaDokHistory(snap)), (err) => console.error("history_pembukuan (filter):", err));
  }, [user?.uid, filter, filterMonth, rangeStart, rangeEnd]);

  // ===== BACKUP / RESTORE =====
  const restoreInputRef = useRef<HTMLInputElement>(null);

  // Backup berisi SELURUH pembukuan (bukan hanya yang sedang tampil di filter)
  const isiBackup = async () => ({
    build: "v3.0 Alpha",
    savedAt: new Date().toISOString(),
    settings: { dark, kualitasGambar, priceLists: { hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa } },
    data: { history: await ambilSemuaHistory() },
  });

  const doBackup = async () => {
    let payload;
    try { payload = await isiBackup(); }
    catch (e: any) { alert("Gagal membaca data untuk backup: " + (e?.message || e)); return; }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `URBAN_Backup_${tanggal}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const onPickRestoreFile = async (file: File | null) => {
    if (!file) return;
    try {
      const txt = await file.text();
      const json = JSON.parse(txt);
      setDark(json?.settings?.dark ?? dark);
      setKualitasGambar(json?.settings?.kualitasGambar ?? kualitasGambar);
      const restoredHistory = json?.data?.history ?? [];

      restoredHistory.forEach((h: any) => {
        if (h && h.id) {
          setDoc(doc(db, "history_pembukuan", h.id), h);
        }
      });

      const pl = json?.settings?.priceLists;
      if (pl) {
        const patch: Partial<Record<keyof typeof priceDefaults, Price[]>> = {};
        for (const field of Object.keys(priceDefaults) as (keyof typeof priceDefaults)[]) {
          if (pl[field] !== undefined) patch[field] = pl[field];
        }
        await persistPrices(patch);
      }
      setSuccessMessage("Restore data berhasil!");
      setShowSuccessAlert(true);
    } catch (e: any) { alert(e?.message || "File restore invalid / corrupt ❌"); }
    finally { if (restoreInputRef.current) restoreInputRef.current.value = ""; }
  };

  const handleBackupDrive = async () => {
    try {
      await uploadBackupToDrive(JSON.stringify(await isiBackup(), null, 2));
      alert("Berhasil dicadangkan ke Google Drive!");
    } catch (e: any) {
      alert(e.message || "Gagal backup ke Google Drive");
    }
  };

  const handleRestoreDrive = async () => {
    try {
      const txt = await downloadBackupFromDrive();
      const json = JSON.parse(txt);

      setDark(json?.settings?.dark ?? dark);
      setKualitasGambar(json?.settings?.kualitasGambar ?? kualitasGambar);
      const restoredHistory = json?.data?.history ?? [];

      restoredHistory.forEach((h: any) => {
        if (h && h.id) {
          setDoc(doc(db, "history_pembukuan", h.id), h);
        }
      });

      const pl = json?.settings?.priceLists;
      if (pl) {
        const patch: Partial<Record<keyof typeof priceDefaults, Price[]>> = {};
        for (const field of Object.keys(priceDefaults) as (keyof typeof priceDefaults)[]) {
          if (pl[field] !== undefined) patch[field] = pl[field];
        }
        await persistPrices(patch);
      }
      setSuccessMessage("Restore data dari Google Drive berhasil!");
      setShowSuccessAlert(true);
    } catch (e: any) {
      alert(e.message || "Gagal restore dari Google Drive");
    }
  };

  const exportCSV = () => {
    const headers = ["tanggal", "hari", "totalHarian", "totalJajanan", "totalJasaAks", "totalSewa", "totalCash", "totalTransfer", "catatan"];
    const escapeCSV = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = history.map((h) =>
      [h.tanggal, h.hari, h.totalHarian, h.totalJajanan, h.totalJasaAks, h.totalSewa, (h as any).totalCash || 0, (h as any).totalTransfer || 0, h.catatan ?? ""].map(escapeCSV)
    );
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `URBAN_Export_${tanggal}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const handleUpdateOngkirConfig = useCallback((cfg: any) => {
    const sanitizedCfg = {
      pegawaiPersen: typeof cfg?.pegawaiPersen === "number" ? cfg.pegawaiPersen : 70,
      masukGaji: Boolean(cfg?.masukGaji)
    };
    setOngkirConfig(sanitizedCfg);
    setDoc(doc(db, "data", "settings"), { ongkirConfig: sanitizedCfg }, { merge: true }).catch(console.error);
  }, []);

  const handleUpdateAbsenConfig = useCallback((cfg: any) => {
    const sanitizedCfg = {
      nominalDenda: typeof cfg?.nominalDenda === "number" ? cfg.nominalDenda : 1500,
      waktuToleransi: typeof cfg?.waktuToleransi === "number" ? cfg.waktuToleransi : 15,
      durasiWaktuPotongan: typeof cfg?.durasiWaktuPotongan === "number" ? cfg.durasiWaktuPotongan : 15,
      dendaTidakAbsenPulang: typeof cfg?.dendaTidakAbsenPulang === "number" ? cfg.dendaTidakAbsenPulang : 40000,
      tanggalMulaiHitung: typeof cfg?.tanggalMulaiHitung === "number" ? Math.max(1, Math.min(31, cfg.tanggalMulaiHitung)) : 1
    };
    setAbsenConfig(sanitizedCfg);
    setDoc(doc(db, "data", "settings"), { absenConfig: sanitizedCfg }, { merge: true }).catch(console.error);
  }, []);

  const handleUpdateThemeMode = useCallback((mode: string) => {
    setThemeMode(mode as any);
    if (user?.email) setDoc(doc(db, "users", user.email), { themeMode: mode }, { merge: true }).catch(console.error);
  }, [setThemeMode, user]);

  const handleUpdateTableMode = useCallback((mode: "Baru" | "Lama") => {
     setTableMode(mode);
     if (user?.email) setDoc(doc(db, "users", user.email), { tableMode: mode }, { merge: true }).catch(console.error);
  }, [setTableMode, user]);

  const handleUpdateKualitasGambar = useCallback((val: ImageQuality) => {
     setKualitasGambar(val);
     if (user?.email) setDoc(doc(db, "users", user.email), { kualitasGambar: val }, { merge: true }).catch(console.error);
  }, [setKualitasGambar, user]);

  const handleLogout = useCallback(() => {
     signOut(auth).catch(console.error);
  }, []);

  const handleUpdateProfileColor = useCallback((color: string) => {
    setUserProfileColor(color);
    if (user?.email) setDoc(doc(db, "users", user.email), { profileColor: color }, { merge: true }).catch(console.error);
  }, [setUserProfileColor, user]);

  /**
   * Sewa yang belum dibayar sudah kembali: konfirmasi kembali, lalu baris aslinya dipindah
   * ke form hari ini (jadi baris pelunasan / perpanjangan). Hanya SATU baris yang dihapus
   * (2 unit identik tetap aman), dan catatan "belum bayar"-nya dibersihkan.
   */
  const pindahkanBarisBelumBayar = useCallback(async (prompt: any) => {
    await handleVerifyReturn({ ...prompt, _skipPaymentCheck: true });
    const raw = prompt._rawRow;
    if (raw) {
      if (raw._isActiveSession && typeof raw._sourceIdx === "number") {
        setRowsSewa((prev) => {
          const res = [...prev];
          const idx = cariBarisSewa(res, raw);
          if (idx !== -1) res.splice(idx, 1);
          return res.length === 0 ? [newBlankSewa()] : res;
        });
      }
      if (raw._historyId) {
        await ubahBarisSewaHistory(raw._historyId, raw, () => null).catch((e) => console.error("Gagal memindah baris sewa:", e));
      }
    }
    setCatatan((prev) => {
      if (!prev) return prev;
      const esc = (t: string) => String(t || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`${esc(prompt.namaPenyewa)}, belum bayar \\(.*?\\), sewa ${esc(prompt.jenis)}\\n?`, "gi");
      return prev.replace(regex, "").trim();
    });
  }, [handleVerifyReturn, setRowsSewa, newBlankSewa, setCatatan]);

  const handlePaymentVerifyNo = useCallback(async () => {
    if (!paymentVerifyPrompt) return;
    await pindahkanBarisBelumBayar(paymentVerifyPrompt);

    const raw = paymentVerifyPrompt._rawRow || {};
    setPaymentVerifyPrompt(null);

    setActiveTab("USAHA RENTAL");
    setRowsSewa(prev => {
        const newRows = [...prev];
        let target = newRows.findIndex(r => !r.ket && !r.jenisPS && !r.harga && !r.bayar);
        if (target === -1) {
            target = newRows.length;
            newRows.push(newBlankSewa());
        }
        const now = new Date();
        const jamStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        newRows[target] = {
            ...newRows[target],
            jenisPS: raw.jenisPS || paymentVerifyPrompt.jenis,
            lamaSewa: "Isi Sendiri",
            jamMasukSewa: jamStr,
            ket: raw.ket || paymentVerifyPrompt.namaPenyewa,
            isPaid: "TIDAK",
            harga: "",
            isOngkir: raw.isOngkir || "TIDAK",
            _ongkir: "",
            _bayarOngkir: "",
            diantarOleh: raw.diantarOleh || "",
            bayar: ""
        };
        return newRows;
    });
    setTimeout(() => {
       const el = document.getElementById("section-rincian");
       if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [paymentVerifyPrompt, pindahkanBarisBelumBayar, setRowsSewa, newBlankSewa, setActiveTab]);

  const handlePaymentVerifyYes = useCallback(async () => {
    if (!paymentVerifyPrompt) return;
    await pindahkanBarisBelumBayar(paymentVerifyPrompt);

    const raw = paymentVerifyPrompt._rawRow || {};
    // Tagihan = harga sewa (tabel Edit Rincian / isi sendiri) + ongkir — sama dengan kartu monitoring
    const getHarga = tagihanBelumBayar({ ...raw, isPaid: "TIDAK" }, sewaPriceTable);

    setPaymentVerifyPrompt(null);

    setActiveTab("USAHA RENTAL");
    setRowsSewa(prev => {
        const newRows = [...prev];
        let target = newRows.findIndex(r => !r.ket && !r.jenisPS && !r.harga && !r.bayar);
        if (target === -1) {
            target = newRows.length;
            newRows.push(newBlankSewa());
        }
        newRows[target] = {
            ...newRows[target],
            jenisPS: raw.jenisPS || paymentVerifyPrompt.jenis,
            lamaSewa: "PELUNASAN",
            jamMasukSewa: "-",
            ket: raw.ket || paymentVerifyPrompt.namaPenyewa,
            isPaid: "YA",
            harga: getHarga,
            isOngkir: raw.isOngkir || "TIDAK",
            _ongkir: raw._ongkir !== undefined ? raw._ongkir : "",
            _bayarOngkir: raw._bayarOngkir || "",
            diantarOleh: raw.diantarOleh || "",
            bayar: "",
            // Sewa dari hari lain: bagian ongkir pengantar sudah tercatat di pembukuan hari sewa
            ...(raw._historyId ? { _ongkirSudahDicatat: true } : {}),
        } as any;
        return newRows;
    });
    setTimeout(() => {
       const el = document.getElementById("section-rincian");
       if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [paymentVerifyPrompt, pindahkanBarisBelumBayar, setRowsSewa, newBlankSewa, setActiveTab, sewaPriceTable]);

  const resetSetting = async () => {
    try { await persistPrices(priceDefaults); }
    catch (error: any) { alert(error?.message || "Gagal reset pengaturan."); return; }
    setDark(true); setKualitasGambar("Tinggi");
    setHargaHarian(DEFAULT_HARGA_HARIAN as Price[]);
    setHargaJajanan(DEFAULT_HARGA_JAJANAN as Price[]);
    setHargaJasaAks(DEFAULT_HARGA_JASA_AKS as Price[]);
    setHargaSewa(DEFAULT_HARGA_SEWA as Price[]);
    setFilter("Bulan Ini"); 
    setFilterMonth(new Date().getMonth() + 1);

    setSuccessMessage("Semua pengaturan telah di-reset.");
    setShowSuccessAlert(true);
  };
  const handleResetRukoBuka = useCallback(async () => {
    setRukoBuka("");
    try {
      await setDoc(doc(db, "data", "ruko_status"), { rukoBuka: "", rukoBukaDate: "", tanggal }, { merge: true });
    } catch (e) {
      console.error("Gagal reset rukoBuka:", e);
    }
  }, [tanggal, setRukoBuka]);

  const handleResetRukoTutup = useCallback(async () => {
    setRukoTutup("");
    try {
      await setDoc(doc(db, "data", "ruko_status"), { rukoTutup: "", rukoTutupDate: "", tanggal }, { merge: true });
    } catch (e) {
      console.error("Gagal reset rukoTutup:", e);
    }
  }, [tanggal, setRukoTutup]);

  const handleResetAbsenPagi = useCallback(async () => {
    setAbsenPagi("");
    _setRukoBuka("");
    _setRukoBukaDate("");
    try {
      // 1. Hapus dari log_absensi menggunakan SSOT isLogForDate
      const targets = allLogAbsensi.filter((l: any) => isLogForDate(l, tanggal) && l.jenisAbsen === "Masuk");
      for (const target of targets) {
        if (target.id) {
          await deleteDoc(doc(db, "log_absensi", target.id)).catch(console.error);
        }
      }
      // Query fallback
      const q = query(collection(db, "log_absensi"), where("tanggal", "==", tanggal), where("jenisAbsen", "==", "Masuk"));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => deleteDoc(docSnap.ref).catch(console.error));

      // Reset ruko buka di database
      await setDoc(doc(db, "data", "ruko_status"), { rukoBuka: "", rukoBukaDate: "" }, { merge: true }).catch(console.error);
    } catch (e) {
      console.error("Gagal reset absen pagi", e);
    }
  }, [tanggal, allLogAbsensi]);

  const handleResetAbsenSiang = useCallback(async () => {
    setAbsenSiang("");
    _setRukoTutup("");
    _setRukoTutupDate("");
    try {
      // 1. Hapus dari log_absensi menggunakan SSOT isLogForDate
      const targets = allLogAbsensi.filter((l: any) => isLogForDate(l, tanggal) && l.jenisAbsen === "Pulang");
      for (const target of targets) {
        if (target.id) {
          await deleteDoc(doc(db, "log_absensi", target.id)).catch(console.error);
        }
      }
      // Query fallback
      const q = query(collection(db, "log_absensi"), where("tanggal", "==", tanggal), where("jenisAbsen", "==", "Pulang"));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => deleteDoc(docSnap.ref).catch(console.error));

      // Reset ruko tutup di database
      await setDoc(doc(db, "data", "ruko_status"), { rukoTutup: "", rukoTutupDate: "" }, { merge: true }).catch(console.error);
    } catch (e) {
      console.error("Gagal reset absen siang", e);
    }
  }, [tanggal, allLogAbsensi]);

  const handleResetForm = useCallback(async () => {
    setAbsenPagi(""); setAbsenSiang(""); setShiftPegawai(""); setRukoBuka(""); setRukoTutup(""); setCatatan(""); 
    try {
      await setDoc(doc(db, "data", "ruko_status"), { rukoBuka: "", rukoBukaDate: "", rukoTutup: "", rukoTutupDate: "", tanggal: "" }, { merge: false });
      const targets = allLogAbsensi.filter((l: any) => isLogForDate(l, tanggal));
      for (const target of targets) {
        if (target.id) {
          await deleteDoc(doc(db, "log_absensi", target.id)).catch(console.error);
        }
      }
      const q = query(collection(db, "log_absensi"), where("tanggal", "==", tanggal));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        deleteDoc(docSnap.ref).catch(console.error);
      });
    } catch (e) {
      console.error("Gagal menghapus log_absensi/ruko_status:", e);
    }
  }, [tanggal, allLogAbsensi, setShiftPegawai]);

  return {
    rootRef,
    appStokData,
    pdfRef,
    hydrated,
    dark,
    setDark,
    themeMode,
    setThemeMode,
    showChallenge,
    setShowChallenge,
    gameConfig,
    kualitasGambar,
    setKualitasGambar,
    tableMode,
    setTableMode,
    isExportingPDF,
    setIsExportingPDF,
    isMobileTable,
    user,
    authLoading,
    userRole,
    isSuperAdminOrOwner,
    userProfilePic,
    userProfileColor,
    customBgDark,
    handleProfilePicChange,
    handleBgDarkChange,
    triggeredAssistants,
    handleRunAssistant,
    handleDismissAssistant,
    tanggal,
    setTanggal,
    hari,
    setHari,
    activeTab,
    setActiveTab,
    adminMonitoringTab,
    setAdminMonitoringTab,
    handleOpenScan,
    activeUsers,
    setFocusedField,
    absenPagi,
    setAbsenPagi,
    absenSiang,
    setAbsenSiang,
    shiftPegawai,
    setShiftPegawai,
    openSettings,
    setOpenSettings,
    openPOS,
    setOpenPOS,
    openGallery,
    setOpenGallery,
    hasVersionUpdate,
    posUpdates,
    posBaseline,
    posBaselineLoaded,
    dbCatalogState,
    userProfileLoaded,
    isDeactivated,
    editingId,
    setEditingId,
    rukoBuka,
    setRukoBuka,
    rukoBukaDate,
    rukoTutup,
    setRukoTutup,
    rukoTutupDate,
    catatan,
    setCatatan,
    showDuplicateDateAlert,
    setShowDuplicateDateAlert,
    showUnsavedAlert,
    setShowUnsavedAlert,
    validationAlert,
    setValidationAlert,
    showSuccessAlert,
    setShowSuccessAlert,
    successMessage,
    setSuccessMessage,
    showStokConfirmation,
    setShowStokConfirmation,
    showRecheckAlert,
    setShowRecheckAlert,
    triggerValidationError,
    savedSignature,
    hargaHarian,
    hargaJajanan,
    hargaJasaAks,
    hargaSewa,
    ongkirConfig,
    setOngkirConfig,
    absenConfig,
    setAbsenConfig,
    openEditRincian,
    setOpenEditRincian,
    getPrices,
    rincianVisibility,
    handleUpdateRincianVisibility,
    getTitle,
    handleSavePrices,
    handleResetSpecificDefault,
    rowsHarian,
    setRowsHarian,
    rowsJajanan,
    setRowsJajanan,
    rowsJasaAks,
    setRowsJasaAks,
    barisNotaJasa,
    notaBarangHari,
    rowsSewa,
    setRowsSewa,
    rowsSetoran,
    setRowsSetoran,
    rowsPengeluaran,
    setRowsPengeluaran,
    totalHarian,
    totalJajanan,
    totalJasaAks,
    totalSewa,
    totalCash,
    totalTransfer,
    totalPengeluaran,
    totalPengeluaranCash,
    manualPengeluaranCash,
    hasData,
    mandatoryFilled,
    history,
    filter,
    setFilter,
    filterMonth,
    setFilterMonth,
    rangeStart,
    setRangeStart,
    rangeEnd,
    setRangeEnd,
    filteredHistory,
    exportData,
    currentFormSignature,
    unverifiedRentals,
    paymentVerifyPrompt,
    setPaymentVerifyPrompt,
    handleVerifyReturn,
    handleCatatPengingat,
    validateTransactions,
    handleShareCheck,
    addPencatatan,
    updatePencatatan,
    editHistoryItem,
    deleteHistoryItem,
    restoreInputRef,
    doBackup,
    onPickRestoreFile,
    handleBackupDrive,
    handleRestoreDrive,
    exportCSV,
    resetSetting,
    blankHarian,
    blankJajanan,
    blankJasaAks,
    newBlankSewa,
    catalogChanges,
    hasPOSUpdate,
    setUserProfileColor,
    handleResetRukoBuka,
    handleResetRukoTutup,
    handleResetAbsenPagi,
    handleResetAbsenSiang,
    handleResetForm,
    handleUpdateOngkirConfig,
    handleUpdateAbsenConfig,
    handleUpdateThemeMode,
    handleUpdateTableMode,
    handleUpdateKualitasGambar,
    handleLogout,
    handleUpdateProfileColor,
    handlePaymentVerifyNo,
    handlePaymentVerifyYes
  };
}
