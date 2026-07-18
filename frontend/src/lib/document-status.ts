/**
 * Centralized utility for handling document status values in a case-insensitive manner.
 * Supports legacy status values ("completed", "ready", etc.) and new pipeline status values.
 */

export function normalizeStatus(status: string | null | undefined): string {
  if (!status) return "";
  return status.trim().toLowerCase();
}

export function isDocumentReady(status: string | null | undefined): boolean {
  const norm = normalizeStatus(status);
  return norm === "ready" || norm === "completed";
}

export function isDocumentFailed(status: string | null | undefined): boolean {
  const norm = normalizeStatus(status);
  return norm === "failed";
}

export function isDocumentProcessing(status: string | null | undefined): boolean {
  if (!status) return false;
  const norm = normalizeStatus(status);
  return !isDocumentReady(norm) && !isDocumentFailed(norm) && norm !== "";
}
