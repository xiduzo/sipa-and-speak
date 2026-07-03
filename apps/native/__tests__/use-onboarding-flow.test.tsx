/**
 * Tests for the headless onboarding-wizard view-model
 * (`hooks/use-onboarding-flow.ts`).
 *
 * These drive the orchestration that used to be duplicated (and drifting)
 * across `app/index.tsx` and `components/onboarding-modal.tsx` — the per-step
 * advance gates (delegating to `@/utils/onboarding-flow`), the pre-fill /
 * jump-to-step-3 initialisation, and the mutation cascades (identity save,
 * finish's upsert + invalidate + callback, the header-Skip partial save) —
 * through `renderHook`, with NO component rendered. tRPC, `Alert`, and the
 * toast are mocked; React Query runs for real.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

// ── tRPC / query / toast mocks ──────────────────────────────────────────────

const mockSetIdentity = jest.fn().mockResolvedValue({});
const mockUpsert = jest.fn().mockResolvedValue({});
const mockPartial = jest.fn().mockResolvedValue({});
const mockInvalidate = jest.fn().mockResolvedValue(undefined);
const mockToastShow = jest.fn();

// Mutated per-test to control what the status/profile queries return.
let mockStatus: { complete: boolean; identityProfileComplete: boolean } = {
  complete: false,
  identityProfileComplete: false,
};
let mockProfile: { identity: { name?: string | null; surname?: string | null; image?: string | null } | null } = {
  identity: null,
};

// NOTE: jest hoists these factories above the `const mock* = jest.fn()`
// declarations, so every mock value MUST be read *lazily* — inside the
// returned arrows, which run at query/mutate time once the consts exist.
type MutOpts = { onSuccess?: () => void; onError?: (e: Error) => void };
const mut = (fn: () => jest.Mock) => ({
  mutationOptions: (opts?: MutOpts) => ({
    mutationFn: (vars: unknown) => fn()(vars),
    onSuccess: opts?.onSuccess,
    onError: opts?.onError,
  }),
});
const q = (key: string, get: () => unknown) => ({
  queryOptions: (..._args: unknown[]) => ({ queryKey: [key], queryFn: async () => get() }),
});

jest.mock("@/utils/trpc", () => ({
  trpc: {
    profile: {
      getOnboardingStatus: q("getOnboardingStatus", () => mockStatus),
      getMyProfile: q("getMyProfile", () => mockProfile),
      setIdentityProfile: mut(() => mockSetIdentity),
      upsertProfile: mut(() => mockUpsert),
      savePartialProfile: mut(() => mockPartial),
    },
  },
  queryClient: { invalidateQueries: (...a: unknown[]) => mockInvalidate(...a) },
}));

jest.mock("heroui-native", () => ({
  useToast: () => ({ toast: { show: (...a: unknown[]) => mockToastShow(...a) } }),
}));

jest.mock("@/utils/profile-picture", () => ({
  pickAndEncodeProfilePicture: jest.fn().mockResolvedValue({ imageDataUri: "data:img" }),
}));

// ── Import after mocks ──────────────────────────────────────────────────────
// eslint-disable-next-line import/first
import { useOnboardingFlow } from "@/hooks/use-onboarding-flow";

const mockAlert = jest.fn();

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

const baseArgs = { sessionUserId: "user-1" };

function renderFlow(args: Partial<Parameters<typeof useOnboardingFlow>[0]> = {}) {
  return renderHook(() => useOnboardingFlow({ ...baseArgs, ...args }), {
    wrapper: createWrapper(),
  });
}

async function untilLoaded(result: { current: { statusPending: boolean } }) {
  await waitFor(() => expect(result.current.statusPending).toBe(false));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = { complete: false, identityProfileComplete: false };
  mockProfile = { identity: null };
  (Alert as unknown as { alert: jest.Mock }).alert = mockAlert;
});

// ── identity steps ──────────────────────────────────────────────────────────

describe("useOnboardingFlow — identity steps", () => {
  it("alerts and does not save when the name is missing", async () => {
    const { result } = renderFlow();
    await untilLoaded(result);
    await act(async () => result.current.continueFromName());
    expect(mockAlert).toHaveBeenCalledWith("Name required", "Please enter your first name.");
    expect(mockSetIdentity).not.toHaveBeenCalled();
    expect(result.current.step).toBe(1);
  });

  it("saves the identity and advances to step 2", async () => {
    const { result } = renderFlow();
    await untilLoaded(result);
    act(() => {
      result.current.setNameInput("Anna ");
      result.current.setSurnameInput(" de Vries");
    });
    await act(async () => result.current.continueFromName());
    expect(mockSetIdentity).toHaveBeenCalledWith({
      name: "Anna",
      surname: "de Vries",
      imageUrl: undefined,
    });
    expect(result.current.step).toBe(2);
  });

  it("advances past the photo step and invalidates in a full onboarding run", async () => {
    const { result } = renderFlow();
    await untilLoaded(result);
    await act(async () => result.current.continueFromPhoto());
    expect(mockSetIdentity).toHaveBeenCalledTimes(1);
    expect(result.current.step).toBe(3);
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("identity-only run (2 steps): photo continue invalidates without advancing", async () => {
    mockStatus = { complete: true, identityProfileComplete: false };
    const { result } = renderFlow();
    await untilLoaded(result);
    await waitFor(() => expect(result.current.totalSteps).toBe(2));
    await act(async () => result.current.continueFromPhoto());
    expect(result.current.step).toBe(1);
    expect(mockInvalidate).toHaveBeenCalled();
  });

  it("pre-fills the name and jumps to step 3 when the identity profile is already complete", async () => {
    mockStatus = { complete: false, identityProfileComplete: true };
    mockProfile = { identity: { name: "Anna", surname: "de Vries", image: null } };
    const { result } = renderFlow();
    await waitFor(() => expect(result.current.step).toBe(3));
    expect(result.current.nameInput).toBe("Anna");
    expect(result.current.surnameInput).toBe("de Vries");
  });
});

// ── wizard gates (from @/utils/onboarding-flow) ─────────────────────────────

describe("useOnboardingFlow — step gates", () => {
  it("blocks step 3 without a spoken language and advances once one is added", async () => {
    const { result } = renderFlow();
    await untilLoaded(result);
    act(() => result.current.continueFromSpoken());
    expect(result.current.validationError).toBe("Add at least one language you speak.");

    act(() => result.current.openPicker("spoken"));
    act(() => result.current.addPickedLanguage("Dutch"));
    expect(result.current.spokenLanguages).toEqual([
      { language: "Dutch", proficiency: "beginner" },
    ]);
    expect(result.current.pickerTarget).toBeNull();

    act(() => result.current.continueFromSpoken());
    expect(result.current.validationError).toBeNull();
    expect(result.current.step).toBe(4);
  });

  it("blocks step 4 without a learning language", async () => {
    const { result } = renderFlow();
    await untilLoaded(result);
    act(() => result.current.continueFromLearning());
    expect(result.current.validationError).toBe("Add at least one language to learn.");
  });

  it("blocks finish below the 3-interest minimum and never calls upsert", async () => {
    const { result } = renderFlow();
    await untilLoaded(result);
    act(() => result.current.toggleInterest("cosmology"));
    act(() => result.current.toggleInterest("literature"));
    expect(result.current.canFinish).toBe(false);
    await act(async () => result.current.finish());
    expect(result.current.validationError).toBe("Pick at least 3 topics.");
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

// ── finish + skip cascades ──────────────────────────────────────────────────

describe("useOnboardingFlow — cascades", () => {
  it("finish upserts the profile, invalidates, and calls onFinished", async () => {
    const onFinished = jest.fn();
    const { result } = renderFlow({ onFinished });
    await untilLoaded(result);
    act(() => result.current.openPicker("spoken"));
    act(() => result.current.addPickedLanguage("Dutch"));
    act(() => result.current.openPicker("learning"));
    act(() => result.current.addPickedLanguage("Spanish"));
    act(() => result.current.toggleInterest("cosmology"));
    act(() => result.current.toggleInterest("literature"));
    act(() => result.current.toggleInterest("fitness_sports"));
    expect(result.current.canFinish).toBe(true);

    await act(async () => result.current.finish());
    expect(mockUpsert).toHaveBeenCalledWith({
      spokenLanguages: [{ language: "Dutch", proficiency: "beginner" }],
      learningLanguages: [{ language: "Spanish", proficiency: "beginner" }],
      interests: ["cosmology", "literature", "fitness_sports"],
    });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("finish surfaces the failure toast and does not call onFinished", async () => {
    mockUpsert.mockRejectedValueOnce(new Error("nope"));
    const onFinished = jest.fn();
    const { result } = renderFlow({ onFinished });
    await untilLoaded(result);
    act(() => result.current.toggleInterest("cosmology"));
    act(() => result.current.toggleInterest("literature"));
    act(() => result.current.toggleInterest("fitness_sports"));
    await act(async () => result.current.finish());
    await waitFor(() => expect(mockToastShow).toHaveBeenCalled());
    expect(onFinished).not.toHaveBeenCalled();
  });

  it("skipWizard from the wizard steps saves only the non-empty selections and calls onSkipped", async () => {
    mockStatus = { complete: false, identityProfileComplete: true };
    mockProfile = { identity: { name: "Anna", surname: "de Vries", image: null } };
    const onSkipped = jest.fn();
    const { result } = renderFlow({ onSkipped });
    await waitFor(() => expect(result.current.step).toBe(3));
    act(() => result.current.openPicker("spoken"));
    act(() => result.current.addPickedLanguage("Dutch"));

    await act(async () => result.current.skipWizard());
    expect(mockPartial).toHaveBeenCalledWith({
      spokenLanguages: [{ language: "Dutch", proficiency: "beginner" }],
    });
    expect(mockInvalidate).toHaveBeenCalled();
    expect(onSkipped).toHaveBeenCalledTimes(1);
  });

  it("skipWizard from step 1 saves the identity when filled and advances to step 2", async () => {
    const { result } = renderFlow();
    await untilLoaded(result);
    act(() => {
      result.current.setNameInput("Anna");
      result.current.setSurnameInput("de Vries");
    });
    await act(async () => result.current.skipWizard());
    expect(mockSetIdentity).toHaveBeenCalledTimes(1);
    expect(mockPartial).not.toHaveBeenCalled();
    expect(result.current.step).toBe(2);
  });

  it("skipPhoto advances in a full run and invalidates in an identity-only run", async () => {
    const full = renderFlow();
    await untilLoaded(full.result);
    act(() => full.result.current.skipPhoto());
    expect(full.result.current.step).toBe(3);
    expect(mockInvalidate).not.toHaveBeenCalled();

    mockStatus = { complete: true, identityProfileComplete: false };
    const identityOnly = renderFlow();
    await untilLoaded(identityOnly.result);
    await waitFor(() => expect(identityOnly.result.current.totalSteps).toBe(2));
    act(() => identityOnly.result.current.skipPhoto());
    expect(identityOnly.result.current.step).toBe(1);
    expect(mockInvalidate).toHaveBeenCalled();
  });
});

// ── session reset ───────────────────────────────────────────────────────────

describe("useOnboardingFlow — session reset", () => {
  it("clears wizard state when the session goes away", async () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | undefined }) =>
        useOnboardingFlow({ sessionUserId: userId }),
      { wrapper: createWrapper(), initialProps: { userId: "user-1" as string | undefined } },
    );
    await untilLoaded(result);
    act(() => {
      result.current.setNameInput("Anna");
      result.current.toggleInterest("cosmology");
    });
    act(() => result.current.skipPhoto());
    expect(result.current.step).toBe(3);

    rerender({ userId: undefined });
    await waitFor(() => expect(result.current.step).toBe(1));
    expect(result.current.nameInput).toBe("");
    expect(result.current.interests).toEqual([]);
  });
});
