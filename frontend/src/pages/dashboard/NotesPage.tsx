import React, { useEffect, useState, useRef } from "react";
import { useNotes, useNote, useCreateNote, useUpdateNote, useDeleteNote, useSetNoteTags } from "@/hooks/useNotes";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import { useUIStore } from "@/store/ui-store";
import {
  Search, Plus, Star, Trash2, FolderOpen,
  Check, ChevronDown, BookOpen, Loader2
} from "lucide-react";
import { TipTapEditor } from "@/components/editor/TipTapEditor";

export const NotesPage: React.FC = () => {
  const {
    activeNoteId,
    setActiveNoteId,
    activeFolderId,
    activeTagId,
    resetFilters
  } = useUIStore();

  // Fetch lists
  const { data: notes, isLoading: notesLoading } = useNotes({
    folderId: activeFolderId,
    tagId: activeTagId
  });
  const { data: folders } = useFolders();
  const { data: tags } = useTags();

  // Fetch active note
  const { data: activeNote, isLoading: noteLoading } = useNote(activeNoteId);

  // Mutations
  const { mutateAsync: createNote } = useCreateNote();
  const { mutateAsync: updateNote } = useUpdateNote();
  const { mutateAsync: deleteNote } = useDeleteNote();
  const { mutateAsync: setNoteTags } = useSetNoteTags();

  // Local editor states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [searchQuery, setSearchQuery] = useState("");

  // Dropdown open states
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveNoteIdRef = useRef<string | null>(null);

  // Synchronize local states when active note changes
  useEffect(() => {
    if (!activeNoteId) {
      setTitle("");
      setContent("");
      setIsFavorite(false);
      setFolderId(null);
      lastActiveNoteIdRef.current = null;
      setSaveStatus("saved");
      return;
    }

    if (activeNote && activeNote.id === activeNoteId) {
      if (lastActiveNoteIdRef.current !== activeNote.id) {
        setTitle(activeNote.title);
        setContent(activeNote.content);
        setIsFavorite(activeNote.is_favorite);
        setFolderId(activeNote.folder_id);
        setSaveStatus("saved");
        lastActiveNoteIdRef.current = activeNote.id;
      }
    }
  }, [activeNote, activeNoteId]);

  // Debounced Autosave Trigger
  useEffect(() => {
    if (!activeNoteId || !activeNote) return;

    // Check if changes actually occurred
    const hasChanges =
      title !== activeNote.title ||
      content !== activeNote.content ||
      isFavorite !== activeNote.is_favorite ||
      folderId !== activeNote.folder_id;

    if (!hasChanges) return;

    setSaveStatus("saving");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await updateNote({
          id: activeNoteId,
          data: {
            title,
            content,
            folder_id: folderId,
            is_favorite: isFavorite,
          },
        });
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("failed");
      }
    }, 1000); // 1-second debounce timeout

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [title, content, isFavorite, folderId]);

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote({
        title: "New Note",
        content: "",
        folder_id: activeFolderId || undefined,
      });
      setActiveNoteId(newNote.id);
    } catch (err) {
      alert("Failed to create note.");
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      await deleteNote(id);
      if (activeNoteId === id) {
        setActiveNoteId(null);
      }
    } catch (err) {
      alert("Failed to delete note.");
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!activeNote) return;
    const isAttached = activeNote.tags.some((t) => t.id === tagId);
    let newTagIds = [];
    if (isAttached) {
      newTagIds = activeNote.tags.filter((t) => t.id !== tagId).map((t) => t.id);
    } else {
      newTagIds = [...activeNote.tags.map((t) => t.id), tagId];
    }

    try {
      await setNoteTags({ id: activeNote.id, tagIds: newTagIds });
    } catch (err) {
      alert("Failed to update tags.");
    }
  };

  // Local filter list
  const filteredNotes =
    notes?.filter(
      (n) =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-1 md:grid-cols-3 overflow-hidden clay-panel">
      {/* Left Column: Notes selection list */}
      <div className="col-span-1 border-r border-border/40 flex flex-col bg-background/10 h-full">
        {/* Search header */}
        <div className="p-4 border-b border-border/40 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute inset-y-0 left-0 pl-3 h-full w-9 text-muted-foreground flex items-center shrink-0 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-full py-2 pl-9 pr-4 text-xs outline-none clay-input"
            />
          </div>

          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">
              {activeFolderId ? "Folder Notes" : activeTagId ? "Tag Notes" : "All Notes"} ({filteredNotes.length})
            </span>
            {(activeFolderId || activeTagId) && (
              <button
                onClick={resetFilters}
                className="text-[10px] text-primary hover:underline font-semibold"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Note list body */}
        <div className="flex-grow overflow-y-auto divide-y divide-border/20 p-2 space-y-1 scrollbar">
          {notesLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground p-4">
              No notes found. Click "+" below to write your first note.
            </div>
          ) : (
            filteredNotes.map((n) => (
              <div
                key={n.id}
                onClick={() => setActiveNoteId(n.id)}
                className={`group text-left p-3.5 rounded-xl cursor-pointer transition-all flex flex-col gap-1.5 ${
                  activeNoteId === n.id
                    ? "bg-primary/10 border-l-4 border-l-primary shadow-sm"
                    : "hover:bg-muted/40"
                }`}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-xs truncate w-[80%]">
                    {n.title || "Untitled Note"}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDeleteNote(n.id, e)}
                      className="text-muted-foreground hover:text-red-500 rounded p-0.5"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {n.content || "Empty content..."}
                </p>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-[9px] text-muted-foreground/80">
                    {new Date(n.updated_at).toLocaleDateString()}
                  </span>
                  {n.is_favorite && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 shrink-0" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create quick button */}
        <div className="p-3 border-t border-border/40 bg-background/5">
          <button
            onClick={handleCreateNote}
            className="flex items-center justify-center gap-2 w-full clay-btn-primary py-2.5 text-xs font-semibold text-white shadow shadow-primary/20 hover:bg-primary/95 transition-all"
          >
            <Plus className="h-4 w-4" /> Create Note
          </button>
        </div>
      </div>

      {/* Right Column: Editing Panel */}
      <div className="col-span-2 flex flex-col h-full bg-background/5">
        {noteLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !activeNoteId ? (
          <div className="flex flex-col h-full items-center justify-center text-center p-8 space-y-3">
            <BookOpen className="h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold text-sm">No note selected</h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Select an existing note from the side panel or create a new note to start writing.
            </p>
            <button
              onClick={handleCreateNote}
              className="clay-btn-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primary/95 shadow transition-all"
            >
              Create Note
            </button>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Editor Header */}
            <div className="p-4 border-b border-border/40 space-y-3 shrink-0 bg-background/10">
              <div className="flex justify-between items-center gap-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note Title..."
                  className="bg-transparent border-none text-base font-bold outline-none flex-grow placeholder:text-muted-foreground/60 focus:ring-0"
                />

                <div className="flex items-center gap-3 shrink-0">
                  {/* Save Status Cloud Indicator */}
                  <span className="text-[10px] text-muted-foreground">
                    {saveStatus === "saving" && "☁️ Saving..."}
                    {saveStatus === "saved" && "✓ Saved"}
                    {saveStatus === "failed" && "⚠️ Sync Failed"}
                  </span>

                  {/* Favorite Toggle */}
                  <button
                    onClick={() => setIsFavorite(!isFavorite)}
                    className={`p-2 transition-colors clay-btn ${
                      isFavorite ? "border-yellow-500/30 text-yellow-500 bg-yellow-500/10" : "text-muted-foreground bg-card/40"
                    }`}
                  >
                    <Star className={`h-4 w-4 ${isFavorite ? "fill-yellow-500" : ""}`} />
                  </button>

                  {/* Folder Mover Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowFolderDropdown(!showFolderDropdown);
                        setShowTagDropdown(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors clay-btn bg-card/40 text-foreground"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="max-w-[70px] truncate">
                        {folders?.find((f) => f.id === folderId)?.name || "Move"}
                      </span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                    {showFolderDropdown && (
                      <div className="absolute right-0 mt-1 w-44 rounded-xl shadow-lg p-1.5 z-20 space-y-0.5 text-left animate-fadeIn clay-panel bg-card/90">
                        <button
                          onClick={() => {
                            setFolderId(null);
                            setShowFolderDropdown(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted/50 font-medium flex justify-between items-center"
                        >
                          Unassigned
                          {folderId === null && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                        {folders?.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => {
                              setFolderId(f.id);
                              setShowFolderDropdown(false);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted/50 font-medium flex justify-between items-center truncate"
                          >
                            {f.name}
                            {folderId === f.id && <Check className="h-3.5 w-3.5 text-primary" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tag Association Selector */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowTagDropdown(!showTagDropdown);
                        setShowFolderDropdown(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors clay-btn bg-card/40 text-foreground"
                    >
                      <span className="flex h-2 w-2 rounded-full bg-purple-500"></span>
                      Tags
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                    {showTagDropdown && (
                      <div className="absolute right-0 mt-1 w-44 shadow-lg p-2 z-20 max-h-56 overflow-y-auto space-y-1.5 text-left animate-fadeIn scrollbar clay-panel bg-card/90">
                        <p className="text-[9px] uppercase font-bold text-muted-foreground px-1 pb-1 border-b border-border/40">
                          Toggle tags
                        </p>
                        {tags?.length === 0 ? (
                          <p className="text-[10px] text-muted-foreground italic p-1">No tags created yet.</p>
                        ) : (
                          tags?.map((t) => {
                            const isAttached = activeNote?.tags.some((nt) => nt.id === t.id);
                            return (
                              <div
                                key={t.id}
                                onClick={() => handleToggleTag(t.id)}
                                className="flex items-center justify-between px-1.5 py-1 rounded-lg hover:bg-muted/50 cursor-pointer text-xs font-medium"
                              >
                                <span className="flex items-center gap-1.5 truncate">
                                  <span
                                    style={{ backgroundColor: t.color }}
                                    className="h-2 w-2 rounded-full shrink-0"
                                  ></span>
                                  <span className="truncate">{t.name}</span>
                                </span>
                                {isAttached && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tags bubble list below title */}
              {activeNote?.tags && activeNote.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeNote.tags.map((t) => (
                    <span
                      key={t.id}
                      style={{ backgroundColor: `${t.color}15`, color: t.color, borderColor: `${t.color}25` }}
                      className="rounded-lg border px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1"
                    >
                      {t.name}
                      <button
                        onClick={() => handleToggleTag(t.id)}
                        className="hover:bg-muted rounded-full p-0.5 shrink-0"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Rich Text Editor */}
            <div className="flex-grow p-4 overflow-y-auto flex flex-col">
              <TipTapEditor content={content} onChange={setContent} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
