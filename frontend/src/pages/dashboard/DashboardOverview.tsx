import React from "react";
import { useNotes, useCreateNote } from "@/hooks/useNotes";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import { useDocuments } from "@/hooks/useDocuments";
import { useChatConversations } from "@/hooks/useChatConversations";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { 
  BookOpen, Folder, Star, Clock, Plus, ArrowRight, FileText, Upload, 
  Sparkles, Search, MessageSquare, Terminal, HelpCircle, Activity 
} from "lucide-react";
import { motion } from "framer-motion";
import { getNotePreview } from "@/lib/utils";
import { Loader } from "../../components/ui/Loader";

// Import our custom AI OS Dashboard components
import {
  DashboardHero,
  DashboardMetric,
  DashboardCard,
  DashboardCharts,
  ActivityTimeline,
  QuickActionCard,
  AIStatusPanel
} from "@/components/dashboard";

export const DashboardOverview: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveTab, setActiveNoteId, setActiveFolderId } = useUIStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();

  // Queries
  const { data: documents = [], isLoading: documentsLoading } = useDocuments();
  const { data: notes = [], isLoading: notesLoading } = useNotes();
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const { data: tags = [], isLoading: tagsLoading } = useTags();
  const { data: conversations = [], isLoading: chatsLoading } = useChatConversations();
  const { mutateAsync: createNote } = useCreateNote();

  // Resolve current active workspace name
  const activeWorkspaceName = React.useMemo(() => {
    const active = workspaces.find((w) => w.id === activeWorkspaceId);
    return active ? active.name : "Global Space";
  }, [workspaces, activeWorkspaceId]);

  const handleCreateQuickNote = async () => {
    try {
      const newNote = await createNote({
        title: "Quick Note",
        content: "",
      });
      setActiveNoteId(newNote.id);
      setActiveTab("notes");
    } catch (err) {
      alert("Failed to create note.");
    }
  };

  const favoriteNotes = notes.filter((n) => n.is_favorite) || [];
  const recentNotes = notes.slice(0, 3) || [];

  const isLoading = notesLoading || foldersLoading || tagsLoading || documentsLoading || chatsLoading;

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  const isWorkspaceEmpty = !isLoading && notes.length === 0 && documents.length === 0;

  // Stagger variants for layout items animation
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Render Premium OS Empty State
  if (isWorkspaceEmpty) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto py-8 text-left space-y-8"
      >
        {/* Onboarding Welcome Panel */}
        <motion.div
          variants={itemVariants}
          className="clay-panel p-8 text-center relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-purple-500/3 to-transparent border border-indigo-500/20 rounded-3xl"
        >
          {!shouldReduceMotion && (
            <>
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-[90px] pointer-events-none -mr-28 -mt-28" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/5 rounded-full blur-[90px] pointer-events-none -ml-28 -mb-28" />
            </>
          )}

          <div className="relative z-10 max-w-xl mx-auto space-y-5">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/25 shadow-inner mb-2 animate-bounce">
              <Sparkles className="h-7 w-7" />
            </span>
            
            <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-indigo-500 bg-clip-text text-transparent">
              Your Knowledge Base is Waiting
            </h1>
            
            <p className="text-xs text-muted-foreground/80 leading-relaxed">
              NoteAI synthesizes your files, notes, and conversations into a unified, lightning-fast semantic RAG second brain. Upload a document or create your first note to launch the AI workspace.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <motion.button
                whileHover={shouldReduceMotion ? {} : { scale: 1.02, y: -2 }}
                whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
                onClick={() => setActiveTab("documents")}
                className="flex items-center gap-2 px-6 py-3.5 text-xs font-bold text-white bg-primary rounded-xl hover:bg-primary/95 border border-primary/20 shadow-md group"
              >
                <Upload className="h-4.5 w-4.5 group-hover:animate-bounce" /> Upload Research Document
              </motion.button>
              
              <button
                onClick={handleCreateQuickNote}
                className="flex items-center gap-2 px-6 py-3.5 text-xs font-bold text-muted-foreground bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] rounded-xl transition-all"
              >
                <Plus className="h-4.5 w-4.5" /> Start Blank Note
              </button>
            </div>
          </div>
        </motion.div>

        {/* Workspace Quick-starts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <motion.div
            variants={itemVariants}
            onClick={() => setActiveTab("chat")}
            className="group relative p-6 bg-white/[0.01] border border-white/[0.03] rounded-2xl flex flex-col justify-between h-44 cursor-pointer select-none hover:border-amber-500/25 hover:shadow-[0_0_15px_rgba(245,158,11,0.06)]"
          >
            <div className="space-y-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/15">
                <MessageSquare className="h-5.5 w-5.5" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">NotebookLM Chat</h3>
                <p className="text-[10px] text-muted-foreground/75 leading-relaxed mt-1">
                  Converse directly with uploaded PDFs, text resources, or notes. Extract insights with citations.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-amber-500 mt-4 group-hover:translate-x-0.5 transition-transform">
              Launch Chat Panel <ArrowRight className="h-3 w-3" />
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            onClick={async () => {
              try {
                const sampleNote = await createNote({
                  title: "Welcome to NoteAI: Quickstart Guide 🚀",
                  content: `<h1>Getting Started with NoteAI</h1><p>NoteAI provides a premium Notion-like editor with inline AI helpers, a comprehensive RAG-based chat, and active studying spaces using Flashcards and Quizzes.</p><p></p><h2>Keyboard Shortcuts</h2><ul><li><p><strong>Open Command Palette</strong>: press <code>Ctrl + K</code> anywhere in the app to access quick search and global commands.</p></li><li><p><strong>Selection Menu</strong>: highlight text inside the editor to open the floating AI Bubble Menu (Explain, Summarize, Refine).</p></li></ul><p></p><h2>AI Knowledge Workspaces</h2><p>Organize notes into folders or workspaces, upload research papers in the Documents tab, and build flashcard review decks to reinforce your learning.</p>`,
                });
                setActiveNoteId(sampleNote.id);
                setActiveTab("notes");
              } catch (err) {
                alert("Failed to load demo.");
              }
            }}
            className="group relative p-6 bg-white/[0.01] border border-white/[0.03] rounded-2xl flex flex-col justify-between h-44 cursor-pointer select-none hover:border-rose-500/25 hover:shadow-[0_0_15px_rgba(244,63,94,0.06)]"
          >
            <div className="space-y-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/15">
                <BookOpen className="h-5.5 w-5.5" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">Load Quickstart Demo</h3>
                <p className="text-[10px] text-muted-foreground/75 leading-relaxed mt-1">
                  Instantly load a pre-configured interactive quickstart note to test inline AI highlights and markdown.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-rose-500 mt-4 group-hover:translate-x-0.5 transition-transform">
              Deploy Sample Note <ArrowRight className="h-3 w-3" />
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-7 max-w-6xl mx-auto text-left pb-12"
    >
      {/* 1. Hero Greetings Module */}
      <motion.div variants={itemVariants}>
        <DashboardHero userName={user?.name || "Researcher"} workspaceName={activeWorkspaceName} />
      </motion.div>

      {/* 2. OS Grid Metrics Segment */}
      <motion.div 
        variants={itemVariants}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
      >
        <DashboardMetric
          title="Total Notes"
          value={notes.length}
          growth="+3 today"
          color="sky"
          icon={<BookOpen className="h-5.5 w-5.5" />}
          onClick={() => setActiveTab("notes")}
        />
        <DashboardMetric
          title="Indexed Files"
          value={documents.length}
          growth={`${documents.filter(d => d.status === "completed").length} ready`}
          color="indigo"
          icon={<FileText className="h-5.5 w-5.5" />}
          onClick={() => setActiveTab("documents")}
        />
        <DashboardMetric
          title="Favorites"
          value={favoriteNotes.length}
          growth="Starred notes"
          color="amber"
          icon={<Star className="h-5.5 w-5.5" />}
          onClick={() => setActiveTab("notes")}
        />
        <DashboardMetric
          title="Folders"
          value={folders.length}
          growth="Workspace hierarchy"
          color="rose"
          icon={<Folder className="h-5.5 w-5.5" />}
          onClick={() => setActiveTab("folders")}
        />
        <DashboardMetric
          title="AI Chats"
          value={conversations.length}
          growth="RAG Dialogues"
          color="purple"
          icon={<MessageSquare className="h-5.5 w-5.5" />}
          onClick={() => setActiveTab("chat")}
        />
      </motion.div>

      {/* 3. Core Split Layout (Charts, Timelines, Action Items) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Span: Visual Charts & Recents logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trend Analysis charts */}
          <motion.div variants={itemVariants}>
            <DashboardCharts 
              notes={notes} 
              documents={documents} 
              folders={folders} 
              conversations={conversations} 
            />
          </motion.div>

          {/* Collated Action timeline */}
          <motion.div variants={itemVariants}>
            <ActivityTimeline 
              notes={notes} 
              documents={documents} 
              folders={folders} 
              conversations={conversations} 
            />
          </motion.div>

          {/* Quick command grid */}
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-xs font-bold uppercase text-muted-foreground/60 tracking-wider flex items-center gap-2 px-1">
              <Activity className="h-4 w-4 text-primary" /> Global Shortcuts & Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <QuickActionCard 
                label="Index Source File" 
                description="Upload PDFs and text logs for semantic chat" 
                icon={<Upload className="h-5 w-5" />} 
                onClick={() => setActiveTab("documents")} 
                color="indigo" 
              />
              <QuickActionCard 
                label="Compose Note" 
                description="Draft markdown text with inline AI bubbles" 
                icon={<Plus className="h-5 w-5" />} 
                onClick={handleCreateQuickNote} 
                color="primary" 
              />
              <QuickActionCard 
                label="Ask Workspace AI" 
                description="Initiate deep RAG chat with workspace context" 
                icon={<Sparkles className="h-5 w-5" />} 
                onClick={() => setActiveTab("chat")} 
                color="amber" 
              />
              <QuickActionCard 
                label="Open Study Decks" 
                description="Review flashcards and custom quiz sets" 
                icon={<BookOpen className="h-5 w-5" />} 
                onClick={() => setActiveTab("flashcards")} 
                color="rose" 
              />
            </div>
          </motion.div>
        </div>

        {/* Right Span: Study Widget & Status Telemetry */}
        <div className="space-y-6">
          {/* Learning Goal progress widget */}
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-xs font-bold uppercase text-muted-foreground/60 tracking-wider flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" /> Active Learning Progress
            </h2>
            
            <DashboardCard className="bg-gradient-to-br from-amber-500/4 via-transparent to-transparent border border-amber-500/10 space-y-4">
              {/* Target review tracker */}
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <h4 className="font-bold text-xs text-foreground">Review Queue</h4>
                  <p className="text-[10px] text-muted-foreground/75 mt-0.5">Maintain study streak!</p>
                </div>
                
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-10 h-10 transform -rotate-90">
                    <circle cx="20" cy="20" r="16" stroke="currentColor" className="text-white/[0.02]" strokeWidth="3.2" fill="transparent" />
                    <circle cx="20" cy="20" r="16" stroke="currentColor" className="text-amber-500" strokeWidth="3.2" fill="transparent"
                      strokeDasharray={2 * Math.PI * 16}
                      strokeDashoffset={2 * Math.PI * 16 * (1 - 12/20)}
                    />
                  </svg>
                  <span className="absolute text-[8px] font-black text-amber-600 dark:text-amber-400">60%</span>
                </div>
              </div>

              {/* Status metrics grid */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.02]">
                <div className="bg-white/[0.005] p-2.5 rounded-xl border border-white/[0.03] text-center">
                  <p className="text-[9px] uppercase font-bold text-muted-foreground/50 tracking-wider">Reviewed</p>
                  <h4 className="text-xs font-black text-foreground mt-0.5">12 / 20</h4>
                </div>
                <div className="bg-white/[0.005] p-2.5 rounded-xl border border-white/[0.03] text-center">
                  <p className="text-[9px] uppercase font-bold text-muted-foreground/50 tracking-wider">Streak</p>
                  <h4 className="text-xs font-black text-foreground mt-0.5">4 Days 🔥</h4>
                </div>
              </div>

              {/* Suggested Decks navigation if content exists */}
              {notes.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-white/[0.02] text-left">
                  <p className="text-[9px] uppercase font-extrabold text-muted-foreground/55 tracking-wider">Recommended Studies</p>
                  <div className="space-y-2">
                    {notes.slice(0, 2).map((note) => (
                      <div key={note.id} className="p-3 rounded-2xl bg-white/[0.01] border border-white/[0.02] space-y-2.5">
                        <h5 className="text-[11px] font-bold text-foreground truncate">{note.title || "Untitled Note"}</h5>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setActiveNoteId(note.id);
                              setActiveTab("flashcards");
                            }}
                            className="flex-1 py-1.5 px-2 text-[9px] font-bold rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 transition-all active:scale-95 cursor-pointer"
                          >
                            Study Cards
                          </button>
                          <button
                            onClick={() => {
                              setActiveNoteId(note.id);
                              setActiveTab("quizzes");
                            }}
                            className="flex-1 py-1.5 px-2 text-[9px] font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                          >
                            Solve Quiz
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setActiveTab("flashcards")}
                className="w-full text-center py-2 px-3 text-[10px] font-extrabold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors border border-amber-500/20"
              >
                Review Due Study Decks
              </button>
            </DashboardCard>
          </motion.div>

          {/* AI engine diagnostic telemetry widget */}
          <motion.div variants={itemVariants}>
            <AIStatusPanel documents={documents} />
          </motion.div>

          {/* Keyboard palette launcher & fast folders nav */}
          <motion.div variants={itemVariants} className="space-y-4">
            <h2 className="text-xs font-bold uppercase text-muted-foreground/60 tracking-wider flex-shrink-0 flex items-center gap-2 px-1">
              <Search className="h-4 w-4 text-indigo-500" /> Fast Navigation
            </h2>

            <DashboardCard className="bg-white/[0.01] border border-white/[0.03] p-4.5 space-y-3">
              {/* Trigger keyboard search palette dialog */}
              <div
                onClick={() => {
                  const event = new KeyboardEvent("keydown", {
                    key: "k",
                    ctrlKey: true,
                    bubbles: true,
                  });
                  window.dispatchEvent(event);
                }}
                className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.02] hover:bg-white/[0.02] cursor-pointer transition-all select-none group text-left"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-foreground/80">
                  <Search className="h-4 w-4 text-indigo-500 transition-transform group-hover:scale-105" />
                  <span>Search Palette</span>
                </div>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[9px] font-medium text-muted-foreground/70">
                  Ctrl K
                </kbd>
              </div>

              {/* Fast navigation folder nodes list */}
              {folders.length > 0 && (
                <div className="pt-2 border-t border-white/[0.02] text-left">
                  <p className="text-[9px] uppercase font-bold text-muted-foreground/50 px-1 mb-1.5">Quick Folder Access</p>
                  <div className="space-y-1">
                    {folders.slice(0, 3).map((folder) => (
                      <div
                        key={folder.id}
                        onClick={() => {
                          setActiveFolderId(folder.id);
                          setActiveTab("folders");
                        }}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/[0.02] text-[10.5px] font-bold text-foreground/75 cursor-pointer transition-all"
                      >
                        <Folder className="h-3.5 w-3.5 text-indigo-500" />
                        <span className="truncate">{folder.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DashboardCard>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
export default DashboardOverview;
