import { doc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "./firebase";

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

export interface CatalogItem {
  price: number;
  name: string;
}

export interface SavedCatalogState {
  products: Record<string, CatalogItem>;
  games: Record<string, CatalogItem>;
}

export async function checkCatalogBaselineAndLogUpdates(
  currentProducts: any[],
  currentGames: any[],
  baseline: SavedCatalogState | null
) {
  // If baseline is not loaded yet (undefined), do nothing
  if (baseline === undefined) return;

  // If baseline is null, initialize it with current products/games
  if (baseline === null) {
    const initialBaseline: SavedCatalogState = { products: {}, games: {} };
    currentProducts.forEach(p => {
      initialBaseline.products[p.id] = { price: p.price, name: p.name || "" };
    });
    currentGames.forEach(g => {
      initialBaseline.games[g.id] = { price: g.price, name: g.name || "" };
    });
    await setDoc(doc(db, "data", "pos_baseline"), initialBaseline).catch(console.error);
    return;
  }

  const newUpdates: Record<string, { type: "baru" | "update harga" | "update", timestamp: string }> = {};
  let baselineChanged = false;
  const updatedBaselineProducts = { ...baseline.products };
  const updatedBaselineGames = { ...baseline.games };

  // 1. Check products
  currentProducts.forEach(p => {
    const savedP = updatedBaselineProducts[p.id];
    if (!savedP) {
      newUpdates[p.id] = { type: "baru", timestamp: new Date().toISOString() };
      updatedBaselineProducts[p.id] = { price: p.price, name: p.name || "" };
      baselineChanged = true;
    } else if (savedP.price !== p.price || savedP.name !== p.name) {
      const type = savedP.price !== p.price ? "update harga" : "update";
      newUpdates[p.id] = { type, timestamp: new Date().toISOString() };
      updatedBaselineProducts[p.id] = { price: p.price, name: p.name || "" };
      baselineChanged = true;
    }
  });

  // 2. Check games
  currentGames.forEach(g => {
    const savedG = updatedBaselineGames[g.id];
    if (!savedG) {
      newUpdates[g.id] = { type: "baru", timestamp: new Date().toISOString() };
      updatedBaselineGames[g.id] = { price: g.price, name: g.name || "" };
      baselineChanged = true;
    } else if (savedG.price !== g.price || savedG.name !== g.name) {
      const type = savedG.price !== g.price ? "update harga" : "update";
      newUpdates[g.id] = { type, timestamp: new Date().toISOString() };
      updatedBaselineGames[g.id] = { price: g.price, name: g.name || "" };
      baselineChanged = true;
    }
  });

  // 3. Clean up deleted products
  const currentProductIds = new Set(currentProducts.map(p => p.id));
  const updatesToDelete: Record<string, any> = {};

  Object.keys(updatedBaselineProducts).forEach(id => {
    if (!currentProductIds.has(id)) {
      delete updatedBaselineProducts[id];
      updatesToDelete[`updates.${id}`] = deleteField();
      baselineChanged = true;
    }
  });

  // 4. Clean up deleted games
  const currentGameIds = new Set(currentGames.map(g => g.id));
  Object.keys(updatedBaselineGames).forEach(id => {
    if (!currentGameIds.has(id)) {
      delete updatedBaselineGames[id];
      updatesToDelete[`updates.${id}`] = deleteField();
      baselineChanged = true;
    }
  });

  if (baselineChanged) {
    await setDoc(doc(db, "data", "pos_baseline"), {
      products: updatedBaselineProducts,
      games: updatedBaselineGames
    }).catch(console.error);
  }

  if (Object.keys(newUpdates).length > 0) {
    const updatesPayload: Record<string, any> = {};
    Object.entries(newUpdates).forEach(([id, val]) => {
      updatesPayload[`updates.${id}`] = val;
    });
    await updateDoc(doc(db, "data", "pos_updates"), updatesPayload).catch(async (err) => {
      if (err.code === "not-found") {
        await setDoc(doc(db, "data", "pos_updates"), { updates: newUpdates });
      } else {
        console.error("Error updating pos_updates:", err);
      }
    });
  }

  if (Object.keys(updatesToDelete).length > 0) {
    await updateDoc(doc(db, "data", "pos_updates"), updatesToDelete).catch(() => {});
    await setDoc(doc(db, "data", "pos_updates"), updatesToDelete, { merge: true }).catch(() => {});
  }
}

export function isVersionLower(v1: string, v2: string): boolean {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 < num2) return true;
    if (num1 > num2) return false;
  }
  return false;
}
