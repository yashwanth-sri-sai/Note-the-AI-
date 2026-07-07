import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FileText, FolderPlus, MessageSquare, StickyNote, CalendarRange } from "lucide-react";
import { DashboardCard } from "./DashboardCard";

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
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  notes = [],
  documents = [],
  folders = [],
  conversations = [],
}) => {
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    // 1. Process Notes
    notes.forEach((note) => {
      items.push({
        id: `note-${note.id}`,
        type: "note",
        label: "Created Note",
        detail: note.title || "Untitled Note",
        date: new Date(note.created_at),
      });
      
      // If note has been modified substantially after creation, record modification
      const createTime = new Date(note.created_at).getTime();
      const updateTime = new Date(note.updated_at).getTime();
      if (updateTime - createTime > 120000) { // > 2 minutes difference
        items.push({
          id: `note-mod-${note.id}-${note.updated_at}`,
          type: "note",
          label: "Modified Note",
          detail: note.title || "Untitled Note",
          date: new Date(note.updated_at),
        });
      }
    });

    // 2. Process Documents
    documents.forEach((doc) => {
      items.push({
        id: `doc-${doc.id}`,
        type: "document",
        label: "Uploaded Knowledge",
        detail: doc.filename,
        date: new Date(doc.created_at),
      });
    });

    // 3. Process Folders
    folders.forEach((folder) => {
      items.push({
        id: `folder-${folder.id}`,
        type: "folder",
        label: "Created Folder",
        detail: folder.name,
        date: new Date(folder.created_at),
      });
    });

    // 4. Process Conversations
    conversations.forEach((chat) => {
      items.push({
        id: `chat-${chat.id}`,
        type: "chat",
        label: "Started AI Chat Session",
        detail: chat.title || "RAG Context Query",
        date: new Date(chat.created_at),
      });
    });

    // Sort items by date descending, take top 5
    return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);
  }, [notes, documents, folders, conversations]);

  const containerVariants = {
    initial: {},
    animate: {
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    initial: { opacity: 0, x: -10 },
    animate: { 
      opacity: 1, 
      x: 0,
      transition: { type: "spring", stiffness: 150, damping: 16 }
    },
  };

  const getTimelineIcon = (type: "note" | "document" | "folder" | "chat") => {
    switch (type) {
      case "note":
        return <StickyNote className="h-3.5 w-3.5 text-sky-500" />;
      case "document":
        return <FileText className="h-3.5 w-3.5 text-emerald-500" />;
      case "folder":
        return <FolderPlus className="h-3.5 w-3.5 text-rose-500" />;
      case "chat":
        return <MessageSquare className="h-3.5 w-3.5 text-amber-500" />;
    }
  };

  const getTimelineColor = (type: "note" | "document" | "folder" | "chat") => {
    switch (type) {
      case "note": return "border-sky-500/25 bg-sky-500/10";
      case "document": return "border-emerald-500/25 bg-emerald-500/10";
      case "folder": return "border-rose-500/25 bg-rose-500/10";
      case "chat": return "border-amber-500/25 bg-amber-500/10";
    }
  };

  return (
    <div className="space-y-4 text-left">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xs font-bold uppercase text-muted-foreground/60 tracking-wider flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-primary" /> Workspace Activity Log
        </h2>
      </div>

      <DashboardCard className="bg-white/[0.01] border border-white/[0.03] rounded-2xl p-5">
        {timelineItems.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground/45">
            No activity logged in this workspace yet. Write notes or index files to populate.
          </div>
        ) : (
          <motion.div
            variants={shouldReduceMotion ? {} : containerVariants}
            initial="initial"
            animate="animate"
            className="relative flex flex-col gap-6 pl-2"
          >
            {timelineItems.map((item, index) => {
              const isLast = index === timelineItems.length - 1;
              return (
                <motion.div
                  key={item.id}
                  variants={shouldReduceMotion ? {} : itemVariants}
                  className="flex items-start gap-4 relative"
                >
                  {/* Connecting Line */}
                  {!isLast && (
                    <div className="absolute left-3.5 top-7 w-[1.5px] -bottom-7 bg-white/[0.03] z-0" />
                  )}

                  {/* Circular Node */}
                  <div className={`relative z-10 h-7 w-7 rounded-full flex items-center justify-center border shrink-0 ${getTimelineColor(item.type)}`}>
                    {getTimelineIcon(item.type)}
                  </div>

                  {/* Activity Details */}
                  <div className="flex-grow pt-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-bold text-foreground/80 leading-none">
                        {item.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground/40 font-mono shrink-0">
                        {timeAgo(item.date)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 truncate max-w-full">
                      {item.detail}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </DashboardCard>
    </div>
  );
};
