import {
  Card,
  Empty,
  Modal,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from "antd";
import {
  FileImageOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  permissionAllows,
  useSmartTableStore,
  type Field,
  type TableRecord,
  type ViewConfig,
} from "../../../store/useSmartTableStore";
import { useTableRecords } from "../hooks/useTableRecords";
import { RowDetailDrawer } from "../RowDetailDrawer";
import { formatAutoNumber } from "../utils/autoNumber";
import { t } from "../../../lib/i18nRuntime";
import { FieldTypeIcon } from "../FieldTypeIcon";

const { Text } = Typography;

type GalleryViewProps = {
  configModalOpen: boolean;
  onConfigModalClose: () => void;
};

type GalleryConfig = NonNullable<ViewConfig["galleryConfig"]>;
type CardSize = NonNullable<GalleryConfig["cardSize"]>;
type ImageFit = NonNullable<GalleryConfig["imageFit"]>;

type AttachmentValue = {
  id?: string;
  name?: string;
  url?: string;
  type?: string;
};

const DEFAULT_GALLERY_CONFIG: Required<GalleryConfig> = {
  coverFieldId: null,
  titleFieldId: null,
  cardSize: "medium",
  imageFit: "cover",
  showFieldNames: true,
};

const CARD_METRICS: Record<
  CardSize,
  { minWidth: number; coverHeight: number; titleFontSize: number }
> = {
  small: { minWidth: 210, coverHeight: 124, titleFontSize: 13 },
  medium: { minWidth: 270, coverHeight: 164, titleFontSize: 14 },
  large: { minWidth: 340, coverHeight: 210, titleFontSize: 15 },
};

const MEDIA_FIELD_TYPES = new Set(["image", "attachment"]);

const isMediaField = (field: Field) =>
  MEDIA_FIELD_TYPES.has(String(field.type));

const isImageFile = (item: AttachmentValue) => {
  if (item.type?.toLowerCase().startsWith("image/")) return true;
  const name = item.name?.toLowerCase() || "";
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif)(\?.*)?$/.test(name);
};

const extractUrl = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const candidate = value as AttachmentValue;
    if (typeof candidate.url === "string" && candidate.url.trim()) {
      return candidate.url;
    }
  }
  return null;
};

const getCoverUrl = (
  field: Field | null,
  value: unknown,
): string | null => {
  if (!field || value === null || value === undefined) return null;

  if (field.type === "image") {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      const url = extractUrl(item);
      if (url) return url;
    }
    return null;
  }

  if (field.type === "attachment") {
    const values = Array.isArray(value) ? value : [value];
    for (const raw of values) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as AttachmentValue;
      if (!isImageFile(item)) continue;
      const url = extractUrl(item);
      if (url) return url;
    }
  }

  return null;
};

