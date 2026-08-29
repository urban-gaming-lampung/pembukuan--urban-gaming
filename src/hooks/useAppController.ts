import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, updateDoc, query, getDocs, getDoc, where, orderBy, serverTimestamp, arrayUnion, deleteField } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth, listGameDb } from "../lib/firebase";
import { usePresence } from "./usePresence";
import { useFormDraft } from "./useFormDraft";
import { useBodyScrollLock } from "./useBodyScrollLock";
import { uploadBackupToDrive, downloadBackupFromDrive } from "../lib/googleDrive";
import versionData from "../version.json";
import { useGameConfig } from "../games/hooks/useGameConfig";
import { RowHarian, RowJajanan, RowJasaAks, RowSewa, HistoryItem } from "../lib/types";
import { DEFAULT_HARGA_HARIAN, DEFAULT_HARGA_JAJANAN, DEFAULT_HARGA_JASA_AKS, DEFAULT_HARGA_SEWA } from "../constants/prices";
import { LS_KEY } from "../constants/storage";
import { checkCatalogBaselineAndLogUpdates, isVersionLower, SavedCatalogState, startOfDay, endOfDay } from "../lib/catalog";
import { atomicAddDenda, normalizeEmail } from "../lib/salaryService";
import useStokData from "./useStokData";
import { PdfExporterHandle } from "../components/PdfExporter";

type ImageQuality = "Tinggi" | "Hemat";
type Price = { label: string; price: number };
type PriceListKey = "harian" | "jajanan" | "jasaAks" | "sewa";

const getWibDate = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

