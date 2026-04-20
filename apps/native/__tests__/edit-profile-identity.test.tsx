/**
 * Tests for task #279 — Add name, surname, and picture to profile screen
 *
 * Scenario 1: Name and surname auto-save on blur
 * Scenario 2: Picture auto-saves and previews on selection
 * Scenario 3: Pre-filled values for existing profile
 * Scenario 4: Dialog on missing name/surname
 * Scenario 5: Proceeds to review with both fields filled
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Alert } from "react-native";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSetIdentityProfile = jest.fn();
const mockGetMyProfile = jest.fn();
jest.mock("@/utils/trpc", () => ({
  trpc: {
    profile: {
      getMyProfile: { queryOptions: () => ({ queryKey: ["profile"], queryFn: mockGetMyProfile }) },
      setIdentityProfile: { mutationOptions: () => ({ mutationFn: mockSetIdentityProfile }) },
      upsertLanguage: { mutationOptions: () => ({ mutationFn: jest.fn() }) },
      removeLanguage: { mutationOptions: () => ({ mutationFn: jest.fn() }) },
      toggleInterest: { mutationOptions: () => ({ mutationFn: jest.fn() }) },
    },
  },
  queryClient: { invalidateQueries: jest.fn() },
}));

const mockPickAndEncode = jest.fn();
jest.mock("@/utils/profile-picture", () => ({
  pickAndEncodeProfilePicture: () => mockPickAndEncode(),
}));

import EditProfileScreen from "../app/edit-profile";

const EMPTY_PROFILE = {
  identity: { name: "", surname: null, image: null, email: "s.janssen@student.tue.nl" },
  profile: null,
  languages: [],
  interests: [],
};

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <EditProfileScreen />
    </QueryClientProvider>,
  );
}

describe("#279 — Profile screen identity section", () => {
  beforeEach(() => {
    mockGetMyProfile.mockReset();
    mockSetIdentityProfile.mockReset();
    mockPickAndEncode.mockReset();
    mockPush.mockReset();
    mockSetIdentityProfile.mockResolvedValue({ success: true });
  });

  describe("Scenario 3: pre-filled values for existing profile", () => {
    it("pre-fills name and surname from existing profile data", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: { name: "Sander", surname: "Boer", image: null, email: "s.boer@student.tue.nl" },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      const nameInput = await screen.findByTestId("name-input");
      const surnameInput = await screen.findByTestId("surname-input");
      expect(nameInput.props.value).toBe("Sander");
      expect(surnameInput.props.value).toBe("Boer");
    });

    it("pre-fills from email when name is empty", async () => {
      mockGetMyProfile.mockResolvedValue(EMPTY_PROFILE);

      renderScreen();

      const nameInput = await screen.findByTestId("name-input");
      const surnameInput = await screen.findByTestId("surname-input");
      expect(nameInput.props.value).toBe("S");
      expect(surnameInput.props.value).toBe("Janssen");
    });
  });

  describe("Scenario 1: auto-save on blur", () => {
    it("calls setIdentityProfile when both name and surname are filled on blur", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: { name: "Sander", surname: "Boer", image: null, email: "s.boer@student.tue.nl" },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      const nameInput = await screen.findByTestId("name-input");
      fireEvent.changeText(nameInput, "Alex");
      fireEvent(nameInput, "blur");

      await waitFor(() => {
        expect(mockSetIdentityProfile).toHaveBeenCalledWith(
          expect.objectContaining({ name: "Alex", surname: "Boer" }),
          expect.anything(),
        );
      });
    });

    it("does not save when name is empty on blur", async () => {
      mockGetMyProfile.mockResolvedValue(EMPTY_PROFILE);

      renderScreen();

      const nameInput = await screen.findByTestId("name-input");
      fireEvent.changeText(nameInput, "");
      fireEvent(nameInput, "blur");

      await waitFor(() => {
        expect(mockSetIdentityProfile).not.toHaveBeenCalled();
      });
    });
  });

  describe("Scenario 4: dialog on missing name/surname", () => {
    it("shows alert when Review is pressed with empty name", async () => {
      mockGetMyProfile.mockResolvedValue(EMPTY_PROFILE);
      const alertSpy = jest.spyOn(Alert, "alert");

      renderScreen();

      const surnameInput = await screen.findByTestId("surname-input");
      fireEvent.changeText(surnameInput, "Boer");

      const nameInput = await screen.findByTestId("name-input");
      fireEvent.changeText(nameInput, "");

      const reviewButton = screen.getByTestId("review-submit-button");
      fireEvent.press(reviewButton);

      expect(alertSpy).toHaveBeenCalledWith(
        "Required fields missing",
        expect.stringContaining("Name"),
        expect.any(Array),
      );
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("Scenario 5: proceeds to review with both fields filled", () => {
    it("navigates to review-profile when both fields are present", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: { name: "Sander", surname: "Boer", image: null, email: "s.boer@student.tue.nl" },
        profile: null,
        languages: [],
        interests: [],
      });

      renderScreen();

      await screen.findByTestId("name-input");

      const reviewButton = screen.getByTestId("review-submit-button");
      fireEvent.press(reviewButton);

      expect(mockPush).toHaveBeenCalledWith("/review-profile");
    });
  });

  describe("Scenario 2: picture auto-saves and previews on selection", () => {
    it("calls setIdentityProfile with imageUrl when picture is selected", async () => {
      mockGetMyProfile.mockResolvedValue({
        identity: { name: "Sander", surname: "Boer", image: null, email: "s.boer@student.tue.nl" },
        profile: null,
        languages: [],
        interests: [],
      });
      mockPickAndEncode.mockResolvedValue({ imageDataUri: "data:image/jpeg;base64,abc", error: null });

      renderScreen();

      const pickButton = await screen.findByTestId("pick-picture-button");
      fireEvent.press(pickButton);

      await waitFor(() => {
        expect(mockSetIdentityProfile).toHaveBeenCalledWith(
          expect.objectContaining({ imageUrl: "data:image/jpeg;base64,abc" }),
          expect.anything(),
        );
      });
    });
  });
});
