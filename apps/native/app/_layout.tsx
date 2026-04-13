import "@/global.css";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { queryClient, trpc } from "@/utils/trpc";
import { useNotificationTapHandler } from "@/hooks/use-notification-tap-handler";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(drawer)",
};

function useNotificationCategories() {
  useEffect(() => {
    void Notifications.setNotificationCategoryAsync("match_accepted", [
      { identifier: "connect_now", buttonTitle: "Connect Now" },
    ]);
  }, []);
}

function useDeviceTokenRegistration(isLoggedIn: boolean) {
  const registerToken = useMutation(trpc.profile.registerDeviceToken.mutationOptions());

  useEffect(() => {
    if (!isLoggedIn) return;

    async function register() {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
      registerToken.mutate({ token: tokenData.data, platform });
    }

    void register();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);
}

function AuthGuard() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const router = useRouter();
  const segments = useSegments();

  useNotificationCategories();
  useDeviceTokenRegistration(!!session);
  useNotificationTapHandler();

  const onboardingQuery = useQuery({
    ...trpc.profile.getOnboardingStatus.queryOptions(),
    enabled: !!session,
  });

  useEffect(() => {
    if (sessionPending) return;
    if (session && onboardingQuery.isPending) return;

    const onEnrolmentScreen = segments[0] === "enrolment";
    const onReviewScreen = segments[0] === "review-profile";

    const onOnboardingScreen = segments[0] === undefined;

    if (!session && !onEnrolmentScreen) {
      router.replace("/enrolment");
    } else if (session && onEnrolmentScreen) {
      if (onboardingQuery.data?.complete) {
        router.replace("/suggestions");
      } else {
        router.replace("/");
      }
    } else if (session && !onboardingQuery.data?.complete && !onOnboardingScreen && !onReviewScreen) {
      router.replace("/");
    }
  }, [session, sessionPending, onboardingQuery.data, onboardingQuery.isPending, segments]);

  return null;
}

function StackLayout() {
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="enrolment" options={{ title: "Enrol with TU/e", headerBackVisible: false }} />
      <Stack.Screen name="onboarding" options={{ title: "Set Up Your Profile", headerBackVisible: false }} />
      <Stack.Screen name="edit-profile" options={{ title: "Edit Profile" }} />
      <Stack.Screen name="review-profile" options={{ title: "Review Profile" }} />
      <Stack.Screen name="partner/[id]" options={{ title: "Partner Profile" }} />
      <Stack.Screen name="schedule/[partnerId]" options={{ title: "Schedule Meet-Up" }} />
      <Stack.Screen name="chat/[conversationId]" options={{ title: "Chat" }} />
      <Stack.Screen name="map" options={{ title: "Campus Map" }} />
      <Stack.Screen name="suggestions" options={{ title: "Suggestions" }} />
      <Stack.Screen name="modal" options={{ title: "Modal", presentation: "modal" }} />
    </Stack>
  );
}

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <AppThemeProvider>
            <HeroUINativeProvider>
              <AuthGuard />
              <StackLayout />
            </HeroUINativeProvider>
          </AppThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
