import React from "react";
import { Cpu, ShieldCheck, Activity, Database, Sparkles } from "lucide-react";
import { DashboardCard } from "./DashboardCard";

interface AIStatusPanelProps {
  documents?: Array<{ status: string }>;
}

export const AIStatusPanel: React.FC<AIStatusPanelProps> = ({ documents = [] }) => {
  const shouldReduceMotion = typeof window !== "undefined" && 
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Determine knowledge base state based on document processing status
  const isSyncing = documents.some(
    (d) => d.status.toUpperCase() === "PENDING" || d.status.toUpperCase() === "PROCESSING"
  );

  return (
    <DashboardCard className="flex flex-col h-full bg-white/[0.01] border border-white/[0.03] rounded-2xl p-5 gap-4">
      {/* Header telemetry ribbon */}
      <div className="flex justify-between items-center pb-3 border-b border-white/[0.02]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 flex items-center gap-2 text-left">
          <Cpu className="h-4 w-4 text-primary" /> AI System Telemetry
        </h3>
        
        {/* Heartbeat Status Dot */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {!shouldReduceMotion && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest font-mono">
            Online
          </span>
        </div>
      </div>

      {/* Control panel status rows */}
      <div className="space-y-3 flex-grow text-left font-mono">
        {/* Vector DB */}
        <div className="flex justify-between items-center py-1.5 border-b border-white/[0.01]">
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-primary/75" /> Vector Engine
          </span>
          <span className="text-[10px] font-bold text-foreground/80 bg-white/[0.03] border border-white/[0.04] px-2 py-0.5 rounded shadow-sm">
            pgvector
          </span>
        </div>

        {/* Embeddings Provider */}
        <div className="flex justify-between items-center py-1.5 border-b border-white/[0.01]">
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500/75" /> Embeddings
          </span>
          <span className="text-[10px] font-bold text-foreground/80 bg-white/[0.03] border border-white/[0.04] px-2 py-0.5 rounded shadow-sm">
            gemini-2.5
          </span>
        </div>

        {/* Index Type */}
        <div className="flex justify-between items-center py-1.5 border-b border-white/[0.01]">
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-cyan-500/75" /> Vector Metric
          </span>
          <span className="text-[10px] font-bold text-foreground/80 bg-white/[0.03] border border-white/[0.04] px-2 py-0.5 rounded shadow-sm">
            Cosine Sim
          </span>
        </div>

        {/* Knowledge Base state */}
        <div className="flex justify-between items-center py-1.5">
          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/75" /> Knowledge Graph
          </span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shadow-sm ${
            isSyncing 
              ? "text-amber-500 bg-amber-500/10 border-amber-500/20 animate-pulse" 
              : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
          }`}>
            {isSyncing ? "Syncing..." : "Ready"}
          </span>
        </div>
      </div>
    </DashboardCard>
  );
};
