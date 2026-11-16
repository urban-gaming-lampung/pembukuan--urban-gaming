import React, { useState, useEffect, useMemo } from "react";
import { X, ShoppingCart, Plus, Minus, Trash2, PlusCircle, Sparkles, Pencil, Receipt, Clock, AlertTriangle } from "lucide-react";
import { collection, onSnapshot, query, addDoc, serverTimestamp, doc, setDoc, deleteDoc, deleteField } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, listGameDb } from "../lib/firebase";
import { Button, Card, EmptyState, Eyebrow, IconBadge, Notice, Pill, SearchField, Sheet } from "../ui";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import useStokData from "../hooks/useStokData";
import type { StokItemValue } from "../hooks/useStokData";
import PosCheckoutSheet from "./PosCheckoutSheet";
import NotaDpSheet from "./NotaDpSheet";
import { StokRefSelect } from "./StokRefSelect";
import { dipesanDari, hapusStokOtomatisBilaYatim, hariKeJatuhTempo, Kondisi, kondisiProduk, PILIH_SAAT_CHECKOUT, StokRef, stokBaruUntukProduk, useNotaDp } from "../lib/posSales";
import KondisiSwitch from "./KondisiSwitch";
import { getMinStok, renameJualanItem, statusOf, useMinStok, kunciStok } from "../lib/stokJualan";
import { rupiah, formatRibuanInput } from "../lib/format";
import { resolveProductThumb } from "../lib/servisThumbnails";

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
  
  // RENTAL tidak dijual lewat POS: sewa dicatat di Rincian Pemasukan SEWA PS (nota sewa di sana)

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

