import downgradePs3Img from "../assets/servis/downgrade-ps3.jpg";
import downgradePs4Img from "../assets/servis/downgrade-ps4.jpg";
import henPs3Img from "../assets/servis/hen-ps3.jpg";
import henPs4Img from "../assets/servis/hen-ps4.png";
import servisUmumImg from "../assets/servis/servis-umum.png";
import stikPs3Img from "../assets/servis/servis-stik-ps3.png";
import stikPs4Img from "../assets/servis/servis-stik-ps4.png";

/**
 * Menentukan URL thumbnail produk kasir (SSOT).
 * Prioritas: foto custom yang diunggah di Firestore, lalu thumbnail bawaan
 * untuk kategori SERVIS / item jasa agar tidak tampil kotak kardus kosong.
 */
export function resolveProductThumb(product: {
  name?: string;
  category?: string;
  imageUrl?: string;
}): string {
  const custom = product.imageUrl?.trim();
  if (custom) return custom;

  const lower = (product.name ?? "").toLowerCase();

  if (
    (lower.includes("stik") ||
      lower.includes("stick") ||
      lower.includes("dualshock") ||
      lower.includes("analog") ||
      lower.includes("drift") ||
      lower.includes("tombol")) &&
    lower.includes("ps4")
  ) {
    return stikPs4Img;
  }

  if (
    (lower.includes("stik") ||
      lower.includes("stick") ||
      lower.includes("dualshock") ||
      lower.includes("analog") ||
      lower.includes("tombol")) &&
    lower.includes("ps3")
  ) {
    return stikPs3Img;
  }

  if (lower.includes("downgrade") && lower.includes("ps4")) {
    return downgradePs4Img;
  }

  if (lower.includes("downgrade") && lower.includes("ps3")) {
    return downgradePs3Img;
  }

  if (
    (lower.includes("hen") ||
      lower.includes("goldhen") ||
      lower.includes("cfw") ||
      lower.includes("reflash")) &&
    lower.includes("ps4")
  ) {
    return henPs4Img;
  }

  if (
    (lower.includes("hen") ||
      lower.includes("hfw") ||
      lower.includes("cfw") ||
      lower.includes("reflash")) &&
    lower.includes("ps3")
  ) {
    return henPs3Img;
  }

  if (product.category === "SERVIS") {
    return servisUmumImg;
  }

  return "";
}
