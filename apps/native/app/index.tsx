/**
 * Standalone onboarding screen — thin chrome over the shared wizard.
 *
 * Behaviour lives in `useOnboardingFlow` (@/hooks/use-onboarding-flow), the
 * JSX in `OnboardingWizardBody` (@/components/onboarding-wizard). This surface
 * only owns what is genuinely its own: routing (redirect home when onboarding
 * is already complete, navigate home on finish/skip), the always-visible
 * header Skip that saves a partial profile, and the gold proficiency-block
 * colourway.
 */
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spinner } from "heroui-native";

import { OnboardingWizardBody } from "@/components/onboarding-wizard";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { authClient } from "@/lib/auth-client";

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: session } = authClient.useSession();

  const flow = useOnboardingFlow({
    sessionUserId: session?.user?.id,
    onFinished: () => router.replace("/(tabs)/home"),
    onSkipped: () => router.replace("/(tabs)/home"),
  });

  useEffect(() => {
    if (flow.statusPending || flow.statusFetching) return;
    if (flow.statusComplete) router.replace("/(tabs)/home");
  }, [flow.statusComplete, flow.statusPending, flow.statusFetching]);

  if (flow.statusPending) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Spinner />
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-background"
      style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <OnboardingWizardBody
        flow={flow}
        levelVariant="gold"
        learningAddLabel="+ Add another"
        headerAccessory={
          <Pressable onPress={flow.skipWizard} disabled={flow.isSaving}>
            <Text className="font-manrope-semi text-[15px] text-foreground">Skip</Text>
          </Pressable>
        }
      />
    </View>
  );
}
