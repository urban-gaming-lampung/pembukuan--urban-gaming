import { useState, useEffect, useRef, useSyncExternalStore, useCallback } from "react";

export type StokKategori = {
  kategori: string;
  items: string[];
};

export const INITIAL_STOK_RENTAL: StokKategori[] = [
  {
    kategori: "UPDATE STOK KEBUTUHAN",
    items: ["Telur", "Mie Instan", "Gula", "Galon"],
  },
  {
    kategori: "UPDATE JAJANAN",
    items: [
      "Luwak White Coffe",
      "Good Day",
      "Fresco kopi susu",
      "Top coffee",
      "Pop Mie",
      "Marimas",
      "Teh jus",
      "Nutrisari",
      "Kripik",
    ],
  },
  {
    kategori: "UPDATE STIK - STIK PS3",
    items: ["bagus", "rusak"],
  },
  {
    kategori: "UPDATE STIK - STIK PS3 ORI MESIN",
    items: ["Bagus", "Rusak"],
  },
  {
    kategori: "UPDATE STIK - STIK PS4",
    items: ["Bagus", "rusak"],
  },
  {
    kategori: "UPDATE STIK - STIK PS4 ORI MESIN",
    items: ["Bagus", "rusak"],
  },
  {
    kategori: "UPDATE KONSOL - PLAYSTATION 3",
    items: ["Bagus", "Rusak"],
  },
  {
    kategori: "UPDATE KONSOL - PLAYSTATION 4",
    items: ["Bagus", "Rusak"],
  },
  {
    kategori: "UPDATE DEVICE - TV MONITOR",
    items: ["Bagus", "Rusak"],
  },
  {
    kategori: "UPDATE DEVICE - PLAYBOX / PORTABEL",
    items: ["Bagus", "Rusak"],
  },
];

export const INITIAL_STOK_JUALAN: StokKategori[] = [
  {
    kategori: "UNIT KONSOL BARU",
    items: [
      "PS3 SLIM 320GB",
      "PS3 SLIM 500GB",
      "PS4 FAT 500GB",
      "PS4 FAT 1TB",
      "PS4 SLIM 500GB",
      "PS4 SLIM 1TB",
      "PS4 PRO 500GB",
      "PS4 PRO 1TB",
      "PS5 FAT 1TB",
      "PS5 SLIM 1TB",
      "PS5 PRO 2TB",
    ],
  },
  {
    kategori: "UNIT KONSOL SEKEN",
    items: [
      "PS3 SLIM 320GB",
      "PS3 SLIM 500GB",
      "PS4 FAT 500GB",
      "PS4 FAT 1TB",
      "PS4 SLIM 500GB",
      "PS4 SLIM 1TB",
      "PS4 PRO 500GB",
      "PS4 PRO 1TB",
      "PS5 FAT 1TB",
      "PS5 SLIM 1TB",
      "PS5 PRO 2TB",
    ],
  },
  {
    kategori: "STIK PS3",
    items: ["Hitam", "Putih", "Merah", "Pink", "Gold", "Biru"],
  },
  {
    kategori: "STIK PS4",
    items: ["Hitam", "Merah", "Biru", "Putih", "Pink", "Gold"],
  },
  {
    kategori: "AKSESORIS",
    items: [
      "Kabel Charger PS3",
      "Kabel Charger PS4",
      "HDD Cover",
      "Port USB",
      "STB HEN 11",
      "LuckFox HEN 11",
      "HDMI Video Capture",
      "Kaset HEN",
      "HDD EKSTERNAL",
      "HDMI",
    ],
  },
];

export type StokItemValue = {
  jumlah: number;
  lastEditDate?: string;
  lastEditDelta?: number;
  lastEditBy?: string;
};

export type StokData = {
  rental: Record<string, Record<string, StokItemValue>>;
  jualan: Record<string, Record<string, StokItemValue>>;
};

export type MasterStokCategories = {
  rental: StokKategori[];
  jualan: StokKategori[];
};

const STOK_LS_KEY = "URBAN_STOK_DATA"; // Keep for migration if needed

import { doc, onSnapshot, setDoc, getDoc, updateDoc, collection } from "firebase/firestore";
import { db } from "../lib/firebase";

// ============================================================
// SINGLETON STORE — shared across all components using this hook
// Prevents race conditions from multiple onSnapshot listeners
// and multiple independent state copies writing to Firestore.
// ============================================================

