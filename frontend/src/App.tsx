import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { AppRoutes } from "@/routes/index"; // Points to src/routes/index.tsx
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

// Create TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent distracting refetches on window focus
      retry: 1, // Only retry failed requests once
      staleTime: 5 * 60 * 1000, // Cache results for 5 minutes
    },
  },
});

function App() {
  const initAuth = useAuthStore((state) => state.initAuth);
  const authReady = useAuthStore((state) => state.authReady);

  // Initialize session verification on boot
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Invalidate queries when workspace changes
  useEffect(() => {
    const handleWorkspaceChanged = () => {
      // Reset active filters and active note on workspace switch first
      const uiStore = useUIStore.getState();
      uiStore.setActiveNoteId(null);
      uiStore.resetFilters();
      // Invalidate queries to trigger refetching with the new workspace context
      queryClient.invalidateQueries();
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-xs text-muted-foreground animate-pulse">
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
