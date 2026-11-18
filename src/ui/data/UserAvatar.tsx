import React from "react";
import { cx } from "../foundations/cn";

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
  statusBadgeColor = "bg-positive",
  statusBadgeActive = true,
}) => {
  const [imgError, setImgError] = React.useState(false);
  const initial = getInitials(name || email);
  const bgColor = profileColor || "#0088FF";
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  React.useEffect(() => {
    setImgError(false);
  }, [photoUrl]);

  const showImage = Boolean(photoUrl && !imgError);

  return (
    <div className={cx("relative shrink-0", className)}>
      <div
        className={cx(
          sizeClasses,
          "rounded-full overflow-hidden flex items-center justify-center border border-black/10 dark:border-white/10 shadow-sm"
        )}
        style={{ backgroundColor: showImage ? undefined : bgColor }}
      >
        {showImage ? (
          <img
            src={photoUrl!}
            alt={name || email || "Avatar"}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="font-bold text-white tracking-wider select-none">
            {initial}
          </span>
        )}
      </div>

      {showStatusBadge && (
        <div
          className={cx(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface",
            statusBadgeActive ? statusBadgeColor : "bg-label-3"
          )}
        />
      )}
    </div>
  );
};

export default UserAvatar;
