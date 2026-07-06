import React, { useState } from "react";
import { useFolders, useCreateFolder, useDeleteFolder } from "@/hooks/useFolders";
import { useUIStore } from "@/store/ui-store";
import { Folder, FolderPlus, Trash2, ArrowRight, X } from "lucide-react";
import { Loader } from "../../components/ui/Loader";

export const FoldersPage: React.FC = () => {
  const { data: folders, isLoading } = useFolders();
  const { mutateAsync: createFolder } = useCreateFolder();
  const { mutateAsync: deleteFolder } = useDeleteFolder();
  const { setActiveFolderId } = useUIStore();

  // Modal / Form States
  const [showModal, setShowModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderDesc, setFolderDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;

    setIsSubmitting(true);
    try {
      await createFolder({
        name: folderName,
        description: folderDesc || undefined,
      });
      setFolderName("");
      setFolderDesc("");
      setShowModal(false);
    } catch (err) {
      alert("Failed to create folder.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteFolder = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card click redirection
    if (folderToDelete !== id) {
      setFolderToDelete(id);
      return;
    }

    try {
      await deleteFolder(id);
      setFolderToDelete(null);
    } catch (err) {
      alert("Failed to delete folder.");
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
    <div className="space-y-6 max-w-6xl mx-auto relative">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Folders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize notes into separate notebook categories
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all"
        >
          <FolderPlus className="h-4 w-4" /> New Folder
        </button>
      </div>

      {/* Grid */}
      {folders?.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
          <Folder className="h-10 w-10 text-muted-foreground/60" />
          <p>No folders created yet. Create a folder to group your notes!</p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl border border-border px-4 py-2 hover:bg-muted font-medium transition-colors"
          >
            Create First Folder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {folders?.map((folder) => (
            <div
              key={folder.id}
              onClick={() => setActiveFolderId(folder.id)}
              className="glass-panel rounded-2xl p-5 border border-border/80 hover:border-primary/50 cursor-pointer flex flex-col justify-between h-[150px] transition-all bg-card group"
            >
              <div className="space-y-2 text-left">
                <div className="flex justify-between items-start">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                    <Folder className="h-4 w-4" />
                  </span>
                  <button
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    className="text-muted-foreground/80 hover:text-red-500 rounded p-1 hover:bg-muted/50 transition-all"
                    title="Delete folder"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                    {folder.name}
                  </h3>
                  {folder.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {folder.description}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 italic mt-0.5">
                      No description
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-border/40 pt-3 mt-3">
                <span className="text-[10px] text-muted-foreground/80">
                  {new Date(folder.created_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
                  Open <ArrowRight className="h-3 w-3" />
                </span>
              </div>

              {/* Confirm deletion banner overlay indicator */}
              {folderToDelete === folder.id && (
                <div className="absolute inset-0 bg-background/90 rounded-2xl flex flex-col items-center justify-center p-3 text-center z-10 border border-red-500/30 animate-fadeIn">
                  <p className="text-xs font-semibold text-red-500">Delete this Folder?</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 max-w-[85%]">
                    Notes will remain but will be unassigned.
                  </p>
                  <div className="flex gap-2.5 mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToDelete(null);
                      }}
                      className="rounded-lg border border-border px-3 py-1 text-[10px] font-semibold hover:bg-muted/80"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={(e) => handleDeleteFolder(folder.id, e)}
                      className="rounded-lg bg-red-500 text-white px-3 py-1 text-[10px] font-semibold hover:bg-red-600"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl space-y-4 border border-border/80 bg-card">
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <h2 className="text-base font-bold flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-primary" /> Create New Folder
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  placeholder="e.g. Work, Journal, Project Ideas"
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-sm outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={folderDesc}
                  onChange={(e) => setFolderDesc(e.target.value)}
                  placeholder="e.g. Design details, reference document notes..."
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-sm outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-colors resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader size="sm" />
                  ) : null}
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
