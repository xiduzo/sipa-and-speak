/**
 * Headless onboarding-wizard view-model — the behaviour behind BOTH wizard
 * surfaces: the standalone onboarding screen (`app/index.tsx`) and the overlay
 * `OnboardingModal`.
 *
 * The components own pixels (screen-vs-modal chrome, where the Skip affordance
 * lives); everything with a bug surface lives here, stated once: the step
 * state and per-step advance gates (delegating to the pure rules in
 * `@/utils/onboarding-flow`), the identity/profile pre-fill and jump-to-step-3
 * initialisation, the session-reset, and the three mutation cascades
 * (setIdentityProfile, upsertProfile + invalidate + completion callback, and
 * the screen's savePartialProfile skip). Returns a small view-model driven
 * directly with `renderHook`, mirroring `use-meetup-flow.ts`.
 *
 * Server stays the source of truth for matching eligibility
 * (`OnboardingProgression`); these are only the wizard's own UX gates.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import { useEffect, useState } from "react";
import { Alert } from "react-native";

import type { InterestValue } from "@/utils/interest-labels";
import {
  isOnboardingStepComplete,
  validateOnboardingStep,
  type OnboardingLanguage,
} from "@/utils/onboarding-flow";
import { pickAndEncodeProfilePicture } from "@/utils/profile-picture";
import { queryClient, trpc } from "@/utils/trpc";

export type LanguagePickerTarget = "spoken" | "learning";

export type UseOnboardingFlowArgs = {
  /** Current session user; state resets when it goes away. */
  sessionUserId: string | undefined;
  /**
   * Whether the onboarding-status query may run. The standalone screen runs it
   * unconditionally (it only mounts behind auth); the overlay modal gates it on
   * having a session.
   */
  statusQueryEnabled?: boolean;
  /** Runs after the finish cascade (upsert + invalidate). Screen: navigate home. */
  onFinished?: () => void;
  /** Runs after the skip-wizard cascade (partial save + invalidate). Screen: navigate home. */
  onSkipped?: () => void;
};

