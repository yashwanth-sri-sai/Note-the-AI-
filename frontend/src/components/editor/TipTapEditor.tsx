import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
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
} from "lucide-react";

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  content,
  onChange,
}) => {
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

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
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
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-grow overflow-y-auto max-h-[60vh] bg-card/5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
