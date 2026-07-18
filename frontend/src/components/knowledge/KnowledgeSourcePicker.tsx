import React, { useState } from "react";
import { Search, Files, FileText, Star, Clock } from "lucide-react";
import { useKnowledgeSources } from "@/hooks/useKnowledgeSources";
import { KnowledgeSourceCard } from "./KnowledgeSourceCard";
import { KnowledgeSource } from "@/types";
import { isDocumentReady } from "@/lib/document-status";

interface KnowledgeSourcePickerProps {
  selectedSourceId: string | null;
  onSelect: (id: string, type: "note" | "document") => void;
  allowProcessing?: boolean;
}

type FilterTab = "all" | "documents" | "notes" | "favorites" | "recent";

export const KnowledgeSourcePicker: React.FC<KnowledgeSourcePickerProps> = ({
  selectedSourceId,
  onSelect,
  allowProcessing = false,
}) => {
  const { data: sources = [], isLoading } = useKnowledgeSources({
    includeProcessing: true, // we fetch all so we can show statuses, but disable selecting if processing (unless allowProcessing)
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // Filtering logic
  const filteredSources = sources.filter((source) => {
    // 1. Search Query filter
    if (
      searchQuery &&
      !source.title.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    // 2. Tab filters
    if (activeTab === "documents" && source.source_type !== "document") {
      return false;
    }
    if (activeTab === "notes" && source.source_type !== "note") {
      return false;
    }
    if (activeTab === "favorites" && !source.metadata.is_favorite) {
      return false;
    }

    // 3. Status filter — show processing docs so user can see pipeline state.
    // NOTE: normalize to lowercase before comparing because the ingestion pipeline
    // writes uppercase statuses ("COMPLETED", "UPLOADED", etc.) which are passed
    // through the API verbatim. A case-sensitive "!== 'completed'" would hide
    // every document that has status "COMPLETED" (all successfully processed ones).
    // We only hide documents when allowProcessing=false AND the doc is genuinely
    // not ready — i.e. status is not completed in any casing.
    if (
      !allowProcessing &&
      source.source_type === "document" &&
      !isDocumentReady(source.status)
    ) {
      return false;
    }

    return true;
  });

  // Grouping into Documents and Notes
  const documents = filteredSources.filter((s) => s.source_type === "document");
  const notes = filteredSources.filter((s) => s.source_type === "note");

  // Sorting for Recent Tab
  const recentSources = [...filteredSources].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Header */}
      <div className="p-4 border-b border-border/40 shrink-0">
        <h3 className="font-extrabold text-sm text-foreground tracking-tight flex items-center gap-2">
          Knowledge Sources
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Select notes or documents as context.
        </p>

        {/* Premium search input */}
        <div className="relative mt-3">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search sources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-4 py-2 text-xs font-medium rounded-xl border border-border/40 bg-background/55 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-300"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: "all", label: "All" },
            { id: "documents", label: "Docs", icon: Files },
            { id: "notes", label: "Notes", icon: FileText },
            { id: "favorites", label: "Stars", icon: Star },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as FilterTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all duration-300 ${
                  isActive
                    ? "bg-primary/10 border-primary/25 text-primary shadow-sm"
                    : "bg-transparent border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/15"
                }`}
              >
                {Icon && <Icon className="h-3 w-3 shrink-0" />}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sources Body list */}
      <div className="flex-grow overflow-y-auto p-3 space-y-4 scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading sources...
            </span>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xs text-muted-foreground">No matching sources found.</p>
          </div>
        ) : (
          <>
            {/* Documents Section */}
            {documents.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground/60 px-2 pb-2 flex items-center gap-1.5">
                  <Files className="h-3.5 w-3.5 text-emerald-500" />
                  Documents ({documents.length})
                </p>
                <div className="space-y-1.5">
                  {documents.map((source) => (
                    <KnowledgeSourceCard
                      key={source.id}
                      source={source}
                      isSelected={selectedSourceId === source.id}
                      onClick={() => onSelect(source.id, "document")}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Notes Section */}
            {notes.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground/60 px-2 pb-2 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-amber-500" />
                  Notes ({notes.length})
                </p>
                <div className="space-y-1.5">
                  {notes.map((source) => (
                    <KnowledgeSourceCard
                      key={source.id}
                      source={source}
                      isSelected={selectedSourceId === source.id}
                      onClick={() => onSelect(source.id, "note")}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