export function useOnboardingFlow({
  sessionUserId,
  statusQueryEnabled = true,
  onFinished,
  onSkipped,
}: UseOnboardingFlowArgs) {
  const { toast } = useToast();

  const statusQuery = useQuery({
    ...trpc.profile.getOnboardingStatus.queryOptions(),
    enabled: statusQueryEnabled,
  });
  const profileQuery = useQuery({
    ...trpc.profile.getMyProfile.queryOptions(),
    enabled: !!sessionUserId,
  });

  const [step, setStep] = useState(1);
  const [initialized, setInitialized] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [surnameInput, setSurnameInput] = useState("");
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [spokenLanguages, setSpokenLanguages] = useState<OnboardingLanguage[]>([]);
  const [learningLanguages, setLearningLanguages] = useState<OnboardingLanguage[]>([]);
  const [interests, setInterests] = useState<InterestValue[]>([]);
  const [pickerTarget, setPickerTarget] = useState<LanguagePickerTarget | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Counts the wizard's gate rules (in @/utils/onboarding-flow) operate on.
  const counts = {
    spoken: spokenLanguages.length,
    learning: learningLanguages.length,
    interests: interests.length,
  };

  const needsFullOnboarding = statusQuery.data?.complete === false;
  const identityProfileComplete = statusQuery.data?.identityProfileComplete === true;
  const totalSteps = needsFullOnboarding ? 5 : 2;

  // Reset state when the user session goes away.
  useEffect(() => {
    if (!sessionUserId) {
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
  }, [sessionUserId]);

  // Pre-fill identity from the profile, and jump past the identity steps when
  // they are already complete.
  useEffect(() => {
    if (initialized || !profileQuery.data || !statusQuery.data) return;
    const identity = profileQuery.data.identity;
    if (identity?.name || identity?.surname) {
      setNameInput(identity.name ?? "");
      setSurnameInput(identity.surname ?? "");
    }
    setImageUri(identity?.image ?? undefined);
    if (needsFullOnboarding && statusQuery.data.identityProfileComplete) {
      setStep(3);
    }
    setInitialized(true);
  }, [profileQuery.data, statusQuery.data, initialized, needsFullOnboarding]);

  const setIdentityMutation = useMutation({
    ...trpc.profile.setIdentityProfile.mutationOptions(),
    onError: (e) => {
      toast.show({ variant: "danger", label: (e as { message?: string }).message ?? "Failed to save." });
    },
  });

  const upsertMutation = useMutation({
    ...trpc.profile.upsertProfile.mutationOptions(),
    onError: () => toast.show({ variant: "danger", label: "Failed to save profile." }),
  });

  const partialMutation = useMutation({
    ...trpc.profile.savePartialProfile.mutationOptions(),
    onError: () => toast.show({ variant: "danger", label: "Failed to save." }),
  });

  const isSaving =
    setIdentityMutation.isPending || upsertMutation.isPending || partialMutation.isPending;

  // ── language / interest selections ─────────────────────────────────────────

  function openPicker(target: LanguagePickerTarget) {
    setPickerTarget(target);
  }

  function closePicker() {
    setPickerTarget(null);
  }

  /** Add the picked language to whichever list the picker was opened for. */
  function addPickedLanguage(language: string) {
    if (pickerTarget === "spoken") {
      setSpokenLanguages((prev) => [...prev, { language, proficiency: "beginner" }]);
    } else if (pickerTarget === "learning") {
      setLearningLanguages((prev) => [...prev, { language, proficiency: "beginner" }]);
    }
    setPickerTarget(null);
  }

  function removeSpoken(language: string) {
    setSpokenLanguages((prev) => prev.filter((l) => l.language !== language));
  }

  function removeLearning(language: string) {
    setLearningLanguages((prev) => prev.filter((l) => l.language !== language));
  }

  function setSpokenProficiency(language: string, proficiency: OnboardingLanguage["proficiency"]) {
    setSpokenLanguages((prev) =>
      prev.map((l) => (l.language === language ? { ...l, proficiency } : l)),
    );
  }

  function setLearningProficiency(language: string, proficiency: OnboardingLanguage["proficiency"]) {
    setLearningLanguages((prev) =>
      prev.map((l) => (l.language === language ? { ...l, proficiency } : l)),
    );
  }

  function toggleInterest(interest: InterestValue) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  }

  // ── step actions ───────────────────────────────────────────────────────────

  async function continueFromName() {
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
    try {
      await setIdentityMutation.mutateAsync({ name, surname, imageUrl: imageUri });
      setValidationError(null);
      setStep(2);
    } catch {
      /* handled in onError */
    }
  }

  async function continueFromPhoto() {
    try {
      await setIdentityMutation.mutateAsync({
        name: nameInput.trim(),
        surname: surnameInput.trim(),
        imageUrl: imageUri,
      });
      setValidationError(null);
      if (needsFullOnboarding) setStep(3);
      // Identity-only run: the refetched status dismisses the wizard.
      void queryClient.invalidateQueries();
    } catch {
      /* handled in onError */
    }
  }

  /** The step-2 "Or do this later" / photo Skip affordance. */
  function skipPhoto() {
    if (needsFullOnboarding) {
      setStep(3);
    } else {
      void queryClient.invalidateQueries();
    }
  }

  function continueFromSpoken() {
    const v = validateOnboardingStep(3, counts);
    if (!v.ok) {
      setValidationError(v.error);
      return;
    }
    setValidationError(null);
    setStep(4);
  }

  function continueFromLearning() {
    const v = validateOnboardingStep(4, counts);
    if (!v.ok) {
      setValidationError(v.error);
      return;
    }
    setValidationError(null);
    setStep(5);
  }

  async function finish() {
    const v = validateOnboardingStep(5, counts);
    if (!v.ok) {
      setValidationError(v.error);
      return;
    }
    setValidationError(null);
    try {
      await upsertMutation.mutateAsync({ spokenLanguages, learningLanguages, interests });
      await queryClient.invalidateQueries();
      onFinished?.();
    } catch {
      /* handled in onError */
    }
  }

  /**
   * The standalone screen's header Skip: advances past the identity steps, and
   * from the wizard steps saves whatever partial profile exists before handing
   * off via `onSkipped`.
   */
  async function skipWizard() {
    if (step === 1) {
      const name = nameInput.trim();
      const surname = surnameInput.trim();
      if (name && surname) {
        try {
          await setIdentityMutation.mutateAsync({ name, surname, imageUrl: imageUri });
        } catch {
          return; // handled in onError
        }
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    try {
      const input: {
        spokenLanguages?: OnboardingLanguage[];
        learningLanguages?: OnboardingLanguage[];
        interests?: InterestValue[];
      } = {};
      if (spokenLanguages.length > 0) input.spokenLanguages = spokenLanguages;
      if (learningLanguages.length > 0) input.learningLanguages = learningLanguages;
      if (interests.length > 0) input.interests = interests;
      await partialMutation.mutateAsync(input);
      await queryClient.invalidateQueries();
      onSkipped?.();
    } catch {
      /* handled in onError */
    }
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function pickPicture() {
    const result = await pickAndEncodeProfilePicture();
    if (result.error) {
      toast.show({ variant: "danger", label: result.error });
      return;
    }
    if (result.imageDataUri) setImageUri(result.imageDataUri);
  }

  return {
    // status
    statusPending: statusQuery.isPending,
    statusFetching: statusQuery.isFetching,
    statusComplete: statusQuery.data?.complete === true,
    identityProfileComplete,
    needsFullOnboarding,
    // step
    step,
    totalSteps,
    goBack,
    // identity
    nameInput,
    setNameInput,
    surnameInput,
    setSurnameInput,
    imageUri,
    pickPicture,
    // languages
    spokenLanguages,
    learningLanguages,
    pickerTarget,
    openPicker,
    closePicker,
    addPickedLanguage,
    removeSpoken,
    removeLearning,
    setSpokenProficiency,
    setLearningProficiency,
    // interests
    interests,
    toggleInterest,
    // gates + errors
    validationError,
    canContinueSpoken: isOnboardingStepComplete(3, counts),
    canContinueLearning: isOnboardingStepComplete(4, counts),
    canFinish: isOnboardingStepComplete(5, counts),
    // actions
    continueFromName,
    continueFromPhoto,
    skipPhoto,
    continueFromSpoken,
    continueFromLearning,
    finish,
    skipWizard,
    // pending
    savingIdentity: setIdentityMutation.isPending,
    finishing: upsertMutation.isPending,
    isSaving,
  };
}

export type OnboardingFlow = ReturnType<typeof useOnboardingFlow>;
