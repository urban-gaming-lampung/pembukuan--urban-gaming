import React, { useEffect, useMemo, useState } from "react";
import { FolderOpen, GripVertical, MinusCircle, Plus, RotateCcw } from "lucide-react";
import { formatRibuanInput, toInt } from "../lib/format";
import { AlertDialog, Button, Card, EmptyState, Eyebrow, Footnote, Notice, SearchField, Sheet } from "../ui";

interface PriceItem {
  id?: string | number;
  label: string;
  price: number;
}

interface EditRincianProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (items: PriceItem[], baseline: PriceItem[]) => void | Promise<void>;
  /** Keterangan kecil di bawah nama item (mis. cara item dibaca tabel). */
  getItemHint?: (label: string) => string | null;
  title: string;
  initialData: PriceItem[];
  onResetDefault?: () => void;
}

const EditRincian: React.FC<EditRincianProps> = ({
  isOpen,
  onClose,
  onSave,
  getItemHint,
  title,
  initialData,
  onResetDefault,
}) => {
  const [items, setItems] = useState<PriceItem[]>([]);
  const baselineRef = React.useRef<PriceItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Sync data & Reset state
  useEffect(() => {
    if (isOpen) {
      baselineRef.current = JSON.parse(JSON.stringify(initialData));
      setItems(baselineRef.current);
      setSearch("");
      setSaveErr("");
      setConfirmResetOpen(false);
    }
  }, [isOpen, title]);

  const handleClose = () => {
    if (isSaving || confirmResetOpen) return;
    onClose();
  };

  const handleAddItem = () => {
    setItems([...items, { label: "", price: 0 }]);
  };

  const handleChange = (index: number, field: keyof PriceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleDelete = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveErr("");
    try {
      await onSave(items, baselineRef.current);
      onClose();
    } catch (error: any) {
      setSaveErr(error?.message || "Gagal menyimpan rincian. Perubahan Anda masih ada di formulir.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredIndices = useMemo(() => {
    return items
      .map((item, index) => ({ ...item, originalIndex: index }))
      .filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase())
      )
      .map((item) => item.originalIndex);
  }, [items, search]);

  return (
    <>
      <Sheet
        open={isOpen}
        onClose={handleClose}
        title={title}
        size="lg"
        zClassName="z-[300]"
        headerLeft={
          <Button variant="plain" size="sm" onClick={handleClose} disabled={isSaving}>
            Kembali
          </Button>
        }
        headerRight={
          <Button variant="tinted" size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddItem} disabled={isSaving}>
            Tambah
          </Button>
        }
        footer={
          <Button variant="filled" size="lg" block loading={isSaving} disabled={isSaving} onClick={handleSave}>
            Selesai &amp; Simpan
          </Button>
        }
      >
        <fieldset disabled={isSaving} className="space-y-5">
          <SearchField value={search} onChange={setSearch} placeholder="Cari item..." />

          {saveErr && <Notice tone="negative">{saveErr}</Notice>}

          <div className="space-y-2">
            <div className="px-2 flex items-center justify-between">
              <Eyebrow>Rincian Item ({items.length})</Eyebrow>
            </div>

            <Card flush>
              {filteredIndices.length > 0 ? (
                <div className="divide-y divide-sep">
                  {filteredIndices.map((realIndex) => {
                    const item = items[realIndex];
                    return (
                      <div
                        key={realIndex}
                        className="flex items-center px-3.5 py-2.5 gap-2.5 transition-colors focus-within:bg-fill/40"
                      >
                        <div className="text-label-3/60 shrink-0 cursor-grab active:cursor-grabbing" aria-hidden>
                          <GripVertical className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col">
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) => handleChange(realIndex, "label", e.target.value)}
                            placeholder="Nama Item"
                            className="w-full min-h-[36px] bg-transparent text-[16px] sm:text-subhead font-medium text-label placeholder:text-label-3 focus:outline-none"
                          />
                          {getItemHint && item.label.trim() && getItemHint(item.label) && (
                            <span className="text-caption2 text-tint truncate">{getItemHint(item.label)}</span>
                          )}
                        </div>

                        <div className="flex items-center shrink-0">
                          <span className="text-footnote text-label-3 mr-1">Rp</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={formatRibuanInput(item.price, { allowZero: true })}
                            onChange={(e) => handleChange(realIndex, "price", toInt(e.target.value))}
                            placeholder="0"
                            className="w-28 min-h-[36px] bg-transparent text-right text-[16px] sm:text-subhead font-semibold text-label placeholder:text-label-3 focus:outline-none tabular-nums"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(realIndex)}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-negative hover:bg-negative/10 active:scale-90 transition-all shrink-0"
                          title="Hapus"
                          aria-label={`Hapus ${item.label || "item"}`}
                        >
                          <MinusCircle className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState icon={<FolderOpen />} title={search ? "Item tidak ditemukan" : "Daftar kosong"} />
              )}
            </Card>
          </div>

          {onResetDefault && (
            <div className="space-y-2 pt-1">
              <Card flush>
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  className="w-full min-h-[46px] py-3 px-4 flex items-center justify-center gap-2 text-subhead font-semibold text-negative hover:bg-negative/5 active:bg-negative/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset ke Default
                </button>
              </Card>
              <Footnote className="text-center px-4 leading-snug">
                Tindakan ini akan mengembalikan seluruh daftar harga ke kondisi pabrik.
              </Footnote>
            </div>
          )}
        </fieldset>
      </Sheet>

      <AlertDialog
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset ke Default?"
        description="Kembalikan seluruh daftar rincian harga ke pengaturan awal pabrik?"
        icon={<RotateCcw />}
        iconColor="red"
        zClassName="z-[320]"
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setConfirmResetOpen(false) },
          {
            label: "Reset",
            role: "destructive",
            onClick: () => {
              setConfirmResetOpen(false);
              onResetDefault?.();
            },
          },
        ]}
      />
    </>
  );
};

export default EditRincian;
