import React from "react";

type ConversationLayerProps = {
  streaming: boolean;
  children: React.ReactNode;
};

/**
 * 对话层 - 始终展开，无收起/折叠功能。
 * 参考 Trae/Cursor 等编辑器体验：对话面板保持简洁直观，
 * 不提供对话区域的折叠切换，确保用户始终能查看到对话内容。
 */
export const ConversationLayer: React.FC<ConversationLayerProps> = ({
  streaming,
  children,
}) => {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      {streaming && (
        <div className="shrink-0 px-3 py-1 text-[10px] text-blue-500 bg-blue-50/50 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          流式输出中
        </div>
      )}
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
};
