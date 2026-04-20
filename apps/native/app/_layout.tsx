import "@/global.css";
import Constants from "expo-constants";
import { Caveat_700Bold } from "@expo-google-fonts/caveat";
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
import { focusManager, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { HeroUINativeProvider } from "heroui-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { authClient } from "@/lib/auth-client";
import { AppThemeProvider } from "@/contexts/app-theme-context";
import { queryClient, trpc } from "@/utils/trpc";
import { useNotificationTapHandler } from "@/hooks/use-notification-tap-handler";
import { OnboardingModal } from "@/components/onboarding-modal"; // edge-case: complete but no identity

SplashScreen.preventAutoHideAsync();

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
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") return;

        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
        registerToken.mutate({ token: tokenData.data, platform });
      } catch {
        // Push token unavailable (simulator or missing EAS projectId) — non-fatal
      }
    }

    void register();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);
}

function AuthGuard() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const segments = useSegments();
  const navigationReady = !!useRootNavigationState()?.key;

  useNotificationCategories();
  useDeviceTokenRegistration(!!session);
  useNotificationTapHandler();

  // Refetch stale queries on route change
  useEffect(() => {
    void queryClient.refetchQueries({ type: "active", stale: true });
  }, [segments]);

  useEffect(() => {
    console.log("[AuthGuard] state:", {
      navigationReady,
      isPending,
      session: session ? "signed-in" : session === null ? "signed-out" : "loading",
      segments,
    });

    if (!navigationReady || isPending) return;

    const inEnrolment = segments[0] === "enrolment";
    const atRoot = segments.length === 0;

    console.log("[AuthGuard] routing:", { inEnrolment, atRoot });

    if (!session && !inEnrolment) {
      console.log("[AuthGuard] → /enrolment (not signed in)");
      router.replace("/enrolment");
    } else if (session && inEnrolment) {
      console.log("[AuthGuard] → /(tabs) (signed in)");
      queryClient.clear();
      router.replace("/(tabs)/suggestions");
    } else {
      console.log("[AuthGuard] no redirect needed");
    }
  }, [navigationReady, isPending, session, segments]);

  return null;
}

function StackLayout() {
  return (
    <Stack screenOptions={{}}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="enrolment" options={{ headerShown: false }} />

      <Stack.Screen name="partner/[id]" options={{ title: "Partner Profile" }} />
      <Stack.Screen name="chat/[conversationId]" options={{ title: "Chat" }} />
      <Stack.Screen name="respond-meetup" options={{ title: "Respond to Proposal" }} />
      <Stack.Screen name="flag-user" options={{ title: "Report Student", presentation: "modal" }} />
    </Stack>
  );
}

export default function Layout() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (Platform.OS !== "web") {
        focusManager.setFocused(status === "active");
      }
    });
    return () => subscription.remove();
  }, []);

  const [fontsLoaded] = useFonts({
    Caveat_700Bold,
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
    console.log("[Layout] fontsLoaded:", fontsLoaded);
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
              <OnboardingModal />
              <StackLayout />
            </HeroUINativeProvider>
          </AppThemeProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
