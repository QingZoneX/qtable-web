import type { EditContext } from "@visactor/vtable-editors";
import { useSmartTableStore } from "../../../store/useSmartTableStore";
import { RelationRecordSelect } from "../relation/RelationRecordSelect";
import { ReactEditor } from "./ReactEditor";
import "./editorStyles.css";

type RelationColumnDef = {
  relationFieldId?: string;
  relationMultiple?: boolean;
};

export class RelationEditor extends ReactEditor {
  sourceTableId = "";
  fieldId = "";
  multiple = true;

  onStart(context: EditContext<unknown, unknown>) {
    this.sourceTableId = useSmartTableStore.getState().currentTableId || "";
    const table = (
      context as {
        table?: {
          getBodyColumnDefine: (
            col: number,
            row: number,
          ) => RelationColumnDef | undefined;
        };
      }
    ).table;
    if (table && context.col !== undefined) {
      const column = table.getBodyColumnDefine(context.col, context.row);
      this.fieldId = column?.relationFieldId || "";
      this.multiple = column?.relationMultiple !== false;
    }
    super.onStart(context);
  }

  render() {
    if (!this.root) return;
    if (!this.sourceTableId || !this.fieldId) {
      this.root.render(<div style={{ padding: 8 }}>关联字段配置无效</div>);
      return;
    }
    this.root.render(
      <div
        style={{
          width: "100%",
          minHeight: this.baseHeight || 40,
          padding: 2,
          border: "2px solid #2563EB",
          borderRadius: 4,
          background: "#fff",
          boxSizing: "border-box",
        }}
      >
        <RelationRecordSelect
          tableId={this.sourceTableId}
          fieldId={this.fieldId}
          value={this.value}
          multiple={this.multiple}
          autoFocus
          defaultOpen
          onChange={(next) => {
            this.value = next;
          }}
          onCommit={() => this.onExit?.()}
        />
      </div>,
    );
  }
}
