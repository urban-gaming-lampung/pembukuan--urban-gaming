import React from "react";
/** Tahun hak cipta mengikuti tahun berjalan. */
const Footer: React.FC = () => (
  <footer className="text-center text-caption text-label-3 pt-4 pb-3">
    © {new Date().getFullYear()} URBAN GAMING LAMPUNG
  </footer>
);
export default Footer;
