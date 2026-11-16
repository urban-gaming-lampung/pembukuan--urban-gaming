import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Package } from "lucide-react";
import { Button, IconBadge, Notice } from "../ui";

export default function Login({ deactivatedError }: { deactivatedError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(deactivatedError || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (deactivatedError) {
      setError(deactivatedError);
    }
  }, [deactivatedError]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = userCred.user?.email;
      if (userEmail && userEmail.toLowerCase().trim() !== "owner@gmail.com") {
        const userDoc = await getDoc(doc(db, "users", userEmail.toLowerCase().trim()));
        if (!userDoc.exists() || userDoc.data()?.status === "nonaktif") {
          await signOut(auth);
          setError("Email atau Password salah.");
          setLoading(false);
          return;
        }
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Email atau Password salah.");
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 apple-canvas text-label flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{ minHeight: "100dvh" }}
    >
      <div className="relative z-10 w-full max-w-sm rounded-card apple-card ring-1 ring-edge shadow-float overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        <div className="p-6 sm:p-8">
          <div className="flex justify-center mb-5">
            <IconBadge
              color="blue"
              variant="tinted"
              className="h-14 w-14 rounded-card [&>svg]:h-7 [&>svg]:w-7"
            >
              <Package strokeWidth={2} />
            </IconBadge>
          </div>

          <h2 className="text-title2 font-bold text-center text-label tracking-tight">
            Login Admin
          </h2>
          <p className="mt-1.5 text-center text-footnote text-label-2 mb-7">
            Masuk untuk mengakses sistem pembukuan URBAN PS.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-caption font-semibold text-label-2 mb-1.5 ml-1"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                placeholder="admin@urbanps.com"
                className="w-full h-11 bg-fill border border-sep text-label text-[16px] rounded-field px-3.5 placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-tint/30 focus:border-tint/40 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-caption font-semibold text-label-2 mb-1.5 ml-1"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full h-11 bg-fill border border-sep text-label text-[16px] rounded-field px-3.5 placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-tint/30 focus:border-tint/40 transition-colors"
              />
            </div>

            {error && <Notice tone="negative">{error}</Notice>}

            <div className="pt-2">
              <Button
                type="submit"
                variant="filled"
                size="lg"
                block
                loading={loading}
              >
                {loading ? "Memproses..." : "Masuk Sekarang"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
