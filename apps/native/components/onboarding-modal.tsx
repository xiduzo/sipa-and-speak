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
import { Spinner, useToast } from "heroui-native";

import { LanguagePickerModal } from "@/components/language-picker-modal";
import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";
import { extractNameFromEmail } from "@/utils/email-name-extract";
import { pickAndEncodeProfilePicture } from "@/utils/profile-picture";

const GOLD = "#F2C94C";
const MUTED_BORDER = "#D9C9BC";

type LearningProficiency = "beginner" | "intermediate" | "advanced";
type InterestValue =
  | "modern_art" | "tech_coding" | "jazz_music" | "culinary_arts"
  | "sustainability" | "cinephile" | "cosmology" | "photography"
  | "board_games" | "hiking_outdoors" | "yoga_wellness" | "literature"
  | "entrepreneurship" | "design_architecture" | "travel" | "gaming"
  | "fitness_sports" | "philosophy" | "theatre";

interface SpokenLanguage { language: string; proficiency: LearningProficiency }
interface LearningLang { language: string; proficiency: LearningProficiency }

const LEVEL_BLOCKS = [
  { value: "beginner" as LearningProficiency, label: "A1–A2", sub: "Beginner" },
  { value: "intermediate" as LearningProficiency, label: "B1–B2", sub: "Intermediate" },
  { value: "advanced" as LearningProficiency, label: "C1–C2", sub: "Advanced" },
];

const INTERESTS: { value: InterestValue; label: string }[] = [
  { value: "modern_art", label: "Art" },
  { value: "tech_coding", label: "Tech" },
  { value: "jazz_music", label: "Music" },
  { value: "culinary_arts", label: "Cooking" },
  { value: "sustainability", label: "Sustainability" },
  { value: "cinephile", label: "Film" },
  { value: "cosmology", label: "Cosmology" },
  { value: "photography", label: "Photography" },
  { value: "board_games", label: "Board games" },
  { value: "hiking_outdoors", label: "Hiking" },
  { value: "yoga_wellness", label: "Yoga" },
  { value: "literature", label: "Literature" },
  { value: "entrepreneurship", label: "Startups" },
  { value: "design_architecture", label: "Design" },
  { value: "travel", label: "Travel" },
  { value: "gaming", label: "Gaming" },
  { value: "fitness_sports", label: "Football" },
  { value: "philosophy", label: "Philosophy" },
  { value: "theatre", label: "Theatre" },
];

const LANGUAGE_FLAGS: Record<string, string> = {
  Afrikaans: "🇿🇦", Albanian: "🇦🇱", Arabic: "🇸🇦", Armenian: "🇦🇲",
  Azerbaijani: "🇦🇿", Bengali: "🇧🇩", Bulgarian: "🇧🇬", Catalan: "🇪🇸",
  Chinese: "🇨🇳", Croatian: "🇭🇷", Czech: "🇨🇿", Danish: "🇩🇰",
  Dutch: "🇳🇱", English: "🇬🇧", Estonian: "🇪🇪", Finnish: "🇫🇮",
  French: "🇫🇷", Georgian: "🇬🇪", German: "🇩🇪", Greek: "🇬🇷",
  Hebrew: "🇮🇱", Hindi: "🇮🇳", Hungarian: "🇭🇺", Icelandic: "🇮🇸",
  Indonesian: "🇮🇩", Italian: "🇮🇹", Japanese: "🇯🇵", Kazakh: "🇰🇿",
  Korean: "🇰🇷", Latvian: "🇱🇻", Lithuanian: "🇱🇹", Macedonian: "🇲🇰",
  Malay: "🇲🇾", Maltese: "🇲🇹", Norwegian: "🇳🇴", Persian: "🇮🇷",
  Polish: "🇵🇱", Portuguese: "🇵🇹", Romanian: "🇷🇴", Russian: "🇷🇺",
  Serbian: "🇷🇸", Slovak: "🇸🇰", Slovenian: "🇸🇮", Spanish: "🇪🇸",
  Swedish: "🇸🇪", Thai: "🇹🇭", Turkish: "🇹🇷", Ukrainian: "🇺🇦",
  Urdu: "🇵🇰", Vietnamese: "🇻🇳", Welsh: "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
};

