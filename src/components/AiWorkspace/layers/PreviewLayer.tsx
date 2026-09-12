import React, { useMemo } from "react";
import type { ActionPreview } from "../../../store/aiRuntimeStore";
import { LayerHeader } from "../shared/LayerHeader";

type PreviewLayerProps = {
  expanded: boolean;
  onToggle: () => void;
  previews: ActionPreview[];
};

const actionIcons: Record<string, string> = {
  create_record: "➕",
  update_record: "✏️",
  delete_record: "🗑️",
  batch_create: "📦",
  batch_update: "📝",
  batch_delete: "🔥",
  custom: "⚙️",
};

const actionLabels: Record<string, string> = {
  create_record: "创建记录",
  update_record: "更新记录",
  delete_record: "删除记录",
  batch_create: "批量创建",
  batch_update: "批量更新",
  batch_delete: "批量删除",
  custom: "自定义操作",
};

export const PreviewLayer: React.FC<PreviewLayerProps> = ({
  expanded,
  onToggle,
  previews,
}) => {
  const dangerousCount = useMemo(
    () => previews.filter((p) => p.isDangerous).length,
    [previews]
  );

  const totalAffected = useMemo(
    () => previews.reduce((sum, p) => sum + p.affectedCount, 0),
    [previews]
  );

  return (
    <div className="border-b border-gray-100">
      <LayerHeader
        title="数据预览"
        icon={
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3C4.5 3 1.5 5.5 0 8c1.5 2.5 4.5 5 8 5s6.5-2.5 8-5c-1.5-2.5-4.5-5-8-5zm0 8.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7zm0-5.5a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
        }
        expanded={expanded}
        onToggle={onToggle}
        badge={previews.length}
        status={
          <>
            {totalAffected > 0 && (
              <span className="text-[10px] text-gray-500">
                {totalAffected} 行受影响
              </span>
            )}
            {dangerousCount > 0 && (
              <span className="text-[10px] text-red-500 font-medium">
                {dangerousCount} 危险
              </span>
            )}
          </>
        }
      />
      {expanded && (
        <div className="px-3 pb-3 space-y-2 max-h-80 overflow-y-auto">
          {previews.map((preview) => (
            <div
              key={preview.previewId}
              className={`rounded-lg border overflow-hidden ${
                preview.isDangerous
                  ? "border-red-200 bg-red-50/30"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{actionIcons[preview.action] ?? "⚙️"}</span>
                  <span className="text-xs font-medium text-gray-700">
                    {actionLabels[preview.action] ?? preview.action}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {preview.skillName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">
                    {preview.affectedCount} 条
                  </span>
                  {preview.isDangerous && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                      ⚠️ 危险操作
                    </span>
                  )}
                </div>
              </div>

              {preview.isDangerous && preview.dangerReason && (
                <div className="px-3 py-1.5 bg-red-50 text-[11px] text-red-600">
                  {preview.dangerReason}
                </div>
              )}

              <div className="p-2 space-y-1">
                <div className="text-xs text-gray-500 mb-1">{preview.summary}</div>

                {preview.recordChanges.slice(0, 5).map((change, idx) => (
                  <div
                    key={change.recordId ?? idx}
                    className="bg-gray-50 rounded-md p-2 border border-gray-100"
                  >
                    {change.recordTitle && (
                      <div className="text-[11px] font-medium text-gray-700 mb-1">
                        {change.recordTitle}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {Object.entries(change.changes).slice(0, 8).map(([key, value]) => {
                        const original = change.originalValues[key];
                        const hasChanged = JSON.stringify(original) !== JSON.stringify(value);

                        return (
                          <div key={key} className="flex items-center gap-2 text-[11px]">
                            <span className="text-gray-500 w-20 flex-shrink-0 truncate">
                              {key}
                            </span>
                            {hasChanged ? (
                              <>
                                <span className="text-red-400 line-through truncate max-w-[100px]">
                                  {JSON.stringify(original)}
                                </span>
                                <span className="text-gray-300">→</span>
                                <span className="text-emerald-600 truncate max-w-[100px] font-medium">
                                  {JSON.stringify(value)}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-600 truncate">
                                {JSON.stringify(value)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {preview.recordChanges.length > 5 && (
                  <div className="text-[10px] text-gray-400 text-center pt-1">
                    还有 {preview.recordChanges.length - 5} 条变更...
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
