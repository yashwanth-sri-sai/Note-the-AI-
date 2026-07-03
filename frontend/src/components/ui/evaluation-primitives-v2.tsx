import React from "react";
import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown, Minus, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ═══════════════════════════════════════════════════════════
   APPLE-LEVEL DESIGN SYSTEM TOKENS
   ═══════════════════════════════════════════════════════════ */

export const V2_CHART_COLORS = {
  recall:        "#3b82f6", // soft blue
  precision:     "#6366f1", // soft indigo
  groundedness:  "#8b5cf6", // soft violet
  hallucination: "#ef4444", // soft red
  latency:       "#f57c00", // warm orange
  quality:       "#10b981", // soft green
};

export const V2_FAILURE_COLORS: Record<string, string> = {
  RETRIEVAL_FAILURE: "#ef4444", // Red
  RERANK_FAILURE:    "#f97316", // Orange
  CHUNKING_FAILURE:  "#eab308", // Yellow
  PROMPT_FAILURE:    "#8b5cf6", // Violet
  HALLUCINATION:     "#ec4899", // Pink
  CITATION_FAILURE:  "#06b6d4", // Cyan
  UNKNOWN:           "#64748b",
};

export const v2SpringTransition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
};

/* ═══════════════════════════════════════════════════════════
   RECHARTS MINIMAL TOOLTIP STYLE
   ═══════════════════════════════════════════════════════════ */
export const v2TooltipStyle = {
  contentStyle: {
    backgroundColor: "rgba(15, 17, 23, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.04)",
    borderRadius: "8px",
    fontSize: "11px",
    fontFamily: "Inter, sans-serif",
    padding: "6px 10px",
    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
    color: "#f3f4f6",
    backdropFilter: "blur(8px)",
  },
  itemStyle: { color: "#9ca3af", fontSize: "11px", padding: "1px 0" },
  cursor: { stroke: "rgba(255, 255, 255, 0.04)", strokeWidth: 1 },
};

/* ═══════════════════════════════════════════════════════════
   SECTION HEADER V2
   ═══════════════════════════════════════════════════════════ */

interface SectionHeaderV2Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const SectionHeaderV2: React.FC<SectionHeaderV2Props> = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between py-1 shrink-0">
    <div className="space-y-0.5">
      <h3 className="text-xs font-semibold text-foreground/80 tracking-tight">{title}</h3>
      {subtitle && <p className="text-[10px] text-muted-foreground/50 tracking-normal">{subtitle}</p>}
    </div>
    {action}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   GLASS PANEL V2 — Clean, flat layout frames
   ═══════════════════════════════════════════════════════════ */

interface GlassPanelV2Props {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const GlassPanelV2: React.FC<GlassPanelV2Props> = ({ children, className = "", noPadding }) => (
  <div className={`
    bg-surface/30
    border border-white/[0.02]
    rounded-xl
    shadow-sm
    ${noPadding ? "" : "p-6"}
    ${className}
  `}>
    {children}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   METRIC STRIP — Sleek, borderless metric counters
   ═══════════════════════════════════════════════════════════ */

interface MetricCardV2Props {
  label: string;
  value: string | number;
  suffix?: string;
  icon?: LucideIcon;
  accentColor: string;
  delta?: number | null;
  isLoading?: boolean;
  isPrimary?: boolean;
}

export const MetricCardV2: React.FC<MetricCardV2Props> = ({
  label, value, suffix, delta, isLoading, isPrimary
}) => {
  return (
    <div className="flex flex-col justify-between py-1 relative">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-14 rounded" />
          <Skeleton className="h-6 w-20 rounded" />
        </div>
      ) : (
        <>
          <span className="text-[10px] font-medium text-muted-foreground/45 uppercase tracking-[0.1em]">{label}</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className={`text-xl font-semibold tracking-tight leading-none ${isPrimary ? "text-emerald-400" : "text-foreground/90"}`}>
              {value}
            </span>
            {suffix && <span className="text-[11px] text-muted-foreground/40 font-medium">{suffix}</span>}
          </div>
          {delta !== undefined && delta !== null && (
            <div className={`flex items-center gap-1 mt-1.5 text-[9px] font-medium ${
              delta > 0 ? "text-emerald-400/80" : delta < 0 ? "text-red-400/80" : "text-muted-foreground/40"
            }`}>
              {delta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : delta < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />}
              <span>{delta > 0 ? "+" : ""}{(delta * 100).toFixed(1)}%</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   RATIO BAR — Apple-style clean visual progress breakdown
   ═══════════════════════════════════════════════════════════ */

interface RatioBarItem {
  key: string;
  name: string;
  value: number;
}

interface RatioBarProps {
  data: RatioBarItem[];
  total: number;
}

export const RatioBar: React.FC<RatioBarProps> = ({ data, total }) => {
  if (total === 0) return <EmptyStateV2 title="No failures" description="All checks passed successfully." />;

  return (
    <div className="space-y-4 w-full">
      {/* Visual segment progress bar */}
      <div className="h-2.5 w-full bg-white/[0.02] rounded-full overflow-hidden flex">
        {data.map((item) => {
          const widthPct = (item.value / total) * 100;
          const color = V2_FAILURE_COLORS[item.key] || "#64748b";
          return (
            <div
              key={item.key}
              style={{ width: `${widthPct}%`, backgroundColor: color }}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
              title={`${item.name}: ${item.value} (${widthPct.toFixed(0)}%)`}
            />
          );
        })}
      </div>

      {/* Structured Clean Legends */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2">
        {data.map((item) => {
          const color = V2_FAILURE_COLORS[item.key] || "#64748b";
          const pct = ((item.value / total) * 100).toFixed(0);
          return (
            <div key={item.key} className="flex items-center justify-between text-[11px] py-0.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-muted-foreground/60 font-medium">{item.name}</span>
              </div>
              <span className="font-mono text-muted-foreground/40 tabular-nums">
                {item.value} <span className="text-[9px] text-muted-foreground/25">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   STATUS BADGE V2
   ═══════════════════════════════════════════════════════════ */

export const StatusBadgeV2: React.FC<{ status: string }> = ({ status }) => {
  if (status === "NONE") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-emerald-400/90 tracking-wide">
        <span className="h-1 w-1 rounded-full bg-emerald-400" />
        Pass
      </span>
    );
  }
  const color = V2_FAILURE_COLORS[status] || "#64748b";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wide"
      style={{ color: `${color}DD` }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: color }} />
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE V2
   ═══════════════════════════════════════════════════════════ */

export const EmptyStateV2: React.FC<{ title: string; description: string; icon?: LucideIcon }> = ({
  title, description, icon: Icon
}) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    {Icon && (
      <div className="h-9 w-9 rounded-lg bg-white/[0.01] flex items-center justify-center mb-3.5 border border-white/[0.02]">
        <Icon className="h-4.5 w-4.5 text-muted-foreground/30" />
      </div>
    )}
    <h4 className="text-[12px] font-medium text-foreground/75 mb-1">{title}</h4>
    <p className="text-[10px] text-muted-foreground/45 max-w-[200px] leading-normal">{description}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   OVERVIEW SKELETON V2
   ═══════════════════════════════════════════════════════════ */

export const OverviewSkeletonV2: React.FC = () => (
  <div className="space-y-6 animate-in fade-in duration-300">
    <div className="flex items-center justify-between border-b border-white/[0.02] pb-5">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-2 w-12 rounded" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4 h-[300px]">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
      <div className="space-y-4 h-[300px]">
        <Skeleton className="h-3.5 w-20 rounded" />
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </div>
  </div>
);
