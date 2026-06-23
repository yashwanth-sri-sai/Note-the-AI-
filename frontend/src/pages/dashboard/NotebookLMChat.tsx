import React, { useState, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient, getAccessToken } from "@/lib/api-client";
import {
  BrainCircuit, Plus, Loader2, Calendar, Filter, Upload, X,
  MessageSquare, AlertTriangle, CheckCircle2, Send, FileText,
  Sparkles, History, User, File, ExternalLink, ChevronRight,
  HelpCircle, CheckSquare, Square, Trash2, Check, RefreshCw
} from "lucide-react";

interface DocumentItem {
  id: string;
  filename: string;
  file_size: number;
  content_type: string;
  status: string;
  created_at: string;
}

interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
}

interface ChatReference {
  chunk_uuid: string;
  chunk_text: string;
  similarity_score: number;
  document_name: string;
  document_id: string;
  page_number?: number;
  section_title?: string;
  token_count: number;
  source_reference?: string;
}

interface MessageItem {
  id: string;
  conversation_id: string;
  sender_role: "user" | "assistant";
  content: string;
  model_used?: string;
  retrieved_chunks?: ChatReference[];
  citation_metadata?: {
    confidence_score?: string;
    citations?: Array<{
      index: number;
      chunk_uuid: string;
      document_name: string;
      document_id: string;
      page_number?: number;
      section_title?: string;
    }>;
  };
  created_at: string;
  isStreaming?: boolean;
}