const getGameDisplayName = (name: string) => (name || "").replace(/^\s*\//, "").trim();

export default function POSModal({ open, onClose, isSuperAdminOrOwner, adminName, catalogChanges = {} }: POSModalProps) {
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
  const [newProdCategory, setNewProdCategory] = useState<"JUALAN" | "RENTAL" | "SERVIS">("SERVIS");
  const [newProdSubCategory, setNewProdSubCategory] = useState<"Unit PS" | "Stik" | "Hardisk" | "Aksesoris" | "BD">("Aksesoris");
  const [newProdImage, setNewProdImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form states for editing product
  const [openEditProduct, setOpenEditProduct] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [editProdName, setEditProdName] = useState("");
  const [editProdPrice, setEditProdPrice] = useState<number | "">("");
  const [editProdCategory, setEditProdCategory] = useState<"JUALAN" | "RENTAL" | "SERVIS">("SERVIS");
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

  // Nota DP (belum lunas): barangnya "dipesan" — stok belum berkurang
  const { list: notaDp } = useNotaDp();
  const dipesan = useMemo(() => dipesanDari(notaDp), [notaDp]);
  const dpLewat = notaDp.filter((s) => (hariKeJatuhTempo(s.jatuhTempo) ?? 0) < 0).length;
  const [openDp, setOpenDp] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "TRANSFER">("CASH");
  const [showQrisModal, setShowQrisModal] = useState(false);

  // Lock body scroll on main POS modal (nested sheets handle their own locks)
  useBodyScrollLock(open);

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
    // Peringatan bila stok bebas (stok − dipesan DP) tidak cukup
    const r = product.stokRef;
    if (r && r.item !== PILIH_SAAT_CHECKOUT) {
      const v = stokData?.[r.kategori]?.[r.item];
      const d = dipesan.get(kunciStok(r)) || 0;
      if (v && d > 0) {
        const n = Math.max(0, Math.round(Number(v.jumlah) || 0));
        const diKeranjang = (cart.find((c) => c.id === product.id)?.quantity || 0) + 1;
        if (diKeranjang > n - d) setToast(`${r.item}: stok ${n}, ${d} sudah dipesan DP — cek barang sebelum dijual.`);
      }
    }
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
        return prev.filter((_, i) => i !== idx);
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
      const d = items.reduce((s, it) => s + (dipesan.get(`${r.kategori}||${it}`) || 0), 0);
      const bebas = n - d;
      return { label: n > 0 ? `Stok ${n}${d ? ` · ${d} dipesan` : ""}` : "Habis", tone: bebas > 0 ? "aman" : n > 0 ? "menipis" : "habis" };
    }
    const v = stokData?.[r.kategori]?.[r.item];
    const diMaster = stokCats.some((c) => c.kategori === r.kategori && c.items.includes(r.item));
    if (!v && !diMaster) return null;
    if (!v) return { label: "Stok ?", tone: "belum" };
    const n = Math.max(0, Math.round(Number(v?.jumlah) || 0));
    const d = dipesan.get(kunciStok(r)) || 0;
    return {
      label: n > 0 ? `Stok ${n}${d ? ` · ${d} dipesan` : ""}` : d ? `Habis · ${d} dipesan` : "Habis",
      tone: n === 0 ? "habis" : n - d <= 0 ? "menipis" : statusOf(n - d, getMinStok(minStokMap, r.kategori, r.item)),
    };
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

  const totalCartQty = cart.reduce((sum, item) => sum + item.quantity, 0);

  const renderCartItems = (mobile: boolean) =>
    cart.map((item) => (
      <div
        key={item.id}
        className={`flex items-center justify-between rounded-tile apple-card ring-1 ring-edge animate-in fade-in duration-200 ${
          mobile ? "p-3.5" : "p-3"
        }`}
      >
        <div className="flex-1 min-w-0 pr-2">
          <div className={`font-semibold text-label truncate ${mobile ? "text-subhead" : "text-footnote"}`}>
            {item.name}
          </div>
          {item.category === "ISI GAME" && item.platform && (
            <div className="text-caption2 font-semibold text-label-2 mt-0.5">{item.platform}</div>
          )}
          <div className="text-caption text-label-2 font-mono tabular-nums mt-0.5">
            {!item.price && item.category === "JUALAN" && (
              <span className="font-sans font-bold text-accent mr-1">BONUS</span>
            )}
            {rupiah(item.price)} x {item.quantity}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => removeFromCart(item.id)}
            aria-label={`Kurangi ${item.name}`}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 text-label-2 hover:text-label active:scale-90 transition-all"
          >
            <Minus size={14} />
          </button>
          <span className="w-5 text-center font-bold text-footnote text-label font-mono tabular-nums">
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => addToCart(item)}
            aria-label={`Tambah ${item.name}`}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 text-label-2 hover:text-label active:scale-90 transition-all"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={() => removeAllFromCart(item.id)}
            aria-label={`Hapus ${item.name}`}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-negative/10 text-negative hover:bg-negative/15 active:scale-90 transition-all ml-1"
            title="Hapus item"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    ));

  const renderCartFooter = (withClearAction: boolean) => (
    <div className="space-y-3">
      {withClearAction && cart.length > 0 && (
        <div className="flex justify-end -mt-1">
          <button
            type="button"
            onClick={clearCart}
            className="text-caption font-semibold text-negative hover:underline inline-flex items-center gap-1 active:scale-95"
          >
            <Trash2 size={12} />
            Bersihkan keranjang
          </button>
        </div>
      )}

      {/* Metode Pembayaran */}
      <div className="space-y-2">
        <Eyebrow>Metode Pembayaran</Eyebrow>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-full apple-segmented">
          {(["CASH", "TRANSFER"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPaymentMethod(m)}
              className={`min-h-[38px] rounded-full text-footnote font-semibold inline-flex items-center justify-center gap-1.5 transition-all ${
                paymentMethod === m
                  ? "apple-segmented-thumb text-label"
                  : "text-label-2 hover:text-label hover:bg-white/30 dark:hover:bg-white/[0.05]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  paymentMethod === m ? (m === "CASH" ? "bg-positive" : "bg-tint") : "bg-label-4"
                }`}
                aria-hidden
              />
              {m === "CASH" ? "Cash / Tunai" : "Transfer"}
            </button>
          ))}
        </div>
        <Button variant="gray" size="md" block onClick={() => setShowQrisModal(true)}>
          Tampilkan QRIS
        </Button>
      </div>

      {/* Ringkasan Subtotal, Diskon Promo, & Total */}
      {discountAmount > 0 ? (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-footnote text-label-2 font-medium">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{rupiah(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-footnote text-positive font-semibold">
            <span className="flex items-center gap-1.5">
              <span>Diskon Promo</span>
              <Pill tone="positive">{discountPercent}% OFF</Pill>
            </span>
            <span className="font-mono tabular-nums">-{rupiah(discountAmount)}</span>
          </div>
          <div className="flex items-end justify-between pt-2 border-t border-sep">
            <span className="text-caption font-semibold uppercase tracking-[0.04em] text-label-2">
              Total Bayar
            </span>
            <span className="text-title2 font-bold text-label font-mono tabular-nums tracking-tight">
              {rupiah(total)}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {qualifyingCount > 0 && nextRule && (
            <Notice tone="warning">
              <div className="flex items-center justify-between gap-2 text-caption">
                <span>Tambah {gamesNeededForNext} game {promosConfig.targetPlatforms.join("/")}</span>
                <span className="font-bold shrink-0">Diskon {nextRule.percent}%</span>
              </div>
            </Notice>
          )}
          <div className="flex items-end justify-between">
            <span className="text-caption font-semibold uppercase tracking-[0.04em] text-label-2">
              Total Harga
            </span>
            <span className="text-title2 font-bold text-label font-mono tabular-nums tracking-tight">
              {rupiah(total)}
            </span>
          </div>
        </div>
      )}

      <Button
        variant="filled"
        size="lg"
        block
        disabled={cart.length === 0}
        icon={<Receipt />}
        onClick={() => setOpenCheckout(true)}
      >
        Selesaikan & Cetak Nota
      </Button>
    </div>
  );

  const inputCls =
    "w-full h-11 px-3.5 rounded-field bg-fill text-[16px] sm:text-footnote font-medium text-label placeholder:text-label-3 focus:outline-none focus:bg-surface dark:focus:bg-[#2C2C2E] focus:ring-2 focus:ring-tint/35 transition-all";
  const labelCls = "text-caption font-semibold uppercase tracking-[0.04em] text-label-2 block mb-1";

  return (
    <div
      className={`fixed inset-0 z-[100] items-center justify-center bg-black/45 backdrop-blur-md transition-opacity duration-300 font-sans ${
        open ? "flex" : "hidden"
      }`}
    >
      {/* MAIN CONTAINER (Full-Screen Apple Split-View) */}
      <div className="relative w-full h-full apple-canvas text-label overflow-hidden flex flex-col animate-in fade-in duration-300">
        {/* Top Translucent Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-sep apple-bar z-20 shrink-0">
          <div className="flex items-center gap-2.5">
            <IconBadge color="gray" variant="solid">
              <ShoppingCart />
            </IconBadge>
            <h2 className="text-headline sm:text-title3 text-label tracking-tight">
              <span className="sm:hidden">Kasir URBAN</span>
              <span className="hidden sm:inline">Kasir URBAN · Point of Sales</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenDp(true)}
              aria-label={`Belum lunas, ${notaDp.length} nota DP`}
              className="min-h-[36px] pl-3 pr-3 flex items-center gap-1.5 rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 text-label text-footnote font-semibold active:scale-95 transition-all"
            >
              <Clock size={14} className="text-label-2" />
              Belum Lunas
              {notaDp.length > 0 && (
                <span
                  className={`min-w-[20px] h-5 px-1.5 rounded-full text-white text-caption2 font-bold flex items-center justify-center tabular-nums ${
                    dpLewat ? "bg-negative" : "bg-warning"
                  }`}
                >
                  {notaDp.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 text-label-2 hover:text-label active:scale-90 transition-all"
              aria-label="Tutup POS"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
          {/* Mobile sub-menu bar */}
          <div className="md:hidden p-3.5 apple-bar border-b border-sep shrink-0">
            <div className="flex apple-segmented p-1 rounded-full gap-1 overflow-x-auto no-scrollbar">
              {(["JUALAN", "ISI GAME", "SERVIS"] as const).map((sub) => {
                const hasCategoryUpdate =
                  sub === "ISI GAME"
                    ? games.some((g) => catalogChanges[g.id] !== undefined)
                    : products.some((p) => p.category === sub && catalogChanges[p.id] !== undefined);

                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setActiveSub(sub)}
                    className={`flex-1 min-w-[75px] min-h-[38px] text-caption font-semibold rounded-full tracking-wide transition-all relative ${
                      activeSub === sub
                        ? "apple-segmented-thumb text-label"
                        : "text-label-2 hover:text-label hover:bg-white/30 dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1">
                      <span>{sub}</span>
                      {hasCategoryUpdate && (
                        <span className="w-2 h-2 rounded-full bg-negative animate-pulse shrink-0" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {isSuperAdminOrOwner && activeSub === "JUALAN" && (
              <p className="mt-2.5 text-caption leading-snug text-label-2">
                Tambah & ubah barang jualan (harga, modal, stok) di{" "}
                <b className="text-label">Dashboard › Input › Atur Stok</b>.
              </p>
            )}
            {isSuperAdminOrOwner && activeSub === "SERVIS" && (
              <div className="mt-3 flex gap-2">
                <Button
                  variant="filled"
                  size="md"
                  className="flex-1"
                  icon={<PlusCircle />}
                  onClick={() => {
                    setNewProdCategory("SERVIS");
                    setOpenAddProduct(true);
                  }}
                >
                  Tambah Produk
                </Button>
                {products.length === 0 && (
                  <Button
                    variant="gray"
                    size="md"
                    className="flex-1"
                    icon={<Sparkles />}
                    onClick={handleInitializeDefaults}
                  >
                    Inisialisasi Awal
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Desktop macOS Source-List Sidebar */}
          <div className="hidden md:flex flex-col w-56 border-r border-sep bg-surface/50 p-3.5 shrink-0 justify-between">
            <div className="space-y-1.5">
              <div className="px-2.5 pb-1">
                <Eyebrow>Kategori POS</Eyebrow>
              </div>
              {(["JUALAN", "ISI GAME", "SERVIS"] as const).map((sub) => {
                const count =
                  sub === "ISI GAME" ? games.length : products.filter((p) => p.category === sub).length;

                const hasCategoryUpdate =
                  sub === "ISI GAME"
                    ? games.some((g) => catalogChanges[g.id] !== undefined)
                    : products.some((p) => p.category === sub && catalogChanges[p.id] !== undefined);

                const active = activeSub === sub;

                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setActiveSub(sub)}
                    className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-tile font-semibold text-footnote tracking-wide transition-all ${
                      active
                        ? "bg-action text-action-label shadow-sm"
                        : "text-label-2 hover:bg-fill/70 hover:text-label"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {sub}
                      {hasCategoryUpdate && (
                        <span className="w-2 h-2 rounded-full bg-negative animate-pulse shrink-0" />
                      )}
                    </span>
                    <span
                      className={`text-caption2 px-2 py-0.5 rounded-full font-bold tabular-nums ${
                        active ? "bg-action-label/20 text-action-label" : "bg-fill text-label-2"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 pt-3 border-t border-sep">
              {isSuperAdminOrOwner && products.length === 0 && (
                <Button
                  variant="gray"
                  size="md"
                  block
                  icon={<Sparkles />}
                  onClick={handleInitializeDefaults}
                >
                  Inisialisasi Produk
                </Button>
              )}
              {isSuperAdminOrOwner && activeSub === "SERVIS" && (
                <Button
                  variant="filled"
                  size="md"
                  block
                  icon={<PlusCircle />}
                  onClick={() => {
                    setNewProdCategory("SERVIS");
                    setOpenAddProduct(true);
                  }}
                >
                  Tambah Produk
                </Button>
              )}
            </div>
          </div>

          {/* CENTER: CATALOG GRID VIEW */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {isSuperAdminOrOwner && (
              <div className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-sep bg-surface/40 shrink-0">
                <span className="text-caption font-medium text-label-2">
                  Katalog {activeSub} &mdash; Klik item untuk menambahkan ke keranjang
                </span>
                {activeSub === "SERVIS" && products.length > 0 && (
                  <Button
                    variant="gray"
                    size="sm"
                    icon={<PlusCircle />}
                    onClick={() => {
                      setNewProdCategory("SERVIS");
                      setOpenAddProduct(true);
                    }}
                  >
                    Tambah Produk Baru
                  </Button>
                )}
              </div>
            )}

            {/* Search Bar */}
            <div className="px-4 py-2.5 md:px-6 md:py-3 border-b border-sep bg-surface/60 shrink-0">
              <SearchField value={searchQuery} onChange={setSearchQuery} placeholder="Cari produk..." />
            </div>

            {/* Sub-Category Pills for JUALAN */}
            {activeSub === "JUALAN" && (
              <div className="px-4 pt-3 border-b border-sep bg-surface/40 shrink-0">
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
                    if (count === 0 && activeJualanSub !== subJualan) return null;

                    const hasSubUpdate = products.some(
                      (p) =>
                        p.category === "JUALAN" &&
                        kondisiProduk(p) === activeKondisi &&
                        getSubCategory(p) === subJualan &&
                        catalogChanges[p.id] !== undefined
                    );
                    const active = activeJualanSub === subJualan;

                    return (
                      <button
                        key={subJualan}
                        type="button"
                        onClick={() => setActiveJualanSub(subJualan)}
                        className={`flex items-center gap-1.5 px-3 min-h-[34px] rounded-full text-caption font-semibold whitespace-nowrap active:scale-95 transition-all relative ${
                          active
                            ? "bg-action text-action-label shadow-sm"
                            : "bg-surface text-label-2 ring-1 ring-edge hover:text-label"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          {subJualan}
                          {hasSubUpdate && (
                            <span className="w-2 h-2 rounded-full bg-negative animate-pulse shrink-0" />
                          )}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                            active ? "bg-action-label/20 text-action-label" : "bg-fill text-label-3"
                          }`}
                        >
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
              <div className="px-4 py-3 border-b border-sep bg-surface/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                {(["PS3 CFW/HEN", "PS4 HEN", "PS5 HEN", "Switch CFW", "PC"] as const).map((subIsiGame) => {
                  const count = games.filter((g) => g.platform === subIsiGame).length;
                  const hasSubUpdate = games.some(
                    (g) => g.platform === subIsiGame && catalogChanges[g.id] !== undefined
                  );
                  const active = activeIsiGameSub === subIsiGame;

                  return (
                    <button
                      key={subIsiGame}
                      type="button"
                      onClick={() => setActiveIsiGameSub(subIsiGame)}
                      className={`flex items-center gap-1.5 px-3 min-h-[34px] rounded-full text-caption font-semibold whitespace-nowrap active:scale-95 transition-all relative ${
                        active
                          ? "bg-action text-action-label shadow-sm"
                          : "bg-surface text-label-2 ring-1 ring-edge hover:text-label"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {subIsiGame}
                        {hasSubUpdate && (
                          <span className="w-2 h-2 rounded-full bg-negative animate-pulse shrink-0" />
                        )}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${
                          active ? "bg-action-label/20 text-action-label" : "bg-fill text-label-3"
                        }`}
                      >
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
                <EmptyState icon={<ShoppingCart />} title="Katalog Kosong" className="my-6">
                  <p>
                    {activeSub === "JUALAN"
                      ? `Belum ada barang ${activeKondisi === "SEKEN" ? "seken" : "baru"} di kategori ini.`
                      : `Belum ada produk di kategori ${activeSub}.`}
                    {isSuperAdminOrOwner &&
                      (activeSub === "JUALAN"
                        ? " Tambahkan lewat Dashboard › Input › Atur Stok."
                        : " Klik tombol di bawah untuk menambahkan produk.")}
                  </p>
                  {isSuperAdminOrOwner && activeSub === "SERVIS" && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="filled"
                        size="sm"
                        icon={<PlusCircle />}
                        onClick={() => {
                          setNewProdCategory("SERVIS");
                          setOpenAddProduct(true);
                        }}
                      >
                        Tambah Produk Pertama
                      </Button>
                    </div>
                  )}
                </EmptyState>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 md:gap-3 pb-24 md:pb-6">
                  {filteredProducts.map((p) => {
                    const cartItem = cart.find((item) => item.id === p.id);
                    const qty = cartItem?.quantity || 0;
                    const changeType = catalogChanges[p.id];
                    const thumbSrc = resolveProductThumb(p);

                    return (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={`group relative overflow-hidden rounded-tile apple-card shadow-card transition-all cursor-pointer flex flex-col active:scale-[0.98] ${
                          qty > 0 ? "ring-2 ring-action" : "ring-1 ring-edge hover:ring-label-3"
                        }`}
                      >
                        {/* Selected Indicator Badge (Bottom Right) */}
                        {qty > 0 && (
                          <div className="absolute bottom-2 right-2 z-10 min-w-[22px] h-[22px] px-1 rounded-full bg-action text-action-label font-bold text-[11px] tabular-nums flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200">
                            {qty}
                          </div>
                        )}

                        {/* Super Admin Edit Product Button (Top Right) */}
                        {isSuperAdminOrOwner && p.category !== "ISI GAME" && p.category !== "JUALAN" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(p);
                            }}
                            className="absolute top-1.5 right-1.5 z-10 w-7 h-7 rounded-full bg-surface/85 backdrop-blur-md text-label-2 hover:text-label flex items-center justify-center shadow-sm ring-1 ring-edge active:scale-90 transition-all"
                            title="Edit Produk"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Pencil size={12} />
                          </button>
                        )}

                        {/* Product Image */}
                        <div
                          className={`w-full bg-fill flex items-center justify-center overflow-hidden shrink-0 relative ${
                            p.category === "ISI GAME" ? "aspect-[3/4]" : "aspect-square"
                          }`}
                        >
                          {thumbSrc ? (
                            <>
                              <img
                                src={thumbSrc}
                                alt={p.name}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const fallback = e.currentTarget.parentElement?.querySelector(".img-fallback");
                                  if (fallback) fallback.classList.remove("hidden");
                                }}
                              />
                              <div className="img-fallback hidden text-2xl text-label-3">📦</div>
                            </>
                          ) : (
                            <div className="text-2xl text-label-3">📦</div>
                          )}

                          {/* Badge stok jualan (Bottom Left) */}
                          {(() => {
                            const b = stokBadge(p);
                            return b ? (
                              <div
                                className={`absolute bottom-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm select-none ${
                                  b.tone === "habis"
                                    ? "bg-negative text-white"
                                    : b.tone === "menipis"
                                      ? "bg-warning text-white"
                                      : b.tone === "belum"
                                        ? "bg-label-3/85 text-white"
                                        : "bg-black/75 text-white"
                                }`}
                              >
                                {b.label}
                              </div>
                            ) : null;
                          })()}

                          {/* Catalog Update Badge */}
                          {changeType && (
                            <div className="absolute top-1.5 left-1.5 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shadow-md bg-negative text-white select-none animate-pulse">
                              {changeType}
                            </div>
                          )}
                        </div>

                        {/* Card Details */}
                        <div className="p-2.5 flex-1 flex flex-col justify-between gap-1 min-w-0">
                          <div className="flex flex-col gap-1">
                            <h4 className="font-semibold text-caption text-label leading-snug line-clamp-2 min-h-[2rem]">
                              {p.name}
                            </h4>
                            {p.category === "JUALAN" && searchQuery.trim() !== "" && (
                              <div>
                                <Pill tone={kondisiProduk(p) === "SEKEN" ? "warning" : "neutral"}>
                                  {kondisiProduk(p) === "SEKEN" ? "SEKEN" : "BARU"}
                                </Pill>
                              </div>
                            )}
                            {p.category === "ISI GAME" && (
                              <div className="flex items-center gap-1.5">
                                <Pill tone="neutral">{p.platform}</Pill>
                                {p.size && (
                                  <span className="text-caption2 font-medium text-label-2 font-mono">
                                    {p.size}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-1">
                            {p.category === "JUALAN" && !p.price ? (
                              <Pill color="purple">BONUS · Rp 0</Pill>
                            ) : (
                              <span className="font-bold text-footnote text-label font-mono tabular-nums">
                                {rupiah(p.price)}
                              </span>
                            )}

                            {qty > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromCart(p.id);
                                }}
                                aria-label={`Kurangi ${p.name}`}
                                className="w-7 h-7 rounded-full bg-fill hover:brightness-95 dark:hover:brightness-110 text-label-2 hover:text-label flex items-center justify-center active:scale-90 transition-all"
                              >
                                <Minus size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: STATIC CART (Desktop only) */}
          <div className="hidden md:flex flex-col w-[380px] border-l border-sep apple-bar shrink-0 min-h-0">
            <div className="px-4 py-3 border-b border-sep flex items-center justify-between bg-surface/60 shrink-0">
              <Eyebrow>Keranjang Belanja</Eyebrow>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-caption font-semibold text-negative hover:underline flex items-center gap-1 active:scale-95"
                >
                  <Trash2 size={12} />
                  Bersihkan
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2 min-h-0 no-scrollbar bg-canvas/50">
              {cart.length === 0 ? (
                <EmptyState icon={<ShoppingCart />} title="Keranjang masih kosong" className="my-8">
                  Pilih produk dari katalog di kiri
                </EmptyState>
              ) : (
                renderCartItems(false)
              )}
            </div>

            <div className="p-4 bg-surface border-t border-sep shrink-0">{renderCartFooter(false)}</div>
          </div>
        </div>

        {/* FLOATING ACTIONS PANEL (Mobile only) */}
        {cart.length > 0 && (
          <div className="md:hidden fixed bottom-[max(18px,env(safe-area-inset-bottom))] left-0 right-0 px-4 z-40 animate-in slide-in-from-bottom-5 duration-300">
            <button
              type="button"
              onClick={() => setOpenMobileCart(true)}
              className="w-full flex items-center justify-between px-5 min-h-[54px] rounded-card bg-action text-action-label font-semibold shadow-card active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <ShoppingCart size={18} />
                  <span className="absolute -top-1.5 -right-2 bg-action-label text-action font-bold text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shadow-sm tabular-nums">
                    {totalCartQty}
                  </span>
                </div>
                <span className="text-footnote font-bold tracking-wide">LIHAT KERANJANG</span>
              </div>
              <span className="text-headline font-bold font-mono tabular-nums">{rupiah(total)} →</span>
            </button>
          </div>
        )}
      </div>

      {/* MOBILE CART SHEET */}
      <div className="md:hidden">
        <Sheet
          open={openMobileCart}
          onClose={() => setOpenMobileCart(false)}
          title="Keranjang Belanja"
          subtitle={`${totalCartQty} item · ${rupiah(total)}`}
          icon={<ShoppingCart />}
          iconColor="gray"
          size="md"
          variant="grouped"
          zClassName="z-[150]"
          footer={renderCartFooter(true)}
        >
          {cart.length === 0 ? (
            <EmptyState icon={<ShoppingCart />} title="Keranjang masih kosong">
              Pilih produk dari katalog terlebih dahulu
            </EmptyState>
          ) : (
            <div className="space-y-2">{renderCartItems(true)}</div>
          )}
        </Sheet>
      </div>

      {/* TAMBAH PRODUK SHEET (Super Admin only) */}
      <Sheet
        open={openAddProduct && isSuperAdminOrOwner}
        onClose={() => setOpenAddProduct(false)}
        title="Tambah Produk Baru"
        subtitle="Produk baru akan tersimpan ke database & muncul di katalog POS"
        icon={<PlusCircle />}
        iconColor="gray"
        size="sm"
        variant="grouped"
        zClassName="z-[200]"
      >
        <form onSubmit={handleAddProductSubmit} className="space-y-3">
          <Card bodyClassName="space-y-3.5">
            <div>
              <label className={labelCls}>Nama Barang</label>
              <input
                type="text"
                required
                placeholder="Contoh: Kabel HDMI 2 Meter"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Harga (Rupiah)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subhead text-label-3">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder="35.000"
                  value={newProdPrice === "" ? "" : formatRibuanInput(newProdPrice, { allowZero: true })}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setNewProdPrice(raw === "" ? "" : Number(raw));
                  }}
                  className={`${inputCls} pl-10 font-mono tabular-nums`}
                />
              </div>
              {newProdPrice !== "" && newProdPrice >= 0 && (
                <div className="text-caption font-semibold text-label-2 font-mono mt-1">
                  Preview: {rupiah(Number(newProdPrice))}
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Kategori</label>
              <select
                value={newProdCategory}
                onChange={(e) => setNewProdCategory(e.target.value as any)}
                className={inputCls}
              >
                <option value="SERVIS">SERVIS (Jasa Service Stik / Konsol)</option>
              </select>
            </div>

            {newProdCategory === "SERVIS" && (
              <div>
                <label className={labelCls}>Barang Stok (dipotong saat nota dicetak)</label>
                <StokRefSelect
                  value={newProdStokRef}
                  onChange={setNewProdStokRef}
                  categories={stokCats}
                  data={stokData}
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label className={labelCls}>Foto Produk (Maks 2MB)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewProdImage(e.target.files?.[0] ?? null)}
                className="w-full text-caption text-label-2 file:mr-3 file:py-2 file:px-3.5 file:rounded-field file:border-0 file:text-caption file:font-semibold file:bg-fill file:text-label hover:file:brightness-95 cursor-pointer"
              />
            </div>
          </Card>

          <Button type="submit" variant="filled" size="lg" block loading={isUploading}>
            {isUploading ? "Mengunggah..." : "Simpan Produk"}
          </Button>
        </form>
      </Sheet>

      {/* EDIT PRODUK SHEET (Super Admin only) */}
      <Sheet
        open={!!(openEditProduct && isSuperAdminOrOwner && selectedProductForEdit)}
        onClose={() => {
          setOpenEditProduct(false);
          setSelectedProductForEdit(null);
        }}
        title="Edit Produk"
        subtitle="Ubah data produk atau hapus produk dari database"
        icon={<Pencil />}
        iconColor="gray"
        size="sm"
        variant="grouped"
        zClassName="z-[200]"
      >
        {selectedProductForEdit && (
          <form onSubmit={handleEditProductSubmit} className="space-y-3">
            <Card bodyClassName="space-y-3.5">
              <div>
                <label className={labelCls}>Nama Barang</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kabel HDMI 2 Meter"
                  value={editProdName}
                  onChange={(e) => setEditProdName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Harga (Rupiah)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-subhead text-label-3">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="35.000"
                    value={editProdPrice === "" ? "" : formatRibuanInput(editProdPrice, { allowZero: true })}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      setEditProdPrice(raw === "" ? "" : Number(raw));
                    }}
                    className={`${inputCls} pl-10 font-mono tabular-nums`}
                  />
                </div>
                {editProdPrice !== "" && editProdPrice >= 0 && (
                  <div className="text-caption font-semibold text-label-2 font-mono mt-1">
                    Preview: {rupiah(Number(editProdPrice))}
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Kategori</label>
                <select
                  value={editProdCategory}
                  onChange={(e) => setEditProdCategory(e.target.value as any)}
                  className={inputCls}
                >
                  {editProdCategory === "RENTAL" && (
                    <option value="RENTAL">RENTAL (lama — tidak tampil di POS)</option>
                  )}
                  <option value="SERVIS">SERVIS (Jasa Service Stik / Konsol)</option>
                </select>
              </div>

              {editProdCategory === "SERVIS" && (
                <div>
                  <label className={labelCls}>Barang Stok (dipotong saat nota dicetak)</label>
                  <StokRefSelect
                    value={editProdStokRef}
                    onChange={setEditProdStokRef}
                    categories={stokCats}
                    data={stokData}
                    className={inputCls}
                  />
                </div>
              )}

              <div>
                <label className={labelCls}>Foto Baru (Opsional, Maks 2MB)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditProdImage(e.target.files?.[0] ?? null)}
                  className="w-full text-caption text-label-2 file:mr-3 file:py-2 file:px-3.5 file:rounded-field file:border-0 file:text-caption file:font-semibold file:bg-fill file:text-label hover:file:brightness-95 cursor-pointer"
                />
                {editProdImageUrl && !editProdImage && (
                  <div className="mt-2 text-caption text-label-2 flex items-center gap-1.5">
                    <span className="font-semibold">Foto saat ini:</span>
                    <a
                      href={editProdImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-tint hover:underline truncate max-w-[200px]"
                    >
                      Lihat Foto
                    </a>
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-2">
              <Button type="submit" variant="filled" size="lg" block loading={isUploading}>
                {isUploading ? "Mengunggah..." : "Simpan Perubahan"}
              </Button>
              <Button
                variant="destructive"
                size="lg"
                block
                disabled={isUploading}
                onClick={() => handleDeleteProduct(selectedProductForEdit.id)}
              >
                Hapus Produk
              </Button>
            </div>
          </form>
        )}
      </Sheet>

      {/* QRIS POPUP SHEET */}
      <Sheet
        open={showQrisModal}
        onClose={() => setShowQrisModal(false)}
        title="QRIS Pembayaran"
        subtitle="Scan kode QRIS di bawah ini untuk pembayaran transfer"
        size="sm"
        variant="grouped"
        zClassName="z-[250]"
        footer={
          <Button variant="filled" size="lg" block onClick={() => setShowQrisModal(false)}>
            Tutup
          </Button>
        }
      >
        <div className="w-full bg-white rounded-tile overflow-hidden ring-1 ring-edge shadow-card">
          <img src={qrisImg} alt="QRIS" className="w-full h-auto object-contain block" />
        </div>
      </Sheet>

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
        dipesan={dipesan}
        onCompleted={() => {
          setCart([]);
          setOpenMobileCart(false);
        }}
        hitungDiskon={(items) => calculatePOSDiscount(items, promosConfig)}
      />

      <NotaDpSheet
        open={openDp}
        onClose={() => setOpenDp(false)}
        list={notaDp}
        isOwner={isSuperAdminOrOwner}
        kasirNama={adminName}
        data={stokData}
      />

      {/* Peringatan stok dipesan DP */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-[max(96px,calc(env(safe-area-inset-bottom)+88px))] z-[240] w-[calc(100%-32px)] max-w-sm flex items-start gap-2 rounded-card bg-action text-action-label px-4 py-3 text-footnote font-semibold leading-snug shadow-card backdrop-blur animate-in fade-in slide-in-from-bottom-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-warning" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
