/**
 * Tests for task #313 — confirmation dialog after sending a match request
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/utils/language-flags", () => ({
  getLanguageFlag: () => "🏳",
  getLanguageCode: (l: string) => l,
  getNativeName: (l: string) => l,
}));

jest.mock("@/utils/interest-labels", () => ({
  interestLabel: (t: string) => t,
}));

const mockSendMatchRequest = jest.fn();

jest.mock("@/utils/trpc", () => ({
  trpc: {
    matching: {
      sendMatchRequest: {
        mutationOptions: () => ({ mutationFn: mockSendMatchRequest }),
      },
    },
  },
}));

import { MatchCard } from "../components/match-card";

const candidate = {
  userId: "user-1",
  name: "Anna",
  image: null,
  age: null,
  university: null,
  spokenLanguages: [{ language: "Dutch", proficiency: "native" }],
  learningLanguages: ["English"],
  interests: [],
  score: 0.9,
};

const onAccept = jest.fn();
const onDecline = jest.fn();

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MatchCard
        candidate={candidate}
        yourLanguage="English"
        onAccept={onAccept}
        onDecline={onDecline}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockSendMatchRequest.mockReset();
  onAccept.mockClear();
  onDecline.mockClear();
  jest.spyOn(Alert, "alert").mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("#313 — confirmation dialog after sending a match request", () => {
  it("shows a confirmation alert when the match request succeeds", async () => {
    mockSendMatchRequest.mockResolvedValue({ matchRequestId: "req-1", status: "pending" });
    const alertSpy = jest.spyOn(Alert, "alert");

    renderCard();

    fireEvent.press(screen.getByTestId("accept-button"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });

    expect(alertSpy.mock.calls[0][0]).toBe("Invitation sent!");
  });

  it("does not show a confirmation alert when the match request fails", async () => {
    mockSendMatchRequest.mockRejectedValue(new Error("network error"));
    const alertSpy = jest.spyOn(Alert, "alert");

    renderCard();

    fireEvent.press(screen.getByTestId("accept-button"));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("calls onAccept after dismissing the confirmation dialog", async () => {
    mockSendMatchRequest.mockResolvedValue({ matchRequestId: "req-1", status: "pending" });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_title, _msg, buttons) => {
      buttons?.[0]?.onPress?.();
    });

    renderCard();

    fireEvent.press(screen.getByTestId("accept-button"));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(onAccept).toHaveBeenCalledTimes(1);
    });
  });
});