export const NotebookLMChat: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();

  // Conversations & Messages States
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);

  // Documents & Filters States
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);

  // Input & Streaming States
  const [questionInput, setQuestionInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [streamReferences, setStreamReferences] = useState<ChatReference[]>([]);
  const [streamConfidence, setStreamConfidence] = useState<string>("LOW");
  const [streamModel, setStreamModel] = useState<string>("");

  // Document Upload States
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null); // "uploading", "processing", "completed", "failed"
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);

  // Selected Citation Modal Preview
  const [activeCitationPreview, setActiveCitationPreview] = useState<ChatReference | null>(null);

  // Scroll ref for chat
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll chat viewport to bottom
  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedText]);

  // Load everything on workspace switch
  useEffect(() => {
    if (activeWorkspaceId) {
      fetchConversations();
      fetchDocuments();
      // Reset current active conversation
      setActiveConversationId(null);
      setMessages([]);
    }
  }, [activeWorkspaceId]);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      fetchMessages(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  // Polling logic for document processing job
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (processingJobId) {
      setUploadProgress("processing");
      intervalId = setInterval(async () => {
        try {
          const response = await apiClient.get(`/documents/jobs/${processingJobId}`);
          const job = response.data;
          if (job.status === "completed") {
            setUploadProgress("completed");
            setProcessingJobId(null);
            fetchDocuments(); // Refresh documents list
            setTimeout(() => setUploadProgress(null), 3000);
          } else if (job.status === "failed") {
            setUploadProgress("failed");
            setUploadError(job.error_message || "Document processing pipeline failed.");
            setProcessingJobId(null);
            setTimeout(() => setUploadProgress(null), 5000);
          }
        } catch (error) {
          console.error("Error polling processing job:", error);
        }
      }, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [processingJobId]);

  // API Call: Get Conversations
  const fetchConversations = async () => {
    setIsConversationsLoading(true);
    try {
      const response = await apiClient.get("/chat/conversations");
      setConversations(response.data);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsConversationsLoading(false);
    }
  };

  // API Call: Get Messages
  const fetchMessages = async (convId: string) => {
    setIsMessagesLoading(true);
    try {
      const response = await apiClient.get(`/chat/conversations/${convId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  // API Call: Get Documents
  const fetchDocuments = async () => {
    setIsDocumentsLoading(true);
    try {
      const response = await apiClient.get("/documents/");
      setDocuments(response.data);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsDocumentsLoading(false);
    }
  };

  // API Call: Create Conversation
  const handleCreateConversation = async () => {
    try {
      const title = `Chat - ${new Date().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
      const response = await apiClient.post("/chat/conversations", { title });
      const newConv = response.data;
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
    } catch (error) {
      alert("Failed to initialize conversation.");
      console.error(error);
    }
  };

  // API Call: Delete Document
  const handleDeleteDocument = async (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this document and all its indexed vector chunks?")) return;
    try {
      await apiClient.delete(`/documents/${docId}`);
      // Remove from selection if it was checked
      setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
      fetchDocuments();
    } catch (error) {
      alert("Failed to delete document.");
      console.error(error);
    }
  };

  // API Call: Document Upload
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadProgress("uploading");
    setUploadError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiClient.post("/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      // Retrieve the DocumentResponse back. We need to poll the job.
      // In our backend, the upload endpoint returns the document directly, and the job gets enqueued.
      // Wait, let's check how we get the job ID.
      // In documents.py upload_document, it creates a ProcessingJob and runs pipeline in background.
      // Wait, the API returns the Document object: `doc`. Let's poll for any pending job on this doc or query job state?
      // Wait! How do we find the processing job ID if upload returns doc but not the job ID?
      // Let's check `backend/app/api/v1/endpoints/documents.py` lines 160-183:
      // It creates job = ProcessingJob(document_id=doc.id) and returns doc.
      // So doc has status="pending". We can query the processing status of the document directly or fetch the job.
      // Wait! We can poll the document details or poll the job associated with document.
      // Let's check if there is an endpoint to poll the document or we can just fetch all documents again to check status.
      // Ah! Let's check if the document response model or database supports document status check.
      // Yes! `DocumentResponse` has `status` ("pending", "processing", "completed", "failed").
      // So instead of polling a job ID directly (since the upload API returns the `Document` object and not the `ProcessingJob`),
      // we can simply poll the list of documents, or add a simple custom hook to check this document's status, or fetch all documents.
      // Let's check: does `documents.py` have a GET `/documents/jobs/{job_id}`? Yes, it has:
      // `@router.get("/jobs/{job_id}", response_model=ProcessingJobResponse)`
      // But how do we know the job_id? Wait, we can fetch all documents and see if the document status has changed to completed!
      // Polling `GET /documents/` is super easy and lightweight!
      // Let's modify our polling to poll `GET /documents/` every 2 seconds, checking if our uploaded document's status becomes "completed" or "failed".
      // That is extremely robust and does not require knowing the job ID!
      
      const doc = response.data;
      const uploadedDocId = doc.id;
      
      // Let's poll documents list to track status of this document
      setUploadProgress("processing");
      const intervalId = setInterval(async () => {
        try {
          const docsResp = await apiClient.get("/documents/");
          const currentDocs = docsResp.data;
          setDocuments(currentDocs);
          
          const matchingDoc = currentDocs.find((d: any) => d.id === uploadedDocId);
          if (matchingDoc) {
            if (matchingDoc.status === "completed") {
              setUploadProgress("completed");
              clearInterval(intervalId);
              setTimeout(() => setUploadProgress(null), 3000);
            } else if (matchingDoc.status === "failed") {
              setUploadProgress("failed");
              setUploadError("Text extraction or embedding generation failed.");
              clearInterval(intervalId);
              setTimeout(() => setUploadProgress(null), 5000);
            }
          } else {
            // Not found in list? Stop polling
            clearInterval(intervalId);
            setUploadProgress(null);
          }
        } catch (err) {
          console.error("Error polling doc status:", err);
          clearInterval(intervalId);
          setUploadProgress(null);
        }
      }, 2000);

    } catch (error: any) {
      setUploadProgress("failed");
      setUploadError(error.response?.data?.detail || "Upload request failed.");
      console.error(error);
      setTimeout(() => setUploadProgress(null), 5000);
    }
  };

  // SSE Send Message Functionality
  const handleSendMessage = async (textToSend?: string) => {
    const finalQuery = textToSend || questionInput;
    if (!finalQuery.trim()) return;

    // We must have an active conversation
    let convId = activeConversationId;
    if (!convId) {
      try {
        const title = `Chat - ${finalQuery.slice(0, 20)}...`;
        const response = await apiClient.post("/chat/conversations", { title });
        const newConv = response.data;
        setConversations((prev) => [newConv, ...prev]);
        convId = newConv.id;
        setActiveConversationId(newConv.id);
      } catch (error) {
        alert("Failed to initialize conversation.");
        console.error(error);
        return;
      }
    }

    if (!convId) return;

    // Reset inputs
    setQuestionInput("");
    setIsStreaming(true);
    setStreamedText("");
    setStreamReferences([]);
    setStreamConfidence("LOW");
    setStreamModel("");

    // Append User Message to local state immediately
    const userMsg: MessageItem = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      sender_role: "user",
      content: finalQuery,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, userMsg]);

    // Construct stream message placeholder
    const assistantMsgPlaceholderId = crypto.randomUUID();
    const assistantPlaceholder: MessageItem = {
      id: assistantMsgPlaceholderId,
      conversation_id: convId,
      sender_role: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      isStreaming: true
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    // Start Fetching stream
    const token = getAccessToken();
    const activeWorkspace = activeWorkspaceId;
    const apiURL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

    try {
      const response = await fetch(`${apiURL}/chat/conversations/${convId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          ...(activeWorkspace ? { "X-Workspace-ID": activeWorkspace } : {}),
        },
        body: JSON.stringify({
          content: finalQuery,
          document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
          file_types: selectedFileTypes.length > 0 ? selectedFileTypes : undefined,
          date_start: dateStart ? new Date(dateStart).toISOString() : undefined,
          date_end: dateEnd ? new Date(dateEnd).toISOString() : undefined,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Unable to initialize response stream reader.");
      }

      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let tempContent = "";
      let tempFootnotes = "";
      let finalMetadata: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line) continue;

          if (line === "data: [DONE]") {
            break;
          }

          if (line.startsWith("data: ")) {
            const dataJsonStr = line.slice(6);
            try {
              const payload = JSON.parse(dataJsonStr);
              if (payload.type === "content") {
                tempContent += payload.delta;
                setStreamedText(tempContent);
                // Update assistant placeholder in message list
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgPlaceholderId
                      ? { ...msg, content: tempContent + tempFootnotes }
                      : msg
                  )
                );
              } else if (payload.type === "footnote") {
                tempFootnotes = payload.footnote;
                // Append footnote to content preview
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgPlaceholderId
                      ? { ...msg, content: tempContent + tempFootnotes }
                      : msg
                  )
                );
              } else if (payload.type === "metadata") {
                finalMetadata = payload;
                setStreamConfidence(payload.confidence_score);
                setStreamModel(payload.model_used);
                setStreamReferences(payload.references);
              } else if (payload.type === "error") {
                // If backend returns config error or something, show it
                let errMsg = payload.message || "Streaming error.";
                if (payload.error === "LLM_PROVIDER_NOT_CONFIGURED") {
                  errMsg = "LLM Provider is not configured. Please add OPENAI_API_KEY or GEMINI_API_KEY to your backend .env environment variables.";
                }
                tempContent = `Error: ${errMsg}`;
                setStreamedText(tempContent);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgPlaceholderId
                      ? { ...msg, content: tempContent }
                      : msg
                  )
                );
              }
            } catch (jsonErr) {
              console.error("SSE parse error on line:", line, jsonErr);
            }
          }
        }
      }

      // Stream finalized. Update the database record representation locally.
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgPlaceholderId
            ? {
                ...msg,
                content: tempContent + tempFootnotes,
                model_used: finalMetadata?.model_used || "Unknown",
                retrieved_chunks: finalMetadata?.references || [],
                citation_metadata: {
                  confidence_score: finalMetadata?.confidence_score || "LOW",
                  citations: finalMetadata?.citations || []
                },
                isStreaming: false
              }
            : msg
        )
      );

      // Refresh messages list to make sure everything aligns with the DB saved version
      fetchMessages(convId);

    } catch (err: any) {
      console.error("RAG Stream error:", err);
      // Update assistant message placeholder with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgPlaceholderId
            ? {
                ...msg,
                content: `Failed to generate RAG response: ${err.message || "Connection interrupted."}`,
                isStreaming: false
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
      setStreamedText("");
    }
  };

  // Checkbox Document toggle handler
  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // Toggle All Documents in selection
  const handleToggleAllDocs = () => {
    const activeDocs = documents.filter((d) => d.status === "completed").map((d) => d.id);
    if (selectedDocIds.length === activeDocs.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(activeDocs);
    }
  };

  // Toggle file extension filter tags
  const handleToggleFileType = (ext: string) => {
    setSelectedFileTypes((prev) =>
      prev.includes(ext) ? prev.filter((t) => t !== ext) : [...prev, ext]
    );
  };

  // Render Inline Citation Badges parsed dynamically
  const renderMessageContent = (msg: MessageItem) => {
    const text = msg.content;
    const referencesList = msg.retrieved_chunks || (msg.isStreaming ? streamReferences : []);

    // Split text by standard bracket citation regex like [1], [2]
    const parts = text.split(/(\[\d+\])/g);
    if (parts.length <= 1) {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>;
    }

    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed">
        {parts.map((part, idx) => {
          const match = part.match(/^\[(\d+)\]$/);
          if (match) {
            const indexNum = parseInt(match[1], 10);
            // Locate reference corresponding to this index
            const ref = referencesList[indexNum - 1];
            if (ref) {
              return (
                <button
                  key={idx}
                  onClick={() => setActiveCitationPreview(ref)}
                  className="mx-0.5 inline-flex h-4.5 items-center justify-center rounded bg-indigo-500/25 px-1.5 py-0.5 text-[10px] font-extrabold text-indigo-400 hover:bg-indigo-500/40 border border-indigo-500/20 active:scale-95 transition-all shadow-sm align-middle"
                  title={`${ref.document_name} - Page ${ref.page_number || "N/A"}`}
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

  // Format File Size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Suggested Prompts list
  const suggestedPrompts = [
    {
      title: "Synthesize Key Themes",
      prompt: "Synthesize the main ideas and core themes across all selected documents."
    },
    {
      title: "Summarize Findings",
      prompt: "Provide a structured, executive summary highlighting the critical findings in these sources."
    },
    {
      title: "Find Contradictions",
      prompt: "Are there any conflicting perspectives or contradictory information between the uploaded documents?"
    }
  ];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-10rem)] max-w-7xl mx-auto overflow-hidden clay-panel relative">
      
      {/* 1. LEFT PANEL: Source Documents & Filters */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-border/80 flex flex-col bg-card/25 backdrop-blur-lg shrink-0">
        
        {/* Document Sources Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-indigo-500" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground/90">
              Source Documents
            </h3>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline"
            title="Upload Document"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUploadFile}
            className="hidden"
            accept=".pdf,.docx,.txt,.md"
          />
        </div>

        {/* Upload & Processing Status Bar */}
        {uploadProgress && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-card border border-border/70 flex items-center gap-3 animate-fadeIn">
            {uploadProgress === "uploading" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {uploadProgress === "processing" && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
            {uploadProgress === "completed" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {uploadProgress === "failed" && <AlertTriangle className="h-4 w-4 text-red-500" />}
            
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold truncate">
                {uploadFile?.name || "Processing File"}
              </p>
              <p className="text-[9px] text-muted-foreground uppercase font-semibold mt-0.5">
                {uploadProgress === "uploading" && "Uploading to storage..."}
                {uploadProgress === "processing" && "Vectorizing & Chunking..."}
                {uploadProgress === "completed" && "Successfully indexed!"}
                {uploadProgress === "failed" && "Failed to index"}
              </p>
            </div>
          </div>
        )}

        {/* Upload Error Banner */}
        {uploadError && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-medium leading-relaxed">
            {uploadError}
          </div>
        )}

        {/* Documents Checklist Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar">
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground">
              <span>ACTIVE SOURCES ({selectedDocIds.length}/{documents.filter(d => d.status === "completed").length})</span>
              {documents.filter(d => d.status === "completed").length > 0 && (
                <button
                  onClick={handleToggleAllDocs}
                  className="hover:text-primary transition-colors text-[10px] font-bold"
                >
                  {selectedDocIds.length === documents.filter(d => d.status === "completed").length ? "Deselect All" : "Select All"}
                </button>
              )}
            </div>

            {isDocumentsLoading && documents.length === 0 ? (
              <div className="flex py-6 justify-center items-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : documents.length === 0 ? (
              <div className="border border-dashed border-border/80 rounded-2xl p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <File className="h-6 w-6 text-muted-foreground/60" />
                <p>No documents uploaded yet in this workspace.</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary font-semibold hover:underline mt-1 flex items-center gap-1"
                >
                  Upload your first file <Plus className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {documents.map((doc) => {
                  const isCompleted = doc.status === "completed";
                  const isSelected = selectedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => isCompleted && handleToggleDoc(doc.id)}
                      className={`group flex items-center justify-between p-2.5 rounded-xl border border-border/60 hover:border-primary/40 cursor-pointer transition-all ${
                        isSelected ? "bg-primary/5 border-primary/20" : "bg-card/45 hover:bg-muted/15"
                      } ${!isCompleted ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-grow">
                        {isCompleted ? (
                          isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                          )
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin text-indigo-500 shrink-0" />
                        )}
                        <div className="truncate text-left">
                          <p className="font-semibold text-xs truncate max-w-[160px] group-hover:text-primary transition-colors" title={doc.filename}>
                            {doc.filename}
                          </p>
                          <p className="text-[9px] text-muted-foreground uppercase font-bold mt-0.5">
                            {formatBytes(doc.file_size)} • {doc.content_type.split("/")[1] || doc.content_type.split(".")[1] || "DOC"}
                          </p>
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => handleDeleteDocument(doc.id, e)}
                        className="text-muted-foreground hover:text-red-500 p-1 rounded hover:bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Filters accordion */}
          <div className="border-t border-border/50 pt-4 space-y-3">
            <button
              onClick={() => setIsFilterExpanded(!isFilterExpanded)}
              className="flex items-center justify-between w-full text-left text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
            >
              <span className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" /> Advanced Search Filters
              </span>
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isFilterExpanded ? "rotate-90" : ""}`} />
            </button>

            {isFilterExpanded && (
              <div className="space-y-4 animate-slideDown">
                {/* File Type Filter */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">File Formats</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "PDF", val: "application/pdf" },
                      { label: "DOCX", val: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
                      { label: "Text", val: "text/plain" },
                      { label: "Markdown", val: "text/markdown" }
                    ].map((type) => {
                      const isSel = selectedFileTypes.includes(type.val);
                      return (
                        <button
                          key={type.val}
                          onClick={() => handleToggleFileType(type.val)}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                            isSel
                              ? "bg-primary text-white border-primary"
                              : "bg-card border-border text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {type.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Upload Date Range */}
                <div className="space-y-2 text-left">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Indexed Date Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">Start</span>
                      <input
                        type="date"
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                        className="w-full bg-background border border-border/80 rounded-lg p-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">End</span>
                      <input
                        type="date"
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                        className="w-full bg-background border border-border/80 rounded-lg p-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  {(dateStart || dateEnd) && (
                    <button
                      onClick={() => {
                        setDateStart("");
                        setDateEnd("");
                      }}
                      className="text-[10px] text-primary hover:underline font-bold flex items-center gap-1 mt-1"
                    >
                      Clear Date Range
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. RIGHT PANEL: Chat viewport and history */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/5">
        
        {/* Chat Control Top Header */}
        <div className="h-16 border-b border-border/80 bg-card/20 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          
          {/* Conversation dropdown selector */}
          <div className="flex items-center gap-2 max-w-[60%]">
            <History className="h-4.5 w-4.5 text-muted-foreground" />
            <select
              value={activeConversationId || ""}
              onChange={(e) => setActiveConversationId(e.target.value || null)}
              className="bg-transparent border-none text-xs font-semibold text-foreground focus:ring-0 max-w-full truncate cursor-pointer outline-none"
            >
              <option value="" className="bg-card">-- Select Chat History --</option>
              {conversations.map((c) => (
                <option key={c.id} value={c.id} className="bg-card text-foreground">
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {/* New Chat Button */}
            <button
              onClick={handleCreateConversation}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-primary/20 hover:border-primary/40 bg-primary/5 text-xs text-primary font-bold transition-all hover:scale-105"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </button>
          </div>
        </div>

        {/* Messages Scrolling Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar">
          
          {isMessagesLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading messages history...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            /* Welcome empty state */
            <div className="max-w-xl mx-auto py-12 text-center space-y-8 flex flex-col justify-center h-full">
              <div className="space-y-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 shadow-md shadow-indigo-500/5 mx-auto">
                  <BrainCircuit className="h-6 w-6" />
                </span>
                <h2 className="text-lg font-bold tracking-tight">
                  NotebookLM cited AI Chat
                </h2>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Submit questions or prompt strategies to examine your uploaded document libraries with semantic vectors, citation annotations, and confidence validation.
                </p>
              </div>

              {/* Suggested prompt cards */}
              <div className="grid grid-cols-1 gap-3 text-left">
                {suggestedPrompts.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSendMessage(item.prompt)}
                    className="p-4 rounded-2xl border border-border/80 bg-card/45 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-sm flex items-start gap-3 group"
                  >
                    <Sparkles className="h-4.5 w-4.5 text-indigo-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        "{item.prompt}"
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Render Message bubbles */
            <div className="space-y-6 max-w-3xl mx-auto text-left">
              {messages.map((msg) => {
                const isUser = msg.sender_role === "user";
                const isStreamingMsg = msg.isStreaming;
                
                // Read confidence / model from metadata
                const confScore = isStreamingMsg ? streamConfidence : (msg.citation_metadata?.confidence_score || "LOW");
                const modelUsed = isStreamingMsg ? streamModel : (msg.model_used || "Unknown");
                const references = isStreamingMsg ? streamReferences : (msg.retrieved_chunks || []);

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {/* User Avatar vs Assistant AI Avatar */}
                    {!isUser && (
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-white shadow shadow-primary/10 shrink-0">
                        <BrainCircuit className="h-4 w-4" />
                      </span>
                    )}

                    <div className="space-y-2 max-w-[85%]">
                      {/* Message Bubble Box */}
                      <div
                        className={`rounded-2xl p-4 border transition-all ${
                          isUser
                            ? "bg-gradient-to-tr from-primary to-indigo-600 text-white border-primary/20 shadow-md shadow-primary/25"
                            : "bg-card/75 border-border/40 shadow-sm"
                        }`}
                      >
                        {/* Message content parsed with bracket citations */}
                        {isUser ? (
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                        ) : (
                          renderMessageContent(msg)
                        )}
                      </div>

                      {/* Metadata row (Confidence / Model) for Assistant Message */}
                      {!isUser && (
                        <div className="flex flex-wrap items-center gap-2.5 px-1.5 text-[10px] font-semibold text-muted-foreground">
                          
                          {/* Confidence Badge */}
                          <span className="flex items-center gap-1">
                            RAG Confidence:
                            <span
                              className={`px-1.5 py-0.5 rounded font-extrabold text-[9px] uppercase tracking-wide ${
                                confScore === "HIGH"
                                  ? "bg-green-500/10 text-green-500 border border-green-500/20"
                                  : confScore === "MEDIUM"
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                  : "bg-red-500/10 text-red-500 border border-red-500/20"
                              }`}
                            >
                              {confScore}
                            </span>
                          </span>

                          <span className="text-muted-foreground/30">•</span>

                          {/* Model used badge */}
                          {modelUsed && (
                            <span className="flex items-center gap-0.5">
                              Model: <span className="font-mono text-[9px] px-1 bg-muted rounded border border-border/50 text-foreground">{modelUsed}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* Retrieved Source References FOOTER below Assistant Message */}
                      {!isUser && references.length > 0 && (
                        <div className="mt-3 border-t border-border/30 pt-3 space-y-2 text-left">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                            Retrieved Sources ({references.length})
                          </h4>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {references.map((ref, idx) => (
                              <div
                                key={ref.chunk_uuid || idx}
                                onClick={() => setActiveCitationPreview(ref)}
                                className="p-2 rounded-xl bg-card border border-border/80 hover:border-indigo-500/40 hover:bg-indigo-500/5 cursor-pointer transition-all flex items-start gap-2.5 group"
                              >
                                <span className="h-5 w-5 rounded bg-indigo-500/10 text-indigo-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="flex-grow min-w-0">
                                  <p className="text-[10px] font-bold truncate group-hover:text-primary transition-colors text-foreground" title={ref.document_name}>
                                    {ref.document_name}
                                  </p>
                                  <p className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                                    {ref.page_number ? `Page ${ref.page_number}` : ref.section_title ? `Section: ${ref.section_title}` : "Reference"}
                                    {ref.similarity_score ? ` • ${Math.round(ref.similarity_score * 100)}% match` : ""}
                                  </p>
                                </div>
                                <ExternalLink className="h-3 w-3 text-muted-foreground/60 shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* User Avatar */}
                    {isUser && (
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted border border-border/80 text-muted-foreground shrink-0 font-semibold text-xs">
                        <User className="h-4.5 w-4.5" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Scrolling anchor */}
          <div ref={chatBottomRef} />
        </div>

        {/* Chat Message Input Container */}
        <div className="p-4 border-t border-border/80 bg-card/25 backdrop-blur-md flex flex-col gap-2 shrink-0">
          
          <div className="flex gap-2 max-w-3xl mx-auto w-full relative">
            <textarea
              rows={1}
              value={questionInput}
              onChange={(e) => setQuestionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                selectedDocIds.length > 0
                  ? `Ask a question about the ${selectedDocIds.length} selected sources...`
                  : "Ask a question about all workspace documents..."
              }
              disabled={isStreaming}
              className="flex-grow rounded-2xl border border-border/80 bg-background/50 hover:bg-background/80 focus:border-primary py-3.5 pl-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none resize-none focus:ring-0 max-h-32 transition-colors scrollbar"
            />
            
            {/* Send Button */}
            <button
              onClick={() => handleSendMessage()}
              disabled={isStreaming || !questionInput.trim()}
              className={`absolute right-2 top-2 h-9 w-9 rounded-xl flex items-center justify-center transition-all ${
                questionInput.trim() && !isStreaming
                  ? "bg-primary text-white shadow-md shadow-primary/20 hover:scale-105"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isStreaming ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
          
          <p className="text-[10px] text-muted-foreground text-center">
            NoteAI citations mapping matches segment vectors exactly. Model parameters: Temp 0.0, Context Limit 4000 tokens.
          </p>
        </div>
      </div>

      {/* 3. DYNAMIC OVERLAY MODAL: Citation Preview Panel */}
      {activeCitationPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-xl glass-panel rounded-3xl p-6 shadow-2xl space-y-4 border border-border/80 bg-card text-left">
            
            <div className="flex justify-between items-start border-b border-border/50 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-400 text-[10px] font-extrabold uppercase border border-indigo-500/20">
                  Citation Reference
                </span>
                <h3 className="font-extrabold text-sm text-foreground mt-2 truncate max-w-[360px]" title={activeCitationPreview.document_name}>
                  {activeCitationPreview.document_name}
                </h3>
              </div>
              <button
                onClick={() => setActiveCitationPreview(null)}
                className="text-muted-foreground hover:text-foreground rounded-xl p-1.5 hover:bg-muted/50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chunk details and coordinates info */}
            <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-muted-foreground">
              <div className="p-2.5 rounded-xl border border-border/60 bg-background/30">
                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/60">Position Coordinate</span>
                <span className="text-foreground font-bold mt-1 block">
                  {activeCitationPreview.page_number ? `Page Number ${activeCitationPreview.page_number}` : activeCitationPreview.section_title ? `Section: ${activeCitationPreview.section_title}` : "Reference Chunk"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl border border-border/60 bg-background/30">
                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground/60">Similarity Score</span>
                <span className="text-foreground font-bold mt-1 block">
                  {activeCitationPreview.similarity_score ? `${Math.round(activeCitationPreview.similarity_score * 100)}% Match Confidence` : "N/A"}
                </span>
              </div>
            </div>

            {/* Chunk Text Viewer box */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Semantic Source Extract</label>
              <div className="p-4 rounded-2xl bg-muted/65 border border-border/60 max-h-60 overflow-y-auto scrollbar">
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap select-all font-medium">
                  {activeCitationPreview.chunk_text}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveCitationPreview(null)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-lg shadow-primary/10 hover:bg-primary/95 transition-all"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
