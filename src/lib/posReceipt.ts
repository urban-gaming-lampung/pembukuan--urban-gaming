/**
 * NOTA / INVOICE URBAN — PDF (80 mm) & printer thermal (ESC/POS).
 * Identitas toko mengikuti Design System "URBAN Gaming Lampung" (footer banner):
 * logo, WhatsApp, Instagram, alamat. Logo hitam = versi resmi untuk cetak satu warna.
 */
import jsPDF from "jspdf";
import logoBlackUrl from "../assets/urban-logo-black.png";
import { infoNego, negoSatuan } from "./posSales";
import type { PosSale } from "./posSales";

export const STORE = {
  nama: "URBAN Gaming Lampung",
  alamat: "Depan Pintu Keluar Sekolahan Arraihan Gunter, Jl. Purnawirawan Raya, Gn. Terang, Langkapura, Bandar Lampung 35141",
  wa: "0857-0964-7790",
  ig: "@sewaplaystationlampung",
};
export const GARANSI_JUDUL = "SIMPAN NOTA / INVOICE INI";
export const GARANSI_TEKS = "Nota ini wajib disimpan & ditunjukkan untuk keperluan klaim garansi.";

const rp = (n: number) => `Rp ${Math.round(n || 0).toLocaleString("id-ID")}`;
/** Font standar PDF & printer thermal hanya aman untuk ASCII dasar. */
export const toAscii = (t: string) =>
  String(t ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[·•]/g, "-")
    .replace(/−/g, "-")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "");

export const fmtTanggalNota = (ts: number) => {
  const d = new Date(ts);
  const tgl = d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  const jam = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
  return `${tgl}, ${jam}`;
};

let logoCache: Promise<HTMLImageElement> | null = null;
function loadLogo(): Promise<HTMLImageElement> {
  if (!logoCache) {
    logoCache = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { logoCache = null; reject(new Error("Logo gagal dimuat")); };
      img.src = logoBlackUrl;
    });
  }
  return logoCache;
}

/** Muat logo lebih awal supaya cetak thermal tidak menunggu (gesture Bluetooth). */
export const preloadNotaAssets = () => { loadLogo().catch(() => {}); };

async function logoDataUrl(): Promise<{ url: string; ratio: number } | null> {
  try {
    const img = await loadLogo();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return { url: c.toDataURL("image/png"), ratio: img.naturalHeight / img.naturalWidth };
  } catch {
    return null;
  }
}

// ============================================================
// PDF 80 mm
// ============================================================

const W = 80, M = 5, CW = W - M * 2;

