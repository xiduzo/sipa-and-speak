import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";

export function useNotificationTapHandler() {
  const router = useRouter();

  function handleNotificationResponse(response: Notifications.NotificationResponse) {
    const data = response.notification.request.content.data as Record<string, unknown> | undefined;
    const matchRequestId = typeof data?.matchRequestId === "string" ? data.matchRequestId : undefined;
    const requesterId = typeof data?.requesterId === "string" ? data.requesterId : undefined;

    if (!matchRequestId || !requesterId) return;

    router.push(`/partner/${requesterId}?matchRequestId=${matchRequestId}`);
  }

  useEffect(() => {
    // Background / foreground tap listener
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    // Cold-start: check if the app was opened by a notification tap
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });

    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
