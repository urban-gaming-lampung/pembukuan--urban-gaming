import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Image,
  Plus,
  QrCode,
  Save,
  Settings,
  Share,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { PresenceData } from "../hooks/usePresence";
import { AlertDialog } from "../ui";

type HeaderProps = {
  rootRef?: React.RefObject<HTMLDivElement>;
  tanggal: string;
  sectionTitle?: string;

  onSharePDF: () => void;
  onOpenSettings: () => void;
  onOpenScan: () => void;
  onOpenPOS: () => void;
  onOpenGallery?: () => void;
  isSuperAdminOrOwner?: boolean;

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

const AVATAR_COLORS = [
  "bg-[#FF383C]",
  "bg-[#FF8D28]",
  "bg-[#34C759]",
  "bg-[#00C8B3]",
  "bg-[#00C0E8]",
  "bg-[#0088FF]",
  "bg-[#6155F5]",
  "bg-[#CB30E0]",
  "bg-[#FF2D55]",
];

export function getColorForEmail(email: string) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function Header({
  tanggal,
  sectionTitle,
  onSharePDF,
  onOpenSettings,
  onOpenScan,
  onOpenPOS,
  onOpenGallery,
  isSuperAdminOrOwner,
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
  hasPOSUpdate,
}: HeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [openEmptyAlert, setOpenEmptyAlert] = useState(false);
  const [openMandatoryAlert, setOpenMandatoryAlert] = useState(false);

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

  // Rekam tinggi header hanya saat posisi normal (belum menyusut) agar tidak terjadi scroll jump
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let lastHeight = 0;

    const measure = () => {
      if (scrolledRef.current) return;
      const h = el.offsetHeight;
      if (h > 0 && Math.abs(h - lastHeight) > 2) {
        lastHeight = h;
        document.documentElement.style.setProperty("--app-header-height", `${h}px`);
        if (onHeightChange) onHeightChange(h);
      }
    };

    measure();

    const ro = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(measure, 320);
    });

    ro.observe(el);

    return () => {
      ro.disconnect();
      clearTimeout(timeoutId);
    };
  }, [onHeightChange]);

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

  const namaPendek = userEmail?.split("@")[0] || "User";

  const utilityIcons = (compact?: boolean) => (
    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
      {isSuperAdminOrOwner && onOpenGallery && (
        <IconButton
          onClick={onOpenGallery}
          icon={<Image className="w-[18px] h-[18px] sm:w-[19px] sm:h-[19px]" />}
          title="Galeri Media (Story & Promo)"
          compact={compact}
        />
      )}
      <IconButton
        onClick={onOpenPOS}
        icon={<ShoppingCart className="w-[18px] h-[18px] sm:w-[19px] sm:h-[19px]" />}
        title="Kasir URBAN"
        hasBadge={hasPOSUpdate}
        compact={compact}
      />
      <IconButton
        onClick={onOpenScan}
        icon={<QrCode className="w-[18px] h-[18px] sm:w-[19px] sm:h-[19px]" />}
        title="Scan QR Code"
        compact={compact}
      />
      <IconButton
        onClick={onOpenSettings}
        icon={<Settings className="w-[18px] h-[18px] sm:w-[19px] sm:h-[19px]" />}
        title="Pengaturan"
        compact={compact}
      />
    </div>
  );

  const renderActionButtons = () => (
    <div className="flex flex-col gap-1.5 w-full md:w-auto">
      {hasData && isEditing && hasUnsavedChanges ? (
        <>
          <div className="flex items-center gap-2">
            <ActionButton
              onClick={onCancelEdit}
              icon={<X className="w-4 h-4" />}
              label="Batal"
              variant="secondary"
              compact={scrolled}
              className="flex-1 md:flex-none justify-center"
            />
            <ActionButton
              onClick={onSaveEdit}
              icon={<Save className="w-4 h-4" />}
              label="Simpan"
              variant="primary"
              compact={scrolled}
              className="flex-1 md:flex-none justify-center"
            />
          </div>
          <div className="flex items-center gap-2">
            <ActionButton
              onClick={handleCreateCheck}
              icon={<Plus className="w-4 h-4" />}
              label="Baru"
              variant="tinted"
              compact={scrolled}
              className="flex-1 md:flex-none justify-center"
            />
            <ActionButton
              onClick={onSharePDF}
              icon={<Share className="w-4 h-4" />}
              label={scrolled ? "PDF" : "Export PDF"}
              variant="secondary"
              compact={scrolled}
              className="flex-1 md:flex-none justify-center"
            />
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <ActionButton
            onClick={handleCreateCheck}
            icon={<Plus className="w-4 h-4" />}
            label={scrolled ? "Catat" : hasData ? "Tambah Data" : "Catatan"}
            variant="primary"
            compact={scrolled}
            className="flex-1 md:flex-none justify-center"
          />
          <ActionButton
            onClick={onSharePDF}
            icon={<Share className="w-4 h-4" />}
            label={scrolled ? "PDF" : "Export PDF"}
            variant="secondary"
            compact={scrolled}
            className="flex-1 md:flex-none justify-center"
          />
        </div>
      )}
    </div>
  );

  // Floating frosted-glass panel
  const glassContainer = [
    "mx-auto w-full max-w-6xl px-4 md:px-8 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
    scrolled ? "pt-[max(0.65rem,env(safe-area-inset-top))] sm:pt-4" : "pt-[max(1rem,env(safe-area-inset-top))] sm:pt-6",
  ].join(" ");

  const glassPanel = [
    "relative overflow-hidden apple-glass",
    "border border-[var(--ui-glass-border)] ring-1 ring-edge",
    "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[padding,border-radius,box-shadow]",
    scrolled
      ? "rounded-card md:rounded-full p-3 sm:px-5 sm:py-2.5 shadow-float"
      : "rounded-card sm:rounded-[28px] p-4 sm:p-6 shadow-card",
  ].join(" ");

  return (
    <>
      <div ref={containerRef} className={glassContainer}>
        <div className={glassPanel}>
          {/* Subtle glass top-left highlight */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-transparent dark:from-white/5" />

          {/* MOBILE HEADER (< md): Versi awal (Avatar + Greeting + Presence + Utility Icons di atas, Aksi penuh di bawah) */}
          <div className="flex flex-col gap-3 md:hidden relative z-10">
            <div className="flex items-start justify-between gap-2 w-full min-w-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`relative shrink-0 overflow-hidden rounded-full bg-fill shadow-inner flex items-center justify-center border border-white/40 dark:border-white/10 transition-all duration-300 ${
                    scrolled ? "w-10 h-10" : "w-14 h-14"
                  }`}
                >
                  {userProfilePic ? (
                    <img src={userProfilePic} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className={scrolled ? "w-4 h-4 text-label-2" : "w-6 h-6 text-label-2"} />
                  )}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <h1
                    className={`font-bold tracking-tight text-label truncate transition-all duration-300 ${
                      scrolled ? "text-lg" : "text-xl"
                    }`}
                  >
                    Hi, {namaPendek}
                  </h1>
                  <span
                    className={`text-caption sm:text-footnote font-normal text-label-2 truncate transition-all duration-300 ${
                      scrolled ? "opacity-0 h-0 overflow-hidden" : "opacity-100 mt-0.5"
                    }`}
                  >
                    Pembukuan Digital, URBAN Gaming
                  </span>

                  <div
                    className={`flex flex-wrap items-center gap-1.5 transition-all duration-300 ${
                      scrolled ? "opacity-0 h-0 overflow-hidden mt-0" : "opacity-100 h-auto mt-1.5"
                    }`}
                  >
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-fill/85 border border-sep shrink-0">
                      <Calendar className="w-3 h-3 text-label-3" />
                      <span className="text-caption font-semibold text-label-2 tabular-nums">{tanggal}</span>
                    </div>

                    {activeUsers && activeUsers.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1" title="User Aktif (Live)">
                        {activeUsers.map((u) => {
                          const customStyle = u.profileColor ? { backgroundColor: u.profileColor } : undefined;
                          const defaultCls = u.profileColor ? "" : getColorForEmail(u.email);
                          return (
                            <div
                              key={u.uid}
                              style={customStyle}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full shadow-xs text-white ${defaultCls}`}
                              title={`Sedang aktif di tab: ${u.tab}`}
                            >
                              <span
                                className="text-[11px] font-bold tracking-wide uppercase max-w-[96px] truncate"
                                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}
                              >
                                {u.email === userEmail ? "SAYA" : u.email.split("@")[0]}
                              </span>
                              {u.tab === "UPDATE STOK" && (
                                <span
                                  className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.8)] shrink-0"
                                  title="Sedang mengedit stok"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center shrink-0">{utilityIcons(scrolled)}</div>
            </div>

            {renderActionButtons()}
          </div>

          {/* DESKTOP TOPBAR (md+): Dioptimalkan tanpa profil & presence ganda (karena sudah tampil di Sidebar) */}
          <div className="hidden md:flex items-center justify-between gap-4 w-full relative z-10 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="min-w-0">
                <h1
                  className={`font-bold tracking-tight text-label truncate transition-all duration-300 ${
                    scrolled ? "text-headline" : "text-title1"
                  }`}
                >
                  {sectionTitle || "Pembukuan Digital"}
                </h1>
                <div
                  className={`text-footnote text-label-2 truncate transition-all duration-300 ${
                    scrolled ? "opacity-0 h-0 overflow-hidden" : "opacity-100"
                  }`}
                >
                  URBAN Gaming · Pembukuan Digital
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-fill/85 border border-sep shrink-0">
                <Calendar className="w-3.5 h-3.5 text-label-3" />
                <span className="text-footnote font-semibold text-label-2 tabular-nums">{tanggal}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {renderActionButtons()}
              <div className="w-px h-7 bg-sep mx-1" aria-hidden />
              {utilityIcons(scrolled)}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        zClassName="z-[270]"
        icon={<Save />}
        iconColor="blue"
        title="Simpan Data?"
        description="Pastikan Anda sudah melakukan screenshot bukti jika diperlukan. Data ini akan disimpan permanen."
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setOpenConfirm(false) },
          { label: "Simpan", role: "primary", onClick: handleConfirmOk },
        ]}
      />

      <AlertDialog
        open={openEmptyAlert}
        onClose={() => setOpenEmptyAlert(false)}
        zClassName="z-[270]"
        icon={<AlertTriangle />}
        iconColor="yellow"
        title="Form Masih Kosong"
        description="Isi setidaknya satu nilai atau rincian sebelum menyimpan."
        actions={[
          { label: "Mengerti", role: "primary", onClick: () => setOpenEmptyAlert(false) },
        ]}
      />

      <AlertDialog
        open={openMandatoryAlert}
        onClose={() => setOpenMandatoryAlert(false)}
        zClassName="z-[270]"
        icon={<AlertTriangle />}
        iconColor="yellow"
        title="Data Belum Lengkap"
        description={
          <>
            Absen Pagi, Absen Siang, Ruko Buka, dan Ruko Tutup{" "}
            <strong className="font-semibold text-label">wajib diisi</strong> sebelum menyimpan data.
          </>
        }
        actions={[
          { label: "Mengerti", role: "primary", onClick: () => setOpenMandatoryAlert(false) },
        ]}
      />
    </>
  );
}

