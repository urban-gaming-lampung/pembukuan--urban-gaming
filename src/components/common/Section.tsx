import React from "react";

type SectionProps = {
  title?: string;
  children: React.ReactNode;
};

const Section: React.FC<SectionProps> = ({ title, children }) => {
  return (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl shadow p-3 sm:p-4 md:p-6 border border-zinc-200 dark:border-zinc-800">
      {title ? (
        <h2 className="text-lg md:text-xl font-semibold mb-3 text-zinc-800 dark:text-zinc-100">
          {title}
        </h2>
      ) : null}

      {children}
    </section>
  );
};

export default Section;
