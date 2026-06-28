import React, { useState, useEffect } from "react";
import { useNotes, useCreateNote } from "@/hooks/useNotes";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { BookOpen, Folder, Star, Clock, Plus, ArrowRight, FileText, Upload, Sparkles, Search } from "lucide-react";
import { motion } from "framer-motion";
import { getNotePreview } from "@/lib/utils";

export const DashboardOverview: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveTab, setActiveNoteId, setActiveFolderId } = useUIStore();
  const { activeWorkspaceId } = useWorkspaceStore();

  const [documents, setDocuments] = useState<any[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const fetchDocuments = async () => {
    setDocumentsLoading(true);
    try {
      const response = await apiClient.get("/documents/");
      setDocuments(response.data);
    } catch (err) {
      console.error("Error fetching documents:", err);
    } finally {
      setDocumentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchDocuments();
    }
  }, [activeWorkspaceId]);

  // Queries
  const { data: notes, isLoading: notesLoading } = useNotes();
  const { data: folders, isLoading: foldersLoading } = useFolders();
  const { isLoading: tagsLoading } = useTags();
  const { mutateAsync: createNote } = useCreateNote();

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

  const favoriteNotes = notes?.filter((n) => n.is_favorite) || [];
  const recentNotes = notes?.slice(0, 3) || [];

  const isLoading = notesLoading || foldersLoading || tagsLoading || documentsLoading;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  } as const;

  const isWorkspaceEmpty = !isLoading && (!notes || notes.length === 0) && documents.length === 0;

  if (isWorkspaceEmpty) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-8 max-w-4xl mx-auto py-8 text-left"
      >
        {/* Onboarding Welcome Banner */}
        <motion.div
          variants={itemVariants}
          className="clay-panel p-8 text-center relative overflow-hidden bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 rounded-3xl"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>
          
          <div className="relative z-10 max-w-xl mx-auto space-y-4">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-500/10 text-indigo-500 shadow-inner mb-2">
              <Sparkles className="h-8 w-8 animate-pulse" />
            </span>
            <h1 className="text-2xl font-black tracking-tight md:text-3xl bg-gradient-to-r from-foreground via-foreground to-indigo-500 bg-clip-text text-transparent">
              Welcome to your AI Knowledge Workspace!
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              NoteAI is your ultimate hybrid workspace combining the flexibility of Notion, the AI research depth of NotebookLM, and the clean productivity of Linear. Let's get you set up!
            </p>
          </div>
        </motion.div>

        {/* Guided Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 1: Upload Documents */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            className="clay-card clay-card-sky p-6 flex flex-col justify-between cursor-pointer group"
            onClick={() => setActiveTab("documents")}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shadow-inner">
                  <Upload className="h-6 w-6" />
                </span>
                <span className="text-[10px] uppercase font-black text-sky-600 bg-sky-500/10 px-2 py-0.5 rounded-full">Step 1</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Upload Research & Source Files</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Upload PDF, TXT, or markdown files. NoteAI will extract content and index it for your private local semantic RAG search.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-sky-600 dark:text-sky-400 mt-6 group-hover:translate-x-1 transition-transform">
              Go to Documents Library <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </motion.div>

          {/* Step 2: Create a Note */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            className="clay-card clay-card-indigo p-6 flex flex-col justify-between cursor-pointer group"
            onClick={handleCreateQuickNote}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-inner">
                  <Plus className="h-6 w-6" />
                </span>
                <span className="text-[10px] uppercase font-black text-indigo-600 bg-indigo-500/10 px-2 py-0.5 rounded-full">Step 2</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Write Notes & Guidelines</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Start drafting notes with our distraction-free, markdown-enabled editor. Highlight selection to invoke inline AI tools.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-6 group-hover:translate-x-1 transition-transform">
              Create New Note <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </motion.div>

          {/* Step 3: Ask AI */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            className="clay-card clay-card-amber p-6 flex flex-col justify-between cursor-pointer group"
            onClick={() => setActiveTab("chat")}
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-inner">
                  <Sparkles className="h-6 w-6" />
                </span>
                <span className="text-[10px] uppercase font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">Step 3</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Converse with your Sources</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Ask questions, summarize documents, generate flashcards or review quizzes based entirely on your custom workspace context.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-600 dark:text-amber-400 mt-6 group-hover:translate-x-1 transition-transform">
              Open NotebookLM Chat <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </motion.div>

          {/* Step 4: Populate Demo */}
          <motion.div
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            className="clay-card clay-card-rose p-6 flex flex-col justify-between cursor-pointer group"
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
          >
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-inner">
                  <FileText className="h-6 w-6" />
                </span>
                <span className="text-[10px] uppercase font-black text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-full">Quick Start</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Populate Workspace Demo</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Instantly load a pre-configured quickstart note to test keyboard shortcuts, the editor sidebar, and AI action menus.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-600 dark:text-rose-400 mt-6 group-hover:translate-x-1 transition-transform">
              Load Quickstart Demo <ArrowRight className="h-3.5 w-3.5" />
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
      className="space-y-6 max-w-6xl mx-auto text-left"
    >
      {/* Welcome banner */}
      <motion.div
        variants={itemVariants}
        className="clay-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-primary/10 via-transparent to-transparent relative overflow-hidden"
      >
        <div className="relative z-10">
          <h1 className="text-xl font-extrabold tracking-tight md:text-2xl bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
            Welcome back, {user?.name || "NoteAI writer"}! 👋
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Your personalized knowledge graph is ready. Here's a quick summary of your notes & documents.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreateQuickNote}
          className="flex items-center gap-2 clay-btn-primary px-5 py-3 text-xs font-bold text-white transition-all shadow-md shrink-0 relative z-10"
        >
          <Plus className="h-4.5 w-4.5" /> Create New Note
        </motion.button>
      </motion.div>

      {/* Metrics Row */}
      <motion.div variants={containerVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Notes */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -4 }}
          onClick={() => setActiveTab("notes")}
          className="clay-card clay-card-sky p-5 flex items-center gap-4 cursor-pointer"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shadow-inner">
            <BookOpen className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[10px] uppercase font-extrabold text-sky-600/70 dark:text-sky-400/70 tracking-wider">
              Total Notes
            </p>
            <h3 className="text-xl font-black text-foreground">{notes?.length || 0}</h3>
          </div>
        </motion.div>

        {/* Workspace Documents */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -4 }}
          onClick={() => setActiveTab("documents")}
          className="clay-card clay-card-indigo p-5 flex items-center gap-4 cursor-pointer"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-inner">
            <FileText className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[10px] uppercase font-extrabold text-indigo-600/70 dark:text-indigo-400/70 tracking-wider">
              Documents
            </p>
            <h3 className="text-xl font-black text-foreground">{documents.length}</h3>
          </div>
        </motion.div>

        {/* Favorites */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -4 }}
          onClick={() => setActiveTab("notes")}
          className="clay-card clay-card-amber p-5 flex items-center gap-4 cursor-pointer"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-inner">
            <Star className="h-6 w-6 fill-amber-500/20 text-amber-600 dark:text-amber-400" />
          </span>
          <div>
            <p className="text-[10px] uppercase font-extrabold text-amber-600/70 dark:text-amber-400/70 tracking-wider">
              Favorites
            </p>
            <h3 className="text-xl font-black text-foreground">{favoriteNotes.length}</h3>
          </div>
        </motion.div>

        {/* Folders count */}
        <motion.div
          variants={itemVariants}
          whileHover={{ scale: 1.02, y: -4 }}
          onClick={() => setActiveTab("folders")}
          className="clay-card clay-card-rose p-5 flex items-center gap-4 cursor-pointer"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-inner">
            <Folder className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[10px] uppercase font-extrabold text-rose-600/70 dark:text-rose-400/70 tracking-wider">
              Folders
            </p>
            <h3 className="text-xl font-black text-foreground">{folders?.length || 0}</h3>
          </div>
        </motion.div>
      </motion.div>

      {/* Grid of Recents & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Notes */}
        <motion.div variants={containerVariants} className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Recent Notes
            </h2>
            <button
              onClick={() => setActiveTab("notes")}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-4">
            {recentNotes.length === 0 ? (
              <motion.div
                variants={itemVariants}
                className="border border-dashed border-border rounded-2xl p-8 text-center text-xs text-muted-foreground clay-panel bg-card/20"
              >
                No notes created yet. Click "Create New Note" to start writing!
              </motion.div>
            ) : (
              recentNotes.map((note) => (
                <motion.div
                  key={note.id}
                  variants={itemVariants}
                  whileHover={{ scale: 1.02, y: -2 }}
                  onClick={() => setActiveNoteId(note.id)}
                  className="clay-card p-5 space-y-3 cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-xs truncate w-[85%] text-foreground">
                        {note.title || "Untitled Note"}
                      </h3>
                      {note.is_favorite && (
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                      {getNotePreview(note.content, 120) || "Empty content..."}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
                    <span className="text-[9px] text-muted-foreground/80">
                      {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                    {note.tags.length > 0 && (
                      <div className="flex gap-1 overflow-hidden max-w-[65%] shrink-0">
                        {note.tags.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            style={{ backgroundColor: `${t.color}15`, color: t.color, borderColor: `${t.color}25` }}
                            className="rounded px-1.5 py-0.5 text-[8px] font-bold border truncate"
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Middle Column: Recent Documents */}
        <motion.div variants={containerVariants} className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Recent Documents
            </h2>
            <button
              onClick={() => setActiveTab("documents")}
              className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-4">
            {documents.length === 0 ? (
              <motion.div
                variants={itemVariants}
                className="border border-dashed border-border rounded-2xl p-8 text-center text-xs text-muted-foreground clay-panel bg-card/20"
              >
                No documents uploaded yet. Upload PDFs or text files to chat with them!
              </motion.div>
            ) : (
              documents.slice(0, 3).map((doc) => (
                <motion.div
                  key={doc.id}
                  variants={itemVariants}
                  whileHover={{ scale: 1.02, y: -2 }}
                  onClick={() => setActiveTab("documents")}
                  className="clay-card p-5 flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-3 truncate w-[75%]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 shadow-inner group-hover:scale-105 transition-transform">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="truncate">
                      <h4 className="font-bold text-xs truncate text-foreground group-hover:text-primary transition-colors">
                        {doc.filename}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-muted-foreground">
                          {(doc.file_size / 1024).toFixed(1)} KB
                        </span>
                        <span className="text-[9px] text-muted-foreground">•</span>
                        <span className="text-[9px] text-muted-foreground">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    {doc.status === "completed" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        Indexed
                      </span>
                    ) : doc.status === "processing" || doc.status === "pending" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 animate-pulse">
                        Parsing
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                        Failed
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        {/* Right Column: Sidebar (Learning Progress & Shortcuts) */}
        <motion.div variants={containerVariants} className="space-y-6">
          {/* Learning Progress Widget */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2 px-1">
              <Sparkles className="h-4 w-4 text-amber-500" /> Learning Progress
            </h2>
            
            <motion.div
              variants={itemVariants}
              className="clay-card p-5 space-y-4 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent border border-amber-500/10"
            >
              {/* Daily Target Progress */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-foreground">Daily Review Target</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Keep your study streak going!</p>
                </div>
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-10 h-10 transform -rotate-90">
                    <circle cx="20" cy="20" r="16" stroke="currentColor" className="text-muted/20" strokeWidth="3" fill="transparent" />
                    <circle cx="20" cy="20" r="16" stroke="currentColor" className="text-amber-500" strokeWidth="3" fill="transparent"
                      strokeDasharray={2 * Math.PI * 16}
                      strokeDashoffset={2 * Math.PI * 16 * (1 - 12/20)}
                    />
                  </svg>
                  <span className="absolute text-[8px] font-black text-amber-600 dark:text-amber-400">60%</span>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
                <div className="bg-card/25 p-2 rounded-xl border border-border/10 text-center">
                  <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Reviewed</p>
                  <h4 className="text-xs font-black text-foreground mt-0.5">12 / 20</h4>
                </div>
                <div className="bg-card/25 p-2 rounded-xl border border-border/10 text-center">
                  <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">Streak</p>
                  <h4 className="text-xs font-black text-foreground mt-0.5">4 Days 🔥</h4>
                </div>
              </div>

              {/* Suggestion to study specific recent notes */}
              {notes && notes.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-border/40">
                  <p className="text-[9px] uppercase font-extrabold text-muted-foreground/80 tracking-wider">Suggested Study</p>
                  <div className="space-y-2">
                    {notes.slice(0, 2).map((note) => (
                      <div key={note.id} className="p-3 rounded-2xl bg-card/45 border border-border/20 space-y-2 text-left">
                        <h5 className="text-[11px] font-bold text-foreground truncate">{note.title || "Untitled Note"}</h5>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setActiveNoteId(note.id);
                              setActiveTab("flashcards");
                            }}
                            className="flex-1 text-center py-1.5 px-2 text-[9px] font-extrabold rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20 transition-all active:scale-95 cursor-pointer"
                          >
                            Study Deck
                          </button>
                          <button
                            onClick={() => {
                              setActiveNoteId(note.id);
                              setActiveTab("quizzes");
                            }}
                            className="flex-1 text-center py-1.5 px-2 text-[9px] font-extrabold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                          >
                            Take Quiz
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveTab("flashcards")}
                className="w-full text-center py-2 px-3 text-[10px] font-extrabold rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors border border-amber-500/20"
              >
                Review Due Decks
              </motion.button>
            </motion.div>
          </div>

          {/* Quick Actions Sidebar */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2 px-1">
              <Search className="h-4 w-4 text-indigo-500" /> Actions & Shortcuts
            </h2>

            <motion.div variants={itemVariants} className="clay-panel p-4 space-y-2.5">
              {/* Command Palette trigger hint */}
              <div
                onClick={() => {
                  const event = new KeyboardEvent("keydown", {
                    key: "k",
                    ctrlKey: true,
                    bubbles: true,
                  });
                  window.dispatchEvent(event);
                }}
                className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 hover:bg-muted/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Search className="h-4 w-4 text-indigo-500" />
                  <span>Search Palette</span>
                </div>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
                  Ctrl K
                </kbd>
              </div>

              {/* Quick AI Chat */}
              <div
                onClick={() => setActiveTab("chat")}
                className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 hover:bg-muted/40 cursor-pointer transition-all group"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                  <span>Ask AI Chat</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
              </div>

              {/* Manage folders shortcuts */}
              <div className="pt-2 border-t border-border/30">
                <p className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider px-1.5 mb-1.5">Recent Folders</p>
                {folders?.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground px-1.5 italic">No folders yet</p>
                ) : (
                  folders?.slice(0, 3).map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => setActiveFolderId(folder.id)}
                      className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted/40 text-[11px] font-semibold text-foreground cursor-pointer"
                    >
                      <Folder className="h-3.5 w-3.5 text-indigo-500" />
                      <span className="truncate">{folder.name}</span>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
