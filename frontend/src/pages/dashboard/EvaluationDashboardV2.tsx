import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, CartesianGrid
} from "recharts";
import {
  useEvaluationQuality, useEvaluationTrends, useEvaluationFailures,
  useEvaluationQuestions, useEvaluationLatest, QuestionEvaluation
} from "@/hooks/useEvaluation";
import {
  ShieldCheck, BrainCircuit, Activity, Database, AlertTriangle,
  FileText, X, Gauge, Clock, Search, ChevronLeft, ChevronRight,
  Eye, CornerDownRight, Sparkles
} from "lucide-react";
import {
  MetricCardV2, GlassPanelV2, SectionHeaderV2, StatusBadgeV2,
  EmptyStateV2, OverviewSkeletonV2, V2_CHART_COLORS, V2_FAILURE_COLORS,
  v2TooltipStyle, v2SpringTransition, RatioBar
} from "@/components/ui/evaluation-primitives-v2";

export const EvaluationDashboardV2: React.FC = () => {
  const [view, setView] = useState<"overview" | "questions">("overview");
  const [page, setPage] = useState(1);
  const [failureFilter, setFailureFilter] = useState("");
  const [inspectedQ, setInspectedQ] = useState<QuestionEvaluation | null>(null);

  const { data: latest, isLoading: latestLoading } = useEvaluationLatest();
  const { data: quality, isLoading: qualityLoading } = useEvaluationQuality();
  const { data: trendsData } = useEvaluationTrends();
  const { data: failures } = useEvaluationFailures();
  const { data: questionsRes, isLoading: questionsLoading } = useEvaluationQuestions(page, 12, failureFilter || undefined);

  /* ── Derived Data Formatting ── */
  const trendData = useMemo(() => {
    if (!trendsData?.trends) return [];
    const tsMap: Record<string, any> = {};
    trendsData.trends.forEach((t: any) => {
      if (!tsMap[t.timestamp]) {
        const parts = t.timestamp.split("_");
        const dateStr = parts[0];
        tsMap[t.timestamp] = { name: `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}` };
      }
      tsMap[t.timestamp][t.metric] = parseFloat(t.value.toFixed(3));
    });
    return Object.values(tsMap);
  }, [trendsData]);

  const failureBarData = useMemo(() => {
    if (!failures?.failure_distribution) return [];
    return Object.entries(failures.failure_distribution)
      .filter(([_, count]) => (count as number) > 0)
      .map(([key, value]) => ({ name: key.replace(/_/g, " "), key, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }, [failures]);

  const topDocs = useMemo(() => {
    if (!failures?.top_failing_documents) return [];
    return Object.entries(failures.top_failing_documents)
      .map(([n, c]) => ({ name: n.length > 24 ? n.slice(0, 24) + "…" : n, full: n, failures: c }))
      .sort((a, b) => (b.failures as number) - (a.failures as number))
      .slice(0, 5);
  }, [failures]);

  const isLoading = latestLoading || qualityLoading;
  const totalFailed = failures?.total_failures || 0;
  const totalQ = latest?.summary?.questions || 0;

  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFailureFilter(e.target.value);
    setPage(1);
    setInspectedQ(null);
  }, []);

  return (
    <div className="h-full flex flex-col min-h-0 text-foreground">
      {/* ── Page Header ── */}
      <header className="flex items-center justify-between pb-6 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-btn bg-primary/10 flex items-center justify-center border border-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-foreground">Observability</h1>
            <p className="text-[10px] text-muted-foreground font-medium">Evaluation metrics and run diagnostics</p>
          </div>
        </div>

        <nav className="flex items-center clay-card rounded-btn p-0.5">
          {(["overview", "questions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`
                px-3 py-1.5 text-[10px] tracking-wide font-medium rounded-btn transition-all duration-200
                ${view === tab
                  ? "text-foreground bg-surface shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
                }
              `}
            >
              {tab === "overview" ? "Overview" : "Run Logs"}
            </button>
          ))}
        </nav>
      </header>

      {/* ═══════ OVERVIEW VIEW ═══════ */}
      {view === "overview" && (
        <>
          {isLoading ? (
            <OverviewSkeletonV2 />
          ) : !latest ? (
            <EmptyStateV2
              title="No evaluation runs yet"
              description="Run the evaluation framework script to generate system logs and telemetries."
              icon={ShieldCheck}
            />
          ) : (
            <div className="flex-grow flex flex-col justify-between py-6 overflow-y-auto scrollbar min-h-0 space-y-8">
              {/* ── Metric Strip (Clean borderless summary) ── */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-y-4 py-2 border-b border-white/[0.02]">
                <MetricCardV2
                  label="Quality Score"
                  value={quality?.quality_score ?? "--"}
                  suffix="/100"
                  accentColor="emerald"
                  isPrimary
                />
                <div className="sm:border-l border-white/[0.02] sm:pl-6">
                  <MetricCardV2
                    label="Recall @5"
                    value={latest?.summary?.retrieval?.recall_at_5?.toFixed(2) ?? "--"}
                    accentColor="blue"
                  />
                </div>
                <div className="sm:border-l border-white/[0.02] sm:pl-6">
                  <MetricCardV2
                    label="Groundedness"
                    value={latest?.summary?.generation?.groundedness?.toFixed(2) ?? "--"}
                    accentColor="purple"
                  />
                </div>
                <div className="sm:border-l border-white/[0.02] sm:pl-6">
                  <MetricCardV2
                    label="Hallucination"
                    value={latest?.summary?.generation?.hallucination_rate?.toFixed(2) ?? "--"}
                    accentColor="rose"
                  />
                </div>
                <div className="sm:border-l border-white/[0.02] sm:pl-6">
                  <MetricCardV2
                    label="Avg Latency"
                    value={latest?.summary?.performance?.avg_latency_ms?.toFixed(2) ?? "--"}
                    suffix="s"
                    accentColor="amber"
                  />
                </div>
              </div>

              {/* ── Main Layout: Trend Chart & Failure Breakdown side-by-side ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Metrics Trends (Takes 2 columns) */}
                <div className="lg:col-span-2 space-y-4">
                  <SectionHeaderV2 title="Performance Quality Trend" subtitle="Metric trends over preceding runs" />
                  <div className="h-[260px] w-full mt-2 -ml-4">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="glowColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={V2_CHART_COLORS.recall} stopOpacity={0.06} />
                              <stop offset="100%" stopColor={V2_CHART_COLORS.recall} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255, 255, 255, 0.02)" vertical={false} />
                          <XAxis dataKey="name" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} dy={6} />
                          <YAxis stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} dx={-2} />
                          <RechartsTooltip {...v2TooltipStyle} />
                          <Area type="monotone" dataKey="recall" stroke={V2_CHART_COLORS.recall} strokeWidth={1.5} fill="url(#glowColor)" dot={false} activeDot={{ r: 3, strokeWidth: 1.5, fill: "hsl(225 21.1% 7.5%)" }} />
                          <Area type="monotone" dataKey="groundedness" stroke={V2_CHART_COLORS.groundedness} strokeWidth={1.5} fill="none" dot={false} activeDot={{ r: 3, strokeWidth: 1.5, fill: "hsl(225 21.1% 7.5%)" }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyStateV2 title="No trend data" description="Run multiple benchmarks to see metrics over time." icon={Activity} />
                    )}
                  </div>
                  {/* Minimal Legend */}
                  {trendData.length > 0 && (
                    <div className="flex items-center gap-6 mt-1 px-1">
                      {[
                        { label: "Recall", color: V2_CHART_COLORS.recall },
                        { label: "Groundedness", color: V2_CHART_COLORS.groundedness },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2 text-[10px] text-muted-foreground/45 font-medium">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          {item.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Failure Breakdown (Linear-style ratio bar) */}
                <div className="space-y-4">
                  <SectionHeaderV2 title="Failure Breakdown" subtitle="Diagnostic root cause frequency" />
                  <div className="pt-2">
                    {failureBarData.length > 0 ? (
                      <RatioBar data={failureBarData} total={totalFailed} />
                    ) : (
                      <EmptyStateV2 title="All runs cleared" description="Zero failures observed in the current database index." />
                    )}
                  </div>
                </div>
              </div>

              {/* ── Document Weak Points ── */}
              {topDocs.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-white/[0.02]">
                  <SectionHeaderV2 title="Weakest Knowledge Sources" subtitle="Knowledge resources accounting for multiple pipeline failures" />
                  <div className="h-[180px] w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDocs} layout="vertical" margin={{ left: -10, right: 12 }}>
                        <CartesianGrid strokeDasharray="3 6" stroke="rgba(255, 255, 255, 0.02)" horizontal={false} />
                        <XAxis type="number" stroke="#4b5563" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={9} stroke="#888888" width={160} tick={{ fill: "#9ca3af" }} />
                        <RechartsTooltip {...v2TooltipStyle} formatter={(v: number, _: string, p: any) => [`${v} failures`, p.payload.full]} />
                        <Bar dataKey="failures" fill={V2_CHART_COLORS.recall} radius={[0, 4, 4, 0]} barSize={12} opacity={0.6} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════ RUN LOGS VIEW ═══════ */}
      {view === "questions" && (
        <div className="flex-grow flex gap-6 min-h-0 py-6 overflow-hidden">
          {/* Main Feed List */}
          <div className="flex-grow flex flex-col min-w-0 bg-surface/10 border border-white/[0.02] rounded-xl overflow-hidden">
            {/* Minimal Toolbar */}
            <div className="px-5 py-3 border-b border-white/[0.02] flex items-center justify-between shrink-0 bg-white/[0.005]">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-foreground/80">Runs</span>
                <span className="text-[9px] text-muted-foreground/35 bg-white/[0.02] px-1.5 py-0.5 rounded font-mono tabular-nums">
                  {questionsRes?.total || 0} Total
                </span>
              </div>
              <select
                className="bg-transparent border border-white/[0.04] rounded-md text-[10px] px-2.5 py-1 text-muted-foreground/60 outline-none focus:border-primary/20 transition-colors cursor-pointer"
                value={failureFilter}
                onChange={handleFilterChange}
              >
                <option value="">All results</option>
                <option value="NONE">Pass</option>
                <option value="RETRIEVAL_FAILURE">Retrieval</option>
                <option value="RERANK_FAILURE">Rerank</option>
                <option value="HALLUCINATION">Hallucination</option>
                <option value="PROMPT_FAILURE">Prompt</option>
                <option value="CHUNKING_FAILURE">Chunking</option>
              </select>
            </div>

            {/* List Feed (Less table-like, cleaner feeds) */}
            <div className="flex-grow overflow-y-auto scrollbar divide-y divide-white/[0.015]">
              {questionsLoading ? (
                [...Array(6)].map((_, i) => (
                  <div key={i} className="p-4 space-y-2">
                    <div className="flex justify-between">
                      <div className="animate-pulse bg-white/[0.02] h-2.5 w-16 rounded" />
                      <div className="animate-pulse bg-white/[0.02] h-2.5 w-12 rounded" />
                    </div>
                    <div className="animate-pulse bg-white/[0.02] h-2.5 w-full rounded" />
                  </div>
                ))
              ) : questionsRes?.data?.length === 0 ? (
                <EmptyStateV2 title="No logs found" description="Try refining your filter criteria." icon={Search} />
              ) : (
                questionsRes?.data?.map((q: QuestionEvaluation) => {
                  const isSelected = inspectedQ?.question_id === q.question_id;
                  return (
                    <div
                      key={q.question_id}
                      onClick={() => setInspectedQ(q)}
                      className={`
                        p-4.5 cursor-pointer transition-all duration-150 relative text-left
                        ${isSelected ? "bg-white/[0.02]" : "hover:bg-white/[0.015]"}
                      `}
                    >
                      {isSelected && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500" />
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] text-muted-foreground/35">{q.question_id}</span>
                          <span className="text-[10px] text-muted-foreground/40">•</span>
                          <span className="font-mono text-[9px] text-muted-foreground/45">{(q.latency_ms / 1000).toFixed(1)}s latency</span>
                        </div>
                        <StatusBadgeV2 status={q.failure_type} />
                      </div>
                      <h4 className="text-[12px] text-foreground/80 mt-1.5 line-clamp-1 leading-normal font-medium">{q.question}</h4>
                      <div className="flex items-center gap-4 mt-2 text-[9px] text-muted-foreground/40 font-mono">
                        <span>Recall: {q.retrieval_recall.toFixed(2)}</span>
                        <span>Precision: {q.retrieval_precision.toFixed(2)}</span>
                        <span>Groundedness: {q.groundedness.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination */}
            <div className="px-4 py-2.5 border-t border-white/[0.02] flex items-center justify-between shrink-0 bg-white/[0.005]">
              <span className="text-[9px] text-muted-foreground/35 font-mono">
                Page {page} of {Math.ceil((questionsRes?.total || 0) / 12) || 1}
              </span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="h-6 w-6 rounded flex items-center justify-center border border-white/[0.04] text-muted-foreground/30 disabled:opacity-20 hover:bg-white/[0.03] transition-colors">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button disabled={!questionsRes || (questionsRes.data?.length || 0) < 12} onClick={() => setPage(p => p + 1)}
                  className="h-6 w-6 rounded flex items-center justify-center border border-white/[0.04] text-muted-foreground/30 disabled:opacity-20 hover:bg-white/[0.03] transition-colors">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Details Inspection Sheet */}
          <AnimatePresence mode="wait">
            {inspectedQ && (
              <motion.aside
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={v2SpringTransition}
                className="w-[360px] shrink-0 bg-surface/30 border border-white/[0.02] rounded-xl flex flex-col overflow-hidden shadow-2xl shadow-black/40"
              >
                {/* Drawer Header */}
                <div className="px-4.5 py-3.5 border-b border-white/[0.02] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-primary opacity-60" />
                    <span className="text-xs font-semibold text-foreground/80">Inspect</span>
                    <span className="text-[9px] text-muted-foreground/30 font-mono">{inspectedQ.question_id}</span>
                  </div>
                  <button onClick={() => setInspectedQ(null)} className="h-5.5 w-5.5 rounded flex items-center justify-center hover:bg-white/[0.03] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
                    <X className="h-3 w-3" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-grow overflow-y-auto scrollbar p-4.5 space-y-5 text-[11px] leading-relaxed">
                  {/* Failure Context Banner */}
                  {inspectedQ.failure_type !== "NONE" && (
                    <div className="p-3.5 rounded-lg border space-y-1.5" style={{
                      borderColor: `${V2_FAILURE_COLORS[inspectedQ.failure_type] || "#64748b"}15`,
                      backgroundColor: `${V2_FAILURE_COLORS[inspectedQ.failure_type] || "#64748b"}04`
                    }}>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" style={{ color: `${V2_FAILURE_COLORS[inspectedQ.failure_type]}AA` }} />
                        <span className="font-semibold text-[9px] uppercase tracking-wider" style={{ color: `${V2_FAILURE_COLORS[inspectedQ.failure_type]}BB` }}>
                          {inspectedQ.failure_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-muted-foreground/50 text-[10px] leading-relaxed">{inspectedQ.failure_reason}</p>
                    </div>
                  )}

                  {/* Question Title */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground/35">Prompt</label>
                    <p className="bg-white/[0.01] border border-white/[0.02] p-3 rounded-lg text-foreground/75">{inspectedQ.question}</p>
                  </div>

                  {/* Expected vs Generated */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-medium uppercase tracking-[0.1em] text-emerald-400/40">Expected Target</label>
                      <p className="bg-emerald-500/[0.01] border border-emerald-500/[0.04] p-3 rounded-lg text-foreground/75">{inspectedQ.expected_answer}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <CornerDownRight className="h-3 w-3 text-blue-400/50" />
                        <label className="text-[9px] font-medium uppercase tracking-[0.1em] text-blue-400/40">LLM Response</label>
                      </div>
                      <p className="bg-blue-500/[0.01] border border-blue-500/[0.04] p-3 rounded-lg text-foreground/75">{inspectedQ.generated_answer}</p>
                    </div>
                  </div>

                  {/* Documents references */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Expected Files", files: inspectedQ.expected_documents },
                      { label: "Retrieved Files", files: inspectedQ.retrieved_documents },
                    ].map(g => (
                      <div key={g.label} className="space-y-1">
                        <label className="text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground/35">{g.label}</label>
                        <div className="space-y-0.5">
                          {g.files.length > 0 ? g.files.map(d => (
                            <div key={d} className="bg-white/[0.01] border border-white/[0.02] px-2.5 py-1 rounded text-[9.5px] truncate text-muted-foreground/50" title={d}>{d}</div>
                          )) : <span className="text-muted-foreground/20 text-[9px]">—</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Specific scores */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.015]">
                    {[
                      { l: "Recall", v: inspectedQ.retrieval_recall },
                      { l: "Precision", v: inspectedQ.retrieval_precision },
                      { l: "Groundedness", v: inspectedQ.groundedness },
                    ].map(m => (
                      <div key={m.l} className="bg-white/[0.005] border border-white/[0.015] rounded-lg p-2.5 text-center">
                        <div className="text-[8px] text-muted-foreground/30 uppercase tracking-wider mb-0.5">{m.l}</div>
                        <div className="text-[12px] font-semibold tabular-nums text-foreground/70">{m.v.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
