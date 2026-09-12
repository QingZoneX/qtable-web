import { createContext, useContext } from "react";

export type NotificationRealtimeContextValue = {
  unreadCount: number;
  eventVersion: number;
  timezone: string;
  refreshUnread: () => Promise<number>;
};

export const NOTIFICATION_CHANGE_EVENT = "qtable:notification-change";

export const NotificationRealtimeContext =
  createContext<NotificationRealtimeContextValue | null>(null);

export const dispatchNotificationChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NOTIFICATION_CHANGE_EVENT));
};

export function useNotificationRealtime() {
  const value = useContext(NotificationRealtimeContext);
  if (!value) {
    throw new Error(
      "useNotificationRealtime must be used inside NotificationRealtimeProvider",
    );
  }
  return value;
}
