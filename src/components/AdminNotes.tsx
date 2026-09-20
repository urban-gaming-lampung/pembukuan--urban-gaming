import React, { useState } from "react";
import {
  StickyNote,
  Plus,
  Pencil,
  Trash2,
  Pin,
  ExternalLink,
  Copy,
  Check,
  X,
  Link2,
  Calendar,
  User,
  ShieldCheck,
  Eye,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { useAdminNotes, AdminNote } from "../hooks/useAdminNotes";

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

  // State Modal Pop-up Utama
  const [isOpenModal, setIsOpenModal] = useState(false);

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

  // Buka Form Tambah Baru
  const handleOpenAdd = () => {
    setTitle("");
    setContent("");
    setLinkUrl("");
    setLinkLabel("");
    setIsPinned(false);
    setEditingNoteId(null);
    setIsEditing(true);
  };

  // Buka Form Edit Catatan yang sudah ada
  const handleOpenEdit = (note: AdminNote) => {
    setTitle(note.title || "");
    setContent(note.content || "");
    setLinkUrl(note.linkUrl || "");
    setLinkLabel(note.linkLabel || "");
    setIsPinned(Boolean(note.isPinned));
    setEditingNoteId(note.id);
    setIsEditing(true);
  };

  // Simpan Catatan (Tambah / Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

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
      alert("Terjadi kesalahan saat menyimpan catatan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hapus Catatan
  const handleConfirmDelete = async () => {
    if (!deletingNote) return;
    try {
      await deleteNote(deletingNote.id);
      setDeletingNote(null);
    } catch (err) {
      console.error("Gagal menghapus catatan:", err);
      alert("Gagal menghapus catatan.");
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
            className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 underline font-medium break-all inline-flex items-center gap-0.5 mx-0.5"
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

  // Ambil catatan teratas untuk ringkasan di tombol banner
  const pinnedOrFirstNote = notes.length > 0 ? notes[0] : null;

  return (
    <>
      {/* ========================================================================= */}
      {/* BANNER UTAMA (UKURAN & PROPORSI DISESUAIKAN DENGAN CHALLENGE GAME BUTTON) */}
      {/* ========================================================================= */}
      <button
        type="button"
        onClick={() => setIsOpenModal(true)}
        className="group relative flex w-full items-center justify-between overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 dark:from-amber-600 dark:via-amber-700 dark:to-yellow-800 p-5 text-white shadow-lg shadow-amber-500/20 transition-all duration-200 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] font-sans text-left"
        aria-label="Buka Catatan dan Tautan Penting Admin"
      >
        {/* Shimmer animation effect ala Apple */}
        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-10" />

        {/* Konten Kiri */}
        <div className="flex items-center gap-4 relative z-20 min-w-0 pr-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white backdrop-blur-md shadow-inner">
            <StickyNote className="h-6 w-6 animate-pulse" />
          </div>

          <div className="flex flex-col text-left min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[10px] tracking-wider text-amber-100 uppercase opacity-95">
                CATATAN & INFORMASI ADMIN
              </span>
              {pinnedOrFirstNote?.isPinned && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md bg-amber-300/30 text-white text-[9px] font-bold">
                  <Pin className="w-2.5 h-2.5" /> PIN
                </span>
              )}
            </div>

            <span className="text-base sm:text-lg font-black tracking-tight mt-0.5 truncate leading-tight">
              {loading
                ? "Memuat catatan..."
                : pinnedOrFirstNote
                ? pinnedOrFirstNote.title || pinnedOrFirstNote.content
                : isOwner
                ? "+ Tambah Catatan / Link Baru"
                : "Belum Ada Catatan Khusus"}
            </span>

            {notes.length > 1 && (
              <span className="text-[11px] text-amber-100/90 font-medium tracking-tight mt-0.5">
                +{notes.length - 1} catatan penting lainnya
              </span>
            )}
          </div>
        </div>

        {/* Tombol Kanan (Badge Aksi) */}
        <div className="flex h-8 shrink-0 items-center gap-1.5 justify-center rounded-xl bg-white/20 px-3.5 text-xs font-bold backdrop-blur-md relative z-20">
          <span>{notes.length > 0 ? "Buka Catatan" : isOwner ? "Tulis Note" : "Lihat"}</span>
          <ArrowUpRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
      </button>

      {/* ========================================================================= */}
      {/* MODAL POP-UP UTAMA (APPLE HIG PHILOSOPHY & LIGHT/DARK THEME)             */}
      {/* ========================================================================= */}
      {isOpenModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-3 sm:p-6 font-sans">
          {/* Backdrop Frosted Glass Apple */}
          <div
            className="absolute inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => {
              if (!isEditing && !deletingNote) setIsOpenModal(false);
            }}
          />

          {/* Modal Container */}
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[28px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/80 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 shadow-sm">
                  <StickyNote className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-white leading-tight">
                    Catatan & Link Tim Admin
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      Permanen • Tidak tereset saat tutup buku
                    </span>
                    <span className="inline-block w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                    {isOwner ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                        <ShieldCheck className="w-3 h-3" /> Super Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">
                        <Eye className="w-3 h-3" /> Hanya Baca
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Tombol Tambah Catatan (Khusus Super Admin) */}
                {isOwner && !isEditing && (
                  <button
                    onClick={handleOpenAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tambah Catatan</span>
                    <span className="sm:hidden">Tambah</span>
                  </button>
                )}

                {/* Tombol Close Apple */}
                <button
                  onClick={() => setIsOpenModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200/80 hover:bg-zinc-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white transition active:scale-95"
                  aria-label="Tutup Catatan"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Sub-Header / Editor Mode Bar (Jika Super Admin sedang mengedit/menambah) */}
            {isEditing && (
              <div className="p-5 border-b border-zinc-200/80 dark:border-white/10 bg-amber-500/5 dark:bg-amber-500/[0.03]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5 text-amber-500" />
                    {editingNoteId ? "Edit Catatan" : "Tambah Catatan Baru"}
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditingNoteId(null);
                    }}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-white"
                  >
                    Batal
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-3">
                  {/* Judul */}
                  <div>
                    <input
                      type="text"
                      placeholder="Judul Catatan (Opsional, misal: SOP Shift Pagi, Link Drive)"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#2C2C2E] border border-zinc-200 dark:border-white/10 text-sm font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>

                  {/* Isi Catatan */}
                  <div>
                    <textarea
                      required
                      rows={4}
                      placeholder="Tulis catatan, instruksi, nomor penting, atau paste URL link di sini..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#2C2C2E] border border-zinc-200 dark:border-white/10 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-y min-h-[90px]"
                    />
                  </div>

                  {/* Tautan Tambahan (Link URL & Label) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="relative">
                      <ExternalLink className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
                      <input
                        type="url"
                        placeholder="https://... (Opsional)"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#2C2C2E] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Label Tautan (misal: Buka Folder Google Drive)"
                        value={linkLabel}
                        onChange={(e) => setLinkLabel(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#2C2C2E] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      />
                    </div>
                  </div>

                  {/* Toggle Pin & Action Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500"
                      />
                      <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                        <Pin className="w-3.5 h-3.5 text-amber-500" /> Sematkan di paling atas
                      </span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setEditingNoteId(null);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !content.trim()}
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-xs font-bold text-white shadow-sm transition active:scale-95"
                      >
                        {isSubmitting
                          ? "Menyimpan..."
                          : editingNoteId
                          ? "Perbarui Catatan"
                          : "Simpan Catatan"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* List Catatan (Scrollable Body) */}
            <div className="p-5 overflow-y-auto space-y-4 max-h-[60vh] divide-y divide-transparent">
              {notes.length === 0 ? (
                /* Empty State */
                <div className="py-12 px-4 text-center flex flex-col items-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-500 mb-3">
                    <StickyNote className="w-7 h-7" />
                  </div>
                  <h4 className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                    Belum Ada Catatan
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mt-1 leading-relaxed">
                    {isOwner
                      ? "Gunakan fitur ini untuk menulis memo, informasi SOP, link drive, atau instruksi kepada staf admin. Tekan tombol 'Tambah Catatan' di atas."
                      : "Saat ini belum ada instruksi atau link catatan dari Super Admin."}
                  </p>
                  {isOwner && !isEditing && (
                    <button
                      onClick={handleOpenAdd}
                      className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Buat Catatan Pertama
                    </button>
                  )}
                </div>
              ) : (
                /* List Kartu Catatan */
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`relative rounded-2xl p-4 sm:p-5 transition-all duration-200 ${
                      note.isPinned
                        ? "bg-amber-50/70 dark:bg-amber-500/[0.08] border border-amber-300/60 dark:border-amber-500/25 ring-1 ring-amber-500/20"
                        : "bg-zinc-50/90 dark:bg-[#2C2C2E]/60 border border-zinc-200/80 dark:border-white/5"
                    } shadow-sm hover:shadow-md`}
                  >
                    {/* Header Item Catatan */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="space-y-1">
                        {note.title && (
                          <h4 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white leading-tight">
                            {note.title}
                          </h4>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {note.isPinned && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px]">
                              <Pin className="w-2.5 h-2.5" /> Disematkan
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-zinc-400" />
                            {formatDateTime(note.createdAt)}
                          </span>
                          {note.authorName && (
                            <span className="flex items-center gap-1 font-medium">
                              <User className="w-3 h-3 text-zinc-400" />
                              {note.authorName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tombol Aksi Kanan (Copy, Edit, Delete, Pin) */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Tombol Copy (Semua Akun) */}
                        <button
                          type="button"
                          onClick={() => handleCopyText(note)}
                          title="Salin isi catatan"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-200/60 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition"
                        >
                          {copiedId === note.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Aksi Khusus Super Admin */}
                        {isOwner && (
                          <>
                            {/* Toggle Pin */}
                            <button
                              type="button"
                              onClick={() => togglePin(note.id, note.isPinned)}
                              title={note.isPinned ? "Lepas sematan" : "Sematkan di atas"}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                                note.isPinned
                                  ? "bg-amber-500 text-white"
                                  : "bg-zinc-200/60 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                              }`}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(note)}
                              title="Edit catatan"
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-200/60 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => setDeletingNote(note)}
                              title="Hapus catatan permanen"
                              className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Isi Catatan */}
                    <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-200 whitespace-pre-line break-words pt-1 font-sans">
                      {renderFormattedContent(note.content)}
                    </div>

                    {/* Tautan Cepat Khusus (Jika Ada linkUrl terpasang) */}
                    {note.linkUrl && (
                      <div className="pt-3">
                        <a
                          href={note.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-bold transition group"
                        >
                          <Link2 className="w-3.5 h-3.5 text-blue-500" />
                          <span>{note.linkLabel || note.linkUrl}</span>
                          <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer Modal Apple */}
            <div className="px-6 py-3.5 border-t border-zinc-200/80 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.02] flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>
                Total: <strong>{notes.length}</strong> Catatan
              </span>
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="px-4 py-1.5 rounded-xl bg-zinc-200/80 hover:bg-zinc-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold transition active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIALOG KONFIRMASI HAPUS ALA APPLE HIG (DESTRUCTIVE CONFIRMATION)          */}
      {/* ========================================================================= */}
      {deletingNote && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeletingNote(null)}
          />
          <div className="relative w-full max-w-[320px] rounded-[24px] bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl p-6 text-center shadow-2xl ring-1 ring-black/10 dark:ring-white/10 animate-in zoom-in-95 duration-150">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h4 className="text-base font-bold text-zinc-900 dark:text-white">
              Hapus Catatan Ini?
            </h4>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Catatan{" "}
              <strong className="text-zinc-800 dark:text-zinc-200">
                "{deletingNote.title || deletingNote.content.slice(0, 30)}..."
              </strong>{" "}
              akan dihapus secara permanen dari server. Tindakan ini tidak dapat
              dibatalkan.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeletingNote(null)}
                className="py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-sm transition active:scale-95"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