type Listener = () => void;

type DeviceType = "ps3" | "ps4" | "stik_ps3" | "stik_ps4" | "tv" | "playbox";

interface RegisteredDevice {
  id: string;
  type: DeviceType;
  number: number;
  stikType: "OP" | "OM" | "";
  status: "baik" | "rusak";
}

let _stokState: StokData = { rental: {}, jualan: {} };
let _masterCategories: MasterStokCategories = { rental: INITIAL_STOK_RENTAL, jualan: INITIAL_STOK_JUALAN };
let _stokLoaded = false;
let _initialized = false;
let _unsubStok: (() => void) | null = null;
let _unsubMaster: (() => void) | null = null;
let _subscriberCount = 0;

let _devicesState: RegisteredDevice[] = [];
let _capacitiesState: Record<string, number> = {
  ps3: 0,
  ps4: 0,
  stik_ps3: 0,
  stik_ps4: 0,
  tv: 0,
  playbox: 0
};
let _devicesLoaded = false;
let _capacitiesLoaded = false;
let _unsubDevices: (() => void) | null = null;
let _unsubCapacities: (() => void) | null = null;

const _stokListeners = new Set<Listener>();
const _masterListeners = new Set<Listener>();

function notifyStokListeners() {
  _stokListeners.forEach(fn => fn());
}
function notifyMasterListeners() {
  _masterListeners.forEach(fn => fn());
}

function subscribeStok(listener: Listener) {
  _stokListeners.add(listener);
  return () => { _stokListeners.delete(listener); };
}
function subscribeMaster(listener: Listener) {
  _masterListeners.add(listener);
  return () => { _masterListeners.delete(listener); };
}
function getStokSnapshot() { return _stokState; }
function getMasterSnapshot() { return _masterCategories; }

function getItemKey(items: string[], type: "bagus" | "rusak") {
  return items.find(item => item.toLowerCase() === type) || (type === "bagus" ? "Bagus" : "Rusak");
}

function calculateIntegratedCounts(devices: RegisteredDevice[], capacities: Record<string, number>) {
  const counts: Record<string, { bagus: number; rusak: number }> = {
    "UPDATE STIK - STIK PS3": { bagus: 0, rusak: 0 },
    "UPDATE STIK - STIK PS3 ORI MESIN": { bagus: 0, rusak: 0 },
    "UPDATE STIK - STIK PS4": { bagus: 0, rusak: 0 },
    "UPDATE STIK - STIK PS4 ORI MESIN": { bagus: 0, rusak: 0 },
    "UPDATE KONSOL - PLAYSTATION 3": { bagus: 0, rusak: 0 },
    "UPDATE KONSOL - PLAYSTATION 4": { bagus: 0, rusak: 0 },
    "UPDATE DEVICE - TV MONITOR": { bagus: 0, rusak: 0 },
    "UPDATE DEVICE - PLAYBOX / PORTABEL": { bagus: 0, rusak: 0 }
  };

  // 1. stik_ps3 OP vs OM
  const capStikPs3 = capacities["stik_ps3"] || 0;
  const stikPs3Devices = devices.filter(d => d.type === "stik_ps3" && d.number <= capStikPs3);
  stikPs3Devices.forEach(d => {
    const isRusak = d.status === "rusak";
    if (d.stikType === "OP") {
      if (isRusak) counts["UPDATE STIK - STIK PS3"].rusak++;
      else counts["UPDATE STIK - STIK PS3"].bagus++;
    } else if (d.stikType === "OM") {
      if (isRusak) counts["UPDATE STIK - STIK PS3 ORI MESIN"].rusak++;
      else counts["UPDATE STIK - STIK PS3 ORI MESIN"].bagus++;
    }
  });

  // 2. stik_ps4 OP vs OM
  const capStikPs4 = capacities["stik_ps4"] || 0;
  const stikPs4Devices = devices.filter(d => d.type === "stik_ps4" && d.number <= capStikPs4);
  stikPs4Devices.forEach(d => {
    const isRusak = d.status === "rusak";
    if (d.stikType === "OP") {
      if (isRusak) counts["UPDATE STIK - STIK PS4"].rusak++;
      else counts["UPDATE STIK - STIK PS4"].bagus++;
    } else if (d.stikType === "OM") {
      if (isRusak) counts["UPDATE STIK - STIK PS4 ORI MESIN"].rusak++;
      else counts["UPDATE STIK - STIK PS4 ORI MESIN"].bagus++;
    }
  });

  // Helper for direct devices (ps3, ps4, tv, playbox)
  const computeDirectStats = (type: string, categoryKey: string) => {
    const capacity = capacities[type] || 0;
    const typeDevices = devices.filter(d => d.type === type && d.number <= capacity);
    const rusakCount = typeDevices.filter(d => d.status === "rusak").length;
    const bagusCount = Math.max(0, capacity - rusakCount);
    counts[categoryKey] = { bagus: bagusCount, rusak: rusakCount };
  };

  computeDirectStats("ps3", "UPDATE KONSOL - PLAYSTATION 3");
  computeDirectStats("ps4", "UPDATE KONSOL - PLAYSTATION 4");
  computeDirectStats("tv", "UPDATE DEVICE - TV MONITOR");
  computeDirectStats("playbox", "UPDATE DEVICE - PLAYBOX / PORTABEL");

  return counts;
}

