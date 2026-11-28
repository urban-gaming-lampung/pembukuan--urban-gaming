/**
 * NOTIFIKASI HP (Web Push via Firebase Cloud Messaging).
 * Server (functions › pengingatSewaOtomatis) mengirim pengingat sewa ke token yang disimpan di users/{email}.pushTokens,
 * jadi notifikasi tetap muncul walau aplikasi / Chrome sedang ditutup.
 */
import { deleteField, doc, FieldPath, setDoc, updateDoc } from "firebase/firestore";
import { app, db } from "./firebase";

const KUNCI_TOKEN = "urban_push_token";
export type StatusPush = "aktif" | "mati" | "ditolak" | "tidak-didukung";

const didukung = () => typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window && "PushManager" in window;
/** iPhone hanya bisa menerima push bila aplikasi dipasang ke Layar Utama. */
export const perluPasangIphone = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone);

export function statusPush(): StatusPush {
  if (!didukung()) return "tidak-didukung";
  if (Notification.permission === "denied") return "ditolak";
  return Notification.permission === "granted" && localStorage.getItem(KUNCI_TOKEN) ? "aktif" : "mati";
}

async function ambilToken(): Promise<string> {
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) throw new Error("Browser ini belum mendukung notifikasi.");
  const base = import.meta.env.BASE_URL || "/";
  const reg = await navigator.serviceWorker.register(`${base}push-sw.js`, { scope: base });
  await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { serviceWorkerRegistration: reg });
}

async function simpanToken(email: string, token: string) {
  const lama = localStorage.getItem(KUNCI_TOKEN);
  await setDoc(doc(db, "users", email), {
    pushAktif: true,
    pushTokens: { [token]: { ts: Date.now(), ua: navigator.userAgent.slice(0, 140) } },
  }, { merge: true });
  if (lama && lama !== token) await updateDoc(doc(db, "users", email), new FieldPath("pushTokens", lama), deleteField()).catch(() => null);
  localStorage.setItem(KUNCI_TOKEN, token);
}

/** Minta izin & daftarkan HP ini untuk menerima notifikasi. */
export async function aktifkanPush(email: string | null | undefined): Promise<StatusPush> {
  if (!email) throw new Error("Masuk dulu untuk mengaktifkan notifikasi.");
  if (!didukung()) return "tidak-didukung";
  const izin = await Notification.requestPermission();
  if (izin !== "granted") return izin === "denied" ? "ditolak" : "mati";
  await simpanToken(email.toLowerCase(), await ambilToken());
  return "aktif";
}

/** Matikan notifikasi di HP ini. */
export async function matikanPush(email: string | null | undefined) {
  const token = localStorage.getItem(KUNCI_TOKEN);
  localStorage.removeItem(KUNCI_TOKEN);
  if (!email || !token) return;
  await updateDoc(doc(db, "users", email.toLowerCase()), new FieldPath("pushTokens", token), deleteField()).catch(() => null);
  try {
    const { deleteToken, getMessaging } = await import("firebase/messaging");
    await deleteToken(getMessaging(app));
  } catch { /* abaikan */ }
}

/** Saat aplikasi dibuka: perbarui token (token FCM bisa berganti) tanpa bertanya lagi. */
export async function segarkanPush(email: string | null | undefined) {
  if (!email || statusPush() !== "aktif") return;
  try { await simpanToken(email.toLowerCase(), await ambilToken()); } catch (e) { console.warn("[push]", e); }
}
