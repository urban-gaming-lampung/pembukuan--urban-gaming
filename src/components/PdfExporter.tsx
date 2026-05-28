import React, { forwardRef, useImperativeHandle, useRef, useMemo, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { 
  RowHarian, RowJajanan, RowJasaAks, RowSewa, HistoryItem 
} from "../lib/types";
import type { StokData, MasterStokCategories, StokKategori } from "../hooks/useStokData";

type ImageQuality = "Tinggi" | "Hemat";

type Props = {
  rootRef: React.RefObject<HTMLDivElement>;
  dark: boolean;
  kualitasGambar: ImageQuality;
  data: {
    tanggal: string; hari: string; absenPagi: string; absenSiang: string; catatan: string;
    rowsHarian: RowHarian[]; rowsJajanan: RowJajanan[]; rowsJasaAks: RowJasaAks[]; rowsSewa: RowSewa[];
    totalHarian: number; totalJajanan: number; totalJasaAks: number; totalSewa: number;
    totalCash: number; totalTransfer: number; history: HistoryItem[];
    rowsSetoran?: any[]; rowsPengeluaran?: any[];
  };
  stokData?: StokData;
  masterCategories?: MasterStokCategories;
  onStartExport?: () => void;
  onEndExport?: () => void;
};

// --- HELPER UNTUK GENERATE TEXT LAPORAN ---
const formatK = (num: number) => {
    if (num === 0) return "";
    const k = num / 1000;
    return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 3 }).format(k) + "k";
};

const formatRp = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(num);
};