const getBusinessDate = () => {
  const wib = getWibDate();
  if (wib.getHours() < 6) {
    wib.setDate(wib.getDate() - 1); // Mundur 1 hari
  }
  return wib;
};

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
      const d = new Date();
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      await addDoc(expenseRef, {
        nama: a.nama_pengeluaran,
        kategori: a.kategori || "Lainnya",
        harga: Number(a.nominal || 0),
        tanggal: `${yy}-${mm}-${dd}`,
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

  const handleProfilePicChange = async (dataUrl: string) => {
    setUserProfilePic(dataUrl);
    if (user?.email) {
      setDoc(doc(db, "users", user.email), { photoUrl: dataUrl }, { merge: true }).catch(console.error);
    }
  };

  const handleBgDarkChange = async (dataUrl: string | null) => {
    setCustomBgDark(dataUrl);
    try { 
       if (dataUrl) localStorage.setItem('custom_bg_dark', dataUrl);
       else localStorage.removeItem('custom_bg_dark');
    } catch(e) { console.error(e); }

    if (user?.email) {
      setDoc(doc(db, "users", user.email), { customBgDark: dataUrl || null }, { merge: true }).catch(console.error);
    }
  };

  const today = getBusinessDate();
  const [tanggal, setTanggal] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
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
      const bizDateStr = `${bizDate.getFullYear()}-${String(bizDate.getMonth() + 1).padStart(2, "0")}-${String(bizDate.getDate()).padStart(2, "0")}`;
      
      const bizAlreadySaved = historyRef.current.some(h => h.tanggal === bizDateStr);
      const targetDate = bizAlreadySaved ? getWibDate() : bizDate;
      
      if (targetDate.getDate() !== systemDateRef.current) {
        systemDateRef.current = targetDate.getDate();
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
        const dd = String(targetDate.getDate()).padStart(2, "0");
        setTanggal(`${yyyy}-${mm}-${dd}`);
        const h = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(targetDate);
        setHari(h.charAt(0).toUpperCase() + h.slice(1));
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // ===== TAB STATE =====
  const [activeTab, setActiveTab] = useState<"USAHA RENTAL" | "UPDATE STOK" | "PAGE OWNER" | "MONITORING">("USAHA RENTAL");
  const [adminMonitoringTab, setAdminMonitoringTab] = useState<"status" | "device">("status");

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

  const handleClearProductChange = useCallback(() => {}, []);

  useEffect(() => {
    openPOSRef.current = openPOS;
  }, [openPOS]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const setShiftPegawai = useCallback((val: string) => {
    _setShiftPegawai(val);
    const cleanEmail = normalizeEmail(user?.email || "");
    if (!editingId && cleanEmail) {
      setDoc(doc(db, "data", `shift_${cleanEmail}`), { shift: val, tanggal }, { merge: true }).catch(console.error);
    }
  }, [editingId, tanggal, user?.email]);

  useEffect(() => {
    const cleanEmail = normalizeEmail(user?.email || "");
    if (!cleanEmail || !tanggal) return;

    const alreadySaved = historyRef.current.some(h => h.tanggal === tanggal);
    if (alreadySaved && !editingId) {
      setAbsenPagi("");
      setAbsenSiang("");
      return;
    }

    const q = query(
      collection(db, "log_absensi"),
      where("email", "==", cleanEmail),
      where("tanggal", "==", tanggal)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (editingId) return;
      let pagi = "";
      let siang = "";
      snap.forEach(d => {
        const data = d.data();
        if (data.status === "completed") return;
        if (data.jenisAbsen === "Masuk") pagi = data.waktu;
        if (data.jenisAbsen === "Pulang") siang = data.waktu;
      });
      // Hanya update jika query berhasil menemukan log atau belum ada state lokal
      if (pagi) setAbsenPagi(pagi);
      if (siang) setAbsenSiang(siang);
    }, (err) => console.error("Error fetching absen: ", err));
    return () => unsub();
  }, [user?.email, tanggal, editingId]);

  useEffect(() => {
    const cleanEmail = normalizeEmail(user?.email || "");
    if (!cleanEmail || !tanggal || editingId) return;
    
    const alreadySaved = historyRef.current.some(h => h.tanggal === tanggal);
    if (alreadySaved) return;

    const unsub = onSnapshot(doc(db, "data", `shift_${cleanEmail}`), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.tanggal === tanggal) {
          _setShiftPegawai(data.shift || "");
        } else {
          _setShiftPegawai("");
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
      const updateData: any = {
        rukoBuka: val,
        rukoBukaDate: dStr,
        tanggal
      };
      setDoc(doc(db, "data", "ruko_status"), updateData, { merge: true }).catch(console.error);
    }
  }, [editingId, tanggal]);

  const setRukoTutup = useCallback((val: string, dateStr?: string) => {
    _setRukoTutup(val);
    const dStr = dateStr || new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 10);
    if (val) _setRukoTutupDate(dStr);
    if (!editingId && val) {
      const updateData: any = {
        rukoTutup: val,
        rukoTutupDate: dStr,
        tanggal
      };
      setDoc(doc(db, "data", "ruko_status"), updateData, { merge: true }).catch(console.error);
    }
  }, [editingId, tanggal]);

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
        if (data.tanggal === tanggal) {
           _setRukoBuka(data.rukoBuka ? data.rukoBuka.split(" - ")[0] : "");
           _setRukoBukaDate(data.rukoBukaDate || "");
           _setRukoTutup(data.rukoTutup ? data.rukoTutup.split(" - ")[0] : "");
           _setRukoTutupDate(data.rukoTutupDate || "");
        } else {
           _setRukoBuka("");
           _setRukoBukaDate("");
           _setRukoTutup("");
           _setRukoTutupDate("");
        }
      } else if (!snap.exists() && !editingId) {
        _setRukoStatusDbTanggal("");
        _setRukoBuka("");
        _setRukoBukaDate("");
        _setRukoTutup("");
        _setRukoTutupDate("");
      }
    });
    return () => unsub();
  }, [tanggal, editingId]);
  
  // State untuk Alert (UI Apple Style)
  const [showDownloadAlert, setShowDownloadAlert] = useState(false);
  const [showDuplicateDateAlert, setShowDuplicateDateAlert] = useState(false);
  const [showNewMonthAlert, setShowNewMonthAlert] = useState(false);
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
  const [absenConfig, setAbsenConfig] = useState({ durasiWaktuPotongan: 15, waktuToleransi: 15, nominalDenda: 1500, dendaTidakAbsenPulang: 40000 });

  const [openEditRincian, setOpenEditRincian] = useState<PriceListKey | null>(null);

  const getPrices = (key: PriceListKey): Price[] => {
    if (key === "harian") return hargaHarian;
    if (key === "jajanan") return hargaJajanan;
    if (key === "jasaAks") return hargaJasaAks;
    return hargaSewa;
  };

  const getHargaSewa = (r: RowSewa): number => {
    if (!r.jenisPS || !r.lamaSewa) return 0;
    const s1 = r.jenisPS.toLowerCase().replace(/\s+/g, "");
    const s2 = r.lamaSewa.toLowerCase().replace(/\s+/g, "");
    const item = hargaSewa.find(x => {
        const lbl = x.label.toLowerCase().replace(/\s+/g, "");
        return lbl.includes(s1) && lbl.includes(s2);
    });
    return item ? item.price : 0;
  };

  const getTitle = (key: PriceListKey | null) => {
    switch (key) {
      case "harian": return "Pemasukan Harian";
      case "jajanan": return "Jajanan";
      case "jasaAks": return "Jasa & Aksesoris";
      case "sewa": return "Sewa PS";
      default: return "";
    }
  };

  const handleSavePrices = (key: PriceListKey, next: Price[]) => {
    if (key === "harian") setHargaHarian(next);
    else if (key === "jajanan") setHargaJajanan(next);
    else if (key === "jasaAks") setHargaJasaAks(next);
    else setHargaSewa(next);
    setOpenEditRincian(null);
  };

  const handleResetSpecificDefault = (key: PriceListKey) => {
    if (key === "harian") setHargaHarian(DEFAULT_HARGA_HARIAN as Price[]);
    else if (key === "jajanan") setHargaJajanan(DEFAULT_HARGA_JAJANAN as Price[]);
    else if (key === "jasaAks") setHargaJasaAks(DEFAULT_HARGA_JASA_AKS as Price[]);
    else setHargaSewa(DEFAULT_HARGA_SEWA as Price[]);
    
    setSuccessMessage(`List ${getTitle(key)} berhasil di-reset ke default!`);
    setShowSuccessAlert(true);
  };

  // ===== TABLE ROWS STATE =====
  const blankHarian: RowHarian = { jenisPS: "", jamMasuk: "", jumlahJam: "", harga: "", bayar: "" };
  const blankJajanan: RowJajanan = { jenisJajanan: "", qtyJam: "", harga: "", bayar: "" };
  const blankJasaAks: RowJasaAks = { tipe: "", ket: "", harga: "", bayar: "" };
  const blankSewa: RowSewa & { _customBase?: string | number } = { jenisPS: "", lamaSewa: "", jamMasukSewa: "", ket: "", isPaid: "", harga: "", isOngkir: "", _ongkir: "", _bayarOngkir: "", bayar: "", _customDurasi: "", _customBase: "", diantarOleh: "" };

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

  const toNum = (v: unknown) => {
    const n = parseInt(String(v ?? "0"), 10);
    return Number.isFinite(n) ? n : 0;
  };

  const totalHarian = useMemo(() => rowsHarian.reduce((s, r) => s + toNum(r.harga), 0), [rowsHarian]);
  const totalJajanan = useMemo(() => rowsJajanan.reduce((s, r) => s + toNum(r.harga), 0), [rowsJajanan]);
  const totalJasaAks = useMemo(() => rowsJasaAks.reduce((s, r) => s + toNum(r.harga), 0), [rowsJasaAks]);
  const totalSewa = useMemo(() => rowsSewa.reduce((s, r) => s + toNum(r.harga), 0), [rowsSewa]);

  const normalizeBayar = (v: unknown) => String(v ?? "").trim().toLowerCase();
  const isCash = (v: unknown) => { const s = normalizeBayar(v); return s.includes("cash") || s.includes("tunai"); };
  const isTransfer = (v: unknown) => { const s = normalizeBayar(v); return s.includes("transfer") || s.includes("tf") || s.includes("trx"); };

  const totalCash = useMemo(() => {
    const allRows = [...rowsHarian, ...rowsJajanan, ...rowsJasaAks, ...rowsSewa] as Array<{ harga?: unknown; bayar?: unknown }>;
    return allRows.reduce((sum, r) => (isCash(r.bayar) ? sum + toNum(r.harga) : sum), 0);
  }, [rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa]);

  const totalTransfer = useMemo(() => {
    const allRows = [...rowsHarian, ...rowsJajanan, ...rowsJasaAks, ...rowsSewa] as Array<{ harga?: unknown; bayar?: unknown }>;
    return allRows.reduce((sum, r) => (isTransfer(r.bayar) ? sum + toNum(r.harga) : sum), 0);
  }, [rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa]);

  const totalPengeluaran = useMemo(() => rowsPengeluaran.reduce((s, r) => s + toNum(r.harga), 0), [rowsPengeluaran]);
  const totalPengeluaranCash = useMemo(() => rowsPengeluaran.reduce((sum, r) => (r.bayar === "Cash" ? sum + toNum(r.harga) : sum), 0), [rowsPengeluaran]);
  const manualPengeluaranCash = useMemo(() => rowsPengeluaran.reduce((sum, r: any) => (r.bayar === "Cash" && !r._autoOngkirKey ? sum + toNum(r.harga) : sum), 0), [rowsPengeluaran]);

  useEffect(() => {
    const POLICY_DATE = "2026-04-29";
    const isNewPolicy = tanggal >= POLICY_DATE;

    let sisaKas: number;

    if (isNewPolicy) {
      sisaKas = Math.max(0, totalCash - manualPengeluaranCash);
    } else {
      const ongkirIncomeCash = rowsSewa.reduce((sum, r: any) => (isCash(r.bayar) && r.isOngkir === "YA" ? sum + (Number(r._ongkir) || 0) : sum), 0);
      const ongkirExpenseCash = rowsSewa.reduce((sum, r: any) => {
        if (r._bayarOngkir === "Cash" && r.isOngkir === "YA") {
          const ongkirCustomer = Number(r._ongkir) || 0;
          let pegNom: number;
          if (r._isNewOngkirSystem) {
            pegNom = r._ongkirPegawaiNominal ?? Math.round(ongkirCustomer * (r._ongkirPegawaiPersen ?? ongkirConfig.pegawaiPersen) / 100);
          } else {
            pegNom = Math.round(ongkirCustomer * ongkirConfig.pegawaiPersen / 100);
          }
          return sum + pegNom;
        }
        return sum;
      }, 0);

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
       if (r.isOngkir === "YA" && toNum(r._ongkir) > 0 && (r as any).diantarOleh) {
         const ongkirCustomer = toNum(r._ongkir);
         const rowId = (r as any)._rowId || `legacy_${(r as any).ket}_${(r as any).jamMasukSewa}`;

         let pegawaiNominal: number;
         if ((r as any)._isNewOngkirSystem) {
           pegawaiNominal = (r as any)._ongkirPegawaiNominal
             ?? Math.round((ongkirCustomer * ((r as any)._ongkirPegawaiPersen ?? ongkirConfig.pegawaiPersen)) / 100);
         } else {
           pegawaiNominal = Math.round((ongkirCustomer * ongkirConfig.pegawaiPersen) / 100);
         }

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
    const effBuka = rukoBuka || (absenPagi ? absenPagi.split(" - ")[0] : "");
    const effTutup = rukoTutup || (absenSiang ? absenSiang.split(" - ")[0] : "");
    if (shiftPegawai === "Libur") {
      return !!(effBuka && effTutup);
    }
    return !!(absenPagi && absenSiang && effBuka && effTutup);
  }, [absenPagi, absenSiang, rukoBuka, rukoTutup, shiftPegawai]);

  // ===== HISTORY & FILTER =====
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  useEffect(() => { historyRef.current = history; }, [history]);

  const hasAutoCorrectRef = useRef(false);
  useEffect(() => {
    if (history.length === 0) return;
    if (editingId) return;
    if (hasAutoCorrectRef.current) return;

    // Hanya ubah tanggal secara otomatis jika form benar-benar kosong dan belum diubah user
    if (!hasDataRef.current) {
      const alreadySaved = history.some(h => h.tanggal === tanggal);
      if (alreadySaved) {
        hasAutoCorrectRef.current = true;
        
        const realNow = getWibDate();
        const realDateStr = `${realNow.getFullYear()}-${String(realNow.getMonth() + 1).padStart(2, "0")}-${String(realNow.getDate()).padStart(2, "0")}`;
        
        if (tanggal !== realDateStr && !history.some(h => h.tanggal === realDateStr)) {
          systemDateRef.current = realNow.getDate();
          setTanggal(realDateStr);
          const h = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(realNow);
          setHari(h.charAt(0).toUpperCase() + h.slice(1));
        }
      }
    }
  }, [history, tanggal, editingId]);

  const [filter, setFilter] = useState("Bulan Ini"); 
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const filteredHistory = useMemo(() => {
    const now = new Date();
    if (filter === "Bulan Ini") {
      return history.filter((h) => {
        const d = new Date(h.tanggal);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }
    if (filter === "7 Hari Terakhir") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      const start = startOfDay(cutoff);
      return history.filter((h) => {
        const d = startOfDay(new Date(h.tanggal));
        return d >= start;
      });
    }
    if (filter === "Semua Bulan") return history;
    if (filter === "Pilih Bulan") {
      return history.filter((h) => {
        const d = new Date(h.tanggal);
        return (d.getMonth() + 1) === filterMonth && d.getFullYear() === now.getFullYear();
      });
    }
    if (filter === "Rentang" && rangeStart && rangeEnd) {
      const s = startOfDay(new Date(rangeStart));
      const e = endOfDay(new Date(rangeEnd));
      return history.filter((h) => {
        const d = startOfDay(new Date(h.tanggal));
        return d >= s && d <= e;
      });
    }
    return history;
  }, [filter, history, filterMonth, rangeStart, rangeEnd]);

  const exportData = useMemo(() => ({
    tanggal, hari, absenPagi, absenSiang, catatan,
    rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa,
    totalHarian, totalJajanan, totalJasaAks, totalSewa,
    totalCash, totalTransfer, history,
    rowsSetoran, rowsPengeluaran
  }), [
    tanggal, hari, absenPagi, absenSiang, catatan,
    rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa,
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
      totalHarian, totalJajanan, totalJasaAks, totalSewa,
      totalCash, totalTransfer,
      rowsSetoran, rowsPengeluaran
    });
  }, [tanggal, hari, rukoBuka, rukoTutup, catatan, rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa, totalHarian, totalJajanan, totalJasaAks, totalSewa, totalCash, totalTransfer, rowsSetoran, rowsPengeluaran]);

  useEffect(() => {
    if (isJustSavedOrLoaded.current) {
      setSavedSignature(currentFormSignature);
      isJustSavedOrLoaded.current = false;
    }
  }, [currentFormSignature]);

  const applyRemoteDraft = useCallback((data: any) => {
    if (!data || typeof data !== "object") return;

    if (!editingId) {
      if (data.tanggal) setTanggal(data.tanggal);
      if (data.hari) setHari(data.hari);
    }
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

    if (Array.isArray(data.rowsHarian) && data.rowsHarian.length > 0) setRowsHarian(cleanRows(data.rowsHarian, 5));
    if (Array.isArray(data.rowsJajanan) && data.rowsJajanan.length > 0) setRowsJajanan(cleanRows(data.rowsJajanan, 5));
    if (Array.isArray(data.rowsJasaAks) && data.rowsJasaAks.length > 0) setRowsJasaAks(cleanRows(data.rowsJasaAks, 5));
    if (Array.isArray(data.rowsSewa) && data.rowsSewa.length > 0) setRowsSewa(cleanRows(data.rowsSewa, 5));
    if (Array.isArray(data.rowsSetoran) && data.rowsSetoran.length > 0) setRowsSetoran(cleanRows(data.rowsSetoran, 1));
    if (Array.isArray(data.rowsPengeluaran) && data.rowsPengeluaran.length > 0) setRowsPengeluaran(cleanRows(data.rowsPengeluaran, 1));
  }, [editingId]);

  useFormDraft(currentFormSignature, applyRemoteDraft, activeTab, !!editingId);

  const [unverifiedRentals, setUnverifiedRentals] = useState<any[]>([]);

  const unverifiedListMemo = useMemo(() => {
    if (!user || activeTab !== "USAHA RENTAL") return [];

    const unverified: any[] = [];
    const timeNowMs = Date.now();

    rowsSewa.forEach((r, idx) => {
      if (r.lamaSewa === "PELUNASAN") return;
      const price = toNum(r.harga);
      if ((price > 0 || r.isPaid === "TIDAK") && r.jenisPS && r.jamMasukSewa && (r as any)._addedBy === user.email && !(r as any)._verifiedReturn) {
          const isCustom = r.lamaSewa === "Isi Sendiri";
          let durationHours = 0;
          if (isCustom) {
             durationHours = parseFloat(String((r as any)._customDurasi)) || 0;
          } else {
             const match = String(r.lamaSewa).match(/(\d+)\s*JAM/i);
             durationHours = match ? parseInt(match[1]) : 0;
             if (!durationHours && String(r.lamaSewa).match(/HARI|SEHARI|SEMALAM/i)) {
                 durationHours = 24;
             }
          }
          
          if (durationHours > 0) {
             const [hStr, mStr] = r.jamMasukSewa.split(":");
             const jamNum = parseInt(hStr || "0");
             const startD = new Date();
             startD.setHours(jamNum, parseInt(mStr || "0"), 0, 0);
             
             if (startD.getTime() > timeNowMs + 12 * 3600000) {
                 startD.setDate(startD.getDate() - 1);
             }
             
             const endD = new Date(startD.getTime() + durationHours * 3600000);
             
             unverified.push({
                isLive: true,
                sourceIdx: idx,
                jenis: r.jenisPS,
                namaPenyewa: (r as any).ket || "Tanpa Nama",
                start: r.jamMasukSewa,
                isPaid: r.isPaid,
                _rawRow: { ...r, _isActiveSession: true, _sourceIdx: idx },
                endTimeMs: endD.getTime()
             });
          }
      }
    });

    if (history && history.length > 0) {
       history.forEach(h => {
           const hd = new Date(h.tanggal);
           const diffDays = (timeNowMs - hd.getTime()) / (1000 * 3600 * 24);
           if (diffDays > 31) return;

           if (h.rowsSewa && h.rowsSewa.length > 0) {
               h.rowsSewa.forEach((r: any) => {
                    if (r.lamaSewa === "PELUNASAN") return;
                    const price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
                    if ((price > 0 || r.isPaid === "TIDAK") && r.jenisPS && r.jamMasukSewa && r._addedBy === user.email && !r._verifiedReturn) {
                        const isCustom = r.lamaSewa === "Isi Sendiri";
                        let durationHours = 0;
                        if (isCustom) {
                            durationHours = parseFloat(String(r._customDurasi)) || 0;
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

                        if (durationHours > 0) {
                            const [hStr, mStr] = r.jamMasukSewa.split(":");
                            const jamNum = parseInt(hStr || "0");
                            const parts = h.tanggal.split("-");
                            const startD = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), jamNum, parseInt(mStr || "0"), 0, 0);
                            
                            const endD = new Date(startD.getTime() + durationHours * 3600000);
                            
                            unverified.push({
                                isLive: false,
                                historyId: h.id,
                                jenis: r.jenisPS,
                                namaPenyewa: r.ket || "Tanpa Nama",
                                start: r.jamMasukSewa,
                                isPaid: r.isPaid,
                                _rawRow: { ...r, _historyId: h.id },
                                endTimeMs: endD.getTime()
                            });
                        }
                    }
               });
           }
       });
    }

    const uniq: any[] = [];
    const keys = new Set();
    for (const item of unverified) {
        const k = `${String(item.jenis).trim()}-${String(item.start).trim()}-${String(item.namaPenyewa).trim()}`;
        if (!keys.has(k)) {
            keys.add(k);
            uniq.push(item);
        }
    }
    
    return uniq;
  }, [rowsSewa, history, user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== "USAHA RENTAL") return;

    const checkInterval = setInterval(() => {
      const nowMs = Date.now();
      const needsNotify = unverifiedListMemo.filter(item => {
         if (nowMs >= item.endTimeMs) {
             const endDiff = (nowMs - item.endTimeMs) / (1000 * 3600 * 24);
             return endDiff <= 2.5;
         }
         return false;
      });
      
      setUnverifiedRentals(prev => {
         if (prev.length === needsNotify.length && prev.every((v,i) => v._rawRow._historyId === needsNotify[i]._rawRow._historyId && v._rawRow._sourceIdx === needsNotify[i]._rawRow._sourceIdx)) {
             return prev;
          }
         return needsNotify;
      });
    }, 15000);
    
    const nowMsInit = Date.now();
    const initNotify = unverifiedListMemo.filter(item => {
       if (nowMsInit >= item.endTimeMs) {
           const endDiff = (nowMsInit - item.endTimeMs) / (1000 * 3600 * 24);
           return endDiff <= 2.5;
       }
       return false;
    });
    setUnverifiedRentals(initNotify);

    return () => clearInterval(checkInterval);
  }, [unverifiedListMemo, user, activeTab]);

  const [paymentVerifyPrompt, setPaymentVerifyPrompt] = useState<any>(null);

  // Lock body scroll on active modals/popups
  useBodyScrollLock(openPOS);
  useBodyScrollLock(openGallery);
  useBodyScrollLock(openSettings);
  useBodyScrollLock(showChallenge);
  useBodyScrollLock(showDownloadAlert);
  useBodyScrollLock(showDuplicateDateAlert);
  useBodyScrollLock(showNewMonthAlert);
  useBodyScrollLock(showUnsavedAlert);
  useBodyScrollLock(!!validationAlert);
  useBodyScrollLock(showSuccessAlert);
  useBodyScrollLock(showStokConfirmation);
  useBodyScrollLock(showRecheckAlert);
  useBodyScrollLock(!!openEditRincian);
  useBodyScrollLock(unverifiedRentals.length > 0);
  useBodyScrollLock(!!paymentVerifyPrompt);

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
          setUnverifiedRentals((prev) => prev.filter(i => i.isLive ? i.sourceIdx !== sourceIdx : true));
          return;
      }

      setUnverifiedRentals((prev) => prev.filter(i => 
          !(i.jenis === item.jenis && i.start === item.start && i.namaPenyewa === item.namaPenyewa)
      ));

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
          try {
            const ref = doc(db, "history_pembukuan", item.historyId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data();
                if (data.rowsSewa && Array.isArray(data.rowsSewa)) {
                    const newRowsSewa = [...data.rowsSewa];
                    const targetIdx = newRowsSewa.findIndex(r => 
                       r.jenisPS === item.jenis && r.jamMasukSewa === item.start && (r.ket || "Tanpa Nama") === item.namaPenyewa
                    );
                    if (targetIdx >= 0) {
                        newRowsSewa[targetIdx] = { ...newRowsSewa[targetIdx], _verifiedReturn: true };
                        await updateDoc(ref, { rowsSewa: newRowsSewa });
                    }
                }
            }
          } catch (e) {
              console.error("Gagal verifikasi dari history:", e);
          }
      }
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
            const isCustom = r.lamaSewa === "Isi Sendiri";
            const totalBase = isCustom ? (toNum((r as any)._customBase) || 0) : getHargaSewa(r);
            const nominalFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalBase);
            block += `${r.ket}, belum bayar (${nominalFormatted}), sewa ${r.jenisPS}\n`;
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
      const price = toNum(r.harga);
      if (price > 0 && !isCash(r.bayar) && !isTransfer(r.bayar)) return "payment_empty";
    }

    for (const r of allLists) {
      const price = toNum(r.harga);
      if (price > 0 && isTransfer(r.bayar) && !r.buktiTransfer) {
        return "transfer_proof_empty";
      }
    }

    for (const r of rowsSewa) {
      const isFilled = r.ket || r.jenisPS || r.lamaSewa || r.jamMasukSewa || toNum(r.harga) > 0 || r.isPaid === "TIDAK";
      if (!isFilled) continue;

      if (!r.isPaid) return "isPaid_empty";

      let basePrice = toNum(r.harga);
      if (r.isPaid === "TIDAK") {
          const isCustom = r.lamaSewa === "Isi Sendiri";
          basePrice = isCustom ? toNum((r as any)._customBase) : getHargaSewa(r);
      }
      
      if (basePrice <= 0) return "harga_sewa_empty";
      
      if (!r.isOngkir) return "ongkir_empty";
      if (r.isOngkir === "YA" && r.isPaid !== "TIDAK") {
          const ong = toNum(r._ongkir);
          if (ong <= 0 || !r._bayarOngkir) return "ongkir_invalid";
      }
      if (!r.jamMasukSewa) return "jam_masuk_sewa_empty";
      if (!(r as any).ket) return "keterangan_empty_sewa";
      if (r.isOngkir !== "TIDAK" && !(r as any).diantarOleh) return "diantar_oleh_empty";
    }

    for (const r of rowsSetoran) {
      const nominal = toNum(r.harga);
      if (nominal > 0) {
        if (!r.ket) return "setoran_ket_empty";
        if (!r.bayar) return "setoran_tf_empty";
      }
    }

    for (const r of rowsPengeluaran) {
      const nominal = toNum(r.harga);
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
      setShowDownloadAlert(true);
      return;
    }

    const valStatus = validateTransactions();
    if (valStatus !== "ok") {
        triggerValidationError(valStatus);
        return;
    }

    setActiveTab("UPDATE STOK");
    setShowStokConfirmation(true);
  };

  const logActivity = async (action: "CREATE" | "UPDATE" | "DELETE", targetDate: string, targetDay: string, recordData: any) => {
    try {
      const email = auth.currentUser?.email || user?.email;
      if (!email) return;
      const uniqueLogId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
        ? crypto.randomUUID() 
        : Date.now().toString() + Math.random().toString(36).slice(2);
      
      const data = recordData || {};
      const totalHarian = data.totalHarian || 0;
      const totalJajanan = data.totalJajanan || 0;
      const totalJasaAks = data.totalJasaAks || 0;
      const totalSewa = data.totalSewa || 0;
      const totalIncome = totalHarian + totalJajanan + totalJasaAks + totalSewa;
      const totalCash = data.totalCash || 0;
      const totalTransfer = data.totalTransfer || 0;
      const totalPengeluaran = (data.rowsPengeluaran || []).reduce((sum: number, r: any) => sum + (Number(r.harga) || 0), 0);

      const logDoc = {
        id: uniqueLogId,
        email,
        action,
        targetDate,
        targetDay,
        timestamp: new Date().toISOString(),
        details: {
          totalIncome,
          totalCash,
          totalTransfer,
          totalPengeluaran
        }
      };

      await setDoc(doc(db, "pembukuan_logs", uniqueLogId), logDoc);
    } catch (err) {
      console.error("logActivity error:", err);
    }
  };

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
    
    const finalRukoBuka = rukoBuka || (absenPagi ? absenPagi.split(" - ")[0] : "");
    const finalRukoTutup = rukoTutup || (absenSiang ? absenSiang.split(" - ")[0] : "");

    const newItem = {
      id: uniqueId,
      tanggal, hari,
      absenPagi, absenSiang, shiftPegawai, 
      rukoBuka: finalRukoBuka, 
      rukoTutup: finalRukoTutup, 
      catatan,
      totalHarian, totalJajanan, totalJasaAks, totalSewa, totalCash, totalTransfer,
      rowsHarian: JSON.parse(JSON.stringify(rowsHarian)),
      rowsJajanan: JSON.parse(JSON.stringify(rowsJajanan)),
      rowsJasaAks: JSON.parse(JSON.stringify(rowsJasaAks)),
      rowsSewa: JSON.parse(JSON.stringify(rowsSewa.map(row => {
          if (row.isOngkir === "YA" && toNum((row as any)._ongkir) > 0) {
              const ongkirAmount = toNum((row as any)._ongkir);
              const pegNom = Math.round((ongkirAmount * ongkirConfig.pegawaiPersen) / 100);
              const ownNom = ongkirAmount - pegNom;
              return {
                  ...row,
                  _isNewOngkirSystem: true,
                  _ongkirPegawaiPersen: ongkirConfig.pegawaiPersen,
                  _ongkirMasukGaji: ongkirConfig.masukGaji,
                  _ongkirPegawaiNominal: pegNom,
                  _ongkirOwnerNominal: ownNom
              };
          }
          return row;
      }))),
      rowsSetoran: JSON.parse(JSON.stringify(rowsSetoran)),
      rowsPengeluaran: JSON.parse(JSON.stringify(rowsPengeluaran)),
    };

    setDoc(doc(db, "history_pembukuan", newItem.id), newItem).catch(console.error);
    logActivity("CREATE", tanggal, hari, newItem);
    
    if (!editingId && shiftPegawai !== "Libur" && user?.email) {
      if (!absenPagi || !absenSiang || !shiftPegawai) {
        const dendaAmount = absenConfig?.dendaTidakAbsenPulang ?? 40000;
        if (dendaAmount > 0) {
          try {
             const cleanUserEmail = normalizeEmail(user.email);
             const idempKey = `dendaBolos_${tanggal}_${cleanUserEmail}`;
             const newDenda = {
                  id: `dendaBolos_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                  nominal: dendaAmount,
                  ket: `[Auto-Sistem] Tidak Full Absen (Bolos/Lupa) pada ${tanggal}`,
                  photoUrl: "",
                  dateStr: new Date().toISOString(),
                  _isAutoSistem: true,
                  _idempKey: idempKey
             };
             const d = new Date();
             const mm = String(d.getMonth() + 1).padStart(2, '0');
             const yy = String(d.getFullYear()).slice(-2);
             const currentBulanTahun = `${mm}/${yy}`;

             await atomicAddDenda(cleanUserEmail, newDenda, currentBulanTahun);
          } catch (err) {
              console.error("Gagal menerapkan denda bolos/lupa absen:", err);
          }
        }
      }
    }

    if (editingId) setEditingId(null);
    
    setRukoBuka("");
    setRukoTutup("");
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
    
    const cleanCompletedEmail = normalizeEmail(user?.email || "");
    if (cleanCompletedEmail) {
      const q = query(collection(db, "log_absensi"), where("email", "==", cleanCompletedEmail), where("tanggal", "==", tanggal));
      getDocs(q).then((snapshot) => {
        snapshot.forEach((docSnap) => {
          updateDoc(docSnap.ref, { status: "completed" }).catch(console.error);
        });
      }).catch((e) => {
        console.error("Gagal update status log_absensi:", e);
      });
    }
    const realNow = getWibDate();
    systemDateRef.current = realNow.getDate();
    const yyyy = realNow.getFullYear();
    const mm = String(realNow.getMonth() + 1).padStart(2, "0");
    const dd = String(realNow.getDate()).padStart(2, "0");
    setTanggal(`${yyyy}-${mm}-${dd}`);
    const nextHari = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(realNow);
    setHari(nextHari.charAt(0).toUpperCase() + nextHari.slice(1));

    setAbsenPagi("");
    setAbsenSiang("");
    setShiftPegawai("");

    setDoc(doc(db, "data", "draft"), {}).catch(console.error);
    setDoc(doc(db, "data", "ruko_status"), { rukoBuka: "", rukoBukaDate: "", rukoTutup: "", rukoTutupDate: "", tanggal: "" }, { merge: false }).catch(console.error);

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
        rowsJasaAks: JSON.parse(JSON.stringify(rowsJasaAks)),
        rowsSewa: JSON.parse(JSON.stringify(rowsSewa.map(row => {
          if (row.isOngkir === "YA" && toNum((row as any)._ongkir) > 0) {
              const ongkirAmount = toNum((row as any)._ongkir);
              if ((row as any)._isNewOngkirSystem) {
                  const oldPersen = (row as any)._ongkirPegawaiPersen ?? 100;
                  const pegNom = Math.round((ongkirAmount * oldPersen) / 100);
                  const ownNom = ongkirAmount - pegNom;
                  return {
                      ...row,
                      _ongkirPegawaiNominal: pegNom,
                      _ongkirOwnerNominal: ownNom
                  };
              } else {
                  return row;
              }
          }
          return row;
        }))),
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
    
    setDoc(doc(db, "history_pembukuan", editingId), updatedData, { merge: true }).catch(console.error);
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
    setRowsJasaAks(item.rowsJasaAks || Array.from({ length: 5 }, () => ({ ...blankJasaAks })));
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
    const settingsRef = doc(db, "data", "settings");
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const pl = data.priceLists;
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
      } else {
        setDoc(settingsRef, {
            settings: { 
                priceLists: { hargaHarian: DEFAULT_HARGA_HARIAN, hargaJajanan: DEFAULT_HARGA_JAJANAN, hargaJasaAks: DEFAULT_HARGA_JASA_AKS, hargaSewa: DEFAULT_HARGA_SEWA }
            },
            ongkirConfig: { pegawaiPersen: 70, masukGaji: false },
            absenConfig: { durasiWaktuPotongan: 15, waktuToleransi: 15, nominalDenda: 1500, dendaTidakAbsenPulang: 40000 }
        }, { merge: true });
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.settings) setDoc(settingsRef, parsed.settings, { merge: true });
            }
        } catch(e) {}
      }
    }, (err) => console.error(err));

    return () => { unsubSettings(); };
  }, []);

  useEffect(() => {
    let q = collection(db, "history_pembukuan") as any;
    
    if (filter === "Semua Bulan") {
       q = query(q, orderBy("tanggal", "desc"));
    } else if (filter === "Pilih Bulan") {
       const yyyy = new Date().getFullYear();
       const mm = String(filterMonth).padStart(2, "0");
       const startD = `${yyyy}-${mm}-01`;
       const endD = `${yyyy}-${mm}-31`;
       q = query(q, where("tanggal", ">=", startD), where("tanggal", "<=", endD), orderBy("tanggal", "desc"));
    } else if (filter === "Rentang" && rangeStart && rangeEnd) {
       q = query(q, where("tanggal", ">=", rangeStart), where("tanggal", "<=", rangeEnd), orderBy("tanggal", "desc"));
    } else {
       const cutoff = new Date();
       cutoff.setDate(cutoff.getDate() - 60);
       const yyyy = cutoff.getFullYear();
       const mm = String(cutoff.getMonth() + 1).padStart(2, "0");
       const dd = String(cutoff.getDate()).padStart(2, "0");
       q = query(q, where("tanggal", ">=", `${yyyy}-${mm}-${dd}`), orderBy("tanggal", "desc"));
    }

    const unsubHistory = onSnapshot(q, (snap: any) => {
      const items: HistoryItem[] = [];
      snap.forEach((d: any) => {
        const data = d.data();
        items.push({ 
            id: d.id, ...data,
            totalHarian: Number(data.totalHarian) || 0,
            totalJajanan: Number(data.totalJajanan) || 0,
            totalJasaAks: Number(data.totalJasaAks) || 0,
            totalSewa: Number(data.totalSewa) || 0,
            totalCash: Number(data.totalCash) || 0,
            totalTransfer: Number(data.totalTransfer) || 0,
        } as HistoryItem);
      });
      items.sort((a,b) => b.tanggal.localeCompare(a.tanggal) || b.id.localeCompare(a.id));
      
      if (items.length === 0 && filter === "Bulan Ini") {
          try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.history && Array.isArray(parsed.history)) {
                    parsed.history.forEach((h: any) => {
                        setDoc(doc(db, "history_pembukuan", h.id), h);
                    });
                }
            }
          } catch(e) {}
      }
      
      setHistory(items);
      setHydrated(true);
    }, (err: any) => console.error(err));

    return () => { unsubHistory(); };
  }, [filter, filterMonth, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      setDoc(doc(db, "data", "settings"), {
        priceLists: { hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa }
      }, { merge: true }).catch(console.error);
    } catch { }
  }, [hydrated, hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa]);

  // ===== BACKUP / RESTORE =====
  const restoreInputRef = useRef<HTMLInputElement>(null);
  
  const doBackup = () => {
    const payload = {
      build: "v3.0 Alpha",
      savedAt: new Date().toISOString(),
      settings: { dark, kualitasGambar, priceLists: { hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa } },
      data: { history },
    };
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
      setHistory(restoredHistory);
      
      restoredHistory.forEach((h: any) => {
        if (h && h.id) {
          setDoc(doc(db, "history_pembukuan", h.id), h);
        }
      });

      const pl = json?.settings?.priceLists;
      if (pl) {
        if (pl.hargaHarian) setHargaHarian(pl.hargaHarian);
        if (pl.hargaJajanan) setHargaJajanan(pl.hargaJajanan);
        if (pl.hargaJasaAks) setHargaJasaAks(pl.hargaJasaAks);
        if (pl.hargaSewa) setHargaSewa(pl.hargaSewa);
      }
      setSuccessMessage("Restore data berhasil!");
      setShowSuccessAlert(true);
    } catch (e) { alert("File restore invalid / corrupt ❌"); } 
    finally { if (restoreInputRef.current) restoreInputRef.current.value = ""; }
  };

  const handleBackupDrive = async () => {
    const payload = {
      build: "v3.0 Alpha",
      savedAt: new Date().toISOString(),
      settings: { dark, kualitasGambar, priceLists: { hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa } },
      data: { history },
    };
    try {
      await uploadBackupToDrive(JSON.stringify(payload, null, 2));
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
      setHistory(restoredHistory);
      
      restoredHistory.forEach((h: any) => {
        if (h && h.id) {
          setDoc(doc(db, "history_pembukuan", h.id), h);
        }
      });

      const pl = json?.settings?.priceLists;
      if (pl) {
        if (pl.hargaHarian) setHargaHarian(pl.hargaHarian);
        if (pl.hargaJajanan) setHargaJajanan(pl.hargaJajanan);
        if (pl.hargaJasaAks) setHargaJasaAks(pl.hargaJasaAks);
        if (pl.hargaSewa) setHargaSewa(pl.hargaSewa);
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
  const handleToggleTheme = useCallback(() => {
    const newMode = dark ? "light" : "dark";
    setThemeMode(newMode);
    if (user?.email) {
      setDoc(doc(db, "users", user.email), { themeMode: newMode }, { merge: true }).catch(console.error);
    }
  }, [dark, setThemeMode, user]);

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
      dendaTidakAbsenPulang: typeof cfg?.dendaTidakAbsenPulang === "number" ? cfg.dendaTidakAbsenPulang : 40000
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

  const handlePaymentVerifyNo = useCallback(async () => {
    if (!paymentVerifyPrompt) return;
    await handleVerifyReturn({ ...paymentVerifyPrompt, _skipPaymentCheck: true });
    if (paymentVerifyPrompt._rawRow) {
        if (paymentVerifyPrompt._rawRow._isActiveSession && typeof paymentVerifyPrompt._rawRow._sourceIdx === "number") {
            setRowsSewa(prev => {
                const res = [...prev];
                const idx = res.findIndex(r => r.jamMasukSewa === paymentVerifyPrompt.start && r.jenisPS === paymentVerifyPrompt.jenis && (r as any).ket === paymentVerifyPrompt.namaPenyewa);
                if (idx !== -1) res.splice(idx, 1);
                return res.length === 0 ? [newBlankSewa()] : res;
            });
        }
        if (paymentVerifyPrompt._rawRow._historyId) {
            try {
               const ref = doc(db, "history_pembukuan", paymentVerifyPrompt._rawRow._historyId);
               const snap = await getDoc(ref);
               if (snap.exists()) {
                   const data = snap.data();
                   if (data.rowsSewa && Array.isArray(data.rowsSewa)) {
                       const newRows = data.rowsSewa.filter((r: any) => 
                           !(r.jamMasukSewa === paymentVerifyPrompt.start && r.jenisPS === paymentVerifyPrompt.jenis && (r.ket || "Tanpa Nama") === paymentVerifyPrompt.namaPenyewa)
                       );
                       await updateDoc(ref, { rowsSewa: newRows });
                   }
               }
            } catch(e) { console.error(e); }
        }
    }

    setCatatan(prev => {
        if (!prev) return prev;
        const escStr = paymentVerifyPrompt.jenis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${paymentVerifyPrompt.namaPenyewa}, belum bayar \\(.*?\\), sewa ${escStr}\\n?`, "gi");
        return prev.replace(regex, "").trim();
    });

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
  }, [paymentVerifyPrompt, handleVerifyReturn, setRowsSewa, newBlankSewa, setCatatan, setActiveTab]);

  const handlePaymentVerifyYes = useCallback(async () => {
    if (!paymentVerifyPrompt) return;
    await handleVerifyReturn({ ...paymentVerifyPrompt, _skipPaymentCheck: true });
    if (paymentVerifyPrompt._rawRow) {
        if (paymentVerifyPrompt._rawRow._isActiveSession && typeof paymentVerifyPrompt._rawRow._sourceIdx === "number") {
            setRowsSewa(prev => {
                const res = [...prev];
                const idx = res.findIndex(r => r.jamMasukSewa === paymentVerifyPrompt.start && r.jenisPS === paymentVerifyPrompt.jenis && (r as any).ket === paymentVerifyPrompt.namaPenyewa);
                if (idx !== -1) res.splice(idx, 1);
                return res.length === 0 ? [newBlankSewa()] : res;
            });
        }
        if (paymentVerifyPrompt._rawRow._historyId) {
            try {
               const ref = doc(db, "history_pembukuan", paymentVerifyPrompt._rawRow._historyId);
               const snap = await getDoc(ref);
               if (snap.exists()) {
                   const data = snap.data();
                   if (data.rowsSewa && Array.isArray(data.rowsSewa)) {
                       const newRows = data.rowsSewa.filter((r: any) => 
                           !(r.jamMasukSewa === paymentVerifyPrompt.start && r.jenisPS === paymentVerifyPrompt.jenis && (r.ket || "Tanpa Nama") === paymentVerifyPrompt.namaPenyewa)
                       );
                       await updateDoc(ref, { rowsSewa: newRows });
                   }
               }
            } catch(e) { console.error(e); }
        }
    }

    setCatatan(prev => {
        if (!prev) return prev;
        const escStr = paymentVerifyPrompt.jenis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${paymentVerifyPrompt.namaPenyewa}, belum bayar \\(.*?\\), sewa ${escStr}\\n?`, "gi");
        return prev.replace(regex, "").trim();
    });

    const raw = paymentVerifyPrompt._rawRow || {};
    
    let getHarga = 0;
    const isCustom = raw.lamaSewa === "Isi Sendiri";
    if (isCustom) {
        getHarga = parseInt(String(raw._customBase).replace(/\D/g, "")) || 0;
    } else if (hargaSewa) {
        const targetStr = `${raw.jenisPS} - ${raw.lamaSewa}`;
        const found = hargaSewa.find((h: any) => h.label === targetStr);
        getHarga = found ? found.price : 0;
    }
    if (raw.isOngkir === "YA") {
        getHarga += parseInt(String(raw._ongkir).replace(/\D/g, "")) || 0;
    }
    
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
            bayar: ""
        };
        return newRows;
    });
    setTimeout(() => {
       const el = document.getElementById("section-rincian");
       if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [paymentVerifyPrompt, handleVerifyReturn, setRowsSewa, newBlankSewa, setCatatan, setActiveTab, hargaSewa]);

  const resetSetting = () => {
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
    try {
      const rawEmail = auth.currentUser?.email;
      if (!rawEmail) return;
      const userEmail = normalizeEmail(rawEmail);
      const q = query(collection(db, "log_absensi"), where("tanggal", "==", tanggal), where("email", "==", userEmail), where("jenisAbsen", "==", "Masuk"));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => deleteDoc(docSnap.ref).catch(console.error));
    } catch (e) {
      console.error("Gagal reset absen pagi", e);
    }
  }, [tanggal]);

  const handleResetAbsenSiang = useCallback(async () => {
    setAbsenSiang("");
    try {
      const rawEmail = auth.currentUser?.email;
      if (!rawEmail) return;
      const userEmail = normalizeEmail(rawEmail);
      const q = query(collection(db, "log_absensi"), where("tanggal", "==", tanggal), where("email", "==", userEmail), where("jenisAbsen", "==", "Pulang"));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => deleteDoc(docSnap.ref).catch(console.error));
    } catch (e) {
      console.error("Gagal reset absen siang", e);
    }
  }, [tanggal]);

  const handleResetForm = useCallback(async () => {
    setAbsenPagi(""); setAbsenSiang(""); setShiftPegawai(""); setRukoBuka(""); setRukoTutup(""); setCatatan(""); 
    try {
      await setDoc(doc(db, "data", "ruko_status"), { rukoBuka: "", rukoBukaDate: "", rukoTutup: "", rukoTutupDate: "", tanggal: "" }, { merge: false });
      const q = query(collection(db, "log_absensi"), where("tanggal", "==", tanggal));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        deleteDoc(docSnap.ref).catch(console.error);
      });
    } catch (e) {
      console.error("Gagal menghapus log_absensi/ruko_status:", e);
    }
  }, [tanggal, setShiftPegawai, setRukoBuka, setRukoTutup]);

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
    showDownloadAlert,
    setShowDownloadAlert,
    showDuplicateDateAlert,
    setShowDuplicateDateAlert,
    showNewMonthAlert,
    setShowNewMonthAlert,
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
    getHargaSewa,
    getTitle,
    handleSavePrices,
    handleResetSpecificDefault,
    rowsHarian,
    setRowsHarian,
    rowsJajanan,
    setRowsJajanan,
    rowsJasaAks,
    setRowsJasaAks,
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
    setHistory,
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
    setUnverifiedRentals,
    paymentVerifyPrompt,
    setPaymentVerifyPrompt,
    handleVerifyReturn,
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
    handleClearProductChange,
    handleResetRukoBuka,
    handleResetRukoTutup,
    handleResetAbsenPagi,
    handleResetAbsenSiang,
    handleResetForm,
    handleToggleTheme,
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
