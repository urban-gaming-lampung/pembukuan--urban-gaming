import React, { useEffect, useState, useRef } from "react";
import { PresenceData } from "../hooks/usePresence";
import { useBodyScrollLock } from "../hooks/useBodyScrollLock";
const logoImg = new URL('/images/logo.png', import.meta.url).href;

type HeaderProps = {
  rootRef: React.RefObject<HTMLDivElement>;
  tanggal: string;

  dark: boolean;
  onToggleTheme: () => void;
  onSharePDF: () => void;
  onOpenSettings: () => void;
  onOpenScan: () => void;
  onOpenPOS: () => void;

  hasData: boolean;
  mandatoryFilled: boolean;
  isEditing: boolean;
  hasUnsavedChanges: boolean;
  onSaveEdit: () => void;
  onAddData: () => void;
  onCancelEdit: () => void;
  userEmail?: string;
  userProfilePic?: string;
  activeUsers?: PresenceData[];
  onHeightChange?: (h: number) => void;
  hasPOSUpdate?: boolean;
};

// --- ICONS (SF Symbols Style) ---
const Icons = {
  Plus: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>,
  Save: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>,
  XMark: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>,
  Share: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>,
  Moon: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  Sun: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>,
  Cog: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
  CogActive: () => <svg className="w-5 h-5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>,
  Calendar: () => <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  QrCode: () => <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M7 17h.01M17 7h.01M17 17h.01M17 21h.01M21 17h.01M17 14h.01" /></svg>,
  POS: () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
};

const AVATAR_COLORS = [
  "bg-red-500 border-red-600",
  "bg-orange-500 border-orange-600",
  "bg-amber-500 border-amber-600",
  "bg-green-500 border-green-600",
  "bg-emerald-500 border-emerald-600",
  "bg-teal-500 border-teal-600",
  "bg-cyan-500 border-cyan-600",
  "bg-blue-500 border-blue-600",
  "bg-indigo-500 border-indigo-600",
  "bg-violet-500 border-violet-600",
  "bg-purple-500 border-purple-600",
  "bg-fuchsia-500 border-fuchsia-600",
  "bg-pink-500 border-pink-600",
  "bg-rose-500 border-rose-600",
];

