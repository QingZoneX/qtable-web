import type { SourceInboxItem } from "./types";

export type SourceBacklinks = {
  qnoteUrl: string | null;
  webUrl: string | null;
};

const QNOTE_ANNOTATION_PREFIX = "qnote://annotation/";

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const isQNoteAnnotationUrl = (value: unknown): value is string => {
  const candidate = text(value);
  if (!candidate || !candidate.startsWith(QNOTE_ANNOTATION_PREFIX)) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "qnote:" && parsed.hostname === "annotation" && Boolean(parsed.pathname.slice(1));
  } catch {
    return false;
  }
};

export const buildQNoteAnnotationUrl = (
  annotationId: unknown,
  workspaceId?: unknown,
): string | null => {
  const annotation = text(annotationId);
  if (!annotation) return null;
  const workspace = text(workspaceId);
  const base = `${QNOTE_ANNOTATION_PREFIX}${encodeURIComponent(annotation)}`;
  return workspace ? `${base}?workspace=${encodeURIComponent(workspace)}` : base;
};

export const resolveSourceBacklinks = (item: SourceInboxItem): SourceBacklinks => {
  const preview = item.preview || {};
  const direct = preview.qnoteUrl;
  if (isQNoteAnnotationUrl(direct)) {
    return { qnoteUrl: direct, webUrl: text(item.url) || text(item.canonicalUrl) };
  }

  const annotationIds = Array.isArray(preview.annotationIds) ? preview.annotationIds : [];
  const qnoteUrl = buildQNoteAnnotationUrl(
    preview.qnoteItemId || annotationIds[0],
    item.workspaceId,
  );
  return {
    qnoteUrl,
    webUrl: text(item.url) || text(item.canonicalUrl),
  };
};

export const resolveRecordBacklinks = (
  fields: Array<{ id: string; name?: string | null }>,
  record: Record<string, unknown> | null | undefined,
): SourceBacklinks => {
  if (!record) return { qnoteUrl: null, webUrl: null };
  const normalized = fields.map((field) => ({
    ...field,
    normalizedName: String(field.name || "").trim().toLocaleLowerCase(),
  }));
  const qnoteField = normalized.find((field) =>
    field.normalizedName === "qnote回溯" ||
    field.normalizedName.includes("qnote") && field.normalizedName.includes("回"),
  );
  const webField = normalized.find((field) =>
    ["来源页面", "来源链接", "原文链接"].includes(String(field.name || "").trim()) ||
    field.normalizedName === "source url",
  );
  const rawQnote = qnoteField ? record[qnoteField.id] : null;
  return {
    qnoteUrl: isQNoteAnnotationUrl(rawQnote) ? rawQnote : null,
    webUrl: webField ? text(record[webField.id]) : null,
  };
};
