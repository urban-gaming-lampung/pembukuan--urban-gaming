import React from "react";

export function getInitials(nameOrEmail?: string): string {
  if (!nameOrEmail) return "U";
  const clean = nameOrEmail.split("@")[0].trim();
  if (clean.length >= 2) {
    return clean.substring(0, 2).toUpperCase();
  }
  return clean.substring(0, 1).toUpperCase();
}

export interface UserAvatarProps {
  photoUrl?: string | null;
  email?: string;
  name?: string;
  profileColor?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showStatusBadge?: boolean;
  statusBadgeColor?: string;
  statusBadgeActive?: boolean;
}

const SIZE_MAP = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-9 h-9 text-xs",
  lg: "w-10 h-10 text-sm",
  xl: "w-12 h-12 text-base",
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoUrl,
  email,
  name,
  profileColor,
  size = "md",
  className = "",
  showStatusBadge = false,
  statusBadgeColor = "bg-emerald-500",
  statusBadgeActive = true,
}) => {
  const initial = getInitials(name || email);
  const bgColor = profileColor || "#3b82f6";
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className={`${sizeClasses} rounded-full overflow-hidden flex items-center justify-center border border-black/10 dark:border-white/10 shadow-sm`}
        style={{ backgroundColor: photoUrl ? undefined : bgColor }}
      >
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name || email || "Avatar"}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-bold text-white tracking-wider select-none">
            {initial}
          </span>
        )}
      </div>

      {showStatusBadge && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${statusBadgeActive ? statusBadgeColor : "bg-zinc-400"} border-2 border-white dark:border-zinc-800`}
        />
      )}
    </div>
  );
};

export default UserAvatar;
