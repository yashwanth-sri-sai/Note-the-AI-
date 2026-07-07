import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { TrendingUp, Layers } from "lucide-react";
import { DashboardCard } from "./DashboardCard";

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

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  notes = [],
  documents = [],
  folders = [],
  conversations = [],
}) => {
  const isDataEmpty = notes.length === 0 && documents.length === 0;

  // 1. Process Area Chart Data: Last 7 Days Knowledge Growth Trend
  const growthData = useMemo(() => {
    if (isDataEmpty) {
      // Premium placeholder data for empty workspace visual backdrop
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

    // Dynamic extraction of creation timestamps over past 7 days
    const dataMap: Record<string, { notes: number; documents: number }> = {};
    
    // Initialize past 7 days keys
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      dataMap[key] = { notes: 0, documents: 0 };
    }

    notes.forEach((n) => {
      const key = new Date(n.created_at).toDateString();
      if (dataMap[key]) dataMap[key].notes += 1;
    });

    documents.forEach((d) => {
      const key = new Date(d.created_at).toDateString();
      if (dataMap[key]) dataMap[key].documents += 1;
    });

    // Accumulate total counts (running sum) for growth representation
    let notesAccum = notes.length - Object.values(dataMap).reduce((sum, d) => sum + d.notes, 0);
    let docsAccum = documents.length - Object.values(dataMap).reduce((sum, d) => sum + d.documents, 0);

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

  // 2. Process Bar Chart Data: Content Composition
  const compositionData = useMemo(() => {
    return [
      { name: "Notes", count: notes.length, color: "var(--primary)" },
      { name: "Docs", count: documents.length, color: "var(--emerald)" },
      { name: "Folders", count: folders.length, color: "var(--rose)" },
      { name: "Chats", count: conversations.length, color: "var(--amber)" },
    ];
  }, [notes, documents, folders, conversations]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 7-Days Trend Area Chart */}
      <div className="lg:col-span-2 space-y-4 text-left">
        <h2 className="text-xs font-bold uppercase text-muted-foreground/60 tracking-wider flex items-center gap-2 px-1">
          <TrendingUp className="h-4 w-4 text-primary" /> Second Brain Knowledge Growth
        </h2>
        
        <DashboardCard className="relative h-64 bg-white/[0.01] border border-white/[0.03] rounded-2xl p-5 flex flex-col justify-between">
          {/* Shimmering glass placeholder state overlay if no data */}
          {isDataEmpty && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0F1117]/65 backdrop-blur-[6px] rounded-2xl p-6 text-center gap-2">
              <span className="text-base">📈</span>
              <h4 className="text-xs font-bold text-foreground">Waiting for knowledge trends</h4>
              <p className="text-[10px] text-muted-foreground/60 max-w-[200px] leading-normal">
                Upload research documents or write notes to activate growth analysis.
              </p>
            </div>
          )}

          <div className="h-full w-full z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNotes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorDocs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--emerald)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--emerald)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: "hsl(var(--muted-foreground) / 0.55)", fontSize: 9, fontFamily: "monospace" }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground) / 0.55)", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--surface-secondary))",
                    borderRadius: "8px",
                    fontSize: "10px",
                    color: "hsl(var(--foreground))"
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="notes" 
                  stroke="var(--primary)" 
                  fillOpacity={1} 
                  fill="url(#colorNotes)" 
                  strokeWidth={2}
                />
                <Area 
                  type="monotone" 
                  dataKey="documents" 
                  stroke="var(--emerald)" 
                  fillOpacity={1} 
                  fill="url(#colorDocs)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
      </div>

      {/* Composition Bar Chart */}
      <div className="space-y-4 text-left">
        <h2 className="text-xs font-bold uppercase text-muted-foreground/60 tracking-wider flex items-center gap-2 px-1">
          <Layers className="h-4 w-4 text-primary" /> Brain Composition
        </h2>

        <DashboardCard className="h-64 bg-white/[0.01] border border-white/[0.03] rounded-2xl p-5 flex flex-col justify-between">
          <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compositionData} margin={{ top: 15, right: 0, left: -25, bottom: 0 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: "hsl(var(--muted-foreground) / 0.55)", fontSize: 9, fontFamily: "monospace" }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground) / 0.55)", fontSize: 9, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.01)" }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--surface-secondary))",
                    borderRadius: "8px",
                    fontSize: "10px",
                    color: "hsl(var(--foreground))"
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={30}>
                  {compositionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DashboardCard>
      </div>
    </div>
  );
};
