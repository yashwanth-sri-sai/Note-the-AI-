import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { useNotes, useCreateNote } from "@/hooks/useNotes";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import { useDocuments } from "@/hooks/useDocuments";
import { useChatConversations } from "@/hooks/useChatConversations";
import {
  BrainCircuit, LayoutDashboard, FileText, Folder, Tag, Star, Settings, LogOut,
  Menu, Bell, Search, X, ChevronDown, Sun, Moon, Files, Layers, GraduationCap, BarChart3,
  ChevronRight, Plus, Upload, ShieldCheck, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/common/Logo";
import { PageTransition } from "@/components/motion/MotionSystem";
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
import { useWorkspaceStore } from "@/store/workspace-store";
import { getNotePreview } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AIAssistantPanel } from "@/components/workspace/AIAssistantPanel";
import { WorkspacePanelToggle } from "@/components/workspace/WorkspacePanelToggle";

// ── BRAND SECTION ──
const BrandSection: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <div className={`flex items-center px-6 py-5 shrink-0 select-none text-left ${collapsed ? "justify-center" : "gap-3.5"}`}>
    <Logo size={42} className="hover:scale-[1.03] transition-all duration-250 ease-in-out shrink-0" />
    {!collapsed && (
      <div className="flex flex-col min-w-0">
        <span className="font-bold text-[18px] tracking-tight text-foreground leading-none">
          NoteAI
        </span>
        <span className="text-[12px] font-medium text-muted-foreground/60 mt-1 tracking-normal truncate">
          AI Knowledge Workspace
        </span>
      </div>
    )}
  </div>
);

// ── WORKSPACE CARD ──
const WorkspaceCard: React.FC<{
  collapsed: boolean;
  activeWorkspaceName: string;
  docCount: number;
  noteCount: number;
  chatCount: number;
  onClick: () => void;
}> = ({ collapsed, activeWorkspaceName, docCount, noteCount, chatCount, onClick }) => (
  <div className="px-6 py-2 select-none shrink-0">
    <button
      onClick={onClick}
      className={`w-full flex flex-col p-4.5 rounded-dialog border border-border bg-[#111827] dark:bg-[#111827] text-white hover:bg-[#162338] transition-all duration-200 text-left group shadow-lg hover:-translate-y-[2px] ${collapsed ? "items-center !p-3" : ""}`}
    >
      <div className="flex items-center gap-3 w-full min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-primary/20 text-primary border border-primary/30 shadow-inner">
          <span className="font-bold text-xs uppercase">{activeWorkspaceName.slice(0, 2)}</span>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex flex-col flex-grow">
            <span className="text-[10px] text-muted-foreground/60 uppercase font-extrabold tracking-wider leading-none">
              Workspace
            </span>
            <span className="text-sm font-semibold text-white truncate mt-1">
              {activeWorkspaceName}
            </span>
          </div>
        )}
      </div>
      
      {!collapsed && (
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/[0.04] text-left text-[11px] font-medium text-muted-foreground">
          <div className="flex flex-col">
            <span className="text-white font-semibold">{docCount}</span>
            <span className="text-[9px] text-muted-foreground/75 uppercase tracking-wide mt-0.5">Docs</span>
          </div>
          <div className="flex flex-col border-l border-white/[0.04] pl-2">
            <span className="text-white font-semibold">{noteCount}</span>
            <span className="text-[9px] text-muted-foreground/75 uppercase tracking-wide mt-0.5">Notes</span>
          </div>
          <div className="flex flex-col border-l border-white/[0.04] pl-2">
            <span className="text-white font-semibold">{chatCount}</span>
            <span className="text-[9px] text-muted-foreground/75 uppercase tracking-wide mt-0.5">Chats</span>
          </div>
        </div>
      )}
    </button>
  </div>
);