const formatDateShort = (dateString: string) => {
    try {
        const d = new Date(dateString);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = String(d.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    } catch { return dateString; }
};

const generateLaporanText = (history: HistoryItem[], currentData: Props['data']) => {
    const dObj = new Date(currentData.tanggal); 
    const currentMonth = dObj.getMonth();
    const currentYear = dObj.getFullYear();
    const todayStringKey = currentData.tanggal;

    const monthHistory = history.filter((h) => {
        const d = new Date(h.tanggal);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime());

    const todayItem = history.find((h) => h.tanggal === todayStringKey) || currentData;

    const dataMap: Record<number, number> = {};
    let strSetor = "";
    let strPengeluaranList = "";
    let monthTotalCash = 0;
    let monthTotalTransfer = 0;
    let monthTotalPengeluaran = 0;

    monthHistory.forEach((h) => {
        const d = new Date(h.tanggal);
        const dateNum = d.getDate();
        const totalHariIni = (h.totalHarian || 0) + (h.totalJajanan || 0) + (h.totalJasaAks || 0) + (h.totalSewa || 0);
        
        dataMap[dateNum] = (dataMap[dateNum] || 0) + totalHariIni;
        monthTotalCash += (Number((h as any).totalCash) || 0);
        monthTotalTransfer += (Number((h as any).totalTransfer) || 0);

        if (Array.isArray((h as any).rowsSetoran)) {
            (h as any).rowsSetoran.forEach((s: any) => {
                const nom = Number(String(s.harga).replace(/\D/g,"")) || 0;
                if (nom > 0) strSetor += `${formatDateShort(s.tanggal || h.tanggal)} - ${s.ket || "Setoran"} - ${formatRp(nom)}\n`;
            });
        }
        if (Array.isArray((h as any).rowsPengeluaran)) {
            (h as any).rowsPengeluaran.forEach((p: any) => {
                const nom = Number(String(p.harga).replace(/\D/g,"")) || 0;
                if (nom > 0) {
                    monthTotalPengeluaran += nom;
                    strPengeluaranList += `${formatDateShort(p.tanggal || h.tanggal)} - ${p.ket || "Pengeluaran"} - ${formatRp(nom)}\n`;
                }
            });
        }
    });

    const hariIniPemasukanKotor = (todayItem.totalHarian || 0) + (todayItem.totalJajanan || 0) + (todayItem.totalJasaAks || 0) + (todayItem.totalSewa || 0);
    
    let hariIniPengeluaran = 0;
    if (Array.isArray((todayItem as any).rowsPengeluaran)) {
        (todayItem as any).rowsPengeluaran.forEach((p: any) => hariIniPengeluaran += (Number(String(p.harga).replace(/\D/g,"")) || 0));
    }

    let hariIniSetorYa = 0;
    if (Array.isArray((todayItem as any).rowsSetoran)) {
        (todayItem as any).rowsSetoran.forEach((s: any) => {
            const isTf = String(s.bayar || "").toLowerCase();
            if (isTf.includes("ya") || isTf.includes("sudah")) hariIniSetorYa += (Number(String(s.harga).replace(/\D/g,"")) || 0);
        });
    }

    const saldoBelumSetor = Math.max(0, (Number(todayItem.totalCash) || 0) - hariIniSetorYa);
    const totalSaldoBulanIni = (monthTotalCash + monthTotalTransfer) - monthTotalPengeluaran;

    const monthsIndo = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const dayStr = String(dObj.getDate()).padStart(2, '0');
    const monthStr = monthsIndo[dObj.getMonth()];
    const yearStr = dObj.getFullYear();
    const formattedDateHeader = `${dayStr} ${monthStr} ${yearStr}`;

    let text = `[PIN] UPDATE PEMASUKAN & KONDISI RENTAL PS URBAN\n`;
    text += `TANGGAL : ${formattedDateHeader}\n`;
    text += `TARGET HARIAN: Rp250.000\n`;
    text += `TARGET MINGGUAN: Rp1.750.000\n`;
    text += `==============================\nPEMASUKAN\n`;

    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const weeks = [
        { s: 1, e: 7, label: "Minggu 1" },
        { s: 8, e: 14, label: "Minggu 2" },
        { s: 15, e: 21, label: "Minggu 3" },
        { s: 22, e: lastDay, label: "Minggu 4" }
    ];

    const weeklySums: number[] = [];

    weeks.forEach((w) => {
        let sum = 0;
        text += `${w.label}\n`;
        for (let i = w.s; i <= w.e; i++) {
            const v = dataMap[i] || 0; 
            sum += v;
            text += `${i}. ${v > 0 ? formatK(v) : ""}\n`;
        }
        text += `Total : ${formatK(sum)}\n\n`;
        weeklySums.push(sum);
    });

    text += `==============================\nTOTAL PEMASUKAN MINGGUAN\n`;
    weeks.forEach((w, idx) => {
        text += `${w.label} : ${formatK(weeklySums[idx])}\n`;
    });

    text += `==============================\n*SETOR*\n${strSetor}`;
    text += `==============================\n*PENGELUARAN*\n${strPengeluaranList}`;
    text += `==============================\n`;
    
    text += `PENGELUARAN HARI INI : -${formatRp(hariIniPengeluaran)}\n`;
    text += `PEMASUKAN KOTOR HARI INI : ${formatRp(hariIniPemasukanKotor)}\n`;
    text += `PEMASUKAN BERSIH HARI INI : ${formatRp(hariIniPemasukanKotor - hariIniPengeluaran)}\n`;
    text += `SALDO YANG BELUM DI SETOR : ${formatRp(saldoBelumSetor)}\n`;
    text += `TOTAL SALDO BULAN INI = ${formatRp(totalSaldoBulanIni)}`;
    
    return text;
};

const generateLaporanStokText = (stokData?: StokData, masterCats?: MasterStokCategories) => {
    const d = stokData || { rental: {}, jualan: {} };
    const rentalCats: StokKategori[] = masterCats?.rental || [];
    const jualanCats: StokKategori[] = masterCats?.jualan || [];

    const getHintStr = (itemData: any) => {
        if (!itemData || !itemData.lastEditDate) return "";
        const delta = itemData.lastEditDelta || 0;
        const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
        return ` (telah di edit, ${itemData.lastEditDate}, ${deltaStr})`;
    };

    let text = `==============================\nREKAP STOK RENTAL\n==============================\n\n`;
    rentalCats.forEach(cat => {
        text += `${cat.kategori}\n`;
        let sum = 0;
        cat.items.forEach(item => {
            const itemData = d.rental?.[cat.kategori]?.[item] || { jumlah: 0 };
            const val = itemData.jumlah || 0;
            sum += val;
            text += `${item} : ${val}${getHintStr(itemData)}\n`;
        });
        text += `TOTAL : ${sum}\n\n`;
    });

    text += `==============================\nREKAP STOK JUALAN\n==============================\n\n`;
    jualanCats.forEach(cat => {
        text += `${cat.kategori}\n`;
        let sum = 0;
        cat.items.forEach(item => {
            const itemData = d.jualan?.[cat.kategori]?.[item] || { jumlah: 0 };
            const val = itemData.jumlah || 0;
            sum += val;
            text += `- ${item} : ${val}${getHintStr(itemData)}\n`;
        });
        text += `TOTAL : ${sum}\n\n`;
    });
    return text;
};

export type PdfExporterHandle = { share: () => Promise<void>; };

const fmt = (n: number | string) => 
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(n) || 0);

const fmtCompact = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "jt";
  if (n >= 1000) return (n / 1000).toFixed(0) + "rb";
  return String(n);
};

