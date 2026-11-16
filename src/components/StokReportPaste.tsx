import React, { useMemo, useState } from "react";
import { ClipboardPaste, ArrowLeft } from "lucide-react";
import type { StokItemValue, StokKategori } from "../hooks/useStokData";
import { MatchedLine, matchReport, normKey, parseStokReport } from "../lib/stokReport";
import { commitStokChanges, StokChange } from "../lib/stokJualan";
import { Button, Card, Eyebrow, Notice, Pill, Sheet } from "../ui";

/**
 * Tempel laporan stok format WhatsApp → pratinjau → simpan.
 * Barang yang cocok diperbarui jumlah & catatannya. Barang yang belum terdaftar bisa disamakan
 * dengan barang lain atau dilewati — barang jualan baru hanya dibuat lewat Owner › Input › Atur Stok.
 */
type Decision = "lewati" | `map:${string}`;
type StaleAction = "biarkan" | "nol";

const CONTOH = `*UNIT KONSOL BARU*\n• PS4 SLIM 1TB - 1 Unit\n\n*STIK PS3*\n• Hitam - 10\n• Putih - 9 (1 baret)`;

const StokReportPaste: React.FC<{
  open: boolean;
  onClose: () => void;
  categories: StokKategori[];
  data: Record<string, Record<string, StokItemValue & { catatan?: string }>>;
  isOwner?: boolean;
}> = ({ open, onClose, categories, data, isOwner }) => {
  const [text, setText] = useState("");
  const [step, setStep] = useState<"input" | "preview">("input");
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [staleAction, setStaleAction] = useState<StaleAction>("biarkan");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => parseStokReport(text), [text]);
  const matched = useMemo<MatchedLine[]>(() => matchReport(parsed.lines, categories), [parsed, categories]);

  const qtyOf = (kat: string, item: string) => Math.max(0, Math.round(Number(data?.[kat]?.[item]?.jumlah) || 0));
  const noteOf = (kat: string, item: string) => String(data?.[kat]?.[item]?.catatan || "");
  const decisionOf = (i: number, m: MatchedLine): Decision => (m.item ? `map:${m.item}` : decisions[i] || "lewati");
  const targetOf = (i: number, m: MatchedLine): string | null => {
    const d = decisionOf(i, m);
    if (d === "lewati") return null;
    return d.slice(4);
  };

  // Barang master (di kategori yang ada di laporan) yang tidak disebut di laporan
  const stale = useMemo(() => {
    const disebut = new Set<string>();
    matched.forEach((m, i) => { const t = targetOf(i, m); if (t) disebut.add(`${m.kategori}||${normKey(t)}`); });
    const katDiLaporan = new Set(matched.map((m) => m.kategori));
    const out: { kategori: string; item: string }[] = [];
    categories.forEach((c) => {
      if (!katDiLaporan.has(c.kategori)) return;
      c.items.forEach((it) => { if (!disebut.has(`${c.kategori}||${normKey(it)}`)) out.push({ kategori: c.kategori, item: it }); });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, decisions, categories]);

  const stats = useMemo(() => {
    let berubah = 0, sama = 0, baru = 0, lewati = 0;
    matched.forEach((m, i) => {
      const d = decisionOf(i, m);
      if (d === "lewati") { lewati++; if (!m.item) baru++; return; }
      const t = d.slice(4);
      const changed = qtyOf(m.kategori, t) !== m.jumlah || (m.catatan || "") !== noteOf(m.kategori, t);
      changed ? berubah++ : sama++;
    });
    return { berubah, sama, baru, lewati };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, decisions, data]);

  const reset = () => { setText(""); setStep("input"); setDecisions({}); setStaleAction("biarkan"); };
  const close = () => { if (saving) return; reset(); onClose(); };

  const save = async () => {
    setSaving(true);
    try {
      const byKey = new Map<string, StokChange>(); // baris terakhir menang bila ada nama kembar
      matched.forEach((m, i) => {
        const target = targetOf(i, m);
        if (!target) return;
        byKey.set(`${m.kategori}||${normKey(target)}`, { kategori: m.kategori, item: target, setTo: m.jumlah, catatan: m.catatan || "", touch: true });
      });
      if (staleAction === "nol") stale.forEach((s) => byKey.set(`${s.kategori}||${normKey(s.item)}`, { kategori: s.kategori, item: s.item, setTo: 0 }));
      const n = await commitStokChanges(Array.from(byKey.values()), "koreksi", "Tempel laporan stok");
      alert(`Laporan stok tersimpan ✅\n${stats.berubah} berubah\n${n} barang tercatat sudah dicek hari ini.${stats.baru ? `\n${stats.baru} barang belum terdaftar dilewati — tambahkan lewat Owner › Input › Atur Stok.` : ""}`);
      reset();
      onClose();
    } catch (e: any) {
      alert("Gagal menyimpan laporan: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const grouped = Array.from(
    matched.reduce((map, m, i) => map.set(m.kategori, [...(map.get(m.kategori) || []), { m, i }]), new Map<string, { m: MatchedLine; i: number }[]>())
  );

  return (
    <Sheet
      open={open}
      onClose={close}
      size="md"
      variant="grouped"
      zClassName="z-[320]"
      title={step === "input" ? "Tempel Laporan Stok" : "Cek Sebelum Simpan"}
      subtitle={
        step === "input"
          ? "Format WhatsApp: *KATEGORI* lalu • Barang - jumlah"
          : `${matched.length} barang terbaca`
      }
      headerLeft={
        step === "preview" ? (
          <button
            type="button"
            onClick={() => setStep("input")}
            aria-label="Kembali"
            className="w-8 h-8 rounded-full bg-fill hover:brightness-95 text-label flex items-center justify-center active:scale-90 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : undefined
      }
      footer={
        step === "input" ? (
          <Button
            variant="filled"
            size="lg"
            block
            disabled={parsed.lines.length === 0}
            onClick={() => setStep("preview")}
          >
            Baca laporan ({parsed.lines.length} barang)
          </Button>
        ) : (
          <Button
            variant="filled"
            size="lg"
            block
            loading={saving}
            disabled={saving || stats.lewati === matched.length}
            onClick={save}
          >
            {saving ? "Menyimpan…" : `Simpan laporan · ${stats.berubah} berubah`}
          </Button>
        )
      }
    >
      {step === "input" ? (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Tempel laporan di sini, contoh:\n\n${CONTOH}`}
            className="w-full h-[44vh] sm:h-72 p-3.5 rounded-tile bg-surface ring-1 ring-edge text-[15px] sm:text-footnote leading-relaxed font-mono focus:outline-none focus:ring-2 focus:ring-tint/35 text-label placeholder:text-label-3 resize-none"
          />
          <Button
            variant="gray"
            size="md"
            block
            icon={<ClipboardPaste />}
            onClick={async () => {
              try {
                setText(await navigator.clipboard.readText());
              } catch {
                alert("Tidak bisa membaca clipboard. Tekan lama kolom di atas lalu pilih Tempel.");
              }
            }}
          >
            Tempel dari clipboard
          </Button>
          {text.trim() && (
            <p className="text-caption text-label-2 px-0.5">
              Terbaca <b className="text-label">{parsed.lines.length}</b> barang
              {parsed.diabaikan.length > 0 && <> · {parsed.diabaikan.length} baris tidak dikenali</>}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="grid grid-cols-4 gap-2">
            {[
              { t: "Berubah", v: stats.berubah, c: "text-tint" },
              { t: "Sama", v: stats.sama, c: "text-label-2" },
              { t: "Blm ada", v: stats.baru, c: "text-warning" },
              { t: "Lewati", v: stats.lewati, c: "text-label-3" },
            ].map((x) => (
              <div key={x.t} className="rounded-tile bg-surface ring-1 ring-edge py-2.5 px-1 text-center">
                <div className={`text-title3 font-bold tabular-nums ${x.c}`}>{x.v}</div>
                <div className="text-caption2 font-semibold uppercase text-label-2 truncate">{x.t}</div>
              </div>
            ))}
          </div>

          {parsed.diabaikan.length > 0 && (
            <Notice tone="warning">
              <div className="font-semibold mb-1">Baris tidak dikenali (dilewati)</div>
              {parsed.diabaikan.slice(0, 5).map((d) => (
                <div key={d.baris} className="truncate text-caption">
                  Baris {d.baris}: {d.teks}
                </div>
              ))}
            </Notice>
          )}

          {grouped.map(([kat, list]) => {
            const cat = categories.find((c) => c.kategori === kat);
            return (
              <Card key={kat} flush>
                <div className="px-3.5 py-2.5 bg-fill/45 border-b border-sep flex items-center justify-between gap-2">
                  <Eyebrow>{kat}</Eyebrow>
                  {!cat && <Pill tone="warning">Kategori belum ada</Pill>}
                </div>
                <div className="divide-y divide-sep">
                  {list.map(({ m, i }) => {
                    const d = decisionOf(i, m);
                    const target = targetOf(i, m);
                    const isNew = false;
                    const before = target && !isNew ? qtyOf(kat, target) : null;
                    const changed = before !== null && (before !== m.jumlah || (m.catatan || "") !== noteOf(kat, target!));
                    return (
                      <div key={i} className={`px-3.5 py-2.5 ${d === "lewati" ? "opacity-55" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-footnote font-semibold text-label truncate">{m.nama}</div>
                            {m.item && normKey(m.item) === normKey(m.nama) && m.item !== m.nama && (
                              <div className="text-caption2 text-label-3 truncate">= {m.item}</div>
                            )}
                            {m.catatan && (
                              <div className="text-caption2 italic text-warning truncate">“{m.catatan}”</div>
                            )}
                          </div>
                          <div className="text-footnote font-semibold tabular-nums shrink-0 text-right">
                            {d === "lewati" ? (
                              <span className={m.item ? "text-label-3" : "text-warning"}>
                                {m.item ? "dilewati" : "belum terdaftar"}
                              </span>
                            ) : isNew ? (
                              <span className="text-positive">BARU · {m.jumlah}</span>
                            ) : changed ? (
                              <span className="text-tint">
                                {before} → {m.jumlah}
                              </span>
                            ) : (
                              <span className="text-label-3">tetap {m.jumlah}</span>
                            )}
                          </div>
                        </div>
                        {!m.item && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {d === "lewati" && (
                              <span className="basis-full text-caption2 text-label-2">
                                Barang baru ditambahkan lewat Owner › Input › Atur Stok, lalu tempel ulang.
                              </span>
                            )}
                            {m.saran && d !== `map:${m.saran}` && (
                              <Button
                                size="sm"
                                variant="tinted"
                                onClick={() => setDecisions((p) => ({ ...p, [i]: `map:${m.saran}` }))}
                              >
                                Samakan dgn “{m.saran}”?
                              </Button>
                            )}
                            <select
                              value={d}
                              onChange={(e) => setDecisions((p) => ({ ...p, [i]: e.target.value as Decision }))}
                              className="h-9 px-2.5 rounded-field text-caption font-semibold bg-fill text-label max-w-full focus:outline-none focus:ring-2 focus:ring-tint/35"
                            >
                              <option value="lewati">Lewati (belum terdaftar)</option>
                              {(cat?.items || []).map((it) => (
                                <option key={it} value={`map:${it}`}>
                                  Samakan dgn: {it}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {stale.length > 0 && (
            <Card bodyClassName="space-y-2.5">
              <div className="text-footnote font-semibold text-label">
                Ada di daftar, tidak ada di laporan ({stale.length})
              </div>
              <div className="text-caption text-label-2 line-clamp-3">{stale.map((s) => s.item).join(", ")}</div>
              <div className={`grid gap-1 p-1 rounded-full apple-segmented ${isOwner ? "grid-cols-2" : "grid-cols-2"}`}>
                {(
                  [
                    ["biarkan", "Biarkan"],
                    ["nol", "Jadikan 0"],
                  ] as [StaleAction, string][]
                ).map(([k, t]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setStaleAction(k)}
                    className={`min-h-[38px] px-3 rounded-full text-caption font-semibold transition-all ${
                      staleAction === k
                        ? "apple-segmented-thumb text-label"
                        : "text-label-2 hover:text-label hover:bg-white/30 dark:hover:bg-white/[0.05]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </Sheet>
  );
};

export default StokReportPaste;