// ── WORKSPACE SWITCHER DROPDOWN ──
const WorkspaceDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  workspaces: any[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
}> = ({ isOpen, onClose, workspaces, activeWorkspaceId, onSelectWorkspace, onCreateWorkspace }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setSubmitting(true);
    try {
      await onCreateWorkspace(newWorkspaceName);
      setNewWorkspaceName("");
      setShowCreate(false);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[135px] left-6 right-6 p-2.5 z-50 rounded-dialog border border-white/[0.05] dark:border-white/[0.05] bg-card shadow-2xl space-y-1.5 text-left"
          >
            <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider">
              Switch Workspace
            </div>
            
            <div className="max-h-48 overflow-y-auto py-1 space-y-0.5 scrollbar">
              {workspaces.map((w) => {
                const isSelected = w.id === activeWorkspaceId;
                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      onSelectWorkspace(w.id);
                      onClose();
                    }}
                    className={`flex items-center justify-between w-full px-2.5 py-2 text-xs font-semibold rounded-btn transition-colors ${
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-secondary-text hover:bg-muted/10 hover:text-foreground"
                    }`}
                  >
                    <span className="truncate pr-2">{w.name}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-white/[0.03] my-1" />
            
            {showCreate ? (
              <form onSubmit={handleCreate} className="p-2 space-y-2">
                <input
                  type="text"
                  placeholder="New workspace name..."
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-btn bg-background border border-border focus:outline-none focus:border-primary text-foreground"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-btn hover:bg-muted/10 text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-btn bg-primary text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold rounded-btn border border-dashed border-border/80 hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Create Workspace
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ── NAVIGATION GROUP ──
const NavigationGroup: React.FC<{
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
}> = ({ title, collapsed, children }) => (
  <div className="space-y-1.5 text-left">
    {!collapsed && (
      <div className="px-6 text-[11px] uppercase font-bold text-muted-foreground/60 tracking-wider select-none mt-4.5 mb-1.5">
        {title}
      </div>
    )}
    <div className="px-3.5 space-y-1">
      {children}
    </div>
  </div>
);

// ── NAVIGATION ITEM ──
const NavigationItem: React.FC<{
  label: string;
  icon: any;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
  color?: string;
}> = ({ label, icon: Icon, isActive, collapsed, onClick, color }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`
      relative flex items-center justify-between w-full h-[48px] px-3.5 rounded-btn transition-all duration-200 group select-none
      ${
        isActive
          ? "text-white bg-gradient-to-r from-primary/20 to-violet/10 border border-primary/20 shadow-sm"
          : "text-secondary-text hover:text-foreground hover:bg-muted/10 hover:translate-x-[4px]"
      }
    `}
  >
    {isActive && (
      <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-primary shadow-[0_0_12px_rgba(37,99,235,0.7)]" />
    )}
    <div className="flex items-center gap-3.5 min-w-0">
      <Icon className={`
        h-[18px] w-[18px] shrink-0 transition-all duration-200
        ${
          isActive 
            ? "text-primary drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]" 
            : `text-muted-foreground/80 group-hover:text-foreground group-hover:drop-shadow-[0_0_8px_rgba(37,99,235,0.2)] ${color || ""}`
        }
      `} />
      {!collapsed && (
        <span className={`text-[14px] font-semibold tracking-wide ${isActive ? "text-white font-bold" : "text-secondary-text"}`}>
          {label}
        </span>
      )}
    </div>
  </button>
);

// ── FOLDER ACCORDION ITEM ──
const FolderAccordionItem: React.FC<{
  label: string;
  icon: any;
  collapsed: boolean;
  isOpen: boolean;
  onClick: () => void;
}> = ({ label, icon: Icon, collapsed, isOpen, onClick }) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className="flex items-center justify-between w-full h-[48px] px-3.5 rounded-btn text-secondary-text hover:text-foreground hover:bg-muted/10 hover:translate-x-[4px] transition-all duration-200 group select-none"
  >
    <div className="flex items-center gap-3.5 min-w-0">
      <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground/80 group-hover:text-foreground group-hover:drop-shadow-[0_0_8px_rgba(37,99,235,0.2)]" />
      {!collapsed && (
        <span className="text-[14px] font-semibold tracking-wide">
          {label}
        </span>
      )}
    </div>
    {!collapsed && (
      <ChevronDown
        className={`h-3.5 w-3.5 transition-transform duration-200 text-muted-foreground/60 ${
          isOpen ? "rotate-0" : "-rotate-90"
        }`}
      />
    )}
  </button>
);

// ── USER PROFILE CARD ──
const UserProfileCard: React.FC<{
  collapsed: boolean;
  user: any;
  showDropdown: boolean;
  onToggleDropdown: () => void;
  onLogout: () => void;
  onSettings: () => void;
}> = ({ collapsed, user, showDropdown, onToggleDropdown, onLogout, onSettings }) => (
  <div className="relative px-6 py-4 border-t border-white/[0.05] dark:border-white/[0.05] shrink-0">
    <button
      onClick={onToggleDropdown}
      className={`w-full flex items-center justify-between gap-3 p-3 rounded-dialog border border-[#111827] dark:border-white/[0.05] bg-card hover:bg-muted/10 transition-all duration-200 text-left shadow-sm group hover:scale-[1.01] ${collapsed ? "justify-center !p-2" : ""}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-8.5 w-8.5 rounded-full overflow-hidden border border-white/[0.08] flex items-center justify-center bg-secondary shrink-0 shadow-sm">
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
            <span className="text-xs font-bold text-primary">
              {user?.name?.slice(0, 2).toUpperCase() || "US"}
            </span>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 text-left flex flex-col">
            <h4 className="font-semibold text-[13px] truncate text-foreground leading-tight">
              {user?.name || "User"}
            </h4>
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              Creator
            </p>
          </div>
        )}
      </div>
      {!collapsed && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-foreground shrink-0 transition-transform duration-200" />}
    </button>

    {/* User Actions Dropdown Menu */}
    <AnimatePresence>
      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={onToggleDropdown} />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-6 right-6 mb-3 p-1.5 z-50 rounded-dialog border border-white/[0.05] dark:border-white/[0.05] bg-card shadow-2xl space-y-1"
          >
            <div className="px-3 py-2 text-[10px] uppercase font-bold text-muted-foreground/60 tracking-wider select-none border-b border-white/[0.03] mb-1">
              Account Settings
            </div>
            <button
              onClick={() => {
                onSettings();
                onToggleDropdown();
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold rounded-btn hover:bg-muted/10 transition-colors flex items-center gap-2.5 text-foreground/80 hover:text-foreground"
            >
              <Settings className="h-4 w-4 text-muted-foreground" /> Settings
            </button>
            
            <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.03] mt-1 pt-2">
              <span className="text-xs font-semibold text-muted-foreground">Dark Theme</span>
              <ThemeToggle compact />
            </div>

            <div className="border-t border-white/[0.03] my-1" />
            <button
              onClick={onLogout}
              className="w-full text-left px-3 py-2 text-xs font-semibold rounded-btn hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors flex items-center gap-2.5"
            >
              <LogOut className="h-4 w-4" /> Log Out
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </div>
);

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
    aiPanelOpen,
  } = useUIStore();

  const { data: notes } = useNotes();
  const { data: folders, isLoading: foldersLoading, isError: foldersError, refetch: refetchFolders } = useFolders();
  const { data: tags, isLoading: tagsLoading, isError: tagsError, refetch: refetchTags } = useTags();
  const { data: documents = [] } = useDocuments();
  const { data: conversations = [] } = useChatConversations();
  
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    createWorkspace,
  } = useWorkspaceStore();

  const [showWorkspaceDropdown, setShowWorkspaceDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

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

  const syncRef = useRef({ tab: activeTab, path: location.pathname });

  // Sync Zustand state and URL path in a unified loop-free manner
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

    let resolvedTab = tabMap[lastPart];
    if (!resolvedTab && (location.pathname === "/dashboard" || location.pathname === "/dashboard/")) {
      resolvedTab = "overview";
    }

    if (resolvedTab) {
      // 1. If Zustand activeTab has changed, push the update to URL
      if (activeTab !== syncRef.current.tab) {
        syncRef.current.tab = activeTab;
        if (resolvedTab !== activeTab && location.pathname.startsWith("/dashboard")) {
          const newPath = `/dashboard/${activeTab}`;
          syncRef.current.path = newPath;
          navigate(newPath, { replace: false });
        }
      }
      // 2. If URL path has changed, sync it back to Zustand activeTab
      else if (location.pathname !== syncRef.current.path) {
        syncRef.current.path = location.pathname;
        if (activeTab !== resolvedTab) {
          syncRef.current.tab = resolvedTab as any;
          setActiveTab(resolvedTab as any);
        }
      }
    }
  }, [location.pathname, activeTab, navigate, setActiveTab]);

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
  // Replace raw apiClient.get + useState with React Query hook.
  // Data is served from cache when the search modal opens — no extra network
  // call within the 5-minute staleTime window.
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
    // No manual fetch needed — useChatConversations serves data from cache.
    // The search modal opening is not a reason to bypass the 5-minute staleTime.
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
    const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
    const activeWorkspaceName = activeWorkspace ? activeWorkspace.name : "Personal Workspace";

    return (
      <div className="flex flex-col justify-between h-full bg-[#FAFCFF] dark:bg-[#0A0F1C] border-r border-[#111827]/5 dark:border-white/[0.05] relative">
        <div className="flex flex-col overflow-y-auto max-h-[calc(100vh-6rem)] flex-grow scrollbar pb-4">
          {/* Logo Brand */}
          <BrandSection collapsed={collapsed} />

          {/* Workspace card selector */}
          <WorkspaceCard
            collapsed={collapsed}
            activeWorkspaceName={activeWorkspaceName}
            docCount={documents?.length ?? 0}
            noteCount={notes?.length ?? 0}
            chatCount={conversations?.length ?? 0}
            onClick={() => setShowWorkspaceDropdown(!showWorkspaceDropdown)}
          />

          <WorkspaceDropdown
            isOpen={showWorkspaceDropdown}
            onClose={() => setShowWorkspaceDropdown(false)}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSelectWorkspace={setActiveWorkspaceId}
            onCreateWorkspace={createWorkspace}
          />

          {/* Nav Items Grouped */}
          <div className="space-y-4.5 mt-4">
            {/* WORKSPACE GROUP */}
            <NavigationGroup title="WORKSPACE" collapsed={collapsed}>
              <NavigationItem
                label="Overview"
                icon={LayoutDashboard}
                isActive={activeTab === "overview"}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("overview");
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />
              <NavigationItem
                label="All Notes"
                icon={FileText}
                color="text-amber"
                isActive={activeTab === "notes" && !activeFolderId && !activeTagId}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("notes");
                  setActiveFolderId(null);
                  setActiveTagId(null);
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />
              <NavigationItem
                label="Documents"
                icon={Files}
                color="text-emerald"
                isActive={activeTab === "documents"}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("documents");
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />
              
              {/* Folders Accordion */}
              <div className="space-y-0.5">
                <FolderAccordionItem
                  label="Folders"
                  icon={Folder}
                  collapsed={collapsed}
                  isOpen={expandFolders}
                  onClick={() => {
                    if (collapsed && !isMobileView) {
                      setActiveTab("folders");
                    } else {
                      setExpandFolders(!expandFolders);
                    }
                  }}
                />
                {!collapsed && expandFolders && (
                  <div className="pl-6 pr-2 py-0.5 space-y-0.5 border-l border-border/60 ml-4.5 text-left">
                    {foldersLoading ? (
                      <div className="space-y-1.5 py-1 px-2.5">
                        <div className="h-2.5 w-16 rounded bg-secondary animate-pulse" />
                      </div>
                    ) : foldersError ? (
                      <div className="py-1 px-2.5 text-[10px] text-red-400">Failed to load</div>
                    ) : (
                      <>
                        {folders?.slice(0, 4).map((f) => (
                          <button
                            key={f.id}
                            onClick={() => {
                              setActiveFolderId(f.id);
                              setActiveTab("notes");
                              if (isMobileView) setMobileSidebarOpen(false);
                            }}
                            className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[12px] font-semibold rounded truncate hover:text-primary transition-colors ${
                              activeFolderId === f.id ? "text-primary font-bold bg-primary/5" : "text-secondary-text"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                            <span className="truncate">{f.name}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setActiveTab("folders");
                            if (isMobileView) setMobileSidebarOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-[11px] text-primary hover:underline font-semibold"
                        >
                          View All...
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Favorites Link */}
              <NavigationItem
                label="Favorites"
                icon={Star}
                color="text-amber"
                isActive={activeTab === "favorites"}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("favorites");
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />

              {/* Tags Accordion */}
              <div className="space-y-0.5">
                <FolderAccordionItem
                  label="Tags"
                  icon={Tag}
                  collapsed={collapsed}
                  isOpen={expandTags}
                  onClick={() => {
                    if (collapsed && !isMobileView) {
                      setActiveTab("tags");
                    } else {
                      setExpandTags(!expandTags);
                    }
                  }}
                />
                {!collapsed && expandTags && (
                  <div className="pl-6 pr-2 py-0.5 space-y-0.5 border-l border-border/60 ml-4.5 text-left">
                    {tagsLoading ? (
                      <div className="space-y-1.5 py-1 px-2.5">
                        <div className="h-2.5 w-16 rounded bg-secondary animate-pulse" />
                      </div>
                    ) : tagsError ? (
                      <div className="py-1 px-2.5 text-[10px] text-red-400">Failed to load</div>
                    ) : (
                      <>
                        {tags?.slice(0, 4).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setActiveTagId(t.id);
                              setActiveTab("notes");
                              if (isMobileView) setMobileSidebarOpen(false);
                            }}
                            className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-[12px] font-semibold rounded truncate hover:text-primary transition-colors ${
                              activeTagId === t.id ? "text-primary font-bold bg-primary/5" : "text-secondary-text"
                            }`}
                          >
                            <span style={{ backgroundColor: t.color }} className="w-1.5 h-1.5 rounded-full shrink-0" />
                            <span className="truncate">{t.name}</span>
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setActiveTab("tags");
                            if (isMobileView) setMobileSidebarOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-[11px] text-primary hover:underline font-semibold"
                        >
                          Manage Tags...
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </NavigationGroup>

            {/* AI GROUP */}
            <NavigationGroup title="AI" collapsed={collapsed}>
              <NavigationItem
                label="AI Chat"
                icon={BrainCircuit}
                isActive={activeTab === "chat"}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("chat");
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />
              <NavigationItem
                label="Flashcards"
                icon={Layers}
                color="text-violet"
                isActive={activeTab === "flashcards"}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("flashcards");
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />
              <NavigationItem
                label="Quizzes"
                icon={GraduationCap}
                color="text-rose"
                isActive={activeTab === "quizzes"}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("quizzes");
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />
            </NavigationGroup>

            {/* INSIGHTS GROUP */}
            <NavigationGroup title="INSIGHTS" collapsed={collapsed}>
              <NavigationItem
                label="Analytics"
                icon={BarChart3}
                color="text-cyan"
                isActive={activeTab === "analytics"}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("analytics");
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />
              <NavigationItem
                label="Evaluation"
                icon={ShieldCheck}
                color="text-emerald"
                isActive={activeTab === "evaluation"}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("evaluation");
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />
            </NavigationGroup>

            {/* SYSTEM GROUP */}
            <NavigationGroup title="SYSTEM" collapsed={collapsed}>
              <NavigationItem
                label="Settings"
                icon={Settings}
                isActive={activeTab === "settings"}
                collapsed={collapsed}
                onClick={() => {
                  setActiveTab("settings");
                  if (isMobileView) setMobileSidebarOpen(false);
                }}
              />
            </NavigationGroup>
          </div>
        </div>

        {/* Sidebar Footer User Profile */}
        <UserProfileCard
          collapsed={collapsed}
          user={user}
          showDropdown={showProfileDropdown}
          onToggleDropdown={() => setShowProfileDropdown(!showProfileDropdown)}
          onLogout={handleLogout}
          onSettings={() => setActiveTab("settings")}
        />
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
              className="fixed left-0 top-0 bottom-0 w-[280px] bg-sidebar border-r border-white/[0.03] flex flex-col justify-between z-50 shadow-2xl"
            >
              {renderSidebar(false, true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar Navigation */}
      {!isMobile && !isFocusMode && (
        <motion.aside
          animate={{ width: sidebarCollapsed ? 72 : 280 }}
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
          <header className="h-14 border-b border-border bg-surface/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (isMobile) {
                    setMobileSidebarOpen(true);
                  } else {
                    toggleSidebar();
                  }
                }}
                className="text-muted-foreground/60 hover:text-foreground p-1 hover:bg-foreground/[0.04] rounded-md transition-colors"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>

              {/* Quick Search trigger box */}
              <div
                onClick={() => setShowSearchModal(true)}
                className="relative hidden sm:flex items-center w-56 rounded-input clay-card py-1 px-2.5 cursor-pointer text-muted-foreground/50 select-none"
              >
                <Search className="h-3.5 w-3.5 mr-2 text-muted-foreground/35 shrink-0" />
                <span className="text-[11px] font-medium">Search workspace...</span>
                <kbd className="absolute right-2 top-1.5 rounded bg-surface-secondary px-1.5 py-0.5 text-[8px] font-mono border border-border shadow-sm font-semibold tracking-wide">
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Header Action Items */}
            <div className="flex items-center gap-3.5 relative">
              {/* AI Panel Toggle */}
              {!isMobile && (
                <WorkspacePanelToggle />
              )}

              {/* Notifications Bell */}
              <button
                onClick={() => alert("Notifications center is empty.")}
                className="text-muted-foreground/60 hover:text-foreground p-1.5 hover:bg-foreground/[0.04] rounded-lg transition-colors relative"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              </button>

              {/* User Profile dropdown */}
              <div className="relative">
                <div
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 cursor-pointer rounded-lg hover:bg-foreground/[0.03] p-1 transition-colors"
                >
                  <div className="h-7 w-7 rounded-full overflow-hidden border border-border flex items-center justify-center bg-muted shrink-0 shadow-sm">
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
              <PageTransition pageKey={activeTab}>
                {renderContent()}
              </PageTransition>
            </AnimatePresence>
          </Suspense>
        </main>
      </div>

      {/* ── Right AI Assistant Panel (three-panel workspace) ───────── */}
      {!isMobile && !isFocusMode && (
        <motion.aside
          animate={{
            width: aiPanelOpen ? 360 : 0,
            opacity: aiPanelOpen ? 1 : 0,
          }}
          transition={{
            width: { type: "spring", stiffness: 260, damping: 28 },
            opacity: { duration: 0.2, ease: "easeOut" },
          }}
          className="shrink-0 h-screen overflow-hidden z-20 relative"
          aria-hidden={!aiPanelOpen}
        >
          <div className="w-[360px] h-full">
            <AIAssistantPanel />
          </div>
        </motion.aside>
      )}

      {/* Spotlight Search Modal (Ctrl+K) */}
      <AnimatePresence>
        {showSearchModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-[4px] p-4 pt-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-lg clay-panel p-5 rounded-dialog space-y-3"
            >
              <div className="relative flex items-center border-b border-border pb-2">
                <Search className="h-4.5 w-4.5 text-muted-text mr-3 shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleModalKeyDown}
                  placeholder="Type note title or text to search..."
                  className="bg-transparent border-none text-[12px] outline-none flex-grow placeholder:text-muted-text focus:ring-0 w-full text-primary-text font-medium"
                />
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setShowSearchModal(false);
                  }}
                  className="text-muted-text hover:text-primary-text rounded p-1 transition-colors"
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
                        <p className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-text px-2">
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
                                isSelected ? "bg-secondary" : "hover:bg-secondary/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-secondary-text">📝</span>
                                  <h4 className="truncate text-primary-text font-semibold">{note.title || "Untitled Note"}</h4>
                                </span>
                                <p className="text-[10px] text-secondary-text truncate mt-0.5 pl-6 font-normal">
                                  {getNotePreview(note.content, 90) || "Empty content..."}
                                </p>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-text shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Documents category */}
                    {searchDocs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-text px-2">
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
                                isSelected ? "bg-secondary" : "hover:bg-secondary/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-secondary-text">📄</span>
                                  <h4 className="truncate text-primary-text font-semibold">{doc.filename}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-text shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Folders category */}
                    {searchFolders.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-text px-2">
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
                                isSelected ? "bg-secondary" : "hover:bg-secondary/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-secondary-text">📁</span>
                                  <h4 className="truncate text-primary-text font-semibold">{folder.name}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-text shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Tags category */}
                    {searchTags.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-text px-2">
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
                                isSelected ? "bg-secondary" : "hover:bg-secondary/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-secondary-text">🏷️</span>
                                  <h4 className="truncate text-primary-text font-semibold">{tag.name}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-text shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Chat Conversations category */}
                    {searchConversations.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-text px-2">
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
                                isSelected ? "bg-secondary" : "hover:bg-secondary/50"
                              }`}
                            >
                              <div className="truncate flex-grow">
                                <span className="flex items-center gap-2 truncate">
                                  <span className="text-secondary-text">💬</span>
                                  <h4 className="truncate text-primary-text font-semibold">{conv.title}</h4>
                                </span>
                              </div>
                              <ChevronRight className="h-3.5 w-3.5 text-muted-text shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Commands list */}
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-[0.1em] font-bold text-muted-text px-2">
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
