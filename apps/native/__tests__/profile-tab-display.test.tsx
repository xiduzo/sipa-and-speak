/**
 * Tests for task #281 — Display name, surname, and picture in the profile UI.
 *
 * The standalone `app/profile.tsx` screen was removed during the "added tabs"
 * migration. The logged-in user's own identity (name / surname / picture) is
 * now rendered by the `ProfileModal` component (`components/profile-modal.tsx`),
 * opened from the home tab's profile avatar. These tests assert the #281
 * scenarios against that component, using its real rendering idioms:
 *   - name  → the "Anna"     TextInput's `value`
 *   - surname → the "de Vries" TextInput's `value`
 *   - picture → an <Image> (no "+" placeholder)
 *   - placeholder → the "+" placeholder text when image is null
 *
 * Scenario 1: Student with complete identity sees name, surname, and picture.
 * Scenario 2: Student without a profile picture sees the placeholder.
 * Scenario 3: Identity reflects the latest values from getMyProfile.
 * Edge: name shows, surname empty when surname is null.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Image } from "react-native";
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

const mockGetMyProfile = jest.fn();

jest.mock("@/utils/trpc", () => ({
  trpc: {
    profile: {
      getMyProfile: {
        queryOptions: () => ({
          queryKey: ["profile.getMyProfile"],
          queryFn: mockGetMyProfile,
        }),
      },
      setIdentityProfile: {
        mutationOptions: () => ({ mutationFn: jest.fn() }),
      },
      upsertLanguage: { mutationOptions: () => ({ mutationFn: jest.fn() }) },
      removeLanguage: { mutationOptions: () => ({ mutationFn: jest.fn() }) },
      toggleInterest: { mutationOptions: () => ({ mutationFn: jest.fn() }) },
      deleteAccount: { mutationOptions: () => ({ mutationFn: jest.fn() }) },
    },
  },
  queryClient: { invalidateQueries: jest.fn(), clear: jest.fn() },
}));

import { ProfileModal } from "../components/profile-modal";

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProfileModal visible={true} onDismiss={() => {}} />
    </QueryClientProvider>,
  );
}

describe("#281 — Profile identity display", () => {
  beforeEach(() => mockGetMyProfile.mockReset());

  describe("Scenario 1: complete identity profile", () => {
    it("shows name, surname, and profile picture", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: {
          name: "Sander",
          surname: "Boer",
          image: "data:image/jpeg;base64,abc",
          email: "s.boer@student.tue.nl",
        },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Anna").props.value).toBe("Sander");
        expect(screen.getByPlaceholderText("de Vries").props.value).toBe(
          "Boer",
        );
      });

      // Picture present: an <Image> renders, and no "+" placeholder is shown.
      const images = screen.UNSAFE_queryAllByType(Image);
      expect(images.length).toBeGreaterThan(0);
      expect(screen.queryByText("+")).toBeNull();
    });
  });

  describe("Scenario 2: no profile picture → placeholder", () => {
    it("shows the placeholder when image is null", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: {
          name: "Sander",
          surname: "Boer",
          image: null,
          email: "s.boer@student.tue.nl",
        },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      // Wait for identity to hydrate so we assert against the resolved state.
      await waitFor(() => {
        expect(screen.getByPlaceholderText("Anna").props.value).toBe("Sander");
      });

      // Identity still shows; only the picture falls back to the placeholder.
      expect(screen.getByPlaceholderText("de Vries").props.value).toBe("Boer");
      expect(screen.getByText("+")).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType(Image).length).toBe(0);
    });
  });

  describe("Scenario 3: updated values reflected", () => {
    it("displays the latest name and surname from getMyProfile", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: {
          name: "Alex",
          surname: "Updated",
          image: null,
          email: "a.updated@student.tue.nl",
        },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Anna").props.value).toBe("Alex");
        expect(screen.getByPlaceholderText("de Vries").props.value).toBe(
          "Updated",
        );
      });
    });
  });

  describe("edge cases", () => {
    it("shows the name and leaves surname empty when surname is null", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: {
          name: "Sander",
          surname: null,
          image: null,
          email: "s@student.tue.nl",
        },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Anna").props.value).toBe("Sander");
      });
      expect(screen.getByPlaceholderText("de Vries").props.value).toBe("");
    });
  });
});