type ButtonVariant = "primary" | "tinted" | "secondary";

const ActionButton = ({
  onClick,
  icon,
  label,
  variant = "secondary",
  compact = false,
  className = "",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: ButtonVariant;
  compact?: boolean;
  className?: string;
}) => {
  const base =
    "group relative flex items-center gap-1.5 rounded-full transition-all duration-200 active:scale-[0.97] disabled:opacity-50 font-semibold select-none overflow-hidden whitespace-nowrap";
  const size = compact ? "px-3.5 py-1.5 text-footnote" : "px-4 py-2.5 min-h-[42px] text-subhead";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-action text-action-label hover:opacity-90 shadow-card",
    tinted: "bg-action/[0.08] text-action dark:bg-action/[0.15] hover:bg-action/[0.13] border border-sep",
    secondary: "bg-fill text-label hover:brightness-95 border border-sep",
  };
  return (
    <button type="button" onClick={onClick} className={`${base} ${size} ${variants[variant]} ${className}`}>
      {variant === "primary" && (
        <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/15 dark:via-black/15 to-transparent z-10" />
      )}
      <span className="relative z-0">{icon}</span>
      <span className="relative z-0">{label}</span>
    </button>
  );
};

const IconButton = ({
  onClick,
  icon,
  title,
  hasBadge,
  compact,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hasBadge?: boolean;
  compact?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    aria-label={title}
    className={`relative rounded-full text-label-2 hover:text-label hover:bg-fill active:scale-95 border border-transparent hover:border-sep transition-all ${
      compact ? "p-2" : "p-2 sm:p-2.5"
    }`}
  >
    {icon}
    {hasBadge && (
      <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-negative rounded-full ring-2 ring-surface animate-pulse pointer-events-none" />
    )}
  </button>
);
