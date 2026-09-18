import {
  alignLeftOutlinedSvg,
  calendarOutlinedSvg,
  checkSquareOutlinedSvg,
  fileOutlinedSvg,
  linkOutlinedSvg,
  pictureOutlinedSvg,
  radioOutlinedSvg,
  userOutlinedSvg,
} from "./icons";

/**
 * 字段类型 → SVG 字串 的唯一映射（canvas 用）。
 * 画布（VTable 自定义布局）只能吃 SVG data URL，不能渲染 React 组件，
 * 所以表头图标走这里；React 侧（下拉、Tag、列表）走 ./FieldTypeIcon.tsx。
 * 两者保持同一套语义。
 */

/**
 * 表头图标的渲染尺寸：右侧 6px 留白就是「图标与字段名称的间距」。
 * 必须把间距画进 SVG —— VRender 的 flex 布局既不读 margin 也不读 padding
 * （flex-layout-plugin 里 getPadding 恒返回 0），只能靠图本身的宽度占位。
 */
export const FIELD_TYPE_ICON_BOX = { width: 22, height: 16 };

const FIELD_TYPE_GLYPH_SIZE = 16;

/**
 * 把 16x16 的图标嵌进更宽的画布（左侧 16x16 原样，右侧留白）。
 * 内层用带 viewBox 的 <svg> 承载，1024 之类别的 viewBox 也能正确缩放。
 */
const withTrailingGap = (svg: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIELD_TYPE_ICON_BOX.width} ${FIELD_TYPE_ICON_BOX.height}">${svg.replace(
    /^<svg([^>]*)>/,
    (_match, attrs: string) =>
      `<svg${attrs.replace(
        /\s(?:width|height)="[^"]*"/g,
        "",
      )} x="0" y="0" width="${FIELD_TYPE_GLYPH_SIZE}" height="${FIELD_TYPE_GLYPH_SIZE}">`,
  )}</svg>`;

// —— icons.ts 里缺口的部分，风格与之一致（16x16、#9CA3AF）——
const hashNumberSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" stroke-width="1.3" stroke-linecap="round"><path d="M6.3 2.8L4.3 13.2"/><path d="M11.3 2.8L9.3 13.2"/><path d="M2.9 6.1h10.4"/><path d="M2.6 9.9h10.4"/></svg>`;
const starGreyOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#9CA3AF"><path d="M8 1.5l2.12 4.29 4.74.69-3.43 3.34.81 4.72L8 12.31l-4.24 2.23.81-4.72-3.43-3.34 4.74-.69L8 1.5z"/></svg>`;
const progressOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"><rect x="1.6" y="6.1" width="12.8" height="3.8" rx="1.9" stroke="#9CA3AF" stroke-width="1.2"/><rect x="3.2" y="7.3" width="4.6" height="1.5" rx="0.75" fill="#9CA3AF"/></svg>`;
const mailOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" stroke-width="1.2"><rect x="1.7" y="3.4" width="12.6" height="9.2" rx="1.6"/><path d="M2.4 4.7L8 8.9l5.6-4.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const mobileOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" stroke-width="1.2"><rect x="4.3" y="1.8" width="7.4" height="12.4" rx="1.8"/><path d="M7.1 12.4h1.8" stroke-linecap="round"/></svg>`;
const functionOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" stroke-width="1.3" stroke-linecap="round"><path d="M10.2 2.8c-2 0-2.4 2.3-3 5.2s-1 5.2-3 5.2"/><path d="M4.4 8h7.2"/></svg>`;
const numberedListOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#9CA3AF"><rect x="2" y="3.4" width="2.6" height="1.2" rx="0.6"/><rect x="6.4" y="3.4" width="7.6" height="1.2" rx="0.6"/><rect x="2" y="7.4" width="2.6" height="1.2" rx="0.6"/><rect x="6.4" y="7.4" width="7.6" height="1.2" rx="0.6"/><rect x="2" y="11.4" width="2.6" height="1.2" rx="0.6"/><rect x="6.4" y="11.4" width="7.6" height="1.2" rx="0.6"/></svg>`;
const relationOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" stroke-width="1.2"><rect x="1.7" y="2.6" width="4.8" height="3.8" rx="1.1"/><rect x="9.5" y="9.6" width="4.8" height="3.8" rx="1.1"/><path d="M4.1 6.4v4.2a1.6 1.6 0 0 0 1.6 1.6h3.8" stroke-linecap="round"/></svg>`;
const clockOutlinedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#9CA3AF" stroke-width="1.2" stroke-linecap="round"><circle cx="8" cy="8" r="6.1"/><path d="M8 4.6V8l2.4 1.6"/></svg>`;

/** 字段类型（含后端/语义层别名）→ 表头等画布位置用的 SVG 字串。 */
const FIELD_TYPE_ICON_SVGS: Record<string, string> = {
  // 文本
  text: alignLeftOutlinedSvg,
  long_text: alignLeftOutlinedSvg,
  textarea: alignLeftOutlinedSvg,
  // 数值
  number: hashNumberSvg,
  // 单选 / 多选
  select: radioOutlinedSvg,
  single_select: radioOutlinedSvg,
  multiSelect: checkSquareOutlinedSvg,
  multi_select: checkSquareOutlinedSvg,
  // 日期
  date: calendarOutlinedSvg,
  datetime: calendarOutlinedSvg,
  // 人员与评分
  member: userOutlinedSvg,
  rating: starGreyOutlinedSvg,
  // 链接类
  url: linkOutlinedSvg,
  image: pictureOutlinedSvg,
  attachment: fileOutlinedSvg,
  // 进度与时长
  progress: progressOutlinedSvg,
  duration: clockOutlinedSvg,
  // 联系方式
  email: mailOutlinedSvg,
  phone: mobileOutlinedSvg,
  // 计算与关联
  formula: functionOutlinedSvg,
  relation: relationOutlinedSvg,
  autoNumber: numberedListOutlinedSvg,
};

/** 取字段类型对应的 SVG 字串（画布用，已含右侧间距），未知类型回退为文本图标。 */
export const fieldTypeIconSvg = (type: unknown): string =>
  withTrailingGap(
    FIELD_TYPE_ICON_SVGS[String(type ?? "").trim()] || alignLeftOutlinedSvg,
  );