function checkAndSyncIntegratedCounts() {
  if (!_stokLoaded || !_devicesLoaded || !_capacitiesLoaded) return;

  const computedCounts = calculateIntegratedCounts(_devicesState, _capacitiesState);
  const docRef = doc(db, "data", "stok");
  const updates: Record<string, any> = {};
  let hasUpdates = false;

  Object.entries(computedCounts).forEach(([category, values]) => {
    const catObj = _masterCategories.rental.find(c => c.kategori.toUpperCase() === category.toUpperCase());
    if (!catObj) return;

    const bagusKey = getItemKey(catObj.items, "bagus");
    const rusakKey = getItemKey(catObj.items, "rusak");

    const currentBagusObj = _stokState.rental?.[category]?.[bagusKey];
    const currentRusakObj = _stokState.rental?.[category]?.[rusakKey];

    const currentBagus = currentBagusObj?.jumlah ?? -1;
    const currentRusak = currentRusakObj?.jumlah ?? -1;

    if (currentBagus !== values.bagus) {
      const delta = values.bagus - (currentBagus === -1 ? 0 : currentBagus);
      updates[`rental.${category}.${bagusKey}`] = {
        jumlah: values.bagus,
        lastEditDate: new Date().toLocaleString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }).replace(/\./g, ':'),
        lastEditDelta: delta,
        lastEditBy: "System (Monitoring)"
      };
      hasUpdates = true;
    }

    if (currentRusak !== values.rusak) {
      const delta = values.rusak - (currentRusak === -1 ? 0 : currentRusak);
      updates[`rental.${category}.${rusakKey}`] = {
        jumlah: values.rusak,
        lastEditDate: new Date().toLocaleString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }).replace(/\./g, ':'),
        lastEditDelta: delta,
        lastEditBy: "System (Monitoring)"
      };
      hasUpdates = true;
    }
  });

  if (hasUpdates) {
    updateDoc(docRef, updates).catch(err => {
      console.warn("[useStokData] Failed to update monitoring counts via updateDoc, trying setDoc merge:", err);
      const fallbackPayload: Record<string, any> = { rental: {} };
      Object.entries(computedCounts).forEach(([category, values]) => {
        const catObj = _masterCategories.rental.find(c => c.kategori.toUpperCase() === category.toUpperCase());
        if (!catObj) return;
        const bagusKey = getItemKey(catObj.items, "bagus");
        const rusakKey = getItemKey(catObj.items, "rusak");
        
        const currentBagus = _stokState.rental?.[category]?.[bagusKey]?.jumlah ?? 0;
        const currentRusak = _stokState.rental?.[category]?.[rusakKey]?.jumlah ?? 0;

        fallbackPayload.rental[category] = {
          ...(_stokState.rental?.[category] || {}),
          [bagusKey]: {
            jumlah: values.bagus,
            lastEditDate: new Date().toLocaleString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }).replace(/\./g, ':'),
            lastEditDelta: values.bagus - currentBagus,
            lastEditBy: "System (Monitoring)"
          },
          [rusakKey]: {
            jumlah: values.rusak,
            lastEditDate: new Date().toLocaleString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }).replace(/\./g, ':'),
            lastEditDelta: values.rusak - currentRusak,
            lastEditBy: "System (Monitoring)"
          }
        };
      });
      setDoc(docRef, fallbackPayload, { merge: true }).catch(console.error);
    });
  }
}

