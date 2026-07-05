import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Note } from "@/types";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

interface NotesFilters {
  folderId?: string | null;
  tagId?: string | null;
  isFavorite?: boolean | null;
}

export const useNotes = (filters: NotesFilters = {}) => {
  // Gate on authReady (set-once signal) rather than isAuthenticated.
  // isAuthenticated briefly toggles false during the 401→refresh→retry cycle,
  // which disabled and then re-enabled this query — causing a fresh network
  // request every time a token refresh happened.
  const authReady = useAuthStore((state) => state.authReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { activeWorkspaceId } = useWorkspaceStore();

  // Stable primitive key — spreading filter values prevents the query key
  // from changing identity every render when the filters object is recreated
  // inline (e.g. useNotes({}) on every component render).
  const queryKey = [
    "notes",
    String(activeWorkspaceId),
    filters.folderId ?? null,
    filters.tagId ?? null,
    filters.isFavorite ?? null,
  ] as const;

  return useQuery<Note[]>({
    queryKey,
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
    enabled: authReady && isAuthenticated && !!activeWorkspaceId,
  });
};

export const useNote = (id: string | null) => {
  const authReady = useAuthStore((state) => state.authReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery<Note>({
    queryKey: ["notes", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get(`/notes/${id}`);
      return response.data;
    },
    enabled: authReady && isAuthenticated && !!id,
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
