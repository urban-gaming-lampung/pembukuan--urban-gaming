import React, { useState, useEffect } from "react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Package } from "lucide-react";

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
    <div className="fixed inset-0 bg-zinc-100 flex items-center justify-center p-4 dark:bg-[url('/images/bg_dark.jpg')] bg-cover bg-center" style={{ minHeight: '100dvh' }}>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/70 pointer-events-none z-0"></div>
      
      <div className="relative z-10 w-full max-w-md bg-white/90 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10 animate-in zoom-in-95 duration-500 fade-in">
        <div className="p-8 pb-10">
          <div className="mx-auto w-16 h-16 bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-500 rounded-2xl flex items-center justify-center mb-6">
            <Package strokeWidth={2.5} size={32} />
          </div>
          
          <h2 className="text-2xl font-bold text-center text-zinc-900 dark:text-white mb-2 tracking-tight">Login Admin</h2>
          <p className="text-center text-zinc-500 dark:text-zinc-400 text-sm mb-8">Masuk untuk mengakses sistem pembukuan URBAN PS.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 ml-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@urbanps.com"
                className="w-full bg-zinc-100 dark:bg-black/50 border border-transparent dark:border-white/10 text-zinc-900 dark:text-white rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-[#2C2C2E] transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5 ml-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-zinc-100 dark:bg-black/50 border border-transparent dark:border-white/10 text-zinc-900 dark:text-white rounded-xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white dark:focus:bg-[#2C2C2E] transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
                <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <p className="leading-tight">{error}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading...</span>
                </>
              ) : (
                "Masuk Sekarang"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
