import React, { useMemo } from "react";
import type { AgentState, WorkflowPlan } from "../../../store/aiRuntimeStore";
import { StatusBadge } from "./StatusBadge";

type AgentProgressBarProps = {
  agentState: AgentState;
  activePlan: WorkflowPlan | null;
};

export const AgentProgressBar: React.FC<AgentProgressBarProps> = ({
  agentState,
  activePlan,
}) => {
  const progress = useMemo(() => {
    if (!activePlan || activePlan.steps.length === 0) return 0;
    const completed = activePlan.steps.filter(
      (s) => s.status === "completed" || s.status === "skipped"
    ).length;
    return Math.round((completed / activePlan.steps.length) * 100);
  }, [activePlan]);

  const isActive = !["idle", "completed", "failed", "stopped"].includes(agentState);

  if (agentState === "idle") return null;

  return (
    <div className="border-b border-gray-100 bg-gray-50/50">
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <StatusBadge state={agentState} />
            {activePlan && (
              <span className="text-xs text-gray-500 truncate max-w-[200px]">
                {activePlan.goal}
              </span>
            )}
          </div>
          {activePlan && (
            <span className="text-xs text-gray-400 tabular-nums">
              {progress}%
            </span>
          )}
        </div>

        {isActive && (
          <div className="relative mt-1">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.max(progress, 4)}%` }}
              />
            </div>
            {progress < 100 && (
              <div
                className="absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{ animation: "progress-indeterminate 1.5s ease-in-out infinite" }}
              />
            )}
          </div>
        )}

        {activePlan && activePlan.steps.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 overflow-x-auto">
            {activePlan.steps.slice(0, 8).map((step) => {
              const colors: Record<string, string> = {
                completed: "bg-emerald-400",
                running: "bg-blue-500",
                failed: "bg-red-400",
                skipped: "bg-gray-300",
                requires_approval: "bg-amber-400",
                pending: "bg-gray-200",
              };
              const color = colors[step.status] ?? "bg-gray-200";
              return (
                <div
                  key={step.stepId}
                  className={`w-3 h-1.5 rounded-full ${color} transition-colors flex-shrink-0`}
                  title={`${step.description} (${step.status})`}
                />
              );
            })}
            {activePlan.steps.length > 8 && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                +{activePlan.steps.length - 8}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
