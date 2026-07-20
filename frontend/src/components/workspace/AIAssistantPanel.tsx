import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  BrainCircuit, Send, X, Sparkles, ChevronDown,
  Lightbulb, BookOpen, Layers, FileText, BarChart3,
  GraduationCap, RotateCcw, Loader2
} from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import { apiClient, getAccessToken } from "@/lib/api-client";
import { EASE_AURORA } from "@/components/motion/MotionSystem";
import { Button, IconButton, ToolbarButton, AIButton } from "@/components/ui/button";

// ── Types ───────────────────────────────────────────────────────────────────

interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

type DashboardTab =
  | "overview" | "notes" | "folders" | "favorites" | "tags"
  | "chat" | "documents" | "flashcards" | "quizzes"
  | "analytics" | "settings" | "evaluation";

// ── Context-aware suggestions per tab ──────────────────────────────────────

const TAB_CONTEXT: Record<string, { label: string; icon: React.ElementType; color: string; suggestions: string[] }> = {
  overview: {
    label: "Study Assistant",
    icon: Sparkles,
    color: "text-primary",
    suggestions: [
      "Summarize my recent notes",
      "What should I study next?",
      "Give me a learning recap",
    ],
  },
  notes: {
    label: "Notes Assistant",
    icon: FileText,
    color: "text-amber-400",
    suggestions: [
      "Summarize my active note",
      "Suggest tags for this note",
      "Find related concepts",
    ],
  },
  documents: {
    label: "Document Q&A",
    icon: BookOpen,
    color: "text-emerald-400",
    suggestions: [
      "Explain the key points of my documents",
      "What are the main topics covered?",
      "Create an outline from my documents",
    ],
  },
  flashcards: {
    label: "Flashcard Tutor",
    icon: Layers,
    color: "text-violet-400",
    suggestions: [
      "Quiz me on my flashcards",
      "Which topics need more review?",
      "Explain the answer to a flashcard",
    ],
  },
  quizzes: {
    label: "Quiz Coach",
    icon: GraduationCap,
    color: "text-rose-400",
    suggestions: [
      "Help me prepare for a quiz",
      "Explain a concept I'm struggling with",
      "Give me practice questions",
    ],
  },
  analytics: {
    label: "Study Insights",
    icon: BarChart3,
    color: "text-cyan-400",
    suggestions: [
      "How can I improve my study habits?",
      "Analyze my learning patterns",
      "What topics am I weakest in?",
    ],
  },
};

const getContext = (tab: string) =>
  TAB_CONTEXT[tab] ?? TAB_CONTEXT["overview"];

// ── AI Message Bubble ───────────────────────────────────────────────────────

const MessageBubble: React.FC<{ msg: AIChatMessage; index: number }> = ({ msg, index }) => {
  const shouldReduceMotion = useReducedMotion();
  const isUser = msg.role === "user";

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_AURORA, delay: index * 0.02 }}
      className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
          <BrainCircuit className="h-3 w-3 text-primary" />
        </div>
      )}
      <div
        className={`max-w-[85%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed ${
          isUser
            ? "bg-primary/15 border border-primary/20 text-foreground/90 rounded-tr-sm"
            : "bg-surface border border-border text-foreground/85 rounded-tl-sm"
        }`}
      >
        {msg.content}
      </div>
    </motion.div>
  );
};

// ── Typing Indicator ────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 6 }}
    className="flex gap-2 justify-start"
  >
    <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
      <BrainCircuit className="h-3 w-3 text-primary" />
    </div>
    <div className="bg-surface border border-border px-3.5 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
      {[0, 0.15, 0.3].map((delay, i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-primary/60"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.9, repeat: Infinity, delay }}
        />
      ))}
    </div>
  </motion.div>
);

// ── Suggestion Chip ─────────────────────────────────────────────────────────

