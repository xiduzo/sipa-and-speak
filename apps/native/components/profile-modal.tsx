import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useToast } from "heroui-native";

import { LanguagePickerModal } from "@/components/language-picker-modal";
import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";
import { pickAndEncodeProfilePicture } from "@/utils/profile-picture";
import { INTERESTS } from "@/utils/interest-labels";
import { getLanguageFlag } from "@/utils/language-flags";

const GOLD = "#F2C94C";
const BORDER = "#D9C9BC";
const MIN_INTERESTS = 3;
const MAX_INTERESTS = 7;

const LEVEL_BLOCKS = [
  { value: "beginner" as const, label: "A1–A2", sub: "Beginner" },
  { value: "intermediate" as const, label: "B1–B2", sub: "Intermediate" },
  { value: "advanced" as const, label: "C1–C2", sub: "Advanced" },
];

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

interface ProfileModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ProfileModal({ visible, onDismiss }: ProfileModalProps) {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const { data: session } = authClient.useSession();

  const profileQuery = useQuery(trpc.profile.getMyProfile.queryOptions());

  const [nameInput, setNameInput] = useState("");
  const [surnameInput, setSurnameInput] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [addingType, setAddingType] = useState<"spoken" | "learning" | null>(
    null,
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const nameFocusedRef = useRef(false);
  const surnameFocusedRef = useRef(false);
  const lastHydratedRef = useRef<{
    name: string | null;
    surname: string | null;
    image: string | null;
  }>({ name: null, surname: null, image: null });

  useEffect(() => {
    if (__DEV__) return;
    Updates.checkForUpdateAsync()
      .then(({ isAvailable }) => setUpdateAvailable(isAvailable))
      .catch(() => {});
  }, []);

  async function handleUpdate() {
    setIsUpdating(true);
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    } catch {
      toast.show({
        variant: "danger",
        label: "Update failed. Try again later.",
      });
      setIsUpdating(false);
    }
  }

  useEffect(() => {
    if (!profileQuery.data) return;
    const identity = profileQuery.data.identity;
    const serverName = identity?.name ?? null;
    const serverSurname = identity?.surname ?? null;
    const serverImage = identity?.image ?? null;
    const last = lastHydratedRef.current;
    const isPending = pendingSaveRef.current;

    if (serverName !== last.name && !nameFocusedRef.current && !isPending) {
      setNameInput(serverName ?? "");
      last.name = serverName;
    }
    if (
      serverSurname !== last.surname &&
      !surnameFocusedRef.current &&
      !isPending
    ) {
      setSurnameInput(serverSurname ?? "");
      last.surname = serverSurname;
    }
    if (serverImage !== last.image && !isPending) {
      setImageUri(serverImage ?? undefined);
      last.image = serverImage;
    }
  }, [profileQuery.data]);

  const setIdentityMutation = useMutation({
    ...trpc.profile.setIdentityProfile.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onSettled: () => {
      pendingSaveRef.current = false;
    },
    onError: (e) => {
      toast.show({
        variant: "danger",
        label: (e as { message?: string }).message ?? "Failed to save.",
      });
    },
  });

  const upsertLangMutation = useMutation({
    ...trpc.profile.upsertLanguage.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () =>
      toast.show({ variant: "danger", label: "Failed to update language." }),
  });

  const removeLangMutation = useMutation({
    ...trpc.profile.removeLanguage.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () =>
      toast.show({ variant: "danger", label: "Failed to remove language." }),
  });

  const toggleInterestMutation = useMutation({
    ...trpc.profile.toggleInterest.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries(),
    onError: () =>
      toast.show({ variant: "danger", label: "Failed to update interest." }),
  });

  // #5 — permanent account deletion. On success, mirror the sign-out flow so the
  // AuthGuard sees the lost session and routes back to /enrolment.
  const deleteAccountMutation = useMutation({
    ...trpc.profile.deleteAccount.mutationOptions(),
    onSuccess: async () => {
      queryClient.clear();
      await authClient.signOut();
      onDismiss();
    },
    onError: (e) =>
      toast.show({
        variant: "danger",
        label: (e as { message?: string }).message ?? "Couldn't delete account.",
      }),
  });

