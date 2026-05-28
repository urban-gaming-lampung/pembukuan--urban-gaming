import { useEffect, useState, useRef } from "react";
import { collection, doc, setDoc, onSnapshot, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export type PresenceData = {
  uid: string;
  email: string;
  tab: string;
  lastActive: number;
  focusedField?: string | null;
  profileColor?: string | null;
};

export function usePresence(user: { uid: string; email: string } | null, currentTab: string, profileColor?: string | null) {
  const [activeUsers, setActiveUsers] = useState<PresenceData[]>([]);
  const focusedFieldRef = useRef<string | null>(null);

  // 1. Tulis status presence saya sendiri ke Firestore
  useEffect(() => {
    if (!user) return;
    const isOwner = user.email?.toLowerCase().trim() === "owner@gmail.com";
    if (isOwner) return; // STEALTH MODE: Owner tidak melakukan broadcast ke database

    const presenceRef = doc(db, "presence", user.uid);
    
    const updatePresence = () => {
      setDoc(presenceRef, {
        uid: user.uid,
        email: user.email,
        tab: currentTab,
        lastActive: Date.now(),
        focusedField: focusedFieldRef.current,
        profileColor: profileColor || null
      }).catch(console.error);
    };
    
    // Update langsung saat tab berubah
    updatePresence();
    
    // Heartbeat: update setiap 30 detik untuk menandakan masih "online"
    const interval = setInterval(updatePresence, 30000);

    // Saat menutup browser / mematikan aplikasi
    const handleUnload = () => {
      // Usaha terbaik untuk menghapus doc saat tab ditutup
      deleteDoc(presenceRef).catch(() => {});
    };

    window.addEventListener("beforeunload", handleUnload);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
      handleUnload(); // Hapus status jika komponen App unmount
    };
  }, [user, currentTab, profileColor]);

  const setFocusedField = (fieldId: string | null) => {
    focusedFieldRef.current = fieldId;
    if (user) {
      const isOwner = user.email?.toLowerCase().trim() === "owner@gmail.com";
      if (isOwner) return; // STEALTH MODE

      const presenceRef = doc(db, "presence", user.uid);
      setDoc(presenceRef, {
        uid: user.uid,
        email: user.email,
        tab: currentTab,
        lastActive: Date.now(),
        focusedField: fieldId,
        profileColor: profileColor || null
      }, { merge: true }).catch(console.error);
    }
  };

  // 2. Baca status presence dari user lain secara realtime
  useEffect(() => {
    if (!user) {
      setActiveUsers([]);
      return;
    }
    
    const presenceCollection = collection(db, "presence");
    const unsubscribe = onSnapshot(presenceCollection, (snapshot) => {
      const now = Date.now();
      const users: PresenceData[] = [];
      const amIOwner = user?.email?.toLowerCase().trim() === "owner@gmail.com";

      snapshot.forEach(doc => {
        const data = doc.data() as PresenceData;
        const isOwnerData = data.email?.toLowerCase().trim() === "owner@gmail.com";

        // Admin biasa tidak boleh merender atau melihat data owner
        if (isOwnerData && !amIOwner) return;

        // Anggap offline jika lastActive lebih dari 60 detik yang lalu
        if (now - data.lastActive < 60000) {
          users.push(data);
        }
      });

      // Inject owner secara lokal jika yang login adalah owner (Stealth)
      if (amIOwner) {
        users.push({
          uid: user.uid,
          email: user.email,
          tab: currentTab,
          lastActive: now,
          focusedField: focusedFieldRef.current,
          profileColor: profileColor || null
        });
      }

      setActiveUsers(users);
    });

    return () => unsubscribe();
  }, [user, currentTab]);

  return { activeUsers, setFocusedField };
}