function getColorForEmail(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Header({
  rootRef,
  tanggal,
  dark,
  onToggleTheme,
  onSharePDF,
  onOpenSettings,
  onOpenScan,
  hasData,
  mandatoryFilled,
  isEditing,
  hasUnsavedChanges,
  onSaveEdit,
  onAddData,
  onCancelEdit,
  userEmail,
  userProfilePic,
  activeUsers,
  onHeightChange,
  onOpenPOS,
  hasPOSUpdate,
}: HeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [openEmptyAlert, setOpenEmptyAlert] = useState(false);
  const [openMandatoryAlert, setOpenMandatoryAlert] = useState(false);

  useBodyScrollLock(openConfirm);
  useBodyScrollLock(openEmptyAlert);
  useBodyScrollLock(openMandatoryAlert);

  const okBtnRef = useRef<HTMLButtonElement | null>(null);
  const scrolledRef = useRef(false);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          if (y > 50 && !scrolledRef.current) {
            scrolledRef.current = true;
            setScrolled(true);
          } else if (y < 20 && scrolledRef.current) {
            scrolledRef.current = false;
            setScrolled(false);
          }
          ticking.current = false;
        });
        ticking.current = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Report height to parent for dynamic padding (native CSS property)
  // FIX: Debounce ResizeObserver to prevent layout thrashing and stuttering during scroll transitions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    let timeoutId: ReturnType<typeof setTimeout>;
    let lastHeight = 0;
    
    const measure = () => {
      // Jangan rekam tinggi header saat menyusut karena scroll, agar halaman tidak loncat ke atas
      if (scrolledRef.current) return;
      
      const h = el.offsetHeight;
      if (Math.abs(h - lastHeight) > 2) {
        lastHeight = h;
        document.documentElement.style.setProperty('--app-header-height', `${h}px`);
        if (onHeightChange) onHeightChange(h);
      }
    };

    // Run initial measure
    measure();

    const ro = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      // Tunggu sampai animasi CSS selesai (300ms) sebelum mengukur ulang
      timeoutId = setTimeout(measure, 350);
    });
    
    ro.observe(el);
    
    return () => {
      ro.disconnect();
      clearTimeout(timeoutId);
    };
  }, [onHeightChange]);

  useEffect(() => {
    if (openConfirm) {
      setTimeout(() => okBtnRef.current?.focus(), 50);
    }
  }, [openConfirm]);

  const handleCreateCheck = () => {
    if (!hasData) {
      setOpenEmptyAlert(true);
    } else if (!mandatoryFilled) {
      setOpenMandatoryAlert(true);
    } else {
      setOpenConfirm(true);
    }
  };

  const handleConfirmOk = () => {
    setOpenConfirm(false);
    onAddData();
  };

  // --- STYLES ---
  const glassContainer = [
    "fixed top-0 left-0 right-0 z-50 mx-auto max-w-6xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
    "will-change-transform",
    "px-4 md:px-8",
    scrolled ? "pt-2 sm:pt-4" : "pt-4 sm:pt-8",
  ].join(" ");

  const glassPanel = [
    "relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-2",
    "backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70 supports-[backdrop-filter]:bg-white/60",
    "border border-white/40 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5",
    "shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-black/20",
    "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
    "will-change-[padding,border-radius,box-shadow]",
    scrolled ? "rounded-[28px] p-3 shadow-lg" : "rounded-[32px] p-4 sm:p-6",
  ].join(" ");

  const titleStyle = [
    "font-bold tracking-tight text-zinc-900 dark:text-white transition-all duration-300",
    scrolled ? "text-lg md:text-xl" : "text-xl md:text-3xl",
  ].join(" ");

  return (
    <>
      <header className="font-sans">
        <div ref={containerRef} className={glassContainer}>
          <div ref={rootRef} className={glassPanel}>

            {/* Background Glow */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/5" />

            {/* --- TOP / LEFT SECTION: Logo & Title & Mobile Icons --- */}
            <div className="flex items-center justify-between w-full md:w-auto relative z-10">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className={`relative shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700 shadow-inner flex items-center justify-center border border-white/20 dark:border-white/5 transition-all duration-300 ${scrolled ? "w-10 h-10" : "w-14 h-14"}`}>
                  {userProfilePic ? (
                     <img src={userProfilePic} alt="Profile" className="w-full h-full object-cover opacity-90" />
                  ) : (
                     <div className="text-zinc-400 text-2xl">👤</div>
                  )}
                </div>

                <div className="flex flex-col">
                  <h1 className={titleStyle}>
                    Hi, {userEmail?.split('@')[0] || "User"}
                    <span className={`block sm:inline font-normal text-zinc-500 dark:text-zinc-400 sm:ml-2 text-[11px] sm:text-sm transition-opacity duration-300 ${scrolled ? "opacity-0 h-0 sm:w-0 overflow-hidden" : "opacity-100"}`}>
                      Pembukuan Digital, URBAN Gaming
                    </span>
                  </h1>

                  <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 transition-all duration-300 ${scrolled ? "opacity-0 h-0 overflow-hidden" : "opacity-100 h-auto"}`}>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-white/10 shrink-0">
                      <Icons.Calendar />
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{tanggal}</span>
                    </div>

                    {/* PRESENCE BADGES */}
                    <div className="flex flex-wrap items-center gap-1 md:ml-1" title="User Aktif (Live)">
                      {activeUsers?.map((u) => {
                        const customStyle = u.profileColor ? { backgroundColor: u.profileColor, borderColor: u.profileColor } : undefined;
                        const defaultCls = u.profileColor ? '' : getColorForEmail(u.email);

                        return (
                        <div key={u.uid} style={customStyle} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-sm ${defaultCls}`} title={`Sedang aktif di tab: ${u.tab}`}>
                          <span className="text-[11px] font-bold text-white tracking-wide uppercase max-w-[100px] sm:max-w-none truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                            {u.email === userEmail ? "SAYA" : u.email.split('@')[0]}
                          </span>
                          {u.tab === "UPDATE STOK" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.8)] shrink-0" title="Sedang mengedit stok" />
                          )}
                        </div>
                      )})}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Icons (Hidden on Desktop) */}
              <div className="flex md:hidden items-center gap-1">
                <IconButton onClick={onOpenPOS} icon={<Icons.POS />} title="POS (Kasir)" hasBadge={hasPOSUpdate} />
                <IconButton onClick={onOpenScan} icon={<Icons.QrCode />} title="Scan QR Code" />
                <IconButton onClick={onOpenSettings} icon={<Icons.Cog />} title="Pengaturan" />
              </div>
            </div>

            {/* --- BOTTOM / RIGHT SECTION: Actions --- */}
            <div className={`flex flex-col md:flex-row md:items-center gap-2 relative z-10 transition-all duration-300 w-full md:w-auto`}>

              <div className="hidden md:block w-px h-8 bg-zinc-200 dark:bg-white/10 mx-2" />

              <div className="flex flex-col gap-2 w-full md:w-auto">
                {hasData && isEditing && hasUnsavedChanges ? (
                  <>
                    {/* Row 1: Batal + Simpan */}
                    <div className="flex items-center gap-2">
                      <ActionButton onClick={onCancelEdit} icon={<Icons.XMark />} label="Batal" variant="secondary" compact={scrolled} className="flex-1 md:flex-none justify-center" />
                      <ActionButton onClick={onSaveEdit} icon={<Icons.Save />} label="Simpan" variant="primary" compact={scrolled} className="flex-1 md:flex-none justify-center" />
                    </div>
                    {/* Row 2: Baru + Export PDF */}
                    <div className="flex items-center gap-2">
                      <ActionButton onClick={handleCreateCheck} icon={<Icons.Plus />} label="Baru" variant="blue" compact={scrolled} className="flex-1 md:flex-none justify-center" />
                      <ActionButton onClick={onSharePDF} icon={<Icons.Share />} label={scrolled ? "PDF" : "Export PDF"} variant="secondary" compact={scrolled} className="flex-1 md:flex-none justify-center" />
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <ActionButton onClick={handleCreateCheck} icon={<Icons.Plus />} label={scrolled ? "Catat" : hasData ? "Tambah Data" : " Catatan"} variant="primary" className="flex-1 w-full md:w-auto justify-center" />
                    <ActionButton onClick={onSharePDF} icon={<Icons.Share />} label={scrolled ? "PDF" : "Export PDF"} variant="secondary" compact={scrolled} className="flex-1 md:flex-none justify-center" />
                  </div>
                )}
              </div>

              {/* Desktop Icons (Hidden on Mobile) */}
              <div className="hidden md:flex items-center gap-2 md:ml-1">
                <IconButton onClick={onOpenPOS} icon={<Icons.POS />} title="POS (Kasir)" hasBadge={hasPOSUpdate} />
                <IconButton onClick={onOpenScan} icon={<Icons.QrCode />} title="Scan QR Code" />
                <IconButton onClick={onOpenSettings} icon={<Icons.Cog />} title="Pengaturan" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- CONFIRM DIALOG --- */}
      {openConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ perspective: "1000px" }}>
          <div className="absolute inset-0 bg-zinc-900/30 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300" onClick={() => setOpenConfirm(false)} />
          <div className="relative w-full max-w-[320px] overflow-hidden rounded-[26px] bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <Icons.Save />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">Simpan Data?</h3>
              <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">Pastikan Anda sudah melakukan screenshot bukti jika diperlukan. Data ini akan disimpan permanen.</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button onClick={() => setOpenConfirm(false)} className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-zinc-600 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 transition-colors">Batal</button>
                <button ref={okBtnRef} onClick={handleConfirmOk} className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]">Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {openEmptyAlert && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 font-sans" style={{ perspective: "1000px" }}>
          <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setOpenEmptyAlert(false)} />
          <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/80 dark:bg-[#1C1C1E]/85 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">
                Form Masih Kosong
              </h3>
              <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Isi setidaknya satu nilai atau rincian sebelum menyimpan.
              </p>
            </div>
            <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
              <button onClick={() => setOpenEmptyAlert(false)} className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10">
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {openMandatoryAlert && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 font-sans" style={{ perspective: "1000px" }}>
          <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px] transition-opacity" onClick={() => setOpenMandatoryAlert(false)} />
          <div className="relative w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[20px] bg-white/80 dark:bg-[#1C1C1E]/85 backdrop-blur-xl shadow-2xl ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <h3 className="text-[17px] font-semibold text-zinc-900 dark:text-white mb-1">
                Data Belum Lengkap
              </h3>
              <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Absen Pagi, Absen Siang, Ruko Buka, dan Ruko Tutup <span className="font-bold text-zinc-800 dark:text-zinc-200">wajib diisi</span> sebelum menyimpan data.
              </p>
            </div>
            <div className="grid grid-cols-1 border-t border-gray-300/30 dark:border-white/10">
              <button
                onClick={() => setOpenMandatoryAlert(false)}
                className="w-full py-3.5 text-[15px] font-semibold text-blue-500 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors active:bg-zinc-200 dark:active:bg-white/10"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "blue";

const ActionButton = ({ onClick, icon, label, variant = "secondary", compact = false, className = "" }: { onClick: () => void; icon: React.ReactNode; label: string; variant?: ButtonVariant; compact?: boolean; className?: string; }) => {
  const base = "group relative flex items-center gap-2 rounded-xl transition-all duration-200 active:scale-[0.96] disabled:opacity-50 font-semibold select-none overflow-hidden";
  const size = compact ? "px-3 py-2 text-xs" : "px-4 py-2.5 text-sm";
  const variants = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md shadow-zinc-500/10",
    secondary: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 border border-transparent dark:border-white/5",
    ghost: "bg-transparent text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
    blue: "bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/25 border border-blue-400/20"
  };
  return (
    <button onClick={onClick} className={`${base} ${size} ${variants[variant]} ${className}`}>
      {(variant === "primary" || variant === "blue") && <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />}
      <span className="relative z-0">{icon}</span><span className="relative z-0">{label}</span>
    </button>
  );
};

const IconButton = ({ onClick, icon, title, hasBadge }: { onClick: () => void; icon: React.ReactNode; title: string; hasBadge?: boolean }) => {
  return (
    <button onClick={onClick} title={title} className="relative p-2.5 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800 transition-all active:scale-95 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
      {icon}
      {hasBadge && (
        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-zinc-900 animate-pulse pointer-events-none" />
      )}
    </button>
  );
};