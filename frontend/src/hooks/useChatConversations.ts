import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stable query key factory
// All consumers must use this — never construct the key ad-hoc.
// ─────────────────────────────────────────────────────────────────────────────

export const chatKeys = {
  /** Root key for all chat queries */
  all: ["chat-conversations"] as const,
  /** Workspace-scoped list — safe primitive, no object spreading */
  list: (workspaceId: string) =>
    ["chat-conversations", workspaceId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// useChatConversations — single source of truth for the conversations list
// ─────────────────────────────────────────────────────────────────────────────

export const useChatConversations = () => {
  // Use authReady (set-once, never reset) as the gate — NOT isAuthenticated
  // which toggles during login/logout cycles and re-enables the query
  // unexpectedly, causing bursts of parallel requests.
  const authReady = useAuthStore((state) => state.authReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { activeWorkspaceId } = useWorkspaceStore();

  return useQuery<ConversationItem[]>({
    // Workspace-scoped so switching workspaces isolates cache entries.
    // String() ensures the key is always a primitive even if the store
    // returns null/undefined transiently — prevents unstable key objects.
    queryKey: chatKeys.list(String(activeWorkspaceId)),

    queryFn: async () => {
      const response = await apiClient.get("/chat/conversations");
      return response.data;
    },

    // ── Cache tunables ───────────────────────────────────────────────────────
    // staleTime: treat data as fresh for 5 min — zero staleTime (default)
    // meant every mount/focus issued a new network call.
    staleTime: 5 * 60 * 1000,   // 5 minutes
    gcTime:   10 * 60 * 1000,   // 10 minutes

    // ── Re-fetch guards ──────────────────────────────────────────────────────
    // These were the primary loop triggers: every tab-focus and DashboardV2
    // tab-switch remount fired a fresh request with the default (true) values.
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,

    // ── No background polling ────────────────────────────────────────────────
    // Conversations do not change server-side without user action. New
    // conversations are prepended optimistically via the mutation below.
    refetchInterval: false,

    // ── Retry ────────────────────────────────────────────────────────────────
    retry: 1,

    // ── Hard gate ────────────────────────────────────────────────────────────
    // Do not fire until auth is fully resolved AND workspace is available.
    enabled: authReady && isAuthenticated && !!activeWorkspaceId,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// useCreateConversation — optimistic insert, no list refetch needed
// ─────────────────────────────────────────────────────────────────────────────

export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (title: string) => {
      const response = await apiClient.post("/chat/conversations", { title });
      return response.data as ConversationItem;
    },
    onSuccess: (newConv) => {
      // Prepend optimistically instead of invalidating the full list —
      // invalidation would trigger another GET /chat/conversations request
      // and is the classic "cache invalidation loop" anti-pattern here.
      queryClient.setQueryData<ConversationItem[]>(
        chatKeys.list(String(activeWorkspaceId)),
        (prev = []) => [newConv, ...prev]
      );
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// useDeleteConversation
// ─────────────────────────────────────────────────────────────────────────────

export const useDeleteConversation = () => {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspaceStore();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/chat/conversations/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      // Remove from cache directly — again avoids a full-list refetch.
      queryClient.setQueryData<ConversationItem[]>(
        chatKeys.list(String(activeWorkspaceId)),
        (prev = []) => prev.filter((c) => c.id !== deletedId)
      );
    },
  });
};