const formatRecordValue = (
  field: Field | undefined,
  value: unknown,
): string => {
  if (value === null || value === undefined || value === "") return "—";

  if (field?.type === "autoNumber") {
    return formatAutoNumber(field, value) || "—";
  }

  if (field?.type === "date") {
    const parsed = dayjs(value as string | number);
    if (parsed.isValid()) {
      return parsed.format(field.property?.format || "YYYY-MM-DD");
    }
  }

  if (field?.type === "rating") {
    const rating = Number(value);
    if (Number.isFinite(rating) && rating > 0) {
      return "★".repeat(Math.min(10, Math.max(0, Math.round(rating))));
    }
  }

  if (field?.type === "progress") {
    const progress = Number(value);
    if (Number.isFinite(progress)) return `${progress}%`;
  }

  if (field?.options?.length) {
    const labelById = new Map(
      field.options.map((option) => [option.id, option.label]),
    );
    const values = Array.isArray(value) ? value : [value];
    return values
      .map((item) => {
        if (item && typeof item === "object") {
          const candidate = item as {
            id?: string;
            label?: string;
            name?: string;
          };
          if (candidate.label) return candidate.label;
          if (candidate.name) return candidate.name;
          if (candidate.id) return labelById.get(candidate.id) || candidate.id;
        }
        const text = String(item);
        return labelById.get(text) || text;
      })
      .join(", ");
  }

  if (field?.type === "attachment") {
    const values = Array.isArray(value) ? value : [value];
    const names = values
      .map((item) => {
        if (item && typeof item === "object") {
          return (item as AttachmentValue).name || "";
        }
        return "";
      })
      .filter(Boolean);
    return names.length ? names.join(", ") : `${values.length} 个附件`;
  }

  if (field?.type === "image") {
    const values = Array.isArray(value) ? value : [value];
    return `${values.filter(Boolean).length} 张图片`;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => formatRecordValue(undefined, item))
      .filter((item) => item !== "—")
      .join(", ") || "—";
  }

  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  if (typeof value === "object") {
    const candidate = value as {
      label?: string;
      name?: string;
      title?: string;
      id?: string;
    };
    const label =
      candidate.label || candidate.name || candidate.title || candidate.id;
    if (label) return String(label);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const cardTitle = (
  record: TableRecord,
  titleField: Field | null,
): string => {
  if (!titleField) return record.id;
  const formatted = formatRecordValue(titleField, record[titleField.id]);
  return formatted === "—" ? "未命名记录" : formatted;
};

export function GalleryView({
  configModalOpen,
  onConfigModalClose,
}: GalleryViewProps) {
  const {
    fields,
    records,
    filters,
    sorts,
    hiddenFieldIds,
    views,
    currentViewId,
    currentPermission,
    insertRow,
    updateRecord,
    updateViewConfig,
  } = useSmartTableStore();

  const currentView = views.find((view) => view.id === currentViewId);
  const config: Required<GalleryConfig> = {
    ...DEFAULT_GALLERY_CONFIG,
    ...(currentView?.config?.galleryConfig || {}),
  };

  const visibleFields = useMemo(
    () => fields.filter((field) => !hiddenFieldIds.includes(field.id)),
    [fields, hiddenFieldIds],
  );
  const mediaFields = useMemo(
    () => fields.filter(isMediaField),
    [fields],
  );
  const titleCandidates = useMemo(
    () => fields.filter((field) => !isMediaField(field)),
    [fields],
  );

  const coverField = useMemo(() => {
    if (config.coverFieldId) {
      const configured = mediaFields.find(
        (field) => field.id === config.coverFieldId,
      );
      if (configured) return configured;
    }
    return mediaFields[0] || null;
  }, [config.coverFieldId, mediaFields]);

  const titleField = useMemo(() => {
    if (config.titleFieldId) {
      const configured = fields.find(
        (field) => field.id === config.titleFieldId,
      );
      if (configured && !isMediaField(configured)) return configured;
    }
    return (
      visibleFields.find((field) => field.type === "text") ||
      visibleFields.find((field) => !isMediaField(field)) ||
      titleCandidates[0] ||
      null
    );
  }, [config.titleFieldId, fields, titleCandidates, visibleFields]);

  const displayFields = useMemo(
    () =>
      visibleFields.filter(
        (field) =>
          field.id !== titleField?.id &&
          field.id !== coverField?.id,
      ),
    [coverField?.id, titleField?.id, visibleFields],
  );

  const drawerFields = useMemo(() => {
    if (
      !titleField ||
      !visibleFields.some((field) => field.id === titleField.id)
    ) {
      return visibleFields;
    }
    return [
      titleField,
      ...visibleFields.filter((field) => field.id !== titleField.id),
    ];
  }, [titleField, visibleFields]);

  const processedRecords = useTableRecords(
    records,
    fields,
    filters,
    sorts,
    { fieldId: null, order: "asc" },
  );

  const canUpdate = permissionAllows(currentPermission, "update");
  const canEdit = permissionAllows(currentPermission, "edit");
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [draftCoverFieldId, setDraftCoverFieldId] = useState<string | null>(
    config.coverFieldId,
  );
  const [draftTitleFieldId, setDraftTitleFieldId] = useState<string | null>(
    config.titleFieldId,
  );
  const [draftCardSize, setDraftCardSize] = useState<CardSize>(
    config.cardSize,
  );
  const [draftImageFit, setDraftImageFit] = useState<ImageFit>(
    config.imageFit,
  );
  const [draftShowFieldNames, setDraftShowFieldNames] = useState(
    config.showFieldNames,
  );

  useEffect(() => {
    if (!configModalOpen) return;
    setDraftCoverFieldId(
      config.coverFieldId &&
        mediaFields.some((field) => field.id === config.coverFieldId)
        ? config.coverFieldId
        : null,
    );
    setDraftTitleFieldId(
      config.titleFieldId &&
        titleCandidates.some((field) => field.id === config.titleFieldId)
        ? config.titleFieldId
        : null,
    );
    setDraftCardSize(config.cardSize);
    setDraftImageFit(config.imageFit);
    setDraftShowFieldNames(config.showFieldNames);
  }, [
    config.cardSize,
    config.coverFieldId,
    config.imageFit,
    config.showFieldNames,
    config.titleFieldId,
    configModalOpen,
    mediaFields,
    titleCandidates,
  ]);

  useEffect(() => {
    if (
      expandedRecordId &&
      !records.some((record) => record.id === expandedRecordId)
    ) {
      setExpandedRecordId(null);
    }
  }, [expandedRecordId, records]);

  const expandedRecord = expandedRecordId
    ? records.find((record) => record.id === expandedRecordId) || null
    : null;

  const handleSaveConfig = () => {
    if (!currentView) return;
    updateViewConfig(currentViewId, {
      ...(currentView.config || {}),
      galleryConfig: {
        coverFieldId: draftCoverFieldId,
        titleFieldId: draftTitleFieldId,
        cardSize: draftCardSize,
        imageFit: draftImageFit,
        showFieldNames: draftShowFieldNames,
      },
    });
    onConfigModalClose();
  };

  const handleAddRecord = async () => {
    if (!canUpdate) return;
    const created = await insertRow();
    if (!created) {
      message.error("新增记录失败，请稍后重试");
      return;
    }
    setExpandedRecordId(created.id);
  };

  const metrics = CARD_METRICS[config.cardSize];

  if (!fields.length) {
    return (
      <div
        style={{
          height: "100%",
          minHeight: 320,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F9FB",
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前数据表没有字段，请先添加字段"
        />
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          height: "100%",
          overflow: "auto",
          background: "#F8F9FB",
          padding: 20,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${metrics.minWidth}px, 1fr))`,
            gap: 16,
            alignItems: "start",
          }}
        >
          {processedRecords.map((record) => {
            const coverUrl = coverField
              ? getCoverUrl(coverField, record[coverField.id])
              : null;
            const title = cardTitle(record, titleField);

            return (
              <Card
                key={record.id}
                hoverable
                onClick={() => setExpandedRecordId(record.id)}
                styles={{
                  body: {
                    padding: 14,
                  },
                }}
                cover={
                  <div
                    style={{
                      height: metrics.coverHeight,
                      background: coverUrl ? "#F2F4F7" : "#F7F8FA",
                      borderBottom: "1px solid #EAECF0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt={title}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: config.imageFit,
                          display: "block",
                        }}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <FileImageOutlined
                        style={{ fontSize: 34, color: "#C0C7D1" }}
                      />
                    )}
                  </div>
                }
              >
                <div
                  title={title}
                  style={{
                    fontSize: metrics.titleFontSize,
                    fontWeight: 600,
                    color: "#101828",
                    lineHeight: 1.5,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginBottom: displayFields.length ? 10 : 0,
                  }}
                >
                  {title}
                </div>

                {displayFields.length > 0 ? (
                  <Space
                    direction="vertical"
                    size={7}
                    style={{ width: "100%" }}
                  >
                    {displayFields.map((field) => {
                      const value = formatRecordValue(
                        field,
                        record[field.id],
                      );
                      return (
                        <div
                          key={field.id}
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 8,
                            minWidth: 0,
                            fontSize: 12,
                            lineHeight: 1.5,
                          }}
                        >
                          {config.showFieldNames ? (
                            <span
                              style={{
                                color: "#98A2B3",
                                flex: "0 0 auto",
                                maxWidth: "42%",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                              title={field.name}
                            >
                              {field.name}
                            </span>
                          ) : null}
                          <span
                            style={{
                              color: value === "—" ? "#C0C7D1" : "#475467",
                              minWidth: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              flex: 1,
                            }}
                            title={value}
                          >
                            {value}
                          </span>
                        </div>
                      );
                    })}
                  </Space>
                ) : null}
              </Card>
            );
          })}

          {canUpdate ? (
            <button
              type="button"
              onClick={() => void handleAddRecord()}
              style={{
                minHeight: metrics.coverHeight + 94,
                border: "1px dashed #C9D0DA",
                borderRadius: 8,
                background: "#FFFFFF",
                color: "#667085",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                fontSize: 13,
              }}
            >
              <PlusOutlined />
              新增记录
            </button>
          ) : null}
        </div>

        {processedRecords.length === 0 && !canUpdate ? (
          <div style={{ paddingTop: 80 }}>
            <Empty description="当前视图暂无记录" />
          </div>
        ) : null}
      </div>

      <Modal
        title={
          <Space size={8}>
            <SettingOutlined />
            画廊视图设置
          </Space>
        }
        open={configModalOpen}
        onCancel={onConfigModalClose}
        onOk={handleSaveConfig}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        okButtonProps={{ disabled: !canEdit }}
        destroyOnHidden
      >
        <Space
          direction="vertical"
          size={18}
          style={{ width: "100%", paddingTop: 8 }}
        >
          <div>
            <Text strong>封面字段</Text>
            <Text
              type="secondary"
              style={{ display: "block", fontSize: 12, margin: "4px 0 8px" }}
            >
              支持图片字段和附件中的图片；未指定时自动使用第一个可用媒体字段。
            </Text>
            <Select
              allowClear
              placeholder="自动选择"
              value={draftCoverFieldId || undefined}
              onChange={(value) => setDraftCoverFieldId(value || null)}
              options={mediaFields.map((field) => ({
                value: field.id,
                label: (
                  <span
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <FieldTypeIcon type={field.type} />
                    {`${field.name} · ${
                      field.type === "image" ? "图片" : "附件"
                    }`}
                  </span>
                ),
              }))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <Text strong>标题字段</Text>
            <Text
              type="secondary"
              style={{ display: "block", fontSize: 12, margin: "4px 0 8px" }}
            >
              未指定时优先使用可见的文本字段。
            </Text>
            <Select
              allowClear
              placeholder="自动选择"
              value={draftTitleFieldId || undefined}
              onChange={(value) => setDraftTitleFieldId(value || null)}
              options={titleCandidates.map((field) => ({
                value: field.id,
                label: field.name,
              }))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <Text strong>卡片大小</Text>
            <Select
              value={draftCardSize}
              onChange={(value: CardSize) => setDraftCardSize(value)}
              options={[
                { value: "small", label: "小" },
                { value: "medium", label: "中" },
                { value: "large", label: "大" },
              ]}
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>

          <div>
            <Text strong>封面填充方式</Text>
            <Select
              value={draftImageFit}
              onChange={(value: ImageFit) => setDraftImageFit(value)}
              options={[
                { value: "cover", label: "裁切铺满" },
                { value: "contain", label: "完整显示" },
              ]}
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <Text strong>显示字段名称</Text>
              <Text
                type="secondary"
                style={{ display: "block", fontSize: 12, marginTop: 4 }}
              >
                关闭后卡片正文只显示字段值。
              </Text>
            </div>
            <Switch
              checked={draftShowFieldNames}
              onChange={setDraftShowFieldNames}
            />
          </div>

        </Space>
      </Modal>

      <RowDetailDrawer
        open={Boolean(expandedRecord)}
        title={
          expandedRecord
            ? cardTitle(expandedRecord, titleField)
            : "行详情"
        }
        record={expandedRecord}
        fields={drawerFields}
        canUpdate={canUpdate}
        onClose={() => setExpandedRecordId(null)}
        onUpdateRecord={(recordId, fieldId, value) =>
          updateRecord(recordId, fieldId, value)
        }
      />
    </>
  );
}
