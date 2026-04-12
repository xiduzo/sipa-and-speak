import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Card, Spinner, useToast } from "heroui-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Container } from "@/components/container";
import { queryClient, trpc } from "@/utils/trpc";

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

const INTERESTS = [
  { value: "modern_art", label: "Modern Art" },
  { value: "tech_coding", label: "Tech & Coding" },
  { value: "jazz_music", label: "Jazz Music" },
  { value: "culinary_arts", label: "Culinary Arts" },
  { value: "sustainability", label: "Sustainability" },
  { value: "cinephile", label: "Cinephile" },
  { value: "cosmology", label: "Cosmology" },
] as const;

const SPOKEN_PROFICIENCY = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "native", label: "Native" },
] as const;

const LEARNING_PROFICIENCY = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

type LanguageType = "spoken" | "learning";

export default function EditProfileScreen() {
  const router = useRouter();
  const { toast } = useToast();
  const [addingType, setAddingType] = useState<LanguageType | null>(null);

  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());

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
    onError: () => {
      toast.show({ variant: "danger", label: "Failed to remove language." });
    },
  });

  const toggleInterestMutation = useMutation({
    ...trpc.profile.toggleInterest.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => {
      toast.show({ variant: "danger", label: "Failed to update interest." });
    },
  });

  const languages = profileQuery.data?.languages ?? [];
  const spokenLanguages = languages.filter((l) => l.type === "spoken");
  const learningLanguages = languages.filter((l) => l.type === "learning");
  const savedInterests = profileQuery.data?.interests ?? [];

  const isMutating = upsertMutation.isPending || removeMutation.isPending || toggleInterestMutation.isPending;

  const availableForSpoken = LANGUAGES.filter(
    (l) =>
      !spokenLanguages.some((s) => s.language === l) &&
      !learningLanguages.some((ll) => ll.language === l),
  );
  const availableForLearning = LANGUAGES.filter(
    (l) =>
      !learningLanguages.some((ll) => ll.language === l) &&
      !spokenLanguages.some((s) => s.language === l),
  );

  function handleAdd(lang: string, type: LanguageType) {
    upsertMutation.mutate({ language: lang, type, proficiency: "beginner" });
    setAddingType(null);
  }

  function handleUpdateProficiency(lang: string, type: LanguageType, proficiency: string) {
    upsertMutation.mutate({
      language: lang,
      type,
      proficiency: proficiency as "beginner" | "intermediate" | "advanced" | "native",
    });
  }

  function handleRemove(lang: string, type: LanguageType) {
    removeMutation.mutate({ language: lang, type });
  }

  if (profileQuery.isPending) {
    return (
      <Container isScrollable={false}>
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </Container>
    );
  }

  return (
    <Container isScrollable={false}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 p-6 gap-8">

          {/* Spoken Languages */}
          <View>
            <Text className="text-foreground text-xl font-bold mb-3">Spoken Languages</Text>

            {spokenLanguages.length === 0 && (
              <Text className="text-muted-foreground text-sm mb-3">No spoken languages added yet.</Text>
            )}

            <View className="gap-3">
              {spokenLanguages.map((sl) => (
                <Card key={sl.language} className="p-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-foreground font-medium">{sl.language}</Text>
                    <Pressable onPress={() => handleRemove(sl.language, "spoken")}>
                      <Text className="text-destructive text-sm font-medium">Remove</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {SPOKEN_PROFICIENCY.map((level) => (
                      <Pressable
                        key={level.value}
                        onPress={() => handleUpdateProficiency(sl.language, "spoken", level.value)}
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

            {addingType === "spoken" ? (
              <View className="mt-3">
                <Text className="text-foreground font-medium mb-2">Pick a language to add:</Text>
                {availableForSpoken.length === 0 ? (
                  <Text className="text-muted-foreground text-sm">All languages already added.</Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {availableForSpoken.map((lang) => (
                      <Pressable
                        key={lang}
                        onPress={() => handleAdd(lang, "spoken")}
                        className="px-4 py-2 rounded-full border bg-background border-border"
                      >
                        <Text className="text-foreground">{lang}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Button variant="ghost" onPress={() => setAddingType(null)} className="mt-2">
                  <Button.Label>Cancel</Button.Label>
                </Button>
              </View>
            ) : (
              availableForSpoken.length > 0 && (
                <Button variant="outline" onPress={() => setAddingType("spoken")} className="mt-3">
                  <Button.Label>+ Add spoken language</Button.Label>
                </Button>
              )
            )}
          </View>

          {/* Learning Languages */}
          <View>
            <Text className="text-foreground text-xl font-bold mb-3">Learning Languages</Text>

            {learningLanguages.length === 0 && (
              <Text className="text-muted-foreground text-sm mb-3">No learning languages added yet.</Text>
            )}

            <View className="gap-3">
              {learningLanguages.map((ll) => (
                <Card key={ll.language} className="p-3">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-foreground font-medium">{ll.language}</Text>
                    <Pressable onPress={() => handleRemove(ll.language, "learning")}>
                      <Text className="text-destructive text-sm font-medium">Remove</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {LEARNING_PROFICIENCY.map((level) => (
                      <Pressable
                        key={level.value}
                        onPress={() =>
                          handleUpdateProficiency(ll.language, "learning", level.value)
                        }
                        className={`px-3 py-1.5 rounded-full border ${
                          ll.proficiency === level.value
                            ? "bg-primary border-primary"
                            : "bg-background border-border"
                        }`}
                      >
                        <Text
                          className={
                            ll.proficiency === level.value
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

            {addingType === "learning" ? (
              <View className="mt-3">
                <Text className="text-foreground font-medium mb-2">Pick a language to add:</Text>
                {availableForLearning.length === 0 ? (
                  <Text className="text-muted-foreground text-sm">All languages already added.</Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {availableForLearning.map((lang) => (
                      <Pressable
                        key={lang}
                        onPress={() => handleAdd(lang, "learning")}
                        className="px-4 py-2 rounded-full border bg-background border-border"
                      >
                        <Text className="text-foreground">{lang}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Button variant="ghost" onPress={() => setAddingType(null)} className="mt-2">
                  <Button.Label>Cancel</Button.Label>
                </Button>
              </View>
            ) : (
              availableForLearning.length > 0 && (
                <Button
                  variant="outline"
                  onPress={() => setAddingType("learning")}
                  className="mt-3"
                >
                  <Button.Label>+ Add learning language</Button.Label>
                </Button>
              )
            )}
          </View>

          {/* Interests */}
          <View>
            <Text className="text-foreground text-xl font-bold mb-1">Interests</Text>
            <Text className="text-muted-foreground text-sm mb-3">
              Select at least one interest to be eligible for matching.
            </Text>

            {savedInterests.length === 0 && (
              <View className="bg-destructive/10 border border-destructive rounded-lg p-3 mb-3">
                <Text className="text-destructive text-sm">
                  No interests selected — select at least one to enter the matching pool.
                </Text>
              </View>
            )}

            <View className="flex-row flex-wrap gap-2">
              {INTERESTS.map((item) => {
                const selected = savedInterests.some((i) => i.interest === item.value);
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => toggleInterestMutation.mutate({ interest: item.value })}
                    disabled={toggleInterestMutation.isPending}
                    className={`px-4 py-2 rounded-full border ${
                      selected
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Text
                      className={
                        selected ? "text-primary-foreground font-medium" : "text-foreground"
                      }
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isMutating && (
            <View className="flex-row items-center gap-2">
              <Spinner size="sm" color="default" />
              <Text className="text-muted-foreground text-sm">Saving…</Text>
            </View>
          )}

          <View className="mt-4 pt-4 border-t border-border">
            <Button onPress={() => router.push("/review-profile")}>
              <Button.Label>Review & Submit Profile</Button.Label>
            </Button>
          </View>

        </View>
      </ScrollView>
    </Container>
  );
}
