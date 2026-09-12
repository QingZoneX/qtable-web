import React from "react";
import type { ToolCallRecord } from "../../../store/aiRuntimeStore";
import { LayerHeader } from "../shared/LayerHeader";
import { ToolTimeline } from "../shared/ToolTimeline";

type ToolCallLayerProps = {
  expanded: boolean;
  onToggle: () => void;
  toolCalls: ToolCallRecord[];
};

export const ToolCallLayer: React.FC<ToolCallLayerProps> = ({
  expanded,
  onToggle,
  toolCalls,
}) => {
  const runningCount = toolCalls.filter((t) => t.state === "running").length;
  const failedCount = toolCalls.filter((t) => t.state === "failed").length;
  const totalCount = toolCalls.length;

  return (
    <div className="border-b border-gray-100">
      <LayerHeader
        title="工具调用"
        icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14.5 2a.5.5 0 01.5.5v11a.5.5 0 01-.5.5h-13a.5.5 0 01-.5-.5v-11a.5.5 0 01.5-.5h13zM14 3H2v10h12V3zM3 4.5a.5.5 0 01.5-.5h2a.5.5 0 010 1h-2a.5.5 0 01-.5-.5zm0 3a.5.5 0 01.5-.5h4a.5.5 0 010 1h-4a.5.5 0 01-.5-.5zm0 3a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z" />
          </svg>
        }
        expanded={expanded}
        onToggle={onToggle}
        badge={totalCount}
        status={
          <div className="flex items-center gap-1">
            {runningCount > 0 && (
              <span className="text-[10px] text-blue-500 font-medium">
                {runningCount} 运行中
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-[10px] text-red-500 font-medium">
                {failedCount} 失败
              </span>
            )}
          </div>
        }
        actions={
          totalCount > 0 ? (
            <span className="text-[10px] text-gray-400">
              {totalCount} 次调用
            </span>
          ) : undefined
        }
      />
      {expanded && (
        <div className="px-3 pb-3 max-h-80 overflow-y-auto">
          <ToolTimeline toolCalls={toolCalls} />
        </div>
      )}
    </div>
  );
};
