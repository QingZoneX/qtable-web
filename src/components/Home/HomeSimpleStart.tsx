import {
  FileTextOutlined,
  FormOutlined,
  LayoutOutlined,
  PlusOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { useQuery } from "@apollo/client/react";
import { Button, message, Typography } from "antd";
import { useState } from "react";
import { GET_WORKSPACE } from "../../lib/graphql";
import { openWorkspaceManager } from "../../lib/shellEvents";
import { useWorkspaceNavigationStore } from "../../store/workspaceNavigationStore";
import { GoalWorkspaceModal } from "../GoalWorkspace/GoalWorkspaceModal";

type WorkspacePayload = {
  root?: {
    id: string;
  } | null;
};

export function HomeSimpleStart() {
  const workspaceId = useWorkspaceNavigationStore((state) => state.workspaceId);
  const [goalOpen, setGoalOpen] = useState(false);
  const { data, loading } = useQuery<{ workspace: WorkspacePayload }>(GET_WORKSPACE, {
    variables: { workspaceId: workspaceId || null },
    skip: !workspaceId,
    fetchPolicy: "cache-and-network",
  });
  const rootId = data?.workspace?.root?.id || "";

  const openWorkspaceCreation = (kind: "template" | "import" | "blank") => {
    openWorkspaceManager();
    if (kind === "template") {
      message.info("在工作区创建菜单中选择“从模板创建”即可开始");
    }
    if (kind === "import") {
      message.info("选择或创建目标数据表后，可从“更多”直接导入 CSV 数据");
    }
    if (kind === "blank") {
      message.info("工作区创建菜单保留“空白数据表”入口");
    }
  };

  return (
    <section className="qtable-home-simple-start" aria-label="下一步行动">
      <div className="qtable-home-simple-start-copy">
        <span className="qtable-home-simple-start-icon" aria-hidden="true">
          <RocketOutlined />
        </span>
        <div>
          <Typography.Title level={3}>从你要完成的事情开始</Typography.Title>
          <Typography.Paragraph>
            不必先理解字段、关系和视图配置。描述目标，或选择你已经熟悉的创建方式。
          </Typography.Paragraph>
        </div>
      </div>

      <div className="qtable-home-simple-action-grid">
        <button
          type="button"
          className="qtable-home-simple-action is-primary"
          onClick={() => setGoalOpen(true)}
          disabled={!workspaceId || !rootId || loading}
        >
          <span className="qtable-home-simple-action-icon"><FormOutlined /></span>
          <span>
            <strong>描述你想管理的事情</strong>
            <small>AI 先生成结构和执行预览，你确认后再创建</small>
          </span>
        </button>
        <button
          type="button"
          className="qtable-home-simple-action"
          onClick={() => openWorkspaceCreation("template")}
        >
          <span className="qtable-home-simple-action-icon"><LayoutOutlined /></span>
          <span>
            <strong>从模板开始</strong>
            <small>使用项目、任务等成熟结构快速开始</small>
          </span>
        </button>
        <button
          type="button"
          className="qtable-home-simple-action"
          onClick={() => openWorkspaceCreation("import")}
        >
          <span className="qtable-home-simple-action-icon"><FileTextOutlined /></span>
          <span>
            <strong>导入已有数据</strong>
            <small>复用现有 CSV 导入流程，不改变数据语义</small>
          </span>
        </button>
        <button
          type="button"
          className="qtable-home-simple-action"
          onClick={() => openWorkspaceCreation("blank")}
        >
          <span className="qtable-home-simple-action-icon"><PlusOutlined /></span>
          <span>
            <strong>空白数据表</strong>
            <small>高级用户仍可直接从零配置，不被 AI 阻挡</small>
          </span>
        </button>
      </div>

      {!workspaceId || (!rootId && !loading) ? (
        <div className="qtable-home-simple-start-status">
          当前工作区尚未准备完成。
          <Button type="link" size="small" onClick={openWorkspaceManager}>
            管理工作区
          </Button>
        </div>
      ) : null}

      {workspaceId && rootId ? (
        <GoalWorkspaceModal
          open={goalOpen}
          workspaceId={workspaceId}
          parentId={rootId}
          onClose={() => setGoalOpen(false)}
          onCreated={() => setGoalOpen(false)}
        />
      ) : null}
    </section>
  );
}
