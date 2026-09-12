import { register } from "@visactor/vtable";
import { InputEditor } from "@visactor/vtable-editors";
import {
  TextEditor,
  SelectEditor,
  DateEditor,
  MultiSelectEditor,
  MemberSelectEditor,
  TaskTitleEditor,
  NumberEditor,
  UrlEditor,
  ImageEditor,
  RatingEditor,
  ProgressEditor,
  AttachmentEditor,
  RelationEditor,
} from "./editors";

export const registerCustomEditors = () => {
  const input_editor = new InputEditor();
  const textEditor = new TextEditor();
  const selectEditor = new SelectEditor();
  const multiSelectEditor = new MultiSelectEditor();
  const memberSelectEditor = new MemberSelectEditor();
  const dateEditor = new DateEditor();
  const taskTitleEditor = new TaskTitleEditor();
  const numberEditor = new NumberEditor();
  const urlEditor = new UrlEditor();
  const imageEditor = new ImageEditor();
  const ratingEditor = new RatingEditor();
  const progressEditor = new ProgressEditor();
  const attachmentEditor = new AttachmentEditor();
  const relationEditor = new RelationEditor();

  register.editor("input-editor", input_editor);
  register.editor("text-editor", textEditor);
  register.editor("select-editor", selectEditor);
  register.editor("multi-select-editor", multiSelectEditor);
  register.editor("member-editor", memberSelectEditor);
  register.editor("date-editor", dateEditor);
  register.editor("task-title-editor", taskTitleEditor);
  register.editor("number-editor", numberEditor);
  register.editor("url-editor", urlEditor);
  register.editor("image-editor", imageEditor);
  register.editor("rating-editor", ratingEditor);
  register.editor("progress-editor", progressEditor);
  register.editor("attachment-editor", attachmentEditor);
  register.editor("relation-editor", relationEditor);
};
