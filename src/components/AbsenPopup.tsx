import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, MapPin, Camera, AlertCircle } from "lucide-react";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet marker icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
});

interface AbsenPopupProps {
  jenisAbsen: "Masuk" | "Pulang" | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (waktu: string, fotoBase64: string, koordinat: {lat: number, lng: number}) => void;
}

const TOKO_COORD = { lat: -5.3953862, lng: 105.2367764 }; // URBAN Gaming Lampung
const MAX_DISTANCE_METERS = 50;

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

const AbsenPopup: React.FC<AbsenPopupProps> = ({ jenisAbsen, isOpen, onClose, onSubmit }) => {
  useBodyScrollLock(isOpen);
  const [userCoord, setUserCoord] = useState<{lat: number, lng: number} | null>(null);
  const [isLocationMatched, setIsLocationMatched] = useState<boolean>(false);
  const [locationError, setLocationError] = useState("");
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
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
      setFotoBase64(null);
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
        if (dist <= MAX_DISTANCE_METERS) {
           setIsLocationMatched(true);
        } else {
           setIsLocationMatched(false);
           setLocationError(`Terlalu jauh! (${Math.round(dist)}m dari toko)`);
        }
      },
      (err) => {
        setLocationError("Gagal akses lokasi. Pastikan GPS aktif.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Akses kamera gagal: Perangkat atau peramban ini tidak mendukung akses kamera (pastikan menggunakan koneksi aman/HTTPS).");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
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
         ctx.translate(width, 0);
         ctx.scale(-1, 1);
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
         const badgeText = absenLabel.toUpperCase();
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
         setFotoBase64(dataUrl);
         stopCamera();
      }
    }
  };

  const handleSubmit = async () => {
    if (submitting || !isLocationMatched || !fotoBase64 || !userCoord) return;
    setSubmitting(true);
    try {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      await onSubmit(`${hh}:${mm} - ${dd}/${mo}/${yyyy}`, fotoBase64, userCoord);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const popupContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-[4px] transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-[340px] sm:max-w-[380px] overflow-hidden rounded-[28px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        {/* Header - Apple Style */}
        <div className="relative px-6 pt-6 pb-4 text-center">
          <h3 className="text-[19px] font-semibold tracking-tight text-zinc-900 dark:text-white">Absen {jenisAbsen}</h3>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1">Konfirmasi lokasi dan foto Anda.</p>
          <button 
            onClick={onClose} 
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5">
          
          {/* Lokasi Section */}
          <div className="bg-zinc-50 dark:bg-[#2C2C2E]/50 rounded-[20px] p-4 border border-black/5 dark:border-white/5 shadow-inner">
             <div className="flex flex-col gap-2 mb-3">
               <div className="flex items-center gap-2">
                 <MapPin className="w-4 h-4 text-blue-500" />
                 <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200">Lokasi Anda</span>
               </div>
               {locationError && (
                 <div className="flex w-fit items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-[11px] font-bold">
                   <AlertCircle className="w-3.5 h-3.5" />
                   {locationError}
                 </div>
               )}
             </div>
             
             <div className="w-full h-36 bg-zinc-200 dark:bg-zinc-800 rounded-xl overflow-hidden relative shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                <MapContainer center={[TOKO_COORD.lat, TOKO_COORD.lng]} zoom={16} scrollWheelZoom={false} style={{ width: '100%', height: '100%' }} zoomControl={false} attributionControl={false}>
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                  <Marker position={[TOKO_COORD.lat, TOKO_COORD.lng]} />
                  <Circle center={[TOKO_COORD.lat, TOKO_COORD.lng]} radius={MAX_DISTANCE_METERS} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 1 }} />
                  {userCoord && <Marker position={[userCoord.lat, userCoord.lng]} />}
                  <FlyToUser coord={userCoord} />
                </MapContainer>
             </div>
             
             <button 
               onClick={handleMatchLocation}
               className={`group relative flex w-full items-center justify-center gap-2 rounded-xl transition-all duration-200 active:scale-[0.96] disabled:opacity-50 font-semibold select-none overflow-hidden px-4 py-2.5 text-sm mt-3 ${
                 isLocationMatched
                 ? "bg-blue-100/50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-transparent"
                 : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md shadow-zinc-500/10 border border-transparent dark:border-white/5"
               }`}
             >
               {!isLocationMatched && <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 dark:via-black/10 to-transparent z-10" />}
               <span className="relative z-0">{isLocationMatched ? "Lokasi Sesuai ✓" : (userCoord ? "Coba Lagi" : "Cocokkan Koordinat")}</span>
             </button>
          </div>

          {/* Kamera Section */}
          <div className="bg-zinc-50 dark:bg-[#2C2C2E]/50 rounded-[20px] p-4 border border-black/5 dark:border-white/5 shadow-inner">
             <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                   <Camera className="w-4 h-4 text-emerald-500" /> Identitas
                </span>
             </div>

             {fotoBase64 ? (
               <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border-2 border-emerald-400 dark:border-emerald-500/50 shadow-sm">
                 <img src={fotoBase64} alt="Hasil Foto" className="w-full h-full object-cover" />
                 <button onClick={() => { setFotoBase64(null); startCamera(); }} className="absolute bottom-3 right-3 bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[12px] font-semibold text-zinc-800 dark:text-zinc-200 active:scale-95 transition-transform shadow-md">Ulangi</button>
               </div>
             ) : isCameraActive ? (
               <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-black shadow-inner ring-1 ring-black/10">
                 <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                 
                 {/* Apple-style shutter button */}
                 <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <button onClick={capturePhoto} className="w-16 h-16 bg-white/30 backdrop-blur-md flex items-center justify-center rounded-full active:scale-90 transition-transform">
                      <div className="w-[52px] h-[52px] bg-white rounded-full shadow-sm" />
                    </button>
                 </div>
               </div>
             ) : (
                <button 
                  onClick={startCamera}
                  disabled={!isLocationMatched}
                  className={`w-full py-6 text-[14px] font-semibold rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-2 border border-dashed
                    ${isLocationMatched 
                       ? "bg-emerald-50/50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30" 
                       : "bg-zinc-100/50 text-zinc-400 border-zinc-300 dark:bg-[#1C1C1E] dark:border-white/10 dark:text-zinc-500 opacity-60 cursor-not-allowed"}`}
                >
                  <Camera className="w-7 h-7 mb-1 opacity-80" /> 
                  Buka Kamera
                </button>
             )}
             <canvas ref={canvasRef} className="hidden" />
          </div>

        </div>

        {/* Footer Action */}
        <div className="p-5 border-t border-gray-200/50 dark:border-white/10 bg-zinc-50/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl">
           <button 
             onClick={handleSubmit}
             disabled={submitting || !isLocationMatched || !fotoBase64}
             className={`w-full py-3.5 text-[16px] font-semibold rounded-[14px] transition-all flex items-center justify-center gap-2
               ${(!submitting && isLocationMatched && fotoBase64) 
                 ? "bg-blue-500 text-white hover:bg-blue-600 shadow-md shadow-blue-500/20 active:scale-[0.98]" 
                 : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed"}`}
           >
             {submitting ? "Memproses Absensi..." : `Kirim Absen ${jenisAbsen || ''}`}
           </button>
        </div>

      </div>
    </div>
  );

  return createPortal(popupContent, document.body);
};

export default AbsenPopup;
