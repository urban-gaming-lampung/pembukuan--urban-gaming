import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";

/**
 * Jumlah request edit pembukuan dari admin yang menunggu persetujuan owner.
 * Dipakai untuk titik merah di tab Lainnya & angka di baris "Request edit".
 */
export default function useRequestEditPending(aktif: boolean): number {
  const [jumlah, setJumlah] = useState(0);
  useEffect(() => {
    if (!aktif) {
      setJumlah(0);
      return;
    }
    const q = query(collection(db, "edit_requests"), where("status", "==", "pending"));
    return onSnapshot(
      q,
      (snap) => setJumlah(snap.size),
      () => setJumlah(0)
    );
  }, [aktif]);
  return jumlah;
}
