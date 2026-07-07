import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, Upload, Trash2, RefreshCw, CheckCircle2, 
  AlertCircle, Clock, FileDown, Plus, Info, Sparkles, X, ChevronRight, HelpCircle, ArrowRight
} from "lucide-react";
import { Loader } from "../../components/ui/Loader";
import { motion, AnimatePresence } from "framer-motion";
import { useUIStore } from "@/store/ui-store";
import { useDocuments, useUploadDocument, useDeleteDocument, DocumentItem } from "@/hooks/useDocuments";

export const DocumentsPage: React.FC = () => {
  const { data: documents = [], isLoading, refetch } = useDocuments();
  const { mutateAsync: uploadDoc } = useUploadDocument();
  const { mutateAsync: deleteDoc } = useDeleteDocument();

  const [isDragging, setIsDragging] = useState(false);
  const [activeDocPreview, setActiveDocPreview] = useState<DocumentItem | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    status: "idle" | "uploading" | "processing" | "completed" | "failed";
    message?: string;
    progressFilename?: string;
  }>({ status: "idle" });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep a ref so the effect can read the *current* uploadStatus without
  // adding it to the dep array (adding it caused a self-referential loop:
  // effect sets uploadStatus → re-runs → sets again, indefinitely).
  const uploadStatusRef = React.useRef(uploadStatus);
  uploadStatusRef.current = uploadStatus;

  // React only when the documents list updates (driven by the polling interval
  // inside useDocuments). Safe: uploadStatusRef.current is always fresh.
  useEffect(() => {
    const current = uploadStatusRef.current;
    if (current.status === "processing" && current.progressFilename) {
      const activeDoc = documents.find(
        (d: DocumentItem) => d.filename === current.progressFilename
      );
      if (activeDoc) {
        const s = activeDoc.status.toUpperCase();
        
        let message = current.message;
        if (s === "UPLOADED") message = "Uploaded";
        else if (s === "TEXT_EXTRACTED") message = "Extracting text...";
        else if (s === "CHUNKED") message = "Chunking...";
        else if (s === "EMBEDDED") message = "Creating embeddings...";
        else if (s === "FLASHCARDS_READY") message = "Generating AI flashcards...";
        else if (s === "QUIZZES_READY") message = "Generating AI quizzes...";

        if (s === "COMPLETED") {
          setUploadStatus({ status: "completed", message: "Document processed successfully!" });
          setTimeout(() => setUploadStatus({ status: "idle" }), 3000);
        } else if (s === "FAILED") {
          setUploadStatus({ status: "failed", message: "Failed to extract or embed document contents." });
          setTimeout(() => setUploadStatus({ status: "idle" }), 4000);
        } else if (message !== current.message) {
          setUploadStatus({
            status: "processing",
            message: message,
            progressFilename: current.progressFilename
          });
        }
      }
    }
  }, [documents]); // ← intentionally omits uploadStatus to break the loop

  const getStepState = (
    stepName: "upload" | "extract" | "chunk" | "embed" | "flashcards" | "quizzes" | "ready",
    docStatus: string | undefined
  ): "pending" | "active" | "completed" | "failed" => {
    if (!docStatus) return "pending";
    const s = docStatus.toUpperCase();

    if (s === "FAILED") return "failed";

    const stages = [
      "UPLOADED",
      "TEXT_EXTRACTED",
      "CHUNKED",
      "EMBEDDED",
      "FLASHCARDS_READY",
      "QUIZZES_READY",
      "COMPLETED"
    ];

    const stepIndex = {
      upload: 0,
      extract: 1,
      chunk: 2,
      embed: 3,
      flashcards: 4,
      quizzes: 5,
      ready: 6
    }[stepName];

    const currentStageIndex = stages.indexOf(s);

    if (currentStageIndex === -1) {
      if (s === "PROCESSING" || s === "PENDING") {
        if (stepName === "upload") return "completed";
        if (stepName === "extract") return "active";
        return "pending";
      }
      return "pending";
    }

    if (currentStageIndex > stepIndex) return "completed";
    if (currentStageIndex === stepIndex) return "active";
    return "pending";
  };

  const renderStep = (
    stepName: "upload" | "extract" | "chunk" | "embed" | "flashcards" | "quizzes" | "ready",
    label: string,
    activeDocStatus: string | undefined
  ) => {
    const state = getStepState(stepName, activeDocStatus);
    
    let circleClass = "bg-muted/10 border-border/40 text-muted-foreground/35";
    let icon = null;

    if (state === "completed") {
      circleClass = "bg-emerald-500/10 border-emerald-500/30 text-emerald-500";
      icon = <CheckCircle2 className="h-3 w-3" />;
    } else if (state === "active") {
      circleClass = "bg-indigo-500/20 border-indigo-500 text-indigo-500 animate-pulse scale-105 shadow-sm";
      icon = <Loader size="sm" />;
    } else if (state === "failed") {
      circleClass = "bg-red-500/10 border-red-500/30 text-red-500";
      icon = <AlertCircle className="h-3 w-3" />;
    } else {
      if (stepName === "flashcards" || stepName === "quizzes") {
        icon = <Sparkles className="h-2.5 w-2.5" />;
      } else {
        icon = <Clock className="h-2.5 w-2.5" />;
      }
    }

    return (
      <div className="flex flex-col items-center gap-1.5 flex-1 min-w-[45px]">
        <div className={`h-6 w-6 rounded-full flex items-center justify-center border transition-all duration-300 ${circleClass}`}>
          {icon}
        </div>
        <span className={`text-[8px] font-bold leading-none tracking-tight text-center ${
          state === "active" ? "text-indigo-500" :
          state === "completed" ? "text-emerald-500" :
          state === "failed" ? "text-red-500" : "text-muted-foreground/45"
        }`}>
          {label}
        </span>
      </div>
    );
  };

  const renderConnectingLine = (
    prevStep: "upload" | "extract" | "chunk" | "embed" | "flashcards" | "quizzes" | "ready",
    activeDocStatus: string | undefined
  ) => {
    const state = getStepState(prevStep, activeDocStatus);
    const lineClass = state === "completed" ? "bg-emerald-500/40" : "bg-border/20";
    return <div className={`h-[1.5px] ${lineClass} flex-grow max-w-[12px] -mt-3.5 transition-all duration-300`} />;
  };

  const handleUploadFile = async (file: File) => {
    if (!file) return;
    setUploadStatus({ 
      status: "uploading", 
      message: "Uploading document...",
      progressFilename: file.name
    });

    try {
      await uploadDoc(file);
      setUploadStatus({ 
        status: "processing", 
        message: "Processing and indexing vectors...",
        progressFilename: file.name
      });
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
      await deleteDoc(id);
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
    if (contentType.includes("pdf")) return <FileText className="h-7 w-7 text-red-500" />;
    if (contentType.includes("word") || contentType.includes("officedocument")) return <FileText className="h-7 w-7 text-blue-500" />;
    if (contentType.includes("markdown") || contentType.includes("md")) return <FileText className="h-7 w-7 text-emerald-500" />;
    return <FileText className="h-7 w-7 text-muted-foreground" />;
  };

  const getDocClayCardClass = (contentType: string) => {
    if (contentType.includes("pdf")) return "clay-card-rose";
    if (contentType.includes("word") || contentType.includes("officedocument")) return "clay-card-sky";
    if (contentType.includes("markdown") || contentType.includes("md")) return "clay-card-emerald";
    return "clay-card-indigo";
  };

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case "COMPLETED":
        return (
          <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shadow-sm">
            <CheckCircle2 className="h-3 w-3" /> Ready
          </span>
        );
      case "PENDING":
      case "UPLOADED":
        return (
          <span className="flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shadow-sm animate-bounce">
            <Clock className="h-3 w-3" /> Uploaded
          </span>
        );
      case "FAILED":
        return (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20 shadow-sm">
            <AlertCircle className="h-3 w-3" /> Failed
          </span>
        );
      case "PROCESSING":
      case "TEXT_EXTRACTED":
      case "CHUNKED":
      case "EMBEDDED":
      case "FLASHCARDS_READY":
      case "QUIZZES_READY":
        let label = "Processing...";
        let icon = <Loader size="sm" />;
        let textClass = "text-blue-500 bg-blue-500/10 border-blue-500/20";
        
        if (s === "TEXT_EXTRACTED") {
          label = "Extracting text";
        } else if (s === "CHUNKED") {
          label = "Chunking";
        } else if (s === "EMBEDDED") {
          label = "Creating embeddings";
        } else if (s === "FLASHCARDS_READY") {
          label = "Generating AI flashcards";
          icon = <span className="text-[10px]">⚡</span>;
          textClass = "text-amber-500 bg-amber-500/10 border-amber-500/20";
        } else if (s === "QUIZZES_READY") {
          label = "Generating AI quizzes";
          icon = <span className="text-[10px]">⚡</span>;
          textClass = "text-purple-500 bg-purple-500/10 border-purple-500/20";
        }
        
        return (
          <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-sm animate-pulse ${textClass}`}>
            {icon} {label}
          </span>
        );
      default:
        return null;
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 15 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 23 } }
  } as const;

  const activeDoc = documents.find(
    (d: DocumentItem) => d.filename === uploadStatus.progressFilename
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
          handleUploadFile(file);
        }
      }}
      className="space-y-6 max-w-6xl mx-auto text-left relative min-h-[calc(100vh-12rem)]"
    >
      {/* Full screen Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-3xl border-4 border-dashed border-primary bg-background/95 backdrop-blur-md shadow-2xl p-8 text-center pointer-events-none"
          >
            <div className="p-6 rounded-full bg-primary/10 text-primary mb-4 animate-bounce">
              <Upload className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-black text-foreground">Drop files to upload</h3>
            <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
              Drop your PDF, DOCX, TXT, or Markdown file anywhere on this screen to instantly upload and index it.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight md:text-2xl bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
            Documents Library
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your knowledge sources for Cited RAG Chat processing.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => refetch()}
          className="p-2.5 text-muted-foreground hover:text-foreground clay-btn bg-card/45"
          title="Refresh List"
        >
          <RefreshCw className={`h-4.5 w-4.5 ${isLoading ? "animate-spin text-primary" : ""}`} />
        </motion.button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Panel */}
        <div className="lg:col-span-1 space-y-4">
          <motion.div
            whileHover={{ scale: 1.01 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`clay-card p-6 flex flex-col items-center justify-center text-center cursor-pointer border-2 border-dashed aspect-video lg:aspect-auto lg:h-[280px] transition-all duration-300 ${
              isDragging
                ? "border-primary bg-primary/10 scale-95 shadow-xl"
                : "border-border/60 hover:border-primary/50"
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
            
            <motion.div 
              animate={isDragging ? { y: [-5, 5, -5] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-3 shadow-inner"
            >
              <Upload className="h-6 w-6" />
            </motion.div>
            
            <h3 className="font-extrabold text-sm text-foreground">Drag & Drop Document</h3>
            <p className="text-[10px] text-muted-foreground mt-1.5 max-w-[200px] leading-normal">
              Supports PDF, DOCX, TXT or Markdown files up to 10MB
            </p>
            
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 text-xs font-bold clay-btn bg-primary text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Choose File
            </motion.button>
          </motion.div>

          {/* Active Upload Status Feedback */}
          <AnimatePresence mode="wait">
            {uploadStatus.status !== "idle" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="clay-panel p-4 flex flex-col gap-3.5 border border-border/30 bg-card/65 shadow-lg"
              >
                <div className="flex gap-3 items-center">
                  <div className="shrink-0">
                    {uploadStatus.status === "uploading" && <Loader size="sm" />}
                    {uploadStatus.status === "processing" && <Loader size="sm" />}
                    {uploadStatus.status === "completed" && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                    {uploadStatus.status === "failed" && <AlertCircle className="h-5 w-5 text-red-500" />}
                  </div>
                  <div className="min-w-0 flex-grow text-left">
                    <h4 className="font-bold text-xs truncate text-foreground">
                      {uploadStatus.progressFilename || "Processing..."}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                      {uploadStatus.message}
                    </p>
                  </div>
                </div>

                {/* 7-Stage Progress Stepper */}
                <div className="flex items-center justify-between gap-1 px-0.5 pt-2 border-t border-border/10 overflow-x-auto pb-1 scrollbar-none">
                  {renderStep("upload", "Upload", activeDoc?.status)}
                  {renderConnectingLine("upload", activeDoc?.status)}
                  {renderStep("extract", "Extract", activeDoc?.status)}
                  {renderConnectingLine("extract", activeDoc?.status)}
                  {renderStep("chunk", "Chunk", activeDoc?.status)}
                  {renderConnectingLine("chunk", activeDoc?.status)}
                  {renderStep("embed", "Embed", activeDoc?.status)}
                  {renderConnectingLine("embed", activeDoc?.status)}
                  {renderStep("flashcards", "Cards", activeDoc?.status)}
                  {renderConnectingLine("flashcards", activeDoc?.status)}
                  {renderStep("quizzes", "Quizzes", activeDoc?.status)}
                  {renderConnectingLine("quizzes", activeDoc?.status)}
                  {renderStep("ready", "Ready", activeDoc?.status)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Files Grid View */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="h-[280px] flex items-center justify-center">
              <Loader size="md" />
            </div>
          ) : documents.length === 0 ? (
            <motion.div 
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="clay-panel p-8 text-center h-[280px] flex flex-col justify-center items-center space-y-2.5"
            >
              <FileDown className="h-8 w-8 text-muted-foreground/35" />
              <h3 className="font-extrabold text-sm text-foreground">No documents uploaded</h3>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Upload files to this workspace, and they will be indexed automatically for RAG QA extraction.
              </p>
            </motion.div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <AnimatePresence>
                {documents.map((doc) => {
                  const isCompleted = doc.status === "completed";
                  return (
                    <motion.div
                      key={doc.id}
                      variants={itemVariants}
                      layout
                      whileHover={isCompleted ? { y: -3, scale: 1.01 } : {}}
                      onClick={() => isCompleted && setActiveDocPreview(doc)}
                      className={`clay-card ${getDocClayCardClass(doc.content_type)} p-4.5 flex flex-col justify-between cursor-pointer`}
                    >
                      <div className="flex gap-3.5 items-start">
                        <div className="shrink-0 p-2 rounded-xl bg-card/70 border border-border/20 shadow-inner">
                          {getFileIcon(doc.content_type)}
                        </div>
                        <div className="min-w-0 flex-grow text-left">
                          <h4 className="font-bold text-xs truncate leading-snug text-foreground" title={doc.filename}>
                            {doc.filename}
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatSize(doc.file_size)}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-border/10">
                        <div>
                          {getStatusBadge(doc.status)}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 font-bold">
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                          <motion.button
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => { e.stopPropagation(); handleDelete(doc.id, e); }}
                            className="ml-2.5 p-1.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Delete source"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </div>

      {/* Right details slide out panel */}
      <AnimatePresence>
        {activeDocPreview && (
          <motion.div
            initial={{ x: "100%", opacity: 0.9 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] bg-card/95 backdrop-blur-xl border-l border-border/80 shadow-2xl z-50 p-6 flex flex-col justify-between overflow-hidden text-left"
          >
            <div className="space-y-6 flex-grow overflow-y-auto pr-1 scrollbar">
              {/* Drawer Header */}
              <div className="flex justify-between items-center pb-4 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-2">
                  <Info className="h-4.5 w-4.5 text-primary" />
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-muted-foreground">
                    Document Source Insights
                  </h3>
                </div>
                <button
                  onClick={() => setActiveDocPreview(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Document Overview Metadata */}
              <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-border/10 space-y-3 shadow-inner">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-card border border-border/40 shadow-sm shrink-0">
                    {getFileIcon(activeDocPreview.content_type)}
                  </div>
                  <div className="min-w-0 flex-grow">
                    <h4 className="font-extrabold text-xs text-foreground break-all leading-normal" title={activeDocPreview.filename}>
                      {activeDocPreview.filename}
                    </h4>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatSize(activeDocPreview.file_size)} • {activeDocPreview.content_type}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border/10 flex justify-between items-center text-[10px] font-bold text-muted-foreground">
                  <span>Uploaded {new Date(activeDocPreview.created_at).toLocaleDateString()}</span>
                  <span>{getStatusBadge(activeDocPreview.status)}</span>
                </div>
              </div>

              {/* Dynamic Insights / Summary */}
              <div className="space-y-2.5 text-left">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  AI Document Insights
                </h4>
                <div className="p-4 rounded-2xl border border-border/50 bg-card/45 shadow-sm text-xs text-muted-foreground leading-relaxed space-y-3">
                  <p>
                    This document has been fully parsed, chunked, and vectorized in your active workspace database. It is ready for cited RAG search queries.
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-[11px] font-medium text-foreground/90">
                    <li>Supports semantic query similarity mapping.</li>
                    <li>Automatic extraction of document headers and pages.</li>
                    <li>Citations link directly back to verified sections.</li>
                  </ul>
                </div>
              </div>

              {/* Suggested Questions */}
              <div className="space-y-3 text-left">
                <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
                  Suggested AI Prompts
                </h4>
                
                <div className="space-y-2">
                  {[
                    `Summarize the core arguments in "${activeDocPreview.filename}".`,
                    `What are the main findings or methodology discussed in "${activeDocPreview.filename}"?`,
                    `Identify any data constraints or caveats in "${activeDocPreview.filename}".`
                  ].map((prompt, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ x: 2, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        useUIStore.getState().setPendingAIQuery(prompt);
                        useUIStore.getState().setActiveTab("chat");
                        setActiveDocPreview(null);
                      }}
                      className="w-full text-left p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-xs font-bold text-foreground flex items-center justify-between group shadow-sm"
                    >
                      <span className="truncate pr-3 group-hover:text-primary transition-colors">"{prompt}"</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0 group-hover:text-primary transition-colors" />
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 shrink-0 flex justify-end">
              <button
                onClick={() => {
                  useUIStore.getState().setActiveTab("chat");
                  setActiveDocPreview(null);
                }}
                className="w-full text-center py-2.5 rounded-xl clay-btn-primary text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5"
              >
                Ask AI Questions in Chat <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
