import { create } from "zustand";

type DashboardTab =
  | "overview"
  | "notes"
  | "folders"
  | "favorites"
  | "tags"
  | "chat"
  | "documents"
  | "flashcards"
  | "quizzes"
  | "analytics"
  | "settings";

interface UIState {
  theme: "light" | "dark";
  sidebarCollapsed: boolean;
  activeTab: DashboardTab;
  activeFolderId: string | null;
  activeTagId: string | null;
  activeNoteId: string | null;

  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveTab: (tab: DashboardTab) => void;
  setActiveFolderId: (id: string | null) => void;
  setActiveTagId: (id: string | null) => void;
  setActiveNoteId: (id: string | null) => void;
  resetFilters: () => void;
}

export const useUIStore = create<UIState>((set) => {
  // Read initial theme from localStorage or system preference
  const getInitialTheme = (): "light" | "dark" => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const initialTheme = getInitialTheme();
  // Apply class on load
  if (initialTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }

  return {
    theme: initialTheme,
    sidebarCollapsed: false,
    activeTab: "overview",
    activeFolderId: null,
    activeTagId: null,
    activeNoteId: null,

    toggleTheme: () =>
      set((state) => {
        const nextTheme = state.theme === "light" ? "dark" : "light";
        localStorage.setItem("theme", nextTheme);
        if (nextTheme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        return { theme: nextTheme };
      }),

    setTheme: (theme) =>
      set(() => {
        localStorage.setItem("theme", theme);
        if (theme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
        return { theme };
      }),

    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

    setActiveTab: (tab) =>
      set(() => {
        // Clear active note or filter when switching tab to keep state clean
        const updates: Partial<UIState> = { activeTab: tab };
        if (tab !== "notes") {
          updates.activeNoteId = null;
        }
        return updates;
      }),

    setActiveFolderId: (id) =>
      set({ activeFolderId: id, activeTagId: null, activeTab: "notes" }), // Filter notes by folder and switch to notes view

    setActiveTagId: (id) =>
      set({ activeTagId: id, activeFolderId: null, activeTab: "notes" }), // Filter notes by tag and switch to notes view

    setActiveNoteId: (id) => set({ activeNoteId: id, activeTab: "notes" }),

    resetFilters: () => set({ activeFolderId: null, activeTagId: null }),
  };
});
