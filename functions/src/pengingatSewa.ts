/**
 * PENGINGAT SEWA OTOMATIS (push notification) — berjalan di server tiap 5 menit, tidak perlu aplikasi terbuka.
 *
 * Event per unit sewa (logika waktu sama dengan src/lib/sewa.ts › daftarSewaBerjalan):
 *  - segera : 30 menit sebelum waktu sewa habis      → pencatat sewa
 *  - habis  : waktu sewa habis, belum dikonfirmasi    → pencatat sewa
 *  - telat  : lewat batas kembali (habis + 60 menit)  → pencatat sewa + owner & super admin
 * Tiap event dikirim sekali (dicatat di data/push_terkirim) dan hanya bila baru terjadi (≤ 60 menit).
 * Token HP disimpan klien di users/{email}.pushTokens (pushAktif = true).
 */
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';

const EMAIL_OWNER = 'owner@gmail.com';
const INGATKAN_SEBELUM_MENIT = 30;
const TOLERANSI_KEMBALI_MENIT = 60;
const JAM_GANTI_HARI = 6;
const BATAS_KONFIRMASI_MS = 2.5 * 86400000;
const JENDELA_KIRIM_MS = 60 * 60000;
const LINK_APP = 'https://urban-gaming-lampung.github.io/pembukuan--urban-gaming/';

type Baris = Record<string, any>;

// ---------- waktu WIB (server berjalan di UTC) ----------
const WIB_MS = 7 * 3600000;
/** ms epoch dari tanggal lokal WIB + jam:menit */
const epochWib = (y: number, m: number, d: number, jam: number, menit: number) => Date.UTC(y, m - 1, d, jam, menit) - WIB_MS;
const ymdWib = (ts: number) => new Date(ts + WIB_MS).toISOString().slice(0, 10);
const jamMenitWib = (ts: number) => new Date(ts + WIB_MS).toISOString().slice(11, 16).replace(':', '.');

const toInt = (v: unknown) => {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};
const jamDariTeks = (s: unknown) => {
  const m = String(s ?? '').trim().match(/^(\d{1,2})(?:[:.](\d{2}))?(?!\d)/);
  if (!m) return null;
  const jam = Number(m[1]), menit = Number(m[2] || 0);
  return jam <= 23 && menit <= 59 ? { jam, menit } : null;
};
function waktuHariKerja(tanggal: string, jamTeks: unknown): number | null {
  const [y, m, d] = String(tanggal || '').split('-').map(Number);
  const j = jamDariTeks(jamTeks);
  if (!y || !m || !d || !j) return null;
  return epochWib(y, m, d + (j.jam < JAM_GANTI_HARI ? 1 : 0), j.jam, j.menit);
}
function jamDurasi(r: Baris): number | null {
  if (String(r?.lamaSewa ?? '') === 'Isi Sendiri') {
    const n = parseFloat(String(r?._customDurasi ?? '').replace(',', '.'));
    return n > 0 ? n : null;
  }
  const s = String(r?.lamaSewa ?? '').toUpperCase();
  const hari = s.match(/(\d+)\s*HARI/);
  if (hari) return Number(hari[1]) * 24 || null;
  const jam = s.match(/(\d+)\s*JAM/);
  if (jam) return Number(jam[1]) || null;
  if (/SEHARI|SEMALAM|HARI/.test(s)) return 24;
  return null;
}
const lama = (r: Baris) => String(r?.lamaSewa ?? '').trim();
const tanpaUnitKeluar = (r: Baris) => {
  const j = String(r?.jenisPS ?? '').trim().toLowerCase();
  return j === 'hanya ongkir' || j === 'denda' || lama(r) === '-' || lama(r) === 'PELUNASAN' || lama(r) === 'DP BOOKING';
};
const barisUnit = (r: Baris) =>
  !tanpaUnitKeluar(r) && !!r.jenisPS && !!r.jamMasukSewa && !!r.lamaSewa && (toInt(r.harga) + Math.max(0, toInt(r._dpBooking)) > 0 || r.isPaid === 'TIDAK');

type Unit = { uid: string; jenis: string; nama: string; addedBy: string; mulai: number; selesai: number; verified: boolean };

export function daftarUnit(history: { tanggal: string; rowsSewa?: Baris[] }[], draft: { tanggal?: string; rowsSewa?: Baris[] } | null): Unit[] {
  const peta = new Map<string, Unit>();
  const tambah = (r: Baris, tanggal: string, seen: Map<string, number>) => {
    const base = `${String(r.jenisPS).trim()}-${String(r.jamMasukSewa).trim()}-${String(r.ket || '').trim()}-${tanggal}`;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    const jam = jamDurasi(r);
    const mulai = waktuHariKerja(tanggal, r.jamMasukSewa);
    if (!jam || mulai === null) return;
    const uid = `${base}#${n}`;
    peta.set(uid, {
      uid,
      jenis: String(r.jenisPS).trim(),
      nama: String(r.ket || '').trim() || 'Tanpa Nama',
      addedBy: String(r._addedBy || '').toLowerCase().trim(),
      mulai,
      selesai: mulai + jam * 3600000,
      verified: !!r._verifiedReturn,
    });
  };
  const histSeen = new Map<string, number>();
  history.forEach((h) => (h.rowsSewa || []).forEach((r) => { if (barisUnit(r)) tambah(r, h.tanggal, histSeen); }));
  if (draft?.tanggal && !history.some((h) => h.tanggal === draft.tanggal)) {
    const liveSeen = new Map<string, number>();
    (draft.rowsSewa || []).forEach((r) => { if (barisUnit(r)) tambah(r, String(draft.tanggal), liveSeen); });
  }
  return Array.from(peta.values());
}

