import React, { useState, useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient } from "@/lib/api-client";
import { 
  FileText, Upload, Trash2, Loader2, RefreshCw, CheckCircle2, 
  AlertCircle, Clock, FileDown, Plus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DocumentItem {
  id: string;
  filename: string;
  file_size: number;
  content_type: string;
  status: "pending" | "processing" | "completed" | "failed";
  created_at: string;
}

export const DocumentsPage: React.FC = () => {
  const { activeWorkspaceId } = useWorkspaceStore();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    status: "idle" | "uploading" | "processing" | "completed" | "failed";
    message?: string;
    progressFilename?: string;
  }>({ status: "idle" });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await apiClient.get("/documents/");
      setDocuments(response.data);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchDocuments();
    }
  }, [activeWorkspaceId]);

  // Polling for processing documents
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    const hasProcessingDocs = documents.some(
      (doc) => doc.status === "pending" || doc.status === "processing"
    );

    if (hasProcessingDocs) {
      intervalId = setInterval(() => {
        fetchDocuments(true);
      }, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [documents]);

  const handleUploadFile = async (file: File) => {
    if (!file) return;
    setUploadStatus({ 
      status: "uploading", 
      message: "Uploading document...",
      progressFilename: file.name
    });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await apiClient.post("/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const newDoc = response.data;
      setUploadStatus({ 
        status: "processing", 
        message: "Processing and indexing vectors...",
        progressFilename: file.name
      });
      
      // Instantly add doc to local list to show pending badge
      setDocuments((prev) => [newDoc, ...prev]);

      // Simple local checker for completion status
      const checkDocStatus = async () => {
        try {
          const docsResp = await apiClient.get("/documents/");
          const matchingDoc = docsResp.data.find((d: DocumentItem) => d.id === newDoc.id);
          if (matchingDoc) {
            if (matchingDoc.status === "completed") {
              setUploadStatus({ status: "completed", message: "Document processed successfully!" });
              fetchDocuments(true);
              setTimeout(() => setUploadStatus({ status: "idle" }), 3000);
              return true;
            } else if (matchingDoc.status === "failed") {
              setUploadStatus({ status: "failed", message: "Failed to extract or embed document contents." });
              fetchDocuments(true);
              setTimeout(() => setUploadStatus({ status: "idle" }), 4000);
              return true;
            }
          }
          return false;
        } catch (err) {
          console.error("Error checking upload completion status:", err);
          return true;
        }
      };

      // Poll every 2 seconds for this specific document status
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        const isDone = await checkDocStatus();
        if (isDone || pollCount > 30) {
          clearInterval(pollInterval);
          if (pollCount > 30 && !isDone) {
            setUploadStatus({ status: "failed", message: "Timeout during indexing." });
            setTimeout(() => setUploadStatus({ status: "idle" }), 4000);
          }
        }
      }, 2000);

    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadStatus({ 
        status: "failed", 
        message: error.response?.data?.detail || "Upload failed. Verify size and format." 
      });
      setTimeout(() => setUploadStatus({ status: "idle" }), 5000);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this document? All embedded vectors and RAG citations will be permanently removed.")) return;
    try {
      await apiClient.delete(`/documents/${id}`);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      alert("Failed to delete document.");
      console.error(error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.includes("pdf")) return <FileText className="h-8 w-8 text-red-500" />;
    if (contentType.includes("word") || contentType.includes("officedocument")) return <FileText className="h-8 w-8 text-blue-500" />;
    if (contentType.includes("markdown") || contentType.includes("md")) return <FileText className="h-8 w-8 text-emerald-500" />;
    return <FileText className="h-8 w-8 text-muted-foreground" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-sm">
            <CheckCircle2 className="h-3 w-3" /> Ready
          </span>
        );
      case "processing":
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 shadow-sm animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" /> Chunking...
          </span>
        );
      case "pending":
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20 shadow-sm">
            <Clock className="h-3 w-3 animate-bounce" /> Enqueued
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 shadow-sm">
            <AlertCircle className="h-3 w-3" /> Failed
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Documents Library</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your knowledge sources for Cited RAG Chat processing.
          </p>
        </div>
        <button
          onClick={() => fetchDocuments(false)}
          className="p-2 text-muted-foreground hover:text-foreground clay-btn bg-card/50"
          title="Refresh List"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-primary" : ""}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`clay-card p-6 flex flex-col items-center justify-center text-center cursor-pointer border-2 border-dashed aspect-video lg:aspect-auto lg:h-[280px] transition-all ${
              isDragging
                ? "border-primary bg-primary/5 scale-95 shadow-lg"
                : "border-border hover:border-primary/50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadFile(file);
              }}
              className="hidden"
              accept=".pdf,.docx,.txt,.md"
            />
            
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3 shadow-inner">
              <Upload className="h-6 w-6" />
            </div>
            
            <h3 className="font-bold text-sm">Drag & Drop Document</h3>
            <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">
              Supports PDF, DOCX, TXT or Markdown files up to 10MB
            </p>
            
            <button className="mt-4 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold clay-btn bg-primary text-white">
              <Plus className="h-3.5 w-3.5" /> Choose File
            </button>
          </div>

          {/* Active Upload Status Feedback */}
          <AnimatePresence mode="wait">
            {uploadStatus.status !== "idle" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="clay-panel p-4 flex gap-3 items-center border border-border bg-card/60"
              >
                <div className="shrink-0">
                  {uploadStatus.status === "uploading" && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                  {uploadStatus.status === "processing" && <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />}
                  {uploadStatus.status === "completed" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                  {uploadStatus.status === "failed" && <AlertCircle className="h-5 w-5 text-red-500" />}
                </div>
                <div className="min-w-0 flex-grow">
                  <h4 className="font-bold text-xs truncate">
                    {uploadStatus.progressFilename || "Processing..."}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {uploadStatus.message}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Files Grid View */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="h-[280px] flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : documents.length === 0 ? (
            <div className="clay-panel p-8 text-center h-[280px] flex flex-col justify-center items-center space-y-2.5">
              <FileDown className="h-8 w-8 text-muted-foreground/40" />
              <h3 className="font-bold text-sm">No documents uploaded</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Upload files to this workspace, and they will be indexed automatically for RAG QA extraction.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {documents.map((doc) => (
                  <motion.div
                    key={doc.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="clay-card p-4 flex flex-col justify-between hover:border-border/80"
                  >
                    <div className="flex gap-3.5 items-start">
                      <div className="shrink-0 p-2.5 rounded-xl bg-card/60 border border-border/20 shadow-inner">
                        {getFileIcon(doc.content_type)}
                      </div>
                      <div className="min-w-0 flex-grow">
                        <h4 className="font-bold text-xs truncate leading-snug" title={doc.filename}>
                          {doc.filename}
                        </h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatSize(doc.file_size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/20">
                      <div>
                        {getStatusBadge(doc.status)}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        <button
                          onClick={(e) => handleDelete(doc.id, e)}
                          className="ml-2 p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-500/5 transition-colors"
                          title="Delete source"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
