import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { PublicRoute } from "@/components/layout/PublicRoute";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AppLayout } from "@/components/layout/AppLayout";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import { LandingPage } from "@/pages/LandingPage";
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { ForgotPassword } from "@/pages/auth/ForgotPassword";
import { ResetPassword } from "@/pages/auth/ResetPassword";
import { NotFound } from "@/pages/NotFound";

// Child views of the Dashboard panel layout
import { DashboardOverview } from "@/pages/dashboard/DashboardOverview";
import { NotesPage } from "@/pages/dashboard/NotesPage";
import { FoldersPage } from "@/pages/dashboard/FoldersPage";
import { FavoritesPage } from "@/pages/dashboard/FavoritesPage";
import { TagsPage } from "@/pages/dashboard/TagsPage";
import { NotebookLMChat } from "@/pages/dashboard/NotebookLMChat";
import { DocumentsPage } from "@/pages/dashboard/DocumentsPage";
import { FlashcardsPage } from "@/pages/dashboard/FlashcardsPage";
import { QuizzesPage } from "@/pages/dashboard/QuizzesPage";
import { AnalyticsPage } from "@/pages/dashboard/AnalyticsPage";
import { EvaluationDashboardV2 } from "@/pages/dashboard/EvaluationDashboardV2";
import { SettingsPage } from "@/pages/dashboard/SettingsPage";

export const AppRoutes: React.FC = () => {
  const basename = import.meta.env.VITE_BASE_PATH || "/";

  return (
    <BrowserRouter basename={basename === "/" ? undefined : basename}>
      <Routes>
        {/* Public Landing View */}
        <Route path="/" element={<LandingPage />} />

        {/* Guest Auth Layout */}
        <Route element={<PublicRoute><AuthLayout /></PublicRoute>}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/signup" element={<Navigate to="/register" replace />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>

        {/* Private Dashboard panel Layout */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RouteErrorBoundary>
                <AppLayout />
              </RouteErrorBoundary>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard/overview" replace />} />
          <Route path="overview" element={<DashboardOverview />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="folders" element={<FoldersPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="chat" element={<NotebookLMChat />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="flashcards" element={<FlashcardsPage />} />
          <Route path="quizzes" element={<QuizzesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="evaluation" element={<EvaluationDashboardV2 />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Dedicated root routes for shortcut deep links with redirect handlers */}
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="/chat" element={<Navigate to="/dashboard/chat" replace />} />
        <Route path="/evaluation" element={<Navigate to="/dashboard/evaluation" replace />} />

        {/* Catch-all 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};
