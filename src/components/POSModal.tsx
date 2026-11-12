import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, ShoppingCart, Plus, Minus, Trash2, PlusCircle, Sparkles, Pencil, Search, Receipt } from "lucide-react";
import { collection, onSnapshot, query, addDoc, serverTimestamp, doc, setDoc, deleteDoc, deleteField } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, listGameDb } from "../lib/firebase";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import useStokData from "../hooks/useStokData";
import type { StokItemValue } from "../hooks/useStokData";
import PosCheckoutSheet from "./PosCheckoutSheet";
import { StokRefSelect } from "./StokRefSelect";
import { hapusStokOtomatisBilaYatim, Kondisi, kondisiProduk, PILIH_SAAT_CHECKOUT, StokRef, stokBaruUntukProduk } from "../lib/posSales";
import KondisiSwitch from "./KondisiSwitch";
import { getMinStok, renameJualanItem, statusOf, useMinStok } from "../lib/stokJualan";

const qrisImg = new URL("/images/QRIS.jpeg", import.meta.url).href;

interface Product {
  id: string;
  name: string;
  price: number;
  category: "JUALAN" | "RENTAL" | "SERVIS" | "ISI GAME";
  imageUrl: string;
  createdAt?: any;
  platform?: string;
  size?: string;
  available?: boolean;
  subcategory?: "Unit PS" | "Stik" | "Hardisk" | "Aksesoris" | "BD";
  stokRef?: StokRef | null; // barang stok jualan yang dipotong saat nota dibuat (undefined = belum disinkron)
  stokAuto?: boolean; // barang stok dibuat otomatis khusus untuk produk ini
  kondisi?: Kondisi | null; // JUALAN: BARU / SEKEN
}

interface CartItem extends Product {
  quantity: number;
}

interface POSModalProps {
  open: boolean;
  onClose: () => void;
  isSuperAdminOrOwner: boolean;
  adminName: string;
  catalogChanges?: Record<string, "baru" | "update harga" | "update">;
  onClearProductChange?: (id: string) => void;
}

const DEFAULT_PRODUCTS: Omit<Product, "id">[] = [
  // JUALAN
  { name: "Stik PS3 Baru - Hitam Tanpa Box", price: 60000, category: "JUALAN", imageUrl: "" },
  { name: "Stik PS3 Baru - Hitam Dengan Box", price: 65000, category: "JUALAN", imageUrl: "" },
  { name: "Stik PS3 Baru - Putih Dengan Box", price: 70000, category: "JUALAN", imageUrl: "" },
  { name: "Stik PS3 Baru - Biru Dengan Box", price: 70000, category: "JUALAN", imageUrl: "" },
  { name: "Stik PS3 Baru - Merah Dengan Box", price: 70000, category: "JUALAN", imageUrl: "" },
  { name: "Stik PS3 Baru - Pink Dengan Box", price: 70000, category: "JUALAN", imageUrl: "" },
  { name: "Stik PS3 Baru - Gold Dengan Box", price: 75000, category: "JUALAN", imageUrl: "" },
  { name: "Stik PS4 Baru - Semua Warna + Box", price: 140000, category: "JUALAN", imageUrl: "" },
  { name: "Stik PS4 Baru - Semua Warna Tanpa Box", price: 130000, category: "JUALAN", imageUrl: "" },
  { name: "PS3 Slim 320GB", price: 2050000, category: "JUALAN", imageUrl: "" },
  { name: "PS3 Slim Limited Edition 160GB", price: 2050000, category: "JUALAN", imageUrl: "" },
  { name: "PS4 Fat HEN 500 GB – 2 Stik", price: 3050000, category: "JUALAN", imageUrl: "" },
  { name: "PS4 Fat HEN 1TB – 2 Stik", price: 3550000, category: "JUALAN", imageUrl: "" },
  { name: "PS4 Slim HEN 500 GB – 2 Stik", price: 3650000, category: "JUALAN", imageUrl: "" },
  { name: "PS4 Slim HEN 1 TB – 2 Stik", price: 4050000, category: "JUALAN", imageUrl: "" },
  { name: "PS4 Pro HEN 1 TB – 2 Stik", price: 4450000, category: "JUALAN", imageUrl: "" },
  { name: "PS4 Fat 500GB Original - 2 Stik (Seken)", price: 2150000, category: "JUALAN", imageUrl: "" },
  { name: "PS4 Pro 1TB HEN - 2 Stik (Seken)", price: 3750000, category: "JUALAN", imageUrl: "" },
  { name: "PS5 Slim Disc (Baru)", price: 10450000, category: "JUALAN", imageUrl: "" },
  { name: "PS5 Slim Digital (Baru)", price: 8950000, category: "JUALAN", imageUrl: "" },
  { name: "Kabel Charger PS3", price: 20000, category: "JUALAN", imageUrl: "" },
  { name: "Kabel Charger PS4", price: 20000, category: "JUALAN", imageUrl: "" },
  { name: "HDD Cover", price: 60000, category: "JUALAN", imageUrl: "" },
  { name: "Kaset HEN VDJB", price: 100000, category: "JUALAN", imageUrl: "" },
  { name: "LuckFox HEN 11", price: 100000, category: "JUALAN", imageUrl: "" },
  { name: "HDD External Full Game 500GB", price: 450000, category: "JUALAN", imageUrl: "" },
  { name: "HDD External 1TB", price: 700000, category: "JUALAN", imageUrl: "" },
  { name: "HDMI", price: 50000, category: "JUALAN", imageUrl: "" },
  { name: "Kabel Power Premium", price: 20000, category: "JUALAN", imageUrl: "" },
  { name: "Kaset PS4 - The Sims 4", price: 50000, category: "JUALAN", imageUrl: "" },
  { name: "Kaset PS4 - Days Gone", price: 150000, category: "JUALAN", imageUrl: "" },
  { name: "Downgrade PS4 HEN", price: 500000, category: "JUALAN", imageUrl: "" },
  
  // RENTAL
  { name: "Sewa PS3 + TV / Jam", price: 5000, category: "RENTAL", imageUrl: "" },
  { name: "Sewa PS4 + TV / Jam", price: 8000, category: "RENTAL", imageUrl: "" },
  { name: "Sewa PS5 + TV / Jam", price: 15000, category: "RENTAL", imageUrl: "" },
  { name: "Paket Main 3 Jam PS4", price: 20000, category: "RENTAL", imageUrl: "" },
  
  // SERVIS
  { name: "Jasa Servis Stik PS3 (Tombol/Analog)", price: 30000, category: "SERVIS", imageUrl: "" },
  { name: "Jasa Servis Stik PS4 (Drift/R2/L2)", price: 45000, category: "SERVIS", imageUrl: "" },
  { name: "Jasa Reflash HEN PS3", price: 50000, category: "SERVIS", imageUrl: "" },
  { name: "Jasa Reflash GoldHEN PS4", price: 75000, category: "SERVIS", imageUrl: "" },
  { name: "Jasa Downgrade Konsol PS3", price: 100000, category: "SERVIS", imageUrl: "" }
];

import { calculatePOSDiscount, PromosConfig, DEFAULT_PROMOS_CONFIG } from "../utils/promoDiscount";

