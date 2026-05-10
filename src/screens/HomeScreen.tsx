import React, { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../services/firebase/config";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import {
  Plus,
  Search,
  User as UserIcon,
  LogIn,
  Sparkles,
  Moon,
  Sun,
  Trash2,
  Pin,
  Palette,
  X,
  RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";

interface Note {
  id: string;
  title: string;
  content: string;
  color?: string;
  isPinned?: boolean;
  updatedAt: any;
}

export const HomeScreen: React.FC = () => {
  const { user, login, notes, notesLoading } = useAppContext();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  // Pending Deletions State
  const [pendingDeletions, setPendingDeletions] = useState<Note[]>([]);
  const pendingTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Context Menu State
  const [selectedNote, setSelectedNote] = useState<{
    note: Note;
    x: number;
    y: number;
  } | null>(null);

  const handleSwipeToRemove = (note: Note) => {
    setPendingDeletions((prev) => [...prev, note]);
    pendingTimers.current[note.id] = setTimeout(async () => {
      try {
        await deleteDoc(doc(db, "notes", note.id));
      } catch (err) {
        console.error("Failed to delete", err);
      }
      setPendingDeletions((prev) => prev.filter((n) => n.id !== note.id));
      delete pendingTimers.current[note.id];
    }, 5000);
  };

  const handleUndoDeletion = (noteId: string) => {
    if (pendingTimers.current[noteId]) {
      clearTimeout(pendingTimers.current[noteId]);
      delete pendingTimers.current[noteId];
    }
    setPendingDeletions((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleUpdateNote = async (noteId: string, updates: Partial<Note>) => {
    try {
      await updateDoc(doc(db, "notes", noteId), { ...updates });
      setSelectedNote(null);
    } catch (err) {
      console.error("Failed to update note", err);
    }
  };

  const filteredNotes = [...notes]
    .filter((n) => !pendingDeletions.find((p) => p.id === n.id))
    .filter(
      (n) =>
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.content.toLowerCase().includes(search.toLowerCase()),
    );

  const pinnedNotes = filteredNotes.filter((n) => n.isPinned);
  const otherNotes = filteredNotes.filter((n) => !n.isPinned);

  const latestDeleted = pendingDeletions[pendingDeletions.length - 1];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-24 relative min-h-screen"
    >
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-10">
        <div className="flex-1 glass rounded-2xl flex items-center px-4 py-3 shadow-sm ring-1 ring-black/[0.02]">
          <Search size={18} className="text-neutral-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search notes..."
            className="bg-transparent border-none focus:outline-none flex-1 w-full min-w-0 text-sm font-medium text-neutral-900 dark:text-neutral-100"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          onClick={toggleTheme}
          className="w-12 h-12 rounded-2xl glass flex items-center justify-center active:scale-95 transition-transform shrink-0"
        >
          {theme === "light" ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {user ? (
          <button
            onClick={() => navigate("/profile")}
            className="w-12 h-12 rounded-2xl glass flex items-center justify-center overflow-hidden active:scale-95 transition-transform shrink-0"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <UserIcon size={22} />
            )}
          </button>
        ) : (
          <button
            onClick={login}
            className="px-5 py-3 glass rounded-2xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-transform whitespace-nowrap shrink-0"
          >
            <LogIn size={16} /> Sign In
          </button>
        )}
      </div>

      {/* Notes Grid */}
      <AnimatePresence mode="popLayout">
        {pinnedNotes.length > 0 ? (
          <>
            <div className="mb-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 pl-2">Pinned</div>
            <div className="columns-2 gap-3 w-full mb-6">
              {pinnedNotes.map((note) => (
                <div key={note.id} className="break-inside-avoid w-full mb-3">
                  <NoteCard
                    note={note}
                    onClick={() => navigate(`/note/${note.id}`)}
                    onRemove={() => handleSwipeToRemove(note)}
                    onLongPress={(pos) => setSelectedNote({ note, ...pos })}
                  />
                </div>
              ))}
            </div>

            {otherNotes.length > 0 && (
              <>
                <div className="mb-3 text-xs font-semibold text-neutral-500 dark:text-neutral-400 pl-2">Others</div>
                <div className="columns-2 gap-3 w-full">
                  {otherNotes.map((note) => (
                    <div key={note.id} className="break-inside-avoid w-full mb-3">
                      <NoteCard
                        note={note}
                        onClick={() => navigate(`/note/${note.id}`)}
                        onRemove={() => handleSwipeToRemove(note)}
                        onLongPress={(pos) => setSelectedNote({ note, ...pos })}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="columns-2 gap-3 w-full">
            {otherNotes.map((note) => (
              <div key={note.id} className="break-inside-avoid w-full mb-3">
                <NoteCard
                  note={note}
                  onClick={() => navigate(`/note/${note.id}`)}
                  onRemove={() => handleSwipeToRemove(note)}
                  onLongPress={(pos) => setSelectedNote({ note, ...pos })}
                />
              </div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!notesLoading && filteredNotes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <Sparkles size={48} className="mb-4" />
          <p className="text-sm font-medium">No notes found</p>
        </div>
      )}

      {/* Context Menu Modal */}
      <AnimatePresence>
        {selectedNote && (
          <div
            className="fixed inset-0 z-50 pointer-events-auto"
            onClick={() => setSelectedNote(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                transformOrigin: "top left",
                // Ensure it doesn't overflow the screen. 256px is width (w-64), 280px is approx height.
                left: Math.max(
                  16,
                  Math.min(selectedNote.x, window.innerWidth - 256 - 16),
                ),
                top: Math.max(
                  16,
                  Math.min(selectedNote.y, window.innerHeight - 280 - 16),
                ),
              }}
              className="w-64 glass rounded-3xl p-5 shadow-2xl flex flex-col gap-3"
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100 line-clamp-1">
                  {selectedNote.note.title || "Untitled"}
                </h3>
              </div>

              <button
                onClick={() =>
                  handleUpdateNote(selectedNote.note.id, {
                    isPinned: !selectedNote.note.isPinned,
                  })
                }
                className="w-full text-left py-3 px-4 glass rounded-[18px] font-medium text-[13px] flex items-center gap-3 active:scale-[0.98] transition-transform"
              >
                <Pin
                  size={16}
                  className={
                    selectedNote.note.isPinned
                      ? "text-brand"
                      : "text-neutral-500"
                  }
                />
                {selectedNote.note.isPinned ? "Unpin Note" : "Pin Note"}
              </button>

              <div className="w-full py-3 px-4 glass rounded-[18px] flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[13px] font-medium">
                  <Palette size={16} className="text-neutral-500" />
                  Note Color
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    "", // Default
                    "bg-red-100 dark:bg-red-900/30",
                    "bg-orange-100 dark:bg-orange-900/30",
                    "bg-emerald-100 dark:bg-emerald-900/30",
                    "bg-blue-100 dark:bg-blue-900/30",
                    "bg-brand/10 dark:bg-brand/20",
                  ].map((colorClass, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        handleUpdateNote(selectedNote.note.id, {
                          color: colorClass,
                        })
                      }
                      className={`w-6 h-6 rounded-full border-2 transition-transform active:scale-95 ${colorClass || "bg-white dark:bg-neutral-800"} ${selectedNote.note.color === colorClass ? "border-neutral-900 dark:border-white scale-110" : "border-transparent"}`}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  const noteToRemove = selectedNote.note;
                  setSelectedNote(null);
                  handleSwipeToRemove(noteToRemove);
                }}
                className="w-full text-left py-3 px-4 glass rounded-[18px] font-medium text-[13px] flex items-center gap-3 active:scale-[0.98] transition-transform text-red-600 dark:text-red-400"
              >
                <Trash2 size={16} />
                Delete Note
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Undo Snackbar */}
      <AnimatePresence>
        {latestDeleted && (
          <div className="fixed bottom-28 left-0 right-0 pointer-events-none z-[60]">
            <div className="max-w-3xl mx-auto px-6 flex justify-center">
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="pointer-events-auto w-full glass rounded-2xl p-4 flex items-center justify-between shadow-2xl border border-white/20"
              >
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Note removed
                </span>
                <button
                  onClick={() => handleUndoDeletion(latestDeleted.id)}
                  className="text-sm font-bold text-brand flex items-center gap-1.5 active:scale-95 transition-transform bg-brand/10 px-3 py-1.5 rounded-full"
                >
                  <RotateCcw size={14} /> Undo
                </button>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* FAB Container - Stays fixed but constrained to max-width */}
      <div className="fixed bottom-10 left-0 right-0 pointer-events-none z-40">
        <div className="max-w-3xl mx-auto px-6 flex justify-end">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/note/new")}
            className="w-16 h-16 bg-brand text-white rounded-3xl shadow-2xl shadow-brand/30 flex items-center justify-center pointer-events-auto active:brightness-90 transition-all"
          >
            <Plus size={32} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// Hook for Long Press Detection
const useLongPress = (
  callback: (pos: { x: number; y: number }) => void,
  ms = 400,
) => {
  const timerId = useRef<NodeJS.Timeout>();
  const posRef = useRef<{ x: number; y: number } | null>(null);

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e && e.touches.length > 0) {
      posRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if ("clientX" in e) {
      posRef.current = {
        x: (e as React.MouseEvent).clientX,
        y: (e as React.MouseEvent).clientY,
      };
    }

    // Clear any existing timer
    if (timerId.current) clearTimeout(timerId.current);

    timerId.current = setTimeout(() => {
      if (posRef.current) callback(posRef.current);
      posRef.current = null;
    }, ms);
  };

  const clear = () => {
    if (timerId.current) clearTimeout(timerId.current);
    posRef.current = null;
  };

  useEffect(() => {
    return () => clear();
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onMouseMove: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
  };
};

const NoteCard: React.FC<{
  note: Note;
  onClick: () => void;
  onRemove: () => void;
  onLongPress: (pos: { x: number; y: number }) => void;
}> = ({ note, onClick, onRemove, onLongPress }) => {
  const longPressProps = useLongPress((pos) => {
    onLongPress(pos);
  }, 400); // 400ms delay for long press

  const baseColor = note.color || "bg-white/40 dark:bg-black/20";

  return (
    <motion.div
      layoutId={`note-${note.id}`}
      initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.8, filter: "blur(40px)" }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={(e, { offset }) => {
        if (offset.x > 80 || offset.x < -80) {
          onRemove();
        }
      }}
      // Use whileDrag to slightly elevate
      whileDrag={{ scale: 1.05, zIndex: 10 }}
      transition={{
        type: "spring",
        stiffness: 450,
        damping: 32,
        mass: 1,
        layout: {
          type: "spring",
          stiffness: 450,
          damping: 32,
        },
      }}
      onClick={onClick}
      {...longPressProps}
      style={{ touchAction: "pan-y" } as any}
      className={`glass rounded-[24px] p-5 cursor-pointer hover:border-brand/30 transition-all flex flex-col overflow-hidden ring-1 ring-black/[0.02] shadow-sm hover:shadow-md hover:-translate-y-0.5 ${baseColor} z-0 relative h-fit`}
    >
      {note.isPinned && (
        <div className="absolute top-4 right-4 text-brand opacity-60">
          <Pin size={14} fill="currentColor" />
        </div>
      )}

      <h3 className="font-display font-semibold text-sm mb-2 line-clamp-1 text-neutral-800 dark:text-neutral-100 pr-4">
        {note.title || "Untitled"}
      </h3>
      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-[10] whitespace-pre-wrap break-words leading-relaxed flex-1">
        {note.content}
      </p>

      {note.updatedAt && (
        <span className="text-[9px] font-bold tracking-tight text-neutral-400 mt-3 uppercase">
          {new Date(note.updatedAt.toDate()).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
          })}
        </span>
      )}
    </motion.div>
  );
};
