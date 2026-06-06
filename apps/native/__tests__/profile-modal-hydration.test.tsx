/**
 * Regression test for bug #360 — Profile modal does not hydrate after
 * onboarding completes in the same session.
 *
 * Race: profileQuery resolves first with null name/surname (pre-onboarding),
 * then refetches with populated identity after `setIdentityProfile` writes.
 * Local input state must be seeded from the refetch.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

jest.mock("expo-updates", () => ({
  checkForUpdateAsync: jest.fn().mockResolvedValue({ isAvailable: false }),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
  updateId: null,
}));

jest.mock("expo-constants", () => ({
  default: { expoConfig: { version: "0.0.0" } },
}));

jest.mock("heroui-native", () => ({
  useToast: () => ({ toast: { show: jest.fn() } }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null }),
    signOut: jest.fn(),
  },
}));

jest.mock("@/utils/profile-picture", () => ({
  pickAndEncodeProfilePicture: jest.fn(),
}));

jest.mock("@/components/language-picker-modal", () => ({
  LanguagePickerModal: () => null,
}));

const mockSetIdentityMutate = jest.fn();
const mockProfileQueryFn = jest.fn();

jest.mock("@/utils/trpc", () => ({
  trpc: {
    profile: {
      getMyProfile: {
        queryOptions: () => ({
          queryKey: ["profile.getMyProfile"],
          queryFn: mockProfileQueryFn,
        }),
      },
      setIdentityProfile: {
        mutationOptions: () => ({
          mutationFn: (vars: unknown) => {
            mockSetIdentityMutate(vars);
            return Promise.resolve({ ok: true });
          },
        }),
      },
      upsertLanguage: {
        mutationOptions: () => ({ mutationFn: jest.fn() }),
      },
      removeLanguage: {
        mutationOptions: () => ({ mutationFn: jest.fn() }),
      },
      toggleInterest: {
        mutationOptions: () => ({ mutationFn: jest.fn() }),
      },
      deleteAccount: {
        mutationOptions: () => ({ mutationFn: jest.fn() }),
      },
    },
  },
  queryClient: { invalidateQueries: jest.fn(), clear: jest.fn() },
}));

import { ProfileModal } from "../components/profile-modal";

function renderModal(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <ProfileModal visible={true} onDismiss={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockSetIdentityMutate.mockReset();
  mockProfileQueryFn.mockReset();
});

describe("#360 — profile modal hydration after onboarding", () => {
  it("seeds name + surname + image when identity arrives in a later refetch", async () => {
    mockProfileQueryFn.mockResolvedValueOnce({
      identity: { name: null, surname: null, image: null, email: "a@b.c" },
      profile: null,
      languages: [],
      interests: [],
    });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderModal(client);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Anna").props.value).toBe("");
      expect(screen.getByPlaceholderText("de Vries").props.value).toBe("");
    });

    mockProfileQueryFn.mockResolvedValueOnce({
      identity: {
        name: "Anna",
        surname: "Smith",
        image: "data:image/jpeg;base64,xyz",
        email: "a@b.c",
      },
      profile: null,
      languages: [],
      interests: [],
    });

    await act(async () => {
      await client.invalidateQueries({ queryKey: ["profile.getMyProfile"] });
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Anna").props.value).toBe("Anna");
      expect(screen.getByPlaceholderText("de Vries").props.value).toBe("Smith");
    });
  });
});
