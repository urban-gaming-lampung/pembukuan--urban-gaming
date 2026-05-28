import React from 'react';

interface RankBadgeProps {
  rank: number;
  size?: 'sm' | 'md';
}

/**
 * RankBadge is a premium circular badge component representing leaderboard positions.
 * It uses Apple HIG system gradients for Top 3 and clean neutral grays for other positions.
 */
export default function RankBadge({ rank, size = 'md' }: RankBadgeProps) {
  const sizeClass = size === 'md' ? 'w-10 h-10 text-[14px]' : 'w-7 h-7 text-[10px]';
  const borderClass = size === 'md' ? 'border-[2px]' : 'border-[1.5px]';

  let bgGradient = '';
  let borderStyle = '';
  let shadowGlow = '';
  let textColor = 'text-white';

  if (rank === 1) {
    // Gold Gradient: #FFD60A -> #FF9F0A
    bgGradient = 'from-[#FFD60A] to-[#FF9F0A]';
    borderStyle = 'border-[#FFD60A]';
    shadowGlow = 'shadow-[0_0_12px_rgba(255,214,10,0.4)]';
  } else if (rank === 2) {
    // Silver Gradient: #E5E5EA -> #8E8E93
    bgGradient = 'from-[#E5E5EA] to-[#8E8E93]';
    borderStyle = 'border-[#C7C7CC]';
    shadowGlow = 'shadow-[0_0_12px_rgba(229,229,234,0.3)]';
  } else if (rank === 3) {
    // Bronze Gradient: #FF9500 -> #A2542B
    bgGradient = 'from-[#FF9500] to-[#A2542B]';
    borderStyle = 'border-[#FF9500]';
    shadowGlow = 'shadow-[0_0_12px_rgba(255,149,0,0.35)]';
  } else {
    // Rank 4+ Neutral gray
    bgGradient = 'bg-[#E5E5EA] dark:bg-[#48484A]';
    borderStyle = 'border-zinc-300 dark:border-zinc-700';
    textColor = 'text-[#48484A] dark:text-[#E5E5EA]';
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-pixel font-bold select-none ${sizeClass} ${borderClass} ${borderStyle} ${shadowGlow} ${
        rank <= 3 ? `bg-gradient-to-b ${bgGradient}` : bgGradient
      } ${textColor} transition-all duration-300`}
    >
      {rank}
    </div>
  );
}
