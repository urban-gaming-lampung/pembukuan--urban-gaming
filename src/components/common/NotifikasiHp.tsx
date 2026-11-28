import React, { useEffect, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { Button, ListGroup, ListRow, Sheet, Toggle, notify } from "../../ui";
import { auth, db } from "../../lib/firebase";
import { aktifkanPush, matikanPush, perluPasangIphone, statusPush, type StatusPush } from "../../lib/pushNotif";

const pesanStatus = (s: StatusPush) =>
  s === "aktif" ? "Aktif di HP ini"
  : s === "ditolak" ? "Diblokir di pengaturan browser"
  : s === "tidak-didukung" ? (perluPasangIphone() ? "Pasang ke Layar Utama dulu" : "Browser ini belum mendukung")
  : "Belum aktif";

const LANGKAH_DIBLOKIR = "Ketuk ikon gembok/⋮ di samping alamat situs → Setelan situs → Notifikasi → Izinkan, lalu muat ulang.";
const LANGKAH_IPHONE = "Ketuk Bagikan → Tambahkan ke Layar Utama, lalu buka URBAN dari ikon itu.";

export function useNotifikasiHp() {
  const [status, setStatus] = useState<StatusPush>(() => statusPush());
  const [sibuk, setSibuk] = useState(false);
  // Izin bisa diubah dari pengaturan browser: cek ulang saat aplikasi kembali dibuka
  useEffect(() => {
    const cek = () => { if (document.visibilityState === "visible") setStatus(statusPush()); };
    document.addEventListener("visibilitychange", cek);
    return () => document.removeEventListener("visibilitychange", cek);
  }, []);
  const email = auth.currentUser?.email;
  const aktifkan = async () => {
    setSibuk(true);
    try {
      const s = await aktifkanPush(email);
      setStatus(s);
      if (s === "aktif") notify("Notifikasi HP aktif.", "positive");
      else if (s === "ditolak") notify(LANGKAH_DIBLOKIR, "warning");
      else if (s === "tidak-didukung") notify(perluPasangIphone() ? LANGKAH_IPHONE : "Browser ini belum mendukung notifikasi.", "warning");
    } catch (e: any) {
      notify(e?.message || "Gagal mengaktifkan notifikasi.", "negative");
    } finally { setSibuk(false); }
  };
  const matikan = async () => {
    setSibuk(true);
    try { await matikanPush(email); setStatus(statusPush()); notify("Notifikasi HP dimatikan."); } finally { setSibuk(false); }
  };
  return { status, sibuk, aktifkan, matikan, label: pesanStatus(status) };
}

/**
 * NOTIFIKASI WAJIB untuk akun admin (bukan super admin / owner), kecuali dimatikan super admin.
 * Browser tidak mengizinkan izin notifikasi diberikan tanpa ketukan, jadi admin wajib menekan "Aktifkan" sekali.
 * Belum aktif → lembar tidak bisa ditutup. Diblokir / iPhone belum dipasang → kartu langkah perbaikan (pekerjaan tetap bisa jalan).
 */
export const NotifikasiWajib: React.FC<{ wajib: boolean }> = ({ wajib }) => {
  const n = useNotifikasiHp();
  if (!wajib || n.status === "aktif") return null;
  if (n.status === "mati") {
    return (
      <Sheet
        open
        onClose={() => {}}
        size="sm"
        variant="grouped"
        icon={<BellRing />}
        iconColor="blue"
        title="Aktifkan notifikasi"
        subtitle="Wajib untuk akun admin"
        hideClose
        footer={<Button variant="filled" size="lg" block disabled={n.sibuk} onClick={n.aktifkan}>{n.sibuk ? "Mengaktifkan…" : "Aktifkan notifikasi"}</Button>}
      >
        <ListGroup>
          <ListRow title="30 menit sebelum sewa habis" subtitle="Ingatkan penyewa via WA" />
          <ListRow title="Saat waktu sewa habis" subtitle="Konfirmasi saat unit kembali" />
          <ListRow title="Lewat batas kembali" subtitle="Owner ikut diberi tahu" />
        </ListGroup>
        <p className="mt-3 px-1 text-footnote text-label-2 leading-snug">Notifikasi tetap muncul walau aplikasi & Chrome ditutup. Setelah menekan tombol, pilih <b className="font-semibold text-label">Izinkan</b>.</p>
      </Sheet>
    );
  }
  return null;
};

/** Kartu di Monitoring: ajakan (super admin, bisa ditutup) atau langkah perbaikan (admin wajib, tidak bisa ditutup). */
export const AjakanNotifikasi: React.FC<{ wajib?: boolean; dimatikan?: boolean }> = ({ wajib, dimatikan }) => {
  const n = useNotifikasiHp();
  const [tutup, setTutup] = useState(() => { try { return localStorage.getItem("urban_push_ajakan_tutup") === "1"; } catch { return false; } });
  if (dimatikan || n.status === "aktif" || (n.status === "tidak-didukung" && !perluPasangIphone())) return null;
  if (!wajib && (tutup || n.status === "ditolak")) return null;
  const iphone = n.status === "tidak-didukung";
  const diblokir = n.status === "ditolak";
  return (
    <div className={`flex items-center gap-3 rounded-card apple-card ring-1 shadow-card px-3.5 py-3 ${diblokir ? "ring-negative/40" : "ring-edge"}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${diblokir ? "bg-negative/10 text-negative" : "bg-tint/10 text-tint"}`}><BellRing className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-subhead font-semibold text-label">{diblokir ? "Notifikasi diblokir" : "Pengingat ke HP"}</span>
        <span className="block text-caption text-label-2 leading-snug">
          {iphone ? LANGKAH_IPHONE : diblokir ? LANGKAH_DIBLOKIR : "Muncul walau aplikasi & Chrome ditutup."}
        </span>
      </span>
      {!iphone && !diblokir && <Button size="sm" variant="filled" disabled={n.sibuk} onClick={n.aktifkan}>Aktifkan</Button>}
      {!wajib && (
        <button type="button" aria-label="Tutup" onClick={() => { setTutup(true); try { localStorage.setItem("urban_push_ajakan_tutup", "1"); } catch { /* */ } }}
          className="hit-44 -mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-label-3 active:bg-fill text-lg leading-none">×</button>
      )}
    </div>
  );
};

/** Super admin: nyalakan / matikan notifikasi tiap akun admin. */
export const KelolaNotifikasiPegawai: React.FC = () => {
  const [akun, setAkun] = useState<any[]>([]);
  useEffect(() => onSnapshot(collection(db, "users"), (snap) => {
    setAkun(snap.docs.map((d) => ({ email: d.id, ...(d.data() as any) }))
      .filter((u) => u.email.includes("@") && u.email !== "owner@gmail.com" && u.status !== "nonaktif" && u.role));
  }), []);
  const urut = useMemo(() => [...akun].sort((a, b) => a.email.localeCompare(b.email)), [akun]);
  const ubah = async (email: string, nyala: boolean) => {
    try {
      await setDoc(doc(db, "users", email), { pushDimatikanOwner: !nyala }, { merge: true });
      notify(`Notifikasi ${email.split("@")[0]} ${nyala ? "dinyalakan" : "dimatikan"}.`, nyala ? "positive" : undefined);
    } catch (e: any) { notify(e?.message || "Gagal mengubah.", "negative"); }
  };
  if (!urut.length) return null;
  return (
    <ListGroup>
      {urut.map((u) => {
        const hp = Object.keys(u.pushTokens || {}).length;
        const nyala = u.pushDimatikanOwner !== true;
        return (
          <ListRow
            key={u.email}
            title={u.email.split("@")[0]}
            subtitle={`${String(u.role || "admin")} · ${!nyala ? "Dimatikan" : hp ? `${hp} HP aktif` : "Belum ada HP aktif"}`}
            value={<Toggle on={nyala} onChange={(v) => ubah(u.email, v)} label={`Notifikasi ${u.email}`} />}
            chevron={false}
          />
        );
      })}
    </ListGroup>
  );
};
