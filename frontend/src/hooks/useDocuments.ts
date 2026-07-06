import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export interface DocumentItem {
  id: string;
  filename: string;
  file_size: number;
  content_type: string;
  status: "pending" | "processing" | "completed" | "failed" | "UPLOADED" | "TEXT_EXTRACTED" | "CHUNKED" | "EMBEDDED" | "FLASHCARDS_READY" | "QUIZZES_READY" | "COMPLETED" | "FAILED";
  created_at: string;
}

export const useDocuments = () => {
  // Gate on authReady (set-once, never resets) + a real workspaceId.
  // Using isAuthenticated alone caused re-fetches whenever the auth state
  // toggled during login/logout cycles.
  const authReady = useAuthStore((state) => state.authReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<DocumentItem[]>({
    // Workspace-scoped cache key so switching workspaces gets fresh data
    // without polluting the previous workspace's cache entry.
    queryKey: ["documents", activeWorkspaceId],
    queryFn: async () => {
      const response = await apiClient.get("/documents/");
      return response.data;
    },

    // ── Polling: ONLY while at least one document is still processing ────────
    // When all docs reach a terminal state (completed / failed) the interval
    // returns `false` and polling stops automatically.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data &&
        data.some(
          (doc) => 
            doc.status !== "completed" && 
            doc.status !== "failed" && 
            doc.status !== "COMPLETED" && 
            doc.status !== "FAILED"
        )
      ) {
        return 3000; // 3 s — tight enough to feel responsive during uploads
      }
      return false; // No active processing → kill the timer
    },

    // ── Cache tunables ────────────────────────────────────────────────────────
    // staleTime: data is considered fresh for 5 min → no background refetch
    //   on window-focus / remount while it is within this window.
    staleTime: 5 * 60 * 1000,   // 5 minutes
    gcTime:   10 * 60 * 1000,   // 10 minutes (formerly cacheTime in v4)

    // ── Re-fetch guards ───────────────────────────────────────────────────────
    // These are the primary cause of the request storm: every tab-focus or
    // component remount (e.g., route change inside DashboardV2) was issuing
    // a new network request even when cached data was perfectly valid.
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,

    // ── Retry: fail fast on auth errors, do not hammer the backend ───────────
    retry: 1,

    // ── Hard gate: do NOT fire until auth is fully resolved ──────────────────
    // `authReady` is set exactly once (in initAuth, login, googleLogin) and
    // never reset, making it a safe, deterministic predicate.
    enabled: authReady && isAuthenticated && !!activeWorkspaceId,
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiClient.post("/documents/upload", formData);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate with the workspace-scoped key so only the right cache
      // entry gets refreshed.
      queryClient.invalidateQueries({ queryKey: ["documents", activeWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/documents/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", activeWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
    },
  });
};
