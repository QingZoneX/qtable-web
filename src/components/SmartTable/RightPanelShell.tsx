import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Typography } from "antd";

const { Text } = Typography;

type RightPanelShellProps = {
  open: boolean;
  title: string;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  resizable?: boolean;
  onWidthChange?: (width: number) => void;
  extra?: ReactNode;
  children: ReactNode;
  bodyStyle?: CSSProperties;
};

const clampWidth = (width: number, minWidth: number, maxWidth: number) =>
  Math.min(Math.max(width, minWidth), maxWidth);

export function RightPanelShell({
  open,
  title,
  width = 400,
  minWidth = 360,
  maxWidth = 760,
  resizable = false,
  onWidthChange,
  extra,
  children,
  bodyStyle,
}: RightPanelShellProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!open || !resizable) return;
    event.preventDefault();

    const startX = event.clientX;
    const startWidth = shellRef.current?.getBoundingClientRect().width ?? width;
    let nextWidth = startWidth;
    let rafId: number | null = null;

    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const deltaX = startX - moveEvent.clientX;
        nextWidth = clampWidth(startWidth + deltaX, minWidth, maxWidth);
        onWidthChange?.(nextWidth);
      });
    };

    const handleMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setIsResizing(false);
      onWidthChange?.(nextWidth);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <aside
      ref={shellRef}
      aria-hidden={!open}
      style={{
        width: open ? width : 0,
        minWidth: open ? width : 0,
        maxWidth: open ? width : 0,
        height: "100%",
        background: "#fff",
        borderLeft: open ? "1px solid #EAECF0" : "none",
        boxShadow: open ? "-4px 0 16px rgba(15, 23, 42, 0.06)" : "none",
        overflow: "hidden",
        transition: isResizing ? "none" : "width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {open && resizable && (
        <div
          onMouseDown={handleResizeStart}
          onDoubleClick={() => onWidthChange?.(480)}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            cursor: "col-resize",
            zIndex: 2,
            background: isResizing
              ? "linear-gradient(180deg, rgba(37, 99, 235, 0.12), rgba(37, 99, 235, 0.2))"
              : "transparent",
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 16px 11px",
          borderBottom: "1px solid #EAECF0",
          flexShrink: 0,
        }}
      >
        <Text strong style={{ fontSize: 16, whiteSpace: "nowrap" }}>
          {title}
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {extra}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          ...bodyStyle,
        }}
      >
        {children}
      </div>
    </aside>
  );
}
