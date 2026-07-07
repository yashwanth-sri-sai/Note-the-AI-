import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, FileText, StickyNote, MessageSquare, HelpCircle, BookOpen } from "lucide-react";

export type ContinueLearningType = "note" | "document" | "chat" | "quiz" | "flashcard";

interface ContinueLearningCardProps {
  title: string;
  subtitle?: string;
  progress?: number; // 0-100
  type: ContinueLearningType;
  onClick: () => void;
  index?: number;
}

const typeConfig: Record<ContinueLearningType, {
  icon: React.ReactNode;
  label: string;
  accent: string;
  bg: string;
  border: string;
  stripe: string;
}> = {
  note: {
    icon: <StickyNote className="h-4 w-4" />,
    label: "Note",
    accent: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    stripe: "bg-sky-500",
  },
  document: {
    icon: <FileText className="h-4 w-4" />,
    label: "Document",
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    stripe: "bg-emerald-500",
  },
  chat: {
    icon: <MessageSquare className="h-4 w-4" />,
    label: "AI Chat",
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    stripe: "bg-amber-500",
  },
  quiz: {
    icon: <HelpCircle className="h-4 w-4" />,
    label: "Quiz",
    accent: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    stripe: "bg-rose-500",
  },
  flashcard: {
    icon: <BookOpen className="h-4 w-4" />,
    label: "Flashcards",
    accent: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    stripe: "bg-purple-500",
  },
};

export const ContinueLearningCard: React.FC<ContinueLearningCardProps> = ({
  title,
  subtitle,
  progress,
  type,
  onClick,
  index = 0,
}) => {
  const shouldReduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cfg = typeConfig[type] ?? typeConfig.note;
  const clampedProgress = Math.min(100, Math.max(0, progress ?? 0));

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.07,
        duration: 0.38,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={shouldReduceMotion ? {} : { y: -3, scale: 1.012 }}
      whileTap={shouldReduceMotion ? {} : { scale: 0.98 }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`Continue ${cfg.label}: ${title}`}
      className="relative group flex items-stretch gap-0 rounded-2xl border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.035] hover:border-white/[0.09] cursor-pointer transition-colors duration-200 overflow-hidden select-none"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.18)" }}
    >
      {/* Left accent stripe */}
      <div className={`w-1 shrink-0 ${cfg.stripe} opacity-70 rounded-l-2xl`} />

      {/* Content */}
      <div className="flex-1 p-4 space-y-2.5 min-w-0">
        {/* Type badge */}
        <div className="flex items-center gap-1.5">
          <span className={`flex items-center justify-center h-6 w-6 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.accent}`}>
            {cfg.icon}
          </span>
          <span className={`text-[9.5px] font-bold uppercase tracking-widest ${cfg.accent}`}>
            {cfg.label}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-foreground/90 truncate leading-tight">
          {title}
        </h4>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-[10px] text-muted-foreground/60 truncate">{subtitle}</p>
        )}

        {/* Progress bar */}
        {progress !== undefined && (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-muted-foreground/50 font-medium">Progress</span>
              <span className={`text-[9px] font-bold ${cfg.accent}`}>{clampedProgress}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${clampedProgress}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: index * 0.07 + 0.2 }}
                className={`h-full rounded-full ${cfg.stripe} opacity-80`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Resume arrow */}
      <div className="flex items-center pr-4 pl-1">
        <div className={`flex items-center gap-1 text-[10px] font-bold ${cfg.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
          <span>Resume</span>
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
        <ArrowRight className={`h-4 w-4 ${cfg.accent} opacity-30 group-hover:opacity-0 transition-opacity absolute right-4`} />
      </div>
    </motion.div>
  );
};