  function saveIdentity(name: string, surname: string, image?: string) {
    const n = name.trim();
    const s = surname.trim();
    if (!n || !s) return;
    pendingSaveRef.current = true;
    lastHydratedRef.current = {
      name: n,
      surname: s,
      image: image ?? null,
    };
    setIdentityMutation.mutate({ name: n, surname: s, imageUrl: image });
  }

  function scheduleIdentitySave(name: string, surname: string) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    pendingSaveRef.current = true;
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

  // Each category must always retain at least one language (mirrors the
  // onboarding invariant + the server guard in removeLanguage). Block the
  // removal of the last one and explain why.
  function handleRemoveLanguage(language: string, type: "spoken" | "learning") {
    const remaining =
      type === "spoken" ? spokenLanguages.length : learningLanguages.length;
    if (remaining <= 1) {
      Alert.alert(
        "Keep at least one language",
        "You should always have at least one language in this category",
      );
      return;
    }
    removeLangMutation.mutate({ language, type });
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View
        className="flex-1 bg-background"
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 pt-6 pb-4 flex-row items-center justify-between">
            <Text className="font-caveat text-[28px] text-foreground">
              Profile
            </Text>
            <Pressable onPress={onDismiss}>
              <Text
                className="font-manrope text-[14px]"
                style={{ color: "#8A7570" }}
              >
                Close
              </Text>
            </Pressable>
          </View>

          <View className="px-6 gap-8">
            <View>
              <SectionLabel>About you</SectionLabel>
              <Pressable
                onPress={handlePickPicture}
                className="mb-5 self-start"
              >
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
                    onFocus={() => {
                      nameFocusedRef.current = true;
                    }}
                    onBlur={() => {
                      nameFocusedRef.current = false;
                      saveIdentity(nameInput, surnameInput, imageUri);
                    }}
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
                    onFocus={() => {
                      surnameFocusedRef.current = true;
                    }}
                    onBlur={() => {
                      surnameFocusedRef.current = false;
                      saveIdentity(nameInput, surnameInput, imageUri);
                    }}
                    placeholder="de Vries"
                    placeholderTextColor={BORDER}
                    autoCapitalize="words"
                    className="font-manrope-md text-[16px] text-foreground bg-brand-input rounded-xl px-4 py-3.5"
                    style={{ borderWidth: 1.5, borderColor: BORDER }}
                  />
                </View>
                {identity?.email ? (
                  <Text
                    className="font-manrope text-[13px]"
                    style={{ color: "#8A7570" }}
                  >
                    {identity.email}
                  </Text>
                ) : null}
              </View>
            </View>

            <View>
              <SectionLabel>Languages I speak</SectionLabel>
              {spokenLanguages.length === 0 && (
                <Text
                  className="font-manrope text-[13px] mb-3"
                  style={{ color: "#C0876A" }}
                >
                  Add at least one spoken language to activate matching
                </Text>
              )}
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
                          {getLanguageFlag(sl.language)}
                        </Text>
                        <Text className="font-manrope-bold text-[15px] text-foreground">
                          {sl.language}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          handleRemoveLanguage(sl.language, "spoken")
                        }
                      >
                        <Text
                          className="font-manrope text-[13px]"
                          style={{ color: "#C0876A" }}
                        >
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
                              sl.proficiency === lvl.value
                                ? GOLD
                                : "transparent",
                            borderWidth: 1.5,
                            borderColor:
                              sl.proficiency === lvl.value ? GOLD : BORDER,
                          }}
                        >
                          <Text
                            className="font-manrope-bold text-[13px]"
                            style={{
                              color:
                                sl.proficiency === lvl.value
                                  ? "#2C1810"
                                  : "#8A7570",
                            }}
                          >
                            {lvl.label}
                          </Text>
                          <Text
                            className="font-manrope text-[11px]"
                            style={{
                              color:
                                sl.proficiency === lvl.value
                                  ? "#2C1810"
                                  : BORDER,
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

            <View>
              <SectionLabel>Languages I'm learning</SectionLabel>
              {learningLanguages.length === 0 && (
                <Text
                  className="font-manrope text-[13px] mb-3"
                  style={{ color: "#C0876A" }}
                >
                  Add at least one language you are learning to activate
                  matching
                </Text>
              )}
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
                          {getLanguageFlag(ll.language)}
                        </Text>
                        <Text className="font-manrope-bold text-[15px] text-foreground">
                          {ll.language}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          handleRemoveLanguage(ll.language, "learning")
                        }
                      >
                        <Text
                          className="font-manrope text-[13px]"
                          style={{ color: "#C0876A" }}
                        >
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
                              ll.proficiency === lvl.value
                                ? GOLD
                                : "transparent",
                            borderWidth: 1.5,
                            borderColor:
                              ll.proficiency === lvl.value ? GOLD : BORDER,
                          }}
                        >
                          <Text
                            className="font-manrope-bold text-[13px]"
                            style={{
                              color:
                                ll.proficiency === lvl.value
                                  ? "#2C1810"
                                  : "#8A7570",
                            }}
                          >
                            {lvl.label}
                          </Text>
                          <Text
                            className="font-manrope text-[11px]"
                            style={{
                              color:
                                ll.proficiency === lvl.value
                                  ? "#2C1810"
                                  : BORDER,
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

            <View>
              <View className="flex-row items-center justify-between mb-3">
                <SectionLabel>Interests</SectionLabel>
                <Text
                  className="font-manrope text-[13px]"
                  style={{ color: "#8A7570" }}
                >
                  {savedInterests.length} / {MAX_INTERESTS}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {INTERESTS.map((item) => {
                  const selected = savedInterests.some(
                    (i) => i.interest === item.value,
                  );
                  const atMax =
                    savedInterests.length >= MAX_INTERESTS && !selected;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() =>
                        !atMax &&
                        toggleInterestMutation.mutate({ interest: item.value })
                      }
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

          <View className="px-6 pt-8 items-center gap-1">
            {updateAvailable && (
              <Pressable
                onPress={handleUpdate}
                disabled={isUpdating}
                style={{
                  backgroundColor: GOLD,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  marginBottom: 8,
                  opacity: isUpdating ? 0.6 : 1,
                }}
              >
                <Text
                  className="font-manrope-bold text-[14px]"
                  style={{ color: "#2C1810" }}
                >
                  {isUpdating
                    ? "Updating…"
                    : "Update available — tap to restart"}
                </Text>
              </Pressable>
            )}
            <Text
              className="font-manrope text-[12px]"
              style={{ color: BORDER }}
            >
              v{Constants.expoConfig?.version}
              {Constants.expoConfig?.ios?.buildNumber
                ? ` (${Constants.expoConfig.ios.buildNumber})`
                : Constants.expoConfig?.android?.versionCode
                  ? ` (${Constants.expoConfig.android.versionCode})`
                  : null}
            </Text>
            {Updates.updateId ? (
              <Text
                className="font-manrope text-[11px]"
                style={{ color: BORDER }}
                numberOfLines={1}
              >
                {Updates.updateId}
              </Text>
            ) : null}
          </View>

          <View className="px-6 pb-4 mt-4">
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
                      onDismiss();
                    },
                  },
                ])
              }
              style={{
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
                borderWidth: 1.5,
                borderColor: "#E57373",
              }}
            >
              <Text
                className="font-manrope-semi text-[15px]"
                style={{ color: "#E57373" }}
              >
                Sign out
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                Alert.alert(
                  "Delete account",
                  "This permanently deletes your profile, matches, chats and meet-ups. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete account",
                      style: "destructive",
                      onPress: () => deleteAccountMutation.mutate(),
                    },
                  ],
                )
              }
              disabled={deleteAccountMutation.isPending}
              className="items-center"
              style={{
                paddingVertical: 12,
                marginTop: 4,
                opacity: deleteAccountMutation.isPending ? 0.5 : 1,
              }}
            >
              <Text
                className="font-manrope text-[13px]"
                style={{ color: "#B0463C", textDecorationLine: "underline" }}
              >
                {deleteAccountMutation.isPending ? "Deleting…" : "Delete account"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      <LanguagePickerModal
        visible={addingType !== null}
        title={
          addingType === "spoken"
            ? "Add spoken language"
            : "Add learning language"
        }
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
    </Modal>
  );
}
