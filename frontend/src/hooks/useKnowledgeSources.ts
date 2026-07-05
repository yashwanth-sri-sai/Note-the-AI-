import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { KnowledgeSource } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

export const useKnowledgeSources = (
  options: { includeProcessing?: boolean } = {}
) => {
  const includeProcessing = options.includeProcessing ?? true;
  const authReady = useAuthStore((state) => state.authReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<KnowledgeSource[]>({
    // Workspace-scoped so switching workspaces doesn't bleed stale data.
    queryKey: ["knowledgeSources", activeWorkspaceId, { includeProcessing }],
    queryFn: async () => {
      const response = await apiClient.get("/knowledge/sources", {
        params: { include_processing: includeProcessing },
      });
      return response.data;
    },

    // ── Polling: active only while a document is still being ingested ─────────
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data &&
        data.some(
          (source) =>
            source.source_type === "document" &&
            (source.status === "pending" || source.status === "processing")
        )
      ) {
        return 3000;
      }
      return false;
    },

    // ── Cache tunables ────────────────────────────────────────────────────────
    staleTime: 5 * 60 * 1000,  // 5 minutes — treat cached data as fresh
    gcTime:   10 * 60 * 1000,  // 10 minutes

    // ── Re-fetch guards ───────────────────────────────────────────────────────
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,

    // ── Retry ─────────────────────────────────────────────────────────────────
    retry: 1,

    // ── Hard gate ─────────────────────────────────────────────────────────────
    enabled: authReady && isAuthenticated && !!activeWorkspaceId,
  });
};
