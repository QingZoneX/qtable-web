import React, { useEffect, useRef, useImperativeHandle } from "react";
import { ListTable } from "@visactor/vtable";

interface TableRow {
  id: string;
  username: string;
  email: string;
}

interface TableProps {
  data: TableRow[];
  // React 19 allows accessing ref directly from props
  ref?: React.Ref<{ scrollToRow: (index: number) => void }>;
}

export function Table({ data, ref }: TableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableInstanceRef = useRef<ListTable | null>(null);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    scrollToRow: (index: number) => {
      if (tableInstanceRef.current) {
        tableInstanceRef.current.scrollToRow(index);
      }
    },
  }));

  useEffect(() => {
    if (containerRef.current) {
      const tableInstance = new ListTable(containerRef.current, {
        records: data,
        columns: [
          { field: "id", title: "ID", width: 80 },
          { field: "username", title: "Username", width: 150 },
          { field: "email", title: "Email", width: 200 },
        ],
        widthMode: "standard",
        autoFillWidth: true,
      });
      tableInstanceRef.current = tableInstance;
    }

    return () => {
      if (tableInstanceRef.current) {
        tableInstanceRef.current.release();
      }
    };
  }, [data]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "400px", border: "1px solid #ccc" }}
    />
  );
}
