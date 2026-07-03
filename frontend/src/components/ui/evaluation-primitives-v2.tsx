import React from "react";
import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown, Minus, Inbox, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ═══════════════════════════════════════════════════════════
   V2 DESIGN TOKENS
   Inspired by: Linear, Vercel, Stripe, OpenAI
   ═══════════════════════════════════════════════════════════ */

export const V2_CHART_COLORS = {
  recall:        "#60a5fa",
  precision:     "#818cf8",
  groundedness:  "#a78bfa",
  hallucination: "#f87171",
  latency:       "#fb923c",
  quality:       "#34d399",
};

export const V2_FAILURE_COLORS: Record<string, string> = {
  RETRIEVAL_FAILURE: "#ef4444",
  RERANK_FAILURE:    "#f97316",
  CHUNKING_FAILURE:  "#eab308",
  PROMPT_FAILURE:    "#8b5cf6",
  HALLUCINATION:     "#ec4899",
  CITATION_FAILURE:  "#06b6d4",
  UNKNOWN:           "#64748b",
};

/* ═══════════════════════════════════════════════════════════
   TOOLTIP STYLE
   ═══════════════════════════════════════════════════════════ */
export const v2TooltipStyle = {
  contentStyle: {
    backgroundColor: 'hsl(225 21.1% 7.5% / 0.95)',
    border: '1px solid hsl(219 21% 15.9% / 0.5)',
    borderRadius: '10px',
    fontSize: '11px',
    fontFamily: 'Inter, sans-serif',
    padding: '8px 12px',
    boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
    color: '#e2e8f0',
    backdropFilter: 'blur(12px)',
  },
  itemStyle: { color: '#94a3b8', fontSize: '11px', padding: '1px 0' },
  cursor: { stroke: 'hsl(229 100% 68.2% / 0.15)', strokeWidth: 1 },
};

/* ═══════════════════════════════════════════════════════════
   SECTION HEADER V2
   ═══════════════════════════════════════════════════════════ */

interface SectionHeaderV2Props {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  action?: React.ReactNode;
}

