import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { EditContext, IEditor } from "@visactor/vtable-editors";

export class ReactEditor implements IEditor {
  element: HTMLElement;
  container: HTMLElement | null = null;
  root: Root | null = null;
  value: unknown;
  onChange: ((val: unknown) => void) | null = null;
  onExit: (() => void) | null = null;
  baseHeight: number = 0;
  protected editContext: EditContext<unknown, unknown> | null = null;

  constructor() {
    this.element = document.createElement("div");
    this.element.style.position = "absolute";
    this.element.style.padding = "0";
    this.element.style.boxSizing = "border-box";
    this.element.style.backgroundColor = "#fff";
    this.element.style.border = "none";
    this.element.style.outline = "none";
    this.element.style.boxShadow = "none";
    this.element.style.zIndex = "100";
  }

  onStart(context: EditContext<unknown, unknown>) {
    const { value, referencePosition, container, endEdit } = context;
    this.editContext = context;
    this.value = value;
    this.container = container;
    this.onExit = endEdit;

    // Position
    const { top, left, width, height } = referencePosition.rect;
    this.element.style.top = `${top}px`;
    this.element.style.left = `${left}px`;
    this.element.style.width = `${width}px`;
    this.element.style.minHeight = `${height}px`;
    this.element.style.height = `${height}px`;
    this.element.className = "vtable-editor-wrapper";
    this.element.style.overflow = "hidden";
    this.baseHeight = height;

    container.appendChild(this.element);
    this.root = createRoot(this.element);
    this.render();
  }

  render() {
    // To be implemented by subclasses
  }

  getValue() {
    return this.value;
  }

  onEnd() {
    const root = this.root;
    this.root = null;
    this.container = null;
    this.editContext = null;

    queueMicrotask(() => {
      try {
        root?.unmount();
      } catch {
        void 0;
      }

      try {
        const parent = this.element.parentNode as HTMLElement | null;
        if (parent) {
          parent.removeChild(this.element);
        }
      } catch {
        void 0;
      }
    });
  }

  setHeight(h: number) {
    this.element.style.height = `${h}px`;
  }

  isEditorElement(target: HTMLElement) {
    if (this.element.contains(target)) return true;
    if (target.closest(".vtable-editor-popup")) return true;
    return false;
  }
}
