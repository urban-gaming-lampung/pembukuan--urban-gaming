import { useState, useEffect, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export interface AdminNote {
  id: string;
  title: string;
  content: string;
  linkUrl?: string;
  linkLabel?: string;
  isPinned?: boolean;
  authorEmail?: string;
  authorName?: string;
  createdAt: string;
  updatedAt?: string;
}

const LOCAL_STORAGE_CACHE_KEY = "admin_notes_cache_v1";

export function useAdminNotes() {
  const [notes, setNotes] = useState<AdminNote[]>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn("Failed to parse cached admin notes:", e);
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const colRef = collection(db, "admin_notes");

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const loadedNotes: AdminNote[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            title: data.title || "",
            content: data.content || "",
            linkUrl: data.linkUrl || "",
            linkLabel: data.linkLabel || "",
            isPinned: Boolean(data.isPinned),
            authorEmail: data.authorEmail || "",
            authorName: data.authorName || "",
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || "",
          };
        });

        // Urutkan: Pinned di paling atas, kemudian berdasarkan createdAt paling baru
        loadedNotes.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return (
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
          );
        });

        setNotes(loadedNotes);
        setLoading(false);
        try {
          localStorage.setItem(
            LOCAL_STORAGE_CACHE_KEY,
            JSON.stringify(loadedNotes)
          );
        } catch (e) {
          console.warn("Failed to cache admin notes:", e);
        }
      },
      (err) => {
        console.error("Firestore onSnapshot error (admin_notes):", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addNote = useCallback(
    async (
      data: Omit<AdminNote, "id" | "createdAt" | "updatedAt">
    ): Promise<string> => {
      const colRef = collection(db, "admin_notes");
      const docRef = await addDoc(colRef, {
        title: data.title?.trim() || "",
        content: data.content?.trim() || "",
        linkUrl: data.linkUrl?.trim() || "",
        linkLabel: data.linkLabel?.trim() || "",
        isPinned: Boolean(data.isPinned),
        authorEmail: data.authorEmail || "",
        authorName: data.authorName || "Super Admin",
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    },
    []
  );

  const updateNote = useCallback(
    async (
      id: string,
      data: Partial<Omit<AdminNote, "id" | "createdAt">>
    ): Promise<void> => {
      const docRef = doc(db, "admin_notes", id);
      const cleanData: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };
      if (data.title !== undefined) cleanData.title = data.title.trim();
      if (data.content !== undefined) cleanData.content = data.content.trim();
      if (data.linkUrl !== undefined) cleanData.linkUrl = data.linkUrl.trim();
      if (data.linkLabel !== undefined)
        cleanData.linkLabel = data.linkLabel.trim();
      if (data.isPinned !== undefined) cleanData.isPinned = Boolean(data.isPinned);

      await updateDoc(docRef, cleanData);
    },
    []
  );

  const deleteNote = useCallback(async (id: string): Promise<void> => {
    const docRef = doc(db, "admin_notes", id);
    await deleteDoc(docRef);
  }, []);

  const togglePin = useCallback(
    async (id: string, currentPin?: boolean): Promise<void> => {
      const docRef = doc(db, "admin_notes", id);
      await updateDoc(docRef, {
        isPinned: !currentPin,
        updatedAt: new Date().toISOString(),
      });
    },
    []
  );

  return {
    notes,
    loading,
    error,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
  };
}