export const SectionHeaderV2: React.FC<SectionHeaderV2Props> = ({
  title, subtitle, icon: Icon, iconColor = "text-muted-foreground", action
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      {Icon && (
        <div className="h-6 w-6 rounded-lg bg-muted/40 flex items-center justify-center">
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </div>
      )}
      <div>
        <h3 className="text-[13px] font-semibold text-foreground/90">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   GLASS PANEL V2
   ═══════════════════════════════════════════════════════════ */

interface GlassPanelV2Props {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const GlassPanelV2: React.FC<GlassPanelV2Props> = ({ children, className = "", noPadding }) => (
  <div className={`
    bg-gradient-to-b from-surface/80 to-surface
    border border-white/[0.04]
    rounded-xl
    shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]
    ${noPadding ? '' : 'p-5'}
    ${className}
  `}>
    {children}
  </div>
);

/* ═══════════════════════════════════════════════════════════
   METRIC CARD V2 — Stripe/Linear inspired
   ═══════════════════════════════════════════════════════════ */

interface MetricCardV2Props {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  accentColor: string;
  delta?: number | null;
  isLoading?: boolean;
  isPrimary?: boolean;
}

const v2CardAnim = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export const MetricCardV2: React.FC<MetricCardV2Props> = ({
  label, value, suffix, icon: Icon, accentColor, delta, isLoading, isPrimary
}) => {
  const colors: Record<string, { text: string; iconBg: string; glowBorder: string; ringGlow: string }> = {
    emerald: { text: "text-emerald-400", iconBg: "bg-emerald-500/10", glowBorder: "border-emerald-500/20", ringGlow: "shadow-[0_0_20px_rgba(52,211,153,0.08)]" },
    blue:    { text: "text-blue-400",    iconBg: "bg-blue-500/10",    glowBorder: "border-blue-500/15",    ringGlow: "" },
    purple:  { text: "text-purple-400",  iconBg: "bg-purple-500/10",  glowBorder: "border-purple-500/15",  ringGlow: "" },
    rose:    { text: "text-rose-400",    iconBg: "bg-rose-500/10",    glowBorder: "border-rose-500/15",    ringGlow: "" },
    amber:   { text: "text-amber-400",   iconBg: "bg-amber-500/10",   glowBorder: "border-amber-500/15",   ringGlow: "" },
  };
  const c = colors[accentColor] || colors.blue;

  return (
    <motion.div
      variants={v2CardAnim}
      className={`
        group relative overflow-hidden
        bg-gradient-to-b from-surface/80 to-surface
        border ${isPrimary ? c.glowBorder : 'border-white/[0.04]'}
        rounded-xl p-5
        shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)]
        transition-all duration-300 ease-out
        hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]
        ${isPrimary ? c.ringGlow : ''}
      `}
    >
      {/* Subtle top highlight line for primary */}
      {isPrimary && (
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-7 w-24 rounded" />
          <Skeleton className="h-2.5 w-16 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-[0.08em]">{label}</span>
            <div className={`h-7 w-7 rounded-lg ${c.iconBg} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}>
              <Icon className={`h-3.5 w-3.5 ${c.text}`} />
            </div>
          </div>

          <div className="flex items-baseline gap-1">
            <span className={`text-[26px] font-bold tracking-tight leading-none ${isPrimary ? c.text : 'text-foreground'}`}>
              {value}
            </span>
            {suffix && <span className="text-xs text-muted-foreground/60 font-medium">{suffix}</span>}
          </div>

          {delta !== undefined && delta !== null && (
            <div className={`flex items-center gap-1 mt-3 text-[10px] font-medium ${
              delta > 0 ? 'text-emerald-400/80' : delta < 0 ? 'text-red-400/80' : 'text-muted-foreground/50'
            }`}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              <span>{delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%</span>
              <span className="text-muted-foreground/40 ml-0.5">vs prev</span>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════════════
   STATUS BADGE V2
   ═══════════════════════════════════════════════════════════ */

export const StatusBadgeV2: React.FC<{ status: string }> = ({ status }) => {
  if (status === "NONE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md bg-emerald-500/8 text-[10px] font-medium text-emerald-400/90 tracking-wide">
        <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
        PASS
      </span>
    );
  }
  const color = V2_FAILURE_COLORS[status] || "#64748b";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md text-[10px] font-medium tracking-wide"
      style={{ backgroundColor: `${color}0D`, color: `${color}CC` }}
    >
      <span className="h-1 w-1 rounded-full" style={{ backgroundColor: `${color}99` }} />
      {status.replace(/_/g, " ")}
    </span>
  );
};

/* ═══════════════════════════════════════════════════════════
   EMPTY STATE V2
   ═══════════════════════════════════════════════════════════ */

export const EmptyStateV2: React.FC<{ title: string; description: string; icon?: LucideIcon }> = ({
  title, description, icon: Icon = Inbox
}) => (
  <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
    <div className="h-10 w-10 rounded-xl bg-muted/30 flex items-center justify-center mb-4 border border-white/[0.04]">
      <Icon className="h-5 w-5 text-muted-foreground/40" />
    </div>
    <h4 className="text-[13px] font-medium text-foreground/70 mb-1">{title}</h4>
    <p className="text-[11px] text-muted-foreground/50 max-w-[240px] leading-relaxed">{description}</p>
  </div>
);

/* ═══════════════════════════════════════════════════════════
   OVERVIEW SKELETON V2
   ═══════════════════════════════════════════════════════════ */

export const OverviewSkeletonV2: React.FC = () => (
  <div className="space-y-6 animate-in fade-in-0 duration-500">
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-surface/50 border border-white/[0.03] rounded-xl p-5 space-y-3">
          <Skeleton className="h-2.5 w-16 rounded" />
          <Skeleton className="h-6 w-20 rounded" />
          <Skeleton className="h-2 w-12 rounded" />
        </div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 bg-surface/50 border border-white/[0.03] rounded-xl p-5 h-[340px]">
        <Skeleton className="h-3 w-28 mb-6 rounded" />
        <Skeleton className="h-[260px] w-full rounded-lg" />
      </div>
      <div className="bg-surface/50 border border-white/[0.03] rounded-xl p-5 h-[340px]">
        <Skeleton className="h-3 w-24 mb-6 rounded" />
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
    </div>
  </div>
);
