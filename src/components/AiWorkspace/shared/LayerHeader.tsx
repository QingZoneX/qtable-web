import React from "react";

type LayerHeaderProps = {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  badge?: number;
  status?: React.ReactNode;
  actions?: React.ReactNode;
};

export const LayerHeader: React.FC<LayerHeaderProps> = ({
  title,
  icon,
  expanded,
  onToggle,
  badge,
  status,
  actions,
}) => {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-left group"
    >
      <svg
        className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${expanded ? "rotate-90" : ""}`}
        viewBox="0 0 16 16"
        fill="currentColor"
      >
        <path d="M6 4l6 4-6 4V4z" />
      </svg>
      <span className="text-gray-500 flex-shrink-0 w-4 h-4 flex items-center justify-center">
        {icon}
      </span>
      <span className="text-sm font-medium text-gray-700 flex-1">{title}</span>
      {badge != null && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold bg-blue-500 text-white">
          {badge}
        </span>
      )}
      {status}
      {actions && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
          {actions}
        </span>
      )}
    </button>
  );
};
