import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToast } from "heroui-native";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";
import { extractNameFromEmail } from "@/utils/email-name-extract";
import { pickAndEncodeProfilePicture } from "@/utils/profile-picture";

const GOLD = "#F2C94C";
const BORDER = "#D9C9BC";

function GoldButton({
  onPress,
  disabled,
  label,
}: {
  onPress: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: disabled ? "#D4C898" : pressed ? "#DFB83A" : GOLD,
        borderRadius: 50,
        paddingVertical: 18,
        alignItems: "center",
        opacity: disabled ? 0.7 : 1,
      })}
    >
      <Text
        className="font-manrope-bold text-[17px] tracking-[0.3px]"
        style={{ color: disabled ? "#8A7570" : "#2C1810" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function GhostButton({
  onPress,
  label,
}: {
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable onPress={onPress} className="items-center py-2.5">
      <Text className="font-manrope-md text-sm underline" style={{ color: "#8A7570" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function OnboardingModal() {
  const { data: session } = authClient.useSession();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const onboardingStatus = useQuery({
    ...trpc.profile.getOnboardingStatus.queryOptions(),
    enabled: !!session,
  });

  const profileQuery = useQuery({
    ...trpc.profile.getMyProfile.queryOptions(),
    enabled: !!session,
  });

  const [step, setStep] = useState<1 | 2>(1);
  const [nameInput, setNameInput] = useState("");
  const [surnameInput, setSurnameInput] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || !profileQuery.data) return;
    const identity = profileQuery.data.identity;
    if (identity?.name || identity?.surname) {
      setNameInput(identity.name ?? "");
      setSurnameInput(identity.surname ?? "");
    } else {
      const { name, surname } = extractNameFromEmail(identity?.email ?? "");
      setNameInput(name);
      setSurnameInput(surname);
    }
    setImageUri(identity?.image ?? undefined);
    setInitialized(true);
  }, [profileQuery.data, initialized]);

  const setIdentityMutation = useMutation({
    ...trpc.profile.setIdentityProfile.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e) => {
      toast.show({ variant: "danger", label: (e as { message?: string }).message ?? "Failed to save." });
    },
  });

  const visible =
    !!session &&
    !onboardingStatus.isPending &&
    onboardingStatus.data?.identityProfileComplete === false;

  if (!visible) return null;

  async function handleStep1Continue() {
    const name = nameInput.trim();
    const surname = surnameInput.trim();
    if (!name) {
      Alert.alert("Name required", "Please enter your first name.");
      return;
    }
    if (!surname) {
      Alert.alert("Surname required", "Please enter your surname.");
      return;
    }
    setIdentityMutation.mutate({ name, surname, imageUrl: imageUri });
    setStep(2);
  }

  async function handlePickPicture() {
    const result = await pickAndEncodeProfilePicture();
    if (result.error) {
      toast.show({ variant: "danger", label: result.error });
      return;
    }
    if (result.imageDataUri) {
      setImageUri(result.imageDataUri);
      const name = nameInput.trim();
      const surname = surnameInput.trim();
      if (name && surname) {
        setIdentityMutation.mutate({ name, surname, imageUrl: result.imageDataUri });
      }
    }
  }

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View
        className="flex-1 bg-background"
        style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {step === 1 ? (
            <ScrollView
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardShouldPersistTaps="handled"
            >
              <View className="flex-1 px-6 pt-[72px] pb-10">
                <View className="mb-10">
                  <Text className="font-manrope-semi text-[11px] tracking-[2px] text-brand-muted-foreground uppercase mb-2">
                    Step 1 of 2
                  </Text>
                  <Text className="font-caveat text-[42px] text-foreground leading-[46px]">
                    {"How should\npeople greet you?"}
                  </Text>
                  <Text className="font-manrope text-[15px] text-brand-muted-foreground italic mt-3 leading-[22px]">
                    Pulled from TU/e. Change if you go by something else.
                  </Text>
                </View>

                <View className="gap-4">
                  <View className="gap-2">
                    <Text className="font-manrope-semi text-[11px] tracking-[1.8px] text-brand-muted-foreground uppercase">
                      First name
                    </Text>
                    <TextInput
                      value={nameInput}
                      onChangeText={setNameInput}
                      placeholder="Anna"
                      placeholderTextColor={BORDER}
                      autoCapitalize="words"
                      returnKeyType="next"
                      className="font-manrope-md text-[17px] text-foreground bg-brand-input rounded-2xl px-5 py-4"
                      style={{ borderWidth: 2, borderColor: BORDER }}
                    />
                  </View>

                  <View className="gap-2">
                    <Text className="font-manrope-semi text-[11px] tracking-[1.8px] text-brand-muted-foreground uppercase">
                      Surname
                    </Text>
                    <TextInput
                      value={surnameInput}
                      onChangeText={setSurnameInput}
                      placeholder="de Vries"
                      placeholderTextColor={BORDER}
                      autoCapitalize="words"
                      returnKeyType="done"
                      onSubmitEditing={handleStep1Continue}
                      className="font-manrope-md text-[17px] text-foreground bg-brand-input rounded-2xl px-5 py-4"
                      style={{ borderWidth: 2, borderColor: BORDER }}
                    />
                  </View>
                </View>

                <View className="flex-1" />
                <GoldButton
                  onPress={handleStep1Continue}
                  disabled={setIdentityMutation.isPending}
                  label={setIdentityMutation.isPending ? "Saving…" : "Continue →"}
                />
              </View>
            </ScrollView>
          ) : (
            <View className="flex-1">
              <View className="px-6 pt-[72px] mb-10">
                <Text className="font-manrope-semi text-[11px] tracking-[2px] text-brand-muted-foreground uppercase mb-2">
                  Step 2 of 2
                </Text>
                <Text className="font-caveat text-[42px] text-foreground leading-[46px]">
                  {"Add a face\nto your name."}
                </Text>
                <Text className="font-manrope text-[15px] text-brand-muted-foreground italic mt-3 leading-[22px]">
                  So your partner can spot you across the café.
                </Text>
              </View>

              <View className="flex-1 items-center justify-center gap-4">
                <Pressable onPress={handlePickPicture}>
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      className="w-[180px] h-[180px] rounded-full"
                      style={{ borderWidth: 3, borderColor: GOLD }}
                    />
                  ) : (
                    <View
                      className="w-[180px] h-[180px] rounded-full bg-brand-input items-center justify-center"
                      style={{ borderWidth: 3, borderColor: GOLD }}
                    >
                      <Text className="text-[40px] text-brand-muted-foreground">+</Text>
                    </View>
                  )}
                </Pressable>
                <Text className="font-manrope text-sm text-brand-muted-foreground">
                  Tap to upload or take a photo
                </Text>
              </View>

              <View className="px-6 pb-8 gap-3">
                <GoldButton onPress={() => queryClient.invalidateQueries()} label="Done →" />
                <GhostButton onPress={() => queryClient.invalidateQueries()} label="Skip for now" />
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
