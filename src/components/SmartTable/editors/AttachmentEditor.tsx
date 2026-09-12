import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, Spin, message } from "antd";
import {
  CloseOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { EditContext } from "@visactor/vtable-editors";
import { ReactEditor } from "./ReactEditor";
import { useSmartTableStore } from "../../../store/useSmartTableStore";
import {
  deleteAttachment,
  downloadAttachment,
  fetchAttachmentBlob,
  stableAttachments,
  uploadAttachment,
  type AttachmentItem,
  type AttachmentScope,
} from "../attachments/attachmentApi";

type AttachmentEditorProps = {
  initialValue: unknown;
  scope: AttachmentScope | null;
  onChange: (val: AttachmentItem[]) => void;
};

type PreviewKind = "image" | "pdf" | "text" | "file";

type PreviewState = {
  attachment: AttachmentItem;
  loading: boolean;
  kind?: PreviewKind;
  objectUrl?: string;
  text?: string;
  error?: string;
};

const SAFE_INLINE_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const baseMime = (value: string | undefined) =>
  (value || "").split(";", 1)[0].trim().toLowerCase();

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isTextLike = (attachment: AttachmentItem) =>
  baseMime(attachment.contentType).startsWith("text/") ||
  [".txt", ".md", ".csv", ".json", ".xml", ".html"].some((ext) =>
    attachment.name.toLowerCase().endsWith(ext),
  );

const AttachmentEditorComponent = ({
  initialValue,
  scope,
  onChange,
}: AttachmentEditorProps) => {
  const initialAttachments = useMemo(
    () => stableAttachments(initialValue),
    [initialValue],
  );
  const legacyCount =
    Array.isArray(initialValue) && initialValue.length > initialAttachments.length
      ? initialValue.length - initialAttachments.length
      : 0;
  const [attachments, setAttachments] =
    useState<AttachmentItem[]>(initialAttachments);
  const [mutationId, setMutationId] = useState<string | null>(null);
  const mutationLockRef = useRef(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mutationInFlight = mutationId !== null;

  useEffect(
    () => () => {
      if (preview?.objectUrl) URL.revokeObjectURL(preview.objectUrl);
    },
    [preview?.objectUrl],
  );

  const replaceAttachments = (next: AttachmentItem[]) => {
    setAttachments(next);
    onChange(next);
  };

  const beginMutation = (id: string) => {
    if (mutationLockRef.current) return false;
    mutationLockRef.current = true;
    setMutationId(id);
    return true;
  };

  const endMutation = () => {
    mutationLockRef.current = false;
    setMutationId(null);
  };

  const uploadFiles = async (files: File[]) => {
    if (!scope) {
      message.error("Attachment upload is unavailable because the cell scope is missing");
      return;
    }
    if (!beginMutation("upload")) {
      message.warning("Another attachment change is still in progress");
      return;
    }
    try {
      for (const file of files) {
        const result = await uploadAttachment(scope, file);
        replaceAttachments(result.attachments);
      }
      if (files.length > 0) {
        message.success(
          files.length === 1
            ? `"${files[0].name}" uploaded`
            : `${files.length} attachments uploaded`,
        );
      }
    } catch (error) {
      console.error("Attachment upload failed", error);
      message.error(error instanceof Error ? error.message : "Attachment upload failed");
    } finally {
      endMutation();
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) void uploadFiles(files);
    event.target.value = "";
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData?.items ?? [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!files.length) return;
    event.preventDefault();
    void uploadFiles(files);
  };

  const handleRemove = async (attachment: AttachmentItem) => {
    if (!scope) {
      message.error("Attachment delete is unavailable because the cell scope is missing");
      return;
    }
    if (!beginMutation(attachment.attachmentId)) {
      message.warning("Another attachment change is still in progress");
      return;
    }
    try {
      const result = await deleteAttachment(attachment.attachmentId);
      replaceAttachments(result.attachments);
      if (result.storageCleanup === "pending") {
        message.warning("Attachment removed; object cleanup is queued for retry");
      } else {
        message.success(`"${attachment.name}" removed`);
      }
    } catch (error) {
      console.error("Attachment delete failed", error);
      message.error(error instanceof Error ? error.message : "Attachment delete failed");
    } finally {
      endMutation();
    }
  };

  const closePreview = () => {
    if (preview?.objectUrl) URL.revokeObjectURL(preview.objectUrl);
    setPreview(null);
  };

  const handlePreview = async (attachment: AttachmentItem) => {
    if (preview?.objectUrl) URL.revokeObjectURL(preview.objectUrl);
    setPreview({ attachment, loading: true });
    try {
      const blob = await fetchAttachmentBlob(attachment.attachmentId);
      const declaredType = baseMime(attachment.contentType);
      const actualType = baseMime(blob.type);

      if (
        SAFE_INLINE_IMAGE_TYPES.has(declaredType) &&
        actualType === declaredType
      ) {
        setPreview({
          attachment,
          loading: false,
          kind: "image",
          objectUrl: URL.createObjectURL(blob),
        });
        return;
      }

      if (declaredType === "application/pdf" && actualType === "application/pdf") {
        setPreview({
          attachment,
          loading: false,
          kind: "pdf",
          objectUrl: URL.createObjectURL(blob),
        });
        return;
      }

      if (isTextLike(attachment)) {
        setPreview({ attachment, loading: false, kind: "text", text: await blob.text() });
        return;
      }

      setPreview({ attachment, loading: false, kind: "file" });
    } catch (error) {
      setPreview({
        attachment,
        loading: false,
        error: error instanceof Error ? error.message : "Preview failed",
      });
    }
  };

  const previewContent = () => {
    if (!preview) return null;
    if (preview.loading) {
      return <div style={{ padding: 32, textAlign: "center" }}><Spin /></div>;
    }
    if (preview.error) {
      return <div style={{ padding: 24, color: "#B91C1C" }}>{preview.error}</div>;
    }
    if (preview.kind === "image" && preview.objectUrl) {
      return (
        <img
          src={preview.objectUrl}
          alt={preview.attachment.name}
          style={{ display: "block", maxWidth: "100%", maxHeight: "70vh", margin: "0 auto" }}
        />
      );
    }
    if (preview.kind === "pdf" && preview.objectUrl) {
      return (
        <iframe
          src={preview.objectUrl}
          title={preview.attachment.name}
          sandbox=""
          referrerPolicy="no-referrer"
          style={{ width: "100%", height: "70vh", border: 0 }}
        />
      );
    }
    if (preview.kind === "text" && preview.text !== undefined) {
      return (
        <pre style={{ maxHeight: "70vh", overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {preview.text}
        </pre>
      );
    }
    return (
      <div style={{ padding: 32, textAlign: "center" }}>
        <FileOutlined style={{ fontSize: 48, color: "#6B7280" }} />
        <div style={{ marginTop: 12 }}>{preview.attachment.name}</div>
        <div style={{ color: "#6B7280", marginTop: 4 }}>
          {formatFileSize(preview.attachment.size)}
        </div>
        <div style={{ color: "#9CA3AF", marginTop: 8, fontSize: 12 }}>
          Inline preview is unavailable for this file type. Download to inspect it safely.
        </div>
      </div>
    );
  };

  return (
    <div
      onPaste={handlePaste}
      tabIndex={0}
      style={{ width: "100%", height: "100%", background: "#fff", boxSizing: "border-box" }}
    >
      <div
        style={{
          border: "2px solid #2563EB",
          borderRadius: 4,
          padding: 3,
          height: "100%",
          overflow: "auto",
          boxSizing: "border-box",
        }}
      >
        {legacyCount > 0 && (
          <div style={{ fontSize: 10, color: "#B45309", marginBottom: 4 }}>
            {legacyCount} legacy URL attachment{legacyCount > 1 ? "s" : ""} unavailable; re-upload required.
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
          {attachments.map((attachment) => (
            <div
              key={attachment.attachmentId}
              title={`${attachment.name}${attachment.size ? ` · ${formatFileSize(attachment.size)}` : ""}`}
              style={{
                position: "relative",
                width: 34,
                height: 34,
                border: "1px solid #E5E7EB",
                borderRadius: 3,
                background: "#F9FAFB",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileOutlined style={{ fontSize: 15, color: "#6B7280" }} />
              <button
                type="button"
                aria-label={`Preview ${attachment.name}`}
                onClick={() => void handlePreview(attachment)}
                style={{
                  position: "absolute",
                  inset: 0,
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  color: "transparent",
                }}
              >
                <EyeOutlined />
              </button>
              <button
                type="button"
                aria-label={`Remove ${attachment.name}`}
                disabled={!scope || mutationInFlight}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleRemove(attachment);
                }}
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: 0,
                  background: "rgba(0,0,0,.55)",
                  color: "#fff",
                  padding: 0,
                  cursor: scope && !mutationInFlight ? "pointer" : "not-allowed",
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 7,
                }}
              >
                <CloseOutlined />
              </button>
            </div>
          ))}
          <button
            type="button"
            aria-label="Upload attachment"
            onClick={() => fileInputRef.current?.click()}
            disabled={!scope || mutationInFlight}
            title={scope ? "Upload attachment" : "Attachment scope unavailable"}
            style={{
              width: 34,
              height: 34,
              border: "1.5px dashed #D1D5DB",
              borderRadius: 3,
              background: "#F9FAFB",
              color: "#6B7280",
              cursor: scope && !mutationInFlight ? "pointer" : "not-allowed",
            }}
          >
            {mutationId === "upload" ? "…" : <PlusOutlined />}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </div>

      <Modal
        open={Boolean(preview)}
        title={preview?.attachment.name}
        onCancel={closePreview}
        width="70%"
        destroyOnHidden
        footer={
          preview ? (
            <Button
              icon={<DownloadOutlined />}
              onClick={() =>
                void downloadAttachment(preview.attachment).catch((error) =>
                  message.error(error instanceof Error ? error.message : "Download failed"),
                )
              }
            >
              Download
            </Button>
          ) : null
        }
      >
        {previewContent()}
      </Modal>
    </div>
  );
};

type ScopedEditContext = EditContext<unknown, unknown> & {
  col?: number;
  row?: number;
  table?: {
    getRecordByCell: (col: number, row: number) => { id?: unknown } | undefined;
    getBodyField: (col: number, row: number) => unknown;
  };
};

export class AttachmentEditor extends ReactEditor {
  private resolveScope(): AttachmentScope | null {
    const context = this.editContext as ScopedEditContext | null;
    const tableId = useSmartTableStore.getState().currentTableId;
    if (
      !tableId ||
      !context?.table ||
      typeof context.col !== "number" ||
      typeof context.row !== "number"
    ) {
      return null;
    }
    const record = context.table.getRecordByCell(context.col, context.row);
    const field = context.table.getBodyField(context.col, context.row);
    if (typeof record?.id !== "string" || typeof field !== "string") return null;
    if (record.id.startsWith("__")) return null;
    return { tableId, recordId: record.id, fieldId: field };
  }

  render() {
    if (!this.root) return;
    this.root.render(
      <AttachmentEditorComponent
        initialValue={this.value}
        scope={this.resolveScope()}
        onChange={(value) => {
          this.value = value;
        }}
      />,
    );
  }
}