type Pesan = { kunci: string; ke: string[]; judul: string; isi: string; tag: string };

export const pengingatSewaOtomatis = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Asia/Jakarta', retryCount: 0, memory: '256MiB' },
  async () => {
    const db = admin.firestore();
    const now = Date.now();
    const dariTanggal = ymdWib(now - 6 * 86400000);

    const [histSnap, draftSnap, sentSnap, userSnap] = await Promise.all([
      db.collection('history_pembukuan').where('tanggal', '>=', dariTanggal).get(),
      db.collection('data').doc('draft').get(),
      db.collection('data').doc('push_terkirim').get(),
      db.collection('users').where('pushAktif', '==', true).get(),
    ]);
    const history = histSnap.docs.map((d) => d.data() as { tanggal: string; rowsSewa?: Baris[] });
    const units = daftarUnit(history, draftSnap.exists ? (draftSnap.data() as any) : null);

    // Penerima: token per email; owner & super admin untuk eskalasi
    const tokenPer = new Map<string, string[]>();
    const pengawas: string[] = [];
    userSnap.docs.forEach((d) => {
      const email = d.id.toLowerCase();
      const x = d.data() as any;
      const tokens = x.pushDimatikanOwner === true ? [] : Object.keys(x.pushTokens || {});
      if (tokens.length) tokenPer.set(email, tokens);
      if (email === EMAIL_OWNER || String(x.role || '').toLowerCase() === 'super admin') pengawas.push(email);
    });

    const terkirim: Record<string, number> = (sentSnap.exists ? (sentSnap.data() as any).sent : null) || {};
    const pesan: Pesan[] = [];
    const baru = (t: number) => now >= t && now - t <= JENDELA_KIRIM_MS;

    units.forEach((u) => {
      if (u.verified || now - u.selesai > BATAS_KONFIRMASI_MS) return;
      const pencatat = u.addedBy ? [u.addedBy] : pengawas;
      const label = `${u.jenis} a.n ${u.nama}`;
      const batas = u.selesai + TOLERANSI_KEMBALI_MENIT * 60000;
      if (baru(u.selesai - INGATKAN_SEBELUM_MENIT * 60000) && now < u.selesai)
        pesan.push({ kunci: `segera|${u.uid}`, ke: pencatat, judul: `${INGATKAN_SEBELUM_MENIT} menit lagi sewa habis`, isi: `${label} habis pukul ${jamMenitWib(u.selesai)}. Ingatkan penyewa via WA.`, tag: `sewa-${u.uid}` });
      if (baru(u.selesai) && now < batas)
        pesan.push({ kunci: `habis|${u.uid}`, ke: pencatat, judul: 'Waktu sewa habis', isi: `${label} sudah habis (${jamMenitWib(u.selesai)}). Konfirmasi saat unit kembali.`, tag: `sewa-${u.uid}` });
      if (baru(batas))
        pesan.push({ kunci: `telat|${u.uid}`, ke: Array.from(new Set([...pencatat, ...pengawas])), judul: 'Lewat batas kembali', isi: `${label} belum dikonfirmasi kembali. Batas pukul ${jamMenitWib(batas)}, denda mulai berjalan.`, tag: `sewa-${u.uid}` });
    });

    const kirim = pesan.filter((p) => !terkirim[p.kunci]);
    const tokenMati = new Map<string, string[]>();
    for (const p of kirim) {
      const tokens = Array.from(new Set(p.ke.flatMap((e) => tokenPer.get(e) || [])));
      terkirim[p.kunci] = now;
      if (!tokens.length) continue;
      const res = await admin.messaging().sendEachForMulticast({
        tokens,
        data: { judul: p.judul, isi: p.isi, tag: p.tag, link: `${LINK_APP}#monitoring` },
        webpush: { headers: { Urgency: 'high', TTL: '3600' } },
      });
      res.responses.forEach((r, i) => {
        const code = r.error?.code || '';
        if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token') || code.includes('invalid-argument')) {
          tokenPer.forEach((list, email) => { if (list.includes(tokens[i])) tokenMati.set(email, [...(tokenMati.get(email) || []), tokens[i]]); });
        }
      });
      console.log(`[pengingat] ${p.kunci} → ${res.successCount}/${tokens.length} HP`);
    }

    // Bersihkan token yang sudah tidak berlaku
    for (const [email, tokens] of tokenMati) {
      const ref = db.collection('users').doc(email);
      for (const t of tokens) await ref.update(new admin.firestore.FieldPath('pushTokens', t), admin.firestore.FieldValue.delete()).catch(() => null);
    }

    // Simpan daftar terkirim (buang yang > 3 hari)
    if (kirim.length) {
      const sent: Record<string, number> = {};
      Object.entries(terkirim).forEach(([k, t]) => { if (now - t < 3 * 86400000) sent[k] = t; });
      await db.collection('data').doc('push_terkirim').set({ sent, updatedAt: now });
    }
  }
);
