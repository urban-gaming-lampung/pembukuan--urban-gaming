import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  QueryConstraint,
  DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Creates or overwrites a document in a specified collection.
 * @param collName The name of the collection
 * @param docId The ID of the document to create. If empty, you should use `addDoc` instead (not provided here, assuming explicit IDs are used).
 * @param data The data payload
 */
export const createDocument = async <T extends DocumentData>(
  collName: string,
  docId: string,
  data: T
): Promise<void> => {
  try {
    const docRef = doc(db, collName, docId);
    await setDoc(docRef, data);
  } catch (error) {
    console.error(`Error creating document in ${collName}:`, error);
    throw error;
  }
};

/**
 * Reads a single document by its ID.
 * @param collName The collection name
 * @param docId The document ID
 * @returns The document data if it exists, otherwise null
 */
export const readDocument = async <T = DocumentData>(
  collName: string,
  docId: string
): Promise<T | null> => {
  try {
    const docRef = doc(db, collName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error) {
    console.error(`Error reading document in ${collName}:`, error);
    throw error;
  }
};

/**
 * Updates specific fields of a document without overwriting the entire document.
 * @param collName The collection name
 * @param docId The document ID
 * @param data The partial data payload to update
 */
export const updateDocument = async <T extends DocumentData>(
  collName: string,
  docId: string,
  data: Partial<T>
): Promise<void> => {
  try {
    const docRef = doc(db, collName, docId);
    // TypeScript needs this cast because updateDoc expects UpdateData
    await updateDoc(docRef, data as any);
  } catch (error) {
    console.error(`Error updating document in ${collName}:`, error);
    throw error;
  }
};

/**
 * Deletes a document by its ID.
 * @param collName The collection name
 * @param docId The document ID
 */
export const deleteDocument = async (
  collName: string,
  docId: string
): Promise<void> => {
  try {
    const docRef = doc(db, collName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting document in ${collName}:`, error);
    throw error;
  }
};

/**
 * Reads all documents from a collection, optionally filtered by constraints.
 * @param collName The collection name
 * @param constraints Optional query constraints (e.g. where, orderBy, limit)
 * @returns An array of document data
 */
export const readCollection = async <T = DocumentData>(
  collName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> => {
  try {
    const collRef = collection(db, collName);
    const q = query(collRef, ...constraints);
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as T[];
  } catch (error) {
    console.error(`Error reading collection ${collName}:`, error);
    throw error;
  }
};
