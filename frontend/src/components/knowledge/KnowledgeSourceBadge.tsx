import React from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface KnowledgeSourceBadgeProps {
  status: "pending" | "processing" | "completed" | "failed" | "ready";
}

export const KnowledgeSourceBadge: React.FC<KnowledgeSourceBadgeProps> = ({ status }) => {
  switch (status) {
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted-foreground/10 text-muted-foreground">
          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Pending
        </span>
      );
    case "processing":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
          <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" /> Processing
        </span>
      );
    case "completed":
    case "ready":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <CheckCircle2 className="h-2.5 w-2.5" /> Ready
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
          <AlertCircle className="h-2.5 w-2.5" /> Failed
        </span>
      );
    default:
      return null;
  }
};
