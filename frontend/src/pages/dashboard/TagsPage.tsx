import React, { useState } from "react";
import { useTags, useCreateTag, useDeleteTag } from "@/hooks/useTags";
import { Tag as TagIcon, Plus, Trash2, X, AlertCircle } from "lucide-react";
import { Loader } from "../../components/ui/Loader";
import { useUIStore } from "@/store/ui-store";
import { AnimatedModal } from "@/components/motion/MotionSystem";

const PRESETS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#64748B", // Slate
];

export const TagsPage: React.FC = () => {
  const { data: tags, isLoading } = useTags();
  const { mutateAsync: createTag } = useCreateTag();
  const { mutateAsync: deleteTag } = useDeleteTag();
  const { setActiveTagId } = useUIStore();

  // Form States
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESETS[5]); // Default to blue
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createTag({ name, color });
      setName("");
      setColor(PRESETS[5]);
      setShowModal(false);
    } catch (err: any) {
      setErrorMsg("Failed to create tag. Make sure values are correct.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTag = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this tag? Notes carrying this tag will remain, but the tag association is removed.")) {
      return;
    }

    try {
      await deleteTag(id);
    } catch (err) {
      alert("Failed to delete tag.");
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tags</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Attach colorful labels to classify and filter notes
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/95 transition-all"
        >
          <Plus className="h-4 w-4" /> New Tag
        </button>
      </div>

      {/* Grid */}
      {tags?.length === 0 ? (
        <div className="border border-dashed border-border rounded-2xl p-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-3">
          <TagIcon className="h-10 w-10 text-muted-text" />
          <p>No tags created yet. Create a tag to color-code your topics!</p>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-xl border border-border px-4 py-2 hover:bg-muted font-medium transition-colors"
          >
            Create First Tag
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {tags?.map((tag) => (
            <div
              key={tag.id}
              onClick={() => setActiveTagId(tag.id)}
              className="glass-panel rounded-2xl p-4 border border-border hover:border-primary/50 cursor-pointer flex items-center justify-between transition-all bg-card group"
            >
              <div className="flex items-center gap-2.5 truncate w-[80%]">
                <span
                  style={{ backgroundColor: tag.color }}
                  className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                ></span>
                <span className="font-semibold text-xs truncate group-hover:text-primary transition-colors">
                  {tag.name}
                </span>
              </div>
              <button
                onClick={(e) => handleDeleteTag(tag.id, e)}
                className="text-muted-foreground hover:text-red-500 rounded p-1 hover:bg-muted/50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                title="Delete tag"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatedModal isOpen={showModal} onClose={() => setShowModal(false)} className="bg-card border border-border/80">
        <div className="flex justify-between items-center pb-2 border-b border-border/50">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" /> Create New Tag
          </h2>
          <button
            onClick={() => setShowModal(false)}
            className="text-muted-foreground hover:text-foreground rounded p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-red-500 mt-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreateTag} className="space-y-4 mt-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground">
              Tag Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ideas, Quick, Study, Work"
              className="w-full rounded-xl border border-border bg-background/50 px-3.5 py-2 text-sm outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">
              Pick Tag Color
            </label>
            <div className="grid grid-cols-5 gap-3.5">
              {PRESETS.map((colorPreset) => (
                <button
                  key={colorPreset}
                  type="button"
                  onClick={() => setColor(colorPreset)}
                  style={{ backgroundColor: colorPreset }}
                  className={`h-7 w-7 rounded-full shrink-0 hover:scale-110 active:scale-95 transition-all relative shadow-sm border ${
                    color === colorPreset ? "border-foreground ring-2 ring-primary/40 scale-105" : "border-transparent"
                  }`}
                >
                  {color === colorPreset && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
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
              Create Tag
            </button>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
};
