/**
 * PDF REPORT BUILDER — 100% Native Vector jsPDF (Apple iOS 27 Editorial Design).
 *
 * Menggantikan html2canvas yang berat (5–15 detik, 5–18 MB, sering gagal Web Share API
 * pada HP low-end karena user-activation kedaluwarsa & gambar buram/terpotong).
 *
 * Hasil: A4 multi-halaman standar, vektor tajam (infinite zoom), ukuran ~25–75 KB (compress: true),
 * waktu render ~25–80 ms di perangkat low-end, siap langsung dipanggil Web Share API.
 */
import type JsPDF from "jspdf";
import type { HistoryItem, RowHarian, RowJajanan, RowJasaAks, RowSewa } from "./types";
import type { MasterStokCategories, StokData, StokKategori } from "../hooks/useStokData";
import type { KunciRincian } from "./tampilRincian";
import { formatK, rpShort, rupiah, tanggalAngka, toInt } from "./format";
import { totalPemasukanHarian } from "./keuangan";
import { dariYmd } from "./dateLocal";
import { rentangMinggu, rincianHariLaporan, TARGET_HARIAN } from "./laporan";
import { isKategoriDihapus, isKategoriJajanan } from "./stokRental";
import { toAscii } from "./posReceipt";

export type PdfExportData = {
  tanggal: string;
  hari: string;
  shiftPegawai?: string;
  absenPagi: string;
  absenSiang: string;
  rukoBuka?: string;
  rukoTutup?: string;
  catatan: string;
  rowsHarian: RowHarian[];
  rowsJajanan: RowJajanan[];
  rowsJasaAks: RowJasaAks[];
  rowsSewa: RowSewa[];
  totalHarian: number;
  totalJajanan: number;
  totalJasaAks: number;
  totalSewa: number;
  totalCash: number;
  totalTransfer: number;
  totalPengeluaran?: number;
  history: HistoryItem[];
  rowsSetoran?: any[];
  rowsPengeluaran?: any[];
  ongkirMasukGaji?: boolean;
  exportedBy?: string;
};

export type PdfBuildOptions = {
  data: PdfExportData;
  stokData?: StokData;
  masterCategories?: MasterStokCategories;
  kualitasGambar?: "Tinggi" | "Hemat";
  tampil: (kunci: KunciRincian, nilai?: number) => boolean;
};

export type PdfBuildResult = {
  pdf: JsPDF;
  blob: Blob;
  filename: string;
  pageCount: number;
  sizeBytes: number;
  durationMs: number;
};

type RGB = readonly [number, number, number];

/** Palet resmi Apple iOS 27 (UDS v4) — kontras cetak bersih di atas kertas putih. */
const C = {
  white: [255, 255, 255] as RGB,
  canvas: [245, 245, 247] as RGB,
  tile: [248, 248, 250] as RGB,
  zebra: [250, 250, 252] as RGB,
  border: [229, 229, 234] as RGB,
  sep: [236, 236, 240] as RGB,
  label: [17, 17, 19] as RGB,
  label2: [82, 82, 88] as RGB,
  label3: [134, 134, 142] as RGB,
  positive: [0, 137, 50] as RGB,
  positiveBg: [234, 248, 238] as RGB,
  positiveBd: [195, 235, 206] as RGB,
  negative: [224, 36, 42] as RGB,
  negativeBg: [253, 236, 236] as RGB,
  negativeBd: [247, 202, 204] as RGB,
  warning: [197, 83, 0] as RGB,
  warningBg: [255, 243, 230] as RGB,
  warningBd: [248, 217, 184] as RGB,
  tint: [0, 136, 255] as RGB,
  tintBg: [235, 245, 255] as RGB,
  tintBd: [194, 224, 255] as RGB,
  indigo: [75, 65, 209] as RGB,
  indigoBg: [239, 239, 254] as RGB,
  purple: [164, 33, 184] as RGB,
  purpleBg: [249, 236, 252] as RGB,
  orange: [255, 141, 40] as RGB,
  barIdle: [229, 229, 234] as RGB,
} as const;

const PAGE_W = 595.28; // A4 Portrait (pt)
const PAGE_H = 841.89;
const M = 32;
const CW = PAGE_W - M * 2;
const TOP_NEXT = 50;
const BOTTOM_LIMIT = PAGE_H - 42;

const clean = (s: unknown): string => toAscii(String(s ?? "")).replace(/\s+/g, " ").trim();
const rp = (n: unknown) => clean(rupiah(toInt(n)));
const fmtK0 = (n: number) => clean(formatK(n) || "0");

const BULAN_PANJANG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmtTanggalIndo(ymdStr: string): string {
  const d = dariYmd(ymdStr);
  if (!d) return clean(ymdStr || "-");
  return `${d.getDate()} ${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`;
}

function shortAbsen(s: unknown): string {
  const t = clean(s);
  if (!t) return "-";
  // "10:02 - 24/11/2026" -> "10:02 (24/11)" agar ringkas dan tidak terpotong di strip Page 1
  const m = t.match(/^(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}\/\d{1,2})(?:\/\d{2,4})?$/);
  if (m) return `${m[1]} (${m[2]})`;
  return t;
}

function formatDurasiSewa(r: RowSewa): string {
  if (r.lamaSewa === "Isi Sendiri" && r._customDurasi) return `${clean(r._customDurasi)} jam`;
  return clean(r.lamaSewa || "-");
}
function fmtTanggalSingkat(ymdStr: string): string {
  const d = dariYmd(ymdStr);
  if (!d) return clean(ymdStr || "-");
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
}

function setText(doc: JsPDF, size: number, style: "normal" | "bold" | "italic", color: RGB) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(color[0], color[1], color[2]);
}

function fitText(doc: JsPDF, text: string, maxW: number): string {
  const t = clean(text);
  if (!t || maxW <= 4) return "";
  if (doc.getTextWidth(t) <= maxW) return t;
  const ell = "...";
  const ellW = doc.getTextWidth(ell);
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.getTextWidth(t.slice(0, mid)) + ellW <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return lo > 0 ? t.slice(0, lo).trimEnd() + ell : ell;
}

function fillStrokeRect(
  doc: JsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: RGB,
  stroke?: RGB,
  lineWidth = 0.6
) {
  if (fill) doc.setFillColor(fill[0], fill[1], fill[2]);
  if (stroke) {
    doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
    doc.setLineWidth(lineWidth);
  }
  const mode = fill && stroke ? "FD" : fill ? "F" : "S";
  if (r > 0) doc.roundedRect(x, y, w, h, r, r, mode);
  else doc.rect(x, y, w, h, mode);
}

function hLine(doc: JsPDF, x1: number, y: number, x2: number, color: RGB = C.sep, width = 0.6) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(width);
  doc.line(x1, y, x2, y);
}

function drawPill(
  doc: JsPDF,
  x: number,
  y: number,
  label: string,
  fg: RGB,
  bg: RGB,
  align: "left" | "right" = "left",
  fontSize = 6.8
): number {
  const t = clean(label);
  setText(doc, fontSize, "bold", fg);
  const tw = doc.getTextWidth(t);
  const pw = tw + 10;
  const ph = fontSize + 5.5;
  const px = align === "right" ? x - pw : x;
  fillStrokeRect(doc, px, y, pw, ph, ph / 2, bg);
  doc.text(t, px + pw / 2, y + ph - 3.6, { align: "center" });
  return pw;
}

/**
 * Bangun dokumen PDF Laporan Harian URBAN Gaming (100% Native Vector).
 */
