import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useToast } from "heroui-native";

import { LanguagePickerModal } from "@/components/language-picker-modal";
import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";
import { pickAndEncodeProfilePicture } from "@/utils/profile-picture";
import { extractNameFromEmail } from "@/utils/email-name-extract";

const GOLD = "#F2C94C";
const BORDER = "#D9C9BC";
const MIN_INTERESTS = 3;
const MAX_INTERESTS = 7;

const LANGUAGE_FLAGS: Record<string, string> = {
  Afrikaans: "🇿🇦", Arabic: "🇸🇦", Bengali: "🇧🇩", Bulgarian: "🇧🇬",
  Catalan: "🏳️", Chinese: "🇨🇳", Croatian: "🇭🇷", Czech: "🇨🇿",
  Danish: "🇩🇰", Dutch: "🇳🇱", English: "🇬🇧", Estonian: "🇪🇪",
  Finnish: "🇫🇮", French: "🇫🇷", German: "🇩🇪", Greek: "🇬🇷",
  Hebrew: "🇮🇱", Hindi: "🇮🇳", Hungarian: "🇭🇺", Indonesian: "🇮🇩",
  Italian: "🇮🇹", Japanese: "🇯🇵", Korean: "🇰🇷", Latvian: "🇱🇻",
  Lithuanian: "🇱🇹", Malay: "🇲🇾", Norwegian: "🇳🇴", Persian: "🇮🇷",
  Polish: "🇵🇱", Portuguese: "🇵🇹", Romanian: "🇷🇴", Russian: "🇷🇺",
  Serbian: "🇷🇸", Slovak: "🇸🇰", Slovenian: "🇸🇮", Spanish: "🇪🇸",
  Swedish: "🇸🇪", Thai: "🇹🇭", Turkish: "🇹🇷", Ukrainian: "🇺🇦",
  Vietnamese: "🇻🇳",
};

