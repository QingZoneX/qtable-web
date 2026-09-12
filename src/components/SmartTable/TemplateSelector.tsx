import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccountBookOutlined,
  AppstoreOutlined,
  BookOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  FileOutlined,
  ProjectOutlined,
  PlusOutlined,
  SolutionOutlined,
  TableOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useQuery } from "@apollo/client/react";
import {
  Button,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { GET_TEMPLATE_DETAIL, GET_TEMPLATES } from "../../lib/graphql";
import { t } from "../../lib/i18n";
import "./templateSelector.css";

type TemplateScope = "system" | "personal" | "workspace";

type TemplateField = {
  id: string;
  name?: string;
  type?: string;
};

type TemplateView = {
  id: string;
  name?: string;
  type?: string;
};

type TemplateSnapshot = {
  fields?: TemplateField[];
  views?: TemplateView[];
  records?: Array<Record<string, unknown>>;
};

export interface TemplateInfo {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  icon?: string | null;
  scope: TemplateScope;
  ownerUserId?: number | null;
  workspaceId?: string | null;
  status: "active" | "archived";
  version: number;
  usageCount: number;
  includeRecords: boolean;
  featured: boolean;
  fieldCount: number;
  viewCount: number;
  recordCount: number;
  canManage: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  snapshot?: TemplateSnapshot;
}

interface TemplateSelectorProps {
  open: boolean;
  workspaceId?: string;
  onClose: () => void;
  onSelect: (templateId: string) => void | Promise<void>;
}

type CategoryItem = {
  value: string;
  label: string;
  count: number;
};

const BLANK_TEMPLATE_ID = "blank";
const CATEGORY_ORDER = [
  "project",
  "product",
  "sales",
  "operations",
  "people",
  "finance",
  "asset",
  "general",
] as const;

const iconMap: Record<string, React.ReactNode> = {
  file: <FileOutlined />,
  project: <ProjectOutlined />,
  appstore: <AppstoreOutlined />,
  solution: <SolutionOutlined />,
  team: <TeamOutlined />,
  book: <BookOutlined />,
  check: <CheckCircleOutlined />,
};

const categoryIconMap: Record<string, React.ReactNode> = {
  all: <AppstoreOutlined />,
  general: <FileOutlined />,
  project: <ProjectOutlined />,
  product: <SolutionOutlined />,
  sales: <TeamOutlined />,
  operations: <CalendarOutlined />,
  people: <TeamOutlined />,
  finance: <AccountBookOutlined />,
  asset: <DatabaseOutlined />,
};

const viewIconMap: Record<string, React.ReactNode> = {
  grid: <TableOutlined />,
  board: <AppstoreOutlined />,
  gantt: <ProjectOutlined />,
  calendar: <CalendarOutlined />,
  gallery: <BookOutlined />,
  dashboard: <SolutionOutlined />,
};

const scopeLabel = (scope: TemplateScope) => {
  if (scope === "personal") return t("template.personal");
  if (scope === "workspace") return t("template.workspace");
  return t("template.system");
};

const categoryLabel = (category?: string | null) => {
  if (!category) return t("template.category.general");
  const translated = t(`template.category.${category}`);
  return translated.startsWith("template.category.") ? category : translated;
};

const getTemplateIcon = (iconName?: string | null): React.ReactNode =>
  iconName && iconMap[iconName] ? iconMap[iconName] : <FileOutlined />;

const getCategoryIcon = (category: string): React.ReactNode =>
  categoryIconMap[category] || <AppstoreOutlined />;

const getViewIcon = (type?: string): React.ReactNode =>
  (type && viewIconMap[type]) || <TableOutlined />;

const getCategoryTheme = (category?: string | null) => {
  if (!category) return "general";
  return categoryIconMap[category] ? category : "other";
};

const getCoverVariant = (templateId: string) => {
  let hash = 0;
  for (const character of templateId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % 4;
};

function TemplateCover({ template }: { template: TemplateInfo }) {
  const theme = getCategoryTheme(template.category);
  const variant = getCoverVariant(template.id);
  return (
    <div
      className={`qtable-template-cover category-${theme} variant-${variant}`}
      aria-hidden="true"
    >
      <div className="qtable-template-cover-glow" />
      <div className="qtable-template-cover-sheet">
        <span className="qtable-template-cover-line is-title" />
        <span className="qtable-template-cover-line" />
        <span className="qtable-template-cover-line is-short" />
        <span className="qtable-template-cover-line" />
      </div>
      <div className="qtable-template-cover-icon">
        {template.id === BLANK_TEMPLATE_ID ? (
          <PlusOutlined />
        ) : (
          getTemplateIcon(template.icon)
        )}
      </div>
      <div className="qtable-template-cover-accent" />
    </div>
  );
}

export function TemplateSelector({
  open,
  workspaceId,
  onClose,
  onSelect,
}: TemplateSelectorProps) {
  const [scope, setScope] = useState<TemplateScope>("system");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const templateListRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  const {
    data,
    loading,
    error,
    refetch,
  } = useQuery<{ templates: TemplateInfo[] }>(GET_TEMPLATES, {
    variables: {
      workspaceId,
      scope: null,
      search: null,
      category: null,
      includeArchived: false,
    },
    skip: !open,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  });

  const templates = useMemo(() => data?.templates || [], [data?.templates]);

  const counts = useMemo(
    () => ({
      system: templates.filter((item) => item.scope === "system").length,
      personal: templates.filter((item) => item.scope === "personal").length,
      workspace: templates.filter((item) => item.scope === "workspace").length,
    }),
    [templates],
  );

  const categoryItems = useMemo<CategoryItem[]>(() => {
    const activeScopeTemplates = templates.filter(
      (item) => item.scope === scope && item.status === "active",
    );
    const categoryCounts = new Map<string, number>();
    for (const item of activeScopeTemplates) {
      const value = item.category || "general";
      categoryCounts.set(value, (categoryCounts.get(value) || 0) + 1);
    }

    const knownCategories = CATEGORY_ORDER.filter((value) =>
      categoryCounts.has(value),
    );
    const knownSet = new Set<string>(CATEGORY_ORDER);
    const remainingCategories = Array.from(categoryCounts.keys())
      .filter((value) => !knownSet.has(value))
      .sort((left, right) =>
        categoryLabel(left).localeCompare(categoryLabel(right)),
      );

    return [
      {
        value: "all",
        label: t("template.allCategories"),
        count: activeScopeTemplates.length,
      },
      ...[...knownCategories, ...remainingCategories].map((value) => ({
        value,
        label: categoryLabel(value),
        count: categoryCounts.get(value) || 0,
      })),
    ];
  }, [scope, templates]);

  const visibleTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return templates
      .filter((item) => {
        if (item.scope !== scope || item.status !== "active") return false;
        if (category !== "all" && (item.category || "general") !== category) {
          return false;
        }
        if (!query) return true;
        const haystack = [
          item.name,
          item.description || "",
          item.category || "",
          ...(item.tags || []),
        ]
          .join(" ")
          .toLocaleLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => {
        if (category !== "all") return 0;
        if (left.id === BLANK_TEMPLATE_ID) return -1;
        if (right.id === BLANK_TEMPLATE_ID) return 1;
        return 0;
      });
  }, [category, scope, search, templates]);

  useEffect(() => {
    if (!open) return;
    setCategory("all");
    setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    templateListRef.current?.scrollTo({ top: 0 });
  }, [category, open, scope, search]);

  useEffect(() => {
    if (!open) return;
    previewScrollRef.current?.scrollTo({ top: 0 });
  }, [open, selectedTemplateId]);

  useEffect(() => {
    if (category === "all") return;
    if (!categoryItems.some((item) => item.value === category)) {
      setCategory("all");
    }
  }, [category, categoryItems]);

  useEffect(() => {
    if (visibleTemplates.length === 0) {
      setSelectedTemplateId(null);
      return;
    }
    if (
      !selectedTemplateId ||
      !visibleTemplates.some((item) => item.id === selectedTemplateId)
    ) {
      setSelectedTemplateId(visibleTemplates[0].id);
    }
  }, [selectedTemplateId, visibleTemplates]);

  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useQuery<{ templateDetail: TemplateInfo }>(GET_TEMPLATE_DETAIL, {
    variables: {
      templateId: selectedTemplateId || "",
      workspaceId,
      includeArchived: false,
    },
    skip: !open || !selectedTemplateId,
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  });

  const selectedTemplate =
    detailData?.templateDetail ||
    visibleTemplates.find((item) => item.id === selectedTemplateId) ||
    null;
  const snapshot = selectedTemplate?.snapshot;
  const fields = snapshot?.fields || [];
  const views = snapshot?.views || [];

  const tabItems = [
    {
      key: "system",
      label: `${t("template.system")} (${counts.system})`,
    },
    {
      key: "personal",
      label: `${t("template.personal")} (${counts.personal})`,
    },
    {
      key: "workspace",
      label: `${t("template.workspace")} (${counts.workspace})`,
    },
  ];

  const handleUseTemplate = (template: TemplateInfo | null = selectedTemplate) => {
    if (!template || template.status !== "active") return;
    void onSelect(template.id);
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1240}
      destroyOnClose
      rootClassName="qtable-template-selector-modal"
      title={
        <div>
          <div style={{ fontSize: 17, fontWeight: 650 }}>
            {t("template.centerTitle")}
          </div>
          <div
            style={{
              color: "#6b7280",
              fontSize: 12,
              fontWeight: 400,
              marginTop: 3,
            }}
          >
            {t("template.centerSubtitle")}
          </div>
        </div>
      }
      styles={{ body: { paddingTop: 12 } }}
    >
      <Tabs
        activeKey={scope}
        onChange={(key) => setScope(key as TemplateScope)}
        items={tabItems}
        className="qtable-template-tabs"
      />

      <div className="qtable-template-center-layout">
        <aside
          className="qtable-template-category-rail"
          aria-label={t("template.allCategories")}
          data-testid="template-category-rail"
        >
          {categoryItems.map((item) => {
            const selected = category === item.value;
            const theme = getCategoryTheme(item.value === "all" ? null : item.value);
            return (
              <button
                key={item.value}
                type="button"
                aria-current={selected ? "true" : undefined}
                className={`qtable-template-category-item${selected ? " is-selected" : ""}`}
                onClick={() => setCategory(item.value)}
              >
                <span
                  className={`qtable-template-category-icon category-${item.value === "all" ? "all" : theme}`}
                >
                  {getCategoryIcon(item.value)}
                </span>
                <span className="qtable-template-category-label">{item.label}</span>
                <span className="qtable-template-category-count">{item.count}</span>
              </button>
            );
          })}
        </aside>

        <div className="qtable-template-list-pane">
          <div className="qtable-template-controls">
            <Input.Search
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("template.searchPlaceholder")}
            />
          </div>

          <div
            ref={templateListRef}
            className="qtable-template-list-region"
            data-testid="template-list-scroll-region"
          >
            {loading ? (
              <div className="qtable-template-state">
                <Spin />
              </div>
            ) : error ? (
              <div className="qtable-template-state">
                <Empty
                  description={
                    <Space orientation="vertical">
                      <span>{t("template.loadFailed")}</span>
                      <Button size="small" onClick={() => void refetch()}>
                        {t("template.retry")}
                      </Button>
                    </Space>
                  }
                />
              </div>
            ) : visibleTemplates.length === 0 ? (
              <div className="qtable-template-state">
                <Empty description={t("sidebar.noTemplates")} />
              </div>
            ) : (
              <div className="qtable-template-card-grid">
                {visibleTemplates.map((template) => {
                  const selected = template.id === selectedTemplateId;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedTemplateId(template.id)}
                      onDoubleClick={() => handleUseTemplate(template)}
                      className={`qtable-template-card${selected ? " is-selected" : ""}${template.id === BLANK_TEMPLATE_ID ? " is-blank-template" : ""}`}
                    >
                      <TemplateCover template={template} />
                      <div className="qtable-template-card-content">
                        <div className="qtable-template-card-title-row">
                          <div className="qtable-template-card-title-icon">
                            {getTemplateIcon(template.icon)}
                          </div>
                          <Space size={5} wrap className="qtable-template-card-heading">
                            <Typography.Text strong ellipsis>
                              {template.name}
                            </Typography.Text>
                            {template.featured && (
                              <Tag color="purple">{t("template.featured")}</Tag>
                            )}
                          </Space>
                        </div>
                        <Typography.Paragraph
                          type="secondary"
                          ellipsis={{ rows: 2 }}
                          className="qtable-template-card-description"
                        >
                          {template.description || t("template.noDescription")}
                        </Typography.Paragraph>
                        <Space size={[4, 4]} wrap>
                          <Tag>{categoryLabel(template.category)}</Tag>
                          {(template.tags || []).slice(0, 2).map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </Space>
                        <div className="qtable-template-card-meta">
                          {template.fieldCount} {t("template.fields")} ·{" "}
                          {template.viewCount} {t("template.views")}
                          {template.recordCount > 0
                            ? ` · ${template.recordCount} ${t("template.examples")}`
                            : ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="qtable-template-preview">
          {!selectedTemplateId ? (
            <div className="qtable-template-state">
              <Empty description={t("template.preview")} />
            </div>
          ) : detailLoading ? (
            <div className="qtable-template-state">
              <Spin />
            </div>
          ) : detailError ? (
            <div className="qtable-template-state">
              <Empty
                description={
                  <Space orientation="vertical">
                    <span>{t("template.detailLoadFailed")}</span>
                    <Button size="small" onClick={() => void refetchDetail()}>
                      {t("template.retry")}
                    </Button>
                  </Space>
                }
              />
            </div>
          ) : selectedTemplate ? (
            <div className="qtable-template-preview-shell">
              <div className="qtable-template-preview-header">
                <Space size={8} wrap>
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    {selectedTemplate.name}
                  </Typography.Title>
                  <Tag>{scopeLabel(selectedTemplate.scope)}</Tag>
                </Space>
                <Typography.Paragraph
                  type="secondary"
                  style={{ fontSize: 12, marginTop: 8, marginBottom: 12 }}
                >
                  {selectedTemplate.description || t("template.noDescription")}
                </Typography.Paragraph>
                <Space size={[4, 4]} wrap>
                  <Tag color="blue">
                    {categoryLabel(selectedTemplate.category)}
                  </Tag>
                  {(selectedTemplate.tags || []).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Space>
              </div>

              <div className="qtable-template-preview-metrics">
                {[
                  [t("template.fields"), selectedTemplate.fieldCount],
                  [t("template.views"), selectedTemplate.viewCount],
                  [t("template.examples"), selectedTemplate.recordCount],
                  [t("template.uses"), selectedTemplate.usageCount],
                ].map(([label, value]) => (
                  <div key={String(label)} className="qtable-template-preview-metric">
                    <div className="qtable-template-preview-metric-label">
                      {label}
                    </div>
                    <div className="qtable-template-preview-metric-value">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div
                ref={previewScrollRef}
                className="qtable-template-preview-scroll"
                data-testid="template-preview-scroll-region"
              >
                <Typography.Text strong style={{ fontSize: 12 }}>
                  {t("template.fields")}
                </Typography.Text>
                {fields.length === 0 ? (
                  <div className="qtable-template-preview-empty-copy">
                    {t("template.noFields")}
                  </div>
                ) : (
                  <div className="qtable-template-field-list">
                    {fields.slice(0, 12).map((field) => (
                      <div key={field.id} className="qtable-template-field-row">
                        <span className="qtable-template-field-name">
                          {field.name || field.id}
                        </span>
                        <Tag style={{ marginInlineEnd: 0 }}>
                          {field.type || "text"}
                        </Tag>
                      </div>
                    ))}
                  </div>
                )}

                <Typography.Text strong style={{ fontSize: 12 }}>
                  {t("template.views")}
                </Typography.Text>
                {views.length === 0 ? (
                  <div className="qtable-template-preview-empty-copy">
                    {t("template.noViews")}
                  </div>
                ) : (
                  <div className="qtable-template-view-list">
                    {views.map((view) => (
                      <Space
                        key={view.id}
                        size={7}
                        className="qtable-template-view-row"
                      >
                        <span className="qtable-template-view-icon">
                          {getViewIcon(view.type)}
                        </span>
                        <span className="qtable-template-view-name">
                          {view.name || view.id}
                        </span>
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          {view.type || "grid"}
                        </Typography.Text>
                      </Space>
                    ))}
                  </div>
                )}
              </div>

              <div className="qtable-template-preview-footer">
                <div className="qtable-template-preview-footer-meta">
                  <span>
                    {t("template.version")} v{selectedTemplate.version}
                  </span>
                  <span>
                    {selectedTemplate.includeRecords
                      ? `${selectedTemplate.recordCount} ${t("template.examples")}`
                      : t("template.fields")}
                  </span>
                </div>
                <Button
                  block
                  type="primary"
                  onClick={() => handleUseTemplate()}
                  disabled={selectedTemplate.status !== "active"}
                >
                  {t("template.useTemplate")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="qtable-template-state">
              <Empty description={t("template.preview")} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
