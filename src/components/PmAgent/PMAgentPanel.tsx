import React, { useEffect, useMemo } from "react";
import { usePMAgentStore } from "../../store/pmAgentStore";
import {
  PM_PHASE_LABELS,
  PM_PHASE_ICONS,
  type PMPhaseStatus,
} from "../../lib/pmAgent";

const statusColors: Record<PMPhaseStatus, string> = {
  pending: "#9CA3AF",
  in_progress: "#3B82F6",
  completed: "#10B981",
  failed: "#EF4444",
  skipped: "#6B7280",
  requires_approval: "#F59E0B",
};

const statusLabels: Record<PMPhaseStatus, string> = {
  pending: "等待中",
  in_progress: "进行中",
  completed: "已完成",
  failed: "失败",
  skipped: "已跳过",
  requires_approval: "待审批",
};

interface PMAgentPanelProps {
  workflowId?: string;
  onComplete?: () => void;
}

export const PMAgentPanel: React.FC<PMAgentPanelProps> = ({
  workflowId,
  onComplete,
}) => {
  const currentWorkflow = usePMAgentStore((s) => s.currentWorkflow);
  const streamingContent = usePMAgentStore((s) => s.streamingContent);
  const getWorkflow = usePMAgentStore((s) => s.getWorkflow);

  const workflow = workflowId
    ? getWorkflow(workflowId)
    : currentWorkflow;

  useEffect(() => {
    if (workflow?.status === "completed" && onComplete) {
      onComplete();
    }
  }, [workflow?.status, onComplete]);

  const progressPercent = useMemo(() => {
    if (!workflow || workflow.totalPhases === 0) return 0;
    return Math.round((workflow.completedPhases / workflow.totalPhases) * 100);
  }, [workflow]);

  if (!workflow) {
    return (
      <div style={{ padding: 16, color: "#6B7280", textAlign: "center" }}>
        暂无 PM Agent 任务
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 12,
            color: "#6B7280",
            marginBottom: 4,
          }}
        >
          项目规划进度
        </div>
        <div
          style={{
            height: 6,
            backgroundColor: "#E5E7EB",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              backgroundColor:
                workflow.status === "failed" ? "#EF4444" : "#3B82F6",
              borderRadius: 3,
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            fontSize: 12,
            color: "#6B7280",
          }}
        >
          <span>
            {workflow.completedPhases}/{workflow.totalPhases} 阶段
          </span>
          <span>{progressPercent}%</span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        {workflow.currentPhase && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#EFF6FF",
              borderRadius: 6,
              fontSize: 13,
              color: "#1D4ED8",
              marginBottom: 8,
            }}
          >
            🔄 当前阶段：{PM_PHASE_LABELS[workflow.currentPhase]}
          </div>
        )}

        {workflow.status === "failed" && workflow.error && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#FEF2F2",
              borderRadius: 6,
              fontSize: 13,
              color: "#DC2626",
            }}
          >
            ❌ 错误：{workflow.error}
          </div>
        )}

        {workflow.status === "completed" && workflow.finalResponse && (
          <div
            style={{
              padding: "8px 12px",
              backgroundColor: "#F0FDF4",
              borderRadius: 6,
              fontSize: 13,
              color: "#166534",
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            {workflow.finalResponse}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {workflow.phaseResults.map((phaseResult) => {
          const icon = PM_PHASE_ICONS[phaseResult.phase] || "📌";
          const label = PM_PHASE_LABELS[phaseResult.phase] || phaseResult.phase;
          const color = statusColors[phaseResult.status];
          const statusLabel = statusLabels[phaseResult.status];

          return (
            <div
              key={phaseResult.phase}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 4,
                backgroundColor:
                  phaseResult.status === "in_progress"
                    ? "#F0F7FF"
                    : "transparent",
              }}
            >
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ flex: 1, fontSize: 13, color: "#374151" }}>
                {label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color,
                  fontWeight: 500,
                }}
              >
                {statusLabel}
              </span>
              {phaseResult.status === "in_progress" && (
                <span
                  style={{
                    width: 12,
                    height: 12,
                    border: `2px solid ${color}`,
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {streamingContent && workflow.status === "running" && (
        <div
          style={{
            marginTop: 12,
            padding: 8,
            backgroundColor: "#F9FAFB",
            borderRadius: 4,
            fontSize: 11,
            color: "#9CA3AF",
            maxHeight: 120,
            overflow: "auto",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {streamingContent.slice(-500)}
        </div>
      )}
    </div>
  );
};

export default PMAgentPanel;
