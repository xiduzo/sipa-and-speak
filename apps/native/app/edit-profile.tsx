import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Spinner, useToast } from "heroui-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { LanguagePickerModal } from "@/components/language-picker-modal";
import { queryClient, trpc } from "@/utils/trpc";
import { extractNameFromEmail } from "@/utils/email-name-extract";
import { pickAndEncodeProfilePicture } from "@/utils/profile-picture";

const GOLD = "#F2C94C";
const BORDER = "#D9C9BC";
const INPUT_BG = "#F5EFE8";
const GREEN = "#2D7A4F";
const TOTAL_STEPS = 5;
const MIN_INTERESTS = 3;
const MAX_INTERESTS = 7;

const LANGUAGE_FLAGS: Record<string, string> = {
  Afrikaans: "🇿🇦", Arabic: "🇸🇦", Bengali: "🇧🇩", Bulgarian: "🇧🇬",
  Catalan: "🏳️", Chinese: "🇨🇳", Croatian: "🇭🇷", Czech: "🇨🇿",
  Danish: "🇩🇰", Dutch: "🇳🇱", English: "🇬🇧", Estonian: "🇪🇪",
  Finnish: "🇫🇮", French: "🇫🇷", German: "🇩🇪", Greek: "🇬🇷",
  Hebrew: "🇮🇱", Hindi: "🇮🇳", Hungarian: "🇭🇺", Indonesian: "🇮🇩",
  Italian: "🇮🇹", Japanese: "🇯🇵", Korean: "🇰🇷", Latvian: "🇱🇻",
  Lithuanian: "🇱🇹", Malay: "🇲🇾", Mandarin: "🇨🇳", Norwegian: "🇳🇴",
  Persian: "🇮🇷", Polish: "🇵🇱", Portuguese: "🇵🇹", Romanian: "🇷🇴",
  Russian: "🇷🇺", Serbian: "🇷🇸", Slovak: "🇸🇰", Slovenian: "🇸🇮",
  Spanish: "🇪🇸", Swedish: "🇸🇪", Thai: "🇹🇭", Turkish: "🇹🇷",
  Ukrainian: "🇺🇦", Vietnamese: "🇻🇳",
};

function getFlag(lang: string) {
  return LANGUAGE_FLAGS[lang] ?? "🌐";
}

const PROFICIENCY_DOT_COUNT = 8;
const PROFICIENCY_FILL: Record<string, number> = {
  beginner: 2,
  intermediate: 4,
  advanced: 6,
  native: 8,
};
const PROFICIENCY_LABEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  native: "Native",
};

function ProficiencyDots({ level }: { level: string }) {
  const filled = PROFICIENCY_FILL[level] ?? 2;
  return (
    <View className="flex-row gap-1 items-center">
      {Array.from({ length: PROFICIENCY_DOT_COUNT }).map((_, i) => (
        <View
          key={i}
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: i < filled ? GREEN : BORDER }}
        />
      ))}
    </View>
  );
}

const SPOKEN_LEVELS = [
  { value: "beginner" as const, label: "Beginner" },
  { value: "intermediate" as const, label: "Intermediate" },
  { value: "advanced" as const, label: "Advanced" },
  { value: "native" as const, label: "Native" },
];

const LEARNING_LEVELS = [
  { value: "beginner" as const, label: "A1–A2", sub: "Beginner" },
  { value: "intermediate" as const, label: "B1–B2", sub: "Intermediate" },
  { value: "advanced" as const, label: "C1–C2", sub: "Advanced" },
];

const INTERESTS = [
  { value: "modern_art", label: "Art" },
  { value: "tech_coding", label: "Tech" },
  { value: "jazz_music", label: "Music" },
  { value: "culinary_arts", label: "Cooking" },
  { value: "sustainability", label: "Sustainability" },
  { value: "cinephile", label: "Film" },
  { value: "cosmology", label: "Science" },
  { value: "photography", label: "Photography" },
  { value: "board_games", label: "Board games" },
  { value: "hiking_outdoors", label: "Hiking" },
  { value: "yoga_wellness", label: "Yoga" },
  { value: "literature", label: "Books" },
  { value: "entrepreneurship", label: "Startups" },
  { value: "design_architecture", label: "Design" },
  { value: "travel", label: "Travel" },
  { value: "gaming", label: "Gaming" },
  { value: "fitness_sports", label: "Fitness" },
  { value: "philosophy", label: "Philosophy" },
  { value: "theatre", label: "Theatre" },
] as const;

