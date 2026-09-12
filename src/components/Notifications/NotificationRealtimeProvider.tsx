import { useQuery } from "@apollo/client/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { client } from "../../lib/apollo";
import {
  NOTIFICATION_UNREAD_COUNT,
  NOTIFICATION_UPDATES,
} from "./notificationGraphql";
import {
  NotificationRealtimeContext,
  dispatchNotificationChange,
} from "./notificationRealtime";
import type { NotificationUpdate } from "./types";

const CHANNEL_NAME = "qtable-notifications-v1";

const resolveTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export function NotificationRealtimeProvider({ children }: { children: ReactNode }) {
  const [timezone] = useState(resolveTimezone);
  const [liveUnreadCount, setLiveUnreadCount] = useState<number | null>(null);
  const [eventVersion, setEventVersion] = useState(0);

  const {
    data: unreadData,
    refetch: refetchUnread,
  } = useQuery<{ notificationUnreadCount: number }>(NOTIFICATION_UNREAD_COUNT, {
    variables: { timezone },
    fetchPolicy: "cache-and-network",
    notifyOnNetworkStatusChange: true,
  });

  const refreshUnread = useCallback(async () => {
    const result = await refetchUnread({ timezone });
    const next = Number(result.data?.notificationUnreadCount || 0);
    setLiveUnreadCount(next);
    return next;
  }, [refetchUnread, timezone]);

  useEffect(() => {
    const observable = client.subscribe<{ notificationUpdates: NotificationUpdate }>({
      query: NOTIFICATION_UPDATES,
      variables: { timezone },
      fetchPolicy: "no-cache",
    });
    const subscription = observable.subscribe({
      next: (result) => {
        const update = result.data?.notificationUpdates;
        if (!update) return;
        setLiveUnreadCount(Number(update.unreadCount || 0));
        setEventVersion((value) => value + 1);
        dispatchNotificationChange();
        if (typeof BroadcastChannel !== "undefined") {
          const channel = new BroadcastChannel(CHANNEL_NAME);
          channel.postMessage({ kind: update.kind, updatedAt: update.updatedAt });
          channel.close();
        }
      },
      error: () => {
        void refreshUnread();
      },
    });
    return () => subscription.unsubscribe();
  }, [refreshUnread, timezone]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return undefined;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = () => {
      setEventVersion((value) => value + 1);
      dispatchNotificationChange();
      void refreshUnread();
    };
    return () => channel.close();
  }, [refreshUnread]);

  useEffect(() => {
    const onFocus = () => {
      dispatchNotificationChange();
      void refreshUnread();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      dispatchNotificationChange();
      void refreshUnread();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshUnread]);

  const unreadCount =
    liveUnreadCount ?? Number(unreadData?.notificationUnreadCount || 0);

  const value = useMemo(
    () => ({ unreadCount, eventVersion, timezone, refreshUnread }),
    [eventVersion, refreshUnread, timezone, unreadCount],
  );

  return (
    <NotificationRealtimeContext.Provider value={value}>
      {children}
    </NotificationRealtimeContext.Provider>
  );
}
