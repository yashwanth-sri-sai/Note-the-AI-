import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { useNotes } from "@/hooks/useNotes";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import {
  BrainCircuit, LayoutDashboard, FileText, Folder, Tag, Star, Settings, LogOut,
  Menu, Bell, Search, X, ChevronDown, Sun, Moon, ArrowRight, Files, Layers, GraduationCap, BarChart3
} from "lucide-react";
import { DashboardOverview } from "./DashboardOverview";
import { NotesPage } from "./NotesPage";
import { FoldersPage } from "./FoldersPage";
import { FavoritesPage } from "./FavoritesPage";
import { TagsPage } from "./TagsPage";
import { SettingsPage } from "./SettingsPage";
import { NotebookLMChat } from "./NotebookLMChat";
import { DocumentsPage } from "./DocumentsPage";
import { FlashcardsPage } from "./FlashcardsPage";
import { QuizzesPage } from "./QuizzesPage";
import { AnalyticsPage } from "./AnalyticsPage";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";

export const Dashboard: React.FC = () => {
  const { user, logout } = useAuthStore();
  const {
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    toggleSidebar,
    theme,
    toggleTheme,
    activeFolderId,
    setActiveFolderId,
    activeTagId,
    setActiveTagId,
    setActiveNoteId,
  } = useUIStore();

  // Queries
  const { data: notes } = useNotes();
  const { data: folders } = useFolders();
  const { data: tags } = useTags();

  // Local UI States
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandFolders, setExpandFolders] = useState(true);
  const [expandTags, setExpandTags] = useState(true);

  // Spotlight search keyboard listener (Ctrl + K / Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSelect = (noteId: string) => {
    setActiveNoteId(noteId);
    setActiveTab("notes");
    setSearchQuery("");
    setShowSearchModal(false);
  };

  // Filter notes inside Spotlight Modal
  const spotlightResults = searchQuery.trim()
    ? notes?.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.content.toLowerCase().includes(searchQuery.toLowerCase())
      ) || []
    : [];

  const handleLogout = async () => {
    await logout();
  };

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return <DashboardOverview />;
      case "notes":
        return <NotesPage />;
      case "folders":
        return <FoldersPage />;
      case "favorites":
        return <FavoritesPage />;
      case "tags":
        return <TagsPage />;
      case "chat":
        return <NotebookLMChat />;
      case "documents":
        return <DocumentsPage />;
      case "flashcards":
        return <FlashcardsPage />;
      case "quizzes":
        return <QuizzesPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-300">
      {/* Sidebar Navigation */}
      <aside
        className={`border-r border-border/80 bg-card/40 backdrop-blur-md flex flex-col justify-between transition-all duration-300 z-30 shrink-0 ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex flex-col overflow-y-auto max-h-[calc(100vh-4rem)]">
          {/* Logo Brand */}
          <div className="h-16 flex items-center px-4 gap-2.5 border-b border-border/40 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-md shadow-primary/20 shrink-0">
              <BrainCircuit className="h-5 w-5" />
            </span>
            {!sidebarCollapsed && (
              <span className="font-extrabold text-sm bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                NoteAI Workspace
              </span>
            )}
          </div>

          {/* Workspace Switcher */}
          {!sidebarCollapsed && (
            <div className="p-3 border-b border-border/40 shrink-0">
              <WorkspaceSwitcher />
            </div>
          )}

          {/* Nav Items */}
          <nav className="p-3 space-y-1.5 flex-grow">
            {/* Overview */}
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === "overview"
                  ? "bg-primary text-white shadow shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && "Overview"}
            </button>

            {/* Notes */}
            <button
              onClick={() => {
                setActiveTab("notes");
                setActiveFolderId(null);
                setActiveTagId(null);
              }}
              className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === "notes" && !activeFolderId && !activeTagId
                  ? "bg-primary text-white shadow shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && "All Notes"}
            </button>

            {/* AI Chat */}
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === "chat"
                  ? "bg-primary text-white shadow shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <BrainCircuit className={`h-4 w-4 shrink-0 ${activeTab === "chat" ? "text-white" : "text-indigo-500"}`} />
              {!sidebarCollapsed && "AI Chat"}
            </button>

            {/* Documents */}
            <button
              onClick={() => setActiveTab("documents")}
              className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === "documents"
                  ? "bg-primary text-white shadow shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Files className={`h-4 w-4 shrink-0 ${activeTab === "documents" ? "text-white" : "text-emerald-500"}`} />
              {!sidebarCollapsed && "Documents"}
            </button>

            {/* Flashcards */}
            <button
              onClick={() => setActiveTab("flashcards")}
              className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === "flashcards"
                  ? "bg-primary text-white shadow shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Layers className={`h-4 w-4 shrink-0 ${activeTab === "flashcards" ? "text-white" : "text-amber-500"}`} />
              {!sidebarCollapsed && "Flashcards"}
            </button>

            {/* Quizzes */}
            <button
              onClick={() => setActiveTab("quizzes")}
              className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === "quizzes"
                  ? "bg-primary text-white shadow shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <GraduationCap className={`h-4 w-4 shrink-0 ${activeTab === "quizzes" ? "text-white" : "text-pink-500"}`} />
              {!sidebarCollapsed && "Quizzes"}
            </button>

            {/* Analytics */}
            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === "analytics"
                  ? "bg-primary text-white shadow shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <BarChart3 className={`h-4 w-4 shrink-0 ${activeTab === "analytics" ? "text-white" : "text-cyan-500"}`} />
              {!sidebarCollapsed && "Analytics"}
            </button>

            {/* Folders Accordion */}
            <div>
              <button
                onClick={() => {
                  if (sidebarCollapsed) {
                    setActiveTab("folders");
                  } else {
                    setExpandFolders(!expandFolders);
                  }
                }}
                className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all ${
                  activeTab === "folders" ? "text-primary" : ""
                }`}
              >
                <span className="flex items-center gap-3">
                  <Folder className="h-4 w-4 shrink-0 text-indigo-500" />
                  {!sidebarCollapsed && "Folders"}
                </span>
                {!sidebarCollapsed && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform shrink-0 ${
                      expandFolders ? "" : "-rotate-90"
                    }`}
                  />
                )}
              </button>
              {!sidebarCollapsed && expandFolders && (
                <div className="pl-6 pr-2 py-1 space-y-1">
                  {folders?.slice(0, 4).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFolderId(f.id)}
                      className={`flex items-center gap-2 w-full text-left px-2 py-1 text-[11px] font-medium rounded-lg truncate hover:text-primary transition-colors ${
                        activeFolderId === f.id ? "text-primary bg-primary/5 font-bold" : "text-muted-foreground"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/80 shrink-0"></span>
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setActiveTab("folders")}
                    className="w-full text-left px-2 py-1 text-[10px] text-primary hover:underline font-semibold"
                  >
                    View All Folders...
                  </button>
                </div>
              )}
            </div>

            {/* Favorites */}
            <button
              onClick={() => setActiveTab("favorites")}
              className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === "favorites"
                  ? "bg-primary text-white shadow shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Star className="h-4 w-4 shrink-0 text-yellow-500" />
              {!sidebarCollapsed && "Favorites"}
            </button>

            {/* Tags Accordion */}
            <div>
              <button
                onClick={() => {
                  if (sidebarCollapsed) {
                    setActiveTab("tags");
                  } else {
                    setExpandTags(!expandTags);
                  }
                }}
                className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/40 hover:text-foreground rounded-xl transition-all ${
                  activeTab === "tags" ? "text-primary" : ""
                }`}
              >
                <span className="flex items-center gap-3">
                  <Tag className="h-4 w-4 shrink-0 text-purple-500" />
                  {!sidebarCollapsed && "Tags"}
                </span>
                {!sidebarCollapsed && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform shrink-0 ${
                      expandTags ? "" : "-rotate-90"
                    }`}
                  />
                )}
              </button>
              {!sidebarCollapsed && expandTags && (
                <div className="pl-6 pr-2 py-1 space-y-1">
                  {tags?.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTagId(t.id)}
                      className={`flex items-center gap-2.5 w-full text-left px-2 py-1 text-[11px] font-medium rounded-lg truncate hover:text-primary transition-colors ${
                        activeTagId === t.id ? "text-primary bg-primary/5 font-bold" : "text-muted-foreground"
                      }`}
                    >
                      <span
                        style={{ backgroundColor: t.color }}
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                      ></span>
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => setActiveTab("tags")}
                    className="w-full text-left px-2 py-1 text-[10px] text-primary hover:underline font-semibold"
                  >
                    Manage Tags...
                  </button>
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                activeTab === "settings"
                  ? "bg-primary text-white shadow shadow-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              <Settings className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && "Settings"}
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border/40 space-y-3 shrink-0">
          {/* Light/Dark Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center gap-2.5 w-full rounded-xl hover:bg-muted/40 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-4 w-4 text-yellow-500 shrink-0" />
                {!sidebarCollapsed && "Light Mode"}
              </>
            ) : (
              <>
                <Moon className="h-4 w-4 text-indigo-500 shrink-0" />
                {!sidebarCollapsed && "Dark Mode"}
              </>
            )}
          </button>

          {/* Log Out */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/5 rounded-xl transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && "Log Out"}
          </button>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <div className="flex-grow flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border/80 bg-card/30 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted/50 rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Quick Search trigger box */}
            <div
              onClick={() => setShowSearchModal(true)}
              className="relative hidden sm:flex items-center w-64 rounded-xl border border-border bg-background/50 hover:bg-background/80 py-1.5 px-3 cursor-pointer text-muted-foreground select-none transition-colors"
            >
              <Search className="h-4 w-4 mr-2 text-muted-foreground/80 shrink-0" />
              <span className="text-xs">Search...</span>
              <kbd className="absolute right-3 top-1.5 rounded bg-muted px-1.5 text-[10px] font-mono border border-border shadow-sm">
                Ctrl K
              </kbd>
            </div>
          </div>

          {/* Header Action Items */}
          <div className="flex items-center gap-4 relative">
            {/* Notifications Bell */}
            <button
              onClick={() => alert("Notifications center is empty.")}
              className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted/50 rounded-xl transition-colors relative"
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500"></span>
            </button>

            {/* User Profile dropdown */}
            <div className="relative">
              <div
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2.5 cursor-pointer rounded-xl hover:bg-muted/40 p-1.5 transition-colors"
              >
                <div className="h-8 w-8 rounded-full overflow-hidden border border-border flex items-center justify-center bg-muted shrink-0">
                  {user?.avatar_url ? (
                    <img
                      src={
                        user.avatar_url.startsWith("http")
                          ? user.avatar_url
                          : `http://localhost:8000${user.avatar_url}`
                      }
                      alt={user.name || "User avatar"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-primary">
                      {user?.name?.slice(0, 2).toUpperCase() || "US"}
                    </span>
                  )}
                </div>
                <div className="text-left hidden md:block max-w-[120px] truncate">
                  <h4 className="font-semibold text-xs truncate leading-none">
                    {user?.name || "User"}
                  </h4>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {user?.email}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              </div>

              {showUserMenu && (
                <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border bg-card shadow-lg p-1.5 z-20 space-y-0.5 animate-fadeIn">
                  <button
                    onClick={() => {
                      setActiveTab("settings");
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-muted/50 font-medium flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" /> Account Settings
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-red-500/5 text-red-500 font-medium flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4 text-red-500" /> Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Dashboard Panels Scroll Frame */}
        <main className="flex-grow p-6 overflow-y-auto scrollbar">
          {renderContent()}
        </main>
      </div>

      {/* Spotlight Search Modal (Ctrl+K) */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-20 animate-fadeIn">
          <div className="w-full max-w-xl glass-panel rounded-2xl p-4 shadow-2xl space-y-3 border border-border bg-card">
            <div className="relative flex items-center border-b border-border/50 pb-2">
              <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type note title or text to search..."
                className="bg-transparent border-none text-sm outline-none flex-grow placeholder:text-muted-foreground/60 focus:ring-0 w-full"
              />
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowSearchModal(false);
                }}
                className="text-muted-foreground hover:text-foreground rounded p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 scrollbar text-left">
              {!searchQuery.trim() ? (
                <p className="text-[10px] text-muted-foreground italic text-center py-4">
                  Search through all note databases. Try typing keywords...
                </p>
              ) : spotlightResults.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">
                  No matching notes found.
                </p>
              ) : (
                spotlightResults.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => handleSearchSelect(note.id)}
                    className="p-3 rounded-xl hover:bg-muted/50 cursor-pointer flex justify-between items-center gap-4 transition-colors"
                  >
                    <div className="truncate flex-grow">
                      <h4 className="font-semibold text-xs truncate">
                        {note.title || "Untitled Note"}
                      </h4>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {note.content || "Empty content..."}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
