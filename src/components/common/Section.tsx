import React from "react";

type SectionProps = {
  title?: string;
  children: React.ReactNode;
};

/**
 * Kartu bagian halaman (lama) — kini memakai permukaan kartu Design System (src/ui) supaya
 * semua halaman simetris: sudut 22px, latar surface, tepi tipis, padding 16px.
 * Untuk kartu baru pakai `Card` dari "../../ui".
 */
const Section: React.FC<SectionProps> = ({ title, children }) => {
  return (
    <section className="rounded-card bg-surface p-4 shadow-card ring-1 ring-edge md:p-6">
      {title ? <h2 className="mb-3 text-title3 text-label">{title}</h2> : null}
      {children}
    </section>
  );
};

export default Section;
