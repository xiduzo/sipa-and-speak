/**
 * Overlay onboarding wizard — thin chrome over the shared wizard.
 *
 * Behaviour lives in `useOnboardingFlow` (@/hooks/use-onboarding-flow), the
 * JSX in `OnboardingWizardBody` (@/components/onboarding-wizard). This surface
 * only owns what is genuinely its own: the full-screen `Modal` presentation,
 * the visibility rule (shows whenever onboarding or the identity profile is
 * incomplete — including the 2-step identity-only run), the step-2-only header
 * Skip, and the dark proficiency-block colourway.
 */
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingWizardBody } from "@/components/onboarding-wizard";
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";
import { authClient } from "@/lib/auth-client";

export function OnboardingModal() {
  const { data: session } = authClient.useSession();
  const insets = useSafeAreaInsets();

  const flow = useOnboardingFlow({
    sessionUserId: session?.user?.id,
    statusQueryEnabled: !!session,
  });

  const visible =
    !!session &&
    !flow.statusPending &&
    (!flow.statusComplete || !flow.identityProfileComplete);

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View
        className="flex-1 bg-background"
        style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <OnboardingWizardBody
          flow={flow}
          levelVariant="dark"
          headerAccessory={
            flow.step === 2 && flow.needsFullOnboarding ? (
              <Pressable onPress={flow.skipPhoto}>
                <Text className="font-manrope-semi text-[15px] text-foreground">Skip</Text>
              </Pressable>
            ) : undefined
          }
        />
      </View>
    </Modal>
  );
}
