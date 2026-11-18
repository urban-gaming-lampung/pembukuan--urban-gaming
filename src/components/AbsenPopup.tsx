import React, { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, Camera } from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Button, Notice, Pill, Sheet } from "../ui";

// Fix Leaflet marker icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
});

export interface AbsenEvidence {
  key: string;
  label: string;
  foto: string;
}

interface EvidenceItem {
  key: string;
  label: string;
  facing: "user" | "environment";
}

interface AbsenPopupProps {
  jenisAbsen: "Masuk" | "Pulang" | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (waktu: string, fotoBase64: string, koordinat: {lat: number, lng: number}, evidence: AbsenEvidence[]) => void | Promise<void>;
  /** Nama shift aktif, mis. "Shift Pagi" / "Shift Sore" */
  shift?: string;
  /** Tanggal pembukuan (YYYY-MM-DD), dipakai untuk menentukan hari Jumat */
  tanggal?: string;
}

/**
 * SSOT daftar evidence absen. Absen Masuk hanya Identitas.
 * Absen Pulang menambah evidence kebersihan sesuai shift, dan Jumat ditambah Area Plafon.
 */
export function getEvidenceItems(jenis: "Masuk" | "Pulang" | null, shift?: string, tanggal?: string): EvidenceItem[] {
  const items: EvidenceItem[] = [{ key: "identitas", label: "Identitas", facing: "user" }];
  if (jenis !== "Pulang") return items;

  const s = (shift || "").toLowerCase();
  if (s.includes("pagi")) {
    items.push(
      { key: "halaman_depan", label: "Kebersihan Halaman Depan", facing: "environment" },
      { key: "area_komputer", label: "Kebersihan Area Komputer", facing: "environment" },
      { key: "meja_ps", label: "Kebersihan Meja PS", facing: "environment" }
    );
  } else if (s.includes("sore") || s.includes("siang")) {
    items.push(
      { key: "halaman_belakang", label: "Kebersihan Halaman Belakang", facing: "environment" },
      { key: "area_wc", label: "Kebersihan Area WC", facing: "environment" },
      { key: "area_dapur", label: "Kebersihan Area Dapur", facing: "environment" }
    );
  } else {
    return items;
  }

  // Hari Jumat (berdasarkan tanggal pembukuan, fallback ke hari ini WIB)
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(tanggal || "")
    ? (tanggal as string)
    : new Date().toLocaleString("en-CA", { timeZone: "Asia/Jakarta" }).slice(0, 10);
  const [y, m, d] = ymd.split("-").map(Number);
  if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 5) {
    items.push({ key: "area_plafon", label: "Kebersihan Area Plafon", facing: "environment" });
  }
  return items;
}

// Lokasi toko baru (pindah Nov 2026): Jl. Purnawirawan Raya No.114, Gn. Terang, Langkapura, Bandar Lampung
// Sumber: pin Google Maps "URBAN Gaming Lampung, Pusat Sewa PlayStation" (!3d-5.3794733!4d105.2410961)
// Lokasi lama (ruko sebelumnya): -5.3953862, 105.2367764
const TOKO_COORD = { lat: -5.3794733, lng: 105.2410961 }; // URBAN Gaming Lampung
const MAX_DISTANCE_METERS = 50;
// GPS di dalam ruko sering meleset 20–60 m. Akurasi GPS dipakai sebagai toleransi (maks 30 m).
const MAX_GPS_TOLERANCE_METERS = 30;

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p = 0.017453292519943295;
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
  return 12742 * Math.asin(Math.sqrt(a)) * 1000;
}

