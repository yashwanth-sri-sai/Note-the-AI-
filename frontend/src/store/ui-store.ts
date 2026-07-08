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
  | "settings"
  | "evaluation";

interface UIState {
  theme: "light" | "dark" | "system";
  sidebarCollapsed: boolean;
  activeTab: DashboardTab;
  activeFolderId: string | null;
  activeTagId: string | null;
  activeNoteId: string | null;
  pendingAIQuery: string | null;
  isFocusMode: boolean;
  aiPanelOpen: boolean;

  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleFocusMode: () => void;
  setFocusMode: (focused: boolean) => void;
  setActiveTab: (tab: DashboardTab) => void;
  setActiveFolderId: (id: string | null) => void;
  setActiveTagId: (id: string | null) => void;
  setActiveNoteId: (id: string | null) => void;
  setPendingAIQuery: (query: string | null) => void;
  resetFilters: () => void;
  toggleAIPanel: () => void;
  setAIPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => {
  // Read initial theme from localStorage or system preference
  const getInitialTheme = (): "light" | "dark" | "system" => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
    return "system";
  };

  const initialTheme = getInitialTheme();
  
  const applyThemeClass = (themeMode: "light" | "dark" | "system") => {
    if (typeof window === "undefined") return;
    let isDark = false;
    if (themeMode === "system") {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    } else {
      isDark = themeMode === "dark";
    }

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Apply theme on load
  applyThemeClass(initialTheme);

  // Set up listener for system color scheme updates
  if (typeof window !== "undefined") {
    const darkMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    darkMediaQuery.addEventListener("change", () => {
      const currentTheme = localStorage.getItem("theme") || "system";
      if (currentTheme === "system") {
        applyThemeClass("system");
      }
    });
  }

  return {
    theme: initialTheme,
    sidebarCollapsed: false,
    activeTab: "overview",
    activeFolderId: null,
    activeTagId: null,
    activeNoteId: null,
    pendingAIQuery: null,
    isFocusMode: false,
    aiPanelOpen: false,

    toggleTheme: () =>
      set((state) => {
        const cycle: Record<"light" | "dark" | "system", "light" | "dark" | "system"> = {
          light: "dark",
          dark: "system",
          system: "light",
        };
        const nextTheme = cycle[state.theme];
        localStorage.setItem("theme", nextTheme);
        applyThemeClass(nextTheme);
        return { theme: nextTheme };
      }),

    setTheme: (theme) =>
      set(() => {
        localStorage.setItem("theme", theme);
        applyThemeClass(theme);
        return { theme };
      }),

    toggleSidebar: () =>
      set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

    toggleFocusMode: () => set((state) => ({ isFocusMode: !state.isFocusMode })),

    setFocusMode: (focused) => set({ isFocusMode: focused }),

    setActiveTab: (tab) =>
      set((state) => {
        console.log("[FORENSIC Event] setActiveTab called.", { oldTab: state.activeTab, newTab: tab });
        console.trace("[FORENSIC Trace] setActiveTab call stack:");
        // Clear active note or filter when switching tab to keep state clean, EXCEPT for tabs that reference active note
        const updates: Partial<UIState> = { activeTab: tab };
        if (tab !== "notes" && tab !== "flashcards" && tab !== "quizzes" && tab !== "chat") {
          updates.activeNoteId = null;
        }
        return updates;
      }),

    setActiveFolderId: (id) =>
      set({ activeFolderId: id, activeTagId: null, activeTab: "notes" }), // Filter notes by folder and switch to notes view

    setActiveTagId: (id) =>
      set({ activeTagId: id, activeFolderId: null, activeTab: "notes" }), // Filter notes by tag and switch to notes view

    setActiveNoteId: (id) => set({ activeNoteId: id, activeTab: "notes" }),

    setPendingAIQuery: (query) => set({ pendingAIQuery: query }),

    resetFilters: () => set({ activeFolderId: null, activeTagId: null }),

    toggleAIPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),

    setAIPanelOpen: (open) => set({ aiPanelOpen: open }),
  };
});