function initStokListeners() {
  if (_initialized) return;
  _initialized = true;

  const docRef = doc(db, "data", "stok");

  _unsubStok = onSnapshot(docRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as StokData;

      // Only migrate from localStorage if Firestore has truly empty data
      // AND we haven't loaded successfully before (prevents accidental overwrite)
      if (!_stokLoaded && Object.keys(data.rental || {}).length === 0 && Object.keys(data.jualan || {}).length === 0) {
        const raw = localStorage.getItem(STOK_LS_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Object.keys(parsed.rental || {}).length > 0 || Object.keys(parsed.jualan || {}).length > 0) {
              setDoc(docRef, parsed, { merge: true }).catch(console.error);
              return; // onSnapshot will fire again with the migrated data
            }
          } catch (e) {}
        }
      }

      _stokState = {
        rental: data.rental || {},
        jualan: data.jualan || {},
      };
      _stokLoaded = true;
      notifyStokListeners();
      checkAndSyncIntegratedCounts();
    } else {
      // Document doesn't exist — only create if we've never loaded before
      if (!_stokLoaded) {
        const raw = localStorage.getItem(STOK_LS_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Object.keys(parsed.rental || {}).length > 0 || Object.keys(parsed.jualan || {}).length > 0) {
              setDoc(docRef, parsed).catch(console.error);
              return;
            }
          } catch (e) {}
        }
        console.warn("[useStokData] stok doc does not exist. Creating empty shell.");
        setDoc(docRef, { rental: {}, jualan: {} }).catch(console.error);
      }
    }
  }, (err) => {
    console.error("Firestore onSnapshot error (stok):", err);
  });

  const masterDocRef = doc(db, "data", "master_stok_categories");
  _unsubMaster = onSnapshot(masterDocRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as MasterStokCategories;
      let modified = false;
      const existingCategories = (data.rental || []).map(c => c.kategori.toUpperCase());
      
      const newRentalCategories = [
        { kategori: "UPDATE KONSOL - PLAYSTATION 3", items: ["Bagus", "Rusak"] },
        { kategori: "UPDATE KONSOL - PLAYSTATION 4", items: ["Bagus", "Rusak"] },
        { kategori: "UPDATE DEVICE - TV MONITOR", items: ["Bagus", "Rusak"] },
        { kategori: "UPDATE DEVICE - PLAYBOX / PORTABEL", items: ["Bagus", "Rusak"] }
      ];

      newRentalCategories.forEach(newCat => {
        if (!existingCategories.includes(newCat.kategori.toUpperCase())) {
          if (!data.rental) data.rental = [];
          data.rental.push(newCat);
          modified = true;
        }
      });

      if (modified) {
        setDoc(masterDocRef, data).catch(console.error);
      }

      _masterCategories = data;
      notifyMasterListeners();
      checkAndSyncIntegratedCounts();
    } else {
      const initialMaster = { rental: INITIAL_STOK_RENTAL, jualan: INITIAL_STOK_JUALAN };
      setDoc(masterDocRef, initialMaster).catch(console.error);
      _masterCategories = initialMaster;
      notifyMasterListeners();
    }
  });

  // Listen to Registered Devices
  _unsubDevices = onSnapshot(collection(db, "monitoring_devices"), (snap) => {
    const list: RegisteredDevice[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as RegisteredDevice);
    });
    _devicesState = list;
    _devicesLoaded = true;
    checkAndSyncIntegratedCounts();
  }, (err) => {
    console.error("Firestore onSnapshot error (monitoring_devices):", err);
  });

  // Listen to Master Capacities
  _unsubCapacities = onSnapshot(doc(db, "data", "master_devices"), (snap) => {
    if (snap.exists()) {
      _capacitiesState = snap.data() as Record<string, number>;
    }
    _capacitiesLoaded = true;
    checkAndSyncIntegratedCounts();
  }, (err) => {
    console.error("Firestore onSnapshot error (master_devices):", err);
  });
}

function cleanupStokListeners() {
  if (_unsubStok) { _unsubStok(); _unsubStok = null; }
  if (_unsubMaster) { _unsubMaster(); _unsubMaster = null; }
  if (_unsubDevices) { _unsubDevices(); _unsubDevices = null; }
  if (_unsubCapacities) { _unsubCapacities(); _unsubCapacities = null; }
  _initialized = false;
  _stokLoaded = false;
  _devicesLoaded = false;
  _capacitiesLoaded = false;
}

