import React from 'react';

interface iOSAlertProps {
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmDestructive?: boolean;
}

/**
 * iOSAlert is a premium iOS-style alert dialog component matching the Apple HIG.
 * Features a blurred background backdrop, centered card, and split actions.
 */
export default function IOSAlert({
  isOpen,
  title,
  body,
  cancelLabel = 'Batal',
  confirmLabel = 'Ganti',
  onCancel,
  onConfirm,
  confirmDestructive = false,
}: iOSAlertProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop: dim 40% + blur */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[8px] transition-opacity duration-300 animate-in fade-in"
        onClick={onCancel}
      />

      {/* Alert Dialog Box */}
      <div className="relative w-full max-w-[270px] bg-white/90 dark:bg-[#1E1E1E]/90 backdrop-blur-2xl rounded-2xl flex flex-col overflow-hidden text-center shadow-2xl border border-zinc-200/20 dark:border-zinc-800/30 animate-in zoom-in-95 duration-200">
        {/* Header & Body */}
        <div className="p-4 flex flex-col gap-1.5">
          <h3 className="text-[17px] font-bold text-zinc-950 dark:text-white leading-tight">
            {title}
          </h3>
          <div className="text-[13px] text-zinc-600 dark:text-zinc-400 leading-normal font-normal">
            {body}
          </div>
        </div>

        {/* Buttons Divider */}
        <div className="h-[0.5px] bg-zinc-300/40 dark:bg-zinc-700/50 w-full" />

        {/* Horizontal Split Buttons (50-50) */}
        <div className="flex h-11">
          <button
            onClick={onCancel}
            className="flex-1 text-[16px] text-[#0A84FF] active:bg-zinc-200/50 dark:active:bg-zinc-800/50 font-normal transition-colors"
          >
            {cancelLabel}
          </button>
          
          <div className="w-[0.5px] bg-zinc-300/40 dark:bg-zinc-700/50 h-full" />

          <button
            onClick={onConfirm}
            className={`flex-1 text-[16px] font-semibold active:bg-zinc-200/50 dark:active:bg-zinc-800/50 transition-colors ${
              confirmDestructive ? 'text-[#FF453A]' : 'text-[#0A84FF]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