function FlyToUser({ coord }: { coord: {lat: number, lng: number} | null }) {
  const map = useMap();
  useEffect(() => {
    if (coord) {
      const bounds = L.latLngBounds([TOKO_COORD.lat, TOKO_COORD.lng], [coord.lat, coord.lng]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
       map.setView([TOKO_COORD.lat, TOKO_COORD.lng], 16);
    }
  }, [coord, map]);
  return null;
}

const AbsenPopup: React.FC<AbsenPopupProps> = ({ jenisAbsen, isOpen, onClose, onSubmit, shift, tanggal }) => {
  const [userCoord, setUserCoord] = useState<{lat: number, lng: number} | null>(null);
  const [isLocationMatched, setIsLocationMatched] = useState<boolean>(false);
  const [locationError, setLocationError] = useState("");
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const evidenceItems = useMemo(
    () => getEvidenceItems(jenisAbsen, shift, tanggal),
    [jenisAbsen, shift, tanggal]
  );
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [pendingStream, setPendingStream] = useState<MediaStream | null>(null);

  // Assign the pending stream to the video element after it mounts
  useEffect(() => {
    if (isCameraActive && pendingStream && videoRef.current) {
      videoRef.current.srcObject = pendingStream;
      setPendingStream(null);
    }
  }, [isCameraActive, pendingStream]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setUserCoord(null);
      setIsLocationMatched(false);
      setLocationError("");
      setPhotos({});
      setActiveKey(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  const stopCamera = () => {
    // Stop any pending stream that hasn't been assigned yet
    if (pendingStream) {
      pendingStream.getTracks().forEach(t => t.stop());
      setPendingStream(null);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleMatchLocation = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Geolocation tidak didukung.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserCoord(coord);
        const dist = getDistance(coord.lat, coord.lng, TOKO_COORD.lat, TOKO_COORD.lng);
        const accuracy = Math.round(pos.coords.accuracy || 0);
        const tolerance = Math.min(accuracy, MAX_GPS_TOLERANCE_METERS);
        if (dist - tolerance <= MAX_DISTANCE_METERS) {
           setIsLocationMatched(true);
        } else {
           setIsLocationMatched(false);
           setLocationError(`Terlalu jauh! (${Math.round(dist)}m dari toko, akurasi GPS ±${accuracy}m). Coba dekat pintu/jendela lalu ulangi.`);
        }
      },
      () => {
        setLocationError("Gagal akses lokasi. Pastikan GPS aktif.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const startCamera = async (key: string) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Akses kamera gagal: Perangkat atau peramban ini tidak mendukung akses kamera (pastikan menggunakan koneksi aman/HTTPS).");
      return;
    }
    stopCamera();
    const item = evidenceItems.find(i => i.key === key);
    const facing = item?.facing || "user";
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      } catch {
        // Fallback: kamera apa pun yang tersedia (misal perangkat tanpa kamera belakang)
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      setActiveKey(key);
      // Set camera active FIRST so the <video> element renders in the DOM
      setIsCameraActive(true);
      // Store stream as pending — the useEffect will assign it to videoRef once available
      setPendingStream(stream);
    } catch (err) {
      alert("Akses kamera ditolak.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Compress image by scaling down
      const MAX_DIMENSION = 640;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height > width && height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
         // Apply horizontal flip to match standard selfie mirror view just like regular photos
         const activeItem = evidenceItems.find(i => i.key === activeKey);
         if (activeItem?.facing === "user") {
           ctx.translate(width, 0);
           ctx.scale(-1, 1);
         }
         ctx.drawImage(video, 0, 0, width, height);
         
         // Reset transform for watermark drawing (no flip)
         ctx.setTransform(1, 0, 0, 1, 0, 0);

         // === WATERMARK: Tanggal, Jam, Hari ===
         const now = new Date();
         const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
         const hariNama = hariList[now.getDay()];
         const jam = String(now.getHours()).padStart(2, '0');
         const menit = String(now.getMinutes()).padStart(2, '0');
         const detik = String(now.getSeconds()).padStart(2, '0');
         const tgl = String(now.getDate()).padStart(2, '0');
         const bln = String(now.getMonth() + 1).padStart(2, '0');
         const thn = now.getFullYear();

         const timeText = `${jam}:${menit}:${detik}`;
         const dateText = `${hariNama}, ${tgl}/${bln}/${thn}`;
         const absenLabel = `Absen ${jenisAbsen || ''}`;

         // Dynamic font sizing based on image width
         const baseFontSize = Math.max(12, Math.round(width * 0.038));
         const timeFontSize = Math.max(16, Math.round(width * 0.06));

         // Bottom banner background
         const bannerHeight = Math.round(height * 0.22);
         const bannerY = height - bannerHeight;
         
         // Gradient overlay for readability
         const gradient = ctx.createLinearGradient(0, bannerY - 20, 0, height);
         gradient.addColorStop(0, 'rgba(0,0,0,0)');
         gradient.addColorStop(0.3, 'rgba(0,0,0,0.5)');
         gradient.addColorStop(1, 'rgba(0,0,0,0.75)');
         ctx.fillStyle = gradient;
         ctx.fillRect(0, bannerY - 20, width, bannerHeight + 20);

         // Absen type badge (top-left of banner)
         const badgePadX = 8;
         const badgePadY = 4;
         const badgeText = (activeKey && activeKey !== 'identitas' ? (evidenceItems.find(i => i.key === activeKey)?.label || absenLabel) : absenLabel).toUpperCase();
         ctx.font = `bold ${baseFontSize - 2}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
         const badgeWidth = ctx.measureText(badgeText).width + badgePadX * 2;
         const badgeX = Math.round(width * 0.04);
         const badgeY = bannerY + Math.round(bannerHeight * 0.12);
         
         // Badge background
         const badgeColor = jenisAbsen === 'Masuk' ? 'rgba(16,185,129,0.85)' : 'rgba(245,158,11,0.85)';
         ctx.fillStyle = badgeColor;
         const badgeH = baseFontSize + badgePadY * 2;
         ctx.beginPath();
         const r = 5;
         ctx.moveTo(badgeX + r, badgeY);
         ctx.lineTo(badgeX + badgeWidth - r, badgeY);
         ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + r);
         ctx.lineTo(badgeX + badgeWidth, badgeY + badgeH - r);
         ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeH, badgeX + badgeWidth - r, badgeY + badgeH);
         ctx.lineTo(badgeX + r, badgeY + badgeH);
         ctx.quadraticCurveTo(badgeX, badgeY + badgeH, badgeX, badgeY + badgeH - r);
         ctx.lineTo(badgeX, badgeY + r);
         ctx.quadraticCurveTo(badgeX, badgeY, badgeX + r, badgeY);
         ctx.closePath();
         ctx.fill();

         // Badge text
         ctx.fillStyle = '#ffffff';
         ctx.textBaseline = 'middle';
         ctx.fillText(badgeText, badgeX + badgePadX, badgeY + badgeH / 2 + 1);

         // Time (large, bold)
         ctx.font = `bold ${timeFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
         ctx.fillStyle = '#ffffff';
         ctx.textBaseline = 'bottom';
         const timeY = height - Math.round(bannerHeight * 0.3);
         ctx.shadowColor = 'rgba(0,0,0,0.5)';
         ctx.shadowBlur = 4;
         ctx.fillText(timeText, badgeX, timeY);
         ctx.shadowBlur = 0;

         // Date line (smaller, below time)
         ctx.font = `600 ${baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
         ctx.fillStyle = 'rgba(255,255,255,0.85)';
         ctx.textBaseline = 'bottom';
         ctx.fillText(dateText, badgeX, height - Math.round(bannerHeight * 0.08));
         
         const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
         if (activeKey) setPhotos(p => ({ ...p, [activeKey]: dataUrl }));
         stopCamera();
      }
    }
  };

  const missingCount = evidenceItems.filter(it => !photos[it.key]).length;
  const canSubmit = !submitting && isLocationMatched && !!userCoord && missingCount === 0;

  const handleSubmit = async () => {
    if (!canSubmit || !photos.identitas) return;
    setSubmitting(true);
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const evidence: AbsenEvidence[] = evidenceItems
        .filter(it => it.key !== "identitas")
        .map(it => ({ key: it.key, label: it.label, foto: photos[it.key] }));
      await onSubmit(`${hh}:${mm} - ${dd}/${mo}/${yyyy}`, photos.identitas, userCoord!, evidence);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet
      open={isOpen}
      onClose={() => { if (!submitting) onClose(); }}
      size="sm"
      variant="surface"
      zClassName="z-[99999]"
      title={`Absen ${jenisAbsen || ""}`}
      subtitle="Konfirmasi lokasi dan foto Anda."
      footer={
        <div className="space-y-2.5">
          {missingCount > 0 && isLocationMatched && (
            <p className="text-caption text-center text-negative font-medium">
              {missingCount} foto wajib belum diisi
            </p>
          )}
          <Button
            variant="filled"
            size="lg"
            block
            disabled={!canSubmit}
            loading={submitting}
            onClick={handleSubmit}
          >
            {submitting ? "Memproses Absensi..." : `Kirim Absen ${jenisAbsen || ""}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="apple-tile rounded-tile p-4 space-y-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-tint" />
              <span className="text-subhead font-semibold text-label">Lokasi Anda</span>
            </div>
            {locationError && <Notice tone="negative">{locationError}</Notice>}
          </div>

          <div className="w-full h-36 bg-fill rounded-field overflow-hidden relative ring-1 ring-edge">
            <MapContainer
              center={[TOKO_COORD.lat, TOKO_COORD.lng]}
              zoom={16}
              scrollWheelZoom={false}
              style={{ width: "100%", height: "100%" }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
              <Marker position={[TOKO_COORD.lat, TOKO_COORD.lng]} />
              <Circle
                center={[TOKO_COORD.lat, TOKO_COORD.lng]}
                radius={MAX_DISTANCE_METERS}
                pathOptions={{ color: "#0088FF", fillColor: "#0088FF", fillOpacity: 0.15, weight: 1 }}
              />
              {userCoord && <Marker position={[userCoord.lat, userCoord.lng]} />}
              <FlyToUser coord={userCoord} />
            </MapContainer>
          </div>

          {isLocationMatched ? (
            <button
              type="button"
              onClick={handleMatchLocation}
              className="flex w-full items-center justify-center gap-2 min-h-[44px] rounded-full bg-positive/15 text-positive border border-positive/30 text-subhead font-semibold transition-colors"
            >
              Lokasi Sesuai ✓
            </button>
          ) : (
            <Button variant="filled" size="md" block onClick={handleMatchLocation}>
              {userCoord ? "Coba Lagi" : "Cocokkan Koordinat"}
            </Button>
          )}
        </div>

        {evidenceItems.map((item, idx) => {
          const foto = photos[item.key];
          const isActive = isCameraActive && activeKey === item.key;
          const mirror = item.facing === "user";
          return (
            <div key={item.key} className="apple-tile rounded-tile p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-subhead font-semibold text-label flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-positive" /> {item.label}
                </span>
                {idx > 0 && (
                  <Pill color={foto ? "green" : "red"}>{foto ? "Terisi" : "Wajib"}</Pill>
                )}
              </div>

              {foto ? (
                <div className="relative w-full aspect-[4/3] rounded-field overflow-hidden border-2 border-positive/60 shadow-card">
                  <img src={foto} alt={`Foto ${item.label}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotos((p) => {
                        const n = { ...p };
                        delete n[item.key];
                        return n;
                      });
                      startCamera(item.key);
                    }}
                    className="absolute bottom-3 right-3 apple-glass px-3.5 py-1.5 rounded-full text-caption font-semibold text-label active:scale-95 transition-transform shadow-card"
                  >
                    Ulangi
                  </button>
                </div>
              ) : isActive ? (
                <div className="relative w-full aspect-[4/3] rounded-field overflow-hidden bg-black ring-1 ring-edge">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${mirror ? "scale-x-[-1]" : ""}`}
                  />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      aria-label="Ambil foto"
                      className="w-16 h-16 bg-white/30 backdrop-blur-md flex items-center justify-center rounded-full active:scale-90 transition-transform"
                    >
                      <div className="w-[52px] h-[52px] bg-white rounded-full shadow-card" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startCamera(item.key)}
                  disabled={!isLocationMatched}
                  className={`w-full py-6 text-subhead font-semibold rounded-field transition-colors flex flex-col items-center justify-center gap-2 border border-dashed ${
                    isLocationMatched
                      ? "bg-positive/10 text-positive border-positive/40 hover:bg-positive/15"
                      : "bg-fill text-label-3 border-sep opacity-60 cursor-not-allowed"
                  }`}
                >
                  <Camera className="w-7 h-7 opacity-80" />
                  Buka Kamera
                </button>
              )}
            </div>
          );
        })}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </Sheet>
  );
};

export default AbsenPopup;
