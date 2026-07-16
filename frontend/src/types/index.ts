export interface User {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  provider: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  created_at: string;
}


export interface Note {
  id: string;
  title: string;
  content: string;
  folder_id: string | null;
  created_by: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export type SourceType = "note" | "document";

export interface KnowledgeSource {
  id: string;
  source_type: SourceType;
  title: string;
  // Status can be lowercase (legacy/notes: "pending", "processing", "completed", "failed", "ready")
  // or uppercase (current ingestion pipeline: "UPLOADED", "TEXT_EXTRACTED", "CHUNKED",
  // "EMBEDDED", "FLASHCARDS_READY", "QUIZZES_READY", "COMPLETED", "FAILED").
  // Always normalize with .toLowerCase() before comparing.
  status: string;
  created_at: string;
  updated_at: string;
  metadata: {
    file_size?: number;
    content_type?: string;
    word_count?: number;
    is_favorite?: boolean;
    folder_id?: string | null;
    [key: string]: any;
  };
}

