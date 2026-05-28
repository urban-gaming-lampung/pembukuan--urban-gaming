import React, { useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider } from "./tema/ThemeContext";
import Header from "./components/Header";
import Input from "./components/Input";
import RincianHarian from "./components/RincianHarian";
import RincianJajanan from "./components/RincianJajanan";
import RincianJasaAksesoris from "./components/RincianJasaAksesoris";
import RincianSewa from "./components/RincianSewa";
import RekapPemasukan from "./components/RekapPemasukan";
import FilterComp from "./components/Filter";
import HistoryPembukuan from "./components/HistoryPembukuan";
import Grafik from "./components/Grafik";
import Footer from "./components/Footer";
import GeminiReportGenerator from "./components/GeminiReportGenerator";
import PdfExporter, { PdfExporterHandle } from "./components/PdfExporter";
import Pengaturan from "./components/Pengaturan";
import EditRincian from "./components/EditRincian"; 

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

const getWeekRangeMonSun = (base: Date) => {
  const d = startOfDay(base);
  const day = d.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: startOfDay(mon), end: endOfDay(sun) };
};

export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PdfExporterHandle>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dark, setDark] = useState(true);
  const [kualitasGambar, setKualitasGambar] = useState<ImageQuality>("Tinggi");

  const today = new Date();
  const [tanggal, setTanggal] = useState(today.toISOString().slice(0, 10));
  const [hari, setHari] = useState(
    new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(today)
  );

  // ===== INPUT FIELD STATE =====
  const [absenPagi, setAbsenPagi] = useState("");
  const [absenSiang, setAbsenSiang] = useState("");
  const [rukoBuka, setRukoBuka] = useState("");
  const [rukoTutup, setRukoTutup] = useState("");
  const [catatan, setCatatan] = useState("");
  
  const [openSettings, setOpenSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // State untuk Alert Download & Duplikasi
  const [showDownloadAlert, setShowDownloadAlert] = useState(false);
  const [showDuplicateDateAlert, setShowDuplicateDateAlert] = useState(false); 

  // ===== PRICE SETTINGS =====
  const [hargaHarian, setHargaHarian] = useState<Price[]>(DEFAULT_HARGA_HARIAN as Price[]);
  const [hargaJajanan, setHargaJajanan] = useState<Price[]>(DEFAULT_HARGA_JAJANAN as Price[]);
  const [hargaJasaAks, setHargaJasaAks] = useState<Price[]>(DEFAULT_HARGA_JASA_AKS as Price[]);
  const [hargaSewa, setHargaSewa] = useState<Price[]>(DEFAULT_HARGA_SEWA as Price[]);
  
  const [openEditRincian, setOpenEditRincian] = useState<PriceListKey | null>(null);

  const getPrices = (key: PriceListKey): Price[] => {
    if (key === "harian") return hargaHarian;
    if (key === "jajanan") return hargaJajanan;
    if (key === "jasaAks") return hargaJasaAks;
    return hargaSewa;
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
    alert(`List ${getTitle(key)} berhasil di-reset ke default!`);
  };

  // ===== TABLE ROWS STATE =====
  const blankHarian: RowHarian = { jenisPS: "", jamMasuk: "", jumlahJam: "", harga: "", bayar: "" };
  const blankJajanan: RowJajanan = { jenisJajanan: "", qtyJam: "", harga: "", bayar: "" };
  const blankJasaAks: RowJasaAks = { tipe: "", ket: "", harga: "", bayar: "" };
  const blankSewa: RowSewa = { jenisPS: "", lamaSewa: "", ket: "", harga: "", bayar: "" };

  const [rowsHarian, setRowsHarian] = useState(Array.from({ length: 10 }, () => ({ ...blankHarian })));
  const [rowsJajanan, setRowsJajanan] = useState(Array.from({ length: 5 }, () => ({ ...blankJajanan })));
  const [rowsJasaAks, setRowsJasaAks] = useState(Array.from({ length: 5 }, () => ({ ...blankJasaAks })));
  const [rowsSewa, setRowsSewa] = useState(Array.from({ length: 5 }, () => ({ ...blankSewa })));

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

  const hasData = useMemo(() => {
    if (absenPagi || absenSiang || rukoBuka || rukoTutup || catatan) return true;
    if (totalHarian > 0 || totalJajanan > 0 || totalJasaAks > 0 || totalSewa > 0) return true;
    return false;
  }, [absenPagi, absenSiang, rukoBuka, rukoTutup, catatan, totalHarian, totalJajanan, totalJasaAks, totalSewa]);

  // ===== HISTORY & FILTER =====
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState("Semua Bulan");
  const [filterMonth, setFilterMonth] = useState(today.getMonth() + 1);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");

  const filteredHistory = useMemo(() => {
    if (filter === "Semua Bulan") return history;
    if (filter === "Satu minggu") {
      const { start, end } = getWeekRangeMonSun(new Date());
      return history.filter((h) => {
        const d = startOfDay(new Date(h.tanggal));
        return d >= start && d <= end;
      });
    }
    if (filter === "Pilih Bulan") {
      return history.filter((h) => parseInt(h.tanggal.slice(5, 7), 10) === filterMonth);
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

  // ===== EXPORTER DATA PREP =====
  const exportData = useMemo(() => ({
    tanggal, hari,
    absenPagi, absenSiang, catatan,
    rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa,
    totalHarian, totalJajanan, totalJasaAks, totalSewa,
    totalCash, totalTransfer,
    history
  }), [
    tanggal, hari, absenPagi, absenSiang, catatan,
    rowsHarian, rowsJajanan, rowsJasaAks, rowsSewa,
    totalHarian, totalJajanan, totalJasaAks, totalSewa,
    totalCash, totalTransfer, history
  ]);

  // ===== VALIDATION LOGIC =====
  const validateTransactions = () => {
    const allLists = [
      ...rowsHarian,
      ...rowsJajanan,
      ...rowsJasaAks,
      ...rowsSewa,
    ] as any[];

    for (const r of allLists) {
      const price = toNum(r.harga);
      if (price > 0 && !isCash(r.bayar) && !isTransfer(r.bayar)) {
        return false;
      }
    }
    return true;
  };

  // ===== HANDLER DOWNLOAD CHECK =====
  const handleDownloadCheck = () => {
    // Cek apakah data mandatory sudah diisi
    if (!absenPagi || !absenSiang || !rukoBuka || !rukoTutup) {
      setShowDownloadAlert(true);
      return;
    }
    // Jika lolos, download
    pdfRef.current?.download();
  };

  // ===== CRUD ACTIONS =====
  const addPencatatan = () => {
    if (!tanggal) return;

    // --- CEK DUPLIKASI TANGGAL ---
    const isDuplicate = history.some((item) => item.tanggal === tanggal);
    if (isDuplicate) {
      setShowDuplicateDateAlert(true);
      return;
    }
    // -----------------------------

    if (!validateTransactions()) {
      alert("⚠️ Gagal Simpan!\n\nIsi dulu, orangnya bayar cash apa transfer!\n\nCek lagi!");
      return;
    }
    // FIX: Gunakan fallback jika crypto.randomUUID tidak tersedia (misal di non-HTTPS)
    const uniqueId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : Date.now().toString() + Math.random().toString(36).slice(2);

    const newItem = {
      id: uniqueId,
      tanggal, hari,
      absenPagi, absenSiang, rukoBuka, rukoTutup, catatan,
      totalHarian, totalJajanan, totalJasaAks, totalSewa, totalCash, totalTransfer,
      rowsHarian: JSON.parse(JSON.stringify(rowsHarian)),
      rowsJajanan: JSON.parse(JSON.stringify(rowsJajanan)),
      rowsJasaAks: JSON.parse(JSON.stringify(rowsJasaAks)),
      rowsSewa: JSON.parse(JSON.stringify(rowsSewa)),
    } as any;
    setHistory((prev) => [newItem as HistoryItem, ...prev]);
    if (editingId) setEditingId(null);
    alert("Data berhasil disimpan sebagai entri baru! ✨");
  };

  const updatePencatatan = () => {
    if (!editingId) return;
    if (!validateTransactions()) {
        alert("⚠️ Gagal Update!\n\nMasih ada item yang belum dipilih metodenya.");
        return;
    }
    if (!confirm("Simpan perubahan?")) return;
    setHistory((prev) => prev.map(item => {
        if (item.id === editingId) {
            return {
                ...item,
                tanggal, hari,
                absenPagi, absenSiang, rukoBuka, rukoTutup, catatan,
                totalHarian, totalJajanan, totalJasaAks, totalSewa, totalCash, totalTransfer,
                rowsHarian: JSON.parse(JSON.stringify(rowsHarian)),
                rowsJajanan: JSON.parse(JSON.stringify(rowsJajanan)),
                rowsJasaAks: JSON.parse(JSON.stringify(rowsJasaAks)),
                rowsSewa: JSON.parse(JSON.stringify(rowsSewa)),
            } as any;
        }
        return item;
    }));
    setEditingId(null);
    alert("Perubahan berhasil disimpan! ✅");
  };

  const editHistoryItem = (id: string) => {
    const item = history.find((x) => x.id === id) as any;
    if (!item) return;
    if (!confirm("Load data ini untuk diedit?")) return;
    setEditingId(id);
    setTanggal(item.tanggal); setHari(item.hari);
    setAbsenPagi(item.absenPagi || ""); setAbsenSiang(item.absenSiang || "");
    setRukoBuka(item.rukoBuka || ""); setRukoTutup(item.rukoTutup || "");
    setCatatan(item.catatan || "");
    setRowsHarian(item.rowsHarian || Array.from({ length: 10 }, () => ({ ...blankHarian })));
    setRowsJajanan(item.rowsJajanan || Array.from({ length: 5 }, () => ({ ...blankJajanan })));
    setRowsJasaAks(item.rowsJasaAks || Array.from({ length: 5 }, () => ({ ...blankJasaAks })));
    setRowsSewa(item.rowsSewa || Array.from({ length: 5 }, () => ({ ...blankSewa })));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteHistoryItem = (id: string) => {
    if (!confirm("Hapus history ini?")) return;
    if (id === editingId) setEditingId(null);
    setHistory((prev) => prev.filter((x) => x.id !== id));
  };

  useEffect(() => {
    const root = document.documentElement;
    dark ? root.classList.add("dark") : root.classList.remove("dark");
  }, [dark]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) { setHydrated(true); return; }
      const json = JSON.parse(raw);
      if (typeof json?.settings?.dark === "boolean") setDark(json.settings.dark);
      if (json?.settings?.kualitasGambar) setKualitasGambar(json.settings.kualitasGambar as ImageQuality);
      
      const pl = json?.settings?.priceLists;
      if (Array.isArray(pl?.hargaHarian)) setHargaHarian(pl.hargaHarian);
      if (Array.isArray(pl?.hargaJajanan)) setHargaJajanan(pl.hargaJajanan);
      if (Array.isArray(pl?.hargaJasaAks)) setHargaJasaAks(pl.hargaJasaAks);
      if (Array.isArray(pl?.hargaSewa)) setHargaSewa(pl.hargaSewa);

      if (Array.isArray(json?.history)) {
        setHistory((json.history as any[]).map((h) => ({
          ...h,
          totalHarian: Number(h.totalHarian) || 0,
          totalJajanan: Number(h.totalJajanan) || 0,
          totalJasaAks: Number(h.totalJasaAks) || 0,
          totalSewa: Number(h.totalSewa) || 0,
          totalCash: Number(h.totalCash) || 0,
          totalTransfer: Number(h.totalTransfer) || 0,
        })));
      }
    } catch { } finally { setHydrated(true); }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        settings: {
          dark, kualitasGambar,
          priceLists: { hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa },
        },
        history,
      }));
    } catch { }
  }, [hydrated, dark, kualitasGambar, history, hargaHarian, hargaJajanan, hargaJasaAks, hargaSewa]);

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
      setHistory(json?.data?.history ?? []);
      const pl = json?.settings?.priceLists;
      if (pl) {
        if (pl.hargaHarian) setHargaHarian(pl.hargaHarian);
        if (pl.hargaJajanan) setHargaJajanan(pl.hargaJajanan);
        if (pl.hargaJasaAks) setHargaJasaAks(pl.hargaJasaAks);
        if (pl.hargaSewa) setHargaSewa(pl.hargaSewa);
      }
      alert("Restore sukses ✅");
    } catch (e) { alert("File restore invalid / corrupt ❌"); } 
    finally { if (restoreInputRef.current) restoreInputRef.current.value = ""; }
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
    setFilter("Semua Bulan"); setFilterMonth(new Date().getMonth() + 1);
    setRangeStart(""); setRangeEnd("");
    alert("Setting di-reset ✅");
  };

  return (
    <ThemeProvider>
      {/* CSS untuk menyembunyikan scrollbar */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Exporter */}
      <PdfExporter 
        ref={pdfRef} 
        rootRef={rootRef} 
        dark={dark} 
        kualitasGambar={kualitasGambar} 
        data={exportData} 
      />
      
      <div ref={rootRef} className={`relative min-h-screen ${dark ? "bg-[url('/images/bg_dark.jpg')] bg-cover bg-center bg-fixed" : "bg-zinc-100"}`}>
        {dark && <div className="fixed inset-0 bg-black/70 pointer-events-none z-0" />}
        
        <div className="relative z-10 text-zinc-900 dark:text-zinc-100">
          <Header
            rootRef={rootRef} tanggal={tanggal} dark={dark}
            onToggleTheme={() => setDark((d) => !d)}
            onDownloadPDF={handleDownloadCheck} 
            onOpenSettings={() => setOpenSettings(true)}
            hasData={hasData} isEditing={!!editingId}
            onSaveEdit={updatePencatatan} onAddData={addPencatatan} onCancelEdit={() => setEditingId(null)}
          />
          
          <main className="w-full px-4 lg:px-8 pb-4 pt-32 md:pt-40 transition-all duration-300">
            {/* GRID SYSTEM UPDATE: 
              - Menggunakan grid-cols-5 agar rasio lebih granular (40:60)
            */}
            <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:h-[calc(100vh-11rem)] lg:overflow-hidden">
              
              {/* === SECTION 1 (INPUT) === 
                  col-span-2 dari 5 = 40% Width (Sebelumnya 33%)
              */}
              <div className="lg:col-span-2 space-y-6 lg:overflow-y-auto lg:pr-2 lg:pb-20 no-scrollbar">
                <Input
                  tanggal={tanggal} setTanggal={setTanggal} hari={hari} setHari={setHari}
                  absenPagi={absenPagi} setAbsenPagi={setAbsenPagi} absenSiang={absenSiang} setAbsenSiang={setAbsenSiang}
                  rukoBuka={rukoBuka} setRukoBuka={setRukoBuka} rukoTutup={rukoTutup} setRukoTutup={setRukoTutup}
                  catatan={catatan} setCatatan={setCatatan}
                />
                
                <RincianHarian rows={rowsHarian} setRows={setRowsHarian} blank={{ ...blankHarian }} hargaItems={hargaHarian} />
                <RincianJajanan rows={rowsJajanan} setRows={setRowsJajanan} blank={{ ...blankJajanan }} hargaItems={hargaJajanan} />
                <RincianJasaAksesoris rows={rowsJasaAks} setRows={setRowsJasaAks} blank={{ ...blankJasaAks }} />
                <RincianSewa rows={rowsSewa} setRows={setRowsSewa} blank={{ ...blankSewa }} hargaItems={hargaSewa} />
              </div>

              {/* === SECTION 2 (REKAP) === 
                  col-span-3 dari 5 = 60% Width (Sebelumnya 66%)
              */}
              <div className="lg:col-span-3 space-y-6 mt-6 lg:mt-0 lg:overflow-y-auto lg:pl-2 lg:pb-20 no-scrollbar">
                <RekapPemasukan
                  totalHarian={totalHarian} totalJajanan={totalJajanan}
                  totalJasaAks={totalJasaAks} totalSewa={totalSewa}
                  totalCash={totalCash} totalTransfer={totalTransfer}
                />
                
                <FilterComp
                  mode={filter} setMode={setFilter} month={filterMonth} setMonth={setFilterMonth}
                  rangeStart={rangeStart} setRangeStart={setRangeStart} rangeEnd={rangeEnd} setRangeEnd={setRangeEnd}
                />
                
                <HistoryPembukuan
                  items={filteredHistory}
                  onClear={() => { if (history.length > 0 && confirm("Bersihkan semua history?")) setHistory([]); }}
                  onEdit={editHistoryItem} onDelete={deleteHistoryItem}
                />
                
                <Grafik history={filteredHistory} />
                <GeminiReportGenerator history={history} />
                <Footer />
              </div>

            </div>
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
            themeMode={dark ? "Gelap" : "Terang"} onThemeChange={(mode) => setDark(mode === "Gelap")}
            kualitasGambar={kualitasGambar} onKualitasGambarChange={setKualitasGambar}
            onBackupData={doBackup} onRestoreData={() => restoreInputRef.current?.click()} onExportCSV={exportCSV} onResetSetting={resetSetting}
            onOpenEditHarian={() => setOpenEditRincian("harian")}
            onOpenEditJajanan={() => setOpenEditRincian("jajanan")}
            onOpenEditJasaAks={() => setOpenEditRincian("jasaAks")}
            onOpenEditSewa={() => setOpenEditRincian("sewa")}
          />

          {/* === ALERT POPUP (Apple Style) : DATA BELUM LENGKAP === */}
          {showDownloadAlert && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 font-sans" style={{ perspective: "1000px" }}>
              <div 
                className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" 
                onClick={() => setShowDownloadAlert(false)} 
              />
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/80 dark:bg-[#1C1C1E]/85 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400">
                     <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  </div>
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">
                    Data Belum Lengkap
                  </h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Absen Pagi, Absen Siang, Ruko Buka, dan Ruko Tutup <span className="text-zinc-800 dark:text-zinc-200 font-medium">wajib diisi</span> sebelum download laporan.
                  </p>
                </div>
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button 
                    onClick={() => setShowDownloadAlert(false)} 
                    className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10"
                  >
                    Mengerti
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* === ALERT POPUP (Apple Style) : DUPLIKASI TANGGAL (BARU) === */}
          {showDuplicateDateAlert && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 font-sans" style={{ perspective: "1000px" }}>
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" 
                onClick={() => setShowDuplicateDateAlert(false)} 
              />
              
              {/* Apple Style Modal */}
              <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/80 dark:bg-[#1C1C1E]/85 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
                
                <div className="p-6 text-center">
                  {/* Icon Wrapper Merah */}
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                      <line x1="15" y1="14" x2="9" y2="20"/>
                      <line x1="9" y1="14" x2="15" y2="20"/>
                    </svg>
                  </div>
                  
                  <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">
                    Duplikasi Tanggal
                  </h3>
                  <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                    Laporan untuk tanggal <span className="font-bold text-zinc-800 dark:text-zinc-200">{tanggal}</span> sudah ada. Anda tidak bisa membuat dua laporan di tanggal yang sama.
                  </p>
                </div>

                {/* Button Area */}
                <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
                  <button 
                    onClick={() => setShowDuplicateDateAlert(false)} 
                    className="w-full py-3.5 text-[15px] font-semibold text-red-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </ThemeProvider>
  );
}