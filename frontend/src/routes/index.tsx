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

// Child views of the Dashboard panel layout (lazy-loaded for premium bundle footprint efficiency)
const DashboardOverview = React.lazy(() => import("@/pages/dashboard/DashboardOverview").then(m => ({ default: m.DashboardOverview })));
const NotesPage = React.lazy(() => import("@/pages/dashboard/NotesPage").then(m => ({ default: m.NotesPage })));
const FoldersPage = React.lazy(() => import("@/pages/dashboard/FoldersPage").then(m => ({ default: m.FoldersPage })));
const FavoritesPage = React.lazy(() => import("@/pages/dashboard/FavoritesPage").then(m => ({ default: m.FavoritesPage })));
const TagsPage = React.lazy(() => import("@/pages/dashboard/TagsPage").then(m => ({ default: m.TagsPage })));
const NotebookLMChat = React.lazy(() => import("@/pages/dashboard/NotebookLMChat").then(m => ({ default: m.NotebookLMChat })));
const DocumentsPage = React.lazy(() => import("@/pages/dashboard/DocumentsPage").then(m => ({ default: m.DocumentsPage })));
const FlashcardsPage = React.lazy(() => import("@/pages/dashboard/FlashcardsPage").then(m => ({ default: m.FlashcardsPage })));
const QuizzesPage = React.lazy(() => import("@/pages/dashboard/QuizzesPage").then(m => ({ default: m.QuizzesPage })));
const AnalyticsPage = React.lazy(() => import("@/pages/dashboard/AnalyticsPage").then(m => ({ default: m.AnalyticsPage })));
const EvaluationDashboardV2 = React.lazy(() => import("@/pages/dashboard/EvaluationDashboardV2").then(m => ({ default: m.EvaluationDashboardV2 })));
const SettingsPage = React.lazy(() => import("@/pages/dashboard/SettingsPage").then(m => ({ default: m.SettingsPage })));


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
