import React, { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { 
  BarChart3, Loader2, RefreshCw, AlertTriangle, 
  Activity, Cpu, Database, Zap, HelpCircle, FileText
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
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100 } }
  };

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
          className="p-2 text-muted-foreground hover:text-foreground clay-btn bg-card/50"
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
        <motion.div variants={itemVariants} className="clay-card p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Total API Calls
            </span>
            <h3 className="text-xl font-black text-foreground">{totalRequests}</h3>
            <p className="text-[9px] text-muted-foreground">Requests processed in workspace</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Activity className="h-5 w-5" />
          </div>
        </motion.div>

        {/* Metric 2: Success Rate */}
        <motion.div variants={itemVariants} className="clay-card p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Success Ratio
            </span>
            <h3 className="text-xl font-black text-emerald-500">
              {Math.round(successRate * 1000) / 10}%
            </h3>
            <p className="text-[9px] text-muted-foreground">HTTP 2xx response rate</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner">
            <Zap className="h-5 w-5" />
          </div>
        </motion.div>

        {/* Metric 3: Total Tokens */}
        <motion.div variants={itemVariants} className="clay-card p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              LLM Tokens Used
            </span>
            <h3 className="text-xl font-black text-indigo-500">{totalTokens.toLocaleString()}</h3>
            <p className="text-[9px] text-muted-foreground">Prompt + Completion units</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner">
            <Cpu className="h-5 w-5" />
          </div>
        </motion.div>

        {/* Metric 4: Avg Response Time */}
        <motion.div variants={itemVariants} className="clay-card p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Avg Latency
            </span>
            <h3 className="text-xl font-black text-amber-500">{avgResponseTime} ms</h3>
            <p className="text-[9px] text-muted-foreground">Average round-trip delay</p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner">
            <Database className="h-5 w-5" />
          </div>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Percentiles Grid */}
        <div className="lg:col-span-2 space-y-6">
          <div className="clay-panel p-5 bg-card/45">
            <h3 className="font-bold text-xs uppercase text-muted-foreground/80 tracking-wider mb-4">
              Latency Performance matrix (ms)
            </h3>
            
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
                      <tr>
                        <td className="py-3 font-semibold">Vector Retrieval Search</td>
                        <td className="py-3 text-amber-600 dark:text-amber-400">{metrics.latency.retrieval.mean} ms</td>
                        <td className="py-3">{metrics.latency.retrieval.p95} ms</td>
                        <td className="py-3">{metrics.latency.retrieval.p99} ms</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-semibold">LLM Inference Generation</td>
                        <td className="py-3 text-indigo-500">{metrics.latency.llm.mean} ms</td>
                        <td className="py-3">{metrics.latency.llm.p95} ms</td>
                        <td className="py-3">{metrics.latency.llm.p99} ms</td>
                      </tr>
                      <tr className="text-primary font-bold">
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
            <div className="space-y-3.5">
              {metrics?.usage.requests_by_endpoint && Object.entries(metrics.usage.requests_by_endpoint).length > 0 ? (
                Object.entries(metrics.usage.requests_by_endpoint)
                  .sort((a, b) => b[1] - a[1])
                  .map(([endpoint, count]) => {
                    const pct = totalRequests > 0 ? (count / totalRequests) * 100 : 0;
                    return (
                      <div key={endpoint} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <code className="text-[11px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded border border-border/30">
                            {endpoint}
                          </code>
                          <span>{count} requests ({Math.round(pct)}%)</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden shadow-inner border border-border/10">
                          <div 
                            style={{ width: `${pct}%` }}
                            className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full"
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
                  <div 
                    key={err.id} 
                    className="p-3 rounded-xl border border-red-500/10 bg-red-500/5 text-left space-y-1.5 shadow-sm"
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
                    <p className="text-[10px] text-red-600 dark:text-red-400 break-words font-medium">
                      {err.error_message}
                    </p>
                  </div>
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
