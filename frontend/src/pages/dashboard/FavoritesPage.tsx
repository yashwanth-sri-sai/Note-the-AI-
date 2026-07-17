import React from "react";
import { useNotes, useUpdateNote } from "@/hooks/useNotes";
import { useUIStore } from "@/store/ui-store";
import { Star, FileText, ArrowRight } from "lucide-react";
import { Loader } from "../../components/ui/Loader";
import { getNotePreview } from "@/lib/utils";

export const FavoritesPage: React.FC = () => {
  const { data: notes, isLoading } = useNotes({ isFavorite: true });
  const { setActiveNoteId, setActiveTab } = useUIStore();
  const { mutateAsync: updateNote } = useUpdateNote();

  const handleToggleFavorite = async (id: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering open card click redirection
    try {
      await updateNote({
        id,
        data: { is_favorite: !currentStatus },
      });
    } catch (err) {
      alert("Failed to toggle favorite status.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Favorites</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Access your starred notes and pinboards immediately
        </p>
      </div>

      {notes?.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
          <Star className="h-10 w-10 text-yellow-500/50" />
          <p>No favorite notes yet. Star your important notes to see them here!</p>
          <button
            onClick={() => setActiveTab("notes")}
            className="rounded-xl border border-border px-4 py-2 hover:bg-muted font-medium transition-colors"
          >
            Browse My Notes
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {notes?.map((note) => (
            <div
              key={note.id}
              onClick={() => {
                setActiveNoteId(note.id);
                setActiveTab("notes");
              }}
              className="glass-panel rounded-2xl p-5 border border-border/80 hover:border-primary/50 cursor-pointer flex flex-col justify-between h-[155px] transition-all bg-card group relative"
            >
              <div className="space-y-2 text-left">
                <div className="flex justify-between items-start">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                    <FileText className="h-4.5 w-4.5" />
                  </span>
                  <button
                    onClick={(e) => handleToggleFavorite(note.id, note.is_favorite, e)}
                    className="text-yellow-500 hover:text-muted-foreground rounded p-1 hover:bg-muted/50 transition-all shrink-0"
                    title="Unfavorite note"
                  >
                    <Star className="h-4 w-4 fill-yellow-500" />
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                    {note.title || "Untitled Note"}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {getNotePreview(note.content, 100) || "Empty content..."}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-border pt-3 mt-3">
                <span className="text-[10px] text-secondary-text">
                  Updated {new Date(note.updated_at).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                  Open Note <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
