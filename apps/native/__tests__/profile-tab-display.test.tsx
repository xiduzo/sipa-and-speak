/**
 * Tests for task #281 — Display name, surname, and picture in the profile tab
 *
 * Scenario 1: Student with complete identity profile sees their details
 * Scenario 2: Student without a profile picture sees a placeholder
 * Scenario 3: Profile tab reflects updated values after editing
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: null }),
    signOut: jest.fn(),
  },
}));

const mockGetMyProfile = jest.fn();
jest.mock("@/utils/trpc", () => ({
  trpc: {
    profile: {
      getMyProfile: {
        queryOptions: () => ({ queryKey: ["profile"], queryFn: mockGetMyProfile }),
      },
    },
  },
}));

import ProfileScreen from "../app/(tabs)/profile";

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProfileScreen />
    </QueryClientProvider>,
  );
}

describe("#281 — Profile tab display", () => {
  beforeEach(() => mockGetMyProfile.mockReset());

  describe("Scenario 1: complete identity profile", () => {
    it("shows full name and profile picture", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: { name: "Sander", surname: "Boer", image: "data:image/jpeg;base64,abc", email: "s.boer@student.tue.nl" },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      const fullName = await screen.findByText("Sander Boer");
      expect(fullName).toBeTruthy();

      const picture = await screen.findByLabelText("Profile picture");
      expect(picture).toBeTruthy();
    });
  });

  describe("Scenario 2: no profile picture → placeholder", () => {
    it("shows placeholder avatar when image is null", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: { name: "Sander", surname: "Boer", image: null, email: "s.boer@student.tue.nl" },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      const placeholder = await screen.findByLabelText("Profile picture placeholder");
      expect(placeholder).toBeTruthy();

      const fullName = await screen.findByText("Sander Boer");
      expect(fullName).toBeTruthy();
    });
  });

  describe("Scenario 3: updated values reflected", () => {
    it("displays latest name and surname from getMyProfile", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: { name: "Alex", surname: "Updated", image: null, email: "a.updated@student.tue.nl" },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      const fullName = await screen.findByText("Alex Updated");
      expect(fullName).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("shows only name when surname is null", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: { name: "Sander", surname: null, image: null, email: "s@student.tue.nl" },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      const nameText = await screen.findByText("Sander");
      expect(nameText).toBeTruthy();
    });
  });
});
