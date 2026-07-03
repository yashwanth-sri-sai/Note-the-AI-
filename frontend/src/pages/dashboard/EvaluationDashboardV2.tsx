import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from "recharts";
import {
  useEvaluationQuality, useEvaluationTrends, useEvaluationFailures,
  useEvaluationQuestions, useEvaluationLatest, QuestionEvaluation
} from "@/hooks/useEvaluation";
import {
  ShieldCheck, BrainCircuit, Activity, Database, AlertTriangle,
  FileText, X, Gauge, Clock, Search, ChevronLeft, ChevronRight,
  Eye, Zap, ArrowUpRight, BarChart3, Table2, Filter
} from "lucide-react";
import {
  MetricCardV2, GlassPanelV2, SectionHeaderV2, StatusBadgeV2,
  EmptyStateV2, OverviewSkeletonV2, V2_CHART_COLORS, V2_FAILURE_COLORS, v2TooltipStyle
} from "@/components/ui/evaluation-primitives-v2";

/* ═══════════════════════════════════════════════════════════ */

const containerStagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

/* ═══════════════════════════════════════════════════════════ */

export const EvaluationDashboardV2: React.FC = () => {
  const [view, setView] = useState<"overview" | "questions">("overview");
  const [page, setPage] = useState(1);
  const [failureFilter, setFailureFilter] = useState("");
  const [inspectedQ, setInspectedQ] = useState<QuestionEvaluation | null>(null);

  const { data: latest, isLoading: latestLoading } = useEvaluationLatest();
  const { data: quality, isLoading: qualityLoading } = useEvaluationQuality();
  const { data: trendsData } = useEvaluationTrends();
  const { data: failures } = useEvaluationFailures();
  const { data: questionsRes, isLoading: questionsLoading } = useEvaluationQuestions(page, 15, failureFilter || undefined);

  /* ── Derived ── */
  const trendData = useMemo(() => {
    if (!trendsData?.trends) return [];
    const tsMap: Record<string, any> = {};
    trendsData.trends.forEach((t: any) => {
      if (!tsMap[t.timestamp]) {
        const p = t.timestamp.split("_");
        const d = p[0];
        tsMap[t.timestamp] = { name: `${d.slice(4, 6)}/${d.slice(6, 8)}` };
      }
      tsMap[t.timestamp][t.metric] = parseFloat(t.value.toFixed(3));
    });
    return Object.values(tsMap);
  }, [trendsData]);

  const failurePie = useMemo(() => {
    if (!failures?.failure_distribution) return [];
    return Object.entries(failures.failure_distribution)
      .filter(([_, c]) => (c as number) > 0)
      .map(([k, v]) => ({ name: k.replace(/_/g, " "), key: k, value: v }))
      .sort((a, b) => (b.value as number) - (a.value as number));
  }, [failures]);

  const topDocs = useMemo(() => {
    if (!failures?.top_failing_documents) return [];
    return Object.entries(failures.top_failing_documents)
      .map(([n, c]) => ({ name: n.length > 30 ? n.slice(0, 30) + "…" : n, full: n, failures: c }))
      .sort((a, b) => (b.failures as number) - (a.failures as number))
      .slice(0, 6);
  }, [failures]);

  const isLoading = latestLoading || qualityLoading;
  const totalFailed = failures?.total_failures || 0;
  const totalQ = latest?.summary?.questions || 0;

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFailureFilter(e.target.value);
    setPage(1);
    setInspectedQ(null);
  }, []);

  /* ═══════════════════════════════════════════════════════════ */

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* ── Header ── */}
      <header className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/10 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">Evaluation</h1>
            <p className="text-[11px] text-muted-foreground/60 mt-1 font-medium">Retrieval · Generation · Failures</p>
          </div>
        </div>

        <nav className="flex items-center bg-surface/60 border border-white/[0.04] rounded-lg p-0.5">
          {(["overview", "questions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`
                relative px-3.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-200
                ${view === tab
                  ? "text-foreground bg-white/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                  : "text-muted-foreground/60 hover:text-muted-foreground"
                }
              `}
            >
              {tab === "overview" ? "Overview" : "Questions"}
            </button>
          ))}
        </nav>
      </header>

      {/* ═══════ OVERVIEW ═══════ */}
      {view === "overview" && (
        <>
          {isLoading ? (
            <OverviewSkeletonV2 />
          ) : !latest ? (
            <EmptyStateV2
              title="No benchmark data yet"
              description="Run your first evaluation to see quality metrics, trends, and failure analytics."
              icon={ShieldCheck}
            />
          ) : (
            <motion.div
              variants={containerStagger}
              initial="hidden"
              animate="show"
              className="space-y-5 overflow-y-auto scrollbar pb-6 min-h-0"
            >
              {/* ── KPI Row ── */}
              <motion.div variants={containerStagger} className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <MetricCardV2
                  label="Quality Score"
                  value={quality?.quality_score ?? "--"}
                  suffix="/100"
                  icon={Gauge}
                  accentColor="emerald"
                  isPrimary
                />
                <MetricCardV2
                  label="Recall @5"
                  value={latest?.summary?.retrieval?.recall_at_5?.toFixed(2) ?? "--"}
                  icon={Database}
                  accentColor="blue"
                />
                <MetricCardV2
                  label="Groundedness"
                  value={latest?.summary?.generation?.groundedness?.toFixed(2) ?? "--"}
                  icon={BrainCircuit}
                  accentColor="purple"
                />
                <MetricCardV2
                  label="Hallucination"
                  value={latest?.summary?.generation?.hallucination_rate?.toFixed(2) ?? "--"}
                  icon={AlertTriangle}
                  accentColor="rose"
                />
                <MetricCardV2
                  label="Avg Latency"
                  value={latest?.summary?.performance?.avg_latency_ms?.toFixed(2) ?? "--"}
                  suffix="s"
                  icon={Clock}
                  accentColor="amber"
                />
              </motion.div>

              {/* ── Charts ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Trend — 2 cols */}
                <GlassPanelV2 className="lg:col-span-2">
                  <SectionHeaderV2 icon={Activity} title="Metrics Over Time" iconColor="text-blue-400/70" />
                  <div className="h-[280px] mt-4 -ml-3">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="v2GradRecall" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={V2_CHART_COLORS.recall} stopOpacity={0.12} />
                              <stop offset="100%" stopColor={V2_CHART_COLORS.recall} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="v2GradGround" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={V2_CHART_COLORS.groundedness} stopOpacity={0.1} />
                              <stop offset="100%" stopColor={V2_CHART_COLORS.groundedness} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 6" stroke="hsl(219 21% 15.9% / 0.35)" vertical={false} />
                          <XAxis dataKey="name" stroke="#4a5568" fontSize={10} tickLine={false} axisLine={false} dy={6} />
                          <YAxis stroke="#4a5568" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} dx={-2} />
                          <RechartsTooltip {...v2TooltipStyle} />
                          <Area type="monotone" dataKey="recall" stroke={V2_CHART_COLORS.recall} strokeWidth={1.5} fill="url(#v2GradRecall)" dot={false} activeDot={{ r: 3.5, strokeWidth: 1.5, fill: "hsl(225 21.1% 7.5%)" }} />
                          <Area type="monotone" dataKey="groundedness" stroke={V2_CHART_COLORS.groundedness} strokeWidth={1.5} fill="url(#v2GradGround)" dot={false} activeDot={{ r: 3.5, strokeWidth: 1.5, fill: "hsl(225 21.1% 7.5%)" }} />
                          <Line type="monotone" dataKey="hallucination" stroke={V2_CHART_COLORS.hallucination} strokeWidth={1} strokeDasharray="3 3" dot={false} activeDot={{ r: 3, fill: V2_CHART_COLORS.hallucination }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyStateV2 title="No trend data" description="Run multiple benchmarks to see metrics over time." icon={Activity} />
                    )}
                  </div>
                  {/* Inline mini legend */}
                  {trendData.length > 0 && (
                    <div className="flex items-center gap-5 mt-2 px-2">
                      {[
                        { label: "Recall", color: V2_CHART_COLORS.recall },
                        { label: "Groundedness", color: V2_CHART_COLORS.groundedness },
                        { label: "Hallucination", color: V2_CHART_COLORS.hallucination, dashed: true },
                      ].map(l => (
                        <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                          <div className={`w-3 h-[2px] rounded-full ${l.dashed ? 'border-t border-dashed' : ''}`} style={{ backgroundColor: l.dashed ? 'transparent' : l.color, borderColor: l.color }} />
                          {l.label}
                        </div>
                      ))}
                    </div>
                  )}
                </GlassPanelV2>

                {/* Failure Pie — 1 col */}
                <GlassPanelV2 className="flex flex-col">
                  <SectionHeaderV2 icon={AlertTriangle} title="Failures" iconColor="text-amber-400/70"
                    action={totalFailed > 0 ? <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">{totalFailed} total</span> : undefined}
                  />
                  <div className="flex-grow flex flex-col items-center justify-center mt-3 min-h-[180px]">
                    {failurePie.length > 0 ? (
                      <>
                        <div className="h-[160px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={failurePie}
                                cx="50%" cy="50%"
                                innerRadius={48} outerRadius={66}
                                paddingAngle={2}
                                dataKey="value"
                                strokeWidth={0}
                              >
                                {failurePie.map(e => (
                                  <Cell key={e.key} fill={V2_FAILURE_COLORS[e.key] || "#64748b"} opacity={0.8} />
                                ))}
                              </Pie>
                              <RechartsTooltip {...v2TooltipStyle} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="w-full space-y-1 mt-3">
                          {failurePie.map(e => (
                            <div key={e.key} className="flex items-center justify-between text-[10px] px-1 py-0.5 rounded hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: V2_FAILURE_COLORS[e.key] || "#64748b", opacity: 0.7 }} />
                                <span className="text-muted-foreground/60">{e.name}</span>
                              </div>
                              <span className="font-medium text-foreground/70 tabular-nums">{e.value as number}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyStateV2 title="All clear" description="No failures detected." icon={ShieldCheck} />
                    )}
                  </div>
                </GlassPanelV2>
              </div>

              {/* ── Top Failing Documents ── */}
              {topDocs.length > 0 && (
                <GlassPanelV2>
                  <SectionHeaderV2 icon={FileText} title="Weakest Documents" subtitle={`${topDocs.length} documents with failures`} />
                  <div className="h-[200px] mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDocs} layout="vertical" margin={{ left: 4, right: 12 }}>
                        <CartesianGrid strokeDasharray="3 6" stroke="hsl(219 21% 15.9% / 0.3)" horizontal={false} />
                        <XAxis type="number" stroke="#4a5568" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} stroke="#64748b" width={180} tick={{ fill: '#94a3b8' }} />
                        <RechartsTooltip {...v2TooltipStyle} formatter={(v: number, _: string, p: any) => [`${v} failures`, p.payload.full]} />
                        <Bar dataKey="failures" fill={V2_CHART_COLORS.recall} radius={[0, 4, 4, 0]} barSize={14} opacity={0.75} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassPanelV2>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* ═══════ QUESTIONS ═══════ */}
      {view === "questions" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex-grow flex gap-4 min-h-0"
        >
          {/* Table */}
          <GlassPanelV2 noPadding className="flex-grow flex flex-col min-w-0 overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Table2 className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span className="text-[12px] font-medium text-foreground/80">Questions</span>
                <span className="text-[9px] text-muted-foreground/40 bg-white/[0.03] px-1.5 py-0.5 rounded font-mono tabular-nums">
                  {questionsRes?.total || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-3 w-3 text-muted-foreground/30" />
                <select
                  className="bg-transparent border border-white/[0.06] rounded-md text-[10px] px-2 py-1 text-muted-foreground/70 outline-none focus:border-primary/30 transition-colors appearance-none cursor-pointer"
                  value={failureFilter}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  <option value="NONE">Pass</option>
                  <option value="RETRIEVAL_FAILURE">Retrieval</option>
                  <option value="RERANK_FAILURE">Rerank</option>
                  <option value="HALLUCINATION">Hallucination</option>
                  <option value="PROMPT_FAILURE">Prompt</option>
                  <option value="CHUNKING_FAILURE">Chunking</option>
                </select>
              </div>
            </div>

            {/* Rows */}
            <div className="flex-grow overflow-y-auto scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm">
                  <tr className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground/40 font-medium border-b border-white/[0.03]">
                    <th className="px-4 py-2">ID</th>
                    <th className="px-4 py-2">Question</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Recall</th>
                    <th className="px-4 py-2 text-right">Ground</th>
                    <th className="px-4 py-2 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {questionsLoading ? (
                    [...Array(8)].map((_, i) => (
                      <tr key={i} className="border-b border-white/[0.02]">
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex gap-6 items-center">
                            <div className="animate-pulse bg-white/[0.03] h-2.5 w-10 rounded" />
                            <div className="animate-pulse bg-white/[0.03] h-2.5 w-44 rounded" />
                            <div className="animate-pulse bg-white/[0.03] h-2.5 w-12 rounded ml-auto" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : questionsRes?.data?.length === 0 ? (
                    <tr><td colSpan={6}><EmptyStateV2 title="No results" description="Adjust filters or run a benchmark." icon={Search} /></td></tr>
                  ) : (
                    questionsRes?.data?.map((q: QuestionEvaluation) => {
                      const sel = inspectedQ?.question_id === q.question_id;
                      return (
                        <tr
                          key={q.question_id}
                          onClick={() => setInspectedQ(q)}
                          className={`
                            border-b border-white/[0.02] cursor-pointer transition-colors duration-150
                            ${sel ? "bg-primary/[0.04]" : "hover:bg-white/[0.015]"}
                          `}
                        >
                          <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground/50">{q.question_id}</td>
                          <td className="px-4 py-2.5 text-[11px] text-foreground/80 truncate max-w-[260px]">{q.question}</td>
                          <td className="px-4 py-2.5"><StatusBadgeV2 status={q.failure_type} /></td>
                          <td className="px-4 py-2.5 text-right font-mono text-[10px] tabular-nums text-foreground/60">{q.retrieval_recall.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[10px] tabular-nums text-foreground/60">{q.groundedness.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[10px] tabular-nums text-muted-foreground/40">{(q.latency_ms / 1000).toFixed(1)}s</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-2.5 border-t border-white/[0.04] flex items-center justify-between shrink-0">
              <span className="text-[10px] text-muted-foreground/40 tabular-nums font-mono">
                Page {page} · {questionsRes?.data?.length || 0}/{questionsRes?.total || 0}
              </span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="h-6 w-6 rounded-md flex items-center justify-center border border-white/[0.05] text-muted-foreground/40 disabled:opacity-20 hover:bg-white/[0.04] hover:text-foreground/60 transition-all">
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button disabled={!questionsRes || (questionsRes.data?.length || 0) < 15} onClick={() => setPage(p => p + 1)}
                  className="h-6 w-6 rounded-md flex items-center justify-center border border-white/[0.05] text-muted-foreground/40 disabled:opacity-20 hover:bg-white/[0.04] hover:text-foreground/60 transition-all">
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </GlassPanelV2>

          {/* ── Detail Panel ── */}
          <AnimatePresence mode="wait">
            {inspectedQ && (
              <motion.aside
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="w-[360px] shrink-0 bg-gradient-to-b from-surface/80 to-surface border border-white/[0.04] rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-primary/60" />
                    <span className="text-[12px] font-medium text-foreground/80">Inspect</span>
                    <span className="text-[9px] text-muted-foreground/40 font-mono">{inspectedQ.question_id}</span>
                  </div>
                  <button onClick={() => setInspectedQ(null)} className="h-5 w-5 rounded flex items-center justify-center hover:bg-white/[0.05] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-grow overflow-y-auto scrollbar p-4 space-y-4 text-[11px]">
                  {/* Failure Banner */}
                  {inspectedQ.failure_type !== "NONE" && (
                    <div className="p-3 rounded-lg border space-y-1" style={{
                      borderColor: `${V2_FAILURE_COLORS[inspectedQ.failure_type] || '#64748b'}20`,
                      backgroundColor: `${V2_FAILURE_COLORS[inspectedQ.failure_type] || '#64748b'}06`
                    }}>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" style={{ color: `${V2_FAILURE_COLORS[inspectedQ.failure_type]}AA` }} />
                        <span className="font-medium text-[10px] uppercase tracking-wider" style={{ color: `${V2_FAILURE_COLORS[inspectedQ.failure_type]}BB` }}>
                          {inspectedQ.failure_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-muted-foreground/60 leading-relaxed text-[10px]">{inspectedQ.failure_reason}</p>
                    </div>
                  )}

                  {/* Question */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground/40">Question</label>
                    <p className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg leading-relaxed text-foreground/80">{inspectedQ.question}</p>
                  </div>

                  {/* Expected vs Generated */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.1em] text-emerald-400/50">Expected</label>
                      <p className="bg-emerald-500/[0.03] border border-emerald-500/[0.06] p-3 rounded-lg leading-relaxed text-foreground/70">{inspectedQ.expected_answer}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.1em] text-blue-400/50">Generated</label>
                      <p className="bg-blue-500/[0.03] border border-blue-500/[0.06] p-3 rounded-lg leading-relaxed text-foreground/70">{inspectedQ.generated_answer}</p>
                    </div>
                  </div>

                  {/* Documents */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Expected Docs", docs: inspectedQ.expected_documents },
                      { label: "Retrieved Docs", docs: inspectedQ.retrieved_documents },
                    ].map(group => (
                      <div key={group.label} className="space-y-1.5">
                        <label className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground/40">{group.label}</label>
                        <div className="space-y-0.5">
                          {group.docs.length > 0 ? group.docs.map(d => (
                            <div key={d} className="bg-white/[0.02] border border-white/[0.03] px-2 py-1 rounded text-[9px] truncate text-muted-foreground/60" title={d}>{d}</div>
                          )) : <span className="text-muted-foreground/30 text-[9px]">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Metrics strip */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {[
                      { l: "Recall", v: inspectedQ.retrieval_recall },
                      { l: "Precision", v: inspectedQ.retrieval_precision },
                      { l: "Faithful", v: inspectedQ.faithfulness },
                    ].map(m => (
                      <div key={m.l} className="bg-white/[0.02] border border-white/[0.03] rounded-lg p-2 text-center">
                        <div className="text-[8px] text-muted-foreground/35 uppercase tracking-wider mb-0.5">{m.l}</div>
                        <div className="text-[13px] font-semibold tabular-nums text-foreground/70">{m.v.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
