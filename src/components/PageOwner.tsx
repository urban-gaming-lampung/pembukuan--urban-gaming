import React, { useMemo, useState, useEffect } from "react";
import HistoryPembukuan from "./HistoryPembukuan";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { AlertCircle, TrendingUp, TrendingDown, DollarSign, Activity, Clock, Monitor, Gamepad2, CheckCircle, Settings2, ShieldCheck, Smartphone, Sparkles, Zap, Brain, Target, BarChart3 } from "lucide-react";
import { doc, setDoc, onSnapshot, query, collection, addDoc, deleteDoc, updateDoc, where, orderBy } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { HistoryItem, RowSewa } from "../lib/types";
import { rupiah, formatDateShort } from "../lib/format";
import RekapPemasukan from "./RekapPemasukan";
import Grafik from "./Grafik";
import Section from "./common/Section";
import { StokData, StokItemValue } from "../hooks/useStokData";
import FilterComp from "./Filter";
import TabPegawai from "./TabPegawai";
import WidgetMonitoringStatus from "./WidgetMonitoringStatus";
import WidgetMonitoringDevice from "./WidgetMonitoringDevice";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend
} from "recharts";

type OwnerExpense = {
  id: string;
  nama: string;
  harga: number;
  kategori: string;
  tanggal: string; // YYYY-MM-DD
  timestamp: number;
};

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
  stokState: StokData;
};

