import React, { useEffect, useState, useRef } from "react";
import { useNotes, useNote, useCreateNote, useUpdateNote, useDeleteNote, useSetNoteTags } from "@/hooks/useNotes";
import { useFolders } from "@/hooks/useFolders";
import { useTags } from "@/hooks/useTags";
import { useUIStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient, getAccessToken } from "@/lib/api-client";
import {
  Search, Plus, Star, Trash2, FolderOpen,
  Check, ChevronDown, BookOpen,
  Sparkles, Send, X, CheckSquare, Square
} from "lucide-react";
import { Loader } from "../../components/ui/Loader";
import { TipTapEditor } from "@/components/editor/TipTapEditor";
import { motion, AnimatePresence } from "framer-motion";
import { getNotePreview } from "@/lib/utils";
import { Button, IconButton, DangerButton, AIButton } from "@/components/ui/button";

export const NotesPage: React.FC = () => {
  const {
    activeNoteId,
    setActiveNoteId,
    activeFolderId,
    activeTagId,
    resetFilters,
    setActiveTab,
    setPendingAIQuery,
    isFocusMode
  } = useUIStore();

  // Fetch lists
  const { data: notes, isLoading: notesLoading, isError: notesError, refetch: refetchNotes } = useNotes({
    folderId: activeFolderId,
    tagId: activeTagId
  });
  const { data: folders } = useFolders();
  const { data: tags } = useTags();

  // Fetch active note
  const { data: activeNote, isLoading: noteLoading } = useNote(activeNoteId);

  // Mutations
  const { mutateAsync: createNote } = useCreateNote();
  const { mutateAsync: updateNote } = useUpdateNote();
  const { mutateAsync: deleteNote } = useDeleteNote();
  const { mutateAsync: setNoteTags } = useSetNoteTags();

  // Panel resizing states
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [copilotWidth, setCopilotWidth] = useState(360);
  const [showCopilot, setShowCopilot] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingCopilot, setIsResizingCopilot] = useState(false);

  // Copilot Chat states
  const [copilotConvId, setCopilotConvId] = useState<string | null>(null);
  const [copilotMessages, setCopilotMessages] = useState<any[]>([]);
  const [copilotInput, setCopilotInput] = useState("");
  const [isCopilotStreaming, setIsCopilotStreaming] = useState(false);
  const [hoveredCitation, setHoveredCitation] = useState<{ ref: any; rect: DOMRect } | null>(null);
  const [activeCitationPreview, setActiveCitationPreview] = useState<any | null>(null);
  const copilotChatEndRef = useRef<HTMLDivElement | null>(null);

  // Multi-select note actions states
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [showBulkFolderDropdown, setShowBulkFolderDropdown] = useState(false);
  const [showBulkTagDropdown, setShowBulkTagDropdown] = useState(false);

  // Automatically scroll to bottom in Copilot Chat
  useEffect(() => {
    if (copilotChatEndRef.current) {
      copilotChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [copilotMessages]);

  // Reset copilot session when note changes
  useEffect(() => {
    setCopilotConvId(null);
    setCopilotMessages([]);
    setIsCopilotStreaming(false);
  }, [activeNoteId]);

  const startResizeSidebar = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  };

  const startResizeCopilot = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingCopilot(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingSidebar) {
        const newWidth = Math.max(180, Math.min(400, e.clientX - 65));
        setSidebarWidth(newWidth);
      }
      if (isResizingCopilot) {
        const newWidth = Math.max(260, Math.min(500, window.innerWidth - e.clientX));
        setCopilotWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      setIsResizingCopilot(false);
    };

    if (isResizingSidebar || isResizingCopilot) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar, isResizingCopilot]);

  const toggleSelectNote = (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNoteIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedNoteIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedNoteIds.length} notes?`)) return;
    try {
      await Promise.all(selectedNoteIds.map((id) => deleteNote(id)));
      setSelectedNoteIds([]);
      setIsMultiSelectMode(false);
      if (selectedNoteIds.includes(activeNoteId || "")) {
        setActiveNoteId(null);
      }
    } catch (err) {
      alert("Failed to delete some notes.");
    }
  };

  const handleBulkMoveToFolder = async (folderId: string | null) => {
    if (selectedNoteIds.length === 0) return;
    try {
      await Promise.all(
        selectedNoteIds.map((id) =>
          updateNote({
            id,
            data: { folder_id: folderId }
          })
        )
      );
      setSelectedNoteIds([]);
      setIsMultiSelectMode(false);
      alert("Notes moved successfully.");
    } catch (err) {
      alert("Failed to move notes.");
    }
  };

  const handleBulkAttachTag = async (tagId: string) => {
    if (selectedNoteIds.length === 0) return;
    try {
      await Promise.all(
        selectedNoteIds.map(async (noteId) => {
          const note = notes?.find((n) => n.id === noteId);
          if (!note) return;
          const isAttached = note.tags.some((t) => t.id === tagId);
          if (isAttached) return;
          const newTagIds = [...note.tags.map((t) => t.id), tagId];
          await setNoteTags({ id: noteId, tagIds: newTagIds });
        })
      );
      setSelectedNoteIds([]);
      setIsMultiSelectMode(false);
      alert("Tags attached successfully.");
    } catch (err) {
      alert("Failed to attach tags.");
    }
  };

  const handleSendCopilotMessage = async (overrideQuery?: string) => {
    const queryToSend = overrideQuery || copilotInput;
    if (!queryToSend.trim()) return;

    let convId = copilotConvId;
    if (!convId) {
      try {
        const res = await apiClient.post("/chat/conversations", {
          title: `Copilot: ${activeNote?.title || "Untitled Note"}`
        });
        convId = res.data.id;
        setCopilotConvId(convId);
      } catch (err) {
        console.error("Error creating conversation", err);
        return;
      }
    }

    if (!convId) return;

    setCopilotInput("");
    setIsCopilotStreaming(true);

    const userMsg = {
      id: crypto.randomUUID(),
      sender_role: "user" as const,
      content: queryToSend,
      created_at: new Date().toISOString()
    };
    setCopilotMessages((prev) => [...prev, userMsg]);

    const assistantMsgPlaceholderId = crypto.randomUUID();
    const assistantPlaceholder = {
      id: assistantMsgPlaceholderId,
      sender_role: "assistant" as const,
      content: "",
      created_at: new Date().toISOString(),
      isStreaming: true,
      retrieved_chunks: [] as any[]
    };
    setCopilotMessages((prev) => [...prev, assistantPlaceholder]);

    const activeWorkspace = useWorkspaceStore.getState().activeWorkspaceId;
    const apiURL = apiClient.defaults.baseURL;

    try {
      const getFetchOptions = () => {
        const currentToken = getAccessToken();

        return {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            ...(currentToken ? { "Authorization": `Bearer ${currentToken}` } : {}),
            ...(activeWorkspace ? { "X-Workspace-ID": activeWorkspace } : {}),
          },
          credentials: "include" as RequestCredentials,
          body: JSON.stringify({
            content: queryToSend,
            stream: true
          })
        };
      };

      let response = await fetch(`${apiURL}/chat/conversations/${convId}/messages`, getFetchOptions());

      if (response.status === 401) {
        try {
          await apiClient.get("/users/me");
          response = await fetch(`${apiURL}/chat/conversations/${convId}/messages`, getFetchOptions());
        } catch (refreshError) {
          throw new Error("Session expired. Please log in again.");
        }
      }

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let tempContent = "";
      let tempFootnotes = "";
      let finalMetadata: any = null;
      let doneStreaming = false;

      console.log("[FRONTEND_STREAM_STARTED]", { convId, query: queryToSend.slice(0, 80) });

      while (!doneStreaming) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line) continue;

          if (line === "data: [DONE]") {
            doneStreaming = true;
            break;
          }

          if (line.startsWith("data: ")) {
            const dataJsonStr = line.slice(6);
            try {
              const payload = JSON.parse(dataJsonStr);
              if (payload.type === "content") {
                tempContent += payload.delta;
                setCopilotMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgPlaceholderId
                      ? { ...msg, content: tempContent + tempFootnotes }
                      : msg
                  )
                );
              } else if (payload.type === "footnote") {
                tempFootnotes = payload.footnote;
                setCopilotMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgPlaceholderId
                      ? { ...msg, content: tempContent + tempFootnotes }
                      : msg
                  )
                );
              } else if (payload.type === "metadata") {
                finalMetadata = payload;
              } else if (payload.type === "error") {
                tempContent = `Error: ${payload.message || "Error"}`;
                setCopilotMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgPlaceholderId
                      ? { ...msg, content: tempContent }
                      : msg
                  )
                );
                doneStreaming = true;
                break;
              }
            } catch (err) {
              console.error(err);
            }
          }
        }
      }

      console.log("[FRONTEND_STREAM_FINISHED]", {
        contentLength: tempContent.length,
        confidence: finalMetadata?.confidence_score,
        model: finalMetadata?.model_used,
      });

      setCopilotMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgPlaceholderId
            ? {
                ...msg,
                content: tempContent + tempFootnotes,
                retrieved_chunks: finalMetadata?.references || [],
                isStreaming: false
              }
            : msg
        )
      );

    } catch (err: any) {
      console.error(err);
      setCopilotMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgPlaceholderId
            ? { ...msg, content: `Error: ${err.message || "Network error."}`, isStreaming: false }
            : msg
        )
      );
    } finally {
      setIsCopilotStreaming(false);
    }
  };

  const renderCopilotMessageContent = (msg: any) => {
    const text = msg.content;
    const referencesList = msg.retrieved_chunks || [];
    const parts = text.split(/(\[\d+\])/g);
    if (parts.length <= 1) {
      return <p className="whitespace-pre-wrap text-[11px] leading-relaxed font-semibold">{text}</p>;
    }

    return (
      <p className="whitespace-pre-wrap text-[11px] leading-relaxed font-semibold">
        {parts.map((part: string, idx: number) => {
          const match = part.match(/^\[(\d+)\]$/);
          if (match) {
            const indexNum = parseInt(match[1], 10);
            const ref = referencesList[indexNum - 1];
            if (ref) {
              return (
                <button
                  key={idx}
                  onClick={() => setActiveCitationPreview(ref)}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredCitation({ ref, rect });
                  }}
                  onMouseLeave={() => setHoveredCitation(null)}
                  className="mx-0.5 inline-flex h-4 items-center justify-center rounded bg-primary/25 px-1.5 py-0.5 text-[9px] font-extrabold text-primary hover:bg-primary/40 border border-primary/20 active:scale-95 transition-all shadow-sm align-middle cursor-pointer"
                >
                  {indexNum}
                </button>
              );
            }
          }
          return part;
        })}
      </p>
    );
  };

  // Local editor states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "failed">("saved");
  const [searchQuery, setSearchQuery] = useState("");

  // Dropdown open states
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveNoteIdRef = useRef<string | null>(null);

  // Synchronize local states when active note changes
  useEffect(() => {
    if (!activeNoteId) {
      setTitle("");
      setContent("");
      setIsFavorite(false);
      setFolderId(null);
      lastActiveNoteIdRef.current = null;
      setSaveStatus("saved");
      return;
    }

    if (activeNote && activeNote.id === activeNoteId) {
      if (lastActiveNoteIdRef.current !== activeNote.id) {
        setTitle(activeNote.title);
        setContent(activeNote.content);
        setIsFavorite(activeNote.is_favorite);
        setFolderId(activeNote.folder_id);
        setSaveStatus("saved");
        lastActiveNoteIdRef.current = activeNote.id;
      }
    }
  }, [activeNote, activeNoteId]);

  // Debounced Autosave Trigger
  useEffect(() => {
    if (!activeNoteId || !activeNote) return;

    // Check if changes actually occurred
    const hasChanges =
      title !== activeNote.title ||
      content !== activeNote.content ||
      isFavorite !== activeNote.is_favorite ||
      folderId !== activeNote.folder_id;

    if (!hasChanges) return;

    setSaveStatus("saving");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await updateNote({
          id: activeNoteId,
          data: {
            title,
            content,
            folder_id: folderId,
            is_favorite: isFavorite,
          },
        });
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("failed");
      }
    }, 1000); // 1-second debounce timeout

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [title, content, isFavorite, folderId]);

  const handleCreateNote = async () => {
    try {
      const newNote = await createNote({
        title: "New Note",
        content: "",
        folder_id: activeFolderId || undefined,
      });
      setActiveNoteId(newNote.id);
    } catch (err) {
      alert("Failed to create note.");
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this note?")) return;

    try {
      await deleteNote(id);
      if (activeNoteId === id) {
        setActiveNoteId(null);
      }
    } catch (err) {
      alert("Failed to delete note.");
    }
  };

  const handleNoteAIAction = (action: string) => {
    if (!activeNote) return;
    
    // Get clean plain text of active note
    const cleanText = activeNote.content 
      ? activeNote.content.replace(/<[^>]*>/g, " ").replace(/&[a-z0-9#]+;/gi, " ").replace(/\s+/g, " ").trim() 
      : "";

    if (action === "summarize") {
      setPendingAIQuery(`Summarize my note "${activeNote.title}":\n\n${cleanText}`);
      setActiveTab("chat");
    } else if (action === "explain") {
      setPendingAIQuery(`Explain the key concepts in this note "${activeNote.title}":\n\n${cleanText}`);
      setActiveTab("chat");
    } else if (action === "flashcards") {
      setActiveTab("flashcards");
    } else if (action === "quiz") {
      setActiveTab("quizzes");
    }
  };

  const handleEditorAIAction = (action: "explain" | "summarize" | "improve", selectedText: string) => {
    if (action === "explain") {
      setPendingAIQuery(`Explain this text from my note "${activeNote?.title}":\n\n"${selectedText}"`);
    } else if (action === "summarize") {
      setPendingAIQuery(`Summarize this text from my note "${activeNote?.title}":\n\n"${selectedText}"`);
    } else if (action === "improve") {
      setPendingAIQuery(`Refine and rewrite this text for clarity:\n\n"${selectedText}"`);
    }
    setActiveTab("chat");
  };

  const handleToggleTag = async (tagId: string) => {
    if (!activeNote) return;
    const isAttached = activeNote.tags.some((t) => t.id === tagId);
    let newTagIds = [];
    if (isAttached) {
      newTagIds = activeNote.tags.filter((t) => t.id !== tagId).map((t) => t.id);
    } else {
      newTagIds = [...activeNote.tags.map((t) => t.id), tagId];
    }

    try {
      await setNoteTags({ id: activeNote.id, tagIds: newTagIds });
    } catch (err) {
      alert("Failed to update tags.");
    }
  };

  // Local filter list
  const filteredNotes =
    notes?.filter(
      (n) =>
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.04 }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 350, damping: 25 } }
  } as const;

  return (
    <div className="h-[calc(100vh-8rem)] flex overflow-hidden clay-panel bg-card/10 backdrop-blur-md relative">
      {/* Left Column: Notes selection list */}
      {!isFocusMode && (
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="border-r border-border/40 flex flex-col bg-background/20 h-full shrink-0"
        >
          {/* Search header */}
          <div className="p-4 border-b border-border/40 flex flex-col gap-3 shrink-0">
            <div className="relative">
              <Search className="absolute inset-y-0 left-0 pl-3 h-full w-9 text-muted-foreground flex items-center shrink-0 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full py-2.5 pl-9 pr-4 text-xs outline-none clay-input"
              />
            </div>

            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] uppercase font-extrabold text-muted-foreground/80 tracking-wider">
                {activeFolderId ? "Folder Notes" : activeTagId ? "Tag Notes" : "All Notes"} ({filteredNotes.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsMultiSelectMode(!isMultiSelectMode);
                    setSelectedNoteIds([]);
                  }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                    isMultiSelectMode
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/10 border-border/20 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isMultiSelectMode ? "Cancel" : "Select"}
                </button>
                {(activeFolderId || activeTagId) && (
                  <button
                    onClick={resetFilters}
                    className="text-[10px] text-primary hover:underline font-bold"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Note list body */}
          <div className="flex-grow overflow-y-auto divide-y divide-border/20 p-2 space-y-1.5 scrollbar">
            {notesLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 rounded-2xl border border-white/[0.03] bg-white/[0.01] space-y-2 animate-pulse">
                    <div className="h-3.5 w-3/4 rounded bg-white/[0.04]" />
                    <div className="h-2.5 w-1/2 rounded bg-white/[0.02]" />
                  </div>
                ))}
              </div>
            ) : notesError ? (
              <div className="text-center py-10 px-4 space-y-3">
                <p className="text-xs text-red-400 font-semibold">Failed to load notes</p>
                <button
                  onClick={() => refetchNotes()}
                  className="px-3.5 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.02] text-[10px] font-bold text-foreground transition-all duration-150"
                >
                  Try Again
                </button>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground p-4">
                No notes found. Click "+" below to write your first note.
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="space-y-1.5"
              >
                {filteredNotes.map((n) => (
                  <motion.div
                    key={n.id}
                    variants={itemVariants}
                    whileHover={{ x: 2 }}
                    onClick={(e) => {
                      if (isMultiSelectMode) {
                        toggleSelectNote(n.id, e);
                      } else {
                        setActiveNoteId(n.id);
                      }
                    }}
                    className={`group text-left p-4 rounded-2xl cursor-pointer transition-all flex flex-col gap-1.5 relative overflow-hidden ${
                      activeNoteId === n.id
                        ? "bg-primary/10 border-l-4 border-l-primary shadow-sm"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {isMultiSelectMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectNote(n.id, e);
                          }}
                          className="text-primary hover:scale-105 transition-transform shrink-0 mt-0.5"
                        >
                          {selectedNoteIds.includes(n.id) ? (
                            <CheckSquare className="h-4.5 w-4.5 text-primary fill-primary/10" />
                          ) : (
                            <Square className="h-4.5 w-4.5 text-muted-foreground" />
                          )}
                        </button>
                      )}
                      <div className="flex-grow min-w-0 flex flex-col gap-1.5">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-xs truncate w-[80%] text-foreground">
                            {n.title || "Untitled Note"}
                          </h3>
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!isMultiSelectMode && (
                              <button
                                onClick={(e) => handleDeleteNote(n.id, e)}
                                className="text-muted-foreground hover:text-red-500 rounded p-0.5"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {getNotePreview(n.content, 80) || "Empty content..."}
                        </p>
                        <div className="flex justify-between items-center pt-1 border-t border-border/10">
                          <span className="text-[9px] text-muted-foreground/80 font-medium">
                            {new Date(n.updated_at).toLocaleDateString()}
                          </span>
                          {n.is_favorite && (
                            <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Create quick button */}
          <div className="p-3 border-t border-border/40 bg-background/10 shrink-0">
            <Button
              onClick={handleCreateNote}
              variant="primary"
              className="w-full flex items-center justify-center gap-2"
              icon={<Plus className="h-4 w-4 text-white" />}
            >
              Create Note
            </Button>
          </div>
        </div>
      )}

      {/* Drag Handle: Sidebar Resize */}
      <div
        onMouseDown={startResizeSidebar}
        className={`w-1 hover:w-1.5 transition-all bg-border/40 hover:bg-primary/50 cursor-col-resize h-full select-none shrink-0 ${
          isResizingSidebar ? "bg-primary w-1.5" : ""
        }`}
      />

      {/* Middle Column: Editing Panel */}
      <div className="flex-1 flex flex-col h-full bg-background/5 min-w-[300px]">
        {noteLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader size="md" />
          </div>
        ) : !activeNoteId ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full items-center justify-center text-center p-8 space-y-4"
          >
            <BookOpen className="h-12 w-12 text-muted-foreground/45" />
            <div>
              <h3 className="font-bold text-sm text-foreground">No note selected</h3>
              <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">
                Select an existing note from the side panel or create a new note to start writing.
              </p>
            </div>
            <Button
              onClick={handleCreateNote}
              variant="primary"
              size="md"
            >
              Create Note
            </Button>
          </motion.div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Editor Header */}
            <div className="p-4 border-b border-border/40 space-y-3 shrink-0 bg-background/10">
              <div className="flex justify-between items-center gap-4">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note Title..."
                  className="bg-transparent border-none text-lg font-black outline-none flex-grow placeholder:text-muted-foreground/60 focus:ring-0 text-foreground"
                />

                <div className="flex items-center gap-3 shrink-0">
                  {/* Save Status Cloud Indicator */}
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    {saveStatus === "saving" && "☁️ Saving..."}
                    {saveStatus === "saved" && "✓ Saved"}
                    {saveStatus === "failed" && "⚠️ Sync Failed"}
                  </span>

                  {/* Favorite Toggle */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsFavorite(!isFavorite)}
                    className={`p-2.5 transition-colors clay-btn ${
                      isFavorite ? "border-amber-500/30 text-amber-500 bg-amber-500/10 shadow-inner" : "text-muted-foreground bg-card/45"
                    }`}
                  >
                    <Star className={`h-4 w-4 ${isFavorite ? "fill-amber-500" : ""}`} />
                  </motion.button>

                  {/* Folder Mover Dropdown */}
                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowFolderDropdown(!showFolderDropdown);
                        setShowTagDropdown(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-colors clay-btn bg-card/45 text-foreground"
                    >
                      <FolderOpen className="h-4 w-4 text-amber" />
                      <span className="max-w-[80px] truncate">
                        {folders?.find((f) => f.id === folderId)?.name || "Move"}
                      </span>
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </motion.button>
                    <AnimatePresence>
                      {showFolderDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute right-0 mt-2 w-44 rounded-2xl shadow-xl p-1.5 z-20 space-y-0.5 text-left border border-border/40 backdrop-blur-md clay-panel bg-card/90"
                        >
                          <button
                            onClick={() => {
                              setFolderId(null);
                              setShowFolderDropdown(false);
                            }}
                            className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-muted/50 font-bold flex justify-between items-center"
                          >
                            Unassigned
                            {folderId === null && <Check className="h-3.5 w-3.5 text-primary" />}
                          </button>
                          {folders?.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => {
                                setFolderId(f.id);
                                setShowFolderDropdown(false);
                              }}
                              className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-muted/50 font-bold flex justify-between items-center truncate"
                            >
                              {f.name}
                              {folderId === f.id && <Check className="h-3.5 w-3.5 text-primary" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Tag Association Selector */}
                  <div className="relative">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowTagDropdown(!showTagDropdown);
                        setShowFolderDropdown(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-colors clay-btn bg-card/45 text-foreground"
                    >
                      <span className="flex h-2.5 w-2.5 rounded-full bg-purple-500"></span>
                      Tags
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </motion.button>
                    <AnimatePresence>
                      {showTagDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute right-0 mt-2 w-48 shadow-xl p-2 z-20 max-h-56 overflow-y-auto space-y-1.5 text-left border border-border/40 backdrop-blur-md scrollbar clay-panel bg-card/90"
                        >
                          <p className="text-[9px] uppercase font-extrabold text-muted-foreground px-1 pb-1.5 border-b border-border/40">
                            Toggle tags
                          </p>
                          {tags?.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic p-1">No tags created yet.</p>
                          ) : (
                            tags?.map((t) => {
                              const isAttached = activeNote?.tags.some((nt) => nt.id === t.id);
                              return (
                                <div
                                  key={t.id}
                                  onClick={() => handleToggleTag(t.id)}
                                  className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-muted/50 cursor-pointer text-xs font-bold"
                                >
                                  <span className="flex items-center gap-2 truncate">
                                    <span
                                      style={{ backgroundColor: t.color }}
                                      className="h-2 w-2 rounded-full shrink-0"
                                    ></span>
                                    <span className="truncate text-foreground">{t.name}</span>
                                  </span>
                                  {isAttached && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                                </div>
                              );
                            })
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* AI Copilot Sidebar Toggle */}
                  {!isFocusMode && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowCopilot(!showCopilot);
                        setShowFolderDropdown(false);
                        setShowTagDropdown(false);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-colors clay-btn ${
                        showCopilot ? "border-primary/30 text-primary bg-primary/10 shadow-inner" : "text-muted-foreground bg-card/45"
                      }`}
                    >
                      <Sparkles className={`h-4 w-4 ${showCopilot ? "animate-pulse" : ""}`} />
                      <span>Copilot</span>
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Tags bubble list below title */}
              {activeNote?.tags && activeNote.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {activeNote.tags.map((t) => (
                    <span
                      key={t.id}
                      style={{ backgroundColor: `${t.color}15`, color: t.color, borderColor: `${t.color}25` }}
                      className="rounded-lg border px-2.5 py-0.5 text-[9px] font-bold flex items-center gap-1"
                    >
                      {t.name}
                      <button
                        onClick={() => handleToggleTag(t.id)}
                        className="hover:bg-muted rounded-full p-0.5 shrink-0 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className="px-4 py-2 border-b border-border/20 flex flex-wrap items-center gap-2 bg-muted/5 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mr-1 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" /> AI Actions:
              </span>
              <AIButton
                onClick={() => handleNoteAIAction("summarize")}
                size="sm"
                className="h-8 py-0"
              >
                Summarize
              </AIButton>
              <AIButton
                onClick={() => handleNoteAIAction("explain")}
                size="sm"
                className="h-8 py-0"
              >
                Explain
              </AIButton>
              <AIButton
                onClick={() => handleNoteAIAction("flashcards")}
                size="sm"
                className="h-8 py-0"
              >
                Study Flashcards
              </AIButton>
              <AIButton
                onClick={() => handleNoteAIAction("quiz")}
                size="sm"
                className="h-8 py-0"
              >
                Practice Quiz
              </AIButton>
            </div>

            {/* Rich Text Editor */}
            <div className="flex-grow p-4 overflow-y-auto flex flex-col bg-background/5">
              <TipTapEditor content={content} onChange={setContent} onAction={handleEditorAIAction} />
            </div>
          </div>
        )}
      </div>

      {/* Drag Handle: Copilot Resize */}
      {!isFocusMode && showCopilot && (
        <div
          onMouseDown={startResizeCopilot}
          className={`w-1 hover:w-1.5 transition-all bg-border/40 hover:bg-primary/50 cursor-col-resize h-full select-none shrink-0 ${
            isResizingCopilot ? "bg-primary w-1.5" : ""
          }`}
        />
      )}

      {/* Right Column: AI Copilot Sidebar */}
      <AnimatePresence>
        {!isFocusMode && showCopilot && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: copilotWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="border-l border-border/40 flex flex-col bg-background/30 h-full shrink-0 overflow-hidden"
          >
            {/* Copilot Header */}
            <div className="p-4 border-b border-border/40 flex items-center justify-between bg-background/10 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
                <span className="font-extrabold text-sm text-foreground">AI Copilot</span>
              </div>
              <button
                onClick={() => setShowCopilot(false)}
                className="text-muted-foreground hover:text-foreground rounded-xl p-1.5 hover:bg-muted/50 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Copilot Chat Feed */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar">
              {copilotMessages.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center p-4 space-y-6">
                  <div className="p-4 rounded-3xl bg-primary/5 border border-primary/10">
                    <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-foreground">Ask anything about this note</h4>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
                      Ask questions, summarize key highlights, or ask Copilot to generate study flashcards from your text.
                    </p>
                  </div>
                  {/* Suggested questions engine */}
                  <div className="w-full space-y-2">
                    <span className="text-[9px] uppercase font-extrabold text-muted-foreground/60 tracking-wider block text-left">Suggested Questions</span>
                    <div className="flex flex-col gap-1.5">
                      {[
                        "Summarize this note",
                        "Extract key concepts",
                        "Generate study flashcards",
                        "Create a study quiz"
                      ].map((prompt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendCopilotMessage(prompt)}
                          className="w-full text-left p-2.5 text-[10px] font-bold rounded-2xl border border-border/40 hover:border-primary/30 hover:bg-primary/5 text-foreground transition-all cursor-pointer"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {copilotMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.sender_role === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                          {msg.sender_role === "user" ? "You" : "Copilot"}
                        </span>
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl max-w-[90%] text-left border ${
                          msg.sender_role === "user"
                            ? "bg-primary/10 border-primary/20 text-foreground"
                            : "bg-card/45 border-border/40 text-foreground"
                        }`}
                      >
                        {renderCopilotMessageContent(msg)}
                      </div>
                    </div>
                  ))}
                  <div ref={copilotChatEndRef} />
                </div>
              )}
            </div>

            {/* Copilot Chat Input */}
            <div className="p-3 border-t border-border/40 bg-background/10 shrink-0">
              <div className="flex items-center gap-2 relative">
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendCopilotMessage();
                    }
                  }}
                  disabled={isCopilotStreaming}
                  placeholder="Ask a question..."
                  className="w-full py-2.5 pl-3.5 pr-10 text-xs outline-none clay-input"
                />
                <button
                  onClick={() => handleSendCopilotMessage()}
                  disabled={isCopilotStreaming || !copilotInput.trim()}
                  className="absolute right-2 text-primary hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-all cursor-pointer p-1.5"
                >
                  {isCopilotStreaming ? (
                    <Loader size="sm" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Batch Action Bar */}
      <AnimatePresence>
        {isMultiSelectMode && selectedNoteIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-6 py-4 rounded-3xl border border-primary/20 backdrop-blur-lg bg-card/90 shadow-2xl shadow-primary/10"
          >
            <span className="text-xs font-extrabold text-foreground">
              {selectedNoteIds.length} note{selectedNoteIds.length > 1 ? "s" : ""} selected
            </span>
            <div className="h-4 w-[1px] bg-border/40" />

            <div className="flex items-center gap-2">
              <DangerButton
                onClick={handleBulkDelete}
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5" />}
              >
                Delete
              </DangerButton>

              {/* Folder move dropdown inside batch bar */}
              <div className="relative">
                <Button
                  onClick={() => setShowBulkFolderDropdown(!showBulkFolderDropdown)}
                  variant="secondary"
                  size="sm"
                  icon={<FolderOpen className="h-3.5 w-3.5 text-amber" />}
                >
                  Move to...
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
                <AnimatePresence>
                  {showBulkFolderDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute bottom-full mb-2 right-0 w-44 rounded-2xl shadow-xl p-1.5 z-40 space-y-0.5 text-left border border-border/40 backdrop-blur-md clay-panel bg-card/90"
                    >
                      <button
                        onClick={() => {
                          handleBulkMoveToFolder(null);
                          setShowBulkFolderDropdown(false);
                        }}
                        className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-muted/50 font-bold"
                      >
                        Unassigned
                      </button>
                      {folders?.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            handleBulkMoveToFolder(f.id);
                            setShowBulkFolderDropdown(false);
                          }}
                          className="w-full text-left px-2.5 py-2 text-xs rounded-xl hover:bg-muted/50 font-bold truncate"
                        >
                          {f.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Tag move dropdown inside batch bar */}
              <div className="relative">
                <Button
                  onClick={() => setShowBulkTagDropdown(!showBulkTagDropdown)}
                  variant="secondary"
                  size="sm"
                  icon={<span className="flex h-2 w-2 rounded-full bg-purple-500" />}
                >
                  Tag...
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
                <AnimatePresence>
                  {showBulkTagDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute bottom-full mb-2 right-0 w-48 shadow-xl p-2 z-40 max-h-56 overflow-y-auto space-y-1.5 text-left border border-border/40 backdrop-blur-md scrollbar clay-panel bg-card/90"
                    >
                      <p className="text-[9px] uppercase font-extrabold text-muted-foreground px-1 pb-1.5 border-b border-border/40">
                        Select Tag to Attach
                      </p>
                      {tags?.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic p-1">No tags available.</p>
                      ) : (
                        tags?.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              handleBulkAttachTag(t.id);
                              setShowBulkTagDropdown(false);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs rounded-xl hover:bg-muted/50 font-bold truncate"
                          >
                            <span
                              style={{ backgroundColor: t.color }}
                              className="h-2 w-2 rounded-full shrink-0"
                            />
                            <span className="truncate text-foreground">{t.name}</span>
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => {
                  setSelectedNoteIds([]);
                  setIsMultiSelectMode(false);
                }}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-border/40 bg-background/50 hover:bg-muted/30 text-muted-foreground transition-all active:scale-95 cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Citation Detail Modal/Drawer */}
      <AnimatePresence>
        {activeCitationPreview && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveCitationPreview(null)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            />
            {/* Drawer container */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-card border-l border-border/80 z-50 shadow-2xl p-6 flex flex-col justify-between"
            >
              <div className="flex-grow flex flex-col justify-start space-y-5 overflow-y-auto scrollbar pr-1 text-left">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-border/55 pb-3">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-extrabold uppercase border border-primary/25">
                      Citation Reference
                    </span>
                    <h3 className="font-extrabold text-sm text-foreground mt-3 leading-snug break-all" title={activeCitationPreview.document_name}>
                      {activeCitationPreview.document_name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveCitationPreview(null)}
                    className="text-muted-foreground hover:text-foreground rounded-xl p-1.5 hover:bg-muted/50 transition-colors shrink-0"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-muted-foreground shrink-0">
                  <div className="p-3 rounded-2xl border border-border/60 bg-background/30 shadow-inner">
                    <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold">Position</span>
                    <span className="text-foreground font-black mt-1 block">
                      {activeCitationPreview.page_number ? `Page ${activeCitationPreview.page_number}` : activeCitationPreview.section_title ? `Section: ${activeCitationPreview.section_title}` : "Reference Chunk"}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl border border-border/60 bg-background/30 shadow-inner">
                    <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold">Similarity</span>
                    <span className="text-foreground font-black mt-1 block">
                      {activeCitationPreview.similarity_score ? `${Math.round(activeCitationPreview.similarity_score * 100)}% Match` : "N/A"}
                    </span>
                  </div>
                </div>

                {/* Text extract */}
                <div className="space-y-2 flex-grow flex flex-col min-h-0">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">Semantic Source Extract</label>
                  <div className="p-4 rounded-2xl bg-muted/50 border border-border/40 overflow-y-auto flex-grow scrollbar max-h-[55vh]">
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap select-all font-medium">
                      {activeCitationPreview.chunk_text}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer action */}
              <div className="border-t border-border/50 pt-4 shrink-0 mt-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveCitationPreview(null)}
                  className="w-full clay-btn-primary py-3 text-xs font-bold text-white shadow shadow-primary/20 transition-all cursor-pointer"
                >
                  Close Reference
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Citation Hover Tooltip */}
      {hoveredCitation && (
        <div
          style={{
            position: "fixed",
            top: `${hoveredCitation.rect.top - 120}px`,
            left: `${Math.max(10, Math.min(window.innerWidth - 310, hoveredCitation.rect.left - 130))}px`,
            width: "280px",
            zIndex: 100,
          }}
          className="pointer-events-none p-3.5 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl text-left"
        >
          <div className="flex items-center justify-between border-b border-border/20 pb-1.5 mb-1.5">
            <span className="text-[9px] uppercase tracking-wider text-primary font-black truncate max-w-[180px]">
              {hoveredCitation.ref.document_name}
            </span>
            <span className="text-[8px] bg-primary/10 text-primary border border-primary/20 px-1 py-0.2 rounded font-extrabold shrink-0">
              {hoveredCitation.ref.page_number ? `Page ${hoveredCitation.ref.page_number}` : "Ref"}
            </span>
          </div>
          <p className="text-[10px] text-foreground leading-relaxed line-clamp-3 font-semibold">
            {hoveredCitation.ref.chunk_text}
          </p>
        </div>
      )}
    </div>
  );
};
