import React, { useState } from "react";
import {
  Pencil,
  Trash2,
  Pin,
  ExternalLink,
  Copy,
  Check,
  Link2,
  Calendar,
  User,
  ShieldCheck,
  Eye,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { useAdminNotes, AdminNote } from "../hooks/useAdminNotes";
import { AKSEN_TILE, AlertDialog, Button, Card, EmptyState, Notice, Pill, Sheet } from "../ui";

interface AdminNotesProps {
  isOwner: boolean; // true untuk Super Admin & Owner
  currentUserEmail?: string | null;
  adminName?: string;
}

export default function AdminNotes({
  isOwner,
  currentUserEmail,
  adminName,
}: AdminNotesProps) {
  const { notes, loading, addNote, updateNote, deleteNote, togglePin } =
    useAdminNotes();

  // State Modal Pop-up Keseluruhan
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  // State Form Edit / Tambah Catatan
  const [isEditing, setIsEditing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Konfirmasi Hapus
  const [deletingNote, setDeletingNote] = useState<AdminNote | null>(null);

  // State Copied Feedback (note id -> boolean)
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  // Buka Form Tambah Baru
  const handleOpenAdd = () => {
    setFormError("");
    setTitle("");
    setContent("");
    setLinkUrl("");
    setLinkLabel("");
    setIsPinned(false);
    setEditingNoteId(null);
    setIsEditing(true);
    setIsOpenModal(true);
  };

  // Buka Form Edit Catatan yang sudah ada
  const handleOpenEdit = (note: AdminNote) => {
    setFormError("");
    setTitle(note.title || "");
    setContent(note.content || "");
    setLinkUrl(note.linkUrl || "");
    setLinkLabel(note.linkLabel || "");
    setIsPinned(Boolean(note.isPinned));
    setEditingNoteId(note.id);
    setIsEditing(true);
    setIsOpenModal(true);
  };

  // Simpan Catatan (Tambah / Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setFormError("");
    setIsSubmitting(true);
    try {
      const authorLabel = isOwner
        ? currentUserEmail?.toLowerCase().includes("owner")
          ? "Owner"
          : "Super Admin"
        : adminName || "Admin";

      if (editingNoteId) {
        await updateNote(editingNoteId, {
          title,
          content,
          linkUrl,
          linkLabel,
          isPinned,
        });
      } else {
        await addNote({
          title,
          content,
          linkUrl,
          linkLabel,
          isPinned,
          authorEmail: currentUserEmail || "",
          authorName: authorLabel,
        });
      }
      setIsEditing(false);
      setEditingNoteId(null);
    } catch (err) {
      console.error("Gagal menyimpan catatan:", err);
      setFormError("Terjadi kesalahan saat menyimpan catatan. Coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hapus Catatan
  const handleConfirmDelete = async () => {
    if (!deletingNote) return;
    setFormError("");
    try {
      await deleteNote(deletingNote.id);
      setDeletingNote(null);
    } catch (err) {
      console.error("Gagal menghapus catatan:", err);
      setFormError("Gagal menghapus catatan. Coba lagi.");
    }
  };

  // Salin isi catatan
  const handleCopyText = (note: AdminNote) => {
    let fullText = "";
    if (note.title) fullText += `${note.title}\n`;
    fullText += note.content;
    if (note.linkUrl) {
      fullText += `\nLink: ${note.linkUrl}`;
    }

    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedId(note.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Render teks dengan auto-detect URL link
  const renderFormattedContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

      return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-tint hover:opacity-80 underline font-medium break-all inline-flex items-center gap-0.5 mx-0.5"
          >
            {part}
            <ExternalLink className="w-3 h-3 inline-block shrink-0" />
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Format tanggal & waktu
  const formatDateTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  // Maksimal 5 catatan untuk preview
  const displayNotes = notes.slice(0, 5);

  // Hitung layout grid kolom responsif
  const totalCards = displayNotes.length + (isOwner && displayNotes.length < 5 ? 1 : 0);

  const getGridColsClass = () => {
    if (totalCards <= 1) return "grid-cols-1 sm:grid-cols-2";
    if (totalCards === 2) return "grid-cols-2 sm:grid-cols-2";
    if (totalCards === 3) return "grid-cols-2 sm:grid-cols-3";
    if (totalCards === 4) return "grid-cols-2 sm:grid-cols-2 md:grid-cols-4";
    return "grid-cols-2 sm:grid-cols-3 md:grid-cols-5";
  };

  if (!loading && notes.length === 0 && !isOwner) {
    return null;
  }

  return (
    <div className="w-full">
      <Card
        variant="hero"
        accent="yellow"
        icon={<Pin />}
        iconColor="yellow"
        title="Catatan Admin"
        subtitle="Permanen · tidak tereset saat tutup buku"
        accessory={
          notes.length > 0 ? (
            <Button
              variant="gray"
              size="sm"
              onClick={() => {
                setFormError("");
                setSelectedNoteId(null);
                setIsEditing(false);
                setIsOpenModal(true);
              }}
            >
              {notes.length > 5 ? `Semua (${notes.length})` : `${notes.length} Catatan`}
            </Button>
          ) : undefined
        }
      >
        <div className={`grid gap-2.5 sm:gap-3 w-full ${getGridColsClass()}`}>
          {displayNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => {
                setFormError("");
                setSelectedNoteId(note.id);
                setIsEditing(false);
                setIsOpenModal(true);
              }}
              className={`group relative rounded-tile p-3 sm:p-3.5 transition-transform duration-150 cursor-pointer text-left flex flex-col justify-between overflow-hidden active:scale-[0.99] min-h-[86px] sm:min-h-[92px] max-h-[144px] ${
                note.isPinned
                  ? AKSEN_TILE.yellow.bg
                  : "apple-tile apple-tile-interactive ring-1 ring-edge"
              }`}
              title="Klik untuk membuka catatan lengkap"
            >
              <div className="overflow-hidden w-full">
                {note.title && (
                  <div className="text-caption sm:text-subhead font-semibold text-label line-clamp-1 mb-0.5 leading-snug">
                    {note.title}
                  </div>
                )}
                <p className="text-caption2 sm:text-caption text-label-2 line-clamp-2 sm:line-clamp-3 leading-relaxed whitespace-pre-line break-words">
                  {note.content}
                </p>
                {note.linkUrl && (
                  <div className="text-caption2 text-tint font-medium truncate mt-1 flex items-center gap-1">
                    <Link2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{note.linkLabel || note.linkUrl}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between w-full mt-2 pt-1.5 border-t border-sep text-caption2 text-label-3 shrink-0">
                <span className="truncate">{formatDateTime(note.createdAt)}</span>
                {note.isPinned && (
                  <span className={`inline-flex items-center gap-0.5 text-caption2 font-semibold shrink-0 ml-1 ${AKSEN_TILE.yellow.iconText}`}>
                    <Pin className="w-2.5 h-2.5" />
                    Pin
                  </span>
                )}
              </div>
            </button>
          ))}

          {isOwner && displayNotes.length < 5 && (
            <button
              type="button"
              onClick={handleOpenAdd}
              className="rounded-tile p-3 sm:p-3.5 transition-colors duration-200 cursor-pointer text-center flex flex-col items-center justify-center border border-dashed border-sep hover:border-label-3 apple-tile apple-tile-interactive min-h-[86px] sm:min-h-[92px] max-h-[144px] text-label-2 hover:text-label group"
              title="Tambah catatan baru"
            >
              <Plus className="w-5 h-5 mb-1 opacity-75 group-hover:scale-110 transition-transform" />
              <span className="text-caption2 sm:text-caption font-semibold">Tambah Catatan</span>
            </button>
          )}
        </div>
      </Card>

      <Sheet
        open={isOpenModal}
        onClose={() => {
          if (!isEditing && !deletingNote) setIsOpenModal(false);
        }}
        size="lg"
        zClassName="z-[600]"
        title={
          <span className="flex items-center gap-2 flex-wrap">
            <span>Catatan Admin</span>
            {isOwner ? (
              <Pill color="yellow" icon={<ShieldCheck className="w-3 h-3" />}>
                Super Admin
              </Pill>
            ) : (
              <Pill color="gray" icon={<Eye className="w-3 h-3" />}>
                Hanya Baca
              </Pill>
            )}
          </span>
        }
        subtitle="Permanen • Tidak tereset saat tutup buku"
        headerRight={
          isOwner && !isEditing ? (
            <Button
              variant="filled"
              size="sm"
              onClick={handleOpenAdd}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              <span className="hidden sm:inline">Tambah Catatan</span>
              <span className="sm:hidden">Tambah</span>
            </Button>
          ) : undefined
        }
        footer={
          <div className="flex items-center justify-between text-caption text-label-2">
            <span>
              Total: <strong className="font-semibold text-label">{notes.length}</strong> Catatan
            </span>
            <Button variant="gray" size="sm" onClick={() => setIsOpenModal(false)}>
              Tutup
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && <Notice tone="negative">{formError}</Notice>}

          {isEditing && (
            <div className="p-4 sm:p-5 rounded-tile apple-tile ring-1 ring-edge">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-subhead font-semibold text-label flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5 text-label-3" />
                  {editingNoteId ? "Edit Catatan" : "Tambah Catatan Baru"}
                </h4>
                <Button
                  variant="plain"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingNoteId(null);
                  }}
                >
                  Batal
                </Button>
              </div>

              <form onSubmit={handleSave} className="space-y-3">
                <input
                  type="text"
                  placeholder="Judul Catatan (Opsional, misal: SOP Shift Pagi, Link Drive)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-field bg-fill border border-sep text-[16px] sm:text-subhead font-semibold text-label placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-tint/30"
                />

                <textarea
                  required
                  rows={4}
                  placeholder="Tulis catatan, instruksi, nomor penting, atau paste URL link di sini..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-field bg-fill border border-sep text-[16px] sm:text-subhead text-label placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-tint/30 resize-y min-h-[96px]"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-label-3" />
                    <input
                      type="url"
                      placeholder="https://... (Opsional)"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      className="w-full min-h-[42px] pl-9 pr-3 py-2 rounded-field bg-fill border border-sep text-[16px] sm:text-footnote text-label placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-tint/30"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Label Tautan (misal: Buka Google Drive)"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-field bg-fill border border-sep text-[16px] sm:text-footnote text-label placeholder:text-label-3 focus:outline-none focus:ring-2 focus:ring-tint/30"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none min-h-[36px]">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                      className="w-4 h-4 rounded accent-tint cursor-pointer"
                    />
                    <span className="text-caption font-semibold text-label-2 flex items-center gap-1">
                      <Pin className="w-3.5 h-3.5 text-warning" /> Sematkan di paling atas
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="gray"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setEditingNoteId(null);
                      }}
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      variant="filled"
                      size="sm"
                      disabled={isSubmitting || !content.trim()}
                      loading={isSubmitting}
                    >
                      {isSubmitting
                        ? "Menyimpan..."
                        : editingNoteId
                        ? "Perbarui Catatan"
                        : "Simpan Catatan"}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {notes.length === 0 ? (
            <EmptyState title="Belum Ada Catatan">
              <p>
                {isOwner
                  ? "Tekan tombol 'Tambah Catatan' di atas untuk menulis catatan baru."
                  : "Saat ini belum ada catatan dari Super Admin."}
              </p>
              {isOwner && !isEditing && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="filled"
                    size="sm"
                    onClick={handleOpenAdd}
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Buat Catatan Pertama
                  </Button>
                </div>
              )}
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const isSelected = selectedNoteId === note.id;

                return (
                  <div
                    key={note.id}
                    className={`relative rounded-tile p-4 transition-colors ${
                      note.isPinned
                        ? AKSEN_TILE.yellow.bg
                        : "apple-tile ring-1 ring-edge"
                    } ${isSelected ? "ring-2 ring-tint/40" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="space-y-1 min-w-0">
                        {note.title && (
                          <h4 className="text-headline text-label leading-tight">{note.title}</h4>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-caption2 text-label-2">
                          {note.isPinned && (
                            <Pill color="yellow" icon={<Pin className="w-2.5 h-2.5" />}>
                              Disematkan
                            </Pill>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-label-3" />
                            {formatDateTime(note.createdAt)}
                          </span>
                          {note.authorName && (
                            <span className="flex items-center gap-1 font-medium">
                              <User className="w-3 h-3 text-label-3" />
                              {note.authorName}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyText(note)}
                          title="Salin isi catatan"
                          className="flex hit-44 h-8 w-8 items-center justify-center rounded-full bg-fill hover:bg-fill/80 text-label-2 hover:text-label transition-colors"
                        >
                          {copiedId === note.id ? (
                            <Check className="w-3.5 h-3.5 text-positive" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => togglePin(note.id, note.isPinned)}
                              title={note.isPinned ? "Lepas sematan" : "Sematkan di atas"}
                              className={`flex hit-44 h-8 w-8 items-center justify-center rounded-full transition-colors ${
                                note.isPinned
                                  ? "bg-warning text-white"
                                  : "bg-fill hover:bg-fill/80 text-label-2 hover:text-label"
                              }`}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEdit(note)}
                              title="Edit catatan"
                              className="flex hit-44 h-8 w-8 items-center justify-center rounded-full bg-fill hover:bg-fill/80 text-label-2 hover:text-label transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setDeletingNote(note)}
                              title="Hapus catatan permanen"
                              className="flex hit-44 h-8 w-8 items-center justify-center rounded-full bg-negative/10 hover:bg-negative/20 text-negative transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-subhead leading-relaxed text-label-2 whitespace-pre-line break-words pt-1">
                      {renderFormattedContent(note.content)}
                    </div>

                    {note.linkUrl && (
                      <div className="pt-3">
                        <a
                          href={note.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-tint/10 hover:bg-tint/15 text-tint border border-tint/25 text-caption font-semibold transition-colors group"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>{note.linkLabel || note.linkUrl}</span>
                          <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Sheet>

      <AlertDialog
        open={!!deletingNote}
        onClose={() => setDeletingNote(null)}
        zClassName="z-[700]"
        icon={<AlertTriangle />}
        iconColor="red"
        title="Hapus Catatan Ini?"
        description={
          deletingNote ? (
            <>
              Catatan{" "}
              <strong className="font-semibold text-label">
                "{deletingNote.title || deletingNote.content.slice(0, 30)}..."
              </strong>{" "}
              akan dihapus secara permanen dari server. Tindakan ini tidak dapat dibatalkan.
            </>
          ) : null
        }
        actions={[
          { label: "Batal", role: "cancel", onClick: () => setDeletingNote(null) },
          { label: "Hapus", role: "destructive", onClick: handleConfirmDelete },
        ]}
      />
    </div>
  );
}