const SuggestionChip: React.FC<{ text: string; onClick: () => void }> = ({ text, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.02, y: -1 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="w-full text-left px-3 py-2 rounded-xl border border-border bg-surface/50 hover:bg-surface hover:border-primary/25 text-[11px] text-muted-foreground hover:text-foreground transition-all duration-200 flex items-center gap-2"
  >
    <Lightbulb className="h-3 w-3 text-primary/60 shrink-0" />
    <span className="truncate">{text}</span>
  </motion.button>
);

// ── Main AIAssistantPanel Component ────────────────────────────────────────

export const AIAssistantPanel: React.FC = () => {
  const { activeTab, toggleAIPanel } = useUIStore();
  const { activeWorkspaceId } = useWorkspaceStore();
  const shouldReduceMotion = useReducedMotion();

  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const ctx = useMemo(() => getContext(activeTab as string), [activeTab]);
  const CtxIcon = ctx.icon;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Reset welcome when tab changes and no messages exist
  useEffect(() => {
    if (messages.length === 0) {
      setShowWelcome(true);
    }
  }, [activeTab, messages.length]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setShowWelcome(false);
    setInput("");

    const userMsg: AIChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // Build a system context string based on active tab
    const tabContextHint = `The user is currently on the "${activeTab}" section of NoteAI, their AI-powered study workspace.`;

    try {
      // If we don't have a conversation yet, create one
      let activeConvId = conversationId;
      if (!activeConvId && activeWorkspaceId) {
        try {
          const res = await apiClient.post("/chat/conversations/", {
            workspace_id: activeWorkspaceId,
            title: `AI Assistant · ${ctx.label}`,
          });
          activeConvId = res.data.id;
          setConversationId(activeConvId);
        } catch {
          // Silently continue — will try direct chat
        }
      }

      // Use the streaming endpoint or fallback to regular chat
      const abort = new AbortController();
      abortRef.current = abort;

      let fullResponse = "";
      const assistantMsgId = `a-${Date.now()}`;

      try {
        // Try streaming endpoint
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || ""}/api/v1/chat/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getAccessToken() ?? ""}`,
            },
            body: JSON.stringify({
              conversation_id: activeConvId,
              workspace_id: activeWorkspaceId,
              message: `${tabContextHint}\n\nUser question: ${trimmed}`,
              knowledge_source_ids: [],
            }),
            signal: abort.signal,
          }
        );

        if (!response.ok) throw new Error("Stream failed");

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          // Add placeholder streaming message
          setMessages((prev) => [
            ...prev,
            { id: assistantMsgId, role: "assistant", content: "", timestamp: new Date() },
          ]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((l) => l.trim());

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  const token = parsed.choices?.[0]?.delta?.content || parsed.token || "";
                  fullResponse += token;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: fullResponse } : m
                    )
                  );
                } catch {
                  // Non-JSON data line, skip
                }
              }
            }
          }
        }
      } catch {
        // Fallback: Try regular (non-streaming) chat endpoint
        try {
          const res = await apiClient.post("/chat/", {
            conversation_id: activeConvId,
            workspace_id: activeWorkspaceId,
            message: `${tabContextHint}\n\nUser question: ${trimmed}`,
            knowledge_source_ids: [],
          });

          fullResponse =
            res.data?.response ||
            res.data?.content ||
            res.data?.answer ||
            "I'm here to help! Could you rephrase your question?";

          setMessages((prev) => [
            ...prev,
            {
              id: assistantMsgId,
              role: "assistant",
              content: fullResponse,
              timestamp: new Date(),
            },
          ]);
        } catch {
          // Final fallback: graceful degradation
          setMessages((prev) => [
            ...prev,
            {
              id: assistantMsgId,
              role: "assistant",
              content:
                "I'm your study assistant. To get full AI responses, please ensure the AI Chat feature is configured. You can also try the full **AI Chat** tab for complete notebook-level conversations.",
              timestamp: new Date(),
            },
          ]);
        }
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isLoading, activeTab, activeWorkspaceId, conversationId, ctx.label]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setShowWelcome(true);
    setInput("");
    setIsLoading(false);
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#F7F9FC] via-[#F4F7FC] to-[#EEF2FA] dark:from-[#09121F] dark:via-[#0D1828] dark:to-[#0F1E30] border-l border-border overflow-hidden">
      {/* ── Panel Header ─────────────────────────────────────────────── */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border shrink-0 bg-surface/40 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_10px_rgba(79,209,197,0.15)]">
            <BrainCircuit className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-[11px] font-bold text-foreground/90 leading-none">AI Assistant</h3>
            <p className={`text-[9px] font-medium mt-0.5 ${ctx.color} flex items-center gap-1`}>
              <CtxIcon className="h-2.5 w-2.5" />
              {ctx.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <ToolbarButton
              onClick={handleReset}
              title="Clear conversation"
              className="h-8 w-8 flex items-center justify-center p-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </ToolbarButton>
          )}
          <ToolbarButton
            onClick={toggleAIPanel}
            title="Close AI Panel"
            className="h-8 w-8 flex items-center justify-center p-0"
          >
            <X className="h-4 w-4" />
          </ToolbarButton>
        </div>
      </div>

      {/* ── Messages Area ─────────────────────────────────────────────── */}
      <div className="flex-grow overflow-y-auto px-4 py-4 space-y-3 scrollbar">
        {/* Welcome state */}
        <AnimatePresence mode="wait">
          {showWelcome && messages.length === 0 && (
            <motion.div
              key="welcome"
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: EASE_AURORA }}
              className="space-y-4"
            >
              {/* Greeting */}
              <div className="text-center pt-2">
                <motion.div
                  animate={{ rotate: [0, 8, -8, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
                  className="inline-flex h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center mb-3 shadow-[0_0_20px_rgba(79,209,197,0.12)]"
                >
                  <CtxIcon className={`h-5 w-5 ${ctx.color}`} />
                </motion.div>
                <h4 className="text-[13px] font-bold text-foreground/90 mb-1">
                  {ctx.label}
                </h4>
                <p className="text-[11px] text-muted-foreground/60 leading-relaxed px-2">
                  Ask me anything about your study materials,<br />
                  or pick a suggestion below.
                </p>
              </div>

              {/* Suggestions */}
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted-foreground/40 px-1">
                  Suggestions
                </p>
                {ctx.suggestions.map((s, i) => (
                  <motion.div
                    key={s}
                    initial={shouldReduceMotion ? undefined : { opacity: 0, x: -8 }}
                    animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, ease: EASE_AURORA, delay: i * 0.06 }}
                  >
                    <SuggestionChip text={s} onClick={() => sendMessage(s)} />
                  </motion.div>
                ))}
              </div>

              {/* Divider hint */}
              <div className="flex items-center gap-2 opacity-40">
                <div className="flex-1 h-px bg-border" />
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                <div className="flex-1 h-px bg-border" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <MessageBubble key={msg.id} msg={msg} index={i} />
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isLoading && <TypingIndicator />}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Bar ─────────────────────────────────────────────────── */}
      <div className="px-3 pb-3 pt-2 shrink-0 border-t border-border bg-surface/30 backdrop-blur-sm">
        <div className="flex items-end gap-2 bg-surface border border-border rounded-xl px-3 py-2 shadow-sm focus-within:border-primary/30 focus-within:shadow-[0_0_0_2px_rgba(79,209,197,0.08)] transition-all duration-200">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask your AI assistant…"
            className="flex-grow resize-none bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/40 text-foreground/85 leading-relaxed max-h-[120px] overflow-y-auto scrollbar"
            style={{ height: "24px" }}
            disabled={isLoading}
          />
          <AIButton
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mb-0.5 hover:scale-105 active:scale-95"
            size="sm"
          >
            {isLoading ? (
              <Loader2 className="h-3 w-3 animate-spin text-white" />
            ) : (
              <Send className="h-3 w-3 text-white" />
            )}
          </AIButton>
        </div>
        <p className="text-[9px] text-muted-foreground/35 text-center mt-1.5 font-medium">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
