/**
 * Tests for task #381 — Gate the Conversation Starters screen on the buddy's
 * profile languages.
 *
 * The screen reads the buddy's spoken + learning languages via the existing
 * `trpc.profile.getMyProfile` query and branches its render:
 *   - loading  → a loading state (never the empty state)
 *   - error    → a sensible fallback, not a false empty state
 *   - empty    → no spoken/learning languages → "add a language" empty state
 *                with a CTA that navigates to the profile/onboarding screen
 *   - ready    → ≥1 language → the cards entry-point container that later
 *                Features (#377 picker, #378 deck) fill in
 *
 * Scenario 1: Buddy with no profile languages sees the empty state.
 * Scenario 2: Buddy with at least one language reaches the cards entry point.
 * Scenario 3: Profile is still loading → loading state.
 * Edge: profile query errors → fallback, not a false empty state.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/container", () => {
  const { View } = require("react-native");
  return {
    Container: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

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
    },
    // The ready-state deck (#405) lives behind the gate; stub it with an empty
    // set so this gate-focused suite never touches real content.
    content: {
      starters: {
        listByLanguage: {
          queryOptions: (input: { language: string }) => ({
            queryKey: ["content.starters.listByLanguage", input],
            queryFn: () =>
              Promise.resolve({ language: input.language, cards: [] }),
          }),
        },
      },
    },
  },
}));

// eslint-disable-next-line import/first
import ConversationStartersScreen from "../app/(tabs)/conversation-starters";

const ENTRY_POINT_TEST_ID = "conversation-starters-entry-point";
const EMPTY_TEST_ID = "conversation-starters-empty";
const LOADING_TEST_ID = "conversation-starters-loading";

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ConversationStartersScreen />
    </QueryClientProvider>,
  );
}

const profileWith = (
  languages: { language: string; type: "spoken" | "learning" }[],
) => ({
  identity: { name: "Anna", surname: "de Vries", image: null, email: "a@b.nl" },
  profile: null,
  languages,
  interests: [],
});

describe("#381 — Gate Conversation Starters on profile languages", () => {
  beforeEach(() => {
    mockGetMyProfile.mockReset();
    mockPush.mockReset();
  });

  describe("Scenario: Buddy with no profile languages sees the empty state", () => {
    it("shows the empty state with a CTA to the profile/onboarding screen", async () => {
      mockGetMyProfile.mockResolvedValue(profileWith([]));

      renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId(EMPTY_TEST_ID)).toBeTruthy();
      });

      // Empty state explains that languages must be added.
      expect(screen.getByText(/add a language/i)).toBeTruthy();
      // Entry point is NOT rendered while there are no languages.
      expect(screen.queryByTestId(ENTRY_POINT_TEST_ID)).toBeNull();

      // CTA navigates to the profile/onboarding screen.
      fireEvent.press(screen.getByTestId("conversation-starters-empty-cta"));
      expect(mockPush).toHaveBeenCalledTimes(1);
    });
  });

  describe("Scenario: Buddy with at least one language reaches the cards entry point", () => {
    it("renders the entry point for a spoken language", async () => {
      mockGetMyProfile.mockResolvedValue(
        profileWith([{ language: "es", type: "spoken" }]),
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId(ENTRY_POINT_TEST_ID)).toBeTruthy();
      });
      expect(screen.queryByTestId(EMPTY_TEST_ID)).toBeNull();
    });

    it("renders the entry point for a learning-only language", async () => {
      mockGetMyProfile.mockResolvedValue(
        profileWith([{ language: "fr", type: "learning" }]),
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId(ENTRY_POINT_TEST_ID)).toBeTruthy();
      });
      expect(screen.queryByTestId(EMPTY_TEST_ID)).toBeNull();
    });
  });

  describe("Scenario: Profile is still loading", () => {
    it("shows the loading state, not the empty state", async () => {
      // A promise that never resolves keeps the query pending.
      mockGetMyProfile.mockReturnValue(new Promise(() => {}));

      renderScreen();

      expect(screen.getByTestId(LOADING_TEST_ID)).toBeTruthy();
      expect(screen.queryByTestId(EMPTY_TEST_ID)).toBeNull();
      expect(screen.queryByTestId(ENTRY_POINT_TEST_ID)).toBeNull();
    });
  });

  describe("Edge: profile query errors", () => {
    it("shows a fallback rather than a false empty state", async () => {
      mockGetMyProfile.mockRejectedValue(new Error("network"));

      renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId("conversation-starters-error")).toBeTruthy();
      });
      // Must NOT misrepresent an error as "no languages".
      expect(screen.queryByTestId(EMPTY_TEST_ID)).toBeNull();
    });
  });
});