const AppleChart = ({ history }: { history: HistoryItem[] }) => {
  const chartData = useMemo(() => {
    if (!history) return [];
    const raw = [...history].slice(0, 7).reverse(); 
    return raw.map(h => {
        const total = Number(h.totalHarian) + Number(h.totalJajanan) + Number(h.totalJasaAks) + Number(h.totalSewa);
        return { label: h.hari.substring(0, 3), value: total };
    });
  }, [history]);

  if (chartData.length === 0) return null;
  const width = 600; const height = 180; const padding = 10;
  const maxVal = Math.max(...chartData.map(d => d.value)) * 1.15 || 100;
  const barWidth = 45;
  const gap = (width - (padding * 2) - (chartData.length * barWidth)) / Math.max(1, chartData.length - 1);
  return (
    <div className="w-full mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            <line x1="0" y1={height - 20} x2={width} y2={height - 20} stroke="#f4f4f5" strokeWidth="2" />
            {chartData.map((d, i) => {
                const x = padding + i * (barWidth + gap);
                const barHeight = (d.value / maxVal) * (height - 40);
                const y = height - 20 - barHeight;
                const isToday = i === chartData.length - 1;
                return (
                    <g key={i}>
                        <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" fill={isToday ? "#2563eb" : "#e4e4e7"} />
                        <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="14" fontWeight="bold" fill={isToday ? "#2563eb" : "#71717a"}>{fmtCompact(d.value)}</text>
                        <text x={x + barWidth / 2} y={height} textAnchor="middle" fontSize="12" fontWeight="500" fill="#a1a1aa">{d.label}</text>
                    </g>
                );
            })}
        </svg>
    </div>
  );
};

