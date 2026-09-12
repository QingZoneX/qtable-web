import React, { useState, useCallback } from "react";
import { usePMAgentStore } from "../../store/pmAgentStore";
import { useAiAssistantStore } from "../../store/aiAssistantStore";

interface PMAgentInputProps {
  onStart?: (workflowId: string) => void;
}

export const PMAgentInput: React.FC<PMAgentInputProps> = ({ onStart }) => {
  const [message, setMessage] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const startWorkflow = usePMAgentStore((s) => s.startWorkflow);
  const selectedTableIds = useAiAssistantStore((s) => s.selectedTableIds);

  const handleSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || isRunning) return;

    setIsRunning(true);
    setMessage("");

    try {
      const workflowId = await startWorkflow({
        message: trimmed,
        tableIds: selectedTableIds,
        streamingEnabled: true,
      });

      onStart?.(workflowId);
    } catch {
      // error handled in store
    } finally {
      setIsRunning(false);
    }
  }, [message, isRunning, startWorkflow, selectedTableIds, onStart]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        padding: "8px 12px",
        borderTop: "1px solid #E5E7EB",
        backgroundColor: "#FFFFFF",
      }}
    >
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="描述你的项目需求，例如：帮我规划一个 ERP 系统..."
        disabled={isRunning}
        style={{
          flex: 1,
          padding: "8px 12px",
          border: "1px solid #D1D5DB",
          borderRadius: 6,
          fontSize: 13,
          outline: "none",
          backgroundColor: isRunning ? "#F3F4F6" : "#FFFFFF",
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={isRunning || !message.trim()}
        style={{
          padding: "8px 16px",
          backgroundColor:
            isRunning || !message.trim() ? "#E5E7EB" : "#3B82F6",
          color: isRunning || !message.trim() ? "#9CA3AF" : "#FFFFFF",
          border: "none",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          cursor: isRunning || !message.trim() ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {isRunning ? "规划中..." : "开始规划"}
      </button>
    </div>
  );
};

export default PMAgentInput;
