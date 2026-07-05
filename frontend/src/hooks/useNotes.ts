import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Note } from "@/types";
import { useAuthStore } from "@/store/auth-store";

interface NotesFilters {
  folderId?: string | null;
  tagId?: string | null;
  isFavorite?: boolean | null;
}

export const useNotes = (filters: NotesFilters = {}) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery<Note[]>({
    queryKey: ["notes", filters],
    queryFn: async () => {
      const params: any = {};
      if (filters.folderId) params.folder_id = filters.folderId;
      if (filters.tagId) params.tag_id = filters.tagId;
      if (filters.isFavorite !== undefined && filters.isFavorite !== null) {
        params.is_favorite = filters.isFavorite;
      }

      const response = await apiClient.get("/notes/", { params });
      return response.data;
    },
    enabled: isAuthenticated,
  });
};

export const useNote = (id: string | null) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery<Note>({
    queryKey: ["notes", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get(`/notes/${id}`);
      return response.data;
    },
    enabled: isAuthenticated && !!id,
  });
};

export const useCreateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title?: string;
      content?: string;
      folder_id?: string | null;
      is_favorite?: boolean;
    }) => {
      const response = await apiClient.post("/notes/", data);
      return response.data;
    },
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
      queryClient.setQueryData(["notes", newNote.id], newNote);
    },
  });
};

export const useUpdateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: {
        title?: string;
        content?: string;
        folder_id?: string | null;
        is_favorite?: boolean;
      };
    }) => {
      const response = await apiClient.put(`/notes/${id}`, data);
      return response.data;
    },
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
      queryClient.setQueryData(["notes", updatedNote.id], updatedNote);
    },
  });
};

export const useDeleteNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/notes/${id}`);
      return response.data;
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
      queryClient.removeQueries({ queryKey: ["notes", deletedId] });
    },
  });
};

export const useDuplicateNote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/notes/${id}/duplicate`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
    },
  });
};

export const useSetNoteTags = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tagIds }: { id: string; tagIds: string[] }) => {
      const response = await apiClient.post(`/notes/${id}/tags`, {
        tag_ids: tagIds,
      });
      return response.data;
    },
    onSuccess: (updatedNote) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
      queryClient.setQueryData(["notes", updatedNote.id], updatedNote);
    },
  });
};
