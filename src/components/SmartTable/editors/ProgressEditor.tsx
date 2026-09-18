import { useRef, useState, useCallback, useEffect } from "react";
import { ReactEditor } from "./ReactEditor";
import type { EditContext } from "@visactor/vtable-editors";

const ProgressEditorComponent = ({
  initialValue,
  max,
  onChange,
  onExit,
}: {
  initialValue: number | string | null | undefined;
  max: number;
  onChange: (val: number) => void;
  onExit: () => void;
}) => {
  const [percentage, setPercentage] = useState(() => {
    const numeric = Number(initialValue);
    const pct = Number.isFinite(numeric) && max > 0 
      ? Math.min(100, Math.max(0, (numeric / max) * 100)) 
      : 0;
    return Math.round(pct);
  });
  
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const calculatePercentage = useCallback((clientX: number) => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.min(100, Math.max(0, (x / rect.width) * 100));
    return Math.round(pct);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const newPct = calculatePercentage(e.clientX);
    setPercentage(newPct);
    onChange(Math.round((newPct / 100) * max));
  }, [calculatePercentage, max, onChange]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const newPct = calculatePercentage(e.clientX);
    setPercentage(newPct);
    onChange(Math.round((newPct / 100) * max));
  }, [calculatePercentage, isDragging, max, onChange]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setTimeout(() => onExit(), 150);
    }
  }, [isDragging, onExit]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setTimeout(() => onExit(), 150);
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging, onExit]);

  // Determine color based on percentage
  let barColor: string;
  if (percentage === 100) {
    barColor = "#3B82F6";
  } else if (percentage >= 70) {
    barColor = "#60A5FA";
  } else if (percentage >= 30) {
    barColor = "#93C5FD";
  } else {
    barColor = "#BFDBFE";
  }

  return (
    <div
      style={{
        padding: "0 10px",
        width: "100%",
        height: "100%",
        backgroundColor: "#fff",
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
        cursor: "pointer",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (isDragging) {
          setIsDragging(false);
          setTimeout(() => onExit(), 150);
        }
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        {/* Progress bar */}
        <div
          ref={barRef}
          style={{
            flex: 1,
            height: 8,
            backgroundColor: "#F3F4F6",
            borderRadius: 4,
            position: "relative",
            overflow: "visible",
          }}
        >
          {/* Filled bar */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${percentage}%`,
              backgroundColor: barColor,
              borderRadius: 4,
              transition: isDragging ? "none" : "width 0.1s ease",
            }}
          />
          
          {/* Thumb */}
          {percentage > 0 && percentage < 100 && (
            <div
              style={{
                position: "absolute",
                left: `${percentage}%`,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 16,
                height: 16,
                backgroundColor: "#fff",
                border: "2px solid #3B82F6",
                borderRadius: "50%",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                cursor: "grab",
              }}
            />
          )}
        </div>
        
        {/* Percentage text */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#111827",
            minWidth: 42,
            textAlign: "right",
          }}
        >
          {percentage}%
        </div>
      </div>
    </div>
  );
};

export class ProgressEditor extends ReactEditor {
  max: number = 100;

  onStart(context: EditContext<unknown, unknown>) {
    const table = (context as {
      table?: {
        getBodyColumnDefine: (
          col: number,
          row: number,
        ) => { max?: number } | undefined;
      };
    }).table;
    if (table && context.col !== undefined) {
      const colDef = table.getBodyColumnDefine(context.col, context.row);
      if (colDef && colDef.max) {
        this.max = colDef.max;
      }
    }
    super.onStart(context);
  }

  render() {
    if (!this.root) return;
    const normalizedValue =
      typeof this.value === "number" || typeof this.value === "string"
        ? this.value
        : this.value == null
        ? 0
        : Number(this.value) || 0;
    this.root.render(
      <ProgressEditorComponent
        initialValue={normalizedValue}
        max={this.max}
        onChange={(val) => (this.value = val)}
        onExit={() => this.onExit?.()}
      />,
    );
  }
}
