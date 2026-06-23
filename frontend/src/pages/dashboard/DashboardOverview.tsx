import React from "react";
import { useNotes } from "@/hooks/useNotes";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { BookOpen, Folder, Tag, Star, Clock, Plus, ArrowRight } from "lucide-react";
import { useCreateNote } from "@/hooks/useNotes";

export const DashboardOverview: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveTab, setActiveNoteId, setActiveFolderId } = useUIStore();

  // Queries
  const { data: notes, isLoading: notesLoading } = useNotes();
  const { data: folders, isLoading: foldersLoading } = useFolders();
  const { data: tags, isLoading: tagsLoading } = useTags();
  const { mutateAsync: createNote } = useCreateNote();

  const handleCreateQuickNote = async () => {
    try {
      const newNote = await createNote({
        title: "Quick Note",
        content: "",
      });
      setActiveNoteId(newNote.id);
      setActiveTab("notes");
    } catch (err) {
      alert("Failed to create note.");
    }
  };

  const favoriteNotes = notes?.filter((n) => n.is_favorite) || [];
  const recentNotes = notes?.slice(0, 4) || [];

  const isLoading = notesLoading || foldersLoading || tagsLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-left">
      {/* Welcome banner */}
      <div className="clay-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Welcome back, {user?.name || "NoteAI writer"}! 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Here's a summary of your workspace notes and folders.
          </p>
        </div>
        <button
          onClick={handleCreateQuickNote}
          className="flex items-center gap-2 clay-btn-primary px-4 py-2.5 text-xs font-semibold text-white transition-all shadow-md"
        >
          <Plus className="h-4 w-4" /> Create New Note
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab("notes")}
          className="clay-card p-4 flex items-center gap-4 cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-inner">
            <BookOpen className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
              Total Notes
            </p>
            <h3 className="text-lg font-black">{notes?.length || 0}</h3>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("folders")}
          className="clay-card p-4 flex items-center gap-4 cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 shadow-inner">
            <Folder className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
              Folders
            </p>
            <h3 className="text-lg font-black">{folders?.length || 0}</h3>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("favorites")}
          className="clay-card p-4 flex items-center gap-4 cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-500 shadow-inner">
            <Star className="h-5 w-5 fill-yellow-500/10 text-yellow-500" />
          </span>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
              Favorites
            </p>
            <h3 className="text-lg font-black">{favoriteNotes.length}</h3>
          </div>
        </div>

        <div
          onClick={() => setActiveTab("tags")}
          className="clay-card p-4 flex items-center gap-4 cursor-pointer"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500 shadow-inner">
            <Tag className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
              Total Tags
            </p>
            <h3 className="text-lg font-black">{tags?.length || 0}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent Notes listing */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Recent Notes
            </h2>
            <button
              onClick={() => setActiveTab("notes")}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recentNotes.length === 0 ? (
              <div className="col-span-2 border border-dashed border-border rounded-2xl p-8 text-center text-xs text-muted-foreground clay-panel bg-card/20">
                No notes created yet. Click "Create New Note" to start writing!
              </div>
            ) : (
              recentNotes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setActiveNoteId(note.id)}
                  className="clay-card p-4 space-y-3 cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-xs truncate w-[85%]">
                        {note.title || "Untitled Note"}
                      </h3>
                      {note.is_favorite && (
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                      {note.content || "Empty content..."}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/20">
                    <span className="text-[9px] text-muted-foreground/80">
                      {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                    {note.tags.length > 0 && (
                      <div className="flex gap-1 overflow-hidden max-w-[60%] shrink-0">
                        {note.tags.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            style={{ backgroundColor: `${t.color}15`, color: t.color, borderColor: `${t.color}25` }}
                            className="rounded px-1.5 py-0.5 text-[8px] font-bold border truncate"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Folders Summary */}
        <div className="md:col-span-1 space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
              <Folder className="h-4 w-4 text-primary" /> Folders List
            </h2>
            <button
              onClick={() => setActiveTab("folders")}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
            >
              Manage <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="clay-panel p-4 divide-y divide-border/20 max-h-[290px] overflow-y-auto">
            {folders?.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No folders. Create one in the folders view!
              </div>
            ) : (
              folders?.slice(0, 5).map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => setActiveFolderId(folder.id)}
                  className="py-3 flex items-center justify-between cursor-pointer hover:text-primary transition-colors group"
                >
                  <div className="flex items-center gap-2.5 truncate w-[85%]">
                    <Folder className="h-4 w-4 text-indigo-500 shrink-0 group-hover:scale-105 transition-transform" />
                    <div>
                      <h4 className="font-semibold text-xs truncate">{folder.name}</h4>
                      {folder.description && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {folder.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
