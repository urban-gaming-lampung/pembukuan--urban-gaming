import React, { lazy, Suspense, useEffect, useState } from "react";
import { SubTabs } from "../ui";
import StokRental from "./StokRental";
import StokJualan from "./StokJualan";
import { ambilPermintaanStok, EVENT_BUKA_STOK, JenisStok } from "../lib/stokRental";

// Atur stok (stok masuk, koreksi, produk kasir) khusus owner — dimuat hanya saat dibuka
const InputStokJualan = lazy(() => import("./InputStokJualan"));

type SegmenStok = JenisStok | "ATUR";

/**
 * HALAMAN STOK — satu UI untuk semua akun (tab bar › Stok).
 * Segmen: Jualan · Rental (+ Atur stok khusus owner / super admin).
 */
const HalamanStok: React.FC<{ isOwner?: boolean; tampilJajanan: boolean }> = ({ isOwner, tampilJajanan }) => {
  const [tab, setTab] = useState<SegmenStok>(() => ambilPermintaanStok() || "JUALAN");

  // Dibuka dari tempat lain (mis. cek stok sebelum kirim laporan PDF)
  useEffect(() => {
    const buka = (e: Event) => {
      const t = (e as CustomEvent).detail as JenisStok | undefined;
      ambilPermintaanStok();
      setTab(t === "RENTAL" ? "RENTAL" : "JUALAN");
    };
    window.addEventListener(EVENT_BUKA_STOK, buka);
    return () => window.removeEventListener(EVENT_BUKA_STOK, buka);
  }, []);

  const aktif: SegmenStok = !isOwner && tab === "ATUR" ? "JUALAN" : tab;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <SubTabs<SegmenStok>
        ariaLabel="Halaman stok"
        value={aktif}
        onChange={setTab}
        options={[
          { key: "JUALAN", label: "Jualan" },
          { key: "RENTAL", label: "Rental" },
          ...(isOwner ? [{ key: "ATUR" as const, label: "Atur stok" }] : []),
        ]}
      />
      {aktif === "JUALAN" ? (
        <StokJualan isOwner={isOwner} onAturStok={isOwner ? () => setTab("ATUR") : undefined} />
      ) : aktif === "RENTAL" ? (
        <StokRental isOwner={isOwner} tampilJajanan={tampilJajanan} />
      ) : (
        <Suspense
          fallback={
            <div className="py-16 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-tint border-t-transparent" />
            </div>
          }
        >
          <InputStokJualan />
        </Suspense>
      )}
    </div>
  );
};

export default HalamanStok;
