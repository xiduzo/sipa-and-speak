import Constants from "expo-constants";
import { Platform } from "react-native";

type Subscription = { remove: () => void };

export type NotificationResponse = {
  notification: { request: { content: { data?: Record<string, unknown> | null; body?: string | null } } };
};

type NotificationReceived = {
  request: { content: { data?: Record<string, unknown> | null; body?: string | null } };
};

type NotificationsApi = {
  setNotificationCategoryAsync: (id: string, actions: Array<{ identifier: string; buttonTitle: string }>) => Promise<unknown>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (opts?: { projectId?: string }) => Promise<{ data: string }>;
  addNotificationReceivedListener: (cb: (n: NotificationReceived) => void) => Subscription;
  addNotificationResponseReceivedListener: (cb: (r: NotificationResponse) => void) => Subscription;
  getLastNotificationResponseAsync: () => Promise<NotificationResponse | null>;
};

const isExpoGoAndroid = Platform.OS === "android" && Constants.appOwnership === "expo";

const noopSubscription: Subscription = { remove: () => {} };

const stub: NotificationsApi = {
  setNotificationCategoryAsync: async () => undefined,
  requestPermissionsAsync: async () => ({ status: "denied" }),
  getExpoPushTokenAsync: async () => {
    throw new Error("Push notifications unavailable in Expo Go on Android");
  },
  addNotificationReceivedListener: () => noopSubscription,
  addNotificationResponseReceivedListener: () => noopSubscription,
  getLastNotificationResponseAsync: async () => null,
};

const impl: NotificationsApi = isExpoGoAndroid
  ? stub
  : (require("expo-notifications") as NotificationsApi);

export const {
  setNotificationCategoryAsync,
  requestPermissionsAsync,
  getExpoPushTokenAsync,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  getLastNotificationResponseAsync,
} = impl;
