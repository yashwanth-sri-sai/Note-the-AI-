import React, { useState, useEffect } from "react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { LoadingContext } from "./LoadingContext";

interface LoadingProviderProps {
  children: React.ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isAppLoading, setIsAppLoading] = useState(true);
  const queryClient = useQueryClient();
  const authReady = useAuthStore((state) => state.authReady);
  const user = useAuthStore((state) => state.user);

  // Monitor active fetches for the ticker or spinner context
  const isFetchingCount = useIsFetching();
  const isInitialLoading = isFetchingCount > 0 && isAppLoading;

  useEffect(() => {
    if (!authReady) {
      setIsAppLoading(true);
      return;
    }

    if (!user) {
      // Guest/landing/login pages don't require workspace startup queries
      setIsAppLoading(false);
      return;
    }

    // Check if critical startup queries are initialized and completed in cache
    const checkInitialQueries = () => {
      const notesStatus = queryClient.getQueryState(["notes"])?.status;
      const foldersStatus = queryClient.getQueryState(["folders"])?.status;
      const tagsStatus = queryClient.getQueryState(["tags"])?.status;

      const notesDone = notesStatus === "success" || notesStatus === "error";
      const foldersDone = foldersStatus === "success" || foldersStatus === "error";
      const tagsDone = tagsStatus === "success" || tagsStatus === "error";

      if (notesDone && foldersDone && tagsDone) {
        // Delay slightly for smooth animations and to avoid UI flicker
        setIsAppLoading(false);
        return true;
      }
      return false;
    };

    // Check immediately on auth success
    if (checkInitialQueries()) return;

    // Set fallback timeout (4 seconds) so the app loader is never permanently stuck 
    // if a startup query fails or hangs indefinitely
    const fallbackTimer = setTimeout(() => {
      setIsAppLoading(false);
    }, 4000);

    // Subscribe to query cache events to detect when initial queries complete
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      if (checkInitialQueries()) {
        clearTimeout(fallbackTimer);
        unsubscribe();
      }
    });

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [authReady, user, queryClient]);

  return (
    <LoadingContext.Provider
      value={{
        isAppLoading,
        setIsAppLoading,
        isInitialLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};
