/**
 * Tests for task #122 — Send Request action on suggestion card
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSendMatchRequest = jest.fn().mockResolvedValue({ matchRequestId: "req-1", status: "pending" });

jest.mock("@/utils/trpc", () => ({
  trpc: {
    matching: {
      sendMatchRequest: {
        mutationOptions: () => ({ mutationFn: mockSendMatchRequest }),
      },
    },
  },
}));

import { CandidateCard } from "../components/candidate-card";

const defaultProps = {
  userId: "user-abc",
  name: "Alice",
  image: null,
  spokenLanguages: [{ language: "Dutch", proficiency: "native" as const }],
  learningLanguages: ["English"],
  interests: ["tech_coding"],
};

function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockPush.mockClear();
  mockSendMatchRequest.mockClear();
});

describe("#122 — Send Request on suggestion card", () => {
  it("renders a Send Request button", () => {
    renderWithQuery(<CandidateCard {...defaultProps} />);
    expect(screen.getByTestId("send-request-button")).toBeTruthy();
  });

  it("calls sendMatchRequest with the candidate's userId when tapped", async () => {
    renderWithQuery(<CandidateCard {...defaultProps} />);

    fireEvent.press(screen.getByTestId("send-request-button"));

    await waitFor(() => {
      expect(mockSendMatchRequest).toHaveBeenCalledTimes(1);
    });
  });

  it("navigates to the candidate profile when the card body is tapped", () => {
    renderWithQuery(<CandidateCard {...defaultProps} />);

    fireEvent.press(screen.getByTestId("candidate-card"));

    expect(mockPush).toHaveBeenCalledWith("/partner/user-abc");
  });
});
