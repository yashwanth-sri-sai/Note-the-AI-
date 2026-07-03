import React from "react";
import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown, Minus, ShieldCheck, Loader2, Inbox } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS — Evaluation Dashboard
   ═══════════════════════════════════════════════════════════ */

export const EVAL_CHART_PALETTE = {
  recall:        "#60a5fa", // blue-400
  precision:     "#818cf8", // indigo-400
  groundedness:  "#a78bfa", // violet-400
  hallucination: "#f87171", // red-400
  latency:       "#fb923c", // orange-400
  quality:       "#34d399", // emerald-400
};

export const EVAL_FAILURE_PALETTE: Record<string, string> = {
  RETRIEVAL_FAILURE: "#f87171",
  RERANK_FAILURE:    "#fb923c",
  CHUNKING_FAILURE:  "#fbbf24",
  PROMPT_FAILURE:    "#818cf8",
  HALLUCINATION:     "#f472b6",
  CITATION_FAILURE:  "#38bdf8",
  UNKNOWN:           "#6b7280",
};

/* ═══════════════════════════════════════════════════════════
   SECTION HEADER
   ═══════════════════════════════════════════════════════════ */

interface SectionHeaderProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  iconColor?: string;
  action?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon: Icon, title, subtitle, iconColor = "text-primary", action }) => (
  <div className="flex items-center justify-between mb-1">
    <div className="flex items-center gap-2.5">
      {Icon && <Icon className={`h-4 w-4 ${iconColor} opacity-70`} />}
      <div>
        <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   GLASS PANEL — Wrapper for chart/table sections
   ═══════════════════════════════════════════════════════════ */

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = "", padding = "md" }) => {
  const paddings = { sm: "p-4", md: "p-5", lg: "p-6" };
  return (
    <div className={`bg-surface border border-border/40 rounded-2xl ${paddings[padding]} ${className}`}>
      {children}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   METRIC CARD — Single KPI with optional delta
   ═══════════════════════════════════════════════════════════ */

interface MetricCardProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  accentColor: string;       // e.g. "emerald" | "blue" | "purple" | "rose"
  delta?: number | null;     // +0.05 means +5%
  isLoading?: boolean;
  isPrimary?: boolean;       // If true, gets hero treatment
}

const cardItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label, value, suffix, icon: Icon, accentColor, delta, isLoading, isPrimary
}) => {
  const colorMap: Record<string, { ring: string; text: string; bg: string; glow: string }> = {
    emerald: { ring: "ring-emerald-500/20", text: "text-emerald-400", bg: "bg-emerald-500/8", glow: "shadow-emerald-500/5" },
    blue:    { ring: "ring-blue-500/20",    text: "text-blue-400",    bg: "bg-blue-500/8",    glow: "shadow-blue-500/5" },
    purple:  { ring: "ring-purple-500/20",  text: "text-purple-400",  bg: "bg-purple-500/8",  glow: "shadow-purple-500/5" },
    rose:    { ring: "ring-rose-500/20",    text: "text-rose-400",    bg: "bg-rose-500/8",    glow: "shadow-rose-500/5" },
    amber:   { ring: "ring-amber-500/20",   text: "text-amber-400",   bg: "bg-amber-500/8",   glow: "shadow-amber-500/5" },
    indigo:  { ring: "ring-indigo-500/20",  text: "text-indigo-400",  bg: "bg-indigo-500/8",  glow: "shadow-indigo-500/5" },
  };

  const c = colorMap[accentColor] || colorMap.blue;

  return (
    <motion.div variants={cardItem} className={`group relative bg-surface border border-border/40 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${c.glow} ${isPrimary ? 'ring-1 ' + c.ring : ''}`}>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-28" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            <div className={`h-8 w-8 rounded-xl ${c.bg} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
              <Icon className={`h-4 w-4 ${c.text}`} />
            </div>
          </div>
          <div className="flex items-end gap-1.5">
            <span className={`text-2xl font-bold tracking-tight ${isPrimary ? c.text : 'text-foreground'}`}>
              {value}
            </span>
            {suffix && <span className="text-sm text-muted-foreground font-medium mb-0.5">{suffix}</span>}
          </div>
          {delta !== undefined && delta !== null && (
            <div className={`flex items-center gap-1 mt-2 text-[11px] font-semibold ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              <span>{delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}% vs last run</span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════════
   STATUS BADGE
   ═══════════════════════════════════════════════════════════ */

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  if (status === "NONE") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold tracking-wide">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        PASS
      </span>
    );
  }
  const color = EVAL_FAILURE_PALETTE[status] || "#6b7280";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide"
      style={{ backgroundColor: `${color}15`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {status.replace(/_/g, " ")}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════ */

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon: Icon = Inbox }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
      <Icon className="h-6 w-6 text-muted-foreground/50" />
    </div>
    <h4 className="text-sm font-semibold text-foreground/80 mb-1">{title}</h4>
    <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   LOADING SKELETON — Overview Tab
   ═══════════════════════════════════════════════════════════ */

export const OverviewSkeleton: React.FC = () => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-surface border border-border/40 rounded-2xl p-5 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-surface border border-border/40 rounded-2xl p-5 h-[320px]">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-full w-full rounded-xl" />
      </div>
      <div className="bg-surface border border-border/40 rounded-2xl p-5 h-[320px]">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-full w-full rounded-xl" />
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   RECHARTS TOOLTIP — Shared premium tooltip
   ═══════════════════════════════════════════════════════════ */

export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(220 20% 11.8%)',
    borderColor: 'hsl(219 21% 15.9% / 0.6)',
    borderRadius: '12px',
    fontSize: '11px',
    padding: '10px 14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    color: '#f5f7fa',
  },
  itemStyle: {
    color: '#a7b1c2',
    fontSize: '11px',
    padding: '2px 0',
  },
  cursor: { stroke: 'hsl(229 100% 68.2% / 0.2)', strokeWidth: 1 },
};
