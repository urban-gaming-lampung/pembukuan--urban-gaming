import React from "react";
import { kartu } from "../../ui";

type SectionProps = {
  title?: string;
  children: React.ReactNode;
};

/**
 * Kartu bagian halaman (lama) — memakai `kartu` frosted glass Design System (src/ui) supaya
 * semua halaman simetris: sudut 24px, material kaca, margin `p-4 sm:p-5`.
 * Untuk kartu baru pakai `Card` dari "../../ui".
 */
const Section: React.FC<SectionProps> = ({ title, children }) => {
  return (
    <section className={`${kartu} p-4 sm:p-5`}>
      {title ? <h2 className="mb-3.5 sm:mb-4 text-headline font-semibold tracking-tight text-label">{title}</h2> : null}
      {children}
    </section>
  );
};

export default Section;
