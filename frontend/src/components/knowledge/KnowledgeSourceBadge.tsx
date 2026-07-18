import React from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { normalizeStatus, isDocumentReady, isDocumentFailed } from "@/lib/document-status";

interface KnowledgeSourceBadgeProps {
  status: string;
}

export const KnowledgeSourceBadge: React.FC<KnowledgeSourceBadgeProps> = ({ status }) => {
  const s = normalizeStatus(status);
  
  if (isDocumentReady(s)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
        <CheckCircle2 className="h-2.5 w-2.5" /> Ready
      </span>
    );
  }
  
  if (isDocumentFailed(s)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-500 border border-red-500/20">
        <AlertCircle className="h-2.5 w-2.5" /> Failed
      </span>
    );
  }
  
  if (s === "pending") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted-foreground/10 text-muted-foreground">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Pending
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
      <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" /> Processing
    </span>
  );
};
