import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { 
  QrCode, Camera, Gamepad2, Monitor, Smartphone, 
  Trash2, Edit, Save, CheckCircle2, XCircle, AlertCircle, 
  Upload, History, Sparkles, Download, Eye,
  Flashlight, FlashlightOff
} from "lucide-react";
import { doc, setDoc, onSnapshot, deleteDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Button, Card, cx, EmptyState, Eyebrow, IconBadge, konfirmasi, ListGroup, MOTION, Pill, Sheet, Stepper, TextAreaField, tile, type WarnaIkon } from "../ui";

import useStokData, { RegisteredDevice, DeviceType } from "../hooks/useStokData";
import { toLocalYmd } from "../lib/dateLocal";

interface WidgetMonitoringDeviceProps {
  isOwner?: boolean;
  /** Dipilih dari segmen halaman Monitoring: "kondisi" (semua akun) atau "stiker" (owner: buat + daftar stiker). */
  halaman?: "kondisi" | "stiker";
}

const DEVICE_LABELS: Record<DeviceType, string> = {
  ps3: "PLAYSTATION 3",
  ps4: "PLAYSTATION 4",
  stik_ps3: "STIK PS3",
  stik_ps4: "STIK PS4",
  tv: "TV MONITOR",
  playbox: "PLAYBOX / PORTABEL"
};

