import { Button, Divider, Drawer, Select, Space, Switch, Typography, message } from "antd";
import { useMemo, useState } from "react";
import { t } from "../../../../lib/i18nRuntime";
import { useLanguage } from "../../../../lib/useLanguage";
import type { Field } from "../../../../store/useSmartTableStore";
import { FieldTypeIcon } from "../../FieldTypeIcon";
import type { TaskProfileConfig } from "../../../TaskProfile/taskProfile";
import type { BoardConfig } from "./types";

const { Text, Title } = Typography;
const MAX_CARD_FIELDS = 6;

type EditorProps = {
  fields: Field[];
  profile: TaskProfileConfig;
  config: BoardConfig;
  canEdit: boolean;
  onClose: () => void;
  onSave: (config: BoardConfig) => Promise<unknown>;
};

function BoardSettingsEditor({
  fields,
  profile,
  config,
  canEdit,
  onClose,
  onSave,
}: EditorProps) {
  const [laneFieldId, setLaneFieldId] = useState<string | null>(config.laneFieldId);
  const [cardFieldIds, setCardFieldIds] = useState<string[]>(
    config.cardFieldIds.slice(0, MAX_CARD_FIELDS),
  );
  const [hideCompleted, setHideCompleted] = useState(config.hideCompleted);
  const [saving, setSaving] = useState(false);

  const laneFields = useMemo(
    () =>
      fields.filter(
        (field) =>
          field.type === "select" ||
          (field.type === "member" && !field.property?.multiple),
      ),
    [fields],
  );
  const cardFields = useMemo(
    () =>
      fields.filter(
        (field) => !["attachment", "image"].includes(String(field.type)),
      ),
    [fields],
  );

  const assigneeAvailable = Boolean(
    profile.assigneeFieldId &&
      laneFields.some((field) => field.id === profile.assigneeFieldId),
  );

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        ...config,
        groupFieldId: profile.statusFieldId || config.groupFieldId,
        laneFieldId,
        cardFieldIds: cardFieldIds.slice(0, MAX_CARD_FIELDS),
        hideCompleted,
      });
      message.success(t("kanban.saved"));
      onClose();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : t("kanban.saveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="q-kanban-settings__body">
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          {!canEdit ? (
            <Text type="secondary">{t("kanban.readonlyDrawer")}</Text>
          ) : null}
          <section>
            <Title level={5}>{t("kanban.laneField")}</Title>
            <Text type="secondary">{t("kanban.laneFieldHelp")}</Text>
            <div className="q-kanban-settings__control">
              <Select
                allowClear
                disabled={!canEdit}
                value={laneFieldId || undefined}
                placeholder={t("kanban.noLaneGrouping")}
                style={{ width: "100%" }}
                options={laneFields.map((field) => ({
                  value: field.id,
                  label: (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <FieldTypeIcon type={field.type} />
                      {`${field.name} · ${t(
                        field.type === "member"
                          ? "kanban.memberField"
                          : "kanban.singleSelectField",
                      )}`}
                    </span>
                  ),
                }))}
                onChange={(value) => setLaneFieldId(value || null)}
              />
            </div>
            {assigneeAvailable ? (
              <Button
                className="q-kanban-settings__quick"
                disabled={!canEdit}
                onClick={() => setLaneFieldId(profile.assigneeFieldId)}
              >
                {t("kanban.laneByAssignee")}
              </Button>
            ) : null}
          </section>

          <Divider />

          <section>
            <Title level={5}>{t("kanban.cardFields")}</Title>
            <Text type="secondary">{t("kanban.cardFieldsHelp")}</Text>
            <div className="q-kanban-settings__control">
              <Select
                mode="multiple"
                disabled={!canEdit}
                maxCount={MAX_CARD_FIELDS}
                value={cardFieldIds}
                placeholder={t("kanban.cardFields")}
                style={{ width: "100%" }}
                options={cardFields.map((field) => ({
                  value: field.id,
                  label: field.name,
                }))}
                onChange={(value) =>
                  setCardFieldIds(value.slice(0, MAX_CARD_FIELDS))
                }
              />
            </div>
          </section>

          <Divider />

          <section className="q-kanban-settings__switch-row">
            <div>
              <Title level={5}>{t("kanban.hideCompleted")}</Title>
              <Text type="secondary">{t("kanban.hideCompletedHelp")}</Text>
            </div>
            <Switch
              aria-label={t("kanban.hideCompleted")}
              disabled={!canEdit}
              checked={hideCompleted}
              onChange={setHideCompleted}
            />
          </section>
        </Space>
      </div>
      <div className="q-kanban-settings__footer">
        <Button onClick={onClose}>{t("kanban.cancel")}</Button>
        <Button
          type="primary"
          loading={saving}
          disabled={!canEdit}
          onClick={save}
        >
          {t("kanban.save")}
        </Button>
      </div>
    </>
  );
}

export function BoardSettingsDrawer({
  open,
  fields,
  profile,
  config,
  canEdit,
  onClose,
  onSave,
}: EditorProps & { open: boolean }) {
  useLanguage();
  const editorKey = [
    config.groupFieldId,
    config.laneFieldId || "none",
    config.cardFieldIds.join(","),
    config.hideCompleted ? "hidden" : "shown",
    config.collapsedColumns.join(","),
  ].join("|");

  return (
    <Drawer
      title={t("kanban.drawerTitle")}
      width={420}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={null}
    >
      {open ? (
        <BoardSettingsEditor
          key={editorKey}
          fields={fields}
          profile={profile}
          config={config}
          canEdit={canEdit}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Drawer>
  );
}
