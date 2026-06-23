import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { AppRoutes } from "@/routes/index"; // Points to src/routes/index.tsx

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

  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}

export default App;