function drawNota(pdf: jsPDF, s: PosSale, logo: { url: string; ratio: number } | null): number {
  let y = 6;
  const center = (t: string, size: number, style: "normal" | "bold" = "normal", lh = size * 0.42) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    (pdf.splitTextToSize(toAscii(t), CW) as string[]).forEach((line) => { pdf.text(line, W / 2, y, { align: "center" }); y += lh; });
  };
  const row = (l: string, r: string, size = 7.5, style: "normal" | "bold" = "normal") => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.text(toAscii(l), M, y);
    pdf.text(toAscii(r), W - M, y, { align: "right" });
    y += size * 0.45;
  };
  const dashed = (gap = 3) => {
    pdf.setLineDashPattern([0.8, 0.8], 0);
    pdf.setLineWidth(0.2);
    pdf.line(M, y, W - M, y);
    pdf.setLineDashPattern([], 0);
    y += gap;
  };

  // Header: logo + identitas toko
  if (logo) {
    const lw = 30, lh = lw * logo.ratio;
    pdf.addImage(logo.url, "PNG", (W - lw) / 2, y, lw, lh);
    y += lh + 4;
  } else {
    center("URBAN", 16, "bold", 6);
    center("Gaming Lampung", 9, "bold");
    y += 1;
  }
  center(STORE.alamat, 6.8, "normal", 2.9);
  y += 0.6;
  center(`WA ${STORE.wa}  |  IG ${STORE.ig}`, 6.8, "bold", 2.9);
  y += 1.5;
  pdf.setLineWidth(0.6);
  pdf.line(M, y, W - M, y);
  y += 5;

  // Judul nota
  center("NOTA PENJUALAN", 10, "bold", 4.4);
  center(s.noNota, 8.5, "bold", 4.8);

  // Info transaksi
  row("Tanggal", fmtTanggalNota(s.ts));
  row("Kasir", s.kasirNama || s.kasir.split("@")[0]);
  row("Pembeli", s.pembeli || "Pelanggan");
  if (s.pembeliWa) row("WA Pembeli", s.pembeliWa);
  row("Pembayaran", s.metode === "TRANSFER" ? "Transfer / QRIS" : "Tunai");
  y += 0.5;
  dashed(4);

  // Barang
  s.items.forEach((it) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    const nama = it.kategori === "ISI GAME" && it.platform ? `${it.nama} (${it.platform})` : it.nama;
    (pdf.splitTextToSize(toAscii(nama), CW) as string[]).forEach((line) => { pdf.text(line, M, y); y += 3.4; });
    row(`${it.qty} x ${rp(it.harga)}`, rp(it.subtotal), 7.5);
    const n = negoSatuan(it);
    if (n) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(6.6);
      pdf.text(toAscii(`Harga normal ${rp(it.hargaNormal!)} - nego kasir ${n > 0 ? "-" : "+"}${rp(Math.abs(n))}/pcs`), M, y);
      y += 3;
    }
    y += 1.4;
  });
  dashed(4);

  // Total
  const ng = infoNego(s);
  if (ng.ada) {
    row("Harga normal", rp(ng.hargaNormal));
    row(ng.labelBaris, `${ng.total >= 0 ? "-" : "+"}${rp(Math.abs(ng.total))}`);
  }
  if (s.diskon > 0) {
    row("Subtotal", rp(s.subtotal));
    row(`Diskon promo (${s.diskonPersen}%)`, `-${rp(s.diskon)}`);
  }
  if (ng.ada || s.diskon > 0) y += 1;
  pdf.setFillColor(0, 0, 0);
  pdf.rect(M, y - 1, CW, 8.5, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("TOTAL", M + 2.5, y + 4.6);
  pdf.setFontSize(11.5);
  pdf.text(rp(s.total), W - M - 2.5, y + 4.8, { align: "right" });
  pdf.setTextColor(0, 0, 0);
  y += 12;
  center(`LUNAS  -  ${s.metode === "TRANSFER" ? "TRANSFER / QRIS" : "TUNAI"}`, 7.5, "bold", 3.4);
  y += 2.5;

  // Catatan nego kasir
  if (ng.ada) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.8);
    const nLines = pdf.splitTextToSize(toAscii(`Catatan: ${ng.catatan}.`), CW - 6) as string[];
    const nh = 3 + nLines.length * 3;
    pdf.setLineDashPattern([0.8, 0.8], 0);
    pdf.setLineWidth(0.25);
    pdf.roundedRect(M, y, CW, nh, 1.2, 1.2, "S");
    pdf.setLineDashPattern([], 0);
    let ny = y + 3.6;
    nLines.forEach((l) => { pdf.text(l, W / 2, ny, { align: "center" }); ny += 3; });
    y += nh + 3;
  }

  // Ketentuan garansi
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  const gLines = pdf.splitTextToSize(toAscii(GARANSI_TEKS), CW - 8) as string[];
  const boxH = 6.5 + gLines.length * 3.1;
  pdf.setLineWidth(0.4);
  pdf.roundedRect(M, y, CW, boxH, 1.5, 1.5, "S");
  let gy = y + 4.2;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.8);
  pdf.text(GARANSI_JUDUL, W / 2, gy, { align: "center" });
  gy += 3.4;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  gLines.forEach((l) => { pdf.text(l, W / 2, gy, { align: "center" }); gy += 3.1; });
  y += boxH + 5;

  // Penutup + sosmed
  center("Terima kasih telah berbelanja!", 8.5, "bold", 4);
  center(`Instagram ${STORE.ig}`, 7, "normal", 3.1);
  center(`WhatsApp ${STORE.wa}`, 7, "normal", 3.1);
  y += 1.5;
  // ornamen pixel kecil (ciri Design System URBAN)
  const px = 1.1, startX = W / 2 - (px * 9) / 2;
  [0, 2, 4, 6, 8].forEach((i) => pdf.rect(startX + i * px, y, px, px, "F"));
  y += px + 4;
  return y;
}

