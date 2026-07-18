import React from "react";
import { KnowledgeSource } from "@/types";
import { KnowledgeSourceIcon } from "./KnowledgeSourceIcon";
import { KnowledgeSourceBadge } from "./KnowledgeSourceBadge";
import { Star } from "lucide-react";
import { isDocumentReady, isDocumentProcessing } from "@/lib/document-status";

interface KnowledgeSourceCardProps {
  source: KnowledgeSource;
  isSelected: boolean;
  onClick: () => void;
}

const formatDistanceToNow = (date: Date, options?: { addSuffix?: boolean }) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let result = "";
  if (diffSecs < 60) {
    result = "just now";
  } else if (diffMins < 60) {
    result = `${diffMins}m`;
  } else if (diffHours < 24) {
    result = `${diffHours}h`;
  } else {
    result = `${diffDays}d`;
  }

  if (options?.addSuffix && result !== "just now") {
    return `${result} ago`;
  }
  return result;
};

export const KnowledgeSourceCard: React.FC<KnowledgeSourceCardProps> = ({
  source,
  isSelected,
  onClick,
}) => {
  const isDoc = source.source_type === "document";
  const isFav = source.metadata.is_favorite ?? false;

  // Formatting date nicely
  const getFormattedTime = () => {
    try {
      return formatDistanceToNow(new Date(source.updated_at), { addSuffix: true });
    } catch (e) {
      return "recently";
    }
  };

  const isReady = isDocumentReady(source.status);
  const isProcessing = isDocumentProcessing(source.status);

  return (
    <button
      onClick={onClick}
      disabled={isProcessing}
      className={`w-full text-left p-3.5 rounded-2xl transition-all duration-300 flex items-start gap-3 border ${
        isSelected
          ? isDoc
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md"
            : "bg-primary/10 border-primary/30 text-primary shadow-md"
          : "bg-card/45 hover:bg-card/90 text-muted-foreground hover:text-foreground border-border/40"
      } ${
        isProcessing
          ? "opacity-60 cursor-not-allowed"
          : "cursor-pointer"
      }`}
    >
      <div className="shrink-0 mt-0.5">
        <KnowledgeSourceIcon type={source.source_type} className="h-4.5 w-4.5" />
      </div>

      <div className="flex-grow min-w-0 text-left">
        <div className="flex items-center gap-1.5 justify-between">
          <span className={`font-bold text-xs truncate ${isSelected ? "text-foreground" : "text-foreground/90"}`}>
            {source.title}
          </span>
          {isFav && <Star className="h-3 w-3 fill-amber-500 text-amber-500 shrink-0" />}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px]">
          <span className="capitalize font-semibold tracking-wider px-1.5 py-0.5 rounded bg-muted/65 text-muted-foreground/90">
            {source.source_type}
          </span>
          <span className="text-muted-foreground/60">{getFormattedTime()}</span>
          {isDoc && !isReady && (
            <KnowledgeSourceBadge status={source.status} />
          )}
        </div>
      </div>
    </button>
  );
};
