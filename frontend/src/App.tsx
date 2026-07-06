import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { AppRoutes } from "@/routes/index"; // Points to src/routes/index.tsx
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

import { Loader } from "./components/ui/Loader";

// Global React Query defaults — applied to ALL queries unless overridden.
// These are the safety net for any hook that forgets to set its own options.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is treated as fresh for 5 minutes globally. Hooks that need
      // shorter or longer windows can override per-query.
      staleTime: 5 * 60 * 1000,
      // Keep unused cache entries for 10 minutes before garbage-collecting.
      gcTime: 10 * 60 * 1000,
      // These three are the most common cause of unintentional refetch storms.
      // Every hook we ship explicitly sets these, but the global default is
      // the backstop that protects against new hooks that don't.
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      // Fail fast on auth errors — do not hammer the backend with 3 retries.
      retry: 1,
    },
  },
});

if (typeof window !== "undefined") {
  queryClient.getQueryCache().subscribe((event) => {
    console.log("[FORENSIC QueryCache Event]", {
      type: event.type,
      queryKey: event.query.queryKey,
      state: event.query.state,
      event,
    });
  });
}

function App() {
  const initAuth = useAuthStore((state) => state.initAuth);
  const authReady = useAuthStore((state) => state.authReady);

  // Initialize session verification on boot
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Invalidate only workspace-scoped queries on workspace switch.
  // CRITICAL: The previous queryClient.invalidateQueries() with NO filter
  // blasted the entire cache simultaneously, causing 6+ parallel requests
  // before the new workspace token was attached — all returned 401 and
  // triggered the refresh storm.
  useEffect(() => {
    const handleWorkspaceChanged = () => {
      console.log("[FORENSIC Event] workspace-changed handler fired in App.tsx");
      console.trace("[FORENSIC Trace] workspace-changed invalidate trace:");
      const uiStore = useUIStore.getState();
      uiStore.setActiveNoteId(null);
      uiStore.resetFilters();
      // Invalidate only data that is workspace-scoped.
      // Folders, tags, user profile are NOT workspace-scoped and should
      // NOT be re-fetched on a simple workspace switch.
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["knowledgeSources"] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    };
    window.addEventListener("workspace-changed", handleWorkspaceChanged);
    return () => {
      window.removeEventListener("workspace-changed", handleWorkspaceChanged);
    };
  }, []);

  if (!authReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader size="lg" />
          <p className="text-xs text-muted-foreground animate-pulse mt-2">
            Verifying secure workspace session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RouteErrorBoundary>
        <AppRoutes />
      </RouteErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
