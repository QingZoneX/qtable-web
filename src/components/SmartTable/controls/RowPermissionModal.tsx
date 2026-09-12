import {
  Alert,
  Divider,
  Modal,
  Radio,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@apollo/client/react";
import {
  ROW_PERMISSION_POLICY,
  UPDATE_ROW_PERMISSION_POLICY,
} from "../../../lib/graphql";
import { t } from "../../../lib/i18n";
import type { Field } from "../../../store/useSmartTableStore";

const { Text, Title } = Typography;

export type RowPermissionMode = "all" | "creator" | "member_field";

export type RowPermissionPolicy = {
  mode: RowPermissionMode;
  memberFieldId?: string | null;
  enabled?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  tableId?: string | null;
  fields: Field[];
  canManage: boolean;
};

const normalizePolicy = (value: unknown): RowPermissionPolicy => {
  if (!value || typeof value !== "object") {
    return { mode: "all", memberFieldId: null, enabled: false };
  }
  const candidate = value as {
    mode?: unknown;
    memberFieldId?: unknown;
    enabled?: unknown;
  };
  const mode: RowPermissionMode =
    candidate.mode === "creator" || candidate.mode === "member_field"
      ? candidate.mode
      : "all";
  return {
    mode,
    memberFieldId:
      typeof candidate.memberFieldId === "string"
        ? candidate.memberFieldId
        : null,
    enabled:
      typeof candidate.enabled === "boolean"
        ? candidate.enabled
        : mode !== "all",
  };
};

const errorText = (error: unknown) => {
  if (error && typeof error === "object") {
    const candidate = error as {
      message?: string;
      graphQLErrors?: Array<{ message?: string }>;
    };
    return (
      candidate.graphQLErrors?.[0]?.message ||
      candidate.message ||
      t("rowPermission.saveFailed")
    );
  }
  return t("rowPermission.saveFailed");
};

const MODE_OPTIONS: Array<{
  mode: RowPermissionMode;
  icon: ReactNode;
  titleKey: string;
  descriptionKey: string;
}> = [
  {
    mode: "all",
    icon: <GlobalOutlined />,
    titleKey: "rowPermission.modeAll",
    descriptionKey: "rowPermission.modeAllDesc",
  },
  {
    mode: "creator",
    icon: <UserOutlined />,
    titleKey: "rowPermission.modeCreator",
    descriptionKey: "rowPermission.modeCreatorDesc",
  },
  {
    mode: "member_field",
    icon: <TeamOutlined />,
    titleKey: "rowPermission.modeMember",
    descriptionKey: "rowPermission.modeMemberDesc",
  },
];

export function RowPermissionModal({
  open,
  onClose,
  tableId,
  fields,
  canManage,
}: Props) {
  const memberFields = useMemo(
    () => fields.filter((field) => field.type === "member"),
    [fields],
  );
  const { data, loading, error, refetch } = useQuery<{
    rowPermissionPolicy?: unknown;
  }>(ROW_PERMISSION_POLICY, {
    variables: { tableId: tableId || undefined },
    skip: !open || !tableId,
    fetchPolicy: "network-only",
  });
  const [savePolicy, { loading: saving }] = useMutation(
    UPDATE_ROW_PERMISSION_POLICY,
  );

  const [mode, setMode] = useState<RowPermissionMode>("all");
  const [memberFieldId, setMemberFieldId] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setMode("all");
    setMemberFieldId(undefined);
  }, [open, tableId]);

  useEffect(() => {
    if (!open || loading || !data) return;
    const policy = normalizePolicy(data?.rowPermissionPolicy);
    setMode(policy.mode);
    setMemberFieldId(policy.memberFieldId || undefined);
  }, [data, data?.rowPermissionPolicy, loading, open]);

  const currentPolicy = normalizePolicy(data?.rowPermissionPolicy);
  const missingConfiguredMemberField =
    currentPolicy.mode === "member_field" &&
    Boolean(currentPolicy.memberFieldId) &&
    !memberFields.some((field) => field.id === currentPolicy.memberFieldId);

  const handleSave = async () => {
    if (!tableId || !canManage) return;
    if (mode === "member_field" && !memberFieldId) {
      message.warning(t("rowPermission.selectMemberField"));
      return;
    }
    try {
      await savePolicy({
        variables: {
          tableId,
          mode,
          memberFieldId: mode === "member_field" ? memberFieldId : null,
        },
      });
      await refetch();
      message.success(t("rowPermission.saved"));
      onClose();
    } catch (saveError) {
      message.error(errorText(saveError));
    }
  };

  return (
    <Modal
      open={open}
      width={600}
      title={
        <Space size={9}>
          <SafetyCertificateOutlined style={{ color: "#3157C8" }} />
          <span>{t("rowPermission.title")}</span>
        </Space>
      }
      onCancel={onClose}
      onOk={handleSave}
      confirmLoading={saving}
      okText={t("rowPermission.save")}
      cancelText={canManage ? t("rowPermission.cancel") : t("rowPermission.close")}
      okButtonProps={
        canManage
          ? { disabled: !tableId || loading || Boolean(error) }
          : { style: { display: "none" } }
      }
      styles={{
        body: {
          paddingTop: 8,
          maxHeight: "70vh",
          overflowY: "auto",
        },
      }}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 7 }} />
      ) : (
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          {error ? (
            <Alert
              type="error"
              showIcon
              message={t("rowPermission.loadFailed")}
              description={error.message}
            />
          ) : null}

          <div
            style={{
              padding: "12px 14px",
              border: "1px solid #EAECF0",
              borderRadius: 8,
              background: "#FAFBFC",
            }}
          >
            <Space
              align="start"
              style={{ width: "100%", justifyContent: "space-between" }}
            >
              <div>
                <Title level={5} style={{ margin: 0, fontSize: 14 }}>
                  {t("rowPermission.sectionTitle")}
                </Title>
                <Text
                  type="secondary"
                  style={{ display: "block", marginTop: 4, fontSize: 12 }}
                >
                  {t("rowPermission.sectionDesc")}
                </Text>
              </div>
              <Tag color={currentPolicy.enabled ? "blue" : "default"}>
                {currentPolicy.enabled
                  ? t("rowPermission.enabled")
                  : t("rowPermission.disabled")}
              </Tag>
            </Space>
          </div>

          {!canManage ? (
            <Alert
              type="info"
              showIcon
              message={t("rowPermission.readOnly")}
              description={t("rowPermission.readOnlyDesc")}
            />
          ) : null}

          <Radio.Group
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as RowPermissionMode)
            }
            style={{ width: "100%" }}
          >
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {MODE_OPTIONS.map((option) => {
                const noMemberFields =
                  option.mode === "member_field" && memberFields.length === 0;
                const disabled = !canManage || noMemberFields;
                const selected = mode === option.mode;
                return (
                  <div
                    key={option.mode}
                    onClick={() => {
                      if (!disabled) setMode(option.mode);
                    }}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "11px 12px",
                      border: selected
                        ? "1px solid #8BA8F8"
                        : "1px solid #EAECF0",
                      borderRadius: 8,
                      background: selected ? "#F5F8FF" : "#FFFFFF",
                      cursor: disabled ? "default" : "pointer",
                      opacity: disabled && !selected ? 0.62 : 1,
                      transition: "border-color 120ms ease, background 120ms ease",
                    }}
                  >
                    <Radio
                      value={option.mode}
                      disabled={disabled}
                      style={{ marginTop: 1 }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Space size={7}>
                        <span
                          style={{
                            width: 24,
                            height: 24,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 6,
                            background: selected ? "#E8EFFF" : "#F3F4F6",
                            color: selected ? "#3157C8" : "#667085",
                          }}
                        >
                          {option.icon}
                        </span>
                        <Text strong style={{ fontSize: 13 }}>
                          {t(option.titleKey)}
                        </Text>
                      </Space>
                      <Text
                        type="secondary"
                        style={{
                          display: "block",
                          marginTop: 5,
                          fontSize: 12,
                          lineHeight: 1.55,
                        }}
                      >
                        {t(option.descriptionKey)}
                      </Text>
                    </div>
                  </div>
                );
              })}
            </Space>
          </Radio.Group>

          {mode === "member_field" ? (
            <div
              style={{
                padding: "12px 14px",
                border: "1px solid #EAECF0",
                borderRadius: 8,
                background: "#FFFFFF",
              }}
            >
              <Text strong style={{ display: "block", fontSize: 12 }}>
                {t("rowPermission.memberFieldLabel")}
              </Text>
              <Select
                value={memberFieldId}
                disabled={!canManage || memberFields.length === 0}
                onChange={(value: string) => setMemberFieldId(value)}
                placeholder={t("rowPermission.memberFieldPlaceholder")}
                options={memberFields.map((field) => ({
                  label: field.name,
                  value: field.id,
                }))}
                style={{ width: "100%", marginTop: 8 }}
                showSearch
                optionFilterProp="label"
              />
              {memberFields.length === 0 ? (
                <Text
                  type="warning"
                  style={{ display: "block", marginTop: 7, fontSize: 12 }}
                >
                  {t("rowPermission.noMemberField")}
                </Text>
              ) : null}
              {missingConfiguredMemberField ? (
                <Alert
                  style={{ marginTop: 9 }}
                  type="warning"
                  showIcon
                  message={t("rowPermission.staleMemberField")}
                />
              ) : null}
            </div>
          ) : null}

          {mode === "creator" ? (
            <Alert
              type="warning"
              showIcon
              message={t("rowPermission.creatorLegacyWarning")}
            />
          ) : null}

          <Alert
            type="info"
            showIcon
            message={t("rowPermission.managerRule")}
            description={t("rowPermission.managerRuleDesc")}
          />

          <Divider style={{ margin: "0" }} />

          <div>
            <Text strong style={{ fontSize: 12 }}>
              {t("rowPermission.tablePermissionTitle")}
            </Text>
            <Text
              type="secondary"
              style={{ display: "block", marginTop: 4, fontSize: 12 }}
            >
              {t("rowPermission.tablePermissionDesc")}
            </Text>
          </div>
        </Space>
      )}
    </Modal>
  );
}
