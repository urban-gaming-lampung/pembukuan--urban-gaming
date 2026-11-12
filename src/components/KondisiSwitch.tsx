import React from "react";
import type { Kondisi } from "../lib/posSales";
import SubTabs from "./common/SubTabs";

/** Saklar BARU / SEKEN — memakai gaya tab sub-halaman yang sama (SubTabs). */
const KondisiSwitch: React.FC<{
  value: Kondisi;
  onChange: (k: Kondisi) => void;
  counts?: Partial<Record<Kondisi, number>>;
  size?: "md" | "sm";
  className?: string;
}> = ({ value, onChange, counts, className = "" }) => (
  <SubTabs<Kondisi>
    ariaLabel="Kondisi barang"
    value={value}
    onChange={onChange}
    className={className}
    options={[
      { key: "BARU", label: "Baru", count: counts?.BARU },
      { key: "SEKEN", label: "Seken", count: counts?.SEKEN },
    ]}
  />
);

export default KondisiSwitch;
