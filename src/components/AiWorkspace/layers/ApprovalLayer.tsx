import React from "react";
import type { ConfirmRequest } from "../../../store/aiRuntimeStore";
import { LayerHeader } from "../shared/LayerHeader";

type ApprovalLayerProps = {
  expanded: boolean;
  onToggle: () => void;
  confirmRequests: ConfirmRequest[];
  onApprove: (confirmId: string) => void;
  onReject: (confirmId: string) => void;
};

export const ApprovalLayer: React.FC<ApprovalLayerProps> = ({
  expanded,
  onToggle,
  confirmRequests,
  onApprove,
  onReject,
}) => {
  const pendingCount = confirmRequests.filter(
    (c) => c.status === "pending"
  ).length;

  return (
    <div>
      <LayerHeader
        title="审批确认"
        icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.5 2a.5.5 0 01.5.5v11a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-11a.5.5 0 01.5-.5h11zM13 3H3v10h10V3zM4.5 8a.5.5 0 01.5-.5h6a.5.5 0 010 1H5a.5.5 0 01-.5-.5zM6.646 5.854a.5.5 0 01.708 0L8 6.293l.646-.647a.5.5 0 01.708.708L8.707 7l.647.646a.5.5 0 01-.708.708L8 7.707l-.646.647a.5.5 0 01-.708-.708L7.293 7l-.647-.646a.5.5 0 010-.708z" />
          </svg>
        }
        expanded={expanded}
        onToggle={onToggle}
        badge={pendingCount}
        status={
          pendingCount > 0 ? (
            <span className="text-[10px] text-amber-500 font-medium animate-pulse">
              待处理
            </span>
          ) : undefined
        }
      />
      {expanded && (
        <div className="px-3 pb-3 space-y-2 max-h-80 overflow-y-auto">
          {confirmRequests.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-3">
              暂无待审批项
            </div>
          ) : (
            confirmRequests.map((req) => {
              const isPending = req.status === "pending";
              const isApproved = req.status === "approved";
              const isRejected = req.status === "rejected";

              return (
                <div
                  key={req.confirmId}
                  className={`rounded-lg border overflow-hidden ${
                    isApproved
                      ? "border-emerald-200 bg-emerald-50/30"
                      : isRejected
                        ? "border-red-200 bg-red-50/30"
                        : "border-amber-200 bg-white"
                  }`}
                >
                  <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                      {isPending ? (
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[10px] font-bold">
                          ?
                        </span>
                      ) : isApproved ? (
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
                          ✓
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-bold">
                          ✗
                        </span>
                      )}
                      <span className="text-xs font-medium text-gray-700">
                        {req.preview?.summary ?? "操作确认"}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        isPending
                          ? "bg-amber-100 text-amber-700"
                          : isApproved
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {isPending ? "待确认" : isApproved ? "已通过" : "已拒绝"}
                    </span>
                  </div>

                  {req.preview && (
                    <div className="p-2 space-y-1">
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span>操作类型: {req.preview.action}</span>
                        <span>•</span>
                        <span>影响: {req.preview.affectedCount} 条记录</span>
                        {req.preview.isDangerous && (
                          <>
                            <span>•</span>
                            <span className="text-red-500 font-medium">⚠️ 危险操作</span>
                          </>
                        )}
                      </div>

                      {req.preview.recordChanges.slice(0, 3).map((change, idx) => (
                        <div
                          key={change.recordId ?? idx}
                          className="bg-gray-50 rounded p-1.5 border border-gray-100"
                        >
                          {change.recordTitle && (
                            <div className="text-[10px] font-medium text-gray-600 mb-0.5">
                              {change.recordTitle}
                            </div>
                          )}
                          <div className="space-y-0.5">
                            {Object.entries(change.changes).slice(0, 4).map(
                              ([key, value]) => (
                                <div
                                  key={key}
                                  className="flex items-center gap-2 text-[10px]"
                                >
                                  <span className="text-gray-400 w-16 truncate flex-shrink-0">
                                    {key}
                                  </span>
                                  <span className="text-gray-600 truncate">
                                    {JSON.stringify(value)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      ))}

                      {req.timeoutMs > 0 && isPending && (
                        <div className="text-[10px] text-amber-500 mt-1">
                          ⏱ 超时时间: {(req.timeoutMs / 1000).toFixed(0)}s
                        </div>
                      )}
                    </div>
                  )}

                  {isPending && (
                    <div className="flex border-t border-gray-100">
                      <button
                        onClick={() => onApprove(req.confirmId)}
                        className="flex-1 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z" />
                        </svg>
                        批准
                      </button>
                      <div className="w-px bg-gray-200" />
                      <button
                        onClick={() => onReject(req.confirmId)}
                        className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center gap-1"
                      >
                        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
                        </svg>
                        拒绝
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