/** Tampilan ringkas di halaman Kondisi (label stiker & PDF tetap DEVICE_LABELS). */
const JENIS_ALAT: { type: DeviceType; label: string; color: WarnaIkon }[] = [
  { type: "ps3", label: "PS3", color: "gray" },
  { type: "ps4", label: "PS4", color: "blue" },
  { type: "stik_ps3", label: "Stik PS3", color: "gray" },
  { type: "stik_ps4", label: "Stik PS4", color: "blue" },
  { type: "tv", label: "TV", color: "orange" },
  { type: "playbox", label: "Playbox / portabel", color: "teal" },
];
const ikonAlat = (type: DeviceType) => (type === "tv" ? <Monitor /> : type === "playbox" ? <Smartphone /> : <Gamepad2 />);

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
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(id)}&ecc=M`;
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

const WidgetMonitoringDevice: React.FC<WidgetMonitoringDeviceProps> = ({ isOwner = false, halaman = "kondisi" }) => {
  // Satu lapis navigasi: segmen dipilih di halaman Monitoring, bukan tab di dalam kartu ini
  const hal = isOwner ? halaman : "kondisi";
  const formStikerRef = useRef<HTMLFormElement>(null);

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

  // Registered Devices from global store
  const { devices } = useStokData();

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scanningError, setScanningError] = useState<string | null>(null);
  const qrCodeRef = useRef<any>(null);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Selected device for Status Update Modal
  const [updatingDevice, setUpdatingDevice] = useState<Partial<RegisteredDevice> | null>(null);
  const [updateStatus, setUpdateStatus] = useState<"baik" | "rusak">("baik");
  const [updateKeterangan, setUpdateKeterangan] = useState("");
  const [updateStikType, setUpdateStikType] = useState<"OP" | "OM">("OP");

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

  // Stiker terpilih di Riwayat (checkbox). pdfTargetIds = daftar yang sedang dicetak (null = semua).
  const [selectedStickerIds, setSelectedStickerIds] = useState<string[]>([]);
  const [pdfTargetIds, setPdfTargetIds] = useState<string[] | null>(null);
  const toggleStickerSelect = (id: string) =>
    setSelectedStickerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const buildStickerPages = (devices: RegisteredDevice[]) => {
    // Group devices by category
    const squareDevices: RegisteredDevice[] = [];
    const stikPs4Devices: RegisteredDevice[] = [];
    const stikPs3Devices: RegisteredDevice[] = [];

    devices.forEach((dev) => {
      if (dev.type === "stik_ps4") {
        stikPs4Devices.push(dev);
      } else if (dev.type === "stik_ps3") {
        stikPs3Devices.push(dev);
      } else {
        squareDevices.push(dev);
      }
    });

    // Sort each group
    const sortByNum = (a: RegisteredDevice, b: RegisteredDevice) => a.type.localeCompare(b.type) || a.number - b.number;
    squareDevices.sort(sortByNum);
    stikPs4Devices.sort(sortByNum);
    stikPs3Devices.sort(sortByNum);

    const chunkedPages: { type: "square" | "stik_ps4" | "stik_ps3"; devices: RegisteredDevice[] }[] = [];

    // Chunk square devices (15 per page)
    for (let i = 0; i < squareDevices.length; i += 15) {
      chunkedPages.push({
        type: "square",
        devices: squareDevices.slice(i, i + 15)
      });
    }

    // Chunk stik_ps4 devices (44 per page)
    for (let i = 0; i < stikPs4Devices.length; i += 44) {
      chunkedPages.push({
        type: "stik_ps4",
        devices: stikPs4Devices.slice(i, i + 44)
      });
    }

    // Chunk stik_ps3 devices (65 per page)
    for (let i = 0; i < stikPs3Devices.length; i += 65) {
      chunkedPages.push({
        type: "stik_ps3",
        devices: stikPs3Devices.slice(i, i + 65)
      });
    }

    return chunkedPages;
  };

  const pages = useMemo(
    () => buildStickerPages(pdfTargetIds ? devices.filter((d) => pdfTargetIds.includes(d.id)) : devices),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, pdfTargetIds]
  );

  // Buang pilihan yang unitnya sudah dihapus
  useEffect(() => {
    setSelectedStickerIds((prev) => {
      const next = prev.filter((id) => devices.some((d) => d.id === id));
      return next.length === prev.length ? prev : next;
    });
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

  // Check if torch is supported
  const checkTorchSupport = () => {
    try {
      if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        const capabilities = qrCodeRef.current.getRunningTrackCameraCapabilities();
        if (capabilities && typeof capabilities.torchFeature === "function") {
          const torch = capabilities.torchFeature();
          if (torch.isSupported()) {
            setIsTorchSupported(true);
            setIsTorchOn(!!torch.value());
          }
        }
      }
    } catch (e) {
      console.warn("Error checking torch support:", e);
    }
  };

  // Toggle the torch
  const toggleTorch = async () => {
    if (!isTorchSupported) {
      alert("Lampu senter tidak didukung oleh browser di perangkat ini. Silakan aktifkan senter secara manual dari Control Center.");
      return;
    }
    try {
      if (qrCodeRef.current && qrCodeRef.current.isScanning) {
        const capabilities = qrCodeRef.current.getRunningTrackCameraCapabilities();
        if (capabilities && typeof capabilities.torchFeature === "function") {
          const torch = capabilities.torchFeature();
          if (torch.isSupported()) {
            const nextState = !isTorchOn;
            await torch.apply(nextState);
            setIsTorchOn(nextState);
          }
        }
      }
    } catch (e) {
      console.error("Error toggling torch:", e);
      alert("Gagal mengontrol lampu senter di perangkat ini.");
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

        const { Html5Qrcode } = await import("html5-qrcode");
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
          checkTorchSupport();
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
            checkTorchSupport();
          } catch (secondErr) {
            console.warn("Failed front camera, trying default available camera...", secondErr);
            const { Html5Qrcode } = await import("html5-qrcode");
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
              checkTorchSupport();
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
    setIsTorchSupported(false);
    setIsTorchOn(false);
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
      if (existing.type.startsWith("stik")) {
        setUpdateStikType(existing.stikType === "OM" ? "OM" : "OP");
      }
    } else {
      // Create temporary mock device if scanned unregistered sticker
      setUpdatingDevice({
        id: trimmedId,
        type: typeCandidate,
        number: numCandidate,
        status: "baik",
        keterangan: "",
        stikType: typeCandidate.startsWith("stik") ? "OP" : ""
      });
      setUpdateStatus("baik");
      setUpdateKeterangan("");
      if (typeCandidate.startsWith("stik")) {
        setUpdateStikType("OP");
      }
    }
  };

  // Upload scan file fallback
  const handleUploadScanFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const { Html5Qrcode } = await import("html5-qrcode");
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
    const existingDevice = devices.find(d => d.id === deviceId);

    const newHistoryEntry = {
      updatedAt: Date.now(),
      updatedBy: currentUserEmail || "Admin",
      status: updateStatus,
      keterangan: updateStatus === "rusak" ? updateKeterangan : "Diperbaiki / Kondisi Normal"
    };

    const currentHistory = existingDevice?.history || [];
    const updatedHistory = [...currentHistory, newHistoryEntry];

    const updatedData: Partial<RegisteredDevice> = {
      status: updateStatus,
      keterangan: updateStatus === "rusak" ? updateKeterangan : "",
      updatedAt: Date.now(),
      updatedBy: currentUserEmail || "Admin",
      history: updatedHistory
    };

    if (updatingDevice.type?.startsWith("stik")) {
      updatedData.stikType = updateStikType;
    }

    try {
      if (isNew) {
        // If it's a completely new scanned device, initialize other values
        const payload: RegisteredDevice = {
          id: deviceId,
          type: updatingDevice.type as DeviceType,
          number: updatingDevice.number || 1,
          stikType: updatingDevice.type?.startsWith("stik") ? updateStikType : "",
          status: updateStatus,
          keterangan: updateStatus === "rusak" ? updateKeterangan : "",
          stickerColor: "#1e1b4b", // default navy
          fontColor: "#ffffff",
          updatedAt: Date.now(),
          updatedBy: currentUserEmail || "Admin",
          history: [newHistoryEntry]
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
      if (!(await konfirmasi(`${DEVICE_LABELS[genType]} nomor ${numValue} sudah terdaftar. Desain stikernya akan diganti.`, { judul: "Timpa stiker?", ya: "Timpa", bahaya: true }))) {
        return;
      }
    }

    try {
      const existingData = devices.find(d => d.id === deviceId);
      
      const payload: RegisteredDevice = {
        id: deviceId,
        type: genType,
        number: numValue,
        stikType: genType.startsWith("stik") ? genStikType : "",
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
    // Form & daftar ada di halaman yang sama → gulir ke form
    requestAnimationFrame(() => formStikerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // Delete device registration
  const handleDeleteDevice = async (id: string) => {
    if (!(await konfirmasi("Riwayat kondisi device ini ikut hilang.", { judul: "Hapus dari monitoring?", ya: "Hapus", bahaya: true }))) {
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
      // Tunggu font selesai dimuat
      if (document.fonts) {
        await document.fonts.ready;
      }

      // Create a temporary container for rendering off-screen
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "fixed";
      tempContainer.style.top = "0";
      tempContainer.style.left = "0";
      tempContainer.style.width = genType === "stik_ps4" ? "529px" : (genType === "stik_ps3" ? "265px" : "378px");
      tempContainer.style.height = genType === "stik_ps4" ? "76px" : (genType === "stik_ps3" ? "151px" : "378px");
      tempContainer.style.overflow = "hidden";
      tempContainer.style.zIndex = "-9999";
      tempContainer.style.opacity = "1";
      tempContainer.style.visibility = "visible";
      tempContainer.style.pointerEvents = "none";
      
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

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(clonedSticker, {
        scale: 8, // 8x scale (2x of previous 4x) for ultra-high resolution print quality
        useCORS: true,
        backgroundColor: null,
        logging: false,
        width: genType === "stik_ps4" ? 529 : (genType === "stik_ps3" ? 265 : 378),
        height: genType === "stik_ps4" ? 76 : (genType === "stik_ps3" ? 151 : 378)
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
  const handleDownloadAllStickersPDF = async (onlyIds?: string[]) => {
    const targetDevices = onlyIds && onlyIds.length ? devices.filter((d) => onlyIds.includes(d.id)) : devices;
    if (targetDevices.length === 0) {
      alert(onlyIds ? "Pilih minimal satu stiker untuk dicetak." : "Tidak ada stiker yang tersimpan di database.");
      return;
    }
    // Halaman PDF dihitung dari daftar target (bukan `pages` lama di closure)
    const targetPages = buildStickerPages(targetDevices);
    setPdfTargetIds(onlyIds && onlyIds.length ? targetDevices.map((d) => d.id) : null);

    setIsGeneratingPdf(true);
    setPdfProgress(5);
    setPdfLoadingText("Menyiapkan data stiker...");

    try {
      if (document.fonts) {
        await document.fonts.ready;
      }
      const sortedDevices = [...targetDevices].sort(
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

      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true
      });

      const scale = 3.2; // Optimized 3.2x scale (600 DPI print quality, perfect balance between crispness and performance)
      
      for (let pageIdx = 0; pageIdx < targetPages.length; pageIdx++) {
        setPdfLoadingText(`Merender halaman ${pageIdx + 1} dari ${targetPages.length}...`);
        
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

        // Use JPEG with 92% compression quality instead of PNG to drastically reduce PDF file size and rendering load
        const imgData = canvas.toDataURL("image/jpeg", 0.92);

        if (pageIdx > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
        setPdfProgress(Math.round(50 + ((pageIdx + 1) / targetPages.length) * 45));
      }

      setPdfLoadingText("Menyimpan PDF...");
      setPdfProgress(98);
      
      pdf.save(`stiker_${onlyIds && onlyIds.length ? `terpilih_${targetDevices.length}` : "all"}_urban_gaming_${toLocalYmd()}.pdf`);
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
    const capacity = masterCapacities[type] || 0;
    const list = devices.filter(d => d.type === type && d.number <= capacity);
    
    // Count broken
    const rusakCount = list.filter(d => d.status === "rusak").length;
    
    // We assume default status of capacity slots are "baik" unless flagged "rusak"
    const baikCount = Math.max(0, capacity - rusakCount);

    return { total: capacity, baik: baikCount, rusak: rusakCount };
  };

  /** Unit terdaftar per "jenis#nomor" (urutan sama dengan find(): yang pertama dipakai). */
  const perNomor = useMemo(() => {
    const m = new Map<string, RegisteredDevice>();
    devices.forEach((d) => { const k = `${d.type}#${d.number}`; if (!m.has(k)) m.set(k, d); });
    return m;
  }, [devices]);
  const statsJenis = JENIS_ALAT.map((j) => ({ ...j, stats: getDeviceStats(j.type) }));
  const totalAlat = statsJenis.reduce((a, j) => a + j.stats.total, 0);
  const totalBaik = statsJenis.reduce((a, j) => a + j.stats.baik, 0);
  const totalRusak = statsJenis.reduce((a, j) => a + j.stats.rusak, 0);
  /** Tutup lembar kapasitas tanpa menyimpan: isian kembali ke angka tersimpan. */
  const batalEditMaster = () => {
    setTempCapacities({
      ps3: String(masterCapacities.ps3),
      ps4: String(masterCapacities.ps4),
      stik_ps3: String(masterCapacities.stik_ps3),
      stik_ps4: String(masterCapacities.stik_ps4),
      tv: String(masterCapacities.tv),
      playbox: String(masterCapacities.playbox),
    });
    setIsEditingMaster(false);
  };

  // QR Code creation string helper
  const qrUrl = useMemo(() => {
    const numValue = genNumber === "" ? 1 : genNumber;
    const deviceId = editingStickerId || `${genType}_${String(numValue).padStart(2, "0")}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(deviceId)}&ecc=M`;
  }, [editingStickerId, genType, genNumber]);

  return (
    <>
      <Card
        title={hal === "stiker" ? "Stiker unit" : "Monitoring kondisi alat"}
        subtitle={
          hal === "stiker"
            ? `${devices.length} unit terdaftar`
            : totalAlat ? `${totalBaik} baik · ${totalRusak} rusak · ${totalAlat} alat` : "Kapasitas alat belum diatur"
        }
        icon={hal === "stiker" ? <Sparkles /> : <QrCode />}
        iconColor={hal === "stiker" ? "indigo" : "teal"}
      >
        <div className="flex flex-col gap-4">
          {/* Kondisi alat (semua akun) — padat untuk mobile */}
          {hal === "kondisi" && (
            <div className="flex w-full flex-col gap-3">
              {/* Aksi scan: kamera / foto QR */}
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="filled" size="md" block icon={<Camera />} onClick={startScanning}>
                  Scan QR
                </Button>
                <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-fill px-4 text-subhead font-semibold text-label transition-opacity active:opacity-70">
                  <Upload className="h-4 w-4 text-label-2" aria-hidden />
                  Unggah foto
                  <input type="file" accept="image/*" onChange={handleUploadScanFile} className="hidden" />
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 px-0.5">
                <Eyebrow>Kondisi per alat</Eyebrow>
                {isOwner && (
                  <Button type="button" variant="tinted" size="sm" onClick={() => setIsEditingMaster(true)}>
                    Atur kapasitas
                  </Button>
                )}
              </div>

              {totalAlat === 0 ? (
                <div className={cx(tile, "px-4 py-5 text-center text-footnote text-label-2")}>
                  {isOwner ? "Ketuk Atur kapasitas untuk mengisi jumlah alat." : "Kapasitas alat belum diatur owner."}
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {statsJenis.filter((j) => j.stats.total > 0).map(({ type, label, color, stats }) => (
                    <section key={type} className={cx(tile, "min-w-0 p-3")} aria-label={`${label}: ${stats.baik} baik, ${stats.rusak} rusak`}>
                      <div className="flex items-center gap-2.5">
                        <IconBadge color={color} size="sm">{ikonAlat(type)}</IconBadge>
                        <h3 className="min-w-0 flex-1 truncate text-subhead font-semibold text-label">{label}</h3>
                        <span className="shrink-0 text-caption font-medium tabular-nums text-label-2">
                          <b className="font-semibold text-positive">{stats.baik}</b> baik ·{" "}
                          <b className={cx("font-semibold", stats.rusak ? "text-negative" : "text-label-2")}>{stats.rusak}</b> rusak
                        </span>
                      </div>
                      <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5">
                        {Array.from({ length: stats.total }, (_, index) => {
                          const badgeNum = index + 1;
                          const deviceId = `${type}_${String(badgeNum).padStart(2, "0")}`;
                          const registered = perNomor.get(`${type}#${badgeNum}`);
                          const gaya = !registered
                            ? "border border-dashed border-sep text-label-3"
                            : registered.status === "rusak"
                              ? "bg-negative/10 text-negative ring-1 ring-inset ring-negative/30"
                              : "bg-positive/10 text-positive ring-1 ring-inset ring-positive/25";
                          return (
                            <button
                              type="button"
                              key={deviceId}
                              onClick={() => handleScannedId(deviceId)}
                              className={cx(
                                "flex hit-44 h-10 min-w-0 flex-col items-center justify-center rounded-control font-mono text-footnote font-semibold leading-none tabular-nums transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint",
                                gaya
                              )}
                              title={registered?.status === "rusak" ? `Rusak: ${registered.keterangan}` : registered ? "Kondisi normal" : "Belum didata"}
                              aria-label={`${label} nomor ${badgeNum}: ${registered ? (registered.status === "rusak" ? "rusak" : "baik") : "belum didata"}`}
                            >
                              {String(badgeNum).padStart(2, "0")}
                              {registered?.stikType && <span className="mt-0.5 text-caption2 font-semibold leading-none opacity-80">{registered.stikType}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5 text-caption text-label-2" aria-hidden>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-positive/25 ring-1 ring-inset ring-positive/40" />Baik</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-negative/20 ring-1 ring-inset ring-negative/40" />Rusak</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-label-3" />Belum didata</span>
                <span className="text-label-3">Ketuk nomor untuk ubah kondisi.</span>
              </div>
            </div>
          )}

          {/* Stiker (owner): buat / ubah stiker, lalu daftar unit terdaftar di bawahnya */}
          {hal === "stiker" && (
            <div className="flex w-full flex-col gap-6 lg:flex-row animate-in fade-in duration-300">
              {/* Generator Configuration Panel */}
              <div className="flex flex-col gap-5 lg:w-1/2">
                <form ref={formStikerRef} onSubmit={handleSaveSticker} className="flex scroll-mt-[calc(var(--app-header-height,148px)+16px)] flex-col gap-4 rounded-tile apple-tile p-4 ring-1 ring-edge sm:p-5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-tint" />
                      <Eyebrow>Desain stiker unit</Eyebrow>
                    </div>
                    {editingStickerId && (
                      <span className="flex items-center gap-1">
                        <Pill tone="tint">Ubah {editingStickerId}</Pill>
                        <Button type="button" variant="plain" size="sm" onClick={() => setEditingStickerId(null)}>
                          Batal
                        </Button>
                      </span>
                    )}
                  </div>

                  {/* Device Type */}
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Tipe device</label>
                    <select
                      value={genType}
                      onChange={(e) => {
                        setGenType(e.target.value as DeviceType);
                        setEditingStickerId(null);
                      }}
                      className="min-h-[44px] cursor-pointer rounded-control bg-surface px-3.5 py-2 text-[16px] sm:text-callout font-medium text-label ring-1 ring-edge focus:outline-none focus:ring-2 focus:ring-tint"
                    >
                      {(Object.keys(DEVICE_LABELS) as DeviceType[]).map(type => (
                        <option key={type} value={type}>{DEVICE_LABELS[type]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Number */}
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Nomor unit</label>
                      <input
                        type="number"
                        inputMode="numeric"
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
                        className="min-h-[44px] rounded-control bg-surface px-3.5 py-2 font-mono text-[16px] sm:text-callout font-semibold tabular-nums text-label ring-1 ring-edge focus:outline-none focus:ring-2 focus:ring-tint"
                      />
                    </div>

                    {genType.startsWith("stik") && (
                      <div className="flex flex-col gap-1.5 text-left">
                        <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Kategori stik</label>
                        <select
                          value={genStikType}
                          onChange={(e) => {
                            setGenStikType(e.target.value as "OP" | "OM");
                            setEditingStickerId(null);
                          }}
                          className="min-h-[44px] cursor-pointer rounded-control bg-surface px-3.5 py-2 text-[16px] sm:text-callout font-medium text-label ring-1 ring-edge focus:outline-none focus:ring-2 focus:ring-tint"
                        >
                          <option value="OM">Original Mesin (OM)</option>
                          <option value="OP">Original Pabrik (OP)</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Preset Colors */}
                  <div className="mt-1 flex flex-col gap-2 text-left">
                    <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Preset warna stiker</label>
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
                            className={`flex min-h-[40px] items-center justify-center rounded-control px-2 text-caption font-semibold transition-transform active:scale-95 ${
                              isSelected ? "ring-2 ring-tint ring-offset-2 ring-offset-surface-2" : "ring-1 ring-edge"
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
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Warna latar</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={genBgColor}
                          onChange={(e) => {
                            setGenBgColor(e.target.value);
                            setEditingStickerId(null);
                          }}
                          className="h-11 w-11 shrink-0 cursor-pointer rounded-control bg-surface p-0.5 ring-1 ring-edge"
                        />
                        <input
                          type="text"
                          value={genBgColor.toUpperCase()}
                          onChange={(e) => {
                            setGenBgColor(e.target.value);
                            setEditingStickerId(null);
                          }}
                          className="w-full min-h-[44px] rounded-control bg-surface px-3 font-mono text-[16px] sm:text-callout font-medium text-label ring-1 ring-edge focus:outline-none focus:ring-2 focus:ring-tint"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Warna teks</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={genTextColor}
                          onChange={(e) => {
                            setGenTextColor(e.target.value);
                            setEditingStickerId(null);
                          }}
                          className="h-11 w-11 shrink-0 cursor-pointer rounded-control bg-surface p-0.5 ring-1 ring-edge"
                        />
                        <input
                          type="text"
                          value={genTextColor.toUpperCase()}
                          onChange={(e) => {
                            setGenTextColor(e.target.value);
                            setEditingStickerId(null);
                          }}
                          className="w-full min-h-[44px] rounded-control bg-surface px-3 font-mono text-[16px] sm:text-callout font-medium text-label ring-1 ring-edge focus:outline-none focus:ring-2 focus:ring-tint"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2.5">
                    {editingStickerId && (
                      <Button
                        type="button"
                        variant="gray"
                        size="lg"
                        onClick={() => {
                          setEditingStickerId(null);
                          setGenNumber(devices.length + 1);
                        }}
                      >
                        Reset
                      </Button>
                    )}
                    <Button
                      type="submit"
                      variant="filled"
                      size="lg"
                      icon={<Save />}
                      className="flex-1"
                    >
                      Simpan stiker ke database
                    </Button>
                  </div>
                </form>
              </div>

              {/* Preview & Download Panel */}
              <div className="flex flex-col items-center justify-center rounded-tile apple-tile p-5 ring-1 ring-edge lg:w-1/2 sm:p-6">
                <div className="mb-5 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-tint" />
                  <Eyebrow>Preview desain stiker</Eyebrow>
                </div>

                {/* Sticker Elements Container */}
                <div className="relative flex min-h-[180px] w-full max-w-[420px] items-center justify-center overflow-hidden rounded-card border-2 border-dashed border-sep bg-surface p-3 sm:min-h-[260px] sm:p-4">
                  <div className={`${
                    genType === "stik_ps4" 
                      ? "scale-[0.55] min-[400px]:scale-[0.65] sm:scale-[0.75]" 
                      : (genType === "stik_ps3" ? "scale-[0.75] min-[400px]:scale-[0.85] sm:scale-100" : "scale-[0.75] min-[400px]:scale-[0.85] sm:scale-100")
                  } origin-center shrink-0 my-[-25px] sm:my-0`}>
                    <div
                      ref={stickerPreviewRef}
                      className={`flex ${genType === "stik_ps4" || genType === "stik_ps3" ? "flex-row" : "flex-col"} items-center justify-between ${
                        genType === "stik_ps4" ? "p-2.5" : (genType === "stik_ps3" ? "p-3.5" : "p-6")
                      } relative select-none shadow-2xl`}
                      style={{
                        width: genType === "stik_ps4" ? "529px" : (genType === "stik_ps3" ? "265px" : "378px"),
                        height: genType === "stik_ps4" ? "76px" : (genType === "stik_ps3" ? "151px" : "378px"),
                        backgroundColor: genBgColor,
                        color: genTextColor,
                        fontFamily: "Inter, Roboto, sans-serif",
                        borderRadius: genType === "stik_ps4" ? "8px" : (genType === "stik_ps3" ? "12px" : "24px"),
                        boxSizing: "border-box",
                        textAlign: genType === "stik_ps4" || genType === "stik_ps3" ? "left" : "center",
                        border: genBgColor.toLowerCase() === "#ffffff" || genBgColor.toLowerCase() === "#fff"
                          ? "2px dashed #cbd5e1"
                          : "none"
                      }}
                    >
                      {genType === "stik_ps4" && (
                        <>
                          {/* Left side details */}
                          <div className="flex flex-col justify-center items-start h-full text-left gap-0.5">
                            <h2 className="text-[12px] font-black tracking-wide leading-tight select-none uppercase">URBAN GAMING</h2>
                            <p className="text-[8px] font-black tracking-widest opacity-85 uppercase select-none">STIK PS4</p>
                            <div className="flex items-center gap-1.5 mt-0.5 select-none">
                              {/* OM Badge */}
                              <svg width="24" height="12" style={{ display: "inline-block" }}>
                                <rect width="24" height="12" rx="3" fill="#000000" />
                                <text 
                                  x="12" 
                                  y="9" 
                                  textAnchor="middle" 
                                  fontFamily="Inter, Roboto, sans-serif" 
                                  fontWeight="900" 
                                  fontSize="7" 
                                  fill="#ffffff"
                                >OM</text>
                              </svg>
                              {/* OP Badge */}
                              <svg width="24" height="12" style={{ display: "inline-block" }}>
                                <rect x="0.5" y="0.5" width="23" height="11" rx="2.5" fill="#ffffff" stroke="#000000" strokeWidth="0.75" />
                                <text 
                                  x="12" 
                                  y="9" 
                                  textAnchor="middle" 
                                  fontFamily="Inter, Roboto, sans-serif" 
                                  fontWeight="900" 
                                  fontSize="7" 
                                  fill="#000000"
                                >OP</text>
                              </svg>
                            </div>
                          </div>

                          {/* Right side: Number and QR Code */}
                          <div className="flex items-center gap-3">
                            <h1 className="text-[32px] font-black font-mono tracking-tighter select-none leading-none">
                              {genNumber === "" ? "00" : String(genNumber).padStart(2, "0")}
                            </h1>
                            <div
                              className={`p-1 bg-white rounded-lg shadow-inner flex items-center justify-center shrink-0 border ${
                                genBgColor.toLowerCase() === "#ffffff" || genBgColor.toLowerCase() === "#fff"
                                  ? "border-zinc-200"
                                  : "border-white/20"
                              }`}
                            >
                              <img
                                src={qrUrl}
                                alt="QR Code"
                                className="w-11 h-11 object-contain select-none"
                                crossOrigin="anonymous"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {genType === "stik_ps3" && (
                        <>
                          {/* Left side details */}
                          <div className="flex-1 flex flex-col justify-between items-start h-full text-left pr-3">
                            <div className="flex flex-col items-start">
                              <h2 className="text-[10px] font-black tracking-[0.2em] leading-tight select-none uppercase">URBAN GAMING</h2>
                              <p className="text-[7px] font-black tracking-widest opacity-85 mt-0.5 uppercase select-none">STIK PS3</p>
                            </div>

                            <div className="flex flex-col items-start gap-1 mt-1">
                              <div className="flex items-center gap-1 select-none my-0.5" style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                                <svg width="24" height="12" style={{ display: "inline-block", verticalAlign: "middle" }}>
                                  <rect width="24" height="12" rx="3" fill="#000000" />
                                  <text 
                                    x="12" 
                                    y="9" 
                                    textAnchor="middle" 
                                    fontFamily="Inter, Roboto, sans-serif" 
                                    fontWeight="900" 
                                    fontSize="7" 
                                    fill="#ffffff"
                                  >OM</text>
                                </svg>
                                <svg width="24" height="12" style={{ display: "inline-block", verticalAlign: "middle" }}>
                                  <rect x="0.5" y="0.5" width="23" height="11" rx="2.5" fill="#ffffff" stroke="#000000" strokeWidth="0.75" />
                                  <text 
                                    x="12" 
                                    y="9" 
                                    textAnchor="middle" 
                                    fontFamily="Inter, Roboto, sans-serif" 
                                    fontWeight="900" 
                                    fontSize="7" 
                                    fill="#000000"
                                  >OP</text>
                                </svg>
                              </div>
                              <h1 className="text-3xl font-black font-mono tracking-tighter select-none leading-none">
                                {genNumber === "" ? "00" : String(genNumber).padStart(2, "0")}
                              </h1>
                            </div>
                          </div>

                          {/* Right side: QR Code */}
                          <div
                            className={`p-1.5 rounded-xl shadow-inner flex items-center justify-center shrink-0 border ${
                              genBgColor.toLowerCase() === "#ffffff" || genBgColor.toLowerCase() === "#fff"
                                ? "bg-white border-zinc-200"
                                : "bg-white border-white/20"
                            }`}
                          >
                            <img
                              src={qrUrl}
                              alt="QR Code"
                              className="w-16 h-16 object-contain select-none"
                              crossOrigin="anonymous"
                            />
                          </div>
                        </>
                      )}

                      {genType !== "stik_ps4" && genType !== "stik_ps3" && (
                        <>
                          <div className="flex flex-col items-center text-center">
                            <h2 className="text-[16px] font-black tracking-[0.25em] leading-tight select-none uppercase">URBAN GAMING</h2>
                            <p className="text-[10px] font-black tracking-widest opacity-85 mt-1.5 uppercase select-none">
                              {genType === "tv" ? "TV MONITOR" : DEVICE_LABELS[genType]}
                            </p>
                          </div>

                          <h1 className="text-7xl font-black font-mono tracking-tighter select-none leading-none my-4">
                            {genNumber === "" ? "00" : String(genNumber).padStart(2, "0")}
                          </h1>

                          {/* QR Code */}
                          <div
                            className={`p-2.5 rounded-2xl shadow-inner flex items-center justify-center shrink-0 border ${
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
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Download Buttons — grid agar size="lg" (50px) selalu sama persis dengan Simpan stiker */}
                <div className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="filled"
                    size="lg"
                    block
                    icon={<Download />}
                    onClick={handleDownloadSticker}
                  >
                    Download stiker (PNG)
                  </Button>
                  <Button
                    type="button"
                    variant="tinted"
                    size="lg"
                    block
                    icon={<QrCode />}
                    onClick={() => handleDownloadAllStickersPDF()}
                  >
                    Download semua (PDF)
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Daftar unit terdaftar (owner) — satu halaman dengan pembuat stiker */}
          {hal === "stiker" && (
            <div className="flex w-full flex-col gap-6 animate-in fade-in duration-300">
              {/* History Section */}
              <div className="flex flex-col gap-4 text-left">
                <div className="mb-1 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-tint" />
                    <Eyebrow>Daftar unit terdaftar ({devices.length} unit)</Eyebrow>
                  </div>
                  {devices.length > 0 && (
                    <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:items-center">
                      <Button
                        type="button"
                        variant="gray"
                        size="md"
                        aria-label={selectedStickerIds.length === devices.length ? "Batal pilih semua stiker" : "Pilih semua stiker"}
                        onClick={() => setSelectedStickerIds(selectedStickerIds.length === devices.length ? [] : devices.map((d) => d.id))}
                        className="w-full sm:w-auto !px-2 sm:!px-4 text-footnote sm:text-subhead whitespace-nowrap"
                      >
                        {selectedStickerIds.length === devices.length ? "Batal" : "Semua"}
                      </Button>
                      <Button
                        type="button"
                        variant="tinted"
                        size="md"
                        icon={<QrCode />}
                        aria-label={`Cetak ${selectedStickerIds.length} stiker terpilih (PDF)`}
                        disabled={selectedStickerIds.length === 0 || isGeneratingPdf}
                        onClick={() => handleDownloadAllStickersPDF(selectedStickerIds)}
                        className="w-full sm:w-auto !px-2 sm:!px-4 text-footnote sm:text-subhead whitespace-nowrap [&>svg]:hidden min-[400px]:[&>svg]:inline"
                      >
                        Cetak ({selectedStickerIds.length})
                      </Button>
                      <Button
                        type="button"
                        variant="filled"
                        size="md"
                        icon={<QrCode />}
                        aria-label="Download semua stiker (PDF)"
                        onClick={() => handleDownloadAllStickersPDF()}
                        className="w-full sm:w-auto !px-2 sm:!px-4 text-footnote sm:text-subhead whitespace-nowrap [&>svg]:hidden min-[400px]:[&>svg]:inline"
                      >
                        Semua PDF
                      </Button>
                    </div>
                  )}
                </div>

                {devices.length > 0 ? (
                  <>
                    {/* Desktop Responsive Table (visible on md screens and up) */}
                    <div className="hidden overflow-x-auto rounded-tile bg-surface ring-1 ring-edge md:block">
                      <table className="w-full border-collapse text-left text-footnote">
                        <thead>
                          <tr className="border-b border-sep bg-surface-2 text-caption font-semibold uppercase tracking-wide text-label-3">
                            <th className="w-10 py-3.5 pl-5 pr-2">
                              <input
                                type="checkbox"
                                aria-label="Pilih semua stiker"
                                className="h-4 w-4 cursor-pointer accent-tint"
                                checked={devices.length > 0 && selectedStickerIds.length === devices.length}
                                onChange={(e) => setSelectedStickerIds(e.target.checked ? devices.map((d) => d.id) : [])}
                              />
                            </th>
                            <th className="px-4 py-3.5">ID unit</th>
                            <th className="px-4 py-3.5">Tipe alat</th>
                            <th className="px-4 py-3.5">No</th>
                            <th className="px-4 py-3.5">Kategori stik</th>
                            <th className="px-4 py-3.5">Kondisi</th>
                            <th className="px-4 py-3.5">Warna stiker</th>
                            <th className="px-4 py-3.5">Diupdate oleh</th>
                            <th className="px-4 py-3.5 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-sep">
                          {[...devices]
                            .sort((a, b) => a.type.localeCompare(b.type) || a.number - b.number)
                            .map((dev) => (
                              <tr key={dev.id} className="transition-colors hover:bg-fill/40">
                                <td className="py-3.5 pl-5 pr-2">
                                  <input
                                    type="checkbox"
                                    aria-label={`Pilih stiker ${dev.id}`}
                                    className="h-4 w-4 cursor-pointer accent-tint"
                                    checked={selectedStickerIds.includes(dev.id)}
                                    onChange={() => toggleStickerSelect(dev.id)}
                                  />
                                </td>
                                <td className="px-4 py-3.5 font-mono font-semibold text-label">{dev.id}</td>
                                <td className="px-4 py-3.5 font-medium text-label-2">{DEVICE_LABELS[dev.type]}</td>
                                <td className="px-4 py-3.5 font-mono tabular-nums text-label">{String(dev.number).padStart(2, "0")}</td>
                                <td className="px-4 py-3.5">
                                  {dev.stikType ? (
                                    <Pill tone={dev.stikType === "OM" ? "tint" : "positive"}>
                                      {dev.stikType === "OM" ? "Original Mesin" : "Original Pabrik"}
                                    </Pill>
                                  ) : (
                                    <span className="text-label-3">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5">
                                  <Pill tone={dev.status === "baik" ? "positive" : "negative"}>
                                    {dev.status === "baik" ? "Normal" : "Rusak"}
                                  </Pill>
                                  {dev.status === "rusak" && dev.keterangan && (
                                    <p className="mt-1 max-w-xs truncate text-caption text-label-3 italic" title={dev.keterangan}>
                                      {dev.keterangan}
                                    </p>
                                  )}
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 rounded ring-1 ring-edge" style={{ backgroundColor: dev.stickerColor }} />
                                    <span className="font-mono text-caption text-label-3">{dev.stickerColor}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-label-2">
                                  <span>{dev.updatedBy.split("@")[0]}</span>
                                  <p className="text-caption2 text-label-3">{new Date(dev.updatedAt).toLocaleString("id-ID")}</p>
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => startEditSticker(dev)}
                                      className="inline-flex hit-44 h-9 w-9 items-center justify-center rounded-full bg-fill text-label-2 transition-colors hover:text-label"
                                      title="Edit desain stiker"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteDevice(dev.id)}
                                      className="inline-flex hit-44 h-9 w-9 items-center justify-center rounded-full bg-negative/10 text-negative transition-colors hover:bg-negative/20"
                                      title="Hapus unit"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card-Based History (visible on mobile/tablet below md) */}
                    <div className="grid grid-cols-1 gap-3 md:hidden">
                      {[...devices]
                        .sort((a, b) => a.type.localeCompare(b.type) || a.number - b.number)
                        .map((dev) => (
                          <div key={dev.id} className="flex flex-col gap-3 rounded-tile apple-tile p-4 ring-1 ring-edge">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Pilih stiker ${dev.id}`}
                                  className="h-5 w-5 shrink-0 cursor-pointer accent-tint"
                                  checked={selectedStickerIds.includes(dev.id)}
                                  onChange={() => toggleStickerSelect(dev.id)}
                                />
                                <div
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control font-mono text-footnote font-bold ring-1 ring-edge"
                                  style={{ backgroundColor: dev.stickerColor, color: dev.fontColor || "#ffffff" }}
                                >
                                  {dev.number}
                                </div>
                                <div>
                                  <h4 className="text-subhead font-semibold text-label">{DEVICE_LABELS[dev.type]}</h4>
                                  <p className="font-mono text-caption text-label-3">{dev.id}</p>
                                </div>
                              </div>

                              <Pill tone={dev.status === "baik" ? "positive" : "negative"}>
                                {dev.status === "baik" ? "Normal" : "Rusak"}
                              </Pill>
                            </div>

                            {dev.stikType && (
                              <div className="flex items-center gap-2">
                                <span className="text-caption font-medium text-label-3">Kategori:</span>
                                <Pill tone={dev.stikType === "OM" ? "tint" : "positive"}>
                                  {dev.stikType === "OM" ? "Original Mesin" : "Original Pabrik"}
                                </Pill>
                              </div>
                            )}

                            {dev.status === "rusak" && dev.keterangan && (
                              <p className="rounded-control bg-surface p-2.5 text-footnote italic text-label-2 ring-1 ring-edge">
                                {dev.keterangan}
                              </p>
                            )}

                            <div className="mt-1 flex items-center justify-between border-t border-sep pt-3 text-caption text-label-3">
                              <div>
                                <span>Oleh: {dev.updatedBy.split("@")[0]}</span>
                                <span className="block text-caption2">{new Date(dev.updatedAt).toLocaleString("id-ID")}</span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditSticker(dev)}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-fill text-label-2 transition-opacity active:opacity-75"
                                  title="Edit desain stiker"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDevice(dev.id)}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-negative/10 text-negative transition-opacity active:opacity-75"
                                  title="Hapus unit"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <EmptyState icon={<QrCode />} title="Belum ada unit terdaftar">
                    Gunakan Sticker Generator untuk mendaftarkan dan membuat stiker QR.
                  </EmptyState>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Hidden container for QR file reader temp scanner initialization */}
      <div id="qr-reader-file-temp" className="hidden" />

      {/* Modal 1: QR Scanner Modal (UDS Sheet) */}
      <Sheet
        open={showScanner}
        onClose={stopScanning}
        size="sm"
        variant="surface"
        zClassName="z-[9999]"
        icon={<QrCode />}
        iconColor="blue"
        title="Pindai QR code device"
        footer={
          <div className="space-y-3">
            <p className="text-center text-footnote text-label-2">
              Posisikan QR code di dalam kotak untuk memindai secara otomatis.
            </p>
            <div className="flex gap-2.5">
              <label className="inline-flex h-[50px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-fill px-5 text-headline text-label transition hover:brightness-[0.95] dark:hover:brightness-115 active:opacity-70">
                <Upload className="h-4 w-4 text-tint" />
                Unggah file QR
                <input type="file" accept="image/*" onChange={handleUploadScanFile} className="hidden" />
              </label>
              <Button type="button" variant="destructive" size="lg" onClick={stopScanning} className="flex-1">
                Batal
              </Button>
            </div>
          </div>
        }
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-tile bg-black ring-1 ring-edge">
          <div id="qr-reader-view" className="h-full w-full" />
          <button
            type="button"
            onClick={toggleTorch}
            className={`absolute bottom-4 left-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition-transform active:scale-95 ${
              isTorchOn
                ? "border-warning bg-warning text-black shadow-lg"
                : "border-white/25 bg-black/60 text-white hover:bg-black/80"
            }`}
            title="Nyalakan/matikan lampu kilat"
          >
            {isTorchOn ? <Flashlight className="h-5 w-5 fill-current" /> : <FlashlightOff className="h-5 w-5" />}
          </button>

          {scanningError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface p-6 text-center">
              <AlertCircle className="mb-3 h-12 w-12 text-negative" />
              <p className="mb-4 text-callout font-semibold text-label">{scanningError}</p>
              <div className="flex w-full flex-col gap-2.5">
                <label className="inline-flex h-[50px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-fill px-5 text-headline text-label transition hover:brightness-[0.95] dark:hover:brightness-115 active:opacity-70">
                  <Upload className="h-4 w-4 text-tint" />
                  Unggah file QR
                  <input type="file" accept="image/*" onChange={handleUploadScanFile} className="hidden" />
                </label>
                <Button type="button" variant="gray" size="lg" block onClick={stopScanning}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </div>
      </Sheet>

      {/* Lembar kapasitas alat (owner) */}
      {isOwner && (
        <Sheet
          open={isEditingMaster}
          onClose={batalEditMaster}
          size="sm"
          variant="grouped"
          zClassName="z-[9999]"
          title="Atur kapasitas"
          subtitle="Jumlah alat yang punya stiker per jenis"
          footer={
            <Button type="button" variant="filled" size="lg" block onClick={handleSaveMaster}>
              Simpan
            </Button>
          }
        >
          <ListGroup>
            {JENIS_ALAT.map(({ type, label, color }) => (
              <div key={type} className="group/row flex items-center gap-3 pl-4 pr-3.5 sm:pr-4">
                <IconBadge color={color}>{ikonAlat(type)}</IconBadge>
                <div className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 border-b border-sep py-2.5 group-last/row:border-b-0">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-callout text-label">{label}</div>
                    <div className="truncate text-footnote text-label-2">{getDeviceStats(type).rusak} rusak</div>
                  </div>
                  <Stepper
                    value={parseInt(tempCapacities[type]) || 0}
                    min={0}
                    max={999}
                    onChange={(n) => setTempCapacities((prev) => ({ ...prev, [type]: String(n) }))}
                    ariaLabel={`kapasitas ${label}`}
                  />
                </div>
              </div>
            ))}
          </ListGroup>
          <p className="mt-2 px-4 text-footnote leading-snug text-label-2">Nomor 01 sampai kapasitas tampil di halaman Kondisi. Alat tanpa catatan rusak dihitung baik.</p>
        </Sheet>
      )}

      {/* Modal 2: Status Update Modal (UDS Sheet) */}
      <Sheet
        open={Boolean(updatingDevice)}
        onClose={() => setUpdatingDevice(null)}
        size="sm"
        variant="surface"
        zClassName="z-[9999]"
        title={updatingDevice ? DEVICE_LABELS[updatingDevice.type as DeviceType] : ""}
        subtitle={updatingDevice ? `UNIT ${String(updatingDevice.number).padStart(2, "0")}` : undefined}
        footer={
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="gray"
              size="lg"
              onClick={() => setUpdatingDevice(null)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="filled"
              size="lg"
              onClick={handleSaveStatusUpdate}
              className="flex-1"
            >
              Simpan status
            </Button>
          </div>
        }
      >
        {updatingDevice && (
          <div className="flex flex-col gap-4">
            {/* Kategori Stik (Khusus Stik PS3 & PS4) */}
            {updatingDevice.type?.startsWith("stik") && (
              <div className={`flex flex-col gap-1.5 text-left ${MOTION.panel}`}>
                <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Kategori stik</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setUpdateStikType("OP")}
                    className={`flex min-h-[48px] items-center justify-center rounded-tile px-3 text-footnote font-semibold ring-1 transition-colors ${
                      updateStikType === "OP"
                        ? "bg-positive/10 text-positive ring-positive"
                        : "bg-surface-2 text-label-2 ring-edge hover:bg-fill"
                    }`}
                  >
                    Original Pabrik (OP)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpdateStikType("OM")}
                    className={`flex min-h-[48px] items-center justify-center rounded-tile px-3 text-footnote font-semibold ring-1 transition-colors ${
                      updateStikType === "OM"
                        ? "bg-tint/10 text-tint ring-tint"
                        : "bg-surface-2 text-label-2 ring-edge hover:bg-fill"
                    }`}
                  >
                    Original Mesin (OM)
                  </button>
                </div>
              </div>
            )}

            {/* Radio Group Status */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-caption font-semibold uppercase tracking-wide text-label-3">Kondisi alat</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setUpdateStatus("baik")}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-tile text-footnote font-semibold ring-1 transition-colors ${
                    updateStatus === "baik"
                      ? "bg-positive/10 text-positive ring-positive"
                      : "bg-surface-2 text-label-2 ring-edge hover:bg-fill"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 text-positive" /> Kondisi normal
                </button>
                <button
                  type="button"
                  onClick={() => setUpdateStatus("rusak")}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-tile text-footnote font-semibold ring-1 transition-colors ${
                    updateStatus === "rusak"
                      ? "bg-negative/10 text-negative ring-negative"
                      : "bg-surface-2 text-label-2 ring-edge hover:bg-fill"
                  }`}
                >
                  <XCircle className="h-4 w-4 text-negative" /> Kondisi rusak
                </button>
              </div>
            </div>

            {/* Keterangan Kerusakan */}
            {updateStatus === "rusak" && (
              <div className={MOTION.panel}>
                <TextAreaField
                  label="Keterangan kerusakan"
                  value={updateKeterangan}
                  onChange={(e) => setUpdateKeterangan(e.target.value)}
                  placeholder="Contoh: Tombol R2 macet, analog kiri ngedrift..."
                  rows={3}
                />
              </div>
            )}

            {/* Update Log metadata */}
            {updatingDevice.updatedAt && (
              <div className="text-center text-caption text-label-3">
                Diupdate oleh: {updatingDevice.updatedBy?.split("@")[0]}
                <span className="mt-0.5 block">Waktu: {new Date(updatingDevice.updatedAt || 0).toLocaleString("id-ID")}</span>
              </div>
            )}

            {/* Damage/Repair History Section */}
            <div className="border-t border-sep pt-4">
              <label className="mb-2 block text-left text-caption font-semibold uppercase tracking-wide text-label-3">
                Riwayat kerusakan & perbaikan ({updatingDevice.history?.length || 0})
              </label>
              {updatingDevice.history && updatingDevice.history.length > 0 ? (
                <div className="flex max-h-36 flex-col gap-2 overflow-y-auto pr-1 text-left">
                  {[...updatingDevice.history].reverse().map((entry, idx) => (
                    <div
                      key={idx}
                      className="rounded-tile bg-surface-2 p-2.5 text-footnote ring-1 ring-edge"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <Pill tone={entry.status === "rusak" ? "negative" : "positive"}>
                          {entry.status === "rusak" ? "Rusak" : "Normal"}
                        </Pill>
                        <span className="font-mono text-caption2 text-label-3">
                          {new Date(entry.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })}
                        </span>
                      </div>
                      {entry.keterangan && (
                        <p className="mb-0.5 text-footnote font-medium leading-relaxed text-label">
                          {entry.keterangan}
                        </p>
                      )}
                      <span className="block text-caption2 text-label-3">
                        Oleh: {entry.updatedBy?.split("@")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-2 text-center text-footnote italic text-label-3">
                  Belum ada riwayat kondisi
                </p>
              )}
            </div>
          </div>
        )}
      </Sheet>
      {/* Off-screen PDF Page Renderer */}
      {isGeneratingPdf && (
        <div 
          id="pdf-render-pages-container"
          style={{ position: "absolute", left: "-9999px", top: 0, pointerEvents: "none" }}
        >
          {pages.map((page, pageIdx) => (
            <div 
              key={pageIdx} 
              id={`pdf-page-${pageIdx}`}
              style={{
                width: "1588px",
                height: "2246px",
                backgroundColor: "#ffffff",
                position: "relative",
                overflow: "hidden",
                boxSizing: "border-box",
                display: "grid",
                padding: page.type === "square" ? "100px 117px" : (page.type === "stik_ps4" ? "130px 125px" : "80px 79px"),
                gridTemplateColumns: page.type === "square" ? "repeat(3, 378px)" : (page.type === "stik_ps4" ? "repeat(2, 529px)" : "repeat(5, 265px)"),
                gridTemplateRows: page.type === "square" ? "repeat(5, 378px)" : (page.type === "stik_ps4" ? "repeat(22, 76px)" : "repeat(13, 151px)"),
                columnGap: page.type === "square" ? "40px" : (page.type === "stik_ps4" ? "80px" : "26px"),
                rowGap: page.type === "square" ? "30px" : (page.type === "stik_ps4" ? "15px" : "10px"),
              }}
            >
              {page.devices.map((dev) => (
                <div
                  key={dev.id}
                  className={`flex ${dev.type === "stik_ps4" || dev.type === "stik_ps3" ? "flex-row" : "flex-col"} items-center justify-between ${
                    dev.type === "stik_ps4" ? "p-2.5" : (dev.type === "stik_ps3" ? "p-3.5" : "p-6")
                  } relative select-none`}
                  style={{
                    width: dev.type === "stik_ps4" ? "529px" : (dev.type === "stik_ps3" ? "265px" : "378px"),
                    height: dev.type === "stik_ps4" ? "76px" : (dev.type === "stik_ps3" ? "151px" : "378px"),
                    boxSizing: "border-box",
                    backgroundColor: dev.stickerColor || "#1e1b4b",
                    color: dev.fontColor || "#ffffff",
                    fontFamily: "Inter, Roboto, sans-serif",
                    borderRadius: dev.type === "stik_ps4" ? "8px" : (dev.type === "stik_ps3" ? "12px" : "24px"),
                    border: dev.stickerColor?.toLowerCase() === "#ffffff" || dev.stickerColor?.toLowerCase() === "#fff"
                      ? "2px dashed #9ca3af"
                      : "1px solid rgba(120, 120, 120, 0.2)",
                    textAlign: dev.type === "stik_ps4" || dev.type === "stik_ps3" ? "left" : "center"
                  }}
                >
                  {dev.type === "stik_ps4" && (
                    <>
                      {/* Left side details */}
                      <div className="flex flex-col justify-center items-start h-full text-left gap-0.5">
                        <h2 className="text-[12px] font-black tracking-wide leading-tight select-none uppercase">URBAN GAMING</h2>
                        <p className="text-[8px] font-black tracking-widest opacity-85 uppercase select-none">STIK PS4</p>
                        <div className="flex items-center gap-1.5 mt-0.5 select-none">
                          {/* OM Badge */}
                          <svg width="24" height="12" style={{ display: "inline-block" }}>
                            <rect width="24" height="12" rx="3" fill="#000000" />
                            <text 
                              x="12" 
                              y="9" 
                              textAnchor="middle" 
                              fontFamily="Inter, Roboto, sans-serif" 
                              fontWeight="900" 
                              fontSize="7" 
                              fill="#ffffff"
                            >OM</text>
                          </svg>
                          {/* OP Badge */}
                          <svg width="24" height="12" style={{ display: "inline-block" }}>
                            <rect x="0.5" y="0.5" width="23" height="11" rx="2.5" fill="#ffffff" stroke="#000000" strokeWidth="0.75" />
                            <text 
                              x="12" 
                              y="9" 
                              textAnchor="middle" 
                              fontFamily="Inter, Roboto, sans-serif" 
                              fontWeight="900" 
                              fontSize="7" 
                              fill="#000000"
                            >OP</text>
                          </svg>
                        </div>
                      </div>

                      {/* Right side: Number and QR Code */}
                      <div className="flex items-center gap-3">
                        <h1 className="text-[32px] font-black font-mono tracking-tighter select-none leading-none">
                          {String(dev.number).padStart(2, "0")}
                        </h1>
                        <div
                          className={`p-1 bg-white rounded-lg shadow-inner flex items-center justify-center shrink-0 border ${
                            dev.stickerColor?.toLowerCase() === "#ffffff" || dev.stickerColor?.toLowerCase() === "#fff"
                              ? "border-zinc-200"
                              : "border-white/20"
                          }`}
                        >
                          <img
                            src={preloadedQrCodes[dev.id]}
                            alt="QR Code"
                            className="w-11 h-11 object-contain select-none"
                            crossOrigin="anonymous"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {dev.type === "stik_ps3" && (
                    <>
                      {/* Left side details */}
                      <div className="flex-1 flex flex-col justify-between items-start h-full text-left pr-3">
                        <div className="flex flex-col items-start">
                          <h2 className="text-[10px] font-black tracking-[0.2em] leading-tight select-none uppercase">URBAN GAMING</h2>
                          <p className="text-[7px] font-black tracking-widest opacity-85 mt-0.5 uppercase select-none">STIK PS3</p>
                        </div>

                        <div className="flex flex-col items-start gap-1 mt-1">
                          <div className="flex items-center gap-1 select-none my-0.5" style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                            <svg width="24" height="12" style={{ display: "inline-block", verticalAlign: "middle" }}>
                              <rect width="24" height="12" rx="3" fill="#000000" />
                              <text 
                                x="12" 
                                y="9" 
                                textAnchor="middle" 
                                fontFamily="Inter, Roboto, sans-serif" 
                                fontWeight="900" 
                                fontSize="7" 
                                fill="#ffffff"
                              >OM</text>
                            </svg>
                            <svg width="24" height="12" style={{ display: "inline-block", verticalAlign: "middle" }}>
                              <rect x="0.5" y="0.5" width="23" height="11" rx="2.5" fill="#ffffff" stroke="#000000" strokeWidth="0.75" />
                              <text 
                                x="12" 
                                y="9" 
                                textAnchor="middle" 
                                fontFamily="Inter, Roboto, sans-serif" 
                                fontWeight="900" 
                                fontSize="7" 
                                fill="#000000"
                              >OP</text>
                            </svg>
                          </div>
                          <h1 className="text-3xl font-black font-mono tracking-tighter select-none leading-none">
                            {String(dev.number).padStart(2, "0")}
                          </h1>
                        </div>
                      </div>

                      {/* Right side: QR Code */}
                      <div
                        className={`p-1.5 rounded-xl shadow-inner flex items-center justify-center shrink-0 border ${
                          dev.stickerColor?.toLowerCase() === "#ffffff" || dev.stickerColor?.toLowerCase() === "#fff"
                            ? "bg-white border-zinc-200"
                            : "bg-white border-white/20"
                        }`}
                      >
                        <img
                          src={preloadedQrCodes[dev.id]}
                          alt="QR Code"
                          className="w-16 h-16 object-contain select-none"
                          crossOrigin="anonymous"
                        />
                      </div>
                    </>
                  )}

                  {dev.type !== "stik_ps4" && dev.type !== "stik_ps3" && (
                    <>
                      <div className="flex flex-col items-center text-center">
                        <h2 className="text-[16px] font-black tracking-[0.25em] leading-tight select-none uppercase">URBAN GAMING</h2>
                        <p className="text-[10px] font-black tracking-widest opacity-85 mt-1.5 uppercase select-none">
                          {dev.type === "tv" ? "TV MONITOR" : DEVICE_LABELS[dev.type]}
                        </p>
                      </div>

                      <h1 className="text-7xl font-black font-mono tracking-tighter select-none leading-none my-4">
                        {String(dev.number).padStart(2, "0")}
                      </h1>

                      {/* QR Code */}
                      <div
                        className={`p-2.5 rounded-2xl shadow-inner flex items-center justify-center shrink-0 border ${
                          dev.stickerColor?.toLowerCase() === "#ffffff" || dev.stickerColor?.toLowerCase() === "#fff"
                            ? "bg-white border-zinc-200"
                            : "bg-white border-white/20"
                        }`}
                      >
                        <img
                          src={preloadedQrCodes[dev.id]}
                          alt="QR Code"
                          className="w-24 h-24 object-contain select-none"
                          crossOrigin="anonymous"
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* PDF Loader Modal */}
      {isGeneratingPdf && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${MOTION.backdrop}`} />
          <div className={`relative z-10 flex w-full max-w-sm flex-col items-center rounded-sheet apple-sheet border border-white/50 dark:border-white/[0.12] p-6 text-center shadow-float ring-1 ring-edge sm:p-8 ${MOTION.dialog}`}>
            {/* PDF Icon */}
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-tile bg-tint/10 text-tint">
              <QrCode className="h-7 w-7 animate-pulse" />
            </div>

            <h3 className="mb-1.5 text-title3 font-bold text-label">Membuat PDF stiker</h3>
            <p className="mb-5 flex min-h-[2.5rem] max-w-[260px] items-center justify-center text-subhead text-label-2">
              {pdfLoadingText}
            </p>

            {/* Progress Bar */}
            <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-tint transition-[width] duration-300 ease-out"
                style={{ width: `${pdfProgress}%` }}
              />
            </div>

            {/* Percentage */}
            <div className="font-mono text-footnote font-semibold tabular-nums text-tint">
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
