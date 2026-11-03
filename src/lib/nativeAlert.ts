/**
 * Ganti window.alert bawaan browser (kasar & memblok layar di HP) dengan toast
 * non-blocking. Berlaku global tanpa mengubah ratusan pemanggil alert().
 * confirm() sengaja TIDAK diganti karena butuh jawaban sinkron (ya/tidak).
 */
const HOST_ID = "urban-toast-host";

function getHost(): HTMLElement {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    Object.assign(host.style, {
      position: "fixed", top: "max(16px, env(safe-area-inset-top))", left: "50%",
      transform: "translateX(-50%)", zIndex: "2147483000", display: "flex",
      flexDirection: "column", gap: "8px", width: "min(92vw, 420px)", pointerEvents: "none",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(host);
  }
  return host;
}

export function showToast(message: unknown): void {
  if (typeof document === "undefined" || !document.body) return;
  const text = String(message ?? "");
  const el = document.createElement("div");
  el.textContent = text;
  Object.assign(el.style, {
    pointerEvents: "auto", cursor: "pointer", whiteSpace: "pre-line", wordBreak: "break-word",
    background: "rgba(24,24,27,0.95)", color: "#fff", font: "600 13px/1.45 Inter, system-ui, sans-serif",
    padding: "12px 16px", borderRadius: "14px", boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.08)", opacity: "0", transform: "translateY(-6px)",
    transition: "opacity .2s ease, transform .2s ease",
  } as Partial<CSSStyleDeclaration>);
  const host = getHost();
  host.appendChild(el);
  while (host.children.length > 3) host.removeChild(host.firstChild as Node);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; });
  const close = () => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  };
  el.addEventListener("click", close);
  setTimeout(close, Math.min(9000, Math.max(3500, text.length * 45)));
}

if (typeof window !== "undefined") {
  window.alert = (message?: unknown) => showToast(message);
}
