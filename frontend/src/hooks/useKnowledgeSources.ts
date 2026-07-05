import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { KnowledgeSource } from "@/types";
import { useAuthStore } from "@/store/auth-store";

export const useKnowledgeSources = (options: { includeProcessing?: boolean } = {}) => {
  const includeProcessing = options.includeProcessing ?? true;
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  return useQuery<KnowledgeSource[]>({
    queryKey: ["knowledgeSources", { includeProcessing }],
    queryFn: async () => {
      const response = await apiClient.get("/knowledge/sources", {
        params: { include_processing: includeProcessing },
      });
      return response.data;
    },
    // Poll the status of processing sources every 3 seconds if any are pending/processing
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
    enabled: isAuthenticated,
  });
};