export async function buildNotaPdf(s: PosSale): Promise<jsPDF> {
  const logo = await logoDataUrl();
  const measure = new jsPDF({ unit: "mm", format: [W, 600] });
  const h = Math.ceil(drawNota(measure, s, logo));
  const pdf = new jsPDF({ unit: "mm", format: [W, Math.max(h, 120)] });
  drawNota(pdf, s, logo);
  return pdf;
}

export const notaFileName = (s: PosSale) =>
  `Nota_${s.noNota}_${toAscii(s.pembeli || "Pelanggan").trim().replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`;

// ============================================================
// Printer thermal ESC/POS (80 mm, 48 kolom)
// ============================================================

const COLS = 48;
const ESC = 0x1b, GS = 0x1d;

async function logoRaster(widthDots = 320): Promise<number[]> {
  try {
    const img = await loadLogo();
    const w = widthDots - (widthDots % 8);
    const h = Math.round((img.naturalHeight / img.naturalWidth) * w);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    const bytesPerRow = w / 8;
    const out: number[] = [GS, 0x76, 0x30, 0x00, bytesPerRow & 0xff, (bytesPerRow >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff];
    for (let yy = 0; yy < h; yy++) {
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
          const i = (yy * w + bx * 8 + bit) * 4;
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (lum < 128) b |= 0x80 >> bit;
        }
        out.push(b);
      }
    }
    return out;
  } catch {
    return [];
  }
}

function wrap(t: string, width = COLS): string[] {
  const words = toAscii(t).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  words.forEach((w) => {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= width) cur += " " + w;
    else { lines.push(cur); cur = w; }
    while (cur.length > width) { lines.push(cur.slice(0, width)); cur = cur.slice(width); }
  });
  if (cur) lines.push(cur);
  return lines;
}

const lr = (l: string, r: string) => {
  const L = toAscii(l), R = toAscii(r);
  const space = COLS - L.length - R.length;
  return space >= 1 ? L + " ".repeat(space) + R : `${L}\n${" ".repeat(Math.max(0, COLS - R.length))}${R}`;
};

