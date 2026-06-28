import React from "react";
import { FileText, File } from "lucide-react";
import { SourceType } from "@/types";

interface KnowledgeSourceIconProps {
  type: SourceType;
  className?: string;
}

export const KnowledgeSourceIcon: React.FC<KnowledgeSourceIconProps> = ({ type, className = "h-4 w-4" }) => {
  if (type === "document") {
    return <File className={`${className} text-emerald-500`} />;
  }
  return <FileText className={`${className} text-amber-500`} />;
};
