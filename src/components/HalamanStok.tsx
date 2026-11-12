import React, { useEffect, useState } from "react";
import SubTabs from "./common/SubTabs";
import StokRental from "./StokRental";
import StokJualan from "./StokJualan";
import { ambilPermintaanStok, EVENT_BUKA_STOK, JenisStok } from "../lib/stokRental";

/**
 * HALAMAN STOK — satu UI untuk semua akun:
 * - Super admin / owner: Page Owner › STOK
 * - Admin: tab UPDATE STOK
 * Sub halaman: STOK RENTAL · STOK JUALAN.
 */
const HalamanStok: React.FC<{ isOwner?: boolean; tampilJajanan: boolean }> = ({ isOwner, tampilJajanan }) => {
  const [tab, setTab] = useState<JenisStok>(() => ambilPermintaanStok() || "RENTAL");

  // Dibuka dari tempat lain (mis. cek stok sebelum kirim laporan PDF)
  useEffect(() => {
    const buka = (e: Event) => {
      const t = (e as CustomEvent).detail as JenisStok | undefined;
      ambilPermintaanStok();
      setTab(t === "JUALAN" ? "JUALAN" : "RENTAL");
    };
    window.addEventListener(EVENT_BUKA_STOK, buka);
    return () => window.removeEventListener(EVENT_BUKA_STOK, buka);
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <SubTabs
        ariaLabel="Jenis stok"
        value={tab}
        onChange={setTab}
        options={[{ key: "RENTAL", label: "Stok Rental" }, { key: "JUALAN", label: "Stok Jualan" }]}
      />
      {tab === "RENTAL" ? <StokRental isOwner={isOwner} tampilJajanan={tampilJajanan} /> : <StokJualan isOwner={isOwner} />}
    </div>
  );
};

export default HalamanStok;
