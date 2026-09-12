import {
  BellOutlined,
  ClockCircleOutlined,
  CommentOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { notificationLocale, notificationT } from "./notificationI18n";
import type { NotificationType } from "./types";

export const notificationTypeMeta = (
  type: NotificationType | string,
): { label: string; tone: string; icon: ReactNode } => {
  switch (type) {
    case "comment_mention":
      return { label: notificationT("type.mention"), tone: "primary", icon: <CommentOutlined /> };
    case "comment_reply":
      return { label: notificationT("type.reply"), tone: "primary", icon: <CommentOutlined /> };
    case "task_assigned":
      return { label: notificationT("type.assigned"), tone: "success", icon: <UserAddOutlined /> };
    case "due_24h":
      return { label: notificationT("type.due24h"), tone: "warning", icon: <ClockCircleOutlined /> };
    case "due_3d":
      return { label: notificationT("type.due3d"), tone: "warning", icon: <ClockCircleOutlined /> };
    case "ai_action_required":
      return { label: notificationT("type.aiRequired"), tone: "ai", icon: <RobotOutlined /> };
    case "automation":
      return { label: notificationT("type.automation"), tone: "warning", icon: <ThunderboltOutlined /> };
    case "automation_failed":
      return { label: notificationT("type.automationFailed"), tone: "danger", icon: <ThunderboltOutlined /> };
    default:
      return { label: notificationT("type.notification"), tone: "neutral", icon: <BellOutlined /> };
  }
};

export const relativeTime = (value?: string | null) => {
  if (!value) return "";
  const target = dayjs(value);
  if (!target.isValid()) return "";
  const seconds = Math.max(0, dayjs().diff(target, "second"));
  if (seconds < 45) return notificationT("time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return notificationT("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return notificationT("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return notificationT("time.daysAgo", { count: days });
  return new Intl.DateTimeFormat(notificationLocale(), {
    year: target.year() === dayjs().year() ? undefined : "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(target.toDate());
};

export const exactTime = (value?: string | null) => {
  if (!value) return "";
  const target = dayjs(value);
  if (!target.isValid()) return "";
  return new Intl.DateTimeFormat(notificationLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(target.toDate());
};

export const getNotificationTypeOptions = () => [
  { value: "comment_mention", label: notificationT("type.mention") },
  { value: "comment_reply", label: notificationT("type.reply") },
  { value: "task_assigned", label: notificationT("type.assigned") },
  { value: "due_24h", label: notificationT("type.due24h") },
  { value: "due_3d", label: notificationT("type.due3d") },
  { value: "ai_action_required", label: notificationT("type.aiRequired") },
  { value: "automation", label: notificationT("type.automation") },
  { value: "automation_failed", label: notificationT("type.automationFailed") },
];