function GoldButton({
  onPress, disabled, label, loading,
}: { onPress: () => void; disabled?: boolean; label: string; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => ({
        backgroundColor: (disabled || loading) ? "#D4C898" : pressed ? "#DFB83A" : GOLD,
        borderRadius: 50,
        paddingVertical: 18,
        alignItems: "center",
        opacity: (disabled || loading) ? 0.7 : 1,
        flexDirection: "row",
        justifyContent: "center",
        gap: 8,
      })}
    >
      {loading && <Spinner size="sm" color="default" />}
      <Text
        className="font-manrope-bold text-[17px]"
        style={{ color: (disabled || loading) ? "#8A7570" : "#2C1810" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const STEP_TITLES = [
  "How should\npeople greet you?",
  "Add a face\nto your name.",
  "What do\nyou speak?",
  "What are\nyou learning?",
  "What do\nyou talk about?",
];

const STEP_SUBTITLES = [
  "Pulled from TU/e. Change if you go by something else.",
  "So your partner can spot you across the café.",
  "Languages you can hold a conversation in.",
  "We'll pair you with native speakers.",
  "Pick 3–7. Seeds your first match.",
];

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

  const [step, setStep] = useState(1);
  const [initialized, setInitialized] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [surnameInput, setSurnameInput] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [spokenLanguages, setSpokenLanguages] = useState<SpokenLanguage[]>([]);
  const [learningLanguages, setLearningLanguages] = useState<LearningLang[]>([]);
  const [interests, setInterests] = useState<InterestValue[]>([]);
  const [pickerTarget, setPickerTarget] = useState<"spoken" | "learning" | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const needsFullOnboarding = onboardingStatus.data?.complete === false;
  const totalSteps = needsFullOnboarding ? 5 : 2;

  // Reset state when user session changes
  useEffect(() => {
    if (!session) {
      setInitialized(false);
      setStep(1);
      setNameInput("");
      setSurnameInput("");
      setImageUri(undefined);
      setSpokenLanguages([]);
      setLearningLanguages([]);
      setInterests([]);
      setValidationError(null);
    }
  }, [session?.user?.id]);

  // Pre-fill identity from profile and skip to language step if identity already done
  useEffect(() => {
    if (initialized || !profileQuery.data || !onboardingStatus.data) return;
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
    if (needsFullOnboarding && onboardingStatus.data.identityProfileComplete) {
      setStep(3);
    }
    setInitialized(true);
  }, [profileQuery.data, onboardingStatus.data, initialized, needsFullOnboarding]);

  const setIdentityMutation = useMutation({
    ...trpc.profile.setIdentityProfile.mutationOptions(),
    onError: (e) => {
      toast.show({ variant: "danger", label: (e as { message?: string }).message ?? "Failed to save." });
    },
  });

  const upsertMutation = useMutation({
    ...trpc.profile.upsertProfile.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => toast.show({ variant: "danger", label: "Failed to save profile." }),
  });

  const isSaving = setIdentityMutation.isPending || upsertMutation.isPending;

  const visible =
    !!session &&
    !onboardingStatus.isPending &&
    (!onboardingStatus.data?.complete || !onboardingStatus.data?.identityProfileComplete);

  if (!visible) return null;

  async function handleStep1Continue() {
    const name = nameInput.trim();
    const surname = surnameInput.trim();
    if (!name) { Alert.alert("Name required", "Please enter your first name."); return; }
    if (!surname) { Alert.alert("Surname required", "Please enter your surname."); return; }
    try {
      await setIdentityMutation.mutateAsync({ name, surname, imageUrl: imageUri });
      setValidationError(null);
      setStep(2);
    } catch { /* handled in onError */ }
  }

  async function handleStep2Continue() {
    try {
      await setIdentityMutation.mutateAsync({
        name: nameInput.trim(),
        surname: surnameInput.trim(),
        imageUrl: imageUri,
      });
      setValidationError(null);
      if (needsFullOnboarding) {
        setStep(3);
      } else {
        await queryClient.invalidateQueries();
      }
    } catch { /* handled in onError */ }
  }

  function handleStep3Continue() {
    if (spokenLanguages.length === 0) {
      setValidationError("Add at least one language you speak.");
      return;
    }
    setValidationError(null);
    setStep(4);
  }

  function handleStep4Continue() {
    if (learningLanguages.length === 0) {
      setValidationError("Add at least one language to learn.");
      return;
    }
    setValidationError(null);
    setStep(5);
  }

  async function handleFinish() {
    if (interests.length < 3) {
      setValidationError("Pick at least 3 topics.");
      return;
    }
    setValidationError(null);
    try {
      await upsertMutation.mutateAsync({ spokenLanguages, learningLanguages, interests });
    } catch { /* handled in onError */ }
  }

  async function handlePickPicture() {
    const result = await pickAndEncodeProfilePicture();
    if (result.error) { toast.show({ variant: "danger", label: result.error }); return; }
    if (result.imageDataUri) setImageUri(result.imageDataUri);
  }

  const effectiveStep = needsFullOnboarding ? step : step;
  const titleIndex = step - 1;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <View
        className="flex-1 bg-background"
        style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <KeyboardAvoidingView
          className="flex-1"
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-1 px-6 pt-6 pb-10" style={{ flex: 1 }}>
              {/* Header */}
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className="font-manrope-semi text-[11px] tracking-[2px] uppercase"
                  style={{ color: GOLD }}
                >
                  ABOUT YOU · {effectiveStep} OF {totalSteps}
                </Text>
                {step === 2 && needsFullOnboarding && (
                  <Pressable onPress={() => setStep(3)}>
                    <Text className="font-manrope-semi text-[15px] text-foreground">Skip</Text>
                  </Pressable>
                )}
              </View>

              {/* Progress bar */}
              <View className="flex-row gap-[4px] mb-8">
                {Array.from({ length: totalSteps }, (_, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      backgroundColor: i < step ? GOLD : MUTED_BORDER,
                    }}
                  />
                ))}
              </View>

              {/* Title */}
              <View className="mb-8">
                <Text className="font-caveat text-[42px] text-foreground leading-[46px]">
                  {STEP_TITLES[titleIndex]}
                </Text>
                <Text
                  className="font-manrope text-[15px] italic mt-3 leading-[22px]"
                  style={{ color: "#8A7570" }}
                >
                  {STEP_SUBTITLES[titleIndex]}
                </Text>
              </View>

              {/* Step 1 — Name */}
              {step === 1 && (
                <View className="gap-4">
                  <View className="gap-2">
                    <Text
                      className="font-manrope-semi text-[11px] tracking-[1.8px] uppercase"
                      style={{ color: "#8A7570" }}
                    >
                      First name
                    </Text>
                    <TextInput
                      value={nameInput}
                      onChangeText={setNameInput}
                      placeholder="Anna"
                      placeholderTextColor={MUTED_BORDER}
                      autoCapitalize="words"
                      returnKeyType="next"
                      className="font-manrope-md text-[17px] text-foreground bg-brand-input rounded-2xl px-5 py-4"
                      style={{ borderWidth: 2, borderColor: MUTED_BORDER }}
                    />
                  </View>
                  <View className="gap-2">
                    <Text
                      className="font-manrope-semi text-[11px] tracking-[1.8px] uppercase"
                      style={{ color: "#8A7570" }}
                    >
                      Surname
                    </Text>
                    <TextInput
                      value={surnameInput}
                      onChangeText={setSurnameInput}
                      placeholder="de Vries"
                      placeholderTextColor={MUTED_BORDER}
                      autoCapitalize="words"
                      returnKeyType="done"
                      onSubmitEditing={handleStep1Continue}
                      className="font-manrope-md text-[17px] text-foreground bg-brand-input rounded-2xl px-5 py-4"
                      style={{ borderWidth: 2, borderColor: MUTED_BORDER }}
                    />
                  </View>
                </View>
              )}

              {/* Step 2 — Photo */}
              {step === 2 && (
                <View className="flex-1 items-center justify-center gap-4">
                  <Pressable onPress={handlePickPicture}>
                    {imageUri ? (
                      <Image
                        source={{ uri: imageUri }}
                        style={{
                          width: 180,
                          height: 180,
                          borderRadius: 90,
                          borderWidth: 3,
                          borderColor: GOLD,
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 180,
                          height: 180,
                          borderRadius: 90,
                          borderWidth: 3,
                          borderColor: GOLD,
                          backgroundColor: "#F5F0EB",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontSize: 40, color: MUTED_BORDER }}>+</Text>
                      </View>
                    )}
                  </Pressable>
                  <Text className="font-manrope text-sm" style={{ color: "#8A7570" }}>
                    Tap to upload or take a photo
                  </Text>
                </View>
              )}

              {/* Step 3 — Spoken languages */}
              {step === 3 && (
                <View className="gap-3">
                  {spokenLanguages.map((sl) => (
                    <View
                      key={sl.language}
                      className="bg-brand-input rounded-2xl px-5 py-4"
                      style={{ borderWidth: 2, borderColor: MUTED_BORDER }}
                    >
                      <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-3">
                          <Text style={{ fontSize: 24 }}>{LANGUAGE_FLAGS[sl.language] ?? "🌐"}</Text>
                          <Text className="font-manrope-bold text-[16px] text-foreground">{sl.language}</Text>
                        </View>
                        <Pressable onPress={() => setSpokenLanguages((p) => p.filter((l) => l.language !== sl.language))}>
                          <Text className="font-manrope text-[13px]" style={{ color: "#C0876A" }}>Remove</Text>
                        </Pressable>
                      </View>
                      <View className="flex-row gap-2">
                        {LEVEL_BLOCKS.map((lvl) => {
                          const selected = sl.proficiency === lvl.value;
                          return (
                            <Pressable
                              key={lvl.value}
                              onPress={() =>
                                setSpokenLanguages((p) =>
                                  p.map((l) => l.language === sl.language ? { ...l, proficiency: lvl.value } : l),
                                )
                              }
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 10,
                                alignItems: "center",
                                backgroundColor: selected ? "#2C1810" : "transparent",
                                borderWidth: 1.5,
                                borderColor: selected ? "#2C1810" : MUTED_BORDER,
                              }}
                            >
                              <Text
                                className="font-manrope-bold text-[13px]"
                                style={{ color: selected ? GOLD : "#8A7570" }}
                              >
                                {lvl.label}
                              </Text>
                              <Text
                                className="font-manrope text-[11px]"
                                style={{ color: selected ? GOLD : MUTED_BORDER }}
                              >
                                {lvl.sub}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                  <Pressable onPress={() => setPickerTarget("spoken")} className="flex-row items-center gap-2 py-2">
                    <Text className="font-manrope-semi text-[15px]" style={{ color: GOLD }}>+ Add a language</Text>
                  </Pressable>
                </View>
              )}

              {/* Step 4 — Learning languages */}
              {step === 4 && (
                <View className="gap-3">
                  {learningLanguages.map((ll) => (
                    <View
                      key={ll.language}
                      className="bg-brand-input rounded-2xl px-5 py-4"
                      style={{ borderWidth: 2, borderColor: MUTED_BORDER }}
                    >
                      <View className="flex-row items-center justify-between mb-4">
                        <View className="flex-row items-center gap-3">
                          <Text style={{ fontSize: 24 }}>{LANGUAGE_FLAGS[ll.language] ?? "🌐"}</Text>
                          <Text className="font-manrope-bold text-[16px] text-foreground">{ll.language}</Text>
                        </View>
                        <Pressable onPress={() => setLearningLanguages((p) => p.filter((l) => l.language !== ll.language))}>
                          <Text className="font-manrope text-[13px]" style={{ color: "#C0876A" }}>Remove</Text>
                        </Pressable>
                      </View>
                      <View className="flex-row gap-2">
                        {LEVEL_BLOCKS.map((lvl) => {
                          const selected = ll.proficiency === lvl.value;
                          return (
                            <Pressable
                              key={lvl.value}
                              onPress={() =>
                                setLearningLanguages((p) =>
                                  p.map((l) => l.language === ll.language ? { ...l, proficiency: lvl.value } : l),
                                )
                              }
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 10,
                                alignItems: "center",
                                backgroundColor: selected ? "#2C1810" : "transparent",
                                borderWidth: 1.5,
                                borderColor: selected ? "#2C1810" : MUTED_BORDER,
                              }}
                            >
                              <Text
                                className="font-manrope-bold text-[13px]"
                                style={{ color: selected ? GOLD : "#8A7570" }}
                              >
                                {lvl.label}
                              </Text>
                              <Text
                                className="font-manrope text-[11px]"
                                style={{ color: selected ? GOLD : MUTED_BORDER }}
                              >
                                {lvl.sub}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))}
                  <Pressable onPress={() => setPickerTarget("learning")} className="flex-row items-center gap-2 py-2">
                    <Text className="font-manrope-semi text-[15px]" style={{ color: GOLD }}>+ Add a language</Text>
                  </Pressable>
                </View>
              )}

              {/* Step 5 — Interests */}
              {step === 5 && (
                <View>
                  <View className="flex-row flex-wrap gap-2">
                    {INTERESTS.map((item) => {
                      const selected = interests.includes(item.value);
                      return (
                        <Pressable
                          key={item.value}
                          onPress={() =>
                            setInterests((p) =>
                              p.includes(item.value) ? p.filter((i) => i !== item.value) : [...p, item.value],
                            )
                          }
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 9,
                            borderRadius: 50,
                            backgroundColor: selected ? "#2C1810" : "transparent",
                            borderWidth: 1.5,
                            borderColor: selected ? "#2C1810" : MUTED_BORDER,
                          }}
                        >
                          <Text
                            className="font-manrope-semi text-[14px]"
                            style={{ color: selected ? GOLD : "#5C4A3F" }}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View className="flex-row justify-between items-center mt-5">
                    <Text className="font-manrope text-[14px]" style={{ color: "#8A7570" }}>
                      {interests.length} picked
                    </Text>
                    {interests.length >= 3 && (
                      <Text className="font-manrope-semi text-[14px]" style={{ color: GOLD }}>ready ✓</Text>
                    )}
                  </View>
                </View>
              )}

              {validationError && (
                <View
                  className="rounded-xl p-3 mt-4"
                  style={{ backgroundColor: "#FDF0ED", borderWidth: 1, borderColor: "#C0876A" }}
                >
                  <Text className="font-manrope text-[13px]" style={{ color: "#C0876A" }}>{validationError}</Text>
                </View>
              )}

              <View className="flex-1" />

              {/* CTAs */}
              <View className="gap-3 mt-8">
                {step === 1 && (
                  <GoldButton
                    onPress={handleStep1Continue}
                    loading={setIdentityMutation.isPending}
                    label="Continue →"
                  />
                )}
                {step === 2 && (
                  <>
                    <GoldButton
                      onPress={handleStep2Continue}
                      loading={isSaving}
                      label="Continue →"
                    />
                    <Pressable onPress={() => needsFullOnboarding ? setStep(3) : queryClient.invalidateQueries()} className="items-center py-2.5">
                      <Text className="font-manrope text-sm" style={{ color: "#8A7570" }}>Or do this later</Text>
                    </Pressable>
                  </>
                )}
                {step === 3 && (
                  <GoldButton
                    onPress={handleStep3Continue}
                    disabled={spokenLanguages.length === 0}
                    label="Continue →"
                  />
                )}
                {step === 4 && (
                  <GoldButton
                    onPress={handleStep4Continue}
                    disabled={learningLanguages.length === 0}
                    label="Continue →"
                  />
                )}
                {step === 5 && (
                  <GoldButton
                    onPress={handleFinish}
                    loading={upsertMutation.isPending}
                    disabled={interests.length < 3}
                    label="Finish — find matches →"
                  />
                )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <LanguagePickerModal
        visible={pickerTarget !== null}
        title={pickerTarget === "spoken" ? "Add spoken language" : "Add learning language"}
        disabledLanguages={[
          ...spokenLanguages.map((l) => l.language),
          ...learningLanguages.map((l) => l.language),
        ]}
        onSelect={(lang) => {
          if (pickerTarget === "spoken") {
            setSpokenLanguages((p) => [...p, { language: lang, proficiency: "beginner" }]);
          } else {
            setLearningLanguages((p) => [...p, { language: lang, proficiency: "beginner" }]);
          }
          setPickerTarget(null);
        }}
        onClose={() => setPickerTarget(null)}
      />
    </Modal>
  );
}
