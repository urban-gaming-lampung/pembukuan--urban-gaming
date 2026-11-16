import React from 'react';
import { Gamepad2, Lock } from 'lucide-react';
import { AKSEN_TILE, IconBadge, kartu } from '../../ui';

interface ChallengeButtonProps {
  isAbsenDone: boolean;
  activeGameName: string;
  onClick: () => void;
}

/**
 * ChallengeButton component displayed on the main dashboard tab.
 * Prompts the user to enter the monthly retro challenge if they have completed daily check-in.
 */
export default function ChallengeButton({
  isAbsenDone,
  activeGameName,
  onClick,
}: ChallengeButtonProps) {
  if (isAbsenDone) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group relative flex w-full items-center justify-between gap-3 overflow-hidden p-4 sm:p-5 text-left font-sans transition-all duration-200 hover:scale-[1.005] active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/40 ${kartu}`}
        aria-label="Buka Tantangan Game Bulan Ini"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: AKSEN_TILE.teal.glow }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent dark:from-white/[0.04]"
        />
        {/* Shimmer animation effect */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/25 dark:via-white/[0.06] to-transparent z-10"
        />

        <div className="relative z-20 flex min-w-0 items-center gap-3.5">
          <IconBadge
            color="teal"
            className="h-11 w-11 sm:h-12 sm:w-12 rounded-tile [&>svg]:h-5 [&>svg]:w-5"
          >
            <Gamepad2 />
          </IconBadge>
          <div className="flex min-w-0 flex-col">
            <span className={`font-pixel text-[9px] sm:text-[10px] tracking-wider uppercase ${AKSEN_TILE.teal.iconText}`}>
              CHALLENGE BULAN INI
            </span>
            <span className="text-headline sm:text-title3 font-bold tracking-tight text-label capitalize leading-tight mt-0.5 truncate">
              {activeGameName || 'Loading game...'}
            </span>
          </div>
        </div>

        <span className="relative z-20 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-action text-action-label px-4 text-caption font-semibold shadow-sm transition-transform group-hover:scale-[1.02]">
          <span>Mainkan</span>
          <Gamepad2 className="h-3.5 w-3.5" />
        </span>
      </button>
    );
  }

  // Disabled state (Employee has not checked-in yet)
  return (
    <div
      className={`relative flex w-full items-center justify-between gap-3 overflow-hidden p-4 sm:p-5 opacity-80 cursor-not-allowed select-none font-sans ${kartu}`}
      aria-disabled="true"
      title="Absen masuk dulu untuk unlock"
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <IconBadge
          color="gray"
          variant="tinted"
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-tile [&>svg]:h-5 [&>svg]:w-5"
        >
          <Lock />
        </IconBadge>
        <div className="flex min-w-0 flex-col">
          <span className="font-pixel text-[9px] tracking-wider text-label-3 uppercase">
            CHALLENGE TERKUNCI
          </span>
          <span className="text-subhead font-semibold tracking-tight mt-0.5 text-label-2 leading-tight truncate">
            Absen masuk dulu untuk unlock
          </span>
        </div>
      </div>

      <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-fill ring-1 ring-edge px-3 text-caption2 font-semibold text-label-3">
        <span>Terkunci</span>
        <Lock className="h-3 w-3" />
      </span>
    </div>
  );
}
