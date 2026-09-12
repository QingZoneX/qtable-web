import React, { useCallback, useMemo } from "react";
import { useAiRuntimeStore } from "../../store/aiRuntimeStore";
import { RightPanelShell } from "../SmartTable/RightPanelShell";
import { AgentProgressBar } from "./shared/AgentProgressBar";
import { ConversationLayer } from "./layers/ConversationLayer";
import { ReasoningLayer } from "./layers/ReasoningLayer";
import { ToolCallLayer } from "./layers/ToolCallLayer";
import { PreviewLayer } from "./layers/PreviewLayer";
import { ExecutionLayer } from "./layers/ExecutionLayer";
import { ApprovalLayer } from "./layers/ApprovalLayer";

type AiWorkspacePanelProps = {
  drawerOpen: boolean;
  drawerWidth: number;
  onWidthChange: (width: number) => void;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
};

export const AiWorkspacePanel: React.FC<AiWorkspacePanelProps> = ({
  drawerOpen,
  drawerWidth,
  onWidthChange,
  children,
  headerExtra,
}) => {
  const agentState = useAiRuntimeStore((s) => s.agentState);
  const activePlan = useAiRuntimeStore((s) => s.activePlan);
  const toolCallsList = useAiRuntimeStore((s) => s.toolCallsList);
  const previews = useAiRuntimeStore((s) => s.previews);
  const confirmRequests = useAiRuntimeStore((s) => s.confirmRequests);
  const executionLogs = useAiRuntimeStore((s) => s.executionLogs);
  const longTasks = useAiRuntimeStore((s) => s.longTasks);
  const streaming = useAiRuntimeStore((s) => s.streaming);
  const workspaceLayout = useAiRuntimeStore((s) => s.workspaceLayout);
  const activeTab = useAiRuntimeStore((s) => s.activeTab);

  const toggleLayerExpanded = useAiRuntimeStore((s) => s.toggleLayerExpanded);
  const resolveConfirmRequest = useAiRuntimeStore((s) => s.resolveConfirmRequest);
  const setActiveTab = useAiRuntimeStore((s) => s.setActiveTab);

  const isAgentActive = useMemo(
    () => !["idle"].includes(agentState),
    [agentState]
  );

  const handleApprove = useCallback(
    (confirmId: string) => {
      resolveConfirmRequest(confirmId, "approved");
    },
    [resolveConfirmRequest]
  );

  const handleReject = useCallback(
    (confirmId: string) => {
      resolveConfirmRequest(confirmId, "rejected");
    },
    [resolveConfirmRequest]
  );

  return (
    <RightPanelShell
      open={drawerOpen}
      title="AI 辅助"
      width={drawerWidth}
      minWidth={420}
      maxWidth={900}
      resizable
      onWidthChange={onWidthChange}
      extra={headerExtra}
      bodyStyle={{
        background: "linear-gradient(to bottom, #fafbfc, #ffffff)",
      }}
    >
      <div className="flex flex-col h-full">
        <AgentProgressBar agentState={agentState} activePlan={activePlan} />

        <div className="flex-1 min-h-0 flex flex-col">
          {isAgentActive && (
            <div className="flex-shrink-0 px-3 pt-1 pb-0.5 border-b border-gray-100 bg-white flex items-center gap-1">
              {(["chat", "plan", "logs"] as const).map((tab) => {
                const isActive = tab === activeTab;
                const labels: Record<string, string> = {
                  chat: "对话",
                  plan: "计划",
                  logs: "日志",
                };
                const icons: Record<string, React.ReactNode> = {
                  chat: (
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 3V3z" />
                    </svg>
                  ),
                  plan: (
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 1a1 1 0 011 1v1.59l2.12-2.12a1 1 0 011.41 0l.71.71a1 1 0 010 1.41L11.12 5.71H13a1 1 0 011 1v1a1 1 0 01-1 1h-1.88l2.12 2.12a1 1 0 010 1.41l-.71.71a1 1 0 01-1.41 0L9 10.41V12a1 1 0 01-1 1H7a1 1 0 01-1-1v-1.59l-2.12 2.12a1 1 0 01-1.41 0l-.71-.71a1 1 0 010-1.41L3.88 8H2a1 1 0 01-1-1V6a1 1 0 011-1h1.88L1.76 2.88a1 1 0 010-1.41l.71-.71a1 1 0 011.41 0L6 2.83V1a1 1 0 011-1z" />
                    </svg>
                  ),
                  logs: (
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2 2a1 1 0 011-1h8a1 1 0 011 1v1.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V2H5v1.5a.5.5 0 01-.5.5h-1a.5.5 0 01-.5-.5V2H2zm2 3.5a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5z" />
                    </svg>
                  ),
                };

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-t-md transition-colors ${
                      isActive
                        ? "text-blue-600 bg-white border border-b-white border-gray-200 -mb-px font-medium"
                        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {icons[tab]}
                    {labels[tab]}
                    {tab === "plan" && activePlan && (
                      <span className="text-[10px] text-gray-400">
                        ({activePlan.steps.length})
                      </span>
                    )}
                    {tab === "logs" && executionLogs.length > 0 && (
                      <span className="text-[10px] text-gray-400">
                        ({executionLogs.length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {(!isAgentActive || activeTab === "chat") && (
              <ConversationLayer
                streaming={streaming}
              >
                {children}
              </ConversationLayer>
            )}

            {isAgentActive && activeTab === "plan" && (
              <div className="flex-1 overflow-y-auto">
                <ReasoningLayer
                  expanded={workspaceLayout.reasoning.expanded}
                  onToggle={() => toggleLayerExpanded("reasoning")}
                  activePlan={activePlan}
                />
                <ToolCallLayer
                  expanded={workspaceLayout.tool_calls.expanded}
                  onToggle={() => toggleLayerExpanded("tool_calls")}
                  toolCalls={toolCallsList}
                />
              </div>
            )}

            {isAgentActive && activeTab === "logs" && (
              <div className="flex-1 overflow-y-auto">
                <ExecutionLayer
                  expanded={workspaceLayout.execution.expanded}
                  onToggle={() => toggleLayerExpanded("execution")}
                  executionLogs={executionLogs}
                  longTasks={longTasks}
                />
              </div>
            )}

            {isAgentActive && (
              <>
                {previews.length > 0 && (
                  <PreviewLayer
                    expanded={workspaceLayout.preview.expanded}
                    onToggle={() => toggleLayerExpanded("preview")}
                    previews={previews}
                  />
                )}

                {confirmRequests.some((c) => c.status === "pending") && (
                  <ApprovalLayer
                    expanded={workspaceLayout.approval.expanded}
                    onToggle={() => toggleLayerExpanded("approval")}
                    confirmRequests={confirmRequests}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </RightPanelShell>
  );
};
