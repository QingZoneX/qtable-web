import type { CSSProperties, ReactNode } from "react";
import {
  AlignLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  FieldTimeOutlined,
  FunctionOutlined,
  LinkOutlined,
  MailOutlined,
  NodeIndexOutlined,
  NumberOutlined,
  OrderedListOutlined,
  PaperClipOutlined,
  PercentageOutlined,
  PhoneOutlined,
  PictureOutlined,
  QuestionCircleOutlined,
  StarOutlined,
  UserOutlined,
} from "@ant-design/icons";

/**
 * 字段类型 → 图标 的唯一映射。
 * 所有展示字段类型的位置都必须通过 <FieldTypeIcon /> 取图标，新增字段类型时只改这张表。
 * key 同时兼容后端/语义层返回的别名（long_text / multi_select / datetime 等）。
 * （值用元素而非组件，避免在渲染期动态创建组件。）
 */
const FIELD_TYPE_ICONS: Record<string, ReactNode> = {
  // 文本
  text: <AlignLeftOutlined />,
  long_text: <AlignLeftOutlined />,
  textarea: <AlignLeftOutlined />,
  // 数值
  number: <NumberOutlined />,
  // 单选 / 多选
  select: <CheckCircleOutlined />,
  single_select: <CheckCircleOutlined />,
  multiSelect: <CheckSquareOutlined />,
  multi_select: <CheckSquareOutlined />,
  // 日期
  date: <CalendarOutlined />,
  datetime: <CalendarOutlined />,
  // 人员与评分
  member: <UserOutlined />,
  rating: <StarOutlined />,
  // 链接类
  url: <LinkOutlined />,
  image: <PictureOutlined />,
  attachment: <PaperClipOutlined />,
  // 进度与时长
  progress: <PercentageOutlined />,
  duration: <FieldTimeOutlined />,
  // 联系方式
  email: <MailOutlined />,
  phone: <PhoneOutlined />,
  // 计算与关联
  formula: <FunctionOutlined />,
  relation: <NodeIndexOutlined />,
  autoNumber: <OrderedListOutlined />,
};

const UNKNOWN_FIELD_TYPE_ICON: ReactNode = <QuestionCircleOutlined />;

export type FieldTypeIconProps = {
  /** 字段类型（`FieldType` 或语义层别名，如 `long_text`）。 */
  type: unknown;
  className?: string;
  style?: CSSProperties;
};

/** 字段类型图标。默认继承父级文字颜色与字号，可用 style 微调。 */
export function FieldTypeIcon({ type, className, style }: FieldTypeIconProps) {
  const key = String(type ?? "").trim();
  return (
    <span className={className} style={style}>
      {FIELD_TYPE_ICONS[key] || UNKNOWN_FIELD_TYPE_ICON}
    </span>
  );
}
