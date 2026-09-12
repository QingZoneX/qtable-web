import { apiUrl } from "../../../lib/apiUrl";
import { useAuthStore } from "../../../store/authStore";

export interface AttachmentItem {
  attachmentId: string;
  objectKey: string;
  name: string;
  size: number;
  contentType: string;
}

export interface AttachmentScope {
  tableId: string;
  recordId: string;
  fieldId: string;
}

type UploadResponse = {
  attachment: AttachmentItem;
  attachments: AttachmentItem[];
};

type DeleteResponse = {
  deleted: boolean;
  storageCleanup: "complete" | "pending";
  attachments: AttachmentItem[];
};

const errorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (payload.detail) return String(payload.detail);
  } catch {
    // Fall through to status text.
  }
  return response.statusText || `Request failed (${response.status})`;
};

const authFetch = async (
  path: string,
  init: RequestInit = {},
  allowRefresh = true,
): Promise<Response> => {
  let token = useAuthStore.getState().token;
  if (!token) throw new Error("Sign in is required for attachments");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  let response = await fetch(apiUrl(path), { ...init, headers });

  if (response.status === 401 && allowRefresh) {
    token = await useAuthStore.getState().refreshSession();
    if (token) {
      const retryHeaders = new Headers(init.headers);
      retryHeaders.set("Authorization", `Bearer ${token}`);
      response = await fetch(apiUrl(path), { ...init, headers: retryHeaders });
    }
  }
  return response;
};

export const uploadAttachment = async (
  scope: AttachmentScope,
  file: File,
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append("file", file);
  const path = `/api/attachments/tables/${encodeURIComponent(scope.tableId)}/records/${encodeURIComponent(scope.recordId)}/fields/${encodeURIComponent(scope.fieldId)}`;
  const response = await authFetch(path, { method: "POST", body: formData });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as UploadResponse;
};

export const deleteAttachment = async (
  attachmentId: string,
): Promise<DeleteResponse> => {
  const response = await authFetch(
    `/api/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()) as DeleteResponse;
};

export const fetchAttachmentBlob = async (
  attachmentId: string,
): Promise<Blob> => {
  const response = await authFetch(
    `/api/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "GET", cache: "no-store" },
  );
  if (!response.ok) throw new Error(await errorMessage(response));
  return response.blob();
};

export const downloadAttachment = async (attachment: AttachmentItem) => {
  const blob = await fetchAttachmentBlob(attachment.attachmentId);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.name || "attachment";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const isStableAttachment = (value: unknown): value is AttachmentItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AttachmentItem> & { url?: unknown };
  return (
    typeof item.attachmentId === "string" &&
    item.attachmentId.length > 0 &&
    typeof item.objectKey === "string" &&
    item.objectKey.length > 0 &&
    typeof item.name === "string" &&
    typeof item.size === "number" &&
    typeof item.contentType === "string" &&
    item.url === undefined
  );
};

export const stableAttachments = (value: unknown): AttachmentItem[] =>
  Array.isArray(value) ? value.filter(isStableAttachment) : [];
