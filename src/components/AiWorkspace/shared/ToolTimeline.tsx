import React from "react";
import type { ToolCallRecord } from "../../../store/aiRuntimeStore";
import { StatusBadge } from "./StatusBadge";

type ToolTimelineProps = {
  toolCalls: ToolCallRecord[];
};

const stateIcons: Record<string, string> = {
  pending: "○",
  running: "◉",
  completed: "✓",
  failed: "✗",
  requires_confirmation: "⚠",
};

const stateColors: Record<string, string> = {
  pending: "text-gray-300",
  running: "text-blue-500",
  completed: "text-emerald-500",
  failed: "text-red-500",
  requires_confirmation: "text-amber-500",
};

export const ToolTimeline: React.FC<ToolTimelineProps> = ({ toolCalls }) => {
  if (toolCalls.length === 0) {
    return (
      <div className="text-xs text-gray-400 text-center py-3">
        暂无工具调用
      </div>
    );
  }

  return (
    <div className="relative">
      {toolCalls.map((call, idx) => {
        const isLast = idx === toolCalls.length - 1;
        const icon = stateIcons[call.state] ?? "○";
        const color = stateColors[call.state] ?? "text-gray-400";

        return (
          <div key={call.toolCallId} className="flex gap-3 pb-1">
            <div className="flex flex-col items-center pt-1">
              <span className={`text-xs font-mono leading-none ${color}`}>
                {icon}
              </span>
              {!isLast && (
                <div className="w-px flex-1 bg-gray-200 my-0.5" />
              )}
            </div>
            <div className={`flex-1 min-w-0 pb-2 ${isLast ? "" : "border-gray-100"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-gray-700 truncate max-w-[160px]">
                  {call.skillName}.{call.functionName}
                </span>
                <StatusBadge state={call.state} className="!text-[10px]" />
              </div>

              {call.state === "running" && call.progress != null && (
                <div className="mt-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] text-gray-400">
                      {call.progressMessage || "执行中..."}
                    </span>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {call.progress}%
                    </span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${call.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {call.durationMs > 0 && call.state !== "pending" && call.state !== "running" && (
                <span className="text-[10px] text-gray-400 mt-0.5 inline-block">
                  {(call.durationMs / 1000).toFixed(1)}s
                  {call.attemptCount > 1 && ` (第${call.attemptCount}次)`}
                </span>
              )}

              {call.state === "failed" && call.error && (
                <div className="mt-1 px-2 py-1 bg-red-50 border border-red-100 rounded text-[11px] text-red-600">
                  {call.error.message}
                </div>
              )}

              {call.state === "completed" && call.output && (
                <div className="mt-1">
                  <pre className="text-[10px] text-gray-500 bg-gray-50 rounded p-1.5 max-h-20 overflow-y-auto font-mono whitespace-pre-wrap break-all">
                    {JSON.stringify(call.output, null, 2).slice(0, 200)}
                    {JSON.stringify(call.output).length > 200 && "..."}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
