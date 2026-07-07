import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, FolderPlus, MessageSquare, StickyNote, BookOpen } from "lucide-react";

interface NoteItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface DocumentItem {
  id: string;
  filename: string;
  created_at: string;
}

interface FolderItem {
  id: string;
  name: string;
  created_at: string;
}

interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
}

interface ActivityTimelineProps {
  notes?: NoteItem[];
  documents?: DocumentItem[];
  folders?: FolderItem[];
  conversations?: ConversationItem[];
}

interface TimelineItem {
  id: string;
  type: "note" | "document" | "folder" | "chat";
  label: string;
  detail: string;
  date: Date;
}

const timeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const typeConfig = {
  note: {
    icon: <StickyNote className="h-3.5 w-3.5" />,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/25",
    dot: "bg-sky-500",
    line: "bg-sky-500/20",
  },
  document: {
    icon: <FileText className="h-3.5 w-3.5" />,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    dot: "bg-emerald-500",
    line: "bg-emerald-500/20",
  },
  folder: {
    icon: <FolderPlus className="h-3.5 w-3.5" />,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    dot: "bg-amber-500",
    line: "bg-amber-500/20",
  },
  chat: {
    icon: <MessageSquare className="h-3.5 w-3.5" />,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/25",
    dot: "bg-purple-500",
    line: "bg-purple-500/20",
  },
};

const itemVariants = {
  initial: { opacity: 0, x: -12 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 160, damping: 18 },
  },
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  notes = [],
  documents = [],
  folders = [],
  conversations = [],
}) => {
  const shouldReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    notes.forEach((note) => {
      items.push({
        id: `note-${note.id}`,
        type: "note",
        label: "Created Note",
        detail: note.title || "Untitled Note",
        date: new Date(note.created_at),
      });
      const createTime = new Date(note.created_at).getTime();
      const updateTime = new Date(note.updated_at).getTime();
      if (updateTime - createTime > 120000) {
        items.push({
          id: `note-mod-${note.id}-${note.updated_at}`,
          type: "note",
          label: "Updated Note",
          detail: note.title || "Untitled Note",
          date: new Date(note.updated_at),
        });
      }
    });

    documents.forEach((doc) => {
      items.push({
        id: `doc-${doc.id}`,
        type: "document",
        label: "Uploaded Document",
        detail: doc.filename,
        date: new Date(doc.created_at),
      });
    });

    folders.forEach((folder) => {
      items.push({
        id: `folder-${folder.id}`,
        type: "folder",
        label: "Created Folder",
        detail: folder.name,
        date: new Date(folder.created_at),
      });
    });

    conversations.forEach((chat) => {
      items.push({
        id: `chat-${chat.id}`,
        type: "chat",
        label: "Started AI Chat",
        detail: chat.title || "RAG Session",
        date: new Date(chat.created_at),
      });
    });

    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 7);
  }, [notes, documents, folders, conversations]);

  if (timelineItems.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-8 text-center space-y-3">
        <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto" aria-hidden="true" />
        <p className="text-sm font-bold text-foreground/50">Your learning journey starts here</p>
        <p className="text-[10px] text-muted-foreground/40 max-w-xs mx-auto leading-relaxed">
          Upload your first document and let AI build summaries, flashcards, quizzes, and study notes.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative flex flex-col"
      aria-label="Recent activity timeline"
    >
      {timelineItems.map((item, index) => {
        const cfg = typeConfig[item.type];
        const isLast = index === timelineItems.length - 1;

        return (
          <motion.div
            key={item.id}
            variants={shouldReduceMotion ? {} : itemVariants}
            initial="initial"
            animate="animate"
            transition={{ delay: index * 0.06 }}
            className="relative flex items-start gap-4 pb-5"
          >
            {/* Vertical connector line */}
            {!isLast && (
              <div className={`absolute left-[14px] top-8 w-[1.5px] bottom-0 ${cfg.line} z-0`} />
            )}

            {/* Node icon */}
            <div
              className={`relative z-10 shrink-0 flex h-7 w-7 items-center justify-center rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}
              aria-hidden="true"
            >
              {cfg.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11.5px] font-bold text-foreground/80 leading-none">
                  {item.label}
                </span>
                <span className="text-[9px] text-muted-foreground/40 font-mono shrink-0 tabular-nums">
                  {timeAgo(item.date)}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/55 mt-1 truncate max-w-full">
                {item.detail}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
};
