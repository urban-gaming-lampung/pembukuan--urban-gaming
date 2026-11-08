/**
 * Baca & buat LAPORAN STOK format WhatsApp, contoh:
 *
 *   *UNIT KONSOL BARU*
 *   • PS4 FAT 1TB - 1 Unit
 *   - PS 3 Slim 160GB - 1 Unit ⚠️ (servis)
 *   *STIK PS3*
 *   • Hitam - 10
 *   Total: 20
 *
 * Murni (tanpa Firebase) supaya mudah dites.
 */

export type ReportLine = {
  kategoriRaw: string; // "" bila barang muncul sebelum judul kategori
  nama: string;
  jumlah: number;
  catatan: string;
  baris: number; // nomor baris di teks (mulai 1)
};

export type ParsedReport = { lines: ReportLine[]; diabaikan: { baris: number; teks: string }[] };

/** Kunci pencocokan: huruf besar, tanpa spasi & tanda baca ("PS 3 Slim 1 TB" == "PS3 SLIM 1TB"). */
export const normKey = (s: string) =>
  String(s || "").normalize("NFKD").toUpperCase().replace(/[^A-Z0-9]/g, "");

const tokens = (s: string) =>
  String(s || "").toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);

/** Kemiripan nama (Jaccard token), 0..1 */
export function similarity(a: string, b: string): number {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((t) => { if (B.has(t)) inter++; });
  return inter / (A.size + B.size - inter);
}

const cleanCatatan = (s: string) =>
  s
    .replace(/[⚠️❗❕‼⁉]/g, "") // ⚠️ ❗ dll
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "") // emoji lain
    .trim()
    .replace(/^[,;:.\-–—\s]+/, "")
    .replace(/^\((.*)\)$/s, "$1")
    .replace(/\s+/g, " ")
    .trim();

const cleanNama = (s: string) => s.replace(/\*/g, "").replace(/\s+/g, " ").trim();

const BULLET = /^[\s]*[•·●▪◦\-–—*+>]+\s*/;
const HEADER = /^\s*\*+\s*([^*]+?)\s*\*+\s*$/;
// "<nama> - <angka> [unit|pcs|buah] <catatan>"  (pemisah: - – — : =)
const ITEM = /^(.+?)\s*[-–—:=]\s*(\d+)\s*(?:unit|units|pcs|pc|buah|bh)?\b(.*)$/i;

export function parseStokReport(text: string): ParsedReport {
  const lines: ReportLine[] = [];
  const diabaikan: ParsedReport["diabaikan"] = [];
  let kategori = "";
  String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .forEach((raw, idx) => {
      const baris = idx + 1;
      const t = raw.trim();
      if (!t) return;
      if (/^total\b/i.test(t.replace(BULLET, ""))) return; // "Total: 20"

      const h = t.match(HEADER);
      if (h) {
        kategori = cleanNama(h[1]);
        return;
      }

      const body = t.replace(BULLET, "");
      const m = body.match(ITEM);
      if (m && cleanNama(m[1])) {
        lines.push({
          kategoriRaw: kategori,
          nama: cleanNama(m[1]),
          jumlah: Math.max(0, parseInt(m[2], 10) || 0),
          catatan: cleanCatatan(m[3] || ""),
          baris,
        });
        return;
      }

      // Judul tanpa bintang: baris huruf besar tanpa angka jumlah, mis. "STIK PS4"
      if (!BULLET.test(raw) && /^[A-Z0-9 &/().-]{3,}$/.test(t) && !/\d+\s*$/.test(t)) {
        kategori = cleanNama(t);
        return;
      }
      diabaikan.push({ baris, teks: t });
    });
  return { lines, diabaikan };
}

// ============================================================
// Pencocokan dengan Master Inventaris
// ============================================================

export type MasterCat = { kategori: string; items: string[] };

export type MatchedLine = ReportLine & {
  kategori: string; // kategori master (atau nama baru)
  kategoriBaru: boolean;
  item: string | null; // nama barang master yang cocok
  saran: string | null; // barang master yang mirip (bila tidak cocok persis)
};

export function matchReport(lines: ReportLine[], master: MasterCat[]): MatchedLine[] {
  const catByKey = new Map(master.map((c) => [normKey(c.kategori), c]));
  return lines.map((l) => {
    const rawCat = l.kategoriRaw || "LAIN-LAIN";
    const cat = catByKey.get(normKey(rawCat));
    const kategori = cat ? cat.kategori : rawCat.toUpperCase();
    const items = cat?.items || [];
    const exact = items.find((i) => normKey(i) === normKey(l.nama)) || null;
    let saran: string | null = null;
    if (!exact) {
      let best = 0;
      items.forEach((i) => {
        const s = similarity(i, l.nama);
        if (s > best) { best = s; saran = i; }
      });
      if (best < 0.6) saran = null;
    }
    return { ...l, kategori, kategoriBaru: !cat, item: exact, saran };
  });
}

// ============================================================
// Buat laporan (kebalikan dari parse) — untuk disalin ke WhatsApp
// ============================================================

export function buildStokReport(
  master: MasterCat[],
  jualan: Record<string, Record<string, { jumlah?: number; catatan?: string }>>,
  tanggal = new Date()
): string {
  const out: string[] = [
    "*STOK BARANG JUALAN*",
    tanggal.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  ];
  master.forEach((c) => {
    if (!c.items?.length) return;
    const isUnit = /unit|konsol/i.test(c.kategori);
    out.push("", `*${c.kategori}*`);
    let total = 0;
    c.items.forEach((i) => {
      const v = jualan?.[c.kategori]?.[i];
      const n = Math.max(0, Math.round(Number(v?.jumlah) || 0));
      total += n;
      const note = String(v?.catatan || "").trim();
      out.push(`• ${i} - ${n}${isUnit ? " Unit" : ""}${note ? ` (${note})` : ""}`);
    });
    if (/stik/i.test(c.kategori)) out.push(`Total: ${total}`);
  });
  return out.join("\n");
}
