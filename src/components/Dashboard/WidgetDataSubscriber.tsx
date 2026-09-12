import { useEffect } from "react";
import { useSubscription } from "@apollo/client/react";
import { TABLE_UPDATES } from "../../lib/graphql";

/**
 * 订阅表数据变更，数据更新时触发回调刷新
 */
export function WidgetDataSubscriber({
  tableId,
  onUpdate,
}: {
  tableId: string;
  onUpdate: () => void;
}) {
  const { data } = useSubscription<{ tableUpdates: { tableId: string; updatedAt: string } }>(
    TABLE_UPDATES,
    {
      variables: { tableId, includeSnapshot: false },
      skip: !tableId,
    },
  );
  useEffect(() => {
    if (data) onUpdate();
  }, [data, onUpdate]);
  return null;
}