// Utils:
const toNum = (v: any) => {
  const n = parseInt(String(v ?? "0"), 10);
  return Number.isFinite(n) ? n : 0;
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
  filterMode, setFilterMode, filterMonth, setFilterMonth,
  rangeStart, setRangeStart, rangeEnd, setRangeEnd, filteredHistory,
  hargaItems,
  isVerifyingPayment = false,
  stokState
}) => {

  const [activeTabOwner, setActiveTabOwner] = useState<"MONITORING" | "ANALITIK" | "INPUT PENGELUARAN" | "STOK" | "PEGAWAI">("MONITORING");
  const [ownerExpenses, setOwnerExpenses] = useState<OwnerExpense[]>([]);
  const [showAnalitikModal, setShowAnalitikModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [selectedIncomeCategory, setSelectedIncomeCategory] = useState<string | null>(null);

  useBodyScrollLock(showAnalitikModal);
  useBodyScrollLock(showIncomeModal);

  // States for Input Pengeluaran Grouping
  const [expandedExpenseMonths, setExpandedExpenseMonths] = useState<string[]>([]);
  const toggleExpenseMonth = (m: string) => setExpandedExpenseMonths(p => p.includes(m) ? p.filter(x => x !== m) : [...p, m]);

  const [expandedExpenseCats, setExpandedExpenseCats] = useState<string[]>([]);
  const toggleExpenseCat = (key: string) => setExpandedExpenseCats(p => p.includes(key) ? p.filter(x => x !== key) : [...p, key]);

  // States for Analitik Sub-tabs and Logging
  const [analitikSubTab, setAnalitikSubTab] = useState<"PEMBUKUAN" | "LOGGING">("PEMBUKUAN");
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [filterEmail, setFilterEmail] = useState<string>("Semua");
  const [filterAction, setFilterAction] = useState<string>("Semua");

  // States for Pegawai Sub-tabs and Requests
  const [pegawaiSubTab, setPegawaiSubTab] = useState<"DASHBOARD" | "REQUEST">("DASHBOARD");
  const [editRequests, setEditRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  useBodyScrollLock(!!selectedRequest);

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

  const logActivity = async (action: "CREATE" | "UPDATE" | "DELETE", targetDate: string, targetDay: string, recordData: any) => {
    try {
      const email = auth.currentUser?.email || "owner@gmail.com";
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

  const handleApproveRequest = async (req: any) => {
    if (!confirm(`Setujui request edit pembukuan tanggal ${req.tanggal}?`)) return;
    try {
      // 1. Update history_pembukuan
      await setDoc(doc(db, "history_pembukuan", req.historyId), req.proposedData, { merge: true });
      
      // 2. Update edit_request status
      await updateDoc(doc(db, "edit_requests", req.id), { status: "approved" });
      
      // 3. Log activity
      await logActivity("UPDATE", req.tanggal, req.hari, req.proposedData);
      
      alert("Request edit berhasil disetujui! ✅");
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Gagal menyetujui request ❌");
    }
  };

  const handleRejectRequest = async (req: any) => {
    if (!confirm(`Tolak request edit pembukuan tanggal ${req.tanggal}?`)) return;
    try {
      await updateDoc(doc(db, "edit_requests", req.id), { status: "rejected" });
      alert("Request edit ditolak! ❌");
      setSelectedRequest(null);
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("Gagal menolak request ❌");
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
    if (activeTabOwner !== "ANALITIK" || analitikSubTab !== "LOGGING") return;
    
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
  }, [activeTabOwner, analitikSubTab]);

  useEffect(() => {
    let q = collection(db, "owner_expenses") as any;
    
    if (filterMode === "Semua Bulan") {
       q = query(q, orderBy("tanggal", "desc"));
    } else if (filterMode === "Pilih Bulan") {
       const yyyy = new Date().getFullYear();
       const mm = String(filterMonth).padStart(2, "0");
       const startD = `${yyyy}-${mm}-01`;
       const endD = `${yyyy}-${mm}-31`;
       q = query(q, where("tanggal", ">=", startD), where("tanggal", "<=", endD), orderBy("tanggal", "desc"));
    } else if (filterMode === "Rentang" && rangeStart && rangeEnd) {
       q = query(q, where("tanggal", ">=", rangeStart), where("tanggal", "<=", rangeEnd), orderBy("tanggal", "desc"));
    } else {
       const cutoff = new Date();
       cutoff.setDate(cutoff.getDate() - 60);
       const yyyy = cutoff.getFullYear();
       const mm = String(cutoff.getMonth() + 1).padStart(2, "0");
       const dd = String(cutoff.getDate()).padStart(2, "0");
       q = query(q, where("tanggal", ">=", `${yyyy}-${mm}-${dd}`), orderBy("tanggal", "desc"));
    }

    const unsub = onSnapshot(q, (snap: any) => {
      const res: OwnerExpense[] = [];
      snap.forEach((d: any) => res.push({ id: d.id, ...d.data() } as OwnerExpense));
      setOwnerExpenses(res.sort((a, b) => b.timestamp - a.timestamp));
    });
    return () => unsub();
  }, [filterMode, filterMonth, rangeStart, rangeEnd]);

  const filteredOwnerExpenses = useMemo(() => {
    const now = new Date();
    if (filterMode === "Bulan Ini") {
      return ownerExpenses.filter((o) => {
        const d = new Date(o.tanggal);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }
    if (filterMode === "7 Hari Terakhir") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      cutoff.setHours(0, 0, 0, 0);
      return ownerExpenses.filter((o) => {
        const d = new Date(o.tanggal);
        d.setHours(0, 0, 0, 0);
        return d >= cutoff;
      });
    }
    if (filterMode === "Semua Bulan") return ownerExpenses;
    if (filterMode === "Pilih Bulan") {
      return ownerExpenses.filter((o) => {
        const d = new Date(o.tanggal);
        return (d.getMonth() + 1) === filterMonth && d.getFullYear() === now.getFullYear();
      });
    }
    if (filterMode === "Rentang" && rangeStart && rangeEnd) {
      const s = new Date(rangeStart); s.setHours(0,0,0,0);
      const e = new Date(rangeEnd); e.setHours(23,59,59,999);
      return ownerExpenses.filter((o) => {
        const d = new Date(o.tanggal);
        return d >= s && d <= e;
      });
    }
    return ownerExpenses;
  }, [filterMode, ownerExpenses, filterMonth, rangeStart, rangeEnd]);

  // Moved uniqueNames & uniqueCategories below formExpense for sorting based on user input

  const groupedOwnerExpenses = useMemo(() => {
    const map = new Map<string, OwnerExpense[]>();
    ownerExpenses.forEach(o => {
        const d = new Date(o.tanggal);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = String(d.getFullYear()).slice(-2);
        const key = `${mm}/${yy}`;
        if(!map.has(key)) map.set(key, []);
        map.get(key)!.push(o);
    });
    return Array.from(map.entries()).sort((a,b) => {
        const [m1, y1] = a[0].split("/");
        const [m2, y2] = b[0].split("/");
        if (y1 !== y2) return parseInt(y2) - parseInt(y1);
        return parseInt(m2) - parseInt(m1);
    });
  }, [ownerExpenses]);

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

  // Category color palette (fixed mapping for consistency)
  const CATEGORY_COLORS: Record<string, string> = {
    "Ongkir / Pengiriman": "#f59e0b",
    "Gaji Pegawai": "#3b82f6",
    "Listrik / Air / Internet": "#06b6d4",
    "Maintenance / Servis": "#ef4444",
    "Belanja Modal": "#8b5cf6",
    "Konsumsi": "#ec4899",
    "Sewa Tempat": "#14b8a6",
    "Lainnya": "#6b7280",
  };
  const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || "#6b7280";

  // Income category colors
  const INCOME_COLORS: Record<string, string> = {
    "Pemasukan Harian": "#3b82f6",
    "Jajanan & Minuman": "#f59e0b",
    "Jasa & Aksesoris": "#8b5cf6",
    "Sewa PS": "#10b981",
    "Ongkir (Bagi Hasil)": "#06b6d4",
  };
  const getIncomeColor = (cat: string) => INCOME_COLORS[cat] || "#6b7280";

  const { totalPemasukanBulanIni, totalPengeluaranBulanIni, combinedExpensesBulanIni } = useMemo(() => {
    let income = 0;
    let adminExpense = 0;
    const combinedList: { source: string, nama: string, harga: number, tanggal: string, kategori: string }[] = [];

    filteredHistory.forEach((h) => {
      let itemIncome =
        toNum(h.totalHarian) +
        toNum(h.totalJajanan) +
        toNum(h.totalJasaAks) +
        toNum(h.totalSewa);

      if (Array.isArray((h as any).rowsPengeluaran)) {
        (h as any).rowsPengeluaran.forEach((r: any) => {
          const x = toNum(r.harga || r.nominal);
          if (x <= 0) return;
          adminExpense += x;
          const smartKategori = detectCategory(r.ket || "", "Lainnya");
          combinedList.push({ source: "admin", nama: r.ket || "Tanpa Ket", harga: x, tanggal: r.tanggal || h.tanggal, kategori: smartKategori });
        });
      }

      // Ongkir sudah masuk ke rowsPengeluaran secara otomatis, sehingga akan dihitung sebagai Pengeluaran.
      // Pendapatan Kotor (itemIncome) tidak perlu dikurangi lagi agar tidak double-deduction.
      
      income += itemIncome;
    });

    let ownerExpense = 0;
    filteredOwnerExpenses.forEach(o => {
        ownerExpense += o.harga;
        const smartKategori = detectCategory(o.nama, o.kategori);
        combinedList.push({ source: "owner", nama: o.nama, harga: o.harga, tanggal: o.tanggal, kategori: smartKategori });
    });

    combinedList.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

    return { totalPemasukanBulanIni: income, totalPengeluaranBulanIni: adminExpense + ownerExpense, combinedExpensesBulanIni: combinedList };
  }, [filteredHistory, filteredOwnerExpenses]);

  const labaKotor = totalPemasukanBulanIni;
  const labaBersih = totalPemasukanBulanIni - totalPengeluaranBulanIni;

  // Hitung Total Cash & Transfer dari filteredHistory untuk section Ringkasan
  const { totalCashFiltered, totalTransferFiltered } = useMemo(() => {
    let cash = 0;
    let transfer = 0;
    filteredHistory.forEach((h) => {
      cash += (h as any).totalCash || 0;
      transfer += (h as any).totalTransfer || 0;
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
      const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
      
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
    filteredHistory.forEach((h) => {
      // Harian
      if (Array.isArray(h.rowsHarian)) {
        h.rowsHarian.forEach((r: any) => {
          let price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
          if (r._ongkir) {
            const ongkirVal = parseInt(String(r._ongkir).replace(/\D/g, "")) || 0;
            if (r._isNewOngkirSystem) {
              const pegawaiNominal = r._ongkirPegawaiNominal || 0;
              price -= pegawaiNominal;
              // Owner's share of ongkir = total ongkir - employee portion
              const ownerOngkir = ongkirVal - pegawaiNominal;
              if (ownerOngkir > 0) {
                list.push({ nama: `Ongkir ${r.jenisPS || "PS Harian"}`, harga: ownerOngkir, tanggal: h.tanggal, hari: h.hari, kategori: "Ongkir (Bagi Hasil)", bayar: r._bayarOngkir || r.bayar || "" });
              }
            } else {
              price -= ongkirVal;
            }
          }
          if (price > 0) {
            list.push({ nama: r.jenisPS || "PS Harian", harga: price, tanggal: h.tanggal, hari: h.hari, kategori: "Pemasukan Harian", bayar: r.bayar || "" });
          }
        });
      }
      // Jajanan
      if (Array.isArray(h.rowsJajanan)) {
        h.rowsJajanan.forEach((r: any) => {
          const price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
          if (price > 0) {
            list.push({ nama: r.jenisJajanan || "Jajanan", harga: price, tanggal: h.tanggal, hari: h.hari, kategori: "Jajanan & Minuman", bayar: r.bayar || "" });
          }
        });
      }
      // Jasa & Aksesoris
      if (Array.isArray(h.rowsJasaAks)) {
        h.rowsJasaAks.forEach((r: any) => {
          const price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
          if (price > 0) {
            list.push({ nama: r.tipe || r.ket || "Jasa/Aks", harga: price, tanggal: h.tanggal, hari: h.hari, kategori: "Jasa & Aksesoris", bayar: r.bayar || "" });
          }
        });
      }
      // Sewa PS
      if (Array.isArray(h.rowsSewa)) {
        h.rowsSewa.forEach((r: any) => {
          let price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
          if (r._ongkir) {
            const ongkirVal = parseInt(String(r._ongkir).replace(/\D/g, "")) || 0;
            if (r._isNewOngkirSystem) {
              const pegawaiNominal = r._ongkirPegawaiNominal || 0;
              price -= pegawaiNominal;
              // Owner's share of ongkir = total ongkir - employee portion
              const ownerOngkir = ongkirVal - pegawaiNominal;
              if (ownerOngkir > 0) {
                list.push({ nama: `Ongkir ${r.jenisPS || "PS"} - ${r.ket || "Sewa"}`, harga: ownerOngkir, tanggal: h.tanggal, hari: h.hari, kategori: "Ongkir (Bagi Hasil)", bayar: r._bayarOngkir || r.bayar || "" });
              }
            } else {
              price -= ongkirVal;
            }
          }
          if (price > 0) {
            list.push({ nama: `${r.jenisPS || "PS"} - ${r.ket || "Sewa"}`, harga: price, tanggal: h.tanggal, hari: h.hari, kategori: "Sewa PS", bayar: r.bayar || "" });
          }
        });
      }
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

  // 2. Data Stok Alert (Menipis <= 5)
  const lowStockItems = useMemo(() => {
    const alerts: { kategori: string; item: string; jumlah: number; type: string }[] = [];

    // Cek Rental
    if (stokState.rental) {
      Object.entries(stokState.rental).forEach(([kat, items]) => {
        Object.entries(items as Record<string, StokItemValue>).forEach(([item, val]) => {
          if (val.jumlah <= 5) {
            alerts.push({ kategori: kat, item, jumlah: val.jumlah, type: "Rental" });
          }
        });
      });
    }

    // Cek Jualan
    if (stokState.jualan) {
      Object.entries(stokState.jualan).forEach(([kat, items]) => {
        Object.entries(items as Record<string, StokItemValue>).forEach(([item, val]) => {
          if (val.jumlah <= 5) {
            alerts.push({ kategori: kat, item, jumlah: val.jumlah, type: "Surplus" }); // Jualan
          }
        });
      });
    }

    // Urutkan dari yg paling sedikit
    return alerts.sort((a, b) => a.jumlah - b.jumlah);
  }, [stokState]);

  // 3. Persiapan Data Chart Stok Rental & Jualan
  const rentalChartData = useMemo(() => {
    const data: { name: string; jumlah: number }[] = [];
    if (stokState.rental) {
      Object.entries(stokState.rental).forEach(([kat, items]) => {
        Object.entries(items as Record<string, StokItemValue>).forEach(([item, val]) => {
          data.push({ name: item, jumlah: val.jumlah });
        });
      });
    }
    return data.sort((a, b) => a.jumlah - b.jumlah).slice(0, 15); // Ambil 15 terendah agar chart tidak penuh
  }, [stokState]);

  const jualanChartData = useMemo(() => {
    const data: { name: string; jumlah: number }[] = [];
    if (stokState.jualan) {
      Object.entries(stokState.jualan).forEach(([kat, items]) => {
        Object.entries(items as Record<string, StokItemValue>).forEach(([item, val]) => {
          data.push({ name: item, jumlah: val.jumlah });
        });
      });
    }
    return data.sort((a, b) => a.jumlah - b.jumlah).slice(0, 15);
  }, [stokState]);

  const [masterUnit, setMasterUnit] = useState({ ps3: 0, ps4: 0, tv: 0, portabel: 0 });
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "master_unit"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMasterUnit({ ps3: data.ps3 || 0, ps4: data.ps4 || 0, tv: data.tv || 0, portabel: data.portabel || 0 });
      }
    });
    return () => unsub();
  }, []);

  // --- 1. TOP PERFORMING UNITS ---
  const topUnitsData = useMemo(() => {
    const counts = new Map<string, { revenue: number, count: number }>();
    const colors = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f43f5e'];
    let cIdx = 0;

    filteredHistory.forEach(h => {
      [...(h.rowsHarian || []), ...(h.rowsSewa || [])].forEach((r: any) => {
         const type = String(r.jenisPS || "").trim().toUpperCase();
         const price = parseInt(String(r.harga).replace(/\D/g, "")) || 0;
         if (type && type !== "UNDEFINED" && r.lamaSewa !== "PELUNASAN" && (price > 0 || r.isPaid === "TIDAK")) {
            let cleanType = "PS / Konsol Lain";
            if (type.includes("PS3") || type.includes("PS 3")) cleanType = "PlayStation 3";
            else if (type.includes("PS4") || type.includes("PS 4")) cleanType = "PlayStation 4";
            else if (type.includes("PS5") || type.includes("PS 5")) cleanType = "PlayStation 5";
            else if (type.includes("TV")) cleanType = "TV / Monitor";
            else if (type.includes("STEAM") || type.includes("PORTA") || type.includes("SWITCH")) cleanType = "Console Portable";
            else cleanType = type;

            const actualPrice = price > 0 ? price : (parseInt(String(r._customBase || "0").replace(/\D/g, "")) || 0);
            if (actualPrice > 0) {
              if (!counts.has(cleanType)) counts.set(cleanType, { revenue: 0, count: 0 });
              const item = counts.get(cleanType)!;
              item.revenue += actualPrice;
              item.count += 1;
            }
         }
      });
    });

    return Array.from(counts.entries())
      .map(([unit, data], i) => ({ unit, revenue: data.revenue, count: data.count, fill: colors[i % colors.length] }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredHistory]);

  // --- 2. OCCUPANCY RATE ---
  const occupancyData = useMemo(() => {
    const uniqueDays = new Set<string>();
    let totalUsedHours = 0;

    filteredHistory.forEach(h => {
        uniqueDays.add(h.tanggal);
        
        const processRow = (r: any) => {
             const type = String(r.jenisPS || "").trim().toUpperCase();
             const priceStr = String(r.harga).replace(/\D/g, "");
             let price = parseInt(priceStr) || 0;
             if (price === 0 && r.isPaid === "TIDAK") {
                price = parseInt(String(r._customBase || "0").replace(/\D/g, "")) || 0;
             }
             
             if (r._ongkir) {
                 const ongkirVal = parseInt(String(r._ongkir).replace(/\D/g, "")) || 0;
                 price -= ongkirVal;
                 if (price < 0) price = 0;
             }
             
             if (r.lamaSewa === "PELUNASAN" || price <= 0) return;

             let isPS3 = type.includes("PS3") || type.includes("PS 3") || (type.includes("PS") && !type.includes("PS4") && !type.includes("PS 4") && !type.includes("PS5"));
             let isPS4 = type.includes("PS4") || type.includes("PS 4") || type.includes("PRO") || type.includes("FAT") || type.includes("SLIM") || type.includes("PS5");
             
             if (isPS3 || isPS4) {
                 const rate = isPS4 ? 7000 : 5000;
                 const calcHours = price / rate;
                 totalUsedHours += calcHours;
             }
        };

        if (Array.isArray(h.rowsHarian)) {
            h.rowsHarian.forEach(r => processRow(r));
        }
        if (Array.isArray(h.rowsSewa)) {
            h.rowsSewa.forEach(r => processRow(r));
        }
    });

    const totalMachines = (masterUnit.ps3 || 0) + (masterUnit.ps4 || 0);
    const safeMachines = totalMachines > 0 ? totalMachines : 10;
    const daysCount = uniqueDays.size > 0 ? uniqueDays.size : 1;
    const maxCapacityHours = safeMachines * 14 * daysCount;
    
    const pct = Math.min(100, Math.round((totalUsedHours / maxCapacityHours) * 100));

    return { totalUsedHours: Math.round(totalUsedHours), maxCapacityHours, percentage: pct, totalMachines };
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
                       hours[hh].revenue += (parseInt(String(r.harga).replace(/\D/g,"")) || 0);
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
                       hours[hh].revenue += (parseInt(String(r.harga).replace(/\D/g,"")) || 0);
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
  type InsightItem = {
    id: string;
    type: 'financial_health' | 'asset_optimization' | 'peak_strategy';
    severity: 'critical' | 'warning' | 'success' | 'info';
    title: string;
    body: string;
    metric?: string;
    actionLabel?: string;
  };

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
          title: '⚠️ Pengeluaran Melebihi Pendapatan',
          body: `Defisit sebesar ${rupiah(deficitAmt)}. Kategori pengeluaran terbesar adalah "${topExpCat?.name || '-'}" (${topExpPct}% dari total biaya). Evaluasi apakah ada pos biaya di kategori ini yang bisa ditekan, terutama Gaji Pegawai atau Belanja Modal yang mungkin bisa dijadwalkan ulang.`,
          metric: `-${rupiah(deficitAmt)}`,
          actionLabel: 'Cek Breakdown Biaya'
        });
      } else if (expenseRatio > 0.7) {
        // Thin margin warning
        const marginPct = ((1 - expenseRatio) * 100).toFixed(1);
        insights.push({
          id: 'fin_thin_margin',
          type: 'financial_health',
          severity: 'warning',
          title: '📊 Margin Laba Tipis',
          body: `Margin laba bersih Anda hanya ${marginPct}%. Idealnya di atas 30% untuk bisnis rental. Perhatikan proporsi biaya operasional vs pendapatan kotor untuk menjaga kesehatan keuangan.`,
          metric: `${marginPct}% margin`,
        });
      } else {
        const marginPct = ((1 - expenseRatio) * 100).toFixed(1);
        insights.push({
          id: 'fin_healthy',
          type: 'financial_health',
          severity: 'success',
          title: '✅ Keuangan Sehat',
          body: `Margin laba bersih ${marginPct}% — dalam kondisi sangat baik. Laba bersih mencapai ${rupiah(profit)}. Pertahankan efisiensi biaya operasional ini.`,
          metric: `${marginPct}% margin`,
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
          title: '🔴 Utilisasi Unit Sangat Rendah',
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
          title: '📉 Utilisasi di Bawah Target 80%',
          body: `Utilisasi saat ini ${occPct}%, masih di bawah benchmark 80%.${leastUnit ? ` Unit "${leastUnit.unit}" dengan pemasukan ${rupiah(leastUnit.revenue)} bisa ditingkatkan melalui promo jam sepi atau paket weekend.` : ' Fokus pada jam-jam yang belum terisi penuh.'}`,
          metric: `${occPct}%`,
        });
      } else {
        insights.push({
          id: 'asset_excellent',
          type: 'asset_optimization',
          severity: 'success',
          title: '🟢 Utilisasi Optimal',
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
          title: `🕐 Konsentrasi Tinggi di Jam ${peakRange}`,
          body: `${peakConcentration}% dari seluruh transaksi terjadi di jam ${peakRange} dengan estimasi pendapatan ${rupiah(peakRevenue)}. Pastikan staf penuh di rentang jam tersebut.${offPeakHours.length > 0 ? ` Untuk jam sepi (${offPeakHours.map(h => h.hour).slice(0, 3).join(', ')}), pertimbangkan "Happy Hour" dengan diskon 10-20% untuk menarik pelanggan.` : ''}`,
          metric: `${peakConcentration}% peak`,
          actionLabel: 'Lihat Jam Sibuk'
        });
      } else if (peakHours.length > 0) {
        insights.push({
          id: 'peak_balanced',
          type: 'peak_strategy',
          severity: 'success',
          title: `✅ Distribusi Jam Kunjungan Merata`,
          body: `Transaksi tersebar cukup merata sepanjang jam operasional. Jam puncak di ${peakRange} dengan ${peakTx} transaksi. Ini menandakan pelanggan datang sepanjang hari — strategi harga flat sudah tepat.`,
          metric: `${peakTx} tx peak`,
        });
      }
    }

    return insights;
  }, [totalPemasukanBulanIni, totalPengeluaranBulanIni, labaBersih, expenseChartData, occupancyData, topUnitsData, peakHoursData]);

  // Color logic for stok (merah jika <= 5)
  const getStokColor = (val: number, isDark: boolean) => {
    if (val <= 5) return isDark ? "#ff453a" : "#ff3b30";
    if (val <= 10) return isDark ? "#ffd60a" : "#ffcc00";
    return isDark ? "#30d158" : "#34c759";
  };

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const [formExpense, setFormExpense] = useState({ nama: "", harga: "", kategori: "", tanggal: new Date().toISOString().split("T")[0] });
  const [loadingEx, setLoadingEx] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // --- Auto Suggestions Logic (with Smart Filtering) ---
  const uniqueNames = useMemo(() => {
    const counts = new Map<string, number>();
    ownerExpenses.forEach(e => {
        if(e.nama) counts.set(e.nama.trim(), (counts.get(e.nama.trim()) || 0) + 1);
    });
    
    let arr = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(x => x[0]);
      
    const currentInput = formExpense.nama.trim().toLowerCase();
    if (currentInput) {
      arr = arr.filter(x => x.toLowerCase().includes(currentInput));
    }
    
    return arr.slice(0, 10);
  }, [ownerExpenses, formExpense.nama]);

  const uniqueCategories = useMemo(() => {
    const counts = new Map<string, number>();
    ownerExpenses.forEach(e => {
        if(e.kategori) counts.set(e.kategori.trim(), (counts.get(e.kategori.trim()) || 0) + 1);
    });
    
    let arr = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(x => x[0]);
      
    const currentInput = formExpense.kategori.trim().toLowerCase();
    if (currentInput) {
      arr = arr.filter(x => x.toLowerCase().includes(currentInput));
    }
    
    return arr;
  }, [ownerExpenses, formExpense.kategori]);

  const handleSimpanOwnerExpense = async () => {
    if (!formExpense.nama || !formExpense.harga || !formExpense.tanggal) return;
    setLoadingEx(true);
    try {
      if (editingExpenseId) {
        await updateDoc(doc(db, "owner_expenses", editingExpenseId), {
          nama: formExpense.nama.trim(),
          harga: parseInt(formExpense.harga.replace(/\D/g, "") || "0", 10),
          kategori: formExpense.kategori || "Lainnya",
          tanggal: formExpense.tanggal
        });
        setEditingExpenseId(null);
      } else {
        await addDoc(collection(db, "owner_expenses"), {
          nama: formExpense.nama.trim(),
          harga: parseInt(formExpense.harga.replace(/\D/g, "") || "0", 10),
          kategori: formExpense.kategori || "Lainnya",
          tanggal: formExpense.tanggal,
          timestamp: Date.now()
        });
      }
      setFormExpense({ nama: "", harga: "", kategori: "", tanggal: new Date().toISOString().split("T")[0] });
    } catch (e) { console.error(e); }
    setLoadingEx(false);
  };

  const handleEditOwnerExpense = (o: OwnerExpense) => {
    setFormExpense({
      nama: o.nama,
      harga: String(o.harga),
      kategori: o.kategori,
      tanggal: o.tanggal
    });
    setEditingExpenseId(o.id);
    
    const section = document.getElementById("input-pengeluaran-section");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleDeleteOwnerExpense = async (id: string) => {
    if (!confirm("Hapus pengeluaran ini?")) return;
    await deleteDoc(doc(db, "owner_expenses", id));
  };

  return (
    <div className="space-y-3 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out fill-mode-both">

      {/* TABS SWICHTER OWNER */}
      <div className="flex w-full mb-6 bg-zinc-200/50 dark:bg-[#1C1C1E] p-1 rounded-[14px] ring-1 ring-zinc-300/50 dark:ring-white/5 backdrop-blur-sm relative gap-1">
        <button
          onClick={() => setActiveTabOwner("MONITORING")}
          className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center shrink-0 min-w-[110px] ${activeTabOwner === "MONITORING" ? "bg-white dark:bg-[#2C2C2E] text-rose-500 dark:text-rose-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/5"}`}
        >
          MONITORING
        </button>
        <button
          onClick={() => setActiveTabOwner("INPUT PENGELUARAN")}
          className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${activeTabOwner === "INPUT PENGELUARAN" ? "bg-white dark:bg-[#2C2C2E] text-purple-600 dark:text-purple-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
        >
          INPUT
        </button>
        <button
          onClick={() => setActiveTabOwner("ANALITIK")}
          className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${activeTabOwner === "ANALITIK" ? "bg-white dark:bg-[#2C2C2E] text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
        >
          ANALITIK
        </button>
        <button
          onClick={() => setActiveTabOwner("PEGAWAI")}
          className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${activeTabOwner === "PEGAWAI" ? "bg-white dark:bg-[#2C2C2E] text-pink-600 dark:text-pink-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
        >
          PEGAWAI
        </button>
        <button
          onClick={() => setActiveTabOwner("STOK")}
          className={`flex-1 py-2.5 text-[13px] sm:text-sm font-bold tracking-wide rounded-[10px] transition-all duration-300 flex justify-center items-center ${activeTabOwner === "STOK" ? "bg-white dark:bg-[#2C2C2E] text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10" : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"}`}
        >
          STOK
        </button>
      </div>

      {activeTabOwner === "INPUT PENGELUARAN" && (
        <div id="input-pengeluaran-section" className="bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 border border-zinc-200 dark:border-white/10 shadow-sm">
          <h2 className="text-xl font-black text-purple-600 dark:text-purple-400 mb-6 flex items-center gap-2">
            <DollarSign /> Input Pengeluaran
          </h2>
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Tanggal</label>
              <input type="date" value={formExpense.tanggal} onChange={e => setFormExpense({ ...formExpense, tanggal: e.target.value })} className="bg-zinc-50 dark:bg-black rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-800 text-sm font-bold w-full custom-date-input" />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Harga Pengeluaran</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" value={formExpense.harga === "" ? "" : rupiah(parseInt(formExpense.harga.replace(/\D/g, "") || "0"))} onChange={e => setFormExpense({ ...formExpense, harga: e.target.value })} className="bg-zinc-50 dark:bg-black rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-800 text-sm font-bold w-full" placeholder="Rp 0" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Nama Pengeluaran</label>
              <input type="text" value={formExpense.nama} onChange={e => setFormExpense({ ...formExpense, nama: e.target.value })} className="bg-zinc-50 dark:bg-black rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-800 text-sm font-bold w-full" placeholder="Contoh: Bayar Wi-Fi" />
              {uniqueNames.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {uniqueNames.map(n => (
                    <button key={`nama-${n}`} onClick={() => setFormExpense({ ...formExpense, nama: n })} className="px-3 py-1.5 text-[11px] font-bold bg-purple-50 hover:bg-purple-100 dark:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg transition-colors border border-purple-200/50 dark:border-purple-500/20 active:scale-95">
                      {n}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-500 uppercase">Kategori</label>
              <input type="text" value={formExpense.kategori} onChange={e => setFormExpense({ ...formExpense, kategori: e.target.value })} className="bg-zinc-50 dark:bg-black rounded-xl px-4 py-3 border border-zinc-200 dark:border-zinc-800 text-sm font-bold w-full" placeholder="Ketik kategori pengeluaran..." />
              {uniqueCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {uniqueCategories.map(c => (
                    <button key={`cat-${c}`} onClick={() => setFormExpense({ ...formExpense, kategori: c })} className="px-3 py-1.5 text-[11px] font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-[#2C2C2E] dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 rounded-lg transition-colors border border-zinc-200/50 dark:border-white/5 active:scale-95">
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-3 mb-8">
            <button disabled={loadingEx || !formExpense.nama || !formExpense.harga} onClick={handleSimpanOwnerExpense} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl py-3.5 shadow-lg shadow-purple-500/20 transition-all active:scale-95">
              {loadingEx ? "Menyimpan..." : editingExpenseId ? "Simpan Perubahan" : "Simpan Pengeluaran"}
            </button>
            {editingExpenseId && (
              <button onClick={() => { setEditingExpenseId(null); setFormExpense({ nama: "", harga: "", kategori: "", tanggal: new Date().toISOString().split("T")[0] }); }} className="px-6 bg-zinc-200 hover:bg-zinc-300 dark:bg-white/10 dark:hover:bg-white/20 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl py-3.5 transition-all active:scale-95">
                Batal
              </button>
            )}
          </div>

          <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-4 uppercase tracking-wider">Histori Pengeluaran</h3>
          <div className="flex flex-col gap-3">
            {groupedOwnerExpenses.length === 0 && <p className="text-center text-sm text-zinc-500 py-4">Belum ada pengeluaran.</p>}
            {groupedOwnerExpenses.map(([gKey, gItems]) => {
              const isExpanded = expandedExpenseMonths.includes(gKey);
              const totalGroup = gItems.reduce((acc, o) => acc + o.harga, 0);

              const catsMap = new Map<string, typeof gItems>();
              gItems.forEach(o => {
                 const c = o.kategori || "Lainnya";
                 if (!catsMap.has(c)) catsMap.set(c, []);
                 catsMap.get(c)!.push(o);
              });
              const groupedCats = Array.from(catsMap.entries()).sort((a,b) => b[1].reduce((sum, x) => sum + x.harga, 0) - a[1].reduce((sum, x) => sum + x.harga, 0));

              return (
                <div key={gKey} className="bg-zinc-50 dark:bg-[#18181A] rounded-[20px] overflow-hidden border border-zinc-200 dark:border-white/5 transition-all">
                  <div 
                    onClick={() => toggleExpenseMonth(gKey)}
                    className="flex items-center justify-between p-4 sm:p-5 cursor-pointer active:bg-zinc-100 dark:active:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border transition-colors ${isExpanded ? 'bg-purple-100 border-purple-200 text-purple-600 dark:bg-purple-500/20 dark:border-purple-500/30 dark:text-purple-400' : 'bg-white border-zinc-200 text-zinc-500 dark:bg-[#2C2C2E] dark:border-white/5 dark:text-zinc-400'}`}>
                        <svg className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                      <div>
                        <div className="text-[13px] font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
                          Pengeluaran <span className="text-purple-600 dark:text-purple-400">{gKey}</span>
                        </div>
                        <div className="text-[11px] font-bold text-zinc-400 mt-0.5">{gItems.length} Transaksi</div>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end justify-center">
                       <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Total</span>
                       <span className="text-base sm:text-lg font-black text-rose-500">{rupiah(totalGroup)}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="flex flex-col gap-3 p-4 pt-1 bg-zinc-100/50 dark:bg-black/20 border-t border-zinc-200 dark:border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                      {groupedCats.map(([cKey, cItems]) => {
                        const totalCat = cItems.reduce((acc, o) => acc + o.harga, 0);
                        const catFullKey = `${gKey}-${cKey}`;
                        const isCatExpanded = expandedExpenseCats.includes(catFullKey);
                        return (
                          <div key={catFullKey} className="bg-white dark:bg-[#1C1C1E] border border-zinc-200/60 dark:border-white/5 rounded-[16px] overflow-hidden shadow-sm transition-all">
                             
                             {/* Category Header */}
                             <div 
                                onClick={(e) => { e.stopPropagation(); toggleExpenseCat(catFullKey); }}
                                className="flex items-center justify-between p-3 sm:p-4 cursor-pointer active:bg-zinc-50 dark:active:bg-white/5 transition-colors"
                             >
                               <div className="flex items-center gap-3">
                                 <div className={`p-1.5 rounded-lg border transition-colors ${isCatExpanded ? 'bg-purple-50 border-purple-200 text-purple-600 dark:bg-purple-500/10 dark:border-purple-500/30 dark:text-purple-400' : 'bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-[#2C2C2E] dark:border-white/5 dark:text-zinc-400'}`}>
                                    <svg className={`w-4 h-4 transition-transform duration-300 ${isCatExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                 </div>
                                 <div>
                                    <div className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200">{cKey}</div>
                                    <div className="text-[10px] font-semibold text-zinc-400">{cItems.length} Transaksi</div>
                                 </div>
                               </div>
                               <div className="text-right">
                                  <div className="text-[14px] font-black text-rose-500">{rupiah(totalCat)}</div>
                               </div>
                             </div>

                             {/* Items in Category */}
                             {isCatExpanded && (
                               <div className="flex flex-col gap-2 p-3 bg-zinc-50 dark:bg-[#18181A] border-t border-zinc-200/60 dark:border-white/5">
                                 {cItems.map(o => (
                                    <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-[#1C1C1E] border border-zinc-200/60 dark:border-white/5 p-3 rounded-xl gap-3 shadow-sm">
                                      <div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">{o.tanggal}</div>
                                        <div className="text-[13px] font-bold text-zinc-900 dark:text-white leading-tight">{o.nama}</div>
                                      </div>
                                      <div className="flex items-center justify-between sm:justify-end gap-3 h-full">
                                        <div className="text-[14px] font-black text-rose-500 whitespace-nowrap">{rupiah(o.harga)}</div>
                                        <div className="flex items-center gap-2">
                                          <button onClick={(e) => { e.stopPropagation(); handleEditOwnerExpense(o); }} className="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 px-2 py-1.5 rounded-lg transition-colors border border-blue-100 dark:border-blue-500/20 active:scale-95">Edit</button>
                                          <button onClick={(e) => { e.stopPropagation(); handleDeleteOwnerExpense(o.id); }} className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 px-2 py-1.5 rounded-lg transition-colors border border-red-100 dark:border-red-500/20 active:scale-95">Hapus</button>
                                        </div>
                                      </div>
                                    </div>
                                 ))}
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
        </div>
      )}

      {activeTabOwner === "MONITORING" && (
        <UnitStatusWidget rowsSewa={rowsSewa} history={history} activeDate={activeDate} onVerifyActiveRental={onVerifyActiveRental} hargaItems={hargaItems} isVerifyingPayment={isVerifyingPayment} />
      )}

      {activeTabOwner === "ANALITIK" && (
        <div className="space-y-6">
          {/* Segmented Pill Switcher for Analitik Subpages */}
          <div className="flex justify-center z-30 relative">
            <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl border border-zinc-200/50 dark:border-white/5 shadow-inner">
              <button
                onClick={() => setAnalitikSubTab("PEMBUKUAN")}
                className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                  analitikSubTab === "PEMBUKUAN"
                    ? "bg-white dark:bg-[#2C2C2E] text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                Analitik Pembukuan
              </button>
              <button
                onClick={() => setAnalitikSubTab("LOGGING")}
                className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                  analitikSubTab === "LOGGING"
                    ? "bg-white dark:bg-[#2C2C2E] text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                Analitik Logging
              </button>
            </div>
          </div>

          {analitikSubTab === "PEMBUKUAN" ? (
            <>
          {/* 1. REKAP PEMASUKAN HARI INI */}
          <RekapPemasukan
            totalHarian={totalHarian}
            totalJajanan={totalJajanan}
            totalJasaAks={totalJasaAks}
            totalSewa={totalSewa}
            totalCash={totalCash}
            totalTransfer={totalTransfer}
            totalPengeluaran={totalPengeluaran}
            pendapatanBersih={pendapatanBersih}
          />

          <FilterComp
            mode={filterMode} setMode={setFilterMode} month={filterMonth} setMonth={setFilterMonth}
            rangeStart={rangeStart} setRangeStart={setRangeStart} rangeEnd={rangeEnd} setRangeEnd={setRangeEnd}
          />

          <Section title="Ringkasan Kinerja Periode Ini">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-4 mb-2">
              <div onClick={(e) => { e.stopPropagation(); setShowIncomeModal(true); }} className="cursor-pointer transition-transform active:scale-[0.97] hover:scale-[1.01]">
                <MetricCard
                  title="Pendapatan Kotor"
                  value={rupiah(labaKotor)}
                  icon={<TrendingUp className="text-blue-500" />}
                />
              </div>
              <div onClick={(e) => { e.stopPropagation(); setShowAnalitikModal(true); }} className="cursor-pointer transition-transform active:scale-[0.97] hover:scale-[1.01]">
                <MetricCard
                  title="Pengeluaran"
                  value={rupiah(totalPengeluaranBulanIni)}
                  icon={<TrendingDown className="text-red-500" />}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <MetricCard
                  title="Laba Bersih"
                  value={rupiah(labaBersih)}
                  icon={<DollarSign className="text-white" />}
                  variant={labaBersih >= 0 ? "profit" : "loss"}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mt-3">
              <MetricCard
                title="Cash"
                value={rupiah(totalCashFiltered)}
                icon={<DollarSign className="text-green-500" />}
                accentColor="green"
                compact
              />
              <MetricCard
                title="Transfer"
                value={rupiah(totalTransferFiltered)}
                icon={<Activity className="text-blue-500" />}
                accentColor="blue"
                compact
              />
              <MetricCard
                title="Transaksi"
                value={filteredHistory.length.toString()}
                icon={<Activity className="text-purple-500" />}
                subtitle="Hari"
                compact
              />
            </div>
          </Section>

          {/* INSIGHT & UTILISASI RENTAL */}
          <Section title="Insight Khusus Bisnis Rental">
            {/* Occupancy and Top Units */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
               {/* Occupancy Rate */}
               <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-black/20 flex flex-col items-center justify-center relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl origin-center group-hover:scale-150 transition-transform duration-500" />
                  <h3 className="text-[13px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5"><Activity className="w-4 h-4 text-blue-500" /> Tingkat Utilisasi Unit</h3>
                  
                  <div className="flex items-end gap-2 my-2 relative z-10">
                    <span className="text-4xl sm:text-5xl font-black text-zinc-900 dark:text-white tabular-nums tracking-tighter">
                      {occupancyData.percentage}<span className="text-2xl sm:text-3xl text-zinc-400">%</span>
                    </span>
                  </div>
                  
                  <div className="w-full max-w-[200px] h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-2 mb-3 relative z-10">
                    <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${occupancyData.percentage}%` }} />
                  </div>
                  
                  <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 text-center leading-relaxed relative z-10">
                    {filterMode === "Hari Ini" ? "Hari ini" : filterMode === "Bulan Ini" ? "Bulan ini" : filterMode === "7 Hari Terakhir" ? "7 hari terakhir" : filterMode === "Kustom" ? "Periode kustom ini" : "Bulan ini"} dirental <strong className="text-blue-500">{occupancyData.totalUsedHours}</strong> jam dari kapasitas puncak <strong className="text-zinc-900 dark:text-white">{occupancyData.maxCapacityHours}</strong> jam.
                    <br/>
                    <span className="text-[9px] text-zinc-400">(Estimasi berdasar {occupancyData.totalMachines} unit (PS3 & PS4) x 14 jam {(filterMode === "Hari Ini" || filterMode === "Semua Hari") ? "" : "x Hari Aktif"})</span>
                  </p>
               </div>

               {/* Top Performing Units */}
               <div className="bg-white dark:bg-[#1C1C1E] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-black/20 flex flex-col hover:border-emerald-500/30 transition-colors">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4 flex items-center gap-1.5"><Gamepad2 className="w-4 h-4 text-emerald-500" /> Unit Paling Laris</h3>
                  
                  <div className="flex flex-col gap-3.5 mt-1 flex-1 justify-center">
                    {topUnitsData.length > 0 ? topUnitsData.map((d, i) => {
                       const maxRev = topUnitsData[0].revenue;
                       const pct = Math.max(5, (d.revenue / maxRev) * 100);
                       return (
                         <div key={i} className="flex flex-col gap-1.5">
                           <div className="flex justify-between items-end">
                             <span className="text-[13px] font-bold text-zinc-900 dark:text-white">{d.unit}</span>
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] text-zinc-400 font-bold bg-zinc-100 dark:bg-zinc-800/50 px-1.5 rounded">{d.count}x Sewa</span>
                               <span className="text-[13px] font-black" style={{ color: d.fill }}>{rupiah(d.revenue)}</span>
                             </div>
                           </div>
                           <div className="w-full h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                             <div className="h-full rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${pct}%`, backgroundColor: d.fill }} />
                           </div>
                         </div>
                       )
                    }) : (
                       <p className="text-[12px] text-zinc-400 text-center italic py-4">Belum ada data rental untuk periode ini</p>
                    )}
                  </div>
               </div>
            </div>

            {/* Peak Hours & Maintenance Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               {/* Peak Hours Bar Chart */}
               <div className="bg-white dark:bg-[#1C1C1E] p-5 xl:p-6 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-black/20 min-h-[280px] flex flex-col hover:border-orange-500/30 transition-colors">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-6 flex items-center justify-between">
                     <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-orange-500" /> Analisis Jam Sibuk</span>
                     <span className="text-[10px] bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-lg font-bold">Heatmap Trend</span>
                  </h3>
                  <div className="flex-1 w-full h-[180px]">
                    {peakHoursData.some(d => d.count > 0) ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={peakHoursData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 600 }} dy={10} />
                          <Tooltip 
                            cursor={{ fill: 'rgba(249,115,22,0.05)', radius: 8 }} 
                            contentStyle={{ borderRadius: '16px', padding: '12px 16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)' }}
                            labelStyle={{ fontWeight: '900', color: '#18181b', marginBottom: '6px' }}
                            formatter={(value: number, name: string) => [
                              <span style={{ fontWeight: '800', color: name === 'revenue' ? '#10b981' : '#f97316' }}>{name === 'revenue' ? rupiah(value) : `${value} transaksi`}</span>, 
                              <span style={{ color: '#71717a', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{name === 'revenue' ? 'EST PENDAPATAN' : 'FREKUENSI KUNJUNGAN'}</span>
                            ]} 
                          />
                          <Bar dataKey="count" radius={[6,6,0,0]} maxBarSize={40}>
                            {peakHoursData.map((entry, index) => {
                               const maxCount = Math.max(...peakHoursData.map(d=>d.count));
                               const isPeak = entry.count >= maxCount * 0.8 && maxCount > 0;
                               return <Cell key={`cell-${index}`} fill={isPeak ? '#f97316' : '#fdba74'} style={{ transition: 'all 0.3s' }} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center opacity-50">
                        <Clock className="w-8 h-8 text-zinc-300 mb-2" />
                        <span className="text-[12px] font-medium text-zinc-400">Tidak ada data di jam ini</span>
                      </div>
                    )}
                  </div>
               </div>

               {/* Mini Maintenance Pie Chart */}
               <div className="bg-white dark:bg-[#1C1C1E] p-5 xl:p-6 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-black/20 flex flex-col hover:border-red-500/30 transition-colors">
                  <h3 className="text-[13px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4 flex items-center justify-between">
                     <span className="flex items-center gap-1.5"><Settings2 className="w-4 h-4 text-red-500" /> Breakdown Biaya</span>
                     <button onClick={() => setShowAnalitikModal(true)} className="text-[10px] bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 px-2.5 py-1 rounded-lg font-bold transition-colors">Lihat Detail</button>
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-6 flex-1 mt-2">
                    <div className="w-[140px] h-[140px] shrink-0 relative group">
                      {expenseChartData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height="100%">
                             <PieChart>
                               <Pie data={expenseChartData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                                 {expenseChartData.map((e, i) => <Cell key={`c-${i}`} fill={e.color} className="hover:opacity-80 transition-opacity outline-none" />)}
                               </Pie>
                             </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <TrendingDown className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
                          </div>
                        </>
                      ) : (
                         <div className="w-full h-full rounded-full border-[3px] border-dashed border-zinc-200 dark:border-white/10 flex items-center justify-center">
                           <span className="text-[10px] font-bold text-zinc-400">KOSONG</span>
                         </div>
                      )}
                    </div>
                    
                    <div className="flex-1 w-full max-w-sm flex flex-col gap-2.5 overflow-y-auto max-h-[160px] pr-2 custom-scrollbar">
                      {expenseChartData.map(e => {
                         const pct = totalPengeluaranBulanIni > 0 ? ((e.value / totalPengeluaranBulanIni) * 100).toFixed(1) : "0";
                         return (
                           <div key={e.name} className="flex flex-col gap-1 bg-zinc-50 dark:bg-[#18181A] p-2.5 rounded-[12px] border border-zinc-100 dark:border-white/5">
                             <div className="flex items-center justify-between gap-2">
                               <div className="flex items-center gap-2 overflow-hidden">
                                 <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{backgroundColor: e.color}} />
                                 <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 truncate">{e.name}</span>
                               </div>
                               <span className="text-[12px] font-black text-zinc-900 dark:text-white shrink-0">{rupiah(e.value)}</span>
                             </div>
                             <div className="flex items-center justify-between px-4">
                               <div className="flex-1 flex gap-px mr-3 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                 <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%`, backgroundColor: e.color }} />
                               </div>
                               <span className="text-[9px] font-bold" style={{ color: e.color }}>{pct}%</span>
                             </div>
                           </div>
                         );
                      })}
                      {expenseChartData.length === 0 && (
                         <p className="text-[12px] font-medium text-zinc-400 italic text-center sm:text-left mt-4">Belum ada pengeluaran tersimpan sesuai rentang tanggal.</p>
                      )}
                    </div>
                  </div>
               </div>
            </div>
          </Section>

          {/* 3. GRAFIK HARIAN */}
          <Grafik history={filteredHistory} filterMode={filterMode} />

          {/* AI BUSINESS INSIGHTS */}
          {aiInsights.length > 0 && (
            <Section title="AI Business Insights">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <Brain className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-500 dark:text-violet-400">Rekomendasi Otomatis</p>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">Berdasarkan data analitik periode filter aktif</p>
                  </div>
                </div>

                {/* Insight Cards */}
                {aiInsights.map((insight) => {
                  const severityStyles: Record<string, { border: string; bg: string; iconBg: string; badge: string; badgeText: string }> = {
                    critical: {
                      border: 'border-red-200 dark:border-red-900/40',
                      bg: 'bg-red-50/50 dark:bg-red-950/20',
                      iconBg: 'from-red-500 to-rose-600',
                      badge: 'bg-red-100 dark:bg-red-500/15',
                      badgeText: 'text-red-600 dark:text-red-400',
                    },
                    warning: {
                      border: 'border-amber-200 dark:border-amber-900/40',
                      bg: 'bg-amber-50/50 dark:bg-amber-950/20',
                      iconBg: 'from-amber-500 to-orange-500',
                      badge: 'bg-amber-100 dark:bg-amber-500/15',
                      badgeText: 'text-amber-600 dark:text-amber-400',
                    },
                    success: {
                      border: 'border-emerald-200 dark:border-emerald-900/40',
                      bg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
                      iconBg: 'from-emerald-500 to-teal-500',
                      badge: 'bg-emerald-100 dark:bg-emerald-500/15',
                      badgeText: 'text-emerald-600 dark:text-emerald-400',
                    },
                    info: {
                      border: 'border-blue-200 dark:border-blue-900/40',
                      bg: 'bg-blue-50/50 dark:bg-blue-950/20',
                      iconBg: 'from-blue-500 to-cyan-500',
                      badge: 'bg-blue-100 dark:bg-blue-500/15',
                      badgeText: 'text-blue-600 dark:text-blue-400',
                    },
                  };
                  const s = severityStyles[insight.severity] || severityStyles.info;

                  const typeLabels: Record<string, { icon: React.ReactNode; label: string }> = {
                    financial_health: { icon: <DollarSign className="w-3.5 h-3.5" />, label: 'Financial Health' },
                    asset_optimization: { icon: <Target className="w-3.5 h-3.5" />, label: 'Asset Optimization' },
                    peak_strategy: { icon: <BarChart3 className="w-3.5 h-3.5" />, label: 'Peak Strategy' },
                  };
                  const typeInfo = typeLabels[insight.type] || typeLabels.financial_health;

                  return (
                    <div
                      key={insight.id}
                      className={`relative overflow-hidden rounded-[20px] border ${s.border} ${s.bg} p-4 sm:p-5 transition-all duration-300 hover:shadow-lg group`}
                    >
                      {/* Glow effect */}
                      <div className={`absolute -top-8 -right-8 w-28 h-28 bg-gradient-to-br ${s.iconBg} opacity-[0.07] rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700`} />

                      <div className="relative z-10">
                        {/* Top row: Category badge + Metric */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className={`flex items-center gap-1.5 ${s.badge} ${s.badgeText} px-2.5 py-1 rounded-lg`}>
                            {typeInfo.icon}
                            <span className="text-[10px] font-bold uppercase tracking-wider">{typeInfo.label}</span>
                          </div>
                          {insight.metric && (
                            <span className={`text-[13px] font-black tabular-nums ${s.badgeText}`}>
                              {insight.metric}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="text-[14px] sm:text-[15px] font-bold text-zinc-900 dark:text-white leading-snug mb-1.5">
                          {insight.title}
                        </h4>

                        {/* Body */}
                        <p className="text-[12px] sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                          {insight.body}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Footer */}
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 tracking-wide">Insights dihasilkan otomatis dari data analitik Anda</span>
                </div>
              </div>
            </Section>
          )}

          {/* HISTORY PEMBUKUAN */}
          <HistoryPembukuan items={filteredHistory} isOwner={true} />
            </>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
              <div className="bg-white dark:bg-black text-zinc-800 dark:text-zinc-300 font-mono text-[13px] border border-zinc-200 dark:border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                 {/* Console Header Bar */}
                 <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-900 pb-3 mb-4 select-none">
                    <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                       <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                       <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                       <span className="ml-2 text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider text-[10px]">System Audit Terminal v1.0</span>
                    </div>
                    <div className="text-emerald-600 dark:text-emerald-500 text-[10px] font-bold flex items-center gap-1.5">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                       STATUS: ONLINE
                    </div>
                 </div>

                 {/* Filter Controls (Console Style) */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 border-b border-zinc-200 dark:border-zinc-900/60 pb-4">
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-black tracking-widest">&gt; Filter Operator</label>
                       <select 
                         value={filterEmail} 
                         onChange={(e) => setFilterEmail(e.target.value)}
                         className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-800 dark:text-zinc-300 outline-none focus:border-emerald-500 transition-colors text-xs font-mono"
                       >
                          <option value="Semua" className="bg-white dark:bg-[#1C1C1E] text-zinc-800 dark:text-zinc-300">Semua Operator (Admin/Owner)</option>
                          {adminEmails.map(email => (
                             <option key={email} value={email} className="bg-white dark:bg-[#1C1C1E] text-zinc-800 dark:text-zinc-300">{email}</option>
                          ))}
                       </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                       <label className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-black tracking-widest">&gt; Filter Action</label>
                       <select 
                         value={filterAction} 
                         onChange={(e) => setFilterAction(e.target.value)}
                         className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-800 dark:text-zinc-300 outline-none focus:border-emerald-500 transition-colors text-xs font-mono"
                       >
                          <option value="Semua" className="bg-white dark:bg-[#1C1C1E] text-zinc-800 dark:text-zinc-300">Semua Aktivitas</option>
                          <option value="CREATE" className="bg-white dark:bg-[#1C1C1E] text-zinc-800 dark:text-zinc-300">CREATE / TAMBAH</option>
                          <option value="UPDATE" className="bg-white dark:bg-[#1C1C1E] text-zinc-800 dark:text-zinc-300">UPDATE / EDIT</option>
                          <option value="DELETE" className="bg-white dark:bg-[#1C1C1E] text-zinc-800 dark:text-zinc-300">DELETE / HAPUS</option>
                       </select>
                    </div>
                 </div>

                 {/* Main Console Output */}
                 {loadingLogs ? (
                    <div className="py-12 text-center text-zinc-450 dark:text-zinc-500 italic space-y-1.5">
                       <div className="animate-pulse">&gt; Initializing secure database connection ...</div>
                       <div className="animate-pulse" style={{ animationDelay: '200ms' }}>&gt; Fetching live stream activity logs ...</div>
                    </div>
                 ) : groupedLogs.length === 0 ? (
                    <div className="py-12 text-center text-zinc-450 dark:text-zinc-500 italic">
                       &gt; Connection established. No activity logs found matching the selected filters.
                    </div>
                 ) : (
                    <div className="space-y-4">
                       {groupedLogs.map(monthGroup => {
                          const isMonthExpanded = expandedMonths.includes(monthGroup.key);
                          return (
                             <div key={monthGroup.key} className="border border-zinc-200 dark:border-zinc-900/60 rounded-2xl overflow-hidden bg-zinc-100/50 dark:bg-zinc-900/10">
                                <div 
                                  onClick={() => toggleMonth(monthGroup.key)}
                                  className="flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900/30 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 cursor-pointer transition-colors border-b border-zinc-200 dark:border-zinc-900/40 select-none"
                                >
                                   <div className="flex items-center gap-2">
                                      <span className="text-zinc-455 dark:text-zinc-600 transition-transform duration-200 inline-block font-bold" style={{ transform: isMonthExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">{monthGroup.key}</span>
                                   </div>
                                   <span className="text-[9px] text-zinc-400 dark:text-zinc-600 uppercase font-black tracking-widest">Month Group</span>
                                </div>

                                {isMonthExpanded && (
                                   <div className="p-3 bg-black/[0.03] dark:bg-black/10 space-y-3">
                                      {monthGroup.weeks.map(weekGroup => {
                                         const isWeekExpanded = expandedWeeks.includes(weekGroup.key);
                                         return (
                                            <div key={weekGroup.key} className="border border-zinc-200 dark:border-zinc-900/40 rounded-xl overflow-hidden ml-3 bg-zinc-100/40 dark:bg-zinc-900/5">
                                               <div 
                                                 onClick={() => toggleWeek(weekGroup.key)}
                                                 className="flex items-center justify-between p-3 bg-zinc-100/50 dark:bg-zinc-900/20 hover:bg-zinc-200/55 dark:hover:bg-zinc-900/40 cursor-pointer transition-colors border-b border-zinc-200 dark:border-zinc-900/30 select-none"
                                               >
                                                  <div className="flex items-center gap-2">
                                                     <span className="text-zinc-400 dark:text-zinc-600 transition-transform duration-200 inline-block font-bold" style={{ transform: isWeekExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                                     <span className="text-sky-600 dark:text-sky-400 font-bold">{weekGroup.weekLabel}</span>
                                                  </div>
                                                  <span className="text-[9px] text-zinc-400 dark:text-zinc-600 uppercase font-black tracking-widest">Week Group</span>
                                               </div>

                                               {isWeekExpanded && (
                                                  <div className="p-2 bg-black/[0.02] dark:bg-black/5 space-y-2">
                                                     {weekGroup.days.map(dayGroup => {
                                                        const isDayExpanded = expandedDays.includes(dayGroup.key);
                                                        return (
                                                           <div key={dayGroup.key} className="border border-zinc-200 dark:border-zinc-900/30 rounded-lg overflow-hidden ml-3">
                                                              <div 
                                                                onClick={() => toggleDay(dayGroup.key)}
                                                                className="flex items-center justify-between p-2.5 bg-zinc-100/60 dark:bg-zinc-900/10 hover:bg-zinc-200/50 dark:hover:bg-zinc-900/30 cursor-pointer transition-colors border-b border-zinc-200 dark:border-zinc-900/20 select-none"
                                                              >
                                                                 <div className="flex items-center gap-2">
                                                                    <span className="text-zinc-400 dark:text-zinc-600 transition-transform duration-200 inline-block font-bold" style={{ transform: isDayExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                                                                    <span className="text-zinc-800 dark:text-zinc-300 font-bold">{dayGroup.dayLabel}</span>
                                                                 </div>
                                                                 <span className="text-[9px] text-zinc-500 dark:text-zinc-600 font-bold uppercase tracking-wider">({dayGroup.logs.length} logs)</span>
                                                              </div>

                                                              {isDayExpanded && (
                                                                 <div className="p-2 space-y-2 bg-black/[0.03] dark:bg-black/10">
                                                                    {dayGroup.logs.map(log => {
                                                                       const isDetailsExpanded = expandedLogDetails.includes(log.id);
                                                                       
                                                                       let actionColor = "text-emerald-600 dark:text-emerald-400";
                                                                       let actionBg = "bg-emerald-500/10 border-emerald-500/20";
                                                                       let actionLabel = "TAMBAH";
                                                                       if (log.action === "UPDATE") {
                                                                         actionColor = "text-amber-600 dark:text-amber-400";
                                                                         actionBg = "bg-amber-500/10 border-amber-500/20";
                                                                         actionLabel = " EDIT ";
                                                                       } else if (log.action === "DELETE") {
                                                                         actionColor = "text-red-600 dark:text-red-400";
                                                                         actionBg = "bg-red-500/10 border-red-500/20";
                                                                         actionLabel = "HAPUS ";
                                                                       }

                                                                       return (
                                                                          <div key={log.id} className="p-3 border border-zinc-200 dark:border-zinc-900/60 rounded-lg bg-zinc-50 dark:bg-black/20 hover:bg-zinc-100 dark:hover:bg-zinc-900/5 transition-colors">
                                                                             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                                                                <div className="flex items-center flex-wrap gap-2 text-xs">
                                                                                   <span className="text-zinc-400 dark:text-zinc-500 font-bold">[{formatLogTime(log.timestamp)}]</span>
                                                                                   <span className={`px-1.5 py-0.5 rounded border text-[9px] font-black tracking-wider ${actionColor} ${actionBg}`}>{actionLabel}</span>
                                                                                   <span className="text-sky-600 dark:text-sky-400/90 font-bold">{log.email}</span>
                                                                                   <span className="text-zinc-550 dark:text-zinc-400 font-medium">melakukan CRUD:</span>
                                                                                   <span className="text-zinc-700 dark:text-zinc-350 underline underline-offset-2 decoration-zinc-300 dark:decoration-zinc-700 decoration-dashed">{log.targetDay}, {log.targetDate}</span>
                                                                                </div>
                                                                                <button 
                                                                                  onClick={() => toggleLogDetails(log.id)}
                                                                                  className="text-[9px] bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1 rounded-md font-bold transition-all active:scale-95 uppercase tracking-wider"
                                                                                >
                                                                                   {isDetailsExpanded ? "Hide Detail" : "Show Detail"}
                                                                                </button>
                                                                             </div>

                                                                             {isDetailsExpanded && (
                                                                                <div className="mt-3 border-t border-dashed border-zinc-200 dark:border-zinc-900/80 pt-3 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1 max-w-sm animate-in fade-in slide-in-from-top-1 duration-200">
                                                                                   <div className="text-zinc-400 dark:text-zinc-650 font-black">+------------------------------------------+</div>
                                                                                   <div className="flex justify-between px-2">
                                                                                      <span>| TOTAL PENDAPATAN</span>
                                                                                      <span className="text-zinc-800 dark:text-zinc-300 font-bold">: {rupiah(log.details?.totalIncome || 0)}</span>
                                                                                   </div>
                                                                                   <div className="flex justify-between px-2">
                                                                                      <span>| CASH</span>
                                                                                      <span className="text-zinc-800 dark:text-zinc-300 font-bold">: {rupiah(log.details?.totalCash || 0)}</span>
                                                                                   </div>
                                                                                   <div className="flex justify-between px-2">
                                                                                      <span>| TRANSFER</span>
                                                                                      <span className="text-zinc-800 dark:text-zinc-300 font-bold">: {rupiah(log.details?.totalTransfer || 0)}</span>
                                                                                   </div>
                                                                                   <div className="flex justify-between px-2">
                                                                                      <span>| PENGELUARAN</span>
                                                                                      <span className="text-zinc-800 dark:text-zinc-300 font-bold">: {rupiah(log.details?.totalPengeluaran || 0)}</span>
                                                                                   </div>
                                                                                   <div className="text-zinc-400 dark:text-zinc-650 font-black">+------------------------------------------+</div>
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
              </div>
            </div>
          )}
        </div>
      )}

      {activeTabOwner === "PEGAWAI" && (
        <div className="space-y-6">
          {/* Segmented Pill Switcher for Pegawai Subpages */}
          <div className="flex justify-center z-10 relative">
            <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl border border-zinc-200/50 dark:border-white/5 shadow-inner">
              <button
                onClick={() => setPegawaiSubTab("DASHBOARD")}
                className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                  pegawaiSubTab === "DASHBOARD"
                    ? "bg-white dark:bg-[#2C2C2E] text-pink-600 dark:text-pink-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                Dashboard Pegawai
              </button>
              <button
                onClick={() => setPegawaiSubTab("REQUEST")}
                className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
                  pegawaiSubTab === "REQUEST"
                    ? "bg-white dark:bg-[#2C2C2E] text-pink-600 dark:text-pink-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                Request Pegawai
              </button>
            </div>
          </div>

          {pegawaiSubTab === "DASHBOARD" ? (
            <div className="animate-in fade-in duration-200">
              <TabPegawai history={history} isOwner={true} />
            </div>
          ) : (
            <div className="animate-in fade-in duration-200 space-y-6">
              <Section title="Permintaan Edit Pembukuan Karyawan">
                {loadingRequests ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
                  </div>
                ) : editRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-[#1C1C1E] border border-zinc-200/50 dark:border-white/5 rounded-2xl text-center">
                    <AlertCircle className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-bold">Tidak ada request edit dari pegawai.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {editRequests.map((req) => {
                      const isPending = req.status === "pending";
                      const isApproved = req.status === "approved";
                      const isRejected = req.status === "rejected";

                      const getTotals = (data: any) => {
                        if (!data) return { income: 0, cash: 0, transfer: 0, expense: 0 };
                        const harian = toNum(data.totalHarian);
                        const jajanan = toNum(data.totalJajanan);
                        const jasa = toNum(data.totalJasaAks);
                        const sewa = toNum(data.totalSewa);
                        const cash = toNum(data.totalCash);
                        const transfer = toNum(data.totalTransfer);
                        const expense = (data.rowsPengeluaran || []).reduce((sum: number, r: any) => sum + toNum(r.harga), 0);
                        return {
                          income: harian + jajanan + jasa + sewa,
                          cash,
                          transfer,
                          expense
                        };
                      };

                      const orig = getTotals(req.originalData);
                      const prop = getTotals(req.proposedData);

                      return (
                        <div key={req.id} className="p-5 bg-white dark:bg-[#1C1C1E] border border-zinc-200/50 dark:border-white/5 rounded-2xl shadow-sm hover:shadow-md transition-all">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/80">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-zinc-900 dark:text-white">{req.requestedBy}</span>
                                {isPending && (
                                  <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full">
                                    Pending
                                  </span>
                                )}
                                {isApproved && (
                                  <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full">
                                    Approved
                                  </span>
                                )}
                                {isRejected && (
                                  <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-full">
                                    Rejected
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-555 mt-1 font-medium">
                                Dikirim: {new Date(req.requestedAt).toLocaleString("id-ID")}
                              </p>
                            </div>
                            <div className="text-left sm:text-right">
                              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-0.5">Target Pembukuan</span>
                              <span className="text-sm font-black text-rose-500 dark:text-rose-400">{req.hari}, {req.tanggal}</span>
                            </div>
                          </div>

                          {/* Quick Comparison Card */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-555 uppercase tracking-wider">Pendapatan Kotor</span>
                              <div className="flex flex-col text-xs font-bold">
                                <span className="text-zinc-400 dark:text-zinc-650 line-through">{rupiah(orig.income)}</span>
                                <span className={`text-xs sm:text-sm font-black ${prop.income !== orig.income ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-700 dark:text-zinc-300"}`}>{rupiah(prop.income)}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-555 uppercase tracking-wider">Total Cash</span>
                              <div className="flex flex-col text-xs font-bold">
                                <span className="text-zinc-400 dark:text-zinc-650 line-through">{rupiah(orig.cash)}</span>
                                <span className={`text-xs sm:text-sm font-black ${prop.cash !== orig.cash ? "text-amber-600 dark:text-amber-400" : "text-zinc-700 dark:text-zinc-300"}`}>{rupiah(prop.cash)}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-555 uppercase tracking-wider">Total Transfer</span>
                              <div className="flex flex-col text-xs font-bold">
                                <span className="text-zinc-400 dark:text-zinc-650 line-through">{rupiah(orig.transfer)}</span>
                                <span className={`text-xs sm:text-sm font-black ${prop.transfer !== orig.transfer ? "text-sky-600 dark:text-sky-400" : "text-zinc-700 dark:text-zinc-300"}`}>{rupiah(prop.transfer)}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-555 uppercase tracking-wider">Pengeluaran</span>
                              <div className="flex flex-col text-xs font-bold">
                                <span className="text-zinc-400 dark:text-zinc-650 line-through">{rupiah(orig.expense)}</span>
                                <span className={`text-xs sm:text-sm font-black ${prop.expense !== orig.expense ? "text-rose-600 dark:text-rose-400" : "text-zinc-700 dark:text-zinc-300"}`}>{rupiah(prop.expense)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="text-xs font-bold text-zinc-500 hover:text-zinc-850 dark:text-zinc-400 dark:hover:text-white px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 transition-colors flex items-center gap-1.5 active:scale-95"
                            >
                              <Activity className="w-3.5 h-3.5" />
                              Bandingkan Detail
                            </button>

                            {isPending && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRejectRequest(req)}
                                  className="px-4 py-2 text-xs font-black text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-all active:scale-95"
                                >
                                  Tolak
                                </button>
                                <button
                                  onClick={() => handleApproveRequest(req)}
                                  className="px-4 py-2 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 rounded-xl transition-all active:scale-95"
                                >
                                  ACC
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Section>
            </div>
          )}
        </div>
      )}

      {activeTabOwner === "STOK" && (
        <>
          {/* ALERT STOK MENIPIS */}
          {lowStockItems.length > 0 && (
            <Section title="⚠️ Stok Menipis (Butuh Restock)">
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 sm:p-6 overflow-x-auto">
                <div className="flex flex-col gap-3">
                  {lowStockItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-[#1c1c1e] border border-red-100 dark:border-red-900/30 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{item.item}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.type} - {item.kategori}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold px-3 py-1 rounded-lg">
                        Sisa {item.jumlah}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* GRAFIK STOK */}
          <Section title="Pantauan Stok (Bottom 15)">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] p-5 border border-zinc-200 dark:border-white/10 shadow-sm">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-4 tracking-wide uppercase">Stok Rental</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rentalChartData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDark ? "#333" : "#f0f0f0"} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "#666", fontSize: 10 }} width={90} />
                      <Tooltip cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }} contentStyle={{ borderRadius: '12px', background: isDark ? '#1C1C1E' : '#fff', border: isDark ? '1px solid #333' : '1px solid #eaeaea', color: isDark ? '#fff' : '#000' }} itemStyle={{ color: isDark ? '#a1a1aa' : '#52525b' }} />
                      <Bar dataKey="jumlah" radius={[0, 4, 4, 0]} barSize={12}>
                        {rentalChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getStokColor(entry.jumlah, isDark)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-[#1c1c1e] rounded-[24px] p-5 border border-zinc-200 dark:border-white/10 shadow-sm">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-4 tracking-wide uppercase">Stok Usaha</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={jualanChartData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={isDark ? "#333" : "#f0f0f0"} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: "#666", fontSize: 10 }} width={90} />
                      <Tooltip cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }} contentStyle={{ borderRadius: '12px', background: isDark ? '#1C1C1E' : '#fff', border: isDark ? '1px solid #333' : '1px solid #eaeaea', color: isDark ? '#fff' : '#000' }} itemStyle={{ color: isDark ? '#a1a1aa' : '#52525b' }} />
                      <Bar dataKey="jumlah" radius={[0, 4, 4, 0]} barSize={12}>
                        {jualanChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getStokColor(entry.jumlah, isDark)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </Section>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: RINCIAN PENGELUARAN (Apple HIG Design) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showAnalitikModal && (
        <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xl" onClick={() => { setShowAnalitikModal(false); setSelectedCategory(null); }} />
          <div className="relative w-full sm:w-[95%] sm:max-w-[960px] max-h-[92vh] sm:max-h-[85vh] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl sm:rounded-2xl rounded-t-[20px] overflow-hidden flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/10 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 z-10">

            {/* SF-Style Drag Handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>

            {/* Header */}
            <div className="px-5 sm:px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-[17px] sm:text-[20px] font-bold tracking-tight text-zinc-900 dark:text-white">Rincian Pengeluaran</h2>
                <p className="text-[12px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} · {combinedExpensesBulanIni.length} transaksi</p>
              </div>
              <button
                onClick={() => { setShowAnalitikModal(false); setSelectedCategory(null); }}
                className="w-[30px] h-[30px] flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-[13px] font-bold"
              >✕</button>
            </div>

            {/* Thin separator */}
            <div className="h-px bg-zinc-200/60 dark:bg-white/5 mx-5 sm:mx-6" />

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>

              {/* Chart + Categories */}
              <div className="px-5 sm:px-6 pt-5 pb-3">
                <div className="flex flex-col md:flex-row gap-6 items-start">

                  {/* Donut Chart */}
                  <div className="w-full md:w-[260px] shrink-0 flex flex-col items-center">
                    <div className="h-[240px] w-[240px] relative mx-auto">
                      {expenseChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={expenseChartData}
                              cx="50%" cy="50%"
                              innerRadius={65} outerRadius={95}
                              paddingAngle={3} dataKey="value" stroke="none"
                              style={{ cursor: 'pointer', outline: 'none' }}
                              onClick={(_: any, idx: number) => {
                                const cat = expenseChartData[idx]?.name;
                                setSelectedCategory(prev => prev === cat ? null : cat);
                              }}
                            >
                              {expenseChartData.map((e, i) => (
                                <Cell key={`c-${i}`} fill={e.color}
                                  opacity={selectedCategory ? (selectedCategory === e.name ? 1 : 0.25) : 1}
                                  style={{ transition: 'opacity 0.4s cubic-bezier(.4,0,.2,1)', cursor: 'pointer' }}
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val: number) => rupiah(val)} contentStyle={{ borderRadius: '14px', background: isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', backdropFilter: 'blur(20px)', fontSize: 12, fontWeight: 600, padding: '8px 14px', color: isDark ? '#fff' : '#000' }} itemStyle={{ color: isDark ? '#d4d4d8' : '#3f3f46' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[13px] font-medium text-zinc-400">Belum ada data</div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                        <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-md">
                          <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest leading-none mb-0.5">Total</span>
                          <span className="text-[13px] font-bold text-red-500 dark:text-red-400 tabular-nums">{rupiah(totalPengeluaranBulanIni)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">Ketuk segmen untuk filter</p>
                  </div>

                  {/* Category Cards */}
                  <div className="flex-1 w-full">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {expenseChartData.map((cat) => {
                        const isActive = selectedCategory === cat.name;
                        const pct = totalPengeluaranBulanIni > 0 ? ((cat.value / totalPengeluaranBulanIni) * 100).toFixed(1) : "0";
                        const count = combinedExpensesBulanIni.filter(x => x.kategori === cat.name).length;
                        return (
                          <button
                            key={cat.name}
                            onClick={() => setSelectedCategory(prev => prev === cat.name ? null : cat.name)}
                            className={`relative overflow-hidden p-3 rounded-[14px] text-left transition-all duration-300 active:scale-[0.96] ${
                              isActive ? "shadow-md" : "hover:shadow-sm"
                            }`}
                            style={{
                              backgroundColor: isActive ? (isDark ? `${cat.color}18` : `${cat.color}10`) : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'),
                              border: `1px solid ${isActive ? cat.color : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}`,
                              boxShadow: isActive ? `0 0 0 1.5px ${cat.color}, 0 4px 16px ${cat.color}20` : undefined,
                            }}
                          >
                            <div className="absolute top-0 left-0 right-0 h-[2.5px]" style={{ backgroundColor: cat.color, opacity: isActive ? 1 : 0.5 }} />
                            <div className="flex items-center gap-1.5 mb-1.5 mt-0.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 truncate">{cat.name}</span>
                            </div>
                            <div className="flex items-end justify-between">
                              <span className="text-[13px] font-bold text-zinc-900 dark:text-white tabular-nums">{rupiah(cat.value)}</span>
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold tabular-nums" style={{ color: cat.color }}>{pct}%</span>
                                <span className="text-[9px] text-zinc-400 font-medium">{count}x</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section Divider */}
              <div className="mx-5 sm:mx-6 flex items-center gap-3 my-3">
                <div className="h-px flex-1 bg-zinc-200/50 dark:bg-white/5" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {selectedCategory || "Semua Transaksi"}
                </span>
                <div className="h-px flex-1 bg-zinc-200/50 dark:bg-white/5" />
              </div>

              {/* Detail / Full List */}
              <div className="px-5 sm:px-6 pb-6">
                {selectedCategory ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${getCategoryColor(selectedCategory)}15` }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(selectedCategory) }} />
                        </div>
                        <div>
                          <h4 className="text-[15px] font-bold text-zinc-900 dark:text-white leading-tight">{selectedCategory}</h4>
                          <p className="text-[11px] text-zinc-400">{selectedCategoryItems.length} transaksi</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[17px] font-bold tabular-nums" style={{ color: getCategoryColor(selectedCategory) }}>
                          {rupiah(selectedCategoryItems.reduce((s, x) => s + x.harga, 0))}
                        </span>
                        <button onClick={() => setSelectedCategory(null)} className="block text-[11px] font-semibold text-blue-500 hover:text-blue-400 transition-colors mt-0.5">← Semua</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {selectedCategoryItems.map((o, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2.5 px-3 rounded-xl transition-colors" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-mono font-semibold text-zinc-400">{formatDateShort(o.tanggal)}</span>
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${o.source === "owner" ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"}`}>{o.source === "owner" ? "OWNER" : "ADMIN"}</span>
                            </div>
                            <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">{o.nama}</span>
                          </div>
                          <span className="text-[13px] font-bold shrink-0 tabular-nums ml-3" style={{ color: getCategoryColor(selectedCategory) }}>-{rupiah(o.harga)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {combinedExpensesBulanIni.length === 0 && <p className="text-zinc-400 text-[13px] py-8 text-center font-medium">Tidak ada pengeluaran bulan ini.</p>}
                    {combinedExpensesBulanIni.map((o, idx) => {
                      const catColor = getCategoryColor(o.kategori);
                      return (
                        <div key={idx}
                          className="flex justify-between items-center py-2.5 px-3 rounded-xl cursor-pointer transition-colors"
                          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                          onClick={() => setSelectedCategory(o.kategori)}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-[3px] h-8 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-mono font-semibold text-zinc-400">{formatDateShort(o.tanggal)}</span>
                                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${o.source === "owner" ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"}`}>{o.source === "owner" ? "OWNER" : "ADMIN"}</span>
                              </div>
                              <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">{o.nama}</span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                                <span className="text-[10px] font-medium" style={{ color: catColor }}>{o.kategori}</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[13px] font-bold text-red-500 shrink-0 tabular-nums ml-3">-{rupiah(o.harga)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: RINCIAN PENDAPATAN (Apple HIG Design) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xl" onClick={() => { setShowIncomeModal(false); setSelectedIncomeCategory(null); }} />
          <div className="relative w-full sm:w-[95%] sm:max-w-[960px] max-h-[92vh] sm:max-h-[85vh] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl sm:rounded-2xl rounded-t-[20px] overflow-hidden flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/10 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 z-10">

            {/* Drag Handle */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>

            {/* Header */}
            <div className="px-5 sm:px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-[17px] sm:text-[20px] font-bold tracking-tight text-zinc-900 dark:text-white">Rincian Pendapatan Kotor</h2>
                <p className="text-[12px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })} · {combinedIncomeBulanIni.length} transaksi</p>
              </div>
              <button
                onClick={() => { setShowIncomeModal(false); setSelectedIncomeCategory(null); }}
                className="w-[30px] h-[30px] flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-[13px] font-bold"
              >✕</button>
            </div>

            <div className="h-px bg-zinc-200/60 dark:bg-white/5 mx-5 sm:mx-6" />

            {/* Content */}
            <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>

              {/* Chart + Categories */}
              <div className="px-5 sm:px-6 pt-5 pb-3">
                <div className="flex flex-col md:flex-row gap-6 items-start">

                  {/* Donut */}
                  <div className="w-full md:w-[260px] shrink-0 flex flex-col items-center">
                    <div className="h-[240px] w-[240px] relative mx-auto">
                      {incomeChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={incomeChartData}
                              cx="50%" cy="50%"
                              innerRadius={65} outerRadius={95}
                              paddingAngle={3} dataKey="value" stroke="none"
                              style={{ cursor: 'pointer', outline: 'none' }}
                              onClick={(_: any, idx: number) => {
                                const cat = incomeChartData[idx]?.name;
                                setSelectedIncomeCategory(prev => prev === cat ? null : cat);
                              }}
                            >
                              {incomeChartData.map((e, i) => (
                                <Cell key={`ic-${i}`} fill={e.color}
                                  opacity={selectedIncomeCategory ? (selectedIncomeCategory === e.name ? 1 : 0.25) : 1}
                                  style={{ transition: 'opacity 0.4s cubic-bezier(.4,0,.2,1)', cursor: 'pointer' }}
                                />
                              ))}
                            </Pie>
                            <Tooltip formatter={(val: number) => rupiah(val)} contentStyle={{ borderRadius: '14px', background: isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.96)', border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', backdropFilter: 'blur(20px)', fontSize: 12, fontWeight: 600, padding: '8px 14px', color: isDark ? '#fff' : '#000' }} itemStyle={{ color: isDark ? '#d4d4d8' : '#3f3f46' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[13px] font-medium text-zinc-400">Belum ada data</div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                        <div className="flex flex-col items-center px-3 py-1.5 rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-md">
                          <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest leading-none mb-0.5">Total</span>
                          <span className="text-[13px] font-bold text-emerald-500 dark:text-emerald-400 tabular-nums">{rupiah(totalPemasukanBulanIni)}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-2">Ketuk segmen untuk filter</p>
                  </div>

                  {/* Category Cards */}
                  <div className="flex-1 w-full">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {incomeChartData.map((cat) => {
                        const isActive = selectedIncomeCategory === cat.name;
                        const pct = totalPemasukanBulanIni > 0 ? ((cat.value / totalPemasukanBulanIni) * 100).toFixed(1) : "0";
                        const count = combinedIncomeBulanIni.filter(x => x.kategori === cat.name).length;
                        return (
                          <button
                            key={cat.name}
                            onClick={() => setSelectedIncomeCategory(prev => prev === cat.name ? null : cat.name)}
                            className={`relative overflow-hidden p-3 rounded-[14px] text-left transition-all duration-300 active:scale-[0.96] ${
                              isActive ? "shadow-md" : "hover:shadow-sm"
                            }`}
                            style={{
                              backgroundColor: isActive ? (isDark ? `${cat.color}18` : `${cat.color}10`) : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'),
                              border: `1px solid ${isActive ? cat.color : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}`,
                              boxShadow: isActive ? `0 0 0 1.5px ${cat.color}, 0 4px 16px ${cat.color}20` : undefined,
                            }}
                          >
                            <div className="absolute top-0 left-0 right-0 h-[2.5px]" style={{ backgroundColor: cat.color, opacity: isActive ? 1 : 0.5 }} />
                            <div className="flex items-center gap-1.5 mb-1.5 mt-0.5">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 truncate">{cat.name}</span>
                            </div>
                            <div className="flex items-end justify-between">
                              <span className="text-[13px] font-bold text-zinc-900 dark:text-white tabular-nums">{rupiah(cat.value)}</span>
                              <div className="flex flex-col items-end">
                                <span className="text-[9px] font-bold tabular-nums" style={{ color: cat.color }}>{pct}%</span>
                                <span className="text-[9px] text-zinc-400 font-medium">{count}x</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-5 sm:mx-6 flex items-center gap-3 my-3">
                <div className="h-px flex-1 bg-zinc-200/50 dark:bg-white/5" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {selectedIncomeCategory || "Semua Pendapatan"}
                </span>
                <div className="h-px flex-1 bg-zinc-200/50 dark:bg-white/5" />
              </div>

              {/* List */}
              <div className="px-5 sm:px-6 pb-6">
                {selectedIncomeCategory ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${getIncomeColor(selectedIncomeCategory)}15` }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getIncomeColor(selectedIncomeCategory) }} />
                        </div>
                        <div>
                          <h4 className="text-[15px] font-bold text-zinc-900 dark:text-white leading-tight">{selectedIncomeCategory}</h4>
                          <p className="text-[11px] text-zinc-400">{selectedIncomeCategoryItems.length} transaksi</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[17px] font-bold tabular-nums" style={{ color: getIncomeColor(selectedIncomeCategory) }}>
                          {rupiah(selectedIncomeCategoryItems.reduce((s, x) => s + x.harga, 0))}
                        </span>
                        <button onClick={() => setSelectedIncomeCategory(null)} className="block text-[11px] font-semibold text-blue-500 hover:text-blue-400 transition-colors mt-0.5">← Semua</button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {selectedIncomeCategoryItems.map((o, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2.5 px-3 rounded-xl transition-colors" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-mono font-semibold text-zinc-400">{formatDateShort(o.tanggal)}</span>
                              <span className="text-[10px] font-medium text-zinc-400 capitalize">{o.hari}</span>
                            </div>
                            <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">{o.nama}</span>
                            {o.bayar && <span className={`text-[10px] font-bold mt-0.5 ${o.bayar.toLowerCase().includes('cash') ? 'text-green-500' : 'text-blue-500'}`}>{o.bayar}</span>}
                          </div>
                          <span className="text-[13px] font-bold shrink-0 tabular-nums ml-3" style={{ color: getIncomeColor(selectedIncomeCategory) }}>+{rupiah(o.harga)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {combinedIncomeBulanIni.length === 0 && <p className="text-zinc-400 text-[13px] py-8 text-center font-medium">Tidak ada pendapatan bulan ini.</p>}
                    {combinedIncomeBulanIni.map((o, idx) => {
                      const catColor = getIncomeColor(o.kategori);
                      return (
                        <div key={idx}
                          className="flex justify-between items-center py-2.5 px-3 rounded-xl cursor-pointer transition-colors"
                          style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                          onClick={() => setSelectedIncomeCategory(o.kategori)}
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="w-[3px] h-8 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-mono font-semibold text-zinc-400">{formatDateShort(o.tanggal)}</span>
                                <span className="text-[10px] font-medium text-zinc-400 capitalize">{o.hari}</span>
                              </div>
                              <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">{o.nama}</span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                                <span className="text-[10px] font-medium" style={{ color: catColor }}>{o.kategori}</span>
                                {o.bayar && <span className={`text-[9px] font-bold ml-2 ${o.bayar.toLowerCase().includes('cash') ? 'text-green-500' : 'text-blue-500'}`}>· {o.bayar}</span>}
                              </div>
                            </div>
                          </div>
                          <span className="text-[13px] font-bold text-emerald-500 shrink-0 tabular-nums ml-3">+{rupiah(o.harga)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL: BANDINGKAN DETAIL REQUEST EDIT */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {selectedRequest && (() => {
        const req = selectedRequest;
        const isPending = req.status === "pending";
        return (
          <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xl" onClick={() => setSelectedRequest(null)} />
            <div className="relative w-full sm:w-[95%] sm:max-w-[850px] max-h-[92vh] sm:max-h-[85vh] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl sm:rounded-2xl rounded-t-[20px] overflow-hidden flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] ring-1 ring-black/5 dark:ring-white/10 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 z-10">
              
              {/* Drag Handle */}
              <div className="sm:hidden flex justify-center pt-2 pb-1">
                <div className="w-9 h-[5px] rounded-full bg-zinc-300 dark:bg-zinc-600" />
              </div>

              {/* Header */}
              <div className="px-5 sm:px-6 py-4 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-[17px] sm:text-[20px] font-bold tracking-tight text-zinc-900 dark:text-white">Detail Perbandingan Edit</h2>
                  <p className="text-[12px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
                    Pengirim: <span className="font-bold">{req.requestedBy}</span> · Target: <span className="font-bold text-rose-500">{req.hari}, {req.tanggal}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="w-[30px] h-[30px] flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-[13px] font-bold"
                >✕</button>
              </div>

              <div className="h-px bg-zinc-200/60 dark:bg-white/5 mx-5 sm:mx-6" />

              {/* Scrollable Content */}
              <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
                
                {/* General Info Comparison */}
                <div className="bg-zinc-50 dark:bg-black/20 border border-zinc-250/40 dark:border-white/5 p-4 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Informasi Umum</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Absen Pagi</span>
                      <span className="text-[12px] font-bold text-red-500 line-through truncate">{req.originalData?.absenPagi || "-"}</span>
                      <span className="text-[12px] font-black text-emerald-600 dark:text-emerald-400 truncate">{req.proposedData?.absenPagi || "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Absen Siang</span>
                      <span className="text-[12px] font-bold text-red-500 line-through truncate">{req.originalData?.absenSiang || "-"}</span>
                      <span className="text-[12px] font-black text-emerald-600 dark:text-emerald-400 truncate">{req.proposedData?.absenSiang || "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Ruko Buka</span>
                      <span className="text-[12px] font-bold text-red-500 line-through truncate">{req.originalData?.rukoBuka || "-"}</span>
                      <span className="text-[12px] font-black text-emerald-600 dark:text-emerald-400 truncate">{req.proposedData?.rukoBuka || "-"}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Ruko Tutup</span>
                      <span className="text-[12px] font-bold text-red-500 line-through truncate">{req.originalData?.rukoTutup || "-"}</span>
                      <span className="text-[12px] font-black text-emerald-600 dark:text-emerald-400 truncate">{req.proposedData?.rukoTutup || "-"}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex flex-col">
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Shift</span>
                      <span className="text-[12px] font-bold text-red-500 line-through truncate">{req.originalData?.shiftPegawai || "-"}</span>
                      <span className="text-[12px] font-black text-emerald-600 dark:text-emerald-400 truncate">{req.proposedData?.shiftPegawai || "-"}</span>
                    </div>
                  </div>
                  <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">Catatan</span>
                    <p className="text-[11px] text-red-500 line-through">{req.originalData?.catatan || "-"}</p>
                    <p className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">{req.proposedData?.catatan || "-"}</p>
                  </div>
                </div>

                {/* Categories Tabbed Comparison */}
                <div className="space-y-4">
                  {(["harian", "jajanan", "jasaAks", "sewa", "setoran", "pengeluaran"] as const).map((cat) => {
                    let title = "";
                    let originalRows: any[] = [];
                    let proposedRows: any[] = [];
                    let renderRow = (row: any) => "";

                    if (cat === "harian") {
                      title = "Transaksi Harian (PS Main)";
                      originalRows = req.originalData?.rowsHarian || [];
                      proposedRows = req.proposedData?.rowsHarian || [];
                      renderRow = (row) => `${row.jenisPS} · ${row.jumlahJam} jam · ${rupiah(row.harga)} · ${row.bayar || "Cash"}`;
                    } else if (cat === "jajanan") {
                      title = "Penjualan Jajanan";
                      originalRows = req.originalData?.rowsJajanan || [];
                      proposedRows = req.proposedData?.rowsJajanan || [];
                      renderRow = (row) => `${row.jenisJajanan} · ${row.qtyJam} qty · ${rupiah(row.harga)} · ${row.bayar || "Cash"}`;
                    } else if (cat === "jasaAks") {
                      title = "Jasa & Aksesoris";
                      originalRows = req.originalData?.rowsJasaAks || [];
                      proposedRows = req.proposedData?.rowsJasaAks || [];
                      renderRow = (row) => `${row.tipe} (${row.ket}) · ${rupiah(row.harga)} · ${row.bayar || "Cash"}`;
                    } else if (cat === "sewa") {
                      title = "Rental Sewa PS Luar";
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
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">{title}</h4>
                          {isIdentical ? (
                            <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wide bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded-full">
                              Tidak Ada Perubahan
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              Ada Perubahan
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Original Column */}
                          <div className={`p-3 border rounded-xl ${isIdentical ? 'bg-zinc-50/50 dark:bg-zinc-900/10 border-zinc-150 dark:border-zinc-800' : 'bg-red-500/5 border-red-500/15 dark:border-red-500/10'}`}>
                            <span className="text-[9px] font-bold text-red-500/80 uppercase tracking-wider block mb-2">Original</span>
                            {originalRows.length === 0 ? (
                              <p className="text-[11px] text-zinc-400 italic">Tidak ada transaksi</p>
                            ) : (
                              <div className="space-y-1">
                                {originalRows.map((row, rIdx) => (
                                  <div key={rIdx} className="text-[11px] text-zinc-500 dark:text-zinc-400 line-through py-0.5 border-b border-zinc-100 dark:border-white/5 last:border-0 truncate">
                                    {rIdx + 1}. {renderRow(row)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Proposed Column */}
                          <div className={`p-3 border rounded-xl ${isIdentical ? 'bg-zinc-50/50 dark:bg-zinc-900/10 border-zinc-150 dark:border-zinc-800' : 'bg-emerald-500/5 border-emerald-500/15 dark:border-emerald-500/10'}`}>
                            <span className="text-[9px] font-bold text-emerald-500/85 uppercase tracking-wider block mb-2">Proposed</span>
                            {proposedRows.length === 0 ? (
                              <p className="text-[11px] text-zinc-400 italic">Tidak ada transaksi</p>
                            ) : (
                              <div className="space-y-1">
                                {proposedRows.map((row, rIdx) => (
                                  <div key={rIdx} className="text-[11px] text-zinc-800 dark:text-zinc-200 font-medium py-0.5 border-b border-zinc-100 dark:border-white/5 last:border-0 truncate">
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

              {/* Footer Actions */}
              {isPending ? (
                <div className="px-5 sm:px-6 py-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-150 dark:border-zinc-850 flex justify-end gap-3 shrink-0">
                  <button
                    onClick={() => handleRejectRequest(req)}
                    className="px-5 py-2.5 text-xs font-black text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/25 rounded-xl transition-all active:scale-95"
                  >
                    Tolak Request
                  </button>
                  <button
                    onClick={() => handleApproveRequest(req)}
                    className="px-5 py-2.5 text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/25 rounded-xl transition-all active:scale-95"
                  >
                    Setujui (ACC)
                  </button>
                </div>
              ) : (
                <div className="px-5 sm:px-6 py-4 bg-zinc-50 dark:bg-zinc-900/40 border-t border-zinc-150 dark:border-zinc-850 flex justify-between items-center shrink-0">
                  <div className="text-xs">
                    Status:{" "}
                    <span className={`font-black uppercase tracking-wider ${req.status === "approved" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {req.status}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedRequest(null)}
                    className="px-5 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-all active:scale-95"
                  >
                    Tutup
                  </button>
                </div>
              )}

            </div>
          </div>
        );
      })()}

    </div>
  );
};

const MetricCard = ({ title, value, icon, isHighlight = false, subtitle = "", variant, accentColor, compact = false }: { title: string, value: string, icon: React.ReactNode, isHighlight?: boolean, subtitle?: string, variant?: "profit" | "loss", accentColor?: "green" | "blue", compact?: boolean }) => {
  // Determine styles based on variant
  const isProfit = variant === "profit";
  const isLoss = variant === "loss";
  const hasVariant = isProfit || isLoss;

  let containerClass = "bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10";
  let titleClass = "text-zinc-500 dark:text-zinc-400";
  let valueClass = "text-zinc-900 dark:text-white";
  let iconBgClass = "bg-zinc-50 dark:bg-white/5";

  if (hasVariant) {
    if (isProfit) {
      containerClass = "bg-gradient-to-br from-emerald-500 to-green-600 dark:from-emerald-600 dark:to-green-700 shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-400/30";
      titleClass = "text-emerald-100/90";
      valueClass = "text-white";
      iconBgClass = "bg-white/15";
    } else {
      containerClass = "bg-gradient-to-br from-red-500 to-rose-600 dark:from-red-600 dark:to-rose-700 shadow-lg shadow-red-500/25 ring-1 ring-red-400/30";
      titleClass = "text-red-100/90";
      valueClass = "text-white";
      iconBgClass = "bg-white/15";
    }
  } else if (isHighlight) {
    containerClass = "bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg";
    titleClass = "text-zinc-400 dark:text-zinc-500";
    valueClass = "text-white dark:text-black";
    iconBgClass = "bg-white/10 dark:bg-black/5";
  } else if (accentColor === "green") {
    containerClass = "bg-white dark:bg-[#1c1c1e] border border-emerald-200/60 dark:border-emerald-500/15";
    valueClass = "text-emerald-600 dark:text-emerald-400";
  } else if (accentColor === "blue") {
    containerClass = "bg-white dark:bg-[#1c1c1e] border border-blue-200/60 dark:border-blue-500/15";
    valueClass = "text-blue-600 dark:text-blue-400";
  }

  if (compact) {
    return (
      <div className={`p-3 sm:p-4 rounded-2xl flex flex-col gap-1.5 justify-center transition-all duration-300 ${containerClass}`}>
        <div className="flex items-center justify-between">
          <p className={`text-[9px] sm:text-[10px] font-bold tracking-widest uppercase ${titleClass}`}>{title}</p>
          <div className={`p-1.5 rounded-lg ${iconBgClass}`}>{icon}</div>
        </div>
        <h4 className={`text-base sm:text-xl font-black tabular-nums tracking-tight ${valueClass}`}>
          {value}
          {subtitle && <span className="text-[9px] sm:text-xs ml-0.5 font-normal opacity-60">{subtitle}</span>}
        </h4>
      </div>
    );
  }

  return (
    <div className={`p-3.5 sm:p-5 rounded-2xl flex flex-col gap-2 sm:gap-3 justify-center transition-all duration-300 ${containerClass}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[10px] sm:text-xs font-bold tracking-widest uppercase ${titleClass}`}>{title}</p>
        <div className={`p-1.5 sm:p-2 rounded-xl ${iconBgClass}`}>{icon}</div>
      </div>
      <div>
        <h4 className={`text-lg sm:text-2xl font-black tabular-nums tracking-tight ${valueClass}`}>
          {value}
          {subtitle && <span className="text-[10px] sm:text-xs ml-1 font-normal opacity-60">{subtitle}</span>}
        </h4>
      </div>
    </div>
  );
};

const UnitStatusWidget = ({ rowsSewa, history, activeDate, onVerifyActiveRental, hargaItems, isVerifyingPayment }: { rowsSewa: RowSewa[], history?: HistoryItem[], activeDate?: string, onVerifyActiveRental?: (idx: number) => void, hargaItems?: any[], isVerifyingPayment?: boolean }) => {
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
      {/* Segmented Pill Switcher */}
      <div className="flex justify-center z-10">
        <div className="flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl border border-zinc-200/50 dark:border-white/5 shadow-inner">
          <button
            onClick={() => setActiveSlide("status")}
            className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
              activeSlide === "status"
                ? "bg-white dark:bg-[#2C2C2E] text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
            }`}
          >
            Monitoring Status Unit
          </button>
          <button
            onClick={() => setActiveSlide("device")}
            className={`px-5 py-2.5 text-xs font-bold tracking-wider uppercase rounded-xl transition-all ${
              activeSlide === "device"
                ? "bg-white dark:bg-[#2C2C2E] text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
            }`}
          >
            Monitoring Kondisi Unit
          </button>
        </div>
      </div>

      {/* Widget Container with fast fade transition */}
      <div className="w-full">
        {activeSlide === "status" ? (
          <div className="animate-in fade-in duration-200">
            <WidgetMonitoringStatus 
              history={history || []} 
              rowsSewa={rowsSewa} 
              activeDate={activeDate} 
              onVerifyActiveRental={onVerifyActiveRental} 
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