export async function buildNotaEscPos(s: PosSale): Promise<Uint8Array> {
  const out: number[] = [];
  const enc = new TextEncoder();
  const text = (t: string) => out.push(...enc.encode(toAscii(t)));
  const line = (t = "") => text(t + "\n");
  const align = (n: 0 | 1 | 2) => out.push(ESC, 0x61, n);
  const bold = (on: boolean) => out.push(ESC, 0x45, on ? 1 : 0);
  const size = (n: 0x00 | 0x11 | 0x01) => out.push(GS, 0x21, n);
  const rule = (ch = "-") => line(ch.repeat(COLS));

  out.push(ESC, 0x40); // init
  align(1);
  const raster = await logoRaster();
  if (raster.length) { out.push(...raster); line(); }
  else { size(0x11); bold(true); line("URBAN"); size(0x00); line("Gaming Lampung"); bold(false); }
  wrap(STORE.alamat).forEach(line);
  bold(true); line(`WA ${STORE.wa} | IG ${STORE.ig}`); bold(false);
  rule("=");
  bold(true); size(0x01); line("NOTA PENJUALAN"); size(0x00); line(s.noNota); bold(false);
  align(0);
  line(lr("Tanggal", fmtTanggalNota(s.ts)));
  line(lr("Kasir", s.kasirNama || s.kasir.split("@")[0]));
  line(lr("Pembeli", s.pembeli || "Pelanggan"));
  if (s.pembeliWa) line(lr("WA Pembeli", s.pembeliWa));
  line(lr("Pembayaran", s.metode === "TRANSFER" ? "Transfer / QRIS" : "Tunai"));
  rule();
  s.items.forEach((it) => {
    const nama = it.kategori === "ISI GAME" && it.platform ? `${it.nama} (${it.platform})` : it.nama;
    bold(true); wrap(nama).forEach(line); bold(false);
    line(lr(`  ${it.qty} x ${rp(it.harga)}`, rp(it.subtotal)));
    const n = negoSatuan(it);
    if (n) wrap(`  Normal ${rp(it.hargaNormal!)}, nego ${n > 0 ? "-" : "+"}${rp(Math.abs(n))}/pcs`).forEach(line);
  });
  rule();
  const ng = infoNego(s);
  if (ng.ada) {
    line(lr("Harga normal", rp(ng.hargaNormal)));
    line(lr(ng.labelBaris, `${ng.total >= 0 ? "-" : "+"}${rp(Math.abs(ng.total))}`));
  }
  if (s.diskon > 0) {
    line(lr("Subtotal", rp(s.subtotal)));
    line(lr(`Diskon promo (${s.diskonPersen}%)`, `-${rp(s.diskon)}`));
  }
  bold(true); size(0x01); line(lr("TOTAL", rp(s.total))); size(0x00); bold(false);
  align(1);
  line(`LUNAS - ${s.metode === "TRANSFER" ? "TRANSFER / QRIS" : "TUNAI"}`);
  if (ng.ada) wrap(`Catatan: ${ng.catatan}.`).forEach(line);
  rule("*");
  bold(true); line(GARANSI_JUDUL); bold(false);
  wrap(GARANSI_TEKS).forEach(line);
  rule("*");
  line();
  bold(true); line("Terima kasih telah berbelanja!"); bold(false);
  line(`Instagram ${STORE.ig}`);
  line(`WhatsApp ${STORE.wa}`);
  line(); line(); line();
  out.push(GS, 0x56, 0x42, 0x00); // cut
  return new Uint8Array(out);
}

/** Kirim ke printer Bluetooth (Web Bluetooth) atau aplikasi RawBT di Android. */
export async function printNotaThermal(s: PosSale): Promise<"bluetooth" | "rawbt" | "batal"> {
  const bytes = await buildNotaEscPos(s);
  const nav: any = navigator;
  if (nav.bluetooth) {
    try {
      const SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: [SERVICE] }, { namePrefix: "Kassen" }, { namePrefix: "MT-80B" }, { namePrefix: "Thermal" }, { namePrefix: "Printer" }, { namePrefix: "MTP" }],
        optionalServices: [SERVICE],
      });
      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService(SERVICE);
      const chars = await service?.getCharacteristics();
      const wc = chars?.find((c: any) => c.properties.write || c.properties.writeWithoutResponse);
      if (!wc) throw new Error("Karakteristik write printer tidak ditemukan.");
      for (let i = 0; i < bytes.length; i += 100) await wc.writeValue(bytes.slice(i, i + 100));
      return "bluetooth";
    } catch (err: any) {
      if (err?.name === "NotFoundError" || err?.name === "AbortError") return "batal";
      console.warn("Bluetooth gagal, coba RawBT:", err);
    }
  }
  if (!/android/i.test(navigator.userAgent || "")) {
    throw new Error("Cetak thermal butuh printer Bluetooth (Chrome) atau aplikasi RawBT di Android. Pakai Unduh PDF di perangkat ini.");
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  window.location.href = `intent:base64,${btoa(bin)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
  return "rawbt";
}
