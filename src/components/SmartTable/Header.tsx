import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Dropdown,
  Input,
  Modal,
  Space,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { MenuProps } from "antd";
import {
  AppstoreOutlined,
  CalendarOutlined,
  DownOutlined,
  EllipsisOutlined,
  FormOutlined,
  PictureOutlined,
  PlusOutlined,
  ProjectOutlined,
  TableOutlined,
} from "@ant-design/icons";
import {
  permissionAllows,
  type View,
  useSmartTableStore,
} from "../../store/useSmartTableStore";
import { useNavigate, useParams } from "react-router-dom";
import { t } from "../../lib/i18n";
import { TaskProfileHeaderAction } from "../TaskProfile/TaskProfileHeaderAction";
import { dispatchTableWorkspaceAction } from "./tableWorkspaceEvents";
import { tableWorkspaceT } from "./tableWorkspaceI18n";
import "./tableWorkspace.css";

type CreatableViewType = "grid" | "board" | "gantt" | "calendar" | "gallery";

export function Header() {
  const {
    views,
    currentViewId,
    setCurrentView,
    createView,
    renameView,
    copyView,
    deleteView,
    currentTableName,
    currentPermission,
    insertRow,
  } = useSmartTableStore();
  const navigate = useNavigate();
  const { tableId } = useParams();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<CreatableViewType>("grid");
  const [createName, setCreateName] = useState("");
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<View | null>(null);
  const [renameName, setRenameName] = useState("");
  const [creatingRecord, setCreatingRecord] = useState(false);
  const viewsAreaRef = useRef<HTMLDivElement | null>(null);
  const [viewsAreaWidth, setViewsAreaWidth] = useState(0);

  const canUpdateRecord = permissionAllows(currentPermission, "update");
  const canEditView = permissionAllows(currentPermission, "edit");

  const permissionLabelMap = {
    manage: t("permission.canManage"),
    edit: t("permission.canEdit"),
    update: t("permission.canUpdate"),
    read: t("permission.canRead"),
  };
  const permissionColorMap = {
    manage: "green",
    edit: "blue",
    update: "orange",
    read: "default",
  } as const;
  const permissionLabel =
    permissionLabelMap[currentPermission ?? "read"] ?? t("permission.canRead");
  const permissionColor =
    permissionColorMap[currentPermission ?? "read"] ?? "default";
  const tableName = currentTableName || t("action.untitledTable");
  const currentView = views.find((view) => view.id === currentViewId) || null;

  const getViewIcon = (view: Pick<View, "type" | "name">) => {
    const viewType = String(view.type);
    if (viewType === "board") return <AppstoreOutlined />;
    if (viewType === "calendar") return <CalendarOutlined />;
    if (viewType === "gallery") return <PictureOutlined />;
    if (viewType === "gantt" || /gantt/i.test(view.name)) return <ProjectOutlined />;
    if (viewType === "form") return <FormOutlined />;
    return <TableOutlined />;
  };

  const createItems: MenuProps["items"] = [
    { key: "grid", icon: <TableOutlined />, label: t("view.gridView") },
    { key: "board", icon: <AppstoreOutlined />, label: t("view.kanbanView") },
    { key: "gantt", icon: <ProjectOutlined />, label: t("view.ganttView") },
    { key: "calendar", icon: <CalendarOutlined />, label: t("view.calendarView") },
    { key: "gallery", icon: <PictureOutlined />, label: t("view.galleryView") },
  ];

  const onCreateMenuClick: MenuProps["onClick"] = ({ key }) => {
    setCreateType(key as CreatableViewType);
    setCreateName("");
    setCreateModalOpen(true);
  };

  const onSubmitCreate = async () => {
    const created = await createView(createType, createName.trim() || undefined);
    if (!created) {
      message.error(t("msg.createViewFailed"));
      return;
    }
    setCreateModalOpen(false);
    if (tableId) navigate(`/workbench/${tableId}/${created.id}`);
  };

  const openRenameModal = (view: View) => {
    setRenameTarget(view);
    setRenameName(view.name);
    setRenameModalOpen(true);
  };

  const onSubmitRename = async () => {
    if (!renameTarget) return;
    const ok = await renameView(renameTarget.id, renameName);
    if (!ok) {
      message.error(t("msg.renameViewFailed"));
      return;
    }
    setRenameModalOpen(false);
  };

  const onCopyView = async (view: View) => {
    const copied = await copyView(view.id);
    if (!copied) {
      message.error(t("msg.copyViewFailed"));
      return;
    }
    if (tableId) navigate(`/workbench/${tableId}/${copied.id}`);
  };

  const onDeleteView = async (view: View) => {
    if (views.length <= 1) {
      message.warning(t("msg.keepOneView"));
      return;
    }
    const deletingCurrent = currentViewId === view.id;
    const fallbackView = views.find((item) => item.id !== view.id) || null;
    const ok = await deleteView(view.id);
    if (!ok) {
      message.error(t("msg.deleteViewFailed"));
      return;
    }
    if (deletingCurrent && fallbackView && tableId) {
      navigate(`/workbench/${tableId}/${fallbackView.id}`, { replace: true });
    }
  };

  const currentViewMenu: MenuProps = useMemo(() => ({
    items: currentView
      ? [
          { key: "rename", label: t("view.renameView"), disabled: !canEditView },
          { key: "copy", label: t("view.copyView"), disabled: !canEditView },
          {
            key: "delete",
            label: t("view.deleteView"),
            danger: true,
            disabled: !canEditView || views.length <= 1,
          },
        ]
      : [],
    onClick: ({ key }) => {
      if (!currentView || !canEditView) return;
      if (key === "rename") openRenameModal(currentView);
      if (key === "copy") void onCopyView(currentView);
      if (key === "delete") {
        Modal.confirm({
          title: t("view.confirmDeleteView"),
          content: t("view.confirmDeleteViewWithName").replace(
            "{name}",
            currentView.name,
          ),
          okText: t("sidebar.confirm"),
          cancelText: t("sidebar.cancel"),
          onOk: () => onDeleteView(currentView),
        });
      }
    },
  }), [canEditView, currentView, views.length, onCopyView, onDeleteView]);

  useEffect(() => {
    const node = viewsAreaRef.current;
    if (!node) return;
    const updateWidth = () => setViewsAreaWidth(node.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const switchToView = (viewId: string) => {
    setCurrentView(viewId);
    if (tableId) navigate(`/workbench/${tableId}/${viewId}`);
  };

  const { visibleViews, overflowViews } = useMemo(() => {
    const estimateViewWidth = (view: View) => {
      const textWidth = Math.min(view.name.length, 24) * 8;
      return Math.min(210, Math.max(92, 38 + textWidth));
    };
    const fixedToolsWidth = (canEditView ? 34 : 0) + 34;
    const moreButtonWidth = 74;
    const itemGap = 2;
    const computeViewSetByCount = (count: number) => {
      const initialVisible = views.slice(0, count);
      if (!initialVisible.length) return initialVisible;
      if (initialVisible.some((view) => view.id === currentViewId)) return initialVisible;
      const activeView = views.find((view) => view.id === currentViewId);
      if (!activeView) return initialVisible;
      const nextVisible = [...initialVisible];
      nextVisible[count - 1] = activeView;
      const deduped: View[] = [];
      const seen = new Set<string>();
      for (const view of nextVisible) {
        if (seen.has(view.id)) continue;
        deduped.push(view);
        seen.add(view.id);
      }
      return deduped;
    };

    if (!views.length) {
      return { visibleViews: [] as View[], overflowViews: [] as View[] };
    }

    const estimatedWidths = views.map(estimateViewWidth);
    const available = viewsAreaWidth;
    const maxCount = views.length;
    if (available <= 0) {
      const visible = computeViewSetByCount(Math.min(1, maxCount));
      const visibleIds = new Set(visible.map((view) => view.id));
      return {
        visibleViews: visible,
        overflowViews: views.filter((view) => !visibleIds.has(view.id)),
      };
    }

    let finalCount = 0;
    for (let count = maxCount; count >= 0; count -= 1) {
      const hasOverflow = count < maxCount;
      let used = fixedToolsWidth + (hasOverflow ? moreButtonWidth : 0);
      for (let index = 0; index < count; index += 1) {
        used += estimatedWidths[index];
        if (index < count - 1) used += itemGap;
      }
      if (used <= available) {
        finalCount = count;
        break;
      }
    }
    if (finalCount === 0 && maxCount > 0) finalCount = 1;
    const visible = computeViewSetByCount(finalCount);
    const visibleIds = new Set(visible.map((view) => view.id));
    return {
      visibleViews: visible,
      overflowViews: views.filter((view) => !visibleIds.has(view.id)),
    };
  }, [views, currentViewId, viewsAreaWidth, canEditView]);

  const createRecord = async () => {
    if (!canUpdateRecord || creatingRecord) return;
    setCreatingRecord(true);
    try {
      const created = await insertRow();
      if (!created) message.error(tableWorkspaceT("addFailed"));
    } finally {
      setCreatingRecord(false);
    }
  };

  const primaryMenu: MenuProps = {
    items: [
      {
        key: "new",
        icon: <PlusOutlined />,
        label: tableWorkspaceT("newRecord"),
        disabled: !canUpdateRecord,
      },
      {
        key: "import",
        label: tableWorkspaceT("importCsv"),
        disabled: !canUpdateRecord,
      },
      {
        key: "ai",
        label: tableWorkspaceT("aiGenerate"),
        disabled: !permissionAllows(currentPermission, "edit"),
      },
    ],
    onClick: ({ key }) => {
      if (key === "new") void createRecord();
      if (key === "import" && canUpdateRecord) {
        dispatchTableWorkspaceAction("import_csv");
      }
      if (key === "ai" && permissionAllows(currentPermission, "edit")) {
        dispatchTableWorkspaceAction("ai_generate");
      }
    },
  };

  return (
    <div className="qtable-table-chrome">
      <div className="qtable-table-page-header">
        <div className="qtable-table-title-block">
          <span className="qtable-table-title-icon" aria-hidden="true">
            <TableOutlined />
          </span>
          <div className="qtable-table-title-copy">
            <div className="qtable-table-title-row">
              <span className="qtable-table-title" title={tableName}>{tableName}</span>
              <Tag color={permissionColor} style={{ marginInlineEnd: 0 }}>
                {permissionLabel}
              </Tag>
            </div>
            <div className="qtable-table-title-meta">
              <span className="qtable-table-secondary-meta">{tableWorkspaceT("table")}</span>
              <span>·</span>
              {canEditView ? (
                <Tooltip title={tableWorkspaceT("autoSave")}>
                  <span className="qtable-table-save-state">
                    {tableWorkspaceT("sharedView")} · {tableWorkspaceT("autoSave")}
                  </span>
                </Tooltip>
              ) : (
                <Tooltip title={tableWorkspaceT("readOnlyHint")}>
                  <span className="qtable-table-save-state is-readonly">
                    {tableWorkspaceT("readOnlyView")}
                  </span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        <div className="qtable-table-header-actions">
          <TaskProfileHeaderAction tableId={tableId} />
          <Dropdown.Button
            className="qtable-table-primary"
            type="primary"
            menu={primaryMenu}
            icon={<DownOutlined />}
            loading={creatingRecord}
            disabled={!canUpdateRecord}
            onClick={() => void createRecord()}
          >
            {tableWorkspaceT("newRecord")}
          </Dropdown.Button>
        </div>
      </div>

      <div className="qtable-table-view-row">
        <div ref={viewsAreaRef} className="qtable-table-view-viewport">
          <div className="qtable-table-view-tabs" role="tablist" aria-label={tableWorkspaceT("currentView")}>
            {visibleViews.map((view) => {
              const isActive = currentViewId === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? "page" : undefined}
                  className={`qtable-table-view-tab${isActive ? " is-active" : ""}`}
                  onClick={() => switchToView(view.id)}
                  title={view.name}
                >
                  {getViewIcon(view)}
                  <span className="qtable-table-view-name">{view.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="qtable-table-view-tools">
          {overflowViews.length > 0 ? (
            <Dropdown
              menu={{
                items: overflowViews.map((view) => ({
                  key: view.id,
                  icon: getViewIcon(view),
                  label: view.name,
                })),
                onClick: ({ key }) => switchToView(String(key)),
              }}
              trigger={["click"]}
              placement="bottomLeft"
            >
              <Button type="text" icon={<DownOutlined />}>
                {tableWorkspaceT("moreViews")}
              </Button>
            </Dropdown>
          ) : null}

          {currentView ? (
            <Tooltip title={tableWorkspaceT("currentViewActions")}>
              <Dropdown menu={currentViewMenu} trigger={["click"]} placement="bottomRight">
                <Button
                  type="text"
                  aria-label={tableWorkspaceT("currentViewActions")}
                  icon={<EllipsisOutlined />}
                  disabled={!canEditView}
                />
              </Dropdown>
            </Tooltip>
          ) : null}

          {canEditView ? (
            <Tooltip title={tableWorkspaceT("createView")}>
              <Dropdown
                menu={{ items: createItems, onClick: onCreateMenuClick }}
                trigger={["click"]}
                placement="bottomRight"
              >
                <Button
                  type="text"
                  aria-label={tableWorkspaceT("createView")}
                  icon={<PlusOutlined />}
                />
              </Dropdown>
            </Tooltip>
          ) : null}
        </div>
      </div>

      <Modal
        open={createModalOpen}
        title={t("view.createView")}
        onOk={onSubmitCreate}
        onCancel={() => setCreateModalOpen(false)}
        okText={t("sidebar.confirm")}
        cancelText={t("sidebar.cancel")}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Typography.Text>{t("view.viewName")}</Typography.Text>
          <Input
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            placeholder={t("view.optionalViewName")}
          />
        </Space>
      </Modal>
      <Modal
        open={renameModalOpen}
        title={t("view.renameView")}
        onOk={onSubmitRename}
        onCancel={() => setRenameModalOpen(false)}
        okText={t("sidebar.confirm")}
        cancelText={t("sidebar.cancel")}
      >
        <Input
          value={renameName}
          onChange={(event) => setRenameName(event.target.value)}
          placeholder={t("view.viewName")}
        />
      </Modal>
    </div>
  );
}