const AppleReportTemplate = forwardRef<HTMLDivElement, { data: Props['data'] }>(({ data }, ref) => {
  const GrandTotal = data.totalHarian + data.totalJajanan + data.totalJasaAks + data.totalSewa;
  return (
    <div ref={ref} className="w-[1200px] min-h-[1600px] bg-white text-zinc-900 p-12 font-sans antialiased">
      <div className="flex justify-between items-end border-b-2 border-zinc-900 pb-6 mb-8">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900">Laporan Harian</h1>
          <p className="text-zinc-500 text-lg mt-1 font-medium tracking-wide">URBAN GAMING LAMPUNG</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-zinc-800">{data.hari}</p>
          <p className="text-zinc-500 font-medium">{data.tanggal}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
          <p className="text-zinc-500 text-sm font-semibold uppercase tracking-wider mb-1">Total Pemasukan</p>
          <p className="text-4xl font-extrabold text-black">{fmt(GrandTotal)}</p>
        </div>
        <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
          <p className="text-zinc-500 text-sm font-semibold uppercase tracking-wider mb-1">Cash</p>
          <p className="text-3xl font-bold text-emerald-600">{fmt(data.totalCash)}</p>
        </div>
        <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
          <p className="text-zinc-500 text-sm font-semibold uppercase tracking-wider mb-1">Transfer / QRIS</p>
          <p className="text-3xl font-bold text-blue-600">{fmt(data.totalTransfer)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-8 text-sm text-zinc-600 border-b border-zinc-100 pb-6">
        <div><span className="font-bold text-zinc-900 mr-2">Tanggal Shift:</span>{data.absenPagi || "-"} / {data.absenSiang || "-"}</div>
        <div className="text-right italic">"{data.catatan || "Tidak ada catatan operasional."}"</div>
      </div>
      <div className="space-y-8 mb-10">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-3 border-b border-zinc-200 pb-2 flex justify-between"><span>Pemasukan Harian</span> <span className="text-zinc-500">{fmt(data.totalHarian)}</span></h3>
            <table className="w-full text-sm"><tbody className="divide-y divide-zinc-100">{data.rowsHarian.map((r, i) => r.harga ? (<tr key={i}><td className="py-2">{r.jenisPS} ({r.jumlahJam} jam)</td><td className="py-2 text-right font-bold">{fmt(r.harga)}</td></tr>) : null)}</tbody></table>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3 border-b border-zinc-200 pb-2 flex justify-between"><span>Sewa PS</span> <span className="text-zinc-500">{fmt(data.totalSewa)}</span></h3>
            <table className="w-full text-sm"><tbody className="divide-y divide-zinc-100">{data.rowsSewa.map((r, i) => r.harga ? (<tr key={i}><td className="py-2">{r.jenisPS} ({r.lamaSewa})</td><td className="py-2 text-right font-bold">{fmt(r.harga)}</td></tr>) : null)}</tbody></table>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-bold mb-3 border-b border-zinc-200 pb-2 flex justify-between"><span>Jajanan</span> <span className="text-zinc-500">{fmt(data.totalJajanan)}</span></h3>
            <table className="w-full text-sm"><tbody className="divide-y divide-zinc-100">{data.rowsJajanan.map((r, i) => r.harga ? (<tr key={i}><td className="py-2">{r.jenisJajanan} (x{r.qtyJam})</td><td className="py-2 text-right font-bold">{fmt(r.harga)}</td></tr>) : null)}</tbody></table>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-3 border-b border-zinc-200 pb-2 flex justify-between"><span>Jasa & Aksesoris</span> <span className="text-zinc-500">{fmt(data.totalJasaAks)}</span></h3>
            <table className="w-full text-sm"><tbody className="divide-y divide-zinc-100">{data.rowsJasaAks.map((r, i) => r.harga ? (<tr key={i}><td className="py-2">{r.tipe}</td><td className="py-2 text-right font-bold">{fmt(r.harga)}</td></tr>) : null)}</tbody></table>
          </div>
        </div>
      </div>
      <div className="pt-6 border-t-4 border-zinc-900">
           <h3 className="text-lg font-bold mb-4 uppercase tracking-wider">Performa 7 Hari Terakhir</h3>
           <div className="w-full mb-8">
             <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-400 border-b border-zinc-100">
                    <th className="pb-2 font-normal">Tanggal</th><th className="pb-2 font-normal">Hari</th><th className="pb-2 text-right font-normal">Total</th><th className="pb-2 text-right font-normal text-emerald-500">Cash</th><th className="pb-2 text-right font-normal text-violet-500">TF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {data.history.slice(0, 7).map((h, i) => {
                     const total = Number(h.totalHarian) + Number(h.totalJajanan) + Number(h.totalJasaAks) + Number(h.totalSewa);
                     return (
                      <tr key={i} className="text-zinc-700">
                        <td className="py-3 font-medium">{h.tanggal}</td><td className="py-3">{h.hari}</td><td className="py-3 text-right font-bold">{fmt(total)}</td><td className="py-3 text-right">{fmt((h as any).totalCash)}</td><td className="py-3 text-right">{fmt((h as any).totalTransfer)}</td>
                      </tr>
                     )
                  })}
                </tbody>
             </table>
           </div>
           <div className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
              <AppleChart history={data.history} />
           </div>
      </div>
    </div>
  );
});

const PdfExporter = forwardRef<PdfExporterHandle, Props>(function PdfExporter({ rootRef, dark, kualitasGambar, data, stokData, masterCategories, onStartExport, onEndExport }, ref) {
  const appleReportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState("Menyiapkan layout Dokumen PDF...");
  const [progress, setProgress] = useState(0);

  const captureSection = async (id: string, name: string, contentWidth: number, scale: number) => {
     const el = document.getElementById(id);
     if (!el) return null;

     try {
         // --- PRE-CALCULATION FOR INVALID STATE ERROR FIX ---
         // Kita ambil ukuran asli elemen sebelum cloning untuk disuntikkan nanti
         const rect = el.getBoundingClientRect();
         const safeWidth = rect.width || 1200; // Fallback width
         const safeHeight = rect.height || 200; // Fallback height

         const canvas = await html2canvas(el, {
            scale,
            useCORS: true,
            logging: false, // Matikan log untuk performa
            backgroundColor: dark ? "#18181b" : "#ffffff",
            windowWidth: 1280,
            onclone: (clonedDoc) => {
                // 1. FIX INPUT TEXT: Ubah input jadi DIV
                const inputs = clonedDoc.querySelectorAll("input, textarea");
                inputs.forEach((input: any) => {
                    const val = input.value || input.placeholder || "";
                    const textDiv = clonedDoc.createElement("div");
                    textDiv.textContent = val;
                    // Salin class layout
                    textDiv.className = input.className;
                    // Salin property css spesifik
                    const style = window.getComputedStyle(input);
                    textDiv.style.color = style.color; 
                    textDiv.style.fontSize = style.fontSize;
                    textDiv.style.fontFamily = style.fontFamily;
                    textDiv.style.fontWeight = style.fontWeight;
                    textDiv.style.textAlign = style.textAlign; 
                    textDiv.style.padding = style.padding;
                    textDiv.style.display = "flex";
                    textDiv.style.alignItems = "center";
                    textDiv.style.justifyContent = style.textAlign === "right" ? "flex-end" : style.textAlign === "center" ? "center" : "flex-start";
                    
                    if (input.parentNode) input.parentNode.replaceChild(textDiv, input);
                });

                // 2. NUCLEAR FIX: FORCE GRADIENT CONTAINER DIMENSIONS
                // Ini memperbaiki InvalidStateError pada Rekap Keuangan
                const gradients = clonedDoc.querySelectorAll("[class*='bg-gradient-']");
                gradients.forEach((el: any) => {
                     // Paksa elemen gradient memiliki dimensi pixel, bukan 0
                     el.style.width = "100%";
                     el.style.minWidth = "100px";
                     el.style.minHeight = "50px";
                     el.style.display = "block";
                });

                // 3. NUCLEAR FIX: FORCE SVG DIMENSIONS
                const svgs = clonedDoc.querySelectorAll("svg");
                svgs.forEach((svg: any) => {
                    const style = window.getComputedStyle(svg);
                    // Gunakan parseFloat untuk mendapatkan angka pixel dari "24px"
                    let w = parseFloat(style.width) || 24;
                    let h = parseFloat(style.height) || 24;
                    
                    // Paksa tulis ke atribut. Tanpa ini, html2canvas sering merender 0x0
                    svg.setAttribute("width", String(w));
                    svg.setAttribute("height", String(h));
                    svg.style.width = `${w}px`;
                    svg.style.height = `${h}px`;
                    svg.style.display = "inline-block";
                });
            }
         });
         
         if (canvas.width > 0 && canvas.height > 0) {
             const imgData = canvas.toDataURL("image/jpeg", 0.9);
             const imgH = (canvas.height * contentWidth) / canvas.width;
             return { name, imgData, width: contentWidth, height: imgH };
         }
     } catch (e) {
         console.warn(`Gagal capture ${name}`, e);
     }
     return null;
  };

  const shareOrDownloadPDF = async () => {
    if (!rootRef.current || !appleReportRef.current) return;
    const currentScroll = window.scrollY;
    
    setIsGenerating(true);
    setProgress(0);
    setLoadingText("Memindai data & merender halaman layout...");
    
    // Scroll ke atas agar html2canvas menangkap layout dengan benar
    window.scrollTo(0, 0);

    let pdf: jsPDF | null = null;
    let filename = `Laporan_URBAN_${data.tanggal}.pdf`;

    try {
      if (onStartExport) {
        onStartExport();
        await new Promise(r => setTimeout(r, 300)); // Tunggu React mem-flush layout Desktop
      }
      
      const tempPdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
      const pdfWidth = tempPdf.internal.pageSize.getWidth();
      const pdfHeight = tempPdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pdfWidth - (margin * 2);
      const scale = kualitasGambar === "Tinggi" ? 2 : 1.5;

      // --- PARALLEL PROCESSING (APPLE OPTIMIZATION) ---
      // Kita jalankan semua capture secara BERSAMAAN (Parallel) menggunakan Promise.all
      // Ini drastis mengurangi waktu tunggu dan mencegah Share API timeout.
      
      const capturePromises = [
        // 1. Cover (Apple Report)
        html2canvas(appleReportRef.current, { scale: 2, useCORS: true, windowWidth: 1280 }).then(canvas => {
             if (canvas.width > 0 && canvas.height > 0) {
                 const imgData = canvas.toDataURL("image/jpeg", 1.0);
                 const height = (canvas.height * pdfWidth) / canvas.width;
                 return { type: 'cover', imgData, width: pdfWidth, height };
             }
             return null;
        }).catch(() => null),

        // 2. Sections (Evidence)
        ...[
            { name: "Input & Absensi", id: "section-input" },
            { name: "Tabel Pemasukan", id: "section-rincian" },
            { name: "Rekap Keuangan", id: "section-rekap" }, 
            { name: "Rincian Pengeluaran", id: "section-pengeluaran" },
            { name: "Rincian Setoran", id: "section-setoran" },
            { name: "History Pembukuan", id: "section-history" },
            { name: "Grafik Performa", id: "section-grafik" }
        ].map(item => captureSection(item.id, item.name, contentWidth, scale))
      ];

      // TUNGGU SEMUA SELESAI DENGAN PROGRESS
      let completed = 0;
      const totalTasks = capturePromises.length;
      const trackedPromises = capturePromises.map(p => p.then(res => {
          completed++;
          setProgress(Math.round((completed / totalTasks) * 85)); // 85% untuk tahap rendering grafik html2canvas
          return res;
      }));

      const results = await Promise.all(trackedPromises);

      // --- SUSUN PDF DARI HASIL PARALLEL ---
      setLoadingText("Menyusun halaman PDF...");
      setProgress(90);
      
      // Page 1: Cover
      const coverResult = results[0] as any;
      if (coverResult) {
          // Buat halaman pertama secara dinamis, mencegah crop jika data sangat panjang
          const firstPageHeight = Math.max(pdfHeight, coverResult.height);
          pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [pdfWidth, firstPageHeight] });
          pdf.addImage(coverResult.imgData, "JPEG", 0, 0, coverResult.width, coverResult.height);
      } else {
          pdf = new jsPDF({ orientation: "portrait", unit: "px", format: "a4" });
      }

      // Page 2: Evidence
      let totalHeightNeeded = 60;
      const evidenceResults = results.slice(1).filter(r => r !== null) as {name: string, imgData: string, width: number, height: number}[];
      
      evidenceResults.forEach(r => totalHeightNeeded += r.height + 30);
      
      const customPageHeight = Math.max(pdfHeight, totalHeightNeeded + 50);
      pdf.addPage([pdfWidth, customPageHeight], "portrait"); 
      pdf.setFontSize(14); pdf.setTextColor(0); pdf.text("Screenshot Bukti Input", margin, 30);
      pdf.setDrawColor(200); pdf.line(margin, 35, pdfWidth - margin, 35);

      let currentY = 55;
      for (const item of evidenceResults) {
         pdf.setFontSize(8); pdf.text(item.name.toUpperCase(), margin, currentY - 5);
         pdf.addImage(item.imgData, "JPEG", margin, currentY, item.width, item.height);
         currentY += item.height + 30;
      }

      // --- PAGE 3: TEXT REPORT ---
      const aiText = generateLaporanText(data.history, data);
      pdf.setFont("courier", "normal"); pdf.setFontSize(9);
      const splitText = pdf.splitTextToSize(aiText, contentWidth);
      const textHeight = splitText.length * pdf.getLineHeight();
      const finalPage3Height = Math.max(pdfHeight, 50 + textHeight + 30);

      pdf.addPage([pdfWidth, finalPage3Height], "portrait");
      pdf.setFont("courier", "bold"); pdf.setFontSize(14); pdf.setTextColor(40, 40, 40);
      pdf.text("LAPORAN TEXT", margin, 30);
      pdf.setDrawColor(0); pdf.line(margin, 35, pdfWidth - margin, 35);
      pdf.setFont("courier", "normal"); pdf.setFontSize(9);
      pdf.text(splitText, margin, 50);

      // --- PAGE 4: STOK TEXT REPORT ---
      const stokText = generateLaporanStokText(stokData, masterCategories);
      const splitStok = pdf.splitTextToSize(stokText, contentWidth);
      const stokHeight = splitStok.length * pdf.getLineHeight();
      const finalPage4Height = Math.max(pdfHeight, 50 + stokHeight + 30);

      pdf.addPage([pdfWidth, finalPage4Height], "portrait");
      pdf.setFont("courier", "bold"); pdf.setFontSize(14); pdf.setTextColor(40, 40, 40);
      pdf.text("LAPORAN STOK", margin, 30);
      pdf.setDrawColor(0); pdf.line(margin, 35, pdfWidth - margin, 35);
      pdf.setFont("courier", "normal"); pdf.setFontSize(9);
      pdf.text(splitStok, margin, 50);

      setLoadingText("Menyimpan & Menyiapkan Jendela Bagikan...");
      setProgress(100);
      // ===== FINAL: WEB SHARE API =====
      const pdfBlob = pdf.output("blob");
      const file = new File([pdfBlob], filename, { type: "application/pdf" });

      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ 
                files: [file], 
                title: "Laporan Harian URBAN Gaming", 
                text: `Berikut laporan harian untuk tanggal ${data.tanggal}` 
            });
        } else {
            throw new Error("Share API not supported");
        }
      } catch (shareError: any) {
        // Silent Fallback: Jika share gagal, langsung download
        if (shareError.name !== "AbortError" && !shareError.message?.includes("User canceled")) {
            console.log("Share API failed, falling back to download.", shareError);
            pdf.save(filename);
        }
      }

    } catch (err: any) {
      console.error("Critical PDF Generation Error:", err);
      alert("Gagal membuat PDF: " + (err.message || "Unknown error"));
    } finally {
      if (onEndExport) {
         onEndExport();
         await new Promise(r => setTimeout(r, 100));
      }
      setIsGenerating(false);
      window.scrollTo(0, currentScroll);
    }
  };

  useImperativeHandle(ref, () => ({ share: shareOrDownloadPDF }));

  return (
    <>
      <div style={{ position: "absolute", left: "-9999px", top: 0, overflow: "hidden" }}>
        <AppleReportTemplate ref={appleReportRef} data={data} />
      </div>
      
      {isGenerating && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-[28px] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 ring-1 ring-black/5 dark:ring-white/10">
             
             {/* Animasi Ikon PDF */}
             <div className="w-16 h-16 mb-6 relative flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 rounded-2xl">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                   <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/>
                </svg>
             </div>
             
             <h3 className="text-[19px] font-bold text-zinc-900 dark:text-white mb-2">Memproses PDF</h3>
             <p className="text-[14px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[260px] mx-auto mb-6 h-10 flex items-center justify-center">
                 {loadingText}
             </p>

             {/* Progress Bar Container */}
             <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-3.5 mb-2 overflow-hidden shadow-inner ring-1 ring-inset ring-black/5 dark:ring-white/5 p-0.5 relative">
                <div 
                   className="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden" 
                   style={{ width: `${progress}%` }}
                >
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                </div>
             </div>
             
             {/* Percentage Text */}
             <div className="text-[13px] font-bold text-blue-600 dark:text-blue-400 font-mono tracking-wider">
                 {progress}%
             </div>
             
          </div>
        </div>
      )}
    </>
  );
});

export default PdfExporter;