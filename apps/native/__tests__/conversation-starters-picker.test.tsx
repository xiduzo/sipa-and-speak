/**
 * Tests for task #403 — wiring the card-language picker into the Conversation
 * Starters screen's ready state (past the #381 gate).
 *
 * Screen-level Gherkin scenarios:
 *   - Selecting a language activates it and reveals the deck area.
 *   - A single profile language is auto-selected and the picker collapses.
 *   - The selection persists while the buddy stays on the tab.
 *
 * The picker's own option rendering / de-dup is covered in
 * card-language-picker.test.tsx.
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
    // Deck content (#405) is exercised in conversation-starters-deck.test.tsx;
    // here it is stubbed empty so the picker assertions stay focused.
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
const PICKER_TEST_ID = "card-language-picker";
const DECK_AREA_TEST_ID = "conversation-starters-deck-area";

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

describe("#403 — Card-language picker on Conversation Starters", () => {
  beforeEach(() => {
    mockGetMyProfile.mockReset();
    mockPush.mockReset();
  });

  describe("Scenario: Picker shows only profile languages", () => {
    it("renders the picker with the buddy's two languages", async () => {
      mockGetMyProfile.mockResolvedValue(
        profileWith([
          { language: "Dutch", type: "spoken" },
          { language: "Spanish", type: "learning" },
        ]),
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId(PICKER_TEST_ID)).toBeTruthy();
      });
      expect(screen.getByTestId("card-language-option-Dutch")).toBeTruthy();
      expect(screen.getByTestId("card-language-option-Spanish")).toBeTruthy();
    });
  });

  describe("Scenario: Selecting a language activates it and reveals the deck area", () => {
    it("activates Dutch and reveals the deck area on press", async () => {
      mockGetMyProfile.mockResolvedValue(
        profileWith([
          { language: "Dutch", type: "spoken" },
          { language: "Spanish", type: "learning" },
        ]),
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId(PICKER_TEST_ID)).toBeTruthy();
      });
      // Nothing selected yet → deck area hidden.
      expect(screen.queryByTestId(DECK_AREA_TEST_ID)).toBeNull();

      fireEvent.press(screen.getByTestId("card-language-option-Dutch"));

      // Deck area for Dutch is now revealed and exposes the active language.
      const deck = screen.getByTestId(DECK_AREA_TEST_ID);
      expect(deck).toBeTruthy();
      expect(deck.props.accessibilityLabel).toBe("Cards for Dutch");
      // The active option is announced as selected.
      expect(
        screen.getByTestId("card-language-option-Dutch").props
          .accessibilityState.selected,
      ).toBe(true);
    });
  });

  describe("Scenario: Single profile language is auto-selected", () => {
    it("auto-selects the only language and collapses the picker", async () => {
      mockGetMyProfile.mockResolvedValue(
        profileWith([{ language: "Dutch", type: "learning" }]),
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId(ENTRY_POINT_TEST_ID)).toBeTruthy();
      });
      // Picker collapsed — no manual pick needed.
      expect(screen.queryByTestId(PICKER_TEST_ID)).toBeNull();
      // Dutch is already active → deck area shown.
      const deck = screen.getByTestId(DECK_AREA_TEST_ID);
      expect(deck.props.accessibilityLabel).toBe("Cards for Dutch");
    });
  });

  describe("Scenario: Duplicate across spoken and learning is shown once", () => {
    it("auto-selects when the only language appears in both lists", async () => {
      mockGetMyProfile.mockResolvedValue(
        profileWith([
          { language: "Dutch", type: "spoken" },
          { language: "Dutch", type: "learning" },
        ]),
      );

      renderScreen();

      await waitFor(() => {
        expect(screen.getByTestId(ENTRY_POINT_TEST_ID)).toBeTruthy();
      });
      // De-duped to one → behaves as a single language: collapsed + auto-select.
      expect(screen.queryByTestId(PICKER_TEST_ID)).toBeNull();
      expect(screen.getByTestId(DECK_AREA_TEST_ID).props.accessibilityLabel).toBe(
        "Cards for Dutch",
      );
    });
  });

  describe("Scenario: Selection persists while on the tab", () => {
    it("keeps the chosen language active across re-renders", async () => {
      mockGetMyProfile.mockResolvedValue(
        profileWith([
          { language: "Dutch", type: "spoken" },
          { language: "Spanish", type: "learning" },
        ]),
      );

      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const tree = (
        <QueryClientProvider client={client}>
          <ConversationStartersScreen />
        </QueryClientProvider>
      );
      const { rerender } = render(tree);

      await waitFor(() => {
        expect(screen.getByTestId(PICKER_TEST_ID)).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId("card-language-option-Spanish"));
      expect(screen.getByTestId(DECK_AREA_TEST_ID).props.accessibilityLabel).toBe(
        "Cards for Spanish",
      );

      // A re-render of the same mounted tree (still on the tab) must keep the
      // chosen language — screen-local useState is the persistence mechanism.
      rerender(tree);

      expect(screen.getByTestId(DECK_AREA_TEST_ID).props.accessibilityLabel).toBe(
        "Cards for Spanish",
      );
    });
  });
});
