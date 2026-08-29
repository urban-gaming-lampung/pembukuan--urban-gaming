import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export function useFormDraft(
  currentSignature: string,
  onIncomingUpdate: (data: any) => void,
  activeTab: string,
  isEditing: boolean
) {
  const skipNextWrite = useRef(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  // 1. Tulis ke Firestore saat ada perubahan lokal dari admin
  useEffect(() => {
    if (activeTab !== "USAHA RENTAL") return; // Hanya jalankan draft untuk Usaha Rental
    if (!hasHydrated) return; // FIX: Jangan timpa DB sebelum mendapatkan state awal dari server
    if (isEditing) return; // FIX: Jangan ubah draft global jika sedang melihat/edit history

    // Jika perubahan ini adalah efek dari injection (data dari admin lain), abaikan!
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }

    try {
      const parsed = JSON.parse(currentSignature);
      setDoc(doc(db, "data", "draft"), parsed).catch(console.error);
    } catch (e) {
      console.error("Gagal menyimpan draft", e);
    }
  }, [currentSignature, activeTab, hasHydrated, isEditing]);

  // 2. Dengarkan perubahan dari admin lain secara realtime
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "draft"), (snap) => {
      // Saat pertama kali komponen load, ambil data DB
      if (!hasHydrated) {
        setHasHydrated(true);
        if (snap.exists() && !isEditing) {
          skipNextWrite.current = true;
          onIncomingUpdate(snap.data());
        }
        return;
      }

      if (isEditing) return; // FIX: Abaikan update draft dari admin lain supaya tidak mengganggu form editing history

      // Hanya ganti state lokal jika snapshot ini BERASAL DARI SERVER (admin lain).
      if (snap.exists() && !snap.metadata.hasPendingWrites) {
        skipNextWrite.current = true;
        onIncomingUpdate(snap.data());
      }
    });

    return () => unsub();
  }, [hasHydrated, onIncomingUpdate, isEditing]);
}
