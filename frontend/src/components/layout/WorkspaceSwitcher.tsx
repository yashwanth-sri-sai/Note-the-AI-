import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { ChevronDown, Plus, Check, Briefcase, X } from "lucide-react";
import { AnimatedModal } from "@/components/motion/MotionSystem";

export const WorkspaceSwitcher: React.FC = () => {
  const {
    workspaces,
    activeWorkspaceId,
    fetchWorkspaces,
    setActiveWorkspaceId,
    createWorkspace,
  } = useWorkspaceStore();

  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchWorkspaces().catch((err) => console.error("Error loading workspaces:", err));
  }, [fetchWorkspaces]);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const handleSelect = (id: string) => {
    setActiveWorkspaceId(id);
    setIsOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setIsSubmitting(true);
    try {
      await createWorkspace(newWorkspaceName);
      setNewWorkspaceName("");
      setShowCreateModal(false);
    } catch (err) {
      console.error("Failed to create workspace:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full">
      {/* Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary hover:border-border transition-all text-left shadow-sm"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 font-semibold text-xs border border-indigo-500/25">
            <Briefcase className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex flex-col">
            <span className="text-[10px] text-muted-text uppercase font-bold tracking-wider leading-none">
              Workspace
            </span>
            <span className="text-xs font-semibold text-primary-text truncate mt-0.5">
              {activeWorkspace?.name || "Loading..."}
            </span>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-text transition-transform shrink-0 duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <>
          {/* Backdrop to close dropdown on click outside */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute left-0 right-0 mt-2 p-1.5 z-50 rounded-xl border border-border bg-card shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-text uppercase tracking-wider">
              Switch Workspace
            </div>
            
            <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
              {workspaces.map((w) => {
                const isSelected = w.id === activeWorkspaceId;
                return (
                  <button
                    key={w.id}
                    onClick={() => handleSelect(w.id)}
                    className={`flex items-center justify-between w-full px-2.5 py-2 text-xs font-medium rounded-lg transition-all ${
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-secondary-text hover:bg-secondary hover:text-primary-text"
                    }`}
                  >
                    <span className="truncate pr-2">{w.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
            
            <div className="border-t border-border my-1.5" />
            
            <button
              onClick={() => {
                setIsOpen(false);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-2 text-xs font-semibold text-primary rounded-lg hover:bg-secondary transition-all text-left"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Create Workspace
            </button>
          </div>
        </>
      )}

      {/* Create Workspace Modal Overlay */}
      <AnimatedModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} className="bg-card border border-border p-6 relative">
        <button
          onClick={() => setShowCreateModal(false)}
          className="absolute top-4 right-4 p-1.5 text-muted-text hover:text-primary-text rounded-lg hover:bg-secondary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <h3 className="text-base font-bold text-primary-text mb-1 text-left">
          Create New Workspace
        </h3>
        <p className="text-xs text-muted-text mb-4 text-left">
          Workspaces isolate your notebooks, tags, and settings, enabling multiple contexts or teams.
        </p>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="text-left">
            <label className="block text-[10px] uppercase font-bold tracking-wider text-muted-text mb-1.5">
              Workspace Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Work, Engineering Team, Personal Notes"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs text-primary-text transition-all placeholder:text-muted-text"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 text-xs font-semibold text-muted-text hover:text-primary-text rounded-xl hover:bg-secondary transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newWorkspaceName.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-primary/10 flex items-center gap-1.5"
            >
              {isSubmitting ? "Creating..." : "Create Workspace"}
            </button>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
};
