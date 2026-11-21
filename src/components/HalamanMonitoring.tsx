import React, { lazy, Suspense } from "react";
import { SubTabs, MOTION } from "../ui";
import type { HistoryItem, RowSewa } from "../lib/types";
import type { SegmenMonitoring } from "../lib/navigasi";

const WidgetMonitoringStatus = lazy(() => import("./WidgetMonitoringStatus"));
const WidgetMonitoringDevice = lazy(() => import("./WidgetMonitoringDevice"));

/**
 * HALAMAN MONITORING — satu UI untuk semua akun (tab bar › Monitoring).
 * Satu baris segmen saja: Status · Kondisi (+ Stiker khusus owner).
 */
const HalamanMonitoring: React.FC<{
  isOwner: boolean;
  segmen: SegmenMonitoring;
  onSegmen: (s: SegmenMonitoring) => void;
  history: HistoryItem[];
  rowsSewa: RowSewa[];
  activeDate?: string;
  onVerifyActiveRental?: (idx: number) => void;
  onPengingat?: (item: any) => void;
  hargaItems?: any[];
  isVerifyingPayment?: boolean;
}> = ({ isOwner, segmen, onSegmen, history, rowsSewa, activeDate, onVerifyActiveRental, onPengingat, hargaItems, isVerifyingPayment }) => {
  const aktif: SegmenMonitoring = !isOwner && segmen === "stiker" ? "device" : segmen;
  const muat = (
    <div className="py-16 flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-transparent" />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <SubTabs<SegmenMonitoring>
        ariaLabel="Halaman monitoring"
        value={aktif}
        onChange={onSegmen}
        options={[
          { key: "status", label: "Status unit" },
          { key: "device", label: "Kondisi alat" },
          ...(isOwner ? [{ key: "stiker" as const, label: "Stiker" }] : []),
        ]}
      />

      {/* Kondisi ↔ Stiker memakai komponen yang sama → tidak di-mount ulang (state & listener tetap) */}
      <div key={aktif === "status" ? "status" : "alat"} className={MOTION.panel}>
        <Suspense fallback={muat}>
          {aktif === "status" ? (
            <WidgetMonitoringStatus
              history={history || []}
              rowsSewa={rowsSewa}
              activeDate={activeDate}
              onVerifyActiveRental={onVerifyActiveRental}
              onPengingat={onPengingat}
              isOwner={isOwner}
              hargaItems={hargaItems}
              isVerifyingPayment={isVerifyingPayment}
            />
          ) : (
            <WidgetMonitoringDevice isOwner={isOwner} halaman={aktif === "stiker" ? "stiker" : "kondisi"} />
          )}
        </Suspense>
      </div>
    </div>
  );
};

export default HalamanMonitoring;
