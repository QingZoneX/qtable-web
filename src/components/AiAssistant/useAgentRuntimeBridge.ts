import {
  useAiRuntimeStore,
  type ToolCallRecord,
  type WorkflowPlan,
  type ActionPreview,
  type ConfirmRequest,
} from "../../store/aiRuntimeStore";
import type { ToolExecutionTrace } from "../../lib/aiToolRouter";

type ToolTraceSnapshot = {
  traceId?: string;
  status: "completed" | "requires_confirmation" | "failed";
  answer?: string;
  provider?: string;
  model?: string;
  toolCalls: ToolExecutionTrace[];
  pendingConfirmation?: Record<string, unknown>;
  updatedAt: string;
  mode: "chat" | "agent";
};

export function useAgentRuntimeBridge() {
  const setAgentState = useAiRuntimeStore((s) => s.setAgentState);
  const setActivePlan = useAiRuntimeStore((s) => s.setActivePlan);
  const upsertToolCall = useAiRuntimeStore((s) => s.upsertToolCall);
  const updateToolCallProgress = useAiRuntimeStore((s) => s.updateToolCallProgress);
  const addPreview = useAiRuntimeStore((s) => s.addPreview);
  const addConfirmRequest = useAiRuntimeStore((s) => s.addConfirmRequest);
  const addExecutionLog = useAiRuntimeStore((s) => s.addExecutionLog);
  const setLayerVisible = useAiRuntimeStore((s) => s.setLayerVisible);
  const setActiveTab = useAiRuntimeStore((s) => s.setActiveTab);
  const upsertLongTask = useAiRuntimeStore((s) => s.upsertLongTask);
  const removeLongTask = useAiRuntimeStore((s) => s.removeLongTask);
  const resetRuntime = useAiRuntimeStore((s) => s.resetRuntime);

  const onAgentStart = () => {
    resetRuntime();
    setAgentState("planning");
    setLayerVisible("reasoning", true);
    setLayerVisible("tool_calls", true);
  };

  const onAgentPlanning = (planData: {
    goal: string;
    strategy: string;
    reasoning: string;
    steps: Array<{
      description: string;
      skillName: string;
      requiresApproval?: boolean;
      maxRetries?: number;
    }>;
    intent: string;
    intentConfidence: number;
    requiresConfirmation: boolean;
  }) => {
    const plan: WorkflowPlan = {
      planId: `plan_${Date.now()}`,
      goal: planData.goal,
      strategy: planData.strategy,
      reasoning: planData.reasoning,
      steps: planData.steps.map((step, i) => ({
        stepId: `step_${i}_${Date.now()}`,
        index: i,
        description: step.description,
        skillName: step.skillName,
        arguments: {},
        status: "pending",
        dependsOn: i > 0 ? [planData.steps[i - 1].description] : [],
        maxRetries: step.maxRetries ?? 0,
        retryCount: 0,
        requireApproval: step.requiresApproval ?? false,
      })),
      intent: planData.intent,
      intentConfidence: planData.intentConfidence,
      requiresConfirmation: planData.requiresConfirmation,
      createdAt: new Date().toISOString(),
    };
    setActivePlan(plan);
    setActiveTab("plan");

    addExecutionLog({
      id: `log_plan_${Date.now()}`,
      level: "info",
      message: `AI 规划完成: ${planData.goal}`,
      timestamp: new Date().toISOString(),
    });
  };

  const onToolCallStarted = (toolCall: {
    toolCallId: string;
    stepId: string;
    skillName: string;
    functionName: string;
    arguments: Record<string, unknown>;
  }) => {
    const record: ToolCallRecord = {
      toolCallId: toolCall.toolCallId,
      stepId: toolCall.stepId,
      skillName: toolCall.skillName,
      functionName: toolCall.functionName,
      arguments: toolCall.arguments,
      state: "running",
      attemptCount: 1,
      durationMs: 0,
      progress: 0,
      progressMessage: "开始执行...",
      timestamp: new Date().toISOString(),
    };
    upsertToolCall(record);
    setAgentState("executing");
    setLayerVisible("tool_calls", true);

    addExecutionLog({
      id: `log_tc_${toolCall.toolCallId}`,
      level: "info",
      message: `工具调用: ${toolCall.skillName}.${toolCall.functionName}`,
      toolCallId: toolCall.toolCallId,
      stepId: toolCall.stepId,
      timestamp: new Date().toISOString(),
    });
  };

  const onToolCallProgress = (
    toolCallId: string,
    progress: number,
    message: string,
  ) => {
    updateToolCallProgress(toolCallId, progress, message);
  };

  const onToolCallCompleted = (toolCall: {
    toolCallId: string;
    output?: Record<string, unknown>;
    durationMs: number;
  }) => {
    upsertToolCall({
      toolCallId: toolCall.toolCallId,
      stepId: "",
      skillName: "",
      functionName: "",
      arguments: {},
      state: "completed",
      output: toolCall.output,
      attemptCount: 1,
      durationMs: toolCall.durationMs,
      timestamp: new Date().toISOString(),
    });

    addExecutionLog({
      id: `log_done_${toolCall.toolCallId}`,
      level: "success",
      message: `工具执行成功 (${(toolCall.durationMs / 1000).toFixed(1)}s)`,
      toolCallId: toolCall.toolCallId,
      timestamp: new Date().toISOString(),
    });
  };

  const onToolCallFailed = (toolCall: {
    toolCallId: string;
    error: { code: string; message: string };
    durationMs: number;
    attemptCount: number;
    canRetry: boolean;
  }) => {
    upsertToolCall({
      toolCallId: toolCall.toolCallId,
      stepId: "",
      skillName: "",
      functionName: "",
      arguments: {},
      state: toolCall.canRetry ? "pending" : "failed",
      error: toolCall.error,
      attemptCount: toolCall.attemptCount,
      durationMs: toolCall.durationMs,
      timestamp: new Date().toISOString(),
    });

    addExecutionLog({
      id: `log_fail_${toolCall.toolCallId}`,
      level: toolCall.canRetry ? "warning" : "error",
      message: `工具执行失败${toolCall.canRetry ? " (将重试)" : ""}: ${toolCall.error.message}`,
      toolCallId: toolCall.toolCallId,
      timestamp: new Date().toISOString(),
    });
  };

  const onPreviewGenerated = (preview: ActionPreview) => {
    addPreview(preview);
    setLayerVisible("preview", true);
    setAgentState("preview");

    addExecutionLog({
      id: `log_preview_${preview.previewId}`,
      level: "info",
      message: `数据预览生成: ${preview.summary} (${preview.affectedCount}行)`,
      stepId: preview.stepId,
      timestamp: new Date().toISOString(),
    });
  };

  const onApprovalRequested = (request: ConfirmRequest) => {
    addConfirmRequest(request);
    setLayerVisible("approval", true);
    setAgentState("awaiting_confirm");

    addExecutionLog({
      id: `log_confirm_${request.confirmId}`,
      level: "warning",
      message: `需要用户确认: ${request.preview?.summary ?? "操作确认"}`,
      stepId: request.stepId,
      timestamp: new Date().toISOString(),
    });
  };

  const onTraceUpdate = (trace: ToolTraceSnapshot) => {
    if (!trace.toolCalls || trace.toolCalls.length === 0) return;

    trace.toolCalls.forEach((tc) => {
      const tcState: ToolCallRecord["state"] =
        tc.state === "completed" ? "completed"
        : tc.state === "failed" ? "failed"
        : "completed";

      const record: ToolCallRecord = {
        toolCallId: tc.toolCallId,
        stepId: "",
        skillName: tc.skillName,
        functionName: tc.functionName,
        arguments: tc.arguments,
        state: tcState,
        output: tc.output,
        error: tc.error ? { code: "error", message: JSON.stringify(tc.error) } : undefined,
        attemptCount: tc.attemptCount,
        durationMs: 0,
        progress: tcState === "completed" ? 100 : 50,
        progressMessage: tcState === "completed" ? "完成" : tcState === "failed" ? "失败" : "执行中",
        timestamp: new Date().toISOString(),
      };
      upsertToolCall(record);
    });

    if (trace.status === "completed") {
      setAgentState("completed");
      addExecutionLog({
        id: `log_done_${trace.traceId ?? Date.now()}`,
        level: "success",
        message: `Agent 执行完成 (${trace.mode}模式)`,
        timestamp: new Date().toISOString(),
      });
    } else if (trace.status === "requires_confirmation") {
      setAgentState("awaiting_confirm");
      setLayerVisible("approval", true);
    } else if (trace.status === "failed") {
      setAgentState("failed");
      addExecutionLog({
        id: `log_fail_${trace.traceId ?? Date.now()}`,
        level: "error",
        message: `Agent 执行失败`,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const onLongTaskStart = (taskId: string, description: string, estimatedDurationMs?: number) => {
    upsertLongTask({
      taskId,
      description,
      progress: 0,
      progressMessage: "开始执行...",
      estimatedDurationMs,
      elapsedMs: 0,
      startedAt: new Date().toISOString(),
    });
    setLayerVisible("execution", true);
  };

  const onLongTaskProgress = (taskId: string, progress: number, message: string, elapsedMs: number) => {
    upsertLongTask({
      taskId,
      description: "",
      progress,
      progressMessage: message,
      elapsedMs,
      startedAt: "",
    });
  };

  const onLongTaskComplete = (taskId: string) => {
    removeLongTask(taskId);
  };

  const onAgentError = (error: string) => {
    setAgentState("failed");
    addExecutionLog({
      id: `log_error_${Date.now()}`,
      level: "error",
      message: error,
      timestamp: new Date().toISOString(),
    });
  };

  const onAgentComplete = (summary?: string) => {
    setAgentState("completed");
    if (summary) {
      addExecutionLog({
        id: `log_summary_${Date.now()}`,
        level: "info",
        message: summary,
        timestamp: new Date().toISOString(),
      });
    }
  };

  const onAgentStop = () => {
    setAgentState("stopped");
    addExecutionLog({
      id: `log_stop_${Date.now()}`,
      level: "info",
      message: "Agent 已停止",
      timestamp: new Date().toISOString(),
    });
  };

  return {
    onAgentStart,
    onAgentPlanning,
    onToolCallStarted,
    onToolCallProgress,
    onToolCallCompleted,
    onToolCallFailed,
    onPreviewGenerated,
    onApprovalRequested,
    onTraceUpdate,
    onLongTaskStart,
    onLongTaskProgress,
    onLongTaskComplete,
    onAgentError,
    onAgentComplete,
    onAgentStop,
  };
}
