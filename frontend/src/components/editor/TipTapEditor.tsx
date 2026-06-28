import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus";
import { motion } from "framer-motion";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useUIStore } from "@/store/ui-store";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Code,
  Quote,
  Undo,
  Redo,
  Sparkles,
  BookOpen,
  PencilLine,
  Maximize,
  Minimize,
  Type
} from "lucide-react";

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  onAction?: (action: "explain" | "summarize" | "improve", selectedText: string) => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  content,
  onChange,
  onAction,
}) => {
  const { isFocusMode, toggleFocusMode } = useUIStore();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start writing your notes, thoughts, and equations...",
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose dark:prose-invert max-w-none min-h-[400px] px-6 py-4 focus:outline-none text-sm leading-relaxed text-foreground select-text",
      },
    },
  });

  // Sync content from parent state when it changes externally (e.g. note selected)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center bg-card/10 border border-border/40 rounded-2xl animate-pulse">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col rounded-2xl border border-border/60 bg-card/20 shadow-inner overflow-hidden">
      {/* Fixed Formatting Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 p-1.5 bg-muted/10 border-b border-border/40 sticky top-0 z-10 backdrop-blur-sm shrink-0">
        <div className="flex flex-wrap items-center gap-1">
          {/* Bold */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-lg transition-all ${
              editor.isActive("bold")
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-lg transition-all ${
              editor.isActive("italic")
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>

          <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />

          {/* Heading 1 */}
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            className={`p-1.5 rounded-lg transition-all ${
              editor.isActive("heading", { level: 1 })
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </button>

          {/* Heading 2 */}
          <button
            type="button"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            className={`p-1.5 rounded-lg transition-all ${
              editor.isActive("heading", { level: 2 })
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </button>

          <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />

          {/* Bullet List */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-lg transition-all ${
              editor.isActive("bulletList")
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>

          {/* Ordered List */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-1.5 rounded-lg transition-all ${
              editor.isActive("orderedList")
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </button>

          <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />

          {/* Code */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`p-1.5 rounded-lg transition-all ${
              editor.isActive("codeBlock")
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            title="Code Block"
          >
            <Code className="h-4 w-4" />
          </button>

          {/* Blockquote */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-lg transition-all ${
              editor.isActive("blockquote")
                ? "bg-primary/10 text-primary font-bold"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            title="Blockquote"
          >
            <Quote className="h-4 w-4" />
          </button>
        </div>

        {/* Undo / Redo & Focus */}
        <div className="flex items-center gap-1 border-l border-border/40 pl-2 ml-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleFocusMode}
            className={`p-1.5 rounded-lg ml-1 transition-all ${
              isFocusMode
                ? "bg-primary/20 text-primary font-bold shadow-sm"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            }`}
            title="Toggle Focus Mode"
          >
            {isFocusMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-grow overflow-y-auto max-h-[60vh] bg-card/5 relative">
        {editor && (
          <FloatingMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: "right" }}
            className="flex flex-col gap-1 p-2 bg-popover/95 border border-border/80 rounded-2xl shadow-2xl backdrop-blur-md z-50 min-w-[160px]"
          >
            <div className="px-2 pb-1 text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">
              Insert
            </div>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-xl transition-colors text-left"
            >
              <Heading1 className="h-4 w-4 text-muted-foreground" /> Heading 1
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-xl transition-colors text-left"
            >
              <Heading2 className="h-4 w-4 text-muted-foreground" /> Heading 2
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-xl transition-colors text-left"
            >
              <List className="h-4 w-4 text-muted-foreground" /> Bullet List
            </button>
            <button
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-xl transition-colors text-left"
            >
              <Code className="h-4 w-4 text-muted-foreground" /> Code Block
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary rounded-xl transition-colors text-left"
            >
              <Quote className="h-4 w-4 text-muted-foreground" /> Quote
            </button>
          </FloatingMenu>
        )}

        {editor && onAction && (
          <BubbleMenu
            editor={editor}
            {...({ tippyOptions: { duration: 0 } } as any)}
            className="z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 6 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className="flex items-center gap-1 p-1 bg-popover/90 border border-border/80 rounded-2xl shadow-xl backdrop-blur-md"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => {
                  const selectedText = editor.state.doc.textBetween(
                    editor.state.selection.from,
                    editor.state.selection.to,
                    " "
                  );
                  if (selectedText.trim()) onAction("explain", selectedText);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg text-foreground hover:bg-muted/60 transition-all shrink-0 cursor-pointer"
              >
                <BookOpen className="h-3 w-3 text-indigo-500" /> Explain
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => {
                  const selectedText = editor.state.doc.textBetween(
                    editor.state.selection.from,
                    editor.state.selection.to,
                    " "
                  );
                  if (selectedText.trim()) onAction("summarize", selectedText);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg text-foreground hover:bg-muted/60 transition-all shrink-0 cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-amber-500" /> Summarize
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={() => {
                  const selectedText = editor.state.doc.textBetween(
                    editor.state.selection.from,
                    editor.state.selection.to,
                    " "
                  );
                  if (selectedText.trim()) onAction("improve", selectedText);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg text-foreground hover:bg-muted/60 transition-all shrink-0 cursor-pointer"
              >
                <PencilLine className="h-3 w-3 text-emerald-500" /> Refine
              </motion.button>
            </motion.div>
          </BubbleMenu>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