function getProductSubCategory(name: string): "Unit PS" | "Stik" | "Hardisk" | "Aksesoris" | "BD" {
  const lower = name.toLowerCase();
  
  if (lower.startsWith("bd ") || lower.includes(" bd ") || lower.includes("kaset") || lower.includes("blu-ray") || lower.startsWith("kaset bd")) {
    return "BD";
  }
  
  if (lower.includes("hdd") || lower.includes("hardisk") || lower.includes("hard disk") || lower.includes("external")) {
    return "Hardisk";
  }
  
  if (
    (lower.startsWith("ps3") || lower.startsWith("ps4") || lower.startsWith("ps5") || lower.startsWith("playstation") || lower.startsWith("konsol")) &&
    !lower.includes("kabel") && !lower.includes("charger") && !lower.includes("kaset") && !lower.includes("servis")
  ) {
    return "Unit PS";
  }
  
  if (lower.includes("stik") || lower.includes("controller")) {
    return "Stik";
  }
  
  return "Aksesoris";
}

function getSubCategory(p: Product): "Unit PS" | "Stik" | "Hardisk" | "Aksesoris" | "BD" {
  return p.subcategory || getProductSubCategory(p.name);
}

const isGameUnavailable = (name: string) => /^\s*\//.test(name || "");
const getGameDisplayName = (name: string) => (name || "").replace(/^\s*\//, "").trim();

export default function POSModal({ open, onClose, isSuperAdminOrOwner, adminName, catalogChanges = {}, onClearProductChange }: POSModalProps) {
  const [activeSub, setActiveSub] = useState<"JUALAN" | "RENTAL" | "SERVIS" | "ISI GAME">("JUALAN");
  const [activeJualanSub, setActiveJualanSub] = useState<"Unit PS" | "Stik" | "Hardisk" | "Aksesoris" | "BD">("Unit PS");
  const [activeKondisi, setActiveKondisi] = useState<Kondisi>("BARU");
  const jualanSubCount = (k: Kondisi, sub: string) => products.filter((p) => p.category === "JUALAN" && kondisiProduk(p) === k && getSubCategory(p) === sub).length;
  const [activeIsiGameSub, setActiveIsiGameSub] = useState<"PS3 CFW/HEN" | "PS4 HEN" | "PS5 HEN" | "Switch CFW" | "PC">("PS4 HEN");
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [games, setGames] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    setActiveJualanSub("Unit PS");
    setActiveIsiGameSub("PS4 HEN");
    setSearchQuery("");
  }, [activeSub]);
  
  // Halaman Baru / Seken: bila sub-kategori aktif kosong, pindah ke yang ada isinya
  useEffect(() => {
    if (activeSub !== "JUALAN" || products.length === 0 || jualanSubCount(activeKondisi, activeJualanSub) > 0) return;
    const ada = (["Unit PS", "Stik", "Hardisk", "Aksesoris", "BD"] as const).find((s) => jualanSubCount(activeKondisi, s) > 0);
    if (ada) setActiveJualanSub(ada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKondisi, activeSub, products]);

  // Form states for adding product
  const [openAddProduct, setOpenAddProduct] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdPrice, setNewProdPrice] = useState<number | "">("");
  const [newProdCategory, setNewProdCategory] = useState<"JUALAN" | "RENTAL" | "SERVIS">("RENTAL");
  const [newProdSubCategory, setNewProdSubCategory] = useState<"Unit PS" | "Stik" | "Hardisk" | "Aksesoris" | "BD">("Aksesoris");
  const [newProdImage, setNewProdImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form states for editing product
  const [openEditProduct, setOpenEditProduct] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [editProdName, setEditProdName] = useState("");
  const [editProdPrice, setEditProdPrice] = useState<number | "">("");
  const [editProdCategory, setEditProdCategory] = useState<"JUALAN" | "RENTAL" | "SERVIS">("RENTAL");
  const [editProdSubCategory, setEditProdSubCategory] = useState<"Unit PS" | "Stik" | "Hardisk" | "Aksesoris" | "BD">("Aksesoris");
  const [editProdImage, setEditProdImage] = useState<File | null>(null);
  const [editProdImageUrl, setEditProdImageUrl] = useState("");

  // Autofill subcategory when name changes in Add Product Form
  useEffect(() => {
    const lower = newProdName.toLowerCase();
    if (lower.startsWith("bd ") || lower.includes(" bd ") || lower.includes("kaset") || lower.includes("blu-ray") || lower.startsWith("kaset bd")) {
      if (newProdCategory === "JUALAN") setNewProdSubCategory("BD");
    } else if (newProdCategory === "JUALAN") {
      setNewProdSubCategory(getProductSubCategory(newProdName));
    }
  }, [newProdName, newProdCategory]);

  // Autofill subcategory when name changes in Edit Product Form
  useEffect(() => {
    const lower = editProdName.toLowerCase();
    if (lower.startsWith("bd ") || lower.includes(" bd ") || lower.includes("kaset") || lower.includes("blu-ray") || lower.startsWith("kaset bd")) {
      if (editProdCategory === "JUALAN") setEditProdSubCategory("BD");
    } else if (editProdCategory === "JUALAN") {
      setEditProdSubCategory(getProductSubCategory(editProdName));
    }
  }, [editProdName, editProdCategory]);

  // Cart Popup state for mobile view
  const [openMobileCart, setOpenMobileCart] = useState(false);

  // Checkout (nota + potong stok) & hubungkan produk ke stok
  const [openCheckout, setOpenCheckout] = useState(false);
  // undefined = Otomatis (sistem hubungkan / buat barang stok)
  const [newProdStokRef, setNewProdStokRef] = useState<StokRef | null | undefined>(undefined);
  const [editProdStokRef, setEditProdStokRef] = useState<StokRef | null | undefined>(undefined);
  const { stokState, masterCategories } = useStokData();
  const minStokMap = useMinStok();
  const stokCats = Array.isArray(masterCategories?.jualan) ? masterCategories.jualan : [];
  const stokData = (stokState?.jualan || {}) as Record<string, Record<string, StokItemValue>>;

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [showQrisModal, setShowQrisModal] = useState(false);

  // Lock body scroll on active modals/popups
  useBodyScrollLock(open);
  useBodyScrollLock(openAddProduct);
  useBodyScrollLock(openEditProduct);
  useBodyScrollLock(openMobileCart);
  useBodyScrollLock(showQrisModal);

  // Real-time Firestore sync for products
  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Product[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Product);
      });
      setProducts(list);
    }, (err) => {
      console.error("Firestore onSnapshot error (products):", err);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore sync for games (from secondary database list-game-digital)
  useEffect(() => {
    const q = query(collection(listGameDb, "games"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Product[] = [];
      snap.forEach((docSnap) => {
        if (docSnap.id.startsWith('_')) return; // Filter dokumen sistem seperti _metadata_ dan _promos_
        const data = docSnap.data();
        const originalName = data.name || "";
        list.push({
          id: docSnap.id,
          name: getGameDisplayName(originalName),
          price: data.price || 0,
          category: "ISI GAME",
          imageUrl: data.cover || "",
          platform: data.platform || "",
          size: data.size || "",
          available: true,
        });
      });
      setGames(list);
    }, (err) => {
      console.error("Firestore onSnapshot error (games):", err);
    });
    return () => unsub();
  }, []);

  const [promosConfig, setPromosConfig] = useState<PromosConfig>(DEFAULT_PROMOS_CONFIG);

  // Real-time Firestore sync for promos (Single Source of Truth from list-game-digital)
  useEffect(() => {
    const promoDocRef = doc(listGameDb, "games", "_promos_");
    const unsub = onSnapshot(
      promoDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as PromosConfig;
          setPromosConfig({
            enabled: data.enabled ?? true,
            targetPlatforms: data.targetPlatforms || DEFAULT_PROMOS_CONFIG.targetPlatforms,
            rules: Array.isArray(data.rules) && data.rules.length > 0 ? data.rules : DEFAULT_PROMOS_CONFIG.rules,
            updatedAt: data.updatedAt,
          });
        } else {
          setPromosConfig(DEFAULT_PROMOS_CONFIG);
        }
      },
      (err) => {
        console.warn("Firestore onSnapshot error (promos from listGameDb):", err);
        setPromosConfig(DEFAULT_PROMOS_CONFIG);
      }
    );
    return () => unsub();
  }, []);

  // Total price & discount calculator (SSOT)
  const {
    subtotal,
    discountPercent,
    discountAmount,
    total,
    qualifyingCount,
    activeRule,
    nextRule,
    gamesNeededForNext,
  } = useMemo(() => {
    return calculatePOSDiscount(cart, promosConfig);
  }, [cart, promosConfig]);

  // Sinkronkan harga/nama item keranjang dengan katalog terbaru (realtime)
  useEffect(() => {
    setCart((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const src = (item.category === "ISI GAME" ? games : products).find((p) => p.id === item.id);
        if (src && (src.price !== item.price || src.name !== item.name || JSON.stringify(src.stokRef || null) !== JSON.stringify(item.stokRef || null))) {
          changed = true;
          return { ...item, price: src.price, name: src.name, stokRef: src.stokRef || null };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [products, games]);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.id === product.id);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.id === productId);
      if (idx >= 0) {
        const item = prev[idx];
        if (item.quantity > 1) {
          return prev.map((item, i) =>
            i === idx ? { ...item, quantity: item.quantity - 1 } : item
          );
        }
        return prev.filter((item, i) => i !== idx);
      }
      return prev;
    });
  };

  const removeAllFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Add Product action handler
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || newProdPrice === "" || newProdPrice < 0) {
      alert("Masukkan nama produk dan harga yang valid!");
      return;
    }
    
    setIsUploading(true);
    try {
      let downloadURL = "";
      if (newProdImage) {
        if (!newProdImage.type.startsWith("image/")) {
          alert("File harus bertipe gambar (PNG/JPEG)!");
          setIsUploading(false);
          return;
        }
        if (newProdImage.size > 2 * 1024 * 1024) {
          alert("Ukuran file maksimal 2MB!");
          setIsUploading(false);
          return;
        }
        const fileRef = ref(storage, `products/${Date.now()}_${newProdImage.name}`);
        const uploadResult = await uploadBytes(fileRef, newProdImage);
        downloadURL = await getDownloadURL(uploadResult.ref);
      }

      const productPayload: any = {
        name: newProdName.trim(),
        price: Number(newProdPrice),
        category: newProdCategory,
        imageUrl: downloadURL,
        createdAt: serverTimestamp()
      };
      if (newProdCategory === "JUALAN") {
        productPayload.subcategory = newProdSubCategory;
      }
      // Otomatis (undefined): field dibiarkan kosong -> langsung disinkron ke stok oleh sistem
      if ((newProdCategory === "JUALAN" || newProdCategory === "SERVIS") && newProdStokRef !== undefined) {
        productPayload.stokRef = newProdStokRef;
        productPayload.stokAuto = false;
      }

      await addDoc(collection(db, "products"), productPayload);

      // Reset form
      setNewProdName("");
      setNewProdPrice("");
      setNewProdSubCategory("Aksesoris");
      setNewProdStokRef(undefined);
      setNewProdImage(null);
      setOpenAddProduct(false);
      alert("Produk berhasil ditambahkan!");
    } catch (err: any) {
      console.error("Failed to add product:", err);
      alert("Gagal menambahkan produk: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleEditClick = (p: Product) => {
    setSelectedProductForEdit(p);
    setEditProdName(p.name);
    setEditProdPrice(p.price);
    setEditProdCategory(p.category as any);
    setEditProdSubCategory(p.subcategory || getProductSubCategory(p.name));
    setEditProdImageUrl(p.imageUrl || "");
    setEditProdStokRef(p.stokRef === undefined ? undefined : p.stokRef);
    setEditProdImage(null);
    setOpenEditProduct(true);
  };

  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForEdit) return;
    if (!editProdName.trim() || editProdPrice === "" || editProdPrice < 0) {
      alert("Masukkan nama produk dan harga yang valid!");
      return;
    }

    setIsUploading(true);
    try {
      let downloadURL = editProdImageUrl;
      if (editProdImage) {
        if (!editProdImage.type.startsWith("image/")) {
          alert("File harus bertipe gambar (PNG/JPEG)!");
          setIsUploading(false);
          return;
        }
        if (editProdImage.size > 2 * 1024 * 1024) {
          alert("Ukuran file maksimal 2MB!");
          setIsUploading(false);
          return;
        }
        const fileRef = ref(storage, `products/${Date.now()}_${editProdImage.name}`);
        const uploadResult = await uploadBytes(fileRef, editProdImage);
        downloadURL = await getDownloadURL(uploadResult.ref);
      }

      const docRef = doc(db, "products", selectedProductForEdit.id);
      const updateData: any = {
        name: editProdName.trim(),
        price: Number(editProdPrice),
        category: editProdCategory,
        imageUrl: downloadURL
      };
      if (editProdCategory === "JUALAN") {
        updateData.subcategory = editProdSubCategory;
      } else {
        updateData.subcategory = null;
      }
      // --- Sinkron produk <-> stok ---
      const prod = selectedProductForEdit;
      const namaBaru = editProdName.trim();
      let bersihkan: StokRef | null = null;
      if (editProdCategory !== "JUALAN" && editProdCategory !== "SERVIS") {
        updateData.stokRef = null;
        updateData.stokAuto = false;
        if (prod.stokAuto && prod.stokRef) bersihkan = prod.stokRef;
      } else if (editProdStokRef === undefined) {
        // Otomatis: kosongkan supaya sistem menghubungkan / membuat ulang barang stok
        updateData.stokRef = deleteField();
        updateData.stokAuto = deleteField();
      } else {
        let ref = editProdStokRef;
        const tetap = JSON.stringify(ref ?? null) === JSON.stringify(prod.stokRef ?? null);
        // Barang stok yang dibuat otomatis untuk produk ini ikut ganti nama
        if (tetap && ref && prod.stokAuto && namaBaru !== prod.name) {
          const dipakaiLain = products.some((x) => x.id !== prod.id && x.stokRef?.kategori === ref!.kategori && x.stokRef?.item === ref!.item);
          if (!dipakaiLain) {
            const target = stokBaruUntukProduk({ name: namaBaru, subcategory: editProdCategory === "JUALAN" ? editProdSubCategory : null });
            try {
              const renamed = await renameJualanItem(ref.kategori, ref.item, target.item);
              if (renamed) ref = { kategori: ref.kategori, item: renamed };
            } catch (err: any) {
              console.warn("Ganti nama barang stok gagal:", err);
            }
          }
        }
        updateData.stokRef = ref;
        updateData.stokAuto = tetap ? !!prod.stokAuto : false;
        if (!tetap && prod.stokAuto && prod.stokRef) bersihkan = prod.stokRef;
      }
      await setDoc(docRef, updateData, { merge: true });
      if (bersihkan) {
        await hapusStokOtomatisBilaYatim(bersihkan, products.filter((x) => x.id !== prod.id), stokData?.[bersihkan.kategori]?.[bersihkan.item]?.jumlah).catch(() => false);
      }

      // Sync updated product info in cart
      setCart((prev) =>
        prev.map((item) =>
          item.id === selectedProductForEdit.id
            ? { ...item, name: editProdName.trim(), price: Number(editProdPrice), category: editProdCategory, imageUrl: downloadURL, subcategory: editProdCategory === "JUALAN" ? editProdSubCategory : undefined }
            : item
        )
      );

      setOpenEditProduct(false);
      setSelectedProductForEdit(null);
      setEditProdImage(null);
      alert("Produk berhasil diperbarui!");
    } catch (err: any) {
      console.error("Failed to update product:", err);
      alert("Gagal memperbarui produk: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus produk ini secara permanen dari database?")) return;
    try {
      const docRef = doc(db, "products", productId);
      const prod = products.find((x) => x.id === productId);
      await deleteDoc(docRef);
      // Barang stok yang dibuat otomatis untuk produk ini ikut dihapus bila stoknya 0 & tidak dipakai produk lain
      if (prod?.stokAuto && prod.stokRef) {
        await hapusStokOtomatisBilaYatim(prod.stokRef, products.filter((x) => x.id !== productId), stokData?.[prod.stokRef.kategori]?.[prod.stokRef.item]?.jumlah).catch(() => false);
      }
      setOpenEditProduct(false);
      setSelectedProductForEdit(null);
      // Remove from cart if present
      setCart((prev) => prev.filter((item) => item.id !== productId));
      alert("Produk berhasil dihapus!");
    } catch (err: any) {
      console.error("Failed to delete product:", err);
      alert("Gagal menghapus produk: " + err.message);
    }
  };

  // Initialize Default Products
  const handleInitializeDefaults = async () => {
    if (!window.confirm("Apakah Anda ingin memuat produk bawaan awal ke database?")) return;
    try {
      const existing = new Set(products.map((x) => String(x.name || "").trim().toLowerCase()));
      const toAdd = DEFAULT_PRODUCTS.filter((p) => !existing.has(String(p.name || "").trim().toLowerCase()));
      if (toAdd.length === 0) {
        alert("Semua produk bawaan sudah ada di database.");
        return;
      }
      for (const p of toAdd) {
        await addDoc(collection(db, "products"), {
          ...p,
          createdAt: serverTimestamp()
        });
      }
      alert("Produk bawaan awal berhasil dimuat!");
    } catch (err: any) {
      console.error("Failed to load default products:", err);
      alert("Gagal memuat produk bawaan: " + err.message);
    }
  };

  // Badge stok di kartu produk
  const stokBadge = (p: Product): { label: string; tone: "habis" | "menipis" | "aman" | "belum" } | null => {
    const r = p.stokRef;
    if (!r) return null;
    if (r.item === PILIH_SAAT_CHECKOUT) {
      const items = stokCats.find((c) => c.kategori === r.kategori)?.items || [];
      if (!items.length) return null;
      if (!items.some((it) => stokData?.[r.kategori]?.[it])) return { label: "Stok ?", tone: "belum" };
      const n = items.reduce((s, it) => s + Math.max(0, Math.round(Number(stokData?.[r.kategori]?.[it]?.jumlah) || 0)), 0);
      return { label: n > 0 ? `Stok ${n}` : "Habis", tone: n > 0 ? "aman" : "habis" };
    }
    const v = stokData?.[r.kategori]?.[r.item];
    const diMaster = stokCats.some((c) => c.kategori === r.kategori && c.items.includes(r.item));
    if (!v && !diMaster) return null;
    if (!v) return { label: "Stok ?", tone: "belum" };
    const n = Math.max(0, Math.round(Number(v?.jumlah) || 0));
    return { label: n > 0 ? `Stok ${n}` : "Habis", tone: statusOf(n, getMinStok(minStokMap, r.kategori, r.item)) };
  };

  // Filter products by category, sort alphabetically by name, search query, and filter by sub-category if in JUALAN
  const filteredProducts = useMemo(() => {
    if (activeSub === "ISI GAME") {
      let result = games;
      
      // Search query filter
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        result = result.filter((p) => p.name.toLowerCase().includes(q));
      }
      
      // Platform filter
      result = result.filter((p) => p.platform === activeIsiGameSub);
      
      // Sort alphabetically by name
      return result.sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
    }

    let result = products.filter((p) => p.category === activeSub);
    const searching = searchQuery.trim() !== "";
    
    // Search query filter
    if (searching) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }
    
    // JUALAN: halaman Baru / Seken + sub-kategori (saat mencari, cari di semua barang jualan)
    if (activeSub === "JUALAN" && !searching) {
      result = result.filter((p) => kondisiProduk(p) === activeKondisi && getSubCategory(p) === activeJualanSub);
    }
    
    // Sort alphabetically by name
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, games, activeSub, activeJualanSub, activeKondisi, activeIsiGameSub, searchQuery]);

  return (
    <div className={`fixed inset-0 z-[100] items-center justify-center bg-black/40 backdrop-blur-md transition-opacity duration-300 font-sans ${open ? "flex" : "hidden"}`}>
      
      {/* ============================================================
          MAIN CONTAINER (Full-Screen iOS Style)
          ============================================================ */}
      <div className="relative w-full h-full bg-zinc-50 dark:bg-[#1C1C1E] overflow-hidden flex flex-col animate-in fade-in duration-300">
        
        {/* Top iOS Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/50 dark:border-white/5 bg-white/70 dark:bg-[#1C1C1E]/70 backdrop-blur-xl z-20 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black/10 dark:bg-white/20 text-black dark:text-white flex items-center justify-center">
              <ShoppingCart size={18} />
            </div>
            <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white uppercase">
              <span className="sm:hidden">Kasir POS</span>
              <span className="hidden sm:inline">Point of Sales (Kasir)</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-200/60 dark:bg-zinc-800 hover:bg-zinc-300/60 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 active:scale-90 transition-all"
            aria-label="Tutup POS"
          >
            <X size={18} />
          </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          
          {/* ============================================================
              LEFT / TOP NAVIGATION (Sidebar/Bar)
              ============================================================ */}
          {/* Mobile sub-menu bar (Horizontal at the top) */}
          <div className="md:hidden p-4 bg-white/50 dark:bg-black/10 border-b border-zinc-200/60 dark:border-white/5 shrink-0">
            <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-[14px] gap-1 overflow-x-auto no-scrollbar">
              {(["JUALAN", "RENTAL", "ISI GAME", "SERVIS"] as const).map((sub) => {
                const hasCategoryUpdate = sub === "ISI GAME"
                  ? games.some(g => catalogChanges[g.id] !== undefined)
                  : products.some(p => p.category === sub && catalogChanges[p.id] !== undefined);

                return (
                  <button
                    key={sub}
                    onClick={() => setActiveSub(sub)}
                    className={`flex-1 min-w-[75px] py-2.5 text-[11px] font-bold rounded-[10px] tracking-wide transition-all relative ${
                      activeSub === sub
                        ? "bg-white dark:bg-[#2C2C2E] text-black dark:text-white shadow-sm ring-1 ring-black/5"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <span>{sub}</span>
                      {hasCategoryUpdate && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            
            {/* Barang jualan hanya lewat Owner › Input › Stok Jualan */}
            {isSuperAdminOrOwner && activeSub === "JUALAN" && (
              <p className="mt-3 text-[12px] leading-snug text-zinc-500 dark:text-zinc-400">
                Tambah & ubah barang jualan (harga, modal, stok) di <b className="text-zinc-700 dark:text-zinc-200">Owner › Input › Stok Jualan</b>.
              </p>
            )}
            {/* Add product button for Super Admin on Mobile */}
            {isSuperAdminOrOwner && (activeSub === "RENTAL" || activeSub === "SERVIS") && (
              <div className="mt-3 flex gap-2">
                <button 
                  onClick={() => { setNewProdCategory(activeSub === "SERVIS" ? "SERVIS" : "RENTAL"); setOpenAddProduct(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black shadow-md shadow-black/25 dark:shadow-white/10 active:scale-95 transition-all"
                >
                  <PlusCircle size={14} />
                  Tambah Produk
                </button>
                {products.length === 0 && (
                  <button 
                    onClick={handleInitializeDefaults}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs active:scale-95 transition-all"
                  >
                    <Sparkles size={14} />
                    Inisialisasi Awal
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Desktop sub-menu sidebar (Vertical on the left) */}
          <div className="hidden md:flex flex-col w-56 border-r border-zinc-200/50 dark:border-white/5 bg-zinc-50/40 dark:bg-[#1C1C1E]/40 p-4 shrink-0 justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] font-black tracking-widest text-zinc-400 dark:text-zinc-500 uppercase px-3">
                KATEGORI POS
              </span>
              {(["JUALAN", "RENTAL", "ISI GAME", "SERVIS"] as const).map((sub) => {
                const count = sub === "ISI GAME" 
                  ? games.length 
                  : products.filter(p => p.category === sub).length;
                  
                const hasCategoryUpdate = sub === "ISI GAME"
                  ? games.some(g => catalogChanges[g.id] !== undefined)
                  : products.some(p => p.category === sub && catalogChanges[p.id] !== undefined);

                return (
                  <button
                    key={sub}
                    onClick={() => setActiveSub(sub)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-sm tracking-wide transition-all ${
                      activeSub === sub
                        ? "bg-black dark:bg-white text-white dark:text-black shadow-md shadow-black/10 dark:shadow-white/5"
                        : "text-zinc-600 hover:bg-zinc-200/50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {sub}
                      {hasCategoryUpdate && (
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                      )}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      activeSub === sub ? "bg-white/20 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bottom Section in Desktop Sidebar */}
            <div className="space-y-2 pt-4 border-t border-zinc-200/50 dark:border-white/5">
              {isSuperAdminOrOwner && products.length === 0 && (
                <button
                  onClick={handleInitializeDefaults}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs active:scale-95 transition-all"
                >
                  <Sparkles size={13} />
                  Inisialisasi Produk
                </button>
              )}
              {isSuperAdminOrOwner && (activeSub === "RENTAL" || activeSub === "SERVIS") && (
                <button
                  onClick={() => { setNewProdCategory(activeSub === "SERVIS" ? "SERVIS" : "RENTAL"); setOpenAddProduct(true); }}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black shadow-md shadow-black/25 dark:shadow-white/10 active:scale-95 transition-all"
                >
                  <PlusCircle size={14} />
                  Tambah Produk
                </button>
              )}
            </div>
          </div>

          {/* ============================================================
              CENTER: CATALOG GRID VIEW
              ============================================================ */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Desktop Add Product Header */}
            {isSuperAdminOrOwner && (
              <div className="hidden md:flex items-center justify-between px-6 py-4 border-b border-zinc-200/50 dark:border-white/5 bg-white/30 dark:bg-black/10 shrink-0">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  Katalog {activeSub} &mdash; Klik item untuk menambahkan ke keranjang
                </span>
                {(activeSub === "RENTAL" || activeSub === "SERVIS") && products.length > 0 && (
                  <button
                    onClick={() => { setNewProdCategory(activeSub === "SERVIS" ? "SERVIS" : "RENTAL"); setOpenAddProduct(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 font-bold text-xs transition-all active:scale-95"
                  >
                    <PlusCircle size={13} />
                    Tambah Produk Baru
                  </button>
                )}
              </div>
            )}

            {/* Search Bar */}
            <div className="px-4 py-2.5 md:px-6 md:py-3 border-b border-zinc-200/50 dark:border-white/5 bg-white dark:bg-black/10 shrink-0">
              <div className="relative flex items-center">
                <Search size={16} className="absolute left-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari produk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 bg-zinc-100 dark:bg-zinc-800/60 text-xs md:text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 border border-transparent rounded-xl outline-none focus:bg-white focus:border-zinc-300 dark:focus:bg-[#2C2C2E] dark:focus:border-zinc-700 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 w-5 h-5 flex items-center justify-center rounded-full bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-500 dark:text-zinc-400 active:scale-90 transition-all"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-Category Pills for JUALAN */}
            {activeSub === "JUALAN" && (
              <div className="px-4 pt-3 border-b border-zinc-200/50 dark:border-white/5 bg-zinc-50/50 dark:bg-black/10 shrink-0">
              {/* Halaman Barang Baru / Seken */}
              <KondisiSwitch
                size="sm"
                value={activeKondisi}
                onChange={setActiveKondisi}
                counts={{
                  BARU: products.filter((p) => p.category === "JUALAN" && kondisiProduk(p) === "BARU").length,
                  SEKEN: products.filter((p) => p.category === "JUALAN" && kondisiProduk(p) === "SEKEN").length,
                }}
              />
              <div className="py-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(["Unit PS", "Stik", "Hardisk", "Aksesoris", "BD"] as const).map((subJualan) => {
                  const count = jualanSubCount(activeKondisi, subJualan);
                  if (count === 0 && activeJualanSub !== subJualan) return null; // sembunyikan sub-kategori kosong
                  
                  const hasSubUpdate = products.some(p => p.category === "JUALAN" && kondisiProduk(p) === activeKondisi && getSubCategory(p) === subJualan && catalogChanges[p.id] !== undefined);

                  return (
                    <button
                      key={subJualan}
                      onClick={() => setActiveJualanSub(subJualan)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap active:scale-95 transition-all relative ${
                        activeJualanSub === subJualan
                          ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                          : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 border border-zinc-200/50 dark:border-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {subJualan}
                        {hasSubUpdate && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                        )}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                        activeJualanSub === subJualan
                          ? "bg-white/20 dark:bg-black/10 text-white dark:text-black"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              </div>
            )}

            {/* Sub-Category Pills for ISI GAME */}
            {activeSub === "ISI GAME" && (
              <div className="px-4 py-3 border-b border-zinc-200/50 dark:border-white/5 bg-zinc-50/50 dark:bg-black/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                {(["PS3 CFW/HEN", "PS4 HEN", "PS5 HEN", "Switch CFW", "PC"] as const).map((subIsiGame) => {
                  const count = games.filter(g => g.platform === subIsiGame).length;
                  const hasSubUpdate = games.some(g => g.platform === subIsiGame && catalogChanges[g.id] !== undefined);

                  return (
                    <button
                      key={subIsiGame}
                      onClick={() => setActiveIsiGameSub(subIsiGame)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap active:scale-95 transition-all relative ${
                        activeIsiGameSub === subIsiGame
                          ? "bg-black dark:bg-white text-white dark:text-black shadow-sm"
                          : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 border border-zinc-200/50 dark:border-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {subIsiGame}
                        {hasSubUpdate && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                        )}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                        activeIsiGameSub === subIsiGame
                          ? "bg-white/20 dark:bg-black/10 text-white dark:text-black"
                          : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500"
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Catalog Scrollbox */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
              {filteredProducts.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-full bg-zinc-200/50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-600 mb-3">
                    <ShoppingCart size={28} />
                  </div>
                  <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                    Katalog Kosong
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[240px]">
                    {activeSub === "JUALAN" ? `Belum ada barang ${activeKondisi === "SEKEN" ? "seken" : "baru"} di kategori ini.` : `Belum ada produk di kategori ${activeSub}.`}
                    {isSuperAdminOrOwner && (activeSub === "JUALAN" ? " Tambahkan lewat Owner › Input › Stok Jualan." : " Klik tombol di bawah untuk menambahkan produk.")}
                  </p>
                  {isSuperAdminOrOwner && (activeSub === "RENTAL" || activeSub === "SERVIS") && (
                    <button
                      onClick={() => { setNewProdCategory(activeSub === "SERVIS" ? "SERVIS" : "RENTAL"); setOpenAddProduct(true); }}
                      className="mt-4 px-4 py-2 text-xs font-bold bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black rounded-lg active:scale-95 shadow-md shadow-black/20 dark:shadow-white/5"
                    >
                      Tambah Produk Pertama
                    </button>
                  )}
                </div>
              ) : (
                <>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 pb-24 md:pb-6">
                  {filteredProducts.map((p) => {
                    const cartItem = cart.find(item => item.id === p.id);
                    const qty = cartItem?.quantity || 0;
                    const changeType = catalogChanges[p.id];

                    return (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={`group relative overflow-hidden rounded-[16px] bg-white dark:bg-[#2C2C2E] border hover:border-black/50 dark:hover:border-white/50 hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col ${
                          qty > 0 
                            ? "border-black/50 dark:border-white/5 ring-1 ring-black/20 dark:ring-white/20" 
                            : "border-zinc-200/60 dark:border-white/5"
                        }`}
                      >
                        {/* Selected Indicator Badge (Bottom Right) */}
                        {qty > 0 && (
                          <div className="absolute bottom-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-black dark:bg-white text-white dark:text-black font-black text-[10px] flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200">
                            {qty}
                          </div>
                        )}

                        {/* Super Admin Edit Product Button (Right) */}
                        {isSuperAdminOrOwner && p.category !== "ISI GAME" && p.category !== "JUALAN" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(p);
                            }}
                            className="absolute top-1.5 right-1.5 z-10 w-6 h-6 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-md text-zinc-700 dark:text-zinc-300 hover:text-black dark:hover:text-white flex items-center justify-center shadow-md border border-zinc-200/50 dark:border-white/10 active:scale-90 transition-all"
                            title="Edit Produk"
                          >
                            <Pencil size={11} />
                          </button>
                        )}

                        {/* Product Image */}
                        <div className={`w-full bg-zinc-100 dark:bg-black/20 flex items-center justify-center overflow-hidden shrink-0 relative ${p.category === "ISI GAME" ? "aspect-[3/4]" : "aspect-square"}`}>
                          {p.imageUrl ? (
                            <>
                              <img
                                src={p.imageUrl}
                                alt={p.name}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fallback = e.currentTarget.parentElement?.querySelector(".img-fallback");
                                  if (fallback) fallback.classList.remove("hidden");
                                }}
                              />
                              <div className="img-fallback hidden text-2xl text-zinc-300 dark:text-zinc-700">
                                📦
                              </div>
                            </>
                          ) : (
                            <div className="text-2xl text-zinc-300 dark:text-zinc-700">
                              📦
                            </div>
                          )}

                          {/* Badge stok jualan (Bottom Left) */}
                          {(() => {
                            const b = stokBadge(p);
                            return b ? (
                              <div className={`absolute bottom-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md text-[9.5px] font-black shadow-sm select-none ${b.tone === "habis" ? "bg-red-600 text-white" : b.tone === "menipis" ? "bg-amber-400 text-amber-950" : b.tone === "belum" ? "bg-zinc-500/80 text-white" : "bg-black/70 text-white"}`}>
                                {b.label}
                              </div>
                            ) : null;
                          })()}
                          {/* Catalog Update Badge (Top Left, Red color) */}
                          {changeType && (
                            <div className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-md border border-red-500 bg-red-600 text-white select-none animate-pulse">
                              {changeType}
                            </div>
                          )}
                        </div>

                        {/* Card Details */}
                        <div className="p-2 md:p-2.5 flex-1 flex flex-col justify-between gap-1 min-w-0">
                          <div className="flex flex-col gap-0.5">
                            <h4 className="font-bold text-[11px] md:text-xs text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2 h-8">
                              {p.name}
                            </h4>
                            {p.category === "JUALAN" && searchQuery.trim() !== "" && (
                              <span className={`self-start text-[9px] font-extrabold px-1.5 py-0.5 rounded ${kondisiProduk(p) === "SEKEN" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                                {kondisiProduk(p) === "SEKEN" ? "SEKEN" : "BARU"}
                              </span>
                            )}
                            {p.category === "ISI GAME" && (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-extrabold px-1 py-0.2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                                  {p.platform}
                                </span>
                                {p.size && (
                                  <span className="text-[9px] font-semibold text-zinc-500 font-mono">
                                    {p.size}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between mt-1">
                            {p.category === "JUALAN" && !p.price ? (
                              <span className="px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[10.5px] md:text-[12px] font-black tracking-wide">
                                BONUS · Rp 0
                              </span>
                            ) : (
                              <span className="font-extrabold text-[12px] md:text-[14px] text-zinc-900 dark:text-zinc-100 font-mono">
                                Rp {p.price.toLocaleString("id-ID")}
                              </span>
                            )}
                            
                            {/* Decrement button if selected */}
                            {qty > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromCart(p.id);
                                }}
                                className="w-5 h-5 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center active:scale-90 transition-all"
                              >
                                <Minus size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          </div>

          {/* ============================================================
              RIGHT PANEL: STATIC CART (Desktop only)
              ============================================================ */}
          <div className="hidden md:flex flex-col w-[380px] border-l border-zinc-200/50 dark:border-white/5 bg-white dark:bg-[#1C1C1E] shrink-0 min-h-0">
            <div className="p-4 border-b border-zinc-200/50 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-black/10 shrink-0">
              <span className="font-black text-[11px] tracking-wider text-zinc-400 uppercase">
                KERANJANG BELANJA
              </span>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[11px] font-bold text-red-500 hover:underline flex items-center gap-1 active:scale-95"
                >
                  <Trash2 size={12} />
                  Bersihkan
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0 no-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 dark:text-zinc-600 py-12">
                  <ShoppingCart size={32} className="mb-2 opacity-50" />
                  <span className="text-xs font-semibold">Keranjang masih kosong</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-0.5">Pilih produk dari katalog di kiri</span>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200/30 dark:border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="font-bold text-[13px] text-zinc-900 dark:text-white truncate">
                        {item.name}
                      </div>
                      {item.category === "ISI GAME" && item.platform && (
                        <div className="text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {item.platform}
                        </div>
                      )}
                      <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                        {!item.price && item.category === "JUALAN" ? <span className="font-sans font-black text-violet-600 dark:text-violet-400 mr-1">BONUS</span> : null}
                        Rp {item.price.toLocaleString("id-ID")} x {item.quantity}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 active:scale-90 transition-all"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-5 text-center font-bold text-xs text-zinc-800 dark:text-white font-mono">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => addToCart(item)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 active:scale-90 transition-all"
                      >
                        <Plus size={13} />
                      </button>
                      
                      <button
                        onClick={() => removeAllFromCart(item.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 active:scale-90 transition-all ml-1.5"
                        title="Hapus item"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Summary Bottom Panel */}
            <div className="p-4 bg-zinc-50 dark:bg-[#2C2C2E]/80 border-t border-zinc-200 dark:border-white/5 shrink-0 space-y-3">
              {/* Metode Pembayaran */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                  Metode Pembayaran
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("CASH")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      paymentMethod === "CASH"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    CASH / TUNAI
                  </button>
                  <button
                    onClick={() => setPaymentMethod("TRANSFER")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      paymentMethod === "TRANSFER"
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    TRANSFER
                  </button>
                </div>
                {/* Tampilkan QRIS Button */}
                <button
                  onClick={() => setShowQrisModal(true)}
                  className="w-full mt-2 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm bg-black hover:bg-zinc-800 text-white border border-transparent dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 dark:border-transparent"
                >
                  Tampilkan QRIS
                </button>
              </div>

              {/* Ringkasan Subtotal, Diskon Promo, & Total */}
              {discountAmount > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    <span>Subtotal</span>
                    <span className="font-mono">Rp {subtotal.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <span>Diskon Promo</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 font-black">
                        {discountPercent}% OFF
                      </span>
                    </span>
                    <span className="font-mono">-Rp {discountAmount.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex items-end justify-between pt-1 border-t border-zinc-200/80 dark:border-white/10">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      TOTAL BAYAR
                    </span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono tracking-tighter">
                      Rp {total.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {qualifyingCount > 0 && nextRule && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl font-medium flex items-center justify-between">
                      <span>💡 Tambah {gamesNeededForNext} game {promosConfig.targetPlatforms.join('/')}</span>
                      <span className="font-bold text-amber-600 dark:text-amber-300">Diskon {nextRule.percent}%</span>
                    </div>
                  )}
                  <div className="flex items-end justify-between">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      TOTAL HARGA
                    </span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono tracking-tighter">
                      Rp {total.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              )}
              
              <div>
                <button
                  disabled={cart.length === 0}
                  onClick={() => setOpenCheckout(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-[13px] active:scale-95 transition-all shadow-md shadow-red-600/20"
                >
                  <Receipt size={16} />
                  Selesaikan & Cetak Nota
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================
            FLOATING ACTIONS PANEL (Mobile only)
            ============================================================ */}
        {cart.length > 0 && (
          <div className="md:hidden fixed bottom-5 left-0 right-0 px-4 z-40 animate-in slide-in-from-bottom-5 duration-300">
            <button
              onClick={() => setOpenMobileCart(true)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-[20px] bg-black dark:bg-white text-white dark:text-black font-bold shadow-xl shadow-black/30 dark:shadow-white/10 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <ShoppingCart size={18} />
                  <span className="absolute -top-1.5 -right-1.5 bg-white dark:bg-zinc-900 text-black dark:text-white font-black text-[9px] w-4.5 h-4.5 rounded-full flex items-center justify-center shadow-sm">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <span className="text-[13px] tracking-wide font-black">LIHAT KERANJANG</span>
              </div>
              <span className="text-[16px] font-extrabold font-mono">
                Rp {total.toLocaleString("id-ID")} &rarr;
              </span>
            </button>
          </div>
        )}

      </div>

      {/* ============================================================
          MOBILE CART MODAL OVERLAY (Full-Screen)
          ============================================================ */}
      {openMobileCart && (
        <div className="md:hidden fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full h-full bg-zinc-50 dark:bg-[#1C1C1E] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/50 dark:border-white/5 bg-white dark:bg-[#1C1C1E] shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-black dark:text-white" />
                <h3 className="font-black text-sm text-zinc-900 dark:text-white uppercase">
                  Keranjang Belanja
                </h3>
              </div>
              <button
                onClick={() => setOpenMobileCart(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-bold"
              >
                <X size={16} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-white/5"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                      {item.name}
                    </div>
                    {item.category === "ISI GAME" && item.platform && (
                      <div className="text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {item.platform}
                      </div>
                    )}
                    <div className="text-[12px] text-zinc-500 font-mono mt-0.5">
                      {!item.price && item.category === "JUALAN" ? <span className="font-sans font-black text-violet-600 dark:text-violet-400 mr-1">BONUS</span> : null}
                      Rp {item.price.toLocaleString("id-ID")} x {item.quantity}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 active:scale-90 transition-all"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-5 text-center font-bold text-xs text-zinc-800 dark:text-white font-mono">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => addToCart(item)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 active:scale-90 transition-all"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => removeAllFromCart(item.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 ml-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Section */}
            <div className="p-5 bg-white dark:bg-[#2C2C2E]/80 border-t border-zinc-200/50 dark:border-white/5 shrink-0 space-y-3">
              {/* Metode Pembayaran */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                  Metode Pembayaran
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("CASH")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      paymentMethod === "CASH"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    CASH / TUNAI
                  </button>
                  <button
                    onClick={() => setPaymentMethod("TRANSFER")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      paymentMethod === "TRANSFER"
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
                        : "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    TRANSFER
                  </button>
                </div>
                {/* Tampilkan QRIS Button */}
                <button
                  onClick={() => setShowQrisModal(true)}
                  className="w-full mt-2 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm bg-black hover:bg-zinc-800 text-white border border-transparent dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-900 dark:border-transparent"
                >
                  Tampilkan QRIS
                </button>
              </div>

              {/* Ringkasan Subtotal, Diskon Promo, & Total Mobile */}
              {discountAmount > 0 ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    <span>Subtotal</span>
                    <span className="font-mono">Rp {subtotal.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <span>Diskon Promo</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 font-black">
                        {discountPercent}% OFF
                      </span>
                    </span>
                    <span className="font-mono">-Rp {discountAmount.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex items-end justify-between pt-1 border-t border-zinc-200/80 dark:border-white/10">
                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      TOTAL BAYAR
                    </span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono">
                      Rp {total.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {qualifyingCount > 0 && nextRule && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl font-medium flex items-center justify-between">
                      <span>💡 Tambah {gamesNeededForNext} game {promosConfig.targetPlatforms.join('/')}</span>
                      <span className="font-bold text-amber-600 dark:text-amber-300">Diskon {nextRule.percent}%</span>
                    </div>
                  )}
                  <div className="flex items-end justify-between">
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      TOTAL HARGA
                    </span>
                    <span className="text-2xl font-black text-zinc-900 dark:text-white font-mono">
                      Rp {total.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              )}
              <div className="pb-4">
                <button
                  disabled={cart.length === 0}
                  onClick={() => setOpenCheckout(true)}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-[13px] active:scale-95 transition-all shadow-md shadow-red-600/20"
                >
                  <Receipt size={16} />
                  Selesaikan & Cetak Nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          TAMBAH PRODUK OVERLAY FORM (Super Admin only)
          ============================================================ */}
      {openAddProduct && isSuperAdminOrOwner && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-[380px] overflow-hidden rounded-[28px] bg-white dark:bg-zinc-900 p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setOpenAddProduct(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-white flex items-center justify-center active:scale-90 transition-all"
            >
              <X size={14} />
            </button>

            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                  Tambah Produk Baru
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Produk baru akan tersimpan ke database & muncul di katalog POS
                </p>
              </div>

              {/* Nama Barang */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                  Nama Barang
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kabel HDMI 2 Meter"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-black/50 dark:focus:ring-white/50 transition-all shadow-sm"
                />
              </div>

              {/* Harga */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                  Harga (Rupiah)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="Contoh: 35000"
                  value={newProdPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewProdPrice(val === "" ? "" : Number(val));
                  }}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold font-mono text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-black/50 dark:focus:ring-white/50 transition-all shadow-sm"
                />
                {newProdPrice !== "" && newProdPrice >= 0 && (
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 font-mono pl-1">
                    Preview: Rp {Number(newProdPrice).toLocaleString("id-ID")}
                  </div>
                )}
              </div>

              {/* Kategori */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                  Kategori
                </label>
                <select
                  value={newProdCategory}
                  onChange={(e) => setNewProdCategory(e.target.value as any)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-black/50 dark:focus:ring-white/50 transition-all shadow-sm"
                >
                  <option value="RENTAL">RENTAL (Sewa PS / Paket Jam)</option>
                  <option value="SERVIS">SERVIS (Jasa Service Stik / Konsol)</option>
                </select>
              </div>

              {/* Barang stok yang dipotong saat nota dibuat */}
              {newProdCategory === "SERVIS" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                    Barang Stok (dipotong saat nota dicetak)
                  </label>
                  <StokRefSelect
                    value={newProdStokRef}
                    onChange={setNewProdStokRef}
                    categories={stokCats}
                    data={stokData}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-white/5 rounded-xl px-3 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-black/50 dark:focus:ring-white/50 transition-all shadow-sm"
                  />
                </div>
              )}

              {/* Upload Foto */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                  Foto Produk (Maks 2MB)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewProdImage(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-200 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3.5 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-black font-bold text-xs rounded-xl shadow-md shadow-black/25 dark:shadow-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                {isUploading ? "Mengunggah..." : "Simpan Produk"}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* ============================================================
          EDIT PRODUK OVERLAY FORM (Super Admin only)
          ============================================================ */}
      {openEditProduct && isSuperAdminOrOwner && selectedProductForEdit && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-[380px] overflow-hidden rounded-[28px] bg-white dark:bg-zinc-900 p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setOpenEditProduct(false);
                setSelectedProductForEdit(null);
              }}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-white flex items-center justify-center active:scale-90 transition-all"
            >
              <X size={14} />
            </button>

            <form onSubmit={handleEditProductSubmit} className="space-y-4">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                  Edit Produk
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Ubah data produk atau hapus produk dari database
                </p>
              </div>

              {/* Nama Barang */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                  Nama Barang
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kabel HDMI 2 Meter"
                  value={editProdName}
                  onChange={(e) => setEditProdName(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-black/50 dark:focus:ring-white/50 transition-all shadow-sm"
                />
              </div>

              {/* Harga */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                  Harga (Rupiah)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="Contoh: 35000"
                  value={editProdPrice}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditProdPrice(val === "" ? "" : Number(val));
                  }}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold font-mono text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-black/50 dark:focus:ring-white/50 transition-all shadow-sm"
                />
                {editProdPrice !== "" && editProdPrice >= 0 && (
                  <div className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 font-mono pl-1">
                    Preview: Rp {Number(editProdPrice).toLocaleString("id-ID")}
                  </div>
                )}
              </div>

              {/* Kategori */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                  Kategori
                </label>
                <select
                  value={editProdCategory}
                  onChange={(e) => setEditProdCategory(e.target.value as any)}
                  className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-white/5 rounded-xl px-4 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-black/50 dark:focus:ring-white/50 transition-all shadow-sm"
                >
                  <option value="RENTAL">RENTAL (Sewa PS / Paket Jam)</option>
                  <option value="SERVIS">SERVIS (Jasa Service Stik / Konsol)</option>
                </select>
              </div>

              {/* Barang stok yang dipotong saat nota dibuat */}
              {editProdCategory === "SERVIS" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                    Barang Stok (dipotong saat nota dicetak)
                  </label>
                  <StokRefSelect
                    value={editProdStokRef}
                    onChange={setEditProdStokRef}
                    categories={stokCats}
                    data={stokData}
                    className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-white/5 rounded-xl px-3 py-3 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-black/50 dark:focus:ring-white/50 transition-all shadow-sm"
                  />
                </div>
              )}

              {/* Upload Foto Baru */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">
                  Foto Baru (Opsional, Maks 2MB)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditProdImage(e.target.files?.[0] ?? null)}
                  className="w-full text-xs text-zinc-500 dark:text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-100 dark:file:bg-zinc-800 file:text-zinc-700 dark:file:text-zinc-200 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-700 cursor-pointer"
                />
                {editProdImageUrl && !editProdImage && (
                  <div className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1.5">
                    <span className="font-semibold">Foto saat ini:</span>
                    <a href={editProdImageUrl} target="_blank" rel="noreferrer" className="text-black dark:text-white underline truncate max-w-[200px]">
                      Lihat Foto
                    </a>
                  </div>
                )}
              </div>

              {/* Submit & Delete Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="w-full py-3.5 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-black font-bold text-xs rounded-xl shadow-md shadow-black/25 dark:shadow-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  {isUploading ? "Mengunggah..." : "Simpan Perubahan"}
                </button>
                
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => handleDeleteProduct(selectedProductForEdit.id)}
                  className="w-full py-3.5 bg-red-100 hover:bg-red-200 dark:bg-red-500/10 dark:hover:bg-red-500/20 disabled:opacity-50 text-red-600 dark:text-red-400 font-bold text-xs rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-transparent dark:border-red-500/20"
                >
                  Hapus Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          QRIS POPUP MODAL
          ============================================================ */}
      {showQrisModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-[450px] overflow-hidden rounded-[28px] bg-white dark:bg-zinc-900 p-6 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200 flex flex-col items-center">
            <button
              onClick={() => setShowQrisModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-white flex items-center justify-center active:scale-90 transition-all"
            >
              <X size={16} />
            </button>
            
            <div className="text-center w-full mt-2">
              <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                QRIS Pembayaran
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                Scan kode QRIS di bawah ini untuk melakukan pembayaran transfer
              </p>
            </div>

            <div className="w-full bg-white rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-md">
              <img
                src={qrisImg}
                alt="QRIS"
                className="w-full h-auto object-contain block"
              />
            </div>
            
            <button
              onClick={() => setShowQrisModal(false)}
              className="w-full mt-5 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold text-xs rounded-xl active:scale-95 transition-all"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      <PosCheckoutSheet
        open={openCheckout}
        onClose={() => setOpenCheckout(false)}
        lines={cart.map((c) => ({
          id: c.id,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          category: c.category,
          platform: c.platform,
          subcategory: c.category === "JUALAN" ? getSubCategory(c) : undefined,
          kondisi: c.category === "JUALAN" ? kondisiProduk(c) : undefined,
          stokRef: c.stokRef || null,
        }))}
        subtotal={subtotal}
        discountPercent={discountPercent}
        discountAmount={discountAmount}
        total={total}
        metode={paymentMethod}
        setMetode={setPaymentMethod}
        kasirNama={adminName}
        categories={stokCats}
        data={stokData}
        onCompleted={() => {
          setCart([]);
          setOpenMobileCart(false);
        }}
        hitungDiskon={(items) => calculatePOSDiscount(items, promosConfig)}
      />
    </div>
  );
}
