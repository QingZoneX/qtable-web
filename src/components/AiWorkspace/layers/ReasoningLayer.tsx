import React from "react";
import type { WorkflowPlan } from "../../../store/aiRuntimeStore";
import { LayerHeader } from "../shared/LayerHeader";
import { StatusBadge } from "../shared/StatusBadge";

type ReasoningLayerProps = {
  expanded: boolean;
  onToggle: () => void;
  activePlan: WorkflowPlan | null;
};

export const ReasoningLayer: React.FC<ReasoningLayerProps> = ({
  expanded,
  onToggle,
  activePlan,
}) => {
  if (!activePlan) return null;

  return (
    <div className="border-b border-gray-100">
      <LayerHeader
        title="AI 规划"
        icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a1 1 0 011 1v1.59l2.12-2.12a1 1 0 011.41 0l.71.71a1 1 0 010 1.41L11.12 5.71H13a1 1 0 011 1v1a1 1 0 01-1 1h-1.88l2.12 2.12a1 1 0 010 1.41l-.71.71a1 1 0 01-1.41 0L9 10.41V12a1 1 0 01-1 1H7a1 1 0 01-1-1v-1.59l-2.12 2.12a1 1 0 01-1.41 0l-.71-.71a1 1 0 010-1.41L3.88 8H2a1 1 0 01-1-1V6a1 1 0 011-1h1.88L1.76 2.88a1 1 0 010-1.41l.71-.71a1 1 0 011.41 0L6 2.83V1a1 1 0 011-1z" />
          </svg>
        }
        expanded={expanded}
        onToggle={onToggle}
      />
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-3 border border-purple-100">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🎯</span>
              <span className="text-sm font-semibold text-purple-800">{activePlan.goal}</span>
            </div>
            <div className="text-xs text-purple-600/80 leading-relaxed mb-2">
              {activePlan.reasoning}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full">
                {activePlan.intent}
              </span>
              <span className="text-[10px] text-purple-400">
                置信度: {Math.round(activePlan.intentConfidence * 100)}%
              </span>
            </div>
          </div>

          <div className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 2a1 1 0 011-1h6a1 1 0 011 1v1h2.5a.5.5 0 010 1H14v9a2 2 0 01-2 2H4a2 2 0 01-2-2V4h-.5a.5.5 0 010-1H4V2zm2.5 1h3V2h-3v1zM4 4v9a1 1 0 001 1h6a1 1 0 001-1V4H4z" />
            </svg>
            执行计划 ({activePlan.steps.length} 步)
          </div>

          <div className="space-y-1">
            {activePlan.steps.map((step, idx) => {
              const statusColors: Record<string, string> = {
                pending: "border-gray-200 bg-white",
                running: "border-blue-200 bg-blue-50",
                completed: "border-emerald-200 bg-emerald-50",
                failed: "border-red-200 bg-red-50",
                skipped: "border-gray-200 bg-gray-50",
                requires_approval: "border-amber-200 bg-amber-50",
              };
              const stepNumColors: Record<string, string> = {
                pending: "bg-gray-100 text-gray-500",
                running: "bg-blue-100 text-blue-600",
                completed: "bg-emerald-100 text-emerald-600",
                failed: "bg-red-100 text-red-600",
                skipped: "bg-gray-100 text-gray-400",
                requires_approval: "bg-amber-100 text-amber-600",
              };

              return (
                <div
                  key={step.stepId}
                  className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border transition-colors ${statusColors[step.status] ?? "border-gray-200 bg-white"}`}
                >
                  <span
                    className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${stepNumColors[step.status] ?? "bg-gray-100 text-gray-500"}`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-700 leading-relaxed">
                      {step.description}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-gray-400 font-mono">
                        {step.skillName}
                      </span>
                      {step.maxRetries > 0 && step.retryCount > 0 && (
                        <span className="text-[10px] text-amber-500">
                          重试 {step.retryCount}/{step.maxRetries}
                        </span>
                      )}
                      {step.requireApproval && (
                        <span className="text-[10px] text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                          🔒 需审批
                        </span>
                      )}
                    </div>
                    {step.error && (
                      <div className="mt-1 text-[10px] text-red-500 bg-red-50 rounded px-2 py-1">
                        {step.error.message}
                      </div>
                    )}
                  </div>
                  <StatusBadge state={step.status} className="!text-[10px] flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
