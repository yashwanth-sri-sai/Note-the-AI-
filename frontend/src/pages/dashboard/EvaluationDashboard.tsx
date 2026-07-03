import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Area, AreaChart, Legend
} from "recharts";
import {
  useEvaluationQuality, useEvaluationTrends, useEvaluationFailures,
  useEvaluationQuestions, useEvaluationLatest, QuestionEvaluation
} from "@/hooks/useEvaluation";
import {
  ShieldCheck, BrainCircuit, Activity, Database, AlertTriangle,
  FileText, X, Gauge, Clock, Eye, Search, ChevronLeft, ChevronRight
} from "lucide-react";
import {
  MetricCard, GlassPanel, SectionHeader, StatusBadge, EmptyState, OverviewSkeleton,
  EVAL_CHART_PALETTE, EVAL_FAILURE_PALETTE, chartTooltipStyle
} from "@/components/ui/evaluation-primitives";

/* ═══════════════════════════════════════════════════════════ */

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

/* ═══════════════════════════════════════════════════════════ */

export const EvaluationDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<"overview" | "questions">("overview");
  const [page, setPage] = useState(1);
  const [failureFilter, setFailureFilter] = useState("");
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionEvaluation | null>(null);

  const { data: latest, isLoading: latestLoading } = useEvaluationLatest();
  const { data: quality, isLoading: qualityLoading } = useEvaluationQuality();
  const { data: trendsData } = useEvaluationTrends();
  const { data: failures } = useEvaluationFailures();
  const { data: questionsRes, isLoading: questionsLoading } = useEvaluationQuestions(page, 15, failureFilter || undefined);

  /* ─── Derived chart data ─── */
  const trendData = useMemo(() => {
    if (!trendsData?.trends) return [];
    const tsMap: Record<string, any> = {};
    trendsData.trends.forEach((t: any) => {
      if (!tsMap[t.timestamp]) {
        const parts = t.timestamp.split("_");
        const dateStr = parts[0];
        const d = `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
        tsMap[t.timestamp] = { name: d };
      }
      tsMap[t.timestamp][t.metric] = parseFloat(t.value.toFixed(3));
    });
    return Object.values(tsMap);
  }, [trendsData]);

  const failurePieData = useMemo(() => {
    if (!failures?.failure_distribution) return [];
    return Object.entries(failures.failure_distribution)
      .filter(([_, count]) => (count as number) > 0)
      .map(([name, value]) => ({ name: name.replace(/_/g, " "), key: name, value }))
      .sort((a, b) => (b.value as number) - (a.value as number));
  }, [failures]);

  const topDocsData = useMemo(() => {
    if (!failures?.top_failing_documents) return [];
    return Object.entries(failures.top_failing_documents)
      .map(([name, count]) => ({
        name: name.length > 28 ? name.substring(0, 28) + "…" : name,
        fullName: name,
        failures: count
      }))
      .sort((a, b) => (b.failures as number) - (a.failures as number))
      .slice(0, 8);
  }, [failures]);

  const isOverviewLoading = latestLoading || qualityLoading;
  const totalFailed = failures?.total_failures || 0;
  const totalQuestions = latest?.summary?.questions || 0;
  const passRate = totalQuestions > 0 ? ((totalQuestions - totalFailed) / totalQuestions * 100).toFixed(0) : "--";

  /* ═══════════════════════════════════════════════════════════ */

  return (
    <div className="h-full flex flex-col">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2.5 tracking-tight">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            AI Evaluation
          </h2>
          <p className="text-xs text-muted-foreground mt-1.5 ml-[42px]">
            Retrieval quality · Generation fidelity · Failure diagnostics
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-surface border border-border/40 p-1 rounded-xl">
          {(["overview", "questions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveView(tab)}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                activeView === tab
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {tab === "overview" ? "Overview" : "Question Explorer"}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ OVERVIEW TAB ═══════ */}
      {activeView === "overview" && (
        <>
          {isOverviewLoading ? (
            <OverviewSkeleton />
          ) : !latest ? (
            <EmptyState
              title="No benchmark data"
              description="Run your first evaluation benchmark to see metrics, trends, and failure diagnostics here."
              icon={ShieldCheck}
            />
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8 overflow-y-auto scrollbar pb-4">
              {/* ── KPI Row ── */}
              <motion.div variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  label="Quality Score"
                  value={quality?.quality_score ?? "--"}
                  suffix="/100"
                  icon={Gauge}
                  accentColor="emerald"
                  isPrimary
                />
                <MetricCard
                  label="Recall @5"
                  value={latest?.summary?.retrieval?.recall_at_5?.toFixed(2) ?? "--"}
                  icon={Database}
                  accentColor="blue"
                />
                <MetricCard
                  label="Groundedness"
                  value={latest?.summary?.generation?.groundedness?.toFixed(2) ?? "--"}
                  icon={BrainCircuit}
                  accentColor="purple"
                />
                <MetricCard
                  label="Hallucination"
                  value={latest?.summary?.generation?.hallucination_rate?.toFixed(2) ?? "--"}
                  icon={AlertTriangle}
                  accentColor="rose"
                />
                <MetricCard
                  label="Avg Latency"
                  value={latest?.summary?.performance?.avg_latency_ms?.toFixed(2) ?? "--"}
                  suffix="s"
                  icon={Clock}
                  accentColor="amber"
                />
              </motion.div>

              {/* ── Charts Row ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Metrics Trend — Takes 2 cols */}
                <GlassPanel className="lg:col-span-2 space-y-4">
                  <SectionHeader icon={Activity} title="Metrics Over Time" iconColor="text-blue-400" />
                  <div className="h-[280px] w-full -ml-2">
                    {trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="gradRecall" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={EVAL_CHART_PALETTE.recall} stopOpacity={0.15} />
                              <stop offset="100%" stopColor={EVAL_CHART_PALETTE.recall} stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradGround" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={EVAL_CHART_PALETTE.groundedness} stopOpacity={0.15} />
                              <stop offset="100%" stopColor={EVAL_CHART_PALETTE.groundedness} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(219 21% 15.9% / 0.5)" vertical={false} />
                          <XAxis dataKey="name" stroke="#7B8494" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                          <YAxis stroke="#7B8494" fontSize={10} tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(v: number) => v.toFixed(1)} dx={-4} />
                          <RechartsTooltip {...chartTooltipStyle} />
                          <Area type="monotone" dataKey="recall" stroke={EVAL_CHART_PALETTE.recall} strokeWidth={2} fill="url(#gradRecall)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(220 20% 11.8%)" }} />
                          <Area type="monotone" dataKey="groundedness" stroke={EVAL_CHART_PALETTE.groundedness} strokeWidth={2} fill="url(#gradGround)" dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "hsl(220 20% 11.8%)" }} />
                          <Line type="monotone" dataKey="hallucination" stroke={EVAL_CHART_PALETTE.hallucination} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={{ r: 3, fill: EVAL_CHART_PALETTE.hallucination }} />
                          <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="line"
                            iconSize={10}
                            wrapperStyle={{ fontSize: '10px', color: '#7B8494', paddingBottom: '8px' }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="No trend data" description="Run multiple benchmarks to see metrics over time." icon={Activity} />
                    )}
                  </div>
                </GlassPanel>

                {/* Failure Distribution — 1 col */}
                <GlassPanel className="space-y-4 flex flex-col">
                  <SectionHeader icon={AlertTriangle} title="Failure Breakdown" iconColor="text-amber-400" />
                  <div className="flex-grow flex flex-col items-center justify-center min-h-[200px]">
                    {failurePieData.length > 0 ? (
                      <>
                        <div className="h-[180px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={failurePieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={52}
                                outerRadius={72}
                                paddingAngle={3}
                                dataKey="value"
                                strokeWidth={0}
                              >
                                {failurePieData.map((entry) => (
                                  <Cell key={entry.key} fill={EVAL_FAILURE_PALETTE[entry.key] || "#6b7280"} />
                                ))}
                              </Pie>
                              <RechartsTooltip {...chartTooltipStyle} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Inline Legend */}
                        <div className="w-full space-y-1.5 mt-2 px-1">
                          {failurePieData.map((entry) => (
                            <div key={entry.key} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: EVAL_FAILURE_PALETTE[entry.key] || "#6b7280" }} />
                                <span className="text-muted-foreground truncate">{entry.name}</span>
                              </div>
                              <span className="font-semibold text-foreground tabular-nums">{entry.value as number}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <EmptyState title="No failures" description="All evaluations passed." icon={ShieldCheck} />
                    )}
                  </div>
                </GlassPanel>
              </div>

              {/* ── Top Failing Documents ── */}
              {topDocsData.length > 0 && (
                <GlassPanel className="space-y-4">
                  <SectionHeader icon={FileText} title="Top Failing Documents" subtitle={`${totalFailed} total failures across ${topDocsData.length} documents`} />
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDocsData} layout="vertical" margin={{ left: 8, right: 16 }} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(219 21% 15.9% / 0.4)" horizontal={false} />
                        <XAxis type="number" stroke="#7B8494" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} stroke="#7B8494" width={160} tick={{ fill: '#A7B1C2' }} />
                        <RechartsTooltip
                          {...chartTooltipStyle}
                          formatter={(value: number, _name: string, props: any) => [`${value} failures`, props.payload.fullName]}
                        />
                        <Bar dataKey="failures" fill={EVAL_CHART_PALETTE.recall} radius={[0, 6, 6, 0]} barSize={16} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlassPanel>
              )}
            </motion.div>
          )}
        </>
      )}

      {/* ═══════ QUESTIONS TAB ═══════ */}
      {activeView === "questions" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="flex-grow flex gap-5 min-h-0"
        >
          {/* ── Table ── */}
          <div className="flex-grow flex flex-col min-w-0 bg-surface border border-border/40 rounded-2xl overflow-hidden">
            {/* Toolbar */}
            <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-foreground">Questions</h3>
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-md font-medium tabular-nums">
                  {questionsRes?.total || 0} total
                </span>
              </div>
              <select
                className="bg-background border border-border/50 rounded-lg text-[11px] px-3 py-1.5 outline-none text-muted-foreground focus:text-foreground focus:border-primary/40 transition-colors"
                value={failureFilter}
                onChange={(e) => { setFailureFilter(e.target.value); setPage(1); setSelectedQuestion(null); }}
              >
                <option value="">All Results</option>
                <option value="NONE">✓ Pass</option>
                <option value="RETRIEVAL_FAILURE">Retrieval Failure</option>
                <option value="RERANK_FAILURE">Rerank Failure</option>
                <option value="HALLUCINATION">Hallucination</option>
                <option value="PROMPT_FAILURE">Prompt Failure</option>
                <option value="CHUNKING_FAILURE">Chunking Failure</option>
                <option value="CITATION_FAILURE">Citation Failure</option>
              </select>
            </div>

            {/* Table Content */}
            <div className="flex-grow overflow-y-auto scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-border/20">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    <th className="px-5 py-2.5">ID</th>
                    <th className="px-5 py-2.5">Question</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Recall</th>
                    <th className="px-5 py-2.5 text-right">Grounded</th>
                    <th className="px-5 py-2.5 text-right">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {questionsLoading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="border-b border-border/10">
                        <td className="px-5 py-3" colSpan={6}>
                          <div className="flex gap-4 items-center">
                            <div className="animate-pulse bg-muted/50 h-3 w-12 rounded" />
                            <div className="animate-pulse bg-muted/50 h-3 w-48 rounded" />
                            <div className="animate-pulse bg-muted/50 h-3 w-14 rounded ml-auto" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : questionsRes?.data?.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState title="No questions found" description="Try adjusting the filter or run an evaluation benchmark." icon={Search} />
                      </td>
                    </tr>
                  ) : (
                    questionsRes?.data?.map((q: QuestionEvaluation) => {
                      const isSelected = selectedQuestion?.question_id === q.question_id;
                      return (
                        <tr
                          key={q.question_id}
                          onClick={() => setSelectedQuestion(q)}
                          className={`border-b border-border/10 cursor-pointer transition-colors duration-150 ${
                            isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                          }`}
                        >
                          <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">{q.question_id}</td>
                          <td className="px-5 py-3 text-xs truncate max-w-[280px]">{q.question}</td>
                          <td className="px-5 py-3"><StatusBadge status={q.failure_type} /></td>
                          <td className="px-5 py-3 text-right font-mono text-[11px] tabular-nums">{q.retrieval_recall.toFixed(2)}</td>
                          <td className="px-5 py-3 text-right font-mono text-[11px] tabular-nums">{q.groundedness.toFixed(2)}</td>
                          <td className="px-5 py-3 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{(q.latency_ms / 1000).toFixed(1)}s</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-border/30 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                Page {page} · {questionsRes?.data?.length || 0} of {questionsRes?.total || 0}
              </span>
              <div className="flex gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center border border-border/40 bg-background text-muted-foreground disabled:opacity-30 hover:bg-muted/30 hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={!questionsRes || (questionsRes.data?.length || 0) < (questionsRes.size || 15)}
                  onClick={() => setPage(p => p + 1)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center border border-border/40 bg-background text-muted-foreground disabled:opacity-30 hover:bg-muted/30 hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Detail Side Panel ── */}
          <AnimatePresence mode="wait">
            {selectedQuestion && (
              <motion.aside
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="w-[380px] shrink-0 bg-surface border border-border/40 rounded-2xl flex flex-col overflow-hidden"
              >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary opacity-70" />
                    <span className="text-sm font-semibold">Details</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{selectedQuestion.question_id}</span>
                  </div>
                  <button
                    onClick={() => setSelectedQuestion(null)}
                    className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-grow overflow-y-auto scrollbar p-5 space-y-5 text-xs">
                  {/* Failure Alert */}
                  {selectedQuestion.failure_type !== "NONE" && (
                    <div className="p-3.5 rounded-xl border space-y-1.5" style={{
                      borderColor: `${EVAL_FAILURE_PALETTE[selectedQuestion.failure_type] || '#6b7280'}30`,
                      backgroundColor: `${EVAL_FAILURE_PALETTE[selectedQuestion.failure_type] || '#6b7280'}08`
                    }}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5" style={{ color: EVAL_FAILURE_PALETTE[selectedQuestion.failure_type] }} />
                        <span className="font-semibold uppercase text-[10px] tracking-wider" style={{ color: EVAL_FAILURE_PALETTE[selectedQuestion.failure_type] }}>
                          {selectedQuestion.failure_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{selectedQuestion.failure_reason}</p>
                    </div>
                  )}

                  {/* Question */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Question</label>
                    <p className="bg-muted/20 border border-border/20 p-3 rounded-xl leading-relaxed text-foreground/90">{selectedQuestion.question}</p>
                  </div>

                  {/* Expected vs Generated */}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium uppercase tracking-wider text-emerald-400/80">Expected Answer</label>
                      <p className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl leading-relaxed">{selectedQuestion.expected_answer}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium uppercase tracking-wider text-blue-400/80">Generated Answer</label>
                      <p className="bg-blue-500/5 border border-blue-500/10 p-3 rounded-xl leading-relaxed">{selectedQuestion.generated_answer}</p>
                    </div>
                  </div>

                  {/* Documents */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Expected Docs</label>
                      <div className="space-y-1">
                        {selectedQuestion.expected_documents.map(d => (
                          <div key={d} className="bg-muted/30 border border-border/20 px-2.5 py-1.5 rounded-lg truncate text-[10px]" title={d}>{d}</div>
                        ))}
                        {selectedQuestion.expected_documents.length === 0 && <span className="text-muted-foreground text-[10px]">—</span>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Retrieved Docs</label>
                      <div className="space-y-1">
                        {selectedQuestion.retrieved_documents.map(d => (
                          <div key={d} className="bg-muted/30 border border-border/20 px-2.5 py-1.5 rounded-lg truncate text-[10px]" title={d}>{d}</div>
                        ))}
                        {selectedQuestion.retrieved_documents.length === 0 && <span className="text-muted-foreground text-[10px]">—</span>}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Mini Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { label: "Recall", value: selectedQuestion.retrieval_recall.toFixed(2) },
                      { label: "Precision", value: selectedQuestion.retrieval_precision.toFixed(2) },
                      { label: "Faithful", value: selectedQuestion.faithfulness.toFixed(2) },
                    ].map(m => (
                      <div key={m.label} className="bg-muted/20 border border-border/20 rounded-xl p-2.5 text-center">
                        <div className="text-[10px] text-muted-foreground mb-0.5">{m.label}</div>
                        <div className="text-sm font-semibold tabular-nums">{m.value}</div>
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
