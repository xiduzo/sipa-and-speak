import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Card, Spinner, useToast } from "heroui-native";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Container } from "@/components/container";
import { trpc, queryClient } from "@/utils/trpc";

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Mandarin",
  "Japanese",
  "Korean",
  "Portuguese",
  "Italian",
  "Arabic",
  "Hindi",
  "Russian",
] as const;

const PROFICIENCY_LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "native", label: "Native" },
] as const;

type Proficiency = "beginner" | "intermediate" | "advanced" | "native";

interface SpokenLanguage {
  language: string;
  proficiency: Proficiency;
}

const INTERESTS = [
  { value: "modern_art", label: "Modern Art" },
  { value: "tech_coding", label: "Tech & Coding" },
  { value: "jazz_music", label: "Jazz Music" },
  { value: "culinary_arts", label: "Culinary Arts" },
  { value: "sustainability", label: "Sustainability" },
  { value: "cinephile", label: "Cinephile" },
  { value: "cosmology", label: "Cosmology" },
] as const;

type InterestValue = (typeof INTERESTS)[number]["value"];

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [spokenLanguages, setSpokenLanguages] = useState<SpokenLanguage[]>([]);
  const [learningLanguages, setLearningLanguages] = useState<string[]>([]);
  const [interests, setInterests] = useState<InterestValue[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const upsertMutation = useMutation(trpc.profile.upsertProfile.mutationOptions());
  const partialMutation = useMutation(trpc.profile.savePartialProfile.mutationOptions());

  const isSaving = upsertMutation.isPending || partialMutation.isPending;

  function toggleSpokenLanguage(lang: string) {
    setValidationError(null);
    setSpokenLanguages((prev) => {
      const exists = prev.find((l) => l.language === lang);
      if (exists) return prev.filter((l) => l.language !== lang);
      return [...prev, { language: lang, proficiency: "beginner" as Proficiency }];
    });
  }

  function setProficiency(lang: string, proficiency: Proficiency) {
    setSpokenLanguages((prev) =>
      prev.map((l) => (l.language === lang ? { ...l, proficiency } : l)),
    );
  }

  function toggleLearningLanguage(lang: string) {
    setValidationError(null);
    setLearningLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  function toggleInterest(interest: InterestValue) {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  }

  function handleNext() {
    if (step === 1 && spokenLanguages.length === 0) {
      setValidationError("Please select at least one spoken language.");
      return;
    }
    if (step === 2 && learningLanguages.length === 0) {
      setValidationError("Please select at least one language to learn.");
      return;
    }
    setValidationError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function handleBack() {
    setValidationError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleSave() {
    if (spokenLanguages.length === 0) {
      setValidationError("Please select at least one spoken language.");
      return;
    }
    if (learningLanguages.length === 0) {
      setValidationError("Please select at least one language to learn.");
      return;
    }
    setValidationError(null);

    try {
      await upsertMutation.mutateAsync({
        spokenLanguages,
        learningLanguages: learningLanguages.map((l) => ({ language: l })),
        interests: interests as InterestValue[],
      });
      await queryClient.refetchQueries();
      toast.show({ variant: "success", label: "Profile saved!" });
      router.replace("/(drawer)/(tabs)");
    } catch {
      toast.show({ variant: "danger", label: "Failed to save profile." });
    }
  }

  async function handleSkip() {
    try {
      const input: Record<string, unknown> = {};
      if (spokenLanguages.length > 0) input.spokenLanguages = spokenLanguages;
      if (learningLanguages.length > 0)
        input.learningLanguages = learningLanguages.map((l) => ({ language: l }));
      if (interests.length > 0) input.interests = interests;

      await partialMutation.mutateAsync(input as Parameters<typeof partialMutation.mutateAsync>[0]);
      await queryClient.refetchQueries();
      toast.show({ variant: "default", label: "You can complete your profile later." });
      router.replace("/(drawer)/(tabs)");
    } catch {
      toast.show({ variant: "danger", label: "Failed to save." });
    }
  }

  function renderStepIndicator() {
    return (
      <View className="flex-row justify-center gap-2 mb-6">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View
            key={i}
            className={`h-2 rounded-full ${
              i + 1 <= step ? "bg-primary w-8" : "bg-muted w-8"
            }`}
          />
        ))}
      </View>
    );
  }

  function renderStep1() {
    return (
      <View className="flex-1">
        <Text className="text-foreground text-2xl font-bold mb-2">
          Languages you speak
        </Text>
        <Text className="text-muted-foreground mb-4">
          Select the languages you already speak and your proficiency level.
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {LANGUAGES.map((lang) => {
            const selected = spokenLanguages.find((l) => l.language === lang);
            return (
              <Pressable
                key={lang}
                onPress={() => toggleSpokenLanguage(lang)}
                className={`px-4 py-2 rounded-full border ${
                  selected
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={selected ? "text-primary-foreground font-medium" : "text-foreground"}
                >
                  {lang}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {spokenLanguages.length > 0 && (
          <View className="gap-3">
            <Text className="text-foreground font-semibold">Set proficiency:</Text>
            {spokenLanguages.map((sl) => (
              <Card key={sl.language} className="p-3">
                <Text className="text-foreground font-medium mb-2">{sl.language}</Text>
                <View className="flex-row flex-wrap gap-2">
                  {PROFICIENCY_LEVELS.map((level) => (
                    <Pressable
                      key={level.value}
                      onPress={() => setProficiency(sl.language, level.value)}
                      className={`px-3 py-1.5 rounded-full border ${
                        sl.proficiency === level.value
                          ? "bg-primary border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      <Text
                        className={
                          sl.proficiency === level.value
                            ? "text-primary-foreground text-sm"
                            : "text-foreground text-sm"
                        }
                      >
                        {level.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Card>
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderStep2() {
    return (
      <View className="flex-1">
        <Text className="text-foreground text-2xl font-bold mb-2">
          Languages you want to learn
        </Text>
        <Text className="text-muted-foreground mb-4">
          Pick the languages you'd like to practice with a partner.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {LANGUAGES.map((lang) => {
            const selected = learningLanguages.includes(lang);
            return (
              <Pressable
                key={lang}
                onPress={() => toggleLearningLanguage(lang)}
                className={`px-4 py-2 rounded-full border ${
                  selected
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={selected ? "text-primary-foreground font-medium" : "text-foreground"}
                >
                  {lang}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function renderStep3() {
    return (
      <View className="flex-1">
        <Text className="text-foreground text-2xl font-bold mb-2">
          Your interests
        </Text>
        <Text className="text-muted-foreground mb-4">
          Select topics you enjoy — we'll use these to find great matches.
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {INTERESTS.map((item) => {
            const selected = interests.includes(item.value);
            return (
              <Pressable
                key={item.value}
                onPress={() => toggleInterest(item.value)}
                className={`px-4 py-2 rounded-full border ${
                  selected
                    ? "bg-primary border-primary"
                    : "bg-background border-border"
                }`}
              >
                <Text
                  className={selected ? "text-primary-foreground font-medium" : "text-foreground"}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function renderStep4() {
    return (
      <View className="flex-1">
        <Text className="text-foreground text-2xl font-bold mb-2">
          Review your profile
        </Text>
        <Text className="text-muted-foreground mb-4">
          Here's a summary of your selections.
        </Text>

        <Card className="p-4 mb-4">
          <Text className="text-foreground font-semibold mb-2">Spoken Languages</Text>
          {spokenLanguages.length === 0 ? (
            <Text className="text-muted-foreground text-sm">None selected</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {spokenLanguages.map((sl) => (
                <View key={sl.language} className="bg-muted px-3 py-1 rounded-full">
                  <Text className="text-foreground text-sm">
                    {sl.language} · {sl.proficiency}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card className="p-4 mb-4">
          <Text className="text-foreground font-semibold mb-2">Learning Languages</Text>
          {learningLanguages.length === 0 ? (
            <Text className="text-muted-foreground text-sm">None selected</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {learningLanguages.map((lang) => (
                <View key={lang} className="bg-muted px-3 py-1 rounded-full">
                  <Text className="text-foreground text-sm">{lang}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card className="p-4">
          <Text className="text-foreground font-semibold mb-2">Interests</Text>
          {interests.length === 0 ? (
            <Text className="text-muted-foreground text-sm">None selected</Text>
          ) : (
            <View className="flex-row flex-wrap gap-2">
              {interests.map((val) => {
                const label = INTERESTS.find((i) => i.value === val)?.label ?? val;
                return (
                  <View key={val} className="bg-muted px-3 py-1 rounded-full">
                    <Text className="text-foreground text-sm">{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </View>
    );
  }

  return (
    <Container isScrollable={false}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 p-6">
          {renderStepIndicator()}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {validationError && (
            <View className="bg-destructive/10 border border-destructive rounded-lg p-3 mt-4">
              <Text className="text-destructive text-sm">{validationError}</Text>
            </View>
          )}

          <View className="mt-6 gap-3">
            {step < TOTAL_STEPS ? (
              <>
                <View className="flex-row gap-3">
                  {step > 1 && (
                    <Button variant="bordered" onPress={handleBack} className="flex-1">
                      <Button.Label>Back</Button.Label>
                    </Button>
                  )}
                  <Button onPress={handleNext} className="flex-1">
                    <Button.Label>Next</Button.Label>
                  </Button>
                </View>
                <Button variant="light" onPress={handleSkip} isDisabled={isSaving}>
                  {isSaving ? (
                    <Spinner size="sm" color="default" />
                  ) : (
                    <Button.Label>Skip for now</Button.Label>
                  )}
                </Button>
              </>
            ) : (
              <>
                <View className="flex-row gap-3">
                  <Button variant="bordered" onPress={handleBack} className="flex-1">
                    <Button.Label>Back</Button.Label>
                  </Button>
                  <Button onPress={handleSave} isDisabled={isSaving} className="flex-1">
                    {isSaving ? (
                      <Spinner size="sm" color="default" />
                    ) : (
                      <Button.Label>Save and Continue</Button.Label>
                    )}
                  </Button>
                </View>
                <Button variant="light" onPress={handleSkip} isDisabled={isSaving}>
                  {isSaving ? (
                    <Spinner size="sm" color="default" />
                  ) : (
                    <Button.Label>Skip for now</Button.Label>
                  )}
                </Button>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}
