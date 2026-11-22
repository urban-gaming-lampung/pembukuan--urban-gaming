import React, { lazy, Suspense } from "react";
import { SubTabs, MOTION } from "../ui";
import type { HistoryItem, RowSewa } from "../lib/types";
import type { SegmenMonitoring } from "../lib/navigasi";
import type { BookingSewa } from "../lib/bookingSewa";

const WidgetMonitoringStatus = lazy(() => import("./WidgetMonitoringStatus"));
const WidgetMonitoringDevice = lazy(() => import("./WidgetMonitoringDevice"));
const HalamanBooking = lazy(() => import("./booking/HalamanBooking"));

export type PropsBookingMonitoring = {
  list: BookingSewa[];
  loading: boolean;
  error?: string;
  onMulaiSewa: (b: BookingSewa) => Promise<boolean>;
  onDpHangus: (b: BookingSewa, alasan: string) => Promise<boolean>;
  onUrungkan: (b: BookingSewa) => Promise<boolean>;
};

/**
 * HALAMAN MONITORING — satu UI untuk semua akun (tab bar › Monitoring).
 * Satu baris segmen saja: Status · Booking · Kondisi (+ Stiker khusus owner).
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
  booking: PropsBookingMonitoring;
}> = ({ isOwner, segmen, onSegmen, history, rowsSewa, activeDate, onVerifyActiveRental, onPengingat, hargaItems, isVerifyingPayment, booking }) => {
  const jumlahBooking = booking.list.filter((b) => b.status === "BARU" || b.status === "KONFIRMASI").length;
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
          { key: "status", label: "Status" },
          { key: "booking", label: "Booking", ...(jumlahBooking ? { count: jumlahBooking } : {}) },
          { key: "device", label: "Kondisi" },
          ...(isOwner ? [{ key: "stiker" as const, label: "Stiker" }] : []),
        ]}
      />

      {/* Kondisi ↔ Stiker memakai komponen yang sama → tidak di-mount ulang (state & listener tetap) */}
      <div key={aktif === "status" || aktif === "booking" ? aktif : "alat"} className={MOTION.panel}>
        <Suspense fallback={muat}>
          {aktif === "booking" ? (
            <HalamanBooking
              bolehHapus={isOwner}
              bookings={booking.list}
              loading={booking.loading}
              error={booking.error}
              history={history || []}
              rowsSewa={rowsSewa}
              activeDate={activeDate}
              hargaItems={hargaItems}
              onMulaiSewa={booking.onMulaiSewa}
              onDpHangus={booking.onDpHangus}
              onUrungkan={booking.onUrungkan}
            />
          ) : aktif === "status" ? (
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
