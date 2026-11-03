import React from "react";

/**
 * Ikon "Rp" bergaya lucide (stroke 2, viewBox 24) — pengganti DollarSign
 * untuk konteks uang Rupiah. Props sama seperti ikon lucide (size, className, strokeWidth).
 */
type RupiahIconProps = React.SVGProps<SVGSVGElement> & { size?: number | string };

const RupiahIcon: React.FC<RupiahIconProps> = ({ size = 24, strokeWidth = 2, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M3 18V6h4.5a3.25 3.25 0 0 1 0 6.5H3" />
    <path d="M7 12.5 10 18" />
    <path d="M13.5 21V10" />
    <circle cx="17.25" cy="13.75" r="3.75" />
  </svg>
);

export default RupiahIcon;
