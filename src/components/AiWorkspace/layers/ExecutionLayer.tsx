import React, { useRef, useEffect } from "react";
import type { ExecutionLogEntry, LongTaskInfo } from "../../../store/aiRuntimeStore";
import { LayerHeader } from "../shared/LayerHeader";

type ExecutionLayerProps = {
  expanded: boolean;
  onToggle: () => void;
  executionLogs: ExecutionLogEntry[];
  longTasks: Record<string, LongTaskInfo>;
};

const levelStyles: Record<string, string> = {
  info: "text-gray-600 bg-transparent",
  success: "text-emerald-600 bg-transparent",
  warning: "text-amber-600 bg-amber-50/50",
  error: "text-red-600 bg-red-50/50",
  debug: "text-gray-400 bg-transparent",
};

const levelIcons: Record<string, string> = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "❌",
  debug: "🔍",
};

export const ExecutionLayer: React.FC<ExecutionLayerProps> = ({
  expanded,
  onToggle,
  executionLogs,
  longTasks,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && expanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [executionLogs, expanded]);

  const errorCount = executionLogs.filter((l) => l.level === "error").length;
  const taskEntries = Object.values(longTasks);

  return (
    <div className="border-b border-gray-100">
      <LayerHeader
        title="执行日志"
        icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2a1 1 0 011-1h8a1 1 0 011 1v1.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V2H5v1.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V2H2zm2 3.5a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z" />
          </svg>
        }
        expanded={expanded}
        onToggle={onToggle}
        badge={executionLogs.length}
        status={
          errorCount > 0 ? (
            <span className="text-[10px] text-red-500 font-medium">
              {errorCount} 错误
            </span>
          ) : undefined
        }
      />
      {expanded && (
        <div className="px-3 pb-3">
          {taskEntries.length > 0 && (
            <div className="mb-2 space-y-1">
              {taskEntries.map((task) => (
                <div
                  key={task.taskId}
                  className="bg-gray-50 rounded-lg p-2 border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {task.description}
                    </span>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {(task.elapsedMs / 1000).toFixed(0)}s
                      {task.estimatedDurationMs != null &&
                        ` / ${(task.estimatedDurationMs / 1000).toFixed(0)}s`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500 tabular-nums w-8 text-right">
                      {task.progress}%
                    </span>
                  </div>
                  {task.progressMessage && (
                    <div className="mt-1 text-[10px] text-gray-400">
                      {task.progressMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            ref={scrollRef}
            className="max-h-60 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50"
          >
            {executionLogs.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">
                暂无日志
              </div>
            ) : (
              <table className="w-full">
                <tbody>
                  {executionLogs.map((log) => (
                    <tr
                      key={log.id}
                      className={`border-b border-gray-100 last:border-0 ${levelStyles[log.level] ?? ""}`}
                    >
                      <td className="px-2 py-1 w-5 text-[10px] text-center flex-shrink-0">
                        {levelIcons[log.level] ?? "•"}
                      </td>
                      <td className="px-2 py-1 w-16 text-[10px] text-gray-400 flex-shrink-0 whitespace-nowrap font-mono">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-2 py-1 text-[11px] leading-relaxed">
                        {log.message}
                      </td>
                      <td className="px-2 py-1 w-16 text-[10px] text-gray-400 flex-shrink-0">
                        {log.stepId && `S${log.stepId.slice(0, 6)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
