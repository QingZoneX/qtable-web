import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Avatar,
  Drawer,
  Divider,
  Dropdown,
  Input,
  message,
  Modal,
  Popover,
  List,
  Select,
  Space,
  Skeleton,
  Tabs,
  Tag,
  Tree,
  Tooltip,
  Typography,
} from "antd";
import type { DataNode, EventDataNode } from "antd/es/tree";
import {
  FolderAddOutlined,
  FileAddOutlined,
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
  SwapOutlined,
  EllipsisOutlined,
  FolderOutlined,
  TableOutlined,
  PlusOutlined,
  SearchOutlined,
  ShareAltOutlined,
  TeamOutlined,
  LockOutlined,
  FileTextOutlined,
  AppstoreAddOutlined,
  DashboardOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@apollo/client/react";
import { useAuthStore } from "../../store/authStore";
import {
  GET_WORKSPACE,
  GET_WORKSPACES,
  CREATE_WORKSPACE,
  RENAME_WORKSPACE,
  DELETE_WORKSPACE,
  CREATE_FOLDER,
  CREATE_TABLE,
  CREATE_DASHBOARD,
  DELETE_ITEM,
  RENAME_ITEM,
  COPY_TABLE,
  COPY_DASHBOARD,
  MOVE_ITEM,
  ITEM_ACCESS,
  SET_ITEM_PERMISSION,
  REMOVE_ITEM_PERMISSION,
} from "../../lib/graphql";
import { useWorkspaceAccess } from "../../hooks/useWorkspaceAccess";
import {
  permissionAllows,
  useSmartTableStore,
  getTableLastViewId,
} from "../../store/useSmartTableStore";
import { t } from "../../lib/i18nRuntime";
import { TemplateSelector } from "./TemplateSelector";
import { GoalWorkspaceModal } from "../GoalWorkspace/GoalWorkspaceModal";
import { useLocation } from "react-router-dom";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import { WORKSPACE_MANAGER_OPEN_EVENT } from "../../lib/shellEvents";
import "./sidebar.css";

type WorkspaceNode = {
  type: "folder" | "table" | "dashboard";
  id: string;
  name: string;
  defaultViewId?: string;
  children?: WorkspaceNode[];
};

type WorkspaceSummary = {
  id: string;
  name: string;
  rootId?: string;
};

type WorkspacesPayload = {
  owned: WorkspaceSummary[];
  invited: WorkspaceSummary[];
};
type ItemAccessEntry = {
  userId: number;
  name: string;
  email: string;
  role: string;
  permission: string;
  inherited: boolean;
};
type AuthSnapshot = ReturnType<typeof useAuthStore.getState>;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 360;

const clampDragWidth = (width: number) =>
  Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);

function findInWorkspace(
  root: WorkspaceNode,
  id: string,
): WorkspaceNode | null {
  if (root.id === id) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const match = findInWorkspace(child, id);
    if (match) return match;
  }
  return null;
}

function findParentId(root: WorkspaceNode, id: string): string | null {
  if (!root.children) return null;
  for (const child of root.children) {
    if (child.id === id) return root.id;
    const match = findParentId(child, id);
    if (match) return match;
  }
  return null;
}

function toTreeData(
  root: WorkspaceNode,
  renderTitle: (n: WorkspaceNode) => React.ReactNode,
): DataNode[] {
  const walk = (node: WorkspaceNode): DataNode => ({
    key: node.id,
    title: renderTitle(node),
    isLeaf: node.type === "table" || node.type === "dashboard",
    children: (node.children || []).map(walk),
  });
  return (root.children || []).map(walk);
}

