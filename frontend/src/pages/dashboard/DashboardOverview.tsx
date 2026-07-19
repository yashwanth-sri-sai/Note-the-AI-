import React, { useMemo } from "react";
import { useNotes, useCreateNote } from "@/hooks/useNotes";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import { useDocuments } from "@/hooks/useDocuments";
import { useChatConversations } from "@/hooks/useChatConversations";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { isDocumentReady } from "@/lib/document-status";
import {
  BookOpen,
  Folder,
  Star,
  FileText,
  Upload,
  Sparkles,
  MessageSquare,
  Plus,
  Tag,
  Clock,
  ArrowRight,
  Brain,
  HelpCircle,
  Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import { AnimatedCard } from "@/components/motion/MotionSystem";
import { Loader } from "../../components/ui/Loader";

import {
  DashboardHero,
  DashboardMetric,
  DashboardCharts,
  ActivityTimeline,
  QuickActionCard,
  ContinueLearningCard,
  AIInsightCard,
  KnowledgeCard,
} from "@/components/dashboard";

// ─── Section Wrapper ────────────────────────────────────────────────────────
interface DashboardSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}
const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  icon,
  children,
  action,
}) => (
  <div className="space-y-4 text-left">
    <div className="flex items-center justify-between px-0.5">
      <h2 className="text-[10.5px] font-extrabold uppercase tracking-widest text-muted-foreground/55 flex items-center gap-2">
        <span className="text-primary" aria-hidden="true">{icon}</span>
        {title}
      </h2>
      {action}
    </div>
    {children}
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export const DashboardOverview: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveTab, setActiveNoteId, setActiveFolderId } = useUIStore();
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();

  // ── Queries (unchanged — zero new API calls) ──
  const { data: documents = [], isLoading: documentsLoading } = useDocuments();
  const { data: notes = [], isLoading: notesLoading } = useNotes();
  const { data: folders = [], isLoading: foldersLoading } = useFolders();
  const { data: tags = [], isLoading: tagsLoading } = useTags();
  const { data: conversations = [], isLoading: chatsLoading } = useChatConversations();
  const { mutateAsync: createNote } = useCreateNote();

  const activeWorkspaceName = useMemo(() => {
    const active = workspaces.find((w) => w.id === activeWorkspaceId);
    return active ? active.name : "Global Space";
  }, [workspaces, activeWorkspaceId]);

  const isLoading =
    notesLoading || foldersLoading || tagsLoading || documentsLoading || chatsLoading;

  const handleCreateQuickNote = async () => {
    try {
      const newNote = await createNote({ title: "Quick Note", content: "" });
      setActiveNoteId(newNote.id);
      setActiveTab("notes");
    } catch {
      alert("Failed to create note.");
    }
  };

  const favoriteNotes = useMemo(() => notes.filter((n) => n.is_favorite), [notes]);
  const recentNotes = useMemo(() => notes.slice(0, 3), [notes]);
  const recentDocs = useMemo(() => documents.slice(0, 2), [documents]);
  const recentChats = useMemo(() => conversations.slice(0, 1), [conversations]);
  const completedDocs = useMemo(() => documents.filter((d) => isDocumentReady(d.status)), [documents]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  const isWorkspaceEmpty =
    notes.length === 0 && documents.length === 0 && conversations.length === 0;

  // ── Empty State ──────────────────────────────────────────────────────────
  if (isWorkspaceEmpty) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl mx-auto py-10 space-y-8 text-center px-4"
      >
        {/* Hero empty state */}
        <div
          className="relative p-10 rounded-lg clay-card overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-[90px] opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(93,124,255,0.20) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
          <div className="relative z-10 space-y-5 max-w-lg mx-auto">
            <div className="flex justify-center">
              <motion.span
                animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-16 w-16 items-center justify-center rounded-3xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
              >
                <Brain className="h-8 w-8" aria-hidden="true" />
              </motion.span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight"
              style={{
                background: "linear-gradient(120deg, hsl(var(--foreground)) 0%, var(--primary) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Your learning journey starts here.
            </h1>
            <p className="text-sm text-muted-foreground/70 leading-relaxed">
              Upload your first document and let AI build{" "}
              <span className="text-foreground/80 font-semibold">summaries</span>,{" "}
              <span className="text-foreground/80 font-semibold">flashcards</span>,{" "}
              <span className="text-foreground/80 font-semibold">quizzes</span>,{" "}
              <span className="text-foreground/80 font-semibold">mind maps</span>, and{" "}
              <span className="text-foreground/80 font-semibold">study notes</span>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setActiveTab("documents")}
                aria-label="Upload Document"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl border border-primary/20"
                style={{
                  background: "linear-gradient(135deg, var(--primary) 0%, hsl(250,80%,55%) 100%)",
                  boxShadow: "0 4px 16px rgba(93,124,255,0.30)",
                }}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload Document
              </motion.button>
              <button
                onClick={handleCreateQuickNote}
                aria-label="Create Note"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold text-muted-foreground bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] rounded-xl transition-all"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create Note
              </button>
            </div>
          </div>
        </div>

        {/* Empty quick-starts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          {[
            {
              icon: <MessageSquare className="h-5 w-5" />,
              title: "NotebookLM Chat",
              desc: "Converse with your documents. Extract insights with source citations.",
              action: () => setActiveTab("chat"),
              cta: "Launch Chat",
              color: "text-amber-400",
              bg: "bg-amber-500/10",
              border: "border-amber-500/15",
            },
            {
              icon: <BookOpen className="h-5 w-5" />,
              title: "Load Quickstart",
              desc: "Load a demo note to explore inline AI highlights and markdown features.",
              action: async () => {
                try {
                  const sampleNote = await createNote({
                    title: "Welcome to NoteAI: Quickstart Guide 🚀",
                    content: `<h1>Getting Started with NoteAI</h1><p>NoteAI provides a premium Notion-like editor with inline AI helpers, a comprehensive RAG-based chat, and active studying spaces using Flashcards and Quizzes.</p><h2>Keyboard Shortcuts</h2><ul><li><strong>Open Command Palette</strong>: press <code>Ctrl + K</code></li><li><strong>Selection Menu</strong>: highlight text to open the floating AI Bubble Menu.</li></ul>`,
                  });
                  setActiveNoteId(sampleNote.id);
                  setActiveTab("notes");
                } catch {
                  alert("Failed to load demo.");
                }
              },
              cta: "Deploy Sample",
              color: "text-rose-400",
              bg: "bg-rose-500/10",
              border: "border-rose-500/15",
            },
          ].map((item) => (
            <div
              key={item.title}
              onClick={item.action}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && item.action()}
              aria-label={item.title}
              className={`group p-6 rounded-2xl border ${item.border} bg-white/[0.01] hover:bg-white/[0.025] cursor-pointer transition-all space-y-3 select-none`}
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.bg} ${item.border} border ${item.color}`} aria-hidden="true">
                {item.icon}
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="text-[10.5px] text-muted-foreground/65 mt-1 leading-relaxed">{item.desc}</p>
              </div>
              <div className={`flex items-center gap-1 text-[10px] font-bold ${item.color} group-hover:translate-x-0.5 transition-transform`}>
                {item.cta} <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // ── Full Dashboard ───────────────────────────────────────────────────────
  return (
    <div className="space-y-10 max-w-6xl mx-auto text-left pb-16 px-1">

      {/* ═══ 1. HERO ═══════════════════════════════════════════════════════ */}
      <AnimatedCard index={0}>
        <DashboardHero
          userName={user?.name || "Learner"}
          workspaceName={activeWorkspaceName}
          onResume={() => {
            if (recentNotes.length > 0) {
              setActiveNoteId(recentNotes[0].id);
              setActiveTab("notes");
            } else {
              setActiveTab("notes");
            }
          }}
        />
      </AnimatedCard>

      {/* ═══ 2. DAILY PROGRESS METRICS ═════════════════════════════════════ */}
      <AnimatedCard index={1}>
        <DashboardSection
          title="Today's Overview"
          icon={<Clock className="h-3.5 w-3.5" />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <DashboardMetric
              title="Notes"
              value={notes.length}
              growth={`${favoriteNotes.length} starred`}
              color="sky"
              icon={<BookOpen className="h-4 w-4" />}
              onClick={() => setActiveTab("notes")}
            />
            <DashboardMetric
              title="Documents"
              value={documents.length}
              growth={`${completedDocs.length} ready`}
              color="emerald"
              icon={<FileText className="h-4 w-4" />}
              onClick={() => setActiveTab("documents")}
            />
            <DashboardMetric
              title="Favorites"
              value={favoriteNotes.length}
              growth="Starred notes"
              color="amber"
              icon={<Star className="h-4 w-4" />}
              onClick={() => setActiveTab("notes")}
            />
            <DashboardMetric
              title="Folders"
              value={folders.length}
              growth="Organized"
              color="rose"
              icon={<Folder className="h-4 w-4" />}
              onClick={() => setActiveTab("folders")}
            />
            <DashboardMetric
              title="AI Chats"
              value={conversations.length}
              growth="RAG sessions"
              color="purple"
              icon={<MessageSquare className="h-4 w-4" />}
              onClick={() => setActiveTab("chat")}
            />
            <DashboardMetric
              title="Tags"
              value={tags.length}
              growth="Labels"
              color="indigo"
              icon={<Tag className="h-4 w-4" />}
              onClick={() => setActiveTab("notes")}
            />
          </div>
        </DashboardSection>
      </AnimatedCard>

      {/* ═══ 3. CONTINUE LEARNING ══════════════════════════════════════════ */}
      {(recentNotes.length > 0 || recentDocs.length > 0 || recentChats.length > 0) && (
        <AnimatedCard index={2}>
          <DashboardSection
            title="Continue Learning"
            icon={<ArrowRight className="h-3.5 w-3.5" />}
            action={
              <button
                onClick={() => setActiveTab("notes")}
                className="text-[9.5px] font-bold text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
                aria-label="View all"
              >
                View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentNotes.slice(0, 2).map((note, i) => (
                <ContinueLearningCard
                  key={note.id}
                  title={note.title || "Untitled Note"}
                  subtitle={note.updated_at ? `Updated ${new Date(note.updated_at).toLocaleDateString()}` : undefined}
                  type="note"
                  index={i}
                  onClick={() => {
                    setActiveNoteId(note.id);
                    setActiveTab("notes");
                  }}
                />
              ))}
              {recentDocs.slice(0, 1).map((doc, i) => (
                <ContinueLearningCard
                  key={doc.id}
                  title={doc.filename}
                  subtitle={isDocumentReady(doc.status) ? "Ready for study" : "Processing…"}
                  type="document"
                  index={i + 2}
                  onClick={() => setActiveTab("documents")}
                />
              ))}
              {recentChats.map((chat, i) => (
                <ContinueLearningCard
                  key={chat.id}
                  title={chat.title || "AI Chat Session"}
                  subtitle="Resume conversation"
                  type="chat"
                  index={i + 3}
                  onClick={() => setActiveTab("chat")}
                />
              ))}
            </div>
          </DashboardSection>
        </AnimatedCard>
      )}

      {/* ═══ 4. AI INSIGHTS ════════════════════════════════════════════════ */}
      <AnimatedCard index={3}>
        <DashboardSection
          title="AI Insights"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <AIInsightCard
              emoji="🧠"
              headline="Your notes are growing"
              body={`You have ${notes.length} note${notes.length !== 1 ? "s" : ""} in your workspace. Reviewing them regularly boosts long-term retention.`}
              cta="Review Notes"
              onCta={() => setActiveTab("notes")}
              variant="brain"
              index={0}
            />
            <AIInsightCard
              emoji="📚"
              headline={`${completedDocs.length} document${completedDocs.length !== 1 ? "s" : ""} ready for quizzes`}
              body="Your processed documents can be turned into AI-generated quizzes and flashcards in seconds."
              cta="Generate Quiz"
              onCta={() => setActiveTab("quizzes")}
              variant="book"
              index={1}
            />
            <AIInsightCard
              emoji="⭐"
              headline={favoriteNotes.length > 0 ? "Review your favorites" : "Start starring notes"}
              body={favoriteNotes.length > 0
                ? `You have ${favoriteNotes.length} starred note${favoriteNotes.length !== 1 ? "s" : ""}. These are your most important topics.`
                : "Star your most important notes to build a focused review queue."}
              cta="View Starred"
              onCta={() => setActiveTab("notes")}
              variant="weakness"
              index={2}
            />
            <AIInsightCard
              emoji="🔥"
              headline="Build your study streak"
              body={`You have ${conversations.length} AI chat session${conversations.length !== 1 ? "s" : ""}. Keep asking questions — active recall is the best study method.`}
              cta="Start Chat"
              onCta={() => setActiveTab("chat")}
              variant="streak"
              index={3}
            />
          </div>
        </DashboardSection>
      </AnimatedCard>

      {/* ═══ 5. KNOWLEDGE SNAPSHOT ════════════════════════════════════════ */}
      <AnimatedCard index={4}>
        <DashboardSection
          title="Knowledge Snapshot"
          icon={<Layers className="h-3.5 w-3.5" />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <KnowledgeCard
              icon={<BookOpen className="h-4.5 w-4.5" />}
              label="Notes"
              count={notes.length}
              description="Written knowledge"
              color="sky"
              onClick={() => setActiveTab("notes")}
              index={0}
            />
            <KnowledgeCard
              icon={<FileText className="h-4.5 w-4.5" />}
              label="Documents"
              count={documents.length}
              description="Indexed sources"
              color="emerald"
              onClick={() => setActiveTab("documents")}
              index={1}
            />
            <KnowledgeCard
              icon={<Folder className="h-4.5 w-4.5" />}
              label="Folders"
              count={folders.length}
              description="Organization"
              color="amber"
              onClick={() => setActiveTab("folders")}
              index={2}
            />
            <KnowledgeCard
              icon={<MessageSquare className="h-4.5 w-4.5" />}
              label="Chats"
              count={conversations.length}
              description="AI sessions"
              color="purple"
              onClick={() => setActiveTab("chat")}
              index={3}
            />
            <KnowledgeCard
              icon={<Star className="h-4.5 w-4.5" />}
              label="Favorites"
              count={favoriteNotes.length}
              description="Starred items"
              color="rose"
              onClick={() => setActiveTab("notes")}
              index={4}
            />
            <KnowledgeCard
              icon={<HelpCircle className="h-4.5 w-4.5" />}
              label="Quizzes"
              count={0}
              description="Self-assessment"
              color="indigo"
              onClick={() => setActiveTab("quizzes")}
              index={5}
            />
            <KnowledgeCard
              icon={<Tag className="h-4.5 w-4.5" />}
              label="Tags"
              count={tags.length}
              description="Labels"
              color="cyan"
              onClick={() => setActiveTab("notes")}
              index={6}
            />
          </div>
        </DashboardSection>
      </AnimatedCard>

      {/* ═══ 6. RECENT ACTIVITY + CHARTS (2-column) ════════════════════════ */}
      <AnimatedCard index={5}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Activity Timeline */}
          <div className="lg:col-span-1 space-y-4">
            <DashboardSection
              title="Recent Activity"
              icon={<Clock className="h-3.5 w-3.5" />}
            >
              <div
                className="rounded-2xl border border-white/[0.05] p-5"
                style={{ background: "rgba(255,255,255,0.012)" }}
              >
                <ActivityTimeline
                  notes={notes}
                  documents={documents}
                  folders={folders}
                  conversations={conversations}
                />
              </div>
            </DashboardSection>
          </div>

          {/* Charts */}
          <div className="lg:col-span-2">
            <DashboardCharts
              notes={notes}
              documents={documents}
              folders={folders}
              conversations={conversations}
            />
          </div>
        </div>
      </AnimatedCard>

      {/* ═══ 7. QUICK ACTIONS ══════════════════════════════════════════════ */}
      <AnimatedCard index={6}>
        <DashboardSection
          title="Quick Actions"
          icon={<Sparkles className="h-3.5 w-3.5" />}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <QuickActionCard
              label="Upload Document"
              description="Index a PDF or text file for AI study"
              icon={<Upload className="h-5 w-5" />}
              onClick={() => setActiveTab("documents")}
              color="emerald"
            />
            <QuickActionCard
              label="Create Note"
              description="Write with inline AI assistance"
              icon={<Plus className="h-5 w-5" />}
              onClick={handleCreateQuickNote}
              color="primary"
            />
            <QuickActionCard
              label="Start AI Chat"
              description="Ask your knowledge base anything"
              icon={<MessageSquare className="h-5 w-5" />}
              onClick={() => setActiveTab("chat")}
              color="amber"
            />
            <QuickActionCard
              label="Flashcards"
              description="Review and memorize key concepts"
              icon={<BookOpen className="h-5 w-5" />}
              onClick={() => setActiveTab("flashcards")}
              color="rose"
            />
            <QuickActionCard
              label="Generate Quiz"
              description="AI-powered quiz from your content"
              icon={<HelpCircle className="h-5 w-5" />}
              onClick={() => setActiveTab("quizzes")}
              color="purple"
            />
          </div>
        </DashboardSection>
      </AnimatedCard>

      {/* ═══ 8. UPCOMING REVIEW ════════════════════════════════════════════ */}
      {notes.length > 0 && (
        <AnimatedCard index={7}>
          <DashboardSection
            title="Upcoming Review"
            icon={<Brain className="h-3.5 w-3.5" />}
            action={
              <button
                onClick={() => setActiveTab("flashcards")}
                className="text-[9.5px] font-bold text-amber-400/80 hover:text-amber-400 transition-colors flex items-center gap-1"
                aria-label="View all flashcards"
              >
                View all <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {notes.slice(0, 3).map((note, i) => (
                <motion.div
                  key={note.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="relative p-4 rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/6 to-transparent space-y-3 hover:border-amber-500/30 transition-colors"
                  style={{ boxShadow: "0 4px 16px rgba(245,158,11,0.08)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-[11.5px] font-bold text-foreground/85 truncate leading-tight flex-1">
                      {note.title || "Untitled Note"}
                    </h4>
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                      Due
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setActiveNoteId(note.id);
                        setActiveTab("flashcards");
                      }}
                      aria-label={`Study flashcards for ${note.title}`}
                      className="flex-1 py-1.5 px-2 text-[9.5px] font-bold rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      Flashcards
                    </button>
                    <button
                      onClick={() => {
                        setActiveNoteId(note.id);
                        setActiveTab("quizzes");
                      }}
                      aria-label={`Quiz for ${note.title}`}
                      className="flex-1 py-1.5 px-2 text-[9.5px] font-bold rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all active:scale-95 cursor-pointer"
                    >
                      Quiz
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </DashboardSection>
        </AnimatedCard>
      )}
    </div>
  );
};

export default DashboardOverview;
