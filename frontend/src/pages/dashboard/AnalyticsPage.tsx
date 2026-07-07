import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { 
  Loader2, RefreshCw, AlertTriangle, 
  Activity, Cpu, Database, Zap
} from "lucide-react";
import { motion } from "framer-motion";

interface MetricsDashboard {
  usage: {
    requests_by_endpoint: Record<string, number>;
    requests_by_user: Record<string, number>;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    total_tokens: number;
  };
  failures: {
    total_requests: number;
    success_count: number;
    client_error_count: number;
    server_error_count: number;
    success_rate: number;
    last_errors: Array<{
      id: string;
      timestamp: string;
      endpoint: string;
      method: string;
      status_code: number;
      error_message: string;
    }>;
  };
  latency: {
    retrieval: { mean: number; p95: number; p99: number };
    llm: { mean: number; p95: number; p99: number };
    total: { mean: number; p95: number; p99: number };
  };
}

export const AnalyticsPage: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();
  const [metrics, setMetrics] = useState<MetricsDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMetrics = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await apiClient.get("/metrics/dashboard");
      setMetrics(response.data);
    } catch (err) {
      console.error("Error fetching workspace telemetry:", err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchMetrics();
    }
  }, [activeWorkspaceId]);

  if (isLoading && !metrics) {
    return (
      <div className="h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } }
  } as const;

  // Safe Fallback Values
  const totalRequests = metrics?.failures.total_requests ?? 0;
  const successRate = metrics?.failures.success_rate ?? 1.0;
  const totalTokens = metrics?.usage.total_tokens ?? 0;
  const avgResponseTime = metrics?.latency.total.mean ?? 0;

  return (
    <div className="space-y-6 text-left">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Workspace Analytics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Operational latency, token consumption, and response failure logs.
          </p>
        </div>
        <button
          onClick={() => fetchMetrics(false)}
          className="p-2.5 text-muted-foreground hover:text-foreground clay-btn bg-card/50 transition-all active:scale-95"
          title="Refresh Data"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
        </button>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Metric 1: Total Requests */}
        <motion.div variants={itemVariants} className="clay-card clay-card-cyan p-5 flex items-center justify-between spring-hover cursor-default">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-cyan tracking-wider">
              Total API Calls
            </span>
            <h3 className="text-2xl font-black text-foreground">{totalRequests.toLocaleString()}</h3>
            <p className="text-[9px] text-muted-foreground">Requests processed in workspace</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-cyan/10 flex items-center justify-center text-cyan shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)]">
            <Activity className="h-5 w-5" />
          </div>
        </motion.div>

        {/* Metric 2: Success Rate */}
        <motion.div variants={itemVariants} className="clay-card clay-card-emerald p-5 flex items-center justify-between spring-hover cursor-default">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
              Success Ratio
            </span>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {Math.round(successRate * 1000) / 10}%
            </h3>
            <p className="text-[9px] text-muted-foreground">HTTP 2xx response rate</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)]">
            <Zap className="h-5 w-5" />
          </div>
        </motion.div>

        {/* Metric 3: Total Tokens */}
        <motion.div variants={itemVariants} className="clay-card clay-card-sky p-5 flex items-center justify-between spring-hover cursor-default">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 tracking-wider">
              LLM Tokens Used
            </span>
            <h3 className="text-2xl font-black text-sky-600 dark:text-sky-400">{totalTokens.toLocaleString()}</h3>
            <p className="text-[9px] text-muted-foreground">Prompt + Completion units</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-sky-500/10 dark:bg-sky-400/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)]">
            <Cpu className="h-5 w-5" />
          </div>
        </motion.div>

        {/* Metric 4: Avg Latency */}
        <motion.div variants={itemVariants} className="clay-card clay-card-amber p-5 flex items-center justify-between spring-hover cursor-default">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
              Avg Latency
            </span>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">{avgResponseTime} ms</h3>
            <p className="text-[9px] text-muted-foreground">Average round-trip delay</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)]">
            <Database className="h-5 w-5" />
          </div>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Percentiles Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="clay-panel p-6 bg-card/45">
            <h3 className="font-bold text-xs uppercase text-muted-foreground/80 tracking-wider mb-5">
              Latency Performance matrix
            </h3>

            {/* Vector CSS-Based Performance Metric Chart */}
            {metrics?.latency && (() => {
              const maxVal = Math.max(
                metrics.latency.retrieval.p99,
                metrics.latency.llm.p99,
                metrics.latency.total.p99,
                100
              );
              return (
                <div className="mb-6 p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-border/10 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05)]">
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/95">
                      Visual Latency Distribution (ms)
                    </span>
                    <div className="flex items-center gap-4 text-[10px] font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#53B7FF] shadow-[0_0_8px_rgba(83,183,255,0.4)]" />
                        <span className="text-muted-foreground">Mean</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#6D6BFF] shadow-[0_0_8px_rgba(109,107,255,0.4)]" />
                        <span className="text-muted-foreground">P95</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#FF6B81] shadow-[0_0_8px_rgba(255,107,129,0.4)]" />
                        <span className="text-muted-foreground">P99</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-44 flex items-end justify-between px-2 sm:px-8 relative pt-4 pb-2">
                    {/* Grid lines */}
                    <div className="absolute inset-x-0 top-4 bottom-8 flex flex-col justify-between pointer-events-none opacity-20 text-[9px] font-semibold text-muted-foreground py-1 select-none">
                      <div className="border-t border-border w-full flex justify-end pr-1 pt-0.5"><span>{Math.round(maxVal)} ms</span></div>
                      <div className="border-t border-border w-full flex justify-end pr-1 pt-0.5"><span>{Math.round(maxVal / 2)} ms</span></div>
                      <div className="border-t border-dashed border-border w-full flex justify-end pr-1 pt-0.5"><span>0 ms</span></div>
                    </div>

                    {/* Vector Retrieval Group */}
                    <div className="flex flex-col items-center flex-1 z-10">
                      <div className="flex items-end gap-1.5 sm:gap-3 h-32 w-full justify-center">
                        {/* Mean */}
                        <div className="group relative flex flex-col items-center">
                          <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-popover text-popover-foreground border border-border/40 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-md z-30 whitespace-nowrap pointer-events-none">
                            Mean: {metrics.latency.retrieval.mean} ms
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${(metrics.latency.retrieval.mean / maxVal) * 100}%` }}
                            transition={{ type: "spring", stiffness: 80, delay: 0.1 }}
                            className="w-3.5 sm:w-5 rounded-t-lg bg-gradient-to-t from-[#53B7FF] to-[#53B7FF]/70 shadow-[0_0_8px_rgba(83,183,255,0.2)] cursor-pointer hover:brightness-105"
                          />
                        </div>
                        {/* P95 */}
                        <div className="group relative flex flex-col items-center">
                          <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-popover text-popover-foreground border border-border/40 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-md z-30 whitespace-nowrap pointer-events-none">
                            P95: {metrics.latency.retrieval.p95} ms
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${(metrics.latency.retrieval.p95 / maxVal) * 100}%` }}
                            transition={{ type: "spring", stiffness: 80, delay: 0.2 }}
                            className="w-3.5 sm:w-5 rounded-t-lg bg-gradient-to-t from-[#6D6BFF] to-[#6D6BFF]/70 shadow-[0_0_8px_rgba(109,107,255,0.2)] cursor-pointer hover:brightness-105"
                          />
                        </div>
                        {/* P99 */}
                        <div className="group relative flex flex-col items-center">
                          <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-popover text-popover-foreground border border-border/40 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-md z-30 whitespace-nowrap pointer-events-none">
                            P99: {metrics.latency.retrieval.p99} ms
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${(metrics.latency.retrieval.p99 / maxVal) * 100}%` }}
                            transition={{ type: "spring", stiffness: 80, delay: 0.3 }}
                            className="w-3.5 sm:w-5 rounded-t-lg bg-gradient-to-t from-[#FF6B81] to-[#FF6B81]/70 shadow-[0_0_8px_rgba(255,107,129,0.2)] cursor-pointer hover:brightness-105"
                          />
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground mt-2 tracking-wide">Vector Retrieval</span>
                    </div>

                    {/* LLM Inference Group */}
                    <div className="flex flex-col items-center flex-1 z-10">
                      <div className="flex items-end gap-1.5 sm:gap-3 h-32 w-full justify-center">
                        {/* Mean */}
                        <div className="group relative flex flex-col items-center">
                          <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-popover text-popover-foreground border border-border/40 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-md z-30 whitespace-nowrap pointer-events-none">
                            Mean: {metrics.latency.llm.mean} ms
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${(metrics.latency.llm.mean / maxVal) * 100}%` }}
                            transition={{ type: "spring", stiffness: 80, delay: 0.2 }}
                            className="w-3.5 sm:w-5 rounded-t-lg bg-gradient-to-t from-[#53B7FF] to-[#53B7FF]/70 shadow-[0_0_8px_rgba(83,183,255,0.2)] cursor-pointer hover:brightness-105"
                          />
                        </div>
                        {/* P95 */}
                        <div className="group relative flex flex-col items-center">
                          <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-popover text-popover-foreground border border-border/40 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-md z-30 whitespace-nowrap pointer-events-none">
                            P95: {metrics.latency.llm.p95} ms
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${(metrics.latency.llm.p95 / maxVal) * 100}%` }}
                            transition={{ type: "spring", stiffness: 80, delay: 0.3 }}
                            className="w-3.5 sm:w-5 rounded-t-lg bg-gradient-to-t from-[#6D6BFF] to-[#6D6BFF]/70 shadow-[0_0_8px_rgba(109,107,255,0.2)] cursor-pointer hover:brightness-105"
                          />
                        </div>
                        {/* P99 */}
                        <div className="group relative flex flex-col items-center">
                          <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-popover text-popover-foreground border border-border/40 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-md z-30 whitespace-nowrap pointer-events-none">
                            P99: {metrics.latency.llm.p99} ms
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${(metrics.latency.llm.p99 / maxVal) * 100}%` }}
                            transition={{ type: "spring", stiffness: 80, delay: 0.4 }}
                            className="w-3.5 sm:w-5 rounded-t-lg bg-gradient-to-t from-[#FF6B81] to-[#FF6B81]/70 shadow-[0_0_8px_rgba(255,107,129,0.2)] cursor-pointer hover:brightness-105"
                          />
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground mt-2 tracking-wide">LLM Inference</span>
                    </div>

                    {/* Total End-to-End Group */}
                    <div className="flex flex-col items-center flex-1 z-10">
                      <div className="flex items-end gap-1.5 sm:gap-3 h-32 w-full justify-center">
                        {/* Mean */}
                        <div className="group relative flex flex-col items-center">
                          <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-popover text-popover-foreground border border-border/40 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-md z-30 whitespace-nowrap pointer-events-none">
                            Mean: {metrics.latency.total.mean} ms
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${(metrics.latency.total.mean / maxVal) * 100}%` }}
                            transition={{ type: "spring", stiffness: 80, delay: 0.3 }}
                            className="w-3.5 sm:w-5 rounded-t-lg bg-gradient-to-t from-[#53B7FF] to-[#53B7FF]/70 shadow-[0_0_8px_rgba(83,183,255,0.2)] cursor-pointer hover:brightness-105"
                          />
                        </div>
                        {/* P95 */}
                        <div className="group relative flex flex-col items-center">
                          <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-popover text-popover-foreground border border-border/40 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-md z-30 whitespace-nowrap pointer-events-none">
                            P95: {metrics.latency.total.p95} ms
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${(metrics.latency.total.p95 / maxVal) * 100}%` }}
                            transition={{ type: "spring", stiffness: 80, delay: 0.4 }}
                            className="w-3.5 sm:w-5 rounded-t-lg bg-gradient-to-t from-[#6D6BFF] to-[#6D6BFF]/70 shadow-[0_0_8px_rgba(109,107,255,0.2)] cursor-pointer hover:brightness-105"
                          />
                        </div>
                        {/* P99 */}
                        <div className="group relative flex flex-col items-center">
                          <div className="absolute -top-7 scale-0 group-hover:scale-100 transition-all bg-popover text-popover-foreground border border-border/40 text-[9px] font-bold px-2 py-0.5 rounded-lg shadow-md z-30 whitespace-nowrap pointer-events-none">
                            P99: {metrics.latency.total.p99} ms
                          </div>
                          <motion.div 
                            initial={{ height: 0 }}
                            animate={{ height: `${(metrics.latency.total.p99 / maxVal) * 100}%` }}
                            transition={{ type: "spring", stiffness: 80, delay: 0.5 }}
                            className="w-3.5 sm:w-5 rounded-t-lg bg-gradient-to-t from-[#FF6B81] to-[#FF6B81]/70 shadow-[0_0_8px_rgba(255,107,129,0.2)] cursor-pointer hover:brightness-105"
                          />
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground mt-2 tracking-wide">Total E2E Pipeline</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/40 text-muted-foreground font-semibold">
                    <th className="py-2.5">Pipeline Segment</th>
                    <th className="py-2.5">Mean Average</th>
                    <th className="py-2.5">p95 Latency</th>
                    <th className="py-2.5">p99 Max Delay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 font-medium">
                  {metrics?.latency && (
                    <>
                      <tr className="hover:bg-muted/15 transition-colors">
                        <td className="py-3 font-semibold">Vector Retrieval Search</td>
                        <td className="py-3 text-cyan">{metrics.latency.retrieval.mean} ms</td>
                        <td className="py-3">{metrics.latency.retrieval.p95} ms</td>
                        <td className="py-3">{metrics.latency.retrieval.p99} ms</td>
                      </tr>
                      <tr className="hover:bg-muted/15 transition-colors">
                        <td className="py-3 font-semibold">LLM Inference Generation</td>
                        <td className="py-3 text-primary">{metrics.latency.llm.mean} ms</td>
                        <td className="py-3">{metrics.latency.llm.p95} ms</td>
                        <td className="py-3">{metrics.latency.llm.p99} ms</td>
                      </tr>
                      <tr className="text-primary font-bold hover:bg-primary/[0.02] transition-colors">
                        <td className="py-3">Total End-to-End Pipeline</td>
                        <td className="py-3">{metrics.latency.total.mean} ms</td>
                        <td className="py-3">{metrics.latency.total.p95} ms</td>
                        <td className="py-3">{metrics.latency.total.p99} ms</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Endpoint Usage Distribution */}
          <div className="clay-panel p-5 bg-card/45">
            <h3 className="font-bold text-xs uppercase text-muted-foreground/80 tracking-wider mb-4">
              Endpoint Distribution
            </h3>
            <div className="space-y-4">
              {metrics?.usage.requests_by_endpoint && Object.entries(metrics.usage.requests_by_endpoint).length > 0 ? (
                Object.entries(metrics.usage.requests_by_endpoint)
                  .sort((a, b) => b[1] - a[1])
                  .map(([endpoint, count]) => {
                    const pct = totalRequests > 0 ? (count / totalRequests) * 100 : 0;
                    return (
                      <div key={endpoint} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <code className="text-[11px] font-mono text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-lg border border-border/30">
                            {endpoint}
                          </code>
                          <span className="text-[11px] text-muted-foreground/90 font-medium">
                            {count} requests ({Math.round(pct)}%)
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-black/5 dark:bg-white/5 overflow-hidden shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)] border border-border/10">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ type: "spring", stiffness: 60, delay: 0.1 }}
                            className="h-full bg-gradient-to-r from-[#6D6BFF] to-[#B48CFF] rounded-full shadow-[0_0_8px_rgba(109,107,255,0.3)]"
                          />
                        </div>
                      </div>
                    );
                  })
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">No request distributions logged.</p>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Failure Logs */}
        <div className="lg:col-span-1">
          <div className="clay-panel p-5 h-full bg-card/45 flex flex-col overflow-hidden">
            <h3 className="font-bold text-xs uppercase text-muted-foreground/80 tracking-wider mb-3.5 shrink-0">
              Workspace Error Log
            </h3>
            
            <div className="flex-grow overflow-y-auto space-y-2.5 pr-1 scrollbar text-xs">
              {metrics?.failures.last_errors && metrics.failures.last_errors.length > 0 ? (
                metrics.failures.last_errors.map((err) => (
                  <motion.div 
                    key={err.id} 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 rounded-2xl border border-rose-500/10 bg-rose-500/[0.03] dark:bg-rose-500/[0.02] text-left space-y-1.5 shadow-[inset_-1px_-1px_3px_rgba(0,0,0,0.02),_inset_1px_1px_3px_rgba(255,255,255,0.05)]"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold uppercase text-[9px] bg-red-500/10 text-red-500 border border-red-500/20 px-1.5 py-0.5 rounded">
                        HTTP {err.status_code}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(err.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-bold text-[10px] text-foreground truncate">
                      {err.method} {err.endpoint}
                    </p>
                    <p className="text-[10px] text-red-600 dark:text-rose-400 break-words font-medium">
                      {err.error_message}
                    </p>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-20 space-y-2 text-muted-foreground">
                  <AlertTriangle className="h-7 w-7 text-emerald-500/70 mx-auto" />
                  <p className="text-xs">No errors or timeouts detected.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