export function Sidebar() {
  const navigate = useNavigate();
  const { tableId, dashboardId } = useParams();
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const workspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);
  const setWorkspaceId = useWorkspaceNavigationStore(
    (state) => state.setWorkspaceId,
  );
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [isResizing, setIsResizing] = useState(false);
  const [workspaceDrawerOpen, setWorkspaceDrawerOpen] = useState(false);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [workspaceModalMode, setWorkspaceModalMode] = useState<
    "create" | "rename"
  >("create");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceTarget, setWorkspaceTarget] =
    useState<WorkspaceSummary | null>(null);
  const {
    data: workspaceListData,
    refetch: refetchWorkspaces,
    loading: workspaceListLoading,
    error: workspaceListError,
  } = useQuery<{
    workspaces: WorkspacesPayload;
  }>(GET_WORKSPACES, {
    skip: !token,
    fetchPolicy: "network-only",
  });
  const [createWorkspace] = useMutation(CREATE_WORKSPACE);
  const [renameWorkspace] = useMutation(RENAME_WORKSPACE);
  const [deleteWorkspace] = useMutation(DELETE_WORKSPACE);
  const [createFolder] = useMutation(CREATE_FOLDER);
  const [createTable] = useMutation(CREATE_TABLE);
  const [createDashboard] = useMutation(CREATE_DASHBOARD);
  const [deleteItem] = useMutation(DELETE_ITEM);
  const [renameItem] = useMutation(RENAME_ITEM);
  const [copyTable] = useMutation(COPY_TABLE);
  const [copyDashboard] = useMutation(COPY_DASHBOARD);
  const [moveItem] = useMutation(MOVE_ITEM);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string>("");
  const [permissionOpen, setPermissionOpen] = useState(false);
  const [permissionTarget, setPermissionTarget] =
    useState<WorkspaceNode | null>(null);
  const [permissionMember, setPermissionMember] = useState<number | null>(null);
  const [permissionLevel, setPermissionLevel] = useState("read");
  const [searchQuery, setSearchQuery] = useState("");
  const [addPopoverOpen, setAddPopoverOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateCreateParentId, setTemplateCreateParentId] = useState<string | null>(null);
  const [goalWorkspaceOpen, setGoalWorkspaceOpen] = useState(false);
  const [goalWorkspaceParentId, setGoalWorkspaceParentId] = useState<string>("");
  const [inputModalOpen, setInputModalOpen] = useState(false);
  const [inputModalTitle, setInputModalTitle] = useState("");
  const [inputModalPlaceholder, setInputModalPlaceholder] = useState("");
  const [inputModalValue, setInputModalValue] = useState("");
  const [inputModalResolve, setInputModalResolve] = useState<
    ((value: string | null) => void) | null
  >(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalTitle, setConfirmModalTitle] = useState("");
  const [confirmModalContent, setConfirmModalContent] = useState("");
  const [confirmModalResolve, setConfirmModalResolve] = useState<
    ((value: boolean) => void) | null
  >(null);
  const workspaceBuckets = workspaceListData?.workspaces || {
    owned: [],
    invited: [],
  };
  const ownedWorkspaces = workspaceBuckets.owned || [];
  const invitedWorkspaces = workspaceBuckets.invited || [];
  const workspaces = [...ownedWorkspaces, ...invitedWorkspaces];
  const resolvedWorkspaceId = (() => {
    if (!workspaces.length) return workspaceId;
    if (workspaceId && workspaces.find((item) => item.id === workspaceId)) {
      return workspaceId;
    }
    return workspaces[0].id;
  })();
  const currentWorkspace =
    workspaces.find((item) => item.id === resolvedWorkspaceId) || workspaces[0];
  const currentWorkspaceName = currentWorkspace?.name || t("sidebar.tables");
  const collapsed = useSmartTableStore((state) => state.sidebarCollapsed);
  const sidebarWidth = useSmartTableStore((state) => state.sidebarWidth);
  const setSidebarWidth = useSmartTableStore((state) => state.setSidebarWidth);
  const setSidebarCollapsed = useSmartTableStore((state) => state.setSidebarCollapsed);
  const currentPermission = useSmartTableStore(
    (state) => state.currentPermission,
  );
  const canEdit = permissionAllows(currentPermission, "edit");
  const canManage = permissionAllows(currentPermission, "manage");
  const {
    data,
    refetch,
    loading: workspaceLoading,
    error: workspaceError,
  } = useQuery<{ workspace: { root: WorkspaceNode } }>(GET_WORKSPACE, {
    variables: { workspaceId: resolvedWorkspaceId || undefined },
    skip: !token || !resolvedWorkspaceId,
    fetchPolicy: "network-only",
  });
  const root = data?.workspace?.root;
  const rootId = root?.id || currentWorkspace?.rootId;
  const workspaceErrorNoticeRef = useRef("");
  const workspaceEmptyNoticeRef = useRef("");
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const showTreeLoading = workspaceLoading || !root;
  const showWorkspaceListLoading = workspaceListLoading;

  const effectiveSelectedKey = tableId || dashboardId || selectedKey || rootId || "";
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const effectiveExpandedKeys = useMemo(() => {
    if (searchQuery && root) {
      // When searching, expand all keys to show matching results
      const allKeys: string[] = [];
      const collectKeys = (node: WorkspaceNode) => {
        allKeys.push(node.id);
        if (node.children) {
          node.children.forEach(collectKeys);
        }
      };
      collectKeys(root);
      return allKeys;
    }
    return expandedKeys.length > 0
      ? expandedKeys
      : rootId
        ? [rootId]
        : [];
  }, [searchQuery, root, expandedKeys, rootId]);
  const effectiveMoveTarget = moveTarget || rootId || "fldRoot";
  const currentWorkspaceId = resolvedWorkspaceId || "";
  const { members, loading: workspaceMembersLoading } = useWorkspaceAccess(
    currentWorkspaceId || undefined,
  );
  const workspaceRole = useMemo(() => {
    if (!user) return null;
    const email = user.email?.toLowerCase();
    const matched = email
      ? members.find((member) => member.email?.toLowerCase() === email)
      : undefined;
    return matched?.role || null;
  }, [members, user]);
  const workspacePermission = useMemo(() => {
    if (workspaceRole === "owner") return "manage";
    if (workspaceRole === "editor") return "edit";
    if (workspaceRole === "viewer") return "read";
    return null;
  }, [workspaceRole]);
  const workspacePermissionReady =
    !workspaceMembersLoading && Boolean(workspacePermission);
  const workspaceCanEdit = workspacePermissionReady
    ? permissionAllows(workspacePermission, "edit")
    : true;
  const {
    data: itemAccessData,
    loading: itemAccessLoading,
    refetch: refetchItemAccess,
  } = useQuery<
    { itemAccess: ItemAccessEntry[] },
    { itemId: string; workspaceId?: string }
  >(ITEM_ACCESS, {
    variables: {
      itemId: permissionTarget?.id || "",
      workspaceId: currentWorkspaceId || undefined,
    },
    skip: !permissionOpen || !permissionTarget || !currentWorkspaceId,
    fetchPolicy: "network-only",
  });
  const [setItemPermission] = useMutation(SET_ITEM_PERMISSION);
  const [removeItemPermission] = useMutation(REMOVE_ITEM_PERMISSION);

  useEffect(() => {
    if (!resolvedWorkspaceId || resolvedWorkspaceId === workspaceId) return;
    setWorkspaceId(resolvedWorkspaceId);
  }, [resolvedWorkspaceId, setWorkspaceId, workspaceId]);

  useEffect(() => {
    const openWorkspaceManager = () => setWorkspaceDrawerOpen(true);
    window.addEventListener(WORKSPACE_MANAGER_OPEN_EVENT, openWorkspaceManager);
    return () =>
      window.removeEventListener(
        WORKSPACE_MANAGER_OPEN_EVENT,
        openWorkspaceManager,
      );
  }, []);

  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe(
      (state: AuthSnapshot, prevState: AuthSnapshot) => {
        if (state.token === prevState?.token) return;
        useWorkspaceNavigationStore.getState().resetWorkspaceId();
        setSelectedKey("");
        setExpandedKeys([]);
        setMoveTarget("");
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!workspaceListError) return;
    if (workspaceErrorNoticeRef.current !== "workspaces-error") {
      message.error(t("msg.workspaceListLoadFailed"));
      workspaceErrorNoticeRef.current = "workspaces-error";
    }
  }, [workspaceListError]);

  const handleShareWorkspace = async () => {
    if (workspacePermissionReady && !workspaceCanEdit) return;
    if (!currentWorkspaceId) return;
    const link = `${window.location.origin}/workspace/${currentWorkspaceId}`;
    try {
      await navigator.clipboard.writeText(link);
      message.success(t("msg.workspaceLinkCopied"));
    } catch {
      message.success(t("msg.workspaceLinkCopied"));
    }
  };

  const permissionOptions = useMemo(
    () => [
      {
        value: "manage",
        label: t("permission.canManage"),
        description:
          t("permission.canManage") + " - " + "拥有该文件的所有操作权限",
      },
      {
        value: "edit",
        label: t("permission.canEdit"),
        description:
          t("permission.canEdit") +
          " - " +
          "在「只可更新」基础上，还可以编辑和分享文件",
      },
      {
        value: "update",
        label: t("permission.canUpdate"),
        description:
          t("permission.canUpdate") +
          " - " +
          "在「只可阅读」基础上，还可以新增和编辑记录",
      },
      {
        value: "read",
        label: t("permission.canRead"),
        description:
          t("permission.canRead") + " - " + "只可查看该文件夹下的内容",
      },
    ],
    [],
  );
  const permissionSelectOptions = useMemo(
    () =>
      permissionOptions.map((option) => ({
        value: option.value,
        display: option.label,
        label: (
          <div style={{ whiteSpace: "pre-wrap" }}>
            <div style={{ fontSize: 13 }}>{option.label}</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              {option.description}
            </div>
          </div>
        ),
      })),
    [permissionOptions],
  );
  const permissionSelectOptionsWithRemove = useMemo(
    () => [
      ...permissionSelectOptions,
      {
        value: "remove",
        display: t("permission.removePermission"),
        label: (
          <span style={{ color: "#ef4444" }}>
            {t("permission.removePermission")}
          </span>
        ),
      },
    ],
    [permissionSelectOptions],
  );
  const itemAccessList = (itemAccessData?.itemAccess ?? []) as ItemAccessEntry[];
  const explicitAccessList = itemAccessList.filter((item) => !item.inherited);
  const workspaceAccessList = itemAccessList;
  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        value: member.userId,
        label: `${member.name} (${member.email})`,
      })),
    [members],
  );
  const roleTags: Record<string, string> = {
    owner: t("permission.owner"),
    editor: t("permission.editor"),
    viewer: t("permission.viewer"),
  };
  const handleOpenPermission = (node: WorkspaceNode) => {
    if (!canManage) return;
    setSelectedKey(node.id);
    setPermissionTarget(node);
    setPermissionMember(null);
    setPermissionLevel("read");
    setPermissionOpen(true);
  };
  const handleClosePermission = () => {
    setPermissionOpen(false);
    setPermissionTarget(null);
    setPermissionMember(null);
  };
  const handleAddPermission = async () => {
    if (!permissionTarget || permissionMember === null) return;
    try {
      await setItemPermission({
        variables: {
          itemId: permissionTarget.id,
          userId: permissionMember,
          permission: permissionLevel,
          workspaceId: currentWorkspaceId || undefined,
        },
      });
      await refetchItemAccess();
    } catch {
      message.error(t("msg.permissionSetFailed"));
    }
  };
  const handleUpdatePermission = async (
    userId: number,
    next: string,
    inherited?: boolean,
  ) => {
    if (!permissionTarget) return;
    if (next === "remove") {
      if (inherited) return;
      try {
        await removeItemPermission({
          variables: {
            itemId: permissionTarget.id,
            userId: userId,
            workspaceId: currentWorkspaceId || undefined,
          },
        });
        await refetchItemAccess();
      } catch {
        message.error(t("msg.removePermissionFailed"));
      }
      return;
    }
    try {
      await setItemPermission({
        variables: {
          itemId: permissionTarget.id,
          userId: userId,
          permission: next,
          workspaceId: currentWorkspaceId || undefined,
        },
      });
      await refetchItemAccess();
    } catch {
      message.error(t("msg.permissionSetFailed"));
    }
  };
  const renderAccessItem = (member: ItemAccessEntry) => (
    <List.Item
      key={member.userId}
      style={{ paddingInline: 0 }}
      extra={
        <div style={{ minWidth: 240 }}>
          <Select
            value={member.permission}
            onChange={(value) =>
              handleUpdatePermission(member.userId, value, member.inherited)
            }
            options={permissionSelectOptionsWithRemove}
            optionLabelProp="display"
            style={{ width: "100%" }}
          />
        </div>
      }
    >
      <List.Item.Meta
        avatar={
          <Avatar style={{ backgroundColor: "#6366f1" }}>
            {member.name.charAt(0).toUpperCase()}
          </Avatar>
        }
        title={
          <Space size={6}>
            <span>{member.name}</span>
            {member.role && (
              <Tag>{roleTags[member.role] || t("permission.editor")}</Tag>
            )}
            {member.inherited && (
              <Tag color="default">{t("permission.inherited")}</Tag>
            )}
          </Space>
        }
        description={member.email}
      />
    </List.Item>
  );

  useEffect(() => {
    if (!workspaceError) return;
    const key = `workspace-error-${resolvedWorkspaceId || "default"}`;
    if (workspaceErrorNoticeRef.current !== key) {
      message.error(t("msg.workspaceDataLoadFailed"));
      workspaceErrorNoticeRef.current = key;
    }
  }, [resolvedWorkspaceId, workspaceError]);

  useEffect(() => {
    if (workspaceListLoading || workspaceListError) return;
    if (workspaces.length > 0) return;
    if (workspaceEmptyNoticeRef.current !== "workspaces-empty") {
      message.warning(t("msg.noWorkspaceData"));
      workspaceEmptyNoticeRef.current = "workspaces-empty";
    }
  }, [workspaceListError, workspaceListLoading, workspaces.length]);

  useEffect(() => {
    if (!token || !resolvedWorkspaceId) return;
    if (workspaceLoading || workspaceError) return;
    if (root) return;
    const key = `workspace-empty-${resolvedWorkspaceId || "default"}`;
    if (workspaceEmptyNoticeRef.current !== key) {
      message.warning(t("msg.noDisplayData"));
      workspaceEmptyNoticeRef.current = key;
    }
  }, [resolvedWorkspaceId, root, token, workspaceError, workspaceLoading]);
  const renderTitle = (node: WorkspaceNode) => {
    const isTable = node.type === "table";
    const isDashboard = node.type === "dashboard";
    const isActive = effectiveSelectedKey === node.id;
    const canCreateTable = canEdit && node.type === "folder";
    const canRename = canManage;
    const canCopy = canEdit && (isTable || isDashboard);
    const canMove = canManage && (isTable || isDashboard);
    const canSetPermission = canManage;
    const canDelete = canManage;
    const hasActions =
      canCreateTable ||
      canRename ||
      canCopy ||
      canMove ||
      canSetPermission ||
      canDelete;
    const actions = (
      <div className="workspace-menu">
        {canCreateTable && (
          <div
            className="workspace-menu-item"
            onClick={(event) => {
              event.stopPropagation();
              createTableInParent(node.id);
            }}
          >
            <FileAddOutlined />
            <span>{t("action.newTable")}</span>
          </div>
        )}
        {canEdit && node.type === "folder" && (
          <div
            className="workspace-menu-item"
            onClick={(event) => {
              event.stopPropagation();
              createDashboardInParent(node.id);
            }}
          >
            <DashboardOutlined />
            <span>{t("sidebar.newDashboard")}</span>
          </div>
        )}
        {canRename && (
          <div
            className="workspace-menu-item"
            onClick={(event) => {
              event.stopPropagation();
              handleRename(node.id);
            }}
          >
            <EditOutlined />
            <span>{t("action.rename")}</span>
          </div>
        )}
        {canCopy && (
          <div
            className="workspace-menu-item"
            onClick={(event) => {
              event.stopPropagation();
              handleCopy(node.id);
            }}
          >
            <CopyOutlined />
            <span>{t("action.copy")}</span>
          </div>
        )}
        {canMove && (
          <div
            className="workspace-menu-item"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedKey(node.id);
              setMoveTarget(node.id);
              setMoveOpen(true);
            }}
          >
            <SwapOutlined />
            <span>{t("action.moveTo")}</span>
          </div>
        )}
        {canSetPermission && (
          <div
            className="workspace-menu-item"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenPermission(node);
            }}
          >
            <LockOutlined />
            <span>{t("action.setPermission")}</span>
          </div>
        )}
        {canDelete && (
          <div
            className="workspace-menu-item workspace-menu-item-danger"
            onClick={(event) => {
              event.stopPropagation();
              handleDelete(node.id);
            }}
          >
            <DeleteOutlined />
            <span>{t("action.delete")}</span>
          </div>
        )}
      </div>
    );
    return (
      <div
        className={`workspace-node${isActive ? " workspace-node-active" : ""}`}
      >
        <div className="workspace-node-main">
          <span className="workspace-node-icon">
            {node.type === "folder" ? (
              <FolderOutlined />
            ) : node.type === "dashboard" ? (
              <DashboardOutlined />
            ) : (
              <TableOutlined />
            )}
          </span>
          <span className="workspace-node-text">{node.name}</span>
        </div>
        {hasActions ? (
          <Popover placement="rightTop" trigger="click" content={actions}>
            <Button
              type="text"
              size="small"
              icon={<EllipsisOutlined />}
              className="workspace-actions"
              onClick={(event) => event.stopPropagation()}
            />
          </Popover>
        ) : null}
      </div>
    );
  };
  const showPrompt = (
    title: string,
    initialValue: string = "",
    placeholder: string = "",
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setInputModalTitle(title);
      setInputModalPlaceholder(placeholder || title);
      setInputModalValue(initialValue);
      setInputModalResolve(() => resolve);
      setInputModalOpen(true);
    });
  };

  const showConfirm = (title: string, content: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmModalTitle(title);
      setConfirmModalContent(content);
      setConfirmModalResolve(() => resolve);
      setConfirmModalOpen(true);
    });
  };

  const handleInputModalOk = () => {
    if (inputModalResolve) {
      inputModalResolve(inputModalValue);
    }
    setInputModalOpen(false);
  };

  const handleInputModalCancel = () => {
    if (inputModalResolve) {
      inputModalResolve(null);
    }
    setInputModalOpen(false);
  };

  const handleConfirmModalOk = () => {
    if (confirmModalResolve) {
      confirmModalResolve(true);
    }
    setConfirmModalOpen(false);
  };

  const handleConfirmModalCancel = () => {
    if (confirmModalResolve) {
      confirmModalResolve(false);
    }
    setConfirmModalOpen(false);
  };

  const createTableInParent = async (parentId: string, templateId?: string) => {
    if (workspacePermissionReady && !workspaceCanEdit) return;
    const name = await showPrompt(t("action.inputTableName"));
    if (!name) return;
    try {
      const res = await createTable({
        variables: {
          name,
          parentId,
          workspaceId: currentWorkspaceId || undefined,
          templateId: templateId || null,
        },
      });
      await refetch();
      const tbl = (res as unknown as { data?: { createTable?: WorkspaceNode } })
        .data?.createTable;
      if (tbl) {
        const savedView = getTableLastViewId(tbl.id);
        navigate(
          `/workbench/${tbl.id}/${savedView || tbl.defaultViewId || "v1"}`,
        );
      }
    } catch {
      message.error(t("msg.createTableFailed"));
    }
  };

  const createDashboardInParent = async (parentId: string) => {
    if (workspacePermissionReady && !workspaceCanEdit) return;
    const name = await showPrompt(t("sidebar.inputDashboardName"));
    if (!name) return;
    try {
      const res = await createDashboard({
        variables: { name, parentId, workspaceId: currentWorkspaceId || undefined },
      });
      await refetch();
      const dashboard = (res as unknown as { data?: { createDashboard?: WorkspaceNode } })
        .data?.createDashboard;
      if (dashboard) {
        navigate(`/workbench/${dashboard.id}`);
      }
    } catch {
      message.error(t("sidebar.createDashboardFailed"));
    }
  };

  const handleCreateFolder = async () => {
    if (workspacePermissionReady && !workspaceCanEdit) return;
    const name = await showPrompt(t("action.inputFolderName"));
    if (!name) return;
    try {
      const parentId = (() => {
        if (!root || !rootId) return "fldRoot";
        const current =
          findInWorkspace(root, effectiveSelectedKey) ||
          findInWorkspace(root, selectedKey);
        if (!current) return rootId;
        if (current.type === "folder") return current.id;
        const pid = findParentId(root, current.id);
        return pid || rootId;
      })();
      await createFolder({
        variables: {
          name,
          parentId,
          workspaceId: currentWorkspaceId || undefined,
        },
      });
      await refetch();
    } catch {
      message.error(t("msg.createFolderFailed"));
    }
  };

  const handleCreateDashboard = async () => {
    if (workspacePermissionReady && !workspaceCanEdit) return;
    const name = await showPrompt(t("sidebar.inputDashboardName"));
    if (!name) return;
    try {
      const parentId = (() => {
        if (!root || !rootId) return "fldRoot";
        const current =
          findInWorkspace(root, effectiveSelectedKey) ||
          findInWorkspace(root, selectedKey);
        if (!current) return rootId;
        if (current.type === "folder") return current.id;
        const pid = findParentId(root, current.id);
        return pid || rootId;
      })();
      const res = await createDashboard({
        variables: { name, parentId, workspaceId: currentWorkspaceId || undefined },
      });
      await refetch();
      const dashboard = (res as unknown as { data?: { createDashboard?: WorkspaceNode } })
        .data?.createDashboard;
      if (dashboard) navigate(`/workbench/${dashboard.id}`);
    } catch {
      message.error(t("sidebar.createDashboardFailed"));
    }
  };

  const getCurrentParentId = (): string => {
    if (!root || !rootId) return "fldRoot";
    const current =
      findInWorkspace(root, effectiveSelectedKey) ||
      findInWorkspace(root, selectedKey);
    if (!current) return rootId || "fldRoot";
    if (current.type === "folder") return current.id;
    const pid = findParentId(root, current.id);
    return pid || rootId || "fldRoot";
  };

  const handleOpenGoalWorkspace = () => {
    if (workspacePermissionReady && !workspaceCanEdit) return;
    setAddPopoverOpen(false);
    setGoalWorkspaceParentId(getCurrentParentId());
    setGoalWorkspaceOpen(true);
  };

  const handleCreateBlankTable = async () => {
    setAddPopoverOpen(false);
    const parentId = getCurrentParentId();
    await createTableInParent(parentId, "blank");
  };

  const handleOpenTemplateSelector = () => {
    setAddPopoverOpen(false);
    const parentId = getCurrentParentId();
    setTemplateCreateParentId(parentId);
    setTemplateModalOpen(true);
  };

  const handleTemplateSelect = async (templateId: string) => {
    if (templateCreateParentId) {
      await createTableInParent(templateCreateParentId, templateId);
    }
    setTemplateCreateParentId(null);
  };

  // Filter tree data based on search query
  const filterTreeBySearch = (query: string): WorkspaceNode | null => {
    if (!root) return null;
    if (!query.trim()) return root;

    const lowerQuery = query.toLowerCase();
    const filterNode = (node: WorkspaceNode): WorkspaceNode | null => {
      const nameMatch = node.name.toLowerCase().includes(lowerQuery);
      let filteredChildren: WorkspaceNode[] = [];
      if (node.children) {
        filteredChildren = node.children
          .map(filterNode)
          .filter((n): n is WorkspaceNode => n !== null);
      }
      if (nameMatch || filteredChildren.length > 0) {
        return {
          ...node,
          children: nameMatch
            ? (node.children || [])
            : filteredChildren,
        };
      }
      return null;
    };
    return filterNode(root);
  };

  const filteredRoot = searchQuery ? filterTreeBySearch(searchQuery) : root;
  const treeDataWithTitle = filteredRoot ? toTreeData(filteredRoot, renderTitle) : [];

  const handleDelete = async (itemId: string) => {
    if (!canManage) return;
    if (!itemId || itemId === rootId) return;

    // Get the node to determine if it's a folder or table
    const node = root ? findInWorkspace(root, itemId) : null;
    const isFolder = node?.type === "folder";
    const itemName = node?.name || "该项";

    const confirmMessage = isFolder
      ? t("action.confirmDeleteFolder").replace("{name}", itemName)
      : t("action.confirmDeleteTable").replace("{name}", itemName);

    const confirmed = await showConfirm(
      t("action.confirmDelete"),
      confirmMessage,
    );
    if (!confirmed) return;
    try {
      await deleteItem({
        variables: {
          itemId,
          workspaceId: currentWorkspaceId || undefined,
        },
      });
      await refetch();
      if (itemId === tableId) navigate("/");
    } catch {
      message.error(t("msg.deleteFailed"));
    }
  };

  const handleRename = async (itemId: string) => {
    if (!canManage) return;
    if (!itemId) return;

    // Get current name to prefill
    const node = root ? findInWorkspace(root, itemId) : null;
    const currentName = node?.name || "";

    const name = await showPrompt(t("action.inputNewName"), currentName);
    if (!name) return;
    try {
      await renameItem({
        variables: {
          itemId,
          name,
          workspaceId: currentWorkspaceId || undefined,
        },
      });
      await refetch();
    } catch {
      message.error(t("msg.renameFailed"));
    }
  };

  const handleCopy = async (itemId: string) => {
    if (!canEdit) return;
    if (!itemId || !root) return;
    const node = findInWorkspace(root, itemId);
    try {
      const res =
        node?.type === "dashboard"
          ? await copyDashboard({
              variables: {
                dashboardId: itemId,
                newParentId: rootId || "fldRoot",
                workspaceId: currentWorkspaceId || undefined,
              },
            })
          : await copyTable({
              variables: {
                tableId: itemId,
                newParentId: rootId || "fldRoot",
                workspaceId: currentWorkspaceId || undefined,
              },
            });
      await refetch();
      const copied =
        (res as unknown as { data?: { copyTable?: WorkspaceNode; copyDashboard?: WorkspaceNode } })
          .data?.copyTable ||
        (res as unknown as { data?: { copyTable?: WorkspaceNode; copyDashboard?: WorkspaceNode } })
          .data?.copyDashboard;
      if (copied?.type === "dashboard") {
        navigate(`/workbench/${copied.id}`);
        return;
      }
      if (copied?.type === "table") {
        const savedView = getTableLastViewId(copied.id);
        navigate(
          `/workbench/${copied.id}/${savedView || copied.defaultViewId || "v1"}`,
        );
      }
    } catch {
      message.error(t("msg.copyFailed"));
    }
  };

  const handleMove = async (itemId: string) => {
    if (!canManage) return;
    if (!itemId || itemId === rootId) return;
    try {
      await moveItem({
        variables: {
          itemId,
          newParentId: effectiveMoveTarget,
          workspaceId: currentWorkspaceId || undefined,
        },
      });
      await refetch();
      setMoveOpen(false);
    } catch {
      message.error(t("msg.moveFailed"));
    }
  };

  const onSelect = (
    _keys: React.Key[],
    info: { node: EventDataNode<DataNode> },
  ) => {
    const id = String(info.node.key);
    setSelectedKey(id);
    const target = root ? findInWorkspace(root, id) : null;
    if (target?.type === "dashboard") {
      navigate(`/workbench/${target.id}`);
      return;
    }
    if (target?.type === "table") {
      const savedView = getTableLastViewId(target.id);
      navigate(
        `/workbench/${target.id}/${savedView || target.defaultViewId || "v1"}`,
      );
    }
  };

  const folderOptions = useMemo(() => {
    if (!root) return [];
    const options: { value: string; label: string }[] = [
      { value: root.id, label: root.name },
    ];
    const walk = (node: WorkspaceNode, path: string[]) => {
      if (node.type === "folder") {
        const nextPath = [...path, node.name];
        options.push({ value: node.id, label: nextPath.join(" / ") });
        (node.children || []).forEach((child) => walk(child, nextPath));
      }
    };
    (root.children || []).forEach((child) => walk(child, []));
    return options;
  }, [root]);

  const handleWorkspaceSwitch = (nextId: string) => {
    if (nextId === currentWorkspaceId) {
      setWorkspaceDrawerOpen(false);
      return;
    }
    setWorkspaceId(nextId);
    setWorkspaceDrawerOpen(false);
  };

  const handleWorkspaceModal = (
    mode: "create" | "rename",
    target?: WorkspaceSummary,
  ) => {
    if (mode === "create" && !token) {
      message.error(t("msg.loginRequired"));
      navigate("/login");
      return;
    }
    setWorkspaceModalMode(mode);
    setWorkspaceTarget(target || null);
    setWorkspaceName(target?.name || "");
    setWorkspaceModalOpen(true);
  };

  const handleWorkspaceSubmit = async () => {
    const name = workspaceName.trim();
    if (!name) return;
    try {
      if (workspaceModalMode === "create") {
        const res = await createWorkspace({ variables: { name } });
        await refetchWorkspaces();
        const created = (
          res as unknown as { data?: { createWorkspace?: WorkspaceSummary } }
        ).data?.createWorkspace;
        if (created?.id) {
          setWorkspaceId(created.id);
        }
      } else if (workspaceTarget) {
        await renameWorkspace({
          variables: { workspaceId: workspaceTarget.id, name },
        });
        await refetchWorkspaces();
      }
      setWorkspaceModalOpen(false);
    } catch {
      message.error(t("msg.operationFailed"));
    }
  };

  const handleWorkspaceDelete = async (target: WorkspaceSummary) => {
    const confirmed = await showConfirm(
      t("action.confirmDeleteWorkspace"),
      t("action.confirmDeleteWorkspaceContent"),
    );
    if (!confirmed) return;
    try {
      await deleteWorkspace({ variables: { workspaceId: target.id } });
      await refetchWorkspaces();
      if (currentWorkspaceId === target.id) {
        const next = workspaces.find((item) => item.id !== target.id);
        if (next) {
          setWorkspaceId(next.id);
        } else {
          if (!token) {
            message.error(t("msg.loginRequired"));
            navigate("/login");
            return;
          }
          const res = await createWorkspace({
            variables: { name: t("sidebar.myWorkspace") },
          });
          await refetchWorkspaces();
          const created = (
            res as unknown as { data?: { createWorkspace?: WorkspaceSummary } }
          ).data?.createWorkspace;
          if (created?.id) {
            setWorkspaceId(created.id);
          }
        }
      }
    } catch {
      message.error(t("msg.deleteWorkspaceFailed"));
    }
  };

  const filteredWorkspaces = workspaceSearch
    ? ownedWorkspaces.filter((item) =>
        item.name.toLowerCase().includes(workspaceSearch.toLowerCase()),
      )
    : ownedWorkspaces;
  const filteredInvitedWorkspaces = workspaceSearch
    ? invitedWorkspaces.filter((item) =>
        item.name.toLowerCase().includes(workspaceSearch.toLowerCase()),
      )
    : invitedWorkspaces;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (collapsed) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth =
      sidebarRef.current?.getBoundingClientRect().width || sidebarWidth;
    let currentWidth = startWidth; // 视觉显示宽度（限制在120-500）
    let virtualWidth = startWidth; // 虚拟宽度（允许小于120，用于判断收起）
    let rafId: number | null = null;

    // 添加全局样式，防止拖拽时选中文本
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const deltaX = moveEvent.clientX - startX;
        // 虚拟宽度允许小于最小宽度
        virtualWidth = startWidth + deltaX;
        // 视觉显示宽度被限制在最小和最大宽度之间
        currentWidth = clampDragWidth(virtualWidth);
        if (sidebarRef.current) {
          const value = `${currentWidth}px`;
          sidebarRef.current.style.width = value;
          sidebarRef.current.style.minWidth = value;
          sidebarRef.current.style.maxWidth = value;
        }
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // 恢复样式
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // 如果虚拟宽度小于80则折叠侧边栏
      if (virtualWidth < 80) {
        setSidebarCollapsed(true);
      } else {
        setSidebarWidth(currentWidth);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  useEffect(() => {
    if (!sidebarRef.current || collapsed) return;
    const value = `${sidebarWidth}px`;
    sidebarRef.current.style.width = value;
    sidebarRef.current.style.minWidth = value;
    sidebarRef.current.style.maxWidth = value;
  }, [collapsed, sidebarWidth]);

  useEffect(() => {
    if (!root || !rootId) return;
    const mayResolveDefaultItem =
      location.pathname === "/tables" ||
      location.pathname === "/dashboards" ||
      location.pathname.startsWith("/workbench/");
    if (!mayResolveDefaultItem) return;
    if (tableId && findInWorkspace(root, tableId)) return;
    const desiredType: WorkspaceNode["type"] =
      location.pathname === "/dashboards" || tableId?.startsWith("dsb")
        ? "dashboard"
        : "table";
    const firstItem = (() => {
      const stack: WorkspaceNode[] = [...(root.children || [])];
      while (stack.length) {
        const node = stack.shift();
        if (!node) continue;
        if (node.type === desiredType) return node;
        if (node.children) stack.push(...node.children);
      }
      return undefined;
    })();
    if (!firstItem) return;
    if (firstItem.type === "dashboard") {
      navigate(`/workbench/${firstItem.id}`);
      return;
    }
    const savedView = getTableLastViewId(firstItem.id);
    navigate(
      `/workbench/${firstItem.id}/${savedView || firstItem.defaultViewId || "v1"}`,
    );
  }, [location.pathname, root, rootId, tableId, navigate]);

  return (
    <>
      <div
        ref={sidebarRef}
        style={{
          width: collapsed ? 0 : sidebarWidth,
          minWidth: collapsed ? 0 : sidebarWidth,
          maxWidth: collapsed ? 0 : sidebarWidth,
          borderRight: "none",
          display: collapsed ? "none" : "flex",
          flexDirection: "column",
          transition: collapsed
            ? "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
            : "none",
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {!collapsed && (
          <>
            <div className="qtable-context-sidebar-heading">
              <div style={{ minWidth: 0 }}>
                <Typography.Text strong className="qtable-context-sidebar-title">
                  工作区内容
                </Typography.Text>
                <Typography.Text
                  type="secondary"
                  className="qtable-context-sidebar-subtitle"
                  ellipsis
                >
                  {currentWorkspaceName}
                </Typography.Text>
              </div>
              <Tooltip title="管理工作区">
                <Button
                  type="text"
                  size="small"
                  aria-label="管理工作区"
                  icon={<SwapOutlined />}
                  onClick={() => setWorkspaceDrawerOpen(true)}
                />
              </Tooltip>
            </div>
            <div style={{ padding: "0 24px 8px 12px", overflowX: "hidden" }}>
              <div style={{ overflowX: "hidden", display: "flex", gap: 6, alignItems: "center" }}>
                <Input
                  size="small"
                  placeholder={t("sidebar.searchTables")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  allowClear
                  prefix={<SearchOutlined style={{ color: "#9ca3af" }} />}
                  style={{
                    flex: 1,
                    borderRadius: 0,
                    background: "#fff",
                    border: "none",
                    borderBottom: "1px solid #e5e7eb",
                    boxShadow: "none",
                    padding: 0,
                  }}
                />
                <Dropdown
                  open={addPopoverOpen}
                  onOpenChange={setAddPopoverOpen}
                  trigger={["click"]}
                  placement="bottomRight"
                  menu={{
                    items: [
                      {
                        key: "goal-project",
                        label: (
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>
                              {t("sidebar.goalProject")}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "#9ca3af",
                                lineHeight: 1.3,
                                maxWidth: 260,
                              }}
                            >
                              {t("sidebar.goalProjectDesc")}
                            </div>
                          </div>
                        ),
                        icon: <RobotOutlined style={{ color: "#2563eb" }} />,
                        onClick: handleOpenGoalWorkspace,
                      },
                      {
                        type: "divider",
                      },
                      {
                        key: "new-table",
                        label: t("sidebar.newTablePopover"),
                        icon: <FileAddOutlined />,
                        children: [
                          {
                            key: "blank",
                            label: (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>
                                  {t("sidebar.blankTable")}
                                </div>
                                <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.3 }}>
                                  {t("sidebar.blankTableDesc")}
                                </div>
                              </div>
                            ),
                            icon: <FileTextOutlined />,
                            onClick: handleCreateBlankTable,
                          },
                          {
                            key: "template",
                            label: (
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 500 }}>
                                  {t("sidebar.fromTemplate")}
                                </div>
                                <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.3 }}>
                                  {t("sidebar.fromTemplateDesc")}
                                </div>
                              </div>
                            ),
                            icon: <AppstoreAddOutlined />,
                            onClick: handleOpenTemplateSelector,
                          },
                        ],
                      },
                      {
                        key: "new-dashboard",
                        label: t("sidebar.newDashboardPopover"),
                        icon: <DashboardOutlined />,
                        onClick: () => {
                          setAddPopoverOpen(false);
                          handleCreateDashboard();
                        },
                      },
                      {
                        key: "new-folder",
                        label: t("sidebar.newFolderPopover"),
                        icon: <FolderAddOutlined />,
                        onClick: () => {
                          setAddPopoverOpen(false);
                          handleCreateFolder();
                        },
                      },
                    ],
                  }}
                >
                  <Button
                    icon={<PlusOutlined />}
                    disabled={workspacePermissionReady && !workspaceCanEdit}
                    type="text"
                    size="small"
                    style={{
                      borderRadius: 20,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    
                  </Button>
                </Dropdown>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 12px 8px 8px" }}>
              {showTreeLoading ? (
                <div style={{ padding: 8 }}>
                  <Skeleton
                    active
                    title={false}
                    paragraph={{ rows: 6, width: "100%" }}
                  />
                </div>
              ) : (
                <Tree
                  showIcon={false}
                  treeData={treeDataWithTitle}
                  expandedKeys={effectiveExpandedKeys}
                  onExpand={(keys) => setExpandedKeys(keys as string[])}
                  blockNode
                  selectedKeys={[effectiveSelectedKey]}
                  onSelect={onSelect}
                  className="workspace-tree"
                />
              )}
            </div>
            <div className="workspace-sidebar-divider" />
            <div className="workspace-bottom-actions" style={{ overflowX: "hidden", padding: "8px 12px" }}>
              <Space size={2} wrap>
                <Button
                  size="small"
                  type="text"
                  icon={<TeamOutlined />}
                  disabled={workspacePermissionReady && !workspaceCanEdit}
                  onClick={() => {
                    if (workspacePermissionReady && !workspaceCanEdit) return;
                    if (currentWorkspaceId) {
                      navigate(`/workspace/${currentWorkspaceId}`);
                    }
                  }}
                >
                  {t("sidebar.memberManagement")}
                </Button>
                <Button
                  size="small"
                  type="text"
                  icon={<ShareAltOutlined />}
                  disabled={workspacePermissionReady && !workspaceCanEdit}
                  onClick={handleShareWorkspace}
                >
                  {t("sidebar.shareWorkspace")}
                </Button>
              </Space>
            </div>
          </>
        )}
        {/* Resize handle */}
        {!collapsed && (
          <div
            onMouseDown={handleMouseDown}
            onDoubleClick={() => setSidebarWidth(260)}
            className={`resize-handle${isResizing ? " resizing" : ""}`}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 12,
              cursor: "col-resize",
              zIndex: 10,
            }}
          />
        )}
      </div>
      {/* Modals and Drawers */}
      <Modal
        open={moveOpen}
        title={t("sidebar.moveTo")}
        onCancel={() => setMoveOpen(false)}
        onOk={() => handleMove(selectedKey)}
        okText={t("sidebar.confirm")}
        cancelText={t("sidebar.cancel")}
      >
        <Select
          style={{ width: "100%" }}
          value={effectiveMoveTarget}
          onChange={(value) => setMoveTarget(value)}
          options={folderOptions}
        />
      </Modal>
      <Modal
        open={permissionOpen}
        title={`${t("sidebar.setPermission")}${permissionTarget ? ` - ${permissionTarget.name}` : ""}`}
        onCancel={handleClosePermission}
        footer={null}
        width={720}
      >
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <div>
            <Typography.Text strong>
              {t("permission.manualAdd")}
            </Typography.Text>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {t("permission.manualAddDesc")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Select
              style={{ flex: 1 }}
              placeholder={t("permission.addMemberPlaceholder")}
              value={permissionMember ?? undefined}
              onChange={(value) => setPermissionMember(value)}
              options={memberOptions}
            />
            <Select
              style={{ width: 180 }}
              value={permissionLevel}
              onChange={(value) => setPermissionLevel(value)}
              options={permissionSelectOptions}
              optionLabelProp="display"
            />
            <Button type="primary" onClick={handleAddPermission}>
              {t("permission.add")}
            </Button>
          </div>
          {explicitAccessList.length === 0 ? (
            <Typography.Text type="secondary">
              {t("permission.noManualMembers")}
            </Typography.Text>
          ) : (
            <List
              loading={itemAccessLoading}
              dataSource={explicitAccessList}
              renderItem={renderAccessItem}
            />
          )}
          <Divider style={{ margin: "8px 0" }} />
          <div>
            <Typography.Text strong>
              {t("permission.workspaceMembers")}
            </Typography.Text>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {t("permission.workspaceMembersDesc").replace(
                "{count}",
                String(workspaceAccessList.length),
              )}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {t("permission.allMembersAccess")}
          </div>
          <List
            loading={itemAccessLoading}
            dataSource={workspaceAccessList}
            renderItem={renderAccessItem}
          />
        </Space>
      </Modal>
      <Drawer
        open={workspaceDrawerOpen}
        placement="left"
        size="default"
        title={t("sidebar.workspaceList")}
        onClose={() => setWorkspaceDrawerOpen(false)}
      >
        <Tabs
          items={[
            {
              key: "owned",
              label: `${t("sidebar.managedWorkspaces")}(${ownedWorkspaces.length})`,
              children: (
                <div className="workspace-drawer">
                  <Input
                    placeholder={t("sidebar.search")}
                    value={workspaceSearch}
                    onChange={(event) => setWorkspaceSearch(event.target.value)}
                    prefix={<SearchOutlined />}
                  />
                  {showWorkspaceListLoading ? (
                    <div style={{ padding: "4px 0" }}>
                      <Skeleton
                        active
                        title={false}
                        paragraph={{ rows: 4, width: "100%" }}
                      />
                    </div>
                  ) : (
                    <div className="workspace-list">
                      {filteredWorkspaces.map((item) => {
                        const isActive = item.id === currentWorkspaceId;
                        return (
                          <div
                            key={item.id}
                            className={`workspace-list-item${
                              isActive ? " active" : ""
                            }`}
                            onClick={() => handleWorkspaceSwitch(item.id)}
                          >
                            <span className="workspace-avatar">
                              {item.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="workspace-name">{item.name}</span>
                            <span className="workspace-list-actions">
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleWorkspaceModal("rename", item);
                                }}
                              />
                              <Button
                                type="text"
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleWorkspaceDelete(item);
                                }}
                              />
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={() => handleWorkspaceModal("create")}
                    disabled={!token}
                    block
                  >
                    {t("sidebar.newWorkspace")}
                  </Button>
                </div>
              ),
            },
            {
              key: "invited",
              label: `${t("sidebar.invitedWorkspaces")}(${invitedWorkspaces.length})`,
              children: (
                <div className="workspace-drawer">
                  <Input
                    placeholder={t("sidebar.search")}
                    value={workspaceSearch}
                    onChange={(event) => setWorkspaceSearch(event.target.value)}
                    prefix={<SearchOutlined />}
                  />
                  {showWorkspaceListLoading ? (
                    <div style={{ padding: "4px 0" }}>
                      <Skeleton
                        active
                        title={false}
                        paragraph={{ rows: 4, width: "100%" }}
                      />
                    </div>
                  ) : filteredInvitedWorkspaces.length === 0 ? (
                    <div className="workspace-empty">
                      {t("sidebar.noWorkspaces")}
                    </div>
                  ) : (
                    <div className="workspace-list">
                      {filteredInvitedWorkspaces.map((item) => {
                        const isActive = item.id === currentWorkspaceId;
                        return (
                          <div
                            key={item.id}
                            className={`workspace-list-item${
                              isActive ? " active" : ""
                            }`}
                            onClick={() => handleWorkspaceSwitch(item.id)}
                          >
                            <span className="workspace-avatar">
                              {item.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="workspace-name">{item.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Drawer>
      <Modal
        open={workspaceModalOpen}
        title={
          workspaceModalMode === "create"
            ? t("sidebar.newWorkspace")
            : t("sidebar.renameWorkspace")
        }
        onCancel={() => setWorkspaceModalOpen(false)}
        onOk={handleWorkspaceSubmit}
        okText={t("sidebar.confirm")}
        cancelText={t("sidebar.cancel")}
      >
        <Input
          value={workspaceName}
          onChange={(event) => setWorkspaceName(event.target.value)}
          placeholder={t("sidebar.search")}
        />
      </Modal>
      <Modal
        open={inputModalOpen}
        title={inputModalTitle}
        onCancel={handleInputModalCancel}
        onOk={handleInputModalOk}
        okText={t("common.ok")}
        cancelText={t("common.cancel")}
        zIndex={1100}
        destroyOnClose
      >
        <Input
          value={inputModalValue}
          onChange={(event) => setInputModalValue(event.target.value)}
          onPressEnter={handleInputModalOk}
          placeholder={inputModalPlaceholder || t("common.inputPlaceholder")}
          allowClear
          autoFocus
          onFocus={(e) => e.target.select()}
        />
      </Modal>
      <Modal
        open={confirmModalOpen}
        title={confirmModalTitle}
        onCancel={handleConfirmModalCancel}
        onOk={handleConfirmModalOk}
        okText={t("common.ok")}
        cancelText={t("common.cancel")}
        zIndex={1100}
      >
        <p>{confirmModalContent}</p>
      </Modal>
      <GoalWorkspaceModal
        open={goalWorkspaceOpen}
        workspaceId={currentWorkspaceId}
        parentId={goalWorkspaceParentId || rootId || ""}
        onClose={() => {
          setGoalWorkspaceOpen(false);
          setGoalWorkspaceParentId("");
        }}
        onCreated={() => {
          void refetch();
        }}
      />

      <TemplateSelector
        open={templateModalOpen}
        workspaceId={currentWorkspaceId || undefined}
        onClose={() => setTemplateModalOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </>
  );
}
