/**
 * Tests for task #405 — the conversation-starter card deck browser.
 *
 * Gherkin scenarios (Feature #378):
 *   - First card shown on open (with "1 / N" position indicator).
 *   - Stepping forward and back one card at a time.
 *   - No wrap-around at the ends (Previous disabled on first, Next on last).
 *   - Changing language resets the deck to the first card.
 *   - No curated cards for a language → a clear "no cards yet" state.
 *
 * The deck fetches its cards via `content.starters.listByLanguage` (#404) and
 * holds the current position in screen-local `useState`, mirroring the
 * index-based stepper in `apps/native/app/match.tsx`.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

type Card = { id: string; text: string; translation: string };

const mockListByLanguage = jest.fn();

jest.mock("@/utils/trpc", () => ({
  trpc: {
    content: {
      starters: {
        listByLanguage: {
          queryOptions: (input: { language: string }) => ({
            queryKey: ["content.starters.listByLanguage", input],
            queryFn: () => mockListByLanguage(input),
          }),
        },
      },
    },
  },
}));

// eslint-disable-next-line import/first
import { CardDeck } from "@/components/conversation-starters/card-deck";

const POSITION_TEST_ID = "card-deck-position";
const CARD_TEXT_TEST_ID = "card-deck-text";
const NEXT_TEST_ID = "card-deck-next";
const PREV_TEST_ID = "card-deck-previous";
const EMPTY_TEST_ID = "card-deck-empty";

function makeCards(language: string, count: number): Card[] {
  return Array.from({ length: count }, (_, i) => {
    const n = String(i + 1).padStart(3, "0");
    return {
      id: `${language}-${n}`,
      text: `${language} question ${i + 1}`,
      translation: `English ${i + 1}`,
    };
  });
}

function renderDeck(language: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CardDeck language={language} />
    </QueryClientProvider>,
  );
}

describe("#405 — Conversation-starter card deck browser", () => {
  beforeEach(() => {
    mockListByLanguage.mockReset();
  });

  describe("Scenario: First card shown on open", () => {
    it("shows the first Dutch card and a '1 / 30' indicator", async () => {
      const cards = makeCards("Dutch", 30);
      mockListByLanguage.mockResolvedValue({ language: "Dutch", cards });

      renderDeck("Dutch");

      await waitFor(() => {
        expect(screen.getByTestId(CARD_TEXT_TEST_ID)).toBeTruthy();
      });
      expect(screen.getByTestId(CARD_TEXT_TEST_ID).props.children).toBe(
        cards[0].text,
      );
      expect(screen.getByTestId(POSITION_TEST_ID).props.children).toBe("1 / 30");
    });

    it("renders the card text in the chosen language, not the translation", async () => {
      const cards = makeCards("Dutch", 30);
      mockListByLanguage.mockResolvedValue({ language: "Dutch", cards });

      renderDeck("Dutch");

      await waitFor(() => {
        expect(screen.getByTestId(CARD_TEXT_TEST_ID).props.children).toBe(
          "Dutch question 1",
        );
      });
      expect(screen.queryByText("English 1")).toBeNull();
    });
  });

  describe("Scenario: Stepping forward and back", () => {
    it("advances on Next and returns on Previous", async () => {
      const cards = makeCards("Dutch", 30);
      mockListByLanguage.mockResolvedValue({ language: "Dutch", cards });

      renderDeck("Dutch");

      await waitFor(() => {
        expect(screen.getByTestId(CARD_TEXT_TEST_ID)).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId(NEXT_TEST_ID));
      expect(screen.getByTestId(CARD_TEXT_TEST_ID).props.children).toBe(
        cards[1].text,
      );
      expect(screen.getByTestId(POSITION_TEST_ID).props.children).toBe("2 / 30");

      fireEvent.press(screen.getByTestId(PREV_TEST_ID));
      expect(screen.getByTestId(CARD_TEXT_TEST_ID).props.children).toBe(
        cards[0].text,
      );
      expect(screen.getByTestId(POSITION_TEST_ID).props.children).toBe("1 / 30");
    });
  });

  describe("Scenario: No wrap-around at the ends", () => {
    it("disables Previous on the first card and Next on the last", async () => {
      const cards = makeCards("Dutch", 3);
      mockListByLanguage.mockResolvedValue({ language: "Dutch", cards });

      renderDeck("Dutch");

      await waitFor(() => {
        expect(screen.getByTestId(CARD_TEXT_TEST_ID)).toBeTruthy();
      });

      // First card → Previous disabled, Next enabled.
      expect(
        screen.getByTestId(PREV_TEST_ID).props.accessibilityState.disabled,
      ).toBe(true);
      expect(
        screen.getByTestId(NEXT_TEST_ID).props.accessibilityState.disabled,
      ).toBe(false);

      // Pressing a disabled Previous must not wrap to the last card.
      fireEvent.press(screen.getByTestId(PREV_TEST_ID));
      expect(screen.getByTestId(POSITION_TEST_ID).props.children).toBe("1 / 3");

      // Walk to the last card.
      fireEvent.press(screen.getByTestId(NEXT_TEST_ID));
      fireEvent.press(screen.getByTestId(NEXT_TEST_ID));
      expect(screen.getByTestId(POSITION_TEST_ID).props.children).toBe("3 / 3");

      // Last card → Next disabled, Previous enabled.
      expect(
        screen.getByTestId(NEXT_TEST_ID).props.accessibilityState.disabled,
      ).toBe(true);
      expect(
        screen.getByTestId(PREV_TEST_ID).props.accessibilityState.disabled,
      ).toBe(false);

      // Pressing a disabled Next must not wrap to the first card.
      fireEvent.press(screen.getByTestId(NEXT_TEST_ID));
      expect(screen.getByTestId(POSITION_TEST_ID).props.children).toBe("3 / 3");
    });
  });

  describe("Scenario: Changing language resets the deck", () => {
    it("resets to the first card when the language prop changes", async () => {
      const dutch = makeCards("Dutch", 30);
      const spanish = makeCards("Spanish", 30);
      mockListByLanguage.mockImplementation(
        ({ language }: { language: string }) =>
          Promise.resolve({
            language,
            cards: language === "Dutch" ? dutch : spanish,
          }),
      );

      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const { rerender } = render(
        <QueryClientProvider client={client}>
          <CardDeck language="Dutch" />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId(CARD_TEXT_TEST_ID)).toBeTruthy();
      });

      // Advance to card 5 of Dutch.
      for (let i = 0; i < 4; i++) {
        fireEvent.press(screen.getByTestId(NEXT_TEST_ID));
      }
      expect(screen.getByTestId(POSITION_TEST_ID).props.children).toBe("5 / 30");

      // Switch language → deck resets to the first card.
      rerender(
        <QueryClientProvider client={client}>
          <CardDeck language="Spanish" />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId(CARD_TEXT_TEST_ID).props.children).toBe(
          spanish[0].text,
        );
      });
      expect(screen.getByTestId(POSITION_TEST_ID).props.children).toBe("1 / 30");
    });
  });

  describe("Scenario: No curated cards for a language", () => {
    it("shows a 'no cards yet' state instead of a blank deck", async () => {
      mockListByLanguage.mockResolvedValue({ language: "Klingon", cards: [] });

      renderDeck("Klingon");

      await waitFor(() => {
        expect(screen.getByTestId(EMPTY_TEST_ID)).toBeTruthy();
      });
      // No card, no position indicator, no stepper buttons.
      expect(screen.queryByTestId(CARD_TEXT_TEST_ID)).toBeNull();
      expect(screen.queryByTestId(POSITION_TEST_ID)).toBeNull();
      expect(screen.queryByTestId(NEXT_TEST_ID)).toBeNull();
      expect(screen.queryByTestId(PREV_TEST_ID)).toBeNull();
    });
  });

  describe("Loading and error states", () => {
    it("shows a loading state while fetching", async () => {
      let resolve: (v: { language: string; cards: Card[] }) => void = () => {};
      mockListByLanguage.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );

      renderDeck("Dutch");

      expect(screen.getByTestId("card-deck-loading")).toBeTruthy();
      resolve({ language: "Dutch", cards: makeCards("Dutch", 30) });
      await waitFor(() => {
        expect(screen.getByTestId(CARD_TEXT_TEST_ID)).toBeTruthy();
      });
    });

    it("shows an error state when the query fails", async () => {
      mockListByLanguage.mockRejectedValue(new Error("boom"));

      renderDeck("Dutch");

      await waitFor(() => {
        expect(screen.getByTestId("card-deck-error")).toBeTruthy();
      });
    });
  });
});