const LEVEL_BLOCKS = [
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

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="font-manrope-semi text-[11px] tracking-[2px] uppercase mb-3"
      style={{ color: "#8A7570" }}
    >
      {children}
    </Text>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { data: session } = authClient.useSession();

  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());

  const [nameInput, setNameInput] = useState("");
  const [surnameInput, setSurnameInput] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [identityInitialized, setIdentityInitialized] = useState(false);
  const [addingType, setAddingType] = useState<"spoken" | "learning" | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const setIdentityMutation = useMutation({
    ...trpc.profile.setIdentityProfile.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: (e) => {
      toast.show({ variant: "danger", label: (e as { message?: string }).message ?? "Failed to save." });
    },
  });

  const upsertLangMutation = useMutation({
    ...trpc.profile.upsertLanguage.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => toast.show({ variant: "danger", label: "Failed to update language." }),
  });

  const removeLangMutation = useMutation({
    ...trpc.profile.removeLanguage.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => toast.show({ variant: "danger", label: "Failed to remove language." }),
  });

  const toggleInterestMutation = useMutation({
    ...trpc.profile.toggleInterest.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () => toast.show({ variant: "danger", label: "Failed to update interest." }),
  });

  function saveIdentity(name: string, surname: string, image?: string) {
    const n = name.trim();
    const s = surname.trim();
    if (!n || !s) return;
    setIdentityMutation.mutate({ name: n, surname: s, imageUrl: image });
  }

  function scheduleIdentitySave(name: string, surname: string) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveIdentity(name, surname, imageUri);
    }, 1200);
  }

  async function handlePickPicture() {
    const result = await pickAndEncodeProfilePicture();
    if (result.error) {
      toast.show({ variant: "danger", label: result.error });
      return;
    }
    if (result.imageDataUri) {
      setImageUri(result.imageDataUri);
      saveIdentity(nameInput, surnameInput, result.imageDataUri);
    }
  }

  const identity = profileQuery.data?.identity;
  const languages = profileQuery.data?.languages ?? [];
  const spokenLanguages = languages.filter((l) => l.type === "spoken");
  const learningLanguages = languages.filter((l) => l.type === "learning");
  const savedInterests = profileQuery.data?.interests ?? [];
  const allSelectedLanguages = languages.map((l) => l.language);

  return (
    <View
      className="flex-1 bg-background"
      style={{ flex: 1, paddingTop: insets.top }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="px-6 pt-6 pb-4 flex-row items-center justify-between">
          <Text className="font-caveat text-[28px] text-foreground">Profile</Text>
          <Pressable
            onPress={() =>
              Alert.alert("Sign out", "Are you sure?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
                  style: "destructive",
                  onPress: async () => {
                    queryClient.clear();
                    await authClient.signOut();
                  },
                },
              ])
            }
          >
            <Text className="font-manrope text-[14px]" style={{ color: "#C0876A" }}>
              Sign out
            </Text>
          </Pressable>
        </View>

        <View className="px-6 gap-8">
          {/* Identity section */}
          <View>
            <SectionLabel>About you</SectionLabel>

            {/* Photo */}
            <Pressable onPress={handlePickPicture} className="mb-5 self-start">
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    borderWidth: 2.5,
                    borderColor: GOLD,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    borderWidth: 2.5,
                    borderColor: GOLD,
                    backgroundColor: "#F5EFE8",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 28, color: BORDER }}>+</Text>
                </View>
              )}
            </Pressable>

            {/* Name fields */}
            <View className="gap-3">
              <View className="gap-1.5">
                <Text
                  className="font-manrope-semi text-[11px] tracking-[1.8px] uppercase"
                  style={{ color: "#8A7570" }}
                >
                  First name
                </Text>
                <TextInput
                  value={nameInput}
                  onChangeText={(v) => {
                    setNameInput(v);
                    scheduleIdentitySave(v, surnameInput);
                  }}
                  onBlur={() => saveIdentity(nameInput, surnameInput, imageUri)}
                  placeholder="Anna"
                  placeholderTextColor={BORDER}
                  autoCapitalize="words"
                  className="font-manrope-md text-[16px] text-foreground bg-brand-input rounded-xl px-4 py-3.5"
                  style={{ borderWidth: 1.5, borderColor: BORDER }}
                />
              </View>
              <View className="gap-1.5">
                <Text
                  className="font-manrope-semi text-[11px] tracking-[1.8px] uppercase"
                  style={{ color: "#8A7570" }}
                >
                  Surname
                </Text>
                <TextInput
                  value={surnameInput}
                  onChangeText={(v) => {
                    setSurnameInput(v);
                    scheduleIdentitySave(nameInput, v);
                  }}
                  onBlur={() => saveIdentity(nameInput, surnameInput, imageUri)}
                  placeholder="de Vries"
                  placeholderTextColor={BORDER}
                  autoCapitalize="words"
                  className="font-manrope-md text-[16px] text-foreground bg-brand-input rounded-xl px-4 py-3.5"
                  style={{ borderWidth: 1.5, borderColor: BORDER }}
                />
              </View>
              {identity?.email ? (
                <Text className="font-manrope text-[13px]" style={{ color: "#8A7570" }}>
                  {identity.email}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Spoken languages */}
          <View>
            <SectionLabel>Languages I speak</SectionLabel>
            <View className="gap-3">
              {spokenLanguages.map((sl) => (
                <View
                  key={sl.language}
                  className="bg-brand-input rounded-2xl p-4 gap-3"
                  style={{ borderWidth: 1.5, borderColor: BORDER }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5">
                      <Text style={{ fontSize: 24 }}>
                        {LANGUAGE_FLAGS[sl.language] ?? "🌐"}
                      </Text>
                      <Text className="font-manrope-bold text-[15px] text-foreground">
                        {sl.language}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeLangMutation.mutate({ language: sl.language, type: "spoken" })}
                    >
                      <Text className="font-manrope text-[13px]" style={{ color: "#C0876A" }}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                  <View className="flex-row gap-2">
                    {LEVEL_BLOCKS.map((lvl) => (
                      <Pressable
                        key={lvl.value}
                        onPress={() =>
                          upsertLangMutation.mutate({
                            language: sl.language,
                            type: "spoken",
                            proficiency: lvl.value,
                          })
                        }
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 12,
                          alignItems: "center",
                          backgroundColor:
                            sl.proficiency === lvl.value ? GOLD : "transparent",
                          borderWidth: 1.5,
                          borderColor:
                            sl.proficiency === lvl.value ? GOLD : BORDER,
                        }}
                      >
                        <Text
                          className="font-manrope-bold text-[13px]"
                          style={{
                            color: sl.proficiency === lvl.value ? "#2C1810" : "#8A7570",
                          }}
                        >
                          {lvl.label}
                        </Text>
                        <Text
                          className="font-manrope text-[11px]"
                          style={{
                            color: sl.proficiency === lvl.value ? "#2C1810" : BORDER,
                          }}
                        >
                          {lvl.sub}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              <Pressable
                onPress={() => setAddingType("spoken")}
                className="flex-row items-center gap-1 py-1"
              >
                <Text
                  className="font-manrope-semi text-[15px]"
                  style={{ color: GOLD }}
                >
                  + Add a language
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Learning languages */}
          <View>
            <SectionLabel>Languages I'm learning</SectionLabel>
            <View className="gap-3">
              {learningLanguages.map((ll) => (
                <View
                  key={ll.language}
                  className="bg-brand-input rounded-2xl p-4 gap-3"
                  style={{ borderWidth: 1.5, borderColor: BORDER }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2.5">
                      <Text style={{ fontSize: 24 }}>
                        {LANGUAGE_FLAGS[ll.language] ?? "🌐"}
                      </Text>
                      <Text className="font-manrope-bold text-[15px] text-foreground">
                        {ll.language}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => removeLangMutation.mutate({ language: ll.language, type: "learning" })}
                    >
                      <Text className="font-manrope text-[13px]" style={{ color: "#C0876A" }}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                  <View className="flex-row gap-2">
                    {LEVEL_BLOCKS.map((lvl) => (
                      <Pressable
                        key={lvl.value}
                        onPress={() =>
                          upsertLangMutation.mutate({
                            language: ll.language,
                            type: "learning",
                            proficiency: lvl.value,
                          })
                        }
                        style={{
                          flex: 1,
                          paddingVertical: 10,
                          borderRadius: 12,
                          alignItems: "center",
                          backgroundColor:
                            ll.proficiency === lvl.value ? GOLD : "transparent",
                          borderWidth: 1.5,
                          borderColor:
                            ll.proficiency === lvl.value ? GOLD : BORDER,
                        }}
                      >
                        <Text
                          className="font-manrope-bold text-[13px]"
                          style={{
                            color:
                              ll.proficiency === lvl.value ? "#2C1810" : "#8A7570",
                          }}
                        >
                          {lvl.label}
                        </Text>
                        <Text
                          className="font-manrope text-[11px]"
                          style={{
                            color:
                              ll.proficiency === lvl.value ? "#2C1810" : BORDER,
                          }}
                        >
                          {lvl.sub}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              <Pressable
                onPress={() => setAddingType("learning")}
                className="flex-row items-center gap-1 py-1"
              >
                <Text
                  className="font-manrope-semi text-[15px]"
                  style={{ color: GOLD }}
                >
                  + Add a language
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Interests */}
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <SectionLabel>Interests</SectionLabel>
              <Text className="font-manrope text-[13px]" style={{ color: "#8A7570" }}>
                {savedInterests.length} / {MAX_INTERESTS}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {INTERESTS.map((item) => {
                const selected = savedInterests.some((i) => i.interest === item.value);
                const atMax = savedInterests.length >= MAX_INTERESTS && !selected;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => !atMax && toggleInterestMutation.mutate({ interest: item.value })}
                    disabled={toggleInterestMutation.isPending || atMax}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 9,
                      borderRadius: 50,
                      backgroundColor: selected ? "#2C1810" : "transparent",
                      borderWidth: 1.5,
                      borderColor: selected ? "#2C1810" : BORDER,
                      opacity: atMax ? 0.4 : 1,
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
            {savedInterests.length < MIN_INTERESTS && (
              <Text
                className="font-manrope text-[13px] mt-3"
                style={{ color: "#C0876A" }}
              >
                Pick at least {MIN_INTERESTS} to activate matching
              </Text>
            )}
          </View>
        </View>
      </ScrollView>

      <LanguagePickerModal
        visible={addingType !== null}
        title={addingType === "spoken" ? "Add spoken language" : "Add learning language"}
        disabledLanguages={allSelectedLanguages}
        onSelect={(lang) => {
          upsertLangMutation.mutate({
            language: lang,
            type: addingType!,
            proficiency: "beginner",
          });
          setAddingType(null);
        }}
        onClose={() => setAddingType(null)}
      />
    </View>
  );
}
