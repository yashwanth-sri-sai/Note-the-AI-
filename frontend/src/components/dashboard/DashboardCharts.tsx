import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { TrendingUp, Layers } from "lucide-react";

interface NoteItem {
  id: string;
  created_at: string;
}

interface DocumentItem {
  id: string;
  created_at: string;
}

interface FolderItem {
  id: string;
}

interface ConversationItem {
  id: string;
}

interface DashboardChartsProps {
  notes?: NoteItem[];
  documents?: DocumentItem[];
  folders?: FolderItem[];
  conversations?: ConversationItem[];
}

const AURORA_COLORS = {
  notes: "var(--primary)",
  documents: "#10b981", // emerald
  folders: "#f59e0b",   // amber
  chats: "#a855f7",     // purple
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl border border-white/[0.08] px-3 py-2 text-left"
      style={{
        background: "rgba(10,12,20,0.90)",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-[10px]">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground/70 capitalize">{p.name}:</span>
          <span className="font-bold text-foreground/90">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  notes = [],
  documents = [],
  folders = [],
  conversations = [],
}) => {
  const isDataEmpty = notes.length === 0 && documents.length === 0;

  const growthData = useMemo(() => {
    if (isDataEmpty) {
      return Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          date: d.toLocaleDateString(undefined, { weekday: "short" }),
          notes: [2, 3, 5, 8, 12, 14, 15][i],
          documents: [1, 2, 4, 4, 6, 8, 9][i],
        };
      });
    }

    const dataMap: Record<string, { notes: number; documents: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dataMap[d.toDateString()] = { notes: 0, documents: 0 };
    }

    notes.forEach((n) => {
      const key = new Date(n.created_at).toDateString();
      if (dataMap[key]) dataMap[key].notes += 1;
    });
    documents.forEach((d) => {
      const key = new Date(d.created_at).toDateString();
      if (dataMap[key]) dataMap[key].documents += 1;
    });

    let notesAccum = notes.length - Object.values(dataMap).reduce((s, v) => s + v.notes, 0);
    let docsAccum = documents.length - Object.values(dataMap).reduce((s, v) => s + v.documents, 0);

    return Object.entries(dataMap).map(([dateStr, counts]) => {
      notesAccum += counts.notes;
      docsAccum += counts.documents;
      return {
        date: new Date(dateStr).toLocaleDateString(undefined, { weekday: "short" }),
        notes: notesAccum,
        documents: docsAccum,
      };
    });
  }, [notes, documents, isDataEmpty]);

  const compositionData = useMemo(() => [
    { name: "Notes", count: notes.length, color: AURORA_COLORS.notes },
    { name: "Docs", count: documents.length, color: AURORA_COLORS.documents },
    { name: "Folders", count: folders.length, color: AURORA_COLORS.folders },
    { name: "Chats", count: conversations.length, color: AURORA_COLORS.chats },
  ], [notes, documents, folders, conversations]);

  const tickStyle = {
    fill: "rgba(148,163,184,0.45)",
    fontSize: 9,
    fontFamily: "monospace",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Area Chart — 7-Day Knowledge Growth */}
      <div className="lg:col-span-2 space-y-3 text-left">
        <h2 className="text-xs font-bold uppercase text-muted-foreground/55 tracking-wider flex items-center gap-2 px-1">
          <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Knowledge Growth · 7 Days
        </h2>

        <div
          className="relative h-56 rounded-2xl border border-white/[0.05] p-4 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.012)" }}
        >
          {isDataEmpty && (
            <div
              className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl gap-2 text-center p-6"
              style={{ background: "rgba(10,12,20,0.65)", backdropFilter: "blur(8px)" }}
            >
              <span className="text-xl" aria-hidden="true">📈</span>
              <p className="text-xs font-bold text-foreground/60">No data yet — preview mode</p>
              <p className="text-[10px] text-muted-foreground/50 max-w-[180px] leading-relaxed">
                Upload documents or write notes to see your real growth.
              </p>
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="gradNotes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.30} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradDocs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={AURORA_COLORS.documents} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={AURORA_COLORS.documents} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="notes"
                stroke="var(--primary)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradNotes)"
                isAnimationActive={true}
                animationDuration={1000}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="documents"
                stroke={AURORA_COLORS.documents}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#gradDocs)"
                isAnimationActive={true}
                animationDuration={1000}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart — Composition */}
      <div className="space-y-3 text-left">
        <h2 className="text-xs font-bold uppercase text-muted-foreground/55 tracking-wider flex items-center gap-2 px-1">
          <Layers className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Composition
        </h2>

        <div
          className="h-56 rounded-2xl border border-white/[0.05] p-4"
          style={{ background: "rgba(255,255,255,0.012)" }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compositionData} margin={{ top: 10, right: 0, left: -28, bottom: 0 }}>
              <XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.025)" }}
                content={<CustomTooltip />}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={32} isAnimationActive animationDuration={900} animationEasing="ease-out">
                {compositionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
