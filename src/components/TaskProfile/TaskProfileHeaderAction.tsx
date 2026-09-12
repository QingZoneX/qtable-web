import { Button, Tooltip } from "antd";
import { ApartmentOutlined } from "@ant-design/icons";
import { useSmartTableStore } from "../../store/useSmartTableStore";
import { openTaskProfileSettings } from "./taskProfile";
import { TaskProfileDrawer } from "./TaskProfileDrawer";

export function TaskProfileHeaderAction({ tableId }: { tableId?: string }) {
  const views = useSmartTableStore((state) => state.views);
  const currentViewId = useSmartTableStore((state) => state.currentViewId);
  const currentView = views.find((view) => view.id === currentViewId);
  const boardOwnsDrawer = currentView?.type === "board";

  if (!tableId) return null;
  return (
    <>
      <Tooltip title="配置记录标题、状态、负责人、截止日期等稳定业务语义">
        <Button
          type="text"
          size="small"
          icon={<ApartmentOutlined />}
          onClick={openTaskProfileSettings}
          style={{ height: 32, fontSize: 12 }}
        >
          业务语义
        </Button>
      </Tooltip>
      {!boardOwnsDrawer ? <TaskProfileDrawer tableId={tableId} /> : null}
    </>
  );
}