export function buildLaporanPdf(JsPDFCtor: typeof JsPDF, opts: PdfBuildOptions): PdfBuildResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, stokData, masterCategories, kualitasGambar = "Tinggi", tampil } = opts;
  const isHemat = kualitasGambar === "Hemat";

  const doc = new JsPDFCtor({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
    compress: true,
    putOnlyUsedFonts: true,
  });

  let y = M;
  let runningLabel = "Laporan Harian";

  const drawRunningHeader = (label: string) => {
    setText(doc, 7.5, "bold", C.label3);
    doc.text("URBAN GAMING LAMPUNG", M, 24);
    setText(doc, 7.5, "bold", C.label2);
    doc.text(clean(label).toUpperCase(), PAGE_W - M, 24, { align: "right" });
    hLine(doc, M, 31, PAGE_W - M, C.border, 0.6);
  };

  const newPage = (label?: string) => {
    if (label) runningLabel = label;
    doc.addPage("a4", "portrait");
    drawRunningHeader(runningLabel);
    y = TOP_NEXT;
  };

  const ensure = (needH: number, onBreak?: () => void) => {
    if (y + needH > BOTTOM_LIMIT) {
      newPage();
      onBreak?.();
    }
  };

  const drawSectionBanner = (title: string, subtitle?: string) => {
    ensure(subtitle ? 38 : 26);
    setText(doc, 13.5, "bold", C.label);
    doc.text(clean(title), M, y + 11);
    if (subtitle) {
      setText(doc, 8, "normal", C.label2);
      doc.text(clean(subtitle), M, y + 22);
      hLine(doc, M, y + 29, PAGE_W - M, C.label, 1.1);
      y += 37;
    } else {
      hLine(doc, M, y + 17, PAGE_W - M, C.label, 1.1);
      y += 25;
    }
  };

  const drawSubheading = (title: string, rightText?: string, dotColor?: RGB) => {
    ensure(28);
    let tx = M;
    if (dotColor) {
      doc.setFillColor(dotColor[0], dotColor[1], dotColor[2]);
      doc.circle(M + 3.5, y + 6.5, 3, "F");
      tx = M + 11;
    }
    setText(doc, 9.5, "bold", C.label);
    doc.text(clean(title), tx, y + 9.5);
    if (rightText) {
      setText(doc, 9, "bold", C.label2);
      doc.text(clean(rightText), PAGE_W - M, y + 9.5, { align: "right" });
    }
    y += 15;
  };

  // =========================================================================
  // HITUNG DATA INTI HARI INI & BULAN INI (SSOT)
  // =========================================================================
  const grandTotal = totalPemasukanHarian(data);
  const totalCash = toInt(data.totalCash);
  const totalTransfer = toInt(data.totalTransfer);
  const rowsPengeluaran = Array.isArray(data.rowsPengeluaran) ? data.rowsPengeluaran : [];
  const rowsSetoran = Array.isArray(data.rowsSetoran) ? data.rowsSetoran : [];
  const totalPengeluaran =
    typeof data.totalPengeluaran === "number"
      ? toInt(data.totalPengeluaran)
      : rowsPengeluaran.reduce((s, r) => s + toInt(r?.harga), 0);
  const pendapatanBersih = grandTotal - totalPengeluaran;
  const totalPay = totalCash + totalTransfer;
  const cashPct = totalPay > 0 ? Math.round((totalCash / totalPay) * 100) : 0;
  const tfPct = totalPay > 0 ? 100 - cashPct : 0;

  // Gabungkan hari ini bila belum masuk history untuk grafik 7 hari
  const historyList = Array.isArray(data.history) ? data.history : [];
  const hasTodayInHistory = historyList.some((h) => h.tanggal === data.tanggal);
  const mergedHistory: HistoryItem[] = hasTodayInHistory
    ? historyList
    : [
        {
          id: "current",
          tanggal: data.tanggal,
          hari: data.hari,
          totalHarian: toInt(data.totalHarian),
          totalJajanan: toInt(data.totalJajanan),
          totalJasaAks: toInt(data.totalJasaAks),
          totalSewa: toInt(data.totalSewa),
          totalCash,
          totalTransfer,
          catatan: data.catatan,
          rowsHarian: data.rowsHarian,
          rowsJajanan: data.rowsJajanan,
          rowsJasaAks: data.rowsJasaAks,
          rowsSewa: data.rowsSewa,
          rowsSetoran,
        },
        ...historyList,
      ].sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)));

  const last7Desc = mergedHistory.slice(0, 7);
  const last7Asc = [...last7Desc].reverse();

  // =========================================================================
  // HALAMAN 1: RINGKASAN EKSEKUTIF (LAPORAN HARIAN + PERFORMA 7 HARI)
  // =========================================================================
  runningLabel = `Laporan Harian - ${data.tanggal}`;

  // Header Brand & Tanggal
  setText(doc, 7.5, "bold", C.label3);
  doc.text("URBAN GAMING LAMPUNG  -  PEMBUKUAN DIGITAL", M, y + 7);
  setText(doc, 22, "bold", C.label);
  doc.text("Laporan Harian", M, y + 30);

  setText(doc, 15, "bold", C.label);
  doc.text(clean(data.hari || "-"), PAGE_W - M, y + 17, { align: "right" });
  setText(doc, 9, "normal", C.label2);
  doc.text(fmtTanggalIndo(data.tanggal), PAGE_W - M, y + 30, { align: "right" });
  y += 40;
  hLine(doc, M, y, PAGE_W - M, C.label, 1.3);
  y += 14;

  // 4 KPI Cards (Apple iOS 27 Tinted Tiles)
  const kpiGap = 8;
  const kpiW = (CW - kpiGap * 3) / 4;
  const kpiH = 56;
  const kpis: {
    label: string;
    value: string;
    sub: string;
    valColor: RGB;
    bg: RGB;
    bd: RGB;
  }[] = [
    {
      label: "TOTAL PEMASUKAN",
      value: rp(grandTotal),
      sub: "Pemasukan kotor",
      valColor: C.label,
      bg: C.canvas,
      bd: C.border,
    },
    {
      label: "CASH (TUNAI)",
      value: rp(totalCash),
      sub: `${cashPct}% dari total`,
      valColor: C.positive,
      bg: C.positiveBg,
      bd: C.positiveBd,
    },
    {
      label: "TRANSFER / QRIS",
      value: rp(totalTransfer),
      sub: `${tfPct}% dari total`,
      valColor: C.tint,
      bg: C.tintBg,
      bd: C.tintBd,
    },
    {
      label: "PENDAPATAN BERSIH",
      value: rp(pendapatanBersih),
      sub: totalPengeluaran > 0 ? `Keluar -${rp(totalPengeluaran)}` : "Tanpa pengeluaran",
      valColor: pendapatanBersih >= 0 ? C.positive : C.negative,
      bg: pendapatanBersih >= 0 ? C.positiveBg : C.negativeBg,
      bd: pendapatanBersih >= 0 ? C.positiveBd : C.negativeBd,
    },
  ];

  kpis.forEach((k, idx) => {
    const x = M + idx * (kpiW + kpiGap);
    fillStrokeRect(doc, x, y, kpiW, kpiH, 10, k.bg, k.bd, 0.7);
    setText(doc, 6.6, "bold", C.label2);
    doc.text(k.label, x + 10, y + 14);
    setText(doc, 12.5, "bold", k.valColor);
    doc.text(fitText(doc, k.value, kpiW - 20), x + 10, y + 34);
    setText(doc, 7, "normal", C.label2);
    doc.text(fitText(doc, k.sub, kpiW - 20), x + 10, y + 47);
  });
  y += kpiH + 10;

  // Payment Split Bar (Apple iOS 27 SplitBar dengan celah tipis antar segmen)
  fillStrokeRect(doc, M, y, CW, 6, 3, C.border);
  if (totalPay > 0) {
    const gap = totalCash > 0 && totalTransfer > 0 ? 2 : 0;
    const cashW = totalCash > 0 ? Math.max(6, (totalCash / totalPay) * (CW - gap)) : 0;
    const tfW = totalTransfer > 0 ? Math.max(6, CW - cashW - gap) : 0;
    if (cashW > 0) fillStrokeRect(doc, M, y, cashW, 6, 3, C.positive);
    if (tfW > 0) fillStrokeRect(doc, M + cashW + gap, y, tfW, 6, 3, C.tint);
  }
  y += 14;

  // Operational Info Card (Shift, Absen, Ruko, Target, Catatan)
  const catatanBersih = clean(data.catatan);
  const catatanLines = catatanBersih
    ? doc.splitTextToSize(`Catatan: ${catatanBersih}`, CW - 20).slice(0, 2)
    : [];
  const opH = catatanLines.length ? 46 + catatanLines.length * 10 : 40;
  fillStrokeRect(doc, M, y, CW, opH, 10, C.tile, C.border, 0.6);

  const hariIniLap = rincianHariLaporan(data);
  const selisihTarget = hariIniLap.total - TARGET_HARIAN;
  const opCols = [
    { label: "SHIFT", val: clean(data.shiftPegawai || "-") },
    { label: "ABSEN MASUK / PULANG", val: `${shortAbsen(data.absenPagi)} / ${shortAbsen(data.absenSiang)}` },
    { label: "RUKO BUKA / TUTUP", val: `${clean(data.rukoBuka || "-")}  /  ${clean(data.rukoTutup || "-")}` },
    {
      label: `TARGET (${fmtK0(TARGET_HARIAN)})`,
      val: selisihTarget >= 0 ? `Tercapai (+${fmtK0(selisihTarget)})` : `Kurang ${fmtK0(Math.abs(selisihTarget))}`,
      color: selisihTarget >= 0 ? C.positive : C.warning,
    },
  ];
  const opColW = (CW - 20) / 4;
  opCols.forEach((col, i) => {
    const cx = M + 10 + i * opColW;
    if (i > 0) {
      doc.setDrawColor(C.border[0], C.border[1], C.border[2]);
      doc.setLineWidth(0.5);
      doc.line(cx - 5, y + 8, cx - 5, y + 31);
    }
    setText(doc, 6.2, "bold", C.label3);
    doc.text(col.label, cx, y + 14);
    setText(doc, 7.8, "bold", col.color || C.label);
    doc.text(fitText(doc, col.val, opColW - 8), cx, y + 27);
  });
  if (catatanLines.length) {
    hLine(doc, M + 10, y + 36, PAGE_W - M - 10, C.sep, 0.5);
    setText(doc, 7.5, "italic", C.label2);
    doc.text(catatanLines, M + 10, y + 47);
  }
  y += opH + 14;

  // Ringkasan Pemasukan Hari Ini (hanya kategori aktif / bernilai > 0)
  type SummaryCardItem = { left: string; badge?: string; right: string };
  type SummaryCard = { title: string; total: number; dot: RGB; items: SummaryCardItem[]; totalCount: number };
  const summaryCards: SummaryCard[] = [];

  if (tampil("sewa", data.totalSewa)) {
    const rows = (data.rowsSewa || []).filter((r) => toInt(r.harga) > 0 || (r.jenisPS && r.isPaid === "TIDAK"));
    summaryCards.push({
      title: "Sewa PS",
      total: toInt(data.totalSewa),
      dot: C.indigo,
      totalCount: rows.length,
      items: rows.slice(0, 6).map((r) => ({
        left: `${clean(r.jenisPS)} (${formatDurasiSewa(r)})${r.ket ? ` - ${clean(r.ket)}` : ""}`,
        badge: r.isPaid === "TIDAK" ? "BELUM" : clean(r.bayar || ""),
        right: r.isPaid === "TIDAK" ? "Belum bayar" : rp(r.harga),
      })),
    });
  }
  if (tampil("jasaAks", data.totalJasaAks)) {
    const rows = (data.rowsJasaAks || []).filter((r) => toInt(r.harga) > 0);
    summaryCards.push({
      title: "Pemasukan Usaha",
      total: toInt(data.totalJasaAks),
      dot: C.purple,
      totalCount: rows.length,
      items: rows.slice(0, 6).map((r) => ({
        left: `${clean(r.tipe)}${r.ket ? ` - ${clean(r.ket)}` : ""}`,
        badge: clean(r.bayar || ""),
        right: rp(r.harga),
      })),
    });
  }
  if (tampil("harian", data.totalHarian)) {
    const rows = (data.rowsHarian || []).filter((r) => toInt(r.harga) > 0);
    summaryCards.push({
      title: "Pemasukan Harian",
      total: toInt(data.totalHarian),
      dot: C.tint,
      totalCount: rows.length,
      items: rows.slice(0, 6).map((r) => ({
        left: `${clean(r.jenisPS)} (${clean(r.jumlahJam)} jam)`,
        badge: clean(r.bayar || ""),
        right: rp(r.harga),
      })),
    });
  }
  if (tampil("jajanan", data.totalJajanan)) {
    const rows = (data.rowsJajanan || []).filter((r) => toInt(r.harga) > 0);
    summaryCards.push({
      title: "Jajanan",
      total: toInt(data.totalJajanan),
      dot: C.orange,
      totalCount: rows.length,
      items: rows.slice(0, 6).map((r) => ({
        left: `${clean(r.jenisJajanan)} (x${clean(r.qtyJam || 1)})`,
        badge: clean(r.bayar || ""),
        right: rp(r.harga),
      })),
    });
  }

  if (summaryCards.length > 0) {
    const colGap = 10;
    const colsPerRow = summaryCards.length === 1 ? 1 : 2;
    const cardW = colsPerRow === 1 ? CW : (CW - colGap) / 2;
    for (let i = 0; i < summaryCards.length; i += colsPerRow) {
      const pair = summaryCards.slice(i, i + colsPerRow);
      const maxRows = Math.max(...pair.map((c) => Math.max(1, c.items.length) + (c.totalCount > 6 ? 1 : 0)));
      const boxH = 28 + maxRows * 15 + 8;
      ensure(boxH + 8);
      pair.forEach((card, cIdx) => {
        const x = M + cIdx * (cardW + colGap);
        fillStrokeRect(doc, x, y, cardW, boxH, 10, C.white, C.border, 0.7);
        // Header kartu
        doc.setFillColor(card.dot[0], card.dot[1], card.dot[2]);
        doc.circle(x + 12, y + 14.5, 3, "F");
        setText(doc, 9, "bold", C.label);
        doc.text(card.title, x + 20, y + 17.5);
        setText(doc, 9, "bold", C.label);
        doc.text(rp(card.total), x + cardW - 10, y + 17.5, { align: "right" });
        hLine(doc, x + 10, y + 24, x + cardW - 10, C.sep, 0.6);

        let ry = y + 36;
        if (card.items.length === 0) {
          setText(doc, 7.8, "italic", C.label3);
          doc.text("Belum ada transaksi", x + 10, ry);
        } else {
          card.items.forEach((it, rIdx) => {
            if (rIdx > 0) hLine(doc, x + 10, ry - 10, x + cardW - 10, C.sep, 0.4);
            setText(doc, 7.6, "normal", C.label);
            const rightW = 62;
            doc.text(fitText(doc, it.left, cardW - 22 - rightW), x + 10, ry);
            setText(doc, 7.6, "bold", it.badge === "BELUM" ? C.negative : C.label);
            doc.text(it.right, x + cardW - 10, ry, { align: "right" });
            ry += 15;
          });
          if (card.totalCount > 6) {
            setText(doc, 7, "italic", C.label3);
            doc.text(`+${card.totalCount - 6} baris lainnya di halaman rincian`, x + 10, ry);
          }
        }
      });
      y += boxH + 10;
    }
  }

  // Performa 7 Hari Terakhir (Tabel + Grafik Batang Vektor Native)
  if (last7Desc.length > 0) {
    const tableH = 18 + 18 + last7Desc.length * 16;
    const chartH = 128;
    ensure(tableH + chartH + 22);

    y += 2;
    hLine(doc, M, y, PAGE_W - M, C.label, 1.1);
    y += 14;
    setText(doc, 9.5, "bold", C.label);
    doc.text("PERFORMA 7 HARI TERAKHIR", M, y);
    setText(doc, 7.5, "normal", C.label3);
    doc.text(`Target harian: ${rp(TARGET_HARIAN)}`, PAGE_W - M, y, { align: "right" });
    y += 10;

    // Header tabel 7 hari
    fillStrokeRect(doc, M, y, CW, 18, 6, C.canvas);
    setText(doc, 7, "bold", C.label2);
    doc.text("TANGGAL", M + 10, y + 11.5);
    doc.text("HARI", M + 92, y + 11.5);
    doc.text("TOTAL", M + 255, y + 11.5, { align: "right" });
    setText(doc, 7, "bold", C.positive);
    doc.text("CASH", M + 355, y + 11.5, { align: "right" });
    setText(doc, 7, "bold", C.tint);
    doc.text("TRANSFER", M + 455, y + 11.5, { align: "right" });
    setText(doc, 7, "bold", C.label2);
    doc.text("TARGET", PAGE_W - M - 10, y + 11.5, { align: "right" });
    y += 20;

    last7Desc.forEach((h, idx) => {
      const tot = totalPemasukanHarian(h);
      const isTodayRow = h.tanggal === data.tanggal;
      if (isTodayRow) {
        fillStrokeRect(doc, M, y - 1, CW, 16, 4, C.tintBg);
      } else if (idx % 2 === 1) {
        fillStrokeRect(doc, M, y - 1, CW, 16, 4, C.zebra);
      }
      setText(doc, 7.8, isTodayRow ? "bold" : "normal", isTodayRow ? C.tint : C.label);
      doc.text(clean(h.tanggal), M + 10, y + 10);
      setText(doc, 7.8, isTodayRow ? "bold" : "normal", C.label2);
      doc.text(clean(h.hari || "-"), M + 92, y + 10);
      setText(doc, 7.8, "bold", C.label);
      doc.text(rp(tot), M + 255, y + 10, { align: "right" });
      setText(doc, 7.8, "normal", C.label2);
      doc.text(rp((h as any).totalCash), M + 355, y + 10, { align: "right" });
      doc.text(rp((h as any).totalTransfer), M + 455, y + 10, { align: "right" });

      const lapTot = rincianHariLaporan(h).total;
      const ok = lapTot >= TARGET_HARIAN;
      setText(doc, 7, "bold", ok ? C.positive : C.label3);
      doc.text(ok ? "OK" : "-", PAGE_W - M - 10, y + 10, { align: "right" });
      y += 16;
    });

    y += 10;

    // Grafik Batang Vektor Apple iOS 27
    fillStrokeRect(doc, M, y, CW, chartH, 12, C.tile, C.border, 0.6);
    const padX = 24;
    const padTop = 30;
    const padBot = 24;
    const plotW = CW - padX * 2;
    const plotH = chartH - padTop - padBot;
    const baseY = y + padTop + plotH;
    const maxVal = Math.max(TARGET_HARIAN * 1.25, ...last7Asc.map((h) => totalPemasukanHarian(h))) * 1.12 || 100;

    // Legenda mini di pojok atas grafik (tidak pernah tertutup batang)
    setText(doc, 6.8, "bold", C.label3);
    doc.text("GRAFIK PEMASUKAN 7 HARI", M + 14, y + 14);
    drawPill(doc, M + CW - 12, y + 4.5, `Garis target ${fmtK0(TARGET_HARIAN)}`, C.positive, C.positiveBg, "right", 6.4);

    // Garis target putus-putus
    const targetY = baseY - (TARGET_HARIAN / maxVal) * plotH;
    doc.setDrawColor(C.positive[0], C.positive[1], C.positive[2]);
    doc.setLineWidth(0.6);
    if (typeof (doc as any).setLineDashPattern === "function") {
      (doc as any).setLineDashPattern([3, 3], 0);
    }
    doc.line(M + padX, targetY, M + CW - padX, targetY);
    if (typeof (doc as any).setLineDashPattern === "function") {
      (doc as any).setLineDashPattern([], 0);
    }

    // Garis dasar
    hLine(doc, M + padX, baseY, M + CW - padX, C.border, 0.7);

    // Batang
    const count = last7Asc.length;
    const barW = Math.min(38, (plotW / Math.max(1, count)) * 0.56);
    const step = count > 1 ? (plotW - barW) / (count - 1) : 0;

    last7Asc.forEach((h, i) => {
      const val = totalPemasukanHarian(h);
      const bx = count === 1 ? M + padX + (plotW - barW) / 2 : M + padX + i * step;
      const bh = Math.max(4, (val / maxVal) * plotH);
      const by = baseY - bh;
      const isActive = h.tanggal === data.tanggal || i === count - 1;
      fillStrokeRect(doc, bx, by, barW, bh, 5, isActive ? C.tint : C.barIdle);

      setText(doc, 7.5, "bold", isActive ? C.tint : C.label2);
      doc.text(clean(rpShort(val)), bx + barW / 2, by - 5, { align: "center" });

      setText(doc, 7.2, isActive ? "bold" : "normal", isActive ? C.label : C.label3);
      const dayLbl = `${clean(h.hari || "").slice(0, 3)} ${String(h.tanggal || "").slice(8, 10)}`;
      doc.text(dayLbl, bx + barW / 2, baseY + 13, { align: "center" });
    });

    y += chartH + 8;
  }

  // =========================================================================
  // HALAMAN 2+: RINCIAN OPERASIONAL & BUKTI INPUT (PENGGANTI SCREENSHOT HTML2CANVAS)
  // =========================================================================
  newPage(`Rincian Bukti Input - ${data.tanggal}`);
  drawSectionBanner(
    "Rincian Bukti Input & Operasional",
    `Detail transaksi tercatat pada ${clean(data.hari)}, ${fmtTanggalIndo(data.tanggal)}${data.exportedBy ? ` · Dicetak oleh ${clean(data.exportedBy)}` : ""}`
  );

  // Helper tabel vektor standar dengan auto-pagination & pengulangan header
  type ColDef = { label: string; width: number; align?: "left" | "right" | "center"; color?: RGB };
  const drawTable = (
    cols: ColDef[],
    rows: { cells: (string | { text: string; bold?: boolean; color?: RGB })[]; highlight?: RGB }[],
    footer?: { label: string; value: string; note?: string; tone?: RGB }
  ) => {
    const rowH = 16.5;
    const headH = 18;

    const drawHeader = () => {
      fillStrokeRect(doc, M, y, CW, headH, 5, C.canvas);
      let cx = M + 8;
      cols.forEach((col) => {
        setText(doc, 6.7, "bold", col.color || C.label2);
        const ax = col.align === "right" ? cx + col.width - 4 : col.align === "center" ? cx + col.width / 2 : cx;
        doc.text(col.label, ax, y + 11.5, { align: col.align || "left" });
        cx += col.width;
      });
      y += headH + 2;
    };

    ensure(headH + rowH + 6);
    drawHeader();

    rows.forEach((row, rIdx) => {
      ensure(rowH + 2, drawHeader);
      if (row.highlight) {
        fillStrokeRect(doc, M, y - 1, CW, rowH, 4, row.highlight);
      } else if (rIdx % 2 === 1) {
        fillStrokeRect(doc, M, y - 1, CW, rowH, 4, C.zebra);
      }
      let cx = M + 8;
      cols.forEach((col, cIdx) => {
        const cell = row.cells[cIdx];
        const text = typeof cell === "string" ? cell : cell?.text ?? "";
        const bold = typeof cell === "object" && cell?.bold;
        const color = (typeof cell === "object" && cell?.color) || col.color || C.label;
        setText(doc, 7.5, bold ? "bold" : "normal", color);
        const ax = col.align === "right" ? cx + col.width - 4 : col.align === "center" ? cx + col.width / 2 : cx;
        doc.text(fitText(doc, text, col.width - 6), ax, y + 10.5, { align: col.align || "left" });
        cx += col.width;
      });
      y += rowH;
    });

    if (footer) {
      ensure(22);
      hLine(doc, M, y + 1, PAGE_W - M, C.border, 0.7);
      fillStrokeRect(doc, M, y + 2, CW, 19, 5, C.canvas);
      setText(doc, 7.8, "bold", C.label);
      doc.text(clean(footer.label), M + 10, y + 14);
      if (footer.note) {
        setText(doc, 7, "normal", C.label2);
        doc.text(clean(footer.note), M + 145, y + 14);
      }
      setText(doc, 8.2, "bold", footer.tone || C.label);
      doc.text(clean(footer.value), PAGE_W - M - 10, y + 14, { align: "right" });
      y += 26;
    } else {
      y += 8;
    }
  };

  // A. Kartu Input & Absensi
  drawSubheading("Input & Absensi", undefined, C.tint);
  const absenPairs: [string, string][] = [
    ["Tanggal Pembukuan", `${clean(data.tanggal)} (${clean(data.hari)})`],
    ["Shift Pegawai", clean(data.shiftPegawai || "-")],
    ["Absen Masuk", clean(data.absenPagi || "-")],
    ["Absen Pulang", clean(data.absenSiang || "-")],
    ["Ruko Buka", clean(data.rukoBuka || "-")],
    ["Ruko Tutup", clean(data.rukoTutup || "-")],
  ];
  const noteWrap = catatanBersih ? doc.splitTextToSize(catatanBersih, CW - 24).slice(0, 3) : [];
  const absenBoxH = 3 * 22 + 12 + (noteWrap.length ? 16 + noteWrap.length * 10 : 0);
  ensure(absenBoxH + 10);
  fillStrokeRect(doc, M, y, CW, absenBoxH, 10, C.tile, C.border, 0.6);
  const halfW = (CW - 24) / 2;
  absenPairs.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const px = M + 12 + col * (halfW + 8);
    const py = y + 14 + row * 22;
    setText(doc, 6.6, "bold", C.label3);
    doc.text(k.toUpperCase(), px, py);
    setText(doc, 8.2, "bold", C.label);
    doc.text(fitText(doc, v, halfW - 6), px, py + 10);
  });
  if (noteWrap.length) {
    const ny = y + 3 * 22 + 10;
    hLine(doc, M + 12, ny - 4, PAGE_W - M - 12, C.sep, 0.5);
    setText(doc, 6.6, "bold", C.label3);
    doc.text("CATATAN OPERASIONAL", M + 12, ny + 5);
    setText(doc, 7.8, "normal", C.label2);
    doc.text(noteWrap, M + 12, ny + 15);
  }
  y += absenBoxH + 12;

  // B1. Rincian Sewa PS
  const sewaRows = (data.rowsSewa || []).filter(
    (r) => toInt(r.harga) > 0 || (r.jenisPS && (r.ket || r.isPaid === "TIDAK"))
  );
  if (tampil("sewa", data.totalSewa) && sewaRows.length > 0) {
    drawSubheading("Rincian Sewa PS", `${sewaRows.length} baris · ${rp(data.totalSewa)}`, C.indigo);
    drawTable(
      [
        { label: "NO", width: 22 },
        { label: "JENIS SEWA", width: 82 },
        { label: "DURASI", width: 52 },
        { label: "JAM", width: 38 },
        { label: "PENYEWA", width: 92 },
        { label: "NO. WA", width: 72 },
        { label: "STATUS", width: 42, align: "center" },
        { label: "METODE", width: 46, align: "center" },
        { label: "NOMINAL", width: 65, align: "right" },
      ],
      sewaRows.map((r, i) => {
        const durasi = r.lamaSewa === "Isi Sendiri" && r._customDurasi ? `${r._customDurasi} jam` : r.lamaSewa || "-";
        const belum = r.isPaid === "TIDAK";
        return {
          cells: [
            String(i + 1),
            { text: clean(r.jenisPS || "-"), bold: true },
            clean(durasi),
            clean(r.jamMasukSewa || "-"),
            clean(r.ket || "-"),
            clean(r.waPenyewa || "-"),
            { text: belum ? "BELUM" : "LUNAS", bold: true, color: belum ? C.negative : C.positive },
            { text: clean(r.bayar || "-"), color: r.bayar === "Cash" ? C.positive : C.tint },
            { text: rp(r.harga), bold: true, color: belum ? C.negative : C.label },
          ],
        };
      }),
      { label: "Total Sewa PS", value: rp(data.totalSewa) }
    );
  }

  // B2. Rincian Pemasukan Usaha (Jasa & Aksesoris)
  const usahaRows = (data.rowsJasaAks || []).filter((r) => toInt(r.harga) > 0 || (r.tipe && r.ket));
  if (tampil("jasaAks", data.totalJasaAks) && usahaRows.length > 0) {
    drawSubheading("Rincian Pemasukan Usaha", `${usahaRows.length} baris · ${rp(data.totalJasaAks)}`, C.purple);
    drawTable(
      [
        { label: "NO", width: 24 },
        { label: "TIPE", width: 92 },
        { label: "KETERANGAN", width: 264 },
        { label: "METODE", width: 56, align: "center" },
        { label: "NOMINAL", width: 75, align: "right" },
      ],
      usahaRows.map((r: any, i) => ({
        cells: [
          String(i + 1),
          { text: `${r._fromPos ? "[POS] " : ""}${clean(r.tipe || "-")}`, bold: true },
          clean(r.ket || "-"),
          { text: clean(r.bayar || "-"), color: r.bayar === "Cash" ? C.positive : C.tint },
          { text: rp(r.harga), bold: true },
        ],
      })),
      { label: "Total Pemasukan Usaha", value: rp(data.totalJasaAks) }
    );
  }

  // B3. Rincian Pemasukan Harian
  const harianRows = (data.rowsHarian || []).filter((r) => toInt(r.harga) > 0);
  if (tampil("harian", data.totalHarian) && harianRows.length > 0) {
    drawSubheading("Rincian Pemasukan Harian", `${harianRows.length} baris · ${rp(data.totalHarian)}`, C.tint);
    drawTable(
      [
        { label: "NO", width: 26 },
        { label: "JENIS PS", width: 150 },
        { label: "JAM MASUK", width: 95 },
        { label: "DURASI", width: 85 },
        { label: "METODE", width: 70, align: "center" },
        { label: "NOMINAL", width: 85, align: "right" },
      ],
      harianRows.map((r, i) => ({
        cells: [
          String(i + 1),
          { text: clean(r.jenisPS || "-"), bold: true },
          clean(r.jamMasuk || "-"),
          `${clean(r.jumlahJam || "-")} jam`,
          { text: clean(r.bayar || "-"), color: r.bayar === "Cash" ? C.positive : C.tint },
          { text: rp(r.harga), bold: true },
        ],
      })),
      { label: "Total Pemasukan Harian", value: rp(data.totalHarian) }
    );
  }

  // B4. Rincian Jajanan
  const jajananRows = (data.rowsJajanan || []).filter((r) => toInt(r.harga) > 0);
  if (tampil("jajanan", data.totalJajanan) && jajananRows.length > 0) {
    drawSubheading("Rincian Jajanan", `${jajananRows.length} baris · ${rp(data.totalJajanan)}`, C.orange);
    drawTable(
      [
        { label: "NO", width: 26 },
        { label: "ITEM JAJANAN", width: 245 },
        { label: "QTY", width: 80, align: "center" },
        { label: "METODE", width: 75, align: "center" },
        { label: "NOMINAL", width: 85, align: "right" },
      ],
      jajananRows.map((r, i) => ({
        cells: [
          String(i + 1),
          { text: clean(r.jenisJajanan || "-"), bold: true },
          clean(r.qtyJam || "1"),
          { text: clean(r.bayar || "-"), color: r.bayar === "Cash" ? C.positive : C.tint },
          { text: rp(r.harga), bold: true },
        ],
      })),
      { label: "Total Jajanan", value: rp(data.totalJajanan) }
    );
  }

  // C. Rincian Pengeluaran
  const keluarRows = rowsPengeluaran.filter((r) => toInt(r?.harga) > 0 || clean(r?.ket));
  if (tampil("pengeluaran", totalPengeluaran) && keluarRows.length > 0) {
    drawSubheading("Rincian Pengeluaran", `${keluarRows.length} baris · -${rp(totalPengeluaran)}`, C.negative);
    drawTable(
      [
        { label: "NO", width: 24 },
        { label: "KETERANGAN", width: 280 },
        { label: "SUMBER", width: 64, align: "center" },
        { label: "METODE", width: 62, align: "center" },
        { label: "NOMINAL", width: 81, align: "right" },
      ],
      keluarRows.map((r: any, i) => {
        const isAuto = Boolean(r?._autoOngkir || /ongkir/i.test(String(r?.ket || "")));
        return {
          highlight: isAuto ? C.purpleBg : undefined,
          cells: [
            String(i + 1),
            { text: clean(r?.ket || "-"), bold: !isAuto },
            { text: isAuto ? "Otomatis" : "Manual", color: isAuto ? C.purple : C.label2 },
            { text: clean(r?.bayar || "Cash"), color: r?.bayar === "Transfer" ? C.tint : C.positive },
            { text: rp(r?.harga), bold: true, color: isAuto ? C.purple : C.negative },
          ],
        };
      }),
      { label: "Total Pengeluaran", value: `-${rp(totalPengeluaran)}`, tone: C.negative }
    );
  }

  // D. Rincian Setoran & Rekonsiliasi Kas
  const setorRows = rowsSetoran.filter((r) => toInt(r?.harga) > 0 || clean(r?.ket));
  const totalSetor = setorRows.reduce((s, r) => s + toInt(r?.harga), 0);
  if (tampil("setoran", totalSetor) && (setorRows.length > 0 || totalCash > 0)) {
    drawSubheading("Rincian Setoran & Kas Tunai", `Setoran: ${rp(totalSetor)}`, C.positive);
    if (setorRows.length > 0) {
      drawTable(
        [
          { label: "NO", width: 24 },
          { label: "KETERANGAN SETORAN", width: 325 },
          { label: "STATUS TF", width: 72, align: "center" },
          { label: "NOMINAL", width: 90, align: "right" },
        ],
        setorRows.map((r: any, i) => {
          const sudah = r?.sudahTf === "YA" || r?.isTf === true;
          return {
            cells: [
              String(i + 1),
              { text: clean(r?.ket || "Setoran"), bold: true },
              { text: sudah ? "Sudah TF" : "Belum", bold: true, color: sudah ? C.positive : C.warning },
              { text: rp(r?.harga), bold: true },
            ],
          };
        })
      );
    }
    // Kartu rekonsiliasi kas
    const keluarCash = keluarRows
      .filter((r: any) => String(r?.bayar || "Cash") !== "Transfer" && !(data.ongkirMasukGaji && r?._autoOngkir))
      .reduce((s, r) => s + toInt(r?.harga), 0);
    const estimasiSetor = Math.max(0, totalCash - keluarCash);
    ensure(42);
    fillStrokeRect(doc, M, y, CW, 36, 8, C.positiveBg, C.positiveBd, 0.6);
    const rCols = [
      { l: "PEMASUKAN CASH", v: rp(totalCash), c: C.label },
      { l: "PENGELUARAN KAS", v: `-${rp(keluarCash)}`, c: C.negative },
      { l: "ESTIMASI SETORAN", v: rp(estimasiSetor), c: C.positive },
      { l: "TERCATAT DI SETORAN", v: rp(totalSetor), c: C.label },
    ];
    const rcW = (CW - 20) / 4;
    rCols.forEach((rc, idx) => {
      const rx = M + 10 + idx * rcW;
      setText(doc, 6.2, "bold", C.label2);
      doc.text(rc.l, rx, y + 13);
      setText(doc, 8.6, "bold", rc.c);
      doc.text(rc.v, rx, y + 26);
    });
    y += 46;
  }

  // E. Riwayat Pembukuan Bulan Ini (History Pembukuan — dengan Grand Total yang tidak pernah tumpang tindih!)
  const anchor = dariYmd(data.tanggal) || new Date();
  const prefixBulan = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-`;
  const monthRowsAll = mergedHistory
    .filter((h) => String(h.tanggal || "").startsWith(prefixBulan))
    .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
  const monthRows = isHemat ? monthRowsAll.slice(-14) : monthRowsAll;

  if (monthRows.length > 0) {
    const sumH = monthRowsAll.reduce((s, h) => s + toInt(h.totalHarian), 0);
    const sumJ = monthRowsAll.reduce((s, h) => s + toInt(h.totalJajanan), 0);
    const sumU = monthRowsAll.reduce((s, h) => s + toInt(h.totalJasaAks), 0);
    const sumS = monthRowsAll.reduce((s, h) => s + toInt(h.totalSewa), 0);
    const sumTot = monthRowsAll.reduce((s, h) => s + totalPemasukanHarian(h), 0);
    const sumCash = monthRowsAll.reduce((s, h) => s + toInt((h as any).totalCash), 0);
    const sumTf = monthRowsAll.reduce((s, h) => s + toInt((h as any).totalTransfer), 0);

    const kolH = tampil("harian", sumH);
    const kolJ = tampil("jajanan", sumJ);
    const kolU = tampil("jasaAks", sumU);
    const kolS = tampil("sewa", sumS);

    const dynCols: { label: string; get: (h: HistoryItem) => number; sum: number }[] = [];
    if (kolH) dynCols.push({ label: "HARIAN", get: (h) => toInt(h.totalHarian), sum: sumH });
    if (kolJ) dynCols.push({ label: "JAJANAN", get: (h) => toInt(h.totalJajanan), sum: sumJ });
    if (kolU) dynCols.push({ label: "USAHA", get: (h) => toInt(h.totalJasaAks), sum: sumU });
    if (kolS) dynCols.push({ label: "SEWA PS", get: (h) => toInt(h.totalSewa), sum: sumS });

    const fixedW = 66 + 44 + 74 + 70 + 70; // Tanggal + Hari + Total + Cash + TF = 324
    const remW = Math.floor(CW - 16 - fixedW);
    const dynW = dynCols.length ? Math.floor(remW / dynCols.length) : 0;
    const extraHariW = dynCols.length ? remW - dynW * dynCols.length : remW;

    const histCols: ColDef[] = [
      { label: "TANGGAL", width: 66 },
      { label: "HARI", width: 44 + extraHariW },
      ...dynCols.map((dc) => ({ label: dc.label, width: dynW, align: "right" as const })),
      { label: "TOTAL", width: 74, align: "right" },
      { label: "CASH", width: 70, align: "right", color: C.positive },
      { label: "TRANSFER", width: 70, align: "right", color: C.tint },
    ];

    drawSubheading(
      `Riwayat Pembukuan ${BULAN_PANJANG[anchor.getMonth()]} ${anchor.getFullYear()}`,
      isHemat && monthRowsAll.length > monthRows.length
        ? `${monthRows.length} hari terakhir (total ${monthRowsAll.length} hari)`
        : `${monthRowsAll.length} hari tercatat`,
      C.tint
    );

    const histTableRows = monthRows.map((h) => ({
      highlight: h.tanggal === data.tanggal ? C.tintBg : undefined,
      cells: [
        { text: clean(h.tanggal), bold: h.tanggal === data.tanggal },
        clean(h.hari || "-").slice(0, 6),
        ...dynCols.map((dc) => {
          const v = dc.get(h);
          return { text: v > 0 ? rp(v) : "-", color: v > 0 ? C.label2 : C.label3 };
        }),
        { text: rp(totalPemasukanHarian(h)), bold: true },
        { text: toInt((h as any).totalCash) > 0 ? rp((h as any).totalCash) : "-", color: C.positive },
        { text: toInt((h as any).totalTransfer) > 0 ? rp((h as any).totalTransfer) : "-", color: C.tint },
      ],
    }));

    // Tambahkan baris GRAND TOTAL utuh di akhir tabel (sejajar lurus dengan semua kolom!)
    histTableRows.push({
      highlight: C.canvas,
      cells: [
        { text: "GRAND TOTAL", bold: true, color: C.label },
        { text: `${monthRowsAll.length} hr`, bold: true, color: C.label2 },
        ...dynCols.map((dc) => ({ text: rp(dc.sum), bold: true, color: C.label })),
        { text: rp(sumTot), bold: true, color: C.label },
        { text: rp(sumCash), bold: true, color: C.positive },
        { text: rp(sumTf), bold: true, color: C.tint },
      ],
    });

    drawTable(histCols, histTableRows);
  }

  // =========================================================================
  // HALAMAN BARU: LAPORAN BULANAN (TARGET, MINGGUAN, SETORAN & PENGELUARAN)
  // =========================================================================
  newPage(`Laporan Bulanan - ${BULAN_PANJANG[anchor.getMonth()]} ${anchor.getFullYear()}`);
  drawSectionBanner(
    `Laporan Bulanan - ${BULAN_PANJANG[anchor.getMonth()]} ${anchor.getFullYear()}`,
    `Target ${rp(TARGET_HARIAN)}/hari · ${rp(TARGET_HARIAN * 7)}/minggu (Rental + Jasa, s.d. ${fmtTanggalIndo(data.tanggal)})`
  );

  // Hitung rekap bulanan persis sama dengan src/lib/laporan.ts
  const anchorDay = anchor.getDate();
  const monthUpToDate = monthRowsAll.filter((h) => h.tanggal <= data.tanggal);
  const dataMap: Record<number, number> = {};
  const rekap = { sewa: 0, harian: 0, jajanan: 0, isiGame: 0, hen: 0, servis: 0, rental: 0, jasa: 0, total: 0 };
  let hariTerisi = 0;
  let kasBulan = 0;
  let pengeluaranBulan = 0;
  const listSetorBulan: { tgl: string; ket: string; nom: number }[] = [];
  const listKeluarBulan: { tgl: string; ket: string; nom: number }[] = [];

  monthUpToDate.forEach((h: any) => {
    const dateNum = Number(String(h.tanggal).slice(8, 10));
    const r = rincianHariLaporan(h);
    dataMap[dateNum] = (dataMap[dateNum] || 0) + r.total;
    (Object.keys(rekap) as (keyof typeof rekap)[]).forEach((k) => {
      rekap[k] += r[k];
    });
    if (r.total > 0) hariTerisi++;
    kasBulan += toInt(h.totalCash) + toInt(h.totalTransfer);
    (Array.isArray(h.rowsSetoran) ? h.rowsSetoran : []).forEach((s: any) => {
      const nom = toInt(s?.harga);
      if (nom > 0) listSetorBulan.push({ tgl: tanggalAngka(s.tanggal || h.tanggal), ket: clean(s.ket || "Setoran"), nom });
    });
    (Array.isArray(h.rowsPengeluaran) ? h.rowsPengeluaran : []).forEach((p: any) => {
      const nom = toInt(p?.harga);
      if (nom <= 0) return;
      pengeluaranBulan += nom;
      listKeluarBulan.push({ tgl: tanggalAngka(p.tanggal || h.tanggal), ket: clean(p.ket || "Pengeluaran"), nom });
    });
  });

  const rataRata = hariTerisi ? Math.round(rekap.total / hariTerisi / 1000) * 1000 : 0;
  const saldoBulan = kasBulan - pengeluaranBulan;

  // 4 Kartu KPI Bulanan
  const mKpiW = (CW - 24) / 4;
  const mKpis = [
    { label: `TOTAL (1-${anchorDay} ${BULAN_PENDEK[anchor.getMonth()].toUpperCase()})`, val: fmtK0(rekap.total), sub: rp(rekap.total), fg: C.label, bg: C.canvas, bd: C.border },
    { label: "RENTAL", val: fmtK0(rekap.rental), sub: `Sewa ${fmtK0(rekap.sewa)}${rekap.harian ? ` · Har ${fmtK0(rekap.harian)}` : ""}`, fg: C.indigo, bg: C.indigoBg, bd: C.border },
    { label: "JASA USAHA", val: fmtK0(rekap.jasa), sub: `Game ${fmtK0(rekap.isiGame)} · HEN ${fmtK0(rekap.hen)}`, fg: C.purple, bg: C.purpleBg, bd: C.border },
    {
      label: "RATA-RATA / HARI",
      val: fmtK0(rataRata),
      sub: hariTerisi ? (rataRata >= TARGET_HARIAN ? "Target tercapai [OK]" : "Di bawah target") : "-",
      fg: rataRata >= TARGET_HARIAN ? C.positive : C.warning,
      bg: rataRata >= TARGET_HARIAN ? C.positiveBg : C.warningBg,
      bd: rataRata >= TARGET_HARIAN ? C.positiveBd : C.warningBd,
    },
  ];
  ensure(62);
  mKpis.forEach((k, idx) => {
    const x = M + idx * (mKpiW + 8);
    fillStrokeRect(doc, x, y, mKpiW, 52, 9, k.bg, k.bd, 0.6);
    setText(doc, 6.3, "bold", C.label2);
    doc.text(k.label, x + 9, y + 13);
    setText(doc, 12.5, "bold", k.fg);
    doc.text(fitText(doc, k.val, mKpiW - 18), x + 9, y + 31);
    setText(doc, 6.8, "normal", C.label2);
    doc.text(fitText(doc, k.sub, mKpiW - 18), x + 9, y + 44);
  });
  y += 62;

  // Kartu Ringkasan Saldo Hari Ini & Bulan Ini
  ensure(48);
  fillStrokeRect(doc, M, y, CW, 40, 9, C.tile, C.border, 0.6);
  const salCols = [
    { l: "KOTOR HARI INI", v: rp(hariIniLap.total), c: C.label },
    { l: "PENGELUARAN HARI INI", v: `-${rp(totalPengeluaran)}`, c: C.negative },
    { l: "BERSIH HARI INI", v: rp(hariIniLap.total - totalPengeluaran), c: C.positive },
    { l: "HARUS DISETOR", v: rp(Math.max(0, totalCash)), c: C.tint },
    { l: "TOTAL SALDO BULAN", v: rp(saldoBulan), c: C.label },
  ];
  const scW = (CW - 20) / 5;
  salCols.forEach((sc, idx) => {
    const sx = M + 10 + idx * scW;
    setText(doc, 6, "bold", C.label3);
    doc.text(sc.l, sx, y + 14);
    setText(doc, 8.4, "bold", sc.c);
    doc.text(fitText(doc, sc.v, scW - 6), sx, y + 29);
  });
  y += 52;

  // Pemasukan Mingguan (Kartu Grid 2 Kolom: Minggu 1 – Minggu 5)
  drawSubheading("Pemasukan Harian per Minggu (Rental + Jasa)", undefined, C.tint);
  const lastDayOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const mingguList = rentangMinggu(lastDayOfMonth);
  const wkGap = 10;
  const wkW = (CW - wkGap) / 2;

  for (let i = 0; i < mingguList.length; i += 2) {
    const pair = mingguList.slice(i, i + 2);
    const maxDays = Math.max(...pair.map(([s, e]) => e - s + 1));
    const cardH = 26 + maxDays * 12.5 + 22;
    ensure(cardH + 8);

    pair.forEach(([start, end], pIdx) => {
      const idx = i + pIdx;
      const target = TARGET_HARIAN * (end - start + 1);
      let wkTotal = 0;
      for (let d = start; d <= end; d++) wkTotal += dataMap[d] || 0;
      const status =
        end <= anchorDay ? (wkTotal >= target ? "OK" : "KURANG") : start <= anchorDay ? "JALAN" : "NANTI";
      const x = M + pIdx * (wkW + wkGap);
      fillStrokeRect(doc, x, y, wkW, cardH, 9, C.white, C.border, 0.6);

      setText(doc, 8.5, "bold", C.label);
      doc.text(`Minggu ${idx + 1} (${start}-${end} ${BULAN_PENDEK[anchor.getMonth()]})`, x + 10, y + 15);
      const pillFg = status === "OK" ? C.positive : status === "KURANG" ? C.negative : status === "JALAN" ? C.tint : C.label3;
      const pillBg = status === "OK" ? C.positiveBg : status === "KURANG" ? C.negativeBg : status === "JALAN" ? C.tintBg : C.canvas;
      drawPill(doc, x + wkW - 10, y + 5, status === "OK" ? "OK" : status === "KURANG" ? "BELUM" : status === "JALAN" ? "JALAN" : "-", pillFg, pillBg, "right", 6.5);
      hLine(doc, x + 10, y + 21, x + wkW - 10, C.sep, 0.5);

      let dy = y + 32;
      for (let d = start; d <= end; d++) {
        const v = dataMap[d] || 0;
        const isAnchorDay = d === anchorDay;
        setText(doc, 7.5, isAnchorDay ? "bold" : "normal", isAnchorDay ? C.tint : C.label2);
        doc.text(`Tgl ${d}`, x + 10, dy);
        setText(doc, 7.5, v > 0 ? "bold" : "normal", v > 0 ? (v >= TARGET_HARIAN ? C.positive : C.label) : C.label3);
        doc.text(v > 0 ? fmtK0(v) : "-", x + wkW - 10, dy, { align: "right" });
        dy += 12.5;
      }

      const fy = y + cardH - 18;
      hLine(doc, x + 10, fy - 3, x + wkW - 10, C.sep, 0.5);
      setText(doc, 7.3, "bold", C.label2);
      doc.text(`Target ${fmtK0(target)}`, x + 10, fy + 9);
      setText(doc, 8, "bold", pillFg);
      doc.text(start > anchorDay ? "-" : fmtK0(wkTotal), x + wkW - 10, fy + 9, { align: "right" });
    });
    y += cardH + 10;
  }

  // Daftar Setoran Bulan Ini
  if (listSetorBulan.length > 0) {
    const totalSetorBulan = listSetorBulan.reduce((s, x) => s + x.nom, 0);
    drawSubheading("Riwayat Setoran Bulan Ini", `${listSetorBulan.length}x · ${rp(totalSetorBulan)}`, C.positive);
    drawTable(
      [
        { label: "TANGGAL", width: 72 },
        { label: "KETERANGAN", width: 344 },
        { label: "NOMINAL", width: 95, align: "right" },
      ],
      listSetorBulan.map((s) => ({
        cells: [s.tgl, { text: s.ket, bold: true }, { text: rp(s.nom), bold: true, color: C.positive }],
      })),
      { label: "Total Setoran Bulan Ini", value: rp(totalSetorBulan), tone: C.positive }
    );
  }

  // Daftar Pengeluaran Bulan Ini
  if (listKeluarBulan.length > 0) {
    drawSubheading("Riwayat Pengeluaran Bulan Ini", `${listKeluarBulan.length}x · -${rp(pengeluaranBulan)}`, C.negative);
    drawTable(
      [
        { label: "TANGGAL", width: 72 },
        { label: "KETERANGAN", width: 344 },
        { label: "NOMINAL", width: 95, align: "right" },
      ],
      listKeluarBulan.map((p) => ({
        cells: [p.tgl, p.ket, { text: rp(p.nom), bold: true, color: C.negative }],
      })),
      { label: "Total Pengeluaran Bulan Ini", value: `-${rp(pengeluaranBulan)}`, tone: C.negative }
    );
  }

  // =========================================================================
  // HALAMAN BARU: LAPORAN STOK (RENTAL & JUALAN)
  // =========================================================================
  const rentalCatsRaw: StokKategori[] = (masterCategories?.rental || []).filter((c) => {
    if (!c || isKategoriDihapus(c.kategori)) return false;
    if (isKategoriJajanan(c.kategori)) {
      const sum = c.items.reduce((s, it) => s + toInt(stokData?.rental?.[c.kategori]?.[it]?.jumlah), 0);
      return tampil("jajanan", sum);
    }
    return true;
  });
  const jualanCatsRaw: StokKategori[] = (masterCategories?.jualan || []).filter((c) => c && c.items?.length > 0);

  if (rentalCatsRaw.length > 0 || jualanCatsRaw.length > 0) {
    newPage(`Laporan Stok - ${data.tanggal}`);
    drawSectionBanner(
      "Laporan Stok (Rental & Jualan)",
      `Snapshot stok per ${fmtTanggalIndo(data.tanggal)}${isHemat ? " · Mode Hemat (stok jualan 0 disembunyikan)" : ""}`
    );

    const drawStokSection = (
      title: string,
      dotColor: RGB,
      cats: StokKategori[],
      bucket: Record<string, Record<string, any>> | undefined,
      skipZeroInHemat: boolean
    ) => {
      if (!cats.length) return;
      drawSubheading(title, `${cats.length} kategori`, dotColor);

      cats.forEach((cat) => {
        let sum = 0;
        let hiddenZero = 0;
        const rows: {
          cells: (string | { text: string; bold?: boolean; color?: RGB })[];
          highlight?: RGB;
        }[] = [];

        cat.items.forEach((item) => {
          const itemData = bucket?.[cat.kategori]?.[item] || { jumlah: 0 };
          const val = Math.max(0, toInt(itemData.jumlah));
          sum += val;
          if (skipZeroInHemat && isHemat && val === 0) {
            hiddenZero++;
            return;
          }
          const delta = toInt(itemData.lastEditDelta);
          const deltaStr = itemData.lastEditDate
            ? delta > 0
              ? `+${delta}`
              : delta < 0
                ? `${delta}`
                : "0"
            : "-";
          const isRusak = /rusak/i.test(item);
          rows.push({
            cells: [
              { text: clean(item), bold: val > 0, color: val === 0 ? C.label3 : C.label },
              {
                text: String(val),
                bold: true,
                color: isRusak && val > 0 ? C.negative : val > 0 ? C.positive : C.label3,
              },
              { text: clean(itemData.lastEditDate || "-"), color: C.label2 },
              {
                text: deltaStr,
                bold: delta !== 0,
                color: delta > 0 ? C.positive : delta < 0 ? C.negative : C.label3,
              },
            ],
          });
        });

        ensure(42);
        // Judul kategori stok yang bersih (tanpa dua bilah abu-abu bertumpuk)
        setText(doc, 8, "bold", C.label);
        doc.text(fitText(doc, clean(cat.kategori), CW - 95), M + 2, y + 10);
        const pillBg = dotColor === C.orange ? C.warningBg : C.indigoBg;
        const pillFg = dotColor === C.orange ? C.warning : C.indigo;
        drawPill(doc, PAGE_W - M, y + 0.5, `TOTAL ${sum}`, pillFg, pillBg, "right", 6.8);
        y += 16;

        if (rows.length > 0) {
          drawTable(
            [
              { label: "NAMA ITEM", width: 295 },
              { label: "STOK", width: 52, align: "right" },
              { label: "TERAKHIR EDIT", width: 112, align: "right" },
              { label: "DELTA", width: 52, align: "right" },
            ],
            rows
          );
        }
        if (hiddenZero > 0) {
          ensure(14);
          setText(doc, 6.8, "italic", C.label3);
          doc.text(`+ ${hiddenZero} item dengan stok 0 disembunyikan (Mode Hemat)`, M + 8, y - 2);
          y += 10;
        }
      });
    };

    drawStokSection("Rekap Stok Rental", C.indigo, rentalCatsRaw, stokData?.rental, false);
    drawStokSection("Rekap Stok Jualan", C.orange, jualanCatsRaw, stokData?.jualan, true);
  }

  // =========================================================================
  // STAMP FOOTER & NOMOR HALAMAN PADA SEMUA HALAMAN
  // =========================================================================
  const pageCount = doc.getNumberOfPages();
  const stampTanggal = fmtTanggalSingkat(data.tanggal);
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    hLine(doc, M, PAGE_H - 30, PAGE_W - M, C.sep, 0.5);
    setText(doc, 7, "normal", C.label3);
    doc.text(
      `URBAN Gaming Lampung  -  Laporan Harian ${stampTanggal} (${clean(data.tanggal)})`,
      M,
      PAGE_H - 19
    );
    setText(doc, 7, "bold", C.label2);
    doc.text(`Halaman ${p} dari ${pageCount}`, PAGE_W - M, PAGE_H - 19, { align: "right" });
  }

  const filename = `Laporan_URBAN_${clean(data.tanggal) || "Harian"}.pdf`;
  const blob = doc.output("blob");
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    pdf: doc,
    blob,
    filename,
    pageCount,
    sizeBytes: blob.size,
    durationMs: Math.max(1, Math.round(t1 - t0)),
  };
}
