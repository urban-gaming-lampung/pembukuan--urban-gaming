import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  QrCode, ScanLine, Camera, Gamepad2, Monitor, Smartphone, 
  Plus, Trash2, Edit, Save, CheckCircle2, XCircle, AlertCircle, 
  Upload, Activity, History, Sparkles, Download, RefreshCw, X, Eye
} from "lucide-react";
import { doc, setDoc, onSnapshot, collection, deleteDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import html2canvas from "html2canvas";
import { Html5Qrcode } from "html5-qrcode";
import Section from "./common/Section";
import jsPDF from "jspdf";

type DeviceType = "ps3" | "ps4" | "stik_ps3" | "stik_ps4" | "tv" | "playbox";

interface RegisteredDevice {
  id: string; // type_number e.g. ps4_03
  type: DeviceType;
  number: number;
  stikType: "OP" | "OM" | "";
  status: "baik" | "rusak";
  keterangan: string;
  stickerColor: string;
  fontColor: string;
  updatedAt: number;
  updatedBy: string;
}

interface WidgetMonitoringDeviceProps {
  isOwner?: boolean;
}

const DEVICE_LABELS: Record<DeviceType, string> = {
  ps3: "PLAYSTATION 3",
  ps4: "PLAYSTATION 4",
  stik_ps3: "STIK PS3",
  stik_ps4: "STIK PS4",
  tv: "TV MONITOR",
  playbox: "PLAYBOX / PORTABEL"
};

const PRESET_COLORS = [
  { name: "Cyber Black", bg: "#000000", text: "#ffffff" },
  { name: "Clean White", bg: "#ffffff", text: "#000000" },
  { name: "Neon Yellow", bg: "#facc15", text: "#000000" },
  { name: "Neon Blue", bg: "#1d4ed8", text: "#ffffff" },
  { name: "Acid Green", bg: "#15803d", text: "#ffffff" },
  { name: "Crimson Red", bg: "#b91c1c", text: "#ffffff" },
  { name: "Gaming Purple", bg: "#6d28d9", text: "#ffffff" },
];

const preloadQrCode = (id: string): Promise<string> => {
  return new Promise((resolve) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(id)}&ecc=M`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          resolve(canvas.toDataURL("image/png"));
          return;
        } catch (e) {
          console.error("CORS canvas conversion failed for", id, e);
        }
      }
      resolve(url); // fallback
    };
    img.onerror = () => {
      resolve(url); // fallback
    };
  });
};

const WidgetMonitoringDevice: React.FC<WidgetMonitoringDeviceProps> = ({ isOwner = false }) => {
  // Navigation sub-tabs for owner
  const [activeSubTab, setActiveSubTab] = useState<"kondisi" | "generator" | "history">("kondisi");

  // Auth State
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setCurrentUserEmail(u?.email || null);
    });
    return () => unsub();
  }, []);

  // Master Capacities State
  const [masterCapacities, setMasterCapacities] = useState<Record<DeviceType, number>>({
    ps3: 0,
    ps4: 0,
    stik_ps3: 0,
    stik_ps4: 0,
    tv: 0,
    playbox: 0
  });
  const [tempCapacities, setTempCapacities] = useState<Record<DeviceType, string>>({
    ps3: "0",
    ps4: "0",
    stik_ps3: "0",
    stik_ps4: "0",
    tv: "0",
    playbox: "0"
  });
  const [isEditingMaster, setIsEditingMaster] = useState(false);

  // Registered Devices from Firestore
  const [devices, setDevices] = useState<RegisteredDevice[]>([]);
  const [devicesLoaded, setDevicesLoaded] = useState(false);

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanningError, setScanningError] = useState<string | null>(null);
  const qrCodeRef = useRef<Html5Qrcode | null>(null);

  // Selected device for Status Update Modal
  const [updatingDevice, setUpdatingDevice] = useState<Partial<RegisteredDevice> | null>(null);
  const [updateStatus, setUpdateStatus] = useState<"baik" | "rusak">("baik");
  const [updateKeterangan, setUpdateKeterangan] = useState("");

  // Generator form state
  const [genType, setGenType] = useState<DeviceType>("ps4");
  const [genNumber, setGenNumber] = useState<number | "">(1);
  const [genStikType, setGenStikType] = useState<"OP" | "OM" | "">("OM");
  const [genBgColor, setGenBgColor] = useState("#1e1b4b");
  const [genTextColor, setGenTextColor] = useState("#ffffff");
  const [editingStickerId, setEditingStickerId] = useState<string | null>(null);

  const stickerPreviewRef = useRef<HTMLDivElement>(null);

  // PDF Download States
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfLoadingText, setPdfLoadingText] = useState("");
  const [preloadedQrCodes, setPreloadedQrCodes] = useState<Record<string, string>>({});

  const pages = useMemo(() => {
    const sortedDevices = [...devices].sort(
      (a, b) => a.type.localeCompare(b.type) || a.number - b.number
    );
    const itemsPerPage = 24;
    const chunks: RegisteredDevice[][] = [];
    for (let i = 0; i < sortedDevices.length; i += itemsPerPage) {
      chunks.push(sortedDevices.slice(i, i + itemsPerPage));
    }
    return chunks;
  }, [devices]);

  // Listen to Master Capacities
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "data", "master_devices"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Record<DeviceType, number>;
        const sanitized: Record<DeviceType, number> = {
          ps3: data.ps3 || 0,
          ps4: data.ps4 || 0,
          stik_ps3: data.stik_ps3 || 0,
          stik_ps4: data.stik_ps4 || 0,
          tv: data.tv || 0,
          playbox: data.playbox || 0
        };
        setMasterCapacities(sanitized);
        setTempCapacities({
          ps3: String(sanitized.ps3),
          ps4: String(sanitized.ps4),
          stik_ps3: String(sanitized.stik_ps3),
          stik_ps4: String(sanitized.stik_ps4),
          tv: String(sanitized.tv),
          playbox: String(sanitized.playbox)
        });
      }
    });
    return () => unsub();
  }, []);

  // Listen to Registered Devices
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "monitoring_devices"), (snap) => {
      const list: RegisteredDevice[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as RegisteredDevice);
      });
      setDevices(list);
      setDevicesLoaded(true);
    });
    return () => unsub();
  }, []);

  // Save Master Capacities
  const handleSaveMaster = async () => {
    if (!isOwner) return;
    const updatePayload: Record<DeviceType, number> = {
      ps3: Math.max(0, parseInt(tempCapacities.ps3) || 0),
      ps4: Math.max(0, parseInt(tempCapacities.ps4) || 0),
      stik_ps3: Math.max(0, parseInt(tempCapacities.stik_ps3) || 0),
      stik_ps4: Math.max(0, parseInt(tempCapacities.stik_ps4) || 0),
      tv: Math.max(0, parseInt(tempCapacities.tv) || 0),
      playbox: Math.max(0, parseInt(tempCapacities.playbox) || 0)
    };
    try {
      await setDoc(doc(db, "data", "master_devices"), updatePayload, { merge: true });
      setIsEditingMaster(false);
    } catch (e) {
      console.error("Error saving master capacities:", e);
      alert("Gagal menyimpan data master kapasitas.");
    }
  };

  // QR Scanning trigger
  const startScanning = async () => {
    setShowScanner(true);
    setScanningError(null);
    setTimeout(async () => {
      try {
        const element = document.getElementById("qr-reader-view");
        if (!element) {
          console.warn("qr-reader-view not found in DOM yet");
          return;
        }

        const html5QrCode = new Html5Qrcode("qr-reader-view");
        qrCodeRef.current = html5QrCode;
        
        const config = { 
          fps: 15, 
          qrbox: (width: number, height: number) => {
            const size = Math.min(width, height) * 0.75;
            return { width: size, height: size };
          }
        };
        
        // Try environment/back camera first
        try {
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              handleScannedId(decodedText);
              stopScanning();
            },
            () => {} // scan silently
          );
        } catch (firstErr) {
          console.warn("Failed back camera, trying front camera...", firstErr);
          try {
            await html5QrCode.start(
              { facingMode: "user" },
              config,
              (decodedText) => {
                handleScannedId(decodedText);
                stopScanning();
              },
              () => {} // scan silently
            );
          } catch (secondErr) {
            console.warn("Failed front camera, trying default available camera...", secondErr);
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length > 0) {
              await html5QrCode.start(
                devices[0].id,
                config,
                (decodedText) => {
                  handleScannedId(decodedText);
                  stopScanning();
                },
                () => {} // scan silently
              );
            } else {
              throw new Error("No camera devices found");
            }
          }
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        setScanningError("Gagal mengakses kamera. Pastikan izin kamera telah diberikan atau gunakan opsi Upload Gambar.");
      }
    }, 350);
  };

  const stopScanning = async () => {
    if (qrCodeRef.current) {
      if (qrCodeRef.current.isScanning) {
        try {
          await qrCodeRef.current.stop();
        } catch (e) {
          console.error("Stop scanning error:", e);
        }
      }
      qrCodeRef.current = null;
    }
    setShowScanner(false);
  };

  useEffect(() => {
    const handleGlobalScan = () => {
      startScanning();
    };
    window.addEventListener("trigger-device-scan", handleGlobalScan);

    return () => {
      window.removeEventListener("trigger-device-scan", handleGlobalScan);
      if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        qrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Process scanned or manual device ID
  const handleScannedId = async (idText: string) => {
    const trimmedId = idText.trim();
    
    // Validate if it is a valid format: e.g. type_number
    const match = trimmedId.match(/^([a-z0-9_]+)_(\d+)$/);
    if (!match) {
      alert(`Format QR Code tidak dikenali: "${trimmedId}". Pastikan QR Code digenerate dari aplikasi ini.`);
      return;
    }

    const typeCandidate = match[1] as DeviceType;
    const numCandidate = parseInt(match[2]);

    if (!DEVICE_LABELS[typeCandidate]) {
      alert(`Tipe device "${typeCandidate}" tidak terdaftar dalam sistem.`);
      return;
    }

    // Lookup device in Firestore
    const existing = devices.find(d => d.id === trimmedId);

    if (existing) {
      setUpdatingDevice(existing);
      setUpdateStatus(existing.status);
      setUpdateKeterangan(existing.keterangan);
    } else {
      // Create temporary mock device if scanned unregistered sticker
      setUpdatingDevice({
        id: trimmedId,
        type: typeCandidate,
        number: numCandidate,
        status: "baik",
        keterangan: "",
        stikType: typeCandidate.startsWith("stik") ? "OM" : ""
      });
      setUpdateStatus("baik");
      setUpdateKeterangan("");
    }
  };

  // Upload scan file fallback
  const handleUploadScanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const html5QrCode = new Html5Qrcode("qr-reader-file-temp");
      html5QrCode.scanFile(file, false)
        .then((decodedText) => {
          handleScannedId(decodedText);
          html5QrCode.clear();
        })
        .catch((err) => {
          alert("Gagal membaca QR Code dari file. Pastikan QR code terlihat jelas & berada di tengah gambar.");
          console.error(err);
          html5QrCode.clear();
        });
    }
  };

  // Update device status in Firestore
  const handleSaveStatusUpdate = async () => {
    if (!updatingDevice?.id) return;
    
    const deviceId = updatingDevice.id;
    const isNew = !devices.some(d => d.id === deviceId);

    const updatedData: Partial<RegisteredDevice> = {
      status: updateStatus,
      keterangan: updateStatus === "rusak" ? updateKeterangan : "",
      updatedAt: Date.now(),
      updatedBy: currentUserEmail || "Admin"
    };

    try {
      if (isNew) {
        // If it's a completely new scanned device, initialize other values
        const payload: RegisteredDevice = {
          id: deviceId,
          type: updatingDevice.type as DeviceType,
          number: updatingDevice.number || 1,
          stikType: updatingDevice.stikType || "",
          status: updateStatus,
          keterangan: updateStatus === "rusak" ? updateKeterangan : "",
          stickerColor: "#1e1b4b", // default navy
          fontColor: "#ffffff",
          updatedAt: Date.now(),
          updatedBy: currentUserEmail || "Admin"
        };
        await setDoc(doc(db, "monitoring_devices", deviceId), payload);
      } else {
        await updateDoc(doc(db, "monitoring_devices", deviceId), updatedData);
      }
      setUpdatingDevice(null);
    } catch (e) {
      console.error("Error updating device status:", e);
      alert("Gagal mengupdate status kondisi device.");
    }
  };

  // Save/Generate Sticker Config
  const handleSaveSticker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    const numValue = genNumber === "" ? 1 : genNumber;
    const deviceId = `${genType}_${String(numValue).padStart(2, "0")}`;

    // check if it's already registered under another ID
    const duplicate = devices.find(d => d.id === deviceId && d.id !== editingStickerId);
    if (duplicate && !editingStickerId) {
      if (!confirm(`Unit ${DEVICE_LABELS[genType]} nomor ${numValue} sudah ada. Ingin menimpa desain stiker ini?`)) {
        return;
      }
    }

    try {
      const existingData = devices.find(d => d.id === deviceId);
      
      const payload: RegisteredDevice = {
        id: deviceId,
        type: genType,
        number: numValue,
        stikType: "",
        status: existingData?.status || "baik",
        keterangan: existingData?.keterangan || "",
        stickerColor: genBgColor,
        fontColor: genTextColor,
        updatedAt: Date.now(),
        updatedBy: currentUserEmail || "Owner"
      };

      await setDoc(doc(db, "monitoring_devices", deviceId), payload);
      
      // If we edited a sticker and changed its ID (type/number changed), delete the old one
      if (editingStickerId && editingStickerId !== deviceId) {
        await deleteDoc(doc(db, "monitoring_devices", editingStickerId));
      }

      setEditingStickerId(deviceId); // Display current preview
      alert("Stiker berhasil disimpan ke database!");
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan konfigurasi stiker.");
    }
  };

  // Open sticker editor from History
  const startEditSticker = (dev: RegisteredDevice) => {
    setGenType(dev.type);
    setGenNumber(dev.number);
    setGenStikType(dev.stikType);
    setGenBgColor(dev.stickerColor);
    setGenTextColor(dev.fontColor);
    setEditingStickerId(dev.id);
    setActiveSubTab("generator");
  };

  // Delete device registration
  const handleDeleteDevice = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus device ini dari daftar monitoring? Riwayat kondisi device ini akan hilang.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, "monitoring_devices", id));
      if (editingStickerId === id) {
        setEditingStickerId(null);
      }
    } catch (e) {
      console.error(e);
      alert("Gagal menghapus device.");
    }
  };

  // Download Sticker PNG
  const handleDownloadSticker = async () => {
    if (!stickerPreviewRef.current) return;
    try {
      // Create a temporary container for rendering off-screen
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.top = "-9999px";
      tempContainer.style.left = "-9999px";
      tempContainer.style.opacity = "1";
      tempContainer.style.visibility = "visible";
      
      // Copy the HTML content of the sticker
      tempContainer.innerHTML = stickerPreviewRef.current.outerHTML;
      document.body.appendChild(tempContainer);
      
      const clonedSticker = tempContainer.firstChild as HTMLDivElement;
      clonedSticker.style.transform = "none";
      clonedSticker.style.margin = "0";
      clonedSticker.style.position = "relative";
      clonedSticker.style.boxShadow = "none"; // Remove shadow for clean stickers
      
      // Wait for any images (like the QR code) inside the clone to load
      const images = clonedSticker.getElementsByTagName("img");
      if (images.length > 0) {
        const qrImg = images[0];
        if (!qrImg.complete) {
          await new Promise((resolve) => {
            qrImg.onload = resolve;
            qrImg.onerror = resolve; // Continue anyway if it fails
          });
        }
      }

      const canvas = await html2canvas(clonedSticker, {
        scale: 4, // 4x scale for high resolution print quality
        useCORS: true,
        backgroundColor: null,
        logging: false,
        width: 380,
        height: 228
      });

      document.body.removeChild(tempContainer);

      const link = document.createElement("a");
      link.download = `sticker_${editingStickerId || `${genType}_${String(genNumber === "" ? 1 : genNumber).padStart(2, "0")}`}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Error capturing sticker:", e);
      alert("Gagal mengunduh stiker PNG.");
    }
  };

  // Download All Stickers PDF
  const handleDownloadAllStickersPDF = async () => {
    if (devices.length === 0) {
      alert("Tidak ada stiker yang tersimpan di database.");
      return;
    }

    setIsGeneratingPdf(true);
    setPdfProgress(5);
    setPdfLoadingText("Menyiapkan data stiker...");

    try {
      const sortedDevices = [...devices].sort(
        (a, b) => a.type.localeCompare(b.type) || a.number - b.number
      );
      
      setPdfLoadingText("Mengunduh QR Code...");
      const loadedQrCodes: Record<string, string> = {};
      const totalDevices = sortedDevices.length;
      
      const batchSize = 5;
      for (let i = 0; i < totalDevices; i += batchSize) {
        const batch = sortedDevices.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (dev) => {
            const base64 = await preloadQrCode(dev.id);
            loadedQrCodes[dev.id] = base64;
          })
        );
        const loadedCount = Math.min(i + batchSize, totalDevices);
        setPdfProgress(Math.round(5 + (loadedCount / totalDevices) * 45));
      }

      setPreloadedQrCodes(loadedQrCodes);
      setPdfProgress(50);
      
      // Tunggu React untuk me-render halaman ke DOM
      await new Promise((resolve) => setTimeout(resolve, 650));

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
      });

      const scale = 2.5; // 2.5x scale memberikan keseimbangan ketajaman cetak & ukuran file optimal
      
      for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
        setPdfLoadingText(`Merender halaman ${pageIdx + 1} dari ${pages.length}...`);
        
        const pageEl = document.getElementById(`pdf-page-${pageIdx}`);
        if (!pageEl) {
          console.error(`Elemen halaman pdf-page-${pageIdx} tidak ditemukan!`);
          continue;
        }

        const canvas = await html2canvas(pageEl, {
          scale,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.82);

        if (pageIdx > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
        setPdfProgress(Math.round(50 + ((pageIdx + 1) / pages.length) * 45));
      }

      setPdfLoadingText("Menyimpan PDF...");
      setPdfProgress(98);
      
      pdf.save(`stiker_all_urban_gaming_${new Date().toISOString().slice(0, 10)}.pdf`);
      setPdfProgress(100);
      
      setTimeout(() => {
        setIsGeneratingPdf(false);
      }, 500);

    } catch (error) {
      console.error("Gagal generate PDF stiker:", error);
      alert("Terjadi kesalahan saat membuat PDF stiker.");
      setIsGeneratingPdf(false);
    }
  };

  // Helper to get device count by status
  const getDeviceStats = (type: DeviceType) => {
    const list = devices.filter(d => d.type === type);
    const capacity = masterCapacities[type] || 0;
    
    // Count broken
    const rusakCount = list.filter(d => d.status === "rusak").length;
    
    // We assume default status of capacity slots are "baik" unless flagged "rusak"
    const baikCount = Math.max(0, capacity - rusakCount);

    return { total: capacity, baik: baikCount, rusak: rusakCount };
  };

  // QR Code creation string helper
  const qrUrl = useMemo(() => {
    const numValue = genNumber === "" ? 1 : genNumber;
    const deviceId = editingStickerId || `${genType}_${String(numValue).padStart(2, "0")}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deviceId)}&ecc=M`;
  }, [editingStickerId, genType, genNumber]);

  return (
    <>
      <Section title="Monitoring Device (Kondisi Alat)">
        <div className="bg-white dark:bg-[#111111] border border-zinc-200 dark:border-white/10 rounded-2xl md:rounded-[32px] p-4 sm:p-6 lg:p-8 flex flex-col gap-6 w-full overflow-hidden relative shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-black/20">
          
          {/* Glassmorphic Background Blur */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 dark:bg-teal-500/5 blur-3xl rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

          {/* Owner Tab Pill Switcher */}
          {isOwner && (
            <div className="flex bg-zinc-100/80 dark:bg-[#1c1c1e] p-1 rounded-2xl self-start w-full sm:w-auto z-10 border border-zinc-200/50 dark:border-white/5 backdrop-blur-md">
              <button
                onClick={() => setActiveSubTab("kondisi")}
                className={`flex-1 sm:flex-initial px-5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeSubTab === "kondisi"
                    ? "bg-white dark:bg-black text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> Kondisi Device
              </button>
              <button
                onClick={() => {
                  setActiveSubTab("generator");
                  setEditingStickerId(null);
                }}
                className={`flex-1 sm:flex-initial px-5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeSubTab === "generator"
                    ? "bg-white dark:bg-black text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Sticker Generator
              </button>
              <button
                onClick={() => setActiveSubTab("history")}
                className={`flex-1 sm:flex-initial px-5 py-2.5 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  activeSubTab === "history"
                    ? "bg-white dark:bg-black text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                <History className="w-3.5 h-3.5" /> Riwayat Sticker
              </button>
            </div>
          )}

          {/* Tab 1: Kondisi Device (Visible to Admin & Owner) */}
          {(!isOwner || activeSubTab === "kondisi") && (
            <div className="flex flex-col gap-6 z-10 w-full animate-in fade-in duration-300">
              
              {/* Camera Scanner Trigger Card */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-zinc-50 dark:bg-white/5 p-5 sm:p-6 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-inner">
                <div className="flex items-center gap-4 text-left">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <QrCode className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-zinc-855 dark:text-zinc-100 flex items-center gap-1.5">
                      Scan QR Code Device
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md">
                      Gunakan kamera HP/laptop Anda untuk memindai kode QR stiker pada unit secara instan, atau upload file foto QR Code.
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto shrink-0">
                  <button
                    onClick={startScanning}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/15 active:scale-95"
                  >
                    <Camera className="w-4 h-4" /> Buka Kamera Scan
                  </button>

                  <label className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-zinc-800 hover:bg-zinc-55 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer">
                    <Upload className="w-4 h-4" /> Upload Foto QR
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadScanFile}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Master Inventaris Card (Visible to both Owner and Admin) */}
              <div className="bg-zinc-50 dark:bg-[#1C1C1E] p-5 rounded-[24px] border border-zinc-200 dark:border-white/5 shadow-inner w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold tracking-widest uppercase text-zinc-900 dark:text-white flex items-center gap-2">
                    <Save className="w-4 h-4 text-emerald-500" /> Master Inventaris Device
                  </h3>
                  {isOwner && (
                    <button
                      onClick={() => {
                        if (isEditingMaster) handleSaveMaster();
                        else setIsEditingMaster(true);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-black text-emerald-600 dark:text-emerald-405 font-bold border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all shadow-sm"
                    >
                      {isEditingMaster ? "Simpan" : "Edit"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {(Object.keys(DEVICE_LABELS) as DeviceType[]).map((type) => {
                    let inputIcon = <Gamepad2 className="w-4 h-4 text-emerald-500" />;
                    if (type.startsWith("stik")) inputIcon = <Gamepad2 className="w-4 h-4 text-blue-500" />;
                    if (type === "tv") inputIcon = <Monitor className="w-4 h-4 text-purple-500" />;
                    if (type === "playbox") inputIcon = <Smartphone className="w-4 h-4 text-amber-500" />;

                    return (
                      <div key={type} className="flex flex-col gap-1.5 bg-white dark:bg-black border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3 items-center justify-center shadow-sm">
                        <div className="flex items-center gap-1 text-[9px] font-black text-zinc-400 uppercase tracking-wider text-center truncate w-full justify-center">
                          {inputIcon} <span className="truncate">{DEVICE_LABELS[type]}</span>
                        </div>
                        {isEditingMaster && isOwner ? (
                          <input
                            type="number"
                            min="0"
                            value={tempCapacities[type]}
                            onChange={(e) => setTempCapacities({ ...tempCapacities, [type]: e.target.value })}
                            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2 py-1 text-zinc-900 dark:text-white font-mono font-bold text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        ) : (
                          <div className="w-full text-zinc-900 dark:text-white font-mono font-black text-base text-center py-0.5 select-none">
                            {masterCapacities[type]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Grid Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(Object.keys(DEVICE_LABELS) as DeviceType[]).map((type) => {
                  const stats = getDeviceStats(type);
                  const registeredForType = devices.filter(d => d.type === type);
                  
                  // Compute largest badge number to show
                  const maxRegisteredNum = registeredForType.reduce((max, d) => d.number > max ? d.number : max, 0);
                  const displayLimit = Math.max(stats.total, maxRegisteredNum);

                  let devIcon = <Gamepad2 className="w-5 h-5 text-emerald-555" />;
                  if (type.startsWith("stik")) devIcon = <Gamepad2 className="w-5 h-5 text-blue-500" />;
                  if (type === "tv") devIcon = <Monitor className="w-5 h-5 text-purple-500" />;
                  if (type === "playbox") devIcon = <Smartphone className="w-5 h-5 text-amber-500" />;

                  return (
                    <div
                      key={type}
                      className="bg-zinc-50 dark:bg-white/5 rounded-3xl p-5 border border-zinc-200/80 dark:border-white/5 flex flex-col justify-between shadow-sm min-h-[170px] transition-all hover:shadow-md"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 border-b border-zinc-200/50 dark:border-white/5 pb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-white dark:bg-black border border-zinc-200 dark:border-white/5 shadow-sm">
                              {devIcon}
                            </div>
                            <div className="text-left">
                              <h3 className="text-xs font-black tracking-wider text-zinc-900 dark:text-white uppercase">
                                {DEVICE_LABELS[type]}
                              </h3>
                              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
                                Kapasitas: {stats.total} unit
                              </p>
                            </div>
                          </div>
                          
                          {/* Mini Stats Pill */}
                          <div className="flex items-center gap-1.5 bg-white dark:bg-black px-2.5 py-1 rounded-full border border-zinc-200/50 dark:border-white/5 shadow-inner">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{stats.baik}</span>
                            <span className="text-[10px] font-medium text-zinc-400">|</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span className="text-[10px] font-black text-red-600 dark:text-red-400 tracking-tight">{stats.rusak}</span>
                          </div>
                        </div>

                        {/* Badges Grid */}
                        {displayLimit > 0 ? (
                          <div className="flex flex-wrap gap-2 pt-2 justify-start">
                            {Array.from({ length: displayLimit }).map((_, index) => {
                              const badgeNum = index + 1;
                              const deviceId = `${type}_${String(badgeNum).padStart(2, "0")}`;
                              const registered = registeredForType.find(d => d.number === badgeNum);
                              
                              let badgeStyle = "bg-zinc-100/60 dark:bg-zinc-900/40 border-zinc-200/80 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 border-dashed"; // Unregistered
                              let labelSuffix = "";

                              if (registered) {
                                if (registered.status === "rusak") {
                                  badgeStyle = "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 shadow-sm animate-pulse";
                                } else {
                                  badgeStyle = "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 shadow-sm";
                                }
                                if (registered.stikType) {
                                  labelSuffix = ` ${registered.stikType}`;
                                }
                              }

                              return (
                                <button
                                  key={deviceId}
                                  onClick={() => handleScannedId(deviceId)}
                                  className={`relative border px-3 py-2 rounded-xl text-xs font-mono font-black transition-all hover:scale-105 active:scale-95 ${badgeStyle}`}
                                  title={registered?.status === "rusak" ? `RUSAK: ${registered.keterangan}` : `Kondisi Baik`}
                                >
                                  {String(badgeNum).padStart(2, "0")}
                                  {labelSuffix && (
                                    <span className="text-[8px] font-bold opacity-80 block -mt-0.5 leading-none">
                                      {labelSuffix}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-zinc-400 dark:text-zinc-500 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-black/20">
                            Belum ada unit terdaftar.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Sticker Generator (Owner Only) */}
          {isOwner && activeSubTab === "generator" && (
            <div className="flex flex-col lg:flex-row gap-8 z-10 w-full animate-in fade-in duration-300">
              
              {/* Generator Configuration Panel */}
              <div className="lg:w-1/2 flex flex-col gap-6">
                <form onSubmit={handleSaveSticker} className="flex flex-col gap-4 bg-zinc-50 dark:bg-white/5 p-6 rounded-3xl border border-zinc-200 dark:border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black tracking-widest uppercase text-zinc-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" /> Desain Sticker Unit
                    </h3>
                    {editingStickerId && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded-md">
                        Mode Edit: {editingStickerId}
                      </span>
                    )}
                  </div>

                  {/* Device Type */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tipe Device</label>
                    <select
                      value={genType}
                      onChange={(e) => {
                        setGenType(e.target.value as DeviceType);
                        setEditingStickerId(null);
                      }}
                      className="bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-3 text-zinc-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                    >
                      {(Object.keys(DEVICE_LABELS) as DeviceType[]).map(type => (
                        <option key={type} value={type}>{DEVICE_LABELS[type]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Number */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Nomor Unit</label>
                      <input
                        type="number"
                        min="1"
                        value={genNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setGenNumber("");
                          } else {
                            const parsed = parseInt(val);
                            setGenNumber(isNaN(parsed) ? 1 : parsed);
                          }
                          setEditingStickerId(null);
                        }}
                        className="bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-4 py-2 text-zinc-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                      />
                    </div>


                  </div>

                  {/* Preset Colors */}
                  <div className="flex flex-col gap-2 mt-2 text-left">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Preset Warna Premium</label>
                    <div className="grid grid-cols-3 gap-2">
                      {PRESET_COLORS.map((color, idx) => {
                        const isSelected = genBgColor === color.bg && genTextColor === color.text;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setGenBgColor(color.bg);
                              setGenTextColor(color.text);
                              setEditingStickerId(null);
                            }}
                            className={`h-9 px-2 rounded-xl text-[10px] font-bold transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-1 ${
                              isSelected ? "ring-2 ring-emerald-500 dark:ring-emerald-400" : "border border-zinc-200 dark:border-white/5"
                            }`}
                            style={{ backgroundColor: color.bg, color: color.text }}
                          >
                            {color.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Colors */}
                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Warna Background</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={genBgColor}
                          onChange={(e) => {
                            setGenBgColor(e.target.value);
                            setEditingStickerId(null);
                          }}
                          className="w-10 h-10 p-0.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-black cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={genBgColor.toUpperCase()}
                          onChange={(e) => {
                            setGenBgColor(e.target.value);
                            setEditingStickerId(null);
                          }}
                          className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-3 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-zinc-800 dark:text-zinc-200"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Warna Teks</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={genTextColor}
                          onChange={(e) => {
                            setGenTextColor(e.target.value);
                            setEditingStickerId(null);
                          }}
                          className="w-10 h-10 p-0.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-black cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          value={genTextColor.toUpperCase()}
                          onChange={(e) => {
                            setGenTextColor(e.target.value);
                            setEditingStickerId(null);
                          }}
                          className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-xl px-3 text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-zinc-800 dark:text-zinc-200"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2.5 mt-4">
                    {editingStickerId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStickerId(null);
                          setGenNumber(devices.length + 1);
                        }}
                        className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl px-4 py-3 text-xs font-black uppercase transition-all active:scale-95"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-3.5 text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-500/10 active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Simpan Stiker ke Database
                    </button>
                  </div>
                </form>
              </div>

              {/* Preview & Download Panel */}
              <div className="lg:w-1/2 flex flex-col items-center justify-center bg-zinc-55 dark:bg-[#18181b] p-6 sm:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800/60 shadow-inner">
                <h4 className="text-[10px] font-black tracking-widest uppercase text-zinc-400 mb-6 flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-emerald-555" /> Preview Desain Stiker</h4>

                {/* Sticker Elements Container */}
                <div className="relative border-4 border-dashed border-zinc-300 dark:border-zinc-800 p-2 sm:p-4 rounded-[28px] bg-zinc-100 dark:bg-black/40 shadow-inner w-full max-w-[420px] overflow-hidden flex items-center justify-center min-h-[180px] sm:min-h-[260px]">
                  <div className="scale-[0.75] min-[400px]:scale-[0.85] sm:scale-100 origin-center shrink-0 my-[-25px] sm:my-0">
                    <div
                      ref={stickerPreviewRef}
                      className="w-[380px] h-[228px] flex flex-row items-center justify-between p-6 relative select-none shadow-2xl"
                      style={{
                        backgroundColor: genBgColor,
                        color: genTextColor,
                        fontFamily: "Inter, Roboto, sans-serif",
                        borderRadius: "20px"
                      }}
                    >
                      {/* Left side details */}
                      <div className="flex-1 flex flex-col justify-between items-start h-full text-left pr-5">
                        <div className="flex flex-col items-start">
                          <h2 className="text-[13px] font-black tracking-[0.25em] leading-tight select-none uppercase">URBAN GAMING</h2>
                          <p className="text-[8px] font-black tracking-widest opacity-85 mt-1 uppercase select-none">
                          {genType.startsWith("stik") ? "CONTROLLER" : DEVICE_LABELS[genType]}
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-start gap-1.5 mt-2">
                        {/* Controller OP/OM side-by-side badges for crossing out */}
                        {genType.startsWith("stik") && (
                           <div className="flex items-center gap-1.5 select-none my-0.5">
                              {/* OM Badge: Black bg, white text */}
                              <span className="inline-flex items-center justify-center w-8 h-4 rounded border border-black bg-black text-white text-[9px] font-black tracking-wider leading-none shadow-sm">OM</span>
                              {/* OP Badge: White bg, black text */}
                              <span className="inline-flex items-center justify-center w-8 h-4 rounded border border-black bg-white text-black text-[9px] font-black tracking-wider leading-none shadow-sm">OP</span>
                           </div>
                         )}
                          <h1 className="text-5xl font-black font-mono tracking-tighter select-none leading-none">
                            {genNumber === "" ? "00" : String(genNumber).padStart(2, "0")}
                          </h1>
                        </div>
                      </div>

                      {/* Right side: QR Code */}
                      <div 
                        className={`p-3 rounded-2xl shadow-inner flex items-center justify-center shrink-0 border ${
                          genBgColor.toLowerCase() === "#ffffff" || genBgColor.toLowerCase() === "#fff"
                            ? "bg-white border-zinc-200" 
                            : "bg-white border-white/20"
                        }`}
                      >
                        <img
                          src={qrUrl}
                          alt="QR Code"
                          className="w-24 h-24 object-contain select-none"
                          crossOrigin="anonymous"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download Buttons */}
                <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full justify-center">
                  <button
                    type="button"
                    onClick={handleDownloadSticker}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-blue-500/10 active:scale-95 animate-in fade-in duration-300"
                  >
                    <Download className="w-4 h-4" /> Download Sticker (PNG)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAllStickersPDF}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-500/10 active:scale-95 animate-in fade-in duration-300"
                  >
                    <QrCode className="w-4 h-4" /> Download Semua Sticker (PDF)
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* Tab 3: History & Master Settings (Owner Only) */}
          {isOwner && activeSubTab === "history" && (
            <div className="flex flex-col gap-8 z-10 w-full animate-in fade-in duration-300">

              {/* History Section */}
              <div className="flex flex-col gap-4 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <h3 className="text-sm font-black tracking-widest uppercase text-zinc-900 dark:text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-emerald-500" /> Daftar Unit Terdaftar ({devices.length} Unit)
                  </h3>
                  {devices.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadAllStickersPDF}
                      className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Download Semua (PDF)
                    </button>
                  )}
                </div>

                {devices.length > 0 ? (
                  <>
                    {/* Desktop Responsive Table (visible on md screens and up) */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-zinc-200 dark:border-white/5 bg-white dark:bg-[#161618]">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-white/5 border-b border-zinc-200 dark:border-white/5 text-zinc-400 font-bold uppercase tracking-wider">
                            <th className="px-6 py-4">ID Unit</th>
                            <th className="px-6 py-4">Tipe Alat</th>
                            <th className="px-6 py-4">No</th>
                            <th className="px-6 py-4">Kategori Stik</th>
                            <th className="px-6 py-4">Kondisi</th>
                            <th className="px-6 py-4">Warna Stiker</th>
                            <th className="px-6 py-4">Diupdate Oleh</th>
                            <th className="px-6 py-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
                          {devices
                            .sort((a, b) => a.type.localeCompare(b.type) || a.number - b.number)
                            .map((dev) => (
                              <tr key={dev.id} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-mono font-bold text-zinc-800 dark:text-zinc-200">{dev.id}</td>
                                <td className="px-6 py-4 font-bold text-zinc-650 dark:text-zinc-300">{DEVICE_LABELS[dev.type]}</td>
                                <td className="px-6 py-4 font-mono text-zinc-800 dark:text-zinc-200">{String(dev.number).padStart(2, "0")}</td>
                                <td className="px-6 py-4">
                                  {dev.stikType ? (
                                    <span className={`px-2.5 py-0.5 font-black rounded-lg text-[9px] tracking-wider uppercase ${
                                      dev.stikType === "OM" 
                                        ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400" 
                                        : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                    }`}>
                                      {dev.stikType === "OM" ? "Original Mesin" : "Original Pabrik"}
                                    </span>
                                  ) : "-"}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                    dev.status === "baik" 
                                      ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                      : "bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse"
                                  }`}>
                                    {dev.status === "baik" ? "Normal" : "Rusak"}
                                  </span>
                                  {dev.status === "rusak" && dev.keterangan && (
                                    <p className="text-[10px] text-zinc-400 mt-0.5 italic max-w-xs truncate" title={dev.keterangan}>{dev.keterangan}</p>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded border border-white/10" style={{ backgroundColor: dev.stickerColor }} />
                                    <span className="font-mono text-[10px] text-zinc-400">{dev.stickerColor}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-zinc-400">
                                  {dev.updatedBy.split("@")[0]}
                                  <p className="text-[9px] opacity-75">{new Date(dev.updatedAt).toLocaleString("id-ID")}</p>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => startEditSticker(dev)}
                                      className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-650 dark:text-zinc-300 transition-colors"
                                      title="Edit sticker style"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDevice(dev.id)}
                                      className="p-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                      title="Hapus unit"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card-Based History (visible on mobile/tablet below md) */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                      {devices
                        .sort((a, b) => a.type.localeCompare(b.type) || a.number - b.number)
                        .map((dev) => (
                          <div key={dev.id} className="bg-white dark:bg-[#161618] border border-zinc-200 dark:border-white/5 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg border border-white/15 flex items-center justify-center text-xs font-mono font-black text-white shrink-0 shadow-sm" style={{ backgroundColor: dev.stickerColor }}>
                                  {dev.number}
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200 uppercase">{DEVICE_LABELS[dev.type]}</h4>
                                  <p className="text-[10px] font-mono text-zinc-400 mt-0.5">{dev.id}</p>
                                </div>
                              </div>
                              
                              {/* Condition Badge */}
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[9px] ${
                                dev.status === "baik" 
                                  ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                  : "bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse"
                              }`}>
                                {dev.status === "baik" ? "Normal" : "Rusak"}
                              </span>
                            </div>

                            {dev.stikType && (
                               <div className="flex items-center gap-2">
                                 <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Kategori:</span>
                                 <span className={`px-2 py-0.5 font-black rounded text-[9px] uppercase tracking-wider ${
                                   dev.stikType === "OM"
                                     ? "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                                     : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                                 }`}>
                                   {dev.stikType === "OM" ? "Original Mesin" : "Original Pabrik"}
                                 </span>
                               </div>
                             )}

                            {dev.status === "rusak" && dev.keterangan && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-black/35 p-2.5 rounded-xl border border-zinc-200/50 dark:border-white/5 italic">
                                {dev.keterangan}
                              </p>
                            )}

                            <div className="flex justify-between items-center text-[10px] text-zinc-400 border-t border-zinc-100 dark:border-white/5 pt-2.5 mt-1">
                              <div>
                                <span>Oleh: {dev.updatedBy.split("@")[0]}</span>
                                <span className="block text-[8px] opacity-75">{new Date(dev.updatedAt).toLocaleString("id-ID")}</span>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => startEditSticker(dev)} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-zinc-600 dark:text-zinc-300 transition-all">
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleDeleteDevice(dev.id)} className="p-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl transition-all">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-black/20">
                    Belum ada unit yang terdaftar. Gunakan Generator untuk mendaftarkan dan membuat stiker QR.
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </Section>

      {/* Hidden container for QR file reader temp scanner initialization */}
      <div id="qr-reader-file-temp" className="hidden" />

      {/* Modal 1: QR Scanner Modal (Floating) */}
      {showScanner && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={stopScanning}></div>
          <div className="relative w-full max-w-md bg-zinc-950 rounded-[32px] overflow-hidden border border-white/10 shadow-2xl z-10 animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-2 text-left">
                <QrCode className="w-5 h-5 text-emerald-400 animate-pulse" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Pindai QR Code Device</h3>
              </div>
              <button onClick={stopScanning} className="p-1.5 hover:bg-white/10 rounded-full text-zinc-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Camera Viewport */}
            <div id="qr-reader-view" className="w-full aspect-square bg-black overflow-hidden" />

            {/* Footer / Alternate Options */}
            <div className="p-5 bg-zinc-900/50 border-t border-white/5 flex flex-col gap-3">
              <p className="text-[11px] text-zinc-400 text-center">
                Posisikan QR Code di dalam kotak untuk memindai secara otomatis.
              </p>
              <div className="flex gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs font-bold text-white transition-all cursor-pointer">
                  <Upload className="w-4 h-4 text-emerald-400" /> Upload File QR
                  <input type="file" accept="image/*" onChange={handleUploadScanFile} className="hidden" />
                </label>
                <button onClick={stopScanning} className="flex-1 px-4 py-3 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 rounded-2xl text-xs font-bold transition-all">
                  Batal
                </button>
              </div>
            </div>

            {scanningError && (
              <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center z-20">
                <AlertCircle className="w-12 h-12 text-red-500 mb-3 animate-bounce" />
                <p className="text-sm text-zinc-300 font-bold mb-4">{scanningError}</p>
                <div className="flex flex-col gap-2 w-full">
                  <label className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/15 border border-white/15 rounded-2xl text-xs font-bold text-white transition-all cursor-pointer">
                    <Upload className="w-4 h-4 text-emerald-400" /> Upload File QR
                    <input type="file" accept="image/*" onChange={handleUploadScanFile} className="hidden" />
                  </label>
                  <button onClick={stopScanning} className="w-full px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-2xl text-xs font-bold transition-all">
                    Tutup
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}

      {/* Modal 2: Status Update Modal (Baik/Rusak + Keterangan) */}
      {updatingDevice && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setUpdatingDevice(null)}></div>
          <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl rounded-[32px] p-6 max-w-sm w-full shadow-2xl shadow-black/30 border border-zinc-100 dark:border-white/10 relative z-10 animate-in zoom-in-95 duration-200">
            
            <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-5"></div>
            
            <h3 className="text-lg font-black text-center text-zinc-950 dark:text-white uppercase tracking-tight">
              {DEVICE_LABELS[updatingDevice.type as DeviceType]}
            </h3>
            <p className="text-2xl font-black text-center text-emerald-600 dark:text-emerald-400 font-mono mt-1 mb-4">
              UNIT {String(updatingDevice.number).padStart(2, "0")}
            </p>

            <div className="flex flex-col gap-4">
              {/* Radio Group Status */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Kondisi Alat</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setUpdateStatus("baik")}
                    className={`py-3.5 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 border transition-all ${
                      updateStatus === "baik"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm font-black"
                        : "bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Kondisi Normal
                  </button>
                  <button
                    onClick={() => setUpdateStatus("rusak")}
                    className={`py-3.5 rounded-2xl font-bold text-xs flex flex-col items-center justify-center gap-1.5 border transition-all ${
                      updateStatus === "rusak"
                        ? "bg-red-500/10 border-red-500 text-red-600 dark:text-red-400 shadow-sm font-black"
                        : "bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-white/5"
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-red-500" /> Kondisi Rusak
                  </button>
                </div>
              </div>

              {/* Keterangan Kerusakan */}
              {updateStatus === "rusak" && (
                <div className="flex flex-col gap-1.5 text-left animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Keterangan Kerusakan</label>
                  <textarea
                    value={updateKeterangan}
                    onChange={(e) => setUpdateKeterangan(e.target.value)}
                    placeholder="Contoh: Tombol R2 macet, Analog kiri ngedrift..."
                    rows={3}
                    className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-white/10 rounded-2xl p-3 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Update Log metadata */}
              {updatingDevice.updatedAt && (
                <div className="text-[10px] text-zinc-450 dark:text-zinc-500 text-center">
                  Diupdate oleh: {updatingDevice.updatedBy?.split("@")[0]}
                  <span className="block mt-0.5">Waktu: {new Date(updatingDevice.updatedAt || 0).toLocaleString("id-ID")}</span>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setUpdatingDevice(null)}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold rounded-2xl py-3.5 transition-all text-xs"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveStatusUpdate}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl py-3.5 transition-all text-xs shadow-md shadow-emerald-500/10 active:scale-95"
                >
                  Simpan Status
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Off-screen PDF Page Renderer */}
      {isGeneratingPdf && (
        <div 
          id="pdf-render-pages-container"
          style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}
        >
          {pages.map((pageDevices, pageIdx) => (
            <div 
              key={pageIdx} 
              id={`pdf-page-${pageIdx}`}
              style={{
                width: "210mm",
                height: "297mm",
                padding: "11mm 15mm",
                boxSizing: "border-box",
                display: "grid",
                gridTemplateColumns: "repeat(3, 50mm)",
                gridTemplateRows: "repeat(8, 30mm)",
                columnGap: "15mm",
                rowGap: "5mm",
                backgroundColor: "#ffffff",
                position: "relative",
                overflow: "hidden"
              }}
            >
              {pageDevices.map((dev) => (
                <div
                  key={dev.id}
                  style={{
                    width: "50mm",
                    height: "30mm",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "3.2mm 2.8mm",
                    borderRadius: "2.6mm",
                    backgroundColor: dev.stickerColor || "#1e1b4b",
                    color: dev.fontColor || "#ffffff",
                    fontFamily: "Inter, Roboto, sans-serif",
                    position: "relative",
                    overflow: "hidden",
                    border: "0.15mm solid rgba(120, 120, 120, 0.2)"
                  }}
                >
                  {/* Left side details */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      height: "100%",
                      textAlign: "left",
                      paddingRight: "1.5mm"
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                      <h2
                        style={{
                          fontSize: "1.8mm",
                          fontWeight: 900,
                          letterSpacing: "0.15em",
                          lineHeight: 1.1,
                          textTransform: "uppercase",
                          margin: 0
                        }}
                      >
                        URBAN GAMING
                      </h2>
                      <p
                        style={{
                          fontSize: "1.0mm",
                          fontWeight: 900,
                          letterSpacing: "0.08em",
                          opacity: 0.85,
                          marginTop: "0.4mm",
                          textTransform: "uppercase",
                          margin: 0
                        }}
                      >
                        {dev.type.startsWith("stik") ? "CONTROLLER" : DEVICE_LABELS[dev.type]}
                      </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.5mm" }}>
                      {dev.type.startsWith("stik") && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.8mm",
                            marginTop: "0.6mm",
                            marginBottom: "0.6mm"
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "5.2mm",
                              height: "2.8mm",
                              borderRadius: "0.6mm",
                              border: "0.15mm solid #000000",
                              backgroundColor: "#000000",
                              color: "#ffffff",
                              fontSize: "1.3mm",
                              fontWeight: 900,
                              lineHeight: 1
                            }}
                          >OM</span>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "5.2mm",
                              height: "2.8mm",
                              borderRadius: "0.6mm",
                              border: "0.15mm solid #000000",
                              backgroundColor: "#ffffff",
                              color: "#000000",
                              fontSize: "1.3mm",
                              fontWeight: 900,
                              lineHeight: 1
                            }}
                          >OP</span>
                        </div>
                      )}
                      <h1
                        style={{
                          fontSize: "6.8mm",
                          fontWeight: 900,
                          fontFamily: "monospace",
                          letterSpacing: "-0.05em",
                          lineHeight: 1,
                          margin: 0
                        }}
                      >
                        {String(dev.number).padStart(2, "0")}
                      </h1>
                    </div>
                  </div>

                  {/* Right side: QR Code */}
                  <div
                    style={{
                      padding: "1.4mm",
                      borderRadius: "1.8mm",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      backgroundColor: "#ffffff",
                      border:
                        dev.stickerColor?.toLowerCase() === "#ffffff" || dev.stickerColor?.toLowerCase() === "#fff"
                          ? "0.15mm solid #e4e4e7"
                          : "0.15mm solid rgba(255,255,255,0.2)",
                      width: "14.5mm",
                      height: "14.5mm",
                      boxSizing: "border-box"
                    }}
                  >
                    <img
                      src={preloadedQrCodes[dev.id]}
                      alt="QR Code"
                      style={{
                        width: "11.7mm",
                        height: "11.7mm",
                        objectFit: "contain"
                      }}
                      crossOrigin="anonymous"
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* PDF Loader Modal */}
      {isGeneratingPdf && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm bg-white dark:bg-[#1C1C1E] rounded-[28px] p-8 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 ring-1 ring-black/5 dark:ring-white/10">
             
             {/* PDF Icon Animation */}
             <div className="w-16 h-16 mb-6 relative flex items-center justify-center bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl">
                <QrCode className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-pulse" />
             </div>
             
             <h3 className="text-[19px] font-bold text-zinc-900 dark:text-white mb-2">Membuat PDF Stiker</h3>
             <p className="text-[14px] font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[260px] mx-auto mb-6 h-10 flex items-center justify-center">
                 {pdfLoadingText}
             </p>

             {/* Progress Bar */}
             <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-3.5 mb-2 overflow-hidden shadow-inner ring-1 ring-inset ring-black/5 dark:ring-white/5 p-0.5 relative">
                <div 
                   className="bg-emerald-600 dark:bg-emerald-500 h-full rounded-full transition-all duration-300 ease-out relative overflow-hidden" 
                   style={{ width: `${pdfProgress}%` }}
                >
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
                </div>
             </div>
             
             {/* Percentage */}
             <div className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 font-mono tracking-wider">
                 {pdfProgress}%
             </div>
             
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default WidgetMonitoringDevice;