function StepHeader({ step, onSkip, canSkip }: { step: number; onSkip?: () => void; canSkip: boolean }) {
  return (
    <View className="px-6 pt-4 gap-2.5">
      <View className="flex-row items-center justify-between">
        <Text
          className="font-manrope-semi text-[11px] tracking-[2px] uppercase"
          style={{ color: GOLD }}
        >
          About you · {step} of {TOTAL_STEPS}
        </Text>
        {canSkip && onSkip && (
          <Pressable onPress={onSkip} hitSlop={12}>
            <Text className="font-manrope-md text-[15px] text-brand-muted-foreground">
              Skip
            </Text>
          </Pressable>
        )}
      </View>
      <View className="flex-row gap-[5px]">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            className="flex-1 h-[3px] rounded-sm"
            style={{ backgroundColor: i < step ? GOLD : BORDER }}
          />
        ))}
      </View>
    </View>
  );
}

function StepHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="px-6 pt-8 mb-1">
      <Text className="font-jakarta text-[36px] text-foreground leading-[42px] tracking-[-0.5px]">
        {title}
      </Text>
      {subtitle && (
        <Text className="font-manrope text-[15px] text-brand-muted-foreground mt-2.5 leading-[22px]">
          {subtitle}
        </Text>
      )}
    </View>
  );
}

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

function GhostButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} className="items-center py-3">
      <Text className="font-manrope text-sm text-brand-muted-foreground">
        {label}
      </Text>
    </Pressable>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [nameInput, setNameInput] = useState("");
  const [surnameInput, setSurnameInput] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [identityInitialized, setIdentityInitialized] = useState(false);
  const [addingType, setAddingType] = useState<"spoken" | "learning" | null>(null);

  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());

  const setIdentityMutation = useMutation({
    ...trpc.profile.setIdentityProfile.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e) => {
      toast.show({ variant: "danger", label: (e as { message?: string }).message ?? "Failed to save." });
    },
  });

  const upsertMutation = useMutation({
    ...trpc.profile.upsertLanguage.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e) => {
      toast.show({ variant: "danger", label: (e as { message?: string }).message ?? "Failed to update language." });
    },
  });

  const removeMutation = useMutation({
    ...trpc.profile.removeLanguage.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => toast.show({ variant: "danger", label: "Failed to remove language." }),
  });

  const toggleInterestMutation = useMutation({
    ...trpc.profile.toggleInterest.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => toast.show({ variant: "danger", label: "Failed to update interest." }),
  });

  useEffect(() => {
    if (identityInitialized || !profileQuery.data) return;
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
    setIdentityInitialized(true);
  }, [profileQuery.data, identityInitialized]);

  const languages = profileQuery.data?.languages ?? [];
  const spokenLanguages = languages.filter((l) => l.type === "spoken");
  const learningLanguages = languages.filter((l) => l.type === "learning");
  const savedInterests = profileQuery.data?.interests ?? [];
  const allSelectedLanguages = languages.map((l) => l.language);
  const email = profileQuery.data?.identity?.email ?? "";

  function advanceTo(next: number) {
    setStep(next);
  }

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
    advanceTo(2);
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

  function handleFinish() {
    router.push("/review-profile");
  }

  if (profileQuery.isPending) {
    return (
      <View className="flex-1 bg-background items-center justify-center" style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <Spinner />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background" style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Step 1 — Name */}
        {step === 1 && (
          <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <View className="flex-1">
              <StepHeader step={1} canSkip={false} />
              <StepHeading
                title={"How should\npeople greet you?"}
                subtitle="Pulled from TU/e. Change if you go by something else."
              />

              <View className="px-6 pt-7 gap-4">
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
                  />
                </View>

                {email ? (
                  <Text className="font-manrope text-[13px] text-brand-muted-foreground">
                    {email}
                  </Text>
                ) : null}
              </View>

              <View className="flex-1" />
              <View className="px-6 pb-8">
                <GoldButton
                  onPress={handleStep1Continue}
                  disabled={setIdentityMutation.isPending}
                  label={setIdentityMutation.isPending ? "Saving…" : "Continue →"}
                />
              </View>
            </View>
          </ScrollView>
        )}

        {/* Step 2 — Photo */}
        {step === 2 && (
          <View className="flex-1">
            <StepHeader step={2} canSkip onSkip={() => advanceTo(3)} />
            <StepHeading
              title={"Add a face\nto your name."}
              subtitle="So your partner can spot you across the café."
            />

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

            <View className="px-6 pb-8">
              <GoldButton onPress={() => advanceTo(3)} label="Continue →" />
              <GhostButton onPress={() => advanceTo(3)} label="Or do this later" />
            </View>
          </View>
        )}

        {/* Step 3 — Spoken languages */}
        {step === 3 && (
          <View className="flex-1">
            <StepHeader step={3} canSkip onSkip={() => advanceTo(4)} />
            <StepHeading
              title={"What do\nyou speak?"}
              subtitle="Languages you can hold a conversation in."
            />

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              {spokenLanguages.map((sl) => (
                <View
                  key={sl.language}
                  className="bg-white rounded-2xl p-4 gap-3"
                  style={{
                    shadowColor: "#2C1810",
                    shadowOpacity: 0.04,
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 8,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5">
                      <Text className="text-[26px]">{getFlag(sl.language)}</Text>
                      <View>
                        <Text className="font-manrope-semi text-base text-foreground">
                          {sl.language}
                        </Text>
                        <Text className="font-manrope text-xs text-brand-muted-foreground">
                          {PROFICIENCY_LABEL[sl.proficiency] ?? sl.proficiency}
                        </Text>
                      </View>
                    </View>
                    <ProficiencyDots level={sl.proficiency} />
                  </View>
                  <View className="flex-row gap-1.5 flex-wrap">
                    {SPOKEN_LEVELS.map((lvl) => (
                      <Pressable
                        key={lvl.value}
                        onPress={() =>
                          upsertMutation.mutate({ language: sl.language, type: "spoken", proficiency: lvl.value })
                        }
                        className={`px-[14px] py-[7px] rounded-[20px] ${sl.proficiency === lvl.value ? "bg-foreground" : "bg-brand-input"}`}
                      >
                        <Text
                          className={`font-manrope-md text-[13px] ${sl.proficiency === lvl.value ? "text-white" : "text-brand-muted-foreground"}`}
                        >
                          {lvl.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={() => removeMutation.mutate({ language: sl.language, type: "spoken" })}>
                    <Text className="font-manrope text-xs text-destructive">
                      Remove
                    </Text>
                  </Pressable>
                </View>
              ))}

              <Pressable
                onPress={() => setAddingType("spoken")}
                className="flex-row items-center gap-2 py-1"
              >
                <Text className="font-manrope-semi text-[15px] text-foreground">+</Text>
                <Text className="font-manrope-md text-[15px] text-foreground">
                  Add a language
                </Text>
              </Pressable>
            </ScrollView>

            <View className="px-6 pb-8">
              <GoldButton onPress={() => advanceTo(4)} label="Continue →" />
            </View>
          </View>
        )}

        {/* Step 4 — Learning languages */}
        {step === 4 && (
          <View className="flex-1">
            <StepHeader step={4} canSkip onSkip={() => advanceTo(5)} />
            <StepHeading
              title={"What are\nyou learning?"}
              subtitle="We'll pair you with native speakers."
            />

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 16, gap: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              {learningLanguages.map((ll) => (
                <View
                  key={ll.language}
                  className="bg-brand-input rounded-2xl p-4 gap-3"
                >
                  <View className="flex-row items-center gap-2.5">
                    <Text className="text-[26px]">{getFlag(ll.language)}</Text>
                    <View>
                      <Text className="font-manrope-semi text-base text-foreground">
                        {ll.language}
                      </Text>
                      <Text className="font-manrope text-xs text-brand-muted-foreground">
                        Your level
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row gap-2">
                    {LEARNING_LEVELS.map((lvl) => (
                      <Pressable
                        key={lvl.value}
                        onPress={() =>
                          upsertMutation.mutate({ language: ll.language, type: "learning", proficiency: lvl.value })
                        }
                        className={`flex-1 py-2.5 rounded-xl items-center gap-0.5 ${ll.proficiency === lvl.value ? "bg-brand-gold" : "bg-white"}`}
                      >
                        <Text
                          className={`font-manrope-bold text-sm ${ll.proficiency === lvl.value ? "text-foreground" : "text-brand-muted-foreground"}`}
                        >
                          {lvl.label}
                        </Text>
                        <Text
                          className={`font-manrope text-[10px] ${ll.proficiency === lvl.value ? "text-foreground" : "text-brand-border"}`}
                        >
                          {lvl.sub}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Pressable onPress={() => removeMutation.mutate({ language: ll.language, type: "learning" })}>
                    <Text className="font-manrope text-xs text-destructive">
                      Remove
                    </Text>
                  </Pressable>
                </View>
              ))}

              <Pressable
                onPress={() => setAddingType("learning")}
                className="flex-row items-center gap-2 py-1"
              >
                <Text className="font-manrope-semi text-[15px] text-foreground">+</Text>
                <Text className="font-manrope-md text-[15px] text-foreground">
                  Add another
                </Text>
              </Pressable>
            </ScrollView>

            <View className="px-6 pb-8">
              <GoldButton onPress={() => advanceTo(5)} label="Continue →" />
            </View>
          </View>
        )}

        {/* Step 5 — Interests */}
        {step === 5 && (
          <View className="flex-1">
            <StepHeader step={5} canSkip onSkip={handleFinish} />
            <StepHeading
              title={"What do you\ntalk about?"}
              subtitle={`Pick ${MIN_INTERESTS}–${MAX_INTERESTS}. Seeds your first match.`}
            />

            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 24,
                paddingBottom: 16,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {INTERESTS.map((item) => {
                const selected = savedInterests.some((i) => i.interest === item.value);
                const atMax = savedInterests.length >= MAX_INTERESTS && !selected;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => !atMax && toggleInterestMutation.mutate({ interest: item.value })}
                    disabled={toggleInterestMutation.isPending || atMax}
                    className={`px-[18px] py-[10px] rounded-full ${selected ? "bg-brand-gold" : "bg-brand-input"}`}
                    style={{ opacity: atMax ? 0.4 : 1 }}
                  >
                    <Text className={`text-[15px] text-foreground ${selected ? "font-manrope-bold" : "font-manrope-md"}`}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="px-6 pb-8">
              <View className="flex-row justify-between items-center mb-[14px]">
                <Text className="font-manrope text-sm text-brand-muted-foreground">
                  {savedInterests.length} picked
                </Text>
                {savedInterests.length >= MIN_INTERESTS && (
                  <Text className="font-manrope-md text-sm" style={{ color: GREEN }}>
                    ready ✓
                  </Text>
                )}
              </View>
              <GoldButton
                onPress={handleFinish}
                disabled={savedInterests.length < MIN_INTERESTS}
                label="Finish — find matches →"
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>

      <LanguagePickerModal
        visible={addingType !== null}
        title={addingType === "spoken" ? "Add spoken language" : "Add learning language"}
        disabledLanguages={allSelectedLanguages}
        onSelect={(lang) => {
          upsertMutation.mutate({ language: lang, type: addingType!, proficiency: addingType === "spoken" ? "native" : "beginner" });
          setAddingType(null);
        }}
        onClose={() => setAddingType(null)}
      />
    </View>
  );
}
