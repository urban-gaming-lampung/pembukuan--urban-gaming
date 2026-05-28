import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Header from "./components/Header";
import Input from "./components/Input";
import RincianHarian from "./components/RincianHarian";
import RincianJajanan from "./components/RincianJajanan";
import RincianJasaAksesoris from "./components/RincianJasaAksesoris";
import RincianSewa from "./components/RincianSewa";
import RekapPemasukan from "./components/RekapPemasukan";
import RincianSetoran from "./components/RincianSetoran";
import RincianPengeluaran from "./components/RincianPengeluaran";
import FilterComp from "./components/Filter";
import HistoryPembukuan from "./components/HistoryPembukuan";
import Grafik from "./components/Grafik";
import Footer from "./components/Footer";
import GeminiReportGenerator from "./components/GeminiReportGenerator";
import Reminder from "./components/Reminder";
import PdfExporter, { PdfExporterHandle } from "./components/PdfExporter";
import useStokData from "./hooks/useStokData";
import Pengaturan from "./components/Pengaturan";
import EditRincian from "./components/EditRincian"; 
import UpdateStok from "./components/UpdateStok"; 
import PageOwner from "./components/PageOwner";
import WidgetMonitoringStatus from "./components/WidgetMonitoringStatus";
import { Package, AlertCircle } from "lucide-react";
import { collection, doc, setDoc, deleteDoc, onSnapshot, addDoc, updateDoc, query, getDocs, getDoc, where, limit, orderBy, serverTimestamp, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "./lib/firebase";
import { usePresence } from "./hooks/usePresence";
import { useFormDraft } from "./hooks/useFormDraft";
import LiveCursors from "./components/LiveCursors";
import Login from "./components/Login";
import { uploadBackupToDrive, downloadBackupFromDrive } from "./lib/googleDrive";

import { lazy, Suspense } from "react";
import { useGameConfig } from "./games/hooks/useGameConfig";
import { GAME_NAMES_ID } from "./games/constants";
import ChallengeButton from "./games/components/ChallengeButton";

const ChallengeModal = lazy(() => import("./games/components/ChallengeModal"));

import {
  RowHarian, RowJajanan, RowJasaAks, RowSewa, HistoryItem
} from "./lib/types";

import {
  DEFAULT_HARGA_HARIAN,
  DEFAULT_HARGA_JAJANAN,
  DEFAULT_HARGA_JASA_AKS,
  DEFAULT_HARGA_SEWA,
} from "./constants/prices";
import { LS_KEY } from "./constants/storage";

type ImageQuality = "Tinggi" | "Hemat";
type Price = { label: string; price: number };
type PriceListKey = "harian" | "jajanan" | "jasaAks" | "sewa";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export default function App() {
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

  // ===== PROFILE & BG STATE =====
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [userProfileColor, setUserProfileColor] = useState<string>("#3b82f6");
  const [customBgDark, setCustomBgDark] = useState<string | null>(() => {
    try { return localStorage.getItem('custom_bg_dark'); } catch(e) { return null; }
  });

  // ===== ASSISTANT STATE =====
  const [triggeredAssistants, setTriggeredAssistants] = useState<any[]>([]);

  useEffect(() => {
    if (user?.email?.toLowerCase().trim() === "owner@gmail.com") {
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
  }, [user]);

  const handleRunAssistant = async (a: any) => {
    try {
      // 1. Add to owner_expenses
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
      // 2. Update assistant last_triggered
      await updateDoc(doc(db, "owner_assistants", a.id), {
        last_triggered: Date.now()
      });
      // 3. Dismiss from UI
      setTriggeredAssistants(prev => prev.filter(x => x.id !== a.id));
      alert(`Berhasil menambahkan pengeluaran: ${a.nama_pengeluaran}`);
    } catch(e: any) {
      alert("Gagal menjalankan asisten: " + e.message);
    }
  };

  const handleDismissAssistant = (id: string) => {
    setTriggeredAssistants(prev => prev.filter(x => x.id !== id));
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
              // Pegawai log
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
    if (user?.email) {
      const profileRef = doc(db, "users", user.email);
      const unsub = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setUserProfilePic(data.photoUrl || null);
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
         } else {
            setUserProfilePic(null);
         }
      });
      return () => unsub();
    } else {
      setUserProfilePic(null);
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

  const getWibDate = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  
  // Business day logic: jam 00:00 - 05:59 masih dianggap hari sebelumnya (shift belum selesai)
  const getBusinessDate = () => {
    const wib = getWibDate();
    if (wib.getHours() < 6) {
      wib.setDate(wib.getDate() - 1); // Mundur 1 hari
    }
    return wib;
  };

  const today = getBusinessDate();
  const [tanggal, setTanggal] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
  const [hari, setHari] = useState(() => {
    const h = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(today);
    return h.charAt(0).toUpperCase() + h.slice(1);
  });

  const systemDateRef = useRef(today.getDate());
  const hasDataRef = useRef(false);
  // Track whether the business day has already been saved to history
  const historyRef = useRef<any[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (hasDataRef.current) return;
      
      // Determine target date: use business date, BUT if that date already
      // has data in history, use real calendar date instead (shift is done)
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
    }, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // ===== TAB STATE =====
  const [activeTab, setActiveTab] = useState<"USAHA RENTAL" | "UPDATE STOK" | "PAGE OWNER" | "MONITORING">("USAHA RENTAL");

  const { activeUsers, setFocusedField } = usePresence(user, activeTab, userProfileColor);

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
  const [editingId, setEditingId] = useState<string | null>(null);

  const setShiftPegawai = useCallback((val: string) => {
    _setShiftPegawai(val);
    if (!editingId && user?.email) {
      setDoc(doc(db, "data", `shift_${user.email}`), { shift: val, tanggal }, { merge: true }).catch(console.error);
    }
  }, [editingId, tanggal, user?.email]);

  // Fetch absenPagi and absenSiang from log_absensi based on current user and date
  useEffect(() => {
    if (!user?.email || !tanggal) return;

    // SKIP: Jika tanggal ini sudah ada di history (sudah disimpan), jangan isi ulang absen
    const alreadySaved = historyRef.current.some(h => h.tanggal === tanggal);
    if (alreadySaved && !editingId) {
      setAbsenPagi("");
      setAbsenSiang("");
      return;
    }

    const q = query(
      collection(db, "log_absensi"),
      where("email", "==", user.email),
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
      setAbsenPagi(pagi);
      setAbsenSiang(siang);
    }, (err) => console.error("Error fetching absen: ", err));
    return () => unsub();
  }, [user?.email, tanggal, editingId]);

  // Fetch shiftPegawai from real-time db
  useEffect(() => {
    if (!user?.email || !tanggal || editingId) return;
    
    // SKIP: Jika tanggal ini sudah ada di history, biarkan kosong
    const alreadySaved = historyRef.current.some(h => h.tanggal === tanggal);
    if (alreadySaved) return;

    const unsub = onSnapshot(doc(db, "data", `shift_${user.email}`), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.tanggal === tanggal) {
          _setShiftPegawai(data.shift || "");
        } else {
          _setShiftPegawai(""); // Reset if date mismatch
        }
      }
    });
    return () => unsub();
  }, [user?.email, tanggal, editingId]);

  const [rukoBuka, _setRukoBuka] = useState("");
  const [rukoBukaDate, _setRukoBukaDate] = useState("");
  const [rukoTutup, _setRukoTutup] = useState("");
  const [rukoTutupDate, _setRukoTutupDate] = useState("");
  const [catatan, setCatatan] = useState("");

  const setRukoBuka = useCallback((val: string, dateStr?: string) => {
    _setRukoBuka(val);
    const dStr = dateStr || new Date().toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, "-");
    if (val) _setRukoBukaDate(dStr);
    if (!editingId && val) {
      setDoc(doc(db, "data", "ruko_status"), { rukoBuka: val, rukoBukaDate: dStr, tanggal }, { merge: true }).catch(console.error);
    }
  }, [editingId, tanggal]);

  const setRukoTutup = useCallback((val: string, dateStr?: string) => {
    _setRukoTutup(val);
    const dStr = dateStr || new Date().toLocaleDateString("id-ID", { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, "-");
    if (val) _setRukoTutupDate(dStr);
    if (!editingId && val) {
      setDoc(doc(db, "data", "ruko_status"), { rukoTutup: val, rukoTutupDate: dStr, tanggal }, { merge: true }).catch(console.error);
    }
  }, [editingId, tanggal]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "ruko_status"), (snap) => {
      if (snap.exists() && !editingId) {
        const data = snap.data();
        if (data.tanggal === tanggal) {
           if (data.rukoBuka) _setRukoBuka(data.rukoBuka.split(" - ")[0]);
           if (data.rukoBukaDate) _setRukoBukaDate(data.rukoBukaDate);
           if (data.rukoTutup) _setRukoTutup(data.rukoTutup.split(" - ")[0]);
           if (data.rukoTutupDate) _setRukoTutupDate(data.rukoTutupDate);
        } else {
           // Jangan reset otomatis jika tidak sama, biar user yang reset atau biarkan sistem membersihkan di hari baru.
        }
      }
    });
    return () => unsub();
  }, [tanggal, editingId]);
  
  // State untuk Alert (UI Apple Style)
  const [showDownloadAlert, setShowDownloadAlert] = useState(false); // Data belum lengkap (Header)
  const [showDuplicateDateAlert, setShowDuplicateDateAlert] = useState(false);
  const [showNewMonthAlert, setShowNewMonthAlert] = useState(false);
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false); // Dirty check saat share
  const [validationAlert, setValidationAlert] = useState<{title: string, message: string} | null>(null); // Peringatan validasi tersentralisasi
  const [showSuccessAlert, setShowSuccessAlert] = useState(false); // Feedback sukses
  const [successMessage, setSuccessMessage] = useState("Data berhasil disimpan!");
  const [showStokConfirmation, setShowStokConfirmation] = useState(false); // Konfirmasi Stok sblm Share
  const [showRecheckAlert, setShowRecheckAlert] = useState(false); // Alert Tolak Konfirmasi Stok

  const triggerValidationError = (status: string) => {
      let title = "Data Tidak Lengkap";
      let message = "";
      let targetId = "";

      switch(status) {
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
          // Add a small delay for UI transition, then scroll and highlight
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

  // State untuk Melacak Perubahan (Dirty Check)
  const [savedSignature, setSavedSignature] = useState("");
  // Ref untuk menandai bahwa kita baru saja melakukan Load/Save
  const isJustSavedOrLoaded = useRef(true);

  // ===== PRICE SETTINGS =====
  const [hargaHarian, setHargaHarian] = useState<Price[]>(DEFAULT_HARGA_HARIAN as Price[]);
  const [hargaJajanan, setHargaJajanan] = useState<Price[]>(DEFAULT_HARGA_JAJANAN as Price[]);
  const [hargaJasaAks, setHargaJasaAks] = useState<Price[]>(DEFAULT_HARGA_JASA_AKS as Price[]);
  const [hargaSewa, setHargaSewa] = useState<Price[]>(DEFAULT_HARGA_SEWA as Price[]);
  
  const [ongkirConfig, setOngkirConfig] = useState({ pegawaiPersen: 70, masukGaji: true });
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
  // PENTING: Urutan key menentukan urutan tata letak kolom secara otomatis di TableEditor!
  const blankSewa: RowSewa & { _customBase?: string | number } = { jenisPS: "", lamaSewa: "", jamMasukSewa: "", ket: "", isPaid: "", harga: "", isOngkir: "", _ongkir: "", _bayarOngkir: "", bayar: "", _customDurasi: "", _customBase: "", diantarOleh: "" };

  // Helper: generate stable unique ID per row sewa (untuk _autoOngkirKey yang stabil)
  const genRowId = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().slice(0, 8)
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const newBlankSewa = () => ({ ...blankSewa, _rowId: genRowId() });

  const [rowsHarian, setRowsHarian] = useState(Array.from({ length: 5 }, () => ({ ...blankHarian })));
  const [rowsJajanan, setRowsJajanan] = useState(Array.from({ length: 5 }, () => ({ ...blankJajanan })));
  const [rowsJasaAks, setRowsJasaAks] = useState(Array.from({ length: 5 }, () => ({ ...blankJasaAks })));
  const [rowsSewa, setRowsSewa] = useState<(RowSewa & { _customBase?: string | number })[]>(Array.from({ length: 5 }, () => newBlankSewa()));

  // ===== NEW TABLES STATE: Setoran & Pengeluaran =====
  const [rowsSetoran, setRowsSetoran] = useState<any[]>([
    { ket: "", harga: "", bayar: "" }
  ]);
  const [rowsPengeluaran, setRowsPengeluaran] = useState<any[]>([
    { ket: "", harga: "", bayar: "" }
  ]);

  // Sync date changes removed since TableEditor state excludes them natively.

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

  const totalOngkirKeseluruhan = useMemo(() => rowsSewa.reduce((s, r) => (r.isOngkir === "YA" ? s + toNum(r._ongkir) : s), 0), [rowsSewa]);

  // === LOGIKA BARU: HITUNG PENGELUARAN & SISA KAS ===
  const totalPengeluaran = useMemo(() => rowsPengeluaran.reduce((s, r) => s + toNum(r.harga), 0), [rowsPengeluaran]);
  const totalPengeluaranCash = useMemo(() => rowsPengeluaran.reduce((sum, r) => (r.bayar === "Cash" ? sum + toNum(r.harga) : sum), 0), [rowsPengeluaran]);
  const totalPengeluaranTransfer = useMemo(() => rowsPengeluaran.reduce((sum, r) => (r.bayar === "Transfer" ? sum + toNum(r.harga) : sum), 0), [rowsPengeluaran]);
  const manualPengeluaranCash = useMemo(() => rowsPengeluaran.reduce((sum, r: any) => (r.bayar === "Cash" && !r._autoOngkirKey ? sum + toNum(r.harga) : sum), 0), [rowsPengeluaran]);

  // === EFEK OTOMATIS: Update Setoran berdasarkan kebijakan ===
  // KEBIJAKAN BARU (≥ 29 April 2026): Semua pemasukan cash = setoran, tanpa dikurangi pengeluaran
  // KEBIJAKAN LAMA (< 29 April 2026): Setoran = Cash - Pengeluaran Cash
  useEffect(() => {
    const POLICY_DATE = "2026-04-29";
    const isNewPolicy = tanggal >= POLICY_DATE;

    let sisaKas: number;

    if (isNewPolicy) {
      // Kebijakan baru: semua cash masuk setoran, KECUALI dikurangi pengeluaran manual cash. Auto ongkir tidak dikurangi.
      sisaKas = Math.max(0, totalCash - manualPengeluaranCash);
    } else {
      // Kebijakan lama: kurangi pengeluaran cash
      // REVISI (Pisahkan Ongkir): Keluarkan ongkir dari Income & Expense khusus untuk Setoran
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

  // === EFEK OTOMATIS: Update Pengeluaran otomatis dari Ongkir Sewa PS ===
  // REFACTOR: Per admin pengantar, dengan bagi hasil (snapshot vs preview)
  useEffect(() => {
     const ongkirEntries: { key: string; ket: string; harga: number; bayar: string; _namaPengantar?: string }[] = [];

     rowsSewa.forEach((r) => {
       if (r.isOngkir === "YA" && toNum(r._ongkir) > 0 && (r as any).diantarOleh) {
         const ongkirCustomer = toNum(r._ongkir);
         // Stable key: pakai _rowId jika ada, fallback untuk data lama
         const rowId = (r as any)._rowId || `legacy_${(r as any).ket}_${(r as any).jamMasukSewa}`;

         // === RULE PERSENTASE ===
         let pegawaiNominal: number;
         if ((r as any)._isNewOngkirSystem) {
           // Row sudah pernah disimpan → pakai snapshot
           pegawaiNominal = (r as any)._ongkirPegawaiNominal
             ?? Math.round((ongkirCustomer * ((r as any)._ongkirPegawaiPersen ?? ongkirConfig.pegawaiPersen)) / 100);
         } else {
           // Row baru, belum disimpan → pakai setting aktif sebagai preview
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
       // Pisahkan entry manual (user) dari auto-ongkir lama
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

       // Deep compare untuk hindari infinite loop
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Keep historyRef in sync for the auto-date-update interval
  useEffect(() => { historyRef.current = history; }, [history]);

  // AUTO-CORRECT: Ketika history ter-load dari Firestore, cek apakah tanggal saat ini
  // sudah ada di history. Jika iya dan bukan sedang edit, pindah ke tanggal real & reset form.
  // Ini mengatasi race condition: business date → absen fetch → hasData=true → date stuck.
  const hasAutoCorrectRef = useRef(false);
  useEffect(() => {
    if (history.length === 0) return; // History belum loaded
    if (editingId) return; // Sedang edit item
    if (hasAutoCorrectRef.current) return; // Sudah pernah auto-correct di session ini

    const alreadySaved = history.some(h => h.tanggal === tanggal);
    if (alreadySaved) {
      hasAutoCorrectRef.current = true;
      
      // Pindah ke tanggal real
      const realNow = getWibDate();
      const realDateStr = `${realNow.getFullYear()}-${String(realNow.getMonth() + 1).padStart(2, "0")}-${String(realNow.getDate()).padStart(2, "0")}`;
      
      // Hanya koreksi jika tanggal saat ini masih menunjuk hari yang sudah disimpan
      if (tanggal !== realDateStr) {
        systemDateRef.current = realNow.getDate();
        setTanggal(realDateStr);
        const h = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(realNow);
        setHari(h.charAt(0).toUpperCase() + h.slice(1));
      }
      
      // Reset absen & form
      setAbsenPagi("");
      setAbsenSiang("");
      setShiftPegawai("");
      setRukoBuka("");
      setRukoTutup("");
      hasDataRef.current = false;
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

  // Object Data Lengkap (yang akan di-share)
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

  // Sinkronisasi status "Saved" saat ada aksi Save/Load
  useEffect(() => {
    if (isJustSavedOrLoaded.current) {
      setSavedSignature(currentFormSignature);
      isJustSavedOrLoaded.current = false;
    }
  }, [currentFormSignature]);

  const applyRemoteDraft = useCallback((data: any) => {
    // GUARD: Jika draft ini untuk tanggal yang sudah disimpan di history, abaikan
    // Ini mencegah data lama muncul kembali setelah auto-correct reset
    if (data.tanggal && historyRef.current.some(h => h.tanggal === data.tanggal)) {
      return; // Draft basi, abaikan
    }

    if (editingId) {
      if (data.tanggal !== undefined) setTanggal(data.tanggal);
      if (data.hari !== undefined) setHari(data.hari);
    }
    if (data.rukoBuka !== undefined) _setRukoBuka(data.rukoBuka ? data.rukoBuka.split(" - ")[0] : "");
    if (data.rukoTutup !== undefined) _setRukoTutup(data.rukoTutup ? data.rukoTutup.split(" - ")[0] : "");
    if (data.catatan !== undefined) setCatatan(data.catatan);
    
    // Function to strip old trailing empty rows down to the new min limit
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
    if (data.rowsJasaAks) setRowsJasaAks(cleanRows(data.rowsJasaAks, 5));
    if (data.rowsSewa) setRowsSewa(cleanRows(data.rowsSewa, 5));
    if (data.rowsSetoran) setRowsSetoran(cleanRows(data.rowsSetoran, 1));
    if (data.rowsPengeluaran) setRowsPengeluaran(cleanRows(data.rowsPengeluaran, 1));
  }, [editingId]);

  useFormDraft(currentFormSignature, applyRemoteDraft, activeTab, !!editingId);

  // --- COMPULSORY RENTAL VERIFICATION POP-UP ---
  const [unverifiedRentals, setUnverifiedRentals] = useState<any[]>([]);

  // --- EXTRACT UNVERIFIED RENTALS DATES (MEMOIZED) ---
  const unverifiedListMemo = useMemo(() => {
    if (!user || activeTab !== "USAHA RENTAL") return [];

    const unverified: any[] = [];
    const timeNowMs = Date.now();

    // 1. Cek dari rowsSewa (LIVE)
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

    // 2. Cek dari history
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

    // 3. Deduplicate
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

  // --- INTERVAL SUPER RINGAN (COMPULSORY RENTAL VERIFICATION) ---
  useEffect(() => {
    if (!user || activeTab !== "USAHA RENTAL") return;

    const checkInterval = setInterval(() => {
      const nowMs = Date.now();
      const needsNotify = unverifiedListMemo.filter(item => {
         if (nowMs >= item.endTimeMs) {
             const endDiff = (nowMs - item.endTimeMs) / (1000 * 3600 * 24);
             return endDiff <= 2.5; // only notify up to 2.5 days late
         }
         return false;
      });
      
      // Update state only if changed to avoid unnecessary renders
      setUnverifiedRentals(prev => {
         if (prev.length === needsNotify.length && prev.every((v,i) => v._rawRow._historyId === needsNotify[i]._rawRow._historyId && v._rawRow._sourceIdx === needsNotify[i]._rawRow._sourceIdx)) {
             return prev;
         }
         return needsNotify;
      });
    }, 15000);
    
    // Initial check
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

  const handleVerifyReturn = async (item: any) => {
      // Logic for checking payment status first
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

  // --- EFEK OTOMATIS: Tambah Catatan kalau belum bayar (Point 4) ---
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

  // --- VALIDATOR UTAMA ---
  const validateTransactions = () => {
    // 1. Validasi Pemasukan
    const allLists = [ ...rowsHarian, ...rowsJajanan, ...rowsJasaAks, ...rowsSewa ] as any[];
    for (const r of allLists) {
      const price = toNum(r.harga);
      if (price > 0 && !isCash(r.bayar) && !isTransfer(r.bayar)) return "payment_empty";
    }

    // 1.5 Validasi Ongkir & Jam Masuk (Khusus Sewa PS)
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

    // 2. Validasi Setoran
    for (const r of rowsSetoran) {
      const nominal = toNum(r.harga);
      if (nominal > 0) {
        if (!r.ket) return "setoran_ket_empty";
        if (!r.bayar) return "setoran_tf_empty"; // WAJIB DI TF ATAU BELUM
      }
    }

    // 3. Validasi Pengeluaran
    for (const r of rowsPengeluaran) {
      const nominal = toNum(r.harga);
      const hasInput = (r.ket && r.ket.trim() !== "") || nominal > 0;
      if (hasInput && (!r.ket || !r.bayar || nominal <= 0)) return "pengeluaran_invalid";
    }

    return "ok";
  };

  const handleShareCheck = () => {
    // 1. Cek Mandatory Fields
    if (!mandatoryFilled) {
      setShowDownloadAlert(true);
      return;
    }

    // 2. Cek Validasi Transaksi & Input Baru
    const valStatus = validateTransactions();
    if (valStatus !== "ok") {
        triggerValidationError(valStatus);
        return;
    }

    // 3. (Removed) — User boleh export PDF tanpa harus simpan dulu

    // 4. Lanjut Share - Lempar ke konfirmasi STOK
    setActiveTab("UPDATE STOK");
    setShowStokConfirmation(true);
  };

  // ===== CRUD ACTIONS =====
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
    
    const newItem = {
      id: uniqueId,
      tanggal, hari,
      absenPagi, absenSiang, shiftPegawai, rukoBuka, rukoTutup, catatan,
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
      // NEW ROWS
      rowsSetoran: JSON.parse(JSON.stringify(rowsSetoran)),
      rowsPengeluaran: JSON.parse(JSON.stringify(rowsPengeluaran)),
    };

    setDoc(doc(db, "history_pembukuan", newItem.id), newItem).catch(console.error);
    
    // APPLY DENDA TIDAK FULL ABSEN
    if (!editingId && shiftPegawai !== "Libur" && user?.email) {
      if (!absenPagi || !absenSiang || !shiftPegawai) {
        const dendaAmount = absenConfig?.dendaTidakAbsenPulang ?? 40000;
        if (dendaAmount > 0) {
          try {
             const docRef = doc(db, "gaji_pegawai", user.email);
             const docSnap = await getDoc(docRef);
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
             const d = new Date();
             const mm = String(d.getMonth() + 1).padStart(2, '0');
             const yy = String(d.getFullYear()).slice(-2);
             const currentBulanTahun = `${mm}/${yy}`;

             if (docSnap.exists()) {
                 const data = docSnap.data();
                 let records = Array.isArray(data.records) ? data.records : [];
                 
                 const alreadyInjected = records.some((r: any) => 
                     r.gajiPengurangan?.some((pg: any) => pg._idempKey === idempKey)
                 );
                 
                 if (!alreadyInjected) {
                     const monthIndex = records.findIndex((r: any) => r.bulanTahun === currentBulanTahun);
                     if (monthIndex >= 0) {
                         const currentMonth = records[monthIndex];
                         const gajiPengurangan = Array.isArray(currentMonth.gajiPengurangan) ? currentMonth.gajiPengurangan : [];
                         records[monthIndex] = { ...currentMonth, gajiPengurangan: [...gajiPengurangan, newDenda] };
                     } else {
                         records = [{ id: `rec-${Date.now()}`, bulanTahun: currentBulanTahun, gajiPokok: 0, gajiTambahan: [], gajiPengurangan: [newDenda] }, ...records];
                     }
                     await setDoc(docRef, { records, lastUpdated: new Date().toISOString() }, { merge: true });
                 }
             } else {
                 const newMonth = { id: `rec-${Date.now()}`, bulanTahun: currentBulanTahun, gajiPokok: 0, gajiTambahan: [], gajiPengurangan: [newDenda] };
                 await setDoc(docRef, { records: [newMonth], lastUpdated: new Date().toISOString() }, { merge: true });
             }
          } catch (err) {
             console.error("Gagal menerapkan denda bolos/lupa absen:", err);
          }
        }
      }
    }

    if (editingId) setEditingId(null);
    
    // RESET STATE — clear form fields
    setRukoBuka("");
    setRukoTutup("");
    setCatatan("");
    setRowsHarian(Array.from({ length: 5 }, () => ({ ...blankHarian })));
    setRowsJajanan(Array.from({ length: 5 }, () => ({ ...blankJajanan })));
    setRowsJasaAks(Array.from({ length: 5 }, () => ({ ...blankJasaAks })));
    setRowsSewa(Array.from({ length: 5 }, () => newBlankSewa()));
    setRowsSetoran([{ ket: "", harga: "", bayar: "" }]);
    setRowsPengeluaran([{ ket: "", harga: "", bayar: "" }]);

    // MARK AS SAVED
    setSavedSignature(currentFormSignature);
    isJustSavedOrLoaded.current = false; 
    
    // After save: always advance to REAL current date
    // Business day logic hanya berlaku saat mulai fresh (belum ada data).
    // Setelah simpan, hari kerja selesai → pindah ke tanggal kalender real.
    hasDataRef.current = false;
    
    // Mark old log_absensi as completed so it doesn't repopulate the form
    const q = query(collection(db, "log_absensi"), where("email", "==", user?.email), where("tanggal", "==", tanggal));
    getDocs(q).then((snapshot) => {
      snapshot.forEach((docSnap) => {
        updateDoc(docSnap.ref, { status: "completed" }).catch(console.error);
      });
    }).catch((e) => {
      console.error("Gagal update status log_absensi:", e);
    });
    const realNow = getWibDate();
    systemDateRef.current = realNow.getDate();
    const yyyy = realNow.getFullYear();
    const mm = String(realNow.getMonth() + 1).padStart(2, "0");
    const dd = String(realNow.getDate()).padStart(2, "0");
    setTanggal(`${yyyy}-${mm}-${dd}`);
    const nextHari = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(realNow);
    setHari(nextHari.charAt(0).toUpperCase() + nextHari.slice(1));

    // Reset absen & shift SETELAH tanggal berubah
    setAbsenPagi("");
    setAbsenSiang("");
    setShiftPegawai("");

    // Clear Firestore draft agar tidak di-rehydrate dengan data basi
    setDoc(doc(db, "data", "draft"), {}).catch(console.error);

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
    setDoc(doc(db, "history_pembukuan", editingId), {
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
    }, { merge: true }).catch(console.error);
    
    // MARK AS SAVED
    setSavedSignature(currentFormSignature);
    isJustSavedOrLoaded.current = false;

    setSuccessMessage("Perubahan berhasil disimpan! Mengembalikan form...");
    setShowSuccessAlert(true);
    
    // Abaikan setEditingId untuk mencegah form ter-push ke draft global server
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
    
    // Load Setoran & Pengeluaran if exist
    const setoranData = (item.rowsSetoran || [{ ket: "", harga: "", bayar: "" }]).map((r: any) => ({
       ket: r.ket || "",
       harga: r.harga ?? r.nominal ?? "",
       bayar: r.bayar ?? (r.isTransfer === "Ya" ? "Transfer" : r.isTransfer === "Belum" ? "" : r.jenis === "cash" ? "Cash" : r.jenis === "transfer" ? "Transfer" : "")
    }));
    setRowsSetoran(setoranData);

    const pengeluaranData = (item.rowsPengeluaran || [{ ket: "", harga: "", bayar: "" }]).map((r: any) => ({
       ket: r.ket || "",
       harga: r.harga ?? r.nominal ?? "",
       bayar: r.bayar ?? (r.jenis === "cash" ? "Cash" : r.jenis === "transfer" ? "Transfer" : ""),
       ...(r._autoOngkirKey ? { _autoOngkirKey: r._autoOngkirKey } : {})
    }));
    setRowsPengeluaran(pengeluaranData);

    // Trigger Sync Saved State setelah render update
    isJustSavedOrLoaded.current = true;
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteHistoryItem = (id: string) => {
    deleteDoc(doc(db, "history_pembukuan", id)).catch(console.error);
    if (id === editingId) {
      // Reload untuk memastikan state kembali murni ke draf server hari ini
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
      const interval = setInterval(checkAuto, 60000); // per minute
      return () => clearInterval(interval);
    }
  }, [themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    dark ? root.classList.add("dark") : root.classList.remove("dark");
  }, [dark]);

  // HYDRATION & FIREBASE REALTIME SYNC
  useEffect(() => {
    // 1. Sync Settings
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
           setOngkirConfig(data.ongkirConfig);
        }
        if (data.absenConfig) {
           setAbsenConfig(data.absenConfig);
        }
      } else {
        // Init default settings block
        setDoc(settingsRef, {
            settings: { 
                priceLists: { hargaHarian: DEFAULT_HARGA_HARIAN, hargaJajanan: DEFAULT_HARGA_JAJANAN, hargaJasaAks: DEFAULT_HARGA_JASA_AKS, hargaSewa: DEFAULT_HARGA_SEWA }
            },
            ongkirConfig: { pegawaiPersen: 70, masukGaji: true },
            absenConfig: { durasiWaktuPotongan: 15, waktuToleransi: 15, nominalDenda: 1500, dendaTidakAbsenPulang: 40000 }
        }, { merge: true });
        // Migrate old settings from LS if exists
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.settings) setDoc(settingsRef, parsed.settings, { merge: true });
            }
        } catch(e) {}
      }
    }, (err) => console.error(err));

    // 2. Removed duplicate history sync from here

    return () => { unsubSettings(); };
  }, []); // Only run once on mount for settings and new month alert

  // --- Dynamic History Listener Effect ---
  useEffect(() => {
    // 2. Sync History (Dynamic Query base on Filter)
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
       // Filter default (Bulan Ini / 7 Hari) + Safe Threshold (60 Hari untuk Unverified Rentals)
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
      // Sort descending string date
      items.sort((a,b) => b.tanggal.localeCompare(a.tanggal) || b.id.localeCompare(a.id));
      
      // Migrate old LS history if firestore is empty
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

  // SAVE SETTINGS TO FIREBASE
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
      
      // Auto-sync ke Firebase agar semua akun terupdate
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

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${dark ? 'bg-[#1C1C1E]' : 'bg-zinc-100'}`}>
         <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent flex items-center justify-center rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <PdfExporter 
        ref={pdfRef} rootRef={rootRef} dark={dark} 
        kualitasGambar={kualitasGambar} data={exportData}
        stokData={appStokData.stokState}
        masterCategories={appStokData.masterCategories}
        onStartExport={() => setIsExportingPDF(true)}
        onEndExport={() => setIsExportingPDF(false)}
      />
      
      <div 
         ref={rootRef} 
         className={`relative min-h-screen ${dark ? '' : 'bg-zinc-100'}`}
      >
        {/* Fixed background layer — Safari-compatible (no bg-fixed) */}
        {dark && (
          <div 
            className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: customBgDark ? `url(${customBgDark})` : "url('/images/bg_dark.jpg')" }}
            aria-hidden="true"
          />
        )}
        {dark && <div className="fixed inset-0 bg-black/70 pointer-events-none z-0" />}
        
        <div className="relative z-10 text-zinc-900 dark:text-zinc-100">
          <Header
              rootRef={rootRef} tanggal={tanggal} dark={dark}
              onToggleTheme={() => {
                const newMode = dark ? "light" : "dark";
                setThemeMode(newMode);
                if (user?.email) {
                  setDoc(doc(db, "users", user.email), { themeMode: newMode }, { merge: true }).catch(console.error);
                }
              }}
              onSharePDF={handleShareCheck}
              onOpenSettings={() => setOpenSettings(true)}
              hasData={hasData} mandatoryFilled={mandatoryFilled}
              isEditing={!!editingId}
              hasUnsavedChanges={currentFormSignature !== savedSignature}
              onSaveEdit={updatePencatatan} onAddData={addPencatatan} 
              onCancelEdit={() => window.location.reload()}
              userEmail={user?.email}
              userProfilePic={userProfilePic || undefined}
              activeUsers={activeUsers}
            />
          
          <main className="mx-auto max-w-6xl px-4 md:px-8 pb-24 space-y-6" style={{ paddingTop: 'calc(var(--app-header-height, 200px) + 16px)' }}>
            {/* TABS PENGATURAN HALAMAN */}
            <div className="flex w-full mb-8 bg-zinc-100/80 dark:bg-[#1C1C1E]/80 p-1 rounded-[14px] ring-1 ring-zinc-200/50 dark:ring-white/5 backdrop-blur-sm relative z-30 gap-1">
              {user?.email?.toLowerCase().trim() !== "owner@gmail.com" && (
                <button
                  onClick={() => setActiveTab("MONITORING")}
                  className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
                    activeTab === "MONITORING"
                      ? "bg-white dark:bg-[#2C2C2E] text-teal-600 dark:text-teal-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  style={activeTab === "MONITORING" && userProfileColor ? { color: userProfileColor } : undefined}
                >
                  MONITORING
                </button>
              )}
              {user?.email?.toLowerCase().trim() === "owner@gmail.com" && (
                <button
                  onClick={() => setActiveTab("PAGE OWNER")}
                  className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
                    activeTab === "PAGE OWNER"
                      ? "bg-white dark:bg-[#2C2C2E] text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                  style={activeTab === "PAGE OWNER" && userProfileColor ? { color: userProfileColor } : undefined}
                >
                  PAGE OWNER
                </button>
              )}
              <button
                onClick={() => setActiveTab("USAHA RENTAL")}
                className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
                  activeTab === "USAHA RENTAL"
                    ? "bg-white dark:bg-[#2C2C2E] text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={activeTab === "USAHA RENTAL" && userProfileColor ? { color: userProfileColor } : undefined}
              >
                USAHA RENTAL
              </button>
              <button
                onClick={() => setActiveTab("UPDATE STOK")}
                className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${
                  activeTab === "UPDATE STOK"
                    ? "bg-white dark:bg-[#2C2C2E] text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"
                }`}
                style={activeTab === "UPDATE STOK" && userProfileColor ? { color: userProfileColor } : undefined}
              >
                UPDATE STOK
              </button>
            </div>

            {activeTab === "PAGE OWNER" && user?.email?.toLowerCase().trim() === "owner@gmail.com" ? (
              <PageOwner
                totalHarian={totalHarian} totalJajanan={totalJajanan}
                totalJasaAks={totalJasaAks} totalSewa={totalSewa}
                totalCash={totalCash} 
                totalTransfer={totalTransfer}
                totalPengeluaran={totalPengeluaran}
                pendapatanBersih={(totalHarian + totalJajanan + totalJasaAks + totalSewa) - totalPengeluaran}
                history={history}
                rowsSewa={rowsSewa}
                activeDate={tanggal}
                onVerifyActiveRental={handleVerifyReturn}
                hargaItems={hargaSewa}
                filterMode={filter}
                setFilterMode={setFilter}
                filterMonth={filterMonth}
                setFilterMonth={setFilterMonth}
                rangeStart={rangeStart}
                setRangeStart={setRangeStart}
                rangeEnd={rangeEnd}
                setRangeEnd={setRangeEnd}
                filteredHistory={filteredHistory}
                isVerifyingPayment={!!paymentVerifyPrompt}
                stokState={appStokData.stokState}
              />
            ) : activeTab === "MONITORING" && user?.email?.toLowerCase().trim() !== "owner@gmail.com" ? (
              <WidgetMonitoringStatus 
                history={history || []} 
                rowsSewa={rowsSewa} 
                activeDate={tanggal} 
                onVerifyActiveRental={handleVerifyReturn} 
                isOwner={false} 
                hargaItems={hargaSewa}
                isVerifyingPayment={!!paymentVerifyPrompt}
              />
            ) : activeTab === "UPDATE STOK" ? (
              <UpdateStok
                adminName={user?.email}
                isOwner={user?.email?.toLowerCase().trim() === "owner@gmail.com"}
                stokState={appStokData.stokState}
                updateStok={appStokData.updateStok}
                masterCategories={appStokData.masterCategories}
                addStokItem={appStokData.addStokItem}
              />
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-both">
                <div id="section-input">
              <Input
                tanggal={tanggal} setTanggal={setTanggal} hari={hari} setHari={setHari}
                shiftPegawai={shiftPegawai} setShiftPegawai={setShiftPegawai}
                absenPagi={absenPagi} setAbsenPagi={setAbsenPagi} absenSiang={absenSiang} setAbsenSiang={setAbsenSiang}
                rukoBuka={rukoBuka} rukoTutup={rukoTutup}
                catatan={catatan} setCatatan={setCatatan}
                absenConfig={absenConfig}
                setRukoBuka={(v, d) => setRukoBuka(v, d)}
                rukoBukaDate={rukoBukaDate}
                setRukoTutup={(v, d) => setRukoTutup(v, d)}
                rukoTutupDate={rukoTutupDate}
                onResetRukoBuka={async () => {
                  setRukoBuka("");
                  _setRukoBukaDate("");
                  try {
                    await setDoc(doc(db, "data", "ruko_status"), { rukoBuka: "", rukoBukaDate: "", tanggal }, { merge: true });
                  } catch (e) {
                    console.error("Gagal reset rukoBuka:", e);
                  }
                }}
                onResetRukoTutup={async () => {
                  setRukoTutup("");
                  _setRukoTutupDate("");
                  try {
                    await setDoc(doc(db, "data", "ruko_status"), { rukoTutup: "", rukoTutupDate: "", tanggal }, { merge: true });
                  } catch (e) {
                    console.error("Gagal reset rukoTutup:", e);
                  }
                }}
                onResetAbsenPagi={async () => {
                  setAbsenPagi("");
                  try {
                    const userEmail = auth.currentUser?.email;
                    if (!userEmail) return;
                    const q = query(collection(db, "log_absensi"), where("tanggal", "==", tanggal), where("email", "==", userEmail), where("jenisAbsen", "==", "Masuk"));
                    const snapshot = await getDocs(q);
                    snapshot.forEach((docSnap) => deleteDoc(docSnap.ref).catch(console.error));
                  } catch (e) {
                    console.error("Gagal reset absen pagi", e);
                  }
                }}
                onResetAbsenSiang={async () => {
                  setAbsenSiang("");
                  try {
                    const userEmail = auth.currentUser?.email;
                    if (!userEmail) return;
                    const q = query(collection(db, "log_absensi"), where("tanggal", "==", tanggal), where("email", "==", userEmail), where("jenisAbsen", "==", "Pulang"));
                    const snapshot = await getDocs(q);
                    snapshot.forEach((docSnap) => deleteDoc(docSnap.ref).catch(console.error));
                  } catch (e) {
                    console.error("Gagal reset absen siang", e);
                  }
                }}
                onReset={async () => { 
                  setAbsenPagi(""); setAbsenSiang(""); setShiftPegawai(""); setRukoBuka(""); _setRukoBukaDate(""); setRukoTutup(""); _setRukoTutupDate(""); setCatatan(""); 
                  try {
                    const q = query(collection(db, "log_absensi"), where("tanggal", "==", tanggal));
                    const snapshot = await getDocs(q);
                    snapshot.forEach((docSnap) => {
                      deleteDoc(docSnap.ref).catch(console.error);
                    });
                  } catch (e) {
                    console.error("Gagal menghapus log_absensi:", e);
                  }
                }}
                isAbsenBlocked={(() => {
                  const wib = getWibDate();
                  const h = wib.getHours();
                  const m = wib.getMinutes();
                  const totalMin = h * 60 + m;
                  // Blokir 00:00 - 09:44 jika data hari sebelumnya sudah ada di history
                  if (totalMin >= 585) return false; // 09:45 = 585 menit → tidak diblokir
                  // Cek apakah kemarin sudah ada di history
                  const yesterday = new Date(wib);
                  yesterday.setDate(yesterday.getDate() - 1);
                  const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
                  return historyRef.current.some(h2 => h2.tanggal === yStr);
                })()}
              />
            </div>
            
            <div id="section-rincian" className="space-y-6">
              <ChallengeButton
                isAbsenDone={absenPagi !== "" || user?.email?.toLowerCase().trim() === "owner@gmail.com"}
                activeGameName={gameConfig ? (GAME_NAMES_ID[gameConfig.activeGame] || gameConfig.activeGame) : ""}
                onClick={() => setShowChallenge(true)}
              />
              <RincianHarian rows={rowsHarian} setRows={setRowsHarian} blank={{ ...blankHarian }} hargaItems={hargaHarian} isMobileTable={isMobileTable} />
              <RincianJajanan rows={rowsJajanan} setRows={setRowsJajanan} blank={{ ...blankJajanan }} hargaItems={hargaJajanan} isMobileTable={isMobileTable} />
              <RincianJasaAksesoris rows={rowsJasaAks} setRows={setRowsJasaAks} blank={{ ...blankJasaAks }} isMobileTable={isMobileTable} />
              <RincianSewa rows={rowsSewa} setRows={setRowsSewa} blank={newBlankSewa()} hargaItems={hargaSewa} userEmail={user?.email} isMobileTable={isMobileTable}  />
            </div>
            {/* SECTION TAMBAHAN BARU: DIBERI ID AGAR BISA DISCREENSHOT */}
            <div className="space-y-6">
              <div id="section-pengeluaran">
                 <RincianPengeluaran 
                    rows={rowsPengeluaran} setRows={setRowsPengeluaran} 
                    currentDate={tanggal} currentDay={hari}
                    isMobileTable={isMobileTable}
                    userEmail={user?.email}
                 />
              </div>
              <div id="section-setoran">
                 <RincianSetoran 
                    rows={rowsSetoran} setRows={setRowsSetoran} 
                    currentDate={tanggal} currentDay={hari}
                    isMobileTable={isMobileTable}
                 />
              </div>
            </div>
            
            <div id="section-rekap" className="pt-2">
              <RekapPemasukan
                totalHarian={totalHarian} totalJajanan={totalJajanan}
                totalJasaAks={totalJasaAks} totalSewa={totalSewa}
                totalCash={totalCash} 
                totalTransfer={totalTransfer}
                totalPengeluaran={totalPengeluaran}
                pendapatanBersih={(totalHarian + totalJajanan + totalJasaAks + totalSewa) - totalPengeluaran}
              />
            </div>
            
            {/* FILTER WIDGET (OWNER ONLY) */}
            {user?.email?.toLowerCase().trim() === "owner@gmail.com" && (
              <FilterComp
                mode={filter} setMode={setFilter} month={filterMonth} setMonth={setFilterMonth}
                rangeStart={rangeStart} setRangeStart={setRangeStart} rangeEnd={rangeEnd} setRangeEnd={setRangeEnd}
              />
            )}
            
            <div id="section-history" className="pt-2">
              <HistoryPembukuan
                items={filteredHistory}
                onClear={() => { if (history.length > 0 && confirm("Bersihkan SEMUA history pembukuan?")) setHistory([]); }}
                onEdit={editHistoryItem} onDelete={deleteHistoryItem}
                isOwner={user?.email === "owner@gmail.com"}
              />
            </div>
            
            {/* PASSING CURRENT DATE HERE */}
            <GeminiReportGenerator history={history} currentDate={tanggal} currentData={exportData} />
            
            <Reminder /> {/* TOMBOL REMINDER DISINI */}
              </div>
            )}
            <Footer />
          </main>
          
          <EditRincian
            isOpen={!!openEditRincian}
            title={getTitle(openEditRincian)}
            initialData={openEditRincian ? getPrices(openEditRincian) : []}
            onClose={() => setOpenEditRincian(null)}
            onSave={(items) => openEditRincian && handleSavePrices(openEditRincian, items)}
            onResetDefault={() => openEditRincian && handleResetSpecificDefault(openEditRincian)}
          />

          <input ref={restoreInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => onPickRestoreFile(e.target.files?.[0] ?? null)} />
          
          <Pengaturan
            open={openSettings} onClose={() => setOpenSettings(false)}
            hargaHarian={hargaHarian} hargaJajanan={hargaJajanan} hargaJasaAks={hargaJasaAks} hargaSewa={hargaSewa}
            ongkirConfig={ongkirConfig} setOngkirConfig={(cfg) => {
               setOngkirConfig(cfg);
               setDoc(doc(db, "data", "settings"), { ongkirConfig: cfg }, { merge: true }).catch(console.error);
            }}
            absenConfig={absenConfig} setAbsenConfig={(cfg) => {
               setAbsenConfig(cfg);
               setDoc(doc(db, "data", "settings"), { absenConfig: cfg }, { merge: true }).catch(console.error);
            }}
            themeMode={themeMode} onThemeChange={(mode) => {
               setThemeMode(mode as any);
               if (user?.email) setDoc(doc(db, "users", user.email), { themeMode: mode }, { merge: true }).catch(console.error);
            }}
            tableMode={tableMode} onTableModeChange={(mod) => {
               setTableMode(mod);
               if (user?.email) setDoc(doc(db, "users", user.email), { tableMode: mod }, { merge: true }).catch(console.error);
            }}
            kualitasGambar={kualitasGambar} onKualitasGambarChange={(val) => {
               setKualitasGambar(val);
               if (user?.email) setDoc(doc(db, "users", user.email), { kualitasGambar: val }, { merge: true }).catch(console.error);
            }}
            onBackupData={doBackup} onRestoreData={() => restoreInputRef.current?.click()} 
            onBackupDrive={handleBackupDrive} onRestoreDrive={handleRestoreDrive}
            onExportCSV={exportCSV} onResetSetting={resetSetting}
            onLogout={() => signOut(auth).catch(console.error)}
            onOpenEditHarian={() => setOpenEditRincian("harian")}
            onOpenEditJajanan={() => setOpenEditRincian("jajanan")}
            onOpenEditJasaAks={() => setOpenEditRincian("jasaAks")}
            onOpenEditSewa={() => setOpenEditRincian("sewa")}
            userEmail={user?.email}
            userProfilePic={userProfilePic || undefined}
            onProfilePicChange={handleProfilePicChange}
            customBgDark={customBgDark || undefined}
            onBgDarkChange={(url) => handleBgDarkChange(url)}
            userProfileColor={userProfileColor}
            onProfileColorChange={(color) => {
              setUserProfileColor(color);
              if (user?.email) setDoc(doc(db, "users", user.email), { profileColor: color }, { merge: true }).catch(console.error);
            }}
            history={history}
          />

          {/* === POPUPS: APPLE UI STYLE === */}
          {/* ALERT 1: UNSAVED */}
          {showUnsavedAlert && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setShowUnsavedAlert(false)} />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/><line x1="12" y1="17" x2="12" y2="17"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Data Belum Disimpan</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Anda memiliki perubahan yang belum disimpan. Mohon simpan data terlebih dahulu sebelum membagikan PDF.</p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setShowUnsavedAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Oke, Mengerti</button>
                </div>
              </div>
            </div>
          )}

          {/* RENTAL VERIFICATION POPUP (MANDATORY) */}
          {unverifiedRentals.length > 0 && !paymentVerifyPrompt && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px] pointer-events-auto" />
              <div className="relative w-full max-w-[320px] overflow-hidden rounded-[24px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-90 duration-300">
                <div className="p-6 text-center flex flex-col items-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 ring-4 ring-red-500/10">
                     <AlertCircle className="w-8 h-8 animate-pulse" />
                  </div>
                  <h3 className="text-[19px] font-black text-zinc-900 dark:text-white mb-2 leading-tight tracking-tight">Waktu Sewa Habis!</h3>
                  {unverifiedRentals.length > 0 && (() => {
                    const profileName = (user?.email || "").split("@")[0];
                    const capitalizedName = profileName ? profileName.charAt(0).toUpperCase() + profileName.slice(1) : "Admin";
                    const item = unverifiedRentals[0];
                    return (
                      <>
                        <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400 mb-4">
                          Unit <strong className="text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{item?.jenis}</strong> atas nama <strong className="text-blue-600 dark:text-blue-400">{item?.namaPenyewa}</strong> telah selesai durasi sewanya.
                        </p>
                        <p className="text-[16px] font-bold text-zinc-900 dark:text-white mb-4 leading-tight tracking-tight">Apakah sewa sudah habis atau belum, {capitalizedName}?</p>
                      </>
                    );
                  })()}
                </div>
                <div className="flex flex-col border-t border-gray-200/50 dark:border-white/10">
                  <button 
                    onClick={() => handleVerifyReturn(unverifiedRentals[0])} 
                    className="w-full py-4 text-[15px] shadow-inner font-black text-blue-600 dark:text-blue-500 bg-white/50 dark:bg-black/20 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors active:bg-blue-100 dark:active:bg-blue-500/20"
                  >
                    YA, SUDAH HABIS & KEMBALI
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECONDARY POPUP: KONFIRMASI PEMBAYARAN */}
          {paymentVerifyPrompt && (
            <div className="fixed inset-0 z-[501] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-[6px] pointer-events-auto" />
              <div className="relative w-full max-w-[320px] overflow-hidden rounded-[24px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-90 duration-300">
                <div className="p-6 text-center flex flex-col items-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 ring-4 ring-orange-500/10">
                     <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-[19px] font-black text-zinc-900 dark:text-white mb-2 leading-tight tracking-tight">Status Pembayaran?</h3>
                  <p className="text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400 mb-4">
                    Penyewa <strong className="text-blue-600 dark:text-blue-400">{paymentVerifyPrompt.namaPenyewa}</strong> sebelumnya ditandai <strong className="text-red-500">BELUM BAYAR</strong>. Apakah penyewa sudah bayar?
                  </p>
                </div>
                <div className="flex border-t border-gray-200/50 dark:border-white/10 divide-x divide-gray-200/50 dark:divide-white/10">
                  <button 
                    onClick={async () => {
                        await handleVerifyReturn({ ...paymentVerifyPrompt, _skipPaymentCheck: true });
                        
                        // DELETION LOGIC FOR TIDAK
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

                        // Remove from catatan
                        setCatatan(prev => {
                            if (!prev) return prev;
                            const escStr = paymentVerifyPrompt.jenis.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const regex = new RegExp(`${paymentVerifyPrompt.namaPenyewa}, belum bayar \\(.*?\\), sewa ${escStr}\\n?`, "gi");
                            return prev.replace(regex, "").trim();
                        });

                        const raw = paymentVerifyPrompt._rawRow || {};
                        setPaymentVerifyPrompt(null);
                        
                        // Redirect ke USAHA RENTAL
                        if (activeTab !== "USAHA RENTAL") setActiveTab("USAHA RENTAL");
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
                    }} 
                    className="flex-1 py-4 text-[14px] font-bold text-red-600 dark:text-red-400 bg-white/50 dark:bg-black/20 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    TIDAK
                  </button>
                  <button 
                    onClick={async () => {
                        await handleVerifyReturn({ ...paymentVerifyPrompt, _skipPaymentCheck: true });
                        
                        // DELETION LOGIC FOR YA
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

                        // Remove from catatan
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

                        // Redirect ke USAHA RENTAL
                        if (activeTab !== "USAHA RENTAL") setActiveTab("USAHA RENTAL");
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
                    }} 
                    className="flex-1 py-4 text-[14px] font-bold text-emerald-600 dark:text-emerald-500 bg-white/50 dark:bg-black/20 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                  >
                    YA
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* FLOATING STOK CONFIRMATION */}
          {showStokConfirmation && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[400] w-[90%] max-w-[400px] animate-in slide-in-from-bottom-10 fade-in duration-300">
              <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl rounded-[24px] p-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 flex flex-col items-center text-center gap-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                  <Package className="w-6 h-6" />
                </div>
                <p className="text-[15px] font-bold text-zinc-900 dark:text-white leading-snug">
                  TOLONG DI CEK LAGI STOK NYA,<br/>APAKAH UPDATE STOK SUDAH SESUAI?
                </p>
                <div className="flex gap-3 w-full mt-1">
                  <button
                    onClick={() => {
                      setShowStokConfirmation(false);
                      setShowRecheckAlert(true);
                    }}
                    className="flex-1 py-3 text-[14px] font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                  >
                    TIDAK
                  </button>
                  <button
                    onClick={() => {
                      setShowStokConfirmation(false);
                      setActiveTab("USAHA RENTAL"); // Kembalikan ke UI input utama
                      // Berikan waktu sejenak agar React selesai me-render ulang DOM sebelum di-screenshot html2canvas
                      setTimeout(() => {
                        pdfRef.current?.share();
                      }, 300);
                    }}
                    className="flex-1 py-3 text-[14px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md shadow-blue-500/20"
                  >
                    YA
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ALERT STOK: DI CEK LAGI (APPLE STYLE) */}
          {showRecheckAlert && (
            <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setShowRecheckAlert(false)} />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Silakan Di Cek Lagi</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Pastikan stok barang Anda sudah diperbarui dengan benar sebelum menghasilkan Laporan PDF.</p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setShowRecheckAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Baik</button>
                </div>
              </div>
            </div>
          )}

          {/* ALERT VALIDATION: APPLE UI STYLE */}
          {validationAlert && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setValidationAlert(null)} />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">{validationAlert.title}</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {validationAlert.message}
                  </p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setValidationAlert(null)} className="w-full py-3.5 text-[15px] font-semibold text-red-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Siap, Dicek</button>
                </div>
              </div>
            </div>
          )}

          {/* ALERT 3: SUKSES */}
          {showSuccessAlert && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setShowSuccessAlert(false)} />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Berhasil</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{successMessage}</p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setShowSuccessAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">Selesai</button>
                </div>
              </div>
            </div>
          )}

           {/* ALERT 4: NEW MONTH */}
           {showNewMonthAlert && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowNewMonthAlert(false)} />
              <div className="relative w-full max-w-[280px] overflow-hidden rounded-[18px] bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-5 text-center">
                  <h3 className="text-[17px] font-bold text-zinc-900 dark:text-white">Bulan Baru Dimulai</h3>
                  <p className="mt-2 text-[13px] leading-tight text-zinc-600 dark:text-zinc-400">Tampilan data <span className="font-semibold text-zinc-900 dark:text-zinc-100">Bulan Ini</span> telah di-reset secara otomatis.</p>
                </div>
                <div className="border-t border-zinc-300/50 dark:border-white/10">
                  <button onClick={() => setShowNewMonthAlert(false)} className="w-full py-3 text-[17px] font-semibold text-blue-500 active:bg-zinc-200 dark:active:bg-white/10 transition-colors">Siap, Gas!</button>
                </div>
              </div>
            </div>
          )}

          {/* ALERT 5: DATA INCOMPLETE */}
          {showDownloadAlert && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px]" onClick={() => setShowDownloadAlert(false)} />
              <div className="relative w-full max-w-[280px] overflow-hidden rounded-[20px] bg-white/80 dark:bg-[#1C1C1E]/85 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Data Belum Lengkap</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Absen Pagi, Siang, Ruko Buka & Tutup <span className="text-zinc-800 dark:text-zinc-200 font-medium">wajib diisi</span>.</p>
                </div>
                <div className="border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setShowDownloadAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-blue-500 active:bg-zinc-200 dark:active:bg-white/10">Mengerti</button>
                </div>
              </div>
            </div>
          )}

          {/* ALERT 7: ASISTEN (AUTO POPUP) */}
          {triggeredAssistants.length > 0 && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 font-sans">
              <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />
              <div className="relative w-full max-w-[320px] overflow-hidden rounded-[24px] bg-white dark:bg-[#1C1C1E] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400 mb-4 shadow-sm shadow-cyan-500/10">
                     <span className="text-3xl">🤖</span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">Halo Boss!</h3>
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Sesuai jadwal hari ini (Tgl {triggeredAssistants[0].tanggal}), izinkan saya mencatat pengeluaran berikut ke dalam sistem:
                  </p>
                  <div className="mt-4 p-3 bg-zinc-50 dark:bg-black/20 rounded-xl border border-zinc-100 dark:border-white/5 text-left">
                     <div className="text-xs font-bold text-zinc-500 mb-1">{triggeredAssistants[0].kategori}</div>
                     <div className="text-sm font-black text-zinc-900 dark:text-white">{triggeredAssistants[0].nama_pengeluaran}</div>
                     <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 mt-1">Rp {Number(triggeredAssistants[0].nominal || 0).toLocaleString("id-ID")}</div>
                  </div>
                </div>
                <div className="flex border-t border-zinc-200 dark:border-white/10 divide-x divide-zinc-200 dark:divide-white/10">
                  <button onClick={() => handleDismissAssistant(triggeredAssistants[0].id)} className="flex-1 py-4 text-sm font-semibold text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/5 active:bg-zinc-100 dark:active:bg-white/10 transition-colors">Tunda Dulu</button>
                  <button onClick={() => handleRunAssistant(triggeredAssistants[0])} className="flex-1 py-4 text-sm font-bold text-cyan-600 dark:text-cyan-500 hover:bg-zinc-50 dark:hover:bg-white/5 active:bg-zinc-100 dark:active:bg-white/10 transition-colors">Ok, Catat!</button>
                </div>
              </div>
            </div>
          )}


          {/* ALERT 6: DUPLICATE DATE */}
          {showDuplicateDateAlert && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
              <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px]" onClick={() => setShowDuplicateDateAlert(false)} />
              <div className="relative w-full max-w-[280px] overflow-hidden rounded-[20px] bg-white/80 dark:bg-[#1C1C1E]/85 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="15" y1="14" x2="9" y2="20"/><line x1="9" y1="14" x2="15" y2="20"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">Duplikasi Tanggal</h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Laporan untuk tanggal <span className="font-bold text-zinc-800 dark:text-zinc-200">{tanggal}</span> sudah ada.</p>
                </div>
                <div className="border-t border-gray-300/30 dark:border-white/10">
                  <button onClick={() => setShowDuplicateDateAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-red-500 active:bg-zinc-200 dark:active:bg-white/10">Tutup</button>
                </div>
              </div>
            </div>
          )}
          {/* CHALLENGE MODAL */}
          <Suspense fallback={null}>
            <ChallengeModal
              isOpen={showChallenge}
              onClose={() => setShowChallenge(false)}
            />
          </Suspense>
        </div>
      </div>
      <LiveCursors users={activeUsers} currentUserEmail={user?.email || ""} />
    </>
  );
}