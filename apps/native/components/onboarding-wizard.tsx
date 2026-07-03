/**
 * Shared onboarding-wizard presentation — pure JSX over the
 * `useOnboardingFlow` view-model (`@/hooks/use-onboarding-flow`).
 *
 * Both wizard surfaces render this body; they differ only in chrome (screen vs
 * `Modal`), where the Skip affordance lives (`headerAccessory`), and two small
 * style choices (`levelVariant`, `learningAddLabel`). Everything behavioural
 * lives in the hook; everything vocabulary-like (titles, level blocks,
 * interests, flags) in utils.
 */
import type { ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Spinner } from "heroui-native";

import { LanguagePickerModal } from "@/components/language-picker-modal";
import type { OnboardingFlow } from "@/hooks/use-onboarding-flow";
import { INTERESTS } from "@/utils/interest-labels";
import { getLanguageFlag } from "@/utils/language-flags";
import {
  LEVEL_BLOCKS,
  ONBOARDING_STEP_SUBTITLES,
  ONBOARDING_STEP_TITLES,
  type OnboardingLanguage,
} from "@/utils/onboarding-flow";

const GOLD = "#F2C94C";
const MUTED_BORDER = "#D9C9BC";

export function GoldButton({
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

/** The two proficiency-block colourways the surfaces ship with. */
export type LevelVariant = "gold" | "dark";

const LEVEL_STYLES: Record<
  LevelVariant,
  {
    headerGap: string;
    paddingVertical: number;
    borderRadius: number;
    selectedBg: string;
    selectedText: string;
  }
> = {
  gold: { headerGap: "mb-3", paddingVertical: 10, borderRadius: 12, selectedBg: GOLD, selectedText: "#2C1810" },
  dark: { headerGap: "mb-4", paddingVertical: 8, borderRadius: 10, selectedBg: "#2C1810", selectedText: GOLD },
};

function LanguageCards({
  languages,
  variant,
  addLabel,
  onAdd,
  onRemove,
  onSetProficiency,
}: {
  languages: OnboardingLanguage[];
  variant: LevelVariant;
  addLabel: string;
  onAdd: () => void;
  onRemove: (language: string) => void;
  onSetProficiency: (language: string, proficiency: OnboardingLanguage["proficiency"]) => void;
}) {
  const s = LEVEL_STYLES[variant];
  return (
    <View className="gap-3">
      {languages.map((l) => (
        <View
          key={l.language}
          className="bg-brand-input rounded-2xl px-5 py-4"
          style={{ borderWidth: 2, borderColor: MUTED_BORDER }}
        >
          <View className={`flex-row items-center justify-between ${s.headerGap}`}>
            <View className="flex-row items-center gap-3">
              <Text style={{ fontSize: 24 }}>{getLanguageFlag(l.language, "🌐")}</Text>
              <Text className="font-manrope-bold text-[16px] text-foreground">{l.language}</Text>
            </View>
            <Pressable onPress={() => onRemove(l.language)}>
              <Text className="font-manrope text-[13px]" style={{ color: "#C0876A" }}>Remove</Text>
            </Pressable>
          </View>
          <View className="flex-row gap-2">
            {LEVEL_BLOCKS.map((lvl) => {
              const selected = l.proficiency === lvl.value;
              return (
                <Pressable
                  key={lvl.value}
                  onPress={() => onSetProficiency(l.language, lvl.value)}
                  style={{
                    flex: 1,
                    paddingVertical: s.paddingVertical,
                    borderRadius: s.borderRadius,
                    alignItems: "center",
                    backgroundColor: selected ? s.selectedBg : "transparent",
                    borderWidth: 1.5,
                    borderColor: selected ? s.selectedBg : MUTED_BORDER,
                  }}
                >
                  <Text
                    className="font-manrope-bold text-[13px]"
                    style={{ color: selected ? s.selectedText : "#8A7570" }}
                  >
                    {lvl.label}
                  </Text>
                  <Text
                    className="font-manrope text-[11px]"
                    style={{ color: selected ? s.selectedText : MUTED_BORDER }}
                  >
                    {lvl.sub}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <Pressable onPress={onAdd} className="flex-row items-center gap-2 py-2">
        <Text className="font-manrope-semi text-[15px]" style={{ color: GOLD }}>{addLabel}</Text>
      </Pressable>
    </View>
  );
}

export function OnboardingWizardBody({
  flow,
  headerAccessory,
  levelVariant,
  learningAddLabel = "+ Add a language",
}: {
  flow: OnboardingFlow;
  /** Rendered right of the "ABOUT YOU · x OF y" label (each surface's Skip). */
  headerAccessory?: ReactNode;
  levelVariant: LevelVariant;
  learningAddLabel?: string;
}) {
  const { step, totalSteps } = flow;
  return (
    <>
      <KeyboardAvoidingView
        className="flex-1"
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="flex-1 px-6 pt-6 pb-10" style={{ flex: 1 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="font-manrope-semi text-[11px] tracking-[2px] uppercase"
                style={{ color: GOLD }}
              >
                ABOUT YOU · {step} OF {totalSteps}
              </Text>
              {headerAccessory}
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

            {/* Title + subtitle */}
            <View className="mb-8">
              <Text className="font-caveat text-[42px] text-foreground leading-[46px]">
                {ONBOARDING_STEP_TITLES[step - 1]}
              </Text>
              <Text
                className="font-manrope text-[15px] italic mt-3 leading-[22px]"
                style={{ color: "#8A7570" }}
              >
                {ONBOARDING_STEP_SUBTITLES[step - 1]}
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
                    value={flow.nameInput}
                    onChangeText={flow.setNameInput}
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
                    value={flow.surnameInput}
                    onChangeText={flow.setSurnameInput}
                    placeholder="de Vries"
                    placeholderTextColor={MUTED_BORDER}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onSubmitEditing={flow.continueFromName}
                    className="font-manrope-md text-[17px] text-foreground bg-brand-input rounded-2xl px-5 py-4"
                    style={{ borderWidth: 2, borderColor: MUTED_BORDER }}
                  />
                </View>
              </View>
            )}

            {/* Step 2 — Photo */}
            {step === 2 && (
              <View className="flex-1 items-center justify-center gap-4">
                <Pressable onPress={flow.pickPicture}>
                  {flow.imageUri ? (
                    <Image
                      source={{ uri: flow.imageUri }}
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
              <LanguageCards
                languages={flow.spokenLanguages}
                variant={levelVariant}
                addLabel="+ Add a language"
                onAdd={() => flow.openPicker("spoken")}
                onRemove={flow.removeSpoken}
                onSetProficiency={flow.setSpokenProficiency}
              />
            )}

            {/* Step 4 — Learning languages */}
            {step === 4 && (
              <LanguageCards
                languages={flow.learningLanguages}
                variant={levelVariant}
                addLabel={learningAddLabel}
                onAdd={() => flow.openPicker("learning")}
                onRemove={flow.removeLearning}
                onSetProficiency={flow.setLearningProficiency}
              />
            )}

            {/* Step 5 — Interests */}
            {step === 5 && (
              <View>
                <View className="flex-row flex-wrap gap-2">
                  {INTERESTS.map((item) => {
                    const selected = flow.interests.includes(item.value);
                    return (
                      <Pressable
                        key={item.value}
                        onPress={() => flow.toggleInterest(item.value)}
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
                    {flow.interests.length} picked
                  </Text>
                  {flow.canFinish && (
                    <Text className="font-manrope-semi text-[14px]" style={{ color: GOLD }}>ready ✓</Text>
                  )}
                </View>
              </View>
            )}

            {flow.validationError && (
              <View
                className="rounded-xl p-3 mt-4"
                style={{ backgroundColor: "#FDF0ED", borderWidth: 1, borderColor: "#C0876A" }}
              >
                <Text className="font-manrope text-[13px]" style={{ color: "#C0876A" }}>
                  {flow.validationError}
                </Text>
              </View>
            )}

            <View className="flex-1" />

            {/* CTAs */}
            <View className="gap-3 mt-8">
              {step === 1 && (
                <GoldButton
                  onPress={flow.continueFromName}
                  loading={flow.savingIdentity}
                  label="Continue →"
                />
              )}
              {step === 2 && (
                <>
                  <GoldButton
                    onPress={flow.continueFromPhoto}
                    loading={flow.savingIdentity}
                    label="Continue →"
                  />
                  <Pressable onPress={flow.skipPhoto} className="items-center py-2.5">
                    <Text className="font-manrope text-sm" style={{ color: "#8A7570" }}>
                      Or do this later
                    </Text>
                  </Pressable>
                </>
              )}
              {step === 3 && (
                <>
                  <GoldButton
                    onPress={flow.continueFromSpoken}
                    disabled={!flow.canContinueSpoken}
                    label="Continue →"
                  />
                  <Pressable onPress={flow.goBack} className="items-center py-2.5">
                    <Text className="font-manrope text-sm" style={{ color: "#8A7570" }}>← Back</Text>
                  </Pressable>
                </>
              )}
              {step === 4 && (
                <>
                  <GoldButton
                    onPress={flow.continueFromLearning}
                    disabled={!flow.canContinueLearning}
                    label="Continue →"
                  />
                  <Pressable onPress={flow.goBack} className="items-center py-2.5">
                    <Text className="font-manrope text-sm" style={{ color: "#8A7570" }}>← Back</Text>
                  </Pressable>
                </>
              )}
              {step === 5 && (
                <>
                  <GoldButton
                    onPress={flow.finish}
                    loading={flow.finishing}
                    disabled={!flow.canFinish}
                    label="Finish — find matches →"
                  />
                  <Pressable onPress={flow.goBack} className="items-center py-2.5">
                    <Text className="font-manrope text-sm" style={{ color: "#8A7570" }}>← Back</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <LanguagePickerModal
        visible={flow.pickerTarget !== null}
        title={flow.pickerTarget === "spoken" ? "Add spoken language" : "Add learning language"}
        disabledLanguages={
          flow.pickerTarget === "spoken"
            ? flow.spokenLanguages.map((l) => l.language)
            : flow.learningLanguages.map((l) => l.language)
        }
        onSelect={flow.addPickedLanguage}
        onClose={flow.closePicker}
      />
    </>
  );
}
