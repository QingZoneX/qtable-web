import React from "react";
import type { AgentState, ToolCallState } from "../../../store/aiRuntimeStore";

const stateConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  idle:       { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400", label: "空闲" },
  planning:   { bg: "bg-purple-50", text: "text-purple-600", dot: "bg-purple-500", label: "规划中" },
  preview:    { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500", label: "预览" },
  awaiting_confirm: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500", label: "待确认" },
  executing:  { bg: "bg-cyan-50", text: "text-cyan-600", dot: "bg-cyan-500", label: "执行中" },
  observing:  { bg: "bg-teal-50", text: "text-teal-600", dot: "bg-teal-500", label: "观察中" },
  completed:  { bg: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500", label: "完成" },
  failed:     { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", label: "失败" },
  stopped:    { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400", label: "已停止" },

  pending:    { bg: "bg-gray-50", text: "text-gray-500", dot: "bg-gray-300", label: "等待" },
  running:    { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500 animate-pulse", label: "运行中" },
  requires_confirmation: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500 animate-pulse", label: "需确认" },
};

type StatusBadgeProps = {
  state: AgentState | ToolCallState | string;
  className?: string;
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ state, className = "" }) => {
  const config = stateConfig[state] ?? stateConfig.idle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
