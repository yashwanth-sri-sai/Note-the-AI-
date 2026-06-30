import React, { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { useNotes, useCreateNote } from "@/hooks/useNotes";
import { apiClient } from "@/lib/api-client";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import {
  BrainCircuit, LayoutDashboard, FileText, Folder, Tag, Star, Settings, LogOut,
  Menu, Bell, Search, X, ChevronDown, Sun, Moon, Files, Layers, GraduationCap, BarChart3,
  ChevronRight, Plus, Upload
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
import { getNotePreview } from "@/lib/utils";

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
    isFocusMode,
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

  // Local states for unified search palette
  const [documents, setDocuments] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const { mutateAsync: createNote } = useCreateNote();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: "auto",
        block: "nearest",
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (showSearchModal) {
      setSelectedIndex(0);
      // Pre-fetch fresh source documents and chat history
      apiClient.get("/documents/").then((res) => setDocuments(res.data)).catch((err) => console.error(err));
      apiClient.get("/chat/conversations").then((res) => setConversations(res.data)).catch((err) => console.error(err));
    }
  }, [showSearchModal]);

  const query = searchQuery.trim().toLowerCase();
  
  // Filter Notes, Docs, Folders, Tags, and Conversations
  const searchNotes = query
    ? notes?.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.content.toLowerCase().includes(query)
      ) || []
    : [];

  const searchDocs = query
    ? documents.filter(
        (d) =>
          d.filename.toLowerCase().includes(query) &&
          d.status === "completed"
      )
    : [];

  const searchFolders = query
    ? folders?.filter((f) => f.name.toLowerCase().includes(query)) || []
    : [];

  const searchTags = query
    ? tags?.filter((t) => t.name.toLowerCase().includes(query)) || []
    : [];

  const searchConversations = query
    ? conversations.filter((c) => c.title.toLowerCase().includes(query))
    : [];

  const hasResults = searchNotes.length > 0 || searchDocs.length > 0 || searchFolders.length > 0 || searchTags.length > 0 || searchConversations.length > 0;

  // Quick commands list
  const quickCommands = [
    { id: "create-note", label: "Create New Note", desc: "Create a blank note in active workspace", icon: "Plus", action: "create" },
    { id: "upload-doc", label: "Upload Document", desc: "Add a PDF/DOCX to index for RAG chat", icon: "Upload", action: "documents" },
    { id: "open-chat", label: "Open RAG Chat", desc: "Ask AI questions about documents", icon: "BrainCircuit", action: "chat" },
    { id: "open-settings", label: "Workspace Settings", desc: "Edit account profiles and keys", icon: "Settings", action: "settings" },
    { id: "open-analytics", label: "View Analytics", desc: "Operational performance and token usage", icon: "BarChart3", action: "analytics" },
  ].filter(c => !query || c.label.toLowerCase().includes(query) || c.desc.toLowerCase().includes(query));

  // Flattened items list for keyboard selection
  const flatItems: any[] = [];
  searchNotes.slice(0, 3).forEach((n) => flatItems.push({ type: "note", id: n.id, title: n.title, data: n }));
  searchDocs.slice(0, 3).forEach((d) => flatItems.push({ type: "document", id: d.id, title: d.filename, data: d }));
  searchFolders.slice(0, 3).forEach((f) => flatItems.push({ type: "folder", id: f.id, title: f.name, data: f }));
  searchTags.slice(0, 3).forEach((t) => flatItems.push({ type: "tag", id: t.id, title: t.name, data: t }));
  searchConversations.slice(0, 3).forEach((c) => flatItems.push({ type: "conversation", id: c.id, title: c.title, data: c }));
  quickCommands.forEach((cmd) => flatItems.push({ type: "command", id: cmd.id, title: cmd.label, data: cmd }));

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (flatItems.length > 0 ? (prev + 1) % flatItems.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (flatItems.length > 0 ? (prev - 1 + flatItems.length) % flatItems.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flatItems.length > 0 && flatItems[selectedIndex]) {
        const item = flatItems[selectedIndex];
        if (item.type === "command") {
          handleCommandSelect(item.data);
        } else {
          handleSearchResultClick(item.type, item.id);
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowSearchModal(false);
    }
  };

  const handleCommandSelect = async (cmd: any) => {
    setShowSearchModal(false);
    setSearchQuery("");
    
    if (cmd.action === "create") {
      try {
        const newNote = await createNote({ title: "New Note", content: "" });
        setActiveNoteId(newNote.id);
        setActiveTab("notes");
      } catch (err) {
        alert("Failed to create note.");
      }
    } else {
      setActiveTab(cmd.action);
    }
  };

  const handleSearchResultClick = (type: string, id: string) => {
    setShowSearchModal(false);
    setSearchQuery("");
    
    if (type === "note") {
      setActiveNoteId(id);
      setActiveTab("notes");
    } else if (type === "folder") {
      setActiveFolderId(id);
      setActiveTab("notes");
    } else if (type === "tag") {
      setActiveTagId(id);
      setActiveTab("notes");
    } else if (type === "document") {
      setActiveTab("documents");
    } else if (type === "conversation") {
      setActiveTab("chat");
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const renderSidebar = (collapsed: boolean, isMobileView: boolean = false) => {
    const sidebarItems = [
      { id: "overview", label: "Overview", icon: LayoutDashboard, color: "text-primary" },
      { id: "notes", label: "All Notes", icon: FileText, color: "text-amber", resetFilters: true },
      { id: "chat", label: "AI Chat", icon: BrainCircuit, color: "text-primary" },
      { id: "documents", label: "Documents", icon: Files, color: "text-emerald" },
      { id: "flashcards", label: "Flashcards", icon: Layers, color: "text-violet" },
      { id: "quizzes", label: "Quizzes", icon: GraduationCap, color: "text-rose" },
      { id: "analytics", label: "Analytics", icon: BarChart3, color: "text-cyan" },
    ];

    const isItemActive = (item: any) => {
      if (item.id === "notes") {
        return activeTab === "notes" && !activeFolderId && !activeTagId;
      }
      return activeTab === item.id;
    };

    return (
      <div className="flex flex-col justify-between h-full bg-sidebar">
        <div className="flex flex-col overflow-y-auto max-h-[calc(100vh-6rem)] flex-grow scrollbar">
          {/* Logo Brand */}
          <div className="h-16 flex items-center px-4.5 gap-3 border-b border-border/30 shrink-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-md shadow-primary/20 shrink-0 animate-pulse">
              <BrainCircuit className="h-5 w-5" />
            </span>
            {(!collapsed || isMobileView) && (
              <span className="font-extrabold text-xs tracking-wider uppercase text-foreground/90">
                NoteAI Workspace
              </span>
            )}
          </div>

          {/* Workspace Switcher */}
          {(!collapsed || isMobileView) && (
            <div className="p-3 border-b border-border/30 shrink-0">
              <WorkspaceSwitcher />
            </div>
          )}

          {/* Nav Items */}
          <nav className="p-3 space-y-1 flex-grow">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = isItemActive(item);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    if (item.resetFilters) {
                      setActiveFolderId(null);
                      setActiveTagId(null);
                    }
                    if (isMobileView) setMobileSidebarOpen(false);
                  }}
                  className={`relative flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-200 group ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 bg-primary/10 rounded-xl border-l-2 border-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-3 w-full">
                    <Icon className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-110 duration-200 ${isActive ? "text-primary" : item.color}`} />
                    {(!collapsed || isMobileView) && <span>{item.label}</span>}
                  </span>
                </button>
              );
            })}

            {/* Folders Accordion */}
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  if (collapsed && !isMobileView) {
                    setActiveTab("folders");
                  } else {
                    setExpandFolders(!expandFolders);
                  }
                }}
                className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold rounded-xl text-muted-foreground hover:bg-muted/10 hover:text-foreground transition-all duration-200`}
              >
                <span className="flex items-center gap-3">
                  <Folder className="h-4 w-4 shrink-0 text-primary" />
                  {(!collapsed || isMobileView) && <span>Folders</span>}
                </span>
                {(!collapsed || isMobileView) && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 shrink-0 ${
                      expandFolders ? "" : "-rotate-90"
                    }`}
                  />
                )}
              </button>
              {(!collapsed || isMobileView) && expandFolders && (
                <div className="pl-6 pr-2 py-0.5 space-y-0.5">
                  {folders?.slice(0, 4).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setActiveFolderId(f.id);
                        if (isMobileView) setMobileSidebarOpen(false);
                      }}
                      className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[11px] font-semibold rounded-lg truncate hover:text-primary transition-colors ${
                        activeFolderId === f.id ? "text-primary bg-primary/5 font-bold" : "text-muted-foreground"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/80 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setActiveTab("folders");
                      if (isMobileView) setMobileSidebarOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[10px] text-primary hover:underline font-bold"
                  >
                    View All Folders...
                  </button>
                </div>
              )}
            </div>

            {/* Favorites */}
            <button
              onClick={() => {
                setActiveTab("favorites");
                if (isMobileView) setMobileSidebarOpen(false);
              }}
              className={`relative flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-200 group ${
                activeTab === "favorites"
                  ? "text-amber"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
              }`}
            >
              {activeTab === "favorites" && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-primary/10 rounded-xl border-l-2 border-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3 w-full">
                <Star className="h-4 w-4 shrink-0 text-amber" />
                {(!collapsed || isMobileView) && <span>Favorites</span>}
              </span>
            </button>

            {/* Tags Accordion */}
            <div className="space-y-0.5">
              <button
                onClick={() => {
                  if (collapsed && !isMobileView) {
                    setActiveTab("tags");
                  } else {
                    setExpandTags(!expandTags);
                  }
                }}
                className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/10 hover:text-foreground rounded-xl transition-all duration-200"
              >
                <span className="flex items-center gap-3">
                  <Tag className="h-4 w-4 shrink-0 text-violet" />
                  {(!collapsed || isMobileView) && <span>Tags</span>}
                </span>
                {(!collapsed || isMobileView) && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 shrink-0 ${
                      expandTags ? "" : "-rotate-90"
                    }`}
                  />
                )}
              </button>
              {(!collapsed || isMobileView) && expandTags && (
                <div className="pl-6 pr-2 py-0.5 space-y-0.5">
                  {tags?.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTagId(t.id);
                        if (isMobileView) setMobileSidebarOpen(false);
                      }}
                      className={`flex items-center gap-2.5 w-full text-left px-2.5 py-1.5 text-[11px] font-semibold rounded-lg truncate hover:text-primary transition-colors ${
                        activeTagId === t.id ? "text-primary bg-primary/5 font-bold" : "text-muted-foreground"
                      }`}
                    >
                      <span
                        style={{ backgroundColor: t.color }}
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                      />
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setActiveTab("tags");
                      if (isMobileView) setMobileSidebarOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-[10px] text-primary hover:underline font-bold"
                  >
                    Manage Tags...
                  </button>
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              onClick={() => {
                setActiveTab("settings");
                if (isMobileView) setMobileSidebarOpen(false);
              }}
              className={`relative flex items-center gap-3 w-full px-3 py-2 text-xs font-semibold rounded-xl transition-all duration-200 group ${
                activeTab === "settings"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/10"
              }`}
            >
              {activeTab === "settings" && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 bg-primary/10 rounded-xl border-l-2 border-primary"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3 w-full">
                <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(!collapsed || isMobileView) && <span>Settings</span>}
              </span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-border/30 space-y-3 shrink-0 bg-sidebar/50">
          {/* User Profile Card */}
          {(!collapsed || isMobileView) && (
            <div className="p-2.5 rounded-2xl bg-card/45 border border-border/40 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-border/80 flex items-center justify-center bg-muted shrink-0 shadow-inner">
                  {user?.avatar_url ? (
                    <img
                      src={
                        user.avatar_url.startsWith("http")
                          ? user.avatar_url
                          : `${import.meta.env.VITE_API_BASE_URL}${user.avatar_url}`
                      }
                      alt={user.name || "User avatar"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-bold text-primary">
                      {user?.name?.slice(0, 2).toUpperCase() || "US"}
                    </span>
                  )}
                </div>
                <div className="text-left min-w-0">
                  <h4 className="font-bold text-xs truncate text-foreground leading-none">
                    {user?.name || "User"}
                  </h4>
                  <p className="text-[9px] text-muted-foreground truncate mt-0.5 font-medium">
                    {user?.email}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Theme & Log Out */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="flex items-center justify-center rounded-xl hover:bg-muted/40 py-2 border border-border/40 text-muted-foreground hover:text-foreground transition-all duration-200"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-yellow-500 shrink-0" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500 shrink-0" />
              )}
            </button>
            <button
              onClick={handleLogout}
              title="Log Out"
              className="flex items-center justify-center rounded-xl hover:bg-red-500/10 py-2 border border-border/40 text-red-500 transition-colors duration-200"
            >
              <LogOut className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    );
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
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-300 overflow-hidden h-screen w-screen">
      {/* Mobile Drawer Sidebar */}
      <AnimatePresence>
        {isMobile && mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0.05, duration: 0.35 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border/80 flex flex-col justify-between z-50 shadow-2xl"
            >
              {renderSidebar(false, true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar Navigation */}
      {!isMobile && !isFocusMode && (
        <motion.aside
          animate={{ width: sidebarCollapsed ? 64 : 256 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="border-r border-border/80 bg-sidebar flex flex-col justify-between shrink-0 h-screen sticky top-0 overflow-hidden z-30"
        >
          {renderSidebar(sidebarCollapsed, false)}
        </motion.aside>
      )}

      {/* Main Panel Content Area */}
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        {!isFocusMode && (
          <header className="h-16 border-b border-border/80 bg-surface flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (isMobile) {
                    setMobileSidebarOpen(true);
                  } else {
                    toggleSidebar();
                  }
                }}
                className="text-muted-foreground hover:text-foreground p-1 hover:bg-muted/50 rounded-lg transition-colors spring-hover"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Quick Search trigger box */}
              <div
                onClick={() => setShowSearchModal(true)}
                className="relative hidden sm:flex items-center w-64 rounded-xl border border-border bg-background/50 hover:bg-background/80 py-1.5 px-3 cursor-pointer text-muted-foreground select-none transition-colors spring-hover"
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
                className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-muted/50 rounded-xl transition-colors relative spring-hover"
              >
                <Bell className="h-4.5 w-4.5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500"></span>
              </button>

              {/* User Profile dropdown */}
              <div className="relative">
                <div
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 cursor-pointer rounded-xl hover:bg-muted/40 p-1.5 transition-colors spring-hover"
                >
                  <div className="h-8 w-8 rounded-full overflow-hidden border border-border flex items-center justify-center bg-muted shrink-0">
                    {user?.avatar_url ? (
                      <img
                        src={
                          user.avatar_url.startsWith("http")
                            ? user.avatar_url
                            : `${import.meta.env.VITE_API_BASE_URL}${user.avatar_url}`
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
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0 animate-pulse" />
                </div>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-1.5 w-48 rounded-xl border border-border bg-card shadow-lg p-1.5 z-20 space-y-0.5"
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>
        )}

        {/* Dashboard Panels Scroll Frame */}
        <main className="flex-grow p-6 overflow-y-auto scrollbar bg-background">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (activeFolderId || "") + (activeTagId || "")}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="w-full h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Spotlight Search Modal (Ctrl+K) */}
      <AnimatePresence>
        {showSearchModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 backdrop-blur-sm p-4 pt-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl clay-panel p-4 shadow-2xl space-y-3 bg-card"
            >
              <div className="relative flex items-center border-b border-border/50 pb-2">
                <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleModalKeyDown}
                  placeholder="Type note title or text to search..."
                  className="bg-transparent border-none text-sm outline-none flex-grow placeholder:text-muted-foreground/60 focus:ring-0 w-full text-foreground"
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

              <div className="max-h-[360px] overflow-y-auto space-y-4 scrollbar text-left p-1.5">
                {/* 1. Grouped Search Results */}
                {searchQuery.trim() && (
                  <div className="space-y-3.5">
                    {/* Notes category */}
                    {searchNotes.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground/60 px-2.5">
                          Notes ({searchNotes.length})
                        </p>
                        {searchNotes.slice(0, 3).map((note, index) => {
                          const flatIndex = index;
                          const isSelected = flatIndex === selectedIndex;
                          return (
                            <div
                              key={note.id}
                              ref={isSelected ? selectedRef : undefined}
                              onClick={() => handleSearchResultClick("note", note.id)}
                              className={`p-2.5 rounded-xl cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-bold ${
                                isSelected ? "bg-muted/80 pl-3.5 border-l-2 border-primary" : "hover:bg-muted/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground">ðŸ“</span>
                                  <h4 className="truncate text-foreground font-bold">{note.title || "Untitled Note"}</h4>
                                </span>
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5 pl-6 font-medium">
                                  {getNotePreview(note.content, 90) || "Empty content..."}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Documents category */}
                    {searchDocs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground/60 px-2.5">
                          Documents ({searchDocs.length})
                        </p>
                        {searchDocs.slice(0, 3).map((doc, index) => {
                          const flatIndex = searchNotes.slice(0, 3).length + index;
                          const isSelected = flatIndex === selectedIndex;
                          return (
                            <div
                              key={doc.id}
                              ref={isSelected ? selectedRef : undefined}
                              onClick={() => handleSearchResultClick("document", doc.id)}
                              className={`p-2.5 rounded-xl cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-bold ${
                                isSelected ? "bg-muted/80 pl-3.5 border-l-2 border-primary" : "hover:bg-muted/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground">ðŸ“„</span>
                                  <h4 className="truncate text-foreground font-bold">{doc.filename}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Folders category */}
                    {searchFolders.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground/60 px-2.5">
                          Folders ({searchFolders.length})
                        </p>
                        {searchFolders.slice(0, 3).map((folder, index) => {
                          const flatIndex = searchNotes.slice(0, 3).length + searchDocs.slice(0, 3).length + index;
                          const isSelected = flatIndex === selectedIndex;
                          return (
                            <div
                              key={folder.id}
                              ref={isSelected ? selectedRef : undefined}
                              onClick={() => handleSearchResultClick("folder", folder.id)}
                              className={`p-2.5 rounded-xl cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-bold ${
                                isSelected ? "bg-muted/80 pl-3.5 border-l-2 border-primary" : "hover:bg-muted/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground">ðŸ“</span>
                                  <h4 className="truncate text-foreground font-bold">{folder.name}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Tags category */}
                    {searchTags.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground/60 px-2.5">
                          Tags ({searchTags.length})
                        </p>
                        {searchTags.slice(0, 3).map((tag, index) => {
                          const flatIndex = searchNotes.slice(0, 3).length + searchDocs.slice(0, 3).length + searchFolders.slice(0, 3).length + index;
                          const isSelected = flatIndex === selectedIndex;
                          return (
                            <div
                              key={tag.id}
                              ref={isSelected ? selectedRef : undefined}
                              onClick={() => handleSearchResultClick("tag", tag.id)}
                              className={`p-2.5 rounded-xl cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-bold ${
                                isSelected ? "bg-muted/80 pl-3.5 border-l-2 border-primary" : "hover:bg-muted/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground">ðŸ·ï¸</span>
                                  <h4 className="truncate text-foreground font-bold">{tag.name}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Chat Conversations category */}
                    {searchConversations.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground/60 px-2.5">
                          Chats ({searchConversations.length})
                        </p>
                        {searchConversations.slice(0, 3).map((conv, index) => {
                          const flatIndex = searchNotes.slice(0, 3).length + searchDocs.slice(0, 3).length + searchFolders.slice(0, 3).length + searchTags.slice(0, 3).length + index;
                          const isSelected = flatIndex === selectedIndex;
                          return (
                            <div
                              key={conv.id}
                              ref={isSelected ? selectedRef : undefined}
                              onClick={() => handleSearchResultClick("conversation", conv.id)}
                              className={`p-2.5 rounded-xl cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-bold ${
                                isSelected ? "bg-muted/80 pl-3.5 border-l-2 border-primary" : "hover:bg-muted/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground">ðŸ’¬</span>
                                  <h4 className="truncate text-foreground font-bold">{conv.title}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Commands list */}
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-wider font-extrabold text-muted-foreground/60 px-2.5">
                    Quick Commands
                  </p>
                  {quickCommands.map((cmd, index) => {
                    const flatIndex =
                      (searchQuery.trim() ? searchNotes.slice(0, 3).length + searchDocs.slice(0, 3).length + searchFolders.slice(0, 3).length + searchTags.slice(0, 3).length + searchConversations.slice(0, 3).length : 0) +
                      index;
                    const isSelected = flatIndex === selectedIndex;

                    const getIcon = (iconName: string) => {
                      switch (iconName) {
                        case "Plus": return <Plus className="h-4 w-4 text-primary shrink-0" />;
                        case "Upload": return <Upload className="h-4 w-4 text-emerald shrink-0" />;
                        case "BrainCircuit": return <BrainCircuit className="h-4 w-4 text-primary shrink-0" />;
                        case "Settings": return <Settings className="h-4 w-4 text-muted-foreground shrink-0" />;
                        case "BarChart3": return <BarChart3 className="h-4 w-4 text-cyan shrink-0" />;
                        default: return <Plus className="h-4 w-4 shrink-0" />;
                      }
                    };
                    return (
                      <div
                        key={cmd.id}
                        ref={isSelected ? selectedRef : undefined}
                        onClick={() => handleCommandSelect(cmd)}
                        className={`p-2.5 rounded-xl cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-bold ${
                          isSelected ? "bg-muted/80 pl-3.5 border-l-2 border-primary translate-x-0.5" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-grow text-left">
                          <span className="p-1.5 rounded-lg bg-muted shrink-0 shadow-inner">
                            {getIcon(cmd.icon)}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-foreground font-bold">{cmd.label}</h4>
                            <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 truncate">{cmd.desc}</p>
                          </div>
                        </div>
                        <span className="text-[9px] text-muted-foreground/60 font-semibold bg-muted px-1.5 py-0.5 rounded border border-border/30 shadow-sm shrink-0">
                          â†µ Run
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Navigation help footer */}
              <div className="flex justify-between items-center border-t border-border/30 pt-2 px-1 text-[10px] text-muted-foreground/80 font-bold shrink-0">
                <span>Use <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/30">â†‘â†“</kbd> to navigate, <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/30">Enter</kbd> to select</span>
                <span><kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/30">Esc</kbd> to close</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
