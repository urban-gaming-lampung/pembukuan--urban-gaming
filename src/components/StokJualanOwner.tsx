import React, { useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Copy, Search } from "lucide-react";
import useStokData from "../hooks/useStokData";
import Section from "./common/Section";

/**
 * Page Owner > STOK — khusus STOK JUALAN (stok rental = kondisi perangkat, ada di Monitoring).
 * Semua item dari Master Inventaris ikut tampil; item yang belum pernah diisi = 0 (HABIS),
 * supaya barang yang paling perlu di-restock tidak tersembunyi.
 */
type Status = "habis" | "menipis" | "aman";

// Batas "menipis": unit konsol cukup 1, barang lain 3
const batasMenipis = (kategori: string) => (/unit|konsol/i.test(kategori) ? 1 : 3);

const fmtTanggal = (s?: string) => {
  if (!s) return "Belum pernah diisi";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

const StokJualanOwner: React.FC = () => {
  const { stokState, masterCategories } = useStokData();
  const [filter, setFilter] = useState<"semua" | Status>("semua");
  const [cari, setCari] = useState("");
  const [copied, setCopied] = useState(false);

  const groups = useMemo(() => {
    const jualan = stokState?.jualan || {};
    return (masterCategories?.jualan || []).map((cat) => {
      const batas = batasMenipis(cat.kategori);
      const items = cat.items.map((nama) => {
        const v = jualan[cat.kategori]?.[nama];
        const jumlah = Math.max(0, Number(v?.jumlah) || 0);
        const status: Status = jumlah <= 0 ? "habis" : jumlah <= batas ? "menipis" : "aman";
        return { nama, jumlah, status, batas, lastEditDate: v?.lastEditDate, lastEditBy: v?.lastEditBy };
      });
      return { kategori: cat.kategori, batas, items };
    });
  }, [stokState, masterCategories]);

  const all = groups.flatMap((g) => g.items.map((i) => ({ ...i, kategori: g.kategori })));
  const count = {
    habis: all.filter((i) => i.status === "habis").length,
    menipis: all.filter((i) => i.status === "menipis").length,
    aman: all.filter((i) => i.status === "aman").length,
    unit: all.reduce((s, i) => s + i.jumlah, 0),
  };

  const q = cari.trim().toLowerCase();
  const shown = groups
    .map((g) => ({
      ...g,
      items: g.items
        .filter((i) => (filter === "semua" || i.status === filter) && (!q || i.nama.toLowerCase().includes(q)))
        .sort((a, b) => a.jumlah - b.jumlah),
    }))
    .filter((g) => g.items.length > 0);

  const restockText = () => {
    const lines = ["*DAFTAR RESTOCK URBAN*", new Date().toLocaleDateString("id-ID", { dateStyle: "full" }), ""];
    groups.forEach((g) => {
      const need = g.items.filter((i) => i.status !== "aman");
      if (!need.length) return;
      lines.push(`*${g.kategori}*`);
      need.forEach((i) => lines.push(`- ${i.nama}: sisa ${i.jumlah}${i.status === "habis" ? " (HABIS)" : ""}`));
      lines.push("");
    });
    return lines.join("\n").trim();
  };

  const copyRestock = async () => {
    try {
      await navigator.clipboard.writeText(restockText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(restockText());
    }
  };

  const badge: Record<Status, string> = {
    habis: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    menipis: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    aman: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  };
  const label: Record<Status, string> = { habis: "Habis", menipis: "Menipis", aman: "Aman" };

  const tiles: { key: "semua" | Status; title: string; value: number; cls: string }[] = [
    { key: "habis", title: "Habis", value: count.habis, cls: "text-red-600 dark:text-red-400" },
    { key: "menipis", title: "Menipis", value: count.menipis, cls: "text-amber-600 dark:text-amber-400" },
    { key: "aman", title: "Aman", value: count.aman, cls: "text-emerald-600 dark:text-emerald-400" },
    { key: "semua", title: "Total Unit", value: count.unit, cls: "text-zinc-900 dark:text-white" },
  ];

  return (
    <Section title="Stok Jualan">
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {tiles.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={`text-left rounded-2xl p-4 border transition-all active:scale-[0.98] bg-white dark:bg-[#1c1c1e] ${
                filter === t.key ? "border-blue-500 ring-2 ring-blue-500/20" : "border-zinc-200 dark:border-white/10"
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{t.title}</div>
              <div className={`text-2xl font-black mt-1 ${t.cls}`}>{t.value}</div>
              <div className="text-[10px] text-zinc-400 mt-0.5">{t.key === "semua" ? `${all.length} jenis barang` : "jenis barang"}</div>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari barang..."
              className="flex-1 py-2.5 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={count.habis + count.menipis === 0}
            onClick={copyRestock}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-bold disabled:opacity-40 active:scale-95"
          >
            {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Tersalin" : `Salin Daftar Restock (${count.habis + count.menipis})`}
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="text-center text-sm text-zinc-500 py-10 rounded-2xl border border-dashed border-zinc-300 dark:border-white/10">
            {filter === "habis" || filter === "menipis" ? "Tidak ada barang dengan status ini. Stok aman 👍" : "Tidak ada barang yang cocok."}
          </div>
        ) : (
          shown.map((g) => (
            <div key={g.kategori} className="rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between bg-zinc-50 dark:bg-white/5 border-b border-zinc-100 dark:border-white/5">
                <span className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300">{g.kategori}</span>
                <span className="text-[10px] text-zinc-400">menipis jika ≤ {g.batas}</span>
              </div>
              {g.items.map((i) => (
                <div key={i.nama} className="px-4 py-3 flex items-center justify-between gap-3 border-b last:border-b-0 border-zinc-100 dark:border-white/5">
                  <div className="flex items-center gap-3 min-w-0">
                    {i.status !== "aman" ? (
                      <AlertCircle className={`w-4 h-4 shrink-0 ${i.status === "habis" ? "text-red-500" : "text-amber-500"}`} />
                    ) : (
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{i.nama}</div>
                      <div className="text-[11px] text-zinc-400 truncate">
                        Update: {fmtTanggal(i.lastEditDate)}{i.lastEditBy ? ` · ${String(i.lastEditBy).split("@")[0]}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-lg font-black text-zinc-900 dark:text-white tabular-nums">{i.jumlah}</span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${badge[i.status]}`}>{label[i.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </Section>
  );
};

export default StokJualanOwner;
