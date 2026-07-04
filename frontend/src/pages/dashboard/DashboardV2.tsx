import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { useNotes, useCreateNote } from "@/hooks/useNotes";
import { apiClient } from "@/lib/api-client";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import {
  BrainCircuit, LayoutDashboard, FileText, Folder, Tag, Star, Settings, LogOut,
  Menu, Bell, Search, X, ChevronDown, Sun, Moon, Files, Layers, GraduationCap, BarChart3,
  ChevronRight, Plus, Upload, ShieldCheck
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
import { EvaluationDashboardV2 } from "./EvaluationDashboardV2";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { getNotePreview } from "@/lib/utils";

export const DashboardV2: React.FC = () => {
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

  const { data: notes } = useNotes();
  const { data: folders, isLoading: foldersLoading, isError: foldersError, refetch: refetchFolders } = useFolders();
  const { data: tags, isLoading: tagsLoading, isError: tagsError, refetch: refetchTags } = useTags();

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

  const location = useLocation();
  const navigate = useNavigate();

  // Sync Zustand state to URL path on change
  useEffect(() => {
    const pathParts = location.pathname.split("/");
    const lastPart = pathParts[pathParts.length - 1];
    if (activeTab && lastPart !== activeTab) {
      if (location.pathname.startsWith("/dashboard")) {
        navigate(`/dashboard/${activeTab}`, { replace: false });
      }
    }
  }, [activeTab, navigate, location.pathname]);

  // Sync URL path to Zustand activeTab on change
  useEffect(() => {
    const pathParts = location.pathname.split("/");
    const lastPart = pathParts[pathParts.length - 1];
    
    const tabMap: Record<string, string> = {
      overview: "overview",
      notes: "notes",
      folders: "folders",
      favorites: "favorites",
      tags: "tags",
      chat: "chat",
      documents: "documents",
      flashcards: "flashcards",
      quizzes: "quizzes",
      analytics: "analytics",
      evaluation: "evaluation",
      settings: "settings"
    };

    if (tabMap[lastPart]) {
      if (activeTab !== tabMap[lastPart]) {
        setActiveTab(tabMap[lastPart] as any);
      }
    } else if (location.pathname === "/dashboard" || location.pathname === "/dashboard/") {
      setActiveTab("overview");
    }
  }, [location.pathname, activeTab, setActiveTab]);

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
    if (!showSearchModal) return;
    const fetchSearchData = async () => {
      try {
        const [docsRes, chatRes] = await Promise.all([
          apiClient.get("/documents"),
          apiClient.get("/chat/conversations"),
        ]);
        setDocuments(docsRes.data);
        setConversations(chatRes.data);
      } catch (err) {
        console.error("Failed to load search data:", err);
      }
    };
    fetchSearchData();
  }, [showSearchModal]);

  const searchNotes = useMemo(() => {
    if (!notes || !searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.content.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  const searchDocs = useMemo(() => {
    if (!documents || !searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return documents.filter((d) => d.filename.toLowerCase().includes(query));
  }, [documents, searchQuery]);

  const searchFolders = useMemo(() => {
    if (!folders || !searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(query));
  }, [folders, searchQuery]);

  const searchTags = useMemo(() => {
    if (!tags || !searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(query));
  }, [tags, searchQuery]);

  const searchConversations = useMemo(() => {
    if (!conversations || !searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  const quickCommands = useMemo(() => {
    const list = [
      { id: "new-note", label: "Create New Note", desc: "Open a blank document in the workspace", icon: "Plus" },
      { id: "upload-doc", label: "Upload Document", desc: "Import PDF, TXT or markdown knowledge sources", icon: "Upload" },
      { id: "ai-assistant", label: "Ask AI Agent", desc: "Open global context chat frame", icon: "BrainCircuit" },
      { id: "telemetry", label: "System Telemetry", desc: "Monitor tokens, API latency, and failure rates", icon: "BarChart3" },
      { id: "account-settings", label: "Account Settings", desc: "Configure details & preferences", icon: "Settings" },
    ];
    if (!searchQuery.trim()) return list;
    const query = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.label.toLowerCase().includes(query) ||
        c.desc.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const totalSearchItemsCount =
    (searchQuery.trim()
      ? searchNotes.slice(0, 3).length +
        searchDocs.slice(0, 3).length +
        searchFolders.slice(0, 3).length +
        searchTags.slice(0, 3).length +
        searchConversations.slice(0, 3).length
      : 0) + quickCommands.length;

  const handleModalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalSearchItemsCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalSearchItemsCount) % totalSearchItemsCount);
    } else if (e.key === "Escape") {
      setShowSearchModal(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      let accumulated = 0;
      if (searchQuery.trim()) {
        const noteLen = searchNotes.slice(0, 3).length;
        if (selectedIndex < noteLen) {
          handleSearchResultClick("note", searchNotes[selectedIndex].id);
          return;
        }
        accumulated += noteLen;

        const docLen = searchDocs.slice(0, 3).length;
        if (selectedIndex < accumulated + docLen) {
          handleSearchResultClick("document", searchDocs[selectedIndex - accumulated].id);
          return;
        }
        accumulated += docLen;

        const folderLen = searchFolders.slice(0, 3).length;
        if (selectedIndex < accumulated + folderLen) {
          handleSearchResultClick("folder", searchFolders[selectedIndex - accumulated].id);
          return;
        }
        accumulated += folderLen;

        const tagLen = searchTags.slice(0, 3).length;
        if (selectedIndex < accumulated + tagLen) {
          handleSearchResultClick("tag", searchTags[selectedIndex - accumulated].id);
          return;
        }
        accumulated += tagLen;

        const chatLen = searchConversations.slice(0, 3).length;
        if (selectedIndex < accumulated + chatLen) {
          handleSearchResultClick("conversation", searchConversations[selectedIndex - accumulated].id);
          return;
        }
        accumulated += chatLen;
      }

      const cmdIndex = selectedIndex - accumulated;
      if (cmdIndex >= 0 && cmdIndex < quickCommands.length) {
        handleCommandSelect(quickCommands[cmdIndex]);
      }
    }
  };

  const handleCommandSelect = async (cmd: any) => {
    setShowSearchModal(false);
    setSearchQuery("");

    if (cmd.id === "new-note") {
      try {
        const note = await createNote({ title: "Untitled Note", content: "" });
        setActiveNoteId(note.id);
        setActiveTab("notes");
      } catch (err) {
        console.error("Failed to create note:", err);
      }
    } else if (cmd.id === "upload-doc") {
      setActiveTab("documents");
    } else if (cmd.id === "ai-assistant") {
      setActiveTab("chat");
    } else if (cmd.id === "telemetry") {
      setActiveTab("analytics");
    } else if (cmd.id === "account-settings") {
      setActiveTab("settings");
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
      { id: "evaluation", label: "Evaluation", icon: ShieldCheck, color: "text-emerald" },
    ];

    const isItemActive = (item: any) => {
      if (item.id === "notes") {
        return activeTab === "notes" && !activeFolderId && !activeTagId;
      }
      return activeTab === item.id;
    };

    return (
      <div className="flex flex-col justify-between h-full bg-sidebar/95">
        <div className="flex flex-col overflow-y-auto max-h-[calc(100vh-6rem)] flex-grow scrollbar">
          {/* Logo Brand */}
          <div className="h-14 flex items-center px-4.5 gap-2.5 border-b border-white/[0.03] shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-primary to-indigo-500 text-white shadow-sm shrink-0">
              <BrainCircuit className="h-4.5 w-4.5" />
            </span>
            {(!collapsed || isMobileView) && (
              <span className="font-semibold text-xs tracking-[0.05em] uppercase text-foreground/80">
                NoteAI Workspace
              </span>
            )}
          </div>

          {/* Workspace Switcher */}
          {(!collapsed || isMobileView) && (
            <div className="p-3 border-b border-white/[0.03] shrink-0">
              <WorkspaceSwitcher />
            </div>
          )}

          {/* Nav Items */}
          <nav className="p-3.5 space-y-0.5 flex-grow">
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
                  className={`relative flex items-center gap-2.5 w-full px-2.5 py-2 text-[11px] font-medium rounded-lg transition-all duration-150 group ${
                    isActive
                      ? "text-foreground bg-white/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.3)] border border-white/[0.02]"
                      : "text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.02]"
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-2.5 w-full">
                    <Icon className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-102 duration-155 ${isActive ? "text-foreground" : item.color}`} />
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
                className={`flex items-center justify-between w-full px-2.5 py-2 text-[11px] font-medium rounded-lg text-muted-foreground/50 hover:bg-white/[0.02] hover:text-foreground/80 transition-all duration-150`}
              >
                <span className="flex items-center gap-2.5">
                  <Folder className="h-4 w-4 shrink-0 text-primary" />
                  {(!collapsed || isMobileView) && <span>Folders</span>}
                </span>
                {(!collapsed || isMobileView) && (
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-150 shrink-0 ${
                      expandFolders ? "" : "-rotate-90"
                    }`}
                  />
                )}
              </button>
              {(!collapsed || isMobileView) && expandFolders && (
                <div className="pl-5 pr-2 py-0.5 space-y-0.5 border-l border-white/[0.03] ml-4">
                  {foldersLoading ? (
                    <div className="space-y-1.5 py-1">
                      <div className="h-2.5 w-16 rounded bg-white/[0.03] animate-pulse" />
                      <div className="h-2.5 w-20 rounded bg-white/[0.03] animate-pulse" />
                    </div>
                  ) : foldersError ? (
                    <div className="py-1 px-1 text-[9px] text-red-400 flex items-center justify-between gap-2">
                      <span>Failed to load</span>
                      <button
                        onClick={() => refetchFolders()}
                        className="text-primary hover:underline font-bold focus:outline-none"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      {folders?.slice(0, 4).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            setActiveFolderId(f.id);
                            if (isMobileView) setMobileSidebarOpen(false);
                          }}
                          className={`flex items-center gap-2 w-full text-left px-2 py-1 text-[10px] font-medium rounded truncate hover:text-primary transition-colors ${
                            activeFolderId === f.id ? "text-primary bg-primary/5 font-semibold" : "text-muted-foreground/60"
                          }`}
                        >
                          <span className="w-1 h-1 rounded-full bg-primary/60 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setActiveTab("folders");
                          if (isMobileView) setMobileSidebarOpen(false);
                        }}
                        className="w-full text-left px-2 py-1 text-[10px] text-primary hover:underline font-semibold"
                      >
                        View All...
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Favorites */}
            <button
              onClick={() => {
                setActiveTab("favorites");
                if (isMobileView) setMobileSidebarOpen(false);
              }}
              className={`relative flex items-center gap-2.5 w-full px-2.5 py-2 text-[11px] font-medium rounded-lg transition-all duration-150 group ${
                activeTab === "favorites"
                  ? "text-foreground bg-white/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.3)] border border-white/[0.02]"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.02]"
              }`}
            >
              <span className="relative z-10 flex items-center gap-2.5 w-full">
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
                className="flex items-center justify-between w-full px-2.5 py-2 text-[11px] font-medium text-muted-foreground/50 hover:bg-white/[0.02] hover:text-foreground/80 rounded-lg transition-all duration-150"
              >
                <span className="flex items-center gap-2.5">
                  <Tag className="h-4 w-4 shrink-0 text-violet" />
                  {(!collapsed || isMobileView) && <span>Tags</span>}
                </span>
                {(!collapsed || isMobileView) && (
                  <ChevronDown
                    className={`h-3 w-3 transition-transform duration-150 shrink-0 ${
                      expandTags ? "" : "-rotate-90"
                    }`}
                  />
                )}
              </button>
              {(!collapsed || isMobileView) && expandTags && (
                <div className="pl-5 pr-2 py-0.5 space-y-0.5 border-l border-white/[0.03] ml-4">
                  {tagsLoading ? (
                    <div className="space-y-1.5 py-1">
                      <div className="h-2.5 w-16 rounded bg-white/[0.03] animate-pulse" />
                      <div className="h-2.5 w-20 rounded bg-white/[0.03] animate-pulse" />
                    </div>
                  ) : tagsError ? (
                    <div className="py-1 px-1 text-[9px] text-red-400 flex items-center justify-between gap-2">
                      <span>Failed to load</span>
                      <button
                        onClick={() => refetchTags()}
                        className="text-primary hover:underline font-bold focus:outline-none"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      {tags?.slice(0, 4).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setActiveTagId(t.id);
                            if (isMobileView) setMobileSidebarOpen(false);
                          }}
                          className={`flex items-center gap-2 w-full text-left px-2 py-1 text-[10px] font-medium rounded truncate hover:text-primary transition-colors ${
                            activeTagId === t.id ? "text-primary bg-primary/5 font-semibold" : "text-muted-foreground/60"
                          }`}
                        >
                          <span
                            style={{ backgroundColor: t.color }}
                            className="w-1 h-1 rounded-full shrink-0"
                          />
                          <span className="truncate">{t.name}</span>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setActiveTab("tags");
                          if (isMobileView) setMobileSidebarOpen(false);
                        }}
                        className="w-full text-left px-2 py-1 text-[10px] text-primary hover:underline font-semibold"
                      >
                        Manage Tags...
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              onClick={() => {
                setActiveTab("settings");
                if (isMobileView) setMobileSidebarOpen(false);
              }}
              className={`relative flex items-center gap-2.5 w-full px-2.5 py-2 text-[11px] font-medium rounded-lg transition-all duration-150 group ${
                activeTab === "settings"
                  ? "text-foreground bg-white/[0.04] shadow-[0_1px_2px_rgba(0,0,0,0.3)] border border-white/[0.02]"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-white/[0.02]"
              }`}
            >
              <span className="relative z-10 flex items-center gap-2.5 w-full">
                <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
                {(!collapsed || isMobileView) && <span>Settings</span>}
              </span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3.5 border-t border-white/[0.03] space-y-3 shrink-0 bg-sidebar/40">
          {/* User Profile Card */}
          {(!collapsed || isMobileView) && (
            <div className="p-2 px-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-full overflow-hidden border border-white/[0.08] flex items-center justify-center bg-muted shrink-0 shadow-inner">
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
                    <span className="text-[10px] font-bold text-primary">
                      {user?.name?.slice(0, 2).toUpperCase() || "US"}
                    </span>
                  )}
                </div>
                <div className="text-left min-w-0">
                  <h4 className="font-semibold text-[11px] truncate text-foreground/80 leading-none">
                    {user?.name || "User"}
                  </h4>
                  <p className="text-[9px] text-muted-foreground/45 truncate mt-0.5 font-medium">
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
              className="flex items-center justify-center rounded-lg hover:bg-white/[0.04] py-1.5 border border-white/[0.04] text-muted-foreground/60 hover:text-foreground transition-all duration-150"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5 text-yellow-500/80 shrink-0" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              )}
            </button>
            <button
              onClick={handleLogout}
              title="Log Out"
              className="flex items-center justify-center rounded-lg hover:bg-red-500/5 py-1.5 border border-white/[0.04] text-red-400/80 transition-colors duration-150"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
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
      case "evaluation":
        return <EvaluationDashboardV2 />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground transition-colors duration-300 overflow-hidden h-screen w-screen selection:bg-primary/20">
      {/* Mobile Drawer Sidebar */}
      <AnimatePresence>
        {isMobile && mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-[4px]"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed left-0 top-0 bottom-0 w-60 bg-sidebar border-r border-white/[0.03] flex flex-col justify-between z-50 shadow-2xl"
            >
              {renderSidebar(false, true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar Navigation */}
      {!isMobile && !isFocusMode && (
        <motion.aside
          animate={{ width: sidebarCollapsed ? 56 : 220 }}
          transition={{ type: "spring", stiffness: 240, damping: 26 }}
          className="border-r border-white/[0.03] bg-sidebar flex flex-col justify-between shrink-0 h-screen sticky top-0 overflow-hidden z-30"
        >
          {renderSidebar(sidebarCollapsed, false)}
        </motion.aside>
      )}

      {/* Main Panel Content Area */}
      <div className="flex-grow flex flex-col min-w-0 h-screen overflow-hidden bg-background">
        {/* Top Navbar */}
        {!isFocusMode && (
          <header className="h-14 border-b border-white/[0.03] bg-surface/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (isMobile) {
                    setMobileSidebarOpen(true);
                  } else {
                    toggleSidebar();
                  }
                }}
                className="text-muted-foreground/60 hover:text-foreground p-1 hover:bg-white/[0.03] rounded-md transition-colors"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>

              {/* Quick Search trigger box */}
              <div
                onClick={() => setShowSearchModal(true)}
                className="relative hidden sm:flex items-center w-56 rounded-lg border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.04] py-1 px-2.5 cursor-pointer text-muted-foreground/50 select-none transition-colors"
              >
                <Search className="h-3.5 w-3.5 mr-2 text-muted-foreground/35 shrink-0" />
                <span className="text-[11px] font-medium">Search workspace...</span>
                <kbd className="absolute right-2 top-1.5 rounded bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-mono border border-white/[0.04] shadow-sm font-semibold tracking-wide">
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Header Action Items */}
            <div className="flex items-center gap-3.5 relative">
              {/* Notifications Bell */}
              <button
                onClick={() => alert("Notifications center is empty.")}
                className="text-muted-foreground/60 hover:text-foreground p-1.5 hover:bg-white/[0.03] rounded-lg transition-colors relative"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </button>

              {/* User Profile dropdown */}
              <div className="relative">
                <div
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 cursor-pointer rounded-lg hover:bg-white/[0.02] p-1 transition-colors"
                >
                  <div className="h-7 w-7 rounded-full overflow-hidden border border-white/[0.08] flex items-center justify-center bg-muted shrink-0 shadow-sm">
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
                      <span className="text-[10px] font-bold text-primary">
                        {user?.name?.slice(0, 2).toUpperCase() || "US"}
                      </span>
                    )}
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                </div>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-44 rounded-lg border border-white/[0.04] bg-surface shadow-2xl p-1 z-20 space-y-0.5"
                    >
                      <button
                        onClick={() => {
                          setActiveTab("settings");
                          setShowUserMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-[11px] rounded-md hover:bg-white/[0.03] font-medium flex items-center gap-2 text-foreground/80"
                      >
                        <Settings className="h-3.5 w-3.5 text-muted-foreground/60" /> Settings
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-2.5 py-1.5 text-[11px] rounded-md hover:bg-red-500/[0.02] text-red-400 font-medium flex items-center gap-2"
                      >
                        <LogOut className="h-3.5 w-3.5 text-red-400" /> Log Out
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
          <Suspense fallback={<PageSkeleton />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="w-full h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>

      {/* Spotlight Search Modal (Ctrl+K) */}
      <AnimatePresence>
        {showSearchModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-[4px] p-4 pt-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-lg bg-surface/95 border border-white/[0.04] p-4 rounded-xl shadow-2xl space-y-3 bg-card"
            >
              <div className="relative flex items-center border-b border-white/[0.04] pb-2">
                <Search className="h-4.5 w-4.5 text-muted-foreground/45 mr-3 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleModalKeyDown}
                  placeholder="Type note title or text to search..."
                  className="bg-transparent border-none text-[12px] outline-none flex-grow placeholder:text-muted-foreground/45 focus:ring-0 w-full text-foreground/80"
                />
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setShowSearchModal(false);
                  }}
                  className="text-muted-foreground/40 hover:text-foreground/60 rounded p-1 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="max-h-[300px] overflow-y-auto space-y-3.5 scrollbar text-left p-1">
                {/* 1. Grouped Search Results */}
                {searchQuery.trim() && (
                  <div className="space-y-3.5">
                    {/* Notes category */}
                    {searchNotes.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/40 px-2">
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
                              className={`p-2 rounded-lg cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-semibold ${
                                isSelected ? "bg-white/[0.03]" : "hover:bg-white/[0.015]"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground/60">📝</span>
                                  <h4 className="truncate text-foreground/85 font-medium">{note.title || "Untitled Note"}</h4>
                                </span>
                                <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5 pl-6 font-normal">
                                  {getNotePreview(note.content, 90) || "Empty content..."}
                                </p>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Documents category */}
                    {searchDocs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/40 px-2">
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
                              className={`p-2 rounded-lg cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-semibold ${
                                isSelected ? "bg-white/[0.03]" : "hover:bg-white/[0.015]"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground/60">📄</span>
                                  <h4 className="truncate text-foreground/85 font-medium">{doc.filename}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Folders category */}
                    {searchFolders.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/40 px-2">
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
                              className={`p-2 rounded-lg cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-semibold ${
                                isSelected ? "bg-white/[0.03]" : "hover:bg-white/[0.015]"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground/60">📁</span>
                                  <h4 className="truncate text-foreground/85 font-medium">{folder.name}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Tags category */}
                    {searchTags.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/40 px-2">
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
                              className={`p-2 rounded-lg cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-semibold ${
                                isSelected ? "bg-white/[0.03]" : "hover:bg-white/[0.015]"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground/60">🏷️</span>
                                  <h4 className="truncate text-foreground/85 font-medium">{tag.name}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Chat Conversations category */}
                    {searchConversations.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/40 px-2">
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
                              className={`p-2 rounded-lg cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-semibold ${
                                isSelected ? "bg-white/[0.03]" : "hover:bg-white/[0.015]"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-muted-foreground/60">💬</span>
                                  <h4 className="truncate text-foreground/85 font-medium">{conv.title}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Commands list */}
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-[0.1em] font-semibold text-muted-foreground/40 px-2">
                    Quick Commands
                  </p>
                  {quickCommands.map((cmd, index) => {
                    const flatIndex =
                      (searchQuery.trim() ? searchNotes.slice(0, 3).length + searchDocs.slice(0, 3).length + searchFolders.slice(0, 3).length + searchTags.slice(0, 3).length + searchConversations.slice(0, 3).length : 0) +
                      index;
                    const isSelected = flatIndex === selectedIndex;

                    const getIcon = (iconName: string) => {
                      switch (iconName) {
                        case "Plus": return <Plus className="h-3.5 w-3.5 text-primary shrink-0" />;
                        case "Upload": return <Upload className="h-3.5 w-3.5 text-emerald shrink-0" />;
                        case "BrainCircuit": return <BrainCircuit className="h-3.5 w-3.5 text-primary shrink-0" />;
                        case "Settings": return <Settings className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
                        case "BarChart3": return <BarChart3 className="h-3.5 w-3.5 text-cyan shrink-0" />;
                        default: return <Plus className="h-3.5 w-3.5 shrink-0" />;
                      }
                    };
                    return (
                      <div
                        key={cmd.id}
                        ref={isSelected ? selectedRef : undefined}
                        onClick={() => handleCommandSelect(cmd)}
                        className={`p-2 rounded-lg cursor-pointer flex justify-between items-center gap-4 transition-all text-xs font-semibold ${
                          isSelected ? "bg-white/[0.03] pl-2.5" : "hover:bg-white/[0.015]"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-grow text-left">
                          <span className="p-1 rounded bg-white/[0.02] border border-white/[0.04] shrink-0">
                            {getIcon(cmd.icon)}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-foreground/80 font-medium">{cmd.label}</h4>
                            <p className="text-[10px] text-muted-foreground/45 mt-0.5 truncate">{cmd.desc}</p>
                          </div>
                        </div>
                        <span className="text-[9px] text-muted-foreground/40 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04] shadow-sm shrink-0">
                          ↵ Run
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Navigation help footer */}
              <div className="flex justify-between items-center border-t border-white/[0.04] pt-2 px-1 text-[9px] text-muted-foreground/35 font-mono shrink-0">
                <span>Use <kbd className="bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">↑↓</kbd> to navigate, <kbd className="bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">Enter</kbd> to run</span>
                <span><kbd className="bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">Esc</kbd></span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
