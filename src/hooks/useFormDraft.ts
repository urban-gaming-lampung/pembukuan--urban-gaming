import { useEffect, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export function useFormDraft(
  currentSignature: string,
  onIncomingUpdate: (data: any) => void,
  activeTab: string,
  isEditing: boolean
) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const lastRemoteSignatureRef = useRef<string>("");
  const isIncomingUpdateRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Tulis ke Firestore saat ada perubahan lokal dari admin (dengan debounce 600ms)
  useEffect(() => {
    if (activeTab !== "USAHA RENTAL") return; // Hanya jalankan draft untuk Usaha Rental
    if (!hasHydrated) return; // Jangan timpa DB sebelum mendapatkan state awal dari server
    if (isEditing) return; // Jangan ubah draft global jika sedang melihat/edit history

    // Jika perubahan ini adalah efek dari injection update server, abaikan penulisan kembali
    if (isIncomingUpdateRef.current) {
      isIncomingUpdateRef.current = false;
      return;
    }

    // Jika signature lokal sama persis dengan yang baru saja diterima dari remote, jangan tulis ulang
    if (currentSignature === lastRemoteSignatureRef.current) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(currentSignature);
        
        // Cek apakah draft ini memiliki konten bermakna agar tidak menimpa draft server dengan form kosong
        const hasContent = 
          Boolean(parsed.absenPagi || parsed.absenSiang || parsed.rukoBuka || parsed.rukoTutup || parsed.catatan) ||
          (Array.isArray(parsed.rowsHarian) && parsed.rowsHarian.some((r: any) => r.harga || r.bayar || r.jenisPS)) ||
          (Array.isArray(parsed.rowsJajanan) && parsed.rowsJajanan.some((r: any) => r.harga || r.bayar || r.jenisJajanan)) ||
          (Array.isArray(parsed.rowsJasaAks) && parsed.rowsJasaAks.some((r: any) => r.harga || r.bayar || r.tipe)) ||
          (Array.isArray(parsed.rowsSewa) && parsed.rowsSewa.some((r: any) => r.harga || r.bayar || r.jenisPS || r.namaPenyewa || r.ket)) ||
          (Array.isArray(parsed.rowsSetoran) && parsed.rowsSetoran.some((r: any) => r.harga || r.ket)) ||
          (Array.isArray(parsed.rowsPengeluaran) && parsed.rowsPengeluaran.some((r: any) => r.harga || r.ket));

        if (hasContent) {
          setDoc(doc(db, "data", "draft"), parsed).catch(console.error);
        }
      } catch (e) {
        console.error("Gagal menyimpan draft", e);
      }
    }, 600);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [currentSignature, activeTab, hasHydrated, isEditing]);

  // 2. Dengarkan perubahan dari admin lain secara realtime
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "draft"), (snap) => {
      if (isEditing) return; // Abaikan update draft dari admin lain supaya tidak mengganggu form editing history

      // Saat pertama kali komponen load, ambil data DB
      if (!hasHydrated) {
        setHasHydrated(true);
        if (snap.exists()) {
          const remoteData = snap.data();
          if (remoteData && Object.keys(remoteData).length > 0) {
            isIncomingUpdateRef.current = true;
            lastRemoteSignatureRef.current = JSON.stringify(remoteData);
            onIncomingUpdate(remoteData);
          }
        }
        return;
      }

      // Hanya ganti state lokal jika snapshot ini BERASAL DARI SERVER (admin lain).
      if (snap.exists() && !snap.metadata.hasPendingWrites) {
        const remoteData = snap.data();
        if (remoteData && Object.keys(remoteData).length > 0) {
          const remoteSig = JSON.stringify(remoteData);
          if (remoteSig !== lastRemoteSignatureRef.current) {
            lastRemoteSignatureRef.current = remoteSig;
            isIncomingUpdateRef.current = true;
            onIncomingUpdate(remoteData);
          }
        }
      }
    }, (err) => console.error("Error draft snapshot:", err));

    return () => unsub();
  }, [hasHydrated, onIncomingUpdate, isEditing]);
}

