import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Avatar,
  Button,
  Input,
  List,
  Modal,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { useMutation } from "@apollo/client/react";
import { LeftOutlined } from "@ant-design/icons";
import { LEAVE_WORKSPACE } from "../lib/graphql";
import { INVITE_USER_TO_WORKSPACE_SAFE } from "../lib/workspaceInviteGraphql";
import { useLanguage } from "../lib/useLanguage";
import { useAuthStore } from "../store/authStore";
import {
  useWorkspaceAccess,
  type WorkspaceMember,
} from "../hooks/useWorkspaceAccess";
import { copyTextToClipboard } from "./SmartTable/utils/clipboard";
import { t } from "../lib/i18nRuntime";
import { workspaceMembersT } from "./workspaceMembersI18n";

const roleLabels = () => ({
  owner: workspaceMembersT("roleOwner"),
  editor: workspaceMembersT("roleEditor"),
  viewer: workspaceMembersT("roleViewer"),
});

export function WorkspaceMembersPage() {
  useLanguage();
  const navigate = useNavigate();
  const params = useParams();
  const workspaceId = params.id || params.workspaceId;
  const { token, user } = useAuthStore();
  const { loading, members, accessDenied, error, refetch } =
    useWorkspaceAccess(workspaceId);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteUser, { loading: inviting }] = useMutation<
    { inviteUserToWorkspace: WorkspaceMember },
    { email: string; workspaceId: string; role: string }
  >(INVITE_USER_TO_WORKSPACE_SAFE);
  const [leaveWorkspace, { loading: leaving }] = useMutation(LEAVE_WORKSPACE);

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (accessDenied) {
      navigate("/unauthorized", { replace: true });
    }
  }, [accessDenied, navigate]);

  useEffect(() => {
    if (error && !accessDenied) {
      message.error(error.message);
    }
  }, [error, accessDenied]);

  const title = useMemo(
    () => workspaceMembersT("title", { count: members.length }),
    [members.length],
  );
  const currentRole = members.find(
    (member) => member.email === user?.email,
  )?.role;
  const isOwner = currentRole === "owner";

  const handleInvite = async () => {
    if (!inviteEmail || !workspaceId) return;
    try {
      await inviteUser({
        variables: {
          email: inviteEmail,
          workspaceId: workspaceId,
          role: inviteRole,
        },
      });
      message.success(workspaceMembersT("inviteSent"));
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("viewer");
      await refetch();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : workspaceMembersT("inviteFailed");
      message.error(errorMessage);
    }
  };

  const confirmLeave = () => {
    if (!workspaceId) return;
    Modal.confirm({
      title: t("workspace.leaveTitle"),
      content: t("workspace.leaveContent"),
      okText: t("common.leave"),
      cancelText: t("common.cancel"),
      okButtonProps: { danger: true, loading: leaving },
      onOk: async () => {
        await leaveWorkspace({ variables: { workspaceId: workspaceId } });
        message.success(t("workspace.left"));
        navigate("/", { replace: true });
      },
    });
  };

  const handleShare = async () => {
    if (!workspaceId) return;
    const link = `${window.location.origin}/workspace/${workspaceId}`;
    const result = await copyTextToClipboard(link);
    if (result.ok) {
      message.success(workspaceMembersT("shareCopied"));
      return;
    }
    message.error(result.error);
  };

  const labels = roleLabels();

  return (
    <div style={{ padding: "24px 32px" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Space size={8} align="center" style={{ marginBottom: 4 }}>
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={() => navigate(-1)}
            />
            <Typography.Title level={3} style={{ marginBottom: 0 }}>
              {title}
            </Typography.Title>
          </Space>
          <Typography.Text type="secondary">
            {workspaceMembersT("subtitle")}
          </Typography.Text>
        </div>
        <Space>
          <Button onClick={handleShare}>{workspaceMembersT("share")}</Button>
          <Button
            onClick={() => setInviteOpen(true)}
            type="primary"
            disabled={!isOwner}
          >
            {workspaceMembersT("invite")}
          </Button>
          <Button danger onClick={confirmLeave}>
            {workspaceMembersT("leaveWorkspace")}
          </Button>
        </Space>
      </Space>

      <div style={{ marginTop: 24 }}>
        <List
          loading={loading}
          dataSource={members}
          renderItem={(member: WorkspaceMember) => {
            const displayName = member.name || member.email;
            const initial = displayName?.[0]?.toUpperCase() || "?";
            const isSelf = user?.email && user.email === member.email;
            const roleKey = member.role ?? "viewer";
            return (
              <List.Item
                actions={[
                  isSelf ? (
                    <Button danger type="link" onClick={confirmLeave}>
                      {workspaceMembersT("leave")}
                    </Button>
                  ) : (
                    <Button type="link" disabled>
                      {workspaceMembersT("noAction")}
                    </Button>
                  ),
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar>{initial}</Avatar>}
                  title={
                    <Space>
                      <span>{displayName}</span>
                      {isSelf ? (
                        <Typography.Text type="secondary">{workspaceMembersT("me")}</Typography.Text>
                      ) : null}
                    </Space>
                  }
                  description={member.email}
                />
                <Typography.Text>
                  {labels[roleKey as keyof typeof labels] || roleKey}
                </Typography.Text>
              </List.Item>
            );
          }}
        />
      </div>

      <Modal
        title={workspaceMembersT("invite")}
        open={inviteOpen}
        onCancel={() => setInviteOpen(false)}
        onOk={handleInvite}
        okText={t("common.sendInvite")}
        cancelText={t("common.cancel")}
        confirmLoading={inviting}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            placeholder={workspaceMembersT("emailPlaceholder")}
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select
            value={inviteRole}
            onChange={(value) => setInviteRole(value)}
            options={[
              { value: "viewer", label: labels.viewer },
              { value: "editor", label: labels.editor },
              { value: "owner", label: labels.owner },
            ]}
          />
        </Space>
      </Modal>
    </div>
  );
}

export default WorkspaceMembersPage;
