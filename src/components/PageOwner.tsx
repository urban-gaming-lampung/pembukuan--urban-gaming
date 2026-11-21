import React, { useMemo, useState, useEffect } from "react";
import HistoryPembukuan from "./HistoryPembukuan";
import { AlertCircle, Activity, ChevronRight, ClipboardEdit, Terminal } from "lucide-react";
import { doc, setDoc, onSnapshot, query, collection, updateDoc, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { HistoryItem, RowSewa } from "../lib/types";
import { rupiah, formatDateShort, toInt } from "../lib/format";
import { Amount, Button, Card, ChartTip, EmptyState, Eyebrow, konfirmasi, MOTION, notify, Pill, Sheet, SubTabs } from "../ui";
import TabPegawai from "./TabPegawai";
import WidgetMonitoringStatus from "./WidgetMonitoringStatus";
import HalamanStok from "./HalamanStok";
import { adaPermintaanStok, EVENT_BUKA_STOK } from "../lib/stokRental";
import AnalitikUsaha from "./AnalitikUsaha";
import InputStokJualan from "./InputStokJualan";
import InputTransaksi from "./InputTransaksi";
import AnalitikKeseluruhan from "./AnalitikKeseluruhan";
import AnalitikRental, { type RekomendasiRental } from "./AnalitikRental";
import { bisnisOf, catatLogPembukuan, JenisTransaksi, pemasukanRental, pengeluaranAdminRental, periodRange, ringkasPembukuan, saringPeriode, useTransaksiOwner } from "../lib/keuangan";
import { kasUsahaHarian } from "../lib/pemasukanUsaha";
import { isPelunasanSewa, jenisUnit, ongkirBaris, tanpaUnitKeluar } from "../lib/sewa";
import { sinkronNotaKePembukuan } from "../lib/posPembukuan";
import WidgetMonitoringDevice from "./WidgetMonitoringDevice";
import { ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from "recharts";
import { toLocalYmd } from "../lib/dateLocal";

type PageOwnerProps = {
  totalHarian: number;
  totalJajanan: number;
  totalJasaAks: number;
  totalSewa: number;
  totalCash: number; // sudah dikurangi pengeluaran cash
  totalTransfer: number; // sudah dikurangi pengeluaran tf
  totalPengeluaran: number;
  pendapatanBersih?: number;
  history: HistoryItem[];
  rowsSewa: RowSewa[];
  activeDate?: string;
  onVerifyActiveRental?: (idx: number) => void;
  /** Catat pengingat WA penyewa (status unit) */
  onPengingatSewa?: (item: any) => void;
  // Filter Props
  filterMode: string;
  setFilterMode: (m: string) => void;
  filterMonth: number;
  setFilterMonth: (m: number) => void;
  rangeStart: string;
  setRangeStart: (val: string) => void;
  rangeEnd: string;
  setRangeEnd: (val: string) => void;
  filteredHistory: HistoryItem[];
  hargaItems?: any[];
  isVerifyingPayment?: boolean;
  /** Stok jajanan ikut pengaturan "Tampilkan Tabel › Pemasukan Jajanan" */
  tampilJajanan?: boolean;
};


const PageOwner: React.FC<PageOwnerProps> = ({
  totalHarian,
  totalJajanan,
  totalJasaAks,
  totalSewa,
  totalCash,
  totalTransfer,
  totalPengeluaran,
  pendapatanBersih = 0,
  history,
  rowsSewa,
  activeDate,
  onVerifyActiveRental,
  onPengingatSewa,
  filterMode, setFilterMode, filterMonth, setFilterMonth,
  rangeStart, setRangeStart, rangeEnd, setRangeEnd, filteredHistory,
  hargaItems,
  isVerifyingPayment = false,
  tampilJajanan = true,
}) => {

  const [activeTabOwner, setActiveTabOwner] = useState<"MONITORING" | "ANALITIK" | "INPUT PENGELUARAN" | "STOK" | "PEGAWAI">(() => (adaPermintaanStok() ? "STOK" : "MONITORING"));
  // Dibuka dari luar (mis. cek stok sebelum kirim laporan PDF)
  useEffect(() => {
    const buka = () => setActiveTabOwner("STOK");
    window.addEventListener(EVENT_BUKA_STOK, buka);
    return () => window.removeEventListener(EVENT_BUKA_STOK, buka);
  }, []);
  // Transaksi owner (pengeluaran & pemasukan) — satu sumber: lib/keuangan
  const ownerExpenses = useTransaksiOwner("PENGELUARAN", filterMode, filterMonth, rangeStart, rangeEnd);
  const ownerIncomes = useTransaksiOwner("PEMASUKAN", filterMode, filterMonth, rangeStart, rangeEnd);
  const [showAnalitikModal, setShowAnalitikModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [selectedIncomeCategory, setSelectedIncomeCategory] = useState<string | null>(null);

  // States for Analitik Sub-tabs and Logging
  const [analitikSubTab, setAnalitikSubTab] = useState<"KESELURUHAN" | "PEMBUKUAN" | "USAHA">("KESELURUHAN");
  const [inputSubTab, setInputSubTab] = useState<"TRANSAKSI" | "STOK">("TRANSAKSI");
  const [transaksiSubTab, setTransaksiSubTab] = useState<JenisTransaksi>("PENGELUARAN");
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [filterEmail, setFilterEmail] = useState<string>("Semua");
  const [filterAction, setFilterAction] = useState<string>("Semua");

  // States for Pegawai Sub-tabs and Requests
  const [pegawaiSubTab, setPegawaiSubTab] = useState<"DASHBOARD" | "REQUEST" | "LOGGING">("DASHBOARD");
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

  const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]);
  const [expandedDays, setExpandedDays] = useState<string[]>([]);
  const [expandedLogDetails, setExpandedLogDetails] = useState<string[]>([]);

  const toggleMonth = (m: string) => setExpandedMonths(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);
  const toggleWeek = (w: string) => setExpandedWeeks(p => p.includes(w) ? p.filter(x => x !== w) : [...p, w]);
  const toggleDay = (d: string) => setExpandedDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);
  const toggleLogDetails = (id: string) => setExpandedLogDetails(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  // Helpers for log date calculations
  const getWeekOfMonth = (date: Date) => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const startDayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const dateNum = date.getDate();
    return Math.ceil((dateNum + startDayOffset) / 7);
  };

  const getWeekRangeString = (year: number, monthIndex: number, weekNum: number) => {
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const startDayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    
    const startOffset = (weekNum - 1) * 7 - startDayOffset;
    const startDate = new Date(year, monthIndex, 1 + startOffset);
    const endDate = new Date(year, monthIndex, 1 + startOffset + 6);
    
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
    return `${startDate.getDate()} ${months[startDate.getMonth()]} - ${endDate.getDate()} ${months[endDate.getMonth()]}`;
  };


  const handleApproveRequest = async (req: any) => {
    if (!(await konfirmasi("Data pembukuan akan diganti dengan usulan pegawai.", { judul: `Setujui edit ${req.tanggal}?`, ya: "Setujui", bahaya: false }))) return;
    try {
      // 1. Update history_pembukuan
      await setDoc(doc(db, "history_pembukuan", req.historyId), req.proposedData, { merge: true });
      // Baris nota POS mengikuti data terbaru (bisa berubah sejak request dibuat)
      sinkronNotaKePembukuan(req.proposedData?.tanggal || req.tanggal).catch((e) => console.warn("Sinkron nota:", e));
      
      // 2. Update edit_request status
      await updateDoc(doc(db, "edit_requests", req.id), { status: "approved" });
      
      // 3. Log activity
      await catatLogPembukuan("UPDATE", req.tanggal, req.hari, req.proposedData);
      
      notify("Request edit disetujui", "positive");
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error approving request:", error);
      notify("Gagal menyetujui request", "negative");
    }
  };

  const handleRejectRequest = async (req: any) => {
    if (!(await konfirmasi("Data pembukuan tetap seperti sekarang.", { judul: `Tolak edit ${req.tanggal}?`, ya: "Tolak", bahaya: true }))) return;
    try {
      await updateDoc(doc(db, "edit_requests", req.id), { status: "rejected" });
      notify("Request edit ditolak", "info");
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error rejecting request:", error);
      notify("Gagal menolak request", "negative");
    }
  };

  useEffect(() => {
    if (activeTabOwner !== "PEGAWAI" || pegawaiSubTab !== "REQUEST") return;
    
    setLoadingRequests(true);
    const q = query(collection(db, "edit_requests"), orderBy("requestedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEditRequests(list);
      setLoadingRequests(false);
    }, (err) => {
      console.error("Error fetching edit requests:", err);
      setLoadingRequests(false);
    });
    return () => unsub();
  }, [activeTabOwner, pegawaiSubTab]);

  const formatDayLabel = (date: Date) => {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  useEffect(() => {
    if (activeTabOwner !== "PEGAWAI" || pegawaiSubTab !== "LOGGING") return;
    
    setLoadingLogs(true);
    const q = query(collection(db, "pembukuan_logs"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(list);
      setLoadingLogs(false);
    }, (err) => {
      console.error("Error fetching logs:", err);
      setLoadingLogs(false);
    });
    return () => unsub();
  }, [activeTabOwner, pegawaiSubTab]);

  const filteredOwnerExpenses = useMemo(() => saringPeriode(ownerExpenses, filterMode, filterMonth, rangeStart, rangeEnd), [filterMode, ownerExpenses, filterMonth, rangeStart, rangeEnd]);
  const filteredOwnerIncomes = useMemo(() => saringPeriode(ownerIncomes, filterMode, filterMonth, rangeStart, rangeEnd), [filterMode, ownerIncomes, filterMonth, rangeStart, rangeEnd]);
  // Pemisahan model usaha: Analitik Rental hanya menghitung pengeluaran RENTAL
  const pengeluaranOwnerRental = useMemo(() => filteredOwnerExpenses.filter((o) => bisnisOf(o) === "RENTAL"), [filteredOwnerExpenses]);
  const pengeluaranOwnerUsaha = useMemo(() => filteredOwnerExpenses.filter((o) => bisnisOf(o) === "USAHA"), [filteredOwnerExpenses]);
  const pemasukanOwnerUsaha = useMemo(() => filteredOwnerIncomes.filter((o) => bisnisOf(o) === "USAHA"), [filteredOwnerIncomes]);

  // --- Smart Auto-Categorization ---
  const detectCategory = (nama: string, fallback: string): string => {
    const n = nama.toLowerCase().trim();
    if (n.includes("ongkir") || n.includes("kirim") || n.includes("antar") || n.includes("grab") || n.includes("gojek")) return "Ongkir / Pengiriman";
    if (n.includes("gaji") || n.includes("pegawai") || n.includes("karyawan") || n.includes("upah") || n.includes("bonus")) return "Gaji Pegawai";
    if (n.includes("listrik") || n.includes("air") || n.includes("pdam") || n.includes("internet") || n.includes("wifi") || n.includes("wi-fi") || n.includes("token")) return "Listrik / Air / Internet";
    if (n.includes("servis") || n.includes("service") || n.includes("maintenance") || n.includes("maintainance") || n.includes("perbaik") || n.includes("benerin") || n.includes("rusak")) return "Maintenance / Servis";
    if (n.includes("belanja") || n.includes("modal") || n.includes("aset") || n.includes("beli") || n.includes("stik") || n.includes("stick") || n.includes("controller") || n.includes("kabel") || n.includes("hdmi")) return "Belanja Modal";
    if (n.includes("makan") || n.includes("minum") || n.includes("snack") || n.includes("jajan") || n.includes("kopi") || n.includes("nasi")) return "Konsumsi";
    if (n.includes("sewa") || n.includes("kontrakan") || n.includes("ruko")) return "Sewa Tempat";
    if (fallback && fallback !== "Umum Admin" && fallback !== "Lainnya") return fallback;
    return "Lainnya";
  };

  // Palet kategori memakai official iOS 27 System Colors
  const CATEGORY_COLORS: Record<string, string> = {
    "Ongkir / Pengiriman": "#FF8D28",
    "Gaji Pegawai": "#0088FF",
    "Listrik / Air / Internet": "#00C0E8",
    "Maintenance / Servis": "#FF383C",
    "Belanja Modal": "#CB30E0",
    "Konsumsi": "#FF2D55",
    "Sewa Tempat": "#00C8B3",
    "Lainnya": "#8E8E93",
  };
  const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || "#8E8E93";

  // Palet sumber pemasukan memakai official iOS 27 System Colors
  const INCOME_COLORS: Record<string, string> = {
    "Pemasukan Harian": "#0088FF",
    "Jajanan & Minuman": "#FF8D28",
    "Sewa PS": "#34C759",
    "Ongkir": "#00C0E8",
  };
  const getIncomeColor = (cat: string) => INCOME_COLORS[cat] || "#8E8E93";

  const { totalPemasukanBulanIni, totalPengeluaranBulanIni, combinedExpensesBulanIni } = useMemo(() => {
    let income = 0;
    let adminExpense = 0;
    const combinedList: { source: string, nama: string, harga: number, tanggal: string, kategori: string }[] = [];

    filteredHistory.forEach((h) => {
      const itemIncome = pemasukanRental(h);

      pengeluaranAdminRental(h).forEach((x) => {
        adminExpense += x.harga;
        combinedList.push({ source: "admin", ...x, kategori: detectCategory(x.nama === "Tanpa Ket" ? "" : x.nama, "Lainnya") });
      });

      // Ongkir sudah masuk ke rowsPengeluaran secara otomatis, sehingga akan dihitung sebagai Pengeluaran.
      // Pendapatan Kotor (itemIncome) tidak perlu dikurangi lagi agar tidak double-deduction.
      
      income += itemIncome;
    });

    let ownerExpense = 0;
    pengeluaranOwnerRental.forEach(o => {
        ownerExpense += o.harga;
        const smartKategori = detectCategory(o.nama, o.kategori);
        combinedList.push({ source: "owner", nama: o.nama, harga: o.harga, tanggal: o.tanggal, kategori: smartKategori });
    });

    combinedList.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    return { totalPemasukanBulanIni: income, totalPengeluaranBulanIni: adminExpense + ownerExpense, combinedExpensesBulanIni: combinedList };
  }, [filteredHistory, pengeluaranOwnerRental]);

  const labaBersih = totalPemasukanBulanIni - totalPengeluaranBulanIni;
  const keluarAdminRental = useMemo(() => combinedExpensesBulanIni.reduce((a, x) => a + (x.source === "admin" ? x.harga : 0), 0), [combinedExpensesBulanIni]);
  const keluarOwnerRental = totalPengeluaranBulanIni - keluarAdminRental;
  // Label periode filter untuk judul lembar rincian (bukan bulan kalender sekarang)
  const labelPeriode = useMemo(() => periodRange(filterMode, filterMonth, rangeStart, rangeEnd).label, [filterMode, filterMonth, rangeStart, rangeEnd]);

  // Hitung Total Cash & Transfer RENTAL dari filteredHistory untuk section Ringkasan
  // (kas harian dikurangi Rincian Pemasukan Usaha, yang dihitung di Analitik › Usaha)
  const { totalCashFiltered, totalTransferFiltered } = useMemo(() => {
    let cash = 0;
    let transfer = 0;
    filteredHistory.forEach((h) => {
      const usaha = kasUsahaHarian(h);
      cash += Math.max(0, toInt(h.totalCash) - usaha.cash);
      transfer += Math.max(0, toInt(h.totalTransfer) - usaha.transfer);
    });
    return { totalCashFiltered: cash, totalTransferFiltered: transfer };
  }, [filteredHistory]);

  const expenseChartData = useMemo(() => {
    const cats: Record<string, number> = {};
    combinedExpensesBulanIni.forEach(x => {
      cats[x.kategori] = (cats[x.kategori] || 0) + x.harga;
    });
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value, color: getCategoryColor(name) }))
      .sort((a, b) => b.value - a.value);
  }, [combinedExpensesBulanIni]);

  // Items filtered by selected category for drill-down
  const selectedCategoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return combinedExpensesBulanIni.filter(x => x.kategori === selectedCategory);
  }, [selectedCategory, combinedExpensesBulanIni]);

  // --- AUDIT LOGS DATA ---
  const adminEmails = useMemo(() => {
    const emails = new Set<string>();
    logs.forEach(l => { if (l.email) emails.add(l.email); });
    return Array.from(emails);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchEmail = filterEmail === "Semua" || log.email === filterEmail;
      const matchAction = filterAction === "Semua" || log.action === filterAction;
      return matchEmail && matchAction;
    });
  }, [logs, filterEmail, filterAction]);

  const groupedLogs = useMemo(() => {
    const monthsMap = new Map<string, {
      key: string;
      weeksMap: Map<string, {
        key: string;
        weekLabel: string;
        daysMap: Map<string, {
          key: string;
          dayLabel: string;
          logs: any[];
        }>;
      }>;
    }>();

    const indonesianMonths = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    filteredLogs.forEach((log) => {
      const date = new Date(log.timestamp);
      if (isNaN(date.getTime())) return;
      
      const year = date.getFullYear();
      const monthIdx = date.getMonth();
      const monthLabel = `${indonesianMonths[monthIdx]} ${year}`;
      
      const weekNum = getWeekOfMonth(date);
      const weekLabel = `Minggu ${weekNum} (${getWeekRangeString(year, monthIdx, weekNum)})`;
      const weekKey = `${monthLabel}-Week-${weekNum}`;
      
      const dayLabel = formatDayLabel(date);
      const dayKey = toLocalYmd(date); // YYYY-MM-DD
      
      if (!monthsMap.has(monthLabel)) {
        monthsMap.set(monthLabel, { key: monthLabel, weeksMap: new Map() });
      }
      const monthEntry = monthsMap.get(monthLabel)!;
      
      if (!monthEntry.weeksMap.has(weekKey)) {
        monthEntry.weeksMap.set(weekKey, { key: weekKey, weekLabel, daysMap: new Map() });
      }
      const weekEntry = monthEntry.weeksMap.get(weekKey)!;
      
      if (!weekEntry.daysMap.has(dayKey)) {
        weekEntry.daysMap.set(dayKey, { key: dayKey, dayLabel, logs: [] });
      }
      const dayEntry = weekEntry.daysMap.get(dayKey)!;
      
      dayEntry.logs.push(log);
    });
    
    const sortedMonths = Array.from(monthsMap.values()).map(month => {
      const sortedWeeks = Array.from(month.weeksMap.values()).map(week => {
        const sortedDays = Array.from(week.daysMap.values()).map(day => {
          const sortedLogsInDay = [...day.logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
          return { ...day, logs: sortedLogsInDay };
        }).sort((a, b) => b.key.localeCompare(a.key)); // Day desc
        return { ...week, days: sortedDays };
      }).sort((a, b) => b.key.localeCompare(a.key)); // Week desc
      return { ...month, weeks: sortedWeeks };
    }).sort((a, b) => {
      const parseMonthYear = (str: string) => {
        const parts = str.split(" ");
        const mIdx = indonesianMonths.indexOf(parts[0]);
        const y = parseInt(parts[1], 10);
        return new Date(y, mIdx, 1).getTime();
      };
      return parseMonthYear(b.key) - parseMonthYear(a.key);
    });
    
    return sortedMonths;
  }, [filteredLogs]);

  const formatLogTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " WIB";
    } catch (e) {
      return "";
    }
  };

  // --- INCOME DATA ---
  type IncomeEntry = { nama: string; harga: number; tanggal: string; hari: string; kategori: string; bayar: string };

  const combinedIncomeBulanIni = useMemo(() => {
    const list: IncomeEntry[] = [];
    // Satu baris pemasukan -> harga tanpa ongkir (kategorinya) + ongkir (kategori Ongkir).
    // Jumlah semua kategori = pendapatan kotor rental; bagian pengantar tercatat di pengeluaran.
    const tambah = (h: HistoryItem, r: any, nama: string, kategori: string, ongkirBaris: number) => {
      const harga = toInt(r.harga);
      const ongkir = Math.min(Math.max(0, ongkirBaris), Math.max(0, harga));
      const base = { tanggal: h.tanggal, hari: h.hari };
      if (ongkir > 0) list.push({ ...base, nama: `Ongkir ${nama}`, harga: ongkir, kategori: "Ongkir", bayar: r._bayarOngkir || r.bayar || "" });
      if (harga - ongkir > 0) list.push({ ...base, nama, harga: harga - ongkir, kategori, bayar: r.bayar || "" });
    };
    filteredHistory.forEach((h) => {
      (h.rowsHarian || []).forEach((r: any) => tambah(h, r, r.jenisPS || "PS Harian", "Pemasukan Harian", toInt(r._ongkir)));
      (h.rowsJajanan || []).forEach((r: any) => tambah(h, r, r.jenisJajanan || "Jajanan", "Jajanan & Minuman", 0));
      // Rincian Pemasukan Usaha (isi game, HEN, servis, aksesoris) = pemasukan USAHA -> Analitik › Usaha
      (h.rowsSewa || []).forEach((r: any) => tambah(h, r, `${r.jenisPS || "PS"} - ${r.ket || "Sewa"}`, "Sewa PS", ongkirBaris(r)));
    });
    list.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    return list;
  }, [filteredHistory]);

  const incomeChartData = useMemo(() => {
    const cats: Record<string, number> = {};
    combinedIncomeBulanIni.forEach(x => {
      cats[x.kategori] = (cats[x.kategori] || 0) + x.harga;
    });
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value, color: getIncomeColor(name) }))
      .sort((a, b) => b.value - a.value);
  }, [combinedIncomeBulanIni]);

  const selectedIncomeCategoryItems = useMemo(() => {
    if (!selectedIncomeCategory) return [];
    return combinedIncomeBulanIni.filter(x => x.kategori === selectedIncomeCategory);
  }, [selectedIncomeCategory, combinedIncomeBulanIni]);

  // Stok: lihat komponen HalamanStok (STOK RENTAL · STOK JUALAN)

  const [masterUnit, setMasterUnit] = useState({ ps3: 0, ps4: 0, ps5: 0, tv: 0, portabel: 0 });
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "master_unit"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMasterUnit({ ps3: data.ps3 || 0, ps4: data.ps4 || 0, ps5: data.ps5 || 0, tv: data.tv || 0, portabel: data.portabel || 0 });
      }
    });
    return () => unsub();
  }, []);

  // --- 1. TOP PERFORMING UNITS ---
  const topUnitsData = useMemo(() => {
    const counts = new Map<string, { revenue: number, count: number }>();
    const colors = ['#0088FF', '#FF8D28', '#34C759', '#CB30E0', '#FF2D55', '#6155F5'];
    const LABEL_KONSOL = { PS5: "PlayStation 5", PS4: "PlayStation 4", PS3: "PlayStation 3" } as const;

    filteredHistory.forEach(h => {
      [...(h.rowsHarian || []), ...(h.rowsSewa || [])].forEach((r: any) => {
         const type = String(r.jenisPS || "").trim();
         // Hanya ongkir / item tambahan / pelunasan bukan unit yang disewa
         if (!type || type.toUpperCase() === "UNDEFINED" || tanpaUnitKeluar(r)) return;
         const price = toInt(r.harga);
         if (!(price > 0 || r.isPaid === "TIDAK")) return;
         const unit = jenisUnit(type);
         const cleanType = unit.konsol ? LABEL_KONSOL[unit.konsol] : unit.tv ? "TV / Monitor" : unit.portabel ? "Console Portable" : type.toUpperCase();
         // Pendapatan unit tanpa ongkir; sewa belum dibayar memakai harga isi sendiri
         const actualPrice = price > 0 ? price - Math.min(price, ongkirBaris(r)) : toInt(r._customBase);
         if (actualPrice > 0) {
           const item = counts.get(cleanType) || { revenue: 0, count: 0 };
           item.revenue += actualPrice;
           item.count += 1;
           counts.set(cleanType, item);
         }
      });
    });

    return Array.from(counts.entries())
      .map(([unit, data], i) => ({ unit, revenue: data.revenue, count: data.count, fill: colors[i % colors.length] }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredHistory]);

  // --- 2. OCCUPANCY RATE ---
  // Perkiraan jam pakai = pendapatan unit (tanpa ongkir) ÷ tarif per jam rata-rata.
  const occupancyData = useMemo(() => {
    const TARIF_RATA: Record<string, number> = { PS5: 10000, PS4: 7000, PS3: 5000 };
    const uniqueDays = new Set<string>();
    let totalUsedHours = 0;

    filteredHistory.forEach(h => {
        uniqueDays.add(h.tanggal);
        const processRow = (r: any) => {
             if (isPelunasanSewa(r)) return;
             let price = toInt(r.harga);
             if (price === 0 && r.isPaid === "TIDAK") price = toInt(r._customBase);
             price = Math.max(0, price - toInt(r._ongkir));
             const konsol = jenisUnit(r.jenisPS).konsol;
             if (price > 0 && konsol) totalUsedHours += price / TARIF_RATA[konsol];
        };
        (h.rowsHarian || []).forEach(processRow);
        (h.rowsSewa || []).forEach(processRow);
    });

    const totalMachines = (masterUnit.ps3 || 0) + (masterUnit.ps4 || 0) + (masterUnit.ps5 || 0);
    const safeMachines = totalMachines > 0 ? totalMachines : 10;
    const daysCount = uniqueDays.size > 0 ? uniqueDays.size : 1;
    const maxCapacityHours = safeMachines * 14 * daysCount;
    
    const pct = Math.min(100, Math.round((totalUsedHours / maxCapacityHours) * 100));

    return { totalUsedHours: Math.round(totalUsedHours), maxCapacityHours, percentage: pct, totalMachines, unitDihitung: safeMachines, hariDihitung: daysCount };
  }, [filteredHistory, masterUnit]);

  // --- 3. PEAK HOURS (JAM SIBUK) ---
  const peakHoursData = useMemo(() => {
      const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, count: 0, revenue: 0 }));
      
      filteredHistory.forEach(h => {
        if (Array.isArray(h.rowsHarian)) {
            h.rowsHarian.forEach((r: any) => {
               const jm = String(r.jamMasuk || "");
               if (jm.includes(":")) {
                   const hh = parseInt(jm.split(":")[0]);
                   if (!isNaN(hh) && hh >= 0 && hh <= 23) {
                       hours[hh].count += 1;
                       hours[hh].revenue += toInt(r.harga);
                   }
               }
            });
        }
        if (Array.isArray(h.rowsSewa)) {
            h.rowsSewa.forEach((r: any) => {
               const jm = String(r.jamMasukSewa || "");
               if (jm.includes(":") && r.lamaSewa !== "PELUNASAN") {
                   const hh = parseInt(jm.split(":")[0]);
                   if (!isNaN(hh) && hh >= 0 && hh <= 23) {
                       hours[hh].count += 1;
                       hours[hh].revenue += toInt(r.harga);
                   }
               }
            });
        }
      });

      let minH = 24, maxH = -1;
      hours.forEach((hm, i) => { if (hm.count > 0) { minH = Math.min(minH, i); maxH = Math.max(maxH, i); } });
      if (minH === 24) return hours.slice(10, 22); 
      minH = Math.max(0, minH - 1);
      maxH = Math.min(23, maxH + 1);
      return hours.slice(minH, maxH + 1);
  }, [filteredHistory]);

  // ===== AI BUSINESS INSIGHTS ENGINE =====
  type InsightItem = RekomendasiRental & { actionLabel?: string };

  const aiInsights = useMemo((): InsightItem[] => {
    const insights: InsightItem[] = [];

    // ──── 1. FINANCIAL HEALTH ALERT ────
    const income = totalPemasukanBulanIni;
    const expense = totalPengeluaranBulanIni;
    const profit = labaBersih;

    if (income > 0 && expense > 0) {
      const expenseRatio = expense / income;

      if (expense > income) {
        // Deficit: find the biggest expense category
        const topExpCat = expenseChartData.length > 0 ? expenseChartData[0] : null;
        const topExpPct = topExpCat && expense > 0 ? ((topExpCat.value / expense) * 100).toFixed(0) : '0';
        const deficitAmt = expense - income;

        insights.push({
          id: 'fin_deficit',
          type: 'financial_health',
          severity: 'critical',
          title: 'Pengeluaran melebihi pendapatan',
          body: `Defisit sebesar ${rupiah(deficitAmt)}. Kategori pengeluaran terbesar adalah "${topExpCat?.name || '-'}" (${topExpPct}% dari total biaya). Evaluasi apakah ada pos biaya di kategori ini yang bisa ditekan, terutama Gaji Pegawai atau Belanja Modal yang mungkin bisa dijadwalkan ulang.`,
          metric: `\u2212${rupiah(deficitAmt)}`,
          actionLabel: 'Cek Breakdown Biaya'
        });
      } else if (expenseRatio > 0.7) {
        // Thin margin warning
        const marginPct = ((1 - expenseRatio) * 100).toFixed(1);
        insights.push({
          id: 'fin_thin_margin',
          type: 'financial_health',
          severity: 'warning',
          title: 'Margin laba tipis',
          body: `Margin laba bersih Anda hanya ${marginPct}%. Idealnya di atas 30% untuk bisnis rental. Perhatikan proporsi biaya operasional vs pendapatan kotor untuk menjaga kesehatan keuangan.`,
          metric: `margin ${marginPct.replace('.', ',')}%`,
        });
      } else {
        const marginPct = ((1 - expenseRatio) * 100).toFixed(1);
        insights.push({
          id: 'fin_healthy',
          type: 'financial_health',
          severity: 'success',
          title: 'Keuangan sehat',
          body: `Margin laba bersih ${marginPct}% — dalam kondisi sangat baik. Laba bersih mencapai ${rupiah(profit)}. Pertahankan efisiensi biaya operasional ini.`,
          metric: `margin ${marginPct.replace('.', ',')}%`,
        });
      }
    }

    // ──── 2. ASSET OPTIMIZATION ────
    const occPct = occupancyData.percentage;
    const totalMachines = occupancyData.totalMachines;

    if (totalMachines > 0) {
      if (occPct < 50) {
        // Very low utilization
        const leastUnit = topUnitsData.length > 1 ? topUnitsData[topUnitsData.length - 1] : null;
        insights.push({
          id: 'asset_very_low',
          type: 'asset_optimization',
          severity: 'critical',
          title: 'Pemakaian unit sangat rendah',
          body: `Hanya ${occPct}% kapasitas terpakai dari ${totalMachines} unit.${leastUnit ? ` Unit "${leastUnit.unit}" paling sedikit transaksi (${leastUnit.count}x). Pertimbangkan promosi khusus atau paket bundling untuk menarik penyewa.` : ' Tingkatkan pemasaran dan promosi harga sewa agar unit lebih sering terisi.'}`,
          metric: `${occPct}%`,
          actionLabel: 'Lihat Unit Terlaris'
        });
      } else if (occPct < 80) {
        const leastUnit = topUnitsData.length > 1 ? topUnitsData[topUnitsData.length - 1] : null;
        insights.push({
          id: 'asset_below_target',
          type: 'asset_optimization',
          severity: 'warning',
          title: 'Pemakaian unit di bawah target 80%',
          body: `Utilisasi saat ini ${occPct}%, masih di bawah benchmark 80%.${leastUnit ? ` Unit "${leastUnit.unit}" dengan pemasukan ${rupiah(leastUnit.revenue)} bisa ditingkatkan melalui promo jam sepi atau paket weekend.` : ' Fokus pada jam-jam yang belum terisi penuh.'}`,
          metric: `${occPct}%`,
        });
      } else {
        insights.push({
          id: 'asset_excellent',
          type: 'asset_optimization',
          severity: 'success',
          title: 'Pemakaian unit optimal',
          body: `Tingkat utilisasi ${occPct}% — sangat baik! Dengan ${totalMachines} unit aktif, mesin Anda bekerja secara produktif. Pertimbangkan untuk menambah unit jika utilisasi konsisten di atas 85%.`,
          metric: `${occPct}%`,
        });
      }
    }

    // ──── 3. PEAK HOUR STRATEGY ────
    if (peakHoursData.length > 0 && peakHoursData.some(d => d.count > 0)) {
      // Find the absolute peak hour(s)
      const maxCount = Math.max(...peakHoursData.map(d => d.count));
      const peakHours = peakHoursData.filter(d => d.count >= maxCount * 0.8 && d.count > 0);
      const offPeakHours = peakHoursData.filter(d => d.count > 0 && d.count < maxCount * 0.3);
      const totalTx = peakHoursData.reduce((s, d) => s + d.count, 0);
      const peakTx = peakHours.reduce((s, d) => s + d.count, 0);
      const peakRevenue = peakHours.reduce((s, d) => s + d.revenue, 0);
      const peakConcentration = totalTx > 0 ? ((peakTx / totalTx) * 100).toFixed(0) : '0';

      const peakRange = peakHours.length > 0
        ? `${peakHours[0].hour} - ${peakHours[peakHours.length - 1].hour}`
        : '-';

      if (parseInt(peakConcentration) > 60) {
        // Heavy concentration in peak hours
        insights.push({
          id: 'peak_concentrated',
          type: 'peak_strategy',
          severity: 'info',
          title: `Ramai terpusat di jam ${peakRange}`,
          body: `${peakConcentration}% dari seluruh transaksi terjadi di jam ${peakRange} dengan estimasi pendapatan ${rupiah(peakRevenue)}. Pastikan staf penuh di rentang jam tersebut.${offPeakHours.length > 0 ? ` Untuk jam sepi (${offPeakHours.map(h => h.hour).slice(0, 3).join(', ')}), pertimbangkan "Happy Hour" dengan diskon 10-20% untuk menarik pelanggan.` : ''}`,
          metric: `${peakConcentration}% di jam puncak`,
          actionLabel: 'Lihat Jam Sibuk'
        });
      } else if (peakHours.length > 0) {
        insights.push({
          id: 'peak_balanced',
          type: 'peak_strategy',
          severity: 'success',
          title: `Kunjungan merata sepanjang hari`,
          body: `Transaksi tersebar cukup merata sepanjang jam operasional. Jam puncak di ${peakRange} dengan ${peakTx} transaksi. Ini menandakan pelanggan datang sepanjang hari — strategi harga flat sudah tepat.`,
          metric: `${peakTx} transaksi puncak`,
        });
      }
    }

    return insights;
  }, [totalPemasukanBulanIni, totalPengeluaranBulanIni, labaBersih, expenseChartData, occupancyData, topUnitsData, peakHoursData]);

  const renderRincianSheet = ({
    open,
    onClose,
    title,
    allLabel,
    emptyLabel,
    isExpense,
    totalAmount,
    chartData,
    items,
    selectedCat,
    setSelectedCat,
    selectedCatItems,
    getColor,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
    allLabel: string;
    emptyLabel: string;
    isExpense: boolean;
    totalAmount: number;
    chartData: { name: string; value: number; color: string }[];
    items: any[];
    selectedCat: string | null;
    setSelectedCat: React.Dispatch<React.SetStateAction<string | null>>;
    selectedCatItems: any[];
    getColor: (cat: string) => string;
  }) => {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        size="xl"
        variant="surface"
        zClassName="z-[600]"
        title={title}
        subtitle={`${labelPeriode} · ${items.length} transaksi`}
      >
        <div className="space-y-4">
          {/* Chart + Categories */}
          <div className="flex flex-col items-start gap-6 md:flex-row">
            {/* Donut Chart */}
            <div className="flex w-full shrink-0 flex-col items-center md:w-[250px]">
              <div className="relative mx-auto h-[230px] w-[230px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        style={{ cursor: "pointer", outline: "none" }}
                        onClick={(_: any, idx: number) => {
                          const cat = chartData[idx]?.name;
                          setSelectedCat((prev) => (prev === cat ? null : cat));
                        }}
                      >
                        {chartData.map((e, i) => (
                          <Cell
                            key={`c-${i}`}
                            fill={e.color}
                            opacity={selectedCat ? (selectedCat === e.name ? 1 : 0.25) : 1}
                            style={{ transition: "opacity 0.3s ease", cursor: "pointer" }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }: any) =>
                          active && payload?.length ? (
                            <ChartTip
                              title={payload[0].name}
                              rows={[{
                                color: payload[0].payload?.color,
                                label: "Nominal",
                                value: rupiah(Number(payload[0].value || 0)),
                              }]}
                            />
                          ) : null
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-footnote text-label-3">
                    Belum ada data
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="flex flex-col items-center rounded-tile bg-surface/90 px-3 py-1.5 ring-1 ring-edge backdrop-blur-md">
                    <Eyebrow>Total</Eyebrow>
                    <span className={`text-subhead font-bold tabular-nums ${isExpense ? "text-negative" : "text-positive"}`}>
                      {rupiah(totalAmount)}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-caption text-label-3">Ketuk segmen untuk filter</p>
            </div>

            {/* Category Cards */}
            <div className="w-full flex-1">
              <div className={`grid grid-cols-2 gap-2 ${isExpense ? "sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-4"}`}>
                {chartData.map((cat) => {
                  const isActive = selectedCat === cat.name;
                  const pct = totalAmount > 0 ? ((cat.value / totalAmount) * 100).toFixed(1) : "0";
                  const count = items.filter((x) => x.kategori === cat.name).length;
                  return (
                    <button
                      type="button"
                      key={cat.name}
                      onClick={() => setSelectedCat((prev) => (prev === cat.name ? null : cat.name))}
                      className={`relative overflow-hidden rounded-tile p-3 text-left transition active:scale-[0.97] ${
                        isActive
                          ? "bg-tint/10 ring-2 ring-tint"
                          : "apple-tile apple-tile-interactive ring-1 ring-edge"
                      }`}
                    >
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="truncate text-caption font-medium text-label-2">{cat.name}</span>
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <span className="text-subhead font-bold tabular-nums text-label">{rupiah(cat.value)}</span>
                        <div className="flex flex-col items-end text-caption2 tabular-nums">
                          <span className="font-semibold text-label-2">{pct}%</span>
                          <span className="text-label-3">{count}x</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section Divider */}
          <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-sep" />
            <Eyebrow>{selectedCat || allLabel}</Eyebrow>
            <div className="h-px flex-1 bg-sep" />
          </div>

          {/* Detail / Full List */}
          <div>
            {selectedCat ? (
              <div className={MOTION.panel}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-tile ring-1 ring-edge"
                      style={{ backgroundColor: `${getColor(selectedCat)}18` }}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: getColor(selectedCat) }} />
                    </span>
                    <div>
                      <h4 className="text-callout font-bold leading-tight text-label">{selectedCat}</h4>
                      <p className="text-caption text-label-3">{selectedCatItems.length} transaksi</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-headline font-bold tabular-nums ${isExpense ? "text-negative" : "text-positive"}`}>
                      {rupiah(selectedCatItems.reduce((s, x) => s + x.harga, 0))}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedCat(null)}
                      className="mt-0.5 block w-full text-right text-caption font-semibold text-tint transition-opacity active:opacity-75"
                    >
                      ← Semua
                    </button>
                  </div>
                </div>
                <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
                  {selectedCatItems.map((o, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 rounded-tile apple-tile px-3.5 py-2.5 ring-1 ring-edge">
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-caption text-label-3">{formatDateShort(o.tanggal)}</span>
                          {isExpense ? (
                            <Pill tone={o.source === "owner" ? "tint" : undefined}>
                              {o.source === "owner" ? "Owner" : "Admin"}
                            </Pill>
                          ) : (
                            <>
                              <span className="text-caption capitalize text-label-3">{o.hari}</span>
                              {o.bayar && (
                                <Pill tone={o.bayar.toLowerCase().includes("cash") ? "positive" : "tint"}>
                                  {o.bayar}
                                </Pill>
                              )}
                            </>
                          )}
                        </div>
                        <span className="truncate text-subhead font-medium text-label">{o.nama}</span>
                      </div>
                      <span className={`shrink-0 text-subhead font-semibold tabular-nums ${isExpense ? "text-negative" : "text-positive"}`}>
                        {isExpense ? "-" : "+"}{rupiah(o.harga)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex max-h-[320px] flex-col gap-1.5 overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
                {items.length === 0 && (
                  <p className="py-8 text-center text-subhead text-label-3">{emptyLabel}</p>
                )}
                {items.map((o, idx) => {
                  const catColor = getColor(o.kategori);
                  return (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => setSelectedCat(o.kategori)}
                      className="flex w-full items-center justify-between gap-3 rounded-tile apple-tile apple-tile-interactive px-3.5 py-2.5 text-left ring-1 ring-edge"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: catColor }} />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-caption text-label-3">{formatDateShort(o.tanggal)}</span>
                            {isExpense ? (
                              <Pill tone={o.source === "owner" ? "tint" : undefined}>
                                {o.source === "owner" ? "Owner" : "Admin"}
                              </Pill>
                            ) : (
                              <span className="text-caption capitalize text-label-3">{o.hari}</span>
                            )}
                          </div>
                          <span className="truncate text-subhead font-medium text-label">{o.nama}</span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                            <span className="text-caption text-label-2">{o.kategori}</span>
                            {!isExpense && o.bayar && (
                              <span className={`text-caption font-semibold ${o.bayar.toLowerCase().includes("cash") ? "text-positive" : "text-tint"}`}>
                                · {o.bayar}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`shrink-0 text-subhead font-semibold tabular-nums ${isExpense ? "text-negative" : "text-positive"}`}>
                        {isExpense ? "-" : "+"}{rupiah(o.harga)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Sheet>
    );
  };

  return (
    <div className={`space-y-4 sm:space-y-6 ${MOTION.panel}`}>
      {/* Menu utama pemilik — SubTabs (SSOT) */}
      <SubTabs
        ariaLabel="Menu utama pemilik"
        value={activeTabOwner}
        onChange={setActiveTabOwner}
        options={[
          { key: "MONITORING", label: "Unit" },
          { key: "INPUT PENGELUARAN", label: "Input" },
          { key: "ANALITIK", label: "Analitik" },
          { key: "PEGAWAI", label: "Pegawai" },
          { key: "STOK", label: "Stok" },
        ]}
      />

      {activeTabOwner === "INPUT PENGELUARAN" && (
        <div className="space-y-4">
          <SubTabs
            ariaLabel="Halaman input"
            value={inputSubTab}
            onChange={setInputSubTab}
            options={[{ key: "TRANSAKSI", label: "Transaksi" }, { key: "STOK", label: "Atur Stok" }]}
          />
          {inputSubTab === "TRANSAKSI" ? (
            <InputTransaksi
              jenis={transaksiSubTab}
              onJenisChange={setTransaksiSubTab}
              items={transaksiSubTab === "PENGELUARAN" ? ownerExpenses : ownerIncomes}
            />
          ) : (
            <InputStokJualan />
          )}
        </div>
      )}

      {activeTabOwner === "MONITORING" && (
        <UnitStatusWidget rowsSewa={rowsSewa} history={history} activeDate={activeDate} onVerifyActiveRental={onVerifyActiveRental} onPengingat={onPengingatSewa} hargaItems={hargaItems} isVerifyingPayment={isVerifyingPayment} />
      )}

      {activeTabOwner === "ANALITIK" && (
        <div className="space-y-4">
          <SubTabs
            ariaLabel="Halaman analitik"
            value={analitikSubTab}
            onChange={setAnalitikSubTab}
            options={[
              { key: "KESELURUHAN", label: "Keseluruhan" },
              { key: "PEMBUKUAN", label: "Rental" },
              { key: "USAHA", label: "Usaha" },
            ]}
          />

          {analitikSubTab === "KESELURUHAN" ? (
            <AnalitikKeseluruhan
              mode={filterMode} setMode={setFilterMode} month={filterMonth} setMonth={setFilterMonth}
              rangeStart={rangeStart} setRangeStart={setRangeStart} rangeEnd={rangeEnd} setRangeEnd={setRangeEnd}
              filteredHistory={filteredHistory}
              pengeluaran={filteredOwnerExpenses}
              pemasukan={filteredOwnerIncomes}
            />
          ) : analitikSubTab === "USAHA" ? (
            <AnalitikUsaha
              mode={filterMode} setMode={setFilterMode} month={filterMonth} setMonth={setFilterMonth}
              rangeStart={rangeStart} setRangeStart={setRangeStart} rangeEnd={rangeEnd} setRangeEnd={setRangeEnd}
              pengeluaran={pengeluaranOwnerUsaha}
              pemasukan={pemasukanOwnerUsaha}
            />
          ) : (
            <>
              <AnalitikRental
                mode={filterMode} setMode={setFilterMode} month={filterMonth} setMonth={setFilterMonth}
                rangeStart={rangeStart} setRangeStart={setRangeStart} rangeEnd={rangeEnd} setRangeEnd={setRangeEnd}
                filteredHistory={filteredHistory}
                masuk={totalPemasukanBulanIni}
                keluar={totalPengeluaranBulanIni}
                keluarAdmin={keluarAdminRental}
                keluarOwner={keluarOwnerRental}
                pemasukanKategori={incomeChartData}
                pengeluaranKategori={expenseChartData}
                tunai={totalCashFiltered}
                transfer={totalTransferFiltered}
                utilisasi={occupancyData}
                unitLaris={topUnitsData}
                jamRamai={peakHoursData}
                rekomendasi={aiInsights}
                onBukaPemasukan={(k) => { setSelectedIncomeCategory(k || null); setShowIncomeModal(true); }}
                onBukaPengeluaran={(k) => { setSelectedCategory(k || null); setShowAnalitikModal(true); }}
              />

              {/* HISTORY PEMBUKUAN */}
              <HistoryPembukuan items={filteredHistory} isOwner={true} />
            </>
          )}
        </div>
      )}

      {activeTabOwner === "PEGAWAI" && (
        <div className="space-y-4 sm:space-y-6">
          <SubTabs
            ariaLabel="Halaman pegawai"
            value={pegawaiSubTab}
            onChange={setPegawaiSubTab}
            options={[
              { key: "DASHBOARD", label: "Dashboard" },
              { key: "REQUEST", label: "Request" },
              { key: "LOGGING", label: "Log" },
            ]}
          />

          {pegawaiSubTab === "DASHBOARD" ? (
            <div className="animate-in fade-in duration-200">
              <TabPegawai history={history} isOwner={true} />
            </div>
          ) : pegawaiSubTab === "LOGGING" ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card title="Log aktivitas pegawai" icon={<Terminal />} iconColor="gray">
                {/* Filter Controls */}
                <div className="mb-4 grid grid-cols-1 gap-3 border-b border-sep pb-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Filter operator</label>
                    <select
                      value={filterEmail}
                      onChange={(e) => setFilterEmail(e.target.value)}
                      className="min-h-[44px] w-full rounded-control bg-surface-2 px-3 py-2 text-[16px] sm:text-callout font-medium text-label ring-1 ring-edge outline-none focus:ring-2 focus:ring-tint"
                    >
                      <option value="Semua">Semua operator (Admin/Owner)</option>
                      {adminEmails.map(email => (
                        <option key={email} value={email}>{email}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Filter aksi</label>
                    <select
                      value={filterAction}
                      onChange={(e) => setFilterAction(e.target.value)}
                      className="min-h-[44px] w-full rounded-control bg-surface-2 px-3 py-2 text-[16px] sm:text-callout font-medium text-label ring-1 ring-edge outline-none focus:ring-2 focus:ring-tint"
                    >
                      <option value="Semua">Semua aktivitas</option>
                      <option value="CREATE">CREATE / Tambah</option>
                      <option value="UPDATE">UPDATE / Edit</option>
                      <option value="DELETE">DELETE / Hapus</option>
                    </select>
                  </div>
                </div>

                {/* Log Output */}
                {loadingLogs ? (
                  <div className="py-10 text-center text-subhead text-label-2">
                    Memuat log aktivitas…
                  </div>
                ) : groupedLogs.length === 0 ? (
                  <EmptyState icon={<Terminal />} title="Belum ada log aktivitas">
                    Tidak ada aktivitas yang cocok dengan filter yang dipilih.
                  </EmptyState>
                ) : (
                  <div className="space-y-3">
                    {groupedLogs.map(monthGroup => {
                      const isMonthExpanded = expandedMonths.includes(monthGroup.key);
                      return (
                        <div key={monthGroup.key} className="overflow-hidden rounded-tile apple-tile ring-1 ring-edge">
                          <button
                            type="button"
                            onClick={() => toggleMonth(monthGroup.key)}
                            aria-expanded={isMonthExpanded}
                            className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-fill/40"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronRight className={`h-4 w-4 text-label-3 transition-transform duration-200 ${isMonthExpanded ? "rotate-90" : ""}`} />
                              <span className="text-subhead font-semibold text-label">{monthGroup.key}</span>
                            </div>
                            <Pill>{monthGroup.weeks.length} minggu</Pill>
                          </button>

                          {isMonthExpanded && (
                            <div className="space-y-2.5 border-t border-sep bg-surface/60 p-3">
                              {monthGroup.weeks.map(weekGroup => {
                                const isWeekExpanded = expandedWeeks.includes(weekGroup.key);
                                return (
                                  <div key={weekGroup.key} className="overflow-hidden rounded-control bg-surface ring-1 ring-edge">
                                    <button
                                      type="button"
                                      onClick={() => toggleWeek(weekGroup.key)}
                                      aria-expanded={isWeekExpanded}
                                      className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-fill/40"
                                    >
                                      <div className="flex items-center gap-2">
                                        <ChevronRight className={`h-3.5 w-3.5 text-label-3 transition-transform duration-200 ${isWeekExpanded ? "rotate-90" : ""}`} />
                                        <span className="text-footnote font-semibold text-tint">{weekGroup.weekLabel}</span>
                                      </div>
                                      <Pill>{weekGroup.days.length} hari</Pill>
                                    </button>

                                    {isWeekExpanded && (
                                      <div className="space-y-2 border-t border-sep bg-surface-2 p-2.5">
                                        {weekGroup.days.map(dayGroup => {
                                          const isDayExpanded = expandedDays.includes(dayGroup.key);
                                          return (
                                            <div key={dayGroup.key} className="overflow-hidden rounded-control bg-surface ring-1 ring-edge">
                                              <button
                                                type="button"
                                                onClick={() => toggleDay(dayGroup.key)}
                                                aria-expanded={isDayExpanded}
                                                className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-fill/40"
                                              >
                                                <div className="flex items-center gap-2">
                                                  <ChevronRight className={`h-3.5 w-3.5 text-label-3 transition-transform duration-200 ${isDayExpanded ? "rotate-90" : ""}`} />
                                                  <span className="text-footnote font-semibold text-label">{dayGroup.dayLabel}</span>
                                                </div>
                                                <Pill>{dayGroup.logs.length} log</Pill>
                                              </button>

                                              {isDayExpanded && (
                                                <div className="space-y-2 border-t border-sep bg-surface-2 p-2.5">
                                                  {dayGroup.logs.map(log => {
                                                    const isDetailsExpanded = expandedLogDetails.includes(log.id);
                                                    const actionTone = log.action === "UPDATE" ? "warning" : log.action === "DELETE" ? "negative" : "positive";
                                                    const actionLabel = log.action === "UPDATE" ? "Edit" : log.action === "DELETE" ? "Hapus" : "Tambah";

                                                    return (
                                                      <div key={log.id} className="rounded-control bg-surface p-3 ring-1 ring-edge">
                                                        <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center">
                                                          <div className="flex flex-wrap items-center gap-2 text-footnote">
                                                            <span className="font-mono text-caption text-label-3">{formatLogTime(log.timestamp)}</span>
                                                            <Pill tone={actionTone}>{actionLabel}</Pill>
                                                            <span className="font-semibold text-tint">{log.email}</span>
                                                            <span className="text-label-2">mengubah pembukuan</span>
                                                            <span className="font-medium text-label">{log.targetDay}, {log.targetDate}</span>
                                                          </div>
                                                          <Button
                                                            type="button"
                                                            variant="gray"
                                                            size="sm"
                                                            onClick={() => toggleLogDetails(log.id)}
                                                            className="self-start sm:self-auto"
                                                          >
                                                            {isDetailsExpanded ? "Tutup detail" : "Lihat detail"}
                                                          </Button>
                                                        </div>

                                                        {isDetailsExpanded && (
                                                          <div className="mt-3 max-w-sm space-y-1.5 rounded-control bg-surface-2 p-3 text-footnote ring-1 ring-edge animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <div className="flex items-center justify-between gap-4">
                                                              <span className="text-label-2">Total pendapatan</span>
                                                              <Amount value={log.details?.totalIncome || 0} className="font-semibold text-label" />
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4">
                                                              <span className="text-label-2">Cash</span>
                                                              <Amount value={log.details?.totalCash || 0} className="font-semibold text-label" />
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4">
                                                              <span className="text-label-2">Transfer</span>
                                                              <Amount value={log.details?.totalTransfer || 0} className="font-semibold text-label" />
                                                            </div>
                                                            <div className="flex items-center justify-between gap-4 border-t border-sep pt-1.5">
                                                              <span className="text-label-2">Pengeluaran</span>
                                                              <Amount value={log.details?.totalPengeluaran || 0} className="font-semibold text-negative" />
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
              </Card>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-200">
              <Card title="Permintaan edit pembukuan karyawan" icon={<ClipboardEdit />} iconColor="orange">
                {loadingRequests ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-sep border-t-tint" />
                  </div>
                ) : editRequests.length === 0 ? (
                  <EmptyState icon={<AlertCircle />} title="Tidak ada permintaan edit">
                    Belum ada request edit pembukuan dari pegawai.
                  </EmptyState>
                ) : (
                  <div className="grid gap-4">
                    {editRequests.map((req) => {
                      const isPending = req.status === "pending";
                      const isApproved = req.status === "approved";
                      const orig = ringkasPembukuan(req.originalData);
                      const prop = ringkasPembukuan(req.proposedData);
                      const summaryMetrics = [
                        { label: "Pendapatan kotor", o: orig.income, p: prop.income },
                        { label: "Total cash", o: orig.cash, p: prop.cash },
                        { label: "Total transfer", o: orig.transfer, p: prop.transfer },
                        { label: "Pengeluaran", o: orig.expense, p: prop.expense },
                      ];

                      return (
                        <div key={req.id} className="space-y-3 rounded-tile apple-tile p-4 ring-1 ring-edge">
                          <div className="flex flex-col justify-between gap-2.5 border-b border-sep pb-3 sm:flex-row sm:items-center">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-subhead font-bold text-label">{req.requestedBy}</span>
                                <Pill tone={isPending ? "warning" : isApproved ? "positive" : "negative"}>
                                  {isPending ? "Menunggu" : isApproved ? "Disetujui" : "Ditolak"}
                                </Pill>
                              </div>
                              <p className="mt-1 text-caption text-label-3">
                                Dikirim: {new Date(req.requestedAt).toLocaleString("id-ID")}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <Eyebrow>Target pembukuan</Eyebrow>
                              <span className="mt-0.5 block text-subhead font-semibold text-label">{req.hari}, {req.tanggal}</span>
                            </div>
                          </div>

                          {/* Quick Comparison Card */}
                          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                            {summaryMetrics.map((m) => (
                              <div key={m.label} className="space-y-1 rounded-control bg-surface p-3 ring-1 ring-edge">
                                <Eyebrow>{m.label}</Eyebrow>
                                <span className="block text-caption tabular-nums text-label-3 line-through">{rupiah(m.o)}</span>
                                <span className={`block text-subhead font-bold tabular-nums ${m.p !== m.o ? "text-tint" : "text-label"}`}>
                                  {rupiah(m.p)}
                                </span>
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sep pt-3">
                            <Button
                              type="button"
                              variant="gray"
                              size="sm"
                              icon={<Activity />}
                              onClick={() => setSelectedRequest(req)}
                              className="min-h-[44px] sm:min-h-[36px]"
                            >
                              Bandingkan detail
                            </Button>

                            {isPending && (
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleRejectRequest(req)}
                                  className="min-h-[44px] sm:min-h-[36px]"
                                >
                                  Tolak
                                </Button>
                                <Button
                                  type="button"
                                  variant="filled"
                                  size="sm"
                                  onClick={() => handleApproveRequest(req)}
                                  className="min-h-[44px] sm:min-h-[36px]"
                                >
                                  ACC
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {activeTabOwner === "STOK" && <HalamanStok isOwner tampilJajanan={tampilJajanan !== false} />}

      {/* MODAL: RINCIAN PENGELUARAN (UDS Sheet) */}
      {renderRincianSheet({
        open: showAnalitikModal,
        onClose: () => { setShowAnalitikModal(false); setSelectedCategory(null); },
        title: "Rincian pengeluaran",
        allLabel: "Semua transaksi",
        emptyLabel: "Tidak ada pengeluaran pada periode ini.",
        isExpense: true,
        totalAmount: totalPengeluaranBulanIni,
        chartData: expenseChartData,
        items: combinedExpensesBulanIni,
        selectedCat: selectedCategory,
        setSelectedCat: setSelectedCategory,
        selectedCatItems: selectedCategoryItems,
        getColor: getCategoryColor,
      })}

      {/* MODAL: RINCIAN PENDAPATAN KOTOR (UDS Sheet) */}
      {renderRincianSheet({
        open: showIncomeModal,
        onClose: () => { setShowIncomeModal(false); setSelectedIncomeCategory(null); },
        title: "Rincian pendapatan kotor",
        allLabel: "Semua pendapatan",
        emptyLabel: "Tidak ada pendapatan pada periode ini.",
        isExpense: false,
        totalAmount: totalPemasukanBulanIni,
        chartData: incomeChartData,
        items: combinedIncomeBulanIni,
        selectedCat: selectedIncomeCategory,
        setSelectedCat: setSelectedIncomeCategory,
        selectedCatItems: selectedIncomeCategoryItems,
        getColor: getIncomeColor,
      })}

      {/* MODAL: BANDINGKAN DETAIL REQUEST EDIT */}
      {selectedRequest && (() => {
        const req = selectedRequest;
        const isPending = req.status === "pending";
        const infoFields = [
          { label: "Absen pagi", o: req.originalData?.absenPagi, p: req.proposedData?.absenPagi },
          { label: "Absen siang", o: req.originalData?.absenSiang, p: req.proposedData?.absenSiang },
          { label: "Ruko buka", o: req.originalData?.rukoBuka, p: req.proposedData?.rukoBuka },
          { label: "Ruko tutup", o: req.originalData?.rukoTutup, p: req.proposedData?.rukoTutup },
          { label: "Shift", o: req.originalData?.shiftPegawai, p: req.proposedData?.shiftPegawai },
        ];
        return (
          <Sheet
            open={Boolean(selectedRequest)}
            onClose={() => setSelectedRequest(null)}
            size="xl"
            variant="surface"
            zClassName="z-[600]"
            title="Detail perbandingan edit"
            subtitle={
              <>
                Pengirim: <span className="font-semibold text-label">{req.requestedBy}</span> · Target: <span className="font-semibold text-tint">{req.hari}, {req.tanggal}</span>
              </>
            }
            footer={
              isPending ? (
                <div className="flex justify-end gap-2.5">
                  <Button type="button" variant="destructive" size="md" onClick={() => handleRejectRequest(req)}>
                    Tolak request
                  </Button>
                  <Button type="button" variant="filled" size="md" onClick={() => handleApproveRequest(req)}>
                    Setujui (ACC)
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-footnote text-label-2">
                    <span>Status:</span>
                    <Pill tone={req.status === "approved" ? "positive" : "negative"}>
                      {req.status === "approved" ? "Disetujui" : "Ditolak"}
                    </Pill>
                  </div>
                  <Button type="button" variant="gray" size="md" onClick={() => setSelectedRequest(null)}>
                    Tutup
                  </Button>
                </div>
              )
            }
          >
            <div className="space-y-5">
              {/* General Info Comparison */}
              <div className="space-y-3 rounded-tile apple-tile p-4 ring-1 ring-edge">
                <Eyebrow>Informasi umum</Eyebrow>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {infoFields.map((f, i) => (
                    <div key={f.label} className={`flex flex-col ${i === 4 ? "col-span-2 sm:col-span-1" : ""}`}>
                      <span className="text-caption text-label-3">{f.label}</span>
                      <span className="truncate text-footnote text-negative line-through">{f.o || "-"}</span>
                      <span className="truncate text-footnote font-semibold text-positive">{f.p || "-"}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-sep pt-2.5">
                  <span className="text-caption text-label-3">Catatan</span>
                  <p className="text-footnote text-negative line-through">{req.originalData?.catatan || "-"}</p>
                  <p className="text-footnote font-medium text-positive">{req.proposedData?.catatan || "-"}</p>
                </div>
              </div>

              {/* Categories Comparison */}
              <div className="space-y-4">
                {(["harian", "jajanan", "jasaAks", "sewa", "setoran", "pengeluaran"] as const).map((cat) => {
                  let title = "";
                  let originalRows: any[] = [];
                  let proposedRows: any[] = [];
                  let renderRow = (_row: any) => "";

                  if (cat === "harian") {
                    title = "Transaksi harian (PS Main)";
                    originalRows = req.originalData?.rowsHarian || [];
                    proposedRows = req.proposedData?.rowsHarian || [];
                    renderRow = (row) => `${row.jenisPS} · ${row.jumlahJam} jam · ${rupiah(row.harga)} · ${row.bayar || "Cash"}`;
                  } else if (cat === "jajanan") {
                    title = "Penjualan jajanan";
                    originalRows = req.originalData?.rowsJajanan || [];
                    proposedRows = req.proposedData?.rowsJajanan || [];
                    renderRow = (row) => `${row.jenisJajanan} · ${row.qtyJam} qty · ${rupiah(row.harga)} · ${row.bayar || "Cash"}`;
                  } else if (cat === "jasaAks") {
                    title = "Pemasukan usaha";
                    originalRows = req.originalData?.rowsJasaAks || [];
                    proposedRows = req.proposedData?.rowsJasaAks || [];
                    renderRow = (row) => `${row.tipe} (${row.ket}) · ${rupiah(row.harga)} · ${row.bayar || "Cash"}`;
                  } else if (cat === "sewa") {
                    title = "Rental sewa PS luar";
                    originalRows = req.originalData?.rowsSewa || [];
                    proposedRows = req.proposedData?.rowsSewa || [];
                    renderRow = (row) => `${row.jenisPS} · ${row.lamaSewa} · ${rupiah(row.harga)} · ${row.bayar || "Cash"}${row.isOngkir === "YA" ? ` (+ Ongkir ${rupiah(row._ongkir)})` : ""}`;
                  } else if (cat === "setoran") {
                    title = "Setoran";
                    originalRows = req.originalData?.rowsSetoran || [];
                    proposedRows = req.proposedData?.rowsSetoran || [];
                    renderRow = (row) => `${row.ket} · ${rupiah(row.harga || row.nominal)} · ${row.bayar || "Cash"}`;
                  } else if (cat === "pengeluaran") {
                    title = "Pengeluaran";
                    originalRows = req.originalData?.rowsPengeluaran || [];
                    proposedRows = req.proposedData?.rowsPengeluaran || [];
                    renderRow = (row) => `${row.ket} · ${rupiah(row.harga || row.nominal)} · ${row.bayar || "Cash"}`;
                  }

                  const isIdentical = JSON.stringify(originalRows) === JSON.stringify(proposedRows);
                  if (originalRows.length === 0 && proposedRows.length === 0) return null;

                  return (
                    <div key={cat} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-subhead font-semibold text-label">{title}</h4>
                        <Pill tone={isIdentical ? undefined : "warning"}>
                          {isIdentical ? "Tidak ada perubahan" : "Ada perubahan"}
                        </Pill>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {/* Original Column */}
                        <div className={`rounded-tile p-3 ring-1 ${isIdentical ? "bg-surface-2 ring-edge" : "bg-negative/5 ring-negative/25"}`}>
                          <Eyebrow>Original</Eyebrow>
                          {originalRows.length === 0 ? (
                            <p className="mt-1.5 text-footnote italic text-label-3">Tidak ada transaksi</p>
                          ) : (
                            <div className="mt-1.5 divide-y divide-sep">
                              {originalRows.map((row, rIdx) => (
                                <div key={rIdx} className="truncate py-1 text-footnote text-label-2 line-through">
                                  {rIdx + 1}. {renderRow(row)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Proposed Column */}
                        <div className={`rounded-tile p-3 ring-1 ${isIdentical ? "bg-surface-2 ring-edge" : "bg-positive/5 ring-positive/25"}`}>
                          <Eyebrow>Usulan edit</Eyebrow>
                          {proposedRows.length === 0 ? (
                            <p className="mt-1.5 text-footnote italic text-label-3">Tidak ada transaksi</p>
                          ) : (
                            <div className="mt-1.5 divide-y divide-sep">
                              {proposedRows.map((row, rIdx) => (
                                <div key={rIdx} className="truncate py-1 text-footnote font-medium text-label">
                                  {rIdx + 1}. {renderRow(row)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Sheet>
        );
      })()}
    </div>
  );
};

const UnitStatusWidget = ({ rowsSewa, history, activeDate, onVerifyActiveRental, onPengingat, hargaItems, isVerifyingPayment }: { rowsSewa: RowSewa[], history?: HistoryItem[], activeDate?: string, onVerifyActiveRental?: (idx: number) => void, onPengingat?: (item: any) => void, hargaItems?: any[], isVerifyingPayment?: boolean }) => {
  const [activeSlide, setActiveSlide] = useState<"status" | "device">("status");

  useEffect(() => {
    const handleGlobalScan = () => {
      setActiveSlide("device");
    };
    window.addEventListener("trigger-device-scan", handleGlobalScan);
    return () => window.removeEventListener("trigger-device-scan", handleGlobalScan);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <SubTabs
        ariaLabel="Halaman monitoring"
        value={activeSlide}
        onChange={setActiveSlide}
        options={[{ key: "status", label: "Status Unit" }, { key: "device", label: "Kondisi Unit" }]}
      />

      {/* Widget Container with fast fade transition */}
      <div className="w-full">
        {activeSlide === "status" ? (
          <div className="animate-in fade-in duration-200">
            <WidgetMonitoringStatus 
              history={history || []} 
              rowsSewa={rowsSewa} 
              activeDate={activeDate} 
              onVerifyActiveRental={onVerifyActiveRental} 
              onPengingat={onPengingat}
              isOwner={true} 
              hargaItems={hargaItems}
              isVerifyingPayment={isVerifyingPayment}
            />
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <WidgetMonitoringDevice isOwner={true} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PageOwner;
