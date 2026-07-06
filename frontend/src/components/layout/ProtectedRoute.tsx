import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";

import { Loader } from "../ui/Loader";

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, authReady } = useAuthStore();

  if (!authReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader size="lg" />
          <p className="text-xs text-muted-foreground animate-pulse mt-2">
            Verifying workspace access...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
