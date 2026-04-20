import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Button, Card, Spinner, useToast } from "heroui-native";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Container } from "@/components/container";
import { LanguagePickerModal } from "@/components/language-picker-modal";
import { queryClient, trpc } from "@/utils/trpc";
import { extractNameFromEmail } from "@/utils/email-name-extract";
import { pickAndEncodeProfilePicture } from "@/utils/profile-picture";

const INTERESTS = [
  { value: "modern_art", label: "Modern Art" },
  { value: "tech_coding", label: "Tech & Coding" },
  { value: "jazz_music", label: "Jazz Music" },
  { value: "culinary_arts", label: "Culinary Arts" },
  { value: "sustainability", label: "Sustainability" },
  { value: "cinephile", label: "Cinephile" },
  { value: "cosmology", label: "Cosmology" },
  { value: "photography", label: "Photography" },
  { value: "board_games", label: "Board Games" },
  { value: "hiking_outdoors", label: "Hiking & Outdoors" },
  { value: "yoga_wellness", label: "Yoga & Wellness" },
  { value: "literature", label: "Literature" },
  { value: "entrepreneurship", label: "Entrepreneurship" },
  { value: "design_architecture", label: "Design & Architecture" },
  { value: "travel", label: "Travel" },
  { value: "gaming", label: "Gaming" },
  { value: "fitness_sports", label: "Fitness & Sports" },
  { value: "philosophy", label: "Philosophy" },
  { value: "theatre", label: "Theatre" },
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
  const [nameInput, setNameInput] = useState("");
  const [surnameInput, setSurnameInput] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>(undefined);
  const [identityInitialized, setIdentityInitialized] = useState(false);

  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());

  const setIdentityMutation = useMutation({
    ...trpc.profile.setIdentityProfile.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e) => {
      toast.show({ variant: "danger", label: (e as { message?: string }).message ?? "Failed to save profile." });
    },
  });

  useEffect(() => {
    if (identityInitialized || !profileQuery.data) return;
    const identity = profileQuery.data.identity;
    const email = identity?.email ?? "";

    if (identity?.name || identity?.surname) {
      setNameInput(identity.name ?? "");
      setSurnameInput(identity.surname ?? "");
    } else {
      const { name, surname } = extractNameFromEmail(email);
      setNameInput(name);
      setSurnameInput(surname);
    }

    setImageUri(identity?.image ?? undefined);
    setIdentityInitialized(true);
  }, [profileQuery.data, identityInitialized]);

  function handleIdentityBlur() {
    const name = nameInput.trim();
    const surname = surnameInput.trim();
    if (!name || !surname) return;
    setIdentityMutation.mutate({ name, surname, imageUrl: imageUri });
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

  function handleReviewPress() {
    const missing: string[] = [];
    if (!nameInput.trim()) missing.push("Name");
    if (!surnameInput.trim()) missing.push("Surname");
    if (missing.length > 0) {
      Alert.alert(
        "Required fields missing",
        `Please fill in: ${missing.join(", ")}`,
        [{ text: "OK" }],
      );
      return;
    }
    router.push("/review-profile");
  }

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

  const allSelectedLanguages = [
    ...spokenLanguages.map((l) => l.language),
    ...learningLanguages.map((l) => l.language),
  ];

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

          {/* Personal Info */}
          <View>
            <Text className="text-foreground text-xl font-bold mb-3">Personal Info</Text>

            <View className="gap-3">
              <View>
                <Text className="text-foreground text-sm font-medium mb-1">Name</Text>
                <TextInput
                  testID="name-input"
                  value={nameInput}
                  onChangeText={setNameInput}
                  onBlur={handleIdentityBlur}
                  placeholder="First name"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  className="border border-border rounded-lg px-3 py-2 text-foreground bg-background"
                />
              </View>

              <View>
                <Text className="text-foreground text-sm font-medium mb-1">Surname</Text>
                <TextInput
                  testID="surname-input"
                  value={surnameInput}
                  onChangeText={setSurnameInput}
                  onBlur={handleIdentityBlur}
                  placeholder="Last name"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="words"
                  className="border border-border rounded-lg px-3 py-2 text-foreground bg-background"
                />
              </View>

              <View>
                <Text className="text-foreground text-sm font-medium mb-2">Profile Picture</Text>
                <Pressable onPress={handlePickPicture} testID="pick-picture-button">
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      style={{ width: 80, height: 80, borderRadius: 40 }}
                      accessibilityLabel="Profile picture preview"
                    />
                  ) : (
                    <View className="w-20 h-20 rounded-full bg-default-200 items-center justify-center border border-dashed border-border">
                      <Text className="text-muted-foreground text-xs text-center">Tap to add{"\n"}photo</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          </View>

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

            <Button variant="outline" onPress={() => setAddingType("spoken")} className="mt-3">
              <Button.Label>+ Add spoken language</Button.Label>
            </Button>
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

            <Button variant="outline" onPress={() => setAddingType("learning")} className="mt-3">
              <Button.Label>+ Add learning language</Button.Label>
            </Button>
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
            <Button onPress={handleReviewPress} testID="review-submit-button">
              <Button.Label>Review & Submit Profile</Button.Label>
            </Button>
          </View>

        </View>
      </ScrollView>

      <LanguagePickerModal
        visible={addingType !== null}
        title={addingType === "spoken" ? "Add spoken language" : "Add learning language"}
        disabledLanguages={allSelectedLanguages}
        onSelect={(lang) => handleAdd(lang, addingType!)}
        onClose={() => setAddingType(null)}
      />
    </Container>
  );
}
