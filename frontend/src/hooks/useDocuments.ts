import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

export interface DocumentItem {
  id: string;
  filename: string;
  file_size: number;
  content_type: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

export const useDocuments = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery<DocumentItem[]>({
    queryKey: ["documents"],
    queryFn: async () => {
      const response = await apiClient.get("/documents/");
      return response.data;
    },
    // Poll the status of processing documents every 3 seconds
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.some((doc) => doc.status === "pending" || doc.status === "processing")) {
        return 3000;
      }
      return false;
    },
    enabled: isAuthenticated,
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post("/documents/upload", formData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/documents/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
    },
  });
};
