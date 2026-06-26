/**
 * Tests for task #457 — enrolment consent wording distinguishes
 * "agree" (Terms of Use, Community Code) from "acknowledge" (Privacy Statement).
 */
import { render, screen } from "@testing-library/react-native";
import React from "react";

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));

jest.mock("@/lib/auth-client", () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: jest.fn() },
    signIn: { emailOtp: jest.fn() },
  },
}));

jest.mock("@/utils/trpc", () => ({
  queryClient: { refetchQueries: jest.fn() },
}));

import EnrolmentScreen from "../app/enrolment";

describe("#457 — enrolment consent wording", () => {
  it("renders one consent sentence: agree to Terms of Use and Community Code, acknowledge Privacy Statement", () => {
    render(<EnrolmentScreen />);

    // Full composed sentence locks the agree-vs-acknowledge distinction so neither
    // verb can drift onto the wrong document.
    expect(
      screen.getByText(
        "By joining you agree to our Terms of Use and Community Code, and acknowledge our Privacy Statement.",
      ),
    ).toBeTruthy();
  });

  it("uses 'agree to' for the contractual documents", () => {
    render(<EnrolmentScreen />);
    expect(screen.getByText(/agree to our/)).toBeTruthy();
  });

  it("uses 'acknowledge' only for the Privacy Statement", () => {
    render(<EnrolmentScreen />);
    expect(screen.getByText(/, and acknowledge our/)).toBeTruthy();
  });

  it("keeps Terms of Use, Community Code, and Privacy Statement as discrete named documents", () => {
    render(<EnrolmentScreen />);
    expect(screen.getByText("Terms of Use")).toBeTruthy();
    expect(screen.getByText("Community Code")).toBeTruthy();
    expect(screen.getByText("Privacy Statement")).toBeTruthy();
  });
});
