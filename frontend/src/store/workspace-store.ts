import { create } from "zustand";
import { apiClient } from "@/lib/api-client";
import { Workspace } from "@/types";

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isLoading: boolean;

  fetchWorkspaces: () => Promise<void>;
  setActiveWorkspaceId: (id: string | null) => void;
  createWorkspace: (name: string) => Promise<Workspace>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  // Try to load initial active workspace from localStorage
  const initialActiveId = typeof window !== "undefined" ? localStorage.getItem("active_workspace_id") : null;

  return {
    workspaces: [],
    activeWorkspaceId: initialActiveId,
    isLoading: false,

    fetchWorkspaces: async () => {
      set({ isLoading: true });
      try {
        const response = await apiClient.get("/workspaces/");
        const workspaces = response.data;
        
        let activeId = get().activeWorkspaceId;
        
        // If the active workspace is not in the fetched list (or is null), fallback to the first workspace
        if (workspaces.length > 0) {
          const match = workspaces.find((w: Workspace) => w.id === activeId);
          if (!match) {
            activeId = workspaces[0].id;
            localStorage.setItem("active_workspace_id", activeId || "");
          }
        } else {
          activeId = null;
          localStorage.removeItem("active_workspace_id");
        }

        set({
          workspaces,
          activeWorkspaceId: activeId,
          isLoading: false,
        });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    setActiveWorkspaceId: (id) => {
      if (id) {
        localStorage.setItem("active_workspace_id", id);
      } else {
        localStorage.removeItem("active_workspace_id");
      }
      
      set({ activeWorkspaceId: id });
      
      // Dispatch a custom event to notify TanStack Query to invalidate queries
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("workspace-changed"));
      }
    },

    createWorkspace: async (name) => {
      set({ isLoading: true });
      try {
        const response = await apiClient.post("/workspaces/", { name });
        const newWorkspace = response.data;
        
        // Fetch workspaces again to populate list
        await get().fetchWorkspaces();
        
        // Set new workspace as active
        get().setActiveWorkspaceId(newWorkspace.id);
        
        set({ isLoading: false });
        return newWorkspace;
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },
  };
});