// ============================================================
// updateStok — writes ONLY the specific item field path
// using updateDoc with dot-notation, preventing full-doc overwrites
// ============================================================
function updateStokItem(tipe: "rental" | "jualan", kategori: string, item: string, value: number, adminName?: string) {
  const oldItem = _stokState[tipe]?.[kategori]?.[item];
  const oldJumlah = oldItem?.jumlah || 0;

  const safeValue = Math.max(0, value);
  const delta = safeValue - oldJumlah;

  let nextItemValue: StokItemValue = { jumlah: safeValue };

  if (delta !== 0) {
    const tz = new Date().toLocaleString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit' }).replace(/\./g, ':');
    nextItemValue.lastEditDate = tz;
    nextItemValue.lastEditDelta = delta;
    nextItemValue.lastEditBy = adminName || "Admin";
  } else {
    nextItemValue.lastEditDate = oldItem?.lastEditDate;
    nextItemValue.lastEditDelta = oldItem?.lastEditDelta;
    nextItemValue.lastEditBy = oldItem?.lastEditBy;
  }

  // Update local state immediately for instant UI feedback
  _stokState = {
    ..._stokState,
    [tipe]: {
      ..._stokState[tipe],
      [kategori]: {
        ...(_stokState[tipe]?.[kategori] || {}),
        [item]: nextItemValue,
      },
    },
  };
  notifyStokListeners();

  // Write ONLY the specific item path to Firestore using dot-notation
  // This prevents overwriting unrelated categories/items
  const docRef = doc(db, "data", "stok");
  const fieldPath = `${tipe}.${kategori}.${item}`;

  updateDoc(docRef, { [fieldPath]: nextItemValue }).catch((err) => {
    // If doc doesn't exist yet, updateDoc fails — fallback to setDoc merge
    console.warn("[useStokData] updateDoc failed, falling back to setDoc merge:", err);
    setDoc(docRef, {
      [tipe]: {
        [kategori]: {
          [item]: nextItemValue,
        },
      },
    }, { merge: true }).catch(console.error);
  });
}

async function addStokItemToMaster(tipe: "rental" | "jualan", kategoriName: string, itemName: string): Promise<boolean> {
  try {
    const masterDocRef = doc(db, "data", "master_stok_categories");
    const snap = await getDoc(masterDocRef);
    let data: MasterStokCategories = { rental: INITIAL_STOK_RENTAL, jualan: INITIAL_STOK_JUALAN };
    if (snap.exists()) data = snap.data() as MasterStokCategories;

    const list = data[tipe] || [];
    const catIndex = list.findIndex(c => c.kategori.toLowerCase() === kategoriName.toLowerCase());

    if (catIndex >= 0) {
      if (!list[catIndex].items.includes(itemName)) {
        list[catIndex].items.push(itemName);
      } else {
        return false; // Item already exists
      }
    } else {
      list.push({ kategori: kategoriName.toUpperCase(), items: [itemName] });
    }

    data[tipe] = list;
    await setDoc(masterDocRef, data);
    return true;
  } catch (err) {
    console.error("Add stok item failed:", err);
    return false;
  }
}

// ============================================================
// React Hook — thin wrapper around the singleton
// ============================================================
export default function useStokData() {
  const stokState = useSyncExternalStore(subscribeStok, getStokSnapshot, getStokSnapshot);
  const masterCategories = useSyncExternalStore(subscribeMaster, getMasterSnapshot, getMasterSnapshot);

  useEffect(() => {
    _subscriberCount++;
    initStokListeners();
    return () => {
      _subscriberCount--;
      // Only cleanup if no more subscribers (all components unmounted)
      if (_subscriberCount <= 0) {
        _subscriberCount = 0;
        cleanupStokListeners();
      }
    };
  }, []);

  const updateStok = useCallback(
    (tipe: "rental" | "jualan", kategori: string, item: string, value: number, adminName?: string) => {
      updateStokItem(tipe, kategori, item, value, adminName);
    },
    []
  );

  const addStokItem = useCallback(
    async (tipe: "rental" | "jualan", kategoriName: string, itemName: string) => {
      return addStokItemToMaster(tipe, kategoriName, itemName);
    },
    []
  );

  return { stokState, updateStok, masterCategories, addStokItem };
}
